function annotateSetupGate() { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; }
function annotateSetupFixture(initial = {}) {
    const account = oauthAccountFixture(), root = document.createElement('div'); document.body.appendChild(root);
    window.CList.schemas.Annotate = {}; window.CList.defaults = { ANNOTATIONS: initial.defaultServer || 'https://annotations.invalid' };
    const calls = [], effects = [], behavior = { ...initial }; let finished = 0;
    globalThis.fetch = async (url, options) => {
        calls.push([url, options]);
        if (options?.method === 'POST') { if (behavior.register) return await behavior.register(url, options); return { ok: true, status: 204 }; }
        if (behavior.health) return await behavior.health(url); return { ok: true, status: 200 };
    };
    globalThis.populateReadAccountList = () => effects.push('read'); globalThis.populatePostOptions = () => effects.push('post');
    const source = captureOAuthAccountSaveSource();
    const panel = window.CList.accountFlows.Annotate({ container: root,
        back() { root.innerHTML = ''; }, finish() { finished++; root.style.display = 'none'; },
        async reloadAccounts() { if (behavior.reload) await behavior.reload(); return loadAccountRecords({ storeUrl: source.storeUrl, token: source.token, encKey: 'key', isCurrent: () => currentOAuthAccountSaveSource(source) }); },
        async refreshList() { effects.push('list'); },
    }); panel.open();
    return { account, root, panel, calls, effects, behavior, get finished() { return finished; },
        posts: () => calls.filter(call => call[1]?.method === 'POST'),
        title(value = 'My Notes') { root.querySelector('#anno-title').value = value; },
        custom(value) { const select = root.querySelector('#anno-server-select'); select.value = '__custom__'; select.onchange(); const input = root.querySelector('#anno-custom-url'); input.value = value; input.onchange(); },
        connect() { return root.querySelector('#anno-add-btn').onclick(); }, back() { return root.querySelector('#anno-back-btn').onclick(); },
        button(text) { return Array.from(root.querySelectorAll('button')).find(node => node.textContent === text); }, text: () => root.textContent,
        dispose() { root.remove(); account.dispose(); },
    };
}
const annotateSetupCases = [
    ['real setup preserves health/registration transport and exact annotation account fields', async check => {
        const f = annotateSetupFixture(); f.title('<b>My notes</b>'); await f.connect();
        const [url, options] = f.posts()[0], data = JSON.parse(f.account.records.get('https://annotations.invalid').slice(10));
        check(url === 'https://annotations.invalid/api/register' && options.headers.Authorization === 'Bearer private-kv-token' && options.body === undefined, 'captured original POST contract');
        check(f.calls.filter(call => call[0].endsWith('/health')).every(call => !call[1]), 'health checks exclude credentials');
        check(data.type === 'Annotate' && data.instance === 'https://annotations.invalid' && data.title === '<b>My notes</b>' && data.permissions === 'rw', 'original account fields');
        check(f.finished === 1 && !f.effects.includes('read') && !JSON.stringify(window.CList.state.annotateSetup).includes('private'), 'safe completion/state'); f.dispose();
    }],
    ['default/custom server controls and default labels use literal DOM values', async check => {
        const f = annotateSetupFixture(); await oauthAccountFlush();
        check(f.text().includes('Found annotation server') && f.root.querySelector('#anno-custom-url').style.display === 'none', 'guarded default health feedback');
        f.custom('https://custom.invalid/'); f.title(); await f.connect();
        check(f.posts()[0][0] === 'https://custom.invalid/api/register' && f.account.records.has('https://custom.invalid'), 'selected custom URL normalized'); f.dispose();
        const g = annotateSetupFixture({ defaultServer: '<b>literal</b>' }); await oauthAccountFlush();
        check(!g.root.querySelector('b') && g.root.querySelector('option').textContent === '<b>literal</b>', 'safe default label'); g.dispose();
    }],
    ['missing title and unsafe server URLs cannot register; failed health permits explicit retry', async check => {
        const f = annotateSetupFixture(); await f.connect(); check(!f.posts().length && f.text().includes('title'), 'title required');
        f.title(); f.custom('https://user:secret@bad.invalid'); await f.connect(); check(!f.posts().length && !f.account.writes.length, 'unsafe URL rejected'); f.dispose();
        const g = annotateSetupFixture({ health: async () => ({ ok: false, status: 503 }) }); g.title(); await g.connect();
        check(!g.posts().length && g.text().includes('Server not reachable'), 'health failure precedes registration');
        g.behavior.health = null; await g.connect(); check(g.posts().length === 1 && g.account.writes.length === 1, 'explicit retry after health recovery'); g.dispose();
    }],
    ['superseded default probes cannot overwrite connection failures or newer selection feedback', async check => {
        const gate = annotateSetupGate(), f = annotateSetupFixture({ health: url => url.includes('annotations.invalid') ? gate.promise : Promise.resolve({ ok: true }) });
        f.custom('https://new.invalid'); await oauthAccountFlush();
        check(f.text().includes('https://new.invalid'), 'new selected health result displayed');
        gate.resolve({ ok: true }); await oauthAccountFlush(); check(!f.text().includes('Found annotation server at https://annotations.invalid'), 'old default result rejected'); f.dispose();
        const second = annotateSetupGate(), g = annotateSetupFixture({ health: () => second.promise });
        await g.connect(); check(g.text().includes('title'), 'new validation feedback displayed'); second.resolve({ ok: true }); await oauthAccountFlush();
        check(g.text().includes('title'), 'late default success cannot overwrite validation error'); g.dispose();
    }],
    ['duplicate/remounted connects retain the lock and accepted registration without new writes', async check => {
        const f = annotateSetupFixture(), gate = annotateSetupGate(); f.title(); f.behavior.register = () => gate.promise;
        const first = f.connect(); check(first === f.connect(), 'pending connect coalesced'); await oauthAccountFlush(); f.panel.open();
        check(first === f.connect() && f.root.querySelector('#anno-add-btn').disabled, 'remount retains lock');
        gate.resolve({ ok: true, status: 204 }); await first;
        check(f.posts().length === 1 && !f.account.writes.length, 'accepted stale registration cannot persist');
        f.title(); await f.connect(); check(f.posts().length === 1 && f.account.writes.length === 1, 'explicit continuation reuses registration'); f.dispose();
    }],
    ['Back, source changes and raw input edits stop writes after preflight awaits', async check => {
        for (const mode of ['back', 'session', 'input']) {
            const f = annotateSetupFixture(), gate = annotateSetupGate(); f.title(); f.account.behavior.key = () => gate.promise;
            const pending = f.connect(); await oauthAccountFlush();
            if (mode === 'back') f.back(); else if (mode === 'session') f.account.token('new-session'); else f.title('Newer title');
            gate.resolve('key'); await pending; check(!f.posts().length && !f.account.writes.length, 'expired ' + mode + ' cannot register'); f.dispose();
        }
    }],
    ['accepted registration survives encryption/list failure; recovery never registers again', async check => {
        for (const mode of ['encrypt', 'reload']) {
            const f = annotateSetupFixture(); f.title();
            if (mode === 'encrypt') f.account.behavior.encrypt = async () => { throw new Error('Encryption failed'); };
            else f.behavior.reload = async () => { throw new Error('List unavailable'); };
            await f.connect(); check(f.posts().length === 1 && !!f.button(mode === 'encrypt' ? 'Retry account save' : 'Retry refresh'), 'separate ' + mode + ' recovery');
            f.account.behavior.encrypt = null; f.behavior.reload = null; await f.button(mode === 'encrypt' ? 'Retry account save' : 'Retry refresh').onclick();
            check(f.posts().length === 1 && f.account.writes.length === 1 && f.finished === 1, 'only remaining account work retried'); f.dispose();
        }
    }],
    ['uncertain service/account writes require explicit retry or read-only confirmation', async check => {
        const f = annotateSetupFixture(); f.title(); f.behavior.register = async () => { throw new Error('Lost registration response'); }; await f.connect(); await f.connect();
        check(f.posts().length === 1 && !!f.button('Retry registration after checking server'), 'uncertain registration blocks automatic repeats');
        f.behavior.register = null; await f.button('Retry registration after checking server').onclick(); check(f.posts().length === 2 && f.account.writes.length === 1, 'explicit service retry'); f.dispose();
        const g = annotateSetupFixture(); g.title(); g.account.behavior.afterPut = async () => { throw new Error('Lost account response'); }; await g.connect();
        await g.button('Check saved account').onclick(); check(g.posts().length === 1 && g.account.writes.length === 1 && g.finished === 1, 'account confirmed without registration/write replay'); g.dispose();
    }],
];
