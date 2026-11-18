/// <reference path="./clist-types.js" />
// Load/Blank controller. Payloads, handlers and account captures are transient.
let _editorControlsOperation = null;
function editorControlsState() { window.CList.state ||= {}; return window.CList.state.editorControls; }
function beginEditorControlsOperation(phase, target) {
    const state = beginEditorControls(editorControlsState(), phase, target);
    window.CList.state.editorControls = state;
    return _editorControlsOperation = { id: state.id, editor: currentEditor, account: currentEditorAccount,
        switchId: window.CList.state.editorSwitching?.id, username: window.CList.state.username,
        storeUrl: window.CList.config?.flaskSiteUrl, loadId: window.CList.state.editorLoading?.id };
}
function editorControlsAlive(operation) {
    return operation === _editorControlsOperation && editorControlsState()?.id === operation.id
        && !['cancelled', 'complete'].includes(editorControlsState().phase);
}
function editorControlsOwner(operation) {
    return editorControlsAlive(operation) && operation.editor === currentEditor && operation.account === currentEditorAccount
        && operation.switchId === window.CList.state.editorSwitching?.id && operation.username === window.CList.state.username
        && operation.storeUrl === window.CList.config?.flaskSiteUrl && operation.loadId === window.CList.state.editorLoading?.id;
}
function editorControlsPhase(operation, phase, target, error) {
    window.CList.state.editorControls = transitionEditorControls(editorControlsState(), operation.id, phase, target, error);
}
function invalidateEditorControls() {
    const operation = _editorControlsOperation;
    if (operation && editorControlsAlive(operation)) editorControlsPhase(operation, 'cancelled');
    _editorControlsOperation = null;
}
async function runEditorControls(operation, action) {
    try { return await action(); }
    catch (error) {
        if (editorControlsOwner(operation)) {
            editorControlsPhase(operation, 'failed', undefined, error.message || String(error));
            window.CList.ui.editorControls.error(error);
        } else if (editorControlsAlive(operation)) {
            editorControlsPhase(operation, 'cancelled');
        }
    }
}
async function playLoad() {
    populateLoadOptions();
    openRightInterface('load-instructions');
}
function populateLoadOptions() {
    const operation = beginEditorControlsOperation('sources');
    try {
        const options = (window.CList.loaders || []).filter(handler => window.CList.ui.isHandlerVisible(handler))
            .map(handler => ({ label: handler.label, icon: handler.icon, logoSrc: handler.logoSrc,
                select: () => selectEditorLoadSource(operation, handler) }));
        window.CList.ui.editorControls.sources(options);
    } catch (error) { editorControlsPhase(operation, 'failed', null, error.message); window.CList.ui.editorControls.error(error); }
}
async function selectEditorLoadSource(operation, handler) {
    if (!editorControlsOwner(operation) || !['sources', 'failed'].includes(editorControlsState().phase)) return;
    editorControlsPhase(operation, 'loading-source');
    return runEditorControls(operation, async () => {
        const content = await handler.load();
        // Legacy self-managing loaders own their own DOM. Only returned content
        // is guarded here; this does not cancel a loader's internal service work.
        if (!editorControlsOwner(operation)) return;
        if (!content || content.value === undefined || content.type === undefined) {
            editorControlsPhase(operation, 'sources'); return;
        }
        editorControlsPhase(operation, 'routing');
        await loadSavedPage(content, content.page || null, window.CList.ui.view.loadOptions, () => populateLoadOptions());
    });
}
function _appendBackButton(container, onClick) {
    return window.CList.ui.editorControls.back(container, async () => {
        try { await (onClick || populateLoadOptions)(); }
        catch (error) { window.CList.ui.editorControls.error(error); }
    });
}
window.CList.loaders ||= [];
window.CList.loaders.push({ label: 'Load blank', icon: 'note_add', requiresLogin: false, requiresAccount: false,
    load: async () => { playLoadBlank(); return null; } });
window.CList.loaders.push({ label: 'Load template', icon: 'folder_open', requiresLogin: true, requiresAccount: true,
    load: async () => {
        const operation = beginEditorControlsOperation('template');
        await runEditorControls(operation, async () => window.CList.ui.editorControls.template(() => {
            if (editorControlsOwner(operation)) populateLoadOptions();
        }));
        return null;
    } });
