//  rss.js  -  RSS feed collection reader for CList
//  Part of CList, the next generation of learning and connecting with your community
//
//  Version 0.1 created by Stephen Downes on May 13, 2025
//
//  Copyright National Research Council of Canada 2025
//  Licensed under Creative Commons Attribution 4.0 International https://creativecommons.org/licenses/by/4.0/
//
//  This software carries NO WARRANTY OF ANY KIND.
//  This software is provided "AS IS," and you, its user, assume all risks when using it.

// ---- Account schemas ----

window.accountSchemas = window.accountSchemas || {};

// OPML2JSON: the proxy service used to fetch RSS/OPML feeds server-side.
// Key = service URL. One entry overrides the default; omitting it uses the built-in default.
window.accountSchemas['OPML2JSON'] = {
    type: 'OPML2JSON',
    instanceFromKey: true,
    kvKey: { label: 'Service URL', placeholder: 'https://opml2json.downes.ca' },
    fields: [
        { key: 'title',       label: 'Service Name', editable: true, inputType: 'text', placeholder: 'Feed Proxy', default: '' },
        { key: 'permissions', label: 'Permissions',  editable: true, inputType: 'text', placeholder: 's',          default: 's' },
    ]
};

window.accountSchemas['RSS'] = {
    type: 'RSS',
    instanceFromKey: true,
    kvKey: { label: 'Collection Name', placeholder: 'My News' },
    fields: [
        { key: 'title',       label: 'Title',       editable: true, inputType: 'text', placeholder: 'My News', default: '' },
        { key: 'permissions', label: 'Permissions', editable: true, inputType: 'text', placeholder: 'r',       default: 'r' },
    ]
};

// ---- Reader handler ----

(function () {
    window.readerHandlers = window.readerHandlers || {};
    window.readerHandlers['RSS'] = {
        name: 'RSS', display: 'RSS', icon: 'rss_feed',
        description: 'Read RSS feed collections',
        type: 'feed',
        initialize: () => {},
        feedFunctions: {
            'Unread':     () => { rssActiveFeedFilter = null; rssFilter = 'unread';     rssDisplayEntries(); },
            'All':        () => { rssActiveFeedFilter = null; rssFilter = 'all';        rssDisplayEntries(); },
            'Bookmarked': () => { rssActiveFeedFilter = null; rssFilter = 'bookmarked'; rssDisplayEntries(); },
            'Refresh':    () => rssRefresh(),
        },
        statusActions: (item, itemID) => {
            let a = '';
            if (item.full_content) {
                a += `<button class="material-icons md-18 md-light" `
                   + `onclick="toggleFormDisplay('${itemID}-content');`
                   + `toggleFormDisplay('${itemID}-summary');">zoom_out_map</button>`;
            }
            if (item.link) {
                a += `<button class="material-icons md-18 md-light" `
                   + `onclick="window.open('${item.link}','_blank','width=800,height=600,scrollbars=yes')">`
                   + `launch</button>`;
            }
            const ri = item.readAt ? 'drafts' : 'mail';
            const rt = item.readAt ? 'Mark unread' : 'Mark read';
            a += `<button class="material-icons md-18 md-light" `
               + `onclick="rssToggleRead('${item.entryId}',this)" title="${rt}">${ri}</button>`;
            const bi = item.bookmarked ? 'bookmark' : 'bookmark_border';
            const bt = item.bookmarked ? 'Remove bookmark' : 'Bookmark';
            a += `<button class="material-icons md-18 md-light" `
               + `onclick="rssToggleBookmark('${item.entryId}',this)" title="${bt}">${bi}</button>`;
            return a;
        }
    };
})();

// ---- Module state ----

let rssCurrentAccount = null;
let rssFilter = 'unread';
let rssActiveFeedFilter = null;

let _rssSortedEntries = [];
let _rssDisplayOffset = 0;
let _rssTitleMap  = {};
let _rssAuthorMap = {};

const _rssFetchState    = {}; // collectionKey → 'fetching' | 'done'
const _rssFetchProgress = {}; // collectionKey → { checked, total, updated, errors, url }

const RSS_PAGE_SIZE = 50;
const RSS_OPML2JSON_DEFAULT = 'https://opml2json.downes.ca';
const RSS_RETENTION = 30 * 86400; // seconds

