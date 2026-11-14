const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const read = name => fs.readFileSync('js/' + name, 'utf8');

function fixture() {
    const writes = [], saved = [], touched = [], local = [], failures = [], shown = [], busy = [], titles = [];
    const account = { type: 'CListBin', instance: 'https://bin.test', permissions: 'b' };
    const cList = { state: {}, config: { flaskSiteUrl: 'https://kv.test' }, keys: { ACCESS_TOKEN: 'access_token' },
        ui: { webPagePublishing: {
            readTitle: () => 'Captured title', begin() {}, setBusy: value => busy.push(value),
            chooseVersion: async () => 'overwrite', published: outcome => shown.push(outcome), fail: error => failures.push(error.message),
        } }, binPublishers: { CListBin: {
            publish: async (...args) => { writes.push(['publish', ...args]); return { url: 'https://bin.test/new', serviceId: 'new-remote' }; },
            update: async (...args) => { writes.push(['update', ...args]); return { url: 'https://bin.test/old' }; },
        } }, pageStore: { recordPublication: async (...args) => local.push(args) } };
    const context = vm.createContext({ window: { CList: cList }, structuredClone, crypto: { randomUUID: () => 'new' },
        currentEditor: 'rich', currentLoadedPage: null,
        editorHandlers: { rich: { getPublishContent: async () => ({ type: 'text/html', value: '<p>Viewable</p>' }),
            getContent: () => assert.fail('prefer editor getPublishContent API') } },
        getSiteSpecificCookie: () => 'token', getEncKey: async () => 'key',
        ensureAccountsLoaded: async () => [{ key: account.instance, value: JSON.stringify(account) }],
        parseAccountValue: record => JSON.parse(record.value), _currentAuthorDid: () => 'captured-author',
        _embedWebPageIdentity: (content, type, title, id) => { titles.push(title); return id + ':' + content; },
        _saveWebPageRecord: async record => { saved.push(record); return 'page:new'; },
        _touchOrForkWebPageRecord: async (...args) => { touched.push(args); return { pageKey: 'page:old', id: 'urn:uuid:old', forked: false }; },
        setLoadedPage: page => { context.currentLoadedPage = { ...page }; },
        showRepublishStatus: (message, isError) => { if (isError) failures.push(message); },
    });
    for (const name of ['account-state.js', 'web-page-workflow.js', 'web-page-publishing.js']) vm.runInContext(read(name), context);
    const page = { kind: 'page', id: 'urn:uuid:old', pageKey: 'page:old', service: 'CListBin', accountInstance: account.instance,
        serviceId: 'old-remote', url: 'https://bin.test/old', title: 'Original', mimeType: 'application/vnd.clist.slides+json' };
    return { context, cList, account, page, writes, saved, touched, local, failures, shown, busy, titles };
}

test('controller captures title/source before awaiting editor API and leaves a newly opened page untouched', async () => {
    const f = fixture(); let release;
    f.context.editorHandlers.rich.getPublishContent = async () => new Promise(resolve => { release = resolve; });
    const pending = f.context.postToWebPage(); await f.context.postToWebPage();
    f.cList.ui.webPagePublishing.readTitle = () => 'Later'; f.context.currentLoadedPage = { kind: 'local-page', id: 'later' };
    release({ type: 'text/html', value: '<p>Captured</p>' }); await pending;
    assert.equal(f.writes.length, 1); assert.equal(f.saved[0].title, 'Captured title');
    assert.equal(f.context.currentLoadedPage.id, 'later'); assert.equal(f.local.length, 0);
    assert.equal(f.cList.state.webPagePublishing.busy, false); assert.deepEqual(f.busy, [true, false]);
});

test('overwrite choice uses the captured original resource and never redirects to a different loaded page', async () => {
    const f = fixture(); f.context.currentLoadedPage = f.page; let choose;
    f.cList.ui.webPagePublishing.chooseVersion = () => new Promise(resolve => { choose = resolve; });
    const pending = f.context.postToWebPage(); await new Promise(resolve => setImmediate(resolve));
    assert.equal(f.cList.state.webPagePublishing.status, 'awaiting-choice');
    const other = { ...f.page, id: 'other', serviceId: 'other-remote' }; f.context.currentLoadedPage = other;
    choose('overwrite'); const result = await pending;
    assert.equal(f.writes[0][1], 'old-remote'); assert.equal(f.touched[0][0], 'page:old');
    assert.equal(f.context.currentLoadedPage, other); assert.equal(result.id, 'urn:uuid:old');
});

