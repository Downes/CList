// Save a complete session synchronously, with token last; reverse partial writes on failure.
/** @param {CListAuthCredentialTarget} target @param {CListVerifiedAuthSession} verified @param {CryptoKey} encKey @param {Object} deps */
async function installAuthSession(target, verified, encKey, deps) {
    let encodedKey;
    try { encodedKey = await deps.exportKey(encKey); }
    catch { throw new Error('Login was verified, but the encryption key could not be exported. Nothing was saved.'); }
    deps.assertCurrent();
    if (typeof encodedKey !== 'string' || !encodedKey) throw new Error('The encryption key could not be prepared for this browser.');
    const slot = target.serverUrl+'_'+verified.username+'_encKey';
    const entries = [
        {kind:'key', name:slot, value:encodedKey},
        {kind:'cookie', name:deps.keys.USERNAME, value:verified.username},
        {kind:'cookie', name:deps.keys.TOKEN_EXPIRES, value:verified.expires},
        {kind:'cookie', name:deps.keys.ACCESS_TOKEN, value:verified.token}
    ];
    const read = entry => entry.kind === 'key' ? deps.getKey(entry.name) : deps.getCookie(target.serverUrl, entry.name);
    const put = (entry, value) => {
        if (entry.kind === 'key') { if (value == null) deps.removeKey(entry.name); else deps.setKey(entry.name, value); }
        else if (value == null || value === '') deps.deleteCookie(target.serverUrl, entry.name);
        else deps.setCookie(target.serverUrl, entry.name, value, 365);
    };
    for (const entry of entries) entry.before = read(entry);
    deps.assertCurrent(); const attempted = [];
    try {
        for (const entry of entries) {
            attempted.push(entry); put(entry, entry.value);
            if (read(entry) !== entry.value) throw new Error('The browser did not retain a session value.');
        }
    } catch (cause) {
        let incomplete = false;
        for (const entry of attempted.reverse()) {
            try {
                const value = read(entry);
                if (value !== entry.value && value !== entry.before) { incomplete = true; continue; }
                put(entry, entry.before);
                const restored = read(entry);
                if (restored !== entry.before && !(restored == null && !entry.before)) incomplete = true;
            } catch { incomplete = true; }
        }
        throw new Error('Login was verified, but this browser could not save the session. '+(incomplete ? 'Some session values could not be restored; check browser storage before retrying.' : 'Previous session values were restored. Check browser storage before retrying.'));
    }
    return {token:verified.token, username:verified.username};
}
