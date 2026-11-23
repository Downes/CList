const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const ctx = vm.createContext({ window: { CList: { state: {} } }, structuredClone });
for (const name of ['chatgpt_requests', 'chatgpt_template_requests', 'chatgpt']) vm.runInContext(fs.readFileSync('js/' + name + '.js', 'utf8'), ctx);
vm.runInContext(fs.readFileSync('tests/helpers/chatgpt-requests-fixture.js', 'utf8'), ctx);
for (const [name, run] of vm.runInContext('chatGptRequestCases', ctx)) test(name, () => run((condition, message) => assert.ok(condition, message)));
