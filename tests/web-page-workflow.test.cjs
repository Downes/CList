const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const read = name => fs.readFileSync('js/' + name, 'utf8');

function fixture() {
    const context = vm.createContext({ structuredClone,
        escapeHtml: value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;'),
    });
    vm.runInContext(read('web-page-records.js'), context);
    vm.runInContext(read('web-page-workflow.js'), context);
    const writes = [], saved = [], touched = [], local = [];
    const page = { kind: 'page', id: 'urn:uuid:old', pageKey: 'page:old', service: 'CListBin',
        accountInstance: 'https://bin.test', serviceId: 'old-remote', url: 'https://bin.test/old', title: 'Old' };
    const request = { title: 'A <Title>', content: '<p>Body</p>', mimeType: 'text/html', page: null,
        authorDid: 'did:web:kv.test:users:stephen', service: 'CListBin' };
    const dependencies = {
        account: { type: 'CListBin', instance: 'https://bin.test', permissions: 'b' },
        adapter: {
            publish: async (...args) => { writes.push(['publish', ...args]); return { url: 'https://bin.test/new', serviceId: 'new-remote' }; },
            update: async (...args) => { writes.push(['update', ...args]); return { url: 'https://bin.test/old' }; },
        },
        createId: () => 'urn:uuid:new', now: () => 'captured-time', embedIdentity: context._embedWebPageIdentity,
        saveRecord: async record => { saved.push(record); return 'page:new'; },
        touchRecord: async (...args) => { touched.push(args); return { id: 'urn:uuid:old', pageKey: 'page:old', forked: false }; },
        recordLocalPublication: async (...args) => local.push(args), assertSession() {},
    };
    return { context, request, dependencies, page, writes, saved, touched, local };
}

test('new web publication runs without DOM/global state, embeds HTML identity, and saves separate page metadata', async () => {
    const f = fixture(), result = await f.context.runWebPagePublication(f.request, 'new', f.dependencies);
    assert.equal('document' in f.context, false); assert.equal('window' in f.context, false);
    assert.equal(f.writes.length, 1); assert.equal(f.writes[0][0], 'publish');
    assert.match(f.writes[0][1], /dcterms.identifier.*urn:uuid:new/);
    assert.match(f.writes[0][1], /<title>A &lt;Title>/);
    assert.equal(f.saved[0].authorDid, f.request.authorDid); assert.equal(f.saved[0].mimeType, 'text/html');
    assert.equal(result.loadedPage.pageKey, 'page:new'); assert.equal(result.loadedPage.serviceId, 'new-remote');
    assert.equal(result.status, 'published'); assert.equal(result.metadataError, null);
});

test('plain text stays unchanged; independent new versions get new identities without touching the old record', async () => {
    const f = fixture(); f.request.page = f.page; f.request.content = 'Original plain text'; f.request.mimeType = 'text/plain';
    const result = await f.context.runWebPagePublication(f.request, 'new', f.dependencies);
    assert.equal(f.writes[0][1], 'Original plain text'); assert.equal(result.id, 'urn:uuid:new');
    assert.equal(f.touched.length, 0); assert.equal(f.page.id, 'urn:uuid:old');
});

test('overwrite reuses the exact service resource and identity; different destinations cannot be overwritten', async () => {
    const f = fixture(); f.request.page = f.page;
    const result = await f.context.runWebPagePublication(f.request, 'overwrite', f.dependencies);
    assert.equal(f.writes[0][0], 'update'); assert.equal(f.writes[0][1], 'old-remote');
    assert.match(f.writes[0][2], /urn:uuid:old/); assert.equal(result.id, 'urn:uuid:old');
    assert.equal(f.touched[0][0], 'page:old'); assert.equal(f.touched[0][2].mimeType, 'text/html');
    f.dependencies.account.instance = 'https://another.test';
    await assert.rejects(f.context.runWebPagePublication(f.request, 'overwrite', f.dependencies), /different destination/);
    assert.equal(f.writes.length, 1);
});

test('local document publication annotates PageStore without creating a published-page KV record', async () => {
    const f = fixture(); f.request.page = { kind: 'local-page', id: 'native-page' };
    const result = await f.context.runWebPagePublication(f.request, 'new', f.dependencies);
    assert.equal(f.local[0][0], 'native-page'); assert.equal(f.local[0][1].url, result.url);
    assert.equal(result.localPublication.format, 'HTML'); assert.equal(result.loadedPage, null);
    assert.equal(f.saved.length, 0); assert.equal(f.touched.length, 0);
});

test('remote failures reject; metadata failures remain published outcomes and never repeat the write', async () => {
    for (const mode of ['new', 'overwrite', 'local']) {
        const f = fixture(); if (mode === 'overwrite') f.request.page = f.page;
        if (mode === 'local') f.request.page = { kind: 'local-page', id: 'native-page' };
        const fail = async () => { throw Error('metadata offline'); };
        f.dependencies.saveRecord = fail; f.dependencies.touchRecord = fail; f.dependencies.recordLocalPublication = fail;
        const result = await f.context.runWebPagePublication(f.request, mode === 'overwrite' ? 'overwrite' : 'new', f.dependencies);
        assert.equal(result.status, 'published'); assert.equal(result.metadataError, 'metadata offline'); assert.equal(f.writes.length, 1);
    }
    const f = fixture(); f.dependencies.adapter.publish = async () => { throw Error('remote rejected'); };
    await assert.rejects(f.context.runWebPagePublication(f.request, 'new', f.dependencies), /remote rejected/);
    assert.equal(f.saved.length, 0);
});

