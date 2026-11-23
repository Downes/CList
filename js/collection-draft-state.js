/// <reference path="./clist-types.js" />
// DOM-free collection draft transitions. The live array remains compatible with Save/imports.
/** @param {CListCollectionMember[]} items */
function createCollectionDraftState(items) {
    return { items: items.map(item => ({ ...item })), generation: 0, expanded: new Set() };
}
function collectionDraftRowCurrent(state, ticket) {
    return ticket.generation === state.generation && state.items[ticket.index] === ticket.item;
}
function moveCollectionDraftRow(state, ticket, offset) {
    if (!collectionDraftRowCurrent(state, ticket)) return false;
    const next = ticket.index + offset;
    if (next < 0 || next >= state.items.length) return false;
    [state.items[next], state.items[ticket.index]] = [state.items[ticket.index], state.items[next]];
    return true;
}
function removeCollectionDraftRow(state, ticket) {
    if (!collectionDraftRowCurrent(state, ticket)) return false;
    state.items.splice(ticket.index, 1); state.expanded.delete(ticket.item); return true;
}
function editCollectionDraftField(state, ticket, key, value, baseline) {
    const fields = ticket.item.role === 'contains' && ticket.item.collectionId
        ? ['title'] : ['title', 'url', 'author_name', 'feed', 'summary'];
    if (!collectionDraftRowCurrent(state, ticket) || !fields.includes(key)
        || ticket.item[key] !== baseline) return false;
    ticket.item[key] = value; return true;
}
