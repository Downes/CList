const originalDropboxOAuthLogin = OAuthClient.login;
function dropboxSetupGate() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
async function dropboxSetupFlush() { for (let i = 0; i < 20; i++) await Promise.resolve(); }
function dropboxSetupFixture() {
    const container = document.createElement('div'); document.body.appendChild(container);
    const storage = new Map([['unrelated', 'keep']]), redirects = [], calls = [], errors = [], behavior = {}; let token = 'private-token', count = 0, back = 0, mode = 'desktop-local';
    window.CList.config = { flaskSiteUrl: 'https://identity.invalid' }; window.CList.state = { username: 'Alice', authEpoch: 1 }; window.CList.keys.ACCESS_TOKEN = 'access_token';
    Object.assign(globalThis, { getSiteSpecificCookie: () => token, showErrorModal: message => errors.push(message) });
    const io = {
        provider: type => OAuthProviders[type], origin: () => window.location.origin, mode: () => mode,
        register: async (...args) => { calls.push(['register', ...args]); return behavior.register ? await behavior.register() : { clientId: 'dynamic-client', clientSecret: 'private-secret' }; },
        pkce: async () => { calls.push(['pkce']); return behavior.pkce ? await behavior.pkce() : { codeVerifier: 'private-verifier', codeChallenge: 'challenge' }; },
        random: () => 'synthetic-state-' + (++count), prefix: window.CList.keys.OAUTH_STATE_PREFIX,
        persist: (key, value) => { if (behavior.persist) behavior.persist(); storage.set(key, value); if (behavior.afterPersist) behavior.afterPersist(); },
        remove: key => storage.delete(key), navigate: url => { if (behavior.navigate) behavior.navigate(); redirects.push(url); },
    };
    OAuthClient.login = (accountKey, providerType, instanceUrl, options) => startOAuthAuthorization({ accountKey, providerType, instanceUrl, options }, io);
    OAuthClient._generatePKCE = io.pkce; OAuthClient._randomState = io.random;
    const flow = window.CList.accountFlows.Dropbox({ container, back: () => { back++; container.innerHTML = ''; } }); flow.open();
    const node = id => container.querySelector('#' + id);
    return { container, storage, redirects, calls, errors, behavior, io, flow, node,
        edit(id, value) { const input = node(id); input.value = value; input.dispatchEvent(new Event('input')); },
        submit() { return node('dropbox-auth-btn').onclick(); }, get back() { return back; }, mode(value) { mode = value; },
        token(value) { token = value; }, dispose() { container.remove(); },
    };
}
const dropboxSetupCases = [
    ['real setup/helper/workflow captures fields, PKCE wire parameters and private flow state', async check => {
        const f = dropboxSetupFixture(); f.edit('dropbox-app-key', 'private-app-key'); f.edit('dropbox-title', '<Files>'); f.edit('dropbox-folder', '/Captured');
        await f.submit(); const url = new URL(f.redirects[0]), record = JSON.parse(f.storage.get(window.CList.keys.OAUTH_STATE_PREFIX + 'synthetic-state-1'));
        check(url.origin === 'https://www.dropbox.com' && url.searchParams.get('client_id') === 'private-app-key' && url.searchParams.get('code_challenge_method') === 'S256' && url.searchParams.get('token_access_type') === 'offline', 'existing provider/PKCE parameters');
        check(record.accountKey === '<Files>' && record.extra.folder === '/Captured' && record.extra.permissions === 'b' && record.codeVerifier === 'private-verifier', 'captured private flow');
        check(Object.keys(window.CList.state.dropboxSetup).sort().join() === 'busy,phase' && !JSON.stringify(window.CList.state.dropboxSetup).includes('private-') && !f.container.textContent.includes('private-verifier'), 'safe presentation state');
        await f.submit(); check(f.redirects.length === 1 && f.node('dropbox-auth-btn').disabled, 'no second redirect after accepted start'); f.dispose();
    }],
    ['blank App Key is visible and failure permits explicit retry without automatic starts', async check => {
        const f = dropboxSetupFixture(); await f.submit(); check(!f.calls.length && f.container.textContent.includes('App Key first'), 'validation without PKCE');
        f.edit('dropbox-app-key', 'app'); f.behavior.pkce = async () => { throw new Error('Crypto unavailable'); }; await f.submit();
        check(f.container.textContent.includes('Crypto unavailable') && !f.node('dropbox-auth-btn').disabled && !f.redirects.length, 'visible failure/unlocked control');
        const count = f.calls.length; await dropboxSetupFlush(); check(f.calls.length === count, 'no automatic retry'); f.behavior.pkce = null; await f.submit(); check(f.redirects.length === 1, 'explicit retry'); f.dispose();
    }],
    ['duplicate clicks share one pending start and newer input expires pre-redirect work', async check => {
        const f = dropboxSetupFixture(), gate = dropboxSetupGate(); f.edit('dropbox-app-key', 'app'); f.behavior.pkce = () => gate.promise;
        const first = f.submit(), second = f.submit(); check(first === second, 'duplicate promise'); await dropboxSetupFlush(); f.node('dropbox-folder').value = '/Newer'; gate.resolve({ codeVerifier: 'old', codeChallenge: 'old' }); await first;
        check(f.redirects.length === 0 && f.storage.size === 1 && f.node('dropbox-folder').value === '/Newer' && !f.node('dropbox-auth-btn').disabled, 'newer form protected before storage/navigation'); f.dispose();
    }],
    ['Back, hidden/rebuilt panels and session expiry reject delayed redirects', async check => {
        const f = dropboxSetupFixture(), gate = dropboxSetupGate(); f.edit('dropbox-app-key', 'app'); f.behavior.pkce = () => gate.promise; const old = f.submit(); await dropboxSetupFlush();
        f.node('dropbox-back-btn').click(); gate.resolve({ codeVerifier: 'old', codeChallenge: 'old' }); await old;
        check(f.back === 1 && !f.redirects.length && f.storage.size === 1, 'Back expires pending start');
        f.flow.open(); f.edit('dropbox-app-key', 'app'); const other = dropboxSetupGate(); f.behavior.pkce = () => other.promise; const pending = f.submit(); await dropboxSetupFlush(); f.token('different'); other.resolve({ codeVerifier: 'old', codeChallenge: 'old' }); await pending;
        check(!f.redirects.length && !f.errors.length && !f.container.textContent.includes('expired'), 'old-session work has no new UI effects'); f.dispose();
    }],
    ['storage/navigation failures clean only the current state and preserve unrelated flows', async check => {
        const f = dropboxSetupFixture(); f.edit('dropbox-app-key', 'app'); f.behavior.navigate = () => { throw new Error('Navigation blocked'); }; await f.submit();
        check(f.container.textContent.includes('Navigation blocked') && f.storage.size === 1 && f.storage.get('unrelated') === 'keep', 'failed navigation cleans its own state');
        f.behavior.navigate = null; f.behavior.persist = () => { throw new Error('Storage blocked'); }; await f.submit();
        check(f.container.textContent.includes('Storage blocked') && !f.redirects.length, 'storage failure never navigates'); f.dispose();
    }],
    ['post-persist expiry cleans its state without exposing secrets', async check => {
        const f = dropboxSetupFixture(); f.edit('dropbox-app-key', 'app'); f.behavior.afterPersist = () => f.token('expired'); await f.submit();
        check(!f.redirects.length && f.storage.size === 1 && !f.errors.length, 'final guard removes only own flow'); f.dispose();
    }],
    ['shared workflow preserves dynamic registration, force-login and captured metadata contracts', async check => {
        const f = dropboxSetupFixture(), gate = dropboxSetupGate(); f.behavior.register = () => gate.promise; let current = true;
        const options = { forceLogin: true, extra: { title: 'Captured' }, isCurrent: () => current };
        const pending = startOAuthAuthorization({ accountKey: 'me@social.invalid', providerType: 'Mastodon', instanceUrl: 'https://social.invalid', options }, f.io);
        options.extra.title = 'Newer'; gate.resolve({ clientId: 'registered', clientSecret: 'private-secret' }); await pending;
        const record = JSON.parse([...f.storage.values()].find(value => value !== 'keep')), url = new URL(f.redirects[0]);
        check(record.extra.title === 'Captured' && record.clientSecret === 'private-secret' && url.searchParams.get('force_login') === 'true' && !url.href.includes('private-secret'), 'dynamic registration/captured metadata/private secret');
        const stale = dropboxSetupGate(); f.behavior.register = () => stale.promise; const old = startOAuthAuthorization({ accountKey: 'me', providerType: 'Mastodon', instanceUrl: 'https://social.invalid', options }, f.io).catch(error => error);
        current = false; stale.resolve({ clientId: 'old' }); check((await old).code === 'ExpiredOAuthStart' && f.redirects.length === 1, 'registration completion cannot revive expired form'); f.dispose();
    }],
    ['file runtime is rejected without state or navigation and detached controls cannot start', async check => {
        const f = dropboxSetupFixture(); f.edit('dropbox-app-key', 'app'); f.mode('file'); await f.submit();
        check(!f.calls.length && f.storage.size === 1 && f.container.textContent.includes('not supported'), 'file runtime fails closed');
        const button = f.node('dropbox-auth-btn'); f.dispose(); button.onclick(); check(!f.redirects.length, 'detached form ignored');
    }],
];
