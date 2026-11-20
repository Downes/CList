const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const plain = value => JSON.parse(JSON.stringify(value));
function fixture(records = []) {
    let token = 'token', key = async () => 'key', listing = async () => records, fetching = async () => ({ ok: true, text: async () => '<p>Page</p>' });
    let deleting = async () => {}, removing = async () => {}, updating = async () => {};
    const errors = [], messages = [], loads = [], deletes = [], removes = [], updates = [];
    let model, actions, mounted, onClose;
    const view = { mount(close) { onClose = close; return mounted = { root: { isConnected: true }, body: {} }; },
        message(view, message) { messages.push(message); }, render(view, next, callbacks) { model = next; actions = callbacks; },
        error(error) { errors.push(error.message); }, status(message) { messages.push(message); } };
    const ctx = vm.createContext({ console: { error() {} }, structuredClone, currentEditor: 'texteditor', currentLoadedPage: null,
        _collectionFormatParsers: { RSS: text => ({ title: text, items: [{ url: 'https://item.invalid' }] }) }, _activeCollection: null,
        window: { CList: { state: { username: 'user' }, config: { flaskSiteUrl: 'https://kv.invalid' }, keys: { ACCESS_TOKEN: 'access_token' },
            ui: { myPages: view }, accounts: [{ value: JSON.stringify({ type: 'Bin', instance: 'original', permissions: 'b' }) }],
            binPublishers: { Bin: { delete: (...args) => { deletes.push(args); return deleting(...args); } } },
            storage: { kv: { list: () => listing(), remove: k => { removes.push(k); return removing(k); }, update: (k, v) => { updates.push([k, v]); return updating(k, v); } } } } },
        getSiteSpecificCookie: () => token, getEncKey: () => key(), assertAccountSession(session) { if (!session.encKey || session.token !== token) throw Error('Session changed'); },
        decryptKVJson: async (key, value) => JSON.parse(value), encryptWithKey: async (key, value) => value,
        _parseCollectionData(raw) { return Array.isArray(raw) ? { items: raw, publishedUrls: [] } : { ...raw, publishedUrls: raw.publishedUrls || [] }; },
        parseAccountValue: record => JSON.parse(record.value), fetch: (...args) => fetching(...args),
        loadSavedPage: async (...args) => { loads.push(args); }, initializeEditor: async key => { ctx.currentEditor = key; },
        setLoadedPage: page => { ctx.currentLoadedPage = page; }, closeLoadSurfaces() {},
    });
    for (const name of ['web-page-workflow', 'my-pages-state', 'my-pages-workflow', 'my-pages']) vm.runInContext(fs.readFileSync('js/' + name + '.js', 'utf8'), ctx);
    return { ctx, errors, messages, loads, deletes, removes, updates, show: () => ctx.showMyPages(), model: () => model, actions: () => actions,
        token(value) { token = value; }, key(fn) { key = fn; }, list(fn) { listing = fn; }, fetch(fn) { fetching = fn; },
        deleting(fn) { deleting = fn; }, removing(fn) { removing = fn; }, updating(fn) { updating = fn; }, close() { onClose(); mounted.root.isConnected = false; } };
}
const page = (overrides = {}) => ({ id: 'id', title: 'Page', url: 'https://page.invalid', mimeType: 'text/html', publishedAt: '2026-11-19', ...overrides });
const record = (key, value) => ({ key, value: JSON.stringify(value) });
function sharedCollectionFixture() {
    const f = fixture([record('collection:c', { id: 'cid', title: 'Collection', items: [],
        publishedUrls: [{ format: 'RSS', url: 'https://rss.invalid', serviceId: 'sid' }] })]);
    let draft = 'Existing draft', choice, review;
    f.ctx.editorHandlers = { collection: { getContent: () => draft } };
    f.ctx.window.CList.ui.editorLoad = {
        chooseCollection(parsed, format, target, open, native, cancel) { choice = { open, native, cancel }; },
        reviewCollection(open, cancel) { review = { open, cancel }; }, error(error) { f.errors.push(error.message); },
    };
    f.ctx._resolveCollectionIdentity = (key, id) => ({ key: key || 'collection:generated', id: id || 'generated' });
    f.ctx.closeRightPane = () => {};
    const collections = fs.readFileSync('js/collections.js', 'utf8');
    vm.runInContext(collections.slice(collections.indexOf('window.openParsedAsCollection ='), collections.indexOf('// Public bridge: parse text')), f.ctx);
    for (const name of ['editor-load-state', 'editor-load']) vm.runInContext(fs.readFileSync('js/' + name + '.js', 'utf8'), f.ctx);
    return { ...f, choice: () => choice, review: () => review, draft: value => { draft = value; },
        active: () => f.ctx._activeCollection };
}

