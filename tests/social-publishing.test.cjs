const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const read = name => fs.readFileSync('js/' + name, 'utf8');

function fixture() {
    const posts = [], warnings = [];
    let metadata = { ok: true, json: async () => ({ configuration: { statuses: { max_characters: 500 } } }) };
    let response = { ok: true, json: async () => ({ url: 'https://social.test/status/1', uri: 'at://did:plc:alice/app.bsky.feed.post/record' }) };
    const context = vm.createContext({ window: { CList: { publishers: {} } }, Intl, structuredClone,
        removeHtml: value => value.replace(/<[^>]*>/g, ''),
        fetch: async (url, options) => {
            if (url.endsWith('/api/v1/instance')) return metadata;
            posts.push({ url, options, body: JSON.parse(options.body) }); return response;
        },
    });
    const utilities = read('utilities.js'), start = utilities.indexOf('function extractBaseUrl(');
    vm.runInContext(utilities.slice(start, utilities.indexOf('function extractAccountName(', start)), context);
    for (const name of ['mastodon_publish.js', 'bluesky_publish.js']) vm.runInContext(read(name), context);
    context.createBlueskyAccountSession = async () => ({ accessToken: 'alice-token', did: 'did:plc:alice', pds: 'https://alice.pds.test' });
    return { context, posts, warnings, options: { onWarning: message => warnings.push(message) },
        metadata: value => { metadata = value; }, response: value => { response = value; } };
}

test('Mastodon publisher is independent of DOM/read credentials and returns the server URL', async () => {
    const f = fixture();
    const url = await f.context.window.CList.publishers.Mastodon.publish(
        { instance: 'alice@social.test', id: 'selected-token' }, '', '<p>Text</p>',
        [{ replyToken: { type: 'Mastodon', statusId: 'reply-id' } }], f.options);
    assert.equal('document' in f.context, false); assert.equal(url, 'https://social.test/status/1');
    assert.equal(f.posts[0].url, 'https://social.test/api/v1/statuses');
    assert.equal(f.posts[0].options.headers.Authorization, 'Bearer selected-token');
    assert.deepEqual(f.posts[0].body, { status: 'Text', visibility: 'public', in_reply_to_id: 'reply-id' });
});

test('Mastodon instance limits truncate with data warnings; unavailable metadata sends the actual text', async () => {
    const f = fixture();
    f.metadata({ ok: true, json: async () => ({ configuration: { statuses: { max_characters: 4 } } }) });
    await f.context.publishMastodonStatus('token', 'https://social.test', 'Long text', null, f.options);
    assert.equal(f.posts[0].body.status, 'Long'); assert.equal(f.warnings.length, 1);
    f.metadata({ ok: false });
    await f.context.publishMastodonStatus('token', 'https://social.test', 'Retained text');
    assert.equal(f.posts[1].body.status, 'Retained text');
    f.metadata({ ok: true, json: async () => ({}) });
    await f.context.publishMastodonStatus('token', 'https://social.test', 'Other server');
    assert.equal(f.posts[2].body.status, 'Other server');
});

test('both publishers report multiple reply targets without rendering and retain the first compatible target', async () => {
    const f = fixture();
    await f.context.window.CList.publishers.Mastodon.publish({ instance: 'alice@social.test', id: 'token' }, '', 'Reply', [
        { author_name: 'First', replyToken: { type: 'Mastodon', statusId: 'first' } },
        { author_name: 'Second', replyToken: { type: 'Mastodon', statusId: 'second' } },
    ], f.options);
    await f.context.window.CList.publishers.Bluesky.publish({ type: 'Bluesky', instance: 'alice.test', id: 'password' }, '', 'Reply', [
        { author_name: 'First', replyToken: { type: 'Bluesky', uri: 'at://first/post', cid: 'first-cid' } },
        { author_name: 'Second', replyToken: { type: 'Bluesky', uri: 'at://second/post', cid: 'second-cid' } },
    ], f.options);
    assert.equal(f.posts[0].body.in_reply_to_id, 'first');
    assert.equal(f.posts[1].body.record.reply.parent.uri, 'at://first/post');
    assert.equal(f.warnings.length, 2); assert.ok(f.warnings.every(message => message.includes('First')));
});

test('Bluesky segments the cleaned text, respects Unicode graphemes, and returns a web link', async () => {
    const f = fixture(), grapheme = '👩‍🔬';
    const url = await f.context.window.CList.publishers.Bluesky.publish(
        { type: 'Bluesky', instance: 'alice.test', id: 'password' }, '', '<b>' + grapheme.repeat(301) + '</b>', [], f.options);
    assert.equal(f.posts[0].body.record.text, grapheme.repeat(300));
    assert.equal(f.posts[0].body.repo, 'did:plc:alice'); assert.equal(f.posts[0].options.headers.Authorization, 'Bearer alice-token');
    assert.equal(url, 'https://bsky.app/profile/did:plc:alice/post/record');
    assert.equal(f.warnings.length, 1); assert.match(f.warnings[0], /301/);
});