// Return the opml2json service URL to use for this session:
// - desktop (localhost/127.0.0.1): assume localrss is running on :8787
// - otherwise: check accounts for an OPML2JSON entry, fall back to built-in default
async function getOpml2jsonUrl() {
    const h = window.location.hostname;
    if (h === 'localhost' || h === '127.0.0.1') return 'http://localhost:8787';
    try {
        const accts = (Array.isArray(window.accounts) && window.accounts.length)
            ? window.accounts
            : await getAccounts(flaskSiteUrl);
        const found = accts.find(a => {
            const d = parseAccountValue(a);
            return d && d.type === 'OPML2JSON';
        });
        if (found) {
            const d = parseAccountValue(found);
            if (d && d.instance) return d.instance;
        }
    } catch (e) {
        console.warn('Could not look up OPML2JSON account, using default:', e);
    }
    return RSS_OPML2JSON_DEFAULT;
}

// ---- IndexedDB helpers ----

const _RSS_DB_NAME = 'clist_rss';
let _rssDb = null;

function _rssOpenDb() {
    if (_rssDb) return Promise.resolve(_rssDb);
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(_RSS_DB_NAME, 1);
        req.onupgradeneeded = ev => {
            const db = ev.target.result;
            if (!db.objectStoreNames.contains('feeds')) {
                const fs = db.createObjectStore('feeds', { keyPath: 'url' });
                fs.createIndex('collectionKey', 'collectionKey');
            }
            if (!db.objectStoreNames.contains('entries')) {
                const es = db.createObjectStore('entries', { keyPath: 'entryId' });
                es.createIndex('collectionKey', 'collectionKey');
                es.createIndex('feedUrl',       'feedUrl');
            }
        };
        req.onsuccess = ev => { _rssDb = ev.target.result; resolve(_rssDb); };
        req.onerror   = ()  => reject(req.error);
    });
}

async function _rssGet(store, key) {
    const db = await _rssOpenDb();
    return new Promise((resolve, reject) => {
        const req = db.transaction(store, 'readonly').objectStore(store).get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror   = () => reject(req.error);
    });
}

async function _rssPut(store, obj) {
    const db = await _rssOpenDb();
    return new Promise((resolve, reject) => {
        const req = db.transaction(store, 'readwrite').objectStore(store).put(obj);
        req.onsuccess = () => resolve();
        req.onerror   = () => reject(req.error);
    });
}

async function _rssAdd(store, obj) {
    const db = await _rssOpenDb();
    return new Promise((resolve, reject) => {
        const tx  = db.transaction(store, 'readwrite');
        const req = tx.objectStore(store).add(obj);
        req.onsuccess = () => resolve(true);
        req.onerror   = ev => {
            if (req.error && req.error.name === 'ConstraintError') {
                ev.preventDefault();   // stop transaction abort
                ev.stopPropagation();
                resolve(false);        // entry already exists — skip
            } else {
                reject(req.error);
            }
        };
    });
}

function _rssPlainText(html) {
    const d = document.createElement('div');
    d.innerHTML = html || '';
    return d.textContent || '';
}

async function _rssGetByIndex(store, idx, val) {
    const db = await _rssOpenDb();
    return new Promise((resolve, reject) => {
        const req = db.transaction(store, 'readonly')
                      .objectStore(store).index(idx).getAll(val);
        req.onsuccess = () => resolve(req.result || []);
        req.onerror   = () => reject(req.error);
    });
}

// ---- Scoring (port of localrss post_score) ----
// Favours infrequent feeds and recent posts.

function _rssScore(publishedTs, monthCount, now) {
    const r   = Math.max(monthCount || 0, 0.25);
    const age = Math.max((now - publishedTs) / 86400, 0);
    return (1 / Math.pow(r + 1, 0.7)) * Math.exp(-0.22 * age);
}

// ---- Stable entry ID (djb2-style hash, sync) ----

function _rssEntryId(feedUrl, guid) {
    const s = feedUrl + '\x00' + (guid || '');
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = (h * 33 ^ s.charCodeAt(i)) >>> 0;
    return 'e' + h.toString(36) + s.length.toString(36);
}

// ---- HTML sanitizer for feed content ----
// Keeps safe formatting tags; strips scripts, iframes, objects, forms, and
// event/style attributes. Dangerous tags are removed with children; unknown
// tags are unwrapped (children kept).

