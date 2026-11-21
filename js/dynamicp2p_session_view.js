// Chat control bindings and lifecycle feedback; hiding the panel keeps its session alive.
function createP2pSessionView(doc = document) {
    const root = doc.getElementById('chat-section'), input = doc.getElementById('messageInput');
    const send = doc.getElementById('sendButton'), connect = doc.getElementById('connectButton');
    const peerInput = doc.getElementById('peerIdInput'), id = doc.getElementById('my-peer-id');
    const alive = () => !!root?.isConnected && doc.getElementById('chat-section') === root
        && [input, send, connect, peerInput].every(node => node && root.contains(node));
    return {
        alive,
        show() { showLeftOverlaySection('chat-section'); openLeftPane(); },
        peerId(value) { if (id?.isConnected) id.textContent = value; },
        error(error) { console.error('Chat session failed:', error); showErrorModal(error.message || String(error), { title: 'Chat connection failed' }); },
        clearMessage(value) { if (input.value.trim() === value) input.value = ''; },
        bind(actions) {
            const submit = () => { const text = input.value.trim(); if (text) return actions.send(text); };
            const key = event => { if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); return submit(); } };
            const join = () => { const target = peerInput.value.trim(); if (target) return actions.connect(target); };
            send.addEventListener('click', submit); input.addEventListener('keydown', key); connect.addEventListener('click', join);
            return () => { send.removeEventListener('click', submit); input.removeEventListener('keydown', key); connect.removeEventListener('click', join); };
        }
    };
}
