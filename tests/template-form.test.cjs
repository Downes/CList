const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const { menuShellDocument } = require('./helpers/menu-shell-dom.cjs');
const ctx = vm.createContext({ document: menuShellDocument(), window: { CList: { state: {} } }, structuredClone, console: { error() {} } });
for (const name of ['chatgpt_requests','chatgpt_template_requests','chatgpt_template_view','chatgpt_template_form','chatgpt']) vm.runInContext(fs.readFileSync('js/' + name + '.js','utf8'),ctx);
vm.runInContext(fs.readFileSync('tests/helpers/template-form-fixture.js','utf8'),ctx);
for (const [name, run] of vm.runInContext('templateFormCases',ctx)) test(name,()=>run((condition,message)=>assert.ok(condition,message)));
