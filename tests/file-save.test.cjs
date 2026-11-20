const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { Element } = require('./helpers/account-fixture.cjs');
const source = name => fs.readFileSync('js/' + name + '.js', 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };

function workflow() {
    const ctx = vm.createContext({ console, structuredClone });
    vm.runInContext(source('file-save-workflow'), ctx);
    return ctx;
}
const request = extra => ({ id: 'urn:uuid:original', loggedIn: true, authorDid: 'did:web:author',
    page: null, title: 'Draft', editor: 'texteditor', references: [], referenceHtml: '<p>Original refs</p>', ...extra });
const output = extra => ({ value: '<p>Captured body</p>', name: undefined, raw: false,
    mimeType: 'text/html', title: 'Draft', ...extra });

test('local export retains native annotation and slide bodies and exact loaded filenames', async () => {
    const ctx = workflow();
    const native = JSON.stringify({ format: 'clist-annotation-v1', body: 'Note', target: { url: 'https://target.invalid' } });
    const annotation = await ctx.prepareLocalFile(request({ handler: { getFileContent: async () => ({ value: native,
        type: 'application/vnd.clist.annotation+json' }), getContent() { throw Error('body-only export'); } } }), {});
    assert.equal(annotation.value, native); assert.equal(annotation.name, 'annotation.json');
    assert.equal(annotation.mimeType, 'application/vnd.clist.annotation+json');
    const slides = await ctx.prepareLocalFile(request({ handler: { fileExtension: 'json', contentTypes: ['application/json'],
        getContent: async () => '{"slides":[]}' }, page: { kind: 'file', title: 'slides.wrong' } }), {});
    assert.equal(slides.value, '{"slides":[]}'); assert.equal(slides.name, 'slides.wrong'); assert.equal(slides.raw, true);
});

test('local export packages fresh documents with captured title, references and handler; loaded files round-trip raw', async () => {
    const ctx = workflow(); const handler = { contentTypes: ['text/plain'], getContent: async () => 'Literal <xml>' };
    let packaged;
    const wrapped = await ctx.prepareLocalFile(request({ handler, references: [{ url: 'https://ref.invalid' }] }), {
        packagePost: async options => { packaged = options; return '<div>Snapshot</div>'; },
    });
    assert.equal(packaged.title, 'Draft'); assert.equal(packaged.editorHandler, handler);
    assert.equal(packaged.content, 'Literal <xml>');
    assert.equal(packaged.referenceHtml, '<p>Original refs</p>');
    assert.deepEqual(plain(packaged.fileMetadata.references), [{ url: 'https://ref.invalid' }]);
    assert.equal(wrapped.raw, false); assert.equal(wrapped.mimeType, 'text/html');
    const raw = await ctx.prepareLocalFile(request({ handler, page: { kind: 'file', title: 'ordinary.xml' } }), {
        packagePost() { throw Error('raw file must not be wrapped'); },
    });
    assert.equal(raw.value, 'Literal <xml>'); assert.equal(raw.name, 'ordinary.xml'); assert.equal(raw.mimeType, 'text/plain');
    await assert.rejects(ctx.prepareLocalFile(request({ handler: { fileExtension: 'txt', getContent: async () => ({ bad: true }) } }), {}), /text content/);
});

function operations(extra = {}) {
    const calls = [];
    return { calls, deps: { assertCurrent() {}, now: () => '2026-11-19T12:00:00.000Z',
        write: async (...args) => { calls.push(['write', ...args]); return { status: 'saved', name: 'content.txt' }; },
        saveRecord: async record => { calls.push(['index', record]); return 'page:original'; },
        touch: async (...args) => { calls.push(['touch', ...args]); return { id: 'urn:uuid:derived', pageKey: 'page:derived', forked: true }; },
        aliasHandle: (...args) => calls.push(['alias', ...args]), ...extra } };
}

