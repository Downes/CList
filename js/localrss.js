/// <reference path="./clist-types.js" />
//  localrss.js  -  LocalRSS personal-database reader for CList
//  Part of CList, the next generation of learning and connecting with your community
//
//  Version 0.1 created by Stephen Downes on October 31, 2026
//
//  Copyright Stephen Downes 2026, downes.ca
//  Licensed under Creative Commons Attribution 4.0 International https://creativecommons.org/licenses/by/4.0/
//
//  This software carries NO WARRANTY OF ANY KIND.
//  This software is provided "AS IS," and you, its user, assume all risks when using it.
//
//  Reads a single (serviceUrl, database) pair against a LocalRSS instance's own
//  /api/items, /api/mark_read, /api/toggle_bookmark routes -- no local storage,
//  the server is the store. One CList account = one LocalRSS database (see
//  /srv/apps/localrss_reader/CLAUDE.md, "Architecture: Global Harvest Store").

// ---- Account schema ----

window.CList.schemas = window.CList.schemas || {};
window.CList.accountHooks = window.CList.accountHooks || {};
window.CList.accountHooks.LOCALRSS = {
    /** @param {CListAccountFormContext} context */
    decorateForm(context) {
        if (context.mode === 'create') context.container.appendChild(_localrssBuildAccountOpmlSection(context.root));
    },
};

window.CList.schemas['LOCALRSS'] = {
    type: 'LOCALRSS',
    instanceFromKey: true,
    kvKey: { label: 'Account Name', placeholder: 'My Feeds' },
    fields: [
        { key: 'title',       label: 'Title',               editable: true, inputType: 'text', placeholder: 'My Feeds',                   default: '' },
        { key: 'permissions', label: 'Permissions',         editable: true, inputType: 'text', placeholder: 'r',                           default: 'r' },
        { key: 'serviceUrl',  label: 'LocalRSS Service URL', editable: true, inputType: 'text', placeholder: window.CList.defaults.LOCALRSS, default: window.CList.defaults.LOCALRSS },
        { key: 'database',    label: 'Database',            editable: true, inputType: 'text', placeholder: 'rss',                         default: 'rss' },
        { key: 'collectionItems', inputType: 'hidden', default: '' },
        { key: 'collectionId', inputType: 'hidden', default: '' },
        // Set automatically from the database-wide audio-majority test -- see
        // syncLocalrssReaderAudio() -- never user-edited. Drives the podcast
        // icon in the sidebar account list (accountIcon() in reader.js/kvstore.js).
        { key: 'hasAudio',    label: 'Has audio episodes',  editable: false, inputType: 'text', placeholder: '',                            default: false },
    ]
};

// ---- Reader handler ----

