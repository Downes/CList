const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const { menuShellDocument } = require('./helpers/menu-shell-dom.cjs');
const document = menuShellDocument(), create = document.createElement;
document.createElement = tag => { const node = create(tag); node.removeAttribute = key => { delete node[key]; }; node.click = () => { if (!node.disabled) return node.onclick?.({ preventDefault() {}, target: node }); }; return node; };
const context = vm.createContext({ document, Blob, console: { error() {} }, window: {} });
for (const name of ['latex_controls_workflow', 'latex_content', 'latex_controls', 'latex_controls_view']) vm.runInContext(fs.readFileSync('js/' + name + '.js', 'utf8'), context);
vm.runInContext(fs.readFileSync('tests/helpers/latex-controls-fixture.js', 'utf8'), context);
for (const [name, run] of vm.runInContext('latexControlsCases', context)) test(name, { timeout: 2000 }, () => run((condition, message) => assert.ok(condition, message)));
