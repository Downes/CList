const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const read = name => fs.readFileSync('js/' + name, 'utf8');

function fixture() {
    const requests = [], modals = [], messages = [], clients = [];
    let authorize = config => config.callback({ access_token: 'test-token' });
    let response = { ok: true, status: 201, json: async () => ({ url: 'https://blog.test/post' }) };
    const cList = { schemas: {}, publishers: {}, config: { flaskSiteUrl: 'https://kv.test' },
        state: { publishing: { selectedAccountKeys: ['blog'], busy: false } }, ui: { view: { postResult: { innerHTML: '' } } } };
    const context = vm.createContext({ window: { CList: cList }, structuredClone, console: { error() {} },
        google: { accounts: { oauth2: { initTokenClient: config => {
            clients.push(config); return { requestAccessToken: () => authorize(config) };
        } } } },
        derivePlainTitle: title => title.replace(/<[^>]+>/g, ''),
        fetch: async (url, options) => { requests.push({ url, options }); return response; },
        showErrorModal: (message, options) => modals.push({ message, ...options }),
        showPostMessage: (_, text) => messages.push(text),
    });
    vm.runInContext(read('blogger.js'), context);
    return { context, cList, requests, modals, messages, clients,
        authorize: callback => { authorize = callback; }, respond: value => { response = value; } };
}

test('Blogger adapter returns its URL, keeps HTML, uses supplied account credentials, and never renders UI', async () => {
    const f = fixture();
    const url = await f.cList.publishers.Blogger.publish({ instance: '123', id: 'client-id' }, '<b>Title</b>', '<p>Body</p>');
    assert.equal(url, 'https://blog.test/post'); assert.equal(f.clients[0].client_id, 'client-id');
    assert.equal(f.requests[0].url, 'https://www.googleapis.com/blogger/v3/blogs/123/posts/');
    assert.equal(f.requests[0].options.headers.Authorization, 'Bearer test-token');
    assert.deepEqual(JSON.parse(f.requests[0].options.body), { kind: 'blogger#post', title: 'Title', content: '<p>Body</p>' });
    assert.equal(f.modals.length, 0); assert.equal(f.messages.length, 0); assert.equal('document' in f.context, false);
});

test('OAuth denial or a missing token rejects without creating a post or displaying a modal', async () => {
    const f = fixture();
    f.authorize(config => config.callback({ error: 'access_denied', error_description: 'Consent denied' }));
    await assert.rejects(f.context.publishBloggerPost('123', 'client', 'Title', 'Body'), /Consent denied/);
    f.authorize(config => config.callback({}));
    await assert.rejects(f.context.publishBloggerPost('123', 'client', 'Title', 'Body'), /No access token/);
    assert.equal(f.requests.length, 0); assert.equal(f.modals.length, 0);
});

test('closed or blocked authorization windows reject instead of leaving publication pending', async () => {
    const f = fixture();
    for (const type of ['popup_closed', 'popup_failed_to_open', 'unknown']) {
        f.authorize(config => config.error_callback({ type }));
        await assert.rejects(f.context.publishBloggerPost('123', 'client', 'Title', 'Body'), /Failed to authorize with Blogger/);
    }
    assert.equal(f.requests.length, 0); assert.equal(f.modals.length, 0);
});

test('API rejection and unreadable error responses reject with useful details', async () => {
    const f = fixture();
    f.respond({ ok: false, status: 403, json: async () => ({ error: { message: 'No permission' } }) });
    await assert.rejects(f.context.publishBloggerPost('123', 'client', 'Title', 'Body'), /HTTP 403.*No permission/);
    f.respond({ ok: false, status: 502, json: async () => { throw Error('not JSON'); } });
    await assert.rejects(f.context.publishBloggerPost('123', 'client', 'Title', 'Body'), /HTTP 502/);
    assert.equal(f.modals.length, 0);
});

test('a successful response without a link remains unconfirmed; unreadable success and network errors warn against repeating an uncertain write', async () => {
    const f = fixture();
    f.respond({ ok: true, status: 201, json: async () => ({ id: 'accepted' }) });
    assert.equal(await f.context.publishBloggerPost('123', 'client', 'Title', 'Body'), null);
    f.respond({ ok: true, status: 201, json: async () => { throw Error('not JSON'); } });
    await assert.rejects(f.context.publishBloggerPost('123', 'client', 'Title', 'Body'), /returned success.*Check your blog/);
    f.context.fetch = async () => { throw Error('offline'); };
    await assert.rejects(f.context.publishBloggerPost('123', 'client', 'Title', 'Body'), /Could not confirm.*offline.*Check your blog/);
    assert.equal(f.modals.length, 0);
});

test('unavailable authorization, SDK exceptions, and invalid inputs reject before any post', async () => {
    const f = fixture();
    await assert.rejects(f.context.publishBloggerPost('123', 'client', 'Title', ''), /no content/);
    await assert.rejects(f.context.publishBloggerPost('', 'client', 'Title', 'Body'), /Blog ID and Client ID/);
    f.authorize(() => { throw Error('SDK request failed'); });
    await assert.rejects(f.context.publishBloggerPost('123', 'client', 'Title', 'Body'), /SDK request failed/);
    delete f.context.google;
    await assert.rejects(f.context.publishBloggerPost('123', 'client', 'Title', 'Body'), /authorization is unavailable/);
    assert.equal(f.requests.length, 0); assert.equal(f.modals.length, 0);
});

test('duplicate SDK token callbacks cannot duplicate a post', async () => {
    const f = fixture();
    f.authorize(config => { config.callback({ access_token: 'token' }); config.callback({ access_token: 'token' }); });
    await f.context.publishBloggerPost('123', 'client', 'Title', 'Body');
    assert.equal(f.requests.length, 1);
});

for (const failure of ['authorization', 'API']) {
    test(`publishing controller presents one Blogger ${failure} failure without a misleading missing-link message`, async () => {
        const f = fixture();
        if (failure === 'authorization') f.authorize(config => config.callback({ error: 'access_denied' }));
        else f.respond({ ok: false, status: 403, json: async () => ({ error: { message: 'Forbidden' } }) });
        Object.assign(f.context, {
            readPublicationFields: () => ({ title: 'Title', referenceHtml: '' }),
            packagePost: async () => '<p>Body</p>', getReferences: () => [],
            getAccounts: async () => [{ key: 'blog', value: JSON.stringify({ type: 'Blogger', instance: '123', id: 'client', title: 'My blog', permissions: 'w' }) }],
            parseAccountValue: account => JSON.parse(account.value), removeHtml: html => html,
            updatePostProgress() {}, renderPublishingBusy() {}, clearPostProgress() {}, renderPublisherProgress() {},
            showPublicationSuccess: () => assert.fail('failed post must not show success'),
            showPublicationError: (name, message) => f.modals.push({ message: name + ': ' + message }),
        });
        for (const name of ['publishing-workflow.js', 'publishing-view.js', 'publish.js']) vm.runInContext(read(name), f.context);
        const result = await f.context.postAll();
        assert.equal(result.destinations[0].status, 'failed'); assert.equal(f.modals.length, 1);
        assert.match(f.modals[0].message, /My blog/);
        assert.equal(f.messages.some(message => message.includes('no post link')), false);
        assert.equal(f.cList.state.publishing.busy, false);
    });
}
