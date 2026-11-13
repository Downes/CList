// Personal feed membership for subscribed public collections. Public collections
// stay read-only; the first edit imports their OPML into a caller-owned database.
// Uses existing LocalRSS endpoints, without changing shared feed metadata.

async function publicFeedAccountRequest(serviceUrl, path, options = {}) {
    if (window.CList.isLocalMode && window.CList.isLocalMode()) {
        throw new Error('Editing collections on LocalRSS requires a server-backed CList login. A local-only login cannot be verified by LocalRSS.');
    }
    let base = serviceUrl.replace(/\/$/, '');
    if (window._launcherConfig?.proxyBase && /^https?:\/\//i.test(base)) {
        base = `${window._launcherConfig.proxyBase}/${base64UrlEncode(base)}`;
    }
    const response = await fetch(base + path, {
        ...options,
        headers: { ..._localrssAuthHeaders(), ...options.headers },
    });
    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || `LocalRSS returned HTTP ${response.status}`);
    }
    return response;
}

function publicChangelogOpml() {
    const xml = value => value.replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
    return '<?xml version="1.0" encoding="UTF-8"?><opml version="2.0"><head><title>CList Changelog</title></head><body>'
        + PUBLIC_CHANGELOG_FEEDS.map(feed => `<outline type="rss" text="${xml(feed.title)}" title="${xml(feed.title)}" xmlUrl="${xml(feed.feed)}" htmlUrl="${xml(feed.url)}" author="${xml(feed.author_name)}" feed="${xml(feed.feed)}" description="${xml(feed.summary)}"/>`).join('')
        + '</body></opml>';
}

async function ensurePersonalPublicFeedAccount(key, account) {
    if (account.database) return account;
    const encKey = await getEncKey(window.CList.config.flaskSiteUrl);
    if (!encKey) throw new Error('Encryption key not available. Please log in again.');
    // Stable per-account name permits retrying a failed account save without
    // importing twice or resetting an already edited copy. LocalRSS scopes it
    // to the authenticated identity (issuer + username).
    const digest = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
    const database = 'clist_' + Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, '0')).join('').slice(0, 32);
    const listResponse = await publicFeedAccountRequest(account.serviceUrl, '/api/db_list');
    const owned = await listResponse.json();
    if (!Array.isArray(owned.dbs)) throw new Error('Unexpected LocalRSS collection response');
    if (!owned.dbs.includes(database)) {
        let opml;
        if (account.collectionSlug === 'clist-changelog') {
            opml = publicChangelogOpml();
        } else {
            const response = await publicFeedAccountRequest(account.serviceUrl,
                `/api/opml_export?db=${encodeURIComponent(account.collectionSlug)}`);
            opml = await response.text();
            const doc = new DOMParser().parseFromString(opml, 'application/xml');
            if (doc.querySelector('parsererror') || doc.documentElement.localName !== 'opml') {
                throw new Error('LocalRSS did not return a valid collection export');
            }
        }
        const form = new FormData();
        form.append('opml', new Blob([opml], { type: 'text/xml' }), 'feeds.opml');
        form.append('mode', 'newdb');
        form.append('new_db_name', database);
        const response = await publicFeedAccountRequest(account.serviceUrl, '/api/opml_import', { method: 'POST', body: form });
        const result = await response.json();
        if (!result.ok || result.db !== database) throw new Error(result.error || 'Could not create personal collection');
    }
    const personal = { ...account, database };
    const encrypted = await encryptWithKey(encKey, JSON.stringify(personal));
    // update, not upsert: an account deleted while the copy was being created
    // must not be resurrected by this operation.
    await window.CList.storage.kv.update(key, encrypted);
    for (const saved of window.CList.accounts || []) {
        if (saved.key === key) saved.value = JSON.stringify(personal);
    }
    return personal;
}

// Feed accounts use the normal write-pane Collection editor and its Save flow.
async function openPublicFeedCollection(key, account, requestBase = account.serviceUrl) {
    const token = getSiteSpecificCookie(window.CList.config.flaskSiteUrl, window.CList.keys.ACCESS_TOKEN);
    const encKey = await getEncKey(window.CList.config.flaskSiteUrl);
    if (!token || !encKey) throw new Error('Please log in before editing feeds.');
    let items;
    if (account.collectionItems) {
        items = JSON.parse(account.collectionItems);
        if (!Array.isArray(items)) throw new Error('Invalid saved feed collection');
    } else {
        const response = await publicFeedAccountRequest(requestBase,
            `/api/opml_export?db=${encodeURIComponent(account.database)}`);
        const text = await response.text();
        const doc = new DOMParser().parseFromString(text, 'text/xml');
        if (doc.querySelector('parsererror') || doc.documentElement.localName !== 'opml') {
            throw new Error('Invalid feed collection export');
        }
        items = _parseCollectionOPML(text).items;
    }
    if (account.collectionSlug === 'clist-changelog') items = publicChangelogCollectionItems(items);
    await _loadCollectionIntoEditor({
        name: account.title, id: account.collectionId || null, items,
        feedAccount: { key, type: account.type, serviceUrl: account.serviceUrl, database: account.database, requestBase },
    }, token, encKey);
}