test('cancelled and failed local writes never create or touch My Pages records', async () => {
    const ctx = workflow();
    for (const existing of [null, { id: 'urn:uuid:original', pageKey: 'page:original' }]) {
        const cancelled = operations({ write: async () => ({ status: 'cancelled' }) });
        assert.equal((await ctx.runLocalFileSave(request({ page: existing }), output(), cancelled.deps)).status, 'cancelled');
        assert.deepEqual(cancelled.calls, []);
        const failed = operations({ write: async () => { throw Error('Disk full'); } });
        await assert.rejects(ctx.runLocalFileSave(request({ page: existing }), output(), failed.deps), /Disk full/);
        assert.deepEqual(failed.calls, []);
    }
});

test('confirmed file write precedes indexing and metadata failure retains a receipt without retrying', async () => {
    const ctx = workflow(), f = operations();
    const result = await ctx.runLocalFileSave(request(), output(), f.deps);
    assert.deepEqual(f.calls.map(call => call[0]), ['write', 'index']);
    assert.equal(result.loadedPage.pageKey, 'page:original'); assert.equal(result.loadedPage.savedLocally, true);
    const g = operations({ saveRecord: async () => { g.calls.push(['index']); throw Error('KV offline'); } });
    const failed = await ctx.runLocalFileSave(request(), output(), g.deps);
    assert.deepEqual(g.calls.map(call => call[0]), ['write', 'index']);
    assert.equal(failed.receipt.status, 'saved'); assert.equal(failed.metadataError.message, 'KV offline');
    assert.equal(failed.loadedPage, null);
});

test('existing page local saves retain metadata and use derived identity results; anonymous saves skip indexing', async () => {
    const ctx = workflow(), f = operations();
    const original = { id: 'urn:uuid:original', pageKey: 'page:original', title: 'Published', url: 'https://page.invalid', service: 'CListBin' };
    const result = await ctx.runLocalFileSave(request({ page: original }), output(), f.deps);
    assert.deepEqual(f.calls.map(call => call[0]), ['write', 'touch', 'alias']);
    assert.equal(result.loadedPage.url, original.url); assert.equal(result.loadedPage.id, 'urn:uuid:derived');
    assert.equal(result.forked, true); assert.equal(original.id, 'urn:uuid:original');
    const g = operations(); await ctx.runLocalFileSave(request({ loggedIn: false, id: null }), output(), g.deps);
    assert.deepEqual(g.calls.map(call => call[0]), ['write']);
});

test('session changes before a write reject it; changes after writing preserve receipt and skip indexing', async () => {
    const ctx = workflow(); let current = true;
    const f = operations({ assertCurrent() { if (!current) throw Error('session changed'); },
        write: async () => { current = false; return { status: 'saved', name: 'original.txt' }; } });
    const result = await ctx.runLocalFileSave(request(), output(), f.deps);
    assert.equal(result.receipt.name, 'original.txt'); assert.match(result.metadataError.message, /session changed/);
    assert.deepEqual(f.calls, []);
    await assert.rejects(ctx.runLocalFileSave(request(), output(), f.deps), /session changed/);
});

test('file transport reuses granted handles and replaces revoked handles before writing', async () => {
    const ctx = workflow(), events = [];
    const stream = { write: async value => events.push(['write', value]), close: async () => events.push(['close']) };
    const cached = { name: 'cached.txt', queryPermission: async () => 'granted', createWritable: async () => stream };
    const handles = { original: cached };
    const deps = { handles, assertCurrent() {}, pickFile: async () => { throw Error('unexpected picker'); } };
    assert.equal((await ctx.writeLocalFileTransport('first', 'original', 'unused.txt', deps)).name, 'cached.txt');
    assert.deepEqual(events, [['write', 'first'], ['close']]);
    cached.queryPermission = async () => 'denied'; cached.requestPermission = async () => 'denied';
    const replacement = { name: 'replacement.xml', createWritable: async () => stream };
    deps.pickFile = async options => { assert.equal(options.suggestedName, 'replacement.xml'); return replacement; };
    await ctx.writeLocalFileTransport('second', 'original', 'replacement.xml', deps);
    assert.equal(handles.original, replacement);
});

