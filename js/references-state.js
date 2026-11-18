/// <reference path="./clist-types.js" />
// Plain list transitions. Preserve structural fields and exact URL deduplication.
/** @param {CListReference[]} list @param {CListReference} reference */
function appendPanelReference(list, reference) {
    return !reference?.url || list.some(item => item.url === reference.url) ? list : [...list, reference];
}
function editPanelReference(list, index, expected, key, value) {
    if (!['author_name', 'title', 'feed', 'url'].includes(key) || list[index] !== expected) return list;
    const next = list.slice(); next[index] = { ...expected, [key]: value }; return next;
}
function removePanelReference(list, index, expected) {
    return list[index] !== expected ? list : list.filter((_, position) => position !== index);
}
/** @returns {CListReferencesPanelState} */
function nextReferencesPanel(state, changes = {}, render = false) {
    return { generation: (state?.generation || 0) + (render ? 1 : 0),
        open: state?.open || false, busy: state?.busy || false, actionId: state?.actionId || 0, ...changes };
}
