// Explicit OAuth callback transport. State is single-use, including failed exchanges.
async function exchangeOAuthCallback(search, deps) {
    const params = new URLSearchParams(search), state = params.get('state');
    if (!state || (!params.has('code') && !params.has('error'))) return null;
    const key = deps.prefix + state, raw = deps.read(key);
    if (!raw) throw new Error('Authorization expired. Start authorization again.');
    deps.remove(key);
    const flow = JSON.parse(raw);
    if (!flow.issuer || flow.phase === 'exchanged' || !Number.isFinite(flow.createdAt)
        || deps.now() - flow.createdAt > 1800000 || deps.now() < flow.createdAt) throw new Error('Authorization expired. Start authorization again.');
    if (params.has('error')) throw new Error('Authorization was denied. Start authorization again if needed.');
    const provider = deps.provider(flow.providerType);
    if (!provider) throw new Error('Unknown authorization provider.');
    const tokenData = await deps.exchange(params.get('code'), {
        instanceUrl: flow.instanceUrl, tokenPath: provider.tokenPath, tokenUrl: provider.tokenUrl || null,
        clientId: flow.clientId, clientSecret: flow.clientSecret, redirectUri: flow.redirectUri,
        codeVerifier: flow.codeVerifier, mode: flow.mode,
    });
    const accessToken = typeof tokenData === 'string' ? tokenData : tokenData?.access_token;
    if (typeof accessToken !== 'string' || !accessToken) throw new Error('Authorization returned no access token. Start again.');
    /** @type {CListOAuthFlowReceipt} */
    const receipt = { phase: 'exchanged', issuer: flow.issuer, providerType: flow.providerType, createdAt: flow.createdAt };
    deps.write(key, JSON.stringify(receipt));
    return { accountKey: flow.accountKey, providerType: flow.providerType, instanceUrl: flow.instanceUrl,
        accessToken, tokenData: typeof tokenData === 'object' ? tokenData : null, extra: flow.extra || {},
        flowState: state, issuer: flow.issuer };
}