test('file transport handles picker cancellation and aborts failed streams without caching new handles', async () => {
    const ctx = workflow(), handles = {}; let aborted = 0, closed = 0;
    const deps = { handles, assertCurrent() {}, pickFile: async () => { throw Object.assign(Error('cancel'), { name: 'AbortError' }); } };
    assert.equal((await ctx.writeLocalFileTransport('body', 'id', 'draft.txt', deps)).status, 'cancelled');
    deps.pickFile = async () => ({ createWritable: async () => ({ write: async () => { throw Error('disk full'); },
        close: async () => closed++, abort: async () => aborted++ }) });
    await assert.rejects(ctx.writeLocalFileTransport('body', 'id', 'draft.txt', deps), /disk full/);
    assert.equal(aborted, 1); assert.equal(closed, 0); assert.equal(handles.id, undefined);
});

function controller() {
    const events = [], pending = deferred();
    const cList = { state: { username: 'alice' }, config: { flaskSiteUrl: 'https://kv.invalid' }, keys: { ACCESS_TOKEN: 'access_token' },
        ui: { view: { writeTitle: { innerText: 'Original title' } } } };
    const sourcePage = { kind: 'file', title: 'original.txt', mimeType: 'text/plain' };
    const ctx = vm.createContext({ window: { CList: cList }, console: { error() {} }, structuredClone,
        document: { getElementById: () => ({ innerHTML: '<p>Original refs</p>' }) }, crypto: { randomUUID: () => 'new-id' },
        currentEditor: 'original', currentLoadedPage: sourcePage,
        editorHandlers: { original: { fileExtension: 'txt', contentTypes: ['text/plain'], getContent: () => pending.promise } },
        getReferences: () => [], getSiteSpecificCookie: () => 'token', getEncKey: async () => 'key',
        _currentAuthorDid: () => 'did:web:alice', assertAccountSession: session => { session.isCurrent?.(); },
        _saveWebPageRecord: async record => { events.push(['index', plain(record)]); return 'page:new-id'; },
        _touchOrForkWebPageRecord: async () => { throw Error('unexpected touch'); },
        setLoadedPage: page => { events.push(['loaded', plain(page)]); ctx.currentLoadedPage = page; },
        showLocalFileSaveResult: result => events.push(['result', result]),
        showErrorModal: message => events.push(['error', message]), packagePost: async () => { throw Error('unexpected package'); },
    });
    vm.runInContext('const _localFileHandles = {};', ctx);
    vm.runInContext(source('file-save-workflow'), ctx); vm.runInContext(source('file-save'), ctx);
    ctx._writeLocalFile = async (...args) => { events.push(['write', ...args.slice(0, 3)]); return { status: 'saved', name: 'original.txt' }; };
    return { ctx, cList, events, pending, sourcePage };
}

test('local-save controller blocks duplicate exports and keeps captured file/title when editor changes', async () => {
    const f = controller(), first = f.ctx.saveContent();
    assert.equal(await f.ctx.saveContent(), null);
    f.ctx.currentEditor = 'another'; f.ctx.currentLoadedPage = { kind: 'page', title: 'New document' };
    f.cList.ui.view.writeTitle.innerText = 'New title'; f.pending.resolve('Original body');
    await first;
    assert.deepEqual(f.events.find(event => event[0] === 'write'), ['write', 'Original body', 'urn:uuid:new-id', 'original.txt']);
    assert.equal(f.events.find(event => event[0] === 'index')[1].title, 'original.txt');
    assert.equal(f.events.some(event => event[0] === 'loaded'), false);
    assert.equal(f.cList.state.fileSave.busy, false); assert.equal(f.cList.state.fileSave.status, 'saved');
    assert.equal(JSON.stringify(f.cList.state.fileSave).includes('token'), false);
});

