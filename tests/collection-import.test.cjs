const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const plain = value => JSON.parse(JSON.stringify(value));
const source = name => fs.readFileSync('js/' + name + '.js', 'utf8');
const defer = () => { let resolve; const promise = new Promise(done => resolve = done); return { promise, resolve }; };
function fixture(records = []) {
    const stored = new Map(records.map(record => [record.key, JSON.stringify(record)])), writes = [], messages = [], errors = [], views = [];
    let token = 'token', serial = 0, pendingWrite, failure, sourceActions, selection;
    const cList = { state: { username: 'fixture', reader: { requestId: 1 } }, config: { flaskSiteUrl: 'https://storage.invalid' },
        keys: { ACCESS_TOKEN: 'access_token' }, ui: { view: { feedContainer: {} } }, storage: { kv: {
            list: async () => [...stored].map(([key, value]) => ({ key, value })), get: async key => stored.has(key) ? { value: stored.get(key) } : null,
            add: async (key, value) => { writes.push(['add', key, JSON.parse(value)]); if (pendingWrite) await pendingWrite; if (failure) throw failure;
                if (stored.has(key)) throw Error('Already exists'); stored.set(key, value); },
            put: async (key, value) => { writes.push(['put', key, JSON.parse(value)]); if (pendingWrite) await pendingWrite; if (failure) throw failure; stored.set(key, value); },
        } } };
    const view = cList.ui.collectionImport = {
        sources(target, actions) { sourceActions = actions; }, mount() { const old = views.at(-1); if (old) old.root.isConnected = false;
            const panel = { root: { isConnected: true } }; views.push(panel); return panel; },
        message(panel, message) { messages.push(message); }, preview(panel, parsed, actions) { panel.parsed = parsed; panel.actions = actions; },
        conflict(panel, name, actions) { panel.conflict = actions; }, busy(panel, busy) { panel.busy = busy; },
        failure(panel, error) { errors.push(error.message); }, status(message) { messages.push(message); }, error(error) { errors.push(error.message); },
        chat() { const panel = { root: { isConnected: true } }; views.push(panel); return panel; },
        choices(panel, collections, select) { panel.collections = collections; selection = select; }, close(panel) { panel.root.isConnected = false; },
    };
    const ctx = vm.createContext({ window: { CList: cList }, structuredClone, console: { error() {} },
        getSiteSpecificCookie: () => token, getEncKey: async () => 'key', decryptKVJson: async (key, value) => JSON.parse(value), encryptWithKey: async (key, value) => value,
        _parseCollectionData: raw => Array.isArray(raw) ? { items: raw } : raw,
        _newCollectionIdentity: () => ({ key: 'collection:new-' + ++serial, id: 'urn:uuid:new-' + serial }),
        _resolveCollectionIdentity: (key, id) => id ? { key: key || 'collection:' + id.replace('urn:uuid:', ''), id } : ctx._newCollectionIdentity(),
        recognizeSavedContent: text => { const value = JSON.parse(text); return value.items ? { collection: value } : {}; },
        fetch: async () => { throw Error('Unexpected network request'); },
    });
    ctx.window.showSavedCollections = async () => messages.push('list');
    for (const name of ['collection-session', 'collection-workflow', 'collection-import-workflow', 'collection-import']) vm.runInContext(source(name), ctx);
    return { ctx, cList, stored, writes, messages, errors, views, panel: () => views.at(-1), actions: () => sourceActions,
        token: value => { token = value; }, writeGate: promise => { pendingWrite = promise; }, fail: error => { failure = error; },
        select: (name, record) => selection(name, record), view };
}
const incoming = (extra = {}) => ({ title: 'Imported', items: [{ url: 'https://incoming.invalid', membershipId: 'member-incoming', extension: true }], ...extra });
const existing = () => ({ key: 'collection:known', id: 'urn:uuid:known', title: 'Original', items: [{ url: 'https://old.invalid', membershipId: 'old' }],
    publishedUrls: [{ url: 'https://published.invalid' }], custom: { keep: true } });

