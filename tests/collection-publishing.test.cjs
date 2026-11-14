const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { Element } = require('./helpers/account-fixture.cjs');
const { workflowFixture, controllerFixture, webPageFixture } = require('./helpers/collection-publishing-fixture.cjs');
const source = name => fs.readFileSync('js/' + name + '.js', 'utf8');

test('collection workflow is DOM-free, publishes full content before link-only destinations, and records one metadata write', async () => {
    const f = workflowFixture(); const result = await f.ctx.runCollectionPublishingWorkflow(f.request, f.dependencies);
    assert.equal('document' in f.ctx, false); assert.equal('window' in f.ctx, false);
    assert.equal(f.calls[0][0], 'bin'); assert.equal(f.calls[1][0], 'short');
    assert.equal(f.calls[1][3], 'Original: https://bin/published');
    assert.equal(f.calls[0][3], 'Original.rss');
    assert.equal(result.primaryUrl, 'https://bin/published'); assert.equal(result.metadataSaved, true);
    assert.equal(f.saved.length, 1); assert.equal(f.saved[0].urls.length, 1);
});

test('format negotiation uses adapter preference and export flattening while preserving raw saved membership', async () => {
    const f = workflowFixture(); f.dependencies.bins.Bin.acceptedFormats = ['text'];
    f.dependencies.flatten = async () => [{ url: 'https://nested-child' }];
    await f.ctx.runCollectionPublishingWorkflow(f.request, f.dependencies);
    assert.equal(f.calls[0][2], 'text/plain'); assert.equal(f.calls[0][3], 'Original.txt');
    assert.equal(f.saved[0].request.items[0].url, 'https://item');
});

test('captured request and per-destination accounts/items survive caller and adapter mutations', async () => {
    const f = workflowFixture(); let resume;
    f.dependencies.flatten = () => new Promise(r => resume = r);
    const pending = f.ctx.runCollectionPublishingWorkflow(f.request, f.dependencies);
    f.request.name = 'New'; f.request.items[0].title = 'New'; f.request.targets[1].account.instance = 'https://changed';
    resume([{ url: 'https://captured' }]); await pending;
    assert.equal(f.calls[0][4].instance, 'https://bin'); assert.equal(f.saved[0].request.name, 'Original');
    assert.equal(f.saved[0].request.items[0].title, 'Original item');
});

test('explicit failure permits other destinations, missing links stay unconfirmed, and failures do not generate metadata', async () => {
    const f = workflowFixture(); f.dependencies.bins.Bin.publish = async () => { throw Error('denied'); };
    f.dependencies.publishers.Short.publish = async () => null;
    const result = await f.ctx.runCollectionPublishingWorkflow(f.request, f.dependencies);
    assert.deepEqual(Array.from(result.destinations, r => r.status), ['failed', 'unconfirmed']);
    assert.equal(f.saved.length, 0); assert.equal(result.publishedUrls.length, 0);
});

test('metadata failure retains successful publication and does not repeat the external write', async () => {
    const f = workflowFixture(); f.dependencies.save = async () => { throw Error('storage offline'); };
    const result = await f.ctx.runCollectionPublishingWorkflow(f.request, f.dependencies);
    assert.equal(result.destinations[0].status, 'published'); assert.equal(result.metadataSaved, false);
    assert.equal(result.metadataError, 'storage offline'); assert.equal(f.calls.filter(c => c[0] === 'bin').length, 1);
});

