const accountReauthorizationSchemas = { Mastodon: structuredClone(window.CList.schemas.Mastodon), Dropbox: structuredClone(window.CList.schemas.Dropbox) };
const accountReauthorizationHooks = { Mastodon: window.CList.accountHooks.Mastodon, Dropbox: window.CList.accountHooks.Dropbox };
const accountReauthorizationStart = startOAuthAuthorization;
const accountReauthorizationPrefix = window.CList.keys.OAUTH_STATE_PREFIX;
function accountReauthorizationGate() { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; }
function accountReauthorizationFixture(type = 'Mastodon') {
    const account = oauthAccountFixture(), behavior = {}, redirects = [], calls = [], requests = [], state = new Map([['unrelated', 'keep']]);
    const oldStorage = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
    window.CList.keys.OAUTH_STATE_PREFIX = accountReauthorizationPrefix;
    Object.assign(window.CList.schemas, accountReauthorizationSchemas); Object.assign(window.CList.accountHooks, accountReauthorizationHooks);
    Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: {
        setItem(key, value) { state.set(key, value); if (behavior.persist) behavior.persist(); }, getItem: key => state.get(key), removeItem: key => state.delete(key),
    } });
    globalThis.fingerprintOAuthIssuer = async source => { if (behavior.fingerprint) await behavior.fingerprint(); return 'issuer:' + source.username; };
    startOAuthAuthorization = (request, deps) => accountReauthorizationStart(request, { ...deps, navigate: url => redirects.push(url) });
    OAuthClient._getOrRegisterClient = async (url, provider, redirectUri) => { calls.push(['registration', url]); if (behavior.registration) await behavior.registration(); return { clientId: 'client', clientSecret: 'private-client-secret', redirectUri }; };
    OAuthClient._generatePKCE = async () => { calls.push(['pkce']); if (behavior.pkce) await behavior.pkce(); return { codeVerifier: 'private-verifier', codeChallenge: 'challenge' }; };
    OAuthClient._randomState = () => 'captured-state';
    const root = document.createElement('div'), shell = document.createElement('div'), formNode = document.createElement('form'), fields = document.createElement('div');
    shell.id = 'sharedForm'; formNode.id = 'addKvForm'; fields.id = 'form-fields'; formNode.appendChild(fields); shell.appendChild(formNode); root.appendChild(shell); document.body.appendChild(root);
    const originalHook = accountReauthorizationHooks[type].reauthorize;
    window.CList.accountHooks[type] = { ...accountReauthorizationHooks[type], reauthorize(request, options) {
        requests.push(structuredClone(request)); if (behavior.hook) behavior.hook(request, options); return originalHook(request, options);
    } };
    const model = { _key: type === 'Mastodon' ? 'me@social.invalid' : 'My Dropbox', type, title: 'Captured title', id: 'private-service-token', permissions: type === 'Mastodon' ? 'rw' : 'b', appKey: 'private-app-key', folder: '/Captured', public: true, extension: { kept: true } };
    const form = createAccountForm(root, { close() { shell.style.display = 'none'; }, getAccountFlow() {}, updateAccount() {} }); form.build(window.CList.schemas[type], 'edit', model);
    function button(label) { return Array.from(root.querySelectorAll('button')).find(node => node.textContent === label); }
    return { account, root, shell, form, model, behavior, redirects, calls, requests, state, button,
        start() { return button('Re-authorize').onclick(); },
        input(key, value, event = false) { const node = root.querySelector('#' + key + 'Input'); node.value = value; if (event) { if (typeof node.dispatch === 'function') node.dispatch('input'); else node.dispatchEvent(new Event('input', { bubbles: true })); } },
        rebuild() { form.build(window.CList.schemas[type], 'edit', model); },
        text: () => root.textContent,
        dispose() { root.remove(); account.dispose(); startOAuthAuthorization = accountReauthorizationStart; if (oldStorage) Object.defineProperty(globalThis, 'sessionStorage', oldStorage); else delete globalThis.sessionStorage; },
    };
}
const accountReauthorizationCases = [
    ['real Mastodon hook/form/helper/start workflow captures metadata and prevents duplicate authorization', async check => {
        const f = accountReauthorizationFixture(), gate = accountReauthorizationGate(); f.behavior.registration = () => gate.promise;
        const first = f.start(); check(first === f.start(), 'duplicate reauthorization shares pending promise'); await oauthAccountFlush();
        check(f.requests[0].key === 'me@social.invalid' && f.requests[0].data.extension.kept && f.requests[0].data.id === 'private-service-token', 'detached complete account snapshot');
        gate.resolve(); await first; const url = new URL(f.redirects[0]);
        check(url.origin === 'https://social.invalid' && url.searchParams.get('force_login') === 'true' && f.calls.filter(call => call[0] === 'registration').length === 1, 'actual helper/start parameters');
        await f.start(); check(f.redirects.length === 1 && f.button('Re-authorize').disabled, 'successful intent cannot start twice');
        check(!JSON.stringify(window.CList.state.accountReauthorization).includes('private') && !f.account.writes.length, 'safe state and no account writes'); f.dispose();
    }],
    ['Dropbox existing-account hook preserves app key/folder/permissions and caller guard', async check => {
        const f = accountReauthorizationFixture('Dropbox'); await f.start();
        const url = new URL(f.redirects[0]), flow = JSON.parse(f.state.get(accountReauthorizationPrefix + 'captured-state'));
        check(url.origin === 'https://www.dropbox.com' && url.searchParams.get('client_id') === 'private-app-key', 'real Dropbox helper/client contract');
        check(flow.accountKey === 'My Dropbox' && flow.extra.folder === '/Captured' && flow.extra.permissions === 'b', 'captured existing account fields'); f.dispose();
    }],
    ['close, hidden ancestors, raw edits and manual mode reject pending redirects', async check => {
        for (const mode of ['close', 'hidden', 'input', 'manual', 'checkbox']) {
            const f = accountReauthorizationFixture(), gate = accountReauthorizationGate(); f.behavior.pkce = () => gate.promise;
            const pending = f.start(); await oauthAccountFlush();
            if (mode === 'close') f.root.remove(); else if (mode === 'hidden') f.shell.style.display = 'none'; else if (mode === 'input') f.input('title', 'New title'); else if (mode === 'manual') f.button('Enter manually').onclick(); else f.root.querySelector('#publicCheckbox').checked = false;
            gate.resolve(); await pending;
            check(!f.redirects.length && f.state.size === 1 && f.state.get('unrelated') === 'keep', 'expired ' + mode + ' cannot persist state/redirect'); f.dispose();
        }
    }],
    ['rebuilt controls retain pending lock and detached buttons cannot target the new form', async check => {
        const f = accountReauthorizationFixture(), gate = accountReauthorizationGate(); f.behavior.pkce = () => gate.promise;
        const old = f.button('Re-authorize'), pending = f.start(); await oauthAccountFlush(); f.rebuild();
        check(f.button('Re-authorize').disabled && f.start() === pending, 'rebuild retains pending lock');
        check(old.onclick() === false, 'old button rejected'); gate.resolve(); await pending;
        check(!f.redirects.length && !f.button('Re-authorize').disabled, 'expired pending work releases rebuilt controls'); f.dispose();
    }],
    ['cookie session changes reject pending and idle existing-account controls', async check => {
        const f = accountReauthorizationFixture(), gate = accountReauthorizationGate(); f.behavior.fingerprint = () => gate.promise;
        const pending = f.start(); await oauthAccountFlush(); f.account.token('new-session'); gate.resolve(); await pending;
        check(!f.redirects.length && !f.calls.length, 'session change prevents preparation/redirect');
        await f.start(); check(f.requests.length === 1, 'idle old form cannot authorize under new session'); f.dispose();
    }],
    ['input revisions and replacement field nodes expire snapshots even if values return to the original', async check => {
        const f = accountReauthorizationFixture(), gate = accountReauthorizationGate(); f.behavior.pkce = () => gate.promise;
        const pending = f.start(); await oauthAccountFlush(); f.input('title', 'Changed', true); f.input('title', 'Captured title', true); gate.resolve(); await pending;
        check(!f.redirects.length, 'edit-and-revert still expires original action'); f.dispose();
        const g = accountReauthorizationFixture('Dropbox'), key = accountReauthorizationGate(); g.behavior.pkce = () => key.promise;
        const old = g.start(); await oauthAccountFlush(); const input = g.root.querySelector('#appKeyInput'), replacement = document.createElement('input'); replacement.id = input.id; replacement.value = input.value; input.parentNode.appendChild(replacement); input.remove(); key.resolve(); await old;
        check(!g.redirects.length, 'replaced input identity expires action'); g.dispose();
    }],
    ['owned preparation failures remain inline with explicit retry and draft preservation', async check => {
        const f = accountReauthorizationFixture(); f.behavior.registration = async () => { throw new Error('<server failure>'); }; await f.start();
        check(f.text().includes('<server failure>') && !f.root.querySelector('server') && !f.button('Re-authorize').disabled, 'literal inline failure and unlocked retry');
        check(f.root.querySelector('#titleInput').value === 'Captured title' && f.root.querySelector('#idInput').value === 'private-service-token', 'draft/hidden credential preserved');
        f.behavior.registration = null; await f.start(); check(f.redirects.length === 1 && !f.account.writes.length, 'only explicit retry starts again'); f.dispose();
    }],
    ['post-persist expiry removes only the new OAuth state without navigation', async check => {
        const f = accountReauthorizationFixture(); f.behavior.persist = () => f.input('title', 'Newer title'); await f.start();
        check(!f.redirects.length && f.state.size === 1 && f.state.get('unrelated') === 'keep', 'owned persisted state cleaned before expired redirect'); f.dispose();
    }],
];
