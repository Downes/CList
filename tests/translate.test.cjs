const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const { menuShellDocument } = require('./helpers/menu-shell-dom.cjs');
const ctx = vm.createContext({ document: menuShellDocument(), window: { CList: { state: {}, keys: { TRANSLATION_ENABLED: 'fixture-translation' } } }, localStorage: { getItem: () => 'false' }, structuredClone, console: { error() {} } });
for (const name of ['translate-workflow', 'translate-view', 'translate-controller', 'translate']) vm.runInContext(fs.readFileSync('js/' + name + '.js', 'utf8'), ctx);
vm.runInContext(fs.readFileSync('tests/helpers/translate-fixture.js', 'utf8'), ctx);
for (const [name, run] of vm.runInContext('translateCases', ctx)) test(name, () => run((condition, message) => assert.ok(condition, message)));
