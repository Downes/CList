// Own one CodeMirror/Yjs/provider set. Hidden documents remain connected.
function createLatexResourceLifecycle(deps) {
    let active = null;
    function state(phase) {
        /** @type {CListLatexResourceState} */
        const value = { phase }; deps.state(value);
    }
    function publish(op, phase) { if (active === op && deps.current(op.target)) state(phase); }
    function cleanup(op) {
        const errors = [], attempt = action => { try { action(); } catch (error) { errors.push(error); } };
        if (op.timer != null) { const timer = op.timer; op.timer = null; attempt(() => deps.clear(timer)); }
        if (op.mapObserver) { const observer = op.mapObserver; op.mapObserver = null; attempt(() => op.map.unobserve(observer)); }
        if (op.awarenessObserver) { const observer = op.awarenessObserver; op.awarenessObserver = null; attempt(() => op.provider.awareness.off('update', observer)); }
        for (const key of ['editor', 'provider', 'ydoc']) { const value = op[key]; op[key] = null; if (value) attempt(() => value.destroy()); }
        if (errors.length) {
            const error = new AggregateError(errors, 'Could not release all LaTeX resources.');
            if (deps.current(op.target)) op.view.error('cleanup', error); else deps.log(error);
        }
    }
    function dispose() {
        if (!active) return;
        const op = active; active = null; op.closed = true; deps.install(null); cleanup(op);
        if (!active && deps.current(op.target)) state('closed');
    }
    function owned(op) {
        if (!op || active !== op || op.closed) return false;
        if (!deps.current(op.target)) { dispose(); return false; }
        return true;
    }
    function presence(op) {
        if (!owned(op) || !op.provider || !deps.visible()) return;
        try { op.view.presence([...op.provider.awareness.getStates().values()]); }
        catch (error) { if (owned(op)) op.view.error('presence', error); }
    }
    return {
        start(target) {
            target.assertCurrent(); dispose(); target.assertCurrent();
            const op = active = { target, view: deps.view(target), closed: false, status: 'connecting…' };
            const { Y, HocuspocusProvider, EditorView, EditorState, keymap, lineNumbers, highlightActiveLine,
                syntaxHighlighting, defaultHighlightStyle, StreamLanguage, stex, defaultKeymap, yUndoManagerKeymap, yCollab } = target.modules;
            try {
                op.view.status(op.status); publish(op, 'connecting'); deps.clearReferences();
                op.ydoc = new Y.Doc(); const text = op.ydoc.getText('latex-source'); op.map = op.ydoc.getMap('clist_refs');
                op.mapObserver = event => {
                    if (!owned(op) || !deps.visible()) return;
                    for (const url of event.keysChanged) {
                        if (!owned(op) || !deps.visible()) return;
                        try { const json = op.map.get(url); if (json) deps.pushReference(JSON.parse(json)); }
                        catch (error) { if (owned(op)) op.view.error('reference update', error); }
                    }
                };
                op.map.observe(op.mapObserver);
                op.provider = new HocuspocusProvider({ url: target.wsUrl, name: target.docId, document: op.ydoc, token: target.token,
                    parameters: { kvstoreUrl: target.storeUrl, ...(target.mode === 'read' ? { mode: 'read' } : {}) },
                    onStatus: ({ status }) => {
                        if (!owned(op) || typeof status !== 'string') return;
                        op.status = status; if (deps.visible()) op.view.status(status);
                        publish(op, ['connected', 'connecting', 'disconnected'].includes(status) ? status : 'connecting');
                    },
                    onAuthenticationFailed: () => { if (owned(op)) op.view.error('authentication', new Error('LaTeX authentication failed. Check your login and reopen the document.')); },
                });
                target.assertCurrent(); if (!owned(op)) throw new Error('LaTeX connection expired during construction.');
                op.provider.awareness.setLocalStateField('user', { name: target.username, color: target.color });
                op.awarenessObserver = () => presence(op); op.provider.awareness.on('update', op.awarenessObserver);
                op.editor = new EditorView({ parent: target.element, state: EditorState.create({ doc: text.toString(), extensions: [
                    lineNumbers(), highlightActiveLine(), syntaxHighlighting(defaultHighlightStyle), StreamLanguage.define(stex),
                    keymap.of([...yUndoManagerKeymap, ...defaultKeymap]), yCollab(text, op.provider.awareness),
                    EditorView.editable.of(target.mode !== 'read'), EditorView.lineWrapping,
                ] }) });
                target.assertCurrent(); if (!owned(op)) throw new Error('LaTeX editor expired during construction.');
                deps.install(op); op.timer = deps.schedule(() => presence(op), 200); return op;
            } catch (error) {
                if (active === op) { active = null; op.closed = true; deps.install(null); }
                cleanup(op);
                if (!active && deps.current(target)) state('error');
                throw error;
            }
        },
        owned: () => owned(active), dispose,
        snapshot() { return owned(active) ? active : null; },
        refresh() { presence(active); },
        rebind() {
            if (!owned(active) || !deps.visible()) return;
            active.view = deps.view(active.target); active.view.status(active.status); presence(active);
        },
    };
}
function currentLatexResourceTarget(target) {
    const state = window.CList.state;
    return target.storeUrl === window.CList.config.flaskSiteUrl && target.username === (state.username && state.username !== 'none' ? state.username : 'Anonymous')
        && target.epoch === state.authEpoch && target.token === (getSiteSpecificCookie(target.storeUrl, window.CList.keys.ACCESS_TOKEN) || 'anonymous')
        && target.root?.isConnected && target.element?.isConnected && target.root.contains(target.element)
        && target.root === document.getElementById('latexDiv') && target.element === document.getElementById('cm-editor');
}
