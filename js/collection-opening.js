/// <reference path="./clist-types.js" />
// Captured collection/member opening controller. Credentials and bodies stay private.
let _collectionOpeningOwner = null;
/** @returns {CListCollectionOpeningState} */
function collectionOpeningState() { return window.CList.state.collectionOpening ||= { id: 0, phase: 'ready', busy: false, error: null }; }
function captureCollectionOpening(isCurrent) {
    const old = _collectionOpeningOwner;
    window.CList.ui.collectionOpening.cancelChoice();
    if (old) old.expired = true;
    const previous = collectionOpeningState();
    const state = window.CList.state.collectionOpening = { id: previous.id + 1, phase: 'preparing', busy: true, error: null };
    const storeUrl = window.CList.config.flaskSiteUrl;
    const owner = _collectionOpeningOwner = { id: state.id, state, isCurrent, storeUrl,
        username: window.CList.state.username, token: getSiteSpecificCookie(storeUrl, window.CList.keys.ACCESS_TOKEN),
        editor: currentEditor, page: currentLoadedPage,
        account: typeof currentEditorAccount === 'undefined' ? null : currentEditorAccount,
        controlsId: window.CList.state.editorControls?.id, loadId: window.CList.state.editorLoading?.id,
        switchId: window.CList.state.editorSwitching?.id };
    return owner;
}
function currentCollectionOpening(owner, source = true) {
    let permitted = false;
    try { permitted = owner.isCurrent(); } catch { return false; }
    if (_collectionOpeningOwner !== owner || owner.expired || !permitted
        || owner.username !== window.CList.state.username || owner.storeUrl !== window.CList.config.flaskSiteUrl
        || owner.token !== getSiteSpecificCookie(owner.storeUrl, window.CList.keys.ACCESS_TOKEN)
        || owner.controlsId !== window.CList.state.editorControls?.id) return false;
    return !source || (owner.editor === currentEditor && owner.page === currentLoadedPage
        && owner.account === (typeof currentEditorAccount === 'undefined' ? null : currentEditorAccount)
        && owner.switchId === window.CList.state.editorSwitching?.id && owner.loadId === window.CList.state.editorLoading?.id);
}
function failCollectionOpening(owner, error) {
    if (currentCollectionOpening(owner, false)) {
        owner.state.phase = 'failed'; owner.state.error = error.message || String(error);
        window.CList.ui.collectionOpening.error(error);
    } else {
        owner.state.phase = 'cancelled';
        console.error('[collection opening] expired action', error);
        window.CList.ui.collectionOpening.status('The earlier collection action expired. Reopen it to continue.');
    }
}
function assertCollectionOpening(owner, source = true) {
    if (!currentCollectionOpening(owner, source)) throw new Error('This collection action is no longer current. Reopen it before continuing.');
}
async function mountCapturedCollection(owner, col, token, encKey) {
    assertCollectionOpening(owner);
    const previous = _activeCollection;
    const target = { col, token, encKey };
    _activeCollection = target;
    const restore = () => { if (_activeCollection === target) _activeCollection = previous; };
    try {
        owner.state.phase = 'opening';
        let mounting;
        if (currentEditor === 'collection' && window.CList.ui.collectionOpening.collectionContainer()) {
            mounting = window.showCollectionEditorPanel(window.CList.ui.collectionOpening.collectionContainer());
        } else mounting = initializeEditor('collection');
        const switchId = window.CList.state.editorSwitching?.id;
        const initialized = await mounting;
        if (!currentCollectionOpening(owner, false) || switchId !== window.CList.state.editorSwitching?.id
            || owner.loadId !== window.CList.state.editorLoading?.id) { restore(); return false; }
        if (initialized === false) throw new Error('Collection editor initialization failed.');
        window.CList.ui.collectionOpening.title(col.name || col.title || '');
        if (typeof setLoadedPage === 'function') setLoadedPage(null);
        owner.state.phase = 'complete';
        return true;
    } catch (error) { restore(); throw error; }
}
async function openCapturedCollection(owner, col, token, encKey) {
    const handler = editorHandlers[owner.editor];
    const hasContent = owner.editor !== 'collection' && handler && typeof editorHasActiveContent === 'function' && editorHasActiveContent(handler);
    let choice = 'open';
    if (hasContent) {
        owner.state.phase = 'choosing';
        choice = await window.CList.ui.collectionOpening.choose(col.name || col.title, handler.label || owner.editor,
            () => currentCollectionOpening(owner));
    }
    if (choice === 'cancel') { owner.state.phase = 'cancelled'; return false; }
    assertCollectionOpening(owner);
    if (choice === 'open') return mountCapturedCollection(owner, col, token, encKey);
    owner.state.phase = 'inserting';
    const prepared = await prepareCollectionText(col, owner.editor === 'tinymce', {
        assertCurrent: () => assertCollectionOpening(owner), escape: escapeHtml,
        flatten: (items, id) => encKey ? _flattenForExport(items, id, token, encKey) : Promise.resolve(items),
    });
    assertCollectionOpening(owner);
    if (prepared.content.value) await loadContent(prepared.content);
    assertCollectionOpening(owner);
    let added = 0;
    for (const reference of prepared.references) if (pushReference(reference)) added++;
    window.CList.ui.collectionOpening.status(added ? 'References loaded — click Refs to view' : 'All references already loaded.');
    owner.state.phase = 'complete'; return true;
}
async function _loadCollectionIntoEditor(col, token, encKey, isCurrent = () => true) {
    const target = col?.key || col?.id || col?.name || col?.title || 'local';
    if (collectionOpeningState().busy && _collectionOpeningOwner?.target === target && currentCollectionOpening(_collectionOpeningOwner, false)) return false;
    const owner = captureCollectionOpening(isCurrent);
    owner.target = target;
    try {
        const captured = Array.isArray(col) ? { name: '', items: structuredClone(col) } : structuredClone(col);
        if (!Array.isArray(captured?.items)) throw new Error('This collection has no valid entries.');
        if ((token || encKey) && token !== owner.token) throw new Error('The collection session changed. Reopen the collection.');
        return await openCapturedCollection(owner, captured, token, encKey);
    } catch (error) { failCollectionOpening(owner, error); return false; }
    finally { owner.state.busy = false; }
}
async function openCollectionMember(item, col, token, encKey, isCurrent = () => true, savedPage = null) {
    if (collectionOpeningState().busy && currentCollectionOpening(_collectionOpeningOwner, false)) return false;
    const owner = captureCollectionOpening(isCurrent), view = window.CList.ui.collectionOpening;
    const sourceItem = structuredClone(item), page = savedPage ? structuredClone(savedPage) : null;
    const draft = owner.editor === 'collection' ? structuredClone(view.readDraft()) : null;
    const currentDraft = () => !draft || JSON.stringify(view.readDraft()) === JSON.stringify(draft);
    try {
        if ((token || encKey) && token !== owner.token) throw new Error('The collection session changed. Reopen the collection.');
        const prepared = await fetchCollectionMember(sourceItem, page, {
            assertCurrent: () => { assertCollectionOpening(owner); if (!currentDraft()) throw new Error('The collection draft changed while loading. Open the entry again.'); },
            canResolve: !!(token && encKey), resolve: id => _resolveCollectionById(id, token, encKey), fetch: url => fetch(url),
        });
        if (prepared.collection) return await openCapturedCollection(owner, prepared.collection, token, encKey);
        assertCollectionOpening(owner);
        if (draft) {
            _activeCollection = { ..._activeCollection,
                col: { ...(_activeCollection?.col || col || {}), name: draft.name || '', items: structuredClone(draft.items || []) }, token, encKey };
            view.returnBar(true);
        }
        owner.state.phase = 'routing';
        await loadSavedPage(prepared.content, prepared.page, null, null, () => currentCollectionOpening(owner, false));
        owner.state.phase = 'routed'; return true;
    } catch (error) { failCollectionOpening(owner, error); return false; }
    finally { owner.state.busy = false; }
}
function _openEntryForEdit(item, token, encKey, savedPage = null) {
    return openCollectionMember(item, _activeCollection?.col, token, encKey, () => true, savedPage);
}
