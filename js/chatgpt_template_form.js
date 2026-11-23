function createTemplateFormController(deps, view) {
    let closed = false, draft = view.initial(), operation = null, stopWatching = () => {}, settle;
    const result = new Promise(resolve => { settle = resolve; });
    const owned = () => !closed && deps.current() && view.alive();
    const publish = (phase, busy = false) => {
        /** @type {CListTemplateFormState} */
        const value = { phase, busy }; deps.state(value);
    };
    function cancel(back = false) {
        if (closed) return;
        const navigate = back && owned(); closed = true; operation = null; stopWatching(); view.remove(); settle(null); publish('cancelled');
        if (navigate) deps.back();
    }
    function change(values) {
        if (!owned()) { cancel(); return; }
        if (JSON.stringify(draft) === JSON.stringify(values)) return;
        draft = { ...values }; operation = null; view.busy(false); publish('editing');
    }
    function submit(values) {
        if (!owned()) { cancel(); return Promise.resolve(false); }
        if (values) change(values);
        if (operation) return operation.promise;
        const type = draft.custom.trim() || draft.type, format = draft.format;
        if (!type || !['text', 'html'].includes(format)) { view.error(Error('Choose a template type and output format.')); publish('error'); return Promise.resolve(false); }
        const op = operation = { promise: null };
        const current = () => owned() && operation === op;
        view.busy(true); publish('generating', true);
        op.promise = Promise.resolve().then(async () => {
            if (!current()) { if (!owned()) cancel(); return false; }
            const content = await deps.generate(type, format, current);
            if (!current()) { if (!owned()) cancel(); return false; }
            const value = deps.extract(content);
            closed = true; operation = null; stopWatching(); view.remove(); publish('complete');
            settle({ type: format === 'html' ? 'text/html' : 'text/plain', value }); return true;
        }).catch(error => {
            if (!owned()) { cancel(); return false; }
            if (operation === op) { operation = null; view.busy(false); view.error(error); publish('error'); }
            return false;
        });
        return op.promise;
    }
    const controller = { result, owned, submit, change, cancel };
    try {
        view.mount({ submit, change, cancel }); publish('editing');
        stopWatching = view.watch(() => { if (!owned()) cancel(); });
    } catch (error) { cancel(); throw error; }
    return controller;
}
let _templateForm = null;
function templateFormSource() {
    return JSON.stringify([readerSession(), window.CList.state.authEpoch || 0,
        currentEditor, currentEditorAccount, window.CList.state.editorControls?.id,
        window.CList.state.editorSwitching?.id, window.CList.state.editorLoading?.id]);
}
function openTemplateForm() {
    _templateForm?.cancel(); const source = templateFormSource();
    const view = createTemplateFormView();
    const controller = createTemplateFormController({ current: () => templateFormSource() === source,
        generate: (type, format, current) => generateNewTemplateFromChatGPT(type, format, current), extract: extractCodeContent,
        state: value => { window.CList.state.templateForm = value; },
        back() { try { populateLoadOptions(); } catch (error) { console.error('Could not return to Load:', error); showStatusMessage('Could not return to Load. Please reopen it.'); } }
    }, view);
    _templateForm = controller; return controller.result;
}
