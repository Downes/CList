const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function fixture() {
    const ctx = vm.createContext({ structuredClone });
    vm.runInContext(fs.readFileSync('js/publishing-workflow.js', 'utf8'), ctx);
    const events = [];
    const request = { title: 'Title', content: 'Article '.repeat(100), references: [{ url: 'https://source.test', metadata: { value: 1 } }],
        selectedAccountKeys: ['short', 'full'], accountStoreUrl: 'https://kv.test' };
    const record = (key, data) => ({ key, value: JSON.stringify({ permissions: 'w', title: key, ...data }) });
    const dependencies = {
        accounts: [record('short', { type: 'Short', maxlength: 80, id: 'secret' }), record('full', { type: 'Full' })],
        publishers: {}, parseAccount: account => JSON.parse(account.value),
        toText: html => html.replace(/<[^>]+>/g, ''), onUpdate: event => events.push(event),
    };
    return { ctx, request, dependencies, events, record };
}

test('workflow runs without a document: full content precedes a limited post containing its returned URL', async () => {
    const f = fixture(), calls = [], url = 'https://blog.test/article';
    f.dependencies.publishers.Full = { publish: async (_, title, content) => { calls.push({ title, content }); return url; } };
    f.dependencies.publishers.Short = { construct: (_, content) => content, publish: async (_, title, content) => {
        calls.push({ title, content }); return 'https://social.test/status';
    } };
    const result = await f.ctx.runPublishingWorkflow(f.request, f.dependencies);
    assert.equal('document' in f.ctx, false); assert.equal('window' in f.ctx, false);
    assert.equal(calls[0].content, f.request.content); assert.equal(calls[1].content, `Title see ${url}`);
    assert.ok(calls[1].content.length <= 80); assert.equal(result.primaryUrl, url);
    assert.deepEqual(Array.from(result.destinations, d => d.key), ['full', 'short']);
    assert.ok(result.destinations.every(d => d.status === 'published'));
    assert.equal(JSON.stringify(result).includes('secret'), false);
    assert.equal(JSON.stringify(f.events).includes('secret'), false);
});

test('target filtering and positive-limit sorting preserve unlimited and same-limit destination order', async () => {
    const f = fixture(); f.request.content = 'small';
    f.request.selectedAccountKeys = ['small', 'no-write', 'missing', 'invalid', 'large', 'zero', 'large2'];
    f.dependencies.accounts = [f.record('small', { type: 'Test', maxlength: 5 }),
        f.record('no-write', { type: 'Test', permissions: 'r' }), f.record('invalid', { type: 'Test', maxlength: 'invalid' }),
        f.record('large', { type: 'Test', maxlength: '100' }), f.record('zero', { type: 'Test', maxlength: 0 }),
        f.record('large2', { type: 'Test', maxlength: 100 })];
    f.dependencies.publishers.Test = { publish: async () => null };
    const result = await f.ctx.runPublishingWorkflow(f.request, f.dependencies);
    assert.deepEqual(Array.from(result.destinations, d => d.key), ['invalid', 'zero', 'large', 'large2', 'small']);
    f.request.selectedAccountKeys = ['missing', 'no-write'];
    await assert.rejects(f.ctx.runPublishingWorkflow(f.request, f.dependencies), /No valid publishing account/);
});

test('construct transforms before measuring, while a first limited destination warns and truncates', async () => {
    const f = fixture(), contents = [];
    f.request.selectedAccountKeys = ['short'];
    f.dependencies.publishers.Short = { construct: () => '<b>constructed</b>'.repeat(10),
        publish: async (_, __, content) => { contents.push(content); return null; } };
    const result = await f.ctx.runPublishingWorkflow(f.request, f.dependencies);
    assert.equal(contents[0], '<b>constructed</b>'.repeat(10).slice(0, 80));
    assert.equal(result.destinations[0].status, 'unconfirmed');
    assert.equal(f.events.filter(event => event.type === 'warning').length, 1);
    assert.equal(result.destinations[0].warnings.length, 1);
    f.dependencies.publishers.Short.construct = () => 'fits';
    const fits = await f.ctx.runPublishingWorkflow(f.request, f.dependencies);
    assert.equal(contents[1], 'fits'); assert.equal(fits.destinations[0].warnings.length, 0);
});

test('failed construction or publication does not stop later destinations, and missing handlers remain distinct', async () => {
    const f = fixture();
    f.request.selectedAccountKeys = ['full', 'short', 'missing-handler', 'last'];
    f.dependencies.accounts.push(f.record('missing-handler', { type: 'Missing' }), f.record('last', { type: 'Last' }));
    f.dependencies.publishers.Full = { publish: async () => { throw Error('write failed'); } };
    f.dependencies.publishers.Short = { construct: () => { throw Error('construction failed'); }, publish: async () => assert.fail('should not write') };
    f.dependencies.publishers.Last = { publish: async () => 'https://last.test/post' };
    const result = await f.ctx.runPublishingWorkflow(f.request, f.dependencies);
    const byKey = Object.fromEntries(result.destinations.map(d => [d.key, d]));
    assert.equal(byKey.full.status, 'failed'); assert.equal(byKey.short.error, 'construction failed');
    assert.equal(byKey['missing-handler'].status, 'skipped'); assert.equal(byKey.last.status, 'published');
    assert.equal(result.primaryUrl, 'https://last.test/post');
    assert.equal(f.events.filter(event => event.type === 'destination' && event.result.status === 'failed').length, 2);
});

test('requests, parsed account properties, and each publisher reference array are detached from other mutations', async () => {
    const f = fixture(); let release, second;
    const shared = { type: 'Short', permissions: 'w', maxlength: 80, title: 'Original short' };
    f.dependencies.parseAccount = account => account.key === 'short' ? shared : JSON.parse(account.value);
    f.dependencies.publishers.Full = { publish: async (_, __, ___, refs) => {
        refs[0].metadata.value = 999;
        await new Promise(resolve => { release = resolve; }); return 'https://blog.test/article';
    } };
    f.dependencies.publishers.Short = { publish: async (account, title, content, refs) => { second = { account, title, content, refs }; return null; } };
    const pending = f.ctx.runPublishingWorkflow(f.request, f.dependencies);
    shared.title = 'Later short'; f.request.title = 'Later'; f.request.references[0].metadata.value = 2;
    f.request.selectedAccountKeys = []; release(); await pending;
    assert.equal(second.title, 'Title'); assert.equal(second.account.title, 'Original short');
    assert.equal(second.refs[0].metadata.value, 1); assert.match(second.content, /^Title see/);
});

test('progress and destination updates reduce to plain state without credentials or interface access', async () => {
    const f = fixture(); let operation = { status: 'capturing', primaryUrl: null, destinations: [] };
    f.dependencies.onUpdate = event => { operation = f.ctx.applyPublishingUpdate(operation, event); };
    f.request.selectedAccountKeys = ['full'];
    let progressState;
    f.dependencies.publishers.Full = { publish: async (_, __, ___, ____, options) => {
        options.onProgress({ stage: 'uploading-images', completed: 0, total: 2 });
        progressState = structuredClone(operation);
        options.onProgress({ stage: 'creating-post' }); return 'https://blog.test/article';
    } };
    const result = await f.ctx.runPublishingWorkflow(f.request, f.dependencies);
    assert.equal(progressState.destinations[0].progress.total, 2);
    assert.equal(operation.destinations[0].status, 'published'); assert.equal(operation.primaryUrl, result.primaryUrl);
    assert.equal(JSON.stringify(operation).includes('secret'), false);
});
