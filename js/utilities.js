/// <reference path="./clist-types.js" />
//  utilities.js  -  Utility functions for CList
//  Part of CList, the next generation of learning and connecting with your community
//
//  Version version 0.1 created by Stephen Downes on January 27, 2025
//
//  Copyright Stephen Downes 2025
//  Licensed under Creative Commons Attribution 4.0 International https://creativecommons.org/licenses/by/4.0/
//
//  This software carries NO WARRANTY OF ANY KIND.
//  This software is provided "AS IS," and you, its user, assume all risks when using it.
//
//  Contents, in order:
//    1. Text & HTML cleanup/escaping
//    2. HTML sanitizer (feed/annotation content)
//    3. Cookies & site-specific storage
//    4. Account lookup & parsing
//    5. kvstore record helpers
//    6. Async / misc control-flow utilities
//    7. Encoding
//    8. IndexedDB
//    9. Real-time-doc identity helpers
//    10. Global error handling

// ============================================================================
// 1. Text & HTML cleanup/escaping
// ============================================================================

// Escape a plain-text value for safe insertion into an HTML context.
function escapeHtml(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function removeHtml(content) {
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = content;
    // Preserve URLs from anchor tags: replace <a href="url">text</a> with "text url"
    // so text-only services receive the actual link rather than just the label.
    tempDiv.querySelectorAll('a[href]').forEach(a => {
        const href = a.getAttribute('href') || '';
        const text = a.textContent.trim();
        const replacement = (text && text !== href) ? `${text} ${href}` : href;
        a.replaceWith(replacement);
    });
    return tempDiv.textContent || tempDiv.innerText || "";
}

function processHtml(input) {
    // Replace <br> or <br /> with a single line feed
    let post = input.replace(/<br\s*\/?>/gi, '\n');

    // Replace </p> and </div> with a double line feed
    post = post.replace(/<\/(p|div)>/gi, '\n\n');

    // Remove all other HTML tags
    post = post.replace(/<[^>]*>/g, '');

    // Trim extra spaces or line breaks
    return post.trim();
}

function cleanHTMLContent(htmlContent) {
    // Extract URLs from href attributes and replace them inline with the desired format
    const withFormattedURLs = htmlContent.replace(
      /<a[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi,
      (_, url, text) => `${text} <${url}>`
    );

    // Remove remaining HTML tags
    const noHTML = withFormattedURLs.replace(/<[^>]*>/g, '');

    // Format any standalone URLs not in tags
    const fullyFormattedContent = noHTML.replace(
      /https?:\/\/[^\s]+/g,
      url => `<${url}>`
    );

    return fullyFormattedContent;
  }

// Function to decode HTML-escaped text
// Used specifically by tinymce.js
function decodeHTMLEntities(content) {
    content = content.replace(/&lt;/g, "LT")
    .replace(/&gt;/g, "GT")
    .replace(/&amp;/g, "AMP")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'");
    return content;

}

// Function to decode escaped HTML entities
function decodeHTML(html) {
    return new DOMParser()
        .parseFromString(html, "text/html")
        .body.textContent || html;
}

function truncateToGraphemeLimit(text, limit = 300) {
    const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });
    const graphemes = Array.from(segmenter.segment(text), segment => segment.segment); // Extract grapheme strings

    if (graphemes.length > limit) {
        return graphemes.slice(0, limit - 1).join('') + '…'; // Truncate to 299 graphemes and append ellipsis
    }
    return text; // Return the original text if within limit
}

// Summarize content by truncating
const summaryLimit = 500;

