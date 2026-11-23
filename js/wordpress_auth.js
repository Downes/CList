function createWordPressAuthController(deps, view) {
    let pending = null, redirected = false;
    return {
        start(siteUrl, options = {}) {
            if (pending) return pending;
            if (redirected) return Promise.resolve(false);
            const source = deps.capture(), request = { siteUrl, ...deps.location() };
            const current = () => deps.current(source) && (!options.isCurrent || options.isCurrent());
            const assert = () => { if (!current()) throw new Error('WordPress authorization form or session expired. Reopen Accounts.'); };
            pending = Promise.resolve().then(() => startWordPressAuthorization(request, {
                assert, issuer: () => deps.issuer(source), random: deps.random, prefix: deps.prefix,
                now: deps.now, write: deps.write, remove: deps.remove, navigate: deps.navigate,
            })).then(() => { redirected = true; return true; })
                .catch(error => { deps.log(error); if (current()) { if (options.onError) options.onError(error); else view.failure(error); } return false; })
                .finally(() => { pending = null; });
            return pending;
        },
    };
}
let _wordPressAuthController;
function startWordPressAuth(siteUrl, options) {
    _wordPressAuthController ||= createWordPressAuthController({
        capture: captureOAuthIssuerSource, current: currentOAuthIssuerSource, issuer: fingerprintOAuthIssuer,
        location: () => ({ origin: window.location.origin, mode: OAuthStrategies.detectRuntimeMode(), port: window._launcherConfig?.port }),
        random: () => OAuthClient._randomState(), prefix: window.CList.keys.OAUTH_STATE_PREFIX, now: Date.now,
        write: (key, value) => sessionStorage.setItem(key, value), remove: key => sessionStorage.removeItem(key),
        navigate: url => { window.location.href = url; }, log: error => console.error('[WordPress authorization]', error),
    }, createWordPressAuthView());
    return _wordPressAuthController.start(siteUrl, options);
}
