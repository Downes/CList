// Copyright Stephen Downes 2026. CC BY 4.0; provided AS IS, without warranty.
// Fetches, parses, and caches events for a Calendar account.
// Pure-ish data layer: no DOM, no rendering -- js/calendar-browser.js owns
// merging these into the visible calendar and reporting per-source errors.
//
// Events returned here are never written to KV. Their `id` is synthetic
// (`subscription:{accountKey}:{uid}`), used only for in-memory dedup and
// React-style keying while rendering.

// Module-scope, no TTL -- persists for the page session until a manual
// Refresh (force: true) or a page reload. Toggling a source off/on reuses
// whatever's cached for the same issuer session, account, URL and proxy.
// Clearing an entry also expires its pending reads.
const _icsSubscriptionCache = new Map();

/**
 * @param {string} accountKey Raw account record key (cache/id namespace).
 * @param {{url: string}} accountData Parsed Calendar fields.
 * @param {{force?: boolean}} [opts]
 * @returns {Promise<Array<Object>>} CListCalendarEvent-shaped objects, each
 *   tagged { sourceType: 'subscription', sourceKey: accountKey, readOnly: true }.
 */
async function fetchSubscriptionEvents(accountKey, accountData, { force = false } = {}) {
    const source = captureOAuthIssuerSource(), url = accountData.url, proxy = window.CList.defaults.PROXYP;
    const key = JSON.stringify([source, accountKey, url, proxy]);
    const cached = _icsSubscriptionCache.get(key);
    if (!force && cached?.events) return cached.events;
    const ticket = { accountKey };
    _icsSubscriptionCache.set(key, ticket);
    const assertCurrent = () => {
        if (!currentOAuthIssuerSource(source) || accountData.url !== url || window.CList.defaults.PROXYP !== proxy
            || _icsSubscriptionCache.get(key) !== ticket) throw new Error('This calendar subscription request expired. Refresh its source.');
    };

    // Same proxyp call shape as collections.js's "Load from URL" -- the
    // target feed's CORS policy blocks a raw cross-origin fetch from the
    // browser (see /srv/apps/proxyp/CLAUDE.md).
    const headers = { ...kvstoreAuthHeader(), ...(await proxypAccessKeyHeader()) };
    assertCurrent();
    const resp = await fetch(`${proxy}?${new URLSearchParams({ url })}`, { headers });
    assertCurrent();
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const contentType = resp.headers.get('Content-Type') || '';
    const text = await resp.text();
    assertCurrent();

    // Proxyp's convention: a reachable-but-failed upstream request still
    // returns HTTP 200, with a JSON {"error": "..."} body instead of the
    // real content.
    if (contentType.includes('application/json')) {
        let proxypError = null;
        try {
            const parsed = JSON.parse(text);
            if (parsed && typeof parsed.error === 'string') proxypError = parsed.error;
        } catch (_) { /* not JSON, or not proxyp's error shape -- fall through */ }
        if (proxypError) throw new Error(proxypError);
    }

    const events = parseIcsCalendar(text).map(event => ({
        ...event,
        id: `subscription:${accountKey}:${event.uid}`,
        sourceType: 'subscription',
        sourceKey: accountKey,
        readOnly: true,
    }));
    assertCurrent();
    ticket.events = events; ticket.fetchedAt = Date.now();
    return events;
}

// Drops one source's cache entry, or every entry when called with no key.
function clearSubscriptionCache(accountKey) {
    if (accountKey === undefined) { _icsSubscriptionCache.clear(); return; }
    for (const [key, entry] of _icsSubscriptionCache) if (entry.accountKey === accountKey) _icsSubscriptionCache.delete(key);
}
