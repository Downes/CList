const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const ctx = vm.createContext({ window: { CList: { state: {} } }, structuredClone });
for (const name of ['summarize-workflow', 'summarize-view', 'summarize-controller', 'summarize']) vm.runInContext(fs.readFileSync('js/' + name + '.js', 'utf8'), ctx);
vm.runInContext(fs.readFileSync('tests/helpers/summarize-fixture.js', 'utf8'), ctx);
for (const [name, run] of vm.runInContext('summarizeCases', ctx)) test(name, () => run((condition, message) => assert.ok(condition, message)));