// Save membership, never /api/feed_update (shared feed metadata).
// Keep the full editor entries in this user's encrypted account so ordering,
// descriptions, and other collection properties survive reopening the editor.
async function savePublicFeedCollection(binding, name, items, id, token, encKey) {
    const record = await window.CList.storage.kv.get(binding.key);
    if (!record) throw new Error('This feed account has been deleted.');
    const account = await decryptKVJson(encKey, record.value);
    if (typeof window.CList.readers[account.type]?.editCollection !== 'function'
        || (binding.type && account.type !== binding.type)
        || account.database !== binding.database || account.serviceUrl !== binding.serviceUrl) {
        throw new Error('The feed account has changed. Reopen Edit Feed Collection before saving.');
    }
    const serviceUrl = binding.requestBase || account.serviceUrl;
    for (const item of items) {
        if (item.role !== 'contains' && !/^https?:\/\//i.test(item.feed || item.url || '')) {
            throw new Error('Every feed entry needs an http:// or https:// URL. Complete or remove blank entries before saving.');
        }
    }
    const flatItems = await _flattenForExport(items, id, token, encKey);
    if (flatItems.some(item => !/^https?:\/\//i.test(item.feed || item.url || ''))) {
        throw new Error('Every feed entry needs an http:// or https:// URL.');
    }
    const exportResponse = await publicFeedAccountRequest(serviceUrl,
        `/api/opml_export?db=${encodeURIComponent(account.database)}`);
    const currentText = await exportResponse.text();
    const currentDoc = new DOMParser().parseFromString(currentText, 'text/xml');
    if (currentDoc.querySelector('parsererror') || currentDoc.documentElement.localName !== 'opml') {
        throw new Error('Invalid feed collection export');
    }
    const previous = _parseCollectionOPML(currentText).items;
    const desiredUrls = new Set(flatItems.map(item => (item.feed || item.url).trim()));
    const form = new FormData();
    form.append('opml', new Blob([collectionFormats.opml.serialize(name, flatItems, id)], { type: 'text/xml' }), 'feeds.opml');
    // "replace" deletes and recreates unshared feeds, losing their harvested
    // entries/read state even if their URLs did not change. Merge additions
    // first, then remove just the unwanted memberships.
    form.append('mode', 'merge');
    const response = await publicFeedAccountRequest(serviceUrl,
        `/api/opml_import?db=${encodeURIComponent(account.database)}`, { method: 'POST', body: form });
    const result = await response.json();
    if (!result.ok) throw new Error(result.error || 'Could not save the feed collection');
    for (const item of previous) {
        const feedUrl = item.feed || item.url;
        if (desiredUrls.has(feedUrl)) continue;
        const response = await publicFeedAccountRequest(serviceUrl,
            `/api/feeds?db=${encodeURIComponent(account.database)}&q=${encodeURIComponent(feedUrl)}&limit=1000`);
        const data = await response.json();
        if (!Array.isArray(data.feeds)) throw new Error('Unexpected feed lookup response');
        const feed = data.feeds.find(feed => feed.url === feedUrl);
        if (!feed) continue; // Already removed, for example by another tab.
        const removedResponse = await publicFeedAccountRequest(serviceUrl, '/api/feed_delete', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ db: account.database, id: feed.id }),
        });
        const removed = await removedResponse.json();
        if (!removed.ok) throw new Error(removed.error || 'Could not remove feed');
    }
    const updated = { ...account, title: name, collectionItems: JSON.stringify(items), collectionId: id };
    try {
        await window.CList.storage.kv.update(binding.key, await encryptWithKey(encKey, JSON.stringify(updated)));
    } catch (error) {
        throw new Error('Feed subscriptions were updated, but the collection details could not be saved. Retry Save to CList: ' + error.message);
    }
    for (const saved of window.CList.accounts || []) {
        if (saved.key === binding.key) saved.value = JSON.stringify(updated);
    }
}
