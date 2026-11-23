const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const { menuShellDocument } = require('./helpers/menu-shell-dom.cjs');
const { NavigationElement } = require('./helpers/navigation-dom.cjs');
const { Element } = require('./helpers/account-fixture.cjs');
const document = menuShellDocument(), create = document.createElement;
document.createElement = tag => {
    const node = create(tag), listeners = node.listeners;
    const html = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
    Object.defineProperty(node, 'innerHTML', { set(value) { html.set.call(node, value);
        const upgrade = parent => { for (const child of parent.children) { Object.setPrototypeOf(child, NavigationElement.prototype); upgrade(child); } }; upgrade(node); } });
    node.dispatchEvent = event => { if (!event.target) Object.defineProperty(event, 'target', { value: node }); listeners[event.type]?.(event); node['on' + event.type]?.(event); return true; };
    node.click = () => { if (!node.disabled) node.dispatchEvent(new Event('click')); };
    return node;
};
const context = vm.createContext({ document, Event, structuredClone, window: { CList: { state: {}, config: {}, ui: {} } },
    editorHandlers: {}, collectionFormats: {}, _activeCollection: null, console: { error() {} } });
for (const name of ['collection-draft-state', 'collection-draft', 'collection-draft-view', 'collection-editor']) vm.runInContext(fs.readFileSync('js/' + name + '.js', 'utf8'), context);
vm.runInContext(fs.readFileSync('tests/helpers/collection-draft-fixture.js', 'utf8'), context);
for (const [name, run] of vm.runInContext('collectionDraftCases', context)) test(name, { timeout: 2000 }, () => run((condition, message) => assert.ok(condition, message)));
