const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const plain = value => JSON.parse(JSON.stringify(value));
const tick = () => new Promise(resolve => setImmediate(resolve));
const gate = () => { let resolve; const promise = new Promise(done => resolve = done); return { promise, resolve }; };
function fixture() {
    const events = [], choices = []; let token = 'token', hasContent = false, draft = { name: 'Draft', items: [{ title: 'Unsaved', url: 'https://draft.invalid' }] };
    const cList = { state: { username: 'alice' }, config: { flaskSiteUrl: 'https://store.invalid' }, keys: { ACCESS_TOKEN: 'access_token' }, ui: {} };
    const view = { choose(name, label, current) { const pending = gate(); choices.push({ name, label, current, resolve: pending.resolve }); return pending.promise; },
        cancelChoice() { choices.at(-1)?.resolve('cancel'); }, title: name => events.push(['title', name]), collectionContainer: () => null,
        readDraft: () => draft, returnBar: value => events.push(['return', value]), status: text => events.push(['status', text]), error: error => events.push(['error', error.message]) };
    cList.ui.collectionOpening = view;
    const ctx = vm.createContext({ window: { CList: cList }, console: { error() {} }, structuredClone,
        currentEditor: 'texteditor', currentEditorAccount: null, currentLoadedPage: null, _activeCollection: { col: { id: 'previous' } },
        editorHandlers: { texteditor: { label: 'Text' }, collection: {} }, getSiteSpecificCookie: () => token,
        editorHasActiveContent: () => hasContent, initializeEditor: async key => { ctx.currentEditor = key; return true; },
        setLoadedPage: page => { ctx.currentLoadedPage = page; events.push(['page', page]); }, escapeHtml: value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;'),
        _flattenForExport: async items => structuredClone(items), loadContent: async content => events.push(['insert', plain(content)]),
        pushReference: reference => { events.push(['reference', plain(reference)]); return true; },
        _resolveCollectionById: async id => ({ id, key: 'collection:nested', title: 'Nested', items: [] }),
        fetch: async url => { events.push(['fetch', url]); return { ok: true, text: async () => 'Exact <xml>' }; },
        loadSavedPage: async (...args) => events.push(['route', ...args]),
    });
    for (const name of ['collection-opening-workflow', 'collection-opening']) vm.runInContext(fs.readFileSync('js/' + name + '.js', 'utf8'), ctx);
    return { ctx, cList, view, events, choices, token: value => { token = value; }, content: value => { hasContent = value; }, draft: value => { draft = value; } };
}
const collection = () => ({ key: 'collection:one', id: 'urn:uuid:one', name: 'Original', items: [{ url: 'https://one.invalid', title: 'One', summary: '<Body>', author_name: 'Author', membershipId: 'm1' }] });

test('collection text export uses explicit nested flattening, retains structural references and excludes local blobs', async () => {
    const f = fixture(); let input;
    const result = await f.ctx.prepareCollectionText(collection(), true, { assertCurrent() {}, escape: f.ctx.escapeHtml,
        flatten: async (...args) => { input = args; return [...args[0], { url: 'blob:private', localOnly: true }]; } });
    assert.equal(input[1], 'urn:uuid:one'); assert.match(result.content.value, /&lt;Body>/);
    assert.equal(result.references.length, 1); assert.equal(result.references[0].membershipId, 'm1');
});

test('member workflow rejects external unowned URLs and requires credentials for nested collection reads', async () => {
    const f = fixture(), deps = { assertCurrent() {}, fetch() { assert.fail('unowned resource fetch'); }, canResolve: false };
    await assert.rejects(f.ctx.fetchCollectionMember({ url: 'https://external.invalid' }, null, deps), /not one of your editable/);
    await assert.rejects(f.ctx.fetchCollectionMember({ role: 'contains', collectionId: 'nested' }, null, deps), /log in/);
});

test('collection opening snapshots inputs and clears unrelated page metadata only after successful mount', async () => {
    const f = fixture(), col = collection(), mounted = gate();
    f.ctx.initializeEditor = () => mounted.promise;
    const pending = f.ctx._loadCollectionIntoEditor(col, 'token', 'key'); col.name = 'Changed'; col.items[0].title = 'Changed';
    mounted.resolve(true); await pending;
    assert.equal(f.ctx._activeCollection.col.name, 'Original'); assert.equal(f.ctx._activeCollection.col.items[0].title, 'One');
    assert.equal(f.events.find(event => event[0] === 'title')[1], 'Original'); assert.equal(f.ctx.currentLoadedPage, null);
});

