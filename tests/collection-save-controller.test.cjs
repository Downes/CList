const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function fixture() {
    const request = {
        name: 'Original collection', formatId: 'opml',
        identity: { key: 'collection:one', id: 'urn:uuid:one' },
        items: [{ title: 'Original entry', url: 'https://example.org' }],
        publishedUrls: [{ url: 'https://published.example' }], feedAccount: null,
    };
    const session = { token: 'test-token', encKey: 'test-key' };
    const calls = [];
    let failure, gate, refreshed = 0;
    let draft = { name: request.name, items: structuredClone(request.items) };
    // Neither persistence nor the controller can access a document or buttons.
    // The controller gets the current draft and refreshes identity through view interfaces.
    const context = vm.createContext({
        structuredClone,
        window: { CList: { config: { flaskSiteUrl: 'https://store.example' }, state: { username: 'alice' }, readers: {} } },
        _activeCollection: { col: { ...structuredClone(request.identity), name: request.name, items: structuredClone(request.items) } },
        _kvSaveItems: async (...args) => { calls.push(args); if (gate) await gate; if (failure) throw failure; },
        readActiveCollectionDraft: () => draft,
        _refreshIdDisplay: () => { refreshed++; },
    });
    const source = fs.readFileSync(path.join(__dirname, '../js/collections.js'), 'utf8');
    vm.runInContext(source.slice(source.indexOf('async function persistCollectionSave('), source.indexOf('window.playCollectionSave =')), context);
    return {
        context, request, session, calls,
        setFailure: value => { failure = value; },
        pause: () => { let resume; gate = new Promise(resolve => { resume = resolve; }); return resume; },
        setDraft: value => { draft = value; }, refreshed: () => refreshed,
        state: () => context.window.CList.state.collectionSaving,
    };
}

test('ordinary persistence consumes explicit data and returns a detached result without UI access', async () => {
    const f = fixture();
    const saved = await f.context.persistCollectionSave(f.request, f.session);
    assert.equal(f.calls.length, 1);
    assert.equal(f.calls[0][0], 'collection:one');
    assert.equal(f.calls[0][1], 'urn:uuid:one');
    assert.equal(f.calls[0][2], 'Original collection');
    assert.deepEqual(f.calls[0][6], f.request.publishedUrls);
    assert.equal(saved.key, 'collection:one');
    f.request.items[0].title = 'Later';
    f.request.publishedUrls[0].url = 'https://later.example';
    assert.equal(saved.items[0].title, 'Original entry');
    assert.equal(saved.publishedUrls[0].url, 'https://published.example');
    assert.equal(f.refreshed(), 0, 'persistence does not refresh the view');
    assert.ok(!JSON.stringify(saved).includes('test-token'));
});

test('feed persistence dispatches through the existing reader registry', async () => {
    const f = fixture();
    let supplied;
    f.request.feedAccount = { type: 'CustomFeed', key: 'custom-feed', database: 'private' };
    f.context.window.CList.readers.CustomFeed = { saveCollection: async (request, session) => { supplied = { request, session }; } };
    const saved = await f.context.persistCollectionSave(f.request, f.session);
    assert.equal(supplied.request, f.request);
    assert.equal(supplied.session, f.session);
    assert.equal(saved.feedAccount.type, 'CustomFeed');
    assert.equal(f.calls.length, 0);
});

test('missing credentials and unsupported save capabilities fail without writing', async () => {
    const f = fixture();
    await assert.rejects(f.context.persistCollectionSave(f.request, { token: '', encKey: '' }), /Please log in/);
    f.request.feedAccount = { type: 'Unsupported', key: 'unsupported' };
    await assert.rejects(f.context.persistCollectionSave(f.request, f.session), /cannot save collections/);
    assert.equal(f.calls.length, 0);
});

test('duplicate invocations share the in-flight save independently of button state', async () => {
    const f = fixture(), resume = f.pause();
    const first = f.context.runCollectionSave(f.request, f.session);
    const second = f.context.runCollectionSave(f.request, f.session);
    assert.equal(first, second);
    assert.equal(f.state().requests.get(f.request).status, 'saving');
    await Promise.resolve();
    assert.equal(f.calls.length, 1);
    const newer = { ...f.request, name: 'Newer snapshot' };
    await assert.rejects(f.context.runCollectionSave(newer, f.session), /already running/);
    assert.equal(f.calls.length, 1);
    resume();
    await first;
    assert.equal(f.state().requests.get(f.request).status, 'saved');
    assert.equal(f.state().active.size, 0);
    await f.context.runCollectionSave(newer, f.session);
    assert.equal(f.calls.length, 2, 'newer snapshot may be saved after the first completes');
});

test('failure propagates and releases operation state for an explicit retry', async () => {
    const f = fixture(), error = new Error('Storage unavailable');
    f.setFailure(error);
    await assert.rejects(f.context.runCollectionSave(f.request, f.session), /Storage unavailable/);
    assert.equal(f.calls.length, 1, 'failed writes are not automatically retried');
    assert.equal(f.state().requests.get(f.request).status, 'failed');
    assert.equal(f.state().requests.get(f.request).error, error);
    assert.equal(f.state().active.size, 0);
    assert.equal(f.refreshed(), 0);
    f.setFailure(null);
    await f.context.runCollectionSave(f.request, f.session);
    assert.equal(f.calls.length, 2);
    assert.equal(f.state().requests.get(f.request).status, 'saved');
    assert.equal(f.state().requests.get(f.request).error, null);
});

test('edits made during a save remain in the active draft', async () => {
    const f = fixture(), resume = f.pause();
    const pending = f.context.runCollectionSave(f.request, f.session);
    await Promise.resolve();
    f.setDraft({ name: 'Later title', items: [{ title: 'Later entry', url: 'https://later.example' }] });
    resume();
    const result = await pending;
    assert.equal(result.name, 'Original collection');
    assert.equal(result.items[0].title, 'Original entry');
    assert.equal(f.context._activeCollection.col.name, 'Later title');
    assert.equal(f.context._activeCollection.col.items[0].title, 'Later entry');
    assert.equal(result.activeUpdated, true);
});

test('completion leaves a different open collection and its view untouched', async () => {
    const f = fixture(), resume = f.pause();
    const pending = f.context.runCollectionSave(f.request, f.session);
    await Promise.resolve();
    const other = { col: { key: 'collection:two', id: 'urn:uuid:two', name: 'Another collection', items: [] } };
    f.context._activeCollection = other;
    resume();
    const result = await pending;
    assert.equal(result.key, 'collection:one');
    assert.equal(result.activeUpdated, false);
    assert.equal(f.context._activeCollection, other);
    assert.equal(f.refreshed(), 0);
});

test('completion while another editor is active preserves the parked collection draft', async () => {
    const f = fixture();
    f.setDraft(null);
    f.context._activeCollection.col.name = 'Parked title';
    f.context._activeCollection.col.items = [{ title: 'Parked entry' }];
    await f.context.runCollectionSave(f.request, f.session);
    assert.equal(f.context._activeCollection.col.name, 'Parked title');
    assert.equal(f.context._activeCollection.col.items[0].title, 'Parked entry');
    // A newly created collection may not yet have a parked draft snapshot.
    delete f.context._activeCollection.col.name;
    delete f.context._activeCollection.col.items;
    await f.context.runCollectionSave(f.request, f.session);
    assert.equal(f.context._activeCollection.col.name, 'Original collection');
    assert.equal(f.context._activeCollection.col.items[0].title, 'Original entry');
});
