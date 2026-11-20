/// <reference path="./reader-types.js" />
// Reader coordination. Captured account/selection objects stay outside shared state.
let _mastodonReaderContext = null;
function mastodonReadState() { return window.CList.state.mastodonReading ||= { kind: 'home', value: null }; }
async function initializeMastodonReader(account, context) {
    if (!context?.isCurrent()) return;
    await requestMastodon(account, '/api/v1/accounts/verify_credentials', { signal: context.signal });
    if (!context.isCurrent()) return;
    _mastodonReaderContext = context;
    window.CList.state.mastodonReading = { kind: 'home', value: null };
}
async function renderMastodonPage(context, selection, pageUrl = null) {
    if (!context.isCurrent()) return;
    const account = structuredClone(context.account), captured = structuredClone(selection);
    const page = await readMastodonPage(account, captured, pageUrl, { signal: context.signal });
    if (!context.isCurrent()) return;
    if (!page.items.length && !pageUrl) { window.CList.ui.mastodon.message(context, 'No content available in ' + captured.kind + '.'); return; }
    await context.render(page.items, {
        normalize: raw => normalizeMastodonReaderItem(raw, captured.kind), title: captured.kind,
        typevalue: captured.value, append: !!pageUrl, loadMoreBtnId: 'nextPageButton',
        onLoadMore: page.next ? () => context.next(next => renderMastodonPage(next, captured, page.next)) : null,
    });
    if (captured.kind === 'thread') context.commit(() => window.CList.ui.mastodon.threadHeader(context));
}
async function selectMastodonFeed(context, kind, value = null) {
    if (!context?.isCurrent()) return;
    const selection = { kind, value };
    window.CList.state.mastodonReading = selection; _mastodonReaderContext = context;
    return renderMastodonPage(context, selection);
}
function navigateMastodonFeed(context, kind, value = null) {
    if (!context?.isAccountCurrent()) return Promise.resolve();
    return context.navigate(next => selectMastodonFeed(next, kind, value), kind);
}
function mastodonFeedForm(context, kind, label) {
    const valid = () => context.isAccountCurrent();
    openLeftInterface(window.CList.ui.mastodon.form(label, value => navigateMastodonFeed(context, kind, value), valid));
}
async function mastodonLists(context) {
    const account = structuredClone(context.account);
    const page = await readMastodonPage(account, { kind: 'lists' }, null, { signal: context.signal });
    if (!context.isCurrent()) return;
    openLeftInterface(window.CList.ui.mastodon.lists(page.items,
        id => navigateMastodonFeed(context, 'list', id), () => context.isAccountCurrent()));
}
async function normalizeMastodonReaderItem(raw, kind) {
    if (kind === 'notifications') {
        const actor = raw.account || {}, labels = { mention: 'mentioned you', reblog: 'boosted your post', favourite: 'liked your post', follow: 'followed you', follow_request: 'requested to follow you', poll: 'poll ended', update: 'edited a post', status: 'posted' };
        const header = `${actor.display_name || actor.acct || 'Someone'} (@${actor.acct || ''}) ${labels[raw.type] || raw.type || ''}`;
        if (raw.status) {
            const item = await normalizeMastodonPost(raw.status, escapeHtml(header));
            item.mastodon.headerActor = { acct: actor.acct, label: header }; return item;
        }
        return { service: 'Mastodon', url: actor.url || '', title: header, desc: '', feed: '@' + (actor.acct || ''),
            author: actor.display_name || actor.acct, date: raw.created_at, guid: 'mastodon-notification-' + raw.id,
            mastodon: { acct: actor.acct || '', statusId: null, isReblogged: false, isFavourited: false, isBookmarked: false } };
    }
    const actor = raw.account || {};
    const header = raw.reblog ? `Reblogged by ${escapeHtml(actor.display_name || actor.acct || '')} (@${escapeHtml(actor.acct || '')})` : null;
    const item = await normalizeMastodonPost(raw.reblog || raw, header);
    if (raw.reblog) item.mastodon.headerActor = { acct: actor.acct, label: 'Reblogged by ' + (actor.display_name || actor.acct || '') };
    return item;
}
// Compatibility entry points now dispatch only through a captured reader selection.
function loadMastodonFeed(kind, pageUrl = null, value = null) {
    const context = _mastodonReaderContext;
    if (!context?.isAccountCurrent()) return Promise.resolve();
    return context.navigate(next => pageUrl ? renderMastodonPage(next, { kind, value }, pageUrl) : selectMastodonFeed(next, kind, value), kind);
}
function loadMastodonNotifications() { return loadMastodonFeed('notifications'); }
function loadMastodonLists() { return _mastodonReaderContext?.isAccountCurrent() ? mastodonLists(_mastodonReaderContext) : Promise.resolve(); }
window.CList.readers ||= {};
window.CList.readers.Mastodon = {
    supportsRequestContext: true, initialize: initializeMastodonReader, uiActions: ['Post', 'Lists', 'Hashtag', 'User'],
    feedFunctions: {
        Post: context => showMastodonPost(context), Following: context => selectMastodonFeed(context, 'home'),
        Notifications: context => selectMastodonFeed(context, 'notifications'), Bookmarks: context => selectMastodonFeed(context, 'bookmarks'),
        Lists: mastodonLists, Local: context => selectMastodonFeed(context, 'local'),
        Hashtag: context => mastodonFeedForm(context, 'hashtag', 'hashtag'), User: context => mastodonFeedForm(context, 'user', 'username'),
        Refresh: context => selectMastodonFeed(context, mastodonReadState().kind, mastodonReadState().value),
    },
    onFeedClick: (item, context) => navigateMastodonFeed(context, 'user', '@' + (item.mastodon?.acct || item.author_id || '')),
    onAuthorClick: null, statusActions: () => '', bindRow: bindMastodonRow,
};
