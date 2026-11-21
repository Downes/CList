function messageGate() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
let previousMessageFixture = null;
const browserMessageSanitizer = typeof DOMParser === 'function' ? sanitizeHTML : value => String(value).replace(/<[^>]*>/g, '');
function messageFixture(bridge = false) {
    previousMessageFixture?.dispose();
    const root = document.createElement('div'); root.id = 'chat-messages'; document.body.appendChild(root);
    const sent = [], relayed = [], states = [], behavior = {};
    let current = true, sequence = 0, controller, sender = { id: 'local', username: 'Original sender', did: 'did:key:original' };
    const resources = { peer: { id: 'local' }, connections: {}, processedMsgIds: new Set(), usernames: { remote: 'Known peer' } };
    const channel = id => {
        const value = { peer: id, open: true, send(packet) { if (behavior.transport) behavior.transport(value); sent.push({ peer: id, packet: structuredClone(packet) }); } };
        resources.connections[id] = value; return value;
    };
    const remote = channel('remote'); channel('recipient');
    const escape = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    Object.assign(globalThis, { showServiceError(container, title, message) { const node = document.createElement('div'); node.className = 'error-message'; node.textContent = title + ': ' + message; container.appendChild(node); } });
    const sign = async text => behavior.sign ? behavior.sign(text) : 'signed';
    const verify = async (...args) => behavior.verify ? behavior.verify(...args) : true;
    const relay = packet => { if (behavior.relay) behavior.relay(); relayed.push(structuredClone(packet)); };
    if (bridge) {
        _p2pSession = { resources, isCurrent: () => current }; peer = resources.peer; myUsername = sender.username; myDidKey = sender.did; chatBc = { postMessage: relay };
        Object.assign(globalThis, { captureP2pSessionGuard: () => () => current, sanitizeHTML: browserMessageSanitizer,
            chatOptions: html => '<b>' + html + '</b>', escapeHtml: escape, signMessage: sign, verifySignature: verify });
    } else {
        controller = createP2pMessagesController({ current: () => current, resources: () => resources, sender: () => ({ ...sender }), id: () => 'message-' + ++sequence, sign, verify,
            state: state => states.push(structuredClone(state)), broadcast: (packet, recipients, valid) => broadcastP2pPacket(packet, recipients, { current: valid,
                channelCurrent: value => resources.connections[value.peer] === value, send: (value, data) => value.send(data) })
        }, createP2pMessageView(document, { sanitize: browserMessageSanitizer, decorate: html => '<b>' + html + '</b>', escape, relay }));
    }
    const f = { root, resources, remote, channel, sent, relayed, states, behavior,
        receive: data => bridge ? handleP2pData(remote, data, () => current && resources.connections.remote === remote) : controller.receive(remote, data, () => current && resources.connections.remote === remote),
        send: text => bridge ? sendMessage(text, () => current) : controller.send(text, () => current),
        expire: () => { current = false; }, close: () => { delete resources.connections.remote; }, sender: value => { sender = value; },
        state: () => bridge ? window.CList.state.chatMessages : states.at(-1),
        dispose() { if (bridge) _p2pMessages?.dispose(); else controller.dispose(); root.remove(); }
    };
    previousMessageFixture = f; return f;
}
const p2pMessageCases = [
    ['incoming text snapshots IDs/extensions and renders literal sender with verification', async check => {
        const f = messageFixture(), gate = messageGate(); f.behavior.verify = () => gate.promise;
        const packet = { type: 'message', msgId: 'once', username: '<b>Peer</b>', message: 'Original body', signature: 'sig', extra: { retained: 1 } };
        const pending = f.receive(packet); packet.message = 'Changed body'; packet.extra.retained = 9; gate.resolve(true); await pending;
        check(f.root.textContent.includes('<b>Peer</b> ✓: Original body') && !f.root.textContent.includes('Changed body'), 'literal captured sender/body');
        check(f.sent.length === 1 && f.sent[0].peer === 'recipient' && f.sent[0].packet.extra.retained === 1 && f.sent[0].packet.msgId === 'once', 'detached relay preserves extensions/id and excludes origin');
        check(f.relayed[0].html.includes('&lt;b&gt;Peer') && f.state().busy === 0 && !JSON.stringify(f.states).includes('Original body'), 'safe popup label and summary');
    }],
    ['concurrent duplicate IDs reserve once before verification and legacy IDs are generated', async check => {
        const f = messageFixture(), gate = messageGate(); let verifies = 0; f.behavior.verify = () => { verifies++; return gate.promise; };
        const packet = { type: 'message', msgId: 'dedup', message: 'body', signature: 'sig' }, pending = f.receive(packet); await f.receive(packet);
        gate.resolve(null); await pending; check(verifies === 1 && f.sent.length === 1 && f.relayed.length === 1, 'one verify/render/relay for concurrent duplicate');
        await f.receive({ type: 'message', message: 'legacy' }); check(f.sent[1].packet.msgId.startsWith('remote-') && f.resources.processedMsgIds.has(f.sent[1].packet.msgId), 'missing ID gets owned dedup token');
    }],
    ['closed connections/new targets cannot receive stale verified relays', async check => {
        const f = messageFixture(), gate = messageGate(); f.behavior.verify = () => gate.promise;
        const pending = f.receive({ type: 'message', msgId: 'old', message: 'old message', signature: 'sig' }); f.close(); gate.resolve(true); await pending;
        check(!f.relayed.length && !f.sent.length, 'closed origin suppresses late message');
        const g = messageFixture(), verify = messageGate(); g.behavior.verify = () => verify.promise;
        const work = g.receive({ type: 'message', msgId: 'captured', message: 'body', signature: 'sig' }); g.channel('new-peer'); g.channel('recipient'); verify.resolve(true); await work;
        check(!g.sent.length && g.relayed.length === 1, 'new/replaced relay targets are excluded from captured recipients');
    }],
    ['outgoing signing captures sender/recipients and rejects expired or detached UI', async check => {
        const f = messageFixture(), gate = messageGate(); f.behavior.sign = () => gate.promise; const pending = f.send('outgoing');
        f.sender({ id: 'different', username: 'Different', did: 'different' }); f.channel('late'); gate.resolve('signature'); await pending;
        check(f.sent.length === 2 && f.sent.every(entry => entry.packet.username === 'Original sender' && entry.packet.did === 'did:key:original'), 'captured sender and no late recipient');
        const g = messageFixture(), signature = messageGate(); g.behavior.sign = () => signature.promise; const stale = g.send('stale'); g.root.innerHTML = ''; signature.resolve('signature'); let cancelled = false;
        try { await stale; } catch (error) { cancelled = error.message.includes('not dispatched'); }
        check(!g.sent.length && cancelled, 'removed local message rejects dispatch so popup retains its draft');
        const h = messageFixture(), signed = messageGate(); h.behavior.sign = () => signed.promise; const old = h.send('old session'); h.expire(); signed.resolve('signature'); await old; check(!h.sent.length, 'expired session never dispatches');
    }],
    ['invalid/unknown verification markers and malformed packets are handled visibly', async check => {
        const f = messageFixture(); f.behavior.verify = () => false; await f.receive({ type: 'message', message: 'unverified', msgId: 'invalid', signature: 'sig' });
        check(f.root.textContent.includes('⚠') && f.sent.length === 1, 'invalid signature warning preserves existing render/relay policy');
        await f.receive({ type: 'message', message: 5, msgId: 'bad' }); check(f.root.textContent.includes('invalid chat message') && f.sent.length === 1, 'malformed text fails visibly without relay');
        f.behavior.verify = () => { throw Error('verification failed'); }; await f.receive({ type: 'message', message: 'not shown', msgId: 'crypto-fail', signature: 'sig' });
        check(f.root.textContent.includes('verification failed') && !f.relayed.some(packet => packet.html.includes('not shown')), 'verification failure is visible without message output');
    }],
    ['partial transport and popup errors do not retry or erase local output', async check => {
        const f = messageFixture(); f.behavior.transport = value => { if (value.peer === 'recipient') throw Error('uncertain send'); };
        await f.send('partial'); check(f.sent.length === 1 && f.root.textContent.includes('uncertain') && f.relayed.length === 1, 'one attempt per recipient and persistent feedback');
        const g = messageFixture(); g.behavior.relay = () => { throw Error('popup failed'); }; await g.send('local remains');
        check(g.root.textContent.includes('local remains') && g.root.textContent.includes('popup failed') && g.sent.length === 2, 'popup failure does not cancel/repeat peer dispatch');
    }],
    ['view sanitizes decorated HTML in browser and escapes sender independently', async check => {
        const f = messageFixture(); await f.receive({ type: 'message', msgId: 'html', username: '<img src=x>', message: '<a href="javascript:bad()" onclick="bad()">link</a><img src=x onerror="bad()"><b>bold</b>' });
        check(f.root.textContent.includes('<img src=x>') && f.relayed[0].html.includes('&lt;img'), 'sender remains literal in DOM/popup');
        if (typeof DOMParser === 'function') {
            check(!f.root.querySelector('img') && !f.root.querySelector('[onclick]') && !f.root.querySelector('a[href]'), 'real sanitizer removes unsafe nodes/attributes/protocol');
            check(!!f.root.querySelector('b'), 'allowed formatting remains');
        }
    }],
    ['real legacy message wrappers use owned resources and new view', async check => {
        const f = messageFixture(true); await f.receive({ type: 'message', msgId: 'bridge', message: 'bridged body' });
        check(f.root.textContent.includes('Known peer: bridged body') && f.sent.length === 1, 'incoming compatibility dispatch');
        await f.send('bridged outgoing'); check(f.sent.length === 3 && f.relayed.length === 2 && f.state().busy === 0, 'outgoing compatibility dispatch and view');
        f.expire(); await f.receive({ type: 'message', msgId: 'expired', message: 'never' }); check(f.sent.length === 3, 'old session wrapper rejects packets');
    }]
];
