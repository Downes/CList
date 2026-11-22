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
    for (const name of ['localrss', 'localrss_requests', 'localrss_view', 'localrss_row_view', 'localrss_reader', 'localrss_actions', 'localrss_feeds_view', 'localrss_feeds', 'localrss_opml_requests', 'localrss_opml_view', 'localrss_opml']) vm.runInContext(source(name), f.ctx);
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

test('pagination captures exclude_ids, ignores double clicks and old callbacks, and advances only after success', async () => {
    const f = fixture();
    const firstPageIds = Array.from({ length: 50 }, (_, id) => id);
    f.ctx.fetch = async (url, options) => { f.calls.push({ url, options }); return response(url.includes('/api/stats') ? { has_audio_majority: false } : firstPageIds.map(id => ({ id }))); };
    await f.ctx.switchReaderAccount('a'); const more = f.rendered[0].more;
    let finish; f.ctx.fetch = (url, options) => { f.calls.push({ url, options }); return new Promise(resolve => finish = resolve); };
    const append = more(); await f.flush(); await more();
    const excludeCalls = f.calls.filter(c => c.url.includes('exclude_ids'));
    assert.equal(excludeCalls.length, 1);
    const qs = new URL(excludeCalls[0].url).searchParams;
    assert.equal(qs.get('offset'), '0'); assert.deepEqual(qs.get('exclude_ids').split(',').map(Number), firstPageIds);
    finish(response([{ id: 51 }])); await append;
    assert.deepEqual(structuredClone(f.CList.state.localrssReading.excludeIds), [...firstPageIds, 51]); assert.equal(f.rendered.at(-1).append, true);
    f.ctx.fetch = async () => response([]); await f.action('Bookmarked'); await more();
    assert.equal(f.CList.state.localrssReading.filter, 'bookmarked'); assert.deepEqual(structuredClone(f.CList.state.localrssReading.excludeIds), []);
});

test('failed pagination keeps its exclude_ids and offers an explicit guarded retry for the same page', async () => {
    const f = fixture(); const firstPageIds = Array.from({ length: 50 }, (_, id) => id);
    f.ctx.fetch = async url => response(url.includes('/api/stats') ? { has_audio_majority: false } : firstPageIds.map(id => ({ id })));
    await f.ctx.switchReaderAccount('a'); const more = f.rendered[0].more;
    f.ctx.fetch = async () => { throw Error('page offline'); }; await more();
    assert.deepEqual(structuredClone(f.CList.state.localrssReading.excludeIds), firstPageIds); assert.equal(f.errors.at(-1), 'page offline');
    const retry = f.rendered.find(r => r.retry).retry; f.ctx.fetch = async () => response([{ id: 51 }]); await retry();
    assert.deepEqual(structuredClone(f.CList.state.localrssReading.excludeIds), [...firstPageIds, 51]); assert.equal(f.CList.state.reader.status, 'ready');
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
    for (const name of ['localrss_requests', 'localrss_view', 'localrss_row_view', 'localrss_reader', 'localrss_actions', 'localrss_options_view', 'localrss_options', 'localrss_opml_requests', 'localrss_opml_view', 'localrss_opml']) {
        new vm.Script(source(name)); assert.ok(source(name).split('\n').length < 500);
        assert.ok(html.indexOf('js/' + name + '.js') > html.indexOf('js/localrss.js'));
        assert.ok(html.indexOf('js/' + name + '.js') < html.indexOf('js/interface.js'));
    }
});


test('opening Options preserves current pagination, and its Show filter remains selected on Refresh', async () => {
    const f = fixture(); f.ctx.localrssOptionsOverlay = () => {};
    const allIds = Array.from({ length: 200 }, (_, id) => id);
    f.ctx.fetch = async url => {
        if (url.includes('/api/stats')) return response({ has_audio_majority: false });
        const excluded = new Set((new URL(url).searchParams.get('exclude_ids') || '').split(',').filter(Boolean).map(Number));
        return response(allIds.filter(id => !excluded.has(id)).slice(0, 50).map(id => ({ id })));
    };
    await f.ctx.switchReaderAccount('a'); const more = f.rendered[0].more;
    await f.action('Options'); assert.equal(f.CList.state.reader.feedName, 'Unread');
    await more(); assert.deepEqual(structuredClone(f.CList.state.localrssReading.excludeIds), allIds.slice(0, 100));
    await f.ctx.localrssLoad(false, null, { filter: 'read', kind: 'items' });
    assert.equal(f.CList.state.reader.feedName, 'Read'); assert.equal(f.CList.state.localrssReading.filter, 'read');
    await f.action('Refresh'); assert.equal(f.CList.state.localrssReading.filter, 'read');
});

function bindAction(f, entryId = 7) {
    return vm.runInContext(`bindLocalrssActions(${entryId}, {account: structuredClone(localrssCurrentAccount), filter: localrssFilter}, _readerContext)`, f.ctx);
}
function actionButton() {
    const icon = { textContent: 'visibility' }, row = { removed: false, remove() { this.removed = true; } };
    const classes = new Set();
    return { classList: { toggle(name, active) { if (active) classes.add(name); else classes.delete(name); }, contains: name => classes.has(name) }, icon, row, disabled: false, title: 'Mark read', querySelector: () => icon, closest: () => row };
}
test('row toggles capture endpoint/database/auth, suppress double clicks and keep read rows visible', async () => {
    const f = fixture(); await f.ctx.switchReaderAccount('a'); const id = bindAction(f), button = actionButton();
    let finish; const calls = []; f.ctx.fetch = async (url, options) => { calls.push({url, options}); return new Promise(resolve => finish = resolve); };
    const pending = f.ctx.localrssToggleRead(id, button); await f.ctx.localrssToggleRead(id, button);
    assert.equal(calls.length, 1); assert.equal(button.disabled, true); assert.equal(button.row.removed, false);
    assert.match(calls[0].url, /^https:\/\/rss-a\/api\/toggle_read$/);
    assert.deepEqual(JSON.parse(calls[0].options.body), {db: 'db-a', id: 7});
    assert.equal(calls[0].options.headers.Authorization, 'Bearer private-token');
    finish(response({read: 1})); await pending;
    assert.equal(button.icon.textContent, 'visibility_off'); assert.equal(button.row.removed, false); assert.equal(button.disabled, false);
    f.ctx.fetch = async () => response({read:false});
    await f.ctx.localrssToggleRead(id, button);
    assert.equal(button.icon.textContent, 'visibility'); assert.equal(button.title, 'Mark read'); assert.equal(button.row.removed, false);
    f.ctx.fetch = async () => response([]); await f.action('Unread');
    assert.equal(f.CList.state.localrssReading.filter, 'unread');
    f.ctx.fetch = () => { throw Error('Reloaded rows must not send old actions'); };
    await f.ctx.localrssToggleRead(id, button);
});
test('account/session changes suppress late toggle feedback and prevent old rows sending writes', async () => {
    for (const change of ['account', 'session']) {
        const f = fixture(); await f.ctx.switchReaderAccount('a'); const id = bindAction(f), button = actionButton();
        let fail; f.ctx.fetch = () => new Promise((_, reject) => fail = reject);
        const pending = f.ctx.localrssToggleRead(id, button);
        if (change === 'account') { f.ctx.fetch = async () => response([]); await f.ctx.switchReaderAccount('b'); }
        else f.setToken('new-token');
        fail(Error('late failure')); await pending;
        assert.deepEqual(f.errors, []); assert.equal(button.row.removed, false);
        f.ctx.fetch = () => { throw Error('Old button must not send'); }; await f.ctx.localrssToggleRead(id, button);
    }
});
test('pagination preserves earlier row actions while replacement filters invalidate them', async () => {
    const f = fixture(); await f.ctx.switchReaderAccount('a'); const id = bindAction(f);
    await vm.runInContext('_readerContext.next(current => loadLocalrssView(current, {append:true, offset:50}))', f.ctx);
    let count = 0; f.ctx.fetch = async () => { count++; return response({bookmarked: true}); };
    const button = actionButton(); await f.ctx.localrssToggleBookmark(id, button);
    assert.equal(count, 1); assert.equal(button.title, 'Remove bookmark'); assert.equal(button.icon.textContent, 'star'); assert.equal(button.classList.contains('action-active'), true);
    f.ctx.fetch = async () => response([]); await f.action('All');
    f.ctx.fetch = () => { throw Error('Replaced row must not send'); }; await f.ctx.localrssToggleBookmark(id, button);
});
test('toggle failures restore controls, show one error and never retry uncertain writes', async () => {
    const f = fixture(); await f.ctx.switchReaderAccount('a'); const id = bindAction(f), button = actionButton();
    f.ctx.showErrorModal = message => f.errors.push(message); let count = 0;
    f.ctx.fetch = async () => { count++; throw Error('lost response'); };
    await f.ctx.localrssToggleRead(id, button);
    assert.equal(count, 1); assert.equal(f.errors.length, 1); assert.equal(button.disabled, false); assert.equal(button.row.removed, false);
});
test('toggle transport has no UI dependency and rejects API or malformed successful responses', async () => {
    const ctx = vm.createContext({structuredClone, URLSearchParams}); vm.runInContext(source('localrss_requests'), ctx);
    const request = {account: {serviceUrl:'https://rss',database:'db'}, entryId:9, action:'bookmark'};
    for (const result of [{ok:false,error:'denied'}, {}, {bookmarked:'yes'}]) {
        await assert.rejects(ctx.toggleLocalrssEntry(request, {fetch: async () => response(result), headers:{}}));
    }
    assert.equal('window' in ctx, false);
});

