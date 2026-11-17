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
        if (snapshot.selection?.mode === 'search') query.set('q', snapshot.selection.query);
        else if (snapshot.selection?.mode === 'feed') query.set('feed_id', String(snapshot.selection.feedId));
        else query.set('filter', snapshot.filter);
        query.set('limit', String(snapshot.limit)); query.set('offset', String(snapshot.offset));
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
    return { items, offset: snapshot.offset, hasMore: snapshot.kind === 'items' && !snapshot.selection && items.length === snapshot.limit };
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

/** @param {CListAccountData} account
 * @param {{fetch: Function, headers: Object}} dependencies */
async function fetchLocalrssStatistics(account, dependencies) {
    return requestLocalrssDatabase(account, '/api/stats', 'GET', dependencies);
}
/** Explicit database write; never automatically retried.
 * @param {CListAccountData} account
 * @param {{fetch: Function, headers: Object}} dependencies */
async function markLocalrssDatabaseRead(account, dependencies) {
    return requestLocalrssDatabase(account, '/api/mark_all_read', 'POST', dependencies);
}
async function requestLocalrssDatabase(account, path, method, { fetch: send, headers }, body = {}) {
    const captured = structuredClone(account);
    const base = captured._effectiveServiceUrl || captured.serviceUrl;
    if (!base || !captured.database) throw new Error('LocalRSS needs a service URL and database.');
    const options = { method, headers: { ...headers } };
    let url = base.replace(/\/$/, '') + path;
    if (method === 'GET') url += '?' + new URLSearchParams({ db: captured.database });
    else {
        options.headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify({ ...structuredClone(body), db: captured.database });
    }
    const response = await send(url, options);
    const data = await response.json().catch(() => null);
    if (!response.ok || !data || typeof data !== 'object' || Array.isArray(data) || data.ok === false) {
        throw new Error(data?.error || `Invalid LocalRSS response (HTTP ${response.status}).`);
    }
    return data;
}

/** Explicit feed management transport, with no global account or UI reads.
 * @param {CListAccountData} account
 * @param {'get'|'create'|'update'|'retry'|'delete'} operation
 * @param {Object} values Captured feed ID and/or editable values.
 * @param {{fetch: Function, headers: Object}} dependencies */
async function requestLocalrssFeed(account, operation, values, dependencies) {
    if (!['get', 'create', 'update', 'retry', 'delete'].includes(operation)) throw new Error('Invalid feed operation.');
    const body = structuredClone(values);
    if (operation !== 'create' && (body.id == null || !/^\d+$/.test(String(body.id)))) throw new Error('Invalid feed ID.');
    const path = operation === 'get' ? '/api/feed/' + encodeURIComponent(body.id) : '/api/feed_' + operation;
    const data = await requestLocalrssDatabase(account, path, operation === 'get' ? 'GET' : 'POST', dependencies, body);
    if (data.ok !== true) throw new Error('Unconfirmed LocalRSS feed response; refresh before trying again.');
    if (['get', 'create', 'retry'].includes(operation)
        && (!data.feed || data.feed.id == null || typeof data.feed !== 'object')) {
        throw new Error('Unexpected LocalRSS feed response; refresh before trying again.');
    }
    if (['get', 'retry'].includes(operation) && String(data.feed.id) !== String(body.id)) throw new Error('LocalRSS returned a different feed.');
    return data;
}