test('local-save controller refuses changed sessions before writing and releases lock for retry', async () => {
    const f = controller(), save = f.ctx.saveContent(); f.cList.state.username = 'bob'; f.pending.resolve('Body');
    await assert.rejects(save, /session changed/);
    assert.equal(f.events.some(event => event[0] === 'write'), false);
    assert.equal(f.events.some(event => event[0] === 'index'), false);
    assert.equal(f.cList.state.fileSave.busy, false); assert.equal(f.cList.state.fileSave.status, 'failed');
    assert.match(f.events.find(event => event[0] === 'error')[1], /session changed/);
});

test('local-save completion cannot attach old identity to a blank or reload with the same null page', async () => {
    for (const lifetime of ['editorSwitching', 'editorLoading', 'editorControls']) {
        const f = controller(); f.ctx.currentLoadedPage = null; f.cList.state[lifetime] = { id: 1 };
        const save = f.ctx.saveContent(); f.cList.state[lifetime].id = 2; f.pending.resolve('Original body');
        await save;
        assert.equal(f.events.some(event => event[0] === 'write'), true);
        assert.equal(f.events.some(event => event[0] === 'loaded'), false);
    }
});

test('local-save capture failures give feedback and release the busy lock', async () => {
    const f = controller(); f.ctx.getReferences = () => { throw Error('references unavailable'); };
    await assert.rejects(f.ctx.saveContent(), /references unavailable/);
    assert.equal(f.cList.state.fileSave.busy, false);
    assert.match(f.events.find(event => event[0] === 'error')[1], /references unavailable/);
});

test('local-save handle cache survives one session and clears across username, server or token changes', async () => {
    for (const change of ['username', 'server', 'token']) {
        const f = controller(); f.pending.resolve('Body');
        f.ctx._touchOrForkWebPageRecord = async (pageKey, id) => ({ pageKey, id, forked: false });
        await f.ctx.saveContent();
        const handles = vm.runInContext('_localFileHandles', f.ctx), originalHandle = { name: 'original.txt' };
        handles['urn:uuid:new-id'] = originalHandle;
        await f.ctx.saveContent();
        assert.equal(handles['urn:uuid:new-id'], originalHandle, 'same session retains cached handle');
        if (change === 'username') f.cList.state.username = 'bob';
        if (change === 'server') f.cList.config.flaskSiteUrl = 'https://other-kv.invalid';
        if (change === 'token') f.ctx.getSiteSpecificCookie = () => 'replacement-token';
        await f.ctx.saveContent();
        assert.equal(Object.keys(handles).length, 0, change + ' change clears previous-session handles');
    }
});

test('local-save mints an identity for unowned imports while retaining indexed owned identity', async () => {
    const imported = controller(); imported.ctx.currentLoadedPage = { kind: 'file', title: 'imported.txt', id: 'urn:uuid:foreign' };
    imported.pending.resolve('Imported body'); await imported.ctx.saveContent();
    assert.equal(imported.events.find(event => event[0] === 'write')[2], 'urn:uuid:new-id');
    assert.equal(imported.events.find(event => event[0] === 'index')[1].id, 'urn:uuid:new-id');
    const owned = controller(); owned.ctx.currentLoadedPage = { kind: 'file', title: 'owned.txt', id: 'urn:uuid:owned', pageKey: 'page:owned' };
    owned.ctx._touchOrForkWebPageRecord = async (pageKey, id) => ({ pageKey, id, forked: false });
    owned.pending.resolve('Owned body'); await owned.ctx.saveContent();
    assert.equal(owned.events.find(event => event[0] === 'write')[2], 'urn:uuid:owned');
    assert.equal(owned.events.some(event => event[0] === 'index'), false);
});

