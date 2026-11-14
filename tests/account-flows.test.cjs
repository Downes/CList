const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = name => fs.readFileSync(path.join(__dirname, '../js', name), 'utf8');
const files = ['mastodon_account.js', 'dropbox_account.js', 'blogger.js',
    'wordpress.js', 'collab_account.js', 'annotate_account.js', 'discord_account.js'];

class Element {
    constructor() { this.nodes = new Map(); this.style = {}; this.value = ''; this.isConnected = true; }
    set innerHTML(html) { this.html = html; this.nodes.clear(); }
    get innerHTML() { return this.html || ''; }
    querySelector(selector) {
        if (!this.nodes.has(selector)) this.nodes.set(selector, new Element());
        return this.nodes.get(selector);
    }
    querySelectorAll() { return []; }
}

function fixture() {
    const writes = [], errors = [], timers = [], calls = [];
    const sandbox = {
        console: { error() {} }, setTimeout: fn => timers.push(fn),
        window: { location: { origin: 'https://clist.test' }, CList: {
            config: { flaskSiteUrl: 'https://kv.test' }, keys: { ACCESS_TOKEN: 'access_token' },
            defaults: { ANNOTATIONS: 'https://anno.test' }, state: { username: 'stephen' },
            storage: { kv: {
                put: async (...args) => writes.push(args),
                add: async (...args) => writes.push(args),
                remove: async key => writes.push(['remove', key]),
            } },
        } },
        getSiteSpecificCookie: () => 'token', getEncKey: async () => 'key',
        encryptWithKey: async (key, json) => 'encrypted:' + json,
        showErrorModal: message => errors.push(message), showStatusMessage() {},
        populatePostOptions() {}, populateReadAccountList() {}, updateUIVisibility() {},
        parseAccountValue: account => JSON.parse(account.value),
        escapeHtml: value => value, kvstoreAuthHeader: () => ({}),
        mastodonOAuthStart: (...args) => calls.push(['Mastodon', ...args]),
        dropboxOAuthStart: (...args) => calls.push(['Dropbox', ...args]),
        wpAuthStart: (...args) => calls.push(['WordPress', ...args]),
        fetch: async () => ({ ok: true, json: async () => [], status: 200 }),
    };
    const ctx = vm.createContext(sandbox);
    for (const file of files) {
        const text = source(file);
        // Existing platform publishing code is outside this account-flow test.
        vm.runInContext(text.slice(text.indexOf('window.CList.accountFlows')), ctx, { filename: file });
    }
    function panel(accounts = []) {
        const container = new Element();
        const context = { container, back: () => calls.push(['back', container]),
            finish: () => calls.push(['finish', container]), getAccounts: () => accounts,
            reloadAccounts: async () => { calls.push(['reload', container]); return accounts; },
            refreshList: () => calls.push(['refresh', container]),
        };
        return { container, context };
    }
    return { ctx, writes, errors, timers, calls, panel, flows: sandbox.window.CList.accountFlows };
}

test('all seven service factories register, open, and preserve panel-local Back actions', async () => {
    const f = fixture();
    assert.equal(Object.keys(f.flows).length, 7);
    const backIds = { Mastodon: 'mastodon', Dropbox: 'dropbox', Blogger: 'blogger',
        WordPress: 'wp', Collab: 'collab', Annotate: 'anno', Discord: 'discord' };
    for (const [type, prefix] of Object.entries(backIds)) {
        const p = f.panel();
        f.flows[type](p.context).open();
        assert.match(p.container.innerHTML, /<h3/);
        p.container.querySelector(`#${prefix}-back-btn`).onclick();
        assert.deepEqual(f.calls.at(-1), ['back', p.container]);
    }
});

test('OAuth controls read only the panel that owns them', () => {
    const f = fixture(), a = f.panel(), b = f.panel();
    f.flows.Mastodon(a.context).open(); f.flows.Mastodon(b.context).open();
    a.container.querySelector('#mastodon-username-input').value = 'a@social.test';
    b.container.querySelector('#mastodon-username-input').value = 'b@social.test';
    a.container.querySelector('#mastodon-auth-btn').onclick();
    b.container.querySelector('#mastodon-auth-btn').onclick();
    assert.deepEqual(f.calls, [
        ['Mastodon', 'a@social.test', 'a@social.test', 'rw'],
        ['Mastodon', 'b@social.test', 'b@social.test', 'rw'],
    ]);
});

