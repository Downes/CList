function createCollabTitleController(deps, view) {
    let disposed = false, version = 0, timer = null, candidate = null, action = null, unbind = () => {};
    const owned = () => !disposed && deps.current() && view.alive();
    const state = (phase, busy = false) => {
        /** @type {CListCollabTitleState} */
        const value = { phase, busy }; if (owned()) deps.state(value);
    };
    function cancelScheduled() { if (timer != null) { deps.clear(timer); timer = null; } }
    const readCurrent = op => owned() && version === op.id && view.read() === op.text && deps.editor() === op.editor && deps.currentDocId() === op.currentDocId;
    const fail = error => { view.error(error, check); state('error'); };
    async function check() {
        if (!owned()) return false;
        cancelScheduled(); const id = ++version; candidate = null; action = null; view.hide();
        const text = view.read(); if (!text) { state('idle'); return true; }
        const op = { id, text, editor: deps.editor(), currentDocId: deps.currentDocId() }; state('checking', true);
        const assertCurrent = () => { if (!readCurrent(op)) throw Error('The document title check expired.'); };
        try {
            const target = await deps.inspect(text, { ...deps.capture(), currentDocId: op.currentDocId }, assertCurrent); assertCurrent();
            if (target.exists) { const selected = candidate = { ...op, target }; view.exists(deps.hasContent(), () => open(selected)); state('exists'); }
            else state(target.current ? 'current' : 'available');
            return true;
        } catch (error) { if (readCurrent(op)) fail(error); return false; }
    }
    function schedule() {
        if (!owned()) return; cancelScheduled(); candidate = null; action = null; const id = ++version; view.hide(); state('idle');
        timer = deps.schedule(() => { timer = null; if (owned() && version === id) check(); }, 500);
    }
    function open(selected = null) {
        if (!owned()) return Promise.resolve(false);
        if (action && action.id === version && action.text === view.read()) return action.promise;
        if (selected && (candidate !== selected || !readCurrent(selected))) return Promise.resolve(false);
        cancelScheduled(); const op = action = { id: ++version, text: view.read(), promise: null }; candidate = null;
        const current = () => owned() && version === op.id && view.read() === op.text;
        view.hide(); state('opening', true);
        op.promise = Promise.resolve().then(async () => {
            if (!current()) return false;
            if (selected) await deps.open(selected.target, current); else await deps.connectNew(current);
            if (!current()) return false;
            if (selected) view.normalize(deps.shortId(selected.target.docId)); state('idle'); return true;
        }).catch(error => { if (current()) fail(error); return false; }).finally(() => { if (action === op) action = null; });
        return op.promise;
    }
    const controller = {
        owned, schedule, check, cancelScheduled,
        hasExisting: () => !!candidate && readCurrent(candidate),
        enter() { return open(candidate && readCurrent(candidate) ? candidate : null); },
        paste(text) {
            if (!owned()) return; cancelScheduled(); const id = ++version; candidate = null; action = null; view.hide();
            Promise.resolve().then(() => { if (owned() && version === id) return deps.openUrl(text); }).catch(error => { if (owned() && version === id) fail(error); });
        },
        dispose() { if (disposed) return; disposed = true; version++; cancelScheduled(); try { unbind(); } catch (error) { if (deps.current() && view.alive()) view.error(error, () => {}); } }
    };
    unbind = view.bind({ current: owned, schedule, enter: controller.enter, paste: controller.paste, isUrl: deps.isUrl });
    return controller;
}
