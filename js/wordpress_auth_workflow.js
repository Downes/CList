// WordPress application-password redirects use the shared tab/session binding receipts.
function normalizeWordPressAuthSite(value) {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash)
        throw new Error('Enter a WordPress site URL without credentials, query or fragment.');
    return url.origin + url.pathname.replace(/\/+$/, '');
}
async function startWordPressAuthorization(request, deps) {
    const siteUrl = normalizeWordPressAuthSite(request.siteUrl);
    deps.assert();
    if (request.mode === 'file') throw new Error('WordPress authorization requires a served CList page.');
    const issuer = await deps.issuer(); deps.assert();
    const state = deps.random(), key = deps.prefix + state;
    const callback = new URL(request.origin + '/callback.html');
    if (request.mode === 'desktop-local' && callback.protocol === 'http:' && request.port) {
        if (!/^\d+$/.test(String(request.port)) || Number(request.port) < 1 || Number(request.port) > 65535) throw new Error('Invalid local callback port.');
        callback.href = 'https://clist.mooc.ca/callback.html'; callback.searchParams.set('local_port', String(request.port));
    }
    callback.searchParams.set('wp_state', state);
    const reject = new URL(callback); reject.searchParams.set('wp_denied', '1');
    // Reuse the cryptographically random state to construct a valid v4 app UUID.
    const appId = `${state.slice(0, 8)}-${state.slice(8, 12)}-4${state.slice(13, 16)}-${((parseInt(state[16], 16) & 3) | 8).toString(16)}${state.slice(17, 20)}-${state.slice(20, 32)}`;
    const params = new URLSearchParams({ app_name: 'CList', app_id: appId, success_url: callback.href, reject_url: reject.href });
    deps.write(key, JSON.stringify({ phase: 'pending', providerType: 'WordPress', siteUrl, issuer, createdAt: deps.now() }));
    try { deps.assert(); deps.navigate(siteUrl + '/wp-admin/authorize-application.php?' + params); }
    catch (error) { deps.remove(key); throw error; }
}

function completeWordPressAuthorization(search, deps) {
    const params = new URLSearchParams(search), state = params.get('wp_state');
    if (!state) throw new Error('This WordPress authorization has no session binding. Start it again.');
    const key = deps.prefix + state, raw = deps.read(key);
    if (!raw) throw new Error('WordPress authorization expired. Start it again.');
    const flow = JSON.parse(raw);
    // A replay must not erase an already accepted receipt waiting for pickup.
    if (flow.phase !== 'pending' || flow.providerType !== 'WordPress') throw new Error('WordPress authorization was already handled or is invalid.');
    deps.remove(key);
    if (!flow.issuer || !Number.isFinite(flow.createdAt) || deps.now() - flow.createdAt > 1800000 || deps.now() < flow.createdAt)
        throw new Error('WordPress authorization expired. Start it again.');
    if (params.get('wp_denied') === '1' || params.get('success') === 'false') throw new Error('WordPress authorization was declined.');
    const siteUrl = normalizeWordPressAuthSite(params.get('site_url'));
    if (siteUrl !== flow.siteUrl) throw new Error('WordPress returned a different site. Start authorization using its canonical site URL.');
    const userLogin = params.get('user_login'), password = params.get('password');
    if (!userLogin?.trim() || !password?.trim()) throw new Error('WordPress did not return complete credentials. Start authorization again.');
    /** @type {CListOAuthFlowReceipt} */
    const receipt = { phase: 'exchanged', providerType: 'WordPress', issuer: flow.issuer, createdAt: flow.createdAt, siteUrl };
    deps.write(key, JSON.stringify(receipt));
    return { providerType: 'WordPress', siteUrl, userLogin, password, flowState: state, issuer: flow.issuer };
}

function wordPressCallbackRelay(search) {
    const params = new URLSearchParams(search), port = params.get('local_port');
    if (!port) return null;
    if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) throw new Error('Invalid local callback port.');
    params.delete('local_port');
    return 'http://localhost:' + port + '/callback.html?' + params;
}
