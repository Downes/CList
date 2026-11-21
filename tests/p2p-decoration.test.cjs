const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const ctx = vm.createContext({ window: { CList: { state: {} } } });
for (const name of ['dynamicp2p_message_workflow', 'dynamicp2p_message_view', 'dynamicp2p']) vm.runInContext(fs.readFileSync('js/' + name + '.js', 'utf8'), ctx);
vm.runInContext(fs.readFileSync('tests/helpers/p2p-decoration-fixture.js', 'utf8'), ctx);
for (const [name, run] of vm.runInContext('p2pDecorationCases', ctx)) test(name, () => run((condition, message) => assert.ok(condition, message)));
