const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { fixture: readerFixture } = require('./helpers/reader-fixture.cjs');
const { Element } = require('./helpers/account-fixture.cjs');
const source = name => fs.readFileSync('js/' + name + '.js', 'utf8');
const response = data => ({ ok: true, json: async () => data });
function fixture() {
    const f = readerFixture(), calls = [], rendered = [], writes = [], playlist = new Element('div');
    const CList = f.CList; CList.schemas = {}; CList.defaults = { LOCALRSS: 'https://rss-default' }; CList.accountHooks = {}; CList.ui.view = { feedContainer: new Element('div'), loadingIndicator: { style: {} } };
    CList.storage = { kv: { put: async (...args) => writes.push(args) } };
    CList.accounts = ['a', 'b'].map(key => ({ key, value: JSON.stringify({ type: 'LOCALRSS', permissions: 'r',
        title: 'Account ' + key, instance: key, serviceUrl: 'https://rss-' + key, database: 'db-' + key, hasAudio: false }) }));
    Object.assign(f.ctx, { URLSearchParams, AbortSignal, console: { error() {}, log() {} },
        document: { getElementById: id => id === 'audio-list' ? playlist : null, createElement: tag => new Element(tag) },
        audioFiles: [], generatePlaylistHTML: () => 'playlist', createFeedHeader: title => { const el = new Element('h2'); el.textContent = title; return el; },
        showLoader: () => CList.ui.view.loadingIndicator.style.display = 'block', showStatusMessage: message => f.errors.push(message),
        getEncKey: async () => 'enc-key', encryptWithKey: async (_, value) => 'encrypted:' + value,
    });
    CList.ui.reader.render = async (items, options) => {
        if (!options.isCurrent()) return;
        rendered.push({ items: structuredClone(items), title: options.title, append: options.append, more: options.onLoadMore, normalize: options.normalize });
    };
    CList.ui.renderLoadMoreButton = (_, more) => rendered.push({ retry: more });
    for (const name of ['localrss', 'localrss_requests', 'localrss_view', 'localrss_reader']) vm.runInContext(source(name), f.ctx);
    f.ctx._localrssProbeLocal = async () => false;
    f.ctx.fetch = async (url, options) => {
        calls.push({ url, options });
        if (url.includes('/api/stats')) return response({ has_audio_majority: false });
        if (url.includes('/api/feeds')) return response({ feeds: [{ id: 1, title: 'Feed', url: 'https://feed' }] });
        return response([{ id: 1, title: url.includes('db-b') ? 'B item' : 'A item', link: 'https://entry' }]);
    };
    const action = name => f.events.find(e => e.type === 'begin').run(name);
    const flush = () => new Promise(resolve => setImmediate(resolve));
    return { ...f, calls, rendered, writes, playlist, action, flush };
}

test('LocalRSS request adapter runs without DOM/global account state and preserves endpoint/filter/pagination/auth inputs', async () => {
    const ctx = vm.createContext({ structuredClone, URLSearchParams }); vm.runInContext(source('localrss_requests'), ctx);
    const calls = [], req = { account: { database: 'db with spaces', serviceUrl: 'https://remote', _effectiveServiceUrl: 'https://proxy' }, kind: 'items', filter: 'bookmarked', offset: 50, limit: 50 };
    const page = await ctx.fetchLocalrssPage(req, { fetch: async (url, options) => { calls.push({ url, options }); return response([]); }, headers: { Authorization: 'Bearer selected' } });
    const parsed = new URL(calls[0].url); assert.equal(parsed.origin, 'https://proxy'); assert.equal(parsed.searchParams.get('db'), 'db with spaces');
    assert.equal(parsed.searchParams.get('filter'), 'bookmarked'); assert.equal(parsed.searchParams.get('offset'), '50');
    assert.equal(calls[0].options.headers.Authorization, 'Bearer selected'); assert.equal(page.hasMore, false);
    assert.equal('window' in ctx, false); assert.equal('document' in ctx, false);
});

test('LocalRSS default/read filters and Feeds use captured account and return awaited loading promises', async () => {
    const f = fixture(); await f.ctx.switchReaderAccount('a');
    await f.action('All'); assert.ok(f.calls.some(c => c.url.includes('filter=all')));
    await f.action('Bookmarked'); assert.ok(f.calls.some(c => c.url.includes('filter=bookmarked')));
    await f.action('Feeds'); assert.match(f.rendered.at(-1).title, /Account a - Feeds/);
    await f.action('Refresh'); assert.match(f.calls.filter(c => !c.url.includes('/api/stats')).at(-1).url, /api\/feeds/);
    assert.equal(f.CList.state.reader.feedName, 'Feeds'); assert.equal(f.CList.state.localrssReading.kind, 'feeds');
});

