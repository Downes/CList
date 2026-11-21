const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const { menuShellDocument } = require('./helpers/menu-shell-dom.cjs');
const ctx = vm.createContext({ document: menuShellDocument(), window: { CList: { state: {} } }, crypto: { randomUUID: (() => { let id = 0; return () => 'bridge-' + ++id; })() }, structuredClone, console: { error() {} } });
for (const name of ['dynamicp2p_popup', 'dynamicp2p_popup_client', 'dynamicp2p_popup_view', 'dynamicp2p']) vm.runInContext(fs.readFileSync('js/' + name + '.js', 'utf8'), ctx);
vm.runInContext(fs.readFileSync('tests/helpers/p2p-popup-fixture.js', 'utf8'), ctx);
for (const [name, run] of vm.runInContext('p2pPopupCases', ctx)) test(name, () => run((condition, message) => assert.ok(condition, message)));
