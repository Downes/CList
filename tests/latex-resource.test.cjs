const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const { menuShellDocument } = require('./helpers/menu-shell-dom.cjs');
const document = menuShellDocument(), create = document.createElement;
// Browser CSS declarations serialize hex colors as rgb(). Exercise that boundary here.
document.createElement = tag => {
    const node = create(tag); let color = '';
    Object.defineProperty(node.style, 'color', { get: () => color, set(value) {
        const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value);
        if (!hex) { color = value; return; }
        const digits = hex[1].length === 3 ? [...hex[1]].map(digit => digit + digit).join('') : hex[1];
        color = 'rgb(' + [0, 2, 4].map(offset => parseInt(digits.slice(offset, offset + 2), 16)).join(', ') + ')';
    } }); return node;
};
const context = vm.createContext({ document, console: { error() {} }, window: { CList: { state: {}, config: {}, ui: {} } } });
for (const name of ['latex_resource', 'latex_resource_view']) vm.runInContext(fs.readFileSync('js/' + name + '.js', 'utf8'), context);
vm.runInContext(fs.readFileSync('tests/helpers/latex-resource-fixture.js', 'utf8'), context);
for (const [name, run] of vm.runInContext('latexResourceCases', context)) test(name, () => run((condition, message) => assert.ok(condition, message)));
