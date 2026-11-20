/// <reference path="./clist-types.js" />
// Collection entry file/import picker controller. Draft captures and sessions stay private.
let _collectionEntryPicker = null;
const _collectionEntryFileOperations = new WeakSet();
function captureCollectionEntryDraft(draftItems, isCurrent = () => true) {
    const storeUrl = window.CList.config.flaskSiteUrl;
    const owner = { draftItems, isCurrent, editor: currentEditor,
        account: typeof currentEditorAccount === 'undefined' ? null : currentEditorAccount,
        page: currentLoadedPage, storeUrl, username: window.CList.state.username,
        token: getSiteSpecificCookie(storeUrl, window.CList.keys.ACCESS_TOKEN),
        controls: window.CList.state.editorControls?.id, loading: window.CList.state.editorLoading?.id, switching: window.CList.state.editorSwitching?.id };
    owner.current = () => owner.isCurrent() && currentEditor === owner.editor && currentEditor === 'collection'
        && currentLoadedPage === owner.page && owner.account === (typeof currentEditorAccount === 'undefined' ? null : currentEditorAccount)
        && (typeof _draftItems === 'undefined' || _draftItems === owner.draftItems)
        && window.CList.state.username === owner.username && window.CList.config.flaskSiteUrl === owner.storeUrl
        && getSiteSpecificCookie(owner.storeUrl, window.CList.keys.ACCESS_TOKEN) === owner.token
        && window.CList.state.editorControls?.id === owner.controls && window.CList.state.editorLoading?.id === owner.loading
        && window.CList.state.editorSwitching?.id === owner.switching;
    owner.assert = () => { if (!owner.current()) throw new Error('The collection draft is no longer current. Reopen its entry controls.'); };
    return owner;
}
async function _addEntryFromFile(file, draftItems, col, token, encKey, refresh, editTargets) {
    if (_collectionEntryFileOperations.has(draftItems)) return false;
    _collectionEntryFileOperations.add(draftItems);
    const view = window.CList.ui.collectionEntries;
    try {
        const owner = captureCollectionEntryDraft(draftItems);
        const prepared = await prepareCollectionEntryFile(file, col, {
            assertCurrent: owner.assert, recognize: recognizeSavedContent, canPersist: !!(token && encKey),
            identity: id => _resolveCollectionIdentity(null, id),
            wouldCycle: (parent, child) => _wouldCreateCycle(parent, child, token, encKey),
            save: async (key, record) => {
                owner.assert();
                const session = beginCollectionSession({ token, encKey, isCurrent: owner.current });
                assertCollectionSession(session);
                return saveCollectionRecord(key, record, collectionDependencies(session), { createOnly: true });
            },
        });
        owner.assert();
        if (prepared.local) {
            const url = URL.createObjectURL(file);
            draftItems.push({ membershipId: crypto.randomUUID(), title: prepared.title, url, mimeType: prepared.mimeType, localOnly: true });
            refresh(); view.status(`Added "${file.name}" as a local-only entry — use Publish to give it a real URL.`);
        } else {
            draftItems.push({ membershipId: crypto.randomUUID(), role: 'contains', collectionId: prepared.collectionId, title: prepared.title });
            editTargets?.collections.add(prepared.collectionId); refresh(); view.status(`Imported "${prepared.title}" as a nested collection.`);
        }
        return true;
    } catch (error) { view.error(error); return false; }
    finally { _collectionEntryFileOperations.delete(draftItems); }
}
async function _showAddEntryFromExistingPicker(draftItems, col, token, encKey, refresh, anchorEl, editTargets) {
    const ui = window.CList.ui.collectionEntries;
    let owner, view;
    try {
        if (!token || !encKey) throw new Error('Please log in to pick a saved page or collection.');
        owner = captureCollectionEntryDraft(draftItems); owner.assert();
        const session = beginCollectionSession({ token, encKey, isCurrent: owner.current }); assertCollectionSession(session);
        _collectionEntryPicker = owner; view = ui.picker(anchorEl); owner.view = view;
        const current = () => owner.current() && _collectionEntryPicker === owner && view.root.isConnected;
        const assertCurrent = () => { if (!current()) throw new Error('The entry picker is no longer current.'); assertCollectionSession(session); };
        ui.message(view, 'Loading…');
        const records = await listCollectionEntryTargets(col, { assertCurrent,
            collections: () => _fetchAllCollections(token, encKey), pages: () => _fetchAllPublishedPages(token, encKey) });
        assertCurrent();
        let busy = false;
        ui.render(view, records, async selected => {
            if (!current() || busy) return;
            busy = true; ui.busy(view, true);
            try {
                const target = { kind: selected.kind, record: structuredClone(selected.record) };
                const entry = await prepareExistingCollectionEntry(target, col, { assertCurrent,
                    cycle: (parent, child) => _wouldCreateCycle(parent, child, token, encKey) });
                assertCurrent();
                draftItems.push({ membershipId: crypto.randomUUID(), ...entry });
                if (target.kind === 'collection') editTargets?.collections.add(entry.collectionId);
                else editTargets?.pages.set(entry.url, target.record);
                ui.close(view); refresh();
            } catch (error) { if (current()) ui.message(view, error.message || String(error), true); ui.error(error); }
            finally { busy = false; if (current()) ui.busy(view, false); }
        });
    } catch (error) {
        if (owner?.current() && view?.root.isConnected) ui.message(view, error.message || String(error), true);
        ui.error(error);
    }
}
