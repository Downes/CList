function createCollabCreationController(deps, view) {
    let version = 0, pending = null, release = null;
    const cleanup = () => { const stop = release; release = null; if (stop) stop(); };
    const controller = {
        create(kind, input) {
            let model;
            try { model = deps.prepare(kind, input); }
            catch (error) { view.error(error); return Promise.resolve(false); }
            const key = JSON.stringify(model);
            if (pending?.key === key && pending.current()) return pending.promise;
            cleanup(); deps.before();
            const id = ++version, source = deps.capture(kind);
            const current = () => id === version && deps.current(source, kind);
            const state = phase => {
                /** @type {CListCollabCreationState} */
                const value = { phase, busy: phase === 'opening' }; if (current()) deps.state(value);
            };
            const job = { key, current, promise: null }; pending = job;
            job.promise = Promise.resolve().then(async () => {
                let feedbackCurrent = current;
                try {
                    if (!current()) return false;
                    state('opening');
                    const selected = await deps.select(current), owned = () => current() && selected && selected();
                    if (!owned()) { state('cancelled'); return false; }
                    feedbackCurrent = owned;
                    const intent = deps.intent(), docId = await deps.expand(model.slug);
                    if (!owned() || intent !== deps.intent()) { state('cancelled'); return false; }
                    const resource = await deps.connect(docId, owned);
                    const live = () => owned() && deps.resourceCurrent(resource);
                    feedbackCurrent = live;
                    if (!live()) { state('cancelled'); return false; }
                    view.title(model);
                    const hasSeed = model.kind === 'chat' ? !!model.html : !!model.items.length;
                    if (hasSeed) {
                        let dirty = false, timer = null, stopped = false;
                        const changed = () => { if (!stopped) dirty = true; };
                        const stop = () => {
                            if (stopped) return; stopped = true;
                            const errors = [];
                            try { if (timer != null) deps.clear(timer); } catch (error) { errors.push(error); }
                            try { resource.editor.off('update', changed); } catch (error) { errors.push(error); }
                            if (errors.length) {
                                const error = new AggregateError(errors, 'Could not release collaboration seed controls.');
                                if (live()) view.error(error); else console.error(error);
                            }
                        };
                        resource.editor.on('update', changed); release = stop;
                        timer = deps.schedule(() => {
                            try {
                                if (stopped) return;
                                timer = null; stop(); if (release === stop) release = null;
                                if (!live()) { state('cancelled'); return; }
                                if (dirty || !resource.editor.isEmpty) { state('skipped'); return; }
                                view.seed(resource.editor, model); state('ready');
                            } catch (error) { if (live()) { state('error'); view.error(error); } }
                            finally { if (pending === job) pending = null; }
                        }, 800);
                        state('waiting');
                    } else state('ready');
                    // Capture invite dispatch separately; failure must not undo the document.
                    try { if (live()) deps.invite(source, { docId, title: model.title, mode: 'edit', server: resource.server }); }
                    catch (error) { if (live()) view.error(error); }
                    return true;
                } catch (error) {
                    if (feedbackCurrent() && error.code !== 'ExpiredCollabPreparation') { cleanup(); state('error'); view.error(error); }
                    else state('cancelled');
                    return false;
                } finally { if (pending === job && !release) pending = null; }
            });
            return job.promise;
        },
        dispose() { version++; pending = null; cleanup(); }
    };
    return controller;
}
