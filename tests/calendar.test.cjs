const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function fixture() {
    const puts = [], removes = [];
    let records = [], failPut = null, failRemove = null, seq = 0;
    const kvMap = new Map();
    const unwrap = value => value.startsWith('enc(') ? value.slice(4, -1) : value;
    const kv = {
        list: async () => [...kvMap].map(([key, value]) => ({ key, value })),
        get: async key => kvMap.has(key) ? { key, value: kvMap.get(key) } : null,
        put: async (key, value) => { if (failPut) throw failPut; puts.push([key, value]); kvMap.set(key, value); },
        add: async (key, value) => { if (kvMap.has(key)) throw Object.assign(Error('Exists'), { code: 'AlreadyExists' }); kvMap.set(key, value); },
        remove: async key => { if (failRemove) throw failRemove; removes.push(key); kvMap.delete(key); },
    };
    const CList = { storage: { kv } };
    const ctx = vm.createContext({ structuredClone, window: { CList }, console: { log() {}, error() {} }, crypto: { randomUUID: () => 'new-id' },
        assertCollectionSession: session => { if (!session.token) throw Error('This calendar operation is no longer current.'); },
        prepareCollectionSession: async session => { if (!session.token) throw Error('This calendar operation is no longer current.'); session.encKey ||= 'key'; },
        kvErrorMessage: err => `kvstore error: ${err.message}`,
        encryptWithKey: async (key, plaintext) => `enc(${plaintext})`,
        decryptKVJson: async (key, value) => JSON.parse(unwrap(value)),
        // Hand-rolled, not the real collection-session.js, so existing calendar.test.cjs
        // sessions (plain { token }, no storeUrl/username) keep working unchanged.
        collectionDependencies: session => ({
            assertSession: () => { if (!session.token) throw Error('This calendar operation is no longer current.'); },
            parse: raw => Array.isArray(raw) ? { id: null, title: null, items: raw, publishedUrls: [] }
                : { id: raw.id || null, title: raw.title || null, items: raw.items || [], publishedUrls: raw.publishedUrls || [] },
            list: () => kv.list(), get: key => kv.get(key),
            decrypt: async value => JSON.parse(unwrap(value)),
            encrypt: async value => `enc(${value})`,
            put: (key, value) => kv.put(key, value), add: (key, value) => kv.add(key, value),
            update: (key, value) => kv.put(key, value), remove: key => kv.remove(key),
            createIdentity: () => ({ key: 'collection:new-' + (++seq), id: 'urn:uuid:' + seq }),
            createMemberId: () => 'member-' + (++seq),
        }),
        fetchDecryptedKvRecordsByPrefix: async (prefix, encKey) =>
            records.filter(record => record.key.startsWith(prefix)).map(record => ({ key: record.key, value: JSON.parse(record.value) })),
    });
    for (const name of ['collection-workflow', 'calendar']) vm.runInContext(fs.readFileSync('js/' + name + '.js', 'utf8'), ctx);
    return { ctx, puts, removes, kvMap,
        setRecords: events => { records = events.map(event => ({ key: 'calendar:' + event.id, value: JSON.stringify(event) })); },
        failPut: err => failPut = err, failRemove: err => failRemove = err };
}
const session = () => ({ token: 'token' });

test('listCalendarEvents decrypts all stored events and filters an optional overlap range client-side', async () => {
    const f = fixture();
    f.setRecords([
        { id: 'a', title: 'Early', start: '2026-01-01T10:00:00.000Z' },
        { id: 'b', title: 'Mid', start: '2026-01-10T10:00:00.000Z', end: '2026-01-10T12:00:00.000Z' },
        { id: 'c', title: 'Late', start: '2026-02-01T10:00:00.000Z' },
    ]);
    assert.equal((await f.ctx.listCalendarEvents({ session: session() })).length, 3);
    const inRange = await f.ctx.listCalendarEvents({ start: '2026-01-05', end: '2026-01-15', session: session() });
    assert.deepEqual(inRange.map(event => event.id), ['b']);
});

test('listCalendarEvents rejects a session that is no longer current before touching storage', async () => {
    const f = fixture();
    await assert.rejects(f.ctx.listCalendarEvents({ session: {} }), /no longer current/);
});

test('getCalendarEvent returns the matching event or null', async () => {
    const f = fixture();
    f.setRecords([{ id: 'a', title: 'Only', start: '2026-01-01T00:00:00.000Z' }]);
    assert.equal((await f.ctx.getCalendarEvent('a', session())).title, 'Only');
    assert.equal(await f.ctx.getCalendarEvent('missing', session()), null);
});

test('saveCalendarEvent assigns a fresh id and encrypts under the calendar: prefix for a new event', async () => {
    const f = fixture();
    const saved = await f.ctx.saveCalendarEvent({ title: 'New', start: '2026-03-01T00:00:00.000Z' }, session());
    assert.equal(saved.id, 'new-id'); assert.equal(saved.created, saved.updated);
    assert.equal(f.puts.length, 1); assert.equal(f.puts[0][0], 'calendar:new-id');
    assert.equal(f.puts[0][1], `enc(${JSON.stringify(saved)})`);
});

