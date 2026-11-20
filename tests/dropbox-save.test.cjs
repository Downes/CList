const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = name => fs.readFileSync('js/' + name + '.js', 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const unauthorized = () => Object.assign(Error('Authentication rejected'), { status: 401 });

function sessionFixture() {
    const data = { type: 'Dropbox', title: 'Private files', folder: '/Original', permissions: 'b',
        id: 'old-token', refresh: 'refresh-token', appKey: 'app-key', custom: { retained: true } };
    const account = { key: 'Dropbox original', value: JSON.stringify(data) };
    const writes = [], refreshes = [], progress = [];
    let token = 'site-token';
    const cList = { state: { username: 'alice' }, config: { flaskSiteUrl: 'https://store.invalid' },
        keys: { ACCESS_TOKEN: 'access_token' }, accounts: [account], ui: {}, savers: [] };
    const ctx = vm.createContext({ window: { CList: cList }, structuredClone,
        console: { error() {} }, getSiteSpecificCookie: () => token,
        getEncKey: async url => { assert.equal(url, 'https://store.invalid'); return 'captured-key'; },
        _dropboxRefresh: async (...args) => { refreshes.push(args); return 'new-token'; },
        saveAccount: async (request, session) => {
            session.isCurrent(); assert.equal(session.encKey, 'captured-key');
            assert.equal(session.token, 'site-token'); writes.push(plain(request)); return structuredClone(request);
        },
    });
    vm.runInContext(source('dropbox_session'), ctx);
    return { ctx, cList, data, account, writes, refreshes, progress,
        capture: permission => ctx.captureDropboxSession({ account, parsedValue: data }, permission),
        token(value) { token = value; } };
}

test('Dropbox capture detaches credentials and rejects changed login, server, token, account and permissions', () => {
    for (const change of [f => { f.cList.state.username = 'bob'; }, f => { f.cList.config.flaskSiteUrl = 'https://other.invalid'; },
        f => f.token('other'), f => { f.cList.accounts = []; }, f => { f.account.value = '{}'; }]) {
        const f = sessionFixture(), capture = f.capture('b');
        f.data.folder = '/Late mutation'; assert.equal(capture.data.folder, '/Original');
        change(f); assert.throws(() => f.ctx.assertDropboxSession(capture), /changed|removed/);
    }
    const f = sessionFixture(); f.data.permissions = 'r';
    assert.throws(() => f.capture('b'), /changed|removed/);
});

test('explicit Dropbox authentication rejection refreshes once and persists only the captured account with extensions', async () => {
    const f = sessionFixture(), capture = f.capture('b'), attempts = [];
    const client = f.ctx.createDropboxRequestClient(capture, text => f.progress.push(text));
    const result = await client.call(async token => { attempts.push(token); if (token === 'old-token') throw unauthorized(); return 'ok'; });
    assert.equal(result, 'ok'); assert.deepEqual(attempts, ['old-token', 'new-token']);
    assert.deepEqual(f.refreshes, [['app-key', 'refresh-token']]); assert.equal(f.writes.length, 1);
    assert.equal(f.writes[0].key, 'Dropbox original'); assert.deepEqual(f.writes[0].data.custom, { retained: true });
    assert.equal(f.writes[0].data.id, 'new-token'); assert.equal(JSON.parse(f.account.value).id, 'new-token');
    assert.equal(capture.data.id, 'new-token'); assert.equal(f.progress.length, 1);
    assert.equal(f.ctx.assertDropboxSession(capture), true);
});

test('Dropbox client does not replay uncertain, scope or untyped errors and never loops a second 401', async () => {
    for (const error of [Object.assign(Error('response lost'), { uncertain: true }), Error('body mentioned 401'),
        Object.assign(unauthorized(), { missingScope: true }), Object.assign(Error('server failed'), { status: 500 })]) {
        const f = sessionFixture(); let calls = 0;
        await assert.rejects(f.ctx.createDropboxRequestClient(f.capture()).call(async () => { calls++; throw error; }));
        assert.equal(calls, 1); assert.equal(f.refreshes.length, 0); assert.equal(f.writes.length, 0);
    }
    const f = sessionFixture(); let calls = 0;
    await assert.rejects(f.ctx.createDropboxRequestClient(f.capture()).call(async () => { calls++; throw unauthorized(); }), /Authentication/);
    assert.equal(calls, 2); assert.equal(f.refreshes.length, 1);
});

test('failed credential persistence or changed session during refresh prevents Dropbox request replay', async () => {
    for (const mode of ['persist', 'session', 'account']) {
        const f = sessionFixture(), capture = f.capture(); let attempts = 0;
        if (mode === 'persist') f.ctx.saveAccount = async () => { throw Error('KV offline'); };
        else f.ctx._dropboxRefresh = async () => {
            if (mode === 'session') f.token('new-site-token'); else f.account.value = '{}';
            return 'new-token';
        };
        await assert.rejects(f.ctx.createDropboxRequestClient(capture).call(async () => { attempts++; throw unauthorized(); }));
        assert.equal(attempts, 1); assert.equal(JSON.parse(f.account.value).id, mode === 'account' ? undefined : 'old-token');
    }
});

function workflowFixture() {
    const ctx = vm.createContext({ structuredClone });
    for (const name of ['file-save-workflow', 'dropbox_save_workflow']) vm.runInContext(source(name), ctx);
    return ctx;
}
const exportRequest = extra => ({ editor: 'texteditor', title: 'Captured title', references: [], referenceHtml: '<p>Refs</p>', page: null, ...extra });
const file = { value: '<p>Captured</p>', name: 'original.html' };
function operations(extra = {}) {
    const events = [];
    return { events, deps: { assertCurrent() {}, progress: text => events.push(['progress', text]),
        exists: async name => { events.push(['exists', name]); return false; },
        choose: async name => { events.push(['choose', name]); return 'overwrite'; },
        upload: async (...args) => { events.push(['upload', ...args]); return { id: 'id:accepted', rev: 'r1', path_display: '/Original/original.html' }; }, ...extra } };
}

test('Dropbox exports reuse native annotation/slide snapshots, raw original filenames and exact document metadata', async () => {
    const ctx = workflowFixture(), packaged = [];
    const deps = { prepareFile: ctx.prepareLocalFile, slug: title => 'slug-' + title,
        packagePost: async options => { packaged.push(options); return '<div>Packaged</div>'; } };
    const annotation = await ctx.prepareDropboxFile(exportRequest({ handler: { getFileContent: async () => ({ type: 'application/vnd.clist.annotation+json', value: '{"annotation":"native"}' }) } }), deps);
    assert.equal(annotation.name, 'annotation.json'); assert.equal(annotation.value, '{"annotation":"native"}');
    const slide = await ctx.prepareDropboxFile(exportRequest({ handler: { fileExtension: 'json', getContent: async () => '{"slides":[]}' } }), deps);
    assert.equal(slide.name, 'presentation.json'); assert.equal(slide.value, '{"slides":[]}');
    const raw = await ctx.prepareDropboxFile(exportRequest({ page: { kind: 'file', title: 'wrong.xml' }, handler: { getContent: async () => '' } }), deps);
    assert.equal(raw.name, 'wrong.xml'); assert.equal(raw.value, '');
    const handler = { contentTypes: ['text/plain'], getContent: async () => 'Exact <body>' };
    const html = await ctx.prepareDropboxFile(exportRequest({ title: ' Exact title ', references: [{ url: 'https://ref.invalid' }], handler }), deps);
    assert.equal(html.name, 'slug- Exact title .html'); assert.equal(packaged[0].content, 'Exact <body>');
    assert.equal(packaged[0].fileMetadata.title, ' Exact title '); assert.equal(packaged[0].referenceHtml, '<p>Refs</p>');
    assert.deepEqual(plain(packaged[0].fileMetadata.references), [{ url: 'https://ref.invalid' }]);
    assert.equal(packaged[0].editorHandler, handler);
});

test('Dropbox overwrite requires an explicit choice and Cancel performs no upload', async () => {
    const ctx = workflowFixture();
    for (const choice of ['cancel', 'overwrite']) {
        const f = operations({ exists: async () => true, choose: async () => choice });
        const result = await ctx.runDropboxFileSave(file, f.deps);
        const writes = f.events.filter(event => event[0] === 'upload');
        assert.equal(writes.length, choice === 'overwrite' ? 1 : 0);
        if (writes.length) assert.deepEqual(writes[0], ['upload', 'original.html', '<p>Captured</p>', 'overwrite']);
        assert.equal(result.status, choice === 'overwrite' ? 'saved' : 'cancelled'); assert.equal(result.keepOpen, true);
    }
});

test('confirmed add conflict leads to overwrite choice; uncertain and unrelated failures do not repeat the upload', async () => {
    const ctx = workflowFixture();
    const f = operations({ upload: async (...args) => {
        f.events.push(['upload', ...args]);
        if (args[2] === 'add') throw Object.assign(Error('conflict'), { status: 409, conflict: true });
        return { path_display: '/Original/original.html' };
    } });
    assert.equal((await ctx.runDropboxFileSave(file, f.deps)).status, 'saved');
    assert.deepEqual(f.events.filter(event => event[0] === 'upload').map(event => event[3]), ['add', 'overwrite']);
    assert.equal(f.events.filter(event => event[0] === 'choose').length, 1);
    for (const error of [Object.assign(Error('conflict words only'), { status: 409 }),
        Object.assign(Error('lost response'), { uncertain: true }), Object.assign(Error('server failed'), { status: 500 })]) {
        let writes = 0, choices = 0;
        const g = operations({ upload: async () => { writes++; throw error; }, choose: async () => { choices++; return 'overwrite'; } });
        await assert.rejects(ctx.runDropboxFileSave(file, g.deps)); assert.equal(writes, 1); assert.equal(choices, 0);
    }
});

function controllerFixture() {
    const f = sessionFixture(), events = [], panel = { root: { isConnected: true } };
    Object.assign(f.ctx, { currentEditor: 'texteditor', currentEditorAccount: null,
        currentLoadedPage: { kind: 'file', title: 'Original.txt' }, editorHandlers: { texteditor: { contentTypes: ['text/plain'], getContent: async () => 'Captured body' } },
        document: { getElementById: () => ({ innerHTML: '<p>Original refs</p>' }) }, getReferences: () => [],
        packagePost: async () => { throw Error('unexpected packaging'); }, slugify: value => value || 'clist-post',
        findAccountByType: () => ({ account: f.account, parsedValue: JSON.parse(f.account.value) }),
        showStatusMessage: text => events.push(['status', text]), isRegistered: () => true,
        _dropboxFileExists: async (...args) => { events.push(['exists', ...args]); return false; },
        _dropboxUpload: async (...args) => { events.push(['upload', ...args]); return { id: 'accepted-id', rev: 'rev1', path_display: '/Original/Original.txt' }; },
    });
    f.cList.ui.view = { writeTitle: { textContent: 'Original title' } };
    f.cList.ui.dropboxSave = {
        mount: () => panel, progress: (view, text) => events.push(['progress', text]),
        error: (view, error) => events.push(['error', error.message]), saved: (view, receipt) => events.push(['saved', plain(receipt)]),
        chooseOverwrite: async () => 'overwrite',
    };
    for (const name of ['file-save-workflow', 'dropbox_save_workflow', 'dropbox_save']) vm.runInContext(source(name), f.ctx);
    return { ...f, panel, events };
}

test('Dropbox controller blocks duplicate export and rejects switched editor/account/page or session before upload', async () => {
    const changes = [f => { f.ctx.currentEditor = 'other'; }, f => { f.ctx.currentEditorAccount = { key: 'other' }; },
        f => { f.ctx.currentLoadedPage = null; }, f => { f.cList.state.editorControls = { id: 2 }; },
        f => { f.cList.state.editorSwitching = { id: 2 }; }, f => { f.cList.state.editorLoading = { id: 2 }; },
        f => f.token('new-token'), f => { f.panel.root.isConnected = false; }];
    for (const change of changes) {
        const f = controllerFixture(), pending = deferred(); let reads = 0;
        f.ctx.editorHandlers.texteditor.getContent = () => { reads++; return pending.promise; };
        const save = f.ctx.saveToDropbox(); assert.deepEqual(plain(await f.ctx.saveToDropbox()), { keepOpen: true });
        change(f); pending.resolve('Captured body'); const result = await save;
        assert.equal(reads, 1); assert.equal(result.status, 'failed'); assert.equal(f.events.some(event => event[0] === 'upload'), false);
        assert.equal(f.cList.state.dropboxSaving.busy, false);
    }
});

test('Dropbox saves captured filename/body and safe receipt without content or credentials in state', async () => {
    const f = controllerFixture(); const result = await f.ctx.saveToDropbox();
    assert.equal(result.status, 'saved');
    assert.deepEqual(f.events.find(event => event[0] === 'upload'), ['upload', 'old-token', '/Original', 'Original.txt', 'Captured body', 'add']);
    assert.deepEqual(plain(f.cList.state.dropboxSaving.receipt), { name: 'Original.txt', path: '/Original/Original.txt', id: 'accepted-id', rev: 'rev1' });
    const serialized = JSON.stringify(f.cList.state.dropboxSaving);
    for (const secret of ['old-token', 'site-token', 'refresh-token', 'Captured body']) assert.equal(serialized.includes(secret), false);
});

test('accepted Dropbox upload keeps its receipt and does not rewrite a changed editor or replacement panel', async () => {
    for (const expire of [f => { f.ctx.currentEditor = 'new-editor'; }, f => f.token('new-site-token'), f => { f.panel.root.isConnected = false; }]) {
        const f = controllerFixture(), pending = deferred();
        f.ctx._dropboxUpload = async (...args) => { f.events.push(['upload', ...args]); return pending.promise; };
        const saving = f.ctx.saveToDropbox(); await new Promise(resolve => setImmediate(resolve)); expire(f);
        pending.resolve({ id: 'accepted-id', path_display: '/Original/Original.txt' });
        assert.equal((await saving).status, 'saved'); assert.equal(f.cList.state.dropboxSaving.receipt.id, 'accepted-id');
        assert.equal(f.events.some(event => event[0] === 'saved'), false);
        assert.ok(f.events.some(event => event[0] === 'status' && event[1].includes('earlier Dropbox save completed')));
    }
});

test('collection Dropbox export uses explicit serialized format and original folder; expired custom owner cannot write', async () => {
    const f = controllerFixture();
    await f.ctx.saveToDropbox({ prepare: async () => ({ name: 'Exact collection.rss', value: '<rss>Snapshot</rss>' }), isCurrent: () => true });
    assert.deepEqual(f.events.find(event => event[0] === 'upload'), ['upload', 'old-token', '/Original', 'Exact collection.rss', '<rss>Snapshot</rss>', 'add']);
    const g = controllerFixture();
    assert.equal((await g.ctx.saveToDropbox({ prepare: async () => ({ name: 'Exact.rss', value: '<rss/>' }), isCurrent: () => false })).status, 'failed');
    assert.equal(g.events.some(event => event[0] === 'upload'), false);
});

test('editor expiration during Dropbox refresh prevents a retry upload', async () => {
    const f = controllerFixture(), refresh = deferred(); let attempts = 0;
    f.ctx._dropboxUpload = async () => { attempts++; throw unauthorized(); };
    f.ctx._dropboxRefresh = () => refresh.promise;
    const saving = f.ctx.saveToDropbox(); await new Promise(resolve => setImmediate(resolve));
    f.ctx.currentEditor = 'new-editor'; refresh.resolve('new-token');
    assert.equal((await saving).status, 'failed'); assert.equal(attempts, 1);
});

function transportFixture(response) {
    const requests = [];
    const ctx = vm.createContext({ window: { CList: {} }, OAuthClient: { onCallback() {} }, URLSearchParams,
        console: { error() {} }, fetch: async (...args) => { requests.push(args); return typeof response === 'function' ? response(...args) : response; } });
    vm.runInContext(source('dropbox'), ctx);
    return { ctx, requests };
}
const response = (status, data) => ({ status, ok: status >= 200 && status < 300, json: async () => data,
    text: async () => typeof data === 'string' ? data : JSON.stringify(data) });

test('Dropbox transport distinguishes metadata absence from auth and other path failures', async () => {
    const missing = transportFixture(response(409, { error: { '.tag': 'path', path: { '.tag': 'not_found' } } }));
    assert.equal(await missing.ctx._dropboxFileExists('token', '/Folder/', 'Exact.txt'), false);
    assert.deepEqual(JSON.parse(missing.requests[0][1].body), { path: '/Folder/Exact.txt' });
    const auth = transportFixture(response(401, { error: 'expired_access_token' }));
    await assert.rejects(auth.ctx._dropboxFileExists('token', '/Folder', 'Exact.txt'), error => error.status === 401);
    for (const status of [404, 409, 500]) {
        const f = transportFixture(response(status, { error: { '.tag': 'path', path: { '.tag': 'not_file' } } }));
        await assert.rejects(f.ctx._dropboxFileExists('token', '/Folder', 'Exact.txt'), error => error.status === status);
    }
});

test('Dropbox upload preserves add/overwrite payloads and classifies definite conflict versus uncertain acceptance', async () => {
    const f = transportFixture(response(200, { path_display: '/Folder/Exact.txt' }));
    await f.ctx._dropboxUpload('token', '/Folder/', 'Exact.txt', 'Exact body', 'overwrite');
    assert.deepEqual(JSON.parse(f.requests[0][1].headers['Dropbox-API-Arg']), { path: '/Folder/Exact.txt', mode: 'overwrite', autorename: false });
    assert.equal(f.requests[0][1].headers.Authorization, 'Bearer token'); assert.equal(f.requests[0][1].body, 'Exact body');
    const conflict = transportFixture(response(409, { error: { '.tag': 'path', path: { '.tag': 'conflict' } } }));
    await assert.rejects(conflict.ctx._dropboxUpload('token', '', 'Exact.txt', 'body'), error => error.status === 409 && error.conflict);
    const network = transportFixture(() => { throw Error('Connection lost'); });
    await assert.rejects(network.ctx._dropboxUpload('token', '', 'Exact.txt', 'body'), error => error.uncertain && /Check Dropbox/.test(error.message));
    const malformed = transportFixture({ ok: true, json: async () => { throw Error('Unreadable receipt'); } });
    await assert.rejects(malformed.ctx._dropboxUpload('token', '', 'Exact.txt', 'body'), error => error.uncertain && /accepted/.test(error.message));
});

test('Dropbox folder continuation and download use explicit cursor/path and propagate scope errors', async () => {
    const f = transportFixture(response(200, { entries: [], cursor: 'next', has_more: false }));
    await f.ctx._dropboxListFolder('token', '/Folder/'); await f.ctx._dropboxContinueFolder('token', 'captured-cursor');
    assert.deepEqual(JSON.parse(f.requests[0][1].body), { path: '/Folder', recursive: false });
    assert.match(f.requests[1][0], /files\/list_folder\/continue$/); assert.deepEqual(JSON.parse(f.requests[1][1].body), { cursor: 'captured-cursor' });
    const download = transportFixture(response(200, 'Raw body'));
    assert.equal(await download.ctx._dropboxDownloadFile('token', '/Folder/wrong.xml'), 'Raw body');
    assert.deepEqual(JSON.parse(download.requests[0][1].headers['Dropbox-API-Arg']), { path: '/Folder/wrong.xml' });
    const scope = transportFixture(response(403, { error: 'missing_scope' }));
    await assert.rejects(scope.ctx._dropboxDownloadFile('token', '/Folder/a'), error => error.status === 403 && error.missingScope);
});
