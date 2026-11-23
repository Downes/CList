/// <reference path="./clist-types.js" />
// collection-editor.js — Collection editor for the write-pane
// Part of CList, the next generation of learning and connecting with your community
//
// Depends on: utilities.js (escapeHtml, showStatusMessage, showErrorModal, parseAccountValue,
//             getSiteSpecificCookie, getAccounts), kvstore.js (getEncKey), editors.js
//             (currentEditor, initializeEditor), collection-formats.js (_collectionItemDisplayTitle,
//             _detectFormat, _collectionFormatParsers), collection-entry-publishing.js
//             (_publishLocalEntry, resolved when clicked), and collections.js (_activeCollection,
//             _resolveCollectionIdentity, _kvSaveItems, _fetchAllCollections,
//             _fetchAllPublishedPages, _wouldCreateCycle, _resolveCollectionById,
//             _loadCollectionIntoEditor — loads before this file)

let _draftItems = null;       // live reference to the editor's item array; set by _renderCollectionEditor
let _refreshEditor = null;    // callback to re-render the entry list; set by _renderCollectionEditor
let _idDisplayEl   = null;    // the UUID-display element; set by _renderCollectionEditor

// Read editor controls at the view boundary; save operations consume data.
/** @returns {CListCollectionSaveFields} */
function readCollectionSaveFields() {
    return {
        name: document.getElementById('write-title')?.textContent || '',
        formatId: document.getElementById('write-format')?.value || 'rss',
    };
}

// View interface used by the save controller to preserve the current draft.
// A different editor's controls must never become the collection's title/body.
function readActiveCollectionDraft() {
    if (currentEditor !== 'collection') return null;
    return { name: readCollectionSaveFields().name.trim(), items: _draftItems || [] };
}

// Refresh the UUID-display element from _activeCollection (collections.js) — called
// whenever Save/Publish assigns a fresh identity to a collection that didn't have one yet.
function _refreshIdDisplay() {
    if (!_idDisplayEl) return;
    const id = _activeCollection?.col?.id;
    // Save/publication replace metadata objects without replacing this live draft.
    const binding = _collectionDraftBinding;
    if (binding && binding.items === _draftItems && binding.source()
        && (!binding.active?.col?.id || binding.active.col.id === id)) binding.active = _activeCollection;
    _idDisplayEl.textContent = id ? `ID: ${id}` : 'Not yet saved — an ID will be assigned on first save.';
}

// ── Collection editor panel (rendered into the write-pane) ──

let _collectionDraftMount = 0;
window.showCollectionEditorPanel = async function showCollectionEditorPanel(container) {
    _collectionDraftController?.dispose();
    const mount = ++_collectionDraftMount, active = _activeCollection, source = captureCollectionDraftSource();
    const current = () => mount === _collectionDraftMount && active === _activeCollection && source() && container.isConnected;
    const titleEl = document.getElementById('write-title');
    if (_activeCollection) {
        const { col, token, encKey } = _activeCollection;
        if (titleEl) titleEl.textContent = col.name || '';
        const targets = await _collectionEditTargets(token, encKey, current);
        if (!current()) return false;
        _renderCollectionEditor(container, col, token, encKey, targets);
    } else {
        if (titleEl) titleEl.textContent = '';
        // A brand-new, never-loaded collection still needs the real session
        // token/encKey (not null) — otherwise every feature that checks them
        // (add-from-file, add-from-existing-picker, etc.) wrongly reports
        // "please log in" for a user who is in fact logged in.
        const token  = getSiteSpecificCookie(window.CList.config.flaskSiteUrl, window.CList.keys.ACCESS_TOKEN);
        let encKey = null;
        try { if (token) encKey = await getEncKey(window.CList.config.flaskSiteUrl); }
        catch (error) {
            console.error('[collection draft] credentials unavailable', error);
            if (current()) showStatusMessage('Could not read collection credentials. Local editing is available; reopen to retry.');
        }
        const targets = await _collectionEditTargets(token, encKey, current);
        if (!current()) return false;
        _renderCollectionEditor(container, { name: '', items: [] }, token, encKey, targets);
    }
};

// Ownership comes from this user's saved records, never from a resource's URL.
async function _collectionEditTargets(token, encKey, isCurrent = () => true) {
    const targets = { pages: new Map(), collections: new Set() };
    if (!token || !encKey) return targets;
    try {
        const [pages, collections] = await Promise.all([
            _fetchAllPublishedPages(token, encKey), _fetchAllCollections(token, encKey),
        ]);
        pages.forEach(page => { if (page.url) targets.pages.set(page.url, page); });
        collections.forEach(collection => { if (collection.id) targets.collections.add(collection.id); });
    } catch (error) {
        console.error('Could not identify editable collection resources:', error);
        if (isCurrent()) showStatusMessage('Could not identify editable resources. Reopen the collection to retry.');
    }
    return targets;
}

function _collectionResourceHasEditor(mimeType) {
    return Object.values(editorHandlers).some(handler => typeof handler.initialize === 'function'
        && (handler.contentTypes || []).includes(mimeType));
}

