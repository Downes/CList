/// <reference path="./clist-types.js" />
// Transient collection storage session; never put tokens/keys in presentation state.
/** @returns {CListCollectionSession} */
function beginCollectionSession({ token, encKey = null, isCurrent = null } = {}) {
    const storeUrl = window.CList.config.flaskSiteUrl;
    return { storeUrl, username: window.CList.state?.username || null,
        token: token === undefined ? getSiteSpecificCookie(storeUrl, window.CList.keys.ACCESS_TOKEN) : token,
        encKey, isCurrent };
}
/** @param {CListCollectionSession} session */
function assertCollectionSession(session) {
    if (!session.token || session.storeUrl !== window.CList.config.flaskSiteUrl
        || session.username !== (window.CList.state?.username || null)
        || session.token !== getSiteSpecificCookie(session.storeUrl, window.CList.keys.ACCESS_TOKEN)
        || (session.isCurrent && !session.isCurrent())) {
        throw new Error('This collection operation is no longer current. Reopen the collection controls.');
    }
}
/** @param {CListCollectionSession} session @returns {Promise<CListCollectionSession>} */
async function prepareCollectionSession(session) {
    assertCollectionSession(session);
    session.encKey ||= await getEncKey(session.storeUrl);
    assertCollectionSession(session);
    if (!session.encKey) throw new Error('Encryption key not available. Please log in again.');
    return session;
}
/** @param {CListCollectionSession} session */
function collectionDependencies(session) {
    const kv = window.CList.storage.kv;
    return { assertSession: () => assertCollectionSession(session), parse: _parseCollectionData,
        list: () => kv.list(),
        get: async key => typeof kv.get === 'function' ? kv.get(key) : (await kv.list() || []).find(record => record.key === key),
        decrypt: value => decryptKVJson(session.encKey, value),
        encrypt: value => encryptWithKey(session.encKey, value),
        put: (key, value) => kv.put(key, value), add: (key, value) => kv.add(key, value),
        update: (key, value) => kv.update(key, value), remove: key => kv.remove(key),
        createIdentity: _newCollectionIdentity, createMemberId: () => crypto.randomUUID() };
}