test('late endpoint resolution never sends the obsolete account load or changes the current account/session cache', async () => {
    const f = fixture(); const probes = [];
    f.ctx._localrssProbeLocal = () => new Promise(resolve => probes.push(resolve));
    const a = f.ctx.switchReaderAccount('a'), b = f.ctx.switchReaderAccount('b');
    probes[1](false); await b; probes[0](false); await a;
    assert.equal(f.calls.filter(c => c.url.includes('/api/items')).length, 1);
    assert.ok(f.calls[0].url.startsWith('https://rss-b/')); assert.equal(f.CList.state.reader.accountKey, 'b');
    assert.equal(f.rendered.at(-1).title, 'Account b');
});

test('late item success and errors cannot render audio, hide a newer loader or change its pagination/filter state', async () => {
    const f = fixture(); const pending = [];
    f.ctx.fetch = (url, options) => url.includes('/api/stats') ? Promise.resolve(response({ has_audio_majority: false }))
        : new Promise((resolve, reject) => pending.push({ url, options, resolve, reject }));
    const a = f.ctx.switchReaderAccount('a'); await f.flush();
    const b = f.ctx.switchReaderAccount('b'); await f.flush();
    pending[0].reject(Error('obsolete error')); await a;
    assert.equal(f.CList.ui.view.loadingIndicator.style.display, 'block'); assert.deepEqual(f.errors, []);
    pending[1].resolve(response([{ id: 2, title: 'B' }])); await b;
    assert.equal(f.rendered.length, 1); assert.equal(f.rendered[0].title, 'Account b');
    assert.equal(f.CList.state.localrssReading.offset, 0); assert.equal(f.CList.ui.view.loadingIndicator.style.display, 'none');
});

test('pagination captures its offset, ignores double clicks and old callbacks, and advances only after success', async () => {
    const f = fixture();
    f.ctx.fetch = async (url, options) => { f.calls.push({ url, options }); return response(url.includes('/api/stats') ? { has_audio_majority: false } : Array.from({ length: 50 }, (_, id) => ({ id }))); };
    await f.ctx.switchReaderAccount('a'); const more = f.rendered[0].more;
    let finish; f.ctx.fetch = (url, options) => { f.calls.push({ url, options }); return new Promise(resolve => finish = resolve); };
    const append = more(); await f.flush(); await more();
    assert.equal(f.CList.state.localrssReading.offset, 0); assert.equal(f.calls.filter(c => c.url.includes('offset=50')).length, 1);
    finish(response([{ id: 51 }])); await append;
    assert.equal(f.CList.state.localrssReading.offset, 50); assert.equal(f.rendered.at(-1).append, true);
    f.ctx.fetch = async () => response([]); await f.action('Bookmarked'); await more();
    assert.equal(f.CList.state.localrssReading.filter, 'bookmarked'); assert.equal(f.CList.state.localrssReading.offset, 0);
});

test('failed pagination keeps its offset and offers an explicit guarded retry for the same page', async () => {
    const f = fixture(); f.ctx.fetch = async url => response(url.includes('/api/stats') ? { has_audio_majority: false } : Array.from({ length: 50 }, (_, id) => ({ id })));
    await f.ctx.switchReaderAccount('a'); const more = f.rendered[0].more;
    f.ctx.fetch = async () => { throw Error('page offline'); }; await more();
    assert.equal(f.CList.state.localrssReading.offset, 0); assert.equal(f.errors.at(-1), 'page offline');
    const retry = f.rendered.find(r => r.retry).retry; f.ctx.fetch = async () => response([{ id: 51 }]); await retry();
    assert.equal(f.CList.state.localrssReading.offset, 50); assert.equal(f.CList.state.reader.status, 'ready');
});

test('LocalRSS headers and account remain captured when logout/server changes occur during a request', async () => {
    const f = fixture(); let finish;
    f.ctx.fetch = (url, options) => { f.calls.push({ url, options }); return new Promise(resolve => finish = resolve); };
    const pending = f.ctx.switchReaderAccount('a'); await f.flush();
    f.setToken('new token'); f.CList.config.flaskSiteUrl = 'https://other-store'; finish(response([{ id: 1 }])); await pending;
    assert.equal(f.calls[0].options.headers.Authorization, 'Bearer private-token');
    assert.equal(f.calls[0].options.headers['X-Kvstore-Url'], 'https://kv'); assert.equal(f.rendered.length, 0);
});

test('hasAudio sync targets the account key and reconciles only metadata without invalidating reader ownership', async () => {
    const f = fixture(); f.ctx.fetch = async url => response(url.includes('/api/stats') ? { has_audio_majority: true } : [{ id: 1 }]);
    await f.ctx.switchReaderAccount('a'); await f.flush();
    assert.equal(f.writes.length, 1); assert.equal(f.writes[0][0], 'a');
    const account = JSON.parse(f.writes[0][1].slice('encrypted:'.length)); assert.equal(account.hasAudio, true);
    assert.equal(account._effectiveServiceUrl, undefined); assert.equal(f.CList.state.reader.status, 'ready');
    assert.equal(JSON.parse(f.CList.accounts[0].value).hasAudio, true);
});

