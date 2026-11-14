const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { webPageFixture } = require('./helpers/collection-publishing-fixture.cjs');
const source = name => fs.readFileSync('js/' + name + '.js', 'utf8');
function fixture() {
    const f = webPageFixture(), records = [], revoked = [], feedback = [], reads = [];
    const item = { url: 'blob:original', localOnly: true, title: 'Local title', mimeType: 'text/html' };
    f.draft.items = [item]; f.ctx._draftItems = f.draft.items;
    f.ctx._currentAuthorDid = () => 'did:key:original';
    f.ctx.crypto = { randomUUID: () => 'entry-uuid' };
    f.ctx.URL = { revokeObjectURL: url => revoked.push(url) };
    f.ctx.fetch = async url => { reads.push(url); return { ok: true, text: async () => '<p>Content</p>' }; };
    f.ctx._embedWebPageIdentity = (content, mime, title, id) => `${content}<!-- ${id} -->`;
    f.ctx._saveWebPageRecord = async (record, session) => { records.push({ record: structuredClone(record), token: session.token }); return 'page:entry-uuid'; };
    f.view.localEntryResult = (result, title, updated) => feedback.push({ result, title, updated });
    f.view.localEntryFailed = error => f.errors.push(error.message);
    vm.runInContext(source('web-page-workflow'), f.ctx);
    vm.runInContext(source('collection-entry-publishing'), f.ctx);
    let refreshes = 0;
    return { ...f, item, records, revoked, feedback, reads, refresh: () => refreshes++, refreshes: () => refreshes };
}

test('local entry uses the shared page workflow, captured authorship, identity embedding, metadata, and URL reconciliation', async () => {
    const f = fixture(); const result = await f.ctx._publishLocalEntry(f.item, f.refresh);
    assert.equal(result.status, 'published'); assert.equal(f.calls.length, 1);
    assert.match(f.calls[0][1], /urn:uuid:entry-uuid/); assert.equal(f.calls[0][2], 'text/html');
    assert.equal(f.records[0].record.authorDid, 'did:key:original'); assert.equal(f.records[0].token, 'token');
    assert.equal(f.item.url, 'https://bin/published'); assert.equal(f.item.localOnly, false);
    assert.deepEqual(f.revoked, ['blob:original']); assert.equal(f.refreshes(), 1); assert.equal(f.loaded.length, 0);
    assert.equal(JSON.stringify(f.CList.state).includes('captured-secret'), false);
});

test('local entry metadata failure retains remote success, updates the unchanged entry, and never repeats its upload', async () => {
    const f = fixture(); f.ctx._saveWebPageRecord = async () => { throw Error('metadata offline'); };
    const result = await f.ctx._publishLocalEntry(f.item, f.refresh);
    assert.equal(result.status, 'published'); assert.equal(result.metadataError, 'metadata offline');
    assert.equal(f.item.localOnly, false); assert.equal(f.feedback[0].updated, true);
    await f.ctx._publishLocalEntry(f.item, f.refresh); assert.equal(f.calls.length, 1);
});

test('edited entries keep newer fields/blob URLs and replay the retained receipt without another upload', async () => {
    const f = fixture(); let finish;
    f.CList.binPublishers.CListBin.publish = (...args) => { f.calls.push(args); return new Promise(r => finish = r); };
    const pending = f.ctx._publishLocalEntry(f.item, f.refresh); await new Promise(r => setImmediate(r));
    f.item.title = 'Newer title'; finish({ url: 'https://created', serviceId: 'id' }); await pending;
    assert.equal(f.item.url, 'blob:original'); assert.equal(f.item.title, 'Newer title'); assert.equal(f.refreshes(), 0);
    assert.equal(f.feedback[0].updated, false); assert.equal(f.revoked.length, 0);
    const replay = await f.ctx._publishLocalEntry(f.item, f.refresh);
    assert.equal(replay.url, 'https://created'); assert.equal(f.calls.length, 1);
});

test('removed entries and different collections are left untouched after a pending upload', async () => {
    for (const change of ['remove', 'switch']) {
        const f = fixture(); let finish;
        f.CList.binPublishers.CListBin.publish = () => new Promise(r => finish = r);
        const pending = f.ctx._publishLocalEntry(f.item, f.refresh); await new Promise(r => setImmediate(r));
        if (change === 'remove') f.draft.items.splice(0, 1);
        else { f.ctx._activeCollection = { col: { id: 'other' } }; f.ctx._draftItems = []; }
        finish({ url: 'https://created' }); await pending;
        assert.equal(f.item.url, 'blob:original'); assert.equal(f.refreshes(), 0); assert.equal(f.revoked.length, 0);
    }
});

