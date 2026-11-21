let _p2pDiscussionActions = null;
function ownsP2pDiscussionAction(op) {
    if (!op?.session.isCurrent()) return false;
    if (op.session.resources.peer.id !== op.peerId) return false;
    const expected = op.effects.active ? (op.kind === 'create' ? op.name : null) : op.before;
    if (activeDiscussionName !== expected) return false;
    const channels = op.session.resources.connections;
    return Object.entries(channels).every(([id, channel]) => op.channels[id] === channel)
        && Object.entries(op.channels).every(([id, channel]) => channels[id] === channel || op.effects.closed?.has(channel));
}
function getP2pDiscussionActions() {
    const view = createP2pDiscussionActionView();
    if (_p2pDiscussionActions?.sameSource()) { _p2pDiscussionActions.attach(view); return _p2pDiscussionActions; }
    _p2pDiscussionActions?.dispose();
    const controller = createP2pDiscussionActionsController({
        source: () => JSON.stringify([p2pSessionSource(), window.CList.defaults.DISCUSSIONS]),
        state: state => { if (_p2pDiscussionActions === controller) window.CList.state.chatDiscussionAction = state; },
        capture(kind, values) {
            const session = ensureP2pSession();
            if (!session?.isCurrent()) throw Error('Reopen Chat before changing a discussion.');
            const name = kind === 'leave' ? activeDiscussionName || values.name : values.name;
            if (!name) throw Error('Please enter a discussion name.');
            if (kind === 'create' && !session.resources.peer.id) throw Error('Peer ID not available yet. Wait for the connection to establish.');
            const url = window.CList.config.flaskSiteUrl;
            return { name, public: values.public, peerId: session.resources.peer.id, session,
                before: activeDiscussionName, channels: { ...session.resources.connections }, effects: {},
                url: window.CList.defaults.DISCUSSIONS + '/api/discussions', token: getSiteSpecificCookie(url, window.CList.keys.ACCESS_TOKEN) };
        },
        owns: ownsP2pDiscussionAction,
        write(op) {
            if (op.kind === 'leave' && ownsP2pDiscussionAction(op) && !op.effects.heartbeatPaused) {
                stopHeartbeat(); op.effects.heartbeatPaused = true;
            }
            return writeP2pDiscussion(op, { fetch });
        },
        read: op => fetchP2pDiscussions({ url: op.url, token: op.token }, { fetch }),
        async apply(op) {
            if (!ownsP2pDiscussionAction(op)) return;
            if (op.kind === 'leave') {
                stopHeartbeat(); op.effects.closed ||= new Set();
                for (const channel of Object.values(op.channels)) {
                    if (op.effects.closed.has(channel)) continue;
                    try { channel.close(); op.effects.closed.add(channel); }
                    catch (error) { if (op.session.resources.connections[channel.peer] !== channel) op.effects.closed.add(channel); throw error; }
                }
            }
            if (!ownsP2pDiscussionAction(op)) return;
            activeDiscussionName = op.kind === 'create' ? op.name : null; op.effects.active = true;
            if (op.kind === 'create') startHeartbeat({ url: op.url, token: op.token });
            if (!op.effects.notice) { op.effects.notice = true; appendMessage((op.kind === 'create' ? 'Created discussion: ' : 'Left discussion: ') + op.name, false, true); }
            if (op.kind === 'leave' && !op.effects.refreshed) { await refreshDiscussions(); op.effects.refreshed = true; }
        }
    }, view);
    _p2pDiscussionActions = controller; controller.present(); return controller;
}
