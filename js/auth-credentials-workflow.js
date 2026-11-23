// Explicit credential operations. Passwords/keys never enter presentation state.
/** @param {Pick<CListAuthInput,'username'|'password'>} input @param {Object} deps @returns {Promise<CListPreparedAuthCredentials>} */
async function prepareAuthCredentials(input, deps, includeKey = true) {
    deps.assertCurrent();
    const username = input.username.trim().toLowerCase();
    if (!username || !input.password) throw new Error('Username and password are required.');
    const [authHash, encKey] = await Promise.all([deps.deriveHash(input.password, username), includeKey ? deps.deriveKey(input.password, username) : null]);
    deps.assertCurrent();
    return {username, authHash, encKey};
}
/** @param {CListAuthCredentialTarget} target @param {CListPreparedAuthCredentials} prepared @param {Object} deps */
async function registerAuthCredentials(target, prepared, deps) {
    deps.assertCurrent(); deps.registered('uncertain');
    let status;
    try {
        if (target.local) await deps.localRegister(prepared.username, prepared.authHash);
        else {
            const response = await deps.fetch(target.serverUrl.replace(/\/+$/, '')+'/auth/register', {
                method:'POST', headers:{'Content-Type':'application/json'},
                body:JSON.stringify({username:prepared.username, auth_hash:prepared.authHash})
            });
            status = response.status;
            if (!response.ok) throw new Error('Registration returned HTTP '+response.status+'.');
        }
    } catch (cause) {
        const code = status ?? cause.status;
        deps.registered(code >= 400 && code < 500 ? 'rejected' : 'uncertain');
        throw new Error(code >= 400 && code < 500 ? 'Registration was rejected (HTTP '+code+'). Check the account details before retrying.' : 'Registration could not be confirmed. Submit again to check login, or explicitly retry registration.');
    }
    // Preserve acceptance even when a replaced panel/session can no longer continue.
    deps.registered('created'); deps.assertCurrent();
}
/** @param {CListAuthCredentialTarget} target @param {CListPreparedAuthCredentials} prepared @param {Object} deps @returns {Promise<CListVerifiedAuthSession>} */
async function verifyAuthCredentials(target, prepared, deps) {
    deps.assertCurrent(); let data;
    if (target.local) data = await deps.localLogin(prepared.username, prepared.authHash);
    else {
        const response = await deps.fetch(target.serverUrl.replace(/\/+$/, '')+'/auth/login', {
            method:'POST', headers:{'Content-Type':'application/json'},
            body:JSON.stringify({username:prepared.username, auth_hash:prepared.authHash})
        });
        deps.assertCurrent();
        if (!response.ok) throw new Error('Login was rejected (HTTP '+response.status+').');
        data = await response.json();
    }
    deps.assertCurrent();
    if (!data || typeof data.token !== 'string' || !data.token || data.username !== prepared.username ||
        typeof data.expires !== 'string' || !Number.isFinite(Date.parse(data.expires)) || Date.parse(data.expires) <= deps.now())
        throw new Error('Login returned an invalid or expired session. Nothing was saved.');
    return {token:data.token, username:data.username, expires:data.expires};
}