test('bookmark removal updates its icon and removes only Bookmarked-filter rows', async () => {
    const f = fixture(); await f.ctx.switchReaderAccount('a'); await f.action('Bookmarked');
    const id = bindAction(f), button = actionButton(); f.ctx.fetch = async () => response({bookmarked: false});
    await f.ctx.localrssToggleBookmark(id, button);
    assert.equal(button.icon.textContent, 'star'); assert.equal(button.classList.contains('action-active'), false); assert.equal(button.title, 'Bookmark'); assert.equal(button.row.removed, true);
});


function optionsFixture() {
    const f = fixture(), targets = [], stats = [], failures = [], confirmations = [], messages = [];
    vm.runInContext(source('localrss_options'), f.ctx);
    Object.assign(f.ctx, {
        renderLocalrssOptions: target => { target.root = { parentNode: {} }; targets.push(target); },
        localrssOptionsStats: (target, data) => stats.push({ target, data }),
        localrssOptionsError: (target, action, error) => failures.push({ target, action, error }),
        _localrssConfirm: (_, title, confirm) => confirmations.push(confirm),
        showStatusMessage: text => messages.push(text),
    });
    return { ...f, targets, stats, failures, confirmations, messages };
}

test('Options statistics capture database/endpoint/headers and stale panel or account results are ignored', async () => {
    for (const invalidate of ['replace', 'close', 'account', 'session']) {
        const f = optionsFixture(); await f.ctx.switchReaderAccount('a'); await f.flush();
        const pending = [], calls = [];
        f.ctx.fetch = (url, options) => { calls.push({url, options}); return new Promise((resolve, reject) => pending.push({resolve, reject})); };
        const first = f.ctx.localrssOptionsOverlay(), target = f.targets[0];
        assert.match(calls[0].url, /^https:\/\/rss-a\/api\/stats\?db=db-a$/);
        assert.equal(calls[0].options.headers.Authorization, 'Bearer private-token');
        let second;
        if (invalidate === 'replace') second = f.ctx.localrssOptionsOverlay();
        if (invalidate === 'close') target.close();
        if (invalidate === 'account') { f.ctx.fetch = async () => response([]); await f.ctx.switchReaderAccount('b'); }
        if (invalidate === 'session') f.setToken('changed');
        pending[0].resolve(response({ feeds: 99 })); await first;
        assert.equal(f.stats.length, 0); assert.equal(f.failures.length, 0);
        if (second) { pending[1].resolve(response({ feeds: 2 })); await second; assert.equal(f.stats[0].data.feeds, 2); }
    }
});

test('Options statistics sequence suppresses an older request within the same panel', async () => {
    const f = optionsFixture(); await f.ctx.switchReaderAccount('a'); await f.flush();
    const pending = []; f.ctx.fetch = () => new Promise(resolve => pending.push(resolve));
    const first = f.ctx.localrssOptionsOverlay(), second = f.ctx._localrssRefreshStats();
    pending[1](response({feeds: 2})); await second; pending[0](response({feeds: 1})); await first;
    assert.deepEqual(f.stats.map(row => row.data.feeds), [2]);
});

test('Mark all confirmation uses captured database/auth, suppresses duplicate writes and ignores obsolete confirmation', async () => {
    const f = optionsFixture(); await f.ctx.switchReaderAccount('a'); await f.flush(); await f.ctx.localrssOptionsOverlay();
    const target = f.targets[0], button = {disabled:false}; target.confirmMarkAll(button);
    const calls = []; let finish;
    f.ctx.fetch = (url, options) => { calls.push({url, options}); return new Promise(resolve => finish = resolve); };
    const write = f.confirmations[0](); await f.confirmations[0]();
    assert.equal(calls.length, 1); assert.equal(button.disabled, true);
    assert.equal(calls[0].url, 'https://rss-a/api/mark_all_read');
    assert.deepEqual(JSON.parse(calls[0].options.body), {db:'db-a'});
    assert.equal(calls[0].options.headers.Authorization, 'Bearer private-token');
    target.close(); finish(response({ok:true})); await write;
    assert.equal(button.disabled, false); assert.deepEqual(f.messages, []);
    await f.confirmations[0](); assert.equal(calls.length, 1);
});

test('accepted Mark all write reports success separately from statistics failure and never repeats write', async () => {
    const f = optionsFixture(); await f.ctx.switchReaderAccount('a'); await f.flush(); await f.ctx.localrssOptionsOverlay();
    const calls = []; f.ctx.fetch = async (url, options) => {
        calls.push({url, options});
        if (options.method === 'POST') return response({ok:true});
        if (url.includes('/api/stats')) throw Error('statistics offline');
        return response([]);
    };
    const button = {disabled:false}; await f.ctx.markAllLocalrssRead(f.targets[0], button);
    assert.equal(f.messages[0], 'All entries marked read.');
    assert.equal(f.messages.filter(message => message === 'All entries marked read.').length, 1);
    assert.equal(f.failures[0].action, 'statistics');
    assert.equal(calls.filter(call => call.options.method === 'POST').length, 1);
    assert.equal(button.disabled, false); assert.equal(f.CList.state.reader.feedName, 'Unread');
});

test('Mark all uncertain write restores control, reports error and never retries or reloads', async () => {
    const f = optionsFixture(); await f.ctx.switchReaderAccount('a'); await f.flush(); await f.ctx.localrssOptionsOverlay();
    let calls = 0; f.ctx.fetch = async () => { calls++; throw Error('response lost'); };
    const button = {disabled:false}; await f.ctx.markAllLocalrssRead(f.targets[0], button);
    assert.equal(calls, 1); assert.equal(button.disabled, false); assert.deepEqual(f.messages, []);
    assert.equal(f.failures[0].action, 'mark all as read');
});