test('Cancel and stale session choices preserve the active collection and never mount or insert', async () => {
    for (const mode of ['cancel', 'session']) {
        const f = fixture(), previous = f.ctx._activeCollection; f.content(true);
        const pending = f.ctx._loadCollectionIntoEditor(collection(), 'token', 'key'); await tick();
        if (mode === 'session') f.token('new-token'); f.choices.at(-1).resolve(mode === 'cancel' ? 'cancel' : 'open'); await pending;
        assert.equal(f.ctx._activeCollection, previous); assert.equal(f.events.some(event => event[0] === 'insert'), false);
    }
});

test('failed/expired collection mounts restore only their own active target', async () => {
    for (const mode of ['failure', 'expired', 'newer']) {
        const f = fixture(), previous = f.ctx._activeCollection, mounted = gate(); f.ctx.initializeEditor = () => mounted.promise;
        const pending = f.ctx._loadCollectionIntoEditor(collection(), 'token', 'key');
        const newer = { col: { id: 'newer' } };
        if (mode !== 'failure') { f.token('new-token'); if (mode === 'newer') f.ctx._activeCollection = newer; }
        mounted.resolve(mode !== 'failure'); await pending;
        assert.equal(f.ctx._activeCollection, mode === 'newer' ? newer : previous);
        assert.equal(f.events.some(event => event[0] === 'title'), false);
    }
});

test('Insert as text waits for preparation then uses captured content and exact references', async () => {
    const f = fixture(); f.content(true);
    const pending = f.ctx._loadCollectionIntoEditor(collection(), 'token', 'key'); await tick();
    f.choices.at(-1).resolve('insert'); await pending;
    assert.match(f.events.find(event => event[0] === 'insert')[1].value, /Author wrote/);
    assert.equal(f.events.find(event => event[0] === 'reference')[1].membershipId, 'm1');
    assert.equal(f.ctx.currentEditor, 'texteditor');
});

test('late insert preparation cannot deliver content after editor/page or Blank controls change', async () => {
    const f = fixture(), flattened = gate(); f.content(true); f.ctx._flattenForExport = () => flattened.promise;
    const pending = f.ctx._loadCollectionIntoEditor(collection(), 'token', 'key'); await tick(); f.choices.at(-1).resolve('insert'); await tick();
    f.cList.state.editorControls = { id: 2 }; flattened.resolve(collection().items); await pending;
    assert.equal(f.events.some(event => event[0] === 'insert' || event[0] === 'reference'), false);
});

test('member opening snapshots unsaved collection draft and retains owned page identity in shared routing', async () => {
    const f = fixture(); f.ctx.currentEditor = 'collection';
    const page = { id: 'page', pageKey: 'page:one', mimeType: 'text/html', url: 'https://one.invalid' };
    await f.ctx._openEntryForEdit({ url: page.url }, 'token', 'key', page);
    assert.equal(f.ctx._activeCollection.col.name, 'Draft'); assert.equal(f.ctx._activeCollection.col.items[0].title, 'Unsaved');
    const route = f.events.find(event => event[0] === 'route'); assert.equal(route[2].pageKey, 'page:one');
    assert.equal(route[1].value, 'Exact <xml>'); assert.equal(route[5](), true);
    f.token('new-token'); assert.equal(route[5](), false);
});

test('duplicate member clicks cannot start duplicate fetches and newer drafts reject delayed completion', async () => {
    const f = fixture(), downloaded = gate(); f.ctx.currentEditor = 'collection';
    f.ctx.fetch = async () => { f.events.push(['fetch']); return { ok: true, text: () => downloaded.promise }; };
    const item = { url: 'blob:local', localOnly: true };
    const pending = f.ctx._openEntryForEdit(item, 'token', 'key'); await tick(); await f.ctx._openEntryForEdit(item, 'token', 'key');
    f.draft({ name: 'Newer draft', items: [] }); downloaded.resolve('Old body'); await pending;
    assert.equal(f.events.filter(event => event[0] === 'fetch').length, 1); assert.equal(f.events.some(event => event[0] === 'route'), false);
});

test('anonymous local blob members remain editable without storage credentials', async () => {
    const f = fixture(); f.cList.state.username = undefined; f.token(null);
    await f.ctx.openCollectionMember({ url: 'blob:local', localOnly: true, mimeType: 'text/plain' }, null, null, null);
    assert.equal(f.events.find(event => event[0] === 'route')[1].type, 'text/plain');
});