test('manual Mastodon saving encrypts its account and reloads the owning panel', async () => {
    const f = fixture(), p = f.panel(); f.flows.Mastodon(p.context).open();
    p.container.querySelector('#mastodon-username-input').value = 'me@social.test';
    p.container.querySelector('#mastodon-manual-token').value = 'secret';
    await p.container.querySelector('#mastodon-manual-save-btn').onclick();
    assert.equal(f.writes[0][0], 'me@social.test');
    assert.equal(JSON.parse(f.writes[0][1].slice(10)).id, 'secret');
    assert.ok(f.calls.some(([name, container]) => name === 'reload' && container === p.container));
    assert.equal(f.errors.length, 0);
});

test('Blogger validation and storage failures produce one error and leave the form open', async () => {
    const f = fixture(), p = f.panel(); f.flows.Blogger(p.context).open();
    await p.container.querySelector('#blogger-save-btn').onclick();
    assert.equal(f.errors.length, 1); assert.equal(f.writes.length, 0);
    p.container.querySelector('#blogger-blog-id').value = '123';
    p.container.querySelector('#blogger-client-id').value = 'client';
    f.ctx.window.CList.storage.kv.put = async () => { throw Error('offline'); };
    await p.container.querySelector('#blogger-save-btn').onclick();
    assert.equal(f.errors.length, 2); assert.match(f.errors[1], /offline/);
    assert.equal(f.calls.length, 0);
});

test('WordPress and Dropbox controls delegate to existing OAuth helpers', () => {
    const f = fixture(), p = f.panel(); f.flows.WordPress(p.context).open();
    p.container.querySelector('#wp-site-url').value = 'blog.test';
    p.container.querySelector('#wp-auth-btn').onclick();
    f.flows.Dropbox(p.context).open();
    p.container.querySelector('#dropbox-app-key').value = 'app';
    p.container.querySelector('#dropbox-title').value = 'Files';
    p.container.querySelector('#dropbox-folder').value = '/CList';
    p.container.querySelector('#dropbox-auth-btn').onclick();
    assert.deepEqual(f.calls, [['WordPress', 'https://blog.test'], ['Dropbox', 'app', 'Files', 'b', '/CList']]);
});

test('Collab adapter accepts plain data, persists the original key, and rejects server failures', async () => {
    const f = fixture();
    f.ctx.fetch = async (url, options) => {
        assert.equal(url, 'https://collab.test/api/register');
        assert.equal(JSON.parse(options.body).did, 'did:key:test');
        return { ok: true, json: async () => ({ username: 'stephen' }) };
    };
    const result = await f.ctx.registerCollabAccount('wss://collab.test', 'did:key:test', { token: 't', encKey: 'k' });
    assert.equal(result.username, 'stephen'); assert.equal(f.writes[0][0], 'wss://collab.test');
    f.ctx.fetch = async () => ({ ok: false, status: 403, json: async () => ({ error: 'denied' }) });
    await assert.rejects(f.ctx.registerCollabAccount('wss://collab.test', null, { token: 't', encKey: 'k' }), /denied/);
    assert.equal(f.writes.length, 1);
});

test('Annotate adapter reports progress without DOM access and does not save after registration failure', async () => {
    const f = fixture(), progress = [], urls = [];
    f.ctx.fetch = async url => { urls.push(url); return { ok: true }; };
    const account = { url: 'https://anno.test', title: 'Notes', permissions: 'rw' };
    await f.ctx.registerAnnotateAccount(account, { token: 't', encKey: 'k' }, text => progress.push(text));
    assert.deepEqual(urls, ['https://anno.test/health', 'https://anno.test/api/register']);
    assert.equal(progress.length, 1); assert.equal(f.writes[0][0], account.url);
    f.ctx.fetch = async url => ({ ok: url.endsWith('/health'), status: 403, json: async () => ({ detail: 'denied' }) });
    await assert.rejects(f.ctx.registerAnnotateAccount(account, { token: 't', encKey: 'k' }, () => {}), /denied/);
    assert.equal(f.writes.length, 1);
});

test('Discord admin errors use the caller-provided edit controls', async () => {
    const f = fixture(), p = f.panel(), statusEl = new Element(), panelEl = new Element();
    const flow = f.flows.Discord(p.context);
    await flow.manageChannels({ statusEl, panelEl, botTokenEl: { value: '' } });
    assert.match(statusEl.textContent, /bot token/);
    f.ctx.fetch = async () => { throw Error('offline'); };
    await flow.manageChannels({ statusEl, panelEl, botTokenEl: { value: 'bot' } });
    assert.match(panelEl.innerHTML, /offline/);
});
