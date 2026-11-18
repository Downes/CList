/// <reference path="./clist-types.js" />
// Plain editor identity, operation and parked-metadata transitions. No DOM/storage.
function editorStateKey(editorType, account) {
    return account?.key ? `${editorType}:${account.key}` : editorType;
}
/** @returns {CListEditorSwitchState} */
function beginEditorSwitch(previous, target) {
    return { id: (previous?.id || 0) + 1, phase: 'pending', target,
        active: previous?.active || null, parked: previous?.parked || {}, error: null };
}
function transitionEditorSwitch(state, id, phase, error = null) {
    if (state.id !== id) return state;
    return { ...state, phase, error, active: phase === 'complete' ? state.target : state.active };
}
/** @param {CListEditorSwitchState} state */
function parkEditorMetadata(state, key, page, references) {
    return { ...state, parked: { ...state.parked,
        [key]: structuredClone({ page, references }) } };
}
function restoredEditorMetadata(state, key) {
    return structuredClone(state.parked[key] || { page: null, references: [] });
}
function mergeEditorReferences(existing, incoming) {
    const merged = structuredClone(existing);
    for (const reference of incoming) {
        if (!merged.some(item => item.url === reference.url)) merged.push(structuredClone(reference));
    }
    return merged;
}
function parseEditorDraftReferences(value) {
    const parsed = JSON.parse(value || '[]');
    if (!Array.isArray(parsed) || parsed.some(item => !item || typeof item !== 'object' || Array.isArray(item))) {
        throw new Error('Saved draft references are invalid.');
    }
    return parsed;
}
