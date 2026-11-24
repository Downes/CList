const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const gate = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const flush = () => new Promise(done => setImmediate(done));
function fixture() {
    const writes = [], requests = [], behavior = {};
    let token = 'original-token', valid = true;
    const clist = { config: { flaskSiteUrl: 'https://original.invalid' }, state: { username: 'Alice' }, keys: { ACCESS_TOKEN: 'token' },
        kvStoreRemote: { async put(ctx, key, value) { writes.push({ ...ctx, key, value }); } } };
    const context = vm.createContext({ window: { CList: clist }, console: { log() {} }, crypto: { randomUUID: () => 'event-id' },
        getSiteSpecificCookie: () => token, getEncKey: async () => 'original-key',
        encryptWithKey: async (key, value) => { if (behavior.encrypt) await behavior.encrypt(); return 'encrypted:' + value; },
        fetchDecryptedKvRecordsByPrefix: async () => { if (behavior.read) await behavior.read(); return [{ value: { id: 'existing', title: 'Original event' } }]; },
        buildIcsCalendar: (events, options) => JSON.stringify({ events, options }), kvErrorMessage: error => error.message,
        fetch: async (url, init) => { requests.push({ url, ...init }); return { ok: true, json: async () => ({ accepted: true }) }; },
    });
    for (const name of ['storage', 'collection-session', 'calendar', 'calendar-publish']) vm.runInContext(fs.readFileSync('js/' + name + '.js', 'utf8'), context);
    context.session = vm.runInContext('beginCollectionSession()', context); context.session.isCurrent = () => valid;
    return { writes, requests, behavior, clist,
        save: () => vm.runInContext("saveCalendarEvent({title:'Captured event', extension:{kept:true}}, session)", context),
        publish: () => vm.runInContext('publishOwnCalendar(session)', context),
        change(kind) { if (kind === 'server') clist.config.flaskSiteUrl = 'https://different.invalid';
            else if (kind === 'user') clist.state.username = 'Bob'; else if (kind === 'token') token = 'new-token'; else valid = false; },
    };
}
for (const kind of ['server', 'user', 'token', 'caller']) {
    test('calendar save rejects ' + kind + ' expiry during encryption', async () => {
        const f = fixture(), pendingEncryption = gate(); f.behavior.encrypt = () => pendingEncryption.promise;
        const save = f.save(); await flush(); f.change(kind); pendingEncryption.resolve();
        await assert.rejects(save, /no longer current/); assert.equal(f.writes.length, 0);
    });
    test('calendar publication rejects ' + kind + ' expiry during event loading', async () => {
        const f = fixture(), pendingRead = gate(); f.behavior.read = () => pendingRead.promise;
        const publish = f.publish(); await flush(); f.change(kind); pendingRead.resolve();
        await assert.rejects(publish, /no longer current/); assert.equal(f.requests.length, 0);
    });
}
test('unchanged calendar save retains metadata and original storage credentials', async () => {
    const f = fixture(); const saved = await f.save();
    assert.equal(saved.extension.kept, true); assert.equal(f.writes.length, 1);
    assert.equal(f.writes[0].baseUrl, 'https://original.invalid'); assert.equal(f.writes[0].token, 'original-token');
    assert.equal(f.writes[0].key, 'calendar:event-id');
});
test('unchanged publication uses captured endpoint, credentials, name and events', async () => {
    const f = fixture(); const result = await f.publish(); assert.equal(result.accepted, true);
    assert.equal(f.requests.length, 1); const request = f.requests[0];
    assert.equal(request.url, 'https://original.invalid/auth/calendar'); assert.equal(request.headers.Authorization, 'Bearer original-token');
    const ics = JSON.parse(JSON.parse(request.body).ics); assert.equal(ics.options.calName, "Alice's Calendar");
    assert.equal(ics.events[0].title, 'Original event');
});
test('already expired publication fails before reading or sending', async () => {
    const f = fixture(); let reads = 0; f.behavior.read = () => { reads++; }; f.change('user');
    await assert.rejects(f.publish(), /no longer current/); assert.equal(reads, 0); assert.equal(f.requests.length, 0);
});
