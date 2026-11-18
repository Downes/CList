/// <reference path="./clist-types.js" />
// Per-editor pane registry and the pure open/close/switch decision. No DOM access —
// panes carry DOM handles (container, render) only as caller-supplied data; this file
// never reads or writes them.
const _editorPaneState = {};

function registerEditorPanes(editorType, panes) {
    _editorPaneState[editorType] = { panes: new Map(panes.map(p => [p.id, p])), activeId: null };
}

/**
 * Decides what switching to paneId should do, without touching the DOM or committing
 * the new activeId — the controller commits via commitEditorPane once it has acted.
 * @returns {{def: object, previous: object|null, activate: boolean}|null} null when
 *   editorType/paneId is unregistered
 */
function editorPaneTransition(editorType, paneId) {
    const state = _editorPaneState[editorType];
    const def = state && state.panes.get(paneId);
    if (!def) return null;
    const activate = state.activeId !== paneId;
    const previous = state.activeId ? state.panes.get(state.activeId) : null;
    return { def, previous: previous || null, activate };
}

function commitEditorPane(editorType, paneId, activate) {
    const state = _editorPaneState[editorType];
    if (state) state.activeId = activate ? paneId : null;
}