function truncateContent(content) {
    // If content is within the limit, return immediately
    if (content.length <= summaryLimit) {
        return content;
    }

    // Remove HTML tags
    let cleanedContent = removeHtml(content).trim();

    // If after cleaning HTML it's still within the limit, return as-is
    if (cleanedContent.length <= summaryLimit) {
        return cleanedContent;
    }

    // Truncate to summaryLimit, but ensure we end on a word boundary.
    // First, truncate strictly to summaryLimit characters
    let truncated = cleanedContent.slice(0, summaryLimit);

    // Find the last space in truncated; this ensures we don't cut a word in half
    const lastSpace = truncated.lastIndexOf(" ");
    if (lastSpace > 0) {
        truncated = truncated.slice(0, lastSpace);
    }

    // Add ellipsis, ensuring we don't exceed summaryLimit
    // We removed from the text so we should have space to add the ellipsis.
    // If not, consider using a shorter ellipsis or handle differently.
    const ellipsis = "…";
    if (truncated.length + ellipsis.length <= summaryLimit) {
        truncated += ellipsis;
    } else {
        // In a rare case where truncated is exactly summaryLimit, we might have to
        // drop the last character to fit the ellipsis.
        truncated = truncated.slice(0, truncated.length - ellipsis.length) + ellipsis;
    }

    // Check for balanced quotes. If there's an odd number of quotes, add one to close them.
    const doubleQuotesCount = (truncated.match(/"/g) || []).length;
    const singleQuotesCount = (truncated.match(/'/g) || []).length;

    // If there's an odd number of double quotes, add another one if space allows
    if (doubleQuotesCount % 2 !== 0) {
        if (truncated.length + 1 <= summaryLimit) {
            truncated += '"';
        } else {
            // If adding a quote would exceed the limit, consider removing something else
            // or just skip closing this quote.
        }
    }

    // If there's an odd number of single quotes, add another one if space allows
    if (singleQuotesCount % 2 !== 0) {
        if (truncated.length + 1 <= summaryLimit) {
            truncated += "'";
        } else {
            // Same consideration as with double quotes
        }
    }

    // At this point, truncated should meet the requirements.
    return truncated;
}

// Fall back to a plain-text title derived from the content when the post has no
// title of its own — shared by publishers (Blogger, WordPress) that always require
// a title field even though CList posts are often written without one.
function derivePlainTitle(title, content) {
    return removeHtml(title).trim()
        || content.replace(/<[^>]+>/g, '').trim().substring(0, 70).replace(/\s\S*$/, '') + '…';
}

function ucfirst(input) {
    if (typeof input !== 'string' || input.length === 0) {
        return input; // Return the input unchanged if it's not a valid string
    }
    return input.charAt(0).toUpperCase() + input.slice(1);
}

// Lowercases, collapses runs of non-alphanumerics to a single '-', trims leading/trailing
// '-', then truncates to maxLength. Falls back to `fallback` if the result is empty.
function slugify(text, { maxLength = 50, fallback = '' } = {}) {
    return (text || '').toLowerCase()
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, maxLength)
        || fallback;
}

function createUniqueIdFromUrl(url) {
    const prefix = 'item-'; // Ensure the id starts with a letter
    const sanitizedUrl = encodeURIComponent(url).replace(/'/g, '%27'); // Encode the URL to make it safe
    return prefix + sanitizedUrl;
}

// ============================================================================
// 2. HTML sanitizer (feed/annotation content)
// ============================================================================
// Keeps safe formatting tags; strips scripts, iframes, objects, forms, and
// event/style attributes. Dangerous tags are removed with children; unknown
// tags are unwrapped (children kept). Returns a SafeHtml (see reader.js).

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
                    if (v.startsWith('javascript:') || v.startsWith('data:') || v.startsWith('vbscript:')) {
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
    return new SafeHtml(doc.body.innerHTML);
}

// Export sanitizer for use by other modules (public-feeds.js, annotate.js, localrss.js, hypothesis.js)
window.sanitizeHtml = _rssSanitizeHtml;

// ============================================================================
// 3. Cookies & site-specific storage
// ============================================================================

// Set Cookie

function setCookie(name, value, days) {
    let expires = "";
    if (days) {
        const date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        expires = "; expires=" + date.toUTCString();
    }
    document.cookie = name + "=" + (value || "") + expires + "; path=/; Secure; SameSite=None";
}

// Get Cookie
function getCookie(name) {

    // Construct the search pattern
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);

     if (parts.length === 2) {
        // Return the value of the cookie
        const result = parts.pop().split(';').shift();
        return result;
    }

    return null;
}

// Site Specific Cookies

function deriveSiteIdentifier(siteUrl) {
    if (!siteUrl) { console.error("No flask site URL provided."); }
    return new URL(siteUrl).hostname.replace(/\./g, '_');
}

// document.cookie never works under file:// (Chrome gives file:// documents no cookie jar at
// all), and Local mode (IndexedDB-backed) has no real server to send a cookie-scoped token to
// anyway — so both use localStorage for auth storage. Remote/server mode over http(s) keeps using
// real cookies, which is the more secure choice when credentials are actually leaving the device.
function _authStorageIsLocalStorage() {
    return (window.CList && window.CList.isLocalMode && window.CList.isLocalMode())
        || window.location.protocol === 'file:';
}

function setSiteSpecificCookie(siteUrl, name, value, days) {
    const key = `${name}_${deriveSiteIdentifier(siteUrl)}`;
    if (_authStorageIsLocalStorage()) {
        localStorage.setItem(key, value);
        return;
    }
    setCookie(key, value, days);
}

function getSiteSpecificCookie(siteUrl, name) {
    const key = `${name}_${deriveSiteIdentifier(siteUrl)}`;
    if (_authStorageIsLocalStorage()) {
        return localStorage.getItem(key);
    }
    return getCookie(key);
}

function deleteSiteSpecificCookie(siteUrl, name) {
    const key = `${name}_${deriveSiteIdentifier(siteUrl)}`;
    if (_authStorageIsLocalStorage()) {
        localStorage.removeItem(key);
        return;
    }
    setCookie(key, '', -1);
}

// ============================================================================
// 4. Account lookup & parsing
// ============================================================================

// Extract baseURL  (from username@baseURL.social allowing for submission of baseURL.social)

function extractBaseUrl(accountName) {
    let baseURL;
    // Split username from instance
    if (accountName.includes('@')) { baseURL = accountName.split('@')[1]; }
    else { baseURL = accountName; }
    // Add "https://" if it's missing
    if (!/^https?:\/\//i.test(baseURL)) {
        baseURL = 'https://' + baseURL;
    }
    return baseURL;
}

function extractAccountName(input) {
    const atIndex = input.indexOf('@'); // Find the position of '@'

    if (atIndex !== -1) {
        return input.slice(0, atIndex); // Return everything before the '@'
    } else {
        return null; // Return null if '@' is not found
    }
}

// Parse a stored account's JSON value safely.
// Returns the parsed object, or null if the value is missing or corrupt.
/**
 * Parse decrypted account JSON. This does not validate its schema.
 * @param {CListAccountRecord} account
 * @returns {CListAccountData|null} Expected account object, or null on parse failure.
 */
function parseAccountValue(account) {
    try {
        return JSON.parse(account.value);
    } catch (e) {
        console.error(`Corrupt account data for key "${account.key || '?'}":`, e);
        return null;
    }
}

// Find the first account carrying a given permission letter (e.g. 'g' for
// ChatGPT, 'z' for summarization, 't' for translation).
// Returns { account, parsedValue } for the first match, or null if none found.
function findAccountByPermission(permissionChar) {
    const accounts = (window.CList && window.CList.accounts) || [];
    for (const account of accounts) {
        const parsedValue = parseAccountValue(account);
        if (parsedValue && parsedValue.permissions && parsedValue.permissions.includes(permissionChar)) {
            return { account, parsedValue };
        }
    }
    return null;
}

// Finds the account carrying permissionChar and extracts its API key (id) + API
// URL (instance) — the shared lookup behind chatgpt.js's generateNewTemplateFromChatGPT
// and summarize.js's summarizeText. Throws errorMessage verbatim (callers keep their own
// service-specific wording) if no account is found or it's missing either field.
function requireAccountWithPermission(permissionChar, errorMessage) {
    const found = findAccountByPermission(permissionChar);
    const apiKey = found?.parsedValue?.id || null;
    const apiUrl = found?.parsedValue?.instance || null;
    if (!apiKey || !apiUrl) throw new Error(errorMessage);
    return { apiKey, apiUrl };
}

// Find the first account of a given type (e.g. 'Dropbox', 'CListBin', 'Collab'),
// optionally also requiring a permission letter (e.g. 'b' for "bin"/upload targets).
// Searches `opts.accounts` if given, else the global window.CList.accounts list.
// Returns { account, parsedValue } for the first match, or null if none found.
function findAccountByType(type, opts = {}) {
    const accounts = opts.accounts || (window.CList && window.CList.accounts) || [];
    for (const account of accounts) {
        const parsedValue = parseAccountValue(account);
        if (parsedValue && parsedValue.type === type
            && (!opts.permission || (parsedValue.permissions || '').includes(opts.permission))) {
            return { account, parsedValue };
        }
    }
    return null;
}

// Fetches window.CList.accounts if it isn't already loaded (mirrors getAccounts'
// own throw-on-failure — callers keep their own try/catch, error message, and
// fallback behavior exactly as before). A no-op when accounts are already present.
async function ensureAccountsLoaded() {
    if (!Array.isArray(window.CList.accounts) || window.CList.accounts.length === 0) {
        window.CList.accounts = await getAccounts(window.CList.config.flaskSiteUrl);
    }
    return window.CList.accounts;
}

// ============================================================================
// 5. kvstore record helpers
// ============================================================================

// Shared by every third-party relay/bridge integration (Discord bridge, proxyp, Oasis, Collab,
// kvstore's own channel picker) that requires a valid kvstore Bearer token on each request —
// read it the same way every service integration in this codebase does.
function kvstoreAuthHeader() {
    const token = getSiteSpecificCookie(window.CList.config.flaskSiteUrl, window.CList.keys.ACCESS_TOKEN);
    return token ? { 'Authorization': `Bearer ${token}` } : {};
}

// Cached across the page's lifetime — {enabled, key} once fetched, so repeated
// proxyp calls on one page load don't each re-fetch /public-key.
let _proxypAccessKeyCache = null;

// Lets a logged-out visitor use proxyp: fetches the admin-declared access key from
// proxyp's public (deliberately unauthenticated) /public-key endpoint and returns it
// as a header, or {} if the bypass is off or no key is set. A Bearer token from
// kvstoreAuthHeader() always takes priority over this when present — this is only
// the fallback for callers with no logged-in session. See /srv/apps/proxyp/CLAUDE.md
// for why this key can't be a true secret.
async function proxypAccessKeyHeader() {
    if (_proxypAccessKeyCache === null) {
        try {
            const resp = await fetch(`${window.CList.defaults.PROXYP}/public-key`);
            _proxypAccessKeyCache = resp.ok ? await resp.json() : { enabled: false };
        } catch (_) {
            _proxypAccessKeyCache = { enabled: false };
        }
    }
    return (_proxypAccessKeyCache.enabled && _proxypAccessKeyCache.key)
        ? { 'X-Access-Key': _proxypAccessKeyCache.key }
        : {};
}

// Standard error message for a failed window.CList.storage.kv.* call —
// distinguishes "not logged in" from any other kvstore failure.
function kvErrorMessage(err) {
    return err.code === 'NotAuthenticated' ? 'Not logged in' : `kvstore error: ${err.message}`;
}

// Decrypt a kvstore record's encrypted value and JSON.parse it — the standard
// shape for reading any non-account kvstore record (collections, pages, catalog
// metadata, DID service entries, etc.). Throws on decrypt/parse failure, same as
// the inline `JSON.parse(await decryptWithKey(encKey, value))` it replaces —
// callers that want to skip corrupt/undecryptable records still wrap this in
// their own try/catch exactly as before.
async function decryptKVJson(encKey, value) {
    return JSON.parse(await decryptWithKey(encKey, value));
}

// Normalizes a decrypted collection record to { id, title, items, publishedUrls } —
// collections saved before publishedUrls existed are a bare array; current saves are
// always the wrapped object (see collections.js's _kvSaveItems). Shared by collections.js
// and annotate.js's "already in a collection?" check, so both agree on the current shape.
function _parseCollectionData(raw) {
    if (Array.isArray(raw)) return { id: null, title: null, items: raw, publishedUrls: [] };
    return { id: raw.id || null, title: raw.title || null, items: raw.items || [], publishedUrls: raw.publishedUrls || [] };
}

// Lists kvstore records, filters by key prefix, and decrypts+JSON-parses each — the
// shared list/filter/decrypt/skip-corrupt mechanics behind collections.js's
// _fetchAllCollections/_fetchAllPublishedPages and annotate.js's "already collected?"
// check. Each caller still reshapes the raw decrypted value itself (collection records and
// page records have different shapes) — this only consolidates the fetch loop itself, not
// the other, deliberately separate per-UI fetch loops in collections.js (see the comment
// above _fetchAllCollections there).
async function fetchDecryptedKvRecordsByPrefix(prefix, encKey) {
    let kvs;
    try {
        kvs = await window.CList.storage.kv.list();
    } catch (err) {
        const wrapped = new Error(kvErrorMessage(err));
        wrapped.code = err.code;
        throw wrapped;
    }
    const records = [];
    for (const kv of (kvs || [])) {
        if (!kv.key.startsWith(prefix)) continue;
        try {
            records.push({ key: kv.key, value: await decryptKVJson(encKey, kv.value) });
        } catch { /* skip corrupt entries */ }
    }
    return records;
}

// ============================================================================
// 6. Async / misc control-flow utilities
// ============================================================================

// Utility function to apply a timeout to any async operation
function withTimeout(promise, ms) {
    return Promise.race([
        promise,
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout exceeded')), ms)
        )
    ]);
}

function callIfAvailable(functionName, ...args) {
    if (typeof window[functionName] === "function") {
        // Call the function with the provided arguments
        return window[functionName](...args);
    } else {
        console.log(`Function ${functionName} is not available.`);
        return null;
    }
}

// Returns a version of fn that waits until `delay` ms of silence before firing.
// Repeated calls within the delay window reset the timer.
function debounce(fn, delay) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
    };
}

