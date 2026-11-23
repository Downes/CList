// Real form/start/exchange/pickup/provider/save integration; all external effects mocked.
function oauthReauthorizationFixture(type = 'Mastodon') {
    const f = accountReauthorizationFixture(type), key = f.model._key;
    const stored = structuredClone(f.model); delete stored._key;
    stored.maxlength = '900'; stored.refresh = 'private-old-refresh'; stored.extension = { kept: true, version: 1 };
    f.account.records.set(key, 'encrypted:' + JSON.stringify(stored));
    globalThis.playRead = async () => {}; globalThis.populateReadAccountList = () => {};
    let result = null, exchanges = 0;
    const controller = createOAuthCallbackController({
        readResult: () => result, removeResult: () => { result = null; },
        readFlow: state => f.state.get(accountReauthorizationPrefix + state), removeFlow: state => f.state.delete(accountReauthorizationPrefix + state),
        capture: captureOAuthIssuerSource, current: currentOAuthIssuerSource, issuer: fingerprintOAuthIssuer,
        now: Date.now, log() {},
    }, { failure: error => f.account.messages.push(error.message) });
    controller.register(type, oauthReauthorizationHandlers[type]);
    return Object.assign(f, {
        key, stored, controller,
        writeStored(value) { f.account.records.set(key, 'encrypted:' + JSON.stringify(value)); },
        saved() { return JSON.parse(f.account.records.get(key).slice(10)); },
        exchanges: () => exchanges,
        async prepare(tokenData = { access_token: 'private-new-token', refresh_token: 'private-new-refresh' }, start = () => f.start()) {
            await start();
            const data = await exchangeOAuthCallback('?code=captured-code&state=captured-state', {
                prefix: accountReauthorizationPrefix, now: Date.now,
                read: key => f.state.get(key), remove: key => f.state.delete(key), write: (key, value) => f.state.set(key, value),
                provider: type => OAuthProviders[type], exchange: async () => { exchanges++; return tokenData; },
            });
            result = JSON.stringify(data);
        },
    });
}
const oauthReauthorizationCases = [
    ['initial provider authorization still creates accounts without an existing-record read', async check => {
        for (const type of ['Mastodon', 'Dropbox']) {
            const f = oauthReauthorizationFixture(type); f.account.records.delete(f.key);
            await f.prepare({ access_token: 'private-new-token' }, () => type === 'Mastodon'
                ? mastodonOAuthStart('Initial', f.key, 'rw', { feedback: false })
                : dropboxOAuthStart('app', f.key, 'b', '/Initial', { feedback: false }));
            await f.controller.pickup();
            check(f.account.writes.length === 1 && !f.account.reads.length && f.saved().id === 'private-new-token', 'initial account creation: ' + type); f.dispose();
        }
    }],
    ['Mastodon form choices and latest extensions survive the real callback save', async check => {
        const f = oauthReauthorizationFixture(); f.input('maxlength', '1200'); f.root.querySelector('#publicCheckbox').checked = false;
        await f.prepare(); f.writeStored({ ...f.stored, extension: { kept: true, version: 2 }, newExtension: { nested: ['retained'] } });
        await f.controller.pickup(); const saved = f.saved();
        check(saved.id === 'private-new-token' && saved.maxlength === '1200' && saved.public === false, 'new token and captured form fields');
        check(saved.extension.version === 2 && saved.newExtension.nested[0] === 'retained', 'latest stored extensions preserved');
        check(saved.title === 'Captured title' && saved.permissions === 'rw' && f.account.writes.length === 1, 'same key and form choices saved once');
        await f.controller.pickup(); check(f.exchanges() === 1 && f.account.writes.length === 1, 'consumed callback cannot exchange/write twice');
        check(!JSON.stringify(window.CList.state).includes('private-') && f.account.reads.length === 2, 'private data excluded from state and metadata rechecked'); f.dispose();
    }],
    ['Dropbox retains extensions/folder/permissions and rotates refresh credentials', async check => {
        const f = oauthReauthorizationFixture('Dropbox'); f.input('folder', '/Chosen'); f.input('permissions', 'r'); await f.prepare(); await f.controller.pickup();
        const saved = f.saved();
        check(saved.id === 'private-new-token' && saved.refresh === 'private-new-refresh', 'new access and refresh credentials');
        check(saved.extension.kept && saved.folder === '/Chosen' && saved.permissions === 'r' && saved.public, 'metadata and captured form choices preserved');
        check(f.account.writes[0][0] === 'My Dropbox' && f.account.writes.length === 1, 'original account key'); f.dispose();
    }],
    ['Dropbox omitted refresh tokens only retain credentials for the same application', async check => {
        for (const changed of [false, true]) {
            const f = oauthReauthorizationFixture('Dropbox'); if (changed) f.input('appKey', 'different-app');
            await f.prepare({ access_token: 'private-new-token' }); await f.controller.pickup();
            check(f.saved().refresh === (changed ? '' : 'private-old-refresh'), 'refresh token application ownership: ' + changed);
            check(f.saved().id === 'private-new-token' && f.saved().extension.kept, 'new token with preserved metadata'); f.dispose();
        }
    }],
    ['missing, malformed or replaced-type accounts fail visibly without recreation', async check => {
        for (const mode of ['deleted', 'malformed', 'type']) {
            const f = oauthReauthorizationFixture(); await f.prepare();
            if (mode === 'deleted') f.account.records.delete(f.key);
            else if (mode === 'malformed') f.account.records.set(f.key, 'encrypted:not json');
            else f.writeStored({ type: 'Dropbox', title: 'Replacement', id: 'replacement' });
            const before = f.account.records.get(f.key); await f.controller.pickup();
            check(!f.account.writes.length && f.account.records.get(f.key) === before, 'no destructive replacement: ' + mode);
            check(f.account.text().includes('Account could not be saved'), 'visible failure: ' + mode); f.dispose();
        }
    }],
    ['read failures are visible and explicit retry preserves original token without re-exchange', async check => {
        const f = oauthReauthorizationFixture(); await f.prepare(); f.account.behavior.get = async () => { throw new Error('Metadata unavailable'); };
        await f.controller.pickup(); check(!f.account.writes.length && f.account.text().includes('Metadata unavailable'), 'read failure stops write');
        f.account.behavior.get = null; await f.account.button('Retry account save').click(); await oauthAccountFlush();
        check(f.account.writes.length === 1 && f.saved().id === 'private-new-token' && f.saved().extension.kept && f.exchanges() === 1, 'retry only repeats account read/save'); f.dispose();
    }],
    ['newer stored metadata during encryption blocks the old write', async check => {
        const f = oauthReauthorizationFixture(), gate = oauthAccountGate(); await f.prepare(); f.account.behavior.encrypt = () => gate.promise;
        const pending = f.controller.pickup(); await oauthAccountFlush(); f.writeStored({ ...f.stored, title: 'Newer account', extension: { version: 3 } });
        gate.resolve(); await pending;
        check(!f.account.writes.length && f.saved().title === 'Newer account', 'newer metadata protected');
        check(f.account.text().includes('account changed') && window.CList.state.oauthAccountSave.receipt === 'none', 'conflict is visible before write dispatch'); f.dispose();
    }],
    ['original-session expiry during metadata read rejects all later writes', async check => {
        const f = oauthReauthorizationFixture(), gate = oauthAccountGate(); await f.prepare(); f.account.behavior.get = () => gate.promise;
        const pending = f.controller.pickup(); await oauthAccountFlush(); f.account.token('different-session'); gate.resolve(); await pending;
        check(!f.account.writes.length && f.saved().id === 'private-service-token', 'expired source cannot overwrite original account');
        check(!f.account.effects.length, 'no later-session UI installation'); f.dispose();
    }],
    ['uncertain reauthorization retains its merged receipt for read-only confirmation', async check => {
        const f = oauthReauthorizationFixture('Dropbox'); await f.prepare(); f.account.behavior.afterPut = async () => { throw new Error('Receipt lost'); };
        await f.controller.pickup(); check(f.account.writes.length === 1 && f.account.button('Check saved account'), 'uncertain merged write remains recoverable');
        f.account.behavior.afterPut = null; await f.account.button('Check saved account').click(); await oauthAccountFlush();
        check(f.account.writes.length === 1 && f.saved().extension.kept && f.exchanges() === 1, 'read-only check never repeats exchange/write'); f.dispose();
    }],
];