test('Options database transport is DOM-free and rejects HTTP/API/malformed responses', async () => {
    const ctx = vm.createContext({structuredClone, URLSearchParams}); vm.runInContext(source('localrss_requests'), ctx);
    const account = {serviceUrl:'https://remote', _effectiveServiceUrl:'https://proxy', database:'db spaces'};
    for (const operation of [ctx.fetchLocalrssStatistics, ctx.markLocalrssDatabaseRead]) {
        for (const data of [null, [], {ok:false,error:'denied'}]) {
            await assert.rejects(operation(account, {fetch: async () => response(data), headers:{}}));
        }
        await assert.rejects(operation(account, {fetch: async () => ({ok:false,status:403,json:async()=>({error:'forbidden'})}),headers:{}}), /forbidden/);
    }
    assert.equal('window' in ctx, false); assert.equal('document' in ctx, false);
});


test('Options view builds standard controls and binds Show, reconnect, close and Mark all to its captured target', () => {
    const f = fixture(), body = new Element('div'), actions = [];
    f.ctx.document.getElementById = id => id === 'left-pane-body' ? body : body.querySelector('#' + id);
    Object.assign(f.ctx, {openLeftPane() {}, showLeftOverlaySection() {},
        _localrssDatabaseSection() {}, _localrssFeedsSection() {}, _localrssImportExportSection() {}});
    vm.runInContext(source('localrss_options_view'), f.ctx);
    const target = {account:{serviceUrl:'https://rss'}, accountKey:'a', filter:'read',
        close: () => actions.push('close'), reconnect: () => actions.push('reconnect'),
        show: value => actions.push(value), confirmMarkAll: button => actions.push(button.textContent)};
    f.ctx.renderLocalrssOptions(target);
    const show = body.querySelector('#localrss-show-select');
    assert.equal(show.children.find(child => child.selected).value, 'read');
    show.value = 'bookmarked'; show.onchange();
    const buttons = body.querySelectorAll('button');
    buttons.find(button => button.textContent === 'Reconnect').click();
    buttons.find(button => button.textContent === 'Mark all as read').click();
    const root = body.children[0]; target.root = root;
    f.ctx.localrssOptionsStats(target, {feeds:3,unread:2,bookmarked:1,retention_days:30});
    assert.match(body.querySelector('#localrss-stats-pill').textContent, /feeds=3  unread=2  bookmarked=1  retention=30d/);
    buttons.find(button => button.title === 'Close').click();
    assert.deepEqual(actions, ['bookmarked','reconnect','Mark all as read','close']);
    assert.equal(body.children.length, 0);
});


test('failed database initialization cannot open Options against the previous account endpoint', async () => {
    const f = optionsFixture(); await f.ctx.switchReaderAccount('a'); await f.flush(); await f.ctx.localrssOptionsOverlay();
    const first = f.targets[0];
    f.ctx._localrssResolveServiceUrl = async () => { throw Error('endpoint resolution failed'); };
    await first.switchAccount('b');
    assert.equal(f.CList.state.reader.accountKey, 'b'); assert.equal(f.CList.state.reader.status, 'failed');
    assert.equal(f.targets.length, 1);
    await f.ctx.localrssOptionsOverlay(); assert.equal(f.targets.length, 1);
    f.ctx.fetch = () => { throw Error('obsolete panel must not write'); };
    await f.ctx.markAllLocalrssRead(first, {disabled:false});
});

test('failed reconnect does not rebuild Options with an unresolved endpoint', async () => {
    const f = optionsFixture(); await f.ctx.switchReaderAccount('a'); await f.flush(); await f.ctx.localrssOptionsOverlay();
    f.ctx._localrssResolveServiceUrl = async () => { throw Error('reconnect unavailable'); };
    await f.targets[0].reconnect();
    assert.equal(f.CList.state.reader.status, 'failed'); assert.equal(f.targets.length, 1);
});


function searchPanel(f, query = 'needle') {
    const statuses = [], target = { query, alive: true, current() { return this.alive; } };
    f.ctx.localrssSearchInput = target => target.query;
    f.ctx.localrssSearchStatus = (target, text) => statuses.push({target, text});
    return { target, statuses };
}

test('search and feed-post transport encode captured selections without queue filters or pagination', async () => {
    const ctx = vm.createContext({structuredClone, URLSearchParams}); vm.runInContext(source('localrss_requests'), ctx);
    for (const selection of [{mode:'search',query:'a & b/ü'}, {mode:'feed',feedId:17,title:'Title'}]) {
        let captured;
        const page = await ctx.fetchLocalrssPage({account:{serviceUrl:'https://remote',_effectiveServiceUrl:'https://proxy',database:'db spaces'},
            kind:'items',filter:'bookmarked',offset:0,limit:1600,selection}, {
            fetch:async (url, options) => { captured={url,options}; return response(Array.from({length:1600},(_,id)=>({id}))); },
            headers:{Authorization:'Bearer captured'},signal:'signal',
        });
        const parsed = new URL(captured.url);
        assert.equal(parsed.origin,'https://proxy'); assert.equal(parsed.searchParams.get('db'),'db spaces');
        assert.equal(parsed.searchParams.has('filter'),false); assert.equal(parsed.searchParams.get('limit'),'1600');
        assert.equal(parsed.searchParams.get(selection.mode === 'search' ? 'q' : 'feed_id'), selection.mode === 'search' ? selection.query : '17');
        assert.equal(captured.options.headers.Authorization,'Bearer captured'); assert.equal(captured.options.signal,'signal');
        assert.equal(page.hasMore,false);
    }
});

test('search captures query, resets list actions and Refresh retains its selection until a normal filter is chosen', async () => {
    const f=fixture(); await f.ctx.switchReaderAccount('a'); await f.action('Bookmarked');
    const {target,statuses}=searchPanel(f,'original query');
    await f.ctx._localrssSearchPosts(target); target.query='edited later';
    assert.equal(f.rendered.at(-1).title,'Search: "original query"'); assert.equal(f.rendered.at(-1).more,null);
    assert.equal(f.CList.state.localrssReading.filter,'all');
    assert.equal(f.CList.state.reader.feedName,'Search'); assert.equal(statuses.at(-1).text,'1 result.');
    await f.action('Refresh');
    assert.equal(new URL(f.calls.filter(c=>c.url.includes('/api/items')).at(-1).url).searchParams.get('q'),'original query');
    await f.action('Unread'); assert.equal(f.CList.state.localrssReading.selection,undefined);
    assert.equal(f.CList.state.localrssReading.filter,'unread');
});

test('failed search retains its query for an explicit Refresh retry and reports one current error', async () => {
    const f=fixture(); await f.ctx.switchReaderAccount('a'); const {target,statuses}=searchPanel(f);
    f.ctx.fetch=async()=>{throw Error('search unavailable');}; await f.ctx._localrssSearchPosts(target);
    assert.equal(f.errors.at(-1),'search unavailable'); assert.equal(f.CList.state.reader.status,'failed');
    assert.match(statuses.at(-1).text,/Search failed/); assert.equal(f.CList.state.localrssReading.selection.query,'needle');
    const requests=[]; f.ctx.fetch=async(url)=>{requests.push(url); return response(url.includes('/api/stats')?{has_audio_majority:false}:[{id:3}]);};
    await f.action('Refresh'); assert.equal(new URL(requests[0]).searchParams.get('q'),'needle');
    assert.equal(f.CList.state.reader.status,'ready');
});