test('cancelled choices never write; republish updates its original destination using viewable MIME', async () => {
    const f = fixture(); f.context.currentLoadedPage = f.page;
    f.cList.ui.webPagePublishing.chooseVersion = async () => 'cancel';
    assert.equal(await f.context.postToWebPage(), null); assert.equal(f.writes.length, 0);
    assert.equal(f.cList.state.webPagePublishing.status, 'cancelled');
    const result = await f.context.playRepublish();
    assert.equal(f.writes[0][0], 'update'); assert.equal(f.writes[0][3], 'text/html');
    assert.equal(f.context.currentLoadedPage.mimeType, 'text/html'); assert.equal(result.status, 'published');
    assert.equal(f.context.currentLoadedPage.id, 'urn:uuid:old');
});

test('local-page publication updates only the original local annotation and live pointer', async () => {
    const f = fixture(); f.context.currentLoadedPage = { kind: 'local-page', id: 'native' };
    await f.context.postToWebPage();
    assert.equal(f.local[0][0], 'native'); assert.equal(f.saved.length, 0);
    assert.equal(f.context.currentLoadedPage.publicationUrl, 'https://bin.test/new'); assert.equal(f.context.currentLoadedPage.format, 'HTML');
});

test('a rejected write reports once and cleans busy state; metadata failure stays published', async () => {
    const f = fixture();
    f.cList.binPublishers.CListBin.publish = async () => { throw Error('remote rejected'); };
    assert.equal(await f.context.postToWebPage(), null); assert.equal(f.failures.length, 1);
    assert.equal(f.cList.state.webPagePublishing.busy, false); assert.equal(f.saved.length, 0);
    f.cList.binPublishers.CListBin.publish = async () => { f.writes.push('write'); return { url: 'https://bin.test/new' }; };
    f.context._saveWebPageRecord = async () => { throw Error('metadata rejected'); };
    const outcome = await f.context.postToWebPage();
    assert.equal(outcome.status, 'published'); assert.equal(outcome.metadataError, 'metadata rejected');
    assert.equal(f.failures.length, 1); assert.equal(f.shown.length, 1); assert.equal(f.writes.length, 1);
    assert.equal(f.cList.state.webPagePublishing.error, undefined);
});

test('session changes during editor capture prevent both remote and metadata writes', async () => {
    const f = fixture(); let release;
    f.context.editorHandlers.rich.getPublishContent = async () => new Promise(resolve => { release = resolve; });
    const pending = f.context.postToWebPage(); f.context.getSiteSpecificCookie = () => 'different-token';
    release({ type: 'text/html', value: '<p>Content</p>' }); await pending;
    assert.equal(f.writes.length, 0); assert.equal(f.saved.length, 0); assert.match(f.failures[0], /session changed/);
});

test('collection republish still delegates to its existing controller', async () => {
    const f = fixture(); let count = 0; f.context.currentLoadedPage = { kind: 'collection' };
    f.context.window.republishCollection = async () => { count++; };
    await f.context.playRepublish(); assert.equal(count, 1); assert.equal(f.writes.length, 0);
});

test('republish completion after a page switch does not label the newly opened page as republished', async () => {
    const f = fixture(); let release, shownAtIndicator;
    f.context.currentLoadedPage = f.page;
    f.cList.binPublishers.CListBin.update = async () => new Promise(resolve => { release = resolve; });
    f.cList.ui.webPagePublishing.published = (_, atIndicator) => { shownAtIndicator = atIndicator; };
    const pending = f.context.playRepublish(); await new Promise(resolve => setImmediate(resolve));
    const other = { ...f.page, id: 'other' }; f.context.currentLoadedPage = other;
    release({ url: 'https://bin.test/old' }); await pending;
    assert.equal(shownAtIndicator, false); assert.equal(f.context.currentLoadedPage, other);
});

test('web-page publication cannot clear the feedback of an active ordinary post', async () => {
    const f = fixture(); f.cList.state.publishing = { busy: true };
    await f.context.postToWebPage();
    assert.equal(f.writes.length, 0); assert.equal(f.busy.length, 0); assert.match(f.failures[0], /current post publication/);
});
