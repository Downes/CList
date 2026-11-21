function createCollabDocumentsController(deps, view) {
    let disposed = false, version = 0, opening = false;
    const owned = () => !disposed && deps.current() && view.alive();
    const state = (phase, count = 0) => {
        /** @type {CListCollabDocumentsState} */
        const value = { phase, count, opening }; if (owned()) deps.state(value);
    };
    const controller = {
        async load() {
            if (!owned()) return null;
            const id = ++version; opening = false; view.loading(); state('loading');
            const current = () => !disposed && version === id && deps.current();
            const assertCurrent = () => { if (!current() || !view.alive()) throw Error('The collaboration document list expired.'); };
            try {
                const result = await deps.read(deps.capture(), assertCurrent); assertCurrent();
                view.show(result.documents, async (record, rowCurrent) => {
                    if (!current() || !view.alive() || !rowCurrent() || opening) return false;
                    opening = true; view.busy(true); state('ready', result.documents.length);
                    try { await deps.open({ ...record }, result.wsUrl, current); return current(); }
                    catch (error) { if (current()) view.openError(error); return false; }
                    finally { if (current()) { opening = false; if (view.alive()) { view.busy(false); state('ready', result.documents.length); } } }
                }, deps.title);
                state(result.documents.length ? 'ready' : 'empty', result.documents.length);
            } catch (error) { if (owned() && version === id) { state('error'); view.error(error, () => controller.load()); } }
            return null;
        },
        dispose() { disposed = true; version++; }
    };
    return controller;
}
let _collabDocuments = null;
function collabDocumentsSource() {
    return JSON.stringify([readerSession(), window.CList.state.authEpoch || 0, window.CList.accounts || [], window.CList.defaults.COLLAB]);
}
function openCollabDocuments(actions) {
    _collabDocuments?.dispose(); const source = collabDocumentsSource();
    const controller = createCollabDocumentsController({ current: () => collabDocumentsSource() === source,
        capture() { const session = readerSession(); return { ...session, accounts: structuredClone(window.CList.accounts || []), defaultServer: window.CList.defaults.COLLAB.replace(/^http/, 'ws') }; },
        read: (snapshot, assertCurrent) => readCollabDocuments(snapshot, { assertCurrent,
            accounts: url => getAccounts(url), server: accounts => findAccountByType('Collab', { accounts })?.parsedValue.instance,
            restBase: wsUrlToRestBase, fetch: (...args) => fetch(...args) }),
        open: actions.open, title: actions.title,
        state: value => { window.CList.state.collabDocuments = value; }
    }, createCollabDocumentsView());
    _collabDocuments = controller; return controller.load();
}
