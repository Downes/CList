const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function fixture({ withDocument = true } = {}) {
    const logins = [], posts = [], response = { innerHTML: '' };
    let failedLogin = null;
    const ctx = vm.createContext({
        window: { CList: { schemas: {}, readers: {}, publishers: {} } },
        console: { log() {}, error() {} }, Intl, structuredClone,
        removeHtml: content => content.replace(/<[^>]*>/g, ''),
        showErrorModal() {}, showStatusMessage() {},
        renderPublicationSuccess() {}, showPostMessage() {}, showServiceError() {},
        ensureAccountsLoaded: async () => { throw Error('Publishing must not scan the shared account list'); },
        fetch: async (url, init) => {
            if (url.includes('/com.atproto.identity.resolveHandle?')) {
                const handle = new URL(url).searchParams.get('handle');
                return { ok: true, json: async () => ({ did: 'did:plc:' + handle.split('.')[0] }) };
            }
            if (url.startsWith('https://plc.directory/')) {
                const name = url.split(':').at(-1);
                return { ok: true, json: async () => ({ service: [{ id: '#atproto_pds', serviceEndpoint: `https://${name}.pds.test` }] }) };
            }
            if (url.endsWith('/com.atproto.server.createSession')) {
                const body = JSON.parse(init.body); logins.push({ url, body });
                if (body.identifier === failedLogin) return { ok: false, status: 401 };
                const name = body.identifier.split('.')[0];
                return { ok: true, json: async () => ({ accessJwt: name + '-token', did: 'did:plc:' + name }) };
            }
            if (url.endsWith('/com.atproto.repo.createRecord')) {
                posts.push({ url, token: init.headers.Authorization, body: JSON.parse(init.body) });
                return { ok: true, json: async () => ({ uri: 'at://example/app.bsky.feed.post/id', cid: 'cid' }) };
            }
            throw Error('Unexpected request: ' + url);
        },
    });
    if (withDocument) ctx.document = { getElementById: () => response };
    vm.runInContext(fs.readFileSync('js/bluesky.js', 'utf8'), ctx);
    vm.runInContext(fs.readFileSync('js/bluesky_publish.js', 'utf8'), ctx);
    vm.runInContext("_bskyToken = 'reader-token'; _bskyDid = 'did:plc:reader'; _bskyPds = 'https://reader.pds.test';", ctx);
    const account = name => ({ type: 'Bluesky', instance: name + '.test', id: name + '-password', title: name });
    return { ctx, logins, posts, response, account, failLogin: handle => { failedLogin = handle; } };
}

test('selected Bluesky publisher authenticates its own account and leaves the reader session intact', async () => {
    const f = fixture();
    const url = await f.ctx.window.CList.publishers.Bluesky.publish(f.account('alice'), 'Title', '<p>Selected account</p>', []);
    assert.equal(url, 'https://bsky.app/profile/did:plc:alice/post/id');
    assert.deepEqual(f.logins[0].body, { identifier: 'alice.test', password: 'alice-password' });
    assert.equal(f.posts[0].url, 'https://alice.pds.test/xrpc/com.atproto.repo.createRecord');
    assert.equal(f.posts[0].token, 'Bearer alice-token'); assert.equal(f.posts[0].body.repo, 'did:plc:alice');
    assert.equal(f.posts[0].body.record.text, 'Selected account');
    const reader = await f.ctx.createBlueskySession();
    assert.equal(reader.accessToken, 'reader-token'); assert.equal(reader.did, 'did:plc:reader');
    assert.equal(reader.pds, 'https://reader.pds.test');
});

test('two concurrently selected accounts never exchange their token, repository, or PDS', async () => {
    const f = fixture(), publisher = f.ctx.window.CList.publishers.Bluesky;
    await Promise.all([
        publisher.publish(f.account('alice'), '', 'Alice post', []),
        publisher.publish(f.account('bob'), '', 'Bob post', []),
    ]);
    assert.equal(f.logins.length, 2); assert.equal(f.posts.length, 2);
    for (const name of ['alice', 'bob']) {
        const post = f.posts.find(post => post.body.repo === 'did:plc:' + name);
        assert.equal(post.token, 'Bearer ' + name + '-token');
        assert.equal(post.url, `https://${name}.pds.test/xrpc/com.atproto.repo.createRecord`);
    }
});

test('selected-account authentication can run without a document and captures credentials before awaiting resolution', async () => {
    const f = fixture({ withDocument: false }), selected = f.account('alice');
    const pending = f.ctx.createBlueskyAccountSession(selected);
    selected.instance = 'bob.test'; selected.id = 'bob-password';
    const session = await pending;
    assert.equal(session.did, 'did:plc:alice'); assert.equal(session.accessToken, 'alice-token');
    assert.equal(f.logins[0].body.password, 'alice-password');
    assert.equal('document' in f.ctx, false);
});

test('failed or missing selected credentials never fall back to the reader session or write a post', async () => {
    const f = fixture(); f.failLogin('alice.test');
    const publisher = f.ctx.window.CList.publishers.Bluesky;
    await assert.rejects(publisher.publish(f.account('alice'), '', 'Post', []), /login failed.*alice.test.*401/);
    await assert.rejects(publisher.publish({ type: 'Bluesky', instance: 'alice.test' }, '', 'Post', []), /selected Bluesky publishing account/);
    await assert.rejects(publisher.publish(undefined, '', 'Post', []), /selected Bluesky publishing account/);
    assert.equal(f.posts.length, 0); assert.equal(f.logins.length, 1);
});

test('selected-account publishing keeps the existing reply record while using that account session', async () => {
    const f = fixture();
    await f.ctx.window.CList.publishers.Bluesky.publish(f.account('alice'), '', 'Reply', [
        { replyToken: { type: 'Bluesky', uri: 'at://parent/post', cid: 'parent-cid' } },
    ]);
    assert.deepEqual(f.posts[0].body.record.reply, {
        parent: { uri: 'at://parent/post', cid: 'parent-cid' }, root: { uri: 'at://parent/post', cid: 'parent-cid' },
    });
    assert.equal(f.posts[0].body.repo, 'did:plc:alice');
});

test('standalone reader post form retains its existing reader-session path', async () => {
    const f = fixture(); await f.ctx.submitBlueskyPost('Reader post', 'blueskyPostResponse');
    assert.equal(f.logins.length, 0); assert.equal(f.posts[0].body.repo, 'did:plc:reader');
    assert.equal(f.posts[0].token, 'Bearer reader-token');
});
