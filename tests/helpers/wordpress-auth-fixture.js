function wordPressAuthGate() { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; }
function wordPressAuthFixture() {
    const account = oauthAccountFixture(), flows = new Map(), redirects = [], errors = [], behavior = {};
    let session = 'Alice', result = null, now = 1000000;
    const location = { origin: 'https://localhost:51888', mode: 'desktop-local', port: 51888 };
    globalThis.populatePostOptions = () => account.effects.push('post-options');
    const deps = {
        capture: () => session, current: source => source === session, issuer: async source => { if (behavior.hash) await behavior.hash(); return 'issuer:' + source; },
        location: () => ({ ...location }), random: () => '0123456789abcdef0123456789abcdef', prefix: 'flow:', now: () => now,
        write(key, value) { if (behavior.write) behavior.write(); flows.set(key, value); }, remove: key => flows.delete(key),
        navigate(url) { if (behavior.navigate) behavior.navigate(); redirects.push(url); }, log: error => errors.push(error),
    };
    const controller = createWordPressAuthController(deps, createWordPressAuthView());
    _wordPressAuthController = controller;
    const pickup = createOAuthCallbackController({
        capture: deps.capture, current: deps.current, issuer: deps.issuer, now: deps.now, log: deps.log,
        readResult: () => result, removeResult: () => { result = null; },
        readFlow: state => flows.get('flow:' + state), removeFlow: state => flows.delete('flow:' + state),
    }, createOAuthCallbackView());
    pickup.register('WordPress', wordPressAuthHandler);
    function complete(search) {
        const data = completeWordPressAuthorization(search, { prefix: 'flow:', now: deps.now, read: key => flows.get(key), write: deps.write, remove: deps.remove });
        result = JSON.stringify(data); return data;
    }
    return { account, flows, redirects, errors, behavior, location, controller, pickup, deps,
        start(options) { return wpAuthStart('https://blog.invalid/subsite/', options); },
        search(overrides = {}) {
            const auth = new URL(redirects.at(-1)), callback = new URL(auth.searchParams.get('success_url'));
            for (const [key, value] of Object.entries({ site_url: 'https://blog.invalid/subsite/', user_login: 'writer', password: 'private-app-password', ...overrides })) callback.searchParams.set(key, value);
            return callback.search;
        }, complete, raw(value) { result = JSON.stringify(value); }, time(value) { now = value; }, session(value) { session = value; },
        dispose() { account.dispose(); },
    };
}
const wordPressAuthCases = [
    ['real WordPress start, return, pickup and handler preserve captured credentials and account shape', async check => {
        const f = wordPressAuthFixture(); await f.start();
        const auth = new URL(f.redirects[0]), success = new URL(auth.searchParams.get('success_url')), reject = new URL(auth.searchParams.get('reject_url'));
        check(auth.pathname === '/subsite/wp-admin/authorize-application.php' && success.searchParams.get('wp_state') && reject.searchParams.get('wp_denied') === '1', 'subsite and bound success/reject URLs');
        check(/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/.test(auth.searchParams.get('app_id')), 'valid random-state-derived v4 app ID');
        const data = f.complete(f.search()); check(data.siteUrl === 'https://blog.invalid/subsite' && data.issuer === 'issuer:Alice', 'canonical captured site and binding');
        check(!JSON.stringify([...f.flows.values()]).includes('private-app-password'), 'receipt excludes credentials');
        await f.pickup.pickup(); const saved = JSON.parse(f.account.records.get('writer@blog.invalid').slice(10));
        check(saved.type === 'WordPress' && saved.id === 'private-app-password' && saved.title === 'blog.invalid' && saved.permissions === 'w', 'real handler/shared writer preserve account contract');
        check(f.account.effects.includes('post-options') && f.account.writes.length === 1 && !f.flows.size, 'owned refresh and single-use receipt');
        await f.pickup.pickup(); check(f.account.writes.length === 1, 'no callback replay'); f.dispose();
    }],
    ['duplicate starts coalesce and changed session/form cannot redirect after hashing', async check => {
        const f = wordPressAuthFixture(), gate = wordPressAuthGate(); f.behavior.hash = () => gate.promise; let active = true;
        const first = f.start({ isCurrent: () => active }); check(first === f.start(), 'same pending start');
        await Promise.resolve(); active = false; gate.resolve(); await first;
        check(!f.redirects.length && !f.flows.size, 'expired form stops redirect/persistence');
        const second = f.start(); await Promise.resolve(); f.session('Bob'); await second;
        check(!f.redirects.length && !f.flows.size, 'expired session stops redirect'); f.dispose();
    }],
    ['denial, malformed, legacy, expired and mismatched-site returns cannot save', async check => {
        for (const mode of ['denial', 'missing-password', 'legacy', 'expired', 'site', 'scheme']) {
            const f = wordPressAuthFixture(); await f.start(); let search = f.search(mode === 'site' ? { site_url: 'https://other.invalid/subsite' } : mode === 'scheme' ? { site_url: 'javascript:bad' } : mode === 'missing-password' ? { password: '' } : {});
            const params = new URLSearchParams(search);
            if (mode === 'denial') params.set('wp_denied', '1');
            if (mode === 'legacy') params.delete('wp_state');
            if (mode === 'expired') f.time(3000000);
            let failed = false; try { f.complete(params.toString()); } catch (_) { failed = true; }
            check(failed && !f.account.writes.length, 'rejected ' + mode + ' without account write'); f.dispose();
        }
    }],
    ['wrong-session pickup and later encryption-time expiry preserve the original save guard', async check => {
        for (const duringEncryption of [false, true]) {
            const f = wordPressAuthFixture(), gate = wordPressAuthGate(); await f.start(); f.complete(f.search());
            if (duringEncryption) f.account.behavior.encrypt = () => gate.promise; else f.session('Bob');
            const pending = f.pickup.pickup(); await oauthAccountFlush(); f.session('Bob'); gate.resolve(); await pending;
            check(f.account.writes.length === 0, 'no credential write for changed original session'); f.dispose();
        }
    }],
    ['local HTTP relay preserves state/credentials and HTTPS stays direct', async check => {
        const f = wordPressAuthFixture(); f.location.origin = 'http://localhost:51888'; await f.start();
        const success = new URL(new URL(f.redirects[0]).searchParams.get('success_url'));
        check(success.origin === 'https://clist.mooc.ca' && success.searchParams.get('local_port') === '51888', 'existing hosted HTTPS bounce');
        const forwarded = new URL(wordPressCallbackRelay(f.search()));
        check(forwarded.origin === 'http://localhost:51888' && forwarded.searchParams.has('wp_state') && forwarded.searchParams.get('password') === 'private-app-password' && !forwarded.searchParams.has('local_port'), 'exact relay state and credentials');
        f.complete(forwarded.search); await f.pickup.pickup(); check(f.account.writes.length === 1, 'relayed callback accepted');
        check(wordPressCallbackRelay('?wp_state=state') === null, 'no relay on direct callback');
        let failed = false; try { wordPressCallbackRelay('?local_port=99999'); } catch (_) { failed = true; } check(failed, 'invalid relay port rejected'); f.dispose();
    }],
    ['replayed return preserves accepted receipt; result-site substitution cannot dispatch', async check => {
        const f = wordPressAuthFixture(); await f.start(); const search = f.search(), data = f.complete(search); let failed = false;
        try { f.complete(search); } catch (_) { failed = true; }
        check(failed && f.flows.size === 1, 'replay preserves receipt awaiting pickup');
        f.raw({ ...data, siteUrl: 'https://other.invalid' }); await f.pickup.pickup();
        check(!f.account.writes.length, 'substituted callback site rejected'); f.raw(data); await f.pickup.pickup(); check(f.account.writes.length === 1, 'original receipt still usable'); f.dispose();
    }],
    ['storage/navigation failures are visible, clean their own state and permit explicit retry', async check => {
        for (const operation of ['write', 'navigate']) {
            const f = wordPressAuthFixture(); f.flows.set('unrelated', 'keep'); f.behavior[operation] = () => { throw new Error('Synthetic failure'); };
            check(await f.start() === false, 'start failure observed');
            check(f.account.messages.includes('Synthetic failure') && f.flows.size === 1 && f.flows.get('unrelated') === 'keep', 'visible failure with scoped cleanup');
            f.behavior[operation] = null; check(await f.start() === true && f.redirects.length === 1, 'explicit retry'); f.dispose();
        }
    }],
    ['real WordPress form Back and changed raw input expire pending authorization', async check => {
        for (const back of [false, true]) {
            const f = wordPressAuthFixture(), gate = wordPressAuthGate(), root = document.createElement('div'); document.body.appendChild(root);
            const panel = window.CList.accountFlows.WordPress({ container: root, back() { root.innerHTML = ''; } }); panel.open();
            const input = root.querySelector('#wp-site-url'); input.value = 'blog.invalid/subsite'; f.behavior.hash = () => gate.promise;
            const pending = root.querySelector('#wp-auth-btn').onclick(); await Promise.resolve();
            if (back) root.querySelector('#wp-back-btn').onclick(); else input.value = 'different.invalid';
            gate.resolve(); await pending; check(!f.redirects.length && !f.flows.size, 'real stale form rejected'); root.remove(); f.dispose();
        }
    }],
];