test('captured content/source/author and account values stay stable while a remote write is pending', async () => {
    const f = fixture(); let release;
    f.dependencies.adapter.publish = async (...args) => { f.writes.push(args); return new Promise(resolve => { release = resolve; }); };
    const pending = f.context.runWebPagePublication(f.request, 'new', f.dependencies);
    await new Promise(resolve => setImmediate(resolve));
    f.request.title = 'Later title'; f.request.authorDid = 'different author'; f.request.page = { kind: 'local-page', id: 'different-page' };
    f.dependencies.account.instance = 'https://other.test'; release({ url: 'https://bin.test/new', serviceId: 'new' });
    await pending;
    assert.equal(f.saved[0].title, 'A <Title>'); assert.equal(f.saved[0].authorDid, 'did:web:kv.test:users:stephen');
    assert.equal(f.saved[0].accountInstance, 'https://bin.test'); assert.equal(f.local.length, 0);
});

test('missing URLs are unconfirmed without metadata writes, and update can retain its known URL', async () => {
    const f = fixture(); f.dependencies.adapter.publish = async () => ({});
    const result = await f.context.runWebPagePublication(f.request, 'new', f.dependencies);
    assert.equal(result.status, 'unconfirmed'); assert.equal(f.saved.length, 0);
    f.request.page = f.page; f.dependencies.adapter.update = async () => ({});
    const updated = await f.context.runWebPagePublication(f.request, 'overwrite', f.dependencies);
    assert.equal(updated.url, f.page.url); assert.equal(updated.status, 'published');
});

test('a changed session blocks a remote write; a session change afterward is a metadata-only failure', async () => {
    const f = fixture(); f.dependencies.assertSession = () => { throw Error('session changed'); };
    await assert.rejects(f.context.runWebPagePublication(f.request, 'new', f.dependencies), /session changed/);
    assert.equal(f.writes.length, 0);
    let checks = 0; f.dependencies.assertSession = () => { if (++checks > 1) throw Error('session changed'); };
    const result = await f.context.runWebPagePublication(f.request, 'new', f.dependencies);
    assert.equal(result.status, 'published'); assert.equal(result.metadataError, 'session changed'); assert.equal(f.writes.length, 1);
});

test('metadata helpers retain same-author/alias identity and fork another author without altering the original record', async () => {
    const store = new Map(), currentDid = 'did:web:kv.test:users:stephen';
    const context = vm.createContext({ structuredClone, crypto: { randomUUID: () => 'fork' }, console: { error() {} },
        window: { CList: { storage: { kv: {
            list: async () => [...store].map(([key, value]) => ({ key, value })),
            put: async (key, value) => store.set(key, value), update: async (key, value) => store.set(key, value),
        } } } }, assertAccountSession() {},
        decryptKVJson: async (_, value) => JSON.parse(value), encryptWithKey: async (_, value) => value,
        fetch: async () => ({ ok: true, json: async () => ({ alsoKnownAs: [currentDid] }) }),
    });
    vm.runInContext(read('web-page-records.js'), context);
    const session = { encKey: 'key', authorDid: currentDid };
    const original = { id: 'urn:uuid:old', title: 'Original', authorDid: currentDid };
    store.set('page:old', JSON.stringify(original));
    let result = await context._touchOrForkWebPageRecord('page:old', original.id, {}, session);
    assert.equal(result.forked, false); assert.equal(result.id, original.id);
    original.authorDid = 'did:web:old.test:users:stephen'; store.set('page:old', JSON.stringify(original));
    result = await context._touchOrForkWebPageRecord('page:old', original.id, {}, session);
    assert.equal(result.forked, false);
    context.fetch = async () => ({ ok: false }); store.set('page:old', JSON.stringify(original));
    result = await context._touchOrForkWebPageRecord('page:old', original.id, { mimeType: 'text/html' }, session);
    assert.equal(result.forked, true); assert.equal(result.pageKey, 'page:fork');
    assert.deepEqual(JSON.parse(store.get('page:old')), original);
    const forked = JSON.parse(store.get('page:fork')); assert.equal(forked.derivedFrom, original.id);
    assert.equal(forked.authorDid, currentDid); assert.equal(forked.mimeType, 'text/html');
});

test('legacy file-save callers can use page record helpers without an explicit session', async () => {
    const store = new Map();
    const context = vm.createContext({ structuredClone, crypto: { randomUUID: () => 'legacy' },
        window: { CList: { config: { flaskSiteUrl: 'https://kv.test' }, keys: { ACCESS_TOKEN: 'access_token' },
            state: { username: 'stephen' }, storage: { kv: {
                list: async () => [...store].map(([key, value]) => ({ key, value })),
                put: async (key, value) => store.set(key, value), update: async (key, value) => store.set(key, value),
            } } } }, getSiteSpecificCookie: () => 'token', getEncKey: async () => 'key',
        encryptWithKey: async (_, value) => value, decryptKVJson: async (_, value) => JSON.parse(value),
    });
    vm.runInContext(read('account-state.js'), context); vm.runInContext(read('web-page-records.js'), context);
    const key = await context._saveWebPageRecord({ id: 'urn:uuid:legacy', authorDid: 'did:web:kv.test:users:stephen', title: 'Page' });
    assert.equal(key, 'page:legacy');
    const touched = await context._touchOrForkWebPageRecord(key, 'urn:uuid:legacy', { savedLocally: true });
    assert.equal(touched.forked, false); assert.equal(JSON.parse(store.get(key)).savedLocally, true);
});