const _RSS_STRIP_WITH_CHILDREN = new Set([
    'script','noscript','style','iframe','frame','frameset',
    'object','embed','applet','form','input','button','select','textarea',
]);
const _RSS_ALLOWED_TAGS = new Set([
    'a','abbr','b','blockquote','br','caption','cite','code','col','colgroup',
    'dd','del','details','dfn','div','dl','dt','em','figcaption','figure',
    'h1','h2','h3','h4','h5','h6','hr','i','img','ins','kbd','li','mark',
    'ol','p','pre','q','s','samp','small','span','strong','sub','summary',
    'sup','table','tbody','td','tfoot','th','thead','time','tr','u','ul','var',
]);
const _RSS_ALLOWED_ATTRS = {
    'a':   new Set(['href','title','target','rel']),
    'img': new Set(['src','alt','title','width','height','loading']),
    'td':  new Set(['colspan','rowspan']),
    'th':  new Set(['colspan','rowspan','scope']),
    'col': new Set(['span']),
    'time':new Set(['datetime']),
};

function _rssSanitizeHtml(html) {
    if (!html) return '';
    const doc = new DOMParser().parseFromString(html, 'text/html');

    function walk(node) {
        const children = Array.from(node.childNodes);
        for (const child of children) {
            if (child.nodeType !== Node.ELEMENT_NODE) continue;
            const tag = child.tagName.toLowerCase();

            if (_RSS_STRIP_WITH_CHILDREN.has(tag)) {
                child.remove();
                continue;
            }

            // Recurse first so inner dangerous nodes are gone before we decide
            walk(child);

            if (!_RSS_ALLOWED_TAGS.has(tag)) {
                // Unwrap: keep children, drop the element itself
                child.replaceWith(...child.childNodes);
                continue;
            }

            // Strip disallowed attributes
            const allowed = _RSS_ALLOWED_ATTRS[tag] || new Set();
            for (const attr of Array.from(child.attributes)) {
                const name = attr.name.toLowerCase();
                if (!allowed.has(name) || name.startsWith('on')) {
                    child.removeAttribute(attr.name);
                    continue;
                }
                // Block javascript: and data: URLs on href/src
                if (name === 'href' || name === 'src') {
                    const v = attr.value.replace(/\s/g, '').toLowerCase();
                    if (v.startsWith('javascript:') || v.startsWith('data:')) {
                        child.removeAttribute(attr.name);
                    }
                }
            }
            // Open links in new tab
            if (tag === 'a') {
                child.setAttribute('target', '_blank');
                child.setAttribute('rel', 'noopener noreferrer');
            }
        }
    }

    walk(doc.body);
    return doc.body.innerHTML;
}

// ---- Fetch one feed via opml2json /fetch_feed ----

async function _rssFetchFeed(feedUrl, collectionKey, serviceUrl) {
    try {
        const token = (typeof getSiteSpecificCookie === 'function')
            ? getSiteSpecificCookie(flaskSiteUrl, 'access_token') || ''
            : '';
        const headers = {};
        // Auth headers only needed for the hosted opml2json service, not localhost
        if (token && serviceUrl && !serviceUrl.startsWith('http://localhost')) {
            headers['Authorization']  = `Bearer ${token}`;
            headers['X-Kvstore-Url'] = flaskSiteUrl;
        }
        const resp = await fetch(
            `${serviceUrl}/fetch_feed?url=${encodeURIComponent(feedUrl)}`,
            { headers }
        );
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        if (!data.ok) throw new Error(data.error || 'fetch_feed failed');

        const now    = Math.floor(Date.now() / 1000);
        const cutoff = now - RSS_RETENTION;

        let added = 0;
        for (const it of (data.items || [])) {
            const pub = it.published_ts || now;
            if (pub < cutoff) continue;
            const eid = _rssEntryId(feedUrl, it.guid || it.link || it.title || '');
            const wasAdded = await _rssAdd('entries', {
                entryId: eid, feedUrl, collectionKey,
                guid:    it.guid  || it.link  || '',
                title:   it.title || '(no title)',
                link:    it.guid  || it.link  || '',
                author:  it.author || '',
                published:   pub,
                contentHtml: it.full_content || it.summary || '',
                readAt: null, bookmarked: 0,
                createdAt: now,
            });
            if (wasAdded) added++;
        }

        // Recompute 30-day post count for this feed (used for scoring)
        const all = await _rssGetByIndex('entries', 'feedUrl', feedUrl);
        const mc  = all.filter(e => e.published >= now - 30 * 86400).length;
        await _rssPut('feeds', {
            url: feedUrl, collectionKey,
            title:  data.title  || feedUrl,
            author: data.author || '',
            lastFetched: now, monthCount: mc,
        });
        return { added };
    } catch (err) {
        console.error(`RSS: failed fetching ${feedUrl}:`, err);
        return { error: true };
    }
}

