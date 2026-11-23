/// <reference path="./clist-types.js" />
function createP2pMessagesController(deps, view) {
    let disposed = false, busy = 0;
    const alive = () => !disposed && deps.current() && view.alive();
    const state = () => {
        /** @type {CListChatMessagesState} */
        const summary = { busy }; if (alive()) deps.state(summary);
    };
    const report = error => { if (alive()) { console.error('Chat message failed:', error); view.error(error); } };
    const transport = (packet, recipients, valid) => {
        const result = deps.broadcast(packet, recipients, valid);
        if (valid() && result.failed) {
            for (const error of result.errors) console.error('Chat message transport failed:', error);
            view.error(Error('Message dispatch: ' + result.sent + ' accepted locally, ' + result.failed + ' uncertain. No automatic retry.'));
        }
    };
    return {
        alive,
        async receive(connection, data, connectionCurrent) {
            const valid = () => alive() && connectionCurrent();
            if (!valid()) return;
            busy++; state();
            try {
                const resources = deps.resources(), prepared = prepareP2pIncomingMessage(data, resources.usernames[connection.peer] || connection.peer, connection.peer + '-' + deps.id());
                if (resources.processedMsgIds.has(prepared.packet.msgId)) return;
                resources.processedMsgIds.add(prepared.packet.msgId);
                const recipients = Object.values(resources.connections).filter(channel => channel !== connection && channel.peer !== connection.peer);
                const verification = prepared.packet.signature ? await deps.verify(prepared.packet.message, prepared.packet.signature, connection.peer) : null;
                if (!valid()) return;
                view.show({ text: prepared.packet.message, sender: prepared.sender, verification, isOwn: false });
                if (valid()) transport(prepared.packet, recipients, valid);
            } catch (error) { if (valid()) report(error); }
            finally { busy--; state(); }
        },
        async send(text, callerCurrent) {
            const valid = () => alive() && callerCurrent();
            if (!deps.current() || !callerCurrent()) return;
            if (disposed || !view.alive()) throw Error('The chat transcript changed. Reopen Chat before sending.');
            if (typeof text !== 'string' || !text.trim()) return;
            busy++; state();
            try {
                const resources = deps.resources(), sender = deps.sender(), recipients = Object.values(resources.connections);
                const row = view.show({ text, sender: sender.username, verification: null, isOwn: true });
                const signature = await deps.sign(text);
                if (!valid() || !view.current(row)) {
                    if (deps.current() && callerCurrent()) throw Error('Message was not dispatched because the chat transcript changed.');
                    return;
                }
                const packet = prepareP2pOutgoingMessage(text, sender, sender.id + '-' + deps.id(), signature);
                resources.processedMsgIds.add(packet.msgId); transport(packet, recipients, valid);
            } catch (error) { if (valid()) { report(error); throw error; } }
            finally { busy--; state(); }
        },
        dispose() { disposed = true; }
    };
}
let _p2pMessages = null;
function getP2pMessages() {
    if (!_p2pMessages?.alive()) {
        _p2pMessages?.dispose(); const session = _p2pSession, guard = captureP2pSessionGuard();
        const controller = createP2pMessagesController({ current: () => guard() && _p2pSession === session,
            resources: () => session.resources, sender: () => ({ id: peer.id, username: myUsername, did: myDidKey }),
            id: () => crypto.randomUUID(), sign: text => signMessage(text), verify: (text, signature, id) => verifySignature(text, signature, id),
            broadcast: (packet, recipients, valid) => broadcastP2pPacket(packet, recipients, { current: valid,
                channelCurrent: channel => session.resources.connections[channel.peer] === channel, send: (channel, data) => channel.send(data) }),
            state: state => { if (_p2pMessages === controller) window.CList.state.chatMessages = state; }
        }, createP2pMessageView());
        _p2pMessages = controller;
    }
    return _p2pMessages;
}
