const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const { menuShellDocument } = require('./helpers/menu-shell-dom.cjs'); const document = menuShellDocument();
const context = vm.createContext({ document, structuredClone, URL, console: { error() {} }, window: { CList: { state: {}, config: {} }, addEventListener() {} } });
for (const name of ['account-state', 'ui', 'oauth_account_workflow', 'oauth_account', 'oauth_account_view', 'oauth-client', 'discord_setup_requests', 'discord_setup', 'discord_setup_view', 'discord_admin', 'discord_admin_view', 'discord_account']) vm.runInContext(fs.readFileSync('js/' + name + '.js', 'utf8'), context);
context.buildDialogModal = context.window.CList.ui.buildDialogModal;
for (const name of ['oauth-account', 'discord-setup']) vm.runInContext(fs.readFileSync('tests/helpers/' + name + '-fixture.js', 'utf8'), context);
let checks = 0;
for (const [name, run] of vm.runInContext('discordSetupCases', context)) test(name, { timeout: 2000 }, () => run((condition, message) => { assert.ok(condition, message); checks++; }));
test.after(() => console.log('Discord setup fixture assertions:', checks));
