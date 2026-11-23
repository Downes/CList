const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const { menuShellDocument } = require('./helpers/menu-shell-dom.cjs');
const document = menuShellDocument();
const context = vm.createContext({ document, structuredClone, URL, console: { error() {} }, window: { CList: { state: {}, config: {} }, location: { origin: 'https://app.invalid' }, addEventListener() {} },
    fetch() { throw new Error('Unexpected external request'); }, google: { accounts: { oauth2: { initTokenClient() { throw new Error('Setup must not authorize'); } } } } });
for (const name of ['account-state', 'ui', 'oauth_account_workflow', 'oauth_account', 'oauth_account_view', 'oauth-client', 'account-setup', 'account-setup-view', 'blogger_setup', 'blogger_setup_view', 'blogger']) vm.runInContext(fs.readFileSync('js/' + name + '.js', 'utf8'), context);
context.buildDialogModal = context.window.CList.ui.buildDialogModal;
for (const name of ['oauth-account', 'blogger-setup']) vm.runInContext(fs.readFileSync('tests/helpers/' + name + '-fixture.js', 'utf8'), context);
let checks = 0;
for (const [name, run] of vm.runInContext('bloggerSetupCases', context)) test(name, { timeout: 2000 }, () => run((condition, message) => { assert.ok(condition, message); checks++; }));
test.after(() => console.log('Blogger setup fixture assertions:', checks));
