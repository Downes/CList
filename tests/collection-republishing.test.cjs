const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const { webPageFixture, workflowFixture } = require('./helpers/collection-publishing-fixture.cjs');
const source = name => fs.readFileSync('js/' + name + '.js', 'utf8');
function fixture() {
    const f = webPageFixture(), touches = [], feedback = [];
    f.ctx.currentLoadedPage = { kind: 'collection', collectionKey: 'collection:one', id: 'urn:uuid:one',
        service: 'CListBin', accountInstance: 'https://bin', format: 'rss', serviceId: 'original', url: 'https://original' };
    f.ctx._activeCollection.col.publishedUrls = [{ url: 'https://original', service: 'CListBin',
        accountInstance: 'https://bin', format: 'rss', serviceId: 'original', publishedAt: 'old' }];
    f.ctx._touchPublishedUrlEntry = async (...args) => touches.push(args);
    f.view.republished = (outcome, active) => feedback.push({ outcome, active });
    f.view.republishFailed = (error, active) => { f.errors.push(error.message); feedback.push({ error: error.message, active }); };
    f.CList.binPublishers.CListBin.update = async (...args) => { f.calls.push(['update', ...args]); return { url: 'https://original' }; };
    return { ...f, touches, feedback };
}

test('direct Republish updates only its original resource/format without choice, new publication, or saving raw members', async () => {
    const f = fixture();
    f.view.fields = () => ({ name: f.draft.name, formatId: 'text' });
    f.CList.binPublishers.CListBin.acceptedFormats = ['text'];
    f.view.choose = () => { throw Error('unexpected choice'); };
    f.CList.binPublishers.CListBin.publish = () => { throw Error('unexpected new publication'); };
    const outcome = await f.ctx.window.republishCollection();
    assert.equal(f.calls.length, 1); assert.equal(f.calls[0][0], 'update'); assert.equal(f.calls[0][1], 'original');
    assert.equal(f.calls[0][3], 'application/rss+xml'); assert.equal(JSON.parse(f.calls[0][2]).name, 'Original');
    assert.equal(outcome.destinations[0].status, 'published'); assert.equal(f.saves.length, 0);
    assert.equal(f.touches.length, 1); assert.equal(f.touches[0][0], 'collection:one'); assert.equal(f.touches[0][1], 'original');
    assert.equal(f.feedback[0].active, true); assert.equal(f.loaded.length, 0);
});

test('direct Republish supports an update-only bin adapter', async () => {
    const f = fixture(); delete f.CList.binPublishers.CListBin.publish;
    const result = await f.ctx.window.republishCollection();
    assert.equal(result.destinations[0].status, 'published'); assert.equal(f.touches.length, 1);
});

test('direct Republish snapshots title/members/page before account loading, preserving newer drafts and page switches', async () => {
    const f = fixture(); let release;
    f.ctx.ensureAccountsLoaded = () => new Promise(r => release = r);
    const pending = f.ctx.window.republishCollection();
    f.draft.name = 'Newer'; f.draft.items.push({ url: 'https://newer' });
    const other = { kind: 'page', id: 'other' }; f.ctx.currentLoadedPage = other;
    release(f.records); await pending;
    assert.equal(f.calls[0][1], 'original'); assert.equal(JSON.parse(f.calls[0][2]).name, 'Original');
    assert.equal(JSON.parse(f.calls[0][2]).items.length, 1); assert.equal(f.feedback[0].active, false);
    assert.equal(f.ctx.currentLoadedPage, other); assert.equal(f.ctx._activeCollection.col.name, 'Newer');
    assert.equal(f.ctx._activeCollection.col.items.length, 2);
});

test('direct Republish rejects unrelated collection, absent account, and unsupported update without falling back to another destination', async () => {
    const wrong = fixture(); wrong.ctx.currentLoadedPage.collectionKey = 'collection:other'; wrong.ctx.currentLoadedPage.id = 'other';
    await wrong.ctx.window.republishCollection(); assert.match(wrong.errors[0], /does not match/); assert.equal(wrong.calls.length, 0);
    const missing = fixture(); missing.records[0].value = JSON.stringify({ type: 'CListBin', instance: 'https://other', permissions: 'b' });
    await missing.ctx.window.republishCollection(); assert.match(missing.errors[0], /writable account/); assert.equal(missing.calls.length, 0);
    const unsupported = fixture(); delete unsupported.CList.binPublishers.CListBin.update;
    await unsupported.ctx.window.republishCollection(); assert.match(unsupported.errors[0], /not available/); assert.equal(unsupported.calls.length, 0);
});

