function etherpadConnectionGate() { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; }
async function etherpadConnectionFlush() { for (let i = 0; i < 25; i++) await Promise.resolve(); }
function etherpadConnectionFixture() {
    _etherpadConnection?.controller.dispose(); _etherpadConnection = null;
    const host = document.createElement('div'); document.body.appendChild(host);
    const calls = [], commands = [], behavior = {}; let token = 'private-token';
    window.CList.state = { username: 'Alice', authEpoch: 1 }; window.CList.config = { flaskSiteUrl: 'https://identity.invalid' };
    window.CList.keys = { ACCESS_TOKEN: 'access_token', USERNAME: 'username' }; window.CList.ui.view = { writePaneContent: host };
    const account = { type: 'Etherpad', title: 'Selected', instance: 'https://pad.invalid/api/1.2.15', id: 'private-api-key' };
    Object.assign(globalThis, { currentEditor: 'etherpad',
        getSiteSpecificCookie: () => token, kvstoreAuthHeader: () => ({ Authorization: 'Bearer ' + token }),
        fetch: async (url, options) => { calls.push({ url, options }); if (behavior.fetch) return await behavior.fetch(url, options); return { ok: true, json: async () => ({ code: 0, data: { padIDs: ['One', '<Literal>'] } }) }; },
        initializeEtherpad: async () => { commands.push(['select', padName]); },
        createAndLoadEtherpad: name => { commands.push(['create', name]); }, sharePad: () => { commands.push(['share']); },
        bindEtherpadDocuments: owner => { owner.documents = { open: name => { commands.push(['select', name]); return Promise.resolve(true); }, dispose() {}, invalidate() {} }; return owner.documents; },
        showErrorModal: message => { throw new Error('Unexpected global feedback: ' + message); },
    });
    const button = text => Array.from(host.querySelectorAll('button')).find(node => node.textContent === text);
    return { host, calls, commands, behavior, account, button,
        mount(value = account) { return editorHandlers.etherpad.initialize(value); },
        node(id) { return host.querySelector('#' + id); },
        token(value) { token = value; },
        dispose() { _etherpadConnection?.controller.dispose(); _etherpadConnection = null; host.remove(); },
    };
}
const etherpadConnectionCases = [
    ['real request captures selected account endpoint/key/auth and renders literal pad names', async check => {
        const f = etherpadConnectionFixture(); await f.mount();
        const request = f.calls[0], body = new URLSearchParams(request.options.body);
        check(request.url === 'https://proxyp.mooc.ca' && body.get('url') === f.account.instance + '/listAllPads' && body.get('apikey') === 'private-api-key', 'selected account transport');
        check(request.options.headers.Authorization === 'Bearer private-token' && f.host.textContent.includes('<Literal>') && !f.host.querySelector('Literal'), 'auth and literal names');
        check(!f.host.textContent.includes('private-') && Object.keys(window.CList.state.etherpadConnection).sort().join() === 'count,mode,phase', 'private data excluded from state/view'); f.dispose();
    }],
    ['list refresh supersedes old reads and old row callbacks', async check => {
        const f = etherpadConnectionFixture(); await f.mount(); const old = f.node('padList').querySelector('a'), gate = etherpadConnectionGate();
        f.behavior.fetch = () => gate.promise; const first = listAllEtherpads();
        f.behavior.fetch = async () => ({ ok: true, json: async () => ({ data: { padIDs: ['Latest'] } }) }); await listAllEtherpads();
        gate.resolve({ ok: true, json: async () => ({ data: { padIDs: ['Old'] } }) }); await first; old.click();
        check(f.node('padList').textContent === 'Latest' && f.commands.length === 0, 'latest list and expired row');
        f.node('padList').querySelector('a').click(); await etherpadConnectionFlush(); check(f.commands[0][1] === 'Latest', 'captured current row handed to existing workflow'); f.dispose();
    }],
    ['failures have visible explicit retry and retired retry callbacks do not replay reads', async check => {
        const f = etherpadConnectionFixture(); f.behavior.fetch = async () => ({ ok: false, status: 503 }); await f.mount();
        check(f.host.textContent.includes('HTTP 503') && f.button('Retry pad list'), 'visible list failure');
        const old = f.button('Retry pad list'); f.behavior.fetch = null; old.click(); await etherpadConnectionFlush(); const count = f.calls.length; old.click();
        check(f.calls.length === count && f.node('padList').textContent.includes('One'), 'explicit retry once, retired retry rejected'); f.dispose();
    }],
    ['malformed and proxy/API error responses are rejected, empty lists are distinct', async check => {
        const f = etherpadConnectionFixture();
        for (const result of [{ error: 'Proxy offline' }, { code: 4, message: 'Access denied' }, { data: { padIDs: [42] } }]) {
            f.behavior.fetch = async () => ({ ok: true, json: async () => result });
            if (!_etherpadConnection) await f.mount(); else await listAllEtherpads();
            check(window.CList.state.etherpadConnection.phase === 'failed', 'malformed/API/proxy failure');
        }
        f.behavior.fetch = async () => ({ ok: true, json: async () => ({ data: { padIDs: [] } }) }); await listAllEtherpads();
        check(f.node('padList').textContent === 'No pads found.' && window.CList.state.etherpadConnection.count === 0, 'empty success'); f.dispose();
    }],
    ['guest form validates server and pad then uses only iframe navigation', async check => {
        const f = etherpadConnectionFixture(); await f.mount(null);
        check(f.calls.length === 0 && f.node('padList').textContent.includes('No Etherpad account'), 'accountless setup is read-free');
        f.node('thirdPartyEtherpadUrl').value = 'javascript:bad'; f.node('thirdPartyEtherpadPad').value = 'pad'; f.button('Connect').click();
        check(!f.node('padIframe').src && f.host.textContent.includes('HTTP'), 'unsafe URL rejected');
        f.node('thirdPartyEtherpadUrl').value = 'https://guest.invalid/path'; f.node('thirdPartyEtherpadPad').value = 'team-pad'; f.button('Connect').click();
        check(f.node('padIframe').src === 'https://guest.invalid/p/team-pad' && currentEtherpadAccount === null && currentEtherpadGuestBase === 'https://guest.invalid', 'guest origin and mutually exclusive account');
        check(window.CList.state.etherpadConnection.mode === 'guest' && f.calls.length === 0 && f.node('padContentSection').style.display === 'block', 'guest mode does not invoke API'); f.dispose();
    }],
    ['guest connection supersedes pending account listing without stale feedback', async check => {
        const f = etherpadConnectionFixture(), gate = etherpadConnectionGate(); f.behavior.fetch = () => gate.promise; const pending = f.mount();
        connectToThirdPartyEtherpad('https://guest.invalid', 'shared');
        gate.resolve({ ok: false, status: 500 }); await pending;
        check(f.node('padIframe').src === 'https://guest.invalid/p/shared' && !f.host.textContent.includes('HTTP 500'), 'guest survives old failure');
        check(await listAllEtherpads() === false && f.calls.length === 1, 'guest cannot list account pads'); f.dispose();
    }],
    ['hidden guest resource resumes same iframe, including legacy guest/account precedence', async check => {
        const f = etherpadConnectionFixture(); await f.mount(null); connectToThirdPartyEtherpad('https://guest.invalid', 'shared');
        const iframe = f.node('padIframe'); globalThis.currentEditor = 'texteditor'; f.host.querySelector('#etherpadDiv').style.display = 'none';
        await f.mount(f.account);
        check(f.node('padIframe') === iframe && iframe.src === 'https://guest.invalid/p/shared', 'guest connection preserved across editor/account selection');
        f.button('Select Pad').click(); check(f.node('padListSection').style.display === 'block', 'Select Pad changes view without remount'); f.dispose();
    }],
    ['account replacement clears original iframe and rejects old controls/read results', async check => {
        const f = etherpadConnectionFixture(); await f.mount(); const oldRefresh = f.button('Refresh pads'), iframe = f.node('padIframe'), gate = etherpadConnectionGate();
        f.behavior.fetch = () => gate.promise; const old = listAllEtherpads(); f.behavior.fetch = null;
        await f.mount({ ...f.account, instance: 'https://other.invalid/api/1.2.15', id: 'other-key' }); const count = f.calls.length; oldRefresh.click();
        gate.resolve({ ok: true, json: async () => ({ data: { padIDs: ['Obsolete'] } }) }); await old;
        check(iframe.src === 'about:blank' && f.node('padIframe') !== iframe, 'owned iframe disposed on replacement');
        check(f.calls.length === count && !f.host.textContent.includes('Obsolete') && new URLSearchParams(f.calls.at(-1).options.body).get('apikey') === 'other-key', 'account replacement isolated'); f.dispose();
    }],
    ['session expiry suppresses late reads/actions and auth replacement starts a fresh resource', async check => {
        const f = etherpadConnectionFixture(), gate = etherpadConnectionGate(); f.behavior.fetch = () => gate.promise; const pending = f.mount();
        f.token('new-token'); gate.resolve({ ok: true, json: async () => ({ data: { padIDs: ['Expired'] } }) }); await pending;
        check(!f.host.textContent.includes('Expired'), 'expired read rejected'); const count = f.calls.length; f.button('Refresh pads').click(); f.button('Create and Load').click();
        check(f.calls.length === count && !f.commands.length, 'expired controls rejected');
        f.behavior.fetch = null; await f.mount(); check(f.calls.at(-1).options.headers.Authorization === 'Bearer new-token', 'fresh auth capture on remount'); f.dispose();
    }],
    ['hidden and detached controls cannot dispatch retained legacy actions', async check => {
        const f = etherpadConnectionFixture(); await f.mount(); f.node('newPadName').value = 'captured-pad'; f.button('Create and Load').click(); f.button('Share').click();
        check(f.commands[0][1] === 'captured-pad' && f.commands[1][0] === 'share', 'legacy create/share handoff retained');
        globalThis.currentEditor = 'texteditor'; f.button('Create and Load').click(); check(f.commands.length === 2, 'hidden editor controls rejected');
        globalThis.currentEditor = 'etherpad'; const root = f.host.querySelector('#etherpadDiv'); root.remove(); f.button('Refresh pads')?.click();
        check(!_etherpadConnection.controller.active(), 'detached resource expires'); f.dispose();
    }],
];
