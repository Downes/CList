const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const ctx = vm.createContext({ window: { CList: { state: {}, config: { flaskSiteUrl: 'https://store.invalid' }, defaults: {}, keys: { ACCESS_TOKEN: 'fixture-token' } } }, structuredClone, console: { error() {}, warn() {} } });
for (const name of ['dynamicp2p_heartbeat_workflow', 'dynamicp2p_heartbeat_view', 'dynamicp2p_heartbeat', 'dynamicp2p']) vm.runInContext(fs.readFileSync('js/' + name + '.js', 'utf8'), ctx);
vm.runInContext(fs.readFileSync('tests/helpers/p2p-heartbeat-fixture.js', 'utf8'), ctx);
for (const [name, run] of vm.runInContext('p2pHeartbeatCases', ctx)) test(name, () => run((condition, message) => assert.ok(condition, message)));
