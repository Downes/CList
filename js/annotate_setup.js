function createAnnotateSetupController(deps) {
    let view, probe = 0;
    const shared = createAccountRegistrationSetupController({
        label: 'Annotate', request: annotateSetupRequest,
        beforeRegister: (job, assert) => checkAnnotateSetupServer(job.request.key, { assert, fetch: deps.fetch }),
        register: (job, assert, receipts) => requestAnnotateRegistration({ url: job.request.key, token: job.source.token }, { assert, fetch: deps.fetch, ...receipts }),
    }, deps);
    async function check() {
        const generation = ++probe;
        if (!shared.canProbe()) return;
        const target = view;
        let current = () => generation === probe && target.current();
        try {
            const draft = target.capture(), source = deps.capture();
            current = () => generation === probe && shared.canProbe() && target.current() && draft.current() && deps.current(source);
            const assert = () => { if (!current()) throw new Error('Annotation server check expired.'); };
            const url = normalizeAnnotateSetupUrl(draft.values.url); assert(); target.message('Checking ' + url + '…');
            await checkAnnotateSetupServer(url, { assert, fetch: deps.fetch });
            if (current()) target.message('Found annotation server at ' + url);
        } catch (error) { deps.log(error); if (current()) target.message('Could not reach the selected server. Check its URL or choose another server.'); }
    }
    const controller = {
        mount(nextView) { probe++; view = nextView; shared.mount(view); view.bind(controller); void check(); },
        changed() { void check(); }, edit() { probe++; },
        connect() { probe++; return shared.connect(); },
        back() { probe++; shared.back(); },
    };
    return controller;
}