test('overlapping searches suppress obsolete results, errors, status and loader cleanup', async () => {
    for (const outcome of ['resolve','reject']) {
        const f=fixture(); await f.ctx.switchReaderAccount('a'); const initial=f.rendered.length;
        const {target,statuses}=searchPanel(f,'first'), pending=[];
        f.ctx.fetch=(url,options)=>url.includes('/api/stats')?Promise.resolve(response({has_audio_majority:false}))
            :new Promise((resolve,reject)=>pending.push({resolve,reject,url,options}));
        const first=f.ctx._localrssSearchPosts(target); target.query='second'; const second=f.ctx._localrssSearchPosts(target);
        pending[0][outcome](outcome==='resolve'?response([{id:1,title:'obsolete'}]):Error('obsolete failure')); await first;
        assert.equal(f.rendered.length,initial); assert.equal(f.CList.ui.view.loadingIndicator.style.display,'block');
        assert.equal(statuses.filter(row=>row.text!=='Searching…').length,0); assert.deepEqual(f.errors,[]);
        pending[1].resolve(response([{id:2,title:'current'}])); await second;
        assert.equal(f.rendered.at(-1).title,'Search: "second"'); assert.equal(f.rendered.at(-1).items[0].id,2);
        assert.equal(f.CList.ui.view.loadingIndicator.style.display,'none');
    }
});

test('search account/session invalidation captures old headers and suppresses late UI results', async () => {
    for(const change of ['account','session']) {
        const f=fixture(); await f.ctx.switchReaderAccount('a'); const {target,statuses}=searchPanel(f);
        let finish,captured; f.ctx.fetch=(url,options)=>{captured={url,options};return new Promise(resolve=>finish=resolve);};
        const search=f.ctx._localrssSearchPosts(target);
        assert.equal(captured.options.headers.Authorization,'Bearer private-token'); assert.match(captured.url,/rss-a/);
        if(change==='account'){f.ctx.fetch=async()=>response([]);await f.ctx.switchReaderAccount('b');}
        else f.setToken('replacement');
        const count=f.rendered.length; finish(response([{id:999,title:'late'}])); await search;
        assert.equal(f.rendered.length,count); assert.equal(statuses.length,1); assert.deepEqual(f.errors,[]);
    }
});

test('closed search panel cannot start new requests or receive completion status', async () => {
    const f=fixture(); await f.ctx.switchReaderAccount('a'); const {target,statuses}=searchPanel(f);
    let finish;f.ctx.fetch=()=>new Promise(resolve=>finish=resolve);
    const search=f.ctx._localrssSearchPosts(target); target.alive=false; finish(response([{id:4}]));await search;
    assert.equal(statuses.length,1);f.ctx.fetch=()=>{throw Error('closed panel must not start requests');};
    await f.ctx._localrssSearchPosts(target);
});

test('feed-row Show posts captures feed identity/title, Refresh retains it and old rows cannot reload', async () => {
    const f=fixture();await f.ctx.switchReaderAccount('a');await f.action('Feeds');
    const item=await f.rendered.at(-1).normalize({id:73,title:'Feed "quoted"',url:'https://feed'});
    await f.ctx.localrssShowBoundFeedPosts(item.localrssFeedPostsId);
    const url=new URL(f.calls.filter(c=>c.url.includes('/api/items')).at(-1).url);
    assert.equal(url.searchParams.get('feed_id'),'73');assert.equal(url.searchParams.has('filter'),false);
    assert.equal(f.rendered.at(-1).title,'Feed "quoted"');assert.equal(f.rendered.at(-1).more,null);
    await f.action('Refresh');assert.equal(f.CList.state.localrssReading.selection.feedId,73);
    f.ctx.fetch=()=>{throw Error('old feed row must not reload');}; await f.ctx.localrssShowBoundFeedPosts(item.localrssFeedPostsId);
});

test('failed feed-post load retains selection for retry and obsolete feed rows never target a different account', async()=>{
    const f=fixture();await f.ctx.switchReaderAccount('a');await f.action('Feeds');
    const item=await f.rendered.at(-1).normalize({id:9,title:'Nine',url:'https://feed'});
    f.ctx.fetch=async()=>{throw Error('feed unavailable');};await f.ctx.localrssShowBoundFeedPosts(item.localrssFeedPostsId);
    assert.equal(f.CList.state.reader.status,'failed');assert.equal(f.CList.state.localrssReading.selection.feedId,9);
    f.ctx.fetch=async()=>response([]);await f.ctx.switchReaderAccount('b');
    f.ctx.fetch=()=>{throw Error('old row must not fetch against b');};await f.ctx.localrssShowBoundFeedPosts(item.localrssFeedPostsId);
});


test('search rows use all-items toggle semantics and replacing search invalidates their actions', async()=>{
    const f=fixture();await f.ctx.switchReaderAccount('a');await f.action('Bookmarked');
    const {target}=searchPanel(f);await f.ctx._localrssSearchPosts(target);
    const item=await f.rendered.at(-1).normalize({id:25,title:'Match'}),button=actionButton();
    f.ctx.fetch=async()=>response({bookmarked:false});
    await f.ctx.localrssToggleBookmark(item.localrssActionId,button);
    assert.equal(button.row.removed,false);assert.equal(button.title,'Bookmark');
    f.ctx.fetch=async()=>response([]);await f.action('Unread');
    f.ctx.fetch=()=>{throw Error('replaced search row must not toggle');};
    await f.ctx.localrssToggleBookmark(item.localrssActionId,button);
});

test('normalized LocalRSS items combine the feed thumbnail with every inline body image, deduplicated and thumbnail first', async()=>{
    const f=fixture();await f.ctx.switchReaderAccount('a');await f.action('Bookmarked');
    f.ctx.extractImageUrlsFromHtml=()=>['https://img/2','https://img/1','https://img/2'];
    const withThumbnail=await f.rendered.at(-1).normalize({id:1,title:'With thumbnail',thumbnail:'https://img/1',content_html:'<p>body</p>'});
    assert.deepEqual(Array.from(withThumbnail.images,i=>i.url),['https://img/1','https://img/2']);
    f.ctx.extractImageUrlsFromHtml=()=>['https://img/a','https://img/b'];
    const bodyOnly=await f.rendered.at(-1).normalize({id:2,title:'No thumbnail',content_html:'<p>body</p>'});
    assert.deepEqual(Array.from(bodyOnly.images,i=>i.url),['https://img/a','https://img/b']);
    f.ctx.extractImageUrlsFromHtml=()=>[];
    const neither=await f.rendered.at(-1).normalize({id:3,title:'Plain'});
    assert.equal('images' in neither,false);
});

test('empty search clears old results and audio, has a literal heading, and offers no Load more', async()=>{
    const f=fixture();await f.ctx.switchReaderAccount('a');const {target,statuses}=searchPanel(f,'<query>');
    f.ctx.audioFiles.push({src:'old audio'});f.ctx.fetch=async url=>response(url.includes('/api/stats')?{has_audio_majority:false}:[]);
    await f.ctx._localrssSearchPosts(target);
    const text=f.CList.ui.view.feedContainer.textContent;
    assert.match(text,/Search: "<query>"/);assert.match(text,/No posts found/);
    assert.equal(f.ctx.audioFiles.length,0);assert.equal(statuses.at(-1).text,'0 results.');
});


test('feed editor Show posts uses the captured panel and rejects replaced or closed editors', async () => {
    const f = await feedFixture();
    f.ctx.fetch = async url => response(url.includes('/api/feed/') ? {ok:true,feed:{id:42,title:'Editor feed'}} : url.includes('/api/stats') ? {has_audio_majority:false} : []);
    await f.ctx._localrssOpenFeedEditor({id:42}, f.target);
    await f.ctx._localrssShowFeedPosts(f.target);
    assert.equal(f.CList.state.localrssReading.selection.feedId,42);
    await f.ctx.localrssOptionsOverlay();
    f.ctx.fetch = () => {throw Error('old panel must not load posts');};
    await f.ctx._localrssShowFeedPosts(f.target);
});



