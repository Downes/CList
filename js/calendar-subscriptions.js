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
// whatever's cached rather than refetching.
const _icsSubscriptionCache = {};

/**
 * @param {string} accountKey Raw account record key (cache/id namespace).
 * @param {{url: string}} accountData Parsed Calendar fields.
 * @param {{force?: boolean}} [opts]
 * @returns {Promise<Array<Object>>} CListCalendarEvent-shaped objects, each
 *   tagged { sourceType: 'subscription', sourceKey: accountKey, readOnly: true }.
 */
async function fetchSubscriptionEvents(accountKey, accountData, { force = false } = {}) {
    if (!force && _icsSubscriptionCache[accountKey]) return _icsSubscriptionCache[accountKey].events;

    // Same proxyp call shape as collections.js's "Load from URL" -- the
    // target feed's CORS policy blocks a raw cross-origin fetch from the
    // browser (see /srv/apps/proxyp/CLAUDE.md).
    const headers = { ...kvstoreAuthHeader(), ...(await proxypAccessKeyHeader()) };
    const resp = await fetch(`${window.CList.defaults.PROXYP}?${new URLSearchParams({ url: accountData.url })}`, { headers });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const contentType = resp.headers.get('Content-Type') || '';
    const text = await resp.text();

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
    _icsSubscriptionCache[accountKey] = { events, fetchedAt: Date.now() };
    return events;
}

// Drops one source's cache entry, or every entry when called with no key.
function clearSubscriptionCache(accountKey) {
    if (accountKey) { delete _icsSubscriptionCache[accountKey]; return; }
    for (const key of Object.keys(_icsSubscriptionCache)) delete _icsSubscriptionCache[key];
}
