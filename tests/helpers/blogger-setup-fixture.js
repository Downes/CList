function bloggerSetupGate() { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; }
function bloggerSetupFixture() {
    const account = oauthAccountFixture(), root = document.createElement('div'); document.body.appendChild(root);
    window.CList.schemas.Blogger = {};
    const calls = [], behavior = {}; let finished = 0;
    globalThis.populateReadAccountList = () => calls.push('read');
    globalThis.populatePostOptions = () => calls.push('post');
    const source = captureOAuthAccountSaveSource();
    const panel = window.CList.accountFlows.Blogger({ container: root,
        back() { root.innerHTML = ''; }, finish() { finished++; root.style.display = 'none'; },
        async reloadAccounts() { calls.push('reload'); if (behavior.reload) await behavior.reload(); return loadAccountRecords({ storeUrl: source.storeUrl, token: source.token, encKey: 'key', isCurrent: () => currentOAuthAccountSaveSource(source) }); },
        async refreshList() { calls.push('list'); },
    }); panel.open();
    function input(key, value) { root.querySelector('#blogger-' + key).value = value; }
    input('blog-id', '123456'); input('client-id', 'private-client.apps.googleusercontent.com');
    return { account, root, calls, behavior, panel, input, get finished() { return finished; },
        save() { return root.querySelector('#blogger-save-btn').onclick(); }, back() { return root.querySelector('#blogger-back-btn').onclick(); },
        button(text) { return Array.from(root.querySelectorAll('button')).find(node => node.textContent === text); },
        text: () => root.textContent, dispose() { root.remove(); account.dispose(); },
    };
}
const bloggerSetupCases = [
    ['real Blogger form and shared persistence keep exact account fields without authorization', async check => {
        const f = bloggerSetupFixture(); f.input('title', '<b>Literal title</b>'); const result = await f.save();
        const data = JSON.parse(f.account.records.get('123456').slice(10));
        check(result.status === 'saved' && data.type === 'Blogger' && data.id === 'private-client.apps.googleusercontent.com' && data.title === '<b>Literal title</b>' && data.permissions === 'w', 'exact Blogger account contract');
        check(f.finished === 1 && f.calls.includes('post') && !f.calls.includes('read'), 'owned post/list refresh without reader changes');
        check(!JSON.stringify(window.CList.state.bloggerSetup).includes('private-client'), 'client configuration excluded from presentation state'); f.dispose();
    }],
    ['validation is visible and blank titles retain Blog ID fallback', async check => {
        for (const [field, message] of [['blog-id', 'Blog ID'], ['client-id', 'Client ID']]) {
            const f = bloggerSetupFixture(); f.input(field, ''); await f.save(); check(!f.account.writes.length && f.text().includes(message), 'missing ' + field + ' rejected'); f.dispose();
        }
        const f = bloggerSetupFixture(); await f.save(); check(JSON.parse(f.account.records.get('123456').slice(10)).title === '123456', 'original title fallback'); f.dispose();
    }],
    ['setup help preserves origin and safe links using real DOM controls', async check => {
        const f = bloggerSetupFixture();
        check(f.root.querySelector('code').textContent === window.location.origin, 'literal current JavaScript origin');
        const links = f.root.querySelectorAll('a'); check(links.length === 5 && Array.from(links).every(link => link.target === '_blank' && link.rel === 'noopener noreferrer'), 'preserved setup links'); f.dispose();
    }],
    ['Back, new session, remount and changed raw values stop encryption-time writes', async check => {
        for (const mode of ['back', 'session', 'remount', 'input']) {
            const f = bloggerSetupFixture(), gate = bloggerSetupGate(); f.account.behavior.encrypt = () => gate.promise;
            const pending = f.save(); await oauthAccountFlush();
            if (mode === 'back') f.back(); else if (mode === 'session') f.account.token('new-session'); else if (mode === 'remount') f.panel.open(); else f.input('client-id', 'newer-draft');
            gate.resolve(); await pending; check(!f.account.writes.length && f.finished === 0, 'stale ' + mode + ' cannot write'); f.dispose();
        }
    }],
    ['duplicate saves and rebuilt controls retain one pending captured write', async check => {
        const f = bloggerSetupFixture(), gate = bloggerSetupGate(); f.account.behavior.put = () => gate.promise;
        const first = f.save(); check(first === f.save(), 'duplicate save coalesced'); await oauthAccountFlush();
        f.panel.open(); check(first === f.save() && f.root.querySelector('#blogger-save-btn').disabled, 'remount retains lock');
        gate.resolve(); await first; check(f.account.writes.length === 1 && f.finished === 0, 'accepted old save cannot close new form'); f.dispose();
    }],
    ['accepted write refresh failure and rebuilt recovery remain read-only', async check => {
        const f = bloggerSetupFixture(); f.behavior.reload = async () => { throw new Error('List unavailable'); }; await f.save();
        check(f.text().includes('Account saved; refresh failed') && f.account.writes.length === 1, 'accepted receipt retained');
        const gate = bloggerSetupGate(); f.behavior.reload = () => gate.promise; const pending = f.button('Retry refresh').onclick(); await oauthAccountFlush(); f.panel.open();
        check(f.root.querySelector('#blogger-save-btn').disabled, 'recovery lock survives remount'); gate.resolve(); await pending;
        check(f.account.writes.length === 1 && f.finished === 0, 'refresh cannot replay write or close newer form'); f.dispose();
    }],
    ['uncertain receipts require read-only checking then explicit retry or refresh', async check => {
        for (const accepted of [false, true]) {
            const f = bloggerSetupFixture();
            if (accepted) f.account.behavior.afterPut = async () => { throw new Error('Lost response'); };
            else f.account.behavior.put = async () => { throw new Error('Lost response'); };
            await f.save(); check(!!f.button('Check saved account'), 'uncertain save exposes check');
            await f.button('Check saved account').onclick();
            if (!accepted) {
                check(f.account.writes.length === 1 && !!f.button('Retry original account save'), 'unconfirmed read does not write');
                f.account.behavior.put = null; await f.button('Retry original account save').onclick();
            }
            check(f.account.writes.length === (accepted ? 1 : 2) && f.finished === 1, 'accepted receipt refreshes; unconfirmed requires explicit retry'); f.dispose();
        }
    }],
    ['newer drafts/readers and detached recovery controls survive late completions', async check => {
        const f = bloggerSetupFixture(), gate = bloggerSetupGate(); f.account.behavior.put = () => gate.promise;
        const pending = f.save(); await oauthAccountFlush(); f.input('title', 'Newer title'); window.CList.state.reader.requestId++;
        gate.resolve(); await pending;
        check(f.finished === 0 && !f.calls.includes('post') && f.root.querySelector('#blogger-title').value === 'Newer title', 'newer form/reader preserved'); f.dispose();
        const g = bloggerSetupFixture(); g.account.behavior.key = async () => { throw new Error('Key unavailable'); }; await g.save();
        const retry = g.button('Retry account save'); g.panel.open(); await retry.onclick(); check(!g.account.writes.length, 'detached retry inert'); g.dispose();
    }],
];
