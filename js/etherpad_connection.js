// Connection panel controller. Accounts/headers stay in private dependency captures.
function createEtherpadConnectionController(deps, view) {
    let disposed = false, generation = 0, phase = 'ready', mode = deps.hasAccount ? 'account' : 'none', count = 0;
    const current = () => !disposed && deps.current() && view.current();
    const visible = () => current() && deps.visible();
    /** @type {function(): void} */
    function present() {
        /** @type {CListEtherpadConnectionState} */
        const state = { phase, mode, count }; deps.present(state);
    }
    async function list() {
        if (!visible() || mode !== 'account') return false;
        const request = ++generation; phase = 'loading'; present(); view.loading();
        try {
            const pads = await deps.list();
            if (!current() || request !== generation || mode !== 'account') return false;
            count = pads.length; phase = 'ready'; present();
            view.pads(pads, name => {
                if (!visible() || request !== generation || mode !== 'account') return false;
                return legacy(() => deps.select(name));
            }); return true;
        } catch (error) {
            deps.log(error);
            if (current() && request === generation && mode === 'account') { phase = 'failed'; present(); view.error(error, list); }
            return false;
        }
    }
    function legacy(action) {
        if (!visible()) return false;
        try { const result = action(); if (result?.catch) result.catch(error => { deps.log(error); if (visible()) view.error(error); }); return result; }
        catch (error) { deps.log(error); if (visible()) view.error(error); return false; }
    }
    const api = {
        list,
        start() { present(); if (mode === 'account') return list(); view.noAccount(); return Promise.resolve(true); },
        guest(base, pad, strict = false) {
            if (!visible()) return false;
            try {
                const target = normalizeEtherpadGuest(base, pad, strict);
                generation++; mode = 'guest'; count = 0; phase = 'ready';
                deps.guest(target); view.guest(target); present(); return true;
            } catch (error) { deps.log(error); if (visible()) view.error(error); return false; }
        },
        create(name) { return legacy(() => deps.create(name)); },
        share() { return legacy(deps.share); },
        showList() { if (!visible()) return false; view.showList(); return true; },
        active: current,
        resume() { if (!current()) return false; view.reveal(); present(); return true; },
        dispose() { if (disposed) return; disposed = true; generation++; view.dispose(); },
    };
    return api;
}

let _etherpadConnection = null;
function captureEtherpadConnectionSource() {
    const store = window.CList.config.flaskSiteUrl, state = window.CList.state;
    const username = state.username, epoch = state.authEpoch, token = getSiteSpecificCookie(store, window.CList.keys.ACCESS_TOKEN);
    return () => store === window.CList.config.flaskSiteUrl && username === window.CList.state.username
        && epoch === window.CList.state.authEpoch && token === getSiteSpecificCookie(store, window.CList.keys.ACCESS_TOKEN);
}
/** @param {CListAccountData|null} account */
async function mountEtherpadConnection(account) {
    currentEditor = 'etherpad';
    const previous = _etherpadConnection;
    const same = !account || (account.instance === previous?.account?.instance && account.id === previous?.account?.id);
    if (previous?.controller.active() && (currentEtherpadGuestBase || same)) return previous.controller.resume();
    previous?.documents?.dispose(); previous?.controller.dispose();
    currentEtherpadAccount = account ? structuredClone(account) : null; currentEtherpadGuestBase = null;
    padName = ''; authorID = ''; etherpadUsername = 'exampleUser';
    const captured = currentEtherpadAccount;
    const source = captureEtherpadConnectionSource(), view = createEtherpadConnectionView(window.CList.ui.view.writePaneContent);
    const owner = { account: captured, controller: null };
    const target = captured ? { instance: captured.instance, apiKey: captured.id, proxy: proxyUrl, headers: { ...kvstoreAuthHeader() } } : null;
    const fetchRequest = fetch;
    owner.controller = createEtherpadConnectionController({
        hasAccount: !!captured, current: () => _etherpadConnection === owner && source(), visible: () => currentEditor === 'etherpad',
        present: state => { window.CList.state.etherpadConnection = state; if(typeof notifyEditorSharingChanged==='function')notifyEditorSharingChanged(); },
        list: () => readEtherpadPads(target, { fetch: fetchRequest }),
        guest: target => { owner.documents?.invalidate(); currentEtherpadAccount = null; currentEtherpadGuestBase = target.base; padName = target.pad; authorID = ''; },
        select: name => etherpadDocuments().open(name, false),
        create: name => createAndLoadEtherpad(name), share: () => sharePad(),
        log: error => console.error('[Etherpad connection]', error),
    }, view);
    _etherpadConnection = owner; view.bind(owner.controller);
    bindEtherpadDocuments(owner, createEtherpadDocumentView(view));
    await owner.controller.start(); return owner.controller.active();
}
