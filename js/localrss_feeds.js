/// <reference path="./reader-types.js" />
// Panel-owned feed management. Credentials stay in the captured Options binding.
function localrssFeedState(target) {
    return target.feeds ||= { cache: null, inFlight: null, version: 0, searchId: 0,
        editorId: 0, editor: null, pending: new Set() };
}
function _localrssInvalidateFeedCache(target = _localrssOptionsTarget) {
    if (!target) return;
    const state = localrssFeedState(target);
    state.version++; state.searchId++; state.cache = null; state.inFlight = null;
}
async function _localrssFetchAllFeeds(target = _localrssOptionsTarget) {
    if (!target?.current()) return [];
    const state = localrssFeedState(target);
    if (state.cache) return state.cache;
    if (state.inFlight) return state.inFlight;
    const version = state.version;
    const promise = fetchLocalrssPage({ account: target.account, kind: 'feeds', filter: '', offset: 0, limit: 1000 },
        { fetch, headers: target.headers }).then(page => {
            if (target.current() && state.version === version) state.cache = page.items;
            return page.items;
        });
    state.inFlight = promise;
    try { return await promise; }
    finally { if (state.inFlight === promise) state.inFlight = null; }
}
async function _localrssSearchFeeds(target = _localrssOptionsTarget) {
    if (!target?.current()) return;
    const state = localrssFeedState(target), id = ++state.searchId;
    const view = window.CList.ui.localrssFeeds;
    const query = view.input(target, 'localrss-feed-search-input').toLowerCase();
    const current = () => target.current() && state.searchId === id;
    try {
        const feeds = await _localrssFetchAllFeeds(target);
        if (!current()) return;
        const matches = query ? feeds.filter(feed => (feed.title || '').toLowerCase().includes(query)
            || (feed.url || '').toLowerCase().includes(query)) : feeds;
        view.results(target, matches, feed => {
            if (current()) return _localrssOpenFeedEditor(feed, target);
        });
    } catch (error) {
        if (current()) view.error(target, 'search', error);
    }
}
async function _localrssOpenFeedEditor(summary, target = _localrssOptionsTarget) {
    if (!target?.current()) return;
    const state = localrssFeedState(target), id = ++state.editorId;
    state.editor = null;
    const current = () => target.current() && state.editorId === id;
    const view = window.CList.ui.localrssFeeds;
    view.busy(target, 'editor', true);
    view.status(target, 'editor', 'Loading feed…');
    try {
        const data = await requestLocalrssFeed(target.account, 'get', { id: summary.id }, { fetch, headers: target.headers });
        if (!current()) return;
        state.editor = { id: data.feed.id };
        view.editor(target, data.feed);
        view.busy(target, 'editor', state.pending.has('feed:' + data.feed.id));
    } catch (error) { if (current()) view.error(target, 'editor', error); }
}
async function _localrssCreateFeed(target = _localrssOptionsTarget) {
    if (!target?.current()) return;
    const view = window.CList.ui.localrssFeeds, url = view.input(target, 'localrss-new-feed-url');
    if (!url) return;
    return runLocalrssFeedWrite(target, 'create', { url });
}
function _localrssSaveFeed(target = _localrssOptionsTarget) {
    if (!target?.current() || !target.feeds?.editor) return;
    return runLocalrssFeedWrite(target, 'update', { ...window.CList.ui.localrssFeeds.snapshot(target), id: target.feeds.editor.id });
}
function _localrssRetryFeed(target = _localrssOptionsTarget) {
    if (!target?.current() || !target.feeds?.editor) return;
    return runLocalrssFeedWrite(target, 'retry', { id: target.feeds.editor.id });
}
function _localrssDeleteFeed(target = _localrssOptionsTarget) {
    if (!target?.current() || !target.feeds?.editor) return;
    const editor = target.feeds.editor;
    const title = window.CList.ui.localrssFeeds.input(target, 'localrss-edit-feed-title') || 'this feed';
    let used = false;
    _localrssConfirm(`Remove "${title}" from this database? Its entries will be removed from this database too (shared feeds are unaffected elsewhere).`,
        'Delete feed', () => {
            if (used || !target.current() || target.feeds.editor !== editor) return;
            used = true;
            return runLocalrssFeedWrite(target, 'delete', { id: editor.id });
        });
}
async function runLocalrssFeedWrite(target, operation, values) {
    if (!target.current()) return;
    const state = localrssFeedState(target), editor = state.editor;
    const deleteDraft = operation === 'delete' ? JSON.stringify(viewDraft(target)) : null;
    const key = operation === 'create' ? 'create' : 'feed:' + values.id;
    if (state.pending.has(key)) return;
    const view = window.CList.ui.localrssFeeds, area = operation === 'create' ? 'create' : 'editor';
    const owned = () => target.current() && (operation === 'create' || state.editor === editor);
    state.pending.add(key); view.busy(target, area, true);
    view.status(target, area, operation === 'create' ? 'Looking for a feed…' : 'Working…');
    _localrssInvalidateFeedCache(target);
    let data;
    try {
        data = await requestLocalrssFeed(target.account, operation, values, { fetch, headers: target.headers });
    } catch (error) {
        // Unknown write outcomes also invalidate cached reads. Never retry automatically.
        if (owned()) view.error(target, area, error);
        return;
    } finally {
        _localrssInvalidateFeedCache(target);
        state.pending.delete(key);
        if (target.current()) {
            if (area === 'create') view.busy(target, area, false);
            else if (state.editor) view.busy(target, area, state.pending.has('feed:' + state.editor.id));
        }
    }
    if (!target.current()) return;
    if (owned()) {
        if (operation === 'create') {
            view.status(target, area, (data.existing ? 'Already in this database: ' : 'Added: ') + (data.feed.title || data.feed.url));
            view.clearCreate(target, values.url);
        } else if (operation === 'delete') {
            state.editor = null; state.editorId++;
            if (JSON.stringify(viewDraft(target)) === deleteDraft) {
                view.deleted(target);
                view.status(target, area, 'Feed removed.');
            } else {
                view.busy(target, area, true);
                view.status(target, area, 'Feed removed; newer unsaved text retained. Select a feed to continue.');
            }
        } else if (operation === 'retry') {
            view.feedError(target, data.feed);
            view.status(target, area, data.feed.fail_count > 0 ? 'Still failing.' : 'Fetched successfully.');
        } else view.status(target, area, 'Saved.');
    }
    // Refresh failures are independent of the accepted write.
    try {
        await refreshLocalrssOptionsStats(target);
        if (target.current() && operation === 'create' && localrssReadState().kind === 'items'
            && localrssReadState().filter === 'unread') await target.show('unread');
    } catch (error) {
        if (target.current()) localrssOptionsError(target, 'refresh after ' + operation, error);
    }
}

function viewDraft(target) { return window.CList.ui.localrssFeeds.snapshot(target); }
