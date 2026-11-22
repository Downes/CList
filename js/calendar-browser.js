/// <reference path="./clist-types.js" />
// Calendar browsing/editing controller. Events and sessions stay private.
let _calendarBrowserOwner = null;
/** @returns {CListCalendarBrowseState} */
function calendarBrowserState() {
    return window.CList.state.calendarBrowsing ||= { generation: 0, phase: 'idle', confirmId: null, busy: false, error: null,
        visibleKeys: new Set(), sourceErrors: {}, sourcesOpen: false, viewRange: 'Day' };
}
function invalidateCalendarBrowser() { _calendarBrowserOwner = null; }
function currentCalendarBrowser(owner) {
    if (_calendarBrowserOwner !== owner || owner.view.root.isConnected === false) return false;
    const reader = window.CList.state.reader;
    if (reader?.requestId !== owner.readerId || reader?.mode !== owner.readerMode) return false;
    // Compare against a fresh session rather than asserting one (assertCollectionSession would
    // reject "never logged in" outright via its unconditional !token check, but a logged-out
    // visitor is a valid, current state for this view — own events are just empty, and
    // subscriptions need no login either). This still catches a token rotation or account switch
    // that leaves the reader's mode/requestId unchanged. Session validity for a write is asserted
    // explicitly where it's actually used, in runCalendarBrowserAction().
    const live = beginCollectionSession();
    if (owner.session.storeUrl !== live.storeUrl || owner.session.username !== live.username
        || owner.session.token !== live.token) return false;
    return true;
}
// Synthesizes a fake "own calendar" account record and prepends it to the
// real Calendar accounts -- one list drives both the left-pane
// toggle rows and the merge/fetch logic below. `collection`/`merged` only affect the
// synthetic row's display title, never its key, so every call site stays consistent
// about which sources are visible regardless of which one it passes.
function calendarSourceAccounts(collection, merged) {
    const title = merged ? 'My Calendars' : (collection?.title || 'My Calendar');
    const own = { key: '__own__', value: JSON.stringify({ type: 'CalendarOwn', title, permissions: 'r' }) };
    const subs = (window.CList.accounts || []).filter(account => parseAccountValue(account)?.type === 'Calendar');
    return [own, ...subs];
}
// `collection` is the single viewed calendar (showCalendarForCollection) or, in sidebar
// mode, the sidebar meta-collection itself (showCalendarSidebar) -- owner.calendars (the
// real type:'calendar' collections contributing events) is resolved and attached by the
// caller once storage has been read, same as owner.events always has been.
function calendarBrowserOwner(session, collection, { merged = false } = {}) {
    const previous = calendarBrowserState();
    // Toggle visibility is in-memory only and defaults to "all visible" on
    // every fresh entry into the calendar -- no persistence layer, see the
    // Calendar Subscriptions plan.
    const visibleKeys = new Set(calendarSourceAccounts(collection, merged).map(account => account.key));
    const state = window.CList.state.calendarBrowsing = { generation: previous.generation + 1,
        phase: 'loading', confirmId: null, busy: false, error: null, visibleKeys, sourceErrors: {},
        sourcesOpen: false, viewRange: 'Day' };
    const owner = { state, session, collection, calendars: [], isSidebar: merged, events: [], subscriptionEvents: {}, merged: [], renderId: 0,
        readerId: window.CList.state.reader?.requestId, readerMode: window.CList.state.reader?.mode };
    _calendarBrowserOwner = owner;
    owner.view = window.CList.ui.calendarBrowser.mount();
    return owner;
}
// Fetches every owner.calendars collection's events and tags each event in place with
// which collection it came from (same mutate-in-place pattern recomputeMerged already uses
// for sourceKey/readOnly) -- save/delete need to know which collection's membership to
// touch, and an event can be resolved from more than one calendar in sidebar mode.
async function _loadCalendarEvents(owner) {
    const lists = await Promise.all(owner.calendars.map(async collection => {
        const events = await listEventsForCollection(collection, owner.session);
        events.forEach(event => { event._collection = collection; });
        return events;
    }));
    owner.events = lists.flat().sort((a, b) => a.start.localeCompare(b.start));
}
// Lazily creates "My Calendar" and wires it into the sidebar meta-collection -- the same
// blank-collection-then-nest path getCalendarSidebarCollection/migrateLegacyCalendarEvents
// already use, reused here so saving a first event from an empty merged sidebar view never
// has nowhere to go.
async function _createOwnCalendar(session) {
    const deps = collectionDependencies(session);
    const identity = deps.createIdentity();
    const created = { ...identity, title: 'My Calendar', name: 'My Calendar', items: [], publishedUrls: [] };
    const saved = await saveCollectionRecord(created.key, created, deps, { createOnly: true });
    await addCalendarToSidebar(saved, session);
    return saved;
}
// Merges owner.events (own, tagged in place so object identity survives for
// runCalendarBrowserAction's owner.events.includes(selected) check) with
// whichever subscription sources are currently toggled on, sorted by start.
function recomputeMerged(owner) {
    const own = owner.state.visibleKeys.has('__own__')
        ? owner.events.map(event => Object.assign(event, { sourceKey: '__own__', readOnly: false }))
        : [];
    const subs = Object.entries(owner.subscriptionEvents)
        .filter(([key]) => owner.state.visibleKeys.has(key))
        .flatMap(([, events]) => events);
    owner.merged = [...own, ...subs].sort((a, b) => a.start.localeCompare(b.start));
}
// Fetches every currently-visible subscription source via Promise.allSettled
// -- one source's failure is recorded in sourceErrors and contributes zero
// events, but never blocks the others or the user's own events.
async function refreshCalendarSources(owner, { force = false } = {}) {
    const visibleSubs = calendarSourceAccounts(owner.collection, owner.isSidebar)
        .filter(account => account.key !== '__own__' && owner.state.visibleKeys.has(account.key));
    const results = await Promise.allSettled(visibleSubs.map(async account => {
        const parsedValue = parseAccountValue(account);
        return { key: account.key, events: await fetchSubscriptionEvents(account.key, parsedValue, { force }) };
    }));
    if (!currentCalendarBrowser(owner)) return;
    results.forEach((result, index) => {
        const key = visibleSubs[index].key;
        if (result.status === 'fulfilled') {
            owner.subscriptionEvents[key] = result.value.events;
            delete owner.state.sourceErrors[key];
        } else {
            owner.subscriptionEvents[key] = owner.subscriptionEvents[key] || [];
            owner.state.sourceErrors[key] = result.reason?.message || String(result.reason);
        }
    });
    recomputeMerged(owner);
}
// "Add calendar…" picker for the sidebar meta-collection's sources overlay. Inverted from
// openCollectionMembershipPicker's usual shape (there, a known child collection is nested into
// whichever target the user picks): here the container (the sidebar meta-collection) is fixed
// and the user instead picks -- or creates -- which type:'calendar' collection to add into it,
// via addCalendarToSidebar() (calendar.js). Reuses the same picker chrome
// (view.picker/_buildCollectionPickerContents from collection-members(-view).js) rather than a
// one-off modal.
async function _showAddCalendarPicker(owner, anchorEl) {
    const view = window.CList.ui.collectionMembers;
    let pickerOwner;
    try {
        const root = view.picker('calendar-add-picker', anchorEl); if (!root) return;
        pickerOwner = membershipOwner(root, owner.session.token, owner.session.encKey, () => currentCalendarBrowser(owner));
        const current = () => currentMembershipOwner(pickerOwner) && currentCalendarBrowser(owner);
        await prepareCollectionSession(pickerOwner.session);
        const deps = collectionDependencies(pickerOwner.session);
        const result = await listCollectionRecords(deps); if (!current()) return;
        const existingIds = new Set(owner.calendars.map(cal => cal.id));
        const choices = result.collections.filter(record => record.type === 'calendar' && !existingIds.has(record.id));
        root.replaceChildren();
        if (result.warnings.length) console.error('[calendar browser] skipped unreadable records', result.warnings);
        _buildCollectionPickerContents(root, choices, async (title, selected) => {
            if (!current()) return;
            return runCollectionMembership(pickerOwner, async nextDeps => {
                let target = selected;
                if (!target) {
                    const identity = nextDeps.createIdentity();
                    target = await saveCollectionRecord(identity.key,
                        { ...identity, title, name: title, items: [], publishedUrls: [] }, nextDeps, { createOnly: true });
                }
                await addCalendarToSidebar(target, pickerOwner.session);
                if (!current()) return;
                root.remove();
                view.status(`Added "${target.title || title}" to the Calendar view.`);
                showCalendarSidebar();
            });
        }, anchorEl);
    } catch (error) {
        console.error('[calendar browser] add calendar failed', error);
        if (pickerOwner?.root.isConnected !== false && pickerOwner) view.message(pickerOwner.root, 'Could not load calendars: ' + (error?.message || String(error)), true);
        else view.error(error);
    }
}
function runRemoveCalendarFromSidebar(owner, collection) {
    if (!currentCalendarBrowser(owner) || owner.state.busy) return;
    owner.state.busy = true; owner.state.error = null; renderCalendarBrowser(owner);
    removeCalendarFromSidebar(collection, owner.session).then(() => {
        if (currentCalendarBrowser(owner)) showCalendarSidebar();
    }).catch(error => {
        console.error('[calendar browser] remove calendar failed', error);
        if (currentCalendarBrowser(owner)) { owner.state.busy = false; owner.state.error = error?.message || String(error); renderCalendarBrowser(owner); }
        else window.CList.ui.calendarBrowser.error(error);
    });
}
function toggleCalendarSource(owner, key) {
    if (!currentCalendarBrowser(owner)) return;
    const wasVisible = owner.state.visibleKeys.has(key);
    if (wasVisible) owner.state.visibleKeys.delete(key); else owner.state.visibleKeys.add(key);
    recomputeMerged(owner);
    renderCalendarBrowser(owner);
    // A newly-toggled-on subscription that's never been fetched needs its
    // first fetch; fetchSubscriptionEvents' own cache makes a toggle-off-
    // then-on of an already-fetched source a no-op network-wise.
    if (!wasVisible && key !== '__own__') {
        refreshCalendarSources(owner).then(() => { if (currentCalendarBrowser(owner)) renderCalendarBrowser(owner); });
    }
}
// Pure Day/Week/Month window bounds, [start, end). Week starts Monday.
function _calendarRangeBounds(range, now = new Date()) {
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (range === 'Week') {
        const daysSinceMonday = (startOfDay.getDay() + 6) % 7;
        const start = new Date(startOfDay); start.setDate(start.getDate() - daysSinceMonday);
        const end = new Date(start); end.setDate(end.getDate() + 7);
        return [start, end];
    }
    if (range === 'Month') {
        return [new Date(now.getFullYear(), now.getMonth(), 1), new Date(now.getFullYear(), now.getMonth() + 1, 1)];
    }
    const end = new Date(startOfDay); end.setDate(end.getDate() + 1);
    return [startOfDay, end];
}
function _calendarEventsInRange(events, range, now = new Date()) {
    const [start, end] = _calendarRangeBounds(range, now);
    return events.filter(event => {
        const eventStart = new Date(event.start);
        return !isNaN(eventStart.getTime()) && eventStart >= start && eventStart < end;
    });
}
// Toggles the left-pane overlay that lists calendar sources -- same
// open/closed convention as LocalRSS's "Feed Options" overlay (Select
// re-opens it; its own Close button, wired the same way, closes it).
function toggleCalendarSourcesOverlay(owner) {
    if (!currentCalendarBrowser(owner)) return;
    owner.state.sourcesOpen = !owner.state.sourcesOpen;
    renderCalendarBrowser(owner);
}
async function runCalendarPublishAction(owner) {
    if (!currentCalendarBrowser(owner)) return;
    let status;
    try {
        status = await ownCalendarPublishStatus();
    } catch (error) {
        showErrorModal(error.message, { title: 'Could Not Check Publish Status' });
        return;
    }
    if (!currentCalendarBrowser(owner)) return;
    const action = await window.CList.ui.calendarBrowser.publishDialog(status);
    if (!action || !currentCalendarBrowser(owner)) return;
    try {
        if (action === 'publish') {
            await publishOwnCalendar(owner.session);
            window.CList.ui.calendarBrowser.status('Calendar published.');
        } else if (action === 'unpublish') {
            await unpublishOwnCalendar();
            window.CList.ui.calendarBrowser.status('Calendar unpublished.');
        }
    } catch (error) {
        showErrorModal(error.message, { title: 'Publish Failed' });
    }
}
// Placeholder for future calendar options -- opens an empty panel via the
// view, same promise-less direct-call shape as toggleCalendarSourcesOverlay.
function runCalendarOptions(owner) {
    if (!currentCalendarBrowser(owner)) return;
    window.CList.ui.calendarBrowser.optionsDialog();
}
// Single-collection entry point -- "View as Calendar" from a Collection's own detail view.
async function showCalendarForCollection(collection, token, encKey) {
    const view = window.CList.ui.calendarBrowser;
    let owner;
    try {
        if (window.CList.state.reader && window.CList.state.reader.mode !== 'calendar'
            && typeof invalidateReader === 'function') invalidateReader('calendar');
        const session = beginCollectionSession({ token, encKey });
        owner = calendarBrowserOwner(session, collection);
        owner.calendars = [collection];
        view.message(owner.view, 'Loading calendar…');
        await prepareCollectionSession(session);
        if (!currentCalendarBrowser(owner)) return null;
        await _loadCalendarEvents(owner);
        if (!currentCalendarBrowser(owner)) return null;
        recomputeMerged(owner);
        owner.state.phase = 'list'; renderCalendarBrowser(owner);
        // Own events render immediately; subscriptions merge in progressively
        // as each one resolves, so one slow/broken feed never blocks the rest.
        refreshCalendarSources(owner).then(() => { if (currentCalendarBrowser(owner)) renderCalendarBrowser(owner); });
    } catch (error) {
        console.error('[calendar browser] list failed', error);
        if (owner && _calendarBrowserOwner === owner && owner.view.root.isConnected !== false) {
            owner.state.phase = 'failed'; owner.state.error = error?.message || String(error);
            view.message(owner.view, 'Could not load calendar: ' + owner.state.error, true);
        } else view.error(error);
    }
    return null;
}
// Sidebar/merged entry point -- the top-level "Calendar" nav button. Resolves the sidebar
// meta-collection (migrating pre-collection calendar: records into "My Calendar" on first
// use) and fans out across every type:'calendar' collection it references, the same
// merge-many-sources shape refreshCalendarSources already uses for ICS subscriptions, just
// over collections instead of accounts.
async function showCalendarSidebar() {
    const view = window.CList.ui.calendarBrowser;
    let owner;
    try {
        if (window.CList.state.reader && window.CList.state.reader.mode !== 'calendar'
            && typeof invalidateReader === 'function') invalidateReader('calendar');
        const session = beginCollectionSession();
        owner = calendarBrowserOwner(session, null, { merged: true });
        view.message(owner.view, 'Loading calendar…');
        // Not logged in isn't a load failure — the sidebar is simply empty (own calendars live
        // behind kvstore/login), while subscriptions still load below with no login needed.
        // Add/Edit stay available; Save then offers "Download as .ics file" instead of "Save to
        // My Calendar" (event-editor.js, gated by requiresLogin on each saver). A real failure
        // once logged in (bad decrypt, kvstore error, etc.) still falls through to the catch
        // below and shows as an error — only the no-token case is treated as "empty."
        if (session.token) {
            await prepareCollectionSession(session);
            if (!currentCalendarBrowser(owner)) return null;
            await migrateLegacyCalendarEvents(session);
            if (!currentCalendarBrowser(owner)) return null;
            const sidebar = await getCalendarSidebarCollection(session);
            if (!currentCalendarBrowser(owner)) return null;
            const ids = new Set(sidebar.items.filter(item => item.role === 'contains').map(item => item.collectionId));
            const { collections } = ids.size ? await listCollectionRecords(collectionDependencies(session)) : { collections: [] };
            if (!currentCalendarBrowser(owner)) return null;
            owner.collection = sidebar;
            owner.calendars = collections.filter(record => ids.has(record.id) && record.type === 'calendar');
            await _loadCalendarEvents(owner);
        } else {
            owner.calendars = [];
        }
        if (!currentCalendarBrowser(owner)) return null;
        recomputeMerged(owner);
        owner.state.phase = 'list'; renderCalendarBrowser(owner);
        refreshCalendarSources(owner).then(() => { if (currentCalendarBrowser(owner)) renderCalendarBrowser(owner); });
    } catch (error) {
        console.error('[calendar browser] list failed', error);
        if (owner && _calendarBrowserOwner === owner && owner.view.root.isConnected !== false) {
            owner.state.phase = 'failed'; owner.state.error = error?.message || String(error);
            view.message(owner.view, 'Could not load calendar: ' + owner.state.error, true);
        } else view.error(error);
    }
    return null;
}
window.showCalendar = showCalendarSidebar;
function renderCalendarBrowser(owner) {
    if (!currentCalendarBrowser(owner)) return;
    const renderId = ++owner.renderId;
    const guard = callback => (...args) => {
        if (currentCalendarBrowser(owner) && owner.renderId === renderId) return callback(...args);
    };
    window.CList.ui.calendarBrowser.list(owner.view, { events: _calendarEventsInRange(owner.merged, owner.state.viewRange),
        busy: owner.state.busy, confirmId: owner.state.confirmId, error: owner.state.error,
        sourcesOpen: owner.state.sourcesOpen, viewRange: owner.state.viewRange }, {
        add: guard(() => runCalendarEventEdit(owner, null)),
        edit: guard(event => runCalendarEventEdit(owner, event)),
        confirm: guard(id => { if (owner.state.busy) return; owner.state.confirmId = id; renderCalendarBrowser(owner); }),
        remove: guard(event => runCalendarBrowserAction(owner, event, 'delete')),
        select: guard(() => toggleCalendarSourcesOverlay(owner)),
        setView: guard(range => {
            if (!['Day', 'Week', 'Month'].includes(range) || range === owner.state.viewRange) return;
            owner.state.viewRange = range; renderCalendarBrowser(owner);
        }),
    });
    window.CList.ui.calendarBrowser.sources(owner.view, calendarSourceAccounts(owner.collection, owner.isSidebar), owner.state.visibleKeys, {
        toggle: guard(key => toggleCalendarSource(owner, key)),
        refresh: guard(() => refreshCalendarSources(owner, { force: true }).then(() => { if (currentCalendarBrowser(owner)) renderCalendarBrowser(owner); })),
        sourceErrors: owner.state.sourceErrors,
        open: owner.state.sourcesOpen,
        close: guard(() => toggleCalendarSourcesOverlay(owner)),
        publish: guard(() => runCalendarPublishAction(owner)),
        options: guard(() => runCalendarOptions(owner)),
        calendars: (owner.isSidebar && owner.session.token) ? owner.calendars : null,
        addCalendar: guard(anchorEl => _showAddCalendarPicker(owner, anchorEl)),
        removeCalendar: guard(collection => runRemoveCalendarFromSidebar(owner, collection)),
    });
}
// Add/Edit now opens the Event editor in the write pane (js/event-editor.js) instead of a
// buildDialogModal dialog — it performs the save itself via runCalendarBrowserAction() on its
// own Save button, and switches back to whatever editor was active before it.
function runCalendarEventEdit(owner, event) {
    if (!currentCalendarBrowser(owner) || owner.state.busy) return;
    window.openEventEditor(owner, event);
}
async function runCalendarBrowserAction(owner, selected, action, draft) {
    if (!currentCalendarBrowser(owner) || owner.state.busy) return;
    if (selected && !owner.events.includes(selected)) return;
    owner.state.busy = true; owner.state.error = null;
    renderCalendarBrowser(owner);
    try {
        assertCollectionSession(owner.session);
        if (action === 'save') {
            const saved = await saveCalendarEvent({ ...(selected || {}), ...draft }, owner.session);
            if (!currentCalendarBrowser(owner)) return;
            // A new event in single-collection mode goes into that collection; in sidebar mode
            // it goes into the first merged calendar, lazily creating "My Calendar" if none are
            // merged yet -- never left un-filed, even with several calendars merged (ambiguity
            // is deliberately resolved by always-pick-the-first rather than a blocking prompt).
            const target = selected?._collection || (owner.isSidebar
                ? (owner.calendars[0] || await _createOwnCalendar(owner.session)) : owner.collection);
            const updated = await applyEventToCollection(target, saved, owner.session);
            if (!currentCalendarBrowser(owner)) return;
            if (owner.isSidebar) {
                owner.calendars = owner.calendars.some(cal => cal.key === updated.key)
                    ? owner.calendars.map(cal => cal.key === updated.key ? updated : cal)
                    : [...owner.calendars, updated];
            } else { owner.collection = updated; owner.calendars = [updated]; }
            Object.assign(saved, { _collection: updated });
            owner.events = (selected ? owner.events.map(event => event === selected ? saved : event) : [...owner.events, saved])
                .sort((a, b) => a.start.localeCompare(b.start));
            recomputeMerged(owner);
            window.CList.ui.calendarBrowser.status(selected
                ? `Event "${saved.title}" updated.`
                : `Event "${saved.title}" added to "${updated.title}".`);
        } else if (action === 'delete') {
            // Membership removal only -- never deletes the stand-alone calendar: record, since
            // the same event may still belong to other calendars.
            await removeEventFromCollection(selected._collection, selected, owner.session);
            if (!currentCalendarBrowser(owner)) return;
            owner.events = owner.events.filter(event => event !== selected);
            recomputeMerged(owner);
            owner.state.confirmId = null;
            window.CList.ui.calendarBrowser.status(`Event "${selected.title}" removed from "${selected._collection.title}".`);
        }
    } catch (error) {
        console.error('[calendar browser] action failed', error);
        if (currentCalendarBrowser(owner)) owner.state.error = error?.message || String(error);
        else window.CList.ui.calendarBrowser.error(error);
    } finally {
        owner.state.busy = false;
        if (currentCalendarBrowser(owner)) renderCalendarBrowser(owner);
    }
}