// Throws if a fetch response isn't ok, using the same "<label> <status>: <body>" shape
// used across the bin-publisher modules (clistbin.js, jsonbin.js, gist.js, 0x0.js).
async function assertOk(resp, label) {
    if (!resp.ok) throw new Error(`${label} ${resp.status}: ${await resp.text()}`);
}

// Trigger a browser download of a Blob via a temporary, invisible <a> link.
// Pass an existing Blob (e.g. from resp.blob()) directly, or build one inline:
// downloadBlob(new Blob([content], { type: mimeType }), filename).
function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

// ============================================================================
// 7. Encoding
// ============================================================================

// Base64url (RFC 4648 §5) encode — accepts a string, or bytes (Uint8Array/ArrayBuffer),
// e.g. a crypto.subtle result. Used anywhere a token/signature/challenge needs to be
// URL- and filename-safe (no '+', '/', or '=' padding): PKCE verifiers/challenges,
// Ed25519 signatures, proxy-encoded origins.
function base64UrlEncode(input) {
    const binary = typeof input === 'string'
        ? input
        : String.fromCharCode(...new Uint8Array(input));
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Inverse of base64UrlEncode, for the common case where the original input was bytes
// (a signature, a public key's raw x-coordinate) rather than a text string.
function base64UrlDecodeToBytes(str) {
    return Uint8Array.from(atob(str.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
}

// ============================================================================
// 8. IndexedDB
// ============================================================================

// ---- Shared IndexedDB request wrapper (local-kvstore.js, page-store-idb.js) ----

// Wraps a single IDBRequest (e.g. an objectStore.get()/getAll()) in a Promise, resolving
// with its result (or defaultValue if falsy, matching the `|| null`/`|| []` each caller
// used inline) on success. Only the per-request wrapper is shared — local-kvstore.js and
// page-store-idb.js keep their own separate openDb()/schema-upgrade logic, since their
// IndexedDB schemas are genuinely different (multi-store users/kv/sessions vs. a single
// pages store). Writes that resolve on transaction.oncomplete rather than a request's own
// onsuccess (put/add/delete/the existence-gated updates) aren't this shape and stay as-is.
function idbRequest(req, defaultValue) {
    return new Promise((resolve, reject) => {
        req.onsuccess = () => resolve(req.result || defaultValue);
        req.onerror = () => reject(req.error);
    });
}

// ============================================================================
// 9. Real-time-doc identity helpers
// ============================================================================

// ---- Shared real-time-doc identity helpers (collab.js, latex.js) ----

// Convert wss:// URL to https:// for REST calls
function wsUrlToRestBase(wsUrl) {
    return wsUrl.replace(/^wss?:\/\//, 'https://').replace(/\/$/, '');
}

// Derive the short-host identifier used in document namespaces.
// kvstore.mooc.ca  →  mooc.ca   (strip default 'kvstore.' prefix)
// accounts.mooc.ca →  accounts.mooc.ca  (non-default subdomain, keep as-is)
function kvShortHost(kvUrl) {
    try {
        const host = new URL(kvUrl).hostname;
        return host.startsWith('kvstore.') ? host.slice('kvstore.'.length) : host;
    } catch { return ''; }
}

// Generate a short random slug for new untitled documents (e.g. "a3f8k2")
function generateDocSlug() {
    return Math.random().toString(36).slice(2, 8);
}

// Fetch the current user's did:key from their DID document on the kvstore.
// Returns the did:key string, or null if unavailable. Result is cached — shared
// across every real-time-doc module (collab.js, latex.js), since it's the same
// user and DID document regardless of which editor is asking.
let _cachedDidKey = null;
async function getUserDidKey() {
    if (_cachedDidKey) return _cachedDidKey;
    const myUser = (window.CList.state.username && window.CList.state.username !== 'none' && window.CList.state.username !== '') ? window.CList.state.username : null;
    if (!myUser) return null;
    try {
        const res = await fetch(`${window.CList.config.flaskSiteUrl}/users/${myUser}/did.json`);
        if (!res.ok) return null;
        const doc = await res.json();
        const didKey = (Array.isArray(doc.alsoKnownAs) ? doc.alsoKnownAs : [])
            .find(id => typeof id === 'string' && id.startsWith('did:key:')) || null;
        _cachedDidKey = didKey;
        return _cachedDidKey;
    } catch {
        return null;
    }
}

// Expand a bare local name to a fully-namespaced document ID using the user's
// did:key (preferred) or username@shortHost fallback. `opts.namespace` (e.g.
// "latex") inserts an extra path segment so different editors' documents never
// collide on the same bare name.
async function expandDocId(localName, opts = {}) {
    if (localName.includes('/')) return localName; // already namespaced
    const prefix = opts.namespace ? `${opts.namespace}/` : '';
    const didKey = await getUserDidKey();
    if (didKey) return `${didKey}/${prefix}${localName}`;
    const myUser = (window.CList.state.username && window.CList.state.username !== 'none' && window.CList.state.username !== '') ? window.CList.state.username : null;
    const shortHost = kvShortHost(window.CList.config.flaskSiteUrl);
    if (myUser && shortHost) return `${myUser}@${shortHost}/${prefix}${localName}`;
    return `${prefix}${localName}`;
}

// Shared body of getLatexShareLink/getCollabShareLink (latex.js/collab.js) — builds the
// REST share URL for a real-time doc from its current ws:// server URL and doc ID.
function getRealtimeDocShareLink(wsUrl, docId, mode) {
    const pathId = docId.split('/').map(encodeURIComponent).join('/');
    return `${wsUrlToRestBase(wsUrl)}/doc/${pathId}/${mode}`;
}

// Prefers a reference's human author name over its feed/handle or service —
// shared by the quote-attribution and bracket-citation logic in annotate.js/ui.js
// so both show the same name instead of one showing a handle and the other a name.
function referenceDisplayName(ref) {
    if (ref.author_name && ref.author_name !== '(unknown author)') return ref.author_name;
    if (ref.feed && ref.feed !== '(no feed specified)') return ref.feed;
    return ref.service || 'Unknown';
}

// ============================================================================
// 10. Global error handling
// ============================================================================

// Last-resort handler for any promise rejection that escapes local error handling.
window.addEventListener('unhandledrejection', function (event) {
    console.error('Unhandled promise rejection:', event.reason);
    showErrorModal('An unexpected error occurred. See console for details.', { title: 'Unexpected error' });
});
