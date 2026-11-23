function controlGate() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
let previousControlFixture = null;
function controlFixture(bridge = false) {
    previousControlFixture?.dispose();
    const root = document.createElement('div'); root.id = 'chat-messages'; document.body.appendChild(root);
    const states = [], sent = [], follows = [], relayed = [], connected = [], behavior = {};
    let current = true, sequence = 0, controller, name = 'Owner';
    const resources = { peer: { id: 'self' }, connections: Object.create(null), knownPeers: new Set(['self']), processedPeerLists: new Set(),
        usernames: Object.create(null), peerDids: Object.create(null), peerPublicKeyJwks: Object.create(null), peerAnnotationStores: Object.create(null) };
    const channel = id => { const value = { peer: id, open: true, send(packet) { if (behavior.send) behavior.send(value); sent.push({ peer: id, packet: structuredClone(packet) }); } }; resources.connections[id] = value; return value; };
    const remote = channel('remote'); channel('other');
    const escape = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const identity = () => ({ username: name, didKey: 'did:key:owner', did: 'did:web:owner', publicKeyJwk: { kty: 'OKP', x: 'public' }, privateKey: 'must-not-send', token: 'must-not-send' });
    const follow = async (did, token, button, valid) => { follows.push({ did, token, button, valid }); if (behavior.follow) await behavior.follow(); return valid(); };
    Object.assign(globalThis, { showServiceError(container, title, message) { const node = document.createElement('div'); node.className = 'error-message'; node.textContent = title + ': ' + message; container.appendChild(node); } });
    const session = { resources, isCurrent: () => current, connect(id) { connected.push(id); return channel(id); } };
    if (bridge) {
        _p2pSession = session; myUsername = name; myDid = 'did:web:owner'; myDidKey = 'did:key:owner'; myPublicKeyJwk = { kty: 'OKP', x: 'public' }; chatBc = { postMessage: packet => relayed.push(structuredClone(packet)) };
        Object.assign(globalThis, { captureP2pSessionGuard: () => () => current, getSiteSpecificCookie: () => 'captured-token', escapeHtml: escape,
            _getMyAnnotationStoreUrl: () => 'https://local-annotations.invalid' }); window._followUser = follow;
    } else {
        controller = createP2pControlController({ current: () => current, resources: () => resources, channelCurrent: value => resources.connections[value.peer] === value,
            identity, auth: () => ({ token: 'captured-token', did: 'did:web:owner' }), store: () => behavior.store || 'https://local-annotations.invalid',
            setName: value => { name = value; }, id: () => 'control-' + ++sequence, escape,
            connect: id => { connected.push(id); return channel(id); }, follow, relay: packet => relayed.push(structuredClone(packet)),
            broadcast: (packet, recipients, valid) => broadcastP2pPacket(packet, recipients, { current: valid, channelCurrent: value => resources.connections[value.peer] === value, send: (value, data) => value.send(data) }),
            state: state => states.push(structuredClone(state))
        }, createP2pControlView());
    }
    const f = { root, resources, remote, channel, states, sent, follows, relayed, connected, behavior,
        receive: packet => bridge ? handleP2pData(remote, packet, () => current && resources.connections.remote === remote) : controller.receive(remote, packet),
        name: value => bridge ? setUsername(value) : controller.setName(value),
        propagate: () => bridge ? propagatePeerList('remote') : controller.propagate('remote'),
        handshake: inbound => (bridge ? getP2pControl() : controller).handshake(remote, inbound),
        stores: () => bridge ? window.getPeerAnnotationStores() : controller.stores(),
        state: () => bridge ? window.CList.state.chatControl : states.at(-1),
        buttons: () => Array.from(root.querySelectorAll('button')), expire: () => { current = false; },
        dispose() { if (bridge) _p2pControl?.dispose(); else controller.dispose(); root.remove(); }
    };
    previousControlFixture = f; return f;
}
const p2pControlCases = [
    ['peer discovery validates/deduplicates lists and excludes self/existing peers', async check => {
        const f = controlFixture(), packet = { type: 'peer-list', id: 'list', peers: ['self', 'remote', 'fresh', 'fresh', 'constructor'] };
        await f.receive(packet); await f.receive(packet);
        check(f.connected.join(',') === 'fresh,constructor', 'unique new peer IDs only, including object-key names');
        check(f.sent.every(entry => entry.peer !== 'remote') && f.sent.every(entry => entry.packet.type === 'peer-list'), 'propagation excludes origin');
        await f.receive({ type: 'peer-list', id: 'bad', peers: [3] }); check(f.root.textContent.includes('invalid peer list') && f.connected.length === 2, 'malformed peer list causes visible error without connection');
    }],
    ['identity snapshots/duplicates replace old claims and escape join relay', async check => {
        const f = controlFixture(), data = { type: 'username-update', username: '<b>Peer</b>', did: 'did:key:peer', didWeb: 'did:web:peer', publicKeyJwk: { kty: 'OKP', x: 'captured' } };
        await f.receive(data); data.publicKeyJwk.x = 'mutated';
        check(f.resources.peerPublicKeyJwks.remote.x === 'captured' && f.root.textContent.includes('<b>Peer</b> (DID)'), 'detached key and literal username');
        check(f.relayed[0].html.includes('&lt;b&gt;Peer') && !f.relayed[0].html.includes('<b>Peer'), 'join text is escaped for popup');
        await f.receive({ ...data, publicKeyJwk: { kty: 'OKP', x: 'captured' } }); check(f.buttons().length === 1, 'duplicate identity does not create another follow row');
        await f.receive({ type: 'username-update', username: 'Anonymous peer' });
        check(!f.resources.peerDids.remote && !f.resources.peerPublicKeyJwks.remote && f.buttons()[0].disabled, 'anonymous update clears old claims and expires old follow');
    }],
    ['Follow uses captured token/DID and guarded existing API with duplicate lock', async check => {
        const f = controlFixture(); await f.receive({ type: 'username-update', username: 'peer', didWeb: 'did:web:peer' });
        const gate = controlGate(); f.behavior.follow = () => gate.promise; const button = f.buttons()[0], work = button.onclick(); await button.onclick();
        check(f.follows.length === 1 && f.follows[0].did === 'did:web:peer' && f.follows[0].token === 'captured-token' && button.disabled, 'captured Follow arguments and one pending action');
        gate.resolve(); await work; check(button.title === 'Following' && button.disabled && f.state().following === 0, 'accepted Follow becomes inert');
        check(!JSON.stringify(f.states).includes('captured-token') && !JSON.stringify(f.states).includes('did:web'), 'state exposes counts only');
    }],
    ['replaced identity/channel and expired session invalidate delayed Follow guards', async check => {
        const f = controlFixture(); await f.receive({ type: 'username-update', username: 'peer', didWeb: 'did:web:peer' });
        const gate = controlGate(); f.behavior.follow = () => gate.promise; const old = f.buttons()[0], work = old.onclick();
        await f.receive({ type: 'username-update', username: 'next', didWeb: 'did:web:next' });
        check(!f.follows[0].valid() && old.disabled && old.onclick === null, 'identity replacement expires captured Follow');
        gate.reject(Error('stale failure')); await work; check(!f.root.textContent.includes('stale failure'), 'late failure cannot affect replacement row');
        const current = f.buttons().at(-1), saved = current.onclick; f.channel('remote'); await saved(); check(f.follows.length === 1, 'old connection cannot follow through replacement');
        f.expire(); await f.receive({ type: 'username-update', username: 'ignored' }); check(f.resources.usernames.remote === 'next', 'expired control packet has no cache effects');
    }],
    ['service announcements accept HTTP(S), preserve exact URL and reject unsafe replacements', async check => {
        const f = controlFixture(), url = 'https://annotations.invalid/?a=1&b=2'; await f.receive({ type: 'service-announce', annotationStore: url });
        check(f.stores()[0] === url, 'exact announced URL retained');
        await f.receive({ type: 'service-announce', annotationStore: 'javascript:bad()' }); check(f.stores()[0] === url && f.root.textContent.includes('invalid annotation service URL'), 'unsafe service rejected without changing existing cache');
        await f.receive({ type: 'service-announce', annotationStore: null }); check(!f.stores().length, 'explicit absence removes old announcement');
        f.expire(); check(!f.stores().length, 'expired sessions expose no peer stores');
    }],
    ['handshakes and username replies expose only explicit public identity fields', async check => {
        const f = controlFixture(); f.handshake(false);
        check(f.sent.some(entry => entry.packet.type === 'request-username') && f.sent.some(entry => entry.packet.type === 'service-announce'), 'outbound handshake includes request and service');
        check(!JSON.stringify(f.sent).includes('must-not-send') && f.sent[0].packet.publicKeyJwk.x === 'public', 'explicit public projection excludes private identity fields');
        const start = f.sent.length; await f.receive({ type: 'request-username' }); check(f.sent.length === start + 1 && f.sent.at(-1).peer === 'remote', 'username reply targets only requesting channel');
        f.name(' Renamed '); check(f.sent.at(-1).packet.username === 'Renamed', 'trimmed username broadcast');
    }],
    ['malformed identity and failed transport/Follow are visible without retries', async check => {
        const f = controlFixture(); await f.receive({ type: 'username-update', username: 2 });
        check(!f.resources.usernames.remote && f.root.textContent.includes('invalid peer username'), 'bad identity has no partial cache mutation');
        f.behavior.send = () => { throw Error('uncertain channel'); }; f.propagate(); check(f.root.textContent.includes('uncertain') && !f.sent.length, 'uncertain control sends report once without retries');
        await f.receive({ type: 'username-update', username: 'peer', didWeb: 'did:web:peer' }); f.behavior.follow = () => { throw Error('Follow failed'); };
        await f.buttons()[0].onclick(); check(f.root.textContent.includes('Follow failed') && !f.buttons()[0].disabled, 'failed Follow visibly unlocks for explicit retry');
    }],
    ['real control wrappers and dispatcher preserve current channel/store ownership', async check => {
        const f = controlFixture(true); f.handshake(true);
        check(!f.sent.some(entry => entry.packet.type === 'request-username') && f.sent.some(entry => entry.packet.type === 'service-announce'), 'inbound compatibility handshake');
        await f.receive({ type: 'username-update', username: 'peer', didWeb: 'did:web:peer' }); await f.buttons()[0].onclick();
        check(f.follows.length === 1 && f.follows[0].valid() && f.buttons()[0].title === 'Following', 'real bridge passes existing guarded Follow contract');
        await f.receive({ type: 'service-announce', annotationStore: 'https://peer.invalid' }); check(f.stores()[0] === 'https://peer.invalid', 'legacy store getter routes owned cache');
        f.expire(); check(!f.stores().length, 'legacy getter does not leak stale account stores');
    }]
];
