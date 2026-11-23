// Private compile lifetime, PDF URL ownership and captured Share operations.
function createLatexControlsController(deps) {
    let view = null, generation = 0, pending = null, pdf = null;
    const state = (phase, busy) => {
        /** @type {CListLatexControlsState} */
        const value = { phase, busy }; deps.state(value);
    };
    function revoke() { if (pdf) { const old = pdf; pdf = null; try { deps.revoke(old.url); } catch (error) { deps.log(error); if (view?.current()) view.error(error); } } }
    const api = {
        bind(next) { view = next; generation++; state(pending ? 'compiling' : 'ready', !!pending); next.busy(!!pending);
            if (pdf && deps.current(pdf.source, true)) next.compiled(pdf.url); else revoke();
        },
        invalidate() { generation++; revoke(); view?.hideDownload(); },
        compile() {
            if (pending) return pending.promise;
            const source = deps.capture(), panel = view, id = generation;
            const current = () => view === panel && generation === id && panel.current() && deps.current(source, true);
            const job = pending = {};
            state('compiling', true); panel.busy(true); panel.hideDownload(); revoke();
            job.promise = Promise.resolve().then(async () => {
                if (!current()) return false;
                if (!source.token) throw new Error('Log in to compile a LaTeX document.');
                const blob = await deps.compile(source);
                if (!current()) return false;
                const url = deps.url(blob);
                if (!current()) { deps.revoke(url); return false; }
                pdf = { url, source }; panel.compiled(url); return true;
            }).catch(error => { if (pdf?.source === source) revoke(); deps.log(error); if (current()) panel.error(error); return false; })
                .finally(() => { if (pending === job) pending = null; state('ready', false); if (view?.current()) view.busy(false); });
            return job.promise;
        },
        share() {
            const source = deps.capture(), panel = view, id = generation;
            const current = () => view === panel && generation === id && panel.current() && deps.current(source, false);
            try {
                if (!current() || !source.docId) throw new Error('Join a document first before sharing.');
                const links = ['edit', 'read'].map(mode => ({ label: mode === 'edit' ? 'Co-edit link' : 'Read-only link', url: deps.link(source, mode) }));
                panel.share(source.title, links, current, (url, owned) => deps.copy(url, owned)); return true;
            } catch (error) { deps.log(error); if (panel?.current()) panel.error(error); return false; }
        },
    };
    return api;
}
