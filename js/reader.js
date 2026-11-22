/// <reference path="./reader-types.js" />
//  reader.js  -  helper and utility functions for the feed reader
//  Part of CList, the next generation of learning and connecting with your community
//
//  Version version 0.1 created by Stephen Downes on January 27, 2025
//
//  Copyright Stephen Downes 2025, downes.ca
//  Licensed under Creative Commons Attribution 4.0 International https://creativecommons.org/licenses/by/4.0/
//
//  This software carries NO WARRANTY OF ANY KIND.
//  This software is provided "AS IS," and you, its user, assume all risks when using it.
// 


// Registry dispatch and request lifetime live here; reader-state.js owns plain
// transitions and reader-view.js owns Read/account/feed-menu rendering.
// initialize(account, context) may use guarded context.render()/commit().
// Legacy feed actions retain zero arguments; context-aware actions opt in with
// handler.supportsRequestContext = true. Service internals migrate separately.

// Ensure readerHandlers exists
if (typeof window.CList.readers === 'undefined') {
    window.CList.readers = {};
}

// Opaque type for HTML that has been sanitized. makeListing requires this for full_content.
// Produce via sanitizeHtml() (rss.js) or any sanitizer that returns new SafeHtml(html).
class SafeHtml {
    constructor(html) { this._html = String(html == null ? '' : html); }
    toString() { return this._html; }
}
window.SafeHtml = SafeHtml;

// escapeHtml is defined in utilities.js
const _he = escapeHtml;

// Escape a plain-text value for use inside a JS string literal delimited by single quotes.
function _heJs(s) {
    return String(s == null ? '' : s)
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'");
}


// This function starts up the reader in the reader div 'read-section'
//  (with some commands located in 'left-content')


let _readerSelection = null;
let _readerContext = null;
let _readerAbort = null;
let _readerPanelVersion = 0;
function readerState() { return window.CList.state.reader ||= createReaderState(); }
function readerSession() {
    const storeUrl = window.CList.config.flaskSiteUrl;
    return { storeUrl, username: window.CList.state.username || '',
        token: getSiteSpecificCookie(storeUrl, window.CList.keys.ACCESS_TOKEN) || '' };
}
// Accountless reader surfaces (public collections/annotations) share the same
// invalidation boundary as selected account readers and Find.
function captureReaderSurface(mode) {
    invalidateReader(mode);
    const abort = _readerAbort = new AbortController();
    const session = readerSession(), requestId = readerState().requestId;
    const target = window.CList.ui.view.feedContainer;
    const isCurrent = () => !abort.signal.aborted && readerState().requestId === requestId && readerState().mode === mode
        && window.CList.ui.view.feedContainer === target && JSON.stringify(session) === JSON.stringify(readerSession());
    const context = { requestId, session, isCurrent, isAccountCurrent: isCurrent,
        signal: abort.signal,
        commit: callback => { if (isCurrent()) callback(); },
        render: (items, options) => isCurrent() ? window.CList.ui.reader.render(items,
            { ...options, isCurrent, rowContext: context }) : Promise.resolve(),
    };
    return context;
}
function invalidateReader(mode = 'idle') {
    if(typeof invalidateFindRequest==='function')invalidateFindRequest();
    _readerAbort?.abort(); _readerSelection = null; _readerContext = null; _readerPanelVersion++;
    window.CList.state.reader = resetReaderState(readerState(), mode);
    window.CList.ui.reader.reset();
}
function readerSelectionCurrent(selection) {
    const session = readerSession();
    return _readerSelection === selection
        && session.storeUrl === selection.session.storeUrl && session.token === selection.session.token
        && session.username === selection.session.username
        && window.CList.accounts.some(record => record.key === selection.key && record.value === selection.value);
}
async function playRead() {
    const view = window.CList.ui.reader;
    if (!isRegistered()) { invalidateReader('public'); view.openPublic(); return; }
    const version = ++_readerPanelVersion, session = readerSession();
    view.open();
    try {
        await ensureAccountsLoaded();
        if (version !== _readerPanelVersion || JSON.stringify(session) !== JSON.stringify(readerSession()) || !isRegistered()) return;
        populateReadAccountList(window.CList.accounts);
    } catch (error) {
        if (version === _readerPanelVersion && JSON.stringify(session) === JSON.stringify(readerSession())) view.accountsFailed(error);
    }
}

// Compatibility entry point for account refreshes and existing callers.
function populateReadAccountList(accounts) {
    const state = window.CList.state?.reader;
    if (state?.accountKey && !accounts.some(record => record.key === state.accountKey
        && (parseAccountValue(record)?.permissions || '').includes('r'))) invalidateReader();
    else if (state?.accountKey && _readerSelection && !readerSelectionCurrent(_readerSelection)) invalidateReader();
    window.CList.ui.reader.accounts(accounts, {
        annotations: !(window.CList.isLocalMode && window.CList.isLocalMode()), collections: isRegistered(),
        calendar: isRegistered(),
        onAccount: switchReaderAccount,
        onAnnotations: async () => {
            invalidateReader('annotations');
            try { await window.showAnnotations('all'); } catch (error) { window.CList.ui.reader.failed(error); }
        },
        onCollections: async () => {
            invalidateReader('collections');
            try { await window.showSavedCollections(); } catch (error) { window.CList.ui.reader.failed(error); }
        },
        onCalendar: async () => {
            invalidateReader('calendar');
            try { await window.showCalendar(); } catch (error) { window.CList.ui.reader.failed(error); }
        },
    });
    if (typeof rssBackgroundFetchAll === 'function') Promise.resolve().then(() => rssBackgroundFetchAll(accounts))
        .catch(error => window.CList.ui.reader.accountsFailed(error));
}

