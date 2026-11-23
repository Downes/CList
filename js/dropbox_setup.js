// Private captured setup values and pre-redirect ownership; callback persistence is separate.
function createDropboxSetupController(deps, view) {
    let pending = null, disposed = false, revision = 0, started = false;
    const current = () => !disposed && deps.current() && view.current();
    function state(phase, busy) {
        /** @type {CListDropboxSetupState} */
        const value = { phase, busy }; deps.state(value);
    }
    return {
        change() { revision++; },
        back() { if (!current()) return; disposed = true; revision++; deps.back(); },
        dispose() { disposed = true; revision++; },
        start() {
            if (pending) return pending;
            if (started) return Promise.resolve(false);
            if (!current()) return Promise.resolve(false);
            const values = view.values(), captured = revision;
            const request = { appKey: values.appKey.trim(), title: values.title.trim() || 'Dropbox', folder: values.folder.trim() || '/CList', permissions: 'b' };
            if (!request.appKey) { view.error(new Error('Please enter your Dropbox App Key first.')); return Promise.resolve(false); }
            const sameValues = () => { const latest = view.values(); return ['appKey', 'title', 'folder'].every(key => latest[key] === values[key]); };
            const owned = () => current() && revision === captured && sameValues();
            state('authorizing', true); view.busy(true);
            pending = Promise.resolve().then(async () => {
                if (!owned()) return false;
                await deps.start(request, owned);
                if (owned()) { started = true; state('redirecting', true); view.started(); return true; }
                return false;
            }).catch(error => { deps.log(error); if (owned()) { state('failed', false); view.error(error); } return false; })
                .finally(() => { pending = null; if (current() && !started) { view.busy(false); if (revision !== captured || !sameValues()) state('ready', false); } });
            return pending;
        },
    };
}
function captureDropboxSetupSource() {
    const state = window.CList.state, store = window.CList.config.flaskSiteUrl;
    const token = getSiteSpecificCookie(store, window.CList.keys.ACCESS_TOKEN), username = state.username, epoch = state.authEpoch;
    return () => store === window.CList.config.flaskSiteUrl && username === window.CList.state.username
        && epoch === window.CList.state.authEpoch && token === getSiteSpecificCookie(store, window.CList.keys.ACCESS_TOKEN);
}
