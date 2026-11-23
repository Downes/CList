// Callback pickup owns dispatch; credentials and original-session captures remain private.
function createOAuthCallbackController(deps, view) {
    const handlers = new Map(); let pending = null;
    async function pick() {
        const raw = deps.readResult(); if (!raw) return { status: 'empty' };
        let data;
        try { data = JSON.parse(raw); } catch (_) { throw new Error('Unreadable authorization result. Start authorization again.'); }
        if (!data || typeof data !== 'object') throw new Error('Invalid authorization result.');
        const handler = handlers.get(data.providerType);
        if (!handler) throw new Error('No handler for this authorization provider.');
        const source = deps.capture(), current = () => deps.current(source);
        if (!data.flowState || !data.issuer) throw new Error('This authorization predates session binding. Start it again.');
        const receipt = JSON.parse(deps.readFlow(data.flowState) || 'null');
        if (!receipt || receipt.phase !== 'exchanged' || receipt.providerType !== data.providerType || receipt.issuer !== data.issuer
            || (data.providerType === 'WordPress' && receipt.siteUrl !== data.siteUrl)
            || !Number.isFinite(receipt.createdAt) || deps.now() - receipt.createdAt > 1800000 || deps.now() < receipt.createdAt)
            throw new Error('Authorization receipt expired. Start authorization again.');
        const issuer = await deps.issuer(source);
        if (!current() || issuer !== data.issuer) throw new Error('Authorization belongs to a different CList session. Start it again.');
        deps.removeFlow(data.flowState);
        if (!current()) throw new Error('The authorization session changed. Start authorization again.');
        // Compare before removal: do not erase a newer result arriving during hashing.
        if (deps.readResult() !== raw) throw new Error('Authorization result changed. Reload to review the newer result.');
        deps.removeResult();
        await handler(structuredClone(data), { isCurrent: current });
        return { status: 'dispatched' };
    }
    return {
        register(type, handler) { handlers.set(type, handler); },
        pickup() {
            if (pending) return pending;
            pending = Promise.resolve().then(pick).catch(error => {
                deps.log(error); view.failure(error); return { status: 'failed' };
            }).finally(() => { pending = null; });
            return pending;
        },
    };
}

function captureOAuthIssuerSource() {
    const storeUrl = window.CList.config.flaskSiteUrl, keys = window.CList.keys;
    return { storeUrl, username: getSiteSpecificCookie(storeUrl, keys.USERNAME), token: getSiteSpecificCookie(storeUrl, keys.ACCESS_TOKEN),
        local: !!window.CList.isLocalMode?.(), epoch: window.CList.state.authEpoch || 0 };
}
function currentOAuthIssuerSource(source) {
    const next = captureOAuthIssuerSource();
    return Object.keys(source).every(key => source[key] === next[key]);
}
async function fingerprintOAuthIssuer(source) {
    if (!source.username || !source.token) throw new Error('Log in to CList before authorizing an account.');
    const bytes = new TextEncoder().encode(JSON.stringify([source.storeUrl, source.username, source.token, source.local]));
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}
let _oauthCallbackController;
function oauthCallbackController() {
    if (!_oauthCallbackController) {
        const keys = window.CList.keys;
        _oauthCallbackController = createOAuthCallbackController({
            readResult: () => localStorage.getItem(keys.OAUTH_CALLBACK_RESULT), removeResult: () => localStorage.removeItem(keys.OAUTH_CALLBACK_RESULT),
            readFlow: state => sessionStorage.getItem(keys.OAUTH_STATE_PREFIX + state), removeFlow: state => sessionStorage.removeItem(keys.OAUTH_STATE_PREFIX + state),
            capture: captureOAuthIssuerSource, current: currentOAuthIssuerSource, issuer: fingerprintOAuthIssuer,
            now: Date.now, log: error => console.error('[OAuth callback]', error),
        }, createOAuthCallbackView());
    }
    return _oauthCallbackController;
}
