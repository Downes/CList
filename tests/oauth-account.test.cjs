const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const { menuShellDocument } = require('./helpers/menu-shell-dom.cjs');
const document = menuShellDocument(), create = document.createElement;
document.createElement = tag => { const node = create(tag); node.click = () => { if (!node.disabled) return node.onclick?.(); }; return node; };
const context = vm.createContext({ document, structuredClone, console: { error() {} }, window: { CList: { state: {}, config: {} }, addEventListener() {} } });
for (const name of ['account-state', 'ui', 'oauth_account_workflow', 'oauth_account', 'oauth_account_view', 'oauth-client']) vm.runInContext(fs.readFileSync('js/' + name + '.js', 'utf8'), context);
context.buildDialogModal = context.window.CList.ui.buildDialogModal;
vm.runInContext(fs.readFileSync('tests/helpers/oauth-account-fixture.js', 'utf8'), context);
for (const [name, run] of vm.runInContext('oauthAccountCases', context)) test(name, { timeout: 2000 }, () => run((condition, message) => assert.ok(condition, message)));