test('browser fixture listing renders registered feed actions and their captured Show posts binding', async () => {
    const f = fixture(); await f.ctx.switchReaderAccount('a'); await f.action('Feeds');
    const html = fs.readFileSync('tests/localrss-reader.browser.html', 'utf8');
    const start = html.indexOf('window.makeListing =');
    const end = html.indexOf('window.createFeedHeader =', start);
    f.ctx.CList = f.CList;
    vm.runInContext(html.slice(start, end), f.ctx);
    const item = await f.rendered.at(-1).normalize({id:7, title:'Feed "quoted" <tags>', url:'https://feed'});
    const row = f.ctx.window.makeListing(item, {rowContext: vm.runInContext('_readerContext', f.ctx)});
    const showPosts = row.querySelectorAll('button').find(button => button.title === 'Show posts');
    assert.ok(showPosts, 'fixture exposes the real registered feed Show posts action');
    assert.equal(typeof showPosts.onclick, 'function');
    await showPosts.click();
    assert.equal(f.CList.state.localrssReading.selection.feedId, 7);
    assert.equal(f.rendered.at(-1).title, 'Feed "quoted" <tags>');
});


async function feedFixture() {
    const f = optionsFixture(); await f.ctx.switchReaderAccount('a'); await f.ctx.localrssOptionsOverlay();
    const target = f.targets[0], root = new Element('div'); root.parentNode = {};
    target.root = root; f.ctx._localrssFeedsSection(root,target);
    target.show = async () => {};
    return {...f,target,root,field:id=>root.querySelector('#'+id)};
}
const feedData = (id,title='Feed '+id) => ({ok:true,feed:{id,title,url:'https://feed/'+id,author:'Author',image:'image',fail_count:0}});

test('feed cache shares in-flight list loads, filters latest text, and rejects invalidated reads', async () => {
    const f=await feedFixture();let finish,calls=0;
    f.ctx.fetch=()=>{calls++;return new Promise(resolve=>finish=resolve);};
    f.field('localrss-feed-search-input').value='old'; const first=f.ctx._localrssSearchFeeds(f.target);
    f.field('localrss-feed-search-input').value='new'; const second=f.ctx._localrssSearchFeeds(f.target);
    assert.equal(calls,1);finish(response({feeds:[{id:1,title:'old'},{id:2,title:'new'}]}));await Promise.all([first,second]);
    assert.equal(f.field('localrss-feed-results').children.length,1);assert.equal(f.field('localrss-feed-results').textContent,'new');
    await f.ctx._localrssFetchAllFeeds(f.target);assert.equal(calls,1);
    f.ctx._localrssInvalidateFeedCache(f.target);const pending=f.ctx._localrssFetchAllFeeds(f.target);
    f.ctx._localrssInvalidateFeedCache(f.target);finish(response({feeds:[{id:3}]}));await pending;
    assert.equal(f.target.feeds.cache,null);
});

test('feed cache belongs only to its captured panel and stale search buttons cannot open an editor', async()=>{
    const f=await feedFixture();let calls=0;
    f.ctx.fetch=async()=>{calls++;return response({feeds:[{id:1,title:'A'}]});};
    await f.ctx._localrssSearchFeeds(f.target);const old=f.field('localrss-feed-results').children[0];
    f.ctx._localrssInvalidateFeedCache(f.target);f.ctx.fetch=()=>{throw Error('invalidated result must not open');};await old.click();
    await f.ctx.localrssOptionsOverlay();const replacement=f.targets.at(-1);
    f.ctx.fetch=async()=>{calls++;return response({feeds:[]});};await f.ctx._localrssFetchAllFeeds(replacement);
    assert.equal(calls,2);assert.notEqual(replacement.feeds,f.target.feeds);
});

test('feed editor gets are sequenced and ignore stale errors, account/session changes and panel close', async()=>{
    for(const invalidation of ['new editor','close','session','account']) {
        const f=await feedFixture(),pending=[];
        f.ctx.fetch=(url,options)=>new Promise((resolve,reject)=>pending.push({resolve,reject,url,options}));
        const first=f.ctx._localrssOpenFeedEditor({id:1},f.target);
        assert.match(pending[0].url,/rss-a\/api\/feed\/1\?db=db-a/);assert.equal(pending[0].options.headers.Authorization,'Bearer private-token');
        let second;
        if(invalidation==='new editor')second=f.ctx._localrssOpenFeedEditor({id:2},f.target);
        if(invalidation==='close')f.target.close();
        if(invalidation==='session')f.setToken('other');
        if(invalidation==='account'){f.ctx.fetch=async()=>response([]);await f.ctx.switchReaderAccount('b');}
        pending[0].reject(Error('obsolete'));await first;
        assert.doesNotMatch(f.field('localrss-feed-editor-status').textContent,/obsolete/);assert.equal(f.target.feeds.editor,null);
        if(second){pending[1].resolve(response(feedData(2)));await second;assert.equal(f.target.feeds.editor.id,2);assert.equal(f.field('localrss-edit-feed-title').value,'Feed 2');}
    }
});

test('feed create captures endpoint/auth/url, blocks duplicate writes and preserves newly typed URL',async()=>{
    const f=await feedFixture(),calls=[];let finish;
    f.field('localrss-new-feed-url').value='https://original';
    f.ctx.fetch=(url,options)=>{calls.push({url,options});return new Promise(resolve=>finish=resolve);};
    const write=f.ctx._localrssCreateFeed(f.target);await f.ctx._localrssCreateFeed(f.target);
    assert.equal(calls.length,1);assert.equal(calls[0].url,'https://rss-a/api/feed_create');
    assert.deepEqual(JSON.parse(calls[0].options.body),{url:'https://original',db:'db-a'});assert.equal(calls[0].options.headers.Authorization,'Bearer private-token');
    f.field('localrss-new-feed-url').value='https://new-draft';f.ctx.fetch=async()=>response({has_audio_majority:false});
    finish(response(feedData(9)));await write;
    assert.equal(f.field('localrss-new-feed-url').value,'https://new-draft');assert.match(f.field('localrss-create-feed-status').textContent,/Added:/);
});

test('feed save captures values, preserves a newer draft, invalidates cache and separates statistics failure',async()=>{
    const f=await feedFixture();f.ctx.fetch=async()=>response(feedData(4));await f.ctx._localrssOpenFeedEditor({id:4},f.target);
    f.target.feeds.cache=[{id:4}];f.field('localrss-edit-feed-title').value='Original save';let finish;const calls=[];
    f.ctx.fetch=(url,options)=>{calls.push({url,options});return new Promise(resolve=>finish=resolve);};
    const write=f.ctx._localrssSaveFeed(f.target);await f.ctx._localrssRetryFeed(f.target);assert.equal(calls.length,1);
    assert.deepEqual(JSON.parse(calls[0].options.body),{url:'https://feed/4',title:'Original save',author:'Author',image:'image',id:4,db:'db-a'});
    f.field('localrss-edit-feed-title').value='New unsaved draft';f.ctx.fetch=async()=>{throw Error('stats offline');};
    finish(response({ok:true}));await write;
    assert.equal(f.field('localrss-edit-feed-title').value,'New unsaved draft');assert.equal(f.field('localrss-feed-editor-status').textContent,'Saved.');
    assert.equal(f.target.feeds.cache,null);assert.equal(f.failures.at(-1).action,'statistics');
});