test('overwrite requires matching collection/account/format, updates the captured resource, and preserves other destinations', async () => {
    const f = workflowFixture(); const page = { kind: 'collection', collectionKey: 'collection:one', id: 'urn:uuid:one',
        service: 'Bin', accountInstance: 'https://bin', format: 'rss', serviceId: 'old', url: 'https://old' };
    const match = f.ctx.collectionOverwriteTarget(page, f.request.targets, 'rss', f.dependencies.bins, f.request.identity);
    assert.equal(match.key, 'bin');
    for (const change of [{ accountInstance: 'https://other' }, { format: 'text' }, { collectionKey: 'other', id: 'other' }])
        assert.equal(f.ctx.collectionOverwriteTarget({ ...page, ...change }, f.request.targets, 'rss', f.dependencies.bins, f.request.identity), null);
    f.request.page = page; f.request.overwriteKey = 'bin';
    f.request.publishedUrls = [{ service: 'Bin', accountInstance: 'https://bin', serviceId: 'old', url: 'https://old', format: 'rss' }];
    f.dependencies.bins.Bin.update = async (id, content) => { f.calls.push(['update', id, content]); return {}; };
    const result = await f.ctx.runCollectionPublishingWorkflow(f.request, f.dependencies);
    assert.equal(f.calls[0][1], 'old'); assert.equal(result.primaryUrl, 'https://old');
    assert.equal(result.publishedUrls.length, 1); assert.equal(result.publishedUrls[0].publishedAt, '2026-11-14T00:00:00Z');
});

test('session change after remote success is a metadata failure; later writes are blocked', async () => {
    const f = workflowFixture(); let changed = false;
    f.dependencies.assertSession = () => { if (changed) throw Error('session changed'); };
    f.dependencies.bins.Bin.publish = async () => { changed = true; return { url: 'https://created' }; };
    const result = await f.ctx.runCollectionPublishingWorkflow(f.request, f.dependencies);
    assert.equal(result.destinations[0].status, 'published'); assert.equal(result.destinations[1].status, 'failed');
    assert.equal(result.metadataError, 'session changed'); assert.equal(f.saved.length, 0);
});


test('selection and busy state are authoritative without DOM attributes; completion preserves newer drafts', async () => {
    const f = controllerFixture(); await f.open(); let resolve;
    f.CList.binPublishers.Bin.publish = () => new Promise(r => resolve = r);
    const pending = f.ctx.runCollectionPublication(f.records, { storeUrl: 'https://kv', token: 'token' });
    await new Promise(r => setImmediate(r));
    assert.equal(f.CList.state.collectionPublishing.busy, true);
    const duplicate = await f.ctx.runCollectionPublication(f.records, { storeUrl: 'https://kv', token: 'token' });
    assert.equal(duplicate, undefined);
    f.draft.name = 'New title'; f.draft.items.push({ url: 'https://new' });
    resolve({ url: 'https://created' }); await pending;
    assert.equal(f.saves[0][2], 'Original'); assert.equal(f.saves[0][3].length, 1);
    assert.equal(f.ctx._activeCollection.col.name, 'New title'); assert.equal(f.ctx._activeCollection.col.items.length, 2);
    assert.equal(f.ctx._activeCollection.col.publishedUrls[0].url, 'https://created');
    assert.equal(f.CList.state.collectionPublishing.busy, false);
    assert.equal(JSON.stringify(f.CList.state).includes('credential'), false);
    assert.equal(JSON.stringify(f.CList.state).includes('encryption-key'), false);
});

test('switching collection leaves its state untouched while recording against the captured identity', async () => {
    const f = controllerFixture(); await f.open(); let resolve;
    f.CList.binPublishers.Bin.publish = () => new Promise(r => resolve = r);
    const pending = f.ctx.runCollectionPublication(f.records, { storeUrl: 'https://kv', token: 'token' });
    await new Promise(r => setImmediate(r));
    const other = { key: 'collection:other', id: 'other', name: 'Other', items: [] };
    f.ctx._activeCollection = { col: other };
    resolve({ url: 'https://created' }); await pending;
    assert.equal(f.ctx._activeCollection.col, other); assert.equal(f.saves[0][0], 'collection:one');
});

