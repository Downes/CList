const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const { menuShellDocument } = require('./helpers/menu-shell-dom.cjs');
const document = menuShellDocument();
const context = vm.createContext({ document, structuredClone, URLSearchParams, console: { error() {} }, window: { CList: { state: {}, config: {} }, addEventListener() {} } });
for (const name of ['account-state', 'ui', 'oauth_account_workflow', 'oauth_account', 'oauth_account_view', 'oauth_callback_workflow', 'oauth_callback', 'oauth_callback_view', 'oauth-client']) vm.runInContext(fs.readFileSync('js/' + name + '.js', 'utf8'), context);
context.buildDialogModal = context.window.CList.ui.buildDialogModal;
for (const name of ['oauth-account', 'oauth-callback']) vm.runInContext(fs.readFileSync('tests/helpers/' + name + '-fixture.js', 'utf8'), context);
for (const [name, run] of vm.runInContext('oauthCallbackCases', context)) test(name, { timeout: 2000 }, () => run((condition, message) => assert.ok(condition, message)));

test('real callback client bridges use one pickup listener and explicit exchange transport', async () => {
    const f = vm.runInContext('oauthCallbackFixture()', context), listeners = [];
    context.document.readyState = 'interactive'; context.document.addEventListener = (name, callback) => listeners.push(callback);
    context.fixtureController = f.controller;
    vm.runInContext('_oauthCallbackController = fixtureController; OAuthClient.onCallback("Dropbox", async () => {}); OAuthClient.onCallback("Mastodon", async () => {});', context);
    assert.equal(listeners.length, 1);
    context.window.CList.keys = { OAUTH_STATE_PREFIX: 'flow:' };
    context.window.location = { search: '?code=original&state=state' };
    const flow = { ...f.receipt, phase: 'pending', createdAt: Date.now(), codeVerifier: 'original-verifier', providerType: 'Dropbox' };
    const storage = new Map([['flow:state', JSON.stringify(flow)]]); let calls = 0;
    context.sessionStorage = { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) };
    context.OAuthProviders = { Dropbox: { tokenPath: '/token' } };
    context.OAuthStrategies = { async exchangeCode(code, config) { calls++; assert.equal(code, 'original'); assert.equal(config.codeVerifier, 'original-verifier'); return 'access'; } };
    const result = await vm.runInContext('OAuthClient.handleCallback()', context);
    assert.equal(result.accessToken, 'access'); assert.equal(result.issuer, flow.issuer); assert.equal(calls, 1);
    assert.equal(JSON.parse(storage.get('flow:state')).phase, 'exchanged'); f.dispose();
});

test('issuer capture uses cookie identity and guards in-page session changes; digest omits volatile epoch', async () => {
    context.window.CList = { config: { flaskSiteUrl: 'https://identity.invalid' }, keys: { ACCESS_TOKEN: 'token', USERNAME: 'user' }, state: { username: 'none', authEpoch: 2 } };
    let token = 'synthetic-token', bytes;
    context.getSiteSpecificCookie = (store, key) => key === 'user' ? 'Alice' : token;
    context.TextEncoder = TextEncoder;
    context.crypto = { subtle: { async digest(algorithm, value) { assert.equal(algorithm, 'SHA-256'); bytes = new TextDecoder().decode(value); return new Uint8Array([1, 2, 255]).buffer; } } };
    const source = vm.runInContext('captureOAuthIssuerSource()', context); context.originalSource = source;
    assert.equal(await vm.runInContext('fingerprintOAuthIssuer(originalSource)', context), '0102ff');
    assert.deepEqual(JSON.parse(bytes), ['https://identity.invalid', 'Alice', 'synthetic-token', false]);
    context.window.CList.state.username = 'Alice'; assert.equal(vm.runInContext('currentOAuthIssuerSource(originalSource)', context), true);
    context.window.CList.state.authEpoch++; assert.equal(vm.runInContext('currentOAuthIssuerSource(originalSource)', context), false);
    context.window.CList.state.authEpoch--; token = 'new-token'; assert.equal(vm.runInContext('currentOAuthIssuerSource(originalSource)', context), false);
});