test('saveCalendarEvent preserves id and created while bumping updated for an edit', async () => {
    const f = fixture();
    const existing = { id: 'a', title: 'Old', start: '2026-01-01T00:00:00.000Z', created: 1000, updated: 1000 };
    const saved = await f.ctx.saveCalendarEvent({ ...existing, title: 'Renamed' }, session());
    assert.equal(saved.id, 'a'); assert.equal(saved.created, 1000); assert.ok(saved.updated >= 1000);
    assert.equal(f.puts[0][0], 'calendar:a');
});

test('saveCalendarEvent wraps a storage failure via kvErrorMessage', async () => {
    const f = fixture(); f.failPut(Object.assign(Error('offline'), { code: 'Indeterminate' }));
    await assert.rejects(f.ctx.saveCalendarEvent({ title: 'X', start: '2026-01-01T00:00:00.000Z' }, session()), /kvstore error: offline/);
});

test('deleteCalendarEvent removes the prefixed key and wraps a storage failure via kvErrorMessage', async () => {
    const f = fixture();
    await f.ctx.deleteCalendarEvent('a', session());
    assert.deepEqual(f.removes, ['calendar:a']);
    f.failRemove(Object.assign(Error('offline'), { code: 'Indeterminate' }));
    await assert.rejects(f.ctx.deleteCalendarEvent('b', session()), /kvstore error: offline/);
});

test('listEventsForCollection resolves only this collection\'s referenced events, sorted by start, ignoring other roles', async () => {
    const f = fixture();
    f.setRecords([
        { id: 'a', title: 'A', start: '2026-01-10T00:00:00.000Z' },
        { id: 'b', title: 'B', start: '2026-01-01T00:00:00.000Z' },
        { id: 'c', title: 'C', start: '2026-01-05T00:00:00.000Z' },
    ]);
    const collection = { items: [
        { role: 'event', eventId: 'a' },
        { role: 'event', eventId: 'c' },
        { role: 'contains', collectionId: 'urn:uuid:other' },
        { title: 'leaf', url: 'https://x.invalid' },
    ] };
    const result = await f.ctx.listEventsForCollection(collection, session());
    assert.deepEqual(result.map(event => event.id), ['c', 'a']);
});

test('listEventsForCollection skips fetching events entirely when the collection has no event references', async () => {
    const f = fixture();
    let called = false;
    f.ctx.listCalendarEvents = async () => { called = true; return []; };
    const result = await f.ctx.listEventsForCollection({ items: [{ role: 'contains', collectionId: 'x' }] }, session());
    assert.equal(result.length, 0);
    assert.equal(called, false);
});

test('getCalendarSidebarCollection creates the meta-collection once and reuses it by sentinel key thereafter', async () => {
    const f = fixture();
    const first = await f.ctx.getCalendarSidebarCollection(session());
    assert.equal(first.title, 'Calendar');
    assert.ok(f.kvMap.has('_calendar_sidebar_set_id'));
    const second = await f.ctx.getCalendarSidebarCollection(session());
    assert.equal(second.key, first.key);
    assert.equal(second.id, first.id);
});

test('addCalendarToSidebar nests a calendar collection into the lazily-created sidebar meta-collection', async () => {
    const f = fixture();
    const deps = f.ctx.collectionDependencies(session());
    const { collection: calendarCollection } = await f.ctx.addCollectionMembership(null, 'Work',
        { role: 'event', eventId: 'e1', title: 'E1', start: '2026-01-01T00:00:00.000Z', allDay: false }, deps);
    const { collection } = await f.ctx.addCalendarToSidebar(calendarCollection, session());
    assert.equal(collection.items.length, 1);
    assert.equal(collection.items[0].role, 'contains');
    assert.equal(collection.items[0].collectionId, calendarCollection.id);
});

test('removeCalendarFromSidebar removes only this calendar\'s reference from the sidebar meta-collection', async () => {
    const f = fixture();
    const deps = f.ctx.collectionDependencies(session());
    const { collection: workCalendar } = await f.ctx.addCollectionMembership(null, 'Work',
        { role: 'event', eventId: 'e1', title: 'E1', start: '2026-01-01T00:00:00.000Z', allDay: false }, deps);
    const { collection: homeCalendar } = await f.ctx.addCollectionMembership(null, 'Home',
        { role: 'event', eventId: 'e2', title: 'E2', start: '2026-01-02T00:00:00.000Z', allDay: false }, deps);
    await f.ctx.addCalendarToSidebar(workCalendar, session());
    await f.ctx.addCalendarToSidebar(homeCalendar, session());
    const sidebar = await f.ctx.removeCalendarFromSidebar(workCalendar, session());
    assert.equal(sidebar.items.length, 1);
    assert.equal(sidebar.items[0].collectionId, homeCalendar.id);
});

test('removeCalendarFromSidebar is a no-op returning the sidebar unchanged when the calendar is not referenced', async () => {
    const f = fixture();
    const sidebar = await f.ctx.removeCalendarFromSidebar({ id: 'urn:uuid:never-added' }, session());
    assert.equal(sidebar.items.length, 0);
});