test('old feed write cannot update a replacement editor and uncertain writes are never retried',async()=>{
    const f=await feedFixture();f.ctx.fetch=async()=>response(feedData(1));await f.ctx._localrssOpenFeedEditor({id:1},f.target);
    let finish;f.ctx.fetch=()=>new Promise(resolve=>finish=resolve);const save=f.ctx._localrssSaveFeed(f.target);
    f.ctx.fetch=async url=>response(url.includes('/api/feed/')?feedData(2):{has_audio_majority:false});
    await f.ctx._localrssOpenFeedEditor({id:2},f.target);finish(response({ok:true}));await save;
    assert.equal(f.field('localrss-edit-feed-title').value,'Feed 2');assert.equal(f.field('localrss-feed-editor-status').textContent,'');
    let attempts=0;f.ctx.fetch=async()=>{attempts++;throw Error('response lost');};await f.ctx._localrssSaveFeed(f.target);
    assert.equal(attempts,1);assert.equal(f.target.feeds.pending.size,0);assert.equal(f.target.feeds.cache,null);
    assert.match(f.field('localrss-feed-editor-status').textContent,/response lost/);
});

test('delete confirms captured editor identity, ignores obsolete and duplicate confirmations',async()=>{
    const f=await feedFixture();f.ctx.fetch=async()=>response(feedData(1));await f.ctx._localrssOpenFeedEditor({id:1},f.target);
    f.ctx._localrssDeleteFeed(f.target);f.ctx.fetch=async()=>response(feedData(2));await f.ctx._localrssOpenFeedEditor({id:2},f.target);
    f.ctx.fetch=()=>{throw Error('old confirmation must not write');};await f.confirmations[0]();
    f.ctx._localrssDeleteFeed(f.target);let finish,calls=0;
    f.ctx.fetch=(url,options)=>{calls++;assert.deepEqual(JSON.parse(options.body),{id:2,db:'db-a'});return new Promise(resolve=>finish=resolve);};
    const deletion=f.confirmations[1]();await f.confirmations[1]();assert.equal(calls,1);
    f.ctx.fetch=async()=>response({has_audio_majority:false});finish(response({ok:true}));await deletion;
    assert.equal(f.target.feeds.editor,null);assert.equal(f.field('localrss-feed-editor').style.display,'none');
});

test('retry uses captured ID and updates failure feedback without replacing editable draft',async()=>{
    const f=await feedFixture();f.ctx.fetch=async()=>response(feedData(3));await f.ctx._localrssOpenFeedEditor({id:3},f.target);
    f.field('localrss-edit-feed-title').value='Unsaved';const calls=[];
    f.ctx.fetch=async(url,options)=>{calls.push({url,options});return response(url.includes('feed_retry')?{ok:true,feed:{id:3,fail_count:2,error_msg:'Bad feed',title:'Remote'}}:{has_audio_majority:false});};
    await f.ctx._localrssRetryFeed(f.target);assert.deepEqual(JSON.parse(calls[0].options.body),{id:3,db:'db-a'});
    assert.equal(f.field('localrss-edit-feed-title').value,'Unsaved');assert.match(f.field('localrss-feed-editor-error').textContent,/2 failed attempts: Bad feed/);
});

test('feed transport rejects unknown operations, malformed responses and wrong feed identity without UI',async()=>{
    const ctx=vm.createContext({structuredClone,URLSearchParams});vm.runInContext(source('localrss_requests'),ctx);
    const account={serviceUrl:'https://rss',database:'db'};
    for(const operation of ['get','create','retry','update','delete'])for(const data of [null,[],{}, {ok:false,error:'denied'}, ...(['get','create','retry'].includes(operation)?[{ok:true}]:[])]) {
        await assert.rejects(ctx.requestLocalrssFeed(account,operation,{id:1,url:'https://feed'},{fetch:async()=>response(data),headers:{}}));
    }
    await assert.rejects(ctx.requestLocalrssFeed(account,'get',{id:1},{fetch:async()=>response(feedData(2)),headers:{}}),/different feed/);
    await assert.rejects(ctx.requestLocalrssFeed(account,'other',{},{}),/Invalid/);
    assert.equal('window' in ctx,false);assert.equal('document' in ctx,false);
});


test('reopening the same feed while its old write settles restores busy state without applying old feedback',async()=>{
    const f=await feedFixture();f.ctx.fetch=async()=>response(feedData(1));await f.ctx._localrssOpenFeedEditor({id:1},f.target);
    let finish;f.ctx.fetch=()=>new Promise(resolve=>finish=resolve);const save=f.ctx._localrssSaveFeed(f.target);
    f.ctx.fetch=async url=>response(url.includes('/api/feed/2')?feedData(2):url.includes('/api/feed/1')?feedData(1):{has_audio_majority:false});
    await f.ctx._localrssOpenFeedEditor({id:2},f.target);await f.ctx._localrssOpenFeedEditor({id:1},f.target);
    const saveButton=f.field('localrss-feed-editor').querySelectorAll('button').find(button=>button.textContent==='Save');
    assert.equal(saveButton.disabled,true);
    finish(response({ok:true}));await save;
    assert.equal(saveButton.disabled,false);assert.equal(f.field('localrss-feed-editor-status').textContent,'');
});


test('late feed writes cannot clear input or show feedback after close, session change or account switch',async()=>{
    for(const invalidation of ['close','session','account'])for(const outcome of ['success','failure']) {
        const f=await feedFixture();f.field('localrss-new-feed-url').value='https://original';let finish,fail;
        f.ctx.fetch=()=>new Promise((resolve,reject)=>{finish=resolve;fail=reject;});
        const write=f.ctx._localrssCreateFeed(f.target);
        if(invalidation==='close')f.target.close();
        if(invalidation==='session')f.setToken('new token');
        if(invalidation==='account'){f.ctx.fetch=async()=>response([]);await f.ctx.switchReaderAccount('b');}
        const status=f.field('localrss-create-feed-status').textContent;
        if(outcome==='success')finish(response(feedData(5)));else fail(Error('late failure'));
        await write;
        assert.equal(f.field('localrss-new-feed-url').value,'https://original');assert.equal(f.field('localrss-create-feed-status').textContent,status);
        assert.equal(f.target.feeds.pending.size,0);
    }
});


class OpmlForm {
    constructor() { this.parts = new Map(); }
    append(key, value) { this.parts.set(key, value); }
    get(key) { return this.parts.get(key); }
}
const imported = (mode='merge', db='created') => ({ok:true, mode, db, imported:2, skipped:1});
async function opmlFixture(mode='merge') {
    const f=optionsFixture(); await f.ctx.switchReaderAccount('a'); await f.ctx.localrssOptionsOverlay();
    const target=f.targets[0], events=[], downloads=[], offers=[];
    const capture={file:{name:'feeds.opml'}, mode, newDbName:'New database'};
    f.ctx.FormData=OpmlForm;
    f.ctx.downloadBlob=(blob,name)=>downloads.push({blob,name});
    const feedView=f.CList.ui.localrssFeeds;
    f.CList.ui.localrssFeeds={...feedView, busy:(_,area,busy)=>events.push({feedArea:area,busy}),
        status:(_,area,text)=>events.push({feedArea:area,text})};
    f.CList.ui.localrssOpml={
        read:()=>({...capture}),status:(_,area,text)=>events.push({area,text}),
        error:(_,area,error,prefix='')=>events.push({area,text:prefix+error.message}),
        busy:(_,area,busy)=>events.push({area,busy}),clearFile:(_,file)=>events.push({cleared:file}),
        offerAccount:(_,callback)=>offers.push(callback),accountRefresh:(_,accounts)=>events.push({accounts}),
    };
    return {...f,target,capture,events,downloads,offers,feedView};
}

