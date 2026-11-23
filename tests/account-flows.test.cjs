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
        URL, structuredClone, document: { getElementById: () => null }, console: { error() {} }, setTimeout: fn => timers.push(fn),
        window: { location: { origin: 'https://clist.test' }, CList: {
            config: { flaskSiteUrl: 'https://kv.test' }, keys: { ACCESS_TOKEN: 'access_token' },
            defaults: { ANNOTATIONS: 'https://anno.test' }, state: { username: 'stephen' },
            storage: { kv: {
                put: async (...args) => writes.push(args), get: async () => null,
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
        // Legacy seven-flow fixture mocks Dropbox's view; its dedicated browser fixture uses real DOM.
        createDropboxSetupView: container => ({
            current: () => container.isConnected,
            values: () => ({ appKey: container.querySelector('#dropbox-app-key').value, title: container.querySelector('#dropbox-title').value, folder: container.querySelector('#dropbox-folder').value }),
            bind(controller) { container.innerHTML = '<h3>Add Dropbox Account</h3>'; container.querySelector('#dropbox-auth-btn').onclick = () => controller.start(); container.querySelector('#dropbox-back-btn').onclick = () => controller.back(); },
            busy() {}, error(error) { errors.push(error.message); }, started() {},
        }),
        createMastodonSetupView: container => {
            const values = () => Object.fromEntries([['username','mastodon-username-input'],['title','mastodon-manual-title'],['permissions','mastodon-manual-permissions'],['token','mastodon-manual-token']].map(([key,id]) => [key,container.querySelector('#'+id).value]));
            return { current: () => container.isConnected, capture: () => ({ values: values(), current: () => container.isConnected }),
                bind(controller) { container.innerHTML = '<h3>Add Mastodon Account</h3>'; container.querySelector('#mastodon-auth-btn').onclick = () => controller.authorize(); container.querySelector('#mastodon-back-btn').onclick = () => controller.back(); container.querySelector('#mastodon-manual-save-btn').onclick = () => controller.manual(); },
                busy() {}, message() {}, error(error) { errors.push(error.message); }, recovery(error) { errors.push(error.message); }, review() {} };
        },
        createBloggerSetupView: container => ({
            current: () => container.isConnected,
            capture: () => ({ values: { blogId: container.querySelector('#blogger-blog-id').value, clientId: container.querySelector('#blogger-client-id').value, title: container.querySelector('#blogger-title').value }, current: () => container.isConnected }),
            bind(controller) { container.innerHTML = '<h3>Add Blogger Account</h3>'; container.querySelector('#blogger-save-btn').onclick = () => controller.manual(); container.querySelector('#blogger-back-btn').onclick = () => controller.back(); },
            busy() {}, message() {}, error(error) { errors.push(error.message); }, recovery(error) { errors.push(error.message); }, review() {},
        }),
        captureOAuthIssuerSource: () => ({}), currentOAuthIssuerSource: () => true,
        normalizeWordPressAuthSite: value => value,
        createWordPressSetupView: container => ({ current: () => container.isConnected,
            capture: () => ({ value: container.querySelector('#wp-site-url').value, current: () => container.isConnected }),
            bind(controller) { container.innerHTML = '<h3>Add WordPress Account</h3>'; container.querySelector('#wp-auth-btn').onclick = () => controller.authorize(); container.querySelector('#wp-back-btn').onclick = () => controller.back(); },
            busy() {}, message() {}, error(error) { errors.push(error.message); } }),
        createCollabSetupView: container => ({ current: () => container.isConnected,
            capture: () => ({ values: {url: container.querySelector('#collab-ws-input').value}, current: () => container.isConnected }),
            bind(controller) { container.innerHTML = '<h3>Add Collab Server</h3>'; container.querySelector('#collab-connect-btn').onclick = () => controller.connect(); container.querySelector('#collab-back-btn').onclick = () => controller.back(); },
            busy() {}, message() {}, error(error) { errors.push(error.message); }, recovery() {}, review() {}, registrationFailure() {} }),
        createAnnotateSetupView: (container, url) => ({ current: () => container.isConnected,
            capture: () => ({ values: {url, title: container.querySelector('#anno-title').value, permissions: 'rw'}, current: () => container.isConnected }),
            bind(controller) { container.innerHTML = '<h3>Add Annotation Server</h3>'; container.querySelector('#anno-add-btn').onclick = () => controller.connect(); container.querySelector('#anno-back-btn').onclick = () => controller.back(); },
            busy() {}, message() {}, error(error) { errors.push(error.message); }, recovery() {}, review() {}, registrationFailure() {} }),
        createDiscordSetupView: container => ({current: () => container.isConnected,
            bind(controller) {container.innerHTML='<h3>Select Channels</h3>'; container.querySelector('#discord-back-btn').onclick=()=>controller.back();}, channels() {}, message() {}, recovery() {}}),
        createDiscordAdminView: controls => ({current:()=>true,token:()=>controls.botTokenEl.value||'',busy(){},render(){},
            message(text){controls.statusEl.textContent=text;controls.panelEl.innerHTML=text;}, recovery(text){controls.panelEl.innerHTML=text;}}),
        wpAuthStart: (...args) => calls.push(['WordPress', ...args]),
        fetch: async () => ({ ok: true, json: async () => [], status: 200 }),
    };
    const ctx = vm.createContext(sandbox);
    for (const file of ['account-state.js','oauth_account_workflow.js','oauth_account.js','account-setup.js','mastodon_setup.js','blogger_setup.js','wordpress_setup.js','collab_setup_workflow.js','account-registration-setup.js','collab_setup.js','annotate_setup_workflow.js','annotate_setup.js','discord_setup_requests.js','discord_setup.js','discord_admin.js','dropbox_setup.js']) vm.runInContext(source(file), ctx);
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

test('OAuth controls read only the panel that owns them', async () => {
    const f = fixture(), a = f.panel(), b = f.panel();
    f.flows.Mastodon(a.context).open(); f.flows.Mastodon(b.context).open();
    a.container.querySelector('#mastodon-username-input').value = 'a@social.test';
    b.container.querySelector('#mastodon-username-input').value = 'b@social.test';
    await a.container.querySelector('#mastodon-auth-btn').onclick();
    await b.container.querySelector('#mastodon-auth-btn').onclick();
    assert.deepEqual(f.calls.map(call => call.slice(0,4)), [
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

test('WordPress and Dropbox controls delegate to existing OAuth helpers', async () => {
    const f = fixture(), p = f.panel(); f.flows.WordPress(p.context).open();
    p.container.querySelector('#wp-site-url').value = 'blog.test';
    await p.container.querySelector('#wp-auth-btn').onclick();
    f.flows.Dropbox(p.context).open();
    p.container.querySelector('#dropbox-app-key').value = 'app';
    p.container.querySelector('#dropbox-title').value = 'Files';
    p.container.querySelector('#dropbox-folder').value = '/CList';
    await p.container.querySelector('#dropbox-auth-btn').onclick();
    assert.deepEqual(f.calls.map(call => call.slice(0, call[0] === 'WordPress' ? 2 : 5)), [['WordPress', 'https://blog.test'], ['Dropbox', 'app', 'Files', 'b', '/CList']]);
    assert.equal(typeof f.calls[0][2].isCurrent, 'function');
});

test('Collab adapter accepts plain data, persists the original key, and rejects server failures', async () => {
    const f = fixture();
    f.ctx.fetch = async (url, options) => {
        assert.equal(url, 'https://collab.test/api/register');
        assert.equal(JSON.parse(options.body).did, 'did:key:test');
        return { ok: true, json: async () => ({ username: 'stephen' }) };
    };
    const result = await f.ctx.registerCollabAccount('wss://collab.test', 'did:key:test', { token: 'token', encKey: 'k' });
    assert.equal(result.username, 'stephen'); assert.equal(f.writes[0][0], 'wss://collab.test');
    f.ctx.fetch = async () => ({ ok: false, status: 403, json: async () => ({ error: 'denied' }) });
    await assert.rejects(f.ctx.registerCollabAccount('wss://collab.test', null, { token: 'token', encKey: 'k' }), /denied/);
    assert.equal(f.writes.length, 1);
});

test('Annotate adapter reports progress without DOM access and does not save after registration failure', async () => {
    const f = fixture(), progress = [], urls = [];
    f.ctx.fetch = async url => { urls.push(url); return { ok: true }; };
    const account = { url: 'https://anno.test', title: 'Notes', permissions: 'rw' };
    await f.ctx.registerAnnotateAccount(account, { token: 'token', encKey: 'k' }, text => progress.push(text));
    assert.deepEqual(urls, ['https://anno.test/health', 'https://anno.test/api/register']);
    assert.equal(progress.length, 1); assert.equal(f.writes[0][0], account.url);
    f.ctx.fetch = async url => ({ ok: url.endsWith('/health'), status: 403, json: async () => ({ detail: 'denied' }) });
    await assert.rejects(f.ctx.registerAnnotateAccount(account, { token: 'token', encKey: 'k' }, () => {}), /denied/);
    assert.equal(f.writes.length, 1);
});

test('Discord admin errors use the caller-provided edit controls', async () => {
    const f = fixture(), p = f.panel(), statusEl = new Element(), panelEl = new Element();
    const flow = f.flows.Discord(p.context);
    await flow.manageChannels({ statusEl, panelEl, botTokenEl: { value: '' } });
    assert.match(statusEl.textContent, /bot token/);
    f.ctx.fetch = async () => { throw Error('offline'); };
    await flow.manageChannels({ statusEl, panelEl, botTokenEl: { value: 'bot' } });
    assert.match(panelEl.innerHTML, /could not be confirmed/);
});
