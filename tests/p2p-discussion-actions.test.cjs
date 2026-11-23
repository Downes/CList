const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const { menuShellDocument } = require('./helpers/menu-shell-dom.cjs');
const ctx = vm.createContext({ document: menuShellDocument(), window: { CList: { state: {}, config: { flaskSiteUrl: 'https://store.invalid' }, defaults: { DISCUSSIONS: 'https://directory.invalid' }, keys: { USERNAME: 'fixture-user', ACCESS_TOKEN: 'fixture-token' } } }, structuredClone, console: { error() {} } });
for (const name of ['dynamicp2p_session_bridge', 'dynamicp2p_discussions_requests', 'dynamicp2p_discussion_workflow', 'dynamicp2p_discussion_view', 'dynamicp2p_discussion_actions', 'dynamicp2p_discussion_bridge', 'dynamicp2p']) vm.runInContext(fs.readFileSync('js/' + name + '.js', 'utf8'), ctx);
vm.runInContext(fs.readFileSync('tests/helpers/discussion-actions-fixture.js', 'utf8'), ctx);
for (const [name, run] of vm.runInContext('discussionActionCases', ctx)) test(name, () => run((condition, message) => assert.ok(condition, message)));
