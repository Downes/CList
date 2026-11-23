function createDiscordSetupController(deps) {
    let view, generation = 0, pending = null, outstanding = null;
    const owner = deps.capture(), current = () => deps.current(owner) && view?.current();
    function state(phase, busy) {
        /** @type {CListDiscordAccountSetupState} */
        const value = { phase, busy, receipt: outstanding?.receipt || 'none' };
        if (current()) deps.state(value);
    }
    function find(name) {
        const record = deps.accounts().find(row => { const data = deps.parse(row); return data && data.type === 'Discord' && data.channel === name; });
        return record ? { key: record.key, value: record.value } : null;
    }
    async function load() {
        if (!current()) return false;
        const target = view, request = ++generation, source = deps.capture(), guard = () => current() && target === view && generation === request && deps.current(source);
        state('loading', !!pending); target.message('Loading channels…');
        try {
            const channels = await deps.read(source); if (!guard()) return false;
            target.message(''); target.channels(channels.map(row => ({ ...row, ...find(row.name) })), row => toggle(row, guard), guard);
            state('ready', !!pending); if (outstanding) recover(outstanding, new Error('Review the outstanding subscription change.')); return true;
        } catch (error) { deps.log(error); if (guard()) { state('failed', !!pending); target.recovery(error.message, [['Retry load', load]], guard); } return false; }
    }
    async function refresh(job) {
        if (!deps.current(job.source)) return false;
        try {
            const accounts = await deps.reload(); if (!deps.current(job.source)) return false;
            if (job.target === view && current()) { deps.install(accounts, job.source); if (!await load()) throw new Error('Channel list could not be refreshed.'); await deps.refresh(); }
            outstanding = null; state('ready', false); if (current()) view.message('Subscription change saved.'); return true;
        } catch (error) { deps.log(error); recover(job, error); return false; }
    }
    function recover(job, error) {
        if (!current() || !deps.current(job.source)) return;
        const guard = () => current() && deps.current(job.source);
        if (job.receipt === 'accepted') view.recovery('Subscription saved, but refresh failed. ' + error.message, [['Retry refresh', () => refresh(job)]], guard);
        else view.recovery('Subscription change could not be confirmed. Check it before retrying.', [['Check subscription', async () => {
            try {
                if (!guard()) return; const stored = await job.source.get(job.key); if (!guard()) return;
                if (job.remove ? !stored : stored?.value === job.encrypted) { job.receipt = 'accepted'; await refresh(job); }
                else view.recovery('The stored account does not confirm the change. Review Accounts before retrying.', [['Retry original subscription change', () => execute(job)]], guard);
            } catch (error) { deps.log(error); recover(job, error); }
        }]], guard);
    }
    function execute(job) {
        if (pending) return pending;
        outstanding = job; state('saving', true); if (current()) view.message('Saving subscription…');
        pending = Promise.resolve().then(async () => {
            const valid = () => current() && view === job.target && job.guard() && deps.current(job.source)
                && (find(job.name)?.key || null) === (job.remove ? job.key : null) && (find(job.name)?.value || null) === job.original;
            const assert = () => { if (!valid()) throw Object.assign(new Error('The subscription row or account session expired.'), { definite: true }); };
            assert(); const encKey = await deps.key(job.source); assert();
            const session = { storeUrl: job.source.storeUrl, token: job.source.token, encKey, isCurrent: valid };
            if (job.remove) { assertAccountSession(session); await deps.confirmRemoval(job, encKey); assert(); job.dispatched = true; await job.source.remove(job.key); }
            else await deps.save({ key: job.key, data: { type: 'Discord', title: job.name, permissions: 'rw', channel: job.name, bot_token: '' } },
                { ...session, put: async (key, encrypted) => { assert(); job.dispatched = true; job.encrypted = encrypted; await job.source.add(key, encrypted); } });
            job.receipt = 'accepted'; return refresh(job);
        }).catch(error => {
            deps.log(error);
            if (!job.dispatched || error.definite || ['AlreadyExists', 'NotAuthenticated', 'NotAuthorized', 'RevisionConflict'].includes(error.code)) {
                outstanding = null; if (current()) view.message(error.message, true);
            } else recover(job, error);
            state('failed', false); return false;
        }).finally(() => { pending = null; state('ready', false); });
        return pending;
    }
    function toggle(row, guard) {
        if (pending) return pending;
        if (!guard()) return Promise.resolve(false);
        if (outstanding) { recover(outstanding, new Error('Review the previous change.')); return Promise.resolve(false); }
        const existing = find(row.name);
        if ((existing?.key || null) !== (row.key || null)) return Promise.resolve(false);
        return execute({ name: row.name, key: existing?.key || row.name, original: existing?.value || null, remove: !!existing, source: deps.capture(), target: view, guard, receipt: 'uncertain' });
    }
    return { mount(next, admin) { view = next; view.bind(this, admin); return load(); }, load, back() { if (current()) { generation++; deps.back(); } } };
}
