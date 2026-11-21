const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const { menuShellDocument } = require('./helpers/menu-shell-dom.cjs');
const document = menuShellDocument();
const ctx = vm.createContext({ document, window: { CList: { ui: { view: {} } } },
    console: { error() {} }, translationEnabled: false, toggleTranslation() {}, showStatusMessage() {},
    MutationObserver: class { observe() {} disconnect() {} } });
const interfaceSource = fs.readFileSync('js/interface.js', 'utf8');
vm.runInContext(interfaceSource.slice(interfaceSource.indexOf('function showStackedModal('), interfaceSource.indexOf('function closeStackedModal(')), ctx);
for (const name of ['action-menu-view', 'action-menu', 'menu-shell-view', 'menu-shell', 'reader-view']) vm.runInContext(fs.readFileSync('js/' + name + '.js', 'utf8'), ctx);
vm.runInContext(fs.readFileSync('tests/helpers/menu-shell-fixture.js', 'utf8'), ctx);
for (const [name, run] of vm.runInContext('menuShellCases', ctx)) test(name, () => run((condition, message) => assert.ok(condition, message)));