function playLoadBlank() {
    const operation = beginEditorControlsOperation('blank-choices');
    try {
        const options = Object.entries(editorHandlers).filter(([, handler]) => editorBlankEligible(handler))
            .map(([key, handler]) => ({label: handler.label || key, icon: handler.icon,
                select: () => {
                    if (editorControlsOwner(operation) && editorControlsState().phase === 'blank-choices')
                        return _confirmAndLoadBlank(key, handler, operation);
                } }));
        window.CList.ui.editorControls.blank(options, () => { if (editorControlsOwner(operation)) populateLoadOptions(); });
    } catch (error) { editorControlsPhase(operation, 'failed', null, error.message); window.CList.ui.editorControls.error(error); }
}
function editorBlankEligible(handler) {
    return typeof handler?.initialize === 'function' && (!handler.requiresAccount || handler.isActive?.())
        && (!handler.visible || handler.visible());
}
async function _confirmAndLoadBlank(targetKey, targetHandler, operation = beginEditorControlsOperation('blank-choices')) {
    if (!editorControlsOwner(operation)) return;
    return runEditorControls(operation, async () => {
        editorControlsPhase(operation, 'blank-check', targetKey);
        if (editorHandlers[targetKey] !== targetHandler || !editorBlankEligible(targetHandler)) throw new Error('That editor is unavailable.');
        operation.handler = targetHandler;
        if (targetKey !== currentEditor || !editorHasActiveContent(targetHandler)) return _doLoadBlank(targetKey, operation);
        // Snapshot before showing a destructive choice. New typing or changed
        // source metadata requires another explicit review.
        const body = JSON.stringify(await targetHandler.getContent?.());
        if (!editorControlsOwner(operation)) return;
        const references = JSON.stringify(getReferences()), page = currentLoadedPage;
        editorControlsPhase(operation, 'blank-review', targetKey);
        window.CList.ui.editorControls.confirmBlank(targetHandler.label || targetKey, targetHandler.label || targetKey,
            () => runEditorControls(operation, async () => {
                if (!editorControlsOwner(operation) || editorControlsState().phase !== 'blank-review') return;
                editorControlsPhase(operation, 'blank-check', targetKey); // Claim before awaiting.
                const latest = JSON.stringify(await targetHandler.getContent?.());
                if (!editorControlsOwner(operation)) return;
                if (latest !== body || references !== JSON.stringify(getReferences()) || page !== currentLoadedPage) {
                    showStatusMessage('The editor has changed. Choose Load blank again to review it.');
                    playLoadBlank(); return;
                }
                return _doLoadBlank(targetKey, operation);
            }), () => {
                if (editorControlsOwner(operation) && editorControlsState().phase === 'blank-review') playLoadBlank();
            });
    });
}
async function _doLoadBlank(targetKey, operation = beginEditorControlsOperation('blank-check', targetKey)) {
    if (!editorControlsOwner(operation)) return;
    return runEditorControls(operation, async () => {
        editorControlsPhase(operation, 'blanking', targetKey);
        const handler = editorHandlers[targetKey];
        if (!editorBlankEligible(handler) || (operation.handler && operation.handler !== handler)) throw new Error('That editor is unavailable.');
        clearDraft(targetKey);
        if (targetKey !== currentEditor) {
            if (await switchToEditor(targetKey) === false || !editorControlsAlive(operation)) { stopEditorBlank(operation); return; }
            operation.editor = currentEditor; operation.account = currentEditorAccount;
            operation.switchId = window.CList.state.editorSwitching?.id;
        }
        if (!editorControlsOwner(operation) || targetKey !== currentEditor) { stopEditorBlank(operation); return; }
        window.clearWriteTags?.(); clearReferences(); setLoadedPage(null);
        if (typeof handler.setContent === 'function') await handler.setContent('');
        else if (targetKey === 'collection') _activeCollection = null;
        if (!editorControlsOwner(operation)) { stopEditorBlank(operation); return; }
        if (await initializeEditor(targetKey) === false || !editorControlsAlive(operation)) { stopEditorBlank(operation); return; }
        operation.editor = currentEditor; operation.account = currentEditorAccount;
        operation.switchId = window.CList.state.editorSwitching?.id;
        if (!editorControlsOwner(operation) || targetKey !== currentEditor) { stopEditorBlank(operation); return; }
        editorControlsPhase(operation, 'complete', targetKey);
        closeLoadSurfaces(); updateEditorIndicator(); showStatusMessage('Blank editor loaded.');
    });
}
function stopEditorBlank(operation) {
    if (!editorControlsAlive(operation)) return;
    const switching = window.CList.state.editorSwitching;
    editorControlsPhase(operation, switching?.phase === 'failed' ? 'failed' : 'cancelled', undefined, switching?.error || null);
}
/** @param {CListWebPageSource|null} page */
function setLoadedPage(page) {
    const model = editorLoadedPageModel(page, currentLoadedPage);
    currentLoadedPage = page ? { ...page } : null;
    window.CList.ui.editorControls.loadedPage(model);
    if (model.notice) showStatusMessage(model.notice);
}
function updateLoadedPageUI() { window.CList.ui.editorControls.loadedPage(editorLoadedPageModel(currentLoadedPage, currentLoadedPage)); }
function setupEditorButtons(editorType) {
    const account = currentEditorAccount, switchId = window.CList.state?.editorSwitching?.id;
    const handler = editorHandlers[editorType];
    const actions = Object.entries(handler?.editorFunctions || {}).map(([label, action]) => ({label, select: async () => {
        if (currentEditor !== editorType || currentEditorAccount !== account || window.CList.state?.editorSwitching?.id !== switchId) return;
        try { await action(); } catch (error) { window.CList.ui.editorControls.error(error); }
    }}));
    window.CList.ui.editorControls.menu(actions);
}
function closeLoadSurfaces() { invalidateEditorControls(); window.CList.ui.editorControls.close(); }
