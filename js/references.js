/// <reference path="./clist-types.js" />
//  references.js  —  Reference list management for the CList editor session
//
//  A reference is created whenever a feed item is loaded into the editor.
//  It records attribution, the source URL, and any service-specific reply
//  token needed to post a threaded reply back to that service at publish time.
//
//  Reference shape:
//    {
//      service:     string | null,   // 'Mastodon', 'Bluesky', 'RSS', etc.
//      author_name: string,
//      author_id:   string,
//      feed:        string,
//      url:         string,
//      title:       string,
//      created_at:  string (ISO) | '',  // date the SOURCE item was published, if known
//      cited_at:    string (ISO),       // date this reference was captured/cited in CList
//      id:          string,          // DOM item ID
//      summary:     string,
//      image:       string | undefined,  // source item's image URL, if it had one (Annotate
//                                         // editor only — not shown in the References panel)
//      images:      string[] | undefined,  // ALL candidate image URLs the source item had,
//                                            // if more than the one in `image` (Annotate
//                                            // editor's upload picker only — see ui.js)
//      replyToken:  object | null,   // service-specific; see below
//    }
//
//  replyToken shapes (null = no reply support for this service):
//    Mastodon:  { type: 'Mastodon', statusId: string }
//    Bluesky:   { type: 'Bluesky', uri: string, cid: string }
//