test('OPML transport captures multipart input, configured/resolved endpoint, database and auth without UI',async()=>{
    const ctx=vm.createContext({structuredClone,URLSearchParams});vm.runInContext(source('localrss_opml_requests'),ctx);
    const calls=[],file={name:'feeds.opml'},account={serviceUrl:'https://remote',_effectiveServiceUrl:'https://proxy',database:'db spaces'};
    for(const mode of ['merge','replace','newdb']){
        const data=await ctx.importLocalrssOpml({account,mode,newDbName:'My DB',file},{fetch:async(url,options)=>{calls.push({url,options});return response(imported(mode));},headers:{Authorization:'Bearer captured'},FormData:OpmlForm});
        const call=calls.at(-1);assert.equal(new URL(call.url).origin,'https://proxy');assert.equal(new URL(call.url).searchParams.get('db'),'db spaces');
        assert.equal(call.options.body.get('opml'),file);assert.equal(call.options.body.get('mode'),mode);
        assert.equal(call.options.headers.Authorization,'Bearer captured');assert.equal(call.options.headers['Content-Type'],undefined);assert.equal(data.imported,2);
    }
    let url;await ctx.importLocalrssOpml({account:{serviceUrl:'https://seed'},mode:'newdb',newDbName:'seed',file},{fetch:async value=>{url=value;return response(imported('newdb'));},headers:{},FormData:OpmlForm});
    assert.equal(new URL(url).searchParams.has('db'),false);assert.equal('window' in ctx,false);
});

test('OPML import transport rejects malformed, API and HTTP failures without repeating the write',async()=>{
    const ctx=vm.createContext({structuredClone,URLSearchParams});vm.runInContext(source('localrss_opml_requests'),ctx);
    const request={account:{serviceUrl:'https://rss',database:'db'},mode:'newdb',newDbName:'x',file:{}};
    for(const data of [null,{}, {ok:false,error:'denied'}, {...imported('newdb'),db:''}, {...imported('newdb'),imported:-1}, imported('merge')]){
        let count=0;await assert.rejects(ctx.importLocalrssOpml(request,{fetch:async()=>{count++;return response(data);},headers:{},FormData:OpmlForm}));assert.equal(count,1);
    }
});

test('OPML import blocks duplicate requests, captures mode/file and invalidates cache even for uncertain outcomes',async()=>{
    const f=await opmlFixture(),calls=[];let finish;
    f.ctx.localrssFeedState(f.target).cache=[{id:1}];
    f.ctx.fetch=(url,options)=>{calls.push({url,options});return new Promise((resolve,reject)=>finish={resolve,reject});};
    const pending=f.ctx._localrssImportOpml(f.target);await f.ctx._localrssImportOpml(f.target);
    f.capture.mode='replace';assert.equal(calls.length,1);assert.equal(calls[0].options.body.get('mode'),'merge');assert.equal(f.target.feeds.cache,null);
    finish.reject(Error('response lost'));await pending;
    assert.equal(f.target.feeds.cache,null);assert.equal(f.target.opml.importing,false);assert.match(f.events.find(row=>row.text?.includes('response lost')).text,/unconfirmed/);
    assert.equal(calls.length,1);
});

test('closed/account/session changes suppress late import and export feedback or downloads',async()=>{
    for(const operation of ['import','export'])for(const change of ['close','account','session']){
        const f=await opmlFixture();let finish;
        f.ctx.fetch=()=>new Promise(resolve=>finish=resolve);
        const pending=operation==='import'?f.ctx._localrssImportOpml(f.target):f.ctx._localrssExportOpml(f.target);
        if(change==='close')f.target.close();
        else if(change==='session')f.setToken('replacement');
        else {f.ctx.fetch=async()=>response([]);await f.ctx.switchReaderAccount('b');}
        const count=f.events.length;finish(operation==='import'?response(imported()):{ok:true,blob:async()=>({data:'opml'})});await pending;
        assert.equal(f.events.length,count);assert.equal(f.downloads.length,0);assert.equal(f.offers.length,0);
    }
});

test('OPML export downloads once using the captured database filename and restores busy state',async()=>{
    const f=await opmlFixture();let finish;const calls=[];
    f.ctx.fetch=(url,options)=>{calls.push({url,options});return new Promise(resolve=>finish=resolve);};
    const pending=f.ctx._localrssExportOpml(f.target);await f.ctx._localrssExportOpml(f.target);
    assert.equal(calls.length,1);assert.equal(calls[0].options.headers.Authorization,'Bearer private-token');
    finish({ok:true,blob:async()=>({data:'opml'})});await pending;
    assert.equal(f.downloads[0].name,'db-a.opml');assert.equal(f.events.at(-1).busy,false);
});

test('successful import remains separate from refresh failure, with no repeat import',async()=>{
    const f=await opmlFixture();let calls=0;
    f.ctx.fetch=async()=>{calls++;return response(imported());};
    f.ctx.refreshLocalrssOptionsStats=async()=>{throw Error('refresh offline');};
    await f.ctx._localrssImportOpml(f.target);
    assert.equal(calls,1);assert.ok(f.events.some(row=>row.text?.startsWith('Imported 2')));
    assert.ok(f.events.some(row=>row.text?.includes('Import succeeded; refresh failed:')));
});

test('new database receipt retries account refresh without reimporting or resaving and preserves configured service URL',async()=>{
    const f=await opmlFixture('newdb');let imports=0,saves=0,lists=0;const requests=[];
    f.ctx.fetch=async()=>{imports++;return response(imported('newdb','new-slug'));};
    vm.runInContext(source('account-state'),f.ctx);
    f.ctx.loadAccountRecords=async()=>{lists++;if(lists===2)throw Error('list offline');return [];};
    f.ctx.saveAccount=async(request,session)=>{f.ctx.assertAccountSession(session);requests.push(request);saves++;};
    await f.ctx._localrssImportOpml(f.target);assert.equal(f.offers.length,1);
    await f.confirmations.at(-1)();await f.confirmations.at(-1)();
    assert.equal(imports,1);assert.equal(saves,1);assert.equal(requests[0].data.database,'new-slug');assert.equal(requests[0].data.serviceUrl,'https://rss-a');
    assert.ok(f.events.some(row=>row.text?.startsWith('Account saved; account-list refresh failed:')));
    await f.offers[0]();assert.equal(saves,1);assert.equal(imports,1);assert.ok(f.events.some(row=>row.accounts));
});

test('new database account creation checks owner/session before write and ignores obsolete receipt confirmations',async()=>{
    for(const change of ['close','session','receipt']){
        const f=await opmlFixture('newdb');f.ctx.fetch=async()=>response(imported('newdb'));
        vm.runInContext(source('account-state'),f.ctx);
        let finish,saves=0;f.ctx.getEncKey=()=>new Promise(resolve=>finish=resolve);f.ctx.loadAccountRecords=async()=>[];f.ctx.saveAccount=async()=>saves++;
        await f.ctx._localrssImportOpml(f.target);const confirm=f.confirmations.at(-1);const pending=confirm();await f.flush();
        if(change==='close')f.target.close();else if(change==='session')f.setToken('changed');else f.target.opml.receipt={};
        finish('key');await pending;assert.equal(saves,0);await confirm();assert.equal(saves,0);
    }
});