test('capture precedes account/key/blob awaits; later account or authorship changes do not redirect the request', async () => {
    const f = fixture(); let release;
    const accountRecords = await f.ctx.ensureAccountsLoaded();
    f.ctx.getEncKey = () => new Promise(r => release = r);
    const pending = f.ctx._publishLocalEntry(f.item, f.refresh); await new Promise(r => setImmediate(r));
    f.item.url = 'blob:newer'; f.item.title = 'Changed'; f.ctx._currentAuthorDid = () => 'did:key:newer';
    accountRecords[0].value = JSON.stringify({ type: 'CListBin', instance: 'https://changed', permissions: 'b', apiKey: 'new-key' });
    f.ctx.ensureAccountsLoaded = async () => [];
    release('key'); await pending;
    assert.deepEqual(f.reads, ['blob:original']); assert.equal(f.calls[0][3], 'Local title');
    assert.equal(f.calls[0][4].instance, 'https://bin'); assert.equal(f.calls[0][4].apiKey, 'captured-secret');
    assert.equal(f.feedback[0].title, 'Local title'); assert.equal(f.item.url, 'blob:newer');
});

test('duplicate and competing collection operations share authoritative in-flight state', async () => {
    const f = fixture(); let finish;
    f.CList.binPublishers.CListBin.publish = () => new Promise(r => finish = r);
    const pending = f.ctx._publishLocalEntry(f.item, f.refresh); await new Promise(r => setImmediate(r));
    assert.equal(f.CList.state.collectionPublishing.busy, true);
    assert.equal(await f.ctx._publishLocalEntry(f.item, f.refresh), undefined);
    assert.equal(await f.ctx.postCollectionToWebPage(), undefined);
    finish({ url: 'https://created' }); await pending;
    assert.equal(f.CList.state.collectionPublishing.busy, false);
});

test('session changes prevent writes, and after remote success prevent reconciling a newer login', async () => {
    const f = fixture(); let release;
    f.ctx.ensureAccountsLoaded = () => new Promise(r => release = r);
    const pending = f.ctx._publishLocalEntry(f.item, f.refresh); f.setToken('other'); release(f.records); await pending;
    assert.equal(f.calls.length, 0); assert.match(f.errors[0], /session changed/);
    const after = fixture(); after.CList.binPublishers.CListBin.publish = async () => { after.setToken('other'); return { url: 'https://created' }; };
    const result = await after.ctx._publishLocalEntry(after.item, after.refresh);
    assert.equal(result.status, 'published'); assert.match(result.metadataError, /session changed/);
    assert.equal(after.item.url, 'blob:original'); assert.equal(after.revoked.length, 0);
});

test('missing publication links retain the blob and receipt; no record, revocation, or repeated upload occurs', async () => {
    const f = fixture(); let writes = 0;
    f.CList.binPublishers.CListBin.publish = async () => { writes++; return {}; };
    const result = await f.ctx._publishLocalEntry(f.item, f.refresh);
    assert.equal(result.status, 'unconfirmed'); assert.equal(f.records.length, 0);
    assert.equal(f.item.url, 'blob:original'); assert.equal(f.revoked.length, 0);
    await f.ctx._publishLocalEntry(f.item, f.refresh); assert.equal(writes, 1);
});

test('blob read and upload failures release state without changing or revoking the entry', async () => {
    for (const failure of ['read', 'upload']) {
        const f = fixture();
        if (failure === 'read') f.ctx.fetch = async () => ({ ok: false, status: 404 });
        else f.CList.binPublishers.CListBin.publish = async () => { throw Error('denied'); };
        await f.ctx._publishLocalEntry(f.item, f.refresh);
        assert.equal(f.errors.length, 1); assert.equal(f.item.url, 'blob:original'); assert.equal(f.revoked.length, 0);
        assert.equal(f.CList.state.collectionPublishing.busy, false);
    }
});

test('local-entry view presents confirmed upload plus metadata failure separately and keeps the browser link visible', () => {
    const messages = [];
    const ctx = vm.createContext({ window: { CList: { ui: {} } }, readCollectionSaveFields() {},
        showErrorModal: (message, options) => messages.push({ message, ...options }), showStatusMessage() {} });
    vm.runInContext(source('collection-publishing-view'), ctx);
    ctx.window.CList.ui.collectionPublishing.localEntryResult({ status: 'published', url: 'https://created', metadataError: 'offline' }, 'Title', true);
    assert.equal(messages[0].title, 'Publication result'); assert.match(messages[0].message, /Published.*https:\/\/created.*My Pages metadata/);
});

test('entry controller loads after its dependencies are declared, remains small, and parses without UI dependencies', () => {
    const html = fs.readFileSync('index.html', 'utf8'); const script = source('collection-entry-publishing');
    new vm.Script(script); assert.ok(script.split('\n').length < 500);
    assert.ok(html.indexOf('js/collection-entry-publishing.js') > html.indexOf('js/collection-publishing.js'));
    assert.ok(html.indexOf('js/collection-entry-publishing.js') < html.indexOf('js/interface.js'));
});