test('My Pages pure sorting and pagination cover whole list and clamp after removal', () => {
    const f = fixture(), state = f.ctx.createMyPagesState();
    state.pageSize = 20; state.pageIndex = 4;
    const pages = Array.from({ length: 45 }, (_, i) => page({ title: String(i).padStart(2, '0') }));
    const sorted = f.ctx.sortMyPages(state, 'title'), slice = f.ctx.sliceMyPages(pages, { ...sorted, pageIndex: 4 });
    assert.equal(slice.pageIndex, 2); assert.equal(slice.rows.length, 5); assert.equal(slice.rows[0].title, '40');
    assert.equal(f.ctx.sliceMyPages([], state).pageIndex, 0); assert.equal(f.ctx.sliceMyPages(pages, { ...state, pageSize: 'All' }).rows.length, 45);
});
test('list merges page and collection publications, warns for corrupt records and keeps local-only entries', async () => {
    const f = fixture([record('page:local', page({ savedLocally: true, url: undefined })),
        record('collection:c', { id: 'cid', title: 'Collection', items: [], publishedUrls: [{ format: 'RSS', url: 'https://rss.invalid' }] }), { key: 'page:bad', value: '{' }]);
    await f.show(); const model = f.model();
    assert.equal(model.slice.total, 2); assert.match(model.warning, /1 unreadable/);
    assert.equal(model.slice.rows.find(p => p.kind === 'collection').collectionKey, 'collection:c');
    assert.equal(model.canLoad(model.slice.rows.find(p => p.savedLocally)), false);
    assert.equal(JSON.stringify(f.ctx.window.CList.state.myPages).includes('token'), false);
});
test('fetch uses selected URL and load hands full identity to shared content recognition', async () => {
    const f = fixture([record('page:a', page({ service: 'Bin', accountInstance: 'original', serviceId: 'sid' }))]);
    await f.show(); await f.actions().load(f.model().slice.rows[0]);
    assert.equal(f.loads.length, 1); assert.equal(f.loads[0][0].value, '<p>Page</p>');
    assert.equal(f.loads[0][1].pageKey, 'page:a'); assert.equal(f.loads[0][1].serviceId, 'sid');
});
test('delayed loading rejects switched editor/page, closed modal and changed session', async () => {
    for (const expire of [f => { f.ctx.currentEditor = 'other'; }, f => { f.ctx.currentLoadedPage = {}; }, f => f.close(), f => f.token('new'),
        f => { f.ctx.currentEditorAccount = { key: 'other' }; },
        f => { f.ctx.window.CList.state.editorControls = { id: 2 }; },
        f => { f.ctx.window.CList.state.editorSwitching = { id: 2 }; },
        f => { f.ctx.window.CList.state.editorLoading = { id: 2 }; }]) {
        const f = fixture([record('page:a', page())]); let finish;
        f.fetch(() => new Promise(resolve => finish = resolve)); await f.show();
        const pending = f.actions().load(f.model().slice.rows[0]); expire(f);
        finish({ ok: true, text: async () => 'late' }); await pending; assert.equal(f.loads.length, 0);
    }
});
test('old rows and duplicate clicks cannot start another action', async () => {
    const f = fixture([record('page:a', page())]); await f.show();
    const oldActions = f.actions(), row = f.model().slice.rows[0]; oldActions.sort('title');
    await oldActions.load(row); assert.equal(f.loads.length, 0);
    let finish; f.fetch(() => new Promise(resolve => finish = resolve));
    const current = f.actions(), pending = current.load(row); await current.load(row);
    finish({ ok: true, text: async () => 'only' }); await pending; assert.equal(f.loads.length, 1);
});
test('collection loading shares representation/draft review while carrying identity and publication metadata', async () => {
    const f = fixture([record('collection:c', { id: 'cid', title: 'Collection', items: [], publishedUrls: [{ format: 'RSS', url: 'https://rss.invalid', serviceId: 'sid' }] })]);
    await f.show(); await f.actions().load(f.model().slice.rows[0]);
    assert.equal(f.loads[0][0].collection.items[0].url, 'https://item.invalid');
    assert.equal(f.loads[0][0].sourceText, '<p>Page</p>');
    assert.equal(f.loads[0][1].collectionKey, 'collection:c'); assert.equal(f.loads[0][1].serviceId, 'sid');
    assert.equal(f.loads[0][4](), true); f.token('other'); assert.equal(f.loads[0][4](), false);
});
test('real shared collection loading offers representation before draft review and preserves publication identity', async () => {
    const f = sharedCollectionFixture(); const previous = f.ctx._activeCollection = { col: { id: 'previous' } };
    await f.show(); await f.actions().load(f.model().slice.rows[0]);
    assert.ok(f.choice()); assert.equal(f.review(), undefined); assert.equal(f.active(), previous);
    await f.choice().open(); assert.ok(f.review()); assert.equal(f.active(), previous);
    const open = f.review().open; await open(); await open();
    assert.equal(f.active().col.id, 'cid'); assert.equal(f.active().col.key, 'collection:c');
    assert.equal(f.ctx.currentLoadedPage.serviceId, 'sid'); assert.equal(f.ctx.window.CList.state.editorLoading.phase, 'complete');
});
test('shared collection choices expire with session/account/editor switching and Cancel keeps draft', async () => {
    for (const expire of [f => f.token('new'), f => { f.ctx.currentEditorAccount = { key: 'other' }; },
        f => { f.ctx.window.CList.state.editorSwitching = { id: 2 }; }]) {
        const f = sharedCollectionFixture(), previous = f.ctx._activeCollection = { col: { id: 'previous' } };
        await f.show(); await f.actions().load(f.model().slice.rows[0]); expire(f); await f.choice().open();
        assert.equal(f.active(), previous); assert.equal(f.review(), undefined);
    }
    const f = sharedCollectionFixture(), previous = f.ctx._activeCollection = { col: { id: 'previous' } };
    await f.show(); await f.actions().load(f.model().slice.rows[0]); await f.choice().open(); await f.review().cancel();
    assert.equal(f.active(), previous); assert.equal(f.ctx.currentLoadedPage, null);
});
test('native text choice permits its own editor switch and subsequent Replace callback', async () => {
    const f = sharedCollectionFixture(); let body = 'Existing text', review;
    f.ctx.currentEditor = 'tinymce';
    f.ctx.editorHandlers.texteditor = { contentTypes: ['text/plain'], initialize() {}, getContent: () => body, setContent: value => { body = value; } };
    f.ctx.editorHandlers.tinymce = { contentTypes: ['text/html'], initialize() {} };
    f.ctx.switchToEditor = async key => { f.ctx.currentEditor = key; return true; };
    Object.assign(f.ctx.window.CList.ui.editorLoad, { preparingReview() {}, reviewEditor(canReplace, target, actions) { review = actions; }, finished() {}, removeModal() {} });
    f.ctx.setReferences = () => {};
    await f.show(); await f.actions().load(f.model().slice.rows[0]); await f.choice().native();
    assert.equal(f.ctx.currentEditor, 'texteditor'); assert.ok(review);
    await review.replace(); assert.equal(body, '<p>Page</p>'); assert.equal(f.ctx.window.CList.state.editorLoading.phase, 'complete');
});
test('failed or expired collection mounting restores prior active collection without overwriting a newer load', async () => {
    for (const mode of ['failed', 'expired', 'newer']) {
        const f = sharedCollectionFixture(), previous = f.ctx._activeCollection = { col: { id: 'previous' } };
        f.draft(''); let finish; f.ctx.initializeEditor = () => new Promise(resolve => { finish = resolve; });
        await f.show(); await f.actions().load(f.model().slice.rows[0]); const pending = f.choice().open();
        await new Promise(resolve => setImmediate(resolve));
        const newer = { col: { id: 'newer' } };
        if (mode !== 'failed') { f.token('new'); if (mode === 'newer') f.ctx._activeCollection = newer; }
        finish(mode !== 'failed'); await pending;
        assert.equal(f.active(), mode === 'newer' ? newer : previous); assert.equal(f.ctx.currentLoadedPage, null);
        if (mode === 'failed') assert.match(f.errors[0], /initialization failed/);
    }
});
test('remote deletion failure preserves metadata and blocks blind retry of uncertain write', async () => {
    const f = fixture([record('page:a', page({ service: 'Bin', serviceId: 'sid', accountInstance: 'original' }))]);
    f.deleting(async () => { throw Error('Connection lost'); }); await f.show(); const row = f.model().slice.rows[0];
    await f.actions().remove(row); await f.actions().remove(row);
    assert.equal(f.deletes.length, 1); assert.equal(f.removes.length, 0); assert.match(f.model().warning, /could not be confirmed/);
});
test('confirmed remote deletion with failed metadata retries only metadata', async () => {
    const f = fixture([record('page:a', page({ service: 'Bin', serviceId: 'sid', accountInstance: 'original' }))]);
    f.removing(async () => { throw Error('Offline'); }); await f.show(); const row = f.model().slice.rows[0];
    await f.actions().remove(row); assert.match(f.model().warning, /Remote page deleted.*cleanup failed/);
    f.removing(async () => {}); await f.actions().remove(row);
    assert.equal(f.deletes.length, 1); assert.equal(f.removes.length, 2); assert.equal(f.model().slice.total, 0);
});
test('remote delete requires the exact original writable account and supported adapter', async () => {
    const f = fixture([record('page:a', page({ service: 'Bin', serviceId: 'sid', accountInstance: 'different' }))]);
    await f.show(); await f.actions().remove(f.model().slice.rows[0]);
    assert.equal(f.deletes.length, 0); assert.equal(f.removes.length, 0); assert.match(f.model().warning, /writable account/);
});
test('collection cleanup removes exact publication only and preserves unknown metadata and members', async () => {
    const publication = { url: 'https://same.invalid', format: 'RSS', service: 'Bin', serviceId: 'sid', accountInstance: 'original' };
    const col = { id: 'cid', title: 'Collection', custom: { keep: true }, items: [{ url: 'https://item.invalid' }],
        publishedUrls: [publication, { ...publication, accountInstance: 'other' }, { ...publication, format: 'HTML' }] };
    const f = fixture([record('collection:c', col)]); await f.show();
    await f.actions().remove(f.model().slice.rows.find(p => p.accountInstance === 'original' && p.format === 'RSS'));
    const saved = JSON.parse(f.updates[0][1]); assert.deepEqual(saved.items, col.items); assert.deepEqual(saved.custom, { keep: true });
    assert.equal(saved.publishedUrls.length, 2); assert.equal(f.deletes.length, 1);
});
test('changed session after accepted remote delete prevents metadata write and records receipt', async () => {
    const f = fixture([record('page:a', page({ service: 'Bin', serviceId: 'sid', accountInstance: 'original' }))]);
    f.deleting(async () => f.token('new')); await f.show(); await f.actions().remove(f.model().slice.rows[0]);
    assert.equal(f.deletes.length, 1); assert.equal(f.removes.length, 0);
    assert.equal(vm.runInContext('[..._myPagesOwner.receipts.values()][0].remoteDeleted', f.ctx), true);
});
test('list failures are visible and late lists cannot replace a newer panel', async () => {
    const f = fixture(); f.list(async () => { throw Error('Unavailable'); }); await f.show(); assert.match(f.messages.at(-1), /Could not load pages.*Unavailable/);
    let finish; f.list(() => new Promise(resolve => finish = resolve)); const first = f.show();
    await new Promise(resolve => setImmediate(resolve)); f.list(async () => [record('page:new', page({ title: 'New' }))]);
    await f.show(); finish([record('page:old', page({ title: 'Old' }))]); await first;
    assert.equal(f.model().slice.rows[0].title, 'New');
});


