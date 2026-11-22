/// <reference path="./clist-types.js" />
console.log('[calendar] calendar.js loading');
// calendar.js — kvstore-backed calendar events; the single source of truth for
// calendar-based events in CList. Depends on: utilities.js
// (fetchDecryptedKvRecordsByPrefix, kvErrorMessage), crypto_utils.js
// (encryptWithKey), collection-session.js (assertCollectionSession,
// prepareCollectionSession — the session shape is a generic storage
// auth/crypto session, not collection-specific, so calendar reuses it rather
// than duplicating it under a new name).
// No DOM here — calendar-browser.js/calendar-browser-view.js own presentation.

const _CALENDAR_KEY_PREFIX = 'calendar:';

// List stored events, optionally filtered to those overlapping [start, end]
// (both ISO 8601 datetimes). No server-side filter support, so this filters
// client-side after list+decrypt, the same constraint collections already
// live with (see docs/storage-model.md).
/** @param {{start?: string, end?: string, session: CListCollectionSession}} args @returns {Promise<CListCalendarEvent[]>} */
async function listCalendarEvents({ start, end, session } = {}) {
    await prepareCollectionSession(session);
    const records = await fetchDecryptedKvRecordsByPrefix(_CALENDAR_KEY_PREFIX, session.encKey);
    const events = records.map(record => record.value).filter(event => event && event.id);
    if (!start && !end) return events;
    const rangeStart = start ? new Date(start).getTime() : -Infinity;
    const rangeEnd = end ? new Date(end).getTime() : Infinity;
    return events.filter(event => {
        const eventStart = new Date(event.start).getTime();
        const eventEnd = event.end ? new Date(event.end).getTime() : eventStart;
        return eventEnd >= rangeStart && eventStart <= rangeEnd;
    });
}

/** @param {string} id @param {CListCollectionSession} session @returns {Promise<CListCalendarEvent|null>} */
async function getCalendarEvent(id, session) {
    await prepareCollectionSession(session);
    const records = await fetchDecryptedKvRecordsByPrefix(_CALENDAR_KEY_PREFIX, session.encKey);
    return records.find(record => record.value?.id === id)?.value || null;
}

// Insert or update by id — a missing id means a brand-new event.
/** @param {CListCalendarEvent} event @param {CListCollectionSession} session @returns {Promise<CListCalendarEvent>} */
async function saveCalendarEvent(event, session) {
    await prepareCollectionSession(session);
    const now = Date.now();
    const saved = { ...event, id: event.id || crypto.randomUUID(), created: event.created || now, updated: now };
    const encrypted = await encryptWithKey(session.encKey, JSON.stringify(saved));
    try {
        await window.CList.storage.kv.put(_CALENDAR_KEY_PREFIX + saved.id, encrypted);
    } catch (err) {
        throw new Error(kvErrorMessage(err));
    }
    return saved;
}

/** @param {string} id @param {CListCollectionSession} session */
async function deleteCalendarEvent(id, session) {
    await prepareCollectionSession(session);
    try {
        await window.CList.storage.kv.remove(_CALENDAR_KEY_PREFIX + id);
    } catch (err) {
        throw new Error(kvErrorMessage(err));
    }
}

// A calendar is a collection whose members are role:'event' references
// (collection-workflow.js). Events stay independently stored; this just
// resolves the subset of them a given collection currently references,
// sorted for display. One listCalendarEvents() call, filtered client-side,
// rather than one getCalendarEvent() round-trip per membership row.
/** @param {CListCollectionBrowseRecord} collection @param {CListCollectionSession} session @returns {Promise<CListCalendarEvent[]>} */
async function listEventsForCollection(collection, session) {
    const ids = new Set(collection.items.filter(item => item.role === 'event').map(item => item.eventId));
    if (!ids.size) return [];
    const all = await listCalendarEvents({ session });
    return all.filter(event => ids.has(event.id)).sort((a, b) => a.start.localeCompare(b.start));
}

// One-time KV marker for the sidebar meta-collection's identity (its own key/id), found
// by sentinel rather than by title so renaming it in My Collections never breaks the
// top-level Calendar button. Created lazily on first use, same createIdentity()+createOnly
// path any brand-new collection goes through.
const _CALENDAR_SIDEBAR_KEY = '_calendar_sidebar_set_id';

/** @param {CListCollectionSession} session @returns {Promise<CListCollectionBrowseRecord>} */
async function getCalendarSidebarCollection(session) {
    await prepareCollectionSession(session);
    const deps = collectionDependencies(session);
    const kv = window.CList.storage.kv;
    const marker = typeof kv.get === 'function' ? await kv.get(_CALENDAR_SIDEBAR_KEY)
        : (await kv.list() || []).find(record => record.key === _CALENDAR_SIDEBAR_KEY);
    if (marker) {
        const pointer = await decryptKVJson(session.encKey, marker.value);
        const snapshot = await readCollectionSnapshot(pointer.key, deps);
        if (snapshot) return snapshot;
    }
    const identity = deps.createIdentity();
    const created = { ...identity, title: 'Calendar', name: 'Calendar', items: [], publishedUrls: [] };
    const saved = await saveCollectionRecord(created.key, created, deps, { createOnly: true });
    await prepareCollectionSession(session);
    const encrypted = await encryptWithKey(session.encKey, JSON.stringify({ key: saved.key, id: saved.id }));
    await kv.add(_CALENDAR_SIDEBAR_KEY, encrypted);
    return saved;
}

