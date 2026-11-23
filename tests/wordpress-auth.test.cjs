const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const { menuShellDocument } = require('./helpers/menu-shell-dom.cjs');
// Parsed innerHTML children use the base fixture Element; give them its existing selector matcher.
const { Element } = require('./helpers/account-fixture.cjs'), { NavigationElement } = require('./helpers/navigation-dom.cjs');
Element.prototype.matches = NavigationElement.prototype.matches;
const document = menuShellDocument();
const context = vm.createContext({ document, structuredClone, URL, URLSearchParams, console: { error() {} }, window: { CList: { state: {}, config: {} }, addEventListener() {} } });
for (const name of ['account-state', 'ui', 'oauth_account_workflow', 'oauth_account', 'oauth_account_view', 'oauth_callback', 'oauth_callback_view', 'oauth-client', 'wordpress_auth_workflow', 'wordpress_auth', 'wordpress_auth_view', 'wordpress_setup', 'wordpress_setup_view']) vm.runInContext(fs.readFileSync('js/' + name + '.js', 'utf8'), context);
context.buildDialogModal = context.window.CList.ui.buildDialogModal;
vm.runInContext('let wordPressAuthHandler; OAuthClient.onCallback = (type, handler) => { wordPressAuthHandler = handler; };', context);
vm.runInContext(fs.readFileSync('js/wordpress.js', 'utf8'), context);
for (const name of ['oauth-account', 'wordpress-auth']) vm.runInContext(fs.readFileSync('tests/helpers/' + name + '-fixture.js', 'utf8'), context);
let checks = 0;
for (const [name, run] of vm.runInContext('wordPressAuthCases', context)) test(name, { timeout: 2000 }, () => run((condition, message) => { assert.ok(condition, message); checks++; }));
test.after(() => console.log('WordPress browser-fixture assertions:', checks));

test('real callback-page shell routes WordPress success, denial, legacy rejection and local relay with mocked effects', async () => {
    const script = [...fs.readFileSync('callback.html', 'utf8').matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)].find(match => !match[1].includes('src='))[2];
    for (const mode of ['success', 'denial', 'legacy', 'relay']) {
        const f = vm.runInContext('wordPressAuthFixture()', context), stored = [], cleaned = [], relayed = [];
        if (mode === 'relay') f.location.origin = 'http://localhost:51888';
        await f.start();
        for (const [key, value] of f.flows) f.flows.set(key, JSON.stringify({ ...JSON.parse(value), createdAt: Date.now() }));
        const params = new URLSearchParams(f.search());
        if (mode === 'denial') params.set('wp_denied', '1');
        if (mode === 'legacy') params.delete('wp_state');
        context.window.CList.keys.OAUTH_STATE_PREFIX = 'flow:'; context.window.CList.keys.OAUTH_CALLBACK_RESULT = 'callback-result';
        context.window.location = { search: '?' + params, pathname: '/callback.html', href: '', replace: value => relayed.push(value) };
        context.localStorage = { setItem: (...args) => stored.push(args) };
        context.sessionStorage = { getItem: key => f.flows.get(key), setItem: (key, value) => f.flows.set(key, value), removeItem: key => f.flows.delete(key) };
        context.history = { replaceState: (...args) => cleaned.push(args) };
        let callback; context.window.addEventListener = (name, handler) => { callback = handler; };
        const msg = document.createElement('p'); msg.id = 'msg'; document.body.appendChild(msg);
        vm.runInContext(script, context); await callback();
        if (mode === 'success') {
            assert.equal(stored[0][0], 'callback-result'); assert.equal(JSON.parse(stored[0][1]).providerType, 'WordPress');
            assert.equal(context.window.location.href, '/'); assert.equal(cleaned[0][2], '/callback.html');
        } else if (mode === 'relay') {
            assert.equal(stored.length, 0); assert.match(relayed[0], /^http:\/\/localhost:51888\/callback.html\?/);
            assert.equal(new URL(relayed[0]).searchParams.get('wp_state'), params.get('wp_state'));
        } else {
            assert.equal(stored.length, 0); assert.match(msg.textContent, mode === 'denial' ? /declined/ : /session binding/);
            assert.equal(cleaned[0][2], '/callback.html');
        }
        msg.remove(); f.dispose();
    }
});
