/// <reference path="./clist-types.js" />
function createP2pControlController(deps, view) {
    let disposed = false; const identities = new Map(), rows = new Set();
    const alive = () => !disposed && deps.current() && view.alive();
    const owned = channel => alive() && deps.channelCurrent(channel);
    const state = () => {
        if (!alive()) return;
        /** @type {CListChatControlState} */
        const summary = { knownPeers: deps.resources().knownPeers.size, identities: Object.keys(deps.resources().usernames).length,
            following: [...rows].filter(record => record.pending).length };
        deps.state(summary);
    };
    const report = error => { if (alive()) { console.error('Chat control failed:', error); view.error(error); } };
    const send = (packet, channels) => {
        if (!alive()) return;
        const result = deps.broadcast(packet, channels, alive);
        if (result.failed && alive()) { for (const error of result.errors) console.error('Chat control dispatch failed:', error); report(Error('Some control sends were uncertain. No automatic retry.')); }
        return result;
    };
    const showJoin = (data, channel) => {
        const auth = deps.auth(), record = { handle: null, pending: false, done: false };
        const valid = () => alive() && !!channel && owned(channel) && identities.get(channel)?.record === record && view.current(record.handle);
        const model = { username: data.username, did: data.did,
            canFollow: !!channel && !!data.didWeb && !!auth.token && data.didWeb !== auth.did };
        record.handle = view.join(model, async button => {
            if (!valid() || record.pending || record.done) return;
            record.pending = true; view.busy(record.handle, true); state();
            try {
                const followed = await deps.follow(data.didWeb, auth.token, button, valid);
                if (valid() && followed) { record.done = true; view.followed(record.handle); }
            } catch (error) { if (valid()) report(error); }
            finally { record.pending = false; if (valid()) view.busy(record.handle, record.done); state(); }
        });
        rows.add(record);
        try { deps.relay({ type: 'chat-msg', html: deps.escape(record.handle.text), isOwn: false, isEvent: true }); }
        catch (error) { report(error); }
        return record;
    };
    const controller = {
        alive,
        receive(channel, value) {
            if (!owned(channel)) return;
            try {
                const data = normalizeP2pControlPacket(value); if (!data) return;
                const resources = deps.resources();
                if (data.type === 'peer-list') {
                    if (resources.processedPeerLists.has(data.id)) return;
                    if (resources.processedPeerLists.size > 500) resources.processedPeerLists.clear();
                    resources.processedPeerLists.add(data.id);
                    for (const id of data.peers) {
                        if (!owned(channel)) return;
                        if (id !== resources.peer.id && !resources.connections[id]) { view.event('Discovered new peer: ' + id); deps.connect(id); }
                    }
                    controller.propagate(channel.peer);
                } else if (data.type === 'username-update') {
                    const fingerprint = JSON.stringify([data.username, data.did, data.didWeb, data.publicKeyJwk]);
                    if (identities.get(channel)?.fingerprint === fingerprint) return;
                    const previous = identities.get(channel); if (previous) view.expire(previous.record.handle);
                    resources.usernames[channel.peer] = data.username;
                    for (const [field, map] of [['did', 'peerDids'], ['publicKeyJwk', 'peerPublicKeyJwks']]) {
                        if (data[field]) resources[map][channel.peer] = data[field]; else delete resources[map][channel.peer];
                    }
                    const record = showJoin(data, channel); identities.set(channel, { fingerprint, record });
                    if (data.didWeb && data.didWeb.split(':').pop() !== data.username) {
                        console.warn('Peer name differs from its announced DID label.'); view.event('Peer name differs from its announced DID label.');
                    }
                } else if (data.type === 'request-username') send(makeP2pIdentityPacket(deps.identity()), [channel]);
                else if (data.annotationStore) resources.peerAnnotationStores[channel.peer] = data.annotationStore;
                else delete resources.peerAnnotationStores[channel.peer];
                state();
            } catch (error) { if (owned(channel)) report(error); }
        },
        join(data) { if (alive()) { try { showJoin(normalizeP2pControlPacket({ ...data, type: 'username-update' }), null); } catch (error) { report(error); } } },
        setName(name) {
            if (!alive()) return;
            if (typeof name !== 'string' || !name.trim()) { report(Error('Please enter a valid chat username.')); return; }
            deps.setName(name.trim()); send(makeP2pIdentityPacket(deps.identity()), Object.values(deps.resources().connections)); state();
        },
        propagate(exclude = null) {
            if (!alive()) return;
            const resources = deps.resources(); if (resources.processedPeerLists.size > 500) resources.processedPeerLists.clear();
            const id = 'peer-list-' + deps.id(); resources.processedPeerLists.add(id);
            send({ type: 'peer-list', peers: [...resources.knownPeers], id }, Object.values(resources.connections).filter(channel => channel.peer !== exclude)); state();
        },
        announce(channel) {
            if (!owned(channel)) return;
            try { const store = deps.store(); if (store) send(normalizeP2pControlPacket({ type: 'service-announce', annotationStore: store }), [channel]); }
            catch (error) { report(error); }
        },
        handshake(channel, inbound) {
            if (!owned(channel)) return;
            send(makeP2pIdentityPacket(deps.identity()), [channel]);
            if (!inbound && owned(channel)) send({ type: 'request-username' }, [channel]);
            controller.announce(channel); controller.propagate(inbound ? channel.peer : null);
        },
        stores: () => alive() ? Object.values(deps.resources().peerAnnotationStores).filter(Boolean) : [],
        dispose() { if (disposed) return; disposed = true; for (const record of rows) view.expire(record.handle); rows.clear(); identities.clear(); }
    };
    return controller;
}
let _p2pControl = null;
function getP2pControl() {
    if (!_p2pControl?.alive()) {
        _p2pControl?.dispose(); const session = _p2pSession, guard = captureP2pSessionGuard();
        const controller = createP2pControlController({ current: () => guard() && _p2pSession === session, resources: () => session.resources,
            channelCurrent: channel => session.resources.connections[channel.peer] === channel,
            connect: id => session.connect(id), setName: name => { myUsername = name; }, id: () => crypto.randomUUID(),
            identity: () => ({ username: myUsername, didKey: myDidKey, did: myDid, publicKeyJwk: myPublicKeyJwk }),
            auth: () => ({ token: getSiteSpecificCookie(window.CList.config.flaskSiteUrl, window.CList.keys.ACCESS_TOKEN), did: myDid }),
            store: () => _getMyAnnotationStoreUrl(), escape: escapeHtml, relay: packet => { if (chatBc) chatBc.postMessage(packet); },
            follow: (did, token, button, valid) => { if (typeof window._followUser !== 'function') throw Error('Follow not available.'); return window._followUser(did, token, button, valid); },
            broadcast: (packet, recipients, valid) => broadcastP2pPacket(packet, recipients, { current: valid,
                channelCurrent: channel => session.resources.connections[channel.peer] === channel, send: (channel, data) => channel.send(data) }),
            state: state => { if (_p2pControl === controller) window.CList.state.chatControl = state; }
        }, createP2pControlView());
        _p2pControl = controller;
    }
    return _p2pControl;
}