// Bind existing Save/import/publication APIs to one captured draft controller.
let _collectionDraftController = null;
let _collectionDraftBinding = null;
function _renderCollectionEditor(container, col, token, encKey, editTargets = { pages: new Map(), collections: new Set() }) {
    _collectionDraftController?.dispose();
    const source = captureCollectionDraftSource();
    const binding = { active: _activeCollection, source, items: null };
    const view = createCollectionDraftView(container, col);
    let controller;
    controller = createCollectionDraftController(col, {
        isCurrent: () => _collectionDraftController === controller && _draftItems === controller.items
            && _activeCollection === binding.active && source(),
        targets: editTargets, hasEditor: _collectionResourceHasEditor,
        present: state => { window.CList.state.collectionDraft = state; },
        open: (item, page) => _openEntryForEdit(item, token, encKey, page),
        publish: (item, refresh) => _publishLocalEntry(item, refresh),
        browse: url => openInBrowser(url),
        file: (file, items, refresh) => _addEntryFromFile(file, items, col, token, encKey, refresh, editTargets),
        existing: (items, refresh, anchor) => _showAddEntryFromExistingPicker(items, col, token, encKey, refresh, anchor, editTargets),
        log: error => console.error('[collection draft]', error),
    }, view);
    _collectionDraftController = controller; _draftItems = controller.items;
    binding.items = controller.items; _collectionDraftBinding = binding;
    _refreshEditor = controller.refresh; _idDisplayEl = view.identity;
    _refreshIdDisplay(); controller.refresh();
    return controller;
}
function captureCollectionDraftSource() {
    const state = window.CList.state, store = window.CList.config.flaskSiteUrl;
    const source = [currentEditor, typeof currentEditorAccount === 'undefined' ? null : currentEditorAccount,
        state.username, state.authEpoch, store, getSiteSpecificCookie(store, window.CList.keys.ACCESS_TOKEN)];
    return () => {
        const now = window.CList.state;
        return source.every((value, index) => value === [currentEditor,
            typeof currentEditorAccount === 'undefined' ? null : currentEditorAccount,
            now.username, now.authEpoch, window.CList.config.flaskSiteUrl,
            getSiteSpecificCookie(store, window.CList.keys.ACCESS_TOKEN)][index]);
    };
}

// "+ From file" handler. A recognized collection export (rss/opml/json/html)
// is imported exactly like the existing "Import collection" flow and added as
// a nested-collection membership; anything else (plain text/markdown, or a
// file whose content doesn't actually parse as a collection) becomes a
// local-only leaf entry via a blob: URL, which the user can later Publish to
// get a real URL.
// "Edit" button handler — opens an entry exactly as if it had been loaded
// directly via the Load button: a nested collection goes through
// _loadCollectionIntoEditor (same as My Pages' "Load into collection editor"),
// a leaf page's content is fetched and handed to loadSavedPage (same as the
// single-page Load button).
// Shows/hides the "Back to collection" bar at the top of the write pane —
// set by _openEntryForEdit before leaving the collection editor for a member's
// own editor, and cleared whenever the collection editor becomes current again
// (see initialize() below).
function _showCollectionReturnBar(show) {
    const bar = document.getElementById('collection-return-bar');
    if (bar) bar.style.display = show ? '' : 'none';
}

// "Back to collection" button handler — returns to the collection editor,
// restoring exactly what was on screen (via the _activeCollection snapshot
// taken in _openEntryForEdit) rather than the last-saved version.
window.backToCollectionEditor = async function backToCollectionEditor() {
    if (!_activeCollection) { showErrorModal('No collection to return to.', { title: 'Nothing to return to' }); return; }
    await initializeEditor('collection');
};

(function () {
    if (typeof editorHandlers === 'undefined') {
        console.error('editorHandlers is not defined — collection-editor.js must load after editors.js');
        return;
    }

    editorHandlers['collection'] = {
        label:          'Collection',
        icon:           'playlist_add',
        contentTypes:   [],
        requiresAccount: false,
        // No visible() gate — the collection editor itself is purely local (build/edit
        // a list of items in memory); it needs no kvstore account. Actions that DO
        // need one (saving/publishing a collection to kvstore) already check
        // isRegistered()/the access token themselves and show their own message.
        formats: Object.entries(collectionFormats).map(([id, f]) => ({ id, label: f.label })),

        initialize: async () => {
            currentEditor = 'collection';

            // Whether we got here via "Back to collection" or by switching to it
            // any other way, the bar no longer applies once we're actually here.
            if (typeof _showCollectionReturnBar === 'function') _showCollectionReturnBar(false);

            const writeTagsEl = document.getElementById('write-tags');
            if (writeTagsEl) writeTagsEl.style.display = 'none';

            const writePaneContent = window.CList.ui.view.writePaneContent;
            let div = document.getElementById('collectionEditorDiv');
            if (!div) {
                div = document.createElement('div');
                div.id = 'collectionEditorDiv';
                writePaneContent.appendChild(div);
            }
            div.style.display = 'block';

            if (typeof window.showCollectionEditorPanel === 'function') {
                await window.showCollectionEditorPanel(div);
            } else {
                div.innerHTML = '<p class="feed-status-message">Collection editor not available.</p>';
            }
        },

        // Reflects the live draft so editorHasActiveContent() (editors.js) can
        // correctly detect unsaved collection items — _draftItems is the global
        // set by _renderCollectionEditor above.
        getContent: () => (typeof _draftItems !== 'undefined' && _draftItems && _draftItems.length)
            ? JSON.stringify(_draftItems)
            : '',

        loadContent: () => {},

        // The insert_link-vs-via distinction is handled entirely by which reference object
        // the dispatch site passes in — addItemToCollectionEditor only ever reads off the
        // reference itself, regardless of how it arrived.
        insertLink: ({ reference }) => {
            if (typeof window.addItemToCollectionEditor === 'function') window.addItemToCollectionEditor(reference);
        },
        insertLinkVia: ({ reference }) => {
            if (typeof window.addItemToCollectionEditor === 'function') window.addItemToCollectionEditor(reference);
        },
    };
})();
