function oauthCallbackGate() { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; }
function oauthCallbackFixture() {
    const flows = new Map(), calls = [], errors = [], behavior = {};
    let result = null, session = 'Alice', now = 1000000;
    const receipt = { phase: 'exchanged', issuer: 'issuer:Alice', providerType: 'Dropbox', createdAt: now };
    const data = { providerType: 'Dropbox', accountKey: 'Files', accessToken: 'private-service-token', extra: { title: 'Files' }, flowState: 'random-state', issuer: 'issuer:Alice' };
    const deps = {
        readResult: () => result, removeResult: () => { result = null; calls.push('consume'); },
        readFlow: state => flows.get(state), removeFlow: state => flows.delete(state),
        capture: () => session, current: source => source === session,
        issuer: async source => { if (behavior.hash) await behavior.hash(); return 'issuer:' + source; },
        now: () => now, log: error => errors.push(error),
    };
    const view = createOAuthCallbackView();
    const oldStatus = globalThis.showStatusMessage; globalThis.showStatusMessage = message => calls.push(['feedback', message]);
    const controller = createOAuthCallbackController(deps, view);
    controller.register('Dropbox', async (value, context) => { calls.push(['dispatch', value]); if (behavior.handler) await behavior.handler(value, context); });
    return { controller, deps, flows, calls, errors, data, receipt, behavior,
        put(value = data) { result = JSON.stringify(value); }, raw(value) { result = value; }, result: () => result,
        authorize() { flows.set(data.flowState, JSON.stringify(receipt)); result = JSON.stringify(data); },
        session(value) { session = value; }, time(value) { now = value; }, dispose() { globalThis.showStatusMessage = oldStatus; },
    };
}
const oauthCallbackCases = [
    ['bound pickup is single-use and pending duplicates coalesce', async check => {
        const f = oauthCallbackFixture(), gate = oauthCallbackGate(); f.authorize(); f.behavior.hash = () => gate.promise;
        const first = f.controller.pickup(); check(first === f.controller.pickup(), 'same pickup promise'); gate.resolve();
        check((await first).status === 'dispatched', 'bound callback dispatched'); await f.controller.pickup();
        check(f.calls.filter(value => value[0] === 'dispatch').length === 1 && !f.flows.size && !f.result(), 'result and receipt consumed once'); f.dispose();
    }],
    ['malformed, unknown and unbound callbacks produce feedback without dispatch', async check => {
        for (const raw of ['{broken', 'null', JSON.stringify({ providerType: 'Other' }), JSON.stringify({ providerType: 'Dropbox' })]) {
            const f = oauthCallbackFixture(); f.raw(raw); check((await f.controller.pickup()).status === 'failed', 'bad result failed');
            check(f.calls.some(value => value[0] === 'feedback') && !f.calls.some(value => value[0] === 'dispatch'), 'visible rejection without dispatch'); f.dispose();
        }
    }],
    ['different owner, expiry and missing receipt reject callbacks', async check => {
        for (const mutate of [f => f.session('Bob'), f => f.time(3000000), f => f.flows.clear(), f => { f.receipt.providerType = 'Mastodon'; f.authorize(); }]) {
            const f = oauthCallbackFixture(); f.authorize(); mutate(f); check((await f.controller.pickup()).status === 'failed', 'mismatch rejected');
            check(!f.calls.some(value => value[0] === 'dispatch'), 'no handler for mismatched receipt/session'); f.dispose();
        }
    }],
    ['session and newer-result changes during binding hash cannot dispatch or erase newer results', async check => {
        for (const newer of [false, true]) {
            const f = oauthCallbackFixture(), gate = oauthCallbackGate(); f.authorize(); f.behavior.hash = () => gate.promise;
            const pending = f.controller.pickup(); await Promise.resolve();
            if (newer) f.put({ ...f.data, accessToken: 'newer-token' }); else f.session('Bob'); gate.resolve(); await pending;
            check(!f.calls.some(value => value[0] === 'dispatch'), 'changed source/result rejected');
            if (newer) check(JSON.parse(f.result()).accessToken === 'newer-token', 'newer result preserved'); f.dispose();
        }
    }],
    ['exchange uses captured transport, strips verifier from receipt and cannot replay', async check => {
        const f = oauthCallbackFixture(), flow = { ...f.receipt, phase: 'pending', accountKey: 'Files', instanceUrl: 'https://service.invalid', clientId: 'app', codeVerifier: 'private-verifier', extra: { extension: true }, mode: 'desktop-local' };
        f.flows.set('random-state', JSON.stringify(flow)); let count = 0;
        const deps = { prefix: '', read: key => f.flows.get(key), write: (key, value) => f.flows.set(key, value), remove: key => f.flows.delete(key),
            now: () => 1000000, provider: () => ({ tokenPath: '/token' }), exchange: async (code, config) => { count++; check(code === 'code' && config.codeVerifier === 'private-verifier', 'captured code/verifier'); return { access_token: 'token', refresh_token: 'refresh' }; } };
        const data = await exchangeOAuthCallback('?code=code&state=random-state', deps);
        check(data.issuer === flow.issuer && data.tokenData.refresh_token === 'refresh' && data.extra.extension, 'bound token/extensions returned');
        check(!JSON.stringify([...f.flows.values()]).includes('private-verifier'), 'exchange receipt has no verifier');
        try { await exchangeOAuthCallback('?code=code&state=random-state', deps); } catch (_) {}
        check(count === 1, 'no replayed exchange'); f.dispose();
    }],
    ['denial, missing state, malformed token and failed exchange never retry transport', async check => {
        for (const mode of ['denied', 'missing', 'token', 'network', 'legacy']) {
            const f = oauthCallbackFixture(); f.flows.set('state', JSON.stringify({ ...f.receipt, phase: 'pending', issuer: mode === 'legacy' ? null : f.receipt.issuer })); let count = 0;
            if (mode === 'missing') f.flows.clear();
            const deps = { prefix: '', read: key => f.flows.get(key), write: (key, value) => f.flows.set(key, value), remove: key => f.flows.delete(key), now: () => 1000000,
                provider: () => ({}), exchange: async () => { count++; if (mode === 'network') throw new Error('Lost response'); return {}; } };
            const search = mode === 'denied' ? '?error=denied&state=state' : '?code=code&state=state'; let failed = false;
            try { await exchangeOAuthCallback(search, deps); } catch (_) { failed = true; }
            check(failed && !f.flows.size, 'failed callback consumes state');
            try { await exchangeOAuthCallback(search, deps); } catch (_) {}
            check(count === (['token', 'network'].includes(mode) ? 1 : 0), 'no implicit token exchange retries'); f.dispose();
        }
    }],
    ['original pickup guard reaches real account encryption and prevents a later-session write', async check => {
        const account = oauthAccountFixture(), f = oauthCallbackFixture(), gate = oauthCallbackGate(); f.authorize();
        account.behavior.encrypt = () => gate.promise;
        f.behavior.handler = (data, context) => account.save({ isCurrent: context.isCurrent });
        const pending = f.controller.pickup(); await oauthAccountFlush(); f.session('Bob'); gate.resolve(); await pending;
        check(account.writes.length === 0, 'original flow guard survives save-time capture and encryption'); account.dispose(); f.dispose();
    }],
    ['handler failure is visible and cannot automatically re-dispatch consumed credentials', async check => {
        const f = oauthCallbackFixture(); f.authorize(); f.behavior.handler = async () => { throw new Error('Handler failed'); };
        check((await f.controller.pickup()).status === 'failed', 'handler rejection observed'); await f.controller.pickup();
        check(f.calls.filter(value => value[0] === 'dispatch').length === 1 && f.calls.some(value => value[0] === 'feedback'), 'visible failure without repeated handler'); f.dispose();
    }],
];
