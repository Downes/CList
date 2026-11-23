// DOM-free form rules and account-server selection data operations.
/** @returns {CListAuthPanelState} */
function authPanelState(serverUrl) {
    return {generation:0, mode:'login', panel:'closed', busy:false, error:null, registration:null, serverUrl, draftServer:null};
}
function authServerLabel(url, localUrl) {
    if (url === localUrl) return 'Local (this device only)';
    try { return new URL(url).hostname; } catch { return url; }
}
/** @returns {CListAuthInput} */
function validateAuthInput(input, mode) {
    const username = input.username.trim().toLowerCase(), password = input.password;
    if (!username || !password) throw new Error('Username and password are required.');
    if (mode === 'register') {
        if (password.length < 8) throw new Error('Password must be at least 8 characters.');
        if (password !== input.confirm) throw new Error('Passwords do not match.');
        if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(username)) throw new Error('Username must be 3–32 characters, start with a letter or digit, and contain only letters, digits, dots, hyphens, and underscores.');
    }
    return {mode, username, password};
}
function applyAuthServerSelection(url, previous, allowed, deps) {
    if (!allowed.includes(url)) throw new Error('Select an available account server.');
    // A failed preference write must leave the active server unchanged.
    deps.persist(url); deps.select(url);
    if (url !== previous) {
        try { deps.changed(); } catch (error) { return {warning:'Account server changed, but reader controls could not refresh: '+error.message}; }
    }
    return {warning:null};
}