test('content-first import recognition retains JSON extensions/member metadata and rejects ordinary documents', () => {
    const f = fixture(), value = incoming({ custom: { retain: true } });
    const parsed = f.ctx.recognizeCollectionImport(JSON.stringify(value), 'image/png', 'wrong.txt', f.ctx.recognizeSavedContent);
    assert.deepEqual(plain(parsed), value);
    assert.throws(() => f.ctx.recognizeCollectionImport('{}', 'application/json', 'data.json', () => ({})), /not a recognized collection/);
    assert.throws(() => f.ctx.captureCollectionImportRequest(value, 'Invalid/name', { key: 'k', id: 'i' }), /Name may only/);
});
test('unknown JSON fields cannot bypass the shared identity parser', () => {
    const f = fixture();
    for (const name of ['collection-formats', 'file-recognition']) vm.runInContext(source(name), f.ctx);
    const parsed = f.ctx.recognizeCollectionImport(JSON.stringify(incoming({ id: 'not-a-collection-identity', custom: true })),
        'application/json', 'misleading.txt', f.ctx.recognizeSavedContent);
    assert.equal(parsed.id, undefined); assert.equal(parsed.custom, true);
});
test('preview captures incoming state and adds only after explicit save', async () => {
    const f = fixture(), value = incoming(); await f.ctx._showCollectionImportPreview(value, 'token', 'key');
    value.items[0].url = 'https://changed.invalid'; assert.equal(f.writes.length, 0);
    await f.panel().actions.save('Saved name');
    assert.equal(f.writes.length, 1); assert.equal(f.writes[0][0], 'add');
    assert.equal(f.writes[0][2].items[0].url, 'https://incoming.invalid'); assert.equal(f.writes[0][2].title, 'Saved name');
    assert.equal(f.cList.state.collectionImport.phase, 'saved'); assert.ok(f.messages.includes('list'));
});
test('imported identity collision asks before overwrite and keeps destination publications/extensions', async () => {
    const f = fixture([existing()]); await f.ctx._showCollectionImportPreview(incoming({ id: 'urn:uuid:known', incomingExtension: true }), 'token', 'key');
    await f.panel().actions.save('Renamed'); assert.equal(f.writes.length, 0); assert.ok(f.panel().conflict);
    await f.panel().conflict.overwrite();
    assert.equal(f.writes[0][0], 'put'); const saved = f.writes[0][2];
    assert.deepEqual(saved.custom, { keep: true }); assert.equal(saved.incomingExtension, true);
    assert.deepEqual(saved.publishedUrls, existing().publishedUrls); assert.equal(saved.items[0].membershipId, 'member-incoming');
});
test('merge deduplicates against existing URLs while retaining existing membership identity/order', async () => {
    const f = fixture([existing()]); await f.ctx._showCollectionImportPreview(incoming({ id: 'urn:uuid:known', items: [
        { url: 'https://old.invalid', title: 'Duplicate incoming' }, { url: 'https://new.invalid' }, { url: 'https://new.invalid', title: 'Second membership' },
    ] }), 'token', 'key');
    await f.panel().actions.save('Merged'); await f.panel().conflict.merge();
    const saved = f.writes[0][2]; assert.equal(saved.items.length, 3); assert.equal(saved.items[0].membershipId, 'old');
    assert.equal(saved.items[2].title, 'Second membership');
});
test('changed destination during conflict is preserved until a new explicit review', async () => {
    const f = fixture([existing()]); await f.ctx._showCollectionImportPreview(incoming({ id: 'urn:uuid:known' }), 'token', 'key');
    await f.panel().actions.save('Changed'); f.stored.set('collection:known', JSON.stringify({ ...existing(), custom: { newer: true } }));
    await f.panel().conflict.overwrite(); assert.equal(f.writes.length, 0); assert.match(f.errors.at(-1), /destination collection changed/);
});
test('merge preserves nested and local-only memberships instead of requiring a URL', async () => {
    const target = { ...existing(), items: [{ role: 'contains', collectionId: 'nested-old' }, { localOnly: true, membershipId: 'local-old' }] };
    const f = fixture([target]); await f.ctx._showCollectionImportPreview(incoming({ id: 'urn:uuid:known', items: [
        { role: 'contains', collectionId: 'nested-old' }, { role: 'contains', collectionId: 'nested-new' },
        { localOnly: true, membershipId: 'local-old' }, { localOnly: true, membershipId: 'local-new', content: 'Original local body' },
    ] }), 'token', 'key');
    await f.panel().actions.save('Nested merge'); await f.panel().conflict.merge();
    const items = f.writes[0][2].items; assert.equal(items.length, 4);
    assert.equal(items[2].collectionId, 'nested-new'); assert.equal(items[3].content, 'Original local body');
});
test('duplicate and stale preview/conflict callbacks never write twice', async () => {
    const f = fixture([existing()]); await f.ctx._showCollectionImportPreview(incoming({ id: 'urn:uuid:known' }), 'token', 'key');
    const oldActions = f.panel().actions, oldSave = oldActions.save; await oldSave('Name'); const choice = f.panel().conflict;
    oldActions.cancel(); assert.equal(f.cList.state.collectionImport.phase, 'conflict');
    const gate = defer(); f.writeGate(gate.promise); const pending = choice.overwrite(); await choice.overwrite(); choice.cancel();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(f.writes.length, 1); gate.resolve(); await pending; await oldSave('Old callback'); assert.equal(f.writes.length, 1);
});
test('failed save keeps identity for explicit retry without automatically repeating a write', async () => {
    const f = fixture(); await f.ctx._showCollectionImportPreview(incoming(), 'token', 'key');
    const save = f.panel().actions.save; f.fail(Error('Storage unavailable')); await save('Retry');
    assert.equal(f.writes.length, 1); assert.equal(f.cList.state.collectionImport.phase, 'failed');
    f.fail(null); await save('Retry'); assert.equal(f.writes.length, 2); assert.equal(f.writes[1][1], f.writes[0][1]);
});
test('URL/file responses cannot replace another import, reader, disconnected pane or login session', async () => {
    for (const expire of [f => f.token('new-token'), f => { f.cList.state.reader.requestId++; }, f => { f.panel().root.isConnected = false; }]) {
        const f = fixture(), gate = defer(); const pending = f.ctx._importCollectionFromFile({ name: 'saved.wrong', type: 'text/plain', text: () => gate.promise }, 'token', 'key');
        await Promise.resolve(); expire(f); gate.resolve(JSON.stringify(incoming())); await pending;
        assert.equal(f.panel().parsed, undefined); assert.equal(f.writes.length, 0);
    }
    const f = fixture(), gate = defer(); const old = f.ctx._importCollectionFromFile({ text: () => gate.promise }, 'token', 'key');
    await Promise.resolve(); await f.ctx._showCollectionImportPreview(incoming({ title: 'Newer' }), 'token', 'key');
    gate.resolve(JSON.stringify(incoming({ title: 'Old' }))); await old; assert.equal(f.panel().parsed.title, 'Newer');
});
test('URL HTTP errors and invalid collection content are visible without writes', async () => {
    const f = fixture(); f.ctx.fetch = async () => ({ ok: false, status: 404 }); await f.ctx._importCollectionFromUrl('https://source.invalid', 'token', 'key');
    assert.match(f.errors.at(-1), /HTTP 404/); assert.equal(f.writes.length, 0);
    await f.ctx._importCollectionFromFile({ text: async () => '{}' }, 'token', 'key'); assert.match(f.errors.at(-1), /not a recognized collection/);
});
test('source controls reject old browser owners and preview Cancel returns without writing', async () => {
    const f = fixture(); let active = true; f.ctx.mountCollectionImports({}, { token: 'token', encKey: 'key' }, () => active);
    active = false; await f.actions().file({ text: async () => JSON.stringify(incoming()) }); assert.equal(f.views.length, 0);
    await f.ctx._showCollectionImportPreview(incoming(), 'token', 'key'); f.panel().actions.cancel();
    assert.equal(f.cList.state.collectionImport.phase, 'cancelled'); assert.equal(f.writes.length, 0);
});
test('chat import captures incoming items, preserves legacy target key and rejects stale choices', async () => {
    const legacy = { ...existing(), id: undefined }; const f = fixture([legacy]), values = incoming().items;
    const anchor = { nextElementSibling: null }; await f.ctx.window.importCollectionFromChat(values, anchor);
    const record = f.panel().collections[0]; await f.select('Chat import', record);
    values[0].url = 'https://changed.invalid'; await f.panel().conflict.overwrite();
    assert.equal(f.writes[0][1], 'collection:known'); assert.equal(f.writes[0][2].items[0].url, 'https://incoming.invalid');
    assert.match(f.writes[0][2].id, /^urn:uuid:new-/);
    assert.equal(JSON.stringify(f.cList.state.collectionImport).includes('token'), false);
});