// ---- Public API ----

function rssFilterByFeed(feedUrl) {
    rssActiveFeedFilter = feedUrl;
    rssDisplayEntries();
}

async function initializeRSS(accountData) {
    rssCurrentAccount = accountData;
    rssFilter = 'unread';
    const key = accountData.instance;
    if (_rssFetchState[key]) {
        // Background fetch already started or done — show what's in IndexedDB
        // (progress banner will appear automatically if still fetching)
        await rssDisplayEntries();
    } else {
        // Not fetched yet this session — start now
        await rssRefresh();
    }
}

// Called by the Refresh feed button — forces a re-fetch from scratch
async function rssRefresh() {
    if (!rssCurrentAccount) return;
    const key = rssCurrentAccount.instance;
    const fc  = document.getElementById('feed-container');
    if (fc) fc.innerHTML = '<p class="feed-status-message" id="rss-fetch-status">Fetching feeds…</p>';
    delete _rssFetchState[key];
    _rssBgFetch(rssCurrentAccount).catch(e => console.error('RSS refresh failed:', e));
}

// Internal: fetch all feeds for a collection in the background.
// Safe to call fire-and-forget; updates the UI if the collection is currently open.
async function _rssBgFetch(accountData) {
    const key   = accountData.instance;
    const feeds = accountData.feeds || [];
    _rssFetchState[key]    = 'fetching';
    _rssFetchProgress[key] = { checked: 0, total: feeds.length, updated: 0, errors: 0, url: '' };

    if (!feeds.length) {
        _rssFetchState[key] = 'done';
        if (rssCurrentAccount?.instance === key) await rssDisplayEntries();
        return;
    }

    const serviceUrl = await getOpml2jsonUrl();
    await Promise.all(feeds.map(async f => {
        const result = await _rssFetchFeed(f.url, key, serviceUrl);
        const p = _rssFetchProgress[key];
        p.checked++;
        if (result?.error)          p.errors++;
        else if (result?.added > 0) p.updated++;
        p.url = f.url;
        _rssUpdateProgressDisplay(key);
    }));

    _rssFetchState[key]    = 'done';
    _rssFetchProgress[key] = null;
    if (rssCurrentAccount?.instance === key) await rssDisplayEntries();
}

function _rssUpdateProgressDisplay(key) {
    if (rssCurrentAccount?.instance !== key) return;
    const el = document.getElementById('rss-fetch-status');
    if (!el) return;
    const p = _rssFetchProgress[key];
    if (!p) return;
    el.textContent =
        `Fetching: checked ${p.checked}/${p.total} (updated=${p.updated}, errors=${p.errors}) — ${p.url}`;
}

// Called from reader.js after accounts are loaded to pre-fetch all RSS collections.
function rssBackgroundFetchAll(accounts) {
    for (const acct of (accounts || [])) {
        const data = parseAccountValue(acct);
        if (!data || data.type !== 'RSS') continue;
        if (_rssFetchState[data.instance]) continue; // already running or done
        _rssBgFetch(data).catch(e => console.error(`RSS bg fetch failed (${data.instance}):`, e));
    }
}

