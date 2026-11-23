function createSummaryController(deps, view) {
    let disposed = false, operation = null;
    const owned = () => !disposed && deps.current() && view.alive();
    const state = (phase, busy = false) => {
        /** @type {CListSummaryState} */
        const value = { phase, busy }; if (owned()) deps.state(value);
    };
    const sameAccount = account => { try { return JSON.stringify(account) === JSON.stringify(deps.account()); } catch (_) { return false; } };
    const valid = op => {
        if (!owned() || operation !== op || !sameAccount(op.account)) return false;
        try { return view.capture() === op.text; } catch (_) { return false; }
    };
    return {
        owned,
        start(type) {
            if (!owned()) return Promise.resolve(false);
            let text, account;
            try { text = view.capture(); account = { ...deps.account() }; }
            catch (error) { operation = null; state('error'); view.error(error); return Promise.resolve(false); }
            if (operation?.busy && operation.text === text && operation.type === type && JSON.stringify(operation.account) === JSON.stringify(account)) return operation.promise;
            const op = operation = { text, type, account, busy: true, promise: null };
            view.pending(); state('loading', true);
            op.promise = Promise.resolve().then(async () => {
                if (!valid(op)) return false;
                const result = await deps.request(text, type, account);
                if (!valid(op)) return false;
                view.show(result, id => {
                    if (!valid(op)) return;
                    try { deps.load(id); } catch (error) { if (valid(op)) view.error(error); }
                });
                state('ready'); return true;
            }).catch(error => { if (valid(op)) { state('error'); view.error(error); } return false; })
                .finally(() => { op.busy = false; });
            return op.promise;
        },
        dispose() { disposed = true; operation = null; }
    };
}
let _summaryPanel = null;
function summarySource() {
    return JSON.stringify([readerSession(), readerState().requestId, window.CList.state.authEpoch || 0]);
}
function showSummary(input, output, type) {
    if (!_summaryPanel?.controller.owned() || _summaryPanel.input !== input || _summaryPanel.output !== output) {
        _summaryPanel?.controller.dispose(); const source = summarySource();
        const controller = createSummaryController({ current: () => summarySource() === source,
            account: summaryAccount, request: (text, kind, account) => requestSummary(text, kind, account, { fetch: (...args) => fetch(...args) }),
            load: id => loadContentToEditor(id), state: value => { if (_summaryPanel?.controller === controller) window.CList.state.summarizing = value; }
        }, createSummaryView(input, output));
        _summaryPanel = { controller, input, output };
    }
    return _summaryPanel.controller.start(type);
}
