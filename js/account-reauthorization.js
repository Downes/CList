// Captured existing-account OAuth intent. Requests and guards remain private.
function createAccountReauthorizationController(deps) {
    let pending = null, latest = null, started = null, phase = 'ready';
    function state(next, busy) {
        phase = next;
        if (!latest?.current()) return;
        /** @type {CListAccountReauthorizationState} */
        const value = { phase, busy }; deps.state(value);
    }
    return {
        bind(view) { latest = view; view.busy(!!pending || !!started?.current()); },
        changed() { if (!pending && latest?.current() && !started?.current()) { latest.busy(false); state('ready', false); } },
        start(view) {
            if (pending) return pending;
            if (!view.current() || started?.current()) return Promise.resolve(false);
            let source, draft;
            try { source = deps.capture(); draft = view.capture(); }
            catch (error) { deps.log(error); if (view.current()) view.error(error); return Promise.resolve(false); }
            const current = () => view.current() && deps.current(source) && draft.current();
            view.busy(true); state('authorizing', true);
            pending = Promise.resolve().then(async () => {
                if (!current()) return false;
                await view.invoke(structuredClone(draft.request), { isCurrent: current, feedback: false });
                if (!current()) return false;
                started = { current }; state('redirecting', true); return true;
            }).catch(error => { deps.log(error); if (current()) { state('failed', false); view.error(error); } return false; })
                .finally(() => { pending = null; if (latest?.current()) { const busy = !!started?.current(); latest.busy(busy); if (!busy) state(phase === 'authorizing' ? 'ready' : phase, false); } });
            return pending;
        },
    };
}
