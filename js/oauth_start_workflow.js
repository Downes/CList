// Shared OAuth preparation with explicit PKCE/registration/storage/navigation effects.
async function startOAuthAuthorization(request, deps) {
    const options = { ...request.options, extra: structuredClone(request.options?.extra || {}) };
    const assert = () => { if (options.isCurrent && !options.isCurrent()) throw Object.assign(new Error('This authorization form expired. Reopen it to continue.'), { code: 'ExpiredOAuthStart' }); };
    assert(); const provider = deps.provider(request.providerType);
    if (!provider) throw new Error('Unknown OAuth provider: ' + request.providerType);
    const mode = deps.mode(); if (mode === 'file') throw new Error('OAuth is not supported when opening CList directly from a file. Use manual token entry instead.');
    const redirectUri = deps.origin() + '/callback.html';
    const client = provider.dynamicRegistration ? await deps.register(request.instanceUrl, provider, redirectUri)
        : { clientId: options.clientId || provider.clientId, clientSecret: null, redirectUri };
    assert(); const { codeVerifier, codeChallenge } = await deps.pkce(); assert();
    const state = deps.random(), key = deps.prefix + state;
    deps.persist(key, JSON.stringify({ accountKey: request.accountKey, providerType: request.providerType, instanceUrl: request.instanceUrl,
        issuer: deps.issuer, createdAt: deps.now ? deps.now() : Date.now(), clientId: client.clientId, clientSecret: client.clientSecret || null, redirectUri, codeVerifier, mode, extra: options.extra }));
    try {
        const params = new URLSearchParams({ client_id: client.clientId, redirect_uri: redirectUri, response_type: 'code', scope: options.scope || provider.scopes,
            state, code_challenge: codeChallenge, code_challenge_method: 'S256' });
        if (options.forceLogin) params.set('force_login', 'true');
        Object.entries(provider.extraAuthParams || {}).forEach(([key, value]) => params.set(key, value));
        assert(); deps.navigate((provider.authorizationUrl || request.instanceUrl + provider.authorizationPath) + '?' + params.toString());
    } catch (error) { deps.remove(key); throw error; }
}
