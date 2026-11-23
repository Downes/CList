function collabSetupGate() { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; }
function collabSetupFixture() {
    const account = oauthAccountFixture(), root = document.createElement('div'); document.body.appendChild(root);
    window.CList.schemas.Collab = {}; const requests = [], effects = [], behavior = {}; let finished = 0;
    globalThis.fetch = async (url, options) => { requests.push([url, options]); if (behavior.fetch) return await behavior.fetch(); return { ok: true, status: 200, json: async () => ({ username: '<server-user>' }) }; };
    globalThis.populateReadAccountList = () => effects.push('read'); globalThis.populatePostOptions = () => effects.push('post');
    const source = captureOAuthAccountSaveSource();
    const panel = window.CList.accountFlows.Collab({ container: root,
        back() { root.innerHTML = ''; }, finish() { finished++; root.style.display = 'none'; },
        async reloadAccounts() { if (behavior.reload) await behavior.reload(); return loadAccountRecords({ storeUrl: source.storeUrl, token: source.token, encKey: 'key', isCurrent: () => currentOAuthAccountSaveSource(source) }); },
        async refreshList() { effects.push('list'); },
    }); panel.open();
    return { account, root, panel, requests, effects, behavior, get finished() { return finished; },
        input(value) { root.querySelector('#collab-ws-input').value = value; }, connect() { return root.querySelector('#collab-connect-btn').onclick(); }, back() { return root.querySelector('#collab-back-btn').onclick(); },
        button(text) { return Array.from(root.querySelectorAll('button')).find(node => node.textContent === text); }, text: () => root.textContent,
        dispose() { root.remove(); account.dispose(); },
    };
}
const collabSetupCases = [
    ['real setup captures registration target/auth/DID and preserves the Collab account contract', async check => {
        const f = collabSetupFixture(); await f.connect(); const [url, options] = f.requests[0], data = JSON.parse(f.account.records.get('wss://collab.mooc.ca').slice(10));
        check(url === 'https://collab.mooc.ca/api/register' && options.headers.Authorization === 'Bearer private-kv-token' && JSON.parse(options.body).did === 'did:web:identity.invalid:users:User', 'captured endpoint, auth and cookie-owned DID');
        check(data.type === 'Collab' && data.instance === 'wss://collab.mooc.ca' && data.title === 'collab.mooc.ca' && data.permissions === 'e', 'original account shape');
        check(f.finished === 1 && f.account.writes.length === 1 && !f.effects.includes('read'), 'normal completion without reader mutation');
        check(!JSON.stringify(window.CList.state.collabSetup).includes('private'), 'safe presentation state'); f.dispose();
    }],
    ['invalid server URLs fail before registration or account writes', async check => {
        for (const value of ['', 'https://wrong.invalid', 'wss://user:password@server.invalid', 'wss://server.invalid?token=x']) {
            const f = collabSetupFixture(); f.input(value); await f.connect();
            check(!f.requests.length && !f.account.writes.length && !!f.root.querySelector('.error-message'), 'invalid URL rejected'); f.dispose();
        }
    }],
    ['Back, input and session changes during key preparation prevent registration', async check => {
        for (const mode of ['back', 'input', 'session']) {
            const f = collabSetupFixture(), gate = collabSetupGate(); f.account.behavior.key = () => gate.promise;
            const pending = f.connect(); await oauthAccountFlush();
            if (mode === 'back') f.back(); else if (mode === 'input') f.input('wss://new.invalid'); else f.account.token('new-session');
            gate.resolve('key'); await pending; check(!f.requests.length && !f.account.writes.length, 'expired ' + mode + ' cannot register'); f.dispose();
        }
    }],
    ['duplicate/remounted starts retain registration lock and accepted receipt', async check => {
        const f = collabSetupFixture(), gate = collabSetupGate(); f.behavior.fetch = () => gate.promise;
        const first = f.connect(); check(first === f.connect(), 'duplicate start coalesced'); await oauthAccountFlush(); f.panel.open();
        check(first === f.connect() && f.root.querySelector('#collab-connect-btn').disabled, 'remount retains lock');
        gate.resolve({ ok: true, status: 200, json: async () => ({ username: 'accepted' }) }); await first;
        check(f.requests.length === 1 && !f.account.writes.length, 'late acceptance cannot write into remounted form');
        await f.connect(); check(f.requests.length === 1 && f.account.writes.length === 1, 'accepted registration reused by explicit save continuation'); f.dispose();
    }],
    ['accepted registration survives encryption failure and account-only retry', async check => {
        const f = collabSetupFixture(); f.account.behavior.encrypt = async () => { throw new Error('Encryption failed'); }; await f.connect();
        check(f.requests.length === 1 && !f.account.writes.length && !!f.button('Retry account save'), 'registration and account failure separated');
        f.account.behavior.encrypt = null; await f.button('Retry account save').onclick();
        check(f.requests.length === 1 && f.account.writes.length === 1 && f.finished === 1, 'account-only retry'); f.dispose();
    }],
    ['uncertain registration requires explicit service retry; malformed acceptance never re-registers', async check => {
        const f = collabSetupFixture(); f.behavior.fetch = async () => { throw new Error('Lost response'); }; await f.connect(); await f.connect();
        check(f.requests.length === 1 && !f.account.writes.length && !!f.button('Retry registration after checking server'), 'uncertain outcome is not automatically replayed');
        f.behavior.fetch = null; await f.button('Retry registration after checking server').onclick();
        check(f.requests.length === 2 && f.account.writes.length === 1, 'only explicit registration retry sends again'); f.dispose();
        const g = collabSetupFixture(); g.behavior.fetch = async () => ({ ok: true, status: 200, json: async () => { throw new Error('Unreadable response'); } }); await g.connect();
        check(!!g.button('Continue account save') && !g.account.writes.length, 'HTTP acceptance retained despite unreadable body');
        await g.button('Continue account save').onclick(); check(g.requests.length === 1 && g.account.writes.length === 1, 'accepted registration not repeated'); g.dispose();
    }],
    ['accepted and uncertain account writes recover without replaying registration', async check => {
        const f = collabSetupFixture(); f.behavior.reload = async () => { throw new Error('List unavailable'); }; await f.connect();
        check(!!f.button('Retry refresh') && f.account.writes.length === 1, 'refresh failure retains account acceptance');
        f.behavior.reload = null; await f.button('Retry refresh').onclick(); check(f.requests.length === 1 && f.account.writes.length === 1, 'refresh retries only reads'); f.dispose();
        const g = collabSetupFixture(); g.account.behavior.afterPut = async () => { throw new Error('Lost account response'); }; await g.connect();
        await g.button('Check saved account').onclick(); check(g.requests.length === 1 && g.account.writes.length === 1 && g.finished === 1, 'uncertain account checked without registration/write replay'); g.dispose();
    }],
    ['late writes preserve newer draft/reader and detached recovery controls are inert', async check => {
        const f = collabSetupFixture(), gate = collabSetupGate(); f.account.behavior.put = () => gate.promise;
        const pending = f.connect(); await oauthAccountFlush(); f.input('wss://newer.invalid'); window.CList.state.reader.requestId++;
        gate.resolve(); await pending; check(!f.finished && !f.effects.includes('post') && f.root.querySelector('#collab-ws-input').value === 'wss://newer.invalid', 'newer surface preserved'); f.dispose();
        const g = collabSetupFixture(); g.behavior.fetch = async () => { throw new Error('Lost response'); }; await g.connect();
        const retry = g.button('Retry registration after checking server'); g.panel.open(); await retry.onclick(); check(g.requests.length === 1, 'detached retry cannot register'); g.dispose();
    }],
];
