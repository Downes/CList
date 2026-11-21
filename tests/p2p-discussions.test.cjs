const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const { menuShellDocument } = require('./helpers/menu-shell-dom.cjs');
const ctx = vm.createContext({ document: menuShellDocument(), window: { CList: { state: {}, config: { flaskSiteUrl: 'https://store.invalid' },
    defaults: { DISCUSSIONS: 'https://discussions.invalid' }, keys: { USERNAME: 'fixture-user', ACCESS_TOKEN: 'fixture-token' } } },
    AbortController, structuredClone, console: { error() {} } });
for (const name of ['dynamicp2p_session_bridge', 'dynamicp2p_discussions_requests', 'dynamicp2p_discussions_view', 'dynamicp2p_discussions', 'dynamicp2p']) vm.runInContext(fs.readFileSync('js/' + name + '.js', 'utf8'), ctx);
vm.runInContext(fs.readFileSync('tests/helpers/p2p-discussions-fixture.js', 'utf8'), ctx);
for (const [name, run] of vm.runInContext('p2pDiscussionsCases', ctx)) test(name, () => run((condition, message) => assert.ok(condition, message)));
