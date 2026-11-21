const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const { NavigationElement } = require('./helpers/navigation-dom.cjs');
const ctx = vm.createContext({ window: { CList: { ui: { view: {} } } },
    document: { createElement: tag => new NavigationElement(tag), getElementById: () => null },
    console: { error() {} }, translationEnabled: false, toggleTranslation() {}, fixtureAttach() {} });
for (const name of ['action-menu-view', 'action-menu', 'menu-shell-view', 'menu-shell', 'reader-view']) vm.runInContext(fs.readFileSync('js/' + name + '.js', 'utf8'), ctx);
vm.runInContext(fs.readFileSync('tests/helpers/action-menu-fixture.js', 'utf8'), ctx);
for (const [name, run] of vm.runInContext('actionMenuCases', ctx)) test(name, () => run((condition, message) => assert.ok(condition, message)));