// Adds (or re-adds) `calendarCollection` as a role:'contains' reference inside the sidebar
// meta-collection -- the same membership mechanism Collections already uses for nesting one
// collection inside another, reused unchanged rather than inventing a new reference shape.
/** @param {CListCollectionBrowseRecord} calendarCollection @param {CListCollectionSession} session */
async function addCalendarToSidebar(calendarCollection, session) {
    await prepareCollectionSession(session);
    const deps = collectionDependencies(session);
    const sidebar = await getCalendarSidebarCollection(session);
    const member = { role: 'contains', collectionId: calendarCollection.id, title: calendarCollection.title };
    return addCollectionMembership(sidebar, sidebar.title, member, deps);
}

// Removes `calendarCollection`'s role:'contains' reference from the sidebar meta-collection --
// never the calendar collection itself, which may still be reached directly from My
// Collections. Symmetric with addCalendarToSidebar() above.
/** @param {CListCollectionBrowseRecord} calendarCollection @param {CListCollectionSession} session */
async function removeCalendarFromSidebar(calendarCollection, session) {
    await prepareCollectionSession(session);
    const deps = collectionDependencies(session);
    const sidebar = await getCalendarSidebarCollection(session);
    const member = sidebar.items.find(item => item.role === 'contains' && item.collectionId === calendarCollection.id);
    if (!member) return sidebar;
    return removeCollectionMembership(sidebar, member, deps);
}

// One-time, idempotent migration from the pre-collection calendar architecture (every event
// was its own untethered calendar:{id} record with no grouping document) into a "My Calendar"
// collection, wired into the sidebar meta-collection so the top-level Calendar button shows
// exactly what it did before -- zero extra steps for an existing account. Gated on a sentinel
// key, not on title text (titles are user-renamable and not a safe uniqueness check), and
// written even when there was nothing to migrate so later loads short-circuit on one cheap
// key check instead of re-listing every calendar:{id} record forever.
const _CALENDAR_MIGRATION_KEY = '_calendar_migration_v1';

/** @param {CListCollectionSession} session @returns {Promise<CListCollectionBrowseRecord|null>} */
async function migrateLegacyCalendarEvents(session) {
    await prepareCollectionSession(session);
    const kv = window.CList.storage.kv;
    const already = typeof kv.get === 'function' ? await kv.get(_CALENDAR_MIGRATION_KEY)
        : (await kv.list() || []).find(record => record.key === _CALENDAR_MIGRATION_KEY);
    if (already) return null;
    const deps = collectionDependencies(session);
    const events = await listCalendarEvents({ session });
    let myCalendar = null;
    if (events.length) {
        let target = null;
        for (const event of events) {
            const member = { role: 'event', eventId: event.id, title: event.title, start: event.start, allDay: !!event.allDay };
            const result = await addCollectionMembership(target, 'My Calendar', member, deps);
            target = result.collection;
        }
        myCalendar = target;
        await addCalendarToSidebar(myCalendar, session);
    }
    await prepareCollectionSession(session);
    const encrypted = await encryptWithKey(session.encKey, JSON.stringify({ migrated: true, at: Date.now() }));
    await kv.add(_CALENDAR_MIGRATION_KEY, encrypted);
    return myCalendar;
}

// Adds -- or, if already present, refreshes -- a role:'event' membership for `event` inside
// `collection`, keeping the same cached title/start/allDay snapshot every other row already
// carries. Shared by calendar-browser.js's own Save action and by event-editor.js's saver
// when it already knows which single collection the event belongs to.
/** @param {CListCollectionBrowseRecord} collection @param {CListCalendarEvent} event @param {CListCollectionSession} session @returns {Promise<CListCollectionBrowseRecord>} */
async function applyEventToCollection(collection, event, session) {
    await prepareCollectionSession(session);
    const deps = collectionDependencies(session);
    const current = await readCollectionSnapshot(collection.key, deps);
    if (!current) throw new Error('This calendar could not be found. Reopen it before saving.');
    const snapshot = { role: 'event', eventId: event.id, title: event.title, start: event.start, allDay: !!event.allDay };
    const index = current.items.findIndex(item => item.role === 'event' && item.eventId === event.id);
    if (index >= 0) current.items[index] = { ...current.items[index], ...snapshot };
    else current.items.push({ ...snapshot, membershipId: deps.createMemberId() });
    _recomputeCollectionType(current);
    return saveCollectionRecord(current.key, current, deps);
}

// Removes just `collection`'s own role:'event' reference to `event' -- never the stand-alone
// calendar:{id} record, since the same event may still belong to other calendars.
/** @param {CListCollectionBrowseRecord} collection @param {CListCalendarEvent} event @param {CListCollectionSession} session @returns {Promise<CListCollectionBrowseRecord|null>} */
async function removeEventFromCollection(collection, event, session) {
    await prepareCollectionSession(session);
    const deps = collectionDependencies(session);
    const current = await readCollectionSnapshot(collection.key, deps);
    if (!current) return null;
    const member = current.items.find(item => item.role === 'event' && item.eventId === event.id);
    if (!member) return current;
    return removeCollectionMembership(current, member, deps);
}
