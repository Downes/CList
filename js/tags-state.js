/// <reference path="./clist-types.js" />
/** @returns {CListWriteTagsState} */
function createWriteTagsState() {
    return {selected:[], collections:null, query:'', dropdown:false, offer:null,
        version:0, requestId:0, loading:false, creating:false, creation:null, error:null};
}
function addWriteTag(state, name) {
    if (!name || state.selected.includes(name)) return state;
    return {...state, selected:[...state.selected,name], query:'', dropdown:false, offer:null, version:state.version+1};
}
function removeWriteTag(state, name) {
    return {...state, selected:state.selected.filter(tag=>tag!==name), version:state.version+1};
}
function suggestedWriteTags(state) {
    const query=state.query.trim().toLowerCase();
    return (state.collections || []).filter(name=>!state.selected.includes(name) && (!query || name.toLowerCase().startsWith(query)));
}
function unknownWriteTag(state, name) {
    return state.collections !== null && !state.collections.some(value=>value.toLowerCase()===name.toLowerCase());
}
