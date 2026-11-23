const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const { menuShellDocument } = require('./helpers/menu-shell-dom.cjs');
const document = menuShellDocument(), create = document.createElement;
document.createElement = tag => { const node = create(tag); node.dispatchEvent = event => { node['on' + event.type]?.(event); return true; }; node.click = () => { if (!node.disabled) return node.onclick?.(); }; return node; };
const context = vm.createContext({ document, Event, URL, URLSearchParams, structuredClone, console: { error() {} }, window: { CList: { state: {} }, location: { origin: 'https://local.invalid', protocol: 'https:', hostname: 'localhost', href: '' } } });
for (const name of ['oauth-config', 'oauth-strategies', 'oauth_start_workflow', 'oauth-client', 'dropbox_setup', 'dropbox_setup_view']) vm.runInContext(fs.readFileSync('js/' + name + '.js', 'utf8'), context);
context.OAuthProviders = context.window.OAuthProviders;
vm.runInContext('OAuthClient.onCallback = () => {};', context);
for (const name of ['dropbox', 'dropbox_account']) vm.runInContext(fs.readFileSync('js/' + name + '.js', 'utf8'), context);
vm.runInContext(fs.readFileSync('tests/helpers/dropbox-setup-fixture.js', 'utf8'), context);
for (const [name, run] of vm.runInContext('dropboxSetupCases', context)) test(name, { timeout: 2000 }, () => run((condition, message) => assert.ok(condition, message)));
test('real OAuthClient login bridge uses existing strategies/PKCE and the shared state prefix', async () => {
    const f = vm.runInContext('dropboxSetupFixture()', context);
    context.sessionStorage = { setItem: (key, value) => f.storage.set(key, value), removeItem: key => f.storage.delete(key) };
    context.captureOAuthIssuerSource = () => ({}); context.currentOAuthIssuerSource = () => true; context.fingerprintOAuthIssuer = async () => 'synthetic-issuer';
    await vm.runInContext("originalDropboxOAuthLogin.call(OAuthClient, 'Files', 'Dropbox', 'https://www.dropbox.com', { clientId: 'captured-client' })", context);
    assert.match(context.window.location.href, /^https:\/\/www\.dropbox\.com\/oauth2\/authorize\?/);
    assert.equal(JSON.parse([...f.storage.values()].find(value => value !== 'keep')).mode, 'desktop-local'); f.dispose();
});
