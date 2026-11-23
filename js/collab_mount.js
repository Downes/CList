function createCollabMountController(deps) {
    let version = 0, active = null;
    function release(operation) {
        const unbind = operation?.unbind; if (!unbind) return; operation.unbind = null;
        try { unbind(); }
        catch (error) {
            if (operation.current()) operation.view.error('drop cleanup', error);
            else console.error('Expired Collab drop cleanup failed:', error);
        }
    }
    return {
        activate() {
            const snapshot = deps.capture();
            if (active?.pending && active.snapshot.source === snapshot.source && active.snapshot.pane === snapshot.pane &&
                deps.current(active.snapshot) && (!active.mounted || active.current())) return active.promise;
            release(active);
            const id = ++version, view = deps.view(snapshot);
            const base = () => version === id && deps.current(snapshot);
            const current = () => base() && view.alive();
            const operation = { snapshot, view, current, pending: true, mounted: false, promise: null, unbind: null }; active = operation;
            let lastPhase = null;
            const state = phase => {
                lastPhase = phase;
                /** @type {CListCollabMountState} */
                const value = { phase, busy: ['mounting','loading','local'].includes(phase) }; if (base()) deps.state(value);
            };
            operation.promise = Promise.resolve().then(async () => {
                let stage = 'mount', mounted = false, success = false;
                try {
                    if (!base()) return false;
                    state('mounting'); view.mount(); mounted = operation.mounted = true;
                    if (!current()) return false;
                    deps.controls();
                    operation.unbind = view.bindDrop(event => {
                        if (!current()) return;
                        try { Promise.resolve(deps.drop(event)).catch(error => { if (current()) view.error('drop attribution', error); }); }
                        catch (error) { if (current()) view.error('drop attribution', error); }
                    });
                    const intent = deps.intent(), titleVersion = view.titleVersion(); stage = 'library loading'; state('loading');
                    await deps.load();
                    if (!current()) return false;
                    const resource = deps.resource();
                    if (resource.docId) { if (view.titleVersion() === titleVersion) view.title(deps.shortId(resource.docId)); }
                    else if (!resource.editor) {
                        if (intent !== deps.intent()) { state('cancelled'); return false; }
                        if (view.titleVersion() === titleVersion) view.title(deps.slug()); stage = 'local initialization'; state('local');
                        await deps.local(current);
                        if (!current()) return false;
                    }
                    stage = 'reactivation'; deps.rebind();
                    if (!current()) return false;
                    stage = 'pending content';
                    const loaded = await deps.predefined();
                    if (!current()) return false;
                    if (loaded === false) { state('error'); return false; }
                    state('ready'); success = true; return true;
                } catch (error) {
                    if (base() && (!mounted || view.alive()) && error.code !== 'ExpiredCollabPreparation') { state('error'); view.error(stage, error); }
                    else if (base()) state('cancelled');
                    return false;
                } finally {
                    operation.pending = false;
                    if (!success && base() && lastPhase !== 'error' && lastPhase !== 'cancelled') state('cancelled');
                    if (!success || !current()) release(operation);
                }
            });
            return operation.promise;
        },
        dispose() { release(active); version++; active = null; }
    };
}
