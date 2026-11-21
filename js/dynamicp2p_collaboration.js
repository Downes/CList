function createP2pCollaborationController(deps, view) {
    let disposed = false, pending = null;
    const owned = () => !disposed && deps.current() && view.alive();
    const state = busy => {
        /** @type {CListChatCollaborationState} */
        const summary = { busy }; if (owned()) deps.state(summary);
    };
    return {
        owned,
        start() {
            if (!owned()) return Promise.resolve(false);
            if (pending) return pending;
            // Capture the API, discussion and transcript before deferring dispatch.
            let open, model;
            try {
                open = deps.open();
                if (typeof open !== 'function') throw Error('Collab editor not available.');
                model = prepareP2pCollaboration(view.capture(), deps.discussion());
            } catch (error) { if (owned()) view.error(error); return Promise.resolve(false); }
            state(true);
            const job = Promise.resolve().then(async () => {
                if (!owned()) return false;
                await open(model.html, model.discussion);
                return owned();
            }).catch(error => { if (owned()) view.error(error); return false; })
                .finally(() => { if (pending === job) { pending = null; state(false); } });
            pending = job; return job;
        },
        dispose() { disposed = true; }
    };
}
let _p2pCollaboration = null;
function startP2pCollaboration() {
    if (!_p2pCollaboration?.owned()) {
        _p2pCollaboration?.dispose();
        const guard = captureP2pSessionGuard(), discussion = activeDiscussionName;
        const controller = createP2pCollaborationController({
            current: () => guard() && activeDiscussionName === discussion,
            discussion: () => discussion, open: () => window.openCollabFromChat,
            state: value => { if (_p2pCollaboration === controller) window.CList.state.chatCollaboration = value; }
        }, createP2pCollaborationView());
        _p2pCollaboration = controller;
    }
    return _p2pCollaboration.start();
}
