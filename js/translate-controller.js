function createTranslationController(deps, view) {
    let enabled = false, revision = 0, pending = 0, formOperation = null;
    const publish = () => {
        /** @type {CListTranslationState} */
        const state = { enabled, pending }; deps.state(state); view.enabled(enabled);
    };
    try { enabled = deps.read() === 'true'; } catch (error) { view.error('preference loading', error); }
    publish();
    const controller = {
        toggle() {
            const next = !enabled;
            try { deps.write(String(next)); enabled = next; revision++; publish(); }
            catch (error) { view.error('preference saving', error); }
            return enabled;
        },
        async run(text, timed = false, caller = () => true) {
            if (timed && !enabled) return text;
            let key, source;
            try { key = deps.key(); source = deps.source(); } catch (error) { view.error('account selection', error); return text; }
            if (!key) return text;
            const version = revision; let active = true;
            const current = () => {
                if (!active || revision !== version || !caller()) return false;
                try { return deps.source() === source && deps.key() === key; } catch (_) { return false; }
            };
            const assertCurrent = () => { if (!current()) throw Object.assign(Error('Translation source expired.'), { stale: true }); };
            pending++; publish();
            try {
                const work = Promise.resolve().then(() => deps.run(text, key, assertCurrent)).catch(error => {
                    if (current()) view.error('request', error); return text;
                });
                const result = await (timed ? deps.timeout(work, 5000) : work);
                return current() ? result : text;
            } catch (error) {
                if (!current()) return text;
                view.error('request', error); throw error; // Preserve timed-wrapper rejection for reader fallbacks.
            } finally { active = false; pending--; publish(); }
        },
        handle() {
            let target, source, key;
            try { target = view.form(); source = deps.source(); key = deps.key(); } catch (error) { view.error('form capture', error); return Promise.resolve(false); }
            if (formOperation?.target.output === target.output && formOperation.target.text === target.text && formOperation.source === source && formOperation.key === key && formOperation.revision === revision) return formOperation.promise;
            const op = formOperation = { target, source, key, revision, promise: null };
            const current = () => {
                try { return formOperation === op && revision === op.revision && target.current() && deps.source() === source && deps.key() === key; } catch (_) { return false; }
            };
            op.promise = controller.run(target.text, false, current).then(result => {
                if (!current()) return false; target.show(result); return true;
            }).catch(error => { if (current()) view.error('form update', error); return false; })
                .finally(() => { if (formOperation === op) formOperation = null; });
            return op.promise;
        }
    };
    return controller;
}
