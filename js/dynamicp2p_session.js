/// <reference path="./clist-types.js" />
// Peer resources and event lifetimes, with no DOM, credential transport or message formatting.
function createP2pSessionController(deps, view) {
    const source = deps.source(), bindings = new Map(), queuedConnections = new Map();
    const resources = { peer: null, connections: Object.create(null), knownPeers: new Set(), processedPeerLists: new Set(),
        processedMsgIds: new Set(), usernames: Object.create(null), peerDids: Object.create(null), peerPublicKeyJwks: Object.create(null), peerAnnotationStores: Object.create(null) };
    let disposed = false, started = false, unbind = null, phase = 'connecting', reconnecting = false;
    const isCurrent = () => !disposed && deps.source() === source && view.alive();
    const publish = () => {
        /** @type {CListChatSessionState} */
        const state = { phase, connectionCount: Object.keys(resources.connections).length };
        deps.state(state);
    };
    const failed = error => { if (isCurrent()) view.error(error); };
    const detach = target => {
        for (const [event, handler] of bindings.get(target) || []) target.off?.(event, handler);
        bindings.delete(target);
    };
    const listen = (target, event, valid, callback) => {
        const handler = (...args) => {
            if (!isCurrent()) { controller.dispose(); return; }
            if (!valid()) return;
            try { const result = callback(...args); if (result?.then) return Promise.resolve(result).catch(error => { if (valid()) failed(error); }); }
            catch (error) { if (valid()) failed(error); }
        };
        target.on(event, handler);
        if (!bindings.has(target)) bindings.set(target, []);
        bindings.get(target).push([event, handler]);
        return handler;
    };
    const bindConnection = (connection, inbound) => {
        if (!isCurrent()) { connection.close(); return; }
        const previous = resources.connections[connection.peer];
        if (previous === connection) return;
        resources.connections[connection.peer] = connection;
        if (previous) { detach(previous); previous.close(); }
        resources.usernames[connection.peer] = 'Anonymous'; publish();
        const valid = () => isCurrent() && resources.connections[connection.peer] === connection;
        let opened = false;
        const open = listen(connection, 'open', valid, () => {
            if (opened) return; opened = true; resources.knownPeers.add(connection.peer);
            deps.open(connection, inbound); publish();
        });
        listen(connection, 'data', valid, data => deps.receive(connection, data, valid));
        listen(connection, 'error', valid, error => deps.connectionError(connection, error));
        listen(connection, 'close', valid, () => {
            delete resources.connections[connection.peer]; resources.knownPeers.delete(connection.peer);
            for (const name of ['usernames', 'peerDids', 'peerPublicKeyJwks', 'peerAnnotationStores']) delete resources[name][connection.peer];
            detach(connection); deps.closed(connection); publish();
        });
        if (connection.open) open();
    };
    const controller = {
        resources, isCurrent,
        start() {
            if (started || disposed) return false;
            started = true;
            const initializePeer = () => {
                if (!isCurrent()) { controller.dispose(); return false; }
                try {
                    if (!view.alive()) throw Error('Chat controls are unavailable. Reopen Chat and try again.');
                    resources.peer = deps.createPeer(); deps.activate(resources);
                    if (!unbind) unbind = view.bind(controller);
                    listen(resources.peer, 'open', isCurrent, id => { reconnecting = false; phase = 'ready'; resources.knownPeers.add(id); view.peerId(id); const ready = deps.ready(id); publish(); return ready; });
                    listen(resources.peer, 'connection', isCurrent, connection => bindConnection(connection, true));
                    listen(resources.peer, 'error', isCurrent, error => {
                        if (error.type === 'disconnected') controller.reconnect();
                        else deps.peerError(error);
                    });
                    listen(resources.peer, 'disconnected', isCurrent, () => controller.reconnect());
                    listen(resources.peer, 'close', isCurrent, () => controller.dispose());
                    for (const [id, detail] of queuedConnections) controller.connect(id, detail);
                    queuedConnections.clear();
                    publish(); return true;
                } catch (error) { view.error(error); controller.dispose(); return false; }
            };
            if (!deps.loadPeer) return initializePeer();
            try {
                unbind = view.bind(controller);
                view.peerId('Loading chat library…'); publish();
                Promise.resolve().then(() => { if (isCurrent()) return deps.loadPeer(); }).then(() => {
                    if (isCurrent()) initializePeer(); else controller.dispose();
                }).catch(error => { if (isCurrent()) view.error(error); controller.dispose(); });
                return true;
            } catch (error) { view.error(error); controller.dispose(); return false; }
        },
        connect(id, detail) {
            if (!isCurrent() || !id || resources.connections[id]) return;
            if (!resources.peer) { if (queuedConnections.has(id)) return; queuedConnections.set(id, detail); return true; }
            try { const connection = resources.peer.connect(id); deps.connecting(id, detail); bindConnection(connection, false); return connection; }
            catch (error) { failed(error); }
        },
        reconnect() {
            if (!isCurrent() || reconnecting) return;
            reconnecting = true; phase = 'connecting'; publish();
            try { deps.reconnecting(); resources.peer.reconnect(); }
            catch (error) { reconnecting = false; failed(error); }
        },
        async send(text) {
            if (!isCurrent() || !resources.peer) return;
            view.clearMessage(text);
            try { await deps.send(text, isCurrent); } catch (error) { failed(error); }
        },
        dispose() {
            if (disposed) return;
            disposed = true; queuedConnections.clear(); unbind?.();
            for (const target of [...bindings.keys()]) detach(target);
            for (const connection of Object.values(resources.connections)) { try { connection.close(); } catch (error) { view.error(error); } }
            try { resources.peer?.destroy(); } catch (error) { view.error(error); }
            for (const name of ['connections', 'usernames', 'peerDids', 'peerPublicKeyJwks', 'peerAnnotationStores']) for (const key of Object.keys(resources[name])) delete resources[name][key];
            resources.knownPeers.clear(); resources.processedPeerLists.clear(); resources.processedMsgIds.clear();
            phase = 'closed'; view.peerId(''); deps.dispose(); publish();
        }
    };
    return controller;
}
