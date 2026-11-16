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
    const mappedFilter = { Unread: 'unread', All: 'all', Bookmarked: 'bookmarked' }[context.feedName];
    const kind = options.kind || (context.feedName === 'Feeds' ? 'feeds' : mappedFilter ? 'items' : previous.kind);
    const filter = options.filter || mappedFilter || previous.filter;
    const append = !!options.append;
    const offset = append ? options.offset ?? previous.offset + LOCALRSS_PAGE_SIZE : 0;
    const headers = { ..._localrssAuthHeaders() };
    const storeUrl = window.CList.config.flaskSiteUrl;
    const cacheKey = JSON.stringify([context.accountKey, context.account.serviceUrl, context.account.database, storeUrl, headers]);
    const account = structuredClone(_localrssResolvedReader?.key === cacheKey && !options.reconnect
        ? _localrssResolvedReader.account : context.account);
    const view = window.CList.ui.localrssReader;
    context.commit(() => { if (!append) resetLocalrssActions(); view.begin(kind, append); });
    try {
        if (_localrssResolvedReader?.key !== cacheKey || options.reconnect) await _localrssResolveServiceUrl(account);
        if (!context.isCurrent()) return;
        context.commit(() => {
            _localrssResolvedReader = { key: cacheKey, account: structuredClone(account) };
            localrssCurrentAccount = structuredClone(account);
            view.connection(account);
        });
        /** @type {CListLocalrssRequest} */
        const request = { account, kind, filter, offset, limit: LOCALRSS_PAGE_SIZE };
        const page = await fetchLocalrssPage(request, { fetch, headers, signal: context.signal });
        if (!context.isCurrent()) return;
        const next = page.hasMore ? () => context.next(current => loadLocalrssView(current,
            { kind, filter, append: true, offset: offset + LOCALRSS_PAGE_SIZE })) : null;
        await view.render(page, context, request, append, next);
        context.commit(() => {
            window.CList.state.localrssReading = { kind, filter, offset };
            localrssFilter = filter; localrssOffset = offset;
        });
        if (kind === 'items' && !append && context.isCurrent()) {
            syncLocalrssReaderAudio(account, context, headers, storeUrl)
                .catch(error => context.commit(() => view.metadataError(error)));
        }
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
