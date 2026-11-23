// Mounted form ownership only; authorization and callback binding remain in wordpress_auth*.
function createWordPressSetupController(deps) {
    let view, source, pending = null, disposed = false, redirected = false;
    const current = () => !disposed && view?.current() && deps.current(source);
    function state(phase, busy) {
        if (!current()) return;
        /** @type {CListWordPressSetupState} */
        const value = { phase, busy }; deps.state(value); view.busy(busy);
    }
    const controller = {
        mount(nextView) {
            source ||= deps.capture(); view = nextView; disposed = false; view.bind(controller);
            state(redirected ? 'redirecting' : pending ? 'authorizing' : 'ready', !!pending || redirected);
        },
        back() { if (!current()) return; disposed = true; deps.back(); },
        authorize() {
            if (pending) return pending;
            if (!current() || redirected) return Promise.resolve(false);
            const draft = view.capture(), owned = () => !disposed && deps.current(source) && draft.current();
            state('authorizing', true);
            pending = Promise.resolve().then(async () => {
                let site = draft.value.trim();
                if (!site) throw new Error('Please enter your WordPress site URL.');
                if (!/^https?:\/\//i.test(site)) site = 'https://' + site;
                site = normalizeWordPressAuthSite(site);
                if (!owned()) return false;
                const result = await deps.authorize(site, { isCurrent: owned, onError: error => { if (owned()) view.error(error); } });
                if (owned()) { redirected = !!result; state(result ? 'redirecting' : 'failed', !!result); if (result) view.message('Authorization started.'); }
                return !!result;
            }).catch(error => { deps.log(error); if (owned()) { state('failed', false); view.error(error); } return false; })
                .finally(() => { pending = null; if (current() && !redirected) state('ready', false); });
            return pending;
        },
    };
    return controller;
}
