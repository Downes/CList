function collabDocumentsGate() { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; }
async function collabDocumentsFlush() { for (let i = 0; i < 12; i++) await Promise.resolve(); }
function collabDocumentsFixture(bridge = false) {
    let source = 'original', controller;
    const outer = document.createElement('div'), options = document.createElement('div'); outer.appendChild(options); document.body.appendChild(outer);
    const ui = { loadOptions: options }, calls = [], opens = [], states = [], notices = [], behavior = {};
    const snapshot = { storeUrl: 'https://store.invalid', token: 'private-token', defaultServer: 'wss://default.invalid', accounts: [{ value: 'captured accounts' }] };
    const fetchMock = async (url, init) => { calls.push({ url, init: structuredClone(init) }); return behavior.fetch ? behavior.fetch() : { ok: true, json: async () => [{ id: 'namespace/notes', title: '<b>Literal title</b>' }, { id: 'namespace/fallback' }] }; };
    const accounts = async () => { if (behavior.accounts) return behavior.accounts(); return []; };
    const restBase = url => url.replace(/^wss?:\/\//, 'https://').replace(/\/$/, '');
    const server = () => behavior.defaultServer ? null : 'wss://captured.invalid';
    const title = id => id.slice(id.lastIndexOf('/') + 1);
    const open = async (record, wsUrl, current) => { opens.push({ record, wsUrl, current }); if (behavior.open) await behavior.open(); };
    Object.assign(globalThis, { showServiceError(root, heading, message) { const error = document.createElement('div'); error.className = 'error-message'; error.textContent = heading + ': ' + message; root.appendChild(error); }, showStatusMessage: message => notices.push(message) });
    if (bridge) {
        _collabDocuments?.dispose(); _collabDocuments = null;
        window.CList.ui = { view: ui }; window.CList.accounts = snapshot.accounts; window.CList.defaults = { COLLAB: 'https://default.invalid' };
        Object.assign(globalThis, { readerSession: () => ({ storeUrl: snapshot.storeUrl, token: source === 'original' ? snapshot.token : 'replacement' }),
            getAccounts: accounts, findAccountByType: (_type, opts) => { if (!Array.isArray(opts.accounts)) throw Error('Missing captured accounts'); return { parsedValue: { instance: 'wss://captured.invalid' } }; },
            wsUrlToRestBase: restBase, fetch: fetchMock });
    } else controller = createCollabDocumentsController({ current: () => source === 'original', capture: () => structuredClone(snapshot),
        read: (value, assertCurrent) => readCollabDocuments(value, { assertCurrent, accounts, server, restBase, fetch: fetchMock }),
        title, open, state: value => states.push(structuredClone(value)) }, createCollabDocumentsView(document, ui));
    return { options, calls, opens, states, notices, behavior, snapshot,
        load() { if (bridge) { const result = openCollabDocuments({ title, open }); controller = _collabDocuments; return result; } return controller.load(); },
        expire: () => { source = 'changed'; }, dispose() { controller?.dispose(); outer.remove(); } };
}
const collabDocumentsCases = [
    ['captured target/auth, normalized rows and literal titles', async check => {
        const f = collabDocumentsFixture(); check(await f.load() === null, 'self-managing loader retains null result');
        check(f.calls[0].url === 'https://captured.invalid/api/documents' && f.calls[0].init.headers.Authorization === 'Bearer private-token', 'captured list endpoint/header');
        const buttons = f.options.querySelectorAll('.account-button');
        check(buttons.length === 2 && buttons[0].textContent.includes('<b>Literal title</b>') && !buttons[0].querySelector('b'), 'literal safe row title');
        check(buttons[1].textContent.includes('fallback'), 'existing local document name fallback');
        check(f.states.at(-1).count === 2 && !JSON.stringify(f.states).includes('private-token'), 'public count excludes credentials/rows'); f.dispose();
    }],
    ['lazy accounts/default server, empty and failed account reads', async check => {
        const f = collabDocumentsFixture(); f.snapshot.accounts = []; f.behavior.defaultServer = true;
        f.behavior.fetch = () => ({ ok: true, json: async () => [] }); await f.load();
        check(f.calls[0].url === 'https://default.invalid/api/documents' && f.options.textContent.includes('No documents yet'), 'default server and empty message');
        f.behavior.accounts = () => { throw Error('account read failed'); }; await f.load();
        check(f.calls.length === 1 && f.options.textContent.includes('account read failed'), 'account error visible without fallback request');
        f.behavior.accounts = () => undefined; await f.load(); check(f.calls.length === 1 && f.options.textContent.includes('Could not read'), 'missing account result fails closed'); f.dispose();
    }],
    ['HTTP/malformed/login failures and explicit retry', async check => {
        const f = collabDocumentsFixture(); f.behavior.fetch = () => ({ ok: false, status: 503 }); await f.load();
        check(f.options.textContent.includes('503') && f.calls.length === 1, 'HTTP error visible without automatic retry');
        const retry = f.options.querySelector('button'); delete f.behavior.fetch; await retry.onclick();
        check(f.calls.length === 2 && f.options.querySelectorAll('.account-button').length === 2, 'explicit Retry loads again');
        f.behavior.fetch = () => ({ ok: true, json: async () => [{ id: 4, title: 'bad' }] }); await f.load(); check(f.options.textContent.includes('Invalid collaboration document entry'), 'malformed rows rejected');
        f.snapshot.token = ''; await f.load(); check(f.calls.length === 3 && f.options.textContent.includes('Log in'), 'missing token prevents request'); f.dispose();
    }],
    ['superseded and expired list results cannot replace current panel', async check => {
        const f = collabDocumentsFixture(), gate = collabDocumentsGate(); f.behavior.fetch = () => gate.promise;
        const first = f.load(); await collabDocumentsFlush(); delete f.behavior.fetch; await f.load();
        gate.resolve({ ok: true, json: async () => [{ id: 'old', title: 'Old result' }] }); await first;
        check(!f.options.textContent.includes('Old result') && f.options.querySelectorAll('.account-button').length === 2, 'superseded result ignored');
        const late = collabDocumentsGate(); f.behavior.fetch = () => late.promise; const pending = f.load(); await collabDocumentsFlush(); f.expire();
        f.options.textContent = 'New panel'; late.resolve({ ok: false, status: 500 }); await pending;
        check(f.options.textContent === 'New panel', 'expired failure cannot change another panel'); f.dispose();
    }],
    ['duplicate opening and stale saved rows', async check => {
        const f = collabDocumentsFixture(); await f.load(); const button = f.options.querySelector('.account-button'), gate = collabDocumentsGate(); f.behavior.open = () => gate.promise;
        const pending = button.onclick(); await button.onclick(); check(f.opens.length === 1 && button.disabled, 'opening lock rejects duplicate row callback');
        await f.load(); gate.resolve(); await pending; await button.onclick();
        check(f.opens.length === 1 && !f.opens[0].current(), 'rebuilt list expires saved row and in-flight opening guard');
        f.expire(); await f.options.querySelector('.account-button').onclick(); check(f.opens.length === 1, 'session change rejects current-looking row'); f.dispose();
    }],
    ['opening errors, explicit row retry and captured server', async check => {
        const f = collabDocumentsFixture(); f.behavior.open = () => { throw Error('connection failed'); }; await f.load();
        const button = f.options.querySelector('.account-button'); await button.onclick();
        check(f.options.textContent.includes('connection failed') && !button.disabled, 'opening failure visible with row unlocked');
        delete f.behavior.open; await button.onclick();
        check(f.opens.length === 2 && f.opens[1].record.id === 'namespace/notes' && f.opens[1].wsUrl === 'wss://captured.invalid', 'explicit retry retains captured document/server'); f.dispose();
    }],
    ['real browser bridge and replaced container guard', async check => {
        const f = collabDocumentsFixture(true); await f.load(); const button = f.options.querySelector('.account-button'); await button.onclick();
        check(f.opens[0].record.id === 'namespace/notes' && f.opens[0].wsUrl === 'wss://captured.invalid', 'real bridge dispatches exact selected record/server');
        check(Object.keys(window.CList.state.collabDocuments).sort().join() === 'count,opening,phase', 'bridge state is presentation-only');
        window.CList.ui.view.loadOptions = document.createElement('div'); await button.onclick();
        check(f.opens.length === 1, 'replaced Load container expires saved row'); f.dispose();
    }]
];
