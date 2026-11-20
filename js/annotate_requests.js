// Annotation reads/follow persistence. Explicit account/session/dependencies; no DOM.
function annotationSessionSnapshot() {
    const storeUrl = window.CList.config.flaskSiteUrl;
    return { storeUrl, username: window.CList.state.username || '',
        token: getSiteSpecificCookie(storeUrl, window.CList.keys.ACCESS_TOKEN) || '' };
}
function annotationSessionCurrent(session) { return JSON.stringify(session) === JSON.stringify(annotationSessionSnapshot()); }
async function readAnnotationRecords(account, { url, since, creatorDid } = {}, fetcher = fetch) {
    if (account.type === 'Hypothesis') return url ? window.hypothesisFetch(account, url) : window.hypothesisFeedFetch(account, since);
    if (!account.instance) return [];
    const params = new URLSearchParams({ limit: '50' });
    if (url) params.set('target', url);
    else { if (!creatorDid) return []; params.set('creator', creatorDid); if (since) params.set('since', since); }
    const response = await fetcher(`${account.instance}/annotations?${params}`, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`Annotation store ${account.instance} returned HTTP ${response.status}.`);
    const data = await response.json();
    if (!Array.isArray(data.items)) throw new Error('Annotation store returned an invalid items list.');
    return data.items;
}
async function collectAnnotationRecords(accounts, request, read = readAnnotationRecords) {
    const results = await Promise.all(accounts.map(async account => {
        try { return { items: await read(structuredClone(account), { ...request, creatorDid: account._did || request.creatorDid }), warning: null }; }
        catch (error) { return { items: [], warning: error?.message || String(error) }; }
    }));
    const seen = new Set();
    return { items: results.flatMap(result => result.items).filter(item => {
        const id = item.id || JSON.stringify(item); if (seen.has(id)) return false; seen.add(id); return true;
    }), warnings: results.map(result => result.warning).filter(Boolean) };
}
async function persistAnnotationFollow(did, following, session, deps) {
    deps.assertCurrent();
    if (!session.token) throw new Error('Please log in before following people.');
    const key = `social:following:${did}`;
    if (!following) { await deps.remove(key); return { following: false }; }
    const encKey = await deps.getKey(session.storeUrl); deps.assertCurrent();
    if (!encKey) throw new Error('Encryption key not available. Please log in again.');
    const value = await deps.encrypt(encKey, JSON.stringify({ did, since: new Date().toISOString() }));
    deps.assertCurrent(); await deps.put(key, value); return { following: true };
}
let _annotationDiscoveryCache = null, _annotationDiscoveryGeneration = 0;
function invalidateAnnotationDiscovery() { _annotationDiscoveryCache = null; _annotationDiscoveryGeneration++; }
async function readAnnotationDiscovery() {
    const session = annotationSessionSnapshot(), key = JSON.stringify(session), generation = _annotationDiscoveryGeneration;
    if (_annotationDiscoveryCache?.key === key && Date.now() - _annotationDiscoveryCache.time < 300000) return _annotationDiscoveryCache.value;
    const current = () => annotationSessionCurrent(session) && generation === _annotationDiscoveryGeneration;
    const assert = () => { if (!current()) throw new Error('Annotation discovery session changed.'); };
    if (!session.token) return { dids: new Set(), accounts: [], warnings: [] };
    const encKey = await getEncKey(session.storeUrl); assert();
    if (!encKey) throw new Error('Encryption key unavailable for annotation discovery.');
    const records = await window.CList.storage.kv.list(); assert();
    const dids = new Set(), accounts = [], warnings = [];
    for (const record of records.filter(record => record.key.startsWith('social:following:'))) {
        try { const value = await decryptKVJson(encKey, record.value); assert(); if (value.did) dids.add(value.did); }
        catch (error) { assert(); warnings.push('An unreadable follow record was skipped.'); }
    }
    const seen = new Set();
    for (const did of dids) {
        const match = did.match(/^did:web:([^:]+):users:(.+)$/); if (!match) continue;
        try {
            const response = await fetch(`https://${match[1]}/users/${match[2]}/did.json`, { headers: { Accept: 'application/json' } });
            if (!response.ok) throw new Error(`Could not discover annotation stores for ${did}.`);
            const data = await response.json(); assert();
            for (const service of data.service || []) {
                if (service.type !== 'AnnotationService' || typeof service.serviceEndpoint !== 'string') continue;
                const endpoint = service.serviceEndpoint;
                let account;
                if (endpoint.includes('hypothes.is')) {
                    const user = endpoint.match(/\/users\/([^/]+)$/)?.[1]; if (!user) continue;
                    account = { type: 'Hypothesis', instance: 'https://hypothes.is', username: user, apiKey: '', permissions: 'r', _did: did };
                } else account = { instance: endpoint, _did: did };
                const id = account.type === 'Hypothesis' ? 'hypothesis:' + account.username : account.instance;
                if (!seen.has(id)) { seen.add(id); accounts.push(account); }
            }
        } catch (error) { assert(); warnings.push(error?.message || String(error)); }
    }
    assert(); const value = { dids, accounts, warnings };
    _annotationDiscoveryCache = { key, time: Date.now(), value }; return value;
}
async function _getFollowedDids() { return new Set((await readAnnotationDiscovery()).dids); }
async function _getFederatedAnnotationAccounts() { return structuredClone((await readAnnotationDiscovery()).accounts); }
window._getFollowedDids = _getFollowedDids;
window._clistAnnotateInvalidateFollowCache = invalidateAnnotationDiscovery;
