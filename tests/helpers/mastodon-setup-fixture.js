function mastodonSetupGate() { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; }
function mastodonSetupFixture() {
    const account = oauthAccountFixture(), root = document.createElement('div'); document.body.appendChild(root);
    const calls = [], behavior = {}; let finished = 0;
    globalThis.populateReadAccountList = accounts => calls.push(['read', accounts]);
    globalThis.populatePostOptions = accounts => calls.push(['post', accounts]);
    globalThis.showErrorModal = message => account.messages.push(message);
    OAuthClient.login = async (key, type, url, options) => {
        calls.push(['oauth', key, type, url, options]); if (behavior.oauth) await behavior.oauth();
        if (!options.isCurrent()) throw new Error('Authorization form expired.');
    };
    const source = captureOAuthAccountSaveSource();
    const panel = window.CList.accountFlows.Mastodon({ container: root,
        back() { root.innerHTML = ''; }, finish() { finished++; root.style.display = 'none'; },
        async reloadAccounts() { calls.push(['reload']); if (behavior.reload) await behavior.reload(); return loadAccountRecords({ storeUrl: source.storeUrl, token: source.token, encKey: 'key', isCurrent: () => currentOAuthAccountSaveSource(source) }); },
        async refreshList() { calls.push(['list']); },
    }); panel.open();
    const ids = { username: 'mastodon-username-input', token: 'mastodon-manual-token', title: 'mastodon-manual-title', permissions: 'mastodon-manual-permissions' };
    function input(key, value) { root.querySelector('#' + ids[key]).value = value; }
    input('username', 'me@social.invalid'); input('token', 'private-mastodon-token');
    return { account, root, calls, behavior, panel, input, get finished() { return finished; },
        action(id) { return root.querySelector('#mastodon-' + id).onclick(); },
        button(text) { return Array.from(root.querySelectorAll('button')).find(node => node.textContent === text); },
        text: () => root.textContent, dispose() { root.remove(); account.dispose(); },
    };
}
const mastodonSetupCases = [
    ['real manual setup saves detached data through shared account APIs and owning panel refresh', async check => {
        const f = mastodonSetupFixture(); f.input('title', '<b>Literal</b>'); const saved = await f.action('manual-save-btn');
        const data = JSON.parse(f.account.records.get('me@social.invalid').slice(10));
        check(saved.status === 'saved' && data.type === 'Mastodon' && data.instance === 'me@social.invalid' && data.id === 'private-mastodon-token' && data.title === '<b>Literal</b>', 'exact manual account fields');
        check(f.finished === 1 && f.calls.some(call => call[0] === 'read') && f.calls.some(call => call[0] === 'post'), 'owned completion and list refresh');
        check(!JSON.stringify(window.CList.state.mastodonSetup).includes('private'), 'secret-free state'); f.dispose();
    }],
    ['invalid usernames and missing manual token fail visibly before persistence', async check => {
        for (const value of ['missing-host', 'a@https://bad', 'a@b@c']) {
            const f = mastodonSetupFixture(); f.input('username', value); await f.action('manual-save-btn');
            check(!f.account.writes.length && f.text().includes('username'), 'invalid username rejected'); f.dispose();
        }
        const f = mastodonSetupFixture(); f.input('token', ''); await f.action('manual-save-btn');
        check(!f.account.writes.length && f.text().includes('access token'), 'missing token feedback'); f.dispose();
    }],
    ['real OAuth helper carries instance, force-login and captured-form guard; duplicate actions coalesce', async check => {
        const f = mastodonSetupFixture(), gate = mastodonSetupGate(); f.behavior.oauth = () => gate.promise;
        const first = f.action('auth-btn'); check(first === f.action('manual-save-btn'), 'one pending OAuth/manual action');
        await oauthAccountFlush(); const call = f.calls.find(value => value[0] === 'oauth');
        check(call[1] === 'me@social.invalid' && call[2] === 'Mastodon' && call[3] === 'https://social.invalid' && call[4].forceLogin, 'actual helper parameters');
        f.input('username', 'new@social.invalid'); gate.resolve(); await first;
        check(!call[4].isCurrent() && !f.account.writes.length && f.text().includes('expired'), 'changed raw form expires OAuth'); f.dispose();
    }],
    ['Back, session change and rebuilt roots reject pre-write encryption completions', async check => {
        for (const mode of ['back', 'session', 'rebuild', 'input']) {
            const f = mastodonSetupFixture(), gate = mastodonSetupGate(); f.account.behavior.encrypt = () => gate.promise;
            const pending = f.action('manual-save-btn'); await oauthAccountFlush();
            if (mode === 'back') f.action('back-btn'); else if (mode === 'session') f.account.token('new-session'); else if (mode === 'rebuild') f.panel.open(); else f.input('token', 'newer-draft');
            gate.resolve(); await pending; check(!f.account.writes.length && f.finished === 0, 'no expired write: ' + mode); f.dispose();
        }
    }],
    ['duplicate manual saves and rebuilt controls share the pending write lock', async check => {
        const f = mastodonSetupFixture(), gate = mastodonSetupGate(); f.account.behavior.put = () => gate.promise;
        const first = f.action('manual-save-btn'); check(first === f.action('manual-save-btn'), 'pending save coalesced'); await oauthAccountFlush();
        f.panel.open(); check(first === f.action('manual-save-btn'), 'rebuilt panel keeps pending lock'); gate.resolve(); await first;
        check(f.account.writes.length === 1 && f.finished === 0, 'accepted original write does not close rebuilt form'); f.dispose();
    }],
    ['accepted write refresh failure offers only read-only refresh recovery', async check => {
        const f = mastodonSetupFixture(); f.behavior.reload = async () => { throw new Error('List unavailable'); }; await f.action('manual-save-btn');
        check(f.account.writes.length === 1 && f.text().includes('Account saved; refresh failed'), 'accepted write retained');
        f.behavior.reload = null; await f.button('Retry refresh').onclick();
        check(f.account.writes.length === 1 && f.finished === 1, 'refresh-only recovery'); f.dispose();
    }],
    ['uncertain write keeps read-only check through remount and never silently replays credentials', async check => {
        const f = mastodonSetupFixture(); f.account.behavior.afterPut = async () => { throw new Error('Lost response'); }; await f.action('manual-save-btn');
        check(f.account.writes.length === 1 && !!f.button('Check saved account'), 'uncertain receipt exposes check');
        f.panel.open(); await f.action('manual-save-btn'); check(f.account.writes.length === 1 && !!f.button('Check saved account'), 'remount preserves check and blocks new save');
        await f.button('Check saved account').onclick();
        check(f.account.writes.length === 1 && f.finished === 0, 'confirmed original write refreshes without closing newer form'); f.dispose();
    }],
    ['late write acceptance preserves newer draft and reader, while old recovery controls stay inert', async check => {
        const f = mastodonSetupFixture(), gate = mastodonSetupGate(); f.account.behavior.put = () => gate.promise;
        const pending = f.action('manual-save-btn'); await oauthAccountFlush(); f.input('token', 'newer-draft'); window.CList.state.reader.requestId++;
        gate.resolve(); await pending;
        check(f.finished === 0 && f.root.querySelector('#mastodon-manual-token').value === 'newer-draft' && !f.calls.some(call => call[0] === 'read'), 'newer draft/reader preserved'); f.dispose();
        const g = mastodonSetupFixture(); g.account.behavior.key = async () => { throw new Error('Key unavailable'); }; await g.action('manual-save-btn');
        const retry = g.button('Retry account save'); g.panel.open(); await retry.onclick();
        check(!g.account.writes.length, 'detached retry inert'); g.dispose();
    }],
    ['unconfirmed write requires read-only review before explicit retry of the original mounted draft', async check => {
        const f = mastodonSetupFixture(); f.account.behavior.put = async () => { throw new Error('Uncertain transport'); }; await f.action('manual-save-btn');
        await f.button('Check saved account').onclick();
        check(f.account.writes.length === 1 && !!f.button('Retry original account save'), 'unconfirmed check does not write');
        f.account.behavior.put = null; await f.button('Retry original account save').onclick();
        check(f.account.writes.length === 2 && f.finished === 1, 'only explicit original retry writes'); f.dispose();
    }],
    ['rebuilt form keeps refresh recovery busy until the captured read settles', async check => {
        const f = mastodonSetupFixture(); f.behavior.reload = async () => { throw new Error('List unavailable'); }; await f.action('manual-save-btn');
        const gate = mastodonSetupGate(); f.behavior.reload = () => gate.promise;
        const pending = f.button('Retry refresh').onclick(); await oauthAccountFlush(); f.panel.open();
        check(f.root.querySelector('#mastodon-manual-save-btn').disabled && window.CList.state.mastodonSetup.busy, 'recovery lock retained through rebuild');
        await f.action('manual-save-btn'); check(f.account.writes.length === 1, 'rebuilt action cannot start a second write');
        gate.resolve(); await pending; f.dispose();
    }],
];