test('overwrite cancellation releases busy state without writes; stale session cannot start publication', async () => {
    const f = controllerFixture(); await f.open();
    f.ctx.currentLoadedPage = { kind: 'collection', collectionKey: 'collection:one', service: 'Bin', accountInstance: 'https://bin', format: 'rss', serviceId: 'old' };
    f.view.choose = async () => null;
    const result = await f.ctx.runCollectionPublication(f.records, { storeUrl: 'https://kv', token: 'token' });
    assert.equal(result, null); assert.equal(f.calls.length, 0); assert.equal(f.saves.length, 0);
    assert.equal(f.CList.state.collectionPublishing.operation.status, 'cancelled');
    f.setToken('other');
    await f.ctx.runCollectionPublication(f.records, { storeUrl: 'https://kv', token: 'token' });
    assert.match(f.errors.at(-1), /session changed/); assert.equal(f.calls.length, 0);
});

test('shared busy guards reject a collection save/publication overlap', async () => {
    const f = controllerFixture(); await f.open();
    f.CList.state.collectionSaving = { active: new Map([['key', {}]]) };
    await f.ctx.runCollectionPublication(f.records, { storeUrl: 'https://kv', token: 'token' });
    assert.match(f.errors.at(-1), /current save/); assert.equal(f.calls.length, 0);
    const text = source('collections');
    vm.runInContext(text.slice(text.indexOf('async function persistCollectionSave('), text.indexOf('window.playCollectionSave =')), f.ctx);
    f.CList.state.collectionPublishing.busy = true;
    await assert.rejects(f.ctx.runCollectionSave({}, {}), /publication to finish/);
});

test('controller reports metadata failure separately and keeps the publication outcome complete', async () => {
    const f = controllerFixture(); await f.open(); f.ctx._kvSaveItems = async () => { throw Error('offline'); };
    const outcome = await f.ctx.runCollectionPublication(f.records, { storeUrl: 'https://kv', token: 'token' });
    assert.equal(outcome.destinations[0].status, 'published'); assert.equal(f.errors.length, 0);
    assert.match(f.messages[0], /Published, but could not update My Pages: offline/);
    assert.equal(f.CList.state.collectionPublishing.operation.status, 'complete');
});

test('collection publishing view uses standard feedback and action callbacks without service writes', () => {
    const result = new Element('div'), calls = [];
    const ctx = vm.createContext({ window: { CList: { ui: {} } }, readCollectionSaveFields() {},
        document: { getElementById: () => result, createElement: tag => new Element(tag) },
        showPublicationSuccess: (...args) => calls.push(args), console: { error() {} } });
    vm.runInContext(source('collection-publishing-view'), ctx);
    ctx.window.CList.ui.collectionPublishing.update({ type: 'destination', result: { destination: 'Store', status: 'published', url: 'https://created' } });
    ctx.window.CList.ui.collectionPublishing.update({ type: 'destination', result: { destination: 'Other', status: 'failed', error: 'denied' } });
    assert.deepEqual(calls, [['Store', 'https://created']]); assert.match(result.children[0].textContent, /Other - denied/);
    assert.equal('fetch' in ctx, false);
});


test('catalog helper checks the session between writes and propagates errors only for opted-in callers', async () => {
    const f = controllerFixture();
    const text = source('collections');
    vm.runInContext(text.slice(text.indexOf('async function _updatePagesCatalog('), text.indexOf('function _generateCatalogOPML(')), f.ctx);
    let changed = false, writes = 0;
    f.CList.storage = { kv: { list: async () => [{ key: 'page:one', value: 'ciphertext' }], put: async () => { writes++; } } };
    f.ctx.decryptKVJson = async () => ({ url: 'https://page', title: 'Page' });
    f.ctx._generateCatalogOPML = () => '<opml/>'; f.ctx._generateCatalogAP = () => '{}';
    f.ctx.encryptWithKey = async () => 'encrypted';
    f.CList.binPublishers.CListBin = { publish: async () => { writes++; changed = true; return { url: 'https://catalog', serviceId: 'catalog' }; } };
    await assert.rejects(f.ctx._updatePagesCatalog('token', 'key', {}, {
        assertSession: () => { if (changed) throw Error('session changed'); }, throwOnError: true,
    }), /session changed/);
    assert.equal(writes, 1);
    f.CList.storage.kv.list = async () => { throw Error('offline'); };
    await f.ctx._updatePagesCatalog('token', 'key', {});
    await assert.rejects(f.ctx._updatePagesCatalog('token', 'key', {}, { throwOnError: true }), /offline/);
});