for (const service of ['Mastodon', 'Bluesky']) {
    test(`${service} rejects API, network, and unreadable success responses without UI; valid success without a link is null`, async () => {
        const f = fixture();
        const publish = () => service === 'Mastodon'
            ? f.context.publishMastodonStatus('token', 'https://social.test', 'Text')
            : f.context.publishBlueskyRecord({ accessToken: 'token', did: 'did:plc:alice', pds: 'https://alice.pds.test' }, 'Text');
        f.response({ ok: false, status: 403, json: async () => ({ error: 'Forbidden', message: 'Forbidden' }) });
        await assert.rejects(publish(), /HTTP 403.*Forbidden/);
        f.response({ ok: true, json: async () => ({}) }); assert.equal(await publish(), null);
        f.response({ ok: true, json: async () => { throw Error('invalid response'); } });
        await assert.rejects(publish(), /returned success.*Check your posts/);
        f.context.fetch = async url => { if (url.endsWith('/instance')) return { ok: false }; throw Error('offline'); };
        await assert.rejects(publish(), /Could not confirm.*offline/);
    });
}

test('social warnings are captured in workflow state and final results through the optional callback', async () => {
    const f = fixture(); vm.runInContext(read('publishing-workflow.js'), f.context);
    let operation = { status: 'capturing', primaryUrl: null, destinations: [] }, during;
    f.metadata({ ok: true, json: async () => ({ configuration: { statuses: { max_characters: 4 } } }) });
    const outcome = await f.context.runPublishingWorkflow({ title: '', content: 'Long text', references: [], selectedAccountKeys: ['m'] }, {
        accounts: [{ key: 'm', value: JSON.stringify({ type: 'Mastodon', title: 'Social', permissions: 'w', instance: 'alice@social.test', id: 'token' }) }],
        publishers: f.context.window.CList.publishers, parseAccount: account => JSON.parse(account.value), toText: value => value,
        onUpdate: update => {
            operation = f.context.applyPublishingUpdate(operation, update);
            if (update.type === 'warning') during = structuredClone(operation);
        },
    });
    assert.equal(during.destinations[0].warnings.length, 1); assert.equal(outcome.destinations[0].warnings.length, 1);
    assert.equal(outcome.destinations[0].status, 'published');
});

test('explicit Mastodon post feedback uses its passed account and reports failure or success', async () => {
    const f = fixture(), result = { innerHTML: '' }, failures = [], receipts = [];
    Object.assign(f.context, { showServiceError: (_, __, message) => failures.push(message), showPostMessage() {},
        renderPublicationSuccess: (...args) => receipts.push(args) });
    const text = read('mastodon.js'), start = text.indexOf('async function postMastodonStatus(');
    vm.runInContext(text.slice(start, text.indexOf('// -----------------------------------------------------', start)), f.context);
    f.context.publishMastodonStatus = async (token, base, content, reply) => {
        assert.equal(token, 'captured-token'); assert.equal(base, 'https://original.test');
        assert.equal(content, 'Draft'); assert.equal(reply, 'reply-id'); throw Error('offline');
    };
    assert.equal(await f.context.postMastodonStatus('captured-token','https://original.test',result,'Draft','reply-id'),false);
    assert.deepEqual(failures,['offline']);
    f.context.publishMastodonStatus = async () => 'https://original.test/post';
    assert.equal(await f.context.postMastodonStatus('captured-token','https://original.test',result,'Draft','reply-id'),true);
    assert.equal(receipts[0][2],'https://original.test/post');
});

test('standalone Bluesky form uses the reader session, preserves failed/newer drafts, and clears a successful submission', async () => {
    const f = fixture(), input = { value: 'Draft' }, result = { innerHTML: '' }, failures = [];
    f.context.document = { getElementById: id => id === 'input' ? input : result };
    Object.assign(f.context, { createBlueskySession: async () => ({ accessToken: 'reader', did: 'did:plc:reader', pds: 'https://reader.test' }),
        showServiceError: (_, __, message) => failures.push(message), showPostMessage() {}, renderPublicationSuccess() {} });
    const text = read('bluesky.js'), start = text.indexOf('async function submitBlueskyPostFromForm(');
    vm.runInContext(text.slice(start), f.context);
    f.context.publishBlueskyRecord = async () => { throw Error('offline'); };
    await f.context.submitBlueskyPostFromForm('input'); assert.equal(input.value, 'Draft'); assert.equal(failures.length, 1);
    let release; f.context.publishBlueskyRecord = async session => {
        assert.equal(session.did, 'did:plc:reader'); return new Promise(resolve => { release = resolve; });
    };
    const pending = f.context.submitBlueskyPostFromForm('input');
    await new Promise(resolve => setImmediate(resolve)); input.value = 'New draft'; release('https://bsky.app/post');
    await pending; assert.equal(input.value, 'New draft');
    f.context.publishBlueskyRecord = async () => 'https://bsky.app/post';
    await f.context.submitBlueskyPostFromForm('input'); assert.equal(input.value, '');
});
