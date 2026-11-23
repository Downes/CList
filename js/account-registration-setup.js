function createAccountRegistrationSetupController(config, deps) {
    let view, owner, pending = null, disposed = false, active, saver, recovery, phase = 'ready', receipt = 'none', busy = false;
    const jobs = new Map(), current = () => !disposed && view?.current() && deps.current(owner);
    function state(next, working, accountReceipt = receipt) {
        phase = next; busy = working; receipt = accountReceipt;
        if (!current()) return;
        /** @type {CListAccountRegistrationSetupState} */
        const value = { phase, busy, registration: active?.registration || 'none', receipt }; deps.state(value); view.busy(busy);
    }
    function showRegistrationFailure(job, error) {
        recovery = () => view.registrationFailure(error, job.registration, () => connect(job.registration === 'uncertain' ? job : null), () => current() && deps.current(job.source));
        if (current()) recovery();
    }
    function connect(explicitRetry = null) {
        if (pending) return pending;
        if (!current() || busy) return Promise.resolve(false);
        if (receipt === 'uncertain' && recovery) { recovery(); return Promise.resolve(false); }
        const draft = view.capture(); state('connecting', true); recovery = null;
        pending = Promise.resolve().then(async () => {
            const request = config.request(draft.values), source = deps.capture();
            if (!source.token) throw new Error('Please log in before adding an account.');
            if (explicitRetry && explicitRetry.request.key !== request.key) throw new Error('Restore the original server URL before retrying its registration.');
            const id = JSON.stringify([source.storeUrl, source.token, source.username, source.epoch, source.local, request.key]);
            const job = active = jobs.get(id) || { request, source, registration: 'none',
                ...config.details?.(source) };
            jobs.set(id, job); job.draft = { ...draft, current: () => !disposed && draft.current() };
            const assert = () => { if (!deps.current(job.source) || !job.draft.current()) throw new Error(config.label + ' setup expired. Reopen the form.'); };
            assert();
            if (job.registration === 'uncertain' && explicitRetry !== job) { showRegistrationFailure(job, new Error('Registration could not be confirmed. Check the server before explicitly retrying.')); return false; }
            if (explicitRetry === job) job.registration = 'none';
            if (job.registration !== 'accepted') {
                if (!await deps.key(source)) throw new Error('Encryption key not found — please log in again.'); assert();
                if (config.beforeRegister) { await config.beforeRegister(job, assert); assert(); }
                await config.register(job, assert, {
                    dispatched: () => { job.registration = 'uncertain'; }, rejected: () => { job.registration = 'none'; }, accepted: () => { job.registration = 'accepted'; },
                });
            }
            assert(); state('saving', true);
            return saver.save(config.label, request.key, request.data);
        }).catch(error => {
            deps.log(error); if (current()) { state('failed', false); if (active) showRegistrationFailure(active, error); else view.error(error); } return false;
        }).finally(() => { pending = null; if (current()) state(phase === 'connecting' ? 'ready' : phase, false); else busy = false; });
        return pending;
    }
    const controller = {
        mount(nextView) {
            owner ||= deps.capture(); view = nextView; disposed = false;
            saver ||= deps.saver({ capture: () => ({ ...active.source, draft: active.draft }), state: value => state(value.phase, value.busy, value.receipt) }, {
                success() { recovery = null; deps.saved(); if (current()) view.message(config.label + ' account saved.'); },
                failure(label, error, value, actions) { recovery = () => view.recovery(error, value, actions); if (current()) recovery(); },
                review(label, actions) { recovery = () => view.review(actions); if (current()) recovery(); },
            });
            view.bind(controller); state(phase, !!pending || busy); if (recovery && current()) recovery();
        },
        canProbe: () => current() && !pending && !busy && !recovery,
        connect: () => connect(), back() { if (current()) { disposed = true; deps.back(); } },
    };
    return controller;
}