test('changing the loaded resource while an overwrite choice is pending cannot redirect its target', async () => {
    const f = controllerFixture(); await f.open(); let choose;
    f.ctx.currentLoadedPage = { kind: 'collection', collectionKey: 'collection:one', service: 'Bin',
        accountInstance: 'https://bin', format: 'rss', serviceId: 'captured', url: 'https://captured' };
    f.view.choose = () => new Promise(r => choose = r);
    const updated = [];
    f.CList.binPublishers.Bin.update = async id => { updated.push(id); return { url: 'https://captured' }; };
    const pending = f.ctx.runCollectionPublication(f.records, { storeUrl: 'https://kv', token: 'token' });
    await new Promise(r => setImmediate(r));
    f.ctx.currentLoadedPage.serviceId = 'new-resource'; f.ctx.currentLoadedPage.url = 'https://new';
    choose('overwrite'); await pending;
    assert.deepEqual(updated, ['captured']);
});

test('catalog failure remains a completion warning after the primary publication has been recorded', async () => {
    const f = controllerFixture();
    f.records[0].value = JSON.stringify({ type: 'CListBin', permissions: 'b', instance: 'https://bin' });
    f.CList.binPublishers.CListBin = f.CList.binPublishers.Bin;
    f.ctx._updatePagesCatalog = async () => { throw Error('catalog unavailable'); };
    await f.open();
    const outcome = await f.ctx.runCollectionPublication(f.records, { storeUrl: 'https://kv', token: 'token' });
    assert.equal(outcome.metadataSaved, true); assert.equal(outcome.destinations[0].status, 'published');
    assert.equal(f.CList.state.collectionPublishing.operation.status, 'complete');
    assert.equal(f.errors.length, 0); assert.match(f.messages[0], /completion action failed: catalog unavailable/);
});

test('new collection scripts parse, stay below 500 lines, and load after their view dependencies', () => {
    const html = fs.readFileSync('index.html', 'utf8');
    for (const name of ['collection-publishing-workflow', 'collection-publishing-view', 'collection-publishing']) {
        new vm.Script(source(name)); assert.ok(source(name).split('\n').length < 500);
        assert.ok(html.indexOf('js/' + name + '.js') > html.indexOf('js/collection-editor.js'));
        assert.ok(html.indexOf('js/' + name + '.js') < html.indexOf('js/interface.js'));
    }
});



test('To Web Page uses one automatic bin target and the shared workflow, then records the captured loaded-page identity', async () => {
    const f = webPageFixture();
    const result = await f.ctx.postCollectionToWebPage();
    assert.equal(f.calls.length, 1); assert.equal(f.calls[0][0], 'bin');
    assert.equal(result.destinations[0].status, 'published'); assert.equal(f.saves.length, 1);
    assert.equal(f.loaded.length, 1); assert.equal(f.loaded[0].collectionKey, 'collection:one');
    assert.equal(f.loaded[0].id, 'urn:uuid:one'); assert.equal(f.loaded[0].format, 'rss');
    assert.equal(f.loaded[0].serviceId, 'remote'); assert.equal(f.loaded[0].service, 'CListBin');
    assert.equal(JSON.stringify(f.CList.state).includes('captured-secret'), false);
});

