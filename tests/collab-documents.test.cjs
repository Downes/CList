const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const { menuShellDocument } = require('./helpers/menu-shell-dom.cjs');
const ctx = vm.createContext({ document: menuShellDocument(), window: { CList: { state: {} } }, structuredClone, console: { error() {} } });
for (const name of ['collab_documents_requests','collab_documents_view','collab_documents']) vm.runInContext(fs.readFileSync('js/' + name + '.js','utf8'),ctx);
vm.runInContext(fs.readFileSync('tests/helpers/collab-documents-fixture.js','utf8'),ctx);
for (const [name,run] of vm.runInContext('collabDocumentsCases',ctx)) test(name,()=>run((condition,message)=>assert.ok(condition,message)));
