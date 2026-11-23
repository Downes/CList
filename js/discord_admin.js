function createDiscordAdminController(deps, view) {
    const source = deps.capture(); let generation = 0, pending = null, outstanding = null, warning = '';
    const current = () => deps.current(source) && view.current();
    const owned = raw => current() && view.token() === raw;
    const jobKey = raw => JSON.stringify([source.storeUrl, source.token, source.username, source.epoch, source.local, raw]);
    function remember(job) { outstanding = job; deps.jobs?.set(jobKey(job.raw), job); }
    function clear(job) { if (outstanding === job) outstanding = null; if (deps.jobs?.get(jobKey(job.raw)) === job) deps.jobs.delete(jobKey(job.raw)); }
    function state(phase, busy) {
        /** @type {CListDiscordAccountSetupState} */
        const value = { phase, busy, receipt: outstanding?.receipt || 'none' };
        if (current()) deps.state(value); view.busy(busy);
    }
    function recover(job, error) {
        if (!owned(job.raw)) return;
        const guard = () => owned(job.raw);
        if (job.receipt === 'accepted') view.recovery('Channel change accepted, but refresh failed. ' + error.message, [['Retry refresh', () => refresh(job)]], guard);
        else view.recovery('Channel change could not be confirmed. Review channels before retrying.', [['Review channels', async () => {
            if (!guard() || !await load(true)) return;
            if (guard()) view.recovery('Check the listed channels before deciding whether to retry the original change.', [
                ['Keep listed result', async () => { clear(job); state('ready', false); await deps.changed(); }],
                ['Retry original change', () => write(job.command, job.values, guard, true)],
            ], guard);
        }]], guard);
    }
    async function load(review = false) {
        if (!current()) return false;
        const raw = view.token(), token = raw.trim(), request = ++generation;
        if (!token) { view.message('Enter the bot token above first.', true); return false; }
        if (!review && deps.jobs) {
            const previous = deps.jobs.get(jobKey(raw));
            if (previous && deps.current(previous.source)) {
                outstanding = previous;
                if (previous.pending) return previous.pending.then(() => load());
            } else outstanding = null;
        }
        if (pending && !review) return pending;
        const guard = () => owned(raw) && generation === request;
        state('loading', true); view.message('Loading channels…');
        try {
            const data = await deps.read(token); if (!guard()) return false;
            warning = data.warning || '';
            view.render(data, { create: values => write('create', values, guard), register: values => write('register', values, guard), remove: id => write('delete', { id }, guard) }, guard);
            state('ready', false);
            if (outstanding && !review) {
                if (outstanding.raw === raw) recover(outstanding, new Error('Review the outstanding channel change.'));
                else view.message('An earlier change is outstanding for a different bot token. Restore that token and review it before another change.', true);
            }
            return true;
        } catch (error) { deps.log(error); if (guard()) { state('failed', false); view.recovery(error.message, [['Retry load', () => load()]], guard); } return false; }
    }
    async function refresh(job) {
        if (!owned(job.raw)) return false;
        if (job.draftCurrent && !job.draftCurrent()) {
            try {
                const updated = await deps.changed(); if (updated === false) throw new Error('Subscription list could not be refreshed.');
                if (owned(job.raw)) { clear(job); state('ready', false); view.message('Channel change accepted. Newer form input was preserved; reopen Manage Channels when ready.'); }
                return true;
            } catch (error) { deps.log(error); recover(job, error); return false; }
        }
        if (!await load(true)) { recover(job, new Error('Channel list could not be refreshed.')); return false; }
        if (!owned(job.raw)) return false;
        job.draftCurrent = view.captureDraft();
        try { const updated = await deps.changed(); if (updated === false) throw new Error('Subscription list could not be refreshed.'); if (owned(job.raw)) { clear(job); state('ready', false); view.message('Channel change accepted.' + (warning ? ' ' + warning : '')); } return true; }
        catch (error) { deps.log(error); recover(job, error); return false; }
    }
    function write(command, values, guard, retry = false) {
        if (pending) return pending;
        if (!guard()) return Promise.resolve(false);
        if (deps.jobs) outstanding = deps.jobs.get(jobKey(view.token())) || null;
        if (outstanding && !retry) { recover(outstanding, new Error('Review the previous change.')); return Promise.resolve(false); }
        const job = { command, values: structuredClone(values), raw: view.token(), source, draftCurrent: view.captureDraft(), receipt: 'uncertain' }; remember(job);
        state('writing', true); view.message('Saving channel change…');
        pending = Promise.resolve().then(async () => {
            if (!guard() || !owned(job.raw)) throw Object.assign(new Error('The admin controls expired.'), { definite: true });
            await deps.write(command, job.raw.trim(), job.values, () => { job.receipt = 'accepted'; });
            if (!owned(job.raw)) return false;
            return refresh(job);
        }).catch(error => {
            deps.log(error);
            if (error.definite) { clear(job); if (owned(job.raw)) view.message(error.message, true); }
            else recover(job, error);
            state('failed', false); return false;
        }).finally(() => { pending = null; job.pending = null; if (current()) view.busy(false); });
        job.pending = pending;
        return pending;
    }
    return { load };
}
