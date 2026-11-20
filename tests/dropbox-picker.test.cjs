const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const plain = value => JSON.parse(JSON.stringify(value));
const tick = () => new Promise(resolve => setImmediate(resolve));
const file = (name, date = '2026-11-19') => ({ '.tag': 'file', name, path_display: '/CList/' + name, server_modified: date });
function fixture() {
    const events = [], loads = [], views = [], requests = [];
    const cList = { state: { username: 'alice' }, config: { flaskSiteUrl: 'https://kv.invalid' }, ui: { view: {} } };
    let token = 'token', accountValue = 'original', listing = async () => ({ entries: [file('note.wrong')] }),
        next = async () => { throw Error('Unexpected continuation'); }, downloading = async () => '<p>Annotation</p>';
    const view = { mount(cancel) { const value = { root: { isConnected: true }, body: {}, cancel }; views.push(value); return value; },
        message(view, message, error) { events.push({ message, error }); },
        files(view, files, busy, selected, choose, error) { view.model = { files, busy, selected, choose, error }; },
        close(view) { view.root.isConnected = false; }, error(error) { events.push({ error: error.message }); } };
    cList.ui.dropboxPicker = view;
    const ctx = vm.createContext({ window: { CList: cList }, structuredClone, console: { error() {} },
        currentEditor: 'texteditor', currentEditorAccount: null, currentLoadedPage: null,
        findAccountByType: () => ({ account: { key: 'Dropbox', value: accountValue }, parsedValue: { id: 'access', folder: '/CList' } }),
        captureDropboxSession(found) {
            if (!found) throw Error('No Dropbox account');
            return { data: structuredClone(found.parsedValue), username: cList.state.username, token, accountValue, storeUrl: cList.config.flaskSiteUrl };
        },
        assertDropboxSession(capture) {
            if (capture.username !== cList.state.username || capture.token !== token || capture.accountValue !== accountValue
                || capture.storeUrl !== cList.config.flaskSiteUrl) throw Error('Changed session/account');
        },
        createDropboxRequestClient(capture) { return { call: async callback => { ctx.assertDropboxSession(capture); const result = await callback(capture.data.id); ctx.assertDropboxSession(capture); return result; } }; },
        _dropboxListFolder: (...args) => { requests.push(['list', ...args]); return listing(...args); },
        _dropboxContinueFolder: (...args) => { requests.push(['next', ...args]); return next(...args); },
        _dropboxDownloadFile: (...args) => { requests.push(['download', ...args]); return downloading(...args); },
        restorePostContent: (text, type, name) => ({ value: text, type: 'text/plain', page: { kind: 'file', title: name } }),
        loadSavedPage: async (...args) => { loads.push(args); }, populateLoadOptions: () => events.push({ sources: true }),
    });
    vm.runInContext(fs.readFileSync('js/dropbox_picker.js', 'utf8'), ctx);
    return { ctx, cList, loads, events, views, requests, open: () => ctx.loadDropboxFiles(), current: () => views.at(-1),
        token(value) { token = value; }, account(value) { accountValue = value; },
        list(value) { listing = value; }, next(value) { next = value; }, download(value) { downloading = value; } };
}

test('Dropbox picker loads all pages, filters folders, deduplicates paths and sorts globally', async () => {
    const f = fixture();
    f.list(async () => ({ entries: [file('old.txt', '2025'), { '.tag': 'folder', name: 'Folder' }], has_more: true, cursor: 'one' }));
    f.next(async cursor => ({ entries: [file('new.txt', '2026'), file('old.txt', '2025')], has_more: false }));
    const pending = f.open(); await tick();
    assert.deepEqual(plain(f.current().model.files.map(item => item.name)), ['new.txt', 'old.txt']);
    assert.deepEqual(f.requests[1], ['next', 'access', 'one']); assert.equal(f.cList.state.dropboxLoading.count, 2);
    f.current().cancel(); assert.equal(await pending, null);
});

test('Dropbox picker rejects cyclic continuation instead of looping and reports visible errors', async () => {
    const f = fixture(); f.list(async () => ({ entries: [], has_more: true, cursor: 'same' }));
    f.next(async () => ({ entries: [], has_more: true, cursor: 'same' }));
    await f.open(); assert.match(f.events.at(-1).message, /invalid folder cursor/);
    assert.equal(f.cList.state.dropboxLoading.phase, 'failed'); assert.equal(f.requests.length, 2);
});

test('Dropbox continuation applies latest updates, deletions and case-insensitive paths in stream order', async () => {
    const f = fixture();
    f.list(async () => ({ entries: [file('Note.txt', '2025'), file('removed.txt'), file('folder-now.txt'), file('readded.txt')],
        has_more: true, cursor: 'changes' }));
    f.next(async () => ({ entries: [
        { ...file('NOTE.txt', '2027'), path_lower: '/clist/note.txt' },
        { '.tag': 'deleted', path_display: '/CLIST/Removed.TXT' },
        { '.tag': 'folder', path_lower: '/clist/folder-now.txt' },
        { '.tag': 'deleted', path_lower: '/clist/readded.txt' }, file('READDED.txt', '2026'),
    ], has_more: false }));
    const pending = f.open(); await tick();
    assert.deepEqual(plain(f.current().model.files.map(item => item.name)), ['NOTE.txt', 'READDED.txt']);
    assert.equal(f.current().model.files[0].server_modified, '2027');
    f.current().cancel(); await pending;
});

