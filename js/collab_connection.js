// Own one local/remote editor resource set. Background connections remain valid
// across editor selection changes while their original mounted nodes survive.
function createCollabConnectionLifecycle(deps) {
    let active = null;
    const publish = (op, phase) => {
        if (active !== op || op.source !== deps.source()) return;
        /** @type {CListCollabConnectionState} */
        const value = { phase, remote: !op.target.local }; deps.state(value);
    };
    function cleanup(op, feedback) {
        const errors = [];
        const attempt = action => { try { action(); } catch (error) { errors.push(error); } };
        if (op.timer != null) { const timer = op.timer; op.timer = null; attempt(() => deps.clear(timer)); }
        if (op.mapObserver) { const handler = op.mapObserver; op.mapObserver = null; attempt(() => op.map.unobserve(handler)); }
        if (op.awarenessObserver) { const handler = op.awarenessObserver; op.awarenessObserver = null; attempt(() => op.provider.awareness.off('update', handler)); }
        for (const field of ['editor', 'provider', 'ydoc']) {
            const resource = op[field]; op[field] = null;
            if (resource) attempt(() => resource.destroy());
        }
        if (errors.length) {
            const error = new AggregateError(errors, 'Could not release all collaboration resources.');
            if (feedback) op.view.error('cleanup', error); else console.error('Expired collaboration cleanup failed:', error);
        }
    }
    function dispose() {
        const op = active; if (!op) return;
        active = null; op.closed = true; deps.install(null);
        cleanup(op, op.source === deps.source());
        if (!active && op.source === deps.source()) deps.state({ phase: 'closed', remote: !op.target.local });
    }
    function current(op) {
        if (active !== op || op.closed) return false;
        if (op.source !== deps.source() || !deps.targetCurrent(op.target)) { dispose(); return false; }
        return true;
    }
    function awareness(op) {
        if (!current(op) || !op.provider) return;
        try { op.view.awareness([...op.provider.awareness.getStates().values()]); }
        catch (error) { if (current(op)) op.view.error('presence update', error); }
    }
    return {
        start(target) {
            target.assertCurrent(); dispose(); target.assertCurrent();
            const op = active = { target, source: deps.source(), view: deps.view(target), closed: false };
            const { Editor, StarterKit, Collaboration, CollaborationCursor, Link, HocuspocusProvider, Y } = target.modules;
            try {
                op.lastStatus = target.local ? 'local document' : 'connecting…'; op.view.status(op.lastStatus); publish(op, target.local ? 'local' : 'connecting');
                if (!target.local) deps.clearReferences();
                op.ydoc = new Y.Doc(); op.map = op.ydoc.getMap('clist_refs');
                if (!target.local) {
                    op.mapObserver = event => {
                        if (!current(op) || !deps.visible()) return;
                        event.keysChanged.forEach(url => {
                            const json = op.map.get(url); if (!json) return;
                            try { deps.pushReference(JSON.parse(json)); }
                            catch (error) { if (current(op)) op.view.error('reference update', error); }
                        });
                    };
                    op.map.observe(op.mapObserver);
                    op.provider = new HocuspocusProvider({ url: target.wsUrl, name: target.docId, document: op.ydoc, token: target.token,
                        parameters: { kvstoreUrl: target.storeUrl, ...(target.mode === 'read' ? { mode: 'read' } : {}) },
                        onStatus: ({ status }) => {
                            if (!current(op) || typeof status !== 'string') return;
                            op.lastStatus = status; op.view.status(status); publish(op, ['connected','connecting','disconnected'].includes(status) ? status : 'connecting');
                        },
                        onAuthenticationFailed: () => { if (current(op)) op.view.authenticationFailed(); }
                    });
                    target.assertCurrent();
                    if (!current(op)) throw Error('Collaboration connection expired during construction.');
                    op.awarenessObserver = () => awareness(op); op.provider.awareness.on('update', op.awarenessObserver);
                }
                const extensions = [StarterKit.configure({ history: false }), Collaboration.configure({ document: op.ydoc })];
                if (op.provider) extensions.push(CollaborationCursor.configure({ provider: op.provider, user: { name: target.username, color: target.color } }));
                extensions.push(Link.configure({ openOnClick: false, validate: href => /^https?:\/\//i.test(href) }));
                op.editor = new Editor({ element: target.element, editable: target.local || target.mode !== 'read', extensions });
                target.assertCurrent();
                if (!current(op)) throw Error('Collaboration connection expired during construction.');
                deps.install(op); deps.ready();
                if (target.local) op.view.awareness([]);
                else op.timer = deps.schedule(() => awareness(op), 200);
                return op;
            } catch (error) {
                const failedCurrent = active === op;
                if (failedCurrent) { active = null; op.closed = true; deps.install(null); }
                cleanup(op, op.source === deps.source());
                if (failedCurrent && !active && op.source === deps.source()) deps.state({ phase: 'error', remote: !target.local });
                throw error;
            }
        },
        refresh() { if (active) awareness(active); },
        owned() { return !!active && current(active); },
        rebind() {
            const op = active;
            if (!op || !current(op) || !deps.visible()) return;
            op.view = deps.view(op.target, true); op.view.status(op.lastStatus);
            if (op.target.local) op.view.awareness([]); else awareness(op);
        },
        dispose
    };
}
