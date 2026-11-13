const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function model() {
    const source = fs.readFileSync(path.join(__dirname, '../js/collections.js'), 'utf8');
    const calls = [];
    // No document, window, editor controls, modal, or storage is available.
    const context = vm.createContext({
        structuredClone,
        _resolveCollectionIdentity: (key, id) => {
            calls.push({ key, id });
            return { key: key || 'collection:new', id: id || 'urn:uuid:new' };
        },
    });
    vm.runInContext(source.slice(source.indexOf('function captureCollectionSaveRequest('), source.indexOf('window.playCollectionSave =')), context);
    return { capture: context.captureCollectionSaveRequest, calls };
}

test('collection save captures nested draft data, publication metadata, identity and feed binding without UI', () => {
    const { capture, calls } = model();
    const fields = { name: '  My feeds  ', formatId: 'opml' };
    const items = [{ title: 'Feed', url: 'https://example.org', feed: 'https://example.org/rss', via: { title: 'Source' } }];
    const collection = {
        key: 'collection:existing', id: 'urn:uuid:existing',
        publishedUrls: [{ url: 'https://published.example', serviceId: 'old' }],
        feedAccount: { key: 'feed-account', type: 'PublicFeed', database: 'personal-db' },
    };
    const request = capture(fields, items, collection);
    fields.name = 'Later title';
    fields.formatId = 'json';
    items[0].title = 'Later feed';
    items[0].via.title = 'Later source';
    items.push({ title: 'Another feed' });
    collection.publishedUrls[0].url = 'https://later.example';
    collection.feedAccount.database = 'another-db';
    assert.equal(request.name, 'My feeds');
    assert.equal(request.formatId, 'opml');
    assert.equal(request.items.length, 1);
    assert.equal(request.items[0].title, 'Feed');
    assert.equal(request.items[0].via.title, 'Source');
    assert.equal(request.publishedUrls[0].url, 'https://published.example');
    assert.equal(request.feedAccount.database, 'personal-db');
    assert.equal(request.identity.key, 'collection:existing');
    assert.equal(request.identity.id, 'urn:uuid:existing');
    assert.equal(calls.length, 1);
});

test('new empty collections get an identity and default metadata without requiring a feed account', () => {
    const { capture, calls } = model();
    const request = capture({ name: 'Empty collection', formatId: 'json' }, []);
    assert.equal(request.identity.key, 'collection:new');
    assert.equal(request.items.length, 0);
    assert.equal(request.publishedUrls.length, 0);
    assert.equal(request.feedAccount, null);
    assert.equal(calls.length, 1);
});

test('blank titles fail before resolving identity', () => {
    const { capture, calls } = model();
    assert.throws(() => capture({ name: '  ', formatId: 'rss' }, []), /Please enter a collection title/);
    assert.equal(calls.length, 0);
});
