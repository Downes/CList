const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const tick = () => new Promise(resolve => setImmediate(resolve));
const plain = value => JSON.parse(JSON.stringify(value));
function fixture() {
    const items = [], events = [], writes = [], blobs = [];
    let token = 'token', detected = { type: 'text/plain' }, selecting;
    const cList = { state: { username: 'alice' }, config: { flaskSiteUrl: 'https://store.invalid' }, keys: { ACCESS_TOKEN: 'access_token' }, ui: {} };
    const ui = { picker: () => ({ root: { isConnected: true } }), message: (view, text) => events.push(['message', text]),
        render: (view, records, choose) => { selecting = choose; }, busy() {}, close: view => { view.root.isConnected = false; },
        status: text => events.push(['status', text]), error: error => events.push(['error', error.message]) };
    cList.ui.collectionEntries = ui;
    const ctx = vm.createContext({ window: { CList: cList }, structuredClone, console: { error() {} },
        currentEditor: 'collection', currentEditorAccount: null, currentLoadedPage: null, _draftItems: items,
        getSiteSpecificCookie: () => token, recognizeSavedContent: () => detected,
        _resolveCollectionIdentity: (key, id) => ({ key: 'collection:' + (id || 'new'), id: id || 'new' }),
        beginCollectionSession: options => ({ ...options, capturedToken: token }), assertCollectionSession: session => { if (!session.isCurrent() || session.token !== token) throw Error('Session changed'); },
        collectionDependencies: session => ({ session }), saveCollectionRecord: async (...args) => { writes.push(args); return args[1]; },
        URL: { createObjectURL: file => { blobs.push(file.name); return 'blob:fixture'; } }, crypto: { randomUUID: () => 'member-id' },
        _fetchAllCollections: async () => [{ id: 'child', title: 'Child', items: [] }], _fetchAllPublishedPages: async () => [{ id: 'page', title: 'Page', url: 'https://page.invalid', mimeType: 'text/html' }],
        _wouldCreateCycle: async () => false,
    });
    for (const name of ['collection-entry-workflow', 'collection-entry']) vm.runInContext(fs.readFileSync('js/' + name + '.js', 'utf8'), ctx);
    return { ctx, items, events, writes, blobs, ui, cList, select: target => selecting(target), detected: value => { detected = value; }, token: value => { token = value; } };
}
const file = (read = async () => new ArrayBuffer(0)) => ({ name: 'Exact.wrong', type: 'application/xml', arrayBuffer: read });

test('entry file classification precedes blob creation and keeps exact filename/MIME without storage writes', async () => {
    const f = fixture(); let refreshed = 0;
    await f.ctx._addEntryFromFile(file(), f.items, {}, null, null, () => refreshed++);
    assert.deepEqual(plain(f.items), [{ membershipId: 'member-id', title: 'Exact.wrong', url: 'blob:fixture', mimeType: 'text/plain', localOnly: true }]);
    assert.equal(f.writes.length, 0); assert.equal(refreshed, 1); assert.equal(f.blobs.length, 1);
});

test('nested collection file saves a detached native record with add-only semantics before appending membership', async () => {
    const f = fixture(), parsed = { id: 'child', title: 'Imported', items: [{ url: 'https://item.invalid' }], custom: { retained: true } };
    f.detected({ collection: parsed }); const targets = { collections: new Set() };
    await f.ctx._addEntryFromFile(file(), f.items, { id: 'parent' }, 'token', 'key', () => {}, targets);
    assert.equal(f.writes.length, 1); assert.equal(f.writes[0][3].createOnly, true);
    assert.deepEqual(plain(f.writes[0][1].custom), { retained: true }); assert.equal(f.items[0].collectionId, 'child');
    assert.equal(targets.collections.has('child'), true); assert.equal(f.blobs.length, 0); assert.equal(parsed.publishedUrls, undefined);
});

test('nested file identity conflicts and self-containing imports never append a membership', async () => {
    const f = fixture(); f.detected({ collection: { id: 'parent', title: 'Self', items: [] } });
    await f.ctx._addEntryFromFile(file(), f.items, { id: 'parent' }, 'token', 'key', () => {});
    assert.equal(f.writes.length, 0); assert.equal(f.items.length, 0); assert.match(f.events.at(-1)[1], /contain its parent/);
    f.detected({ collection: { id: 'child', title: 'Child', items: [] } }); f.ctx.saveCollectionRecord = async () => { throw Error('Already exists'); };
    await f.ctx._addEntryFromFile(file(), f.items, { id: 'parent' }, 'token', 'key', () => {});
    assert.equal(f.items.length, 0); assert.match(f.events.at(-1)[1], /Already exists/);
});

test('late file bytes and duplicate file clicks cannot append to a replacement draft or create blobs', async () => {
    const f = fixture(); let finish; const slow = file(() => new Promise(resolve => finish = resolve));
    const pending = f.ctx._addEntryFromFile(slow, f.items, {}, null, null, () => {});
    assert.equal(await f.ctx._addEntryFromFile(slow, f.items, {}, null, null, () => {}), false);
    f.ctx._draftItems = []; finish(new ArrayBuffer(0)); await pending;
    assert.equal(f.blobs.length, 0); assert.equal(f.items.length, 0);
});

test('existing resource choices append captured metadata once and retain live unsaved edits', async () => {
    const f = fixture(), target = { pages: new Map(), collections: new Set() };
    await f.ctx._showAddEntryFromExistingPicker(f.items, { id: 'parent' }, 'token', 'key', () => {}, {}, target);
    const page = { id: 'page', title: 'Original page', url: 'https://page.invalid', mimeType: 'text/html', custom: 'retained' };
    const pending = f.select({ kind: 'page', record: page }); await f.select({ kind: 'page', record: page }); await pending;
    assert.equal(f.items.length, 1); assert.equal(f.items[0].title, 'Original page'); assert.equal(target.pages.get(page.url).custom, 'retained');
});

test('existing collection cycle checks and session changes prevent draft mutations', async () => {
    const f = fixture(); f.ctx._wouldCreateCycle = async () => true;
    await f.ctx._showAddEntryFromExistingPicker(f.items, { id: 'parent' }, 'token', 'key', () => {}, {});
    await f.select({ kind: 'collection', record: { id: 'child', title: 'Child' } });
    assert.equal(f.items.length, 0); assert.match(f.events.at(-1)[1], /contains the parent/);
    const g = fixture(); let finish; g.ctx._wouldCreateCycle = () => new Promise(resolve => finish = resolve);
    await g.ctx._showAddEntryFromExistingPicker(g.items, { id: 'parent' }, 'token', 'key', () => {}, {});
    const pending = g.select({ kind: 'collection', record: { id: 'child', title: 'Child' } }); await tick();
    g.token('new-token'); finish(false); await pending; assert.equal(g.items.length, 0);
});
