/// <reference path="./clist-types.js" />
// Main-window popup ownership. Channels and request records never enter UI state.
function createP2pPopupController(deps) {
    let channel = null, popup = null, client = null, disposed = false;
    const requests = new Map();
    const owned = () => !disposed && deps.current();
    const state = () => {
        /** @type {CListChatPopupState} */
        const summary = { phase: disposed ? 'closed' : client ? 'ready' : channel ? 'opening' : 'closed', pending: [...requests.values()].filter(value => value.pending).length };
        deps.state(summary);
    };
    const report = error => { console.error('Chat popup failed:', error); deps.error(error); };
    const post = packet => { channel.postMessage({ ...packet, clientId: client }); };
    const active = (captured, identity) => owned() && channel === captured && client === identity && !!identity && popup && !popup.closed;
    const finish = () => {
        if (channel) { channel.onmessage = null; try { channel.close(); } catch (error) { report(error); } }
        channel = null; client = null; popup = null; requests.clear(); state();
    };
    const receive = async (captured, packet) => {
        if (!owned()) { controller.dispose(); return; }
        if (channel !== captured || !popup || popup.closed || !packet || typeof packet !== 'object') return;
        if (packet.type === 'popup-ready' && typeof packet.clientId === 'string' && /^[\w-]{1,100}$/.test(packet.clientId)) {
            if (client !== packet.clientId) requests.clear(); client = packet.clientId;
            post({ type: 'chat-state', discussionName: deps.discussion() }); state(); return;
        }
        const identity = client;
        if (!active(captured, identity) || packet.clientId !== identity) return;
        if (packet.type === 'popup-closed') {
            client = null; requests.clear(); state();
            deps.schedule(() => { if (channel === captured && popup?.closed) finish(); }); return;
        }
        if (!['send-msg', 'start-collab-from-chat'].includes(packet.type) || typeof packet.id !== 'string' || !/^[\w-]{1,100}$/.test(packet.id)) return;
        if (packet.type === 'send-msg' && (typeof packet.message !== 'string' || !packet.message.trim())) return;
        const previous = requests.get(packet.id);
        if (previous) { if (!previous.pending) post(previous.result); return; }
        if (requests.size >= 256) {
            const old = [...requests].find(([, entry]) => !entry.pending); if (old) requests.delete(old[0]);
            else { post({ type: 'action-result', id: packet.id, ok: false, message: 'Chat is busy. Wait for pending requests.' }); return; }
        }
        const entry = { pending: true }; requests.set(packet.id, entry); state();
        const current = () => active(captured, identity);
        try {
            if (packet.type === 'send-msg') await deps.send(packet.message, current);
            else await deps.collaborate(current);
            entry.result = { type: 'action-result', id: packet.id, ok: true };
        } catch (error) {
            entry.result = { type: 'action-result', id: packet.id, ok: false, message: error.message || String(error) };
            if (current()) report(error);
        }
        entry.pending = false;
        if (current()) { post(entry.result); state(); }
    };
    const controller = {
        owned,
        open() {
            if (!owned()) return;
            try {
                if (popup && !popup.closed && channel) { popup.focus(); return; }
                finish(); const name = 'clist-chat-' + deps.id();
                channel = deps.channel(name); const captured = channel;
                channel.onmessage = event => { receive(captured, event.data).catch(error => { if (owned() && channel === captured) report(error); }); };
                popup = deps.open('chat-popup.html#' + encodeURIComponent(name), 'clist-chat-popup-' + name);
                if (!popup) throw Error('The chat popup was blocked. Allow popups for CList and try again.');
                state();
            } catch (error) { finish(); report(error); }
        },
        publish(packet) {
            if (!owned()) { controller.dispose(); return; }
            if (!channel || !client) return;
            if (popup?.closed) { finish(); return; }
            try { post({ type: 'chat-state', discussionName: deps.discussion() }); post(packet); }
            catch (error) { report(error); }
        },
        dispose() {
            if (disposed) return;
            if (channel && client) { try { post({ type: 'main-closed' }); } catch (error) { report(error); } }
            disposed = true; finish(); deps.closed();
        }
    };
    return controller;
}
let _p2pPopup = null;
function openOwnedP2pPopup() {
    const session = ensureP2pSession(); if (!session) return;
    if (!_p2pPopup?.owned()) {
        _p2pPopup?.dispose();
        const controller = createP2pPopupController({
            current: session.isCurrent, id: () => crypto.randomUUID(), channel: name => new BroadcastChannel(name),
            open: (url, name) => window.open(url, name, 'width=420,height=620,resizable=yes'),
            schedule: callback => setTimeout(callback, 250), discussion: () => activeDiscussionName,
            state: state => { if (_p2pPopup === controller) window.CList.state.chatPopup = state; },
            send: (text, current) => { if (!session.resources.peer?.id) throw Error('Wait for the chat connection to open before sending.'); return sendMessage(text, current); },
            collaborate: current => { if (current()) return startCollabFromChat(); },
            error: error => showStatusMessage(error.message || String(error)),
            closed: () => { if (_p2pPopup === controller) chatBc = null; }
        });
        _p2pPopup = controller; chatBc = { postMessage: packet => controller.publish(packet) };
    }
    _p2pPopup.open();
}
function closeOwnedP2pPopup() { _p2pPopup?.dispose(); }
