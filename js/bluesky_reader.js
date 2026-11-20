/// <reference path="./reader-types.js" />
// Captured Bluesky reader, panels and row actions. Sessions stay outside shared state.
let _blueskyReaderOwner = null;
function currentBlueskyOwner(owner) {
    return _blueskyReaderOwner === owner && owner.context.isAccountCurrent();
}
function assertBlueskyOwner(owner) {
    if (!currentBlueskyOwner(owner)) throw new Error('The Bluesky reader account changed. Reopen it before continuing.');
}
async function currentBlueskyReaderSession() {
    const owner = _blueskyReaderOwner; if (!owner) throw new Error('Select a Bluesky reader account first.');
    assertBlueskyOwner(owner); const session = await owner.session; assertBlueskyOwner(owner); return session;
}
async function initializeCapturedBluesky(account, context) {
    if (!context) throw new Error('Bluesky requires a captured reader context.');
    const captured = structuredClone(account);
    const owner = _blueskyReaderOwner = { account: captured, context, panelId: 0, selection: { kind: 'timeline', title: 'Timeline' } };
    owner.session = (async () => {
        assertBlueskyOwner(owner);
        const session = await createBlueskyAccountSession(captured);
        assertBlueskyOwner(owner); return session;
    })();
    await owner.session;
    return loadCapturedBluesky(context, owner.selection);
}
async function loadCapturedBluesky(context, selection, cursor = null) {
    const owner = _blueskyReaderOwner;
    assertBlueskyOwner(owner);
    const captured = structuredClone(selection);
    const session = await owner.session;
    if (!context.isCurrent() || !currentBlueskyOwner(owner)) return;
    const page = await fetchCapturedBlueskyPage(session, captured, cursor, context.signal);
    if (!context.isCurrent() || !currentBlueskyOwner(owner)) return;
    owner.context = context; owner.selection = captured;
    await context.render(page.notifications || page.posts, {
        title: cursor ? null : captured.title, append: !!cursor,
        normalize: page.notifications ? normalizeCapturedBlueskyNotification : normalizeBlueskyPost,
        onLoadMore: page.cursor ? () => context.next(next => loadCapturedBluesky(next, captured, page.cursor)) : null,
    });
}
async function normalizeCapturedBlueskyNotification(notification) {
    const labels = { like: 'liked your post', repost: 'reposted your post', follow: 'followed you', mention: 'mentioned you', reply: 'replied to your post', quote: 'quoted your post' };
    if (['mention', 'reply', 'quote'].includes(notification.reason) && notification.record?.text) {
        const item = await normalizeBlueskyPost({ uri: notification.uri, cid: notification.cid, author: notification.author,
            record: notification.record, viewer: {} });
        const author = notification.author || {};
        item.titleHtml = window.CList.ui.socialPostLine(`<a href="#" title="View User Feed">${_he(author.displayName || author.handle || 'Unknown author')}</a>`,
            author.handle, labels[notification.reason], item.desc, item.url, item.feed);
        return item;
    }
    const author = notification.author || {}, label = labels[notification.reason] || notification.reason || 'Notification';
    return { service: 'Bluesky', url: `https://bsky.app/profile/${encodeURIComponent(author.handle || author.did || '')}`,
        title: `${author.displayName || author.handle || 'Unknown author'} ${label}`, desc: label,
        author: author.displayName || author.handle, feed: '@' + (author.handle || ''), guid: notification.uri,
        date: notification.indexedAt, noSummaryDesc: true, bluesky: { handle: author.handle } };
}
function navigateCapturedBluesky(context, selection) {
    if (!context?.isAccountCurrent()) return Promise.resolve();
    return context.navigate(next => loadCapturedBluesky(next, selection), selection.title);
}
function blueskyCurrentNavigation(selection) {
    const owner = _blueskyReaderOwner;
    if (!owner || !currentBlueskyOwner(owner)) return Promise.resolve();
    return navigateCapturedBluesky(owner.context, selection);
}
function fetchBlueskyUserFeed(handle) { return blueskyCurrentNavigation({ kind: 'user', actor: handle, title: '@' + handle }); }
function fetchBlueskyTimeline() { return blueskyCurrentNavigation({ kind: 'timeline', title: 'Timeline' }); }
function fetchBlueskyFavorites() { return blueskyCurrentNavigation({ kind: 'favorites', title: 'Favorites' }); }
function fetchBlueskySearch(query, sort) { return blueskyCurrentNavigation({ kind: 'search', query, sort, title: 'Search' }); }
function displayThread(uri) { return blueskyCurrentNavigation({ kind: 'thread', uri, title: 'Bluesky Thread' }); }
function fetchBlueskyFeed(title, uri) {
    return blueskyCurrentNavigation(uri === 'timeline' ? { kind: 'timeline', title: title || 'Timeline' }
        : uri === 'favorites' ? { kind: 'favorites', title: title || 'Favorites' }
            : uri?.startsWith('user:') ? { kind: 'user', actor: uri.slice(5), title }
                : { kind: 'feed', uri, title: title || 'Feed' });
}
async function showCapturedBlueskyCompose(context, reply = null, rowCurrent = () => true) {
    const owner = _blueskyReaderOwner; assertBlueskyOwner(owner);
    const generation = ++owner.panelId, session = await owner.session;
    if (!context.isAccountCurrent() || !currentBlueskyOwner(owner) || generation !== owner.panelId || !rowCurrent()) return;
    const current = root => root.isConnected && currentBlueskyOwner(owner) && owner.panelId === generation && rowCurrent();
    window.CList.ui.blueskyReader.compose(reply, async (text, feedback) => {
        assertBlueskyOwner(owner); if (!rowCurrent()) throw new Error('The original Bluesky row was replaced.');
        return publishBlueskyRecord(session, text, reply, {
            onWarning: message => { if (current(feedback)) showPostMessage(feedback, message); },
        });
    }, current);
}
async function showCapturedBlueskyPanel(context, kind) {
    const owner = _blueskyReaderOwner; assertBlueskyOwner(owner);
    const generation = ++owner.panelId;
    const current = root => root.isConnected && currentBlueskyOwner(owner) && owner.panelId === generation;
    const view = window.CList.ui.blueskyReader;
    if (kind === 'search') return view.search((query, sort) => navigateCapturedBluesky(context, { kind: 'search', title: 'Search', query, sort }), current);
    const session = await owner.session;
    const feeds = await fetchCapturedBlueskyFeeds(session, kind, context.signal);
    if (!context.isAccountCurrent() || !currentBlueskyOwner(owner) || generation !== owner.panelId) return;
    return view.feeds(feeds, feed => navigateCapturedBluesky(context, { kind: 'feed', title: feed.title, uri: feed.uri }), current);
}
function bindCapturedBlueskyRow(item, row, context) {
    const owner = _blueskyReaderOwner;
    if (!owner || !context?.isAccountCurrent) return;
    const target = structuredClone(item.bluesky || {}), view = window.CList.ui.blueskyReader;
    const itemId = row.querySelector?.('.statusSpecific')?.id || row.id;
    const current = () => row.isConnected && currentBlueskyOwner(owner) && context.isAccountCurrent();
    const values = { favorite: target.likeUri || null, repost: target.repostUri || null }, busy = new Set();
    let buttons;
    const toggle = async action => {
        if (!current() || busy.has(action)) return;
        busy.add(action); view.toggle(buttons[action], !!values[action], true);
        try {
            const session = await owner.session; if (!current()) return;
            const value = await toggleCapturedBlueskyRecord(session, target, action, values[action]);
            values[action] = value;
            if (current()) view.toggle(buttons[action], !!value, false);
        } catch (error) { if (current()) view.error(error); else { console.error('[Bluesky action] expired row', error); showStatusMessage('An earlier Bluesky action could not be confirmed. Check Bluesky before retrying.'); } }
        finally { busy.delete(action); if (current()) view.toggle(buttons[action], !!values[action], false); }
    };
    const navigate = selection => current() && navigateCapturedBluesky(context, selection);
    buttons = view.buttons(row, item, {
        favorite: () => toggle('favorite'), repost: () => toggle('repost'),
        reply: async () => {
            if (!current()) return;
            try { await showCapturedBlueskyCompose(context, { parent: { uri: target.parentUri, cid: target.parentCid }, root: { uri: target.rootUri, cid: target.rootCid } }, current); }
            catch (error) { view.error(error); }
        },
        thread: () => navigate({ kind: 'thread', uri: target.threadUri, title: 'Bluesky Thread' }),
        user: () => navigate({ kind: 'user', actor: target.handle, title: '@' + target.handle }),
        expand: () => { if (current()) toggleEntryExpanded(itemId); },
        browser: () => { if (current()) openInBrowser(target.postUrl || item.url, itemId); },
    });
}
window.CList.readers.Bluesky = {
    supportsRequestContext: true,
    initialize: initializeCapturedBluesky,
    feedFunctions: {
        Post: context => showCapturedBlueskyCompose(context),
        Timeline: context => loadCapturedBluesky(context, { kind: 'timeline', title: 'Timeline' }),
        Notifications: context => loadCapturedBluesky(context, { kind: 'notifications', title: 'Notifications' }),
        Favorites: context => loadCapturedBluesky(context, { kind: 'favorites', title: 'Favorites' }),
        Pinned: context => showCapturedBlueskyPanel(context, 'pinned'),
        Recommended: context => showCapturedBlueskyPanel(context, 'recommended'),
        "What's Hot": context => loadCapturedBluesky(context, { kind: 'feed', title: "What's Hot", uri: 'at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/hot-classic' }),
        Search: context => showCapturedBlueskyPanel(context, 'search'),
    },
    uiActions: ['Post', 'Search', 'Pinned', 'Recommended'],
    onFeedClick: (item, context) => context && navigateCapturedBluesky(context, { kind: 'user', actor: item.bluesky?.handle, title: '@' + item.bluesky?.handle }),
    onAuthorClick: null, statusActions: () => '', bindRow: bindCapturedBlueskyRow,
};
