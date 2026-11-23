const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const { menuShellDocument } = require('./helpers/menu-shell-dom.cjs');
const document = menuShellDocument(), create = document.createElement;
document.createElement = tag => { const node = create(tag); node.click = () => { if (!node.disabled) return node.onclick?.({ preventDefault() {}, stopPropagation() {}, target: node }); }; return node; };
const context = vm.createContext({ document, URL, URLSearchParams, FormData, Blob, structuredClone, console: { error() {} },
    window: { CList: { state: {}, config: {}, ui: {} } }, editorHandlers: {} });
for (const name of ['etherpad_requests', 'etherpad_document_requests', 'etherpad_document_workflow', 'etherpad_document', 'etherpad_document_view', 'etherpad_connection', 'etherpad_connection_view', 'etherpad']) vm.runInContext(fs.readFileSync('js/' + name + '.js', 'utf8'), context);
vm.runInContext(fs.readFileSync('tests/helpers/etherpad-document-fixture.js', 'utf8'), context);
for (const [name, run] of vm.runInContext('etherpadDocumentCases', context)) test(name, { timeout: 2000 }, () => run((condition, message) => assert.ok(condition, message)));