test('Dropbox picker keeps source pending until chosen and routes exact filename through recognition', async () => {
    const f = fixture(); let done = false; const pending = f.open().then(() => { done = true; }); await tick();
    assert.equal(done, false); const selected = f.current().model.files[0];
    await f.current().model.choose(selected); await pending;
    assert.equal(f.loads[0][0].value, '<p>Annotation</p>'); assert.equal(f.loads[0][1].title, 'note.wrong');
    assert.deepEqual(f.requests.find(item => item[0] === 'download'), ['download', 'access', '/CList/note.wrong']);
    assert.equal(f.cList.state.dropboxLoading.phase, 'routed');
    assert.equal(JSON.stringify(f.cList.state.dropboxLoading).includes('access'), false);
});

test('Dropbox picker duplicates share one download and explicit retry follows visible read failure', async () => {
    const f = fixture(); let finish; f.download(() => new Promise(resolve => { finish = resolve; }));
    const pending = f.open(); await tick(); const model = f.current().model, selected = model.files[0];
    const first = model.choose(selected); await model.choose(selected);
    assert.equal(f.requests.filter(item => item[0] === 'download').length, 1);
    finish('Native body'); await first; await pending;

    const g = fixture(); g.download(async () => { throw Error('Read failed'); }); const second = g.open(); await tick();
    await g.current().model.choose(g.current().model.files[0]);
    assert.match(g.current().model.error, /Read failed/); assert.equal(g.current().model.busy, false);
    g.download(async () => 'Retry body'); await g.current().model.choose(g.current().model.files[0]); await second;
    assert.equal(g.loads[0][0].value, 'Retry body');
});

test('Cancel and replaced pickers settle pending sources and invalidate detached row callbacks', async () => {
    const f = fixture(), first = f.open(); await tick(); const old = f.current(), oldModel = old.model;
    const second = f.open(); await first; await tick(); await oldModel.choose(oldModel.files[0]);
    assert.equal(f.loads.length, 0); assert.equal(old.root.isConnected, false);
    f.current().cancel(); await second; assert.equal(f.cList.state.dropboxLoading.busy, false);
});

test('delayed Dropbox reads cannot route after session, account, page or editor lifecycle changes', async () => {
    for (const expire of [f => f.token('new'), f => f.account('updated'), f => { f.ctx.currentEditor = 'other'; },
        f => { f.ctx.currentEditorAccount = {}; }, f => { f.ctx.currentLoadedPage = {}; },
        f => { f.cList.state.editorControls = { id: 2 }; }, f => { f.cList.state.editorLoading = { id: 2 }; },
        f => { f.cList.state.editorSwitching = { id: 2 }; }, f => { f.current().root.isConnected = false; }]) {
        const f = fixture(); let finish; f.download(() => new Promise(resolve => { finish = resolve; }));
        const pending = f.open(); await tick(); const action = f.current().model.choose(f.current().model.files[0]);
        expire(f); finish('Old session body'); await action; await pending; assert.equal(f.loads.length, 0);
    }
});

test('pending shared editor choices retain only session/control ownership after an intentional mount', async () => {
    const f = fixture(), pending = f.open(); await tick();
    await f.current().model.choose(f.current().model.files[0]); await pending;
    const guard = f.loads[0][4]; f.ctx.currentEditor = 'chosen'; f.ctx.currentEditorAccount = { key: 'chosen' };
    f.ctx.currentLoadedPage = { title: 'chosen' }; f.cList.state.editorLoading = { id: 10 };
    assert.equal(guard(), true); f.token('different'); assert.equal(guard(), false);
});

test('empty folder/list failures settle source and scope errors explain reauthorization', async () => {
    const f = fixture(); f.list(async () => ({ entries: [] })); await f.open();
    assert.equal(f.cList.state.dropboxLoading.phase, 'empty'); assert.match(f.events.at(-1).message, /No files found/);
    const g = fixture(); g.list(async () => { throw Object.assign(Error('Denied'), { missingScope: true }); }); await g.open();
    assert.match(g.events.at(-1).message, /files.content.read/); assert.equal(g.cList.state.dropboxLoading.busy, false);
});

test('late Dropbox listing cannot replace a new picker or source', async () => {
    const f = fixture(); let finish; f.list(() => new Promise(resolve => { finish = resolve; }));
    const first = f.open(); f.list(async () => ({ entries: [file('new.txt')] })); const second = f.open(); await first; await tick();
    finish({ entries: [file('old.txt')] }); await tick(); assert.equal(f.current().model.files[0].name, 'new.txt');
    f.current().cancel(); await second;
});


test('empty and failed picker panels can still be closed after their source promise settles', async () => {
    for (const failed of [false, true]) {
        const f = fixture();
        f.list(async () => { if (failed) throw Error('List failed'); return { entries: [], has_more: false }; });
        await f.open(); assert.equal(f.current().root.isConnected, true);
        f.current().cancel(); assert.equal(f.current().root.isConnected, false);
        assert.equal(f.cList.state.dropboxLoading.busy, false);
    }
});
