/// <reference path="./clist-types.js" />
// Generic Save controller. Existing saver methods still own their export/service UI.
let _savePanel = null;
window.CList.savers ||= [];
function savePanelState() {
    window.CList.state ||= {};
    return window.CList.state.saving ||= {panelId:0, operationId:0, busy:false, phase:'ready', destination:null, error:null};
}
function captureSavePanelOwner() {
    return { editor: typeof currentEditor === 'undefined' ? null : currentEditor,
        account: typeof currentEditorAccount === 'undefined' ? null : currentEditorAccount,
        switchId: window.CList.state.editorSwitching?.id, loadId: window.CList.state.editorLoading?.id,
        username: window.CList.state.username, storeUrl: window.CList.config?.flaskSiteUrl };
}
function savePanelOwnerMatches(panel) {
    const now = captureSavePanelOwner();
    return Object.keys(now).every(key => now[key] === panel.owner[key]);
}
function ownsSavePanel(panel) {
    return _savePanel === panel && savePanelState().panelId === panel.id && savePanelOwnerMatches(panel);
}
function invalidateSavePanel() { _savePanel = null; }
async function playSave() {
    try {
        if (window.CList.state?.collectionPublishing?.busy) { showStatusMessage('Wait for collection publication to finish.'); return; }
        if (typeof currentEditor !== 'undefined' && currentEditor === 'collection' && typeof window.playCollectionSave === 'function') {
            if (savePanelState().busy) { showStatusMessage('Wait for the current save to finish.'); return; }
            invalidateSavePanel(); await window.playCollectionSave(); return;
        }
        populateSaveOptions(); window.CList.ui.saving.open();
    } catch (error) { window.CList.ui.saving.error(error); }
}
function populateSaveOptions() {
    const state = window.CList.state.saving = openSavePanelState(savePanelState());
    const panel = _savePanel = {id: state.panelId, owner: captureSavePanelOwner()};
    try {
        const options = window.CList.savers.filter(handler => window.CList.ui.isHandlerVisible(handler))
            .map(handler => ({label: handler.label, icon: handler.icon, logoSrc: handler.logoSrc,
                select: () => selectSaveDestination(panel, handler)}));
        window.CList.ui.saving.mount(options, state.busy);
    } catch (error) { window.CList.ui.saving.error(error); }
}
async function selectSaveDestination(panel, handler) {
    if (!ownsSavePanel(panel) || savePanelState().busy) return;
    if (window.CList.state.collectionPublishing?.busy) { showStatusMessage('Wait for collection publication to finish.'); return; }
    let operation;
    try {
        if (!window.CList.savers.includes(handler) || !window.CList.ui.isHandlerVisible(handler)) return;
        if (typeof handler.save !== 'function') throw new Error('This save destination is unavailable.');
        operation = window.CList.state.saving = startSaveState(savePanelState(), handler.label);
        window.CList.ui.saving.busy(true);
        // Preserve the no-argument saver contract and its user gesture. The
        // guard covers dispatch/completion, not a legacy saver's internal writes.
        const result = await handler.save();
        window.CList.state.saving = finishSaveState(savePanelState(), operation.operationId);
        if (_savePanel && ownsSavePanel(_savePanel)) window.CList.ui.saving.busy(false);
        if (ownsSavePanel(panel) && !result?.keepOpen) {
            invalidateSavePanel(); window.CList.ui.saving.close();
        }
    } catch (error) {
        if (operation) window.CList.state.saving = finishSaveState(savePanelState(), operation.operationId, error?.message || String(error));
        if (_savePanel && ownsSavePanel(_savePanel)) window.CList.ui.saving.busy(false);
        if (ownsSavePanel(panel)) window.CList.ui.saving.error(error);
        else window.CList.ui.saving.staleError(error);
    }
}