test('To Web Page captures title/members/format before account loading and preserves newer edits', async () => {
    const f = webPageFixture(); let release;
    f.ctx.ensureAccountsLoaded = () => new Promise(r => release = r);
    const pending = f.ctx.postCollectionToWebPage();
    f.draft.name = 'New title'; f.draft.items.push({ url: 'https://new' });
    f.view.fields = () => ({ name: 'New title', formatId: 'text' });
    release(f.records); const result = await pending;
    assert.equal(result.metadataSaved, true);
    const serialized = JSON.parse(f.calls[0][1]);
    assert.equal(serialized.name, 'Original'); assert.equal(serialized.items.length, 1);
    assert.equal(f.calls[0][2], 'application/rss+xml');
    assert.equal(f.saves[0][2], 'Original'); assert.equal(f.saves[0][3].length, 1);
    assert.equal(f.ctx._activeCollection.col.name, 'New title'); assert.equal(f.ctx._activeCollection.col.items.length, 2);
    assert.equal(f.loaded.length, 0);
});

test('To Web Page captures the chosen account before encryption-key loading and ignores live account changes', async () => {
    const f = webPageFixture(); let release;
    f.ctx.getEncKey = () => new Promise(r => release = r);
    const pending = f.ctx.postCollectionToWebPage(); await new Promise(r => setImmediate(r));
    f.records[0].value = JSON.stringify({ type: 'CListBin', permissions: 'b', instance: 'https://other', apiKey: 'new-secret' });
    release('key'); await pending;
    assert.equal(f.calls[0][4].instance, 'https://bin'); assert.equal(f.calls[0][4].apiKey, 'captured-secret');
});

test('To Web Page cancels a matching overwrite choice without writes and blocks overlapping clicks', async () => {
    const f = webPageFixture(); let choose;
    f.ctx.currentLoadedPage = { kind: 'collection', collectionKey: 'collection:one', service: 'CListBin',
        accountInstance: 'https://bin', format: 'rss', serviceId: 'old', url: 'https://old' };
    f.view.choose = () => new Promise(r => choose = r);
    const pending = f.ctx.postCollectionToWebPage(); await new Promise(r => setImmediate(r));
    assert.equal(f.CList.state.collectionPublishing.operation.status, 'choosing');
    assert.equal(await f.ctx.postCollectionToWebPage(), undefined);
    choose(null); await pending;
    assert.equal(f.calls.length, 0); assert.equal(f.saves.length, 0); assert.equal(f.loaded.length, 0);
    assert.equal(f.CList.state.collectionPublishing.busy, false);
    assert.equal(f.CList.state.collectionPublishing.operation.status, 'cancelled');
});

test('To Web Page never overwrites a different account instance or unrelated collection', async () => {
    for (const change of [{ accountInstance: 'https://other' }, { collectionKey: 'collection:other', id: 'other' }]) {
        const f = webPageFixture();
        f.ctx.currentLoadedPage = { kind: 'collection', collectionKey: 'collection:one', service: 'CListBin',
            accountInstance: 'https://bin', format: 'rss', serviceId: 'old', url: 'https://old', ...change };
        f.view.choose = () => { throw Error('Should not offer overwrite'); };
        const result = await f.ctx.postCollectionToWebPage();
        assert.equal(result.destinations[0].status, 'published'); assert.equal(f.calls[0][0], 'bin'); assert.equal(f.errors.length, 0);
    }
});

test('To Web Page overwrite uses the captured remote resource and leaves a newly loaded page untouched', async () => {
    const f = webPageFixture(); let choose;
    f.ctx.currentLoadedPage = { kind: 'collection', collectionKey: 'collection:one', service: 'CListBin',
        accountInstance: 'https://bin', format: 'rss', serviceId: 'captured', url: 'https://captured' };
    f.CList.binPublishers.CListBin.update = async id => { f.calls.push(['update', id]); return {}; };
    f.view.choose = () => new Promise(r => choose = r);
    const pending = f.ctx.postCollectionToWebPage(); await new Promise(r => setImmediate(r));
    const other = { kind: 'page', id: 'other' }; f.ctx.currentLoadedPage = other;
    choose('overwrite'); const result = await pending;
    assert.equal(f.calls[0][1], 'captured'); assert.equal(result.primaryUrl, 'https://captured');
    assert.equal(f.loaded.length, 0); assert.equal(f.ctx.currentLoadedPage, other);
});

