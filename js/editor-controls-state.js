/// <reference path="./clist-types.js" />
// Plain Load/Blank operation transitions and loaded-page presentation.
/** @returns {CListEditorControlsState} */
function beginEditorControls(previous, phase, target = null) {
    return { id: (previous?.id || 0) + 1, phase, target, error: null };
}
function transitionEditorControls(state, id, phase, target = state.target, error = null) {
    return state.id !== id ? state : { ...state, phase, target, error };
}
/**
 * @param {CListWebPageSource|null} page
 * @param {CListWebPageSource|null} previous
 * @returns {CListLoadedPagePresentation}
 */
function editorLoadedPageModel(page, previous = null) {
    const url = page?.publicationUrl || page?.url || '';
    let label = page ? (page.kind === 'file' ? 'Loaded file: ' + (page.title || '') : 'Loaded: ' + (page.title || url || '')) : '';
    if (url) label += ` → ${url}`;
    if (page?.format) label += ` [${page.format}]`;
    const changed = page && (page.kind !== previous?.kind || page.id !== previous?.id || page.title !== previous?.title);
    return { documentTitle: page?.documentTitle, label, url,
        hasPublicationLocation: !!(page && (page.service || page.serviceId || page.url || page.publicationUrl)),
        notice: changed ? (page.kind === 'file' ? 'Loaded file: ' : 'Loaded: ') + (page.title || 'Untitled') : null };
}