// Function to switch accounts
async function switchReaderAccount(key) {
    const view = window.CList.ui.reader;
    const record = window.CList.accounts.find(account => account.key === key);
    const account = record && parseAccountValue(record);
    if (!account || !(account.permissions || '').includes('r')) { view.invalidAccount(); return; }
    const handler = window.CList.readers[account.type];
    if (!handler) { view.unsupported(account.type); return; }
    const selection = { key, value: record.value, account: structuredClone(account), handler,
        session: readerSession(), initialized: false };
    _readerSelection = selection;
    const feedName = Object.keys(handler.feedFunctions || {}).find(name => name !== 'Refresh' && !handler.uiActions?.includes(name)) || null;
    return runReaderRequest(selection, feedName, async context => {
        await handler.initialize?.(structuredClone(selection.account), context);
        if (context.isCurrent()) selection.initialized = true;
    }, true);
}
async function runReaderRequest(selection, feedName, load, initialize = false) {
    if (!readerSelectionCurrent(selection)) return;
    if(typeof invalidateFindRequest==='function')invalidateFindRequest();
    _readerAbort?.abort(); const abort = _readerAbort = new AbortController();
    const state = window.CList.state.reader = beginReaderRequest(readerState(), selection.key, selection.account.type, feedName);
    const requestId = state.requestId, view = window.CList.ui.reader;
    const isCurrent = () => !abort.signal.aborted && readerState().requestId === requestId && readerSelectionCurrent(selection);
    /** @type {CListReaderContext} */
    const context = { requestId, account: structuredClone(selection.account), feedName, signal: abort.signal, isCurrent,
        commit: callback => { if (isCurrent()) callback(); },
        accountKey: selection.key,
        isAccountCurrent: () => readerSelectionCurrent(selection),
        next: loadNext => isCurrent() && selection.initialized
            ? runReaderRequest(selection, feedName, loadNext) : Promise.resolve(),
        navigate: (loadNext, nextFeedName = feedName) => readerSelectionCurrent(selection) && selection.initialized
            ? runReaderRequest(selection, nextFeedName, loadNext) : Promise.resolve(),
        updateAccount: record => {
            if (!isCurrent() || record.key !== selection.key) return;
            const account = parseAccountValue(record); if (!account) throw new Error('Invalid updated reader account.');
            selection.value = record.value; selection.account = structuredClone(account);
            window.CList.accounts = window.CList.accounts.map(row => row.key === record.key ? { ...record } : row);
            view.selected?.(account);
        },
        render: (items, options) => isCurrent() ? view.render(items, { ...options, isCurrent, rowContext: context }) : Promise.resolve(),
    };
    _readerContext = context;
    view.begin(selection.account, state, Object.keys(selection.handler.feedFunctions || {}),
        name => runReaderFeedAction(selection, name), initialize);
    try {
        await load(context);
        if (!isCurrent()) { if (readerState().requestId === requestId) invalidateReader(); return; }
        window.CList.state.reader = finishReaderRequest(readerState(), requestId);
        view.complete(selection.account, readerState());
        setTimeout(() => { if (isCurrent()) view.clearStatus(); }, 5000);
    } catch (error) {
        if (!isCurrent()) { if (readerState().requestId === requestId) invalidateReader(); return; }
        const message = error?.message || String(error);
        window.CList.state.reader = finishReaderRequest(readerState(), requestId, message);
        view.failed(new Error(message)); view.busy(initialize);
    }
}
async function runReaderFeedAction(selection, name) {
    if (!selection.initialized || !readerSelectionCurrent(selection)) return;
    const action = selection.handler.feedFunctions?.[name];
    if (typeof action !== 'function') return;
    if (selection.handler.uiActions?.includes(name)) {
        const context = _readerContext;
        if (!context?.isCurrent()) return;
        try { await (selection.handler.supportsRequestContext ? action(context) : action()); }
        catch (error) { if (context.isCurrent()) window.CList.ui.reader.failed(error); }
        return;
    }
    const feed = name === 'Refresh' ? readerState().feedName : name;
    return runReaderRequest(selection, feed, context => selection.handler.supportsRequestContext
        ? action(context) : action());
}

// Controlled reload entry point for service options/reconnect callbacks.
function reloadReader(type, load, feedName = readerState().feedName) {
    const selection = _readerSelection;
    if (!selection?.initialized || selection.account.type !== type || !readerSelectionCurrent(selection)) return Promise.resolve();
    return runReaderRequest(selection, feedName, load);
}

// Compatibility entry point for search providers outside account-backed reading.
function setupFeedButtons(instanceType) {
    const handler = window.CList.readers[instanceType];
    const selection = _readerSelection;
    if (selection?.account.type === instanceType) {
        window.CList.ui.reader.menu(Object.keys(handler?.feedFunctions || {}), readerState().feedName,
            name => runReaderFeedAction(selection, name), readerState().status === 'loading');
    } else {
        invalidateReader('external');
        const names = Object.keys(handler?.feedFunctions || {});
        const generation = readerState().requestId;
        const run = async name => {
            if (readerState().requestId !== generation) return;
            window.CList.state.reader = { ...readerState(), feedName: name === 'Refresh' ? readerState().feedName : name };
            window.CList.ui.reader.menu(names, readerState().feedName, run, false);
            try { await handler.feedFunctions[name](); }
            catch (error) { if (readerState().requestId === generation) window.CList.ui.reader.failed(error); }
        };
        window.CList.state.reader = { ...readerState(), feedName: names.find(name => name !== 'Refresh') || null };
        window.CList.ui.reader.menu(names, readerState().feedName, run, false);
    }
}
