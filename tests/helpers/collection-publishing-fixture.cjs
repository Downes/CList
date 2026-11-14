const fs = require('node:fs');
const vm = require('node:vm');
const { Element } = require('./account-fixture.cjs');
const source = name => fs.readFileSync('js/' + name + '.js', 'utf8');
function workflowFixture() {
    const ctx = vm.createContext({ structuredClone }); vm.runInContext(source('collection-publishing-workflow'), ctx);
    const request = { name: 'Original', identity: { key: 'collection:one', id: 'urn:uuid:one' },
        formatId: 'rss', items: [{ url: 'https://item', title: 'Original item' }], publishedUrls: [], page: null, overwriteKey: null,
        targets: [{ key: 'short', account: { type: 'Short', permissions: 'w', maxlength: 50 } },
            { key: 'bin', account: { type: 'Bin', permissions: 'b', instance: 'https://bin' } }] };
    const calls = [], saved = [], events = [];
    const dependencies = {
        bins: { Bin: { publish: async (...args) => { calls.push(['bin', ...args]); return { url: 'https://bin/published', serviceId: 'remote' }; } } },
        publishers: { Short: { publish: async (...args) => { calls.push(['short', ...args]); return 'https://short/post'; } } },
        formats: { rss: { ext: 'rss', mimeType: 'application/rss+xml', serialize: (name, items, id) => JSON.stringify({ name, items, id }) },
            text: { ext: 'txt', mimeType: 'text/plain', serialize: name => name } },
        flatten: async items => items, assertSession() {}, now: () => '2026-11-14T00:00:00Z',
        save: async (request, urls) => saved.push({ request, urls }), onUpdate: e => events.push(e),
    };
    return { ctx, request, dependencies, calls, saved, events };
}

function controllerFixture() {
    const f = workflowFixture(); let token = 'token';
    const draft = { name: 'Original', items: [{ url: 'https://item', title: 'Original item' }] };
    const state = {}, messages = [], errors = [], updates = [], saves = [];
    const account = { type: 'Bin', permissions: 'b', instance: 'https://bin', secret: 'credential' };
    const records = [{ key: 'bin', value: JSON.stringify(account) }];
    const CList = { state, config: { flaskSiteUrl: 'https://kv' }, keys: { ACCESS_TOKEN: 'access_token' },
        publishers: {}, binPublishers: f.dependencies.bins, ui: { collectionPublishing: {
            fields: () => ({ name: draft.name, formatId: 'rss' }), begin() {}, setBusy() {},
            choose: async () => 'new', update: e => updates.push(e), fail: e => errors.push(e.message),
            message: text => messages.push(text), mount: (accounts, keys, toggle, run) => { f.toggle = toggle; f.run = run; },
        } } };
    Object.assign(f.ctx, { window: { CList }, console: { error() {} },
        getSiteSpecificCookie: () => token, ensureAccountsLoaded: async () => records,
        readActiveCollectionDraft: () => draft, _activeCollection: { col: { ...f.request.identity, ...structuredClone(draft) } },
        currentLoadedPage: null, _resolveCollectionIdentity: (key, id) => ({ key, id }), _refreshIdDisplay() {},
        getEncKey: async () => 'encryption-key', parseAccountValue: r => r && JSON.parse(r.value),
        _flattenForExport: async items => items, collectionFormats: f.dependencies.formats,
        _kvSaveItems: async (...args) => saves.push(args), _updatePagesCatalog: async () => {},
    });
    vm.runInContext(source('collection-publishing'), f.ctx);
    return { ...f, draft, CList, messages, errors, updates, saves, records,
        setToken: value => token = value, view: CList.ui.collectionPublishing,
        async open() { await f.ctx.window.playCollectionPublish(); f.toggle('bin'); },
    };
}

function webPageFixture() {
    const f = controllerFixture(), loaded = [];
    f.records[0].value = JSON.stringify({ type: 'CListBin', permissions: 'b', instance: 'https://bin', apiKey: 'captured-secret' });
    f.CList.binPublishers.CListBin = f.CList.binPublishers.Bin;
    f.ctx.currentEditor = 'collection';
    f.ctx.setLoadedPage = page => { loaded.push(page); f.ctx.currentLoadedPage = page; };
    return { ...f, loaded };
}

module.exports = { workflowFixture, controllerFixture, webPageFixture };
