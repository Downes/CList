/// <reference path="./clist-types.js" />
// Reuse the shared account validator/encryption writer with a captured session/put.
async function persistOAuthCallbackAccount(request, deps) {
    deps.assert(); const encKey = await deps.key(); deps.assert();
    if (!encKey) throw new Error('Encryption key missing. Please log in again.');
    let expected = null;
    if (deps.updateExisting) {
        const record = await deps.get(request.key); deps.assert();
        if (!record || typeof record.value !== 'string') throw new Error('The account was removed. Reopen Accounts before authorizing again.');
        expected = record.value;
        const existing = JSON.parse(await deps.decrypt(encKey, expected)); deps.assert();
        if (!existing || Array.isArray(existing) || existing.type !== request.data.type) throw new Error('The stored account type changed or is unreadable. Reopen Accounts before authorizing again.');
        request = { ...request, data: deps.mergeExisting ? deps.mergeExisting(existing, request.data) : { ...existing, ...request.data } };
    }
    return deps.save(request, { ...deps.session, encKey, isCurrent: deps.current,
        put: async (key, encrypted) => {
            deps.assert();
            if (deps.updateExisting) {
                const latest = await deps.get(key); deps.assert();
                if (latest?.value !== expected) throw Object.assign(new Error('The account changed while authorization was being saved. Review Accounts before retrying.'), { code: 'RevisionConflict' });
            }
            deps.dispatch(encrypted); return deps.put(key, encrypted);
        } });
}
async function checkOAuthCallbackAccount(key, encrypted, deps) {
    deps.assert(); const record = await deps.get(key); deps.assert(); return !!record && record.value === encrypted;
}
