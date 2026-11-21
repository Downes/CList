function discussionActionGate() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
const discussionActionResponse = (status = 200, items = []) => ({ ok: status >= 200 && status < 300, status, json: async () => items });
let previousDiscussionActions = null;
function discussionActionFixture(bridge = false) {
    previousDiscussionActions?.dispose();
    let root, input, publicChoice, create, leave, controller, source = 'synthetic-token';
    const requests = [], states = [], applied = [], events = [], behavior = {}, channels = {};
    const build = () => {
        root = document.createElement('div'); root.id = 'chat-section'; document.body.appendChild(root);
        const start = document.createElement('div'); start.id = 'discussion-button-div'; root.appendChild(start);
        const end = document.createElement('div'); end.id = 'end-discussion-div'; root.appendChild(end);
        const add = (parent, tag, id) => { const node = document.createElement(tag); node.id = id; parent.appendChild(node); return node; };
        input = add(start, 'input', 'discussionNameInput'); input.value = 'Original';
        publicChoice = add(start, 'input', 'discussionPublicCheckbox'); publicChoice.checked = true;
        create = add(start, 'button', 'advertiseDiscussionButton'); leave = add(end, 'button', 'endDiscussionButton');
    };
    build();
    const fetchMock = async (url, options) => {
        requests.push({ url, options });
        if (options.method === 'GET') return behavior.read ? behavior.read() : discussionActionResponse(200, [{ name: 'Original', peerId: 'local-peer' }]);
        return behavior.write ? behavior.write() : discussionActionResponse(201);
    };
    const session = { isCurrent: () => behavior.session !== false, resources: { peer: { id: 'local-peer' }, connections: channels } };
    const addChannel = id => {
        const channel = { peer: id, count: 0, close() {
            if (behavior.close) behavior.close(channel);
            channel.count++; if (channels[id] === channel) delete channels[id];
        } }; channels[id] = channel; return channel;
    };
    if (bridge) {
        activeDiscussionName = null;
        Object.assign(globalThis, { fetch: fetchMock, getSiteSpecificCookie: (_url, key) => key === window.CList.keys.USERNAME ? 'tester' : source,
            ensureP2pSession: () => session, startHeartbeat: () => events.push('start'), stopHeartbeat: () => events.push('stop'),
            appendMessage: text => events.push(text), refreshDiscussions: async () => { events.push('refresh'); if (behavior.refresh) await behavior.refresh(); } });
        controller = getP2pDiscussionActions();
    } else {
        controller = createP2pDiscussionActionsController({ source: () => source, state: state => states.push(structuredClone(state)),
            capture(kind, values) {
                if (!values.name) throw Error('Name required');
                return { name: values.name, peerId: 'local-peer', public: values.public, url: 'https://directory.invalid/api/discussions', token: source, effects: {} };
            },
            owns: op => !!op && behavior.owns !== false,
            write: op => writeP2pDiscussion(op, { fetch: fetchMock }),
            read: op => fetchP2pDiscussions(op, { fetch: fetchMock }),
            async apply(op) { if (behavior.apply) await behavior.apply(op); applied.push(op.name); }
        }, createP2pDiscussionActionView());
    }
    const f = { requests, states, applied, events, behavior, session, addChannel,
        root: () => root, input: () => input, create: () => create, leave: () => leave,
        state: () => bridge ? window.CList.state.chatDiscussionAction : states.at(-1),
        begin: (kind, origin) => bridge ? (kind === 'create' ? advertiseDiscussion(origin || create) : endDiscussion(origin || leave)) : controller.begin(kind, origin),
        button: label => Array.from(root.querySelectorAll('button')).find(button => button.textContent === label),
        source: () => { source += '-new'; },
        writes: () => requests.filter(request => request.options.method !== 'GET'),
        setActive: name => { activeDiscussionName = name; }, active: () => activeDiscussionName,
        rebuild() { root.remove(); build(); if (!bridge) controller.attach(createP2pDiscussionActionView()); },
        dispose() { if (bridge) _p2pDiscussionActions?.dispose(); else controller.dispose(); root.remove(); }
    };
    previousDiscussionActions = f; return f;
}
const discussionActionCases = [
    ['write transport captures exact Create/Leave payload and accepts empty successful bodies', async check => {
        const f = discussionActionFixture(); await f.begin('create');
        const request = f.writes()[0]; check(request.url === 'https://directory.invalid/api/discussions' && request.options.headers.Authorization === 'Bearer synthetic-token', 'captured destination/credentials');
        check(request.options.method === 'POST' && request.options.body === JSON.stringify({ name: 'Original', peerId: 'local-peer', public: true }), 'exact create payload');
        await f.begin('leave'); check(f.writes()[1].options.method === 'DELETE' && f.writes()[1].options.body === JSON.stringify({ name: 'Original' }), 'delete carries captured name only');
        check(f.state().receipt === 'accepted' && f.applied.length === 2, 'HTTP acceptance independent of JSON');
    }],
    ['pending/rebuilt controls keep one request and preserve newer drafts', async check => {
        const f = discussionActionFixture(), gate = discussionActionGate(); f.behavior.write = () => gate.promise;
        const pending = f.begin('create'); await f.begin('create'); f.rebuild(); f.input().value = 'New draft'; await f.begin('leave');
        check(f.writes().length === 1 && f.create().disabled && f.leave().disabled, 'one lock across rebuilt controls');
        gate.resolve(discussionActionResponse()); await pending;
        check(f.applied[0] === 'Original' && f.input().value === 'New draft' && f.state().phase === 'complete', 'captured effects and newer draft retained');
        check(!JSON.stringify(f.states).includes('synthetic-token') && !JSON.stringify(f.states).includes('Original'), 'safe state excludes captured data');
    }],
    ['uncertain writes require read-only review and explicit captured retry', async check => {
        const f = discussionActionFixture(); f.behavior.write = () => { throw Error('response lost'); }; await f.begin('create');
        f.input().value = 'Changed'; await f.begin('leave'); check(f.state().phase === 'uncertain' && f.writes().length === 1, 'uncertainty blocks new writes');
        await f.button('Check discussion list').onclick();
        check(f.requests.at(-1).options.method === 'GET' && f.writes().length === 1 && f.root().textContent.includes('does not confirm'), 'review is read-only and avoids false confirmation');
        check(f.root().textContent.includes('Original (public)'), 'review identifies original name and visibility');
        delete f.behavior.write; await f.button('Retry original request').onclick();
        check(f.writes().length === 2 && JSON.parse(f.writes()[1].options.body).name === 'Original' && f.input().value === 'Changed', 'explicit retry uses original payload');
    }],
    ['HTTP rejection/5xx and failed review retain appropriate receipts without automatic writes', async check => {
        const f = discussionActionFixture(); f.behavior.write = () => discussionActionResponse(403); await f.begin('create');
        check(f.state().receipt === 'rejected' && !!f.button('Retry original request'), 'definite rejection has explicit retry');
        f.behavior.write = () => discussionActionResponse(503); await f.button('Retry original request').onclick();
        const count = f.writes().length; f.behavior.read = () => { throw Error('check failed'); }; await f.button('Check discussion list').onclick();
        check(f.state().phase === 'uncertain' && f.root().textContent.includes('check failed') && f.writes().length === count, 'failed check retains uncertainty and no repeat write');
    }],
    ['accepted write with local failure retries effects only', async check => {
        const f = discussionActionFixture(); f.behavior.apply = () => { throw Error('local refresh failed'); }; await f.begin('create');
        check(f.state().receipt === 'accepted' && f.state().phase === 'effects-error', 'accepted receipt survives local failure');
        delete f.behavior.apply; await f.button('Retry local updates').onclick();
        check(f.writes().length === 1 && f.applied.length === 1 && f.state().phase === 'complete', 'local recovery never repeats write');
        await f.begin('create'); check(f.writes().length === 1, 'duplicate completed request not repeated');
    }],
    ['changed conversation and expired source suppress old effects and recovery callbacks', async check => {
        const f = discussionActionFixture(), gate = discussionActionGate(); f.behavior.write = () => gate.promise; const pending = f.begin('leave');
        f.behavior.owns = false; gate.resolve(discussionActionResponse()); await pending;
        check(f.state().phase === 'stale' && !f.applied.length, 'accepted old result preserves current conversation');
        const dismiss = f.button('Done').onclick; f.source(); dismiss(); check(f.state().phase === 'stale', 'expired callbacks have no state effects');
    }],
    ['real bridge creates once and controls exact active state/heartbeat', async check => {
        const f = discussionActionFixture(true); f.session.resources.peer.id = null; await f.begin('create'); check(!f.writes().length && f.root().textContent.includes('Peer ID'), 'missing peer rejected visibly');
        f.session.resources.peer.id = 'local-peer'; await f.begin('create'); await f.begin('create');
        check(f.active() === 'Original' && f.writes().length === 1 && f.events.filter(event => event === 'start').length === 1, 'one accepted create starts captured discussion');
        check(document.body.classList.contains('chat-active') && document.getElementById('discussion-button-div').style.display === 'none', 'view uses explicit active layout');
    }],
    ['real Leave preserves new channels/discussion introduced during the request', async check => {
        const f = discussionActionFixture(true), old = f.addChannel('old'), gate = discussionActionGate(); f.setActive('Original');
        f.behavior.write = () => gate.promise; const pending = f.begin('leave'); f.addChannel('new'); f.setActive('New discussion'); gate.resolve(discussionActionResponse()); await pending;
        check(old.count === 0 && f.active() === 'New discussion' && f.state().phase === 'stale', 'new activity preserved after accepted original delete');
        check(JSON.parse(f.writes()[0].options.body).name === 'Original', 'remote delete kept original target');
    }],
    ['real Leave local recovery closes only captured channels and never repeats DELETE', async check => {
        const f = discussionActionFixture(true), a = f.addChannel('a'), b = f.addChannel('b'); f.setActive('Original'); let failed = false;
        f.behavior.close = channel => { if (channel === b && !failed) { failed = true; throw Error('close failed'); } }; await f.begin('leave');
        check(f.state().phase === 'effects-error' && a.count === 1 && b.count === 0, 'partial close preserves accepted receipt');
        f.behavior.refresh = () => { throw Error('refresh failed'); };
        await f.button('Retry local updates').onclick();
        check(f.state().phase === 'effects-error' && f.active() === null, 'refresh failure retains accepted cleanup receipt');
        delete f.behavior.refresh; await f.button('Retry local updates').onclick();
        check(f.writes().length === 1 && a.count === 1 && b.count === 1 && f.active() === null, 'remaining local cleanup only');
        check(f.events.filter(event => String(event).startsWith('Left discussion:')).length === 1 && !document.body.classList.contains('chat-active'), 'one notice and deterministic inactive view');
    }],
    ['uncertain Leave pauses its heartbeat without closing channels or reissuing DELETE', async check => {
        const f = discussionActionFixture(true), channel = f.addChannel('remote'); f.setActive('Original');
        f.behavior.write = () => { throw Error('lost delete response'); }; await f.begin('leave');
        check(f.events.filter(event => event === 'stop').length === 1 && channel.count === 0 && f.active() === 'Original', 'owned heartbeat paused while connections retained');
        check(f.state().phase === 'uncertain' && f.root().textContent.includes('Heartbeat is paused'), 'uncertainty explains paused heartbeat');
        await f.begin('leave'); await f.button('Check discussion list').onclick();
        check(f.writes().length === 1 && !f.events.includes('start'), 'no automatic delete retry or re-advertisement');
    }],
    ['real bridge keeps pending lock after rebuild and rejects stale origin/source', async check => {
        const f = discussionActionFixture(true), gate = discussionActionGate(), origin = f.create(); f.behavior.write = () => gate.promise;
        const pending = f.begin('create'); f.rebuild(); f.input().value = 'New draft'; await f.begin('create', origin); await f.begin('create');
        check(f.writes().length === 1 && f.create().disabled, 'rebuilt same-source owner retains pending request');
        f.source(); gate.resolve(discussionActionResponse()); await pending;
        check(f.active() === null && !f.events.includes('start'), 'old source acceptance never activates new chat');
    }]
];
