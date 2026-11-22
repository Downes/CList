const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const { menuShellDocument } = require('./helpers/menu-shell-dom.cjs');
const context = vm.createContext({ document: menuShellDocument(), structuredClone, AggregateError, console: { error() {} } });
for (const name of ['js/collab_creation_workflow.js','js/collab_creation_view.js','js/collab_creation.js','tests/helpers/collab-creation-fixture.js']) vm.runInContext(fs.readFileSync(name,'utf8'),context);
for (const [name, run] of vm.runInContext('collabCreationCases',context)) test(name, () => run((condition,message) => assert.ok(condition,message)));
