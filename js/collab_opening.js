function createCollabOpeningController(deps, view) {
    let version = 0, active = null;
    return {
        open(kind, input) {
            let target;
            try { target = normalizeCollabOpening(kind, input); }
            catch (error) { view.error(error); return Promise.resolve(false); }
            const key = JSON.stringify(target);
            if (active?.key === key && active.current()) return active.promise;
            const id = ++version, source = deps.capture();
            const current = () => id === version && deps.current(source);
            const phase = value => {
                /** @type {CListCollabOpeningState} */
                const state = { phase: value, busy: value === 'opening' }; if (current()) deps.state(state);
            };
            const operation = { key, current, promise: null }; active = operation;
            // Defer effects until the duplicate lock owns its promise.
            operation.promise = Promise.resolve().then(async () => {
                if (!current()) return false;
                phase('opening');
                let feedbackCurrent = current;
                try {
                    const selected = await deps.select(current);
                    const owned = () => current() && selected && selected();
                    if (!owned()) { phase('cancelled'); return false; }
                    feedbackCurrent = owned;
                    await deps.connect(target, owned);
                    if (!owned()) { phase('cancelled'); return false; }
                    view.title(target); phase('ready'); return true;
                } catch (error) {
                    if (feedbackCurrent() && error.code !== 'ExpiredCollabPreparation') { phase('error'); view.error(error); }
                    else phase('cancelled');
                    return false;
                } finally { if (active === operation) active = null; }
            });
            return operation.promise;
        },
        dispose() { version++; active = null; }
    };
}