test('direct Republish is covered by shared in-flight state and duplicate clicks cannot duplicate updates', async () => {
    const f = fixture(); let finish;
    f.CList.binPublishers.CListBin.update = () => new Promise(r => finish = r);
    const pending = f.ctx.window.republishCollection(); await new Promise(r => setImmediate(r));
    assert.equal(f.CList.state.collectionPublishing.busy, true);
    assert.equal(await f.ctx.window.republishCollection(), undefined);
    finish({ url: 'https://original' }); await pending;
    assert.equal(f.touches.length, 1); assert.equal(f.CList.state.collectionPublishing.busy, false);
    assert.equal(JSON.stringify(f.CList.state).includes('captured-secret'), false);
});

test('direct Republish reports metadata-only failure as published and never repeats its update', async () => {
    const f = fixture(); f.ctx._touchPublishedUrlEntry = async () => { throw Error('metadata offline'); };
    const result = await f.ctx.window.republishCollection();
    assert.equal(result.destinations[0].status, 'published'); assert.equal(result.metadataError, 'metadata offline');
    assert.equal(f.calls.length, 1); assert.equal(f.errors.length, 0); assert.equal(f.CList.state.collectionPublishing.operation.status, 'complete');
});

test('session changes block republish before writing or become metadata warnings after a completed update', async () => {
    const f = fixture(); let release;
    f.ctx.ensureAccountsLoaded = () => new Promise(r => release = r);
    const pending = f.ctx.window.republishCollection(); f.setToken('new'); release(f.records); await pending;
    assert.equal(f.calls.length, 0); assert.match(f.errors[0], /session changed/);
    const after = fixture(); after.CList.binPublishers.CListBin.update = async () => { after.setToken('new'); return {}; };
    const result = await after.ctx.window.republishCollection();
    assert.equal(result.destinations[0].status, 'published'); assert.match(result.metadataError, /session changed/); assert.equal(after.touches.length, 0);
});

test('timestamp helper preserves stored title/items and checks captured credentials before its metadata write', async () => {
    const f = fixture(); const text = source('collections');
    vm.runInContext(text.slice(text.indexOf('async function _touchPublishedUrlEntry('), text.indexOf('// Regenerate the OPML')), f.ctx);
    const stored = { id: 'one', title: 'Saved title', items: [{ url: 'https://saved' }], publishedUrls: [{ serviceId: 'original', publishedAt: 'old' }] };
    let payload, writes = 0, changed = false;
    f.CList.storage = { kv: { list: async () => [{ key: 'collection:one', value: 'encrypted' }], update: async (_, value) => { payload = JSON.parse(value); writes++; } } };
    f.ctx.decryptKVJson = async () => structuredClone(stored); f.ctx._parseCollectionData = x => x;
    f.ctx.encryptWithKey = async (_, value) => value;
    const options = { session: { encKey: 'captured-key' }, strict: true, assertSession: () => { if (changed) throw Error('changed'); } };
    await f.ctx._touchPublishedUrlEntry('collection:one', 'original', options);
    assert.equal(payload.title, stored.title); assert.deepEqual(payload.items, stored.items); assert.notEqual(payload.publishedUrls[0].publishedAt, 'old');
    f.ctx.encryptWithKey = async (_, value) => { changed = true; return value; };
    await assert.rejects(f.ctx._touchPublishedUrlEntry('collection:one', 'original', options), /changed/); assert.equal(writes, 1);
});

test('Republish feedback uses the original status indicator only while its captured source remains active', () => {
    const messages = [], statuses = [];
    const ctx = vm.createContext({ window: { CList: { ui: {} } }, readCollectionSaveFields() {}, showRepublishStatus: (...args) => statuses.push(args) });
    vm.runInContext(source('collection-publishing-view'), ctx);
    const view = ctx.window.CList.ui.collectionPublishing; view.message = (...args) => messages.push(args);
    view.republished({ destinations: [{ status: 'published' }], metadataError: null }, true);
    view.republished({ destinations: [{ status: 'published' }], metadataError: 'offline' }, false);
    assert.deepEqual(statuses, [['Republished.', false]]); assert.match(messages[0][0], /Republished, but could not update My Pages/);
});
