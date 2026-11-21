const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const { menuShellDocument } = require('./helpers/menu-shell-dom.cjs');
const ctx = vm.createContext({ document: menuShellDocument(), window: { CList: { accounts: [] } }, structuredClone,
    fetch() { throw Error('Unexpected network'); }, console: { error() {} } });
const ui = fs.readFileSync('js/interface.js', 'utf8');
vm.runInContext(ui.slice(ui.indexOf('function showStackedModal('), ui.indexOf('function closeStackedModal(')), ctx);
for (const name of ['menu-shell-view', 'menu-shell', 'localrss_options_view', 'localrss_options']) vm.runInContext(fs.readFileSync('js/' + name + '.js', 'utf8'), ctx);
vm.runInContext(fs.readFileSync('tests/helpers/localrss-options-shell-fixture.js', 'utf8'), ctx);
for (const [name, run] of vm.runInContext('optionsShellCases', ctx)) test(name, () => run((condition, message) => assert.ok(condition, message)));