test('standalone deletion keeps replacement targets before and after remote deletion', async () => {
    const original = page({ service: 'Bin', serviceId: 'sid', accountInstance: 'original' });
    const f = fixture([record('page:a', original)]); await f.show();
    const row = f.model().slice.rows[0];
    f.list(async () => [record('page:a', { ...original, serviceId: 'replacement' })]);
    await f.actions().remove(row);
    assert.equal(f.deletes.length, 0); assert.equal(f.removes.length, 0);
    assert.match(f.model().warning, /record has changed/);

    const g = fixture([record('page:a', original)]); await g.show();
    const captured = g.model().slice.rows[0];
    g.deleting(async () => { g.list(async () => [record('page:a', { ...original, url: 'https://replacement.invalid' })]); });
    await g.actions().remove(captured);
    assert.equal(g.deletes.length, 1); assert.equal(g.removes.length, 0);
    assert.match(g.model().warning, /Remote page deleted.*record has changed/);
    await g.actions().remove(captured);
    assert.equal(g.deletes.length, 1); assert.equal(g.removes.length, 0);
});


test('legacy collection publications without embedded IDs keep their original storage key', async () => {
    const f = sharedCollectionFixture();
    f.ctx._resolveCollectionIdentity = (key, id) => id ? { key, id } : { key: 'collection:new', id: 'minted' };
    const publication = { kind: 'collection', collectionKey: 'collection:legacy-name', serviceId: 'sid' };
    await f.ctx.window.openParsedAsCollection({ title: 'Legacy', items: [] }, publication);
    assert.equal(f.active().col.key, 'collection:legacy-name'); assert.equal(f.active().col.id, 'minted');
    assert.equal(f.ctx.currentLoadedPage.collectionKey, 'collection:legacy-name');
    assert.equal(f.ctx.currentLoadedPage.id, 'minted'); assert.equal(publication.id, undefined);
});
