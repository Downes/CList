// Captured public/account collection reader; no current-account globals in requests.
const _publicFeedLists = new WeakMap();
async function renderPublicFeedsList(container) {
    if (!container) return;
    const session = readerSession(), owner = {}; _publicFeedLists.set(container, owner);
    let wrap;
    const current = () => _publicFeedLists.get(container) === owner && container.isConnected !== false && wrap?.isConnected !== false
        && JSON.stringify(session) === JSON.stringify(readerSession());
    wrap = mountPublicFeedList(container);
    const add = (slug, title) => {
        appendPublicFeedChoice(wrap,title,() => { if (current()) return loadPublicFeed(slug,title); });
    };
    add('clist-changelog', 'CList Changelog');
    try {
        const response = await fetch(`${PUBLIC_FEEDS_BASE_URL}/api/collections`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const collections = await response.json(); if (!current()) return;
        for (const entry of Array.isArray(collections) ? collections : []) add(entry.slug,entry.title || entry.slug);
    } catch (error) { if (current()) { console.error('[public feeds]',error); showServiceError(container,'Could not load public feed collections',error.message); } }
}
async function loadPublicFeed(slug, title, serviceUrl = PUBLIC_FEEDS_BASE_URL, database = '', context = null) {
    context ||= captureReaderSurface('public');
    if (!context.isCurrent()) return;
    let accountBase = serviceUrl.replace(/\/$/,'');
    if (database && window.CList.isLocalMode?.()) throw new Error('Reading a personal LocalRSS collection requires a server-backed CList login.');
    if (database && window._launcherConfig?.proxyBase && /^https?:\/\//i.test(accountBase)) accountBase = `${window._launcherConfig.proxyBase}/${base64UrlEncode(accountBase)}`;
    const request = { slug,title,serviceUrl,database,accountBase,signal:context.signal,
        headers: database ? { ..._localrssAuthHeaders() } : {}, feeds: structuredClone(PUBLIC_CHANGELOG_FEEDS) };
    try {
        const result = await requestPublicFeedItems(request,{ fetch,escape:escapeHtml });
        if (!context.isCurrent()) return;
        await context.render(result.items,{ title:title || slug,normalize:normalizePublicFeedItem });
        context.commit(()=>{
            for (const failure of result.errors) { console.error('[public feeds]',failure.error); showServiceError('feed-container',`Could not load ${failure.title}`,failure.error?.message || String(failure.error)); }
            if (!result.items.length && !result.errors.length) showPublicFeedNotice(window.CList.ui.view.feedContainer,'No items found.');
        });
    } catch (error) {
        if (context.isCurrent()) { console.error('[public feeds]',error); context.commit(()=>showServiceError('feed-container','Could not load feed',error.message)); }
    }
}
window.CList.readers.PublicFeed.initialize = (account,context) => loadPublicFeed(account.collectionSlug,account.title,account.serviceUrl,account.database,context);
window.CList.readers.PublicFeed.supportsRequestContext = true;
window.CList.readers.PublicFeed.statusActions = () => '';
window.CList.readers.PublicFeed.bindRow = bindPublicFeedRow;
window.renderPublicFeedsList = renderPublicFeedsList; window.loadPublicFeed = loadPublicFeed;
