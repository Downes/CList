const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function fixture() {
    const calls = [], CList = { schemas: {}, readers: {}, publishers: {} };
    const ctx = vm.createContext({ window: { CList }, structuredClone,
        kvstoreAuthHeader: () => ({ Authorization: 'Bearer captured-token' }),
        removeHtml: content => content.replace(/<[^>]*>/g, ''),
        fetch: async (url, options) => { calls.push({ url, ...options }); return { ok: true, status: 200, json: async () => ({ ok: true, url: 'https://discord.com/channels/server/channel/message' }) }; },
    });
    vm.runInContext(fs.readFileSync('js/discord.js', 'utf8'), ctx);
    return { ctx, CList, calls, publish: CList.publishers.Discord.publish };
}
test('Discord publishes selected account channel and plain text using the existing bridge auth without DOM or modals', async () => {
    const f = fixture();
    const result = await f.publish({ channel: 'selected' }, 'Title', '<p>Content</p>');
    assert.equal(f.calls[0].url, 'https://discord.mooc.ca/send'); assert.equal(f.calls[0].method, 'POST');
    assert.equal(f.calls[0].headers.Authorization, 'Bearer captured-token');
    assert.deepEqual(JSON.parse(f.calls[0].body), { channel: 'selected', content: 'Content' });
    assert.equal(result, 'https://discord.com/channels/server/channel/message'); assert.equal('document' in f.ctx, false);
});
test('missing channel rejects without making a request', async () => {
    const f = fixture(); await assert.rejects(f.publish({}, '', 'body'), /no channel configured/); assert.equal(f.calls.length, 0);
});
test('bridge HTTP errors and bridge-declared failures reject with the supplied detail', async () => {
    for (const response of [{ ok: false, status: 403, json: async () => ({ error: 'Access denied' }) },
        { ok: true, status: 200, json: async () => ({ ok: false, error: 'Channel unavailable' }) }]) {
        const f = fixture(); f.ctx.fetch = async () => response;
        await assert.rejects(f.publish({ channel: 'selected' }, '', 'body'), /Access denied|Channel unavailable/);
    }
});
test('network and unreadable bridge responses reject rather than returning an unconfirmed success', async () => {
    const f = fixture(); f.ctx.fetch = async () => { throw Error('network offline'); };
    await assert.rejects(f.publish({ channel: 'selected' }, '', 'body'), /network offline/);
    f.ctx.fetch = async () => ({ ok: false, status: 502, json: async () => { throw Error('invalid JSON'); } });
    await assert.rejects(f.publish({ channel: 'selected' }, '', 'body'), /HTTP 502/);
});
test('a successful bridge response without a URL retains the optional-link return contract', async () => {
    const f = fixture(); f.ctx.fetch = async () => ({ ok: true, status: 200, json: async () => ({ ok: true }) });
    assert.equal(await f.publish({ channel: 'selected' }, '', 'body'), null);
});
test('ordinary workflow emits one failed destination for a Discord error and continues other destinations', async () => {
    const f = fixture(), events = [];
    vm.runInContext(fs.readFileSync('js/publishing-workflow.js', 'utf8'), f.ctx);
    f.ctx.fetch = async () => ({ ok: false, status: 401, json: async () => ({ error: 'Not authorized' }) });
    f.CList.publishers.Other = { publish: async () => 'https://other/post' };
    const result = await f.ctx.runPublishingWorkflow({ title: '', content: 'body', references: [], selectedAccountKeys: ['discord', 'other'] }, {
        accounts: [{ key: 'discord', value: JSON.stringify({ type: 'Discord', permissions: 'w', channel: 'selected' }) },
            { key: 'other', value: JSON.stringify({ type: 'Other', permissions: 'w' }) }],
        publishers: f.CList.publishers, parseAccount: row => JSON.parse(row.value), toText: s => s, onUpdate: e => events.push(e),
    });
    assert.equal(result.destinations[0].status, 'failed'); assert.equal(result.destinations[0].error, 'Not authorized');
    assert.equal(result.destinations[1].status, 'published');
    assert.equal(events.filter(e => e.type === 'destination' && e.result.status === 'failed').length, 1);
});