function view({ observe = false } = {}) {
    let dialog; const downloads = [], errors = [], messages = [], observers = [];
    const ctx = vm.createContext({ Blob, console: { error() {} },
        ...(observe ? { MutationObserver: class {
            constructor(callback) { this.callback = callback; this.disconnected = false; observers.push(this); }
            observe() {} disconnect() { this.disconnected = true; }
        } } : {}),
        document: { body: new Element(), createElement: tag => { const node = new Element(tag); node.select = () => {}; return node; } },
        buildDialogModal: (title, input, buttons) => { dialog = { title, input, buttons, closed: 0,
            close() { dialog.closed++; } }; return dialog; },
        downloadBlob: (blob, name) => downloads.push({ blob, name }),
        showStatusMessage: text => messages.push(text), showErrorModal: text => errors.push(text),
    });
    vm.runInContext(source('file-save-view'), ctx);
    return { ctx, downloads, errors, messages, observers, dialog: () => dialog };
}

test('filename choice stays pending, supports Cancel and Enter, and rejects stale or duplicate callbacks', async () => {
    const f = view(); let settled = false;
    const cancelled = f.ctx.chooseLocalFileDownload('body', 'original.txt').then(result => { settled = true; return result; });
    await Promise.resolve(); assert.equal(settled, false);
    let dialog = f.dialog(); dialog.buttons[0].onClick(dialog.close);
    assert.equal((await cancelled).status, 'cancelled'); assert.equal(f.downloads.length, 0);
    dialog.buttons[1].onClick(dialog.close); assert.equal(f.downloads.length, 0);
    const downloaded = f.ctx.chooseLocalFileDownload('exact body', 'original.txt'); dialog = f.dialog();
    dialog.input.value = '  renamed.xml  ';
    dialog.input.listeners.keydown({ key: 'Enter', preventDefault() {} });
    dialog.buttons[1].onClick(dialog.close);
    assert.equal((await downloaded).status, 'downloaded'); assert.equal(f.downloads.length, 1);
    assert.equal(f.downloads[0].name, 'renamed.xml'); assert.equal(await f.downloads[0].blob.text(), 'exact body');
    const stale = f.ctx.chooseLocalFileDownload('body', 'name.txt', () => { throw Error('session changed'); });
    dialog = f.dialog(); dialog.buttons[1].onClick(dialog.close);
    await assert.rejects(stale, /session changed/); assert.equal(f.downloads.length, 1);
});

test('detached filename Save and Cancel settle without downloading or closing a replacement dialog', async () => {
    for (const action of [0, 1]) {
        const f = view(), old = f.ctx.chooseLocalFileDownload('old body', 'old.txt'), oldDialog = f.dialog();
        oldDialog.input.isConnected = false;
        const replacement = f.ctx.chooseLocalFileDownload('new body', 'new.txt'), replacementDialog = f.dialog();
        oldDialog.buttons[action].onClick(oldDialog.close);
        assert.equal((await old).status, 'cancelled');
        assert.equal(replacementDialog.closed, 0); assert.equal(f.downloads.length, 0);
        replacementDialog.buttons[0].onClick(replacementDialog.close); await replacement;
    }
});

test('removing the filename panel cancels pending work through its observer and disconnects it', async () => {
    const f = view({ observe: true }), pending = f.ctx.chooseLocalFileDownload('body', 'draft.txt');
    const dialog = f.dialog(), observer = f.observers[0];
    dialog.input.isConnected = false; observer.callback();
    assert.equal((await pending).status, 'cancelled'); assert.equal(observer.disconnected, true);
    assert.equal(dialog.closed, 0); assert.equal(f.downloads.length, 0);
    dialog.buttons[1].onClick(dialog.close); assert.equal(f.downloads.length, 0);
});

test('local-save view distinguishes browser download requests and metadata-only failures', () => {
    const f = view(); f.ctx.showLocalFileSaveResult({ status: 'cancelled' }); assert.deepEqual(f.messages, []);
    f.ctx.showLocalFileSaveResult({ status: 'downloaded', metadataError: Error('offline') });
    assert.match(f.messages[0], /download requested/); assert.match(f.errors[0], /My Pages.*offline/);
});
