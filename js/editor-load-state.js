/// <reference path="./clist-types.js" />
// Plain-data transitions and representation rules. No DOM, registry or session reads.
/** @param {CListEditorLoadState} [previous] @returns {CListEditorLoadState} */
function beginEditorLoad(previous) {
    return { id: (previous?.id || 0) + 1, phase: 'recognizing', target: null, error: null };
}
/** @param {CListEditorLoadState} state @returns {CListEditorLoadState} */
function transitionEditorLoad(state, id, phase, target = state.target, error = null) {
    return state.id === id ? { ...state, phase, target, error } : state;
}
function editorLoadIsEmpty(contentTypes, value, plainText) {
    if (!value) return true;
    return !(contentTypes?.[0] === 'text/plain' ? String(value).trim() : String(plainText || '').trim());
}
function editorLoadRepresentations(content, page, capabilities) {
    const choices = {};
    for (const capability of capabilities) {
        if (capability.contentTypes.includes(content.type)) choices[capability.key] = content;
    }
    const supports = key => capabilities.some(capability => capability.key === key);
    if (content.type === 'text/html' && supports('texteditor')) {
        choices.texteditor = { ...content, type: 'text/plain', value: content.value };
    }
    if (content.type === 'text/html' && choices['annotate-edit'] && page?.documentTitle) {
        const references = structuredClone(page.references || []);
        const target = references[0] || { title: page.documentTitle };
        choices['annotate-edit'] = { ...content, type: 'application/vnd.clist.annotation+json',
            value: { format: 'clist-annotation-v1', body: content.value, target, references } };
    }
    if (content.type === 'application/vnd.clist.annotation+json') {
        if (supports('texteditor')) choices.texteditor = {
            type: 'text/plain', value: content.sourceText ?? JSON.stringify(content.value, null, 2) };
        if (supports('tinymce')) choices.tinymce = { type: 'text/html', value: content.value.body };
    }
    return choices;
}
