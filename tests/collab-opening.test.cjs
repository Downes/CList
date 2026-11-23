const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const { menuShellDocument } = require('./helpers/menu-shell-dom.cjs');
const context = vm.createContext({ document: menuShellDocument(), URL, structuredClone, console: { error() {} } });
for (const name of ['js/collab_opening_workflow.js','js/collab_opening_view.js','js/collab_opening.js','tests/helpers/collab-opening-fixture.js']) vm.runInContext(fs.readFileSync(name,'utf8'),context);
for (const [name, run] of vm.runInContext('collabOpeningCases',context)) test(name, () => run((condition,message) => assert.ok(condition,message)));
