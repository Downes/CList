/// <reference path="./reader-types.js" />
// Copyright Stephen Downes 2026. CC BY 4.0; provided AS IS, without warranty.

// Explicit data and transport only; no current-account/session or UI reads.
/** @param {CListLocalrssRequest} request
 * @param {{fetch: Function, headers: Object, signal?: AbortSignal}} dependencies
 * @returns {Promise<CListLocalrssPage|{hasAudio: boolean}>} */
async function fetchLocalrssPage(request, { fetch: send, headers, signal }) {
    const snapshot = structuredClone(request);
    const base = snapshot.account._effectiveServiceUrl || snapshot.account.serviceUrl;
    if (!base || !snapshot.account.database) throw new Error('LocalRSS needs a service URL and database.');
    const query = new URLSearchParams({ db: snapshot.account.database });
    if (snapshot.kind === 'items') {
        query.set('filter', snapshot.filter); query.set('limit', String(snapshot.limit)); query.set('offset', String(snapshot.offset));
    } else if (snapshot.kind === 'feeds') query.set('limit', '1000');
    const path = snapshot.kind === 'items' ? '/api/items' : snapshot.kind === 'feeds' ? '/api/feeds' : '/api/stats';
    const response = await send(base.replace(/\/$/, '') + path + '?' + query,
        { headers: { ...headers }, signal });
    const data = await response.json().catch(() => null);
    if (!response.ok || data?.ok === false) throw new Error(data?.error || `HTTP ${response.status}`);
    if (snapshot.kind === 'stats') {
        if (!data || typeof data !== 'object') throw new Error('Unexpected LocalRSS statistics response.');
        return { hasAudio: !!data.has_audio_majority };
    }
    const items = snapshot.kind === 'feeds' ? data?.feeds : data;
    if (!Array.isArray(items)) throw new Error('Unexpected response from LocalRSS server.');
    return { items, offset: snapshot.offset, hasMore: snapshot.kind === 'items' && items.length === snapshot.limit };
}

/** Explicit toggle write. Never retries: a lost response may follow an accepted toggle.
 * @param {CListLocalrssToggleRequest} request
 * @param {{fetch: Function, headers: Object}} dependencies
 * @returns {Promise<{value: boolean}>} */
async function toggleLocalrssEntry(request, { fetch: send, headers }) {
    const { account, entryId, action } = structuredClone(request);
    if (!['read', 'bookmark'].includes(action) || entryId == null) throw new Error('Invalid LocalRSS toggle.');
    const base = account._effectiveServiceUrl || account.serviceUrl;
    if (!base || !account.database) throw new Error('LocalRSS needs a service URL and database.');
    const response = await send(base.replace(/\/$/, '') + '/api/toggle_' + action, {
        method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ db: account.database, id: entryId }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || data?.ok === false) throw new Error(data?.error || `HTTP ${response.status}`);
    const value = data?.[action === 'read' ? 'read' : 'bookmarked'];
    if (![true, false, 0, 1].includes(value)) throw new Error('Unexpected LocalRSS toggle response; refresh before trying again.');
    return { value: !!value };
}