async function rssDisplayEntries() {
    if (!rssCurrentAccount) return;
    const fc = document.getElementById('feed-container');
    if (!fc) return;

    const key    = rssCurrentAccount.instance;
    const now    = Math.floor(Date.now() / 1000);
    const cutoff = now - RSS_RETENTION;

    let entries = await _rssGetByIndex('entries', 'collectionKey', key);
    entries = entries.filter(e => e.published >= cutoff);
    if (rssActiveFeedFilter)        entries = entries.filter(e => e.feedUrl === rssActiveFeedFilter);
    if (rssFilter === 'unread')     entries = entries.filter(e => !e.readAt);
    if (rssFilter === 'bookmarked') entries = entries.filter(e =>  e.bookmarked);

    // Build per-feed maps for scoring, titles, and authors
    const feedMetas  = await _rssGetByIndex('feeds', 'collectionKey', key);
    const mcMap      = Object.fromEntries(feedMetas.map(f => [f.url, f.monthCount || 0]));
    _rssTitleMap     = Object.fromEntries(feedMetas.map(f => [f.url, f.title  || f.url]));
    _rssAuthorMap    = Object.fromEntries(feedMetas.map(f => [f.url, f.author || '']));
    entries.forEach(e => { e._score = _rssScore(e.published, mcMap[e.feedUrl] || 0, now); });
    entries.sort((a, b) => b._score - a._score);

    _rssSortedEntries = entries;
    _rssDisplayOffset = 0;

    fc.innerHTML = '';
    fc.appendChild(createFeedHeader(rssCurrentAccount.title || 'RSS'));

    // Show live progress banner if a background fetch is running for this collection
    if (_rssFetchState[key] === 'fetching') {
        const banner = document.createElement('p');
        banner.className = 'feed-status-message';
        banner.id = 'rss-fetch-status';
        const p = _rssFetchProgress[key];
        banner.textContent = p && p.total
            ? `Fetching: checked ${p.checked}/${p.total} (updated=${p.updated}, errors=${p.errors}) — ${p.url}`
            : 'Fetching feeds…';
        fc.appendChild(banner);
    }

    if (!entries.length) {
        // Don't show "caught up" while a fetch is still in progress
        if (_rssFetchState[key] !== 'fetching') {
            const p = document.createElement('p');
            p.className = 'feed-status-message';
            p.textContent = rssFilter === 'bookmarked' ? 'No bookmarked items.'
                          : rssFilter === 'unread'     ? 'All caught up — no unread items.'
                          :                              'No items found.';
            fc.appendChild(p);
        }
        return;
    }

    _rssAppendPage();
}

function _rssAppendPage() {
    const fc = document.getElementById('feed-container');
    if (!fc) return;

    document.getElementById('rss-load-more')?.remove();

    const page = _rssSortedEntries.slice(_rssDisplayOffset, _rssDisplayOffset + RSS_PAGE_SIZE);
    for (const e of page) {
        fc.appendChild(makeListing({
            service:    'RSS',
            url:        e.link,
            title:      e.title,
            desc:       _rssPlainText(e.contentHtml),
            feed:       _rssTitleMap[e.feedUrl]  || e.feedUrl,
            titleHtml:  `<strong>${e.title.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</strong>`,
            feedAction: `rssFilterByFeed('${e.feedUrl}'); return false;`,
            author:     e.author || _rssAuthorMap[e.feedUrl] || '',
            date:       new Date(e.published * 1000).toLocaleDateString(),
            full_content: _rssSanitizeHtml(e.contentHtml),
            link:       e.link,
            entryId:    e.entryId,
            readAt:     e.readAt,
            bookmarked: e.bookmarked,
        }));
    }
    _rssDisplayOffset += page.length;

    const remaining = _rssSortedEntries.length - _rssDisplayOffset;
    if (remaining > 0) {
        const btn = document.createElement('button');
        btn.id = 'rss-load-more';
        btn.className = 'kv-action-btn';
        btn.style.cssText = 'display:block;margin:12px auto;';
        btn.textContent = `Load more (${remaining} remaining)`;
        btn.onclick = _rssAppendPage;
        fc.appendChild(btn);
    }
}

async function rssToggleRead(entryId, btn) {
    const e = await _rssGet('entries', entryId);
    if (!e) return;
    e.readAt = e.readAt ? null : Math.floor(Date.now() / 1000);
    await _rssPut('entries', e);
    if (btn) {
        btn.textContent = e.readAt ? 'drafts' : 'mail';
        btn.title       = e.readAt ? 'Mark unread' : 'Mark read';
    }
    if (rssFilter === 'unread' && e.readAt) btn?.closest('.status-box')?.remove();
}

async function rssToggleBookmark(entryId, btn) {
    const e = await _rssGet('entries', entryId);
    if (!e) return;
    e.bookmarked = e.bookmarked ? 0 : 1;
    await _rssPut('entries', e);
    if (btn) {
        btn.textContent = e.bookmarked ? 'bookmark' : 'bookmark_border';
        btn.title       = e.bookmarked ? 'Remove bookmark' : 'Bookmark';
    }
    if (rssFilter === 'bookmarked' && !e.bookmarked) btn?.closest('.status-box')?.remove();
}

// Prevent onclick errors from makeListing's title link
window.RSSSearch = function () {};
