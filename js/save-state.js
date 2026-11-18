/// <reference path="./clist-types.js" />
// Plain Save panel and in-flight operation transitions. No DOM, storage or credentials.
/** @returns {CListSavePanelState} */
function openSavePanelState(previous) {
    return { panelId: (previous?.panelId || 0) + 1, operationId: previous?.operationId || 0,
        busy: previous?.busy || false, phase: previous?.busy ? 'saving' : 'ready',
        destination: previous?.busy ? previous.destination : null, error: null };
}
function startSaveState(state, destination) {
    if (state.busy) return state;
    return { ...state, operationId: state.operationId + 1, busy: true, phase: 'saving', destination, error: null };
}
function finishSaveState(state, operationId, error = null) {
    return state.operationId !== operationId ? state : { ...state, busy: false,
        phase: error !== null ? 'failed' : 'complete', error };
}
