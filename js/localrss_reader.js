/// <reference path="./reader-types.js" />
// Copyright Stephen Downes 2026. CC BY 4.0; provided AS IS, without warranty.

// LocalRSS reader controller. Legacy options/actions keep their existing module.
let _localrssResolvedReader = null;
/** @returns {CListLocalrssReadState} */
function localrssReadState() {
    return window.CList.state.localrssReading ||= { kind: 'items', filter: 'unread', offset: 0 };
}
async function initializeLocalrss(account, context) {
    if (!context) return;
    return loadLocalrssView(context, { kind: 'items', filter: 'unread', offset: 0, reconnect: true });
}
async function localrssLoad(append = false, context = null, options = {}) {
    const load = current => loadLocalrssView(current, { ...options, append });
    const feedName = options.filter ? { unread: 'Unread', all: 'All', bookmarked: 'Bookmarked', read: 'Read' }[options.filter] : undefined;
    return context ? load(context) : reloadReader('LOCALRSS', load, feedName);
}
async function localrssLoadFeedList(context = null) {
    return context ? loadLocalrssView(context, { kind: 'feeds' })
        : reloadReader('LOCALRSS', current => loadLocalrssView(current, { kind: 'feeds' }));
}
/** @param {CListReaderContext} context */
async function loadLocalrssView(context, options = {}) {
    if (!context?.isCurrent()) return;
    const previous = localrssReadState();
    const mappedFilter = { Unread: 'unread', Read: 'read', All: 'all', Bookmarked: 'bookmarked' }[context.feedName];
    const selection = options.selection || (!options.kind && !options.filter
        && ['Search', 'Feed posts'].includes(context.feedName) ? previous.selection : null);
    const kind = options.kind || (context.feedName === 'Feeds' ? 'feeds' : mappedFilter ? 'items' : previous.kind);
    const filter = selection ? 'all' : options.filter || mappedFilter || previous.filter;
    const append = !!options.append;
    const offset = append ? options.offset ?? previous.offset + LOCALRSS_PAGE_SIZE : 0;
    const headers = { ..._localrssAuthHeaders() };
    const storeUrl = window.CList.config.flaskSiteUrl;
    const cacheKey = JSON.stringify([context.accountKey, context.account.serviceUrl, context.account.database, storeUrl, headers]);
    const account = structuredClone(_localrssResolvedReader?.key === cacheKey && !options.reconnect
        ? _localrssResolvedReader.account : context.account);
    const view = window.CList.ui.localrssReader;
    context.commit(() => { if (!append) { resetLocalrssActions(); resetLocalrssFeedPosts(); } view.begin(kind, append); });
    try {
        if (_localrssResolvedReader?.key !== cacheKey || options.reconnect) await _localrssResolveServiceUrl(account);
        if (!context.isCurrent()) return;
        context.commit(() => {
            _localrssResolvedReader = { key: cacheKey, account: structuredClone(account) };
            localrssCurrentAccount = structuredClone(account);
            view.connection(account);
        });
        /** @type {CListLocalrssRequest} */
        const request = { account, kind, filter, offset, limit: selection ? 1600 : LOCALRSS_PAGE_SIZE,
            ...(selection ? { selection: structuredClone(selection) } : {}) };
        // Save owned selection before fetching so Refresh can retry a failed query.
        if (selection) context.commit(() => {
            window.CList.state.localrssReading = { kind, filter, offset, selection: structuredClone(selection) };
        });
        const page = await fetchLocalrssPage(request, { fetch, headers, signal: context.signal });
        if (!context.isCurrent()) return;
        const next = page.hasMore ? () => context.next(current => loadLocalrssView(current,
            { kind, filter, append: true, offset: offset + LOCALRSS_PAGE_SIZE })) : null;
        await view.render(page, context, request, append, next);
        context.commit(() => {
            window.CList.state.localrssReading = { kind, filter, offset, ...(selection ? { selection: structuredClone(selection) } : {}) };
            localrssFilter = filter; localrssOffset = offset;
        });
        if (kind === 'items' && !append && context.isCurrent()) {
            syncLocalrssReaderAudio(account, context, headers, storeUrl)
                .catch(error => context.commit(() => view.metadataError(error)));
        }
        return page;
    } catch (error) {
        if (append) context.commit(() => view.retry(() => context.next(current => loadLocalrssView(current,
            { kind, filter, append: true, offset }))));
        throw error; // The reader controller presents current-request errors once.
    } finally { context.commit(() => view.busy(false)); }
}
async function syncLocalrssReaderAudio(account, context, headers, storeUrl) {
    const stats = await fetchLocalrssPage({ account, kind: 'stats', filter: '', offset: 0, limit: 0 },
        { fetch, headers, signal: context.signal });
    if (!context.isCurrent() || !!context.account.hasAudio === stats.hasAudio) return;
    const encKey = await getEncKey(storeUrl);
    if (!encKey || !context.isCurrent()) return;
    const updated = { ...context.account, hasAudio: stats.hasAudio };
    const record = { key: context.accountKey, value: JSON.stringify(updated) };
    const encrypted = await encryptWithKey(encKey, record.value);
    if (!context.isCurrent()) return;
    await window.CList.storage.kv.put(record.key, encrypted);
    context.commit(() => { context.updateAccount(record); populateReadAccountList(window.CList.accounts); });
}

// Feed-row bindings expire when the displayed list is replaced.
let _localrssFeedPostsSequence = 0;
const _localrssFeedPosts = new Map();
function resetLocalrssFeedPosts() { _localrssFeedPosts.clear(); }
function bindLocalrssFeedPosts(feedId, title, context) {
    const id = ++_localrssFeedPostsSequence;
    _localrssFeedPosts.set(id, { feedId, title, current: context.isCurrent });
    return id;
}
function localrssShowBoundFeedPosts(id) {
    const target = _localrssFeedPosts.get(id);
    if (!target?.current()) return;
    return _localrssRenderFeedItems(target.feedId, target.title);
}
function _localrssRenderFeedItems(feedId, title = 'Feed') {
    if (feedId == null || !_readerContext?.isCurrent() || _readerContext.account.type !== 'LOCALRSS') return;
    return reloadReader('LOCALRSS', context => loadLocalrssView(context, {
        kind: 'items', selection: { mode: 'feed', feedId, title },
    }), 'Feed posts');
}
function _localrssShowFeedPosts(panel = _localrssOptionsTarget) {
    const editor = panel?.feeds?.editor;
    if (!panel?.current() || !editor) return;
    return _localrssRenderFeedItems(editor.id,
        window.CList.ui.localrssFeeds.input(panel, 'localrss-edit-feed-title') || 'Feed');
}
function _localrssSearchPosts(target = _localrssOptionsTarget) {
    if (!target?.current()) return;
    const query = localrssSearchInput(target);
    if (!query) return;
    localrssSearchStatus(target, 'Searching…');
    return reloadReader('LOCALRSS', async context => {
        try {
            const page = await loadLocalrssView(context, { kind: 'items', selection: { mode: 'search', query } });
            if (context.isCurrent() && target.current()) localrssSearchStatus(target,
                `${page.items.length} result${page.items.length !== 1 ? 's' : ''}.`);
        } catch (error) {
            if (context.isCurrent() && target.current()) localrssSearchStatus(target, 'Search failed: ' + error.message);
            throw error; // The central controller owns feed error feedback.
        }
    }, 'Search');
}
