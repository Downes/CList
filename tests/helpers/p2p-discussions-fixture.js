function discussionsGate() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
const discussionsResponse = (rows, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => rows });
let previousDiscussionsFixture = null;
function discussionsFixture(bridge = false) {
    previousDiscussionsFixture?.dispose();
    const root = document.createElement('ul'); root.id = 'discussion-list'; document.body.appendChild(root);
    const items = [{ name: '<b>Literal discussion</b>', peerId: 'captured-peer' }], requests = [], joins = [], states = [], behavior = {};
    let source = 'synthetic-token', controller;
    const fetchMock = async (url, options) => { requests.push({ url, options }); return behavior.read ? behavior.read(url, options) : discussionsResponse(items); };
    Object.assign(globalThis, {
        showServiceError(container, title, message) { const node = document.createElement('div'); node.className = 'error-message'; node.textContent = title + ': ' + message; container.appendChild(node); }
    });
    if (bridge) {
        const channels = {};
        Object.assign(globalThis, {
            fetch: fetchMock, getSiteSpecificCookie: (_url, key) => key === window.CList.keys.USERNAME ? 'test-user' : source,
            ensureP2pSession: () => behavior.unavailable ? null : { isCurrent: () => true, resources: { connections: channels },
                connect(id, name) { joins.push({ peerId: id, name }); channels[id] = { peer: id }; return channels[id]; } }
        });
    } else {
        controller = createP2pDiscussionsController({
            source: () => source,
            capture: () => ({ url: 'https://directory.invalid/api/discussions', token: source }),
            read: (request, signal) => fetchP2pDiscussions(request, { fetch: fetchMock, signal }),
            async join(item, current) { joins.push(item); if (behavior.join) return behavior.join(item, current); return { existing: false }; },
            state: state => states.push(structuredClone(state))
        }, createP2pDiscussionsView());
    }
    const f = { root, items, requests, joins, states, behavior,
        refresh: () => bridge ? refreshDiscussions() : controller.refresh(),
        buttons: () => Array.from(root.querySelectorAll('button')),
        click: index => f.buttons()[index].onclick?.(), source: () => { source += '-new'; },
        state: () => bridge ? window.CList.state.chatDiscussions : states.at(-1),
        dispose() { if (bridge) _p2pDiscussionsController?.dispose(); else controller.dispose(); root.remove(); }
    };
    previousDiscussionsFixture = f; return f;
}
const p2pDiscussionsCases = [
    ['captured GET and literal detached rows dispatch exact Join targets', async check => {
        const f = discussionsFixture(); await f.refresh();
        check(f.requests[0].url === 'https://directory.invalid/api/discussions' && f.requests[0].options.headers.Authorization === 'Bearer synthetic-token', 'captured endpoint/header');
        check(f.buttons()[0].textContent === 'Join <b>Literal discussion</b>' && !f.buttons()[0].children.length, 'literal label, no HTML');
        f.items[0].peerId = 'changed'; f.items[0].name = 'changed'; await f.click(0);
        check(f.joins[0].peerId === 'captured-peer' && f.joins[0].name === '<b>Literal discussion</b>', 'Join uses detached original row');
        check(!JSON.stringify(f.state()).includes('captured-peer') && !JSON.stringify(f.state()).includes('synthetic-token'), 'summary is credential/row-free');
    }],
    ['superseded and expired reads cannot replace a newer directory', async check => {
        const f = discussionsFixture(), first = discussionsGate(), second = discussionsGate(); let count = 0;
        f.behavior.read = () => ++count === 1 ? first.promise : second.promise;
        const old = f.refresh(), next = f.refresh(); check(f.requests[0].options.signal.aborted, 'superseded GET is aborted');
        second.resolve(discussionsResponse([{ name: 'New', peerId: 'new' }])); await next;
        first.resolve(discussionsResponse([{ name: 'Old', peerId: 'old' }])); await old;
        check(f.buttons()[0].textContent === 'Join New', 'late old result ignored');
        const pending = discussionsGate(); f.behavior.read = () => pending.promise; const expired = f.refresh(); f.source(); pending.reject(Error('late failure')); await expired;
        check(!f.root.textContent.includes('late failure') && f.state().phase === 'loading', 'expired failure has no newer-state effects');
    }],
    ['login, empty and failed reads have visible feedback and explicit retry', async check => {
        const f = discussionsFixture(); f.behavior.read = () => discussionsResponse(null, 401); await f.refresh();
        check(f.state().phase === 'login' && f.root.textContent.includes('Please log in') && !f.buttons().length, '401 is login feedback');
        f.behavior.read = () => discussionsResponse([]); await f.refresh(); check(f.state().phase === 'empty' && f.root.textContent.includes('No discussions'), 'empty feedback');
        f.behavior.read = () => discussionsResponse({}, 503); await f.refresh(); const calls = f.requests.length;
        check(f.state().phase === 'error' && f.root.textContent.includes('HTTP 503') && f.buttons()[0].textContent === 'Retry', 'HTTP error and retry visible');
        check(f.requests.length === calls, 'failure does not automatically retry'); delete f.behavior.read; await f.click(0);
        check(f.state().phase === 'ready' && f.requests.length === calls + 1, 'explicit retry loads again');
    }],
    ['malformed directory responses fail closed', async check => {
        const f = discussionsFixture();
        for (const value of [{ discussions: [] }, [null], [{ name: 'X' }], [{ name: '', peerId: 'p' }], [{ name: 'X', peerId: 4 }]]) {
            f.behavior.read = () => discussionsResponse(value); await f.refresh();
            check(f.state().phase === 'error' && f.buttons()[0].textContent === 'Retry' && !f.joins.length, 'invalid list produces no Join actions');
        }
        f.behavior.read = () => ({ ok: true, status: 200, json: async () => { throw Error('invalid JSON'); } }); await f.refresh();
        check(f.root.textContent.includes('invalid JSON'), 'JSON read failure visible');
    }],
    ['pending duplicate rows are locked together and failure requires explicit Join retry', async check => {
        const f = discussionsFixture(), gate = discussionsGate(); f.items.push({ name: 'Same peer', peerId: 'captured-peer' }); await f.refresh();
        f.behavior.join = () => gate.promise; const joining = f.click(0); await f.click(1);
        check(f.joins.length === 1 && f.buttons().every(button => button.disabled) && f.state().joiningCount === 1, 'one pending action per peer');
        gate.reject(Error('synthetic connection failure')); await joining;
        check(f.root.textContent.includes('synthetic connection failure') && f.buttons().every(button => !button.disabled), 'failed action visibly unlocks');
        delete f.behavior.join; await f.click(1);
        check(f.joins.length === 2 && f.buttons().every(button => button.disabled) && f.root.textContent.includes('Connection requested'), 'explicit retry accepted and duplicate row locked');
    }],
    ['rebuilt, detached and expired row callbacks and completions are inert', async check => {
        const f = discussionsFixture(); await f.refresh(); const oldJoin = f.buttons()[0].onclick, gate = discussionsGate();
        f.behavior.join = () => gate.promise; const pending = oldJoin(); await f.refresh(); const state = JSON.stringify(f.state());
        gate.reject(Error('stale join')); await pending; await oldJoin();
        check(f.joins.length === 1 && !f.root.textContent.includes('stale join') && JSON.stringify(f.state()) === state, 'old completion/callback cannot alter refreshed rows');
        const detached = f.buttons()[0], saved = detached.onclick; detached.parentNode.remove(); await saved(); check(f.joins.length === 1, 'detached row cannot Join');
        await f.refresh(); const expired = f.buttons()[0].onclick; f.source(); await expired(); check(f.joins.length === 1, 'expired source cannot Join');
    }],
    ['real compatibility bridge captures current service and reuses existing channels', async check => {
        const f = discussionsFixture(true); await f.refresh(); await f.click(0);
        check(f.requests[0].url === 'https://discussions.invalid/api/discussions' && f.joins[0].peerId === 'captured-peer', 'legacy refresh routes through captured request and session');
        await f.refresh(); await f.click(0); check(f.joins.length === 1 && f.root.textContent.includes('Already connected'), 'existing channel is not dispatched again');
        const old = f.buttons()[0].onclick; window.CList.defaults.DISCUSSIONS = 'https://replacement.invalid'; await old();
        check(f.joins.length === 1, 'changed service expires old row'); await f.refresh();
        check(f.requests.at(-1).url === 'https://replacement.invalid/api/discussions', 'next refresh captures new service');
        window.CList.defaults.DISCUSSIONS = 'https://discussions.invalid';
    }],
    ['replaced list and unavailable session cannot dispatch stale Join', async check => {
        const f = discussionsFixture(true); await f.refresh(); const old = f.buttons()[0].onclick; f.root.remove();
        const replacement = document.createElement('ul'); replacement.id = 'discussion-list'; document.body.appendChild(replacement);
        await old(); check(!f.joins.length, 'replacement list rejects old controls');
        f.behavior.unavailable = true; await f.refresh(); await replacement.querySelector('button').onclick();
        check(replacement.textContent.includes('Could not start the connection') && !f.joins.length, 'unavailable session produces visible failure');
        _p2pDiscussionsController.dispose(); replacement.remove();
    }]
];