test('migrateLegacyCalendarEvents is a no-op but still marks the sentinel when there are no pre-existing events', async () => {
    const f = fixture();
    const result = await f.ctx.migrateLegacyCalendarEvents(session());
    assert.equal(result, null);
    assert.ok(f.kvMap.has('_calendar_migration_v1'));
    assert.ok(![...f.kvMap.keys()].some(key => key.startsWith('collection:')), 'no collection created when nothing to migrate');
});

test('migrateLegacyCalendarEvents creates "My Calendar" from every pre-existing event exactly once, wires it into the sidebar, then no-ops on a second call', async () => {
    const f = fixture();
    f.setRecords([
        { id: 'a', title: 'A', start: '2026-01-01T00:00:00.000Z' },
        { id: 'b', title: 'B', start: '2026-01-02T00:00:00.000Z' },
    ]);
    const myCalendar = await f.ctx.migrateLegacyCalendarEvents(session());
    assert.equal(myCalendar.title, 'My Calendar');
    assert.equal(myCalendar.items.length, 2);
    assert.equal(myCalendar.type, 'calendar');
    const sidebar = await f.ctx.getCalendarSidebarCollection(session());
    assert.equal(sidebar.items.length, 1);
    assert.equal(sidebar.items[0].collectionId, myCalendar.id);

    const again = await f.ctx.migrateLegacyCalendarEvents(session());
    assert.equal(again, null, 'second call is a no-op');
    const sidebarAfter = await f.ctx.getCalendarSidebarCollection(session());
    assert.equal(sidebarAfter.items.length, 1, 'no duplicate wiring from a repeated call');
});

test('applyEventToCollection adds a role:event membership snapshot without flipping type when events stay the minority', async () => {
    const f = fixture();
    const deps = f.ctx.collectionDependencies(session());
    const { collection } = await f.ctx.addCollectionMembership(null, 'Work', { title: 'leaf', url: 'https://x.invalid' }, deps);
    const event = { id: 'e1', title: 'Standup', start: '2026-01-01T10:00:00.000Z', allDay: false };
    const updated = await f.ctx.applyEventToCollection(collection, event, session());
    assert.equal(updated.items.length, 2);
    const added = updated.items.find(item => item.role === 'event');
    assert.equal(added.eventId, 'e1'); assert.equal(added.title, 'Standup');
    assert.equal(updated.type, undefined, 'one event out of two is not a majority');
});

test('applyEventToCollection refreshes an existing membership\'s cached snapshot instead of duplicating it', async () => {
    const f = fixture();
    const deps = f.ctx.collectionDependencies(session());
    const start = '2026-01-01T10:00:00.000Z';
    const { collection } = await f.ctx.addCollectionMembership(null, 'Work',
        { role: 'event', eventId: 'e1', title: 'Standup', start, allDay: false }, deps);
    assert.equal(collection.type, 'calendar');
    const renamed = { id: 'e1', title: 'Standup (renamed)', start, allDay: false };
    const updated = await f.ctx.applyEventToCollection(collection, renamed, session());
    assert.equal(updated.items.length, 1);
    assert.equal(updated.items[0].title, 'Standup (renamed)');
});

test('applyEventToCollection rejects when the collection can no longer be found', async () => {
    const f = fixture();
    await assert.rejects(
        f.ctx.applyEventToCollection({ key: 'collection:missing' }, { id: 'e1', title: 'X', start: '2026-01-01T00:00:00.000Z' }, session()),
        /could not be found/);
});

test('removeEventFromCollection removes only this collection\'s reference, leaves other items intact, and recomputes type', async () => {
    const f = fixture();
    const deps = f.ctx.collectionDependencies(session());
    let result = await f.ctx.addCollectionMembership(null, 'Work',
        { role: 'event', eventId: 'e1', title: 'A', start: '2026-01-01T00:00:00.000Z', allDay: false }, deps);
    result = await f.ctx.addCollectionMembership(result.collection, 'Work', { title: 'leaf', url: 'https://x.invalid' }, deps);
    assert.equal(result.collection.type, undefined, 'one event out of two is not a majority');
    const updated = await f.ctx.removeEventFromCollection(result.collection, { id: 'e1' }, session());
    assert.equal(updated.items.length, 1);
    assert.equal(updated.items[0].url, 'https://x.invalid');
});

test('removeEventFromCollection is a no-op returning the unchanged collection when the event is not a member', async () => {
    const f = fixture();
    const deps = f.ctx.collectionDependencies(session());
    const { collection } = await f.ctx.addCollectionMembership(null, 'Work', { title: 'leaf', url: 'https://x.invalid' }, deps);
    const updated = await f.ctx.removeEventFromCollection(collection, { id: 'missing' }, session());
    assert.equal(updated.items.length, 1);
});

test('removeEventFromCollection returns null when the collection itself cannot be found', async () => {
    const f = fixture();
    const result = await f.ctx.removeEventFromCollection({ key: 'collection:missing' }, { id: 'e1' }, session());
    assert.equal(result, null);
});