test('account persistence lifetime guard stops writes when owner closes during encryption',async()=>{
    const f=fixture();vm.runInContext(source('account-state'),f.ctx);
    let alive=true,finish;f.ctx.encryptWithKey=()=>new Promise(resolve=>finish=resolve);
    const session={storeUrl:'https://kv',token:'private-token',encKey:'key',isCurrent:()=>alive};
    const pending=f.ctx.saveAccount({key:'New',data:{type:'LOCALRSS',title:'New'}},session);
    alive=false;finish('encrypted');await assert.rejects(pending,/no longer current/);assert.equal(f.writes.length,0);
});

function seedFixture(){
    const f=fixture(),root=new Element('div'),shared=new Element('div'),service=new Element('input'),db=new Element('input');
    shared.id='sharedForm';service.id='serviceUrlInput';service.value='https://seed';db.id='databaseInput';db.value='Wanted';
    root.append(shared);shared.append(service,db);const wrapper=f.ctx._localrssBuildAccountOpmlSection(root);shared.append(wrapper);
    const file=wrapper.querySelector('#localrss-create-opml-file');file.files=[{name:'seed.opml'}];f.ctx.FormData=OpmlForm;
    return {...f,root,shared,service,db,wrapper,file,button:wrapper.querySelector('button'),status:wrapper.querySelector('#localrss-create-opml-status')};
}
test('seed form import captures endpoint/inputs, suppresses duplicates and keeps newer draft fields',async()=>{
    const f=seedFixture();let finish;const calls=[];
    f.ctx.fetch=(url,options)=>{calls.push({url,options});return new Promise(resolve=>finish=resolve);};
    const pending=f.button.onclick();await f.button.onclick();assert.equal(calls.length,1);assert.equal(new URL(calls[0].url).searchParams.has('db'),false);
    f.db.value='Newer draft';finish(response(imported('newdb','created-slug')));await pending;
    assert.equal(f.db.value,'Newer draft');assert.match(f.status.textContent,/created-slug/);assert.match(f.status.textContent,/newer form values/);assert.equal(f.button.disabled,false);
});

test('seed import ignores results after form close, rebuild or session changes',async()=>{
    for(const change of ['close','rebuild','session']){
        const f=seedFixture();let finish;f.ctx.fetch=()=>new Promise(resolve=>finish=resolve);
        const pending=f.button.onclick();
        if(change==='close')f.shared.style.display='none';else if(change==='rebuild')f.wrapper.remove();else f.setToken('changed');
        finish(response(imported('newdb','obsolete')));await pending;
        assert.equal(f.db.value,'Wanted');assert.doesNotMatch(f.status.textContent,/obsolete/);
    }
});


test('uncertain account write is reconciled from stored records before retry, without another import or save',async()=>{
    const f=await opmlFixture('newdb'), records=new Map();let imports=0,puts=0;
    vm.runInContext(source('account-state'),f.ctx);
    f.ctx.decryptWithKey=async(_,value)=>value.slice('encrypted:'.length);
    f.CList.storage.kv={list:async()=>[...records].map(([key,value])=>({key,value})),
        put:async(key,value)=>{records.set(key,value);puts++;throw Error('write response lost');}};
    f.ctx.fetch=async()=>{imports++;return response(imported('newdb','receipt-db'));};
    await f.ctx._localrssImportOpml(f.target);await f.offers[0]();
    assert.equal(puts,1);assert.equal(f.target.opml.receipt.savedKey,null);
    assert.ok(f.events.some(row=>row.text?.includes('account save failed or is unconfirmed')));
    await f.offers[0]();
    assert.equal(puts,1);assert.equal(imports,1);assert.equal(f.target.opml.receipt.savedKey,'New database');
    assert.ok(f.events.some(row=>row.accounts?.length===1));
});

test('new database account creation avoids a live stored key collision and keeps ciphertext separate',async()=>{
    const f=await opmlFixture('newdb');vm.runInContext(source('account-state'),f.ctx);
    const records=new Map([['New database','encrypted:'+JSON.stringify({type:'LOCALRSS',title:'Existing',database:'different',serviceUrl:'https://rss-a'})]]);
    f.ctx.decryptWithKey=async(_,value)=>value.slice('encrypted:'.length);
    f.CList.storage.kv={list:async()=>[...records].map(([key,value])=>({key,value})),put:async(key,value)=>records.set(key,value)};
    f.ctx.fetch=async()=>response(imported('newdb','created'));
    await f.ctx._localrssImportOpml(f.target);await f.offers[0]();
    assert.equal(f.target.opml.receipt.savedKey,'New database (2)');assert.equal(records.size,2);
    const stored=records.get('New database (2)');assert.ok(stored.startsWith('encrypted:'));
    assert.equal(JSON.parse(stored.slice('encrypted:'.length)).database,'created');
});

test('seed import writes the created slug only into the original unchanged form',async()=>{
    const f=seedFixture();f.ctx.fetch=async()=>response(imported('newdb','created-slug'));
    await f.button.onclick();assert.equal(f.db.value,'created-slug');assert.match(f.status.textContent,/Click Save/);
});


test('merge and replace import expire captured editor ownership without overwriting draft text',async()=>{
    for(const mode of ['merge','replace']){
        const f=await opmlFixture(mode),root=new Element('div');
        root.append(f.ctx._localrssFeedEditor(f.target));root.parentNode={};f.target.root=root;
        f.CList.ui.localrssFeeds=f.feedView;
        const state=f.ctx.localrssFeedState(f.target);state.editor={id:1};const generation=state.editorId;
        const title=root.querySelector('#localrss-edit-feed-title');title.value='Newer unsaved draft';
        f.ctx.fetch=async()=>response(imported(mode));f.ctx.refreshLocalrssOptionsStats=async()=>{};f.target.show=async()=>{};
        await f.ctx._localrssImportOpml(f.target);
        assert.equal(state.editor,null);assert.equal(state.editorId,generation+1);assert.equal(title.value,'Newer unsaved draft');
        assert.match(root.querySelector('#localrss-feed-editor-status').textContent,/draft text is retained/);
        assert.equal(root.querySelectorAll('button').find(button=>button.textContent==='Save').disabled,true);
    }
});


test('detached LocalRSS controls cannot send a toggle or apply late feedback', async () => {
    const f = fixture(); await f.ctx.switchReaderAccount('a'); const id = bindAction(f), button = actionButton();
    let calls = 0, finish; f.ctx.fetch = () => { calls++; return new Promise(resolve => finish = resolve); };
    button.isConnected = false; await f.ctx.localrssToggleRead(id, button); assert.equal(calls, 0);
    button.isConnected = true; const pending = f.ctx.localrssToggleRead(id, button); assert.equal(calls, 1);
    button.isConnected = false; finish(response({read: 1})); await pending;
    assert.equal(button.icon.textContent, 'visibility'); assert.equal(button.disabled, false);
});

test('LocalRSS row callbacks capture audio and navigation and expire detached or changed-account rows', async () => {
    const f = fixture(); await f.ctx.switchReaderAccount('a');
    const context = vm.runInContext('_readerContext', f.ctx), row = new Element('div'); row.id = 'captured-row';
    const actions = new Element('div'); actions.className = 'service-status-actions'; row.appendChild(actions);
    const played = []; f.ctx.playAudio = index => played.push(index);
    const item = {service:'LOCALRSS', audioIndex:3, localrssActionId:bindAction(f)};
    f.ctx.bindLocalrssRow(item, row, context); item.audioIndex = 9;
    const audio = actions.children.find(button => button.title === 'Play audio');
    await context.next(async () => {}); await audio.click(); assert.deepEqual(played, [3]);
    row.isConnected = false; await audio.click(); assert.deepEqual(played, [3]); row.isConnected = true;
    await f.ctx.switchReaderAccount('b'); await audio.click(); assert.deepEqual(played, [3]);
});
