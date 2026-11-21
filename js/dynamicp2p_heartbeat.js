function createP2pHeartbeatController(deps, view) {
    let run = null;
    const publish = (phase, busy = false) => {
        /** @type {CListChatHeartbeatState} */
        const state = { phase, busy }; deps.state(state);
    };
    function stop() {
        const old = run; run = null;
        if (old) deps.clear(old.timer);
        deps.timer(null); publish('idle');
    }
    const owned = op => run === op && deps.current(op.target);
    async function tick(op) {
        if (run !== op) return;
        if (!owned(op)) { stop(); return; }
        if (op.busy) return;
        op.busy = true; publish('sending', true);
        try {
            const result = await deps.send(op.target);
            if (run !== op) return;
            if (!owned(op)) { stop(); return; }
            if (result === 'expired') { stop(); publish('expired'); view.expired(); }
        } catch (error) {
            if (run !== op) return;
            if (!owned(op)) { stop(); return; }
            view.error(error);
        } finally {
            op.busy = false;
            if (run === op) publish('waiting');
        }
    }
    return {
        start(target) {
            stop(); if (!deps.current(target)) return;
            const op = { target: { ...target }, timer: null, busy: false }; run = op;
            try { op.timer = deps.every(() => tick(op), 60000); deps.timer(op.timer); publish('waiting'); }
            catch (error) { stop(); view.error(error); }
        },
        stop
    };
}
let _p2pHeartbeat = null;
function getP2pHeartbeat() {
    if (!_p2pHeartbeat) _p2pHeartbeat = createP2pHeartbeatController({
        current: target => target.current() && peer === target.owner && peer?.id === target.peerId &&
            activeDiscussionName === target.name && window.CList.defaults.DISCUSSIONS === target.service,
        send: target => sendP2pHeartbeat(target, { fetch: (...args) => fetch(...args) }),
        every: (callback, delay) => setInterval(callback, delay), clear: timer => clearInterval(timer),
        timer: value => { heartbeatInterval = value; },
        state: value => { window.CList.state.chatHeartbeat = value; }
    }, createP2pHeartbeatView());
    return _p2pHeartbeat;
}
function startP2pHeartbeat(target = {}) {
    if (!activeDiscussionName || !peer?.id) return;
    const service = window.CList.defaults.DISCUSSIONS;
    getP2pHeartbeat().start({ current: captureP2pSessionGuard(), owner: peer, peerId: peer.id,
        name: activeDiscussionName, service, url: target.url || service + '/api/discussions',
        token: target.token ?? getSiteSpecificCookie(window.CList.config.flaskSiteUrl, window.CList.keys.ACCESS_TOKEN) });
}