test('real JSON recognition and import persistence retain membership IDs, extensions, author metadata and nested members', async () => {
    const f = fixture();
    for (const name of ['collection-formats', 'file-recognition']) vm.runInContext(source(name), f.ctx);
    const value = incoming({ id: 'urn:uuid:12345678-1234-1234-1234-123456789abc', custom: { keep: true }, items: [
        { membershipId: 'leaf', title: 'Leaf', url: 'https://leaf.invalid', author_name: 'Native author', author: 'Legacy alias', extension: { keep: true } },
        { membershipId: 'nested', role: 'contains', collectionId: 'urn:uuid:child', title: 'Child', extension: 'nested metadata' },
    ] });
    const parsed = f.ctx.recognizeCollectionImport(JSON.stringify(value), 'text/plain', 'misleading.xml', f.ctx.recognizeSavedContent);
    assert.deepEqual(plain(parsed.custom), { keep: true }); assert.equal(parsed.items.length, 2);
    assert.equal(parsed.items[0].membershipId, 'leaf'); assert.equal(parsed.items[0].author_name, 'Native author');
    assert.deepEqual(plain(parsed.items[0].extension), { keep: true });
    assert.equal(parsed.items[1].membershipId, 'nested'); assert.equal(parsed.items[1].collectionId, 'urn:uuid:child');
    await f.ctx._showCollectionImportPreview(parsed, 'token', 'key'); await f.panel().actions.save('Imported');
    assert.equal(f.writes.length, 1); const saved = f.writes[0][2];
    assert.equal(saved.items[0].membershipId, 'leaf'); assert.deepEqual(plain(saved.items[0].extension), { keep: true });
    assert.equal(saved.items[1].role, 'contains'); assert.equal(saved.items[1].extension, 'nested metadata');
    const nestedOnly = f.ctx.recognizeCollectionImport(JSON.stringify({ title: 'Nested only', items: [value.items[1]] }),
        'application/octet-stream', 'wrong.txt', f.ctx.recognizeSavedContent);
    assert.equal(nestedOnly.items.length, 1); assert.equal(nestedOnly.items[0].membershipId, 'nested');
});
