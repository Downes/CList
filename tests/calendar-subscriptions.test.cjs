const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const plain = value => JSON.parse(JSON.stringify(value));

function fixture() {
    const fetchCalls = [];
    let respond = async () => ({ ok: true, headers: { get: () => 'text/calendar' },
        text: async () => [
            'BEGIN:VEVENT', 'UID:evt-1', 'SUMMARY:Standup', 'DTSTART:20260105T090000Z', 'END:VEVENT',
        ].join('\r\n') });
    const CList = { defaults: { PROXYP: 'https://proxy.invalid/relay' } };
    const ctx = vm.createContext({ console: { error() {} }, window: { CList }, URLSearchParams,
        kvstoreAuthHeader: () => ({}),
        proxypAccessKeyHeader: async () => ({}),
        fetch: async (...args) => { fetchCalls.push(args); return respond(...args); },
    });
    vm.runInContext(fs.readFileSync('js/ics.js', 'utf8'), ctx);
    vm.runInContext(fs.readFileSync('js/calendar-subscriptions.js', 'utf8'), ctx);
    return { ctx, fetchCalls, respond: fn => respond = fn };
}

test('normalized events get a synthetic id and subscription tagging', async () => {
    const f = fixture();
    const events = await f.ctx.fetchSubscriptionEvents('acct-1', { url: 'https://example.invalid/feed.ics' });
    assert.deepEqual(plain(events), [{ uid: 'evt-1', title: 'Standup', start: '2026-01-05T09:00:00Z',
        id: 'subscription:acct-1:evt-1', sourceType: 'subscription', sourceKey: 'acct-1', readOnly: true }]);
});

test('repeated calls without force reuse the cache -- fetch called once', async () => {
    const f = fixture();
    await f.ctx.fetchSubscriptionEvents('acct-1', { url: 'https://example.invalid/feed.ics' });
    await f.ctx.fetchSubscriptionEvents('acct-1', { url: 'https://example.invalid/feed.ics' });
    assert.equal(f.fetchCalls.length, 1);
});

test('force: true bypasses the cache', async () => {
    const f = fixture();
    await f.ctx.fetchSubscriptionEvents('acct-1', { url: 'https://example.invalid/feed.ics' });
    await f.ctx.fetchSubscriptionEvents('acct-1', { url: 'https://example.invalid/feed.ics' }, { force: true });
    assert.equal(f.fetchCalls.length, 2);
});

test('clearSubscriptionCache(key) forces the next call to refetch; a plain reload keeps other keys', async () => {
    const f = fixture();
    await f.ctx.fetchSubscriptionEvents('acct-1', { url: 'https://example.invalid/a.ics' });
    await f.ctx.fetchSubscriptionEvents('acct-2', { url: 'https://example.invalid/b.ics' });
    f.ctx.clearSubscriptionCache('acct-1');
    await f.ctx.fetchSubscriptionEvents('acct-1', { url: 'https://example.invalid/a.ics' });
    await f.ctx.fetchSubscriptionEvents('acct-2', { url: 'https://example.invalid/b.ics' });
    assert.equal(f.fetchCalls.length, 3);
});

test('a non-OK HTTP response surfaces as a usable error', async () => {
    const f = fixture();
    f.respond(async () => ({ ok: false, status: 503, headers: { get: () => '' }, text: async () => '' }));
    await assert.rejects(f.ctx.fetchSubscriptionEvents('acct-1', { url: 'https://example.invalid/feed.ics' }), /503/);
});

test('a proxyp {error} JSON body (HTTP 200) surfaces as a usable error', async () => {
    const f = fixture();
    f.respond(async () => ({ ok: true, headers: { get: () => 'application/json' },
        text: async () => JSON.stringify({ error: 'Could not reach that URL' }) }));
    await assert.rejects(f.ctx.fetchSubscriptionEvents('acct-1', { url: 'https://example.invalid/feed.ics' }), /Could not reach that URL/);
});
