// Private callback save receipts. Exchange/pickup and original-flow binding are separate.
function createOAuthAccountSaveController(deps, view) {
    const jobs = new Map();
    function owned(job) { return deps.current(job.source) && (!job.isCurrent || job.isCurrent()); }
    function state(job, phase, busy) {
        if (!owned(job)) return;
        /** @type {CListOAuthAccountSaveState} */
        const value = { phase, busy, receipt: job.receipt }; deps.state(value);
    }
    const assert = job => { if (!owned(job)) throw Object.assign(new Error('The callback account-save session expired.'), { code: 'ExpiredOAuthAccountSave' }); };
    const actions = job => ({ current: () => owned(job), refresh: () => refresh(job), check: () => check(job), retry: () => write(job) });
    async function refreshEffects(job) {
        assert(job); state(job, 'refreshing', true);
        const accounts = await deps.accounts(job.source); assert(job);
        deps.install(accounts, job.source); deps.visibility();
        if (deps.surfaceCurrent(job.source) && job.afterRefresh) { await job.afterRefresh(); assert(job); }
        if (deps.surfaceCurrent(job.source)) await deps.navigate();
        assert(job);
        job.refreshed = true; state(job, 'complete', false); view.success(job.label); return { status: 'saved', refreshed: true };
    }
    function run(job, operation) {
        if (job.pending) return job.pending;
        job.pending = Promise.resolve().then(operation).catch(error => {
            deps.log(error);
            if (job.dispatched && job.receipt !== 'accepted' && !['NotAuthenticated', 'NotAuthorized', 'InvalidData', 'RevisionConflict', 'ExpiredOAuthAccountSave'].includes(error.code)) job.receipt = 'uncertain';
            if (owned(job)) { state(job, 'failed', false); view.failure(job.label, error, job.receipt, actions(job), job.source); }
            return { status: job.receipt === 'accepted' ? 'saved' : job.receipt === 'uncertain' ? 'uncertain' : 'failed', refreshed: false };
        }).finally(() => { job.pending = null; });
        return job.pending;
    }
    function write(job) {
        if (job.receipt === 'accepted') return refresh(job);
        if (job.receipt === 'uncertain' && !job.reviewed) { if (owned(job)) view.failure(job.label, new Error('Check the saved account before retrying.'), 'uncertain', actions(job), job.source); return Promise.resolve({ status: 'uncertain' }); }
        return run(job, async () => {
            assert(job); job.dispatched = false; job.reviewed = false; job.receipt = 'none'; state(job, 'saving', true);
            job.saved = await persistOAuthCallbackAccount(job.request, {
                assert: () => assert(job), current: () => owned(job), session: { storeUrl: job.source.storeUrl, token: job.source.token },
                key: () => deps.key(job.source), save: (request, session) => deps.save(request, session, job.source), put: job.source.put,
                dispatch: encrypted => { job.dispatched = true; job.encrypted = encrypted; },
            });
            job.receipt = 'accepted'; if (!owned(job)) return { status: 'saved', refreshed: false };
            return refreshEffects(job);
        });
    }
    function refresh(job) { return run(job, () => refreshEffects(job)); }
    function check(job) {
        return run(job, async () => {
            assert(job); state(job, 'checking', true);
            const confirmed = await checkOAuthCallbackAccount(job.request.key, job.encrypted, { assert: () => assert(job), get: job.source.get });
            if (confirmed) { job.receipt = 'accepted'; return refreshEffects(job); }
            job.reviewed = true; state(job, 'review', false); view.review(job.label, actions(job), job.source); return { status: 'unconfirmed', refreshed: false };
        });
    }
    return {
        save(label, key, data, options = {}) {
            const source = deps.capture();
            const request = { key, data: structuredClone({ ...data, title: data.title || key || label }) };
            const id = JSON.stringify([source.storeUrl, source.token, source.username, source.epoch, key, request.data]);
            const previous = jobs.get(id);
            if (previous && owned(previous)) {
                if (previous.pending) return previous.pending;
                if (previous.receipt === 'accepted') return previous.refreshed ? Promise.resolve({ status: 'saved', refreshed: true }) : refresh(previous);
                if (previous.receipt === 'uncertain') { if (owned(previous)) view.failure(label, new Error('The earlier account write could not be confirmed.'), 'uncertain', actions(previous), previous.source); return Promise.resolve({ status: 'uncertain', refreshed: false }); }
            }
            const job = { label, request, source, afterRefresh: options.afterRefresh, isCurrent: options.isCurrent, receipt: 'none' }; jobs.set(id, job); return write(job);
        },
    };
}

let _oauthAccountSaver = null;
function captureOAuthAccountSaveSource() {
    const storeUrl = window.CList.config.flaskSiteUrl, keys = window.CList.keys, kv = window.CList.storage.kv;
    return { storeUrl, token: getSiteSpecificCookie(storeUrl, keys.ACCESS_TOKEN), username: getSiteSpecificCookie(storeUrl, keys.USERNAME),
        epoch: window.CList.state.authEpoch || 0, local: !!window.CList.isLocalMode?.(), kv,
        put: kv.put.bind(kv), get: kv.get.bind(kv), reader: window.CList.state.reader?.requestId,
        editor: typeof currentEditor === 'undefined' ? null : currentEditor, modal: document.getElementById('generic-modal') };
}
function currentOAuthAccountSaveSource(source) {
    const keys = window.CList.keys;
    return source.storeUrl === window.CList.config.flaskSiteUrl && source.kv === window.CList.storage.kv
        && source.token === getSiteSpecificCookie(source.storeUrl, keys.ACCESS_TOKEN) && source.username === getSiteSpecificCookie(source.storeUrl, keys.USERNAME)
        && source.epoch === (window.CList.state.authEpoch || 0) && source.local === !!window.CList.isLocalMode?.();
}
function oauthAccountSaveSurfaceCurrent(source) {
    return currentOAuthAccountSaveSource(source) && source.reader === window.CList.state.reader?.requestId
        && source.editor === (typeof currentEditor === 'undefined' ? null : currentEditor) && source.modal === document.getElementById('generic-modal');
}
function saveOAuthCallbackAccount(label, key, data, options) {
    _oauthAccountSaver ||= createOAuthAccountSaveController({
        capture: captureOAuthAccountSaveSource, current: currentOAuthAccountSaveSource, surfaceCurrent: oauthAccountSaveSurfaceCurrent,
        state: value => { window.CList.state.oauthAccountSave = value; },
        key: source => getEncKey(source.storeUrl), save: saveAccount,
        accounts: async source => loadAccountRecords({ storeUrl: source.storeUrl, token: source.token, encKey: await getEncKey(source.storeUrl), isCurrent: () => currentOAuthAccountSaveSource(source) }),
        install: accounts => { window.CList.accounts = accounts; }, visibility: () => updateUIVisibility(),
        navigate: () => { if (typeof playAccounts === 'function') return playAccounts(); }, log: error => console.error('[OAuth account save]', error),
    }, createOAuthAccountSaveView());
    return _oauthAccountSaver.save(label, key, data, options);
}
