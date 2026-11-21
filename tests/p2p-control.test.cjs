const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const { menuShellDocument } = require('./helpers/menu-shell-dom.cjs');
const ctx = vm.createContext({ document: menuShellDocument(), window: { CList: { state: {}, config: { flaskSiteUrl: 'https://store.invalid' }, keys: { ACCESS_TOKEN: 'fixture-token' } } }, URL, structuredClone, crypto: { randomUUID: () => 'control-fixture' }, console: { error() {}, warn() {} } });
for (const name of ['dynamicp2p_session_bridge', 'dynamicp2p_share_workflow', 'dynamicp2p_control_workflow', 'dynamicp2p_control_view', 'dynamicp2p_control', 'dynamicp2p']) vm.runInContext(fs.readFileSync('js/' + name + '.js', 'utf8'), ctx);
vm.runInContext(fs.readFileSync('tests/helpers/p2p-control-fixture.js', 'utf8'), ctx);
for (const [name, run] of vm.runInContext('p2pControlCases', ctx)) test(name, () => run((condition, message) => assert.ok(condition, message)));
