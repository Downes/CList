class SessionEmitter {
    constructor() { this.handlers = new Map(); this.sent = []; this.open = false; this.closed = 0; }
    on(event, callback) { if (!this.handlers.has(event)) this.handlers.set(event, new Set()); this.handlers.get(event).add(callback); }
    off(event, callback) { this.handlers.get(event)?.delete(callback); }
    async emit(event, value) { for (const callback of [...(this.handlers.get(event) || [])]) await callback(value); }
    first(event) { return [...(this.handlers.get(event) || [])][0]; }
    send(value) { this.sent.push(value); }
    close() { this.open = false; this.closed++; for (const callback of [...(this.handlers.get('close') || [])]) callback(); }
}
class SessionPeer extends SessionEmitter {
    constructor() { super(); this.id = null; this.targets = []; this.destroyed = 0; this.reconnected = 0; }
    connect(id) { const channel = new SessionEmitter(); channel.peer = id; this.targets.push(channel); return channel; }
    reconnect() { this.reconnected++; }
    destroy() { this.destroyed++; }
}
function p2pGate() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
async function p2pFlush() { for (let i = 0; i < 12; i++) await Promise.resolve(); }
let previousP2pFixture = null;
function p2pFixture(bridge = false, loadPeer = null) {
    previousP2pFixture?.dispose();
    const root = document.createElement('div'); root.id = 'chat-section'; document.body.appendChild(root);
    const add = (tag, id) => { const node = document.createElement(tag); node.id = id; root.appendChild(node); return node; };
    const input = add('input', 'messageInput'), send = add('button', 'sendButton'), joinInput = add('input', 'peerIdInput');
    const join = add('button', 'connectButton'), label = add('span', 'my-peer-id');
    add('div', 'chat-messages');
    let source = 'synthetic-token', instance = null;
    const errors = [], states = [], peers = [], events = [], timers = [], fetches = [], behavior = {};
    const makePeer = () => { if (behavior.create) return behavior.create(); const value = new SessionPeer(); peers.push(value); return value; };
    const view = createP2pSessionView();
    Object.assign(globalThis, { showErrorModal: message => errors.push(message), showStatusMessage: message => events.push(['status', message]),
        showLeftOverlaySection: () => { root.style.display = 'block'; }, openLeftPane() {} });
    if (bridge) {
        Object.assign(globalThis, {
            Peer: class { constructor() { return makePeer(); } },
            getSiteSpecificCookie: (_url, key) => key === window.CList.keys.USERNAME ? 'tester' : source,
            appendMessage: text => events.push(['message', text]), sanitizeHTML: value => value, chatOptions: value => value,
            escapeHtml: value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
            _sendServiceAnnounce: channel => events.push(['announce', channel.peer]), propagatePeerList() {},
            toggleDiv() {}, setInterval: callback => { timers.push(callback); return timers.length; }, clearInterval() {},
            fetch: async (url, options) => { fetches.push({ url, options }); return behavior.fetch ? behavior.fetch(url, options) : { ok: false, status: 404 }; },
            loadIdentityKey: async () => behavior.key ? behavior.key() : null,
            verifySignature: async () => behavior.verify ? behavior.verify() : true,
            signMessage: async () => behavior.sign ? behavior.sign() : null
        });
    }
    const deps = { loadPeer, source: () => source, createPeer: makePeer, state: state => states.push(structuredClone(state)),
        activate() {}, ready: id => events.push(['ready', id]), connecting: id => events.push(['connect', id]),
        open: (channel, inbound) => events.push(['open', channel.peer, inbound]), closed: channel => events.push(['closed', channel.peer]),
        receive: async (channel, data, current) => { if (behavior.receive) await behavior.receive(); if (current()) events.push(['data', channel.peer, data]); },
        connectionError: (_channel, error) => errors.push(error.message), peerError: error => errors.push(error.message),
        reconnecting: () => events.push(['reconnecting']), send: async (text, current) => { if (behavior.send) await behavior.send(); if (current()) events.push(['send', text]); },
        dispose: () => events.push(['disposed']) };
    const start = () => {
        if (bridge) return instance = playChat();
        if (!instance) instance = createP2pSessionController(deps, view);
        instance.start(); return instance;
    };
    const click = async button => {
        if (button.dispatchEvent) { button.dispatchEvent(new MouseEvent('click', { bubbles: true })); await p2pFlush(); }
        else await button.listeners.click?.();
    };
    const key = async options => {
        const event = { key: 'Enter', preventDefault() { this.prevented = true; }, ...options };
        if (input.dispatchEvent) { const native = new KeyboardEvent('keydown', { key: event.key, shiftKey: !!event.shiftKey, isComposing: !!event.isComposing, bubbles: true, cancelable: true }); input.dispatchEvent(native); await p2pFlush(); event.prevented = native.defaultPrevented; }
        else await input.listeners.keydown?.(event);
        return event;
    };
    const f = { root, input, send, join, joinInput, label, errors, states, peers, events, behavior, timers, fetches, view, start, click, key,
        session: () => instance, source: () => { source += '-new'; },
        inbound: id => { const channel = new SessionEmitter(); channel.peer = id; return channel; },
        identity: () => ({ did: myDid, key: myIdentityKey }),
        dispose() { instance?.dispose(); root.remove(); } };
    previousP2pFixture = f; return f;
}
const p2pSessionCases = [
    ['lazy PeerJS coalesces startup and queues one join while retaining unsent text', async check => {
        const gate=p2pGate();let loads=0;const f=p2pFixture(false,()=>{loads++;return gate.promise;});
        const session=f.start();session.start();await p2pFlush();
        check(loads===1&&f.peers.length===0,'one pending library load');
        f.input.value='Keep draft';await f.click(f.send);check(f.input.value==='Keep draft','no pre-library send consumes draft');
        session.connect('remote','Captured discussion');session.connect('remote','Duplicate');
        gate.resolve();await p2pFlush();
        check(f.peers.length===1&&f.peers[0].targets.length===1,'one queued join replayed');
        check(f.events.some(e=>e[0]==='connect'&&e[1]==='remote'),'captured join delivered');f.dispose();
    }],
    ['late library completion cannot initialize a replaced source or disposed panel', async check => {
        for(const dispose of [false,true]){
            const gate=p2pGate(),f=p2pFixture(false,()=>gate.promise);const session=f.start();await p2pFlush();
            session.connect('remote');if(dispose)session.dispose();else f.source();
            gate.resolve();await p2pFlush();check(f.peers.length===0,'stale library cannot construct Peer');f.dispose();
        }
    }],
    ['lazy library failure is visible and an explicit new session can retry', async check => {
        let fail=true;const f=p2pFixture(false,async()=>{if(fail)throw Error('PeerJS unavailable');});
        f.start();await p2pFlush();check(f.errors.includes('PeerJS unavailable')&&!f.session().isCurrent(),'visible failure and retired session');
        fail=false;f.dispose();const retry=p2pFixture(false,async()=>{});retry.start();await p2pFlush();check(retry.peers.length===1,'explicit retry constructs Peer');retry.dispose();
    }],
    ['initialization is single-use and hidden controls retain their live session', async check => {
        const f = p2pFixture(), session = f.start(); session.start(); check(f.peers.length === 1, 'one Peer instance');
        await f.peers[0].emit('open', 'peer-private'); check(f.label.textContent === 'peer-private' && f.states.at(-1).phase === 'ready', 'open updates view/summary');
        f.root.style.display = 'none'; check(session.isCurrent(), 'hiding panel does not disconnect');
        check(!JSON.stringify(f.states).includes('peer-private') && !JSON.stringify(f.states).includes('synthetic-token'), 'safe summary excludes identity/session');
    }],
    ['captured Send/Enter controls clear once and ignore Shift/composition', async check => {
        const f = p2pFixture(); f.start(); f.input.value = 'hello'; await f.click(f.send); await f.key({});
        check(f.events.filter(event => event[0] === 'send').length === 1 && f.input.value === '', 'Send and empty Enter dispatch once');
        f.input.value = 'draft'; await f.key({ shiftKey: true }); await f.key({ isComposing: true });
        check(f.input.value === 'draft' && f.events.filter(event => event[0] === 'send').length === 1, 'typing controls retain draft');
        await f.key({}); check(f.events.at(-1)[1] === 'draft', 'plain Enter sends captured text');
    }],
    ['duplicate outgoing connections and duplicate open callbacks are guarded', async check => {
        const f = p2pFixture(), session = f.start(); f.joinInput.value = 'remote'; await f.click(f.join); await f.click(f.join);
        check(f.peers[0].targets.length === 1, 'one pending connection per target');
        const channel = f.peers[0].targets[0]; await channel.emit('open'); await channel.emit('open');
        check(f.events.filter(event => event[0] === 'open').length === 1 && session.resources.knownPeers.has('remote'), 'open side effects once');
        channel.close(); check(!session.resources.connections.remote && f.states.at(-1).connectionCount === 0, 'close removes owned target');
        const named = session.connect('constructor'); check(!!named && session.resources.connections.constructor === named, 'peer IDs do not collide with inherited object keys');
    }],
    ['replaced incoming channel cannot remove or mutate its same-ID replacement', async check => {
        const f = p2pFixture(), session = f.start(), old = f.inbound('same'), next = f.inbound('same');
        await f.peers[0].emit('connection', old); const staleClose = old.first('close'), staleData = old.first('data');
        await f.peers[0].emit('connection', next); await staleClose(); await staleData({ text: 'old' });
        check(old.closed === 1 && session.resources.connections.same === next && !f.events.some(event => event[0] === 'data'), 'old channel is closed and callbacks inert');
        next.open = true; await next.emit('open'); check(f.events.some(event => event[0] === 'open' && event[2] === true), 'incoming handshake path preserved');
    }],
    ['expired source and rebuilt controls reject pending and saved callbacks', async check => {
        const f = p2pFixture(), session = f.start(), channel = session.connect('remote'), gate = p2pGate();
        f.behavior.receive = () => gate.promise; const pending = channel.emit('data', 'late');
        const staleOpen = f.peers[0].first('open'); f.source(); await staleOpen('old-id'); gate.resolve(); await pending;
        check(!session.isCurrent() && f.peers[0].destroyed === 1 && !f.events.some(event => event[0] === 'data'), 'expired callbacks reject and dispose');
        const g = p2pFixture(), current = g.start(); g.input.remove(); check(!current.isCurrent(), 'replaced controls expire view ownership');
    }],
    ['reconnect events are coalesced and transport failures are visible', async check => {
        const f = p2pFixture(); f.start(); await f.peers[0].emit('disconnected'); await f.peers[0].emit('error', { type: 'disconnected' });
        check(f.peers[0].reconnected === 1, 'one reconnect while pending');
        await f.peers[0].emit('open', 'ready'); await f.peers[0].emit('disconnected'); check(f.peers[0].reconnected === 2, 'later disconnect may reconnect');
        f.peers[0].connect = () => { throw Error('connection refused'); }; f.session().connect('broken');
        check(f.errors.includes('connection refused'), 'transport exception visible');
        f.session().dispose(); f.session().dispose(); check(f.peers[0].destroyed === 1 && !f.send.listeners?.click, 'idempotent resource/listener cleanup');
    }],
    ['real bridge reuses session, tears down source replacement and allows initialization retry', async check => {
        const f = p2pFixture(true), first = f.start(); f.start(); check(f.peers.length === 1, 'bridge reuses active session');
        const stale = f.peers[0].first('open'); f.source(); const next = f.start(); await stale('old');
        check(next !== first && f.peers[0].destroyed === 1 && f.peers.length === 2 && f.label.textContent === '', 'new source owns new session');
        f.dispose(); const g = p2pFixture(true); g.behavior.create = () => { throw Error('Peer unavailable'); };
        check(g.start() === null && g.errors.includes('Peer unavailable'), 'constructor failure visible');
        delete g.behavior.create; check(!!g.start() && g.peers.length === 1, 'explicit reopen retries initialization');
    }],
    ['real identity completion and signed sends cannot cross source replacement', async check => {
        const f = p2pFixture(true), key = p2pGate();
        f.behavior.fetch = () => ({ ok: true, json: async () => ({ id: 'did:old', alsoKnownAs: ['did:key:old'] }) }); f.behavior.key = () => key.promise;
        f.start(); await p2pFlush(); f.source(); f.behavior.fetch = () => ({ ok: false }); f.start(); key.resolve('old-private-key'); await p2pFlush();
        check(f.identity().did === null && f.identity().key === null, 'late identity stays out of replacement session');
        const channel = f.session().connect('recipient'); channel.open = true; const signature = p2pGate(); f.behavior.sign = () => signature.promise;
        const pending = sendMessage('captured text'); f.source(); f.start(); signature.resolve('signature'); await pending;
        check(!channel.sent.some(packet => packet.type === 'message'), 'old signed text never reaches another session');
    }],
    ['real packet handling rejects post-verification output from a closed channel', async check => {
        const f = p2pFixture(true); f.start(); const channel = f.session().connect('remote'), gate = p2pGate();
        f.behavior.verify = () => gate.promise;
        const pending = channel.emit('data', { type: 'message', msgId: 'once', message: 'stale payload', signature: 'synthetic' });
        channel.close(); gate.resolve(true); await pending;
        check(!f.events.some(event => String(event[1]).includes('stale payload')), 'no stale message rendering or relay');
    }],
    ['real heartbeat timer rejects stale sources and cannot stop a newer timer', async check => {
        const f = p2pFixture(true); f.start(); f.peers[0].id = 'local'; activeDiscussionName = 'old discussion'; startHeartbeat(); const old = f.timers[0];
        f.source(); f.start(); f.peers[1].id = 'new-local'; activeDiscussionName = 'new discussion'; startHeartbeat();
        await p2pFlush(); // Settle the separately scheduled identity read before measuring heartbeat traffic.
        const count = f.fetches.length; old(); await p2pFlush(); check(f.fetches.length === count && heartbeatInterval === 2, 'old callback leaves newer timer untouched');
        f.source(); f.timers[1](); await p2pFlush(); check(f.fetches.length === count && heartbeatInterval === null, 'expired source stops without network');
        f.start(); await p2pFlush(); f.peers[2].id = 'third'; activeDiscussionName = 'captured';
        startHeartbeat({ url: 'https://captured.invalid/api/discussions', token: 'captured-test-token' }); f.timers[2](); await p2pFlush();
        check(f.fetches.at(-1).url === 'https://captured.invalid/api/discussions' && f.fetches.at(-1).options.headers.Authorization === 'Bearer captured-test-token', 'heartbeat uses captured endpoint and token');
        const service = window.CList.defaults.DISCUSSIONS, before = f.fetches.length;
        window.CList.defaults.DISCUSSIONS = 'https://changed.invalid'; f.timers[2](); await p2pFlush();
        check(f.fetches.length === before && heartbeatInterval === null, 'changed service expires timer'); window.CList.defaults.DISCUSSIONS = service;
    }]
];