(function () {
    window.CList.readers = window.CList.readers || {};
    window.CList.readers['LOCALRSS'] = {
        name: 'LOCALRSS', display: 'LocalRSS', icon: 'rss_feed',
        description: 'Read a personal LocalRSS database',
        type: 'feed',
        supportsRequestContext: true,
        uiActions: ['Options'],
        initialize: async (accountData, context) => initializeLocalrss(accountData, context),
        editCollection: async (key, account) => {
            const resolved = { ...account };
            await _localrssResolveServiceUrl(resolved);
            await openPublicFeedCollection(key, account, resolved._effectiveServiceUrl);
        },
        saveCollection: (request, session) => savePublicFeedCollection(request.feedAccount,
            request.name, request.items, request.identity.id, session.token, session.encKey),
        feedFunctions: {
            'Unread':     context => loadLocalrssView(context, { filter: 'unread', kind: 'items' }),
            'All':        context => loadLocalrssView(context, { filter: 'all', kind: 'items' }),
            'Bookmarked': context => loadLocalrssView(context, { filter: 'bookmarked', kind: 'items' }),
            'Feeds':      context => loadLocalrssView(context, { kind: 'feeds' }),
            'Refresh':    context => loadLocalrssView(context),
            'Options':    context => localrssOptionsOverlay(context),
        },
        onFeedClick:   null,
        onAuthorClick: null,
        statusActions: (item, itemID) => {
            let a = '';
            if (item._hasExpandableContent) {
                a += `<button class="clist-action-btn" title="Expand" `
                   + `onclick="toggleEntryExpanded('${itemID}');"><span class="material-icons md-18 md-light">zoom_out_map</span></button>`;
            }
            if (item.audioIcon) { a += item.audioIcon; }
            if (item.link && /^https?:\/\//i.test(item.link)) {
                const safeLink = item.link.replace(/'/g, '%27');
                a += `<button class="clist-action-btn" title="Open in browser" `
                   + `onclick="openInBrowser('${safeLink}', '${itemID}')">`
                   + `<span class="material-icons md-18 md-light">launch</span></button>`;
            }
            const ri = item.readAt ? 'visibility_off' : 'visibility';
            const rt = item.readAt ? 'Mark unread' : 'Mark read';
            a += `<button class="clist-action-btn" `
               + `onclick="localrssToggleRead(${item.localrssActionId},this)" title="${rt}">`
               + `<span class="material-icons md-18 md-light">${ri}</span></button>`;
            const bi = 'star';
            const bt = item.bookmarked ? 'Remove bookmark' : 'Bookmark';
            a += `<button class="clist-action-btn${item.bookmarked ? ' action-active' : ''}" `
               + `onclick="localrssToggleBookmark(${item.localrssActionId},this)" title="${bt}">`
               + `<span class="material-icons md-18 md-light">${bi}</span></button>`;
            return a;
        }
    };

    // Pseudo-service used only as the item.service tag for rows in the "Feeds" list
    // view (a feed's own title/url/description, not its entries) -- never a
    // switchable account type (no schema, no initialize/feedFunctions). Needs its
    // own entry rather than reusing 'LOCALRSS' because makeListing() resolves
    // statusActions by service, and LOCALRSS's own statusActions wires Mark-read/
    // Bookmark to item.entryId -- an entry id. Reusing it here would send a feed's
    // numeric id to the entry-toggle endpoints.
    window.CList.readers['LOCALRSS_FEED'] = {
        name: 'LOCALRSS_FEED', display: 'LocalRSS Feeds', icon: 'rss_feed',
        description: 'A single feed (not its entries) in a LocalRSS database feed list',
        type: 'feed',
        initialize: null,
        feedFunctions: null,
        onFeedClick:   null,
        onAuthorClick: null,
        statusActions: (item, itemID) => {
            let a = '';
            if (item.link && /^https?:\/\//i.test(item.link)) {
                const safeLink = item.link.replace(/'/g, '%27');
                a += `<button class="clist-action-btn" title="Open feed URL in browser" `
                   + `onclick="openInBrowser('${safeLink}', '${itemID}')">`
                   + `<span class="material-icons md-18 md-light">launch</span></button>`;
            }
            a += `<button class="clist-action-btn" title="Show posts" `
               + `onclick="localrssShowBoundFeedPosts(${item.localrssFeedPostsId})">`
               + `<span class="material-icons md-18 md-light">list</span></button>`;
            return a;
        }
    };
})();

// ---- Module state ----

let localrssCurrentAccount = null;
let localrssFilter = 'unread';
let localrssOffset = 0;
const LOCALRSS_PAGE_SIZE = 50;

function localrssReportLoadError(e) {
    console.error(e);
    showErrorModal('Could not load LocalRSS items: ' + e.message, { title: 'LocalRSS error' });
}

// ---- Auth / request helpers ----
// A kvstore-issued bearer token plus the issuing instance, verified locally by the server.

function _localrssAuthHeaders() {
    const token = (typeof getSiteSpecificCookie === 'function')
        ? getSiteSpecificCookie(window.CList.config.flaskSiteUrl, window.CList.keys.ACCESS_TOKEN) || ''
        : '';
    const headers = {};
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
        headers['X-Kvstore-Url'] = window.CList.config.flaskSiteUrl;
    }
    return headers;
}

// ---- Local-first / remote-fallback resolution ----
// LocalRSS is meant to run on the user's own machine. Every account probes the
// conventional local port first, regardless of its configured serviceUrl -- if
// something answers there, it's used for this session in place of serviceUrl.
// Resolved once per account activation (initializeLocalrss), not re-probed on
// every request; _localrssReconnect() re-probes on demand since local
// availability can change mid-session (e.g. the user starts/stops their own
// LocalRSS container after CList is already open).
const LOCALRSS_LOCAL_URL = 'http://localhost:8787';
const LOCALRSS_PROBE_TIMEOUT_MS = 1500;

async function _localrssProbeLocal() {
    try {
        // Any HTTP response -- even a 401 from the unauthenticated probe request --
        // means a LocalRSS instance is listening and answering. Only a network
        // error or timeout (fetch throws) means "not there".
        await fetch(`${LOCALRSS_LOCAL_URL}/api/config`, { signal: AbortSignal.timeout(LOCALRSS_PROBE_TIMEOUT_MS) });
        return true;
    } catch (err) {
        return false;
    }
}

// base64url-encodes an origin for the launcher's generic proxy path
// (/proxy/<encoded-origin>/...) -- must match _decode_proxy_origin in launcher.py.
function _localrssProxyEncodeOrigin(origin) {
    return base64UrlEncode(origin);
}

async function _localrssResolveServiceUrl(accountData) {
    const usingLocal = await _localrssProbeLocal();
    if (usingLocal) {
        accountData._effectiveServiceUrl = LOCALRSS_LOCAL_URL;
    } else if (window._launcherConfig && window._launcherConfig.proxyBase && accountData.serviceUrl) {
        // Running under the desktop launcher and falling back to a remote instance:
        // route through the launcher's local proxy so the browser's same-origin
        // request bypasses CORS, while the launcher forwards it to the real
        // serviceUrl server-side. Works for any remote LocalRSS the user has
        // configured, not just a built-in default.
        const encoded = _localrssProxyEncodeOrigin(accountData.serviceUrl.replace(/\/$/, ''));
        accountData._effectiveServiceUrl = `${window._launcherConfig.proxyBase}/${encoded}`;
    } else {
        accountData._effectiveServiceUrl = accountData.serviceUrl;
    }
    accountData._usingLocal = usingLocal;
}

// Manual re-probe + reload, for when local availability changes mid-session.
async function _localrssReconnect() {
    return reloadReader('LOCALRSS', context => loadLocalrssView(context, { reconnect: true }));
}

function _localrssConnectionStatusText(accountData) {
    if (accountData._usingLocal) return `Connected to local instance (${LOCALRSS_LOCAL_URL})`;
    const viaProxy = accountData._effectiveServiceUrl
        && accountData._effectiveServiceUrl !== accountData.serviceUrl;
    const target = accountData.serviceUrl || '(no service URL)';
    return viaProxy ? `Connected to ${target} (via launcher proxy)` : `Connected to ${target}`;
}

function _localrssPlainText(html) {
    const d = document.createElement('div');
    d.innerHTML = html || '';
    return d.textContent || '';
}

// Shared LocalRSS panel helpers.
function _localrssSectionHeading(text) {
    const h = document.createElement('h4');
    h.textContent = text;
    return h;
}

function _localrssConfirm(message, title, onConfirm) {
    const msg = document.createElement('p');
    msg.textContent = message;

    buildDialogModal(title, msg, [
        { label: 'OK', onClick: (close) => { close(); onConfirm(); } },
        { label: 'Cancel', secondary: true, onClick: (close) => close() }
    ]);
}
