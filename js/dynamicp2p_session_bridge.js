// Compatibility bridge for message/sharing/discussion helpers still in dynamicp2p.js.
let _p2pSession = null;
function p2pSessionSource() {
    const url = window.CList.config.flaskSiteUrl;
    return JSON.stringify([url, getSiteSpecificCookie(url, window.CList.keys.USERNAME),
        getSiteSpecificCookie(url, window.CList.keys.ACCESS_TOKEN), window.CList.state.authEpoch || 0]);
}
function captureP2pSessionGuard() { const session = _p2pSession; return () => !!session?.isCurrent(); }
function ensureP2pSession() {
    if (_p2pSession?.isCurrent()) return _p2pSession;
    _p2pSession?.dispose();
    const view = createP2pSessionView();
    const session = createP2pSessionController({
        source: p2pSessionSource, loadPeer: typeof Peer === 'undefined' ? () => ensurePeerJS() : null, createPeer: () => new Peer(),
        state: state => { if (_p2pSession === session) window.CList.state.chatSession = state; },
        activate(resources) {
            ({ peer, connections, knownPeers, processedPeerLists, processedMsgIds, usernames,
                peerDids, peerPublicKeyJwks, peerAnnotationStores } = resources);
            p2pInitialized = true; myUsername = ''; myDid = myDidKey = myPublicKeyJwk = myIdentityKey = null;
            const current = session.isCurrent;
            initializeDid(current).catch(error => { if (current()) view.error(error); });
        },
        ready(id) {
            appendMessage(`Your Peer ID: ${id}`, false, true); setUsername(myUsername?.trim() || getSiteSpecificCookie(window.CList.config.flaskSiteUrl, window.CList.keys.USERNAME) || 'Anon');
            if (typeof resumeP2pShare === 'function') return resumeP2pShare(session);
        },
        connecting(id, name) { if (name) { appendMessage(`Joining: ${name}`); activeDiscussionName = name; } },
        open(connection, inbound) {
            getP2pControl().handshake(connection, inbound);
            if (!inbound) { toggleDiv('discussion-button-div'); toggleDiv('end-discussion-div'); document.body.classList.add('chat-active'); startHeartbeat(); }
        },
        receive: (connection, data, current) => handleP2pData(connection, data, current),
        closed(connection) { appendMessage(`Connection closed: ${connection.peer}`); propagatePeerList(); },
        connectionError(connection, error) { console.error('Chat connection error:', error); appendMessage(`Connection error with ${usernames[connection.peer] || connection.peer}: ${error.message} — they may have lost their connection. Try rejoining the discussion.`); },
        peerError(error) {
            console.error('PeerJS error:', error.type, error);
            if (error.type === 'peer-unavailable') appendMessage('That peer is no longer available — they may have left the discussion.', false, true);
            else if (error.type === 'browser-incompatible') view.error(Error('Your browser does not support WebRTC. Try a modern browser such as Chrome or Firefox.'));
            else appendMessage(`Connection error (${error.type}): ${error.message}`);
        },
        reconnecting: () => appendMessage('Lost connection to signaling server — reconnecting…'),
        send: (text, current) => sendMessage(text, current),
        dispose() {
            if (_p2pSession !== session) return;
            if (typeof closeOwnedP2pPopup === 'function') closeOwnedP2pPopup();
            if (typeof cancelP2pShare === 'function') cancelP2pShare(session);
            stopHeartbeat(); p2pInitialized = false; activeDiscussionName = null;
            myDid = myDidKey = myPublicKeyJwk = myIdentityKey = null;
            document.body.classList.remove('chat-active');
        }
    }, view);
    _p2pSession = session;
    return session.start() ? session : null;
}
function openP2pChat() {
    const view = createP2pSessionView(); view.show();
    const session = ensureP2pSession();
    if (session) setUsername(getSiteSpecificCookie(window.CList.config.flaskSiteUrl, window.CList.keys.USERNAME) || 'Anonymous');
    if (session && typeof getP2pDiscussionActions === 'function') getP2pDiscussionActions();
    return session;
}
