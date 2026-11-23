// Form lifetime and mutually exclusive OAuth/manual actions; values stay private.
function createServiceAccountSetupController(config, deps) {
    let view, pending = null, disposed = false, source, saver, requestedDraft, recovery, phase = 'ready', operationBusy = false, redirected = false, receipt = 'none';
    const current = () => !disposed && view?.current() && deps.current(source);
    function state(nextPhase, busy, value = receipt) {
        phase = nextPhase; receipt = value; operationBusy = busy;
        if (busy) recovery = null;
        if (current()) {
            /** @type {CListServiceAccountSetupState} */
            const value = { phase, busy, receipt }; deps.state(value); view.busy(busy);
        }
    }
    function accountView() {
        return {
            success() { recovery = null; deps.saved(); if (current()) view.message(config.label + ' account saved.'); },
            failure(label, error, value, actions) { recovery = () => view.recovery(error, value, actions); if (current()) recovery(); },
            review(label, actions) { recovery = () => view.review(actions); if (current()) recovery(); },
        };
    }
    function run(operation) {
        if (pending) return pending;
        if (!current() || operationBusy || redirected) return Promise.resolve(false);
        state('working', true);
        pending = Promise.resolve().then(operation).catch(error => {
            deps.log(error); if (current()) { state('failed', false); view.error(error); } return false;
        }).finally(() => { pending = null; operationBusy = false; if (current()) state(phase === 'working' ? 'ready' : phase, false); });
        return pending;
    }
    const controller = {
        mount(nextView) {
            view = nextView; disposed = false;
            if (!source) {
                source = deps.capture();
                saver = deps.saver({
                    capture: () => { const draft = requestedDraft; return { ...deps.capture(), draft: { ...draft, current: () => !disposed && draft.current() } }; },
                    state: value => state(value.phase, value.busy, value.receipt),
                }, accountView());
            }
            const locked = !!pending || operationBusy;
            view.bind(controller); state(locked ? phase : 'ready', locked);
            if (recovery && current()) recovery();
        },
        back() { if (!current()) return; disposed = true; deps.back(); },
        dispose() { disposed = true; },
        authorize() {
            if (!config.authorizationKey || !deps.authorize) return Promise.resolve(false);
            if (receipt === 'uncertain' && recovery && current()) { recovery(); return Promise.resolve(false); }
            const draft = view?.capture();
            return run(async () => {
                if (receipt === 'uncertain') throw new Error('Check the outstanding account save before authorizing another account.');
                const key = config.authorizationKey(draft.values);
                const owned = () => !disposed && deps.current(source) && draft.current();
                await deps.authorize(key, owned);
                if (owned()) { redirected = true; state('redirecting', false); view.message('Authorization started.'); } return true;
            });
        },
        manual() {
            if (receipt === 'uncertain' && recovery && current()) { recovery(); return Promise.resolve(false); }
            const draft = view?.capture();
            return run(async () => {
                if (receipt === 'uncertain') throw new Error('Check the outstanding account save before saving again.');
                const request = config.request(draft.values);
                requestedDraft = draft;
                return saver.save(config.label, request.key, request.data);
            });
        },
    };
    return controller;
}

function accountSetupDependencies(context, config) {
    return {
        capture: captureOAuthAccountSaveSource, current: currentOAuthAccountSaveSource, back: context.back,
        state: value => { window.CList.state[config.stateKey] = value; },
        saved: () => showStatusMessage(config.label + ' account saved.'),
        authorize: config.authorize,
        log: error => console.error('[' + config.label + ' setup]', error),
        saver: (panel, view) => createOAuthAccountSaveController({
            capture: panel.capture, current: currentOAuthAccountSaveSource,
            surfaceCurrent: captured => oauthAccountSaveSurfaceCurrent(captured) && captured.draft.current(),
            state: panel.state, key: captured => getEncKey(captured.storeUrl),
            save: (request, session, captured) => saveAccount(request, { ...session,
                isCurrent: () => session.isCurrent() && captured.draft.current() }),
            accounts: () => context.reloadAccounts(),
            install: (accounts, captured) => { window.CList.accounts = accounts; if (captured.draft.current() && oauthAccountSaveSurfaceCurrent(captured)) { if (config.reader) populateReadAccountList(accounts); populatePostOptions(accounts); } },
            visibility: () => updateUIVisibility(), navigate: async () => { context.finish(); await context.refreshList(); },
            log: error => console.error('[' + config.label + ' account save]', error),
        }, view),
    };
}
