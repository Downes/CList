const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function setup() {
    const records = new Map();
    const listings = [];
    let discoveryFails = false;
    let requestedUrl;
    const element = () => ({ appendChild() {}, set innerHTML(value) {} });
    const context = {
        window: { CList: {
            defaults: { LOCALRSS: 'https://rss.example' },
            config: { flaskSiteUrl: 'local' },
            ui: { view: { feedContainer: element() } },
            storage: { kv: {
                list: async () => [...records].map(([key, value]) => ({ key, value })),
                add: async (key, value) => {
                    assert.equal(records.has(key), false, 'must not overwrite accounts');
                    records.set(key, value);
                },
            } },
        } },
        document: { createElement: element }, console,
        getEncKey: async () => 'key',
        encryptWithKey: async (key, value) => `encrypted:${value}`,
        escapeHtml: value => value,
        SafeHtml: class {},
        createFeedHeader: element,
        makeListing: item => { listings.push(item); return element(); },
        showServiceError: () => assert.fail('Unexpected reader error'),
        fetch: async url => {
            requestedUrl = url;
            if (url.endsWith('/api/collections')) {
                if (discoveryFails) throw new Error('Offline');
                return { ok: true, json: async () => [
                    { slug: 'news', title: 'News' }, { slug: 'sessions', title: 'Sessions' },
                ] };
            }
            return { ok: true, json: async () => [{ id: 1, title: 'An item', link: 'https://example.org' }] };
        },
    };
    vm.createContext(context);
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/public-feeds.js'), 'utf8'), context);
    return { context, records, listings, failDiscovery: () => { discoveryFails = true; }, url: () => requestedUrl };
}

test('public subscriptions are encrypted, editable reader accounts without duplicates', async () => {
    const { context, records } = setup();
    await context.seedPublicFeedAccounts();
    assert.equal(records.size, 3);
    const accounts = [...records.values()].map(value => {
        assert.ok(value.startsWith('encrypted:'));
        return JSON.parse(value.slice('encrypted:'.length));
    });
    assert.deepEqual(accounts.map(account => account.title), ['CList Changelog', 'News', 'Sessions']);
    assert.ok(accounts.every(account => account.type === 'PublicFeed' && account.permissions === 'r'));
    assert.ok(context.window.CList.schemas.PublicFeed.fields.some(field => field.key === 'title' && field.editable));
    await context.seedPublicFeedAccounts();
    assert.equal(records.size, 3);
});

test('saved subscription opens its own service and collection', async () => {
    const { context, listings, url } = setup();
    await context.window.CList.readers.PublicFeed.initialize({
        title: 'Renamed News', serviceUrl: 'https://another.example/', collectionSlug: 'news',
    });
    assert.equal(url(), 'https://another.example/api/collections/news/items?limit=200');
    assert.equal(listings[0].title, 'An item');
});

test('discovery failure preserves already saved changelog and reports failure to caller', async () => {
    const { context, records, failDiscovery } = setup();
    failDiscovery();
    await assert.rejects(context.seedPublicFeedAccounts(), /Offline/);
    assert.equal(records.size, 1);
});

test('subscription seeding is guarded by registration, before account refresh', () => {
    const source = fs.readFileSync(path.join(__dirname, '../js/kvstore.js'), 'utf8');
    assert.match(source, /if \(mode === 'register'\) \{\s*try \{\s*await seedPublicFeedAccounts\(\);/);
    const start = source.indexOf('await seedPublicFeedAccounts();');
    assert.ok(source.indexOf('window.CList.accounts = await getAccounts', start) > start);
});
