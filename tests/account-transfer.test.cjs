const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const document = { getElementById: () => null };
const context = vm.createContext({ document, structuredClone, Blob, console: { error() {} }, window: { CList: { state: {}, config: {} } } });
for (const name of ['oauth_account', 'account-transfer-workflow', 'account-transfer-controller', 'account-transfer', 'personal-options-transfer']) vm.runInContext(fs.readFileSync('js/' + name + '.js', 'utf8'), context);
vm.runInContext(fs.readFileSync('tests/helpers/account-transfer-fixture.js', 'utf8'), context);
let checks = 0;
for (const [name, run] of vm.runInContext('accountTransferCases', context)) test(name, { timeout: 2000 }, () => run((condition, message) => { assert.ok(condition, message); checks++; }));
test.after(() => console.log('Account transfer fixture assertions:', checks));
