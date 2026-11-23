const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const { menuShellDocument } = require('./helpers/menu-shell-dom.cjs');
const ctx = vm.createContext({ document: menuShellDocument(), window: { CList: { config: { flaskSiteUrl: 'https://store.invalid' },
    defaults: { DISCUSSIONS: 'https://discussion.invalid' }, state: {}, keys: { USERNAME: 'fixture-user', ACCESS_TOKEN: 'fixture-token' } } },
    console: { error() {}, log() {}, warn() {} }, structuredClone, crypto: { randomUUID: () => 'session-message' } });
for (const name of ['dynamicp2p_session_view', 'dynamicp2p_session', 'dynamicp2p_session_bridge', 'dynamicp2p_share_workflow', 'dynamicp2p_message_workflow', 'dynamicp2p_message_view', 'dynamicp2p_messages', 'dynamicp2p_control_workflow', 'dynamicp2p_control_view', 'dynamicp2p_control', 'dynamicp2p_identity_workflow', 'dynamicp2p_identity_view', 'dynamicp2p_identity', 'dynamicp2p_heartbeat_workflow', 'dynamicp2p_heartbeat_view', 'dynamicp2p_heartbeat', 'dynamicp2p']) vm.runInContext(fs.readFileSync('js/' + name + '.js', 'utf8'), ctx);
vm.runInContext(fs.readFileSync('tests/helpers/p2p-session-fixture.js', 'utf8'), ctx);
for (const [name, run] of vm.runInContext('p2pSessionCases', ctx)) test(name, () => run((condition, message) => assert.ok(condition, message)));