test('To Web Page keeps remote success separate from metadata failure and missing links', async () => {
    const f = webPageFixture(); f.ctx._kvSaveItems = async () => { throw Error('metadata offline'); };
    const result = await f.ctx.postCollectionToWebPage();
    assert.equal(result.destinations[0].status, 'published'); assert.equal(result.metadataError, 'metadata offline');
    assert.equal(f.calls.length, 1); assert.equal(f.loaded.length, 0); assert.equal(f.errors.length, 0);
    assert.match(f.messages[0], /Published, but could not update My Pages/);
    const missing = webPageFixture(); missing.CList.binPublishers.CListBin.publish = async () => ({});
    const noLink = await missing.ctx.postCollectionToWebPage();
    assert.equal(noLink.destinations[0].status, 'unconfirmed'); assert.equal(missing.saves.length, 0); assert.equal(missing.loaded.length, 0);
});

test('To Web Page rejects a session switch during account loading before any write', async () => {
    const f = webPageFixture(); let release;
    f.ctx.ensureAccountsLoaded = () => new Promise(r => release = r);
    const pending = f.ctx.postCollectionToWebPage(); f.setToken('other'); release(f.records); await pending;
    assert.equal(f.calls.length, 0); assert.match(f.errors[0], /session changed/);
    assert.equal(f.CList.state.collectionPublishing.busy, false);
});

test('To Web Page retains creation when session changes after the write, blocking metadata and reconciliation', async () => {
    const f = webPageFixture();
    f.CList.binPublishers.CListBin.publish = async () => { f.setToken('other'); return { url: 'https://created' }; };
    const result = await f.ctx.postCollectionToWebPage();
    assert.equal(result.destinations[0].status, 'published'); assert.match(result.metadataError, /session changed/);
    assert.equal(f.saves.length, 0); assert.equal(f.loaded.length, 0);
});

test('To Web Page preserves raw nested membership for saving and serializes only flattened export content', async () => {
    const f = webPageFixture(); f.draft.items.push({ role: 'contains', collectionId: 'nested' }, { url: 'blob:local' });
    f.ctx._flattenForExport = async items => [{ url: 'https://flattened' }];
    await f.ctx.postCollectionToWebPage();
    const content = JSON.parse(f.calls[0][1]); assert.equal(content.items.length, 1); assert.equal(content.items[0].url, 'https://flattened');
    assert.equal(f.saves[0][3].length, 3); assert.equal(f.saves[0][3][1].collectionId, 'nested');
});

test('To Web Page reports missing destinations cleanly and releases its state guard', async () => {
    const f = webPageFixture(); f.ctx.ensureAccountsLoaded = async () => [];
    assert.equal(await f.ctx.postCollectionToWebPage(), null);
    assert.match(f.errors[0], /No web-page destination/); assert.equal(f.calls.length, 0);
    assert.equal(f.CList.state.collectionPublishing.busy, false);
});

test('To Web Page option is view-only, reuses the public icon, and reflects busy state', () => {
    const clicks = [], ctx = vm.createContext({ window: { CList: { ui: {} } }, readCollectionSaveFields() {},
        postCollectionToWebPage: () => clicks.push('web-page'),
        document: { createElement: tag => new Element(tag) } });
    vm.runInContext(source('collection-publishing-view'), ctx);
    const option = ctx.makeCollectionWebPageOption();
    const button = option.querySelector('button'); assert.equal(option.querySelector('span').textContent, 'public');
    button.listeners.click(); assert.deepEqual(clicks, ['web-page']);
    ctx.window.CList.ui.collectionPublishing.setBusy(true); assert.equal(button.disabled, true);
    ctx.window.CList.ui.collectionPublishing.setBusy(false); assert.equal(button.disabled, false);
    assert.equal('fetch' in ctx, false);
});
