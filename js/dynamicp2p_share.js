/// <reference path="./clist-types.js" />
function createP2pShareController(deps, view) {
    const source = deps.source(); let pending = null, phase = 'idle', disposed = false;
    const current = () => !disposed && deps.source() === source;
    const state = () => {
        /** @type {CListChatShareState} */
        const summary = { phase, busy: ['waiting-peer', 'creating', 'sending'].includes(phase) };
        if (current()) deps.state(summary);
    };
    const validSession = session => current() && session?.isCurrent() && deps.session(false) === session;
    const transmit = (session, packet, preview, valid = () => validSession(session)) => {
        if (!valid() || !session.resources.peer?.id) return null;
        const resources = session.resources, recipients = Object.values(resources.connections);
        if (packet.type === 'share') resources.processedMsgIds.add(packet.msgId);
        const result = broadcastP2pPacket(packet, recipients, { current: valid,
            channelCurrent: channel => resources.connections[channel.peer] === channel, send: (channel, data) => channel.send(data) });
        if (!valid()) return result;
        if (result.failed) {
            for (const error of result.errors) console.error('Chat broadcast failed:', error);
            view.notice('Chat dispatch: ' + result.sent + ' accepted, ' + result.failed + ' uncertain. Nothing was retried automatically.');
        } else if (packet.type === 'share' && !result.sent) view.notice('Shared locally. No open peer connections accepted this share.');
        try { if (preview && (packet.type === 'share' || result.sent)) deps.preview(packet); }
        catch (error) { console.error('Chat preview failed:', error); view.error(Error('Peer dispatch was attempted; local preview failed: ' + (error.message || String(error)))); }
        return result;
    };
    const packet = (session, data, extra = {}) => ({ ...structuredClone(extra), type: 'share', kind: data.kind, url: data.url, title: data.title,
        excerpt: data.excerpt, username: deps.username(), msgId: session.resources.peer?.id + '-' + deps.id() });
    const flush = async op => {
        const valid = () => current() && pending === op && validSession(op.session) && op.source.current();
        if (!valid()) { if (pending === op) { pending = null; phase = 'idle'; state(); } return; }
        if (!op.session.resources.peer?.id || op.running) return;
        op.running = true;
        try {
            if (deps.discussion() !== op.before) throw Error('The discussion changed before this share was ready. Select Share again.');
            let expected = op.before;
            if (!expected) {
                phase = 'creating'; state();
                const result = await deps.create({ name: op.data.discussion, public: op.source.public });
                if (!valid()) return;
                if (result?.status !== 'accepted' || result.phase !== 'complete' || result.name !== op.data.discussion) throw Error('The discussion was not confirmed. Resolve its Create/Leave controls, then explicitly share again.');
                expected = op.data.discussion;
            }
            if (!valid()) return;
            if (deps.discussion() !== expected) throw Error('The discussion changed before dispatch. Select Share again.');
            phase = 'sending'; state(); transmit(op.session, packet(op.session, op.data), true, () => valid() && deps.discussion() === expected);
            if (valid()) { phase = 'complete'; state(); }
        } catch (error) { if (valid()) { phase = 'error'; state(); view.error(error); } }
        finally { if (pending === op) { pending = null; if (current() && ['creating', 'sending'].includes(phase)) { phase = 'idle'; state(); } } }
    };
    const controller = {
        sameSource: current,
        enqueue(itemId) {
            if (!current()) return;
            if (pending?.running) { view.notice('A share is already pending. Wait before sharing another item.'); return; }
            try {
                const captured = view.capture(itemId);
                if (pending?.source.key === captured.key) return;
                const session = deps.session(true);
                if (!validSession(session)) throw Error('Open Chat before sharing.');
                pending = { source: captured, session, data: prepareP2pItemShare(captured.reference, captured.text, itemId), before: deps.discussion(), running: false };
                phase = 'waiting-peer'; state(); return flush(pending);
            } catch (error) { if (current()) { phase = 'error'; state(); view.error(error); } }
        },
        ready(session) { if (pending?.session === session) return flush(pending); },
        share(kind, url, title, excerpt, extra) {
            if (pending) { view.notice('A share is already pending. Wait before sharing another item.'); return null; }
            try {
                const session = deps.session(false);
                if (!validSession(session) || !session.resources.peer?.id) throw Error('Open chat first to share.');
                const data = structuredClone({ kind, url, title, excerpt });
                phase = 'sending'; state(); const result = transmit(session, packet(session, data, extra), true); phase = result?.stale ? 'idle' : 'complete'; state(); return result;
            } catch (error) { if (current()) { phase = 'error'; state(); view.error(error); } return null; }
        },
        invite(invite) {
            try {
                const session = deps.session(false); if (!validSession(session) || !session.resources.peer?.id) return false;
                const data = { ...structuredClone(invite), type: 'collab-invite' };
                return (transmit(session, data, true)?.sent || 0) > 0;
            } catch (error) { if (current()) view.error(error); return false; }
        },
        cancel(session) { if (!pending || pending.session !== session) return; pending = null; phase = 'idle'; state(); },
        dispose() { if (disposed) return; disposed = true; pending = null; }
    };
    return controller;
}
let _p2pShare = null;
function getP2pShare() {
    if (!_p2pShare?.sameSource()) {
        _p2pShare?.dispose();
        const controller = createP2pShareController({ source: p2pSessionSource,
            session: open => open ? openP2pChat() : _p2pSession, discussion: () => activeDiscussionName, username: () => myUsername, id: () => crypto.randomUUID(),
            create: values => getP2pDiscussionActions().begin('create', undefined, values),
            preview: data => data.type === 'share' ? appendShareCard(data, null) : appendCollabInviteCard(data, 'You (' + myUsername + ')'),
            state: state => { if (_p2pShare === controller) window.CList.state.chatShare = state; }
        }, createP2pShareView());
        _p2pShare = controller;
    }
    return _p2pShare;
}
function resumeP2pShare(session) { return _p2pShare?.ready(session); }
function cancelP2pShare(session) { _p2pShare?.cancel(session); }
