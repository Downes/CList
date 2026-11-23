/// <reference path="./clist-types.js" />
// Reuse the shared account validator/encryption writer with a captured session/put.
async function persistOAuthCallbackAccount(request, deps) {
    deps.assert(); const encKey = await deps.key(); deps.assert();
    if (!encKey) throw new Error('Encryption key missing. Please log in again.');
    return deps.save(request, { ...deps.session, encKey, isCurrent: deps.current,
        put: async (key, encrypted) => { deps.assert(); deps.dispatch(encrypted); return deps.put(key, encrypted); } });
}
async function checkOAuthCallbackAccount(key, encrypted, deps) {
    deps.assert(); const record = await deps.get(key); deps.assert(); return !!record && record.value === encrypted;
}
