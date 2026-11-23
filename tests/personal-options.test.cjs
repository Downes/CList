const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const { menuShellDocument } = require('./helpers/menu-shell-dom.cjs'); const document = menuShellDocument(); document.documentElement = document.createElement('html');
const context = vm.createContext({ document, structuredClone, URL, console: { error() {} }, localStorage: { getItem: () => null }, window: { CList: { state: {}, config: {}, keys: { WEBMENTION_ENABLED: 'clist_webmention_enabled' } }, location: { host: 'localhost:51888' }, addEventListener() {} } });
for (const name of ['account-state', 'ui', 'oauth_account_workflow', 'oauth_account', 'oauth_account_view', 'oauth-client', 'account-transfer-workflow', 'account-transfer-controller', 'account-transfer', 'personal-options-workflow', 'personal-options', 'personal-options-view', 'personal-options-transfer', 'webmention']) vm.runInContext(fs.readFileSync('js/' + name + '.js', 'utf8'), context);
context.buildDialogModal = context.window.CList.ui.buildDialogModal;
for (const name of ['oauth-account', 'personal-options']) vm.runInContext(fs.readFileSync('tests/helpers/' + name + '-fixture.js', 'utf8'), context);
let checks = 0;
for (const [name, run] of vm.runInContext('personalOptionsCases', context)) test(name, { timeout: 2000 }, () => run((condition, message) => { assert.ok(condition, message); checks++; }));
test.after(() => console.log('Personal Options fixture assertions:', checks));
test('early theme bootstrap retains the existing key and survives unreadable storage', () => {
    const script = [...fs.readFileSync('index.html', 'utf8').matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].find(match => match[1].includes('_savedTheme'))[1];
    for (const failed of [false, true]) {
        let dark = false; const target = { window: {}, localStorage: { getItem(key) { assert.equal(key, 'clist-dark-mode'); if (failed) throw new Error('Denied'); return '1'; } }, document: { documentElement: { classList: { add() { dark = true; } } } }, console: { error() {} } };
        vm.runInNewContext(script, target); assert.equal(dark, !failed); assert.equal(target.window.CList.keys.WEBMENTION_ENABLED, 'clist_webmention_enabled');
    }
});