// Controller and compatibility API. The view receives display values and callbacks.
window.CList.state.references ||= [];
let _referencesAction = null;
function referencesPanelState() {
    return window.CList.state.referencesPanel ||= nextReferencesPanel(null);
}
function updateReferencesPanel(changes, render = false) {
    return window.CList.state.referencesPanel = nextReferencesPanel(referencesPanelState(), changes, render);
}
function referencePanelOwner() {
    const editor = typeof currentEditor === 'undefined' ? null : currentEditor;
    const handler = typeof editorHandlers === 'undefined' ? null : editorHandlers[editor];
    return { editor, account: typeof currentEditorAccount === 'undefined' ? null : currentEditorAccount,
        // Save/publication can replace currentLoadedPage metadata without loading
        // another document. Actual loads/mounts and live document IDs own expiry.
        switchId: window.CList.state.editorSwitching?.id, loadId: window.CList.state.editorLoading?.id,
        username: window.CList.state.username, storeUrl: window.CList.config?.flaskSiteUrl,
        docId: handler?.getDocId?.() || null };
}
function referenceOwnerMatches(owner) {
    const now = referencePanelOwner();
    return Object.keys(now).every(key => now[key] === owner[key]);
}
function referenceRowCurrent(row) {
    return row.generation === referencesPanelState().generation && referenceOwnerMatches(row.owner)
        && getReferences()[row.index] === row.reference;
}
/** @param {CListReference} ref @returns {boolean} */
function pushReference(ref) {
    const next = appendPanelReference(getReferences(), ref);
    if (next === getReferences()) return false;
    window.CList.state.references = next; _renderReferencesPanel(); return true;
}
/** @returns {CListReference[]} */
function getReferences() { return window.CList.state.references; }
function closeReferencesPanel() {
    updateReferencesPanel({open:false}, true);
    window.CList.ui.references.visibility(false);
}
window.playRefs = function() {
    if (referencesPanelState().open) { closeReferencesPanel(); return; }
    if (!getReferences().length) { showErrorModal('No references yet.', {title:'No references'}); return; }
    updateReferencesPanel({open:true}); _renderReferencesPanel();
};
function clearReferences() {
    window.CList.state.references = [];
    updateReferencesPanel({open:false}, true);
    if (_referencesAction) _referencesAction.cancelled = true;
    window.CList.ui.references.clear();
}
/** @param {CListReference[]} list */
function setReferences(list) {
    window.CList.state.references = Array.isArray(list) ? list : [];
    _renderReferencesPanel();
}
function editReferenceRow(row, key, value) {
    if (!referenceRowCurrent(row)) return false;
    const next = editPanelReference(getReferences(), row.index, row.reference, key, value);
    if (next === getReferences()) return false;
    if (_referencesAction) _referencesAction.cancelled = true;
    // Existing editor field handlers (notably Annotation) retain this reference
    // object. Apply the validated field only, keeping that legacy live identity.
    row.reference[key] = next[row.index][key]; next[row.index] = row.reference;
    window.CList.state.references = next;
    return true; // The view updates only this field, preserving focus in other rows.
}
function removeReferenceRow(row) {
    if (!referenceRowCurrent(row)) return;
    if (_referencesAction) _referencesAction.cancelled = true;
    window.CList.state.references = removePanelReference(getReferences(), row.index, row.reference);
    _renderReferencesPanel();
}
function beginReferenceAction() {
    const state = referencesPanelState();
    if (state.busy) return null;
    const action = _referencesAction = {id:state.actionId + 1, cancelled:false};
    updateReferencesPanel({busy:true, actionId:action.id}); window.CList.ui.references.busy(true);
    return action;
}
function finishReferenceAction(action) {
    if (_referencesAction !== action) return;
    _referencesAction = null; updateReferencesPanel({busy:false}); window.CList.ui.references.busy(false);
}
async function annotateReferenceRow(row) {
    if (!referenceRowCurrent(row)) return;
    const action = beginReferenceAction(); if (!action) return;
    let switchId;
    try {
        const target = structuredClone({...row.reference, replyToken:null});
        const switching = switchToEditor('annotate-edit');
        switchId = window.CList.state.editorSwitching?.id;
        const switched = await switching;
        if (switched === false || action.cancelled || _referencesAction !== action || currentEditor !== 'annotate-edit'
            || switchId !== window.CList.state.editorSwitching?.id
            || row.owner.username !== window.CList.state.username || row.owner.storeUrl !== window.CList.config?.flaskSiteUrl
            || row.owner.loadId !== window.CList.state.editorLoading?.id) return;
        pushReference(target);
        await _refreshAnnotateSendControls(); _refreshAnnotateRefFields();
    } catch (error) {
        const sameSession = row.owner.username === window.CList.state.username && row.owner.storeUrl === window.CList.config?.flaskSiteUrl;
        const ownedTarget = typeof currentEditor !== 'undefined' && currentEditor === 'annotate-edit'
            && switchId === window.CList.state.editorSwitching?.id && row.owner.loadId === window.CList.state.editorLoading?.id;
        if (sameSession && (referenceOwnerMatches(row.owner) || ownedTarget)) window.CList.ui.references.error(error, 'Could not annotate reference');
        else window.CList.ui.references.staleError(error);
    }
    finally { finishReferenceAction(action); }
}
async function saveReferenceCollection(generation, owner, anchor) {
    if (generation !== referencesPanelState().generation || !referenceOwnerMatches(owner)) return;
    const action = beginReferenceAction(); if (!action) return;
    try {
        if (typeof window.importCollectionFromChat !== 'function') throw new Error('Collection import not available.');
        // The existing helper owns its asynchronous picker and storage actions.
        // Capture the list; this controller does not cancel that legacy workflow.
        await window.importCollectionFromChat(structuredClone(getReferences()), anchor);
    } catch (error) {
        if (referenceOwnerMatches(owner)) window.CList.ui.references.error(error, 'Could not save references as collection');
        else window.CList.ui.references.staleError(error);
    }
    finally { finishReferenceAction(action); }
}
function _renderReferencesPanel() {
    const state = updateReferencesPanel({}, true), owner = referencePanelOwner();
    const rows = getReferences().map((reference, index) => {
        const row = {reference, index, owner, generation:state.generation};
        return { reference: {
            author_name:reference.author_name, title:reference.title, feed:reference.feed, url:reference.url,
            created_at:reference.created_at, cited_at:reference.cited_at,
        }, read:key=>({current:referenceRowCurrent(row), value:row.reference[key]}),
        edit:(key,value)=>editReferenceRow(row,key,value), remove:()=>removeReferenceRow(row), annotate:()=>annotateReferenceRow(row) };
    });
    window.CList.ui.references.mount(rows, {open:state.open, busy:state.busy,
        close:()=>{if (state.generation === referencesPanelState().generation && referenceOwnerMatches(owner)) closeReferencesPanel();},
        save:anchor=>saveReferenceCollection(state.generation,owner,anchor)});
}
