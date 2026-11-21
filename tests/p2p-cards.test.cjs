const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const { menuShellDocument } = require('./helpers/menu-shell-dom.cjs');
const ctx = vm.createContext({ document: menuShellDocument(), window: { CList: { state: {} } }, URL, structuredClone, console: { error() {} } });
for (const name of ['dynamicp2p_cards_view', 'dynamicp2p_cards', 'dynamicp2p']) vm.runInContext(fs.readFileSync('js/' + name + '.js', 'utf8'), ctx);
vm.runInContext(fs.readFileSync('tests/helpers/p2p-cards-fixture.js', 'utf8'), ctx);
for (const [name, run] of vm.runInContext('p2pCardsCases', ctx)) test(name, () => run((condition, message) => assert.ok(condition, message)));
