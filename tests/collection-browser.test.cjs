const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const plain = value => JSON.parse(JSON.stringify(value));
const deferred = () => { let resolve; const promise = new Promise(done => resolve = done); return { promise, resolve }; };
function fixture() {
    const calls = [], messages = [], views = [], events = new Map();
    let token = 'token', listing = async () => ({ collections: [{ key: 'collection:a', id: 'a', title: 'Saved', items: [{ url: 'https://item.invalid' }], publishedUrls: [{ url: 'https://published.invalid' }] }], warnings: [] });
    let deletion = async () => {}, flatten = async items => items;
    const CList = { state: { username: 'alice', reader: { mode: 'collections', requestId: 1 } },
        config: { flaskSiteUrl: 'https://store.invalid' }, accounts: [], readers: { Feed: { editCollection: async (...args) => calls.push(['feed-edit', ...args]) } },
        ui: { collectionBrowser: {
            mount(mode) { views.forEach(view => view.root.isConnected = false); const view = { mode, root: { isConnected: true } }; views.push(view); return view; },
            message(view, text, error) { view.message = { text, error }; },
            list(view, model, actions) { view.model = model; view.actions = actions; view.imports = {}; },
            detail(view, col, actions) { view.collection = col; view.actions = actions; return { count: {}, items: {}, error: {} }; },
            actionError(view, text) { view.error = text; }, status(text) { messages.push(text); }, error(error) { messages.push(error.message); },
        } }, loaders: [],
    };
    const ctx = vm.createContext({ structuredClone, console: { error() {} }, window: { CList,
        addEventListener: (name, fn) => events.set(name, fn), removeEventListener: name => events.delete(name) },
        beginCollectionSession(options = {}) { return { username: CList.state.username, storeUrl: CList.config.flaskSiteUrl, token: options.token || token, encKey: options.encKey }; },
        async prepareCollectionSession(session) { ctx.assertCollectionSession(session); session.encKey ||= 'key'; },
        assertCollectionSession(session) { if (session.username !== CList.state.username || session.storeUrl !== CList.config.flaskSiteUrl || session.token !== token) throw Error('Session changed'); },
        collectionDependencies: session => ({ session }),
        listCollectionRecords: (...args) => listing(...args),
        deleteCollectionRecord: async (...args) => { calls.push(['remove', ...args]); await deletion(...args); },
        parseAccountValue: record => JSON.parse(record.value),
        deleteAccount: async (...args) => calls.push(['account-remove', ...args]),
        revealEditorPane: () => calls.push(['reveal']),
        _loadCollectionIntoEditor: async (...args) => calls.push(['editor', ...args]),
        switchReaderAccount: async key => { calls.push(['read', key]); CList.state.reader = { mode: 'account', requestId: 2 }; },
        populateReadAccountList: accounts => calls.push(['read-menu', accounts]), updateUIVisibility: () => calls.push(['visibility']),
        populateLoadOptions: () => { CList.state.editorControls = { id: 2 }; calls.push(['sources']); },
        mountCollectionImports: (...args) => calls.push(['imports', ...args]),
        history: { pushState: value => calls.push(['push', value]), back: () => calls.push(['back']) },
        _renderCollectionItems: async (...args) => calls.push(['rows', ...args]),
        _showAddToCollectionPicker: async (...args) => calls.push(['nest', ...args]),
        _flattenForExport: (...args) => flatten(...args),
        _collectionItemDisplayTitle: item => item.title || item.url,
        sendShareMessage: (...args) => calls.push(['share', ...args]),
    });
    ctx.window.openCollabWithCollection = (...args) => calls.push(['collab', ...args]);
    vm.runInContext(fs.readFileSync('js/collection-browser.js', 'utf8'), ctx);
    return { ctx, CList, views, calls, messages, events, show: () => CList.loaders[0].load(), feed: () => ctx.window.showSavedCollections(),
        view: () => views.at(-1), token: value => token = value, list: fn => listing = fn,
        deleting: fn => deletion = fn, flatten: fn => flatten = fn };
}
test('collection browser merges saved collections and registry feed subscriptions with guarded import mounting', async () => {
    const f = fixture(); f.CList.accounts.push({ key: 'feed', value: JSON.stringify({ type: 'Feed', title: 'News', id: 'private-token' }) });
    await f.feed(); assert.equal(f.view().model.collections.length, 2);
    const saved = f.view().model.collections[0]; assert.equal(saved.name, 'Saved');
    assert.equal(f.view().model.collections[1].feedSubscription.title, 'News');
    assert.equal(f.calls.find(call => call[0] === 'imports')[3](), true);
    assert.equal(JSON.stringify(f.CList.state.collectionBrowsing).includes('private-token'), false);
    assert.equal(JSON.stringify(f.CList.state.collectionBrowsing).includes('published.invalid'), false);
});
test('late collection listing cannot replace a newer panel or a different reader/session', async () => {
    for (const expire of [f => f.token('new'), f => { f.CList.state.username = 'bob'; },
        f => { f.CList.state.reader = { mode: 'account', requestId: 2 }; }, f => { f.view().root.isConnected = false; }]) {
        const f = fixture(), gate = deferred(); f.list(() => gate.promise);
        const pending = f.feed(); await Promise.resolve(); await Promise.resolve(); expire(f);
        gate.resolve({ collections: [], warnings: [] }); await pending;
        assert.equal(f.view().model, undefined);
    }
    const f = fixture(), gate = deferred(); f.list(() => gate.promise); const old = f.feed(); await Promise.resolve();
    f.list(async () => ({ collections: [], warnings: [] })); await f.feed();
    gate.resolve({ collections: [{ key: 'old', title: 'Old', items: [] }], warnings: [] }); await old;
    assert.equal(f.view().model.collections.length, 0);
});
test('list failures are visible and corrupt-record warnings retain readable rows', async () => {
    const f = fixture(); f.list(async () => { throw Error('Storage offline'); }); await f.feed();
    assert.match(f.view().message.text, /Storage offline/); assert.equal(f.view().message.error, true);
    const g = fixture(); g.list(async () => ({ collections: [], warnings: [{ key: 'collection:bad' }] })); await g.feed();
    assert.match(g.view().model.warning, /1 unreadable/);
});
test('delete confirmation state belongs to the controller; old rows and duplicate writes expire', async () => {
    const f = fixture(); await f.feed(); const old = f.view().actions, row = f.view().model.collections[0];
    old.confirm(row.key); assert.equal(f.CList.state.collectionBrowsing.confirmKey, row.key);
    await old.remove(row); assert.equal(f.calls.some(call => call[0] === 'remove'), false);
    const gate = deferred(); f.deleting(() => gate.promise);
    const actions = f.view().actions, pending = actions.remove(row); await actions.remove(row);
    assert.equal(f.calls.filter(call => call[0] === 'remove').length, 1); gate.resolve(); await pending;
    assert.equal(f.view().model.collections.length, 0); assert.equal(f.CList.state.collectionBrowsing.busy, false);
});
test('failed delete retains its row and supports explicit retry', async () => {
    const f = fixture(); await f.feed(); const row = f.view().model.collections[0];
    f.deleting(async () => { throw Error('Uncertain delete'); }); await f.view().actions.remove(row);
    assert.equal(f.view().model.collections.length, 1); assert.match(f.view().model.error, /Uncertain delete/);
    f.deleting(async () => {}); await f.view().actions.remove(row); assert.equal(f.view().model.collections.length, 0);
});
test('delete dependencies expire before a delayed data write if the reader surface changes', async () => {
    const f = fixture(); await f.feed(); const row = f.view().model.collections[0], gate = deferred();
    let persisted = false;
    f.deleting(async (col, deps) => {
        await gate.promise;
        if (!deps.session.isCurrent()) throw Error('Expired collection action');
        persisted = true;
    });
    const pending = f.view().actions.remove(row);
    f.CList.state.reader = { mode: 'account', requestId: 2 }; gate.resolve(); await pending;
    assert.equal(persisted, false); assert.equal(f.CList.state.collectionBrowsing.busy, false);
});
test('feed account actions use the captured registry target and never delete a changed account', async () => {
    const f = fixture(), account = { key: 'feed', value: JSON.stringify({ type: 'Feed', title: 'News' }) };
    f.CList.accounts.push(account); await f.feed(); const row = f.view().model.collections.find(col => col.feedSubscription);
    await f.view().actions.edit(row); assert.equal(f.calls.find(call => call[0] === 'feed-edit')[1], 'feed');
    account.value = JSON.stringify({ type: 'Feed', title: 'Replacement' }); await f.view().actions.remove(row);
    assert.equal(f.calls.some(call => call[0] === 'account-remove'), false); assert.match(f.view().model.error, /account changed/);
});
test('My Collections loader excludes subscriptions and guards controls across Load navigation', async () => {
    const f = fixture(); f.CList.accounts.push({ key: 'feed', value: JSON.stringify({ type: 'Feed' }) });
    await f.show(); assert.equal(f.view().mode, 'load'); assert.equal(f.view().model.collections.length, 1);
    const actions = f.view().actions, row = f.view().model.collections[0];
    await actions.open(row); assert.equal(f.calls.find(call => call[0] === 'editor')[1].publishedUrls[0].url, 'https://published.invalid');
    f.CList.state.editorControls = { id: 3 }; await actions.open(row);
    assert.equal(f.calls.filter(call => call[0] === 'editor').length, 1);
});
test('detail actions preserve references and reject a late flattened result after account reading replaces it', async () => {
    const f = fixture(); await f.feed(); const row = f.view().model.collections[0];
    await f.view().actions.open(row); const detail = f.view();
    assert.equal(f.calls.find(call => call[0] === 'rows')[6](), true); await detail.actions.load();
    assert.equal(f.calls.find(call => call[0] === 'editor')[1].items[0].url, 'https://item.invalid');
    const gate = deferred(); f.flatten(() => gate.promise); const pending = detail.actions.share();
    f.CList.state.reader = { mode: 'account', requestId: 2 }; gate.resolve([{ url: 'https://late.invalid' }]); await pending;
    assert.equal(f.calls.some(call => call[0] === 'share'), false); assert.equal(f.CList.state.collectionBrowsing.busy, false);
    f.events.get('popstate')(); assert.equal(f.events.has('popstate'), false);
});