test('LocalRSS adapter rejects malformed/API responses and propagates abort signal without UI', async () => {
    const ctx = vm.createContext({ structuredClone, URLSearchParams }); vm.runInContext(source('localrss_requests'), ctx);
    const req = { account: { serviceUrl: 'https://rss', database: 'db' }, kind: 'feeds', filter: '', offset: 0, limit: 50 };
    await assert.rejects(ctx.fetchLocalrssPage(req, { fetch: async () => response({ feeds: null }), headers: {} }), /Unexpected response/);
    await assert.rejects(ctx.fetchLocalrssPage(req, { fetch: async () => ({ ok: false, status: 403, json: async () => ({ error: 'denied' }) }), headers: {} }), /denied/);
    const abort = new AbortController();
    const stats = await ctx.fetchLocalrssPage({ ...req, kind: 'stats' }, { signal: abort.signal, headers: {},
        fetch: async (_, options) => { assert.equal(options.signal, abort.signal); return response({ has_audio_majority: 1 }); } });
    assert.equal(stats.hasAudio, true);
});
test('local-first resolution and explicit reconnect retain the selected database and configured service URL', async () => {
    const f = fixture(); await f.ctx.switchReaderAccount('a');
    f.ctx._localrssProbeLocal = async () => true; await f.ctx._localrssReconnect();
    const items = f.calls.filter(c => c.url.includes('/api/items'));
    assert.ok(items.at(-1).url.startsWith('http://localhost:8787/')); assert.match(items.at(-1).url, /db=db-a/);
    assert.equal(JSON.parse(f.CList.accounts[0].value).serviceUrl, 'https://rss-a');
});

test('current request failures are reported once, restore loader state and allow Refresh', async () => {
    const f = fixture(); await f.ctx.switchReaderAccount('a');
    f.ctx.fetch = async () => ({ ok: false, status: 403, json: async () => ({ error: 'denied' }) });
    await f.action('All'); assert.deepEqual(f.errors, ['denied']); assert.equal(f.CList.state.reader.status, 'failed');
    assert.equal(f.CList.ui.view.loadingIndicator.style.display, 'none');
    f.ctx.fetch = async url => response(url.includes('/api/stats') ? { has_audio_majority: false } : []);
    await f.action('Refresh'); assert.equal(f.CList.state.reader.status, 'ready');
});

test('late audio-majority metadata cannot update the account after switching databases', async () => {
    const f = fixture(); let statsA;
    f.ctx.fetch = async url => url.includes('/api/stats') && url.includes('db-a')
        ? new Promise(resolve => statsA = resolve)
        : response(url.includes('/api/stats') ? { has_audio_majority: false } : [{ id: 1 }]);
    await f.ctx.switchReaderAccount('a'); await f.ctx.switchReaderAccount('b');
    statsA(response({ has_audio_majority: true })); await f.flush();
    assert.equal(f.writes.length, 0); assert.equal(f.CList.state.reader.accountKey, 'b');
});

test('LocalRSS new scripts remain below 500 lines and load after their registered service and reader dependencies', () => {
    const html = fs.readFileSync('index.html', 'utf8');
    for (const name of ['localrss_requests', 'localrss_view', 'localrss_reader']) {
        new vm.Script(source(name)); assert.ok(source(name).split('\n').length < 500);
        assert.ok(html.indexOf('js/' + name + '.js') > html.indexOf('js/localrss.js'));
        assert.ok(html.indexOf('js/' + name + '.js') < html.indexOf('js/interface.js'));
    }
});


test('opening Options preserves current pagination, and its Show filter remains selected on Refresh', async () => {
    const f = fixture(); f.ctx.localrssOptionsOverlay = () => {};
    f.ctx.fetch = async url => response(url.includes('/api/stats') ? { has_audio_majority: false } : Array.from({ length: 50 }, (_, id) => ({ id })));
    await f.ctx.switchReaderAccount('a'); const more = f.rendered[0].more;
    await f.action('Options'); assert.equal(f.CList.state.reader.feedName, 'Unread');
    await more(); assert.equal(f.CList.state.localrssReading.offset, 50);
    await f.ctx.localrssLoad(false, null, { filter: 'read', kind: 'items' });
    assert.equal(f.CList.state.reader.feedName, 'Read'); assert.equal(f.CList.state.localrssReading.filter, 'read');
    await f.action('Refresh'); assert.equal(f.CList.state.localrssReading.filter, 'read');
});
