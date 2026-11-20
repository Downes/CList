/// <reference path="./clist-types.js" />
// Captured Dropbox file browsing/loading. Bodies and session values remain private.
let _dropboxPickerOwner = null;
/** @returns {CListDropboxLoadState} */
function beginDropboxPickerState(previous) {
    return { generation: (previous?.generation || 0) + 1, phase: 'listing', busy: true, count: 0, selected: null, error: null };
}
async function listDropboxPickerFiles(deps) {
    deps.assertCurrent();
    let listing = await deps.list();
    const files = new Map(), cursors = new Set();
    while (true) {
        deps.assertCurrent();
        // Folder pages are an ordered stream of changes, not independent snapshots.
        // Apply later updates/deletions to the same case-insensitive Dropbox path.
        for (const entry of listing.entries || []) {
            const path = (entry.path_lower || entry.path_display || '').toLowerCase();
            if (!path) continue;
            if (entry['.tag'] === 'file') files.set(path, entry);
            else if (entry['.tag'] === 'deleted' || entry['.tag'] === 'folder') files.delete(path);
        }
        if (!listing.has_more) break;
        if (!listing.cursor || cursors.has(listing.cursor)) throw new Error('Dropbox returned an invalid folder cursor.');
        cursors.add(listing.cursor);
        listing = await deps.next(listing.cursor);
    }
    return [...files.values()].sort((a, b) => (b.server_modified || '').localeCompare(a.server_modified || ''));
}
function dropboxPickerError(error) {
    return error?.missingScope || /missing_scope|not permitted/i.test(error?.message || '')
        ? 'Missing permission — enable files.content.read in your Dropbox App Console, submit the change, then re-authorize CList from Accounts.'
        : error?.message || String(error);
}
function currentDropboxPicker(owner, source = true) {
    if (_dropboxPickerOwner !== owner || owner.closed) return false;
    try { assertDropboxSession(owner.capture); } catch { return false; }
    if (owner.controlsId !== window.CList.state.editorControls?.id) return false;
    return !source || (owner.view.root.isConnected && owner.editor === currentEditor && owner.page === currentLoadedPage
        && owner.account === (typeof currentEditorAccount === 'undefined' ? null : currentEditorAccount)
        && owner.switchId === window.CList.state.editorSwitching?.id && owner.loadId === window.CList.state.editorLoading?.id);
}
function settleDropboxPicker(owner, phase) {
    if (owner.settled) return;
    owner.settled = true; owner.observer?.disconnect();
    if (_dropboxPickerOwner === owner) {
        owner.state.phase = phase; owner.state.busy = false;
    }
    owner.resolve(null);
}
function cancelDropboxPicker(owner, remove = true) {
    if (owner.closed) return;
    owner.closed = true;
    settleDropboxPicker(owner, 'cancelled');
    if (remove && owner.view) window.CList.ui.dropboxPicker.close(owner.view);
}
function renderDropboxPicker(owner) {
    if (!currentDropboxPicker(owner)) { cancelDropboxPicker(owner); return; }
    const generation = ++owner.renderGeneration;
    window.CList.ui.dropboxPicker.files(owner.view, owner.files, owner.state.busy,
        owner.selected, file => {
            if (owner.renderGeneration === generation) return selectDropboxPickerFile(owner, file);
        }, owner.state.error);
}
async function selectDropboxPickerFile(owner, selected) {
    if (!currentDropboxPicker(owner)) { cancelDropboxPicker(owner); return; }
    if (owner.state.busy || !owner.files.includes(selected)) return;
    owner.state.busy = true; owner.state.phase = 'downloading'; owner.state.selected = selected.name; owner.state.error = null;
    owner.selected = selected; renderDropboxPicker(owner);
    try {
        const file = structuredClone(selected);
        const text = await owner.client.call(token => _dropboxDownloadFile(token, file.path_display || file.path_lower));
        if (!currentDropboxPicker(owner)) { cancelDropboxPicker(owner); return; }
        const content = restorePostContent(text, '', file.name);
        owner.routing = true; owner.observer?.disconnect();
        await loadSavedPage(content, content.page, owner.view.root,
            () => { if (currentDropboxPicker(owner, false)) return populateLoadOptions(); },
            () => currentDropboxPicker(owner, false));
        settleDropboxPicker(owner, 'routed');
    } catch (error) {
        console.error('[Dropbox picker] load failed', error);
        if (!currentDropboxPicker(owner)) { cancelDropboxPicker(owner); return; }
        owner.routing = false; owner.state.busy = false; owner.state.phase = 'failed'; owner.state.error = 'Load failed: ' + dropboxPickerError(error);
        renderDropboxPicker(owner);
    }
}
function loadDropboxFiles() {
    if (_dropboxPickerOwner) cancelDropboxPicker(_dropboxPickerOwner);
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    const state = window.CList.state.dropboxLoading = beginDropboxPickerState(window.CList.state.dropboxLoading);
    const owner = _dropboxPickerOwner = { state, resolve, settled: false, closed: false, routing: false, files: [], renderGeneration: 0,
        editor: currentEditor, page: currentLoadedPage,
        account: typeof currentEditorAccount === 'undefined' ? null : currentEditorAccount,
        controlsId: window.CList.state.editorControls?.id, switchId: window.CList.state.editorSwitching?.id,
        loadId: window.CList.state.editorLoading?.id };
    const view = window.CList.ui.dropboxPicker;
    try {
        owner.capture = captureDropboxSession(findAccountByType('Dropbox'));
        owner.view = view.mount(() => cancelDropboxPicker(owner));
        view.message(owner.view, 'Loading Dropbox files…');
        owner.client = createDropboxRequestClient(owner.capture, message => {
            if (currentDropboxPicker(owner)) view.message(owner.view, message);
        });
        if (typeof MutationObserver !== 'undefined') {
            owner.observer = new MutationObserver(() => {
                if (!owner.routing && !currentDropboxPicker(owner)) cancelDropboxPicker(owner);
            });
            owner.observer.observe(document.body, { childList: true, subtree: true, attributes: true });
        }
        const assertCurrent = () => {
            if (!currentDropboxPicker(owner)) throw new Error('The Dropbox picker is no longer current.');
        };
        listDropboxPickerFiles({ assertCurrent,
            list: () => owner.client.call(token => _dropboxListFolder(token, owner.capture.data.folder)),
            next: cursor => owner.client.call(token => _dropboxContinueFolder(token, cursor)),
        }).then(files => {
            if (!currentDropboxPicker(owner)) { cancelDropboxPicker(owner); return; }
            owner.files = files; state.count = files.length; state.phase = 'ready'; state.busy = false;
            if (!files.length) {
                view.message(owner.view, 'No files found in ' + (owner.capture.data.folder || '/CList') + '.');
                settleDropboxPicker(owner, 'empty');
            } else renderDropboxPicker(owner);
        }).catch(error => {
            console.error('[Dropbox picker] list failed', error);
            if (!currentDropboxPicker(owner)) { cancelDropboxPicker(owner); return; }
            state.error = 'Could not list Dropbox files: ' + dropboxPickerError(error);
            view.message(owner.view, state.error, true); settleDropboxPicker(owner, 'failed');
        });
    } catch (error) {
        state.error = error?.message || String(error); view.error(error); settleDropboxPicker(owner, 'failed');
    }
    return promise;
}
window.CList.loaders ||= [];
window.CList.loaders.push({ label: 'Load from Dropbox', logoSrc: 'assets/icons/dropbox.svg',
    requiresLogin: true, requiresAccount: true,
    visible: () => typeof isRegistered === 'function' && isRegistered() && !!findAccountByType('Dropbox'),
    load: loadDropboxFiles });
