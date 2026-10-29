// collection-editor.js — Collection editor for the write-pane
// Part of CList, the next generation of learning and connecting with your community
//
// Depends on: utilities.js (escapeHtml, showStatusMessage, showErrorModal, parseAccountValue,
//             getSiteSpecificCookie, getAccounts), kvstore.js (getEncKey), editors.js
//             (currentEditor, initializeEditor), collection-formats.js (_collectionItemDisplayTitle,
//             _detectFormat, _collectionFormatParsers), publish.js (_saveWebPageRecord,
//             _embedWebPageIdentity, _currentAuthorDid), and collections.js (_activeCollection,
//             _resolveCollectionIdentity, _kvSaveItems, _fetchAllCollections,
//             _fetchAllPublishedPages, _wouldCreateCycle, _resolveCollectionById,
//             _loadCollectionIntoEditor — loads before this file)

let _draftItems = null;       // live reference to the editor's item array; set by _renderCollectionEditor
let _refreshEditor = null;    // callback to re-render the entry list; set by _renderCollectionEditor
let _idDisplayEl   = null;    // the UUID-display element; set by _renderCollectionEditor

// Refresh the UUID-display element from _activeCollection (collections.js) — called
// whenever Save/Publish assigns a fresh identity to a collection that didn't have one yet.
function _refreshIdDisplay() {
    if (!_idDisplayEl) return;
    const id = _activeCollection?.col?.id;
    _idDisplayEl.textContent = id ? `ID: ${id}` : 'Not yet saved — an ID will be assigned on first save.';
}

// ── Collection editor panel (rendered into the write-pane) ──

window.showCollectionEditorPanel = async function showCollectionEditorPanel(container) {
    const titleEl = document.getElementById('write-title');
    if (_activeCollection) {
        const { col, token, encKey } = _activeCollection;
        if (titleEl) titleEl.textContent = col.name || '';
        _renderCollectionEditor(container, col, token, encKey);
    } else {
        if (titleEl) titleEl.textContent = '';
        // A brand-new, never-loaded collection still needs the real session
        // token/encKey (not null) — otherwise every feature that checks them
        // (add-from-file, add-from-existing-picker, etc.) wrongly reports
        // "please log in" for a user who is in fact logged in.
        const token  = getSiteSpecificCookie(window.CList.config.flaskSiteUrl, window.CList.keys.ACCESS_TOKEN);
        const encKey = token ? await getEncKey(window.CList.config.flaskSiteUrl).catch(() => null) : null;
        _renderCollectionEditor(container, { name: '', items: [] }, token, encKey);
    }
};

// Render the main collection editor into container.
function _renderCollectionEditor(container, col, token, encKey) {
    container.innerHTML = '';
    const draftItems = col.items.map(i => ({ ...i }));
    _draftItems    = draftItems;
    _refreshEditor = null; // will be set after renderEntries is defined

    // ── UUID identity display ── so it's always visible which kvstore record
    // Save/Republish/Publish will update, regardless of the current title text.
    const idRow = document.createElement('div');
    idRow.className = 'list-tip';
    idRow.textContent = col.id ? `ID: ${col.id}` : 'Not yet saved — an ID will be assigned on first save.';
    container.appendChild(idRow);
    _idDisplayEl = idRow;

    // ── Entry list ──
    const list = document.createElement('div');
    list.className = 'collection-editor-list';
    container.appendChild(list);

    function renderEntries() {
        list.innerHTML = '';
        draftItems.forEach((item, idx) =>
            list.appendChild(_renderEntryRow(item, idx, draftItems, renderEntries, token, encKey))
        );

        // "Add entry" row — styled like a normal entry's bar (small icon
        // buttons) rather than full-size text buttons, so it reads as part
        // of the list instead of a separate action area.
        const addRow = document.createElement('div');
        addRow.className = 'collection-editor-entry collection-editor-add-row';

        const addBar = document.createElement('div');
        addBar.className = 'collection-editor-entry-bar';
        addRow.appendChild(addBar);

        const addBtn = document.createElement('button');
        addBtn.className = 'clist-action-btn';
        addBtn.title     = 'Add a blank entry';
        addBtn.innerHTML = '<span class="material-icons md-18 md-light">add</span>';
        addBtn.onclick   = () => { draftItems.push({ title: '', url: '' }); renderEntries(); };
        addBar.appendChild(addBtn);

        // Hidden file input behind the "from file" button — a recognized
        // collection export (rss/opml/json/html) becomes a nested collection,
        // same parsers used by the "Import collection" flow; anything else
        // becomes a local-only leaf entry via a blob: URL (see _addEntryFromFile).
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.style.display = 'none';
        fileInput.onchange = async () => {
            const file = fileInput.files[0];
            fileInput.value = '';
            if (!file) return;
            await _addEntryFromFile(file, draftItems, col, token, encKey, renderEntries);
        };
        addBar.appendChild(fileInput);

        const fromFileBtn = document.createElement('button');
        fromFileBtn.className = 'clist-action-btn';
        fromFileBtn.title     = 'Add entry from a file';
        fromFileBtn.innerHTML = '<span class="material-icons md-18 md-light">upload_file</span>';
        fromFileBtn.onclick   = () => fileInput.click();
        addBar.appendChild(fromFileBtn);

        const fromExistingBtn = document.createElement('button');
        fromExistingBtn.className = 'clist-action-btn';
        fromExistingBtn.title     = 'Add entry from a saved page or collection';
        fromExistingBtn.innerHTML = '<span class="material-icons md-18 md-light">library_add</span>';
        fromExistingBtn.onclick   = () => _showAddEntryFromExistingPicker(draftItems, col, token, encKey, renderEntries, fromExistingBtn);
        addBar.appendChild(fromExistingBtn);

        list.appendChild(addRow);
    }
    _refreshEditor = renderEntries;
    renderEntries();
}

// Render a single collapsible entry row.
function _renderEntryRow(item, idx, draftItems, refresh, token, encKey) {
    const row      = document.createElement('div');
    row.className  = 'collection-editor-entry';

    const bar      = document.createElement('div');
    bar.className  = 'collection-editor-entry-bar';

    const upBtn    = document.createElement('button');
    upBtn.className = 'clist-action-btn';
    upBtn.title     = 'Move up';
    upBtn.innerHTML = '<span class="material-icons md-18 md-light">arrow_upward</span>';
    upBtn.onclick   = (e) => { e.stopPropagation(); if (idx > 0) { [draftItems[idx-1], draftItems[idx]] = [draftItems[idx], draftItems[idx-1]]; refresh(); } };

    const downBtn   = document.createElement('button');
    downBtn.className = 'clist-action-btn';
    downBtn.title     = 'Move down';
    downBtn.innerHTML = '<span class="material-icons md-18 md-light">arrow_downward</span>';
    downBtn.onclick   = (e) => { e.stopPropagation(); if (idx < draftItems.length-1) { [draftItems[idx], draftItems[idx+1]] = [draftItems[idx+1], draftItems[idx]]; refresh(); } };

    const delBtn    = document.createElement('button');
    delBtn.className = 'clist-action-btn';
    delBtn.title     = 'Remove entry';
    delBtn.innerHTML = '<span class="material-icons md-18 md-light">delete_outline</span>';
    delBtn.onclick   = (e) => { e.stopPropagation(); draftItems.splice(idx, 1); refresh(); };

    const chevron   = document.createElement('span');
    chevron.className   = 'material-icons collection-editor-chevron';
    chevron.textContent = 'expand_more';

    const labelEl   = document.createElement('span');
    labelEl.className   = 'collection-editor-entry-label';
    const isNested    = item.role === 'contains' && item.collectionId;
    const isLocalLeaf  = !!item.localOnly && !!item.url && item.url.startsWith('blob:');
    const entryLabel   = () => (_collectionItemDisplayTitle(item) || '(untitled)')
        + (isNested ? ' (nested collection)' : '')
        + (isLocalLeaf ? ' (local only)' : '');
    labelEl.textContent = entryLabel();

    // "Edit" — opens this entry in its appropriate editor exactly as the
    // existing "Load into editor" / "Load into collection editor" buttons do
    // elsewhere (My Pages, collection detail view). A blank/never-populated
    // entry has nothing to open yet, so it gets no button.
    let editBtn = null;
    if (isNested || item.url) {
        editBtn = document.createElement('button');
        editBtn.className = 'clist-action-btn';
        editBtn.title     = isNested ? 'Edit nested collection' : 'Edit this page';
        editBtn.innerHTML = '<span class="material-icons md-18 md-light">edit</span>';
        editBtn.onclick   = (e) => { e.stopPropagation(); _openEntryForEdit(item, token, encKey); };
    }

    // "Publish" — only for a local-only (blob:) entry added via "+ From file".
    let publishBtn = null;
    if (isLocalLeaf) {
        publishBtn = document.createElement('button');
        publishBtn.className = 'clist-action-btn';
        publishBtn.title     = 'Publish this local page';
        publishBtn.innerHTML = '<span class="material-icons md-18 md-light">publish</span>';
        publishBtn.onclick   = (e) => { e.stopPropagation(); _publishLocalEntry(item, refresh); };
    }

    bar.appendChild(upBtn);
    bar.appendChild(downBtn);
    bar.appendChild(chevron);
    bar.appendChild(labelEl);
    if (editBtn)    bar.appendChild(editBtn);
    if (publishBtn) bar.appendChild(publishBtn);
    bar.appendChild(delBtn);

    const fields    = document.createElement('div');
    fields.className = 'collection-editor-entry-fields';
    fields.style.display = 'none';

    bar.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        const open = fields.style.display !== 'none';
        fields.style.display    = open ? 'none' : 'block';
        chevron.textContent     = open ? 'expand_more' : 'expand_less';
    });

    _renderEntryFields(item, fields, () => {
        labelEl.textContent = entryLabel();
    });

    row.appendChild(bar);
    row.appendChild(fields);
    return row;
}

// Render editable fields for a single entry. A role:'contains' item is a
// nested-collection reference, not a feed item — it has no url/author/feed/
// summary, so it only gets a Title field (plus a note identifying it).
function _renderEntryFields(item, container, onTitleChange) {
    if (item.role === 'contains' && item.collectionId) {
        const note = document.createElement('p');
        note.className   = 'feed-status-message';
        note.textContent = 'Nested collection — its items are included when this collection is exported or published.';
        container.appendChild(note);

        const wrapper = document.createElement('div');
        wrapper.className = 'collection-editor-field';
        const labelEl  = document.createElement('label');
        labelEl.textContent = 'Title';
        wrapper.appendChild(labelEl);
        const input = document.createElement('input');
        input.type      = 'text';
        input.value     = item.title || '';
        input.className = 'collection-editor-input';
        input.addEventListener('input', () => {
            item.title = input.value;
            if (onTitleChange) onTitleChange();
        });
        wrapper.appendChild(input);
        container.appendChild(wrapper);
        return;
    }

    [
        { key: 'title',       label: 'Title',       tag: 'input',    type: 'text' },
        { key: 'url',         label: 'URL',         tag: 'input',    type: 'url'  },
        { key: 'author_name', label: 'Author',      tag: 'input',    type: 'text' },
        { key: 'feed',        label: 'Feed',        tag: 'input',    type: 'url'  },
        { key: 'summary',     label: 'Description', tag: 'textarea', type: null   },
    ].forEach(({ key, label, tag, type }) => {
        const wrapper   = document.createElement('div');
        wrapper.className = 'collection-editor-field';

        const labelEl   = document.createElement('label');
        labelEl.textContent = label;
        wrapper.appendChild(labelEl);

        const input     = document.createElement(tag);
        if (type) input.type = type;
        input.value     = item[key] || '';
        input.className = 'collection-editor-input';
        input.addEventListener('input', () => {
            item[key] = input.value;
            if (key === 'title' && onTitleChange) onTitleChange();
        });
        wrapper.appendChild(input);
        container.appendChild(wrapper);
    });
}

// "+ From file" handler. A recognized collection export (rss/opml/json/html)
// is imported exactly like the existing "Import collection" flow and added as
// a nested-collection membership; anything else (plain text/markdown, or a
// file whose content doesn't actually parse as a collection) becomes a
// local-only leaf entry via a blob: URL, which the user can later Publish to
// get a real URL.
async function _addEntryFromFile(file, draftItems, col, token, encKey, refresh) {
    const format = _detectFormat(file.type, file.name);
    if (_collectionFormatParsers[format]) {
        if (!token || !encKey) {
            showStatusMessage('Please log in to add a collection file.');
            return;
        }
        try {
            const text   = await file.text();
            const parsed = _collectionFormatParsers[format](text);
            if (parsed && parsed.items && parsed.items.length) {
                const identity = _resolveCollectionIdentity(null, parsed.id);
                await _kvSaveItems(identity.key, identity.id, parsed.title || file.name, parsed.items, token, encKey);
                draftItems.push({ membershipId: crypto.randomUUID(), role: 'contains', collectionId: identity.id, title: parsed.title || file.name });
                refresh();
                showStatusMessage(`Imported "${parsed.title || file.name}" as a nested collection.`);
                return;
            }
        } catch (e) {
            console.error('[collection add-entry] file is not a recognized collection export, adding as a local page', e);
        }
    }

    const blobUrl = URL.createObjectURL(file);
    draftItems.push({
        membershipId: crypto.randomUUID(),
        title:        file.name,
        url:          blobUrl,
        mimeType:     file.type || 'text/plain',
        localOnly:    true,
    });
    refresh();
    showStatusMessage(`Added "${file.name}" as a local-only entry — use Publish to give it a real URL.`);
}

// "+ From page or collection" picker. Mirrors _showAddToCollectionPicker's
// structure/CSS but lists both saved collections and standalone published
// pages (page: kvstore records), and adds whichever one is picked as a
// membership on this entry list.
async function _showAddEntryFromExistingPicker(draftItems, col, token, encKey, refresh, anchorEl) {
    if (!token || !encKey) { showStatusMessage('Please log in to pick a saved page or collection.'); return; }

    const PICKER_CLASS = 'collection-picker';
    const pickerId      = 'collection-add-entry-picker';
    document.querySelectorAll('.' + PICKER_CLASS).forEach(el => el.remove());

    const picker = document.createElement('div');
    picker.id        = pickerId;
    picker.className = PICKER_CLASS;
    picker.innerHTML = '<p class="feed-status-message">Loading…</p>';
    anchorEl.parentElement.insertBefore(picker, anchorEl.nextSibling);

    const outsideHandler = (e) => {
        if (!picker.contains(e.target) && e.target !== anchorEl) {
            picker.remove();
            document.removeEventListener('click', outsideHandler, true);
        }
    };
    setTimeout(() => document.addEventListener('click', outsideHandler, true), 0);

    try {
        const [collections, pages] = await Promise.all([
            _fetchAllCollections(token, encKey),
            _fetchAllPublishedPages(token, encKey),
        ]);
        const candidateCollections = collections.filter(c => !col?.id || c.id !== col.id);

        picker.innerHTML = '';
        if (!candidateCollections.length && !pages.length) {
            const msg = document.createElement('p');
            msg.className   = 'feed-status-message';
            msg.textContent = 'No saved collections or published pages yet.';
            picker.appendChild(msg);
            return;
        }

        const list = document.createElement('ul');
        list.className = 'collection-picker-list';

        candidateCollections.forEach(c => {
            const li  = document.createElement('li');
            const btn = document.createElement('button');
            btn.className   = 'collection-pick-btn';
            btn.textContent = `${c.title} (collection)`;
            btn.addEventListener('click', async () => {
                try {
                    if (col?.id && await _wouldCreateCycle(col.id, c.id, token, encKey)) {
                        showErrorModal(`Can't add "${c.title}" — it already contains this collection.`);
                        return;
                    }
                    draftItems.push({ membershipId: crypto.randomUUID(), role: 'contains', collectionId: c.id, title: c.title });
                    picker.remove();
                    refresh();
                } catch (e) {
                    console.error('[collection add-entry] add collection failed', e);
                    showStatusMessage('Could not add collection: ' + e.message);
                }
            });
            li.appendChild(btn);
            list.appendChild(li);
        });

        pages.forEach(p => {
            const li  = document.createElement('li');
            const btn = document.createElement('button');
            btn.className   = 'collection-pick-btn';
            btn.textContent = p.title || p.url;
            btn.addEventListener('click', () => {
                draftItems.push({ membershipId: crypto.randomUUID(), title: p.title || p.url, url: p.url, mimeType: p.mimeType });
                picker.remove();
                refresh();
            });
            li.appendChild(btn);
            list.appendChild(li);
        });

        picker.appendChild(list);
    } catch (e) {
        console.error('[collection add-entry] picker error', e);
        picker.innerHTML = `<p class="feed-status-message">Could not load list: ${escapeHtml(e.message)}</p>`;
    }
}

// "Edit" button handler — opens an entry exactly as if it had been loaded
// directly via the Load button: a nested collection goes through
// _loadCollectionIntoEditor (same as My Pages' "Load into collection editor"),
// a leaf page's content is fetched and handed to loadSavedPage (same as the
// single-page Load button).
async function _openEntryForEdit(item, token, encKey) {
    try {
        if (item.role === 'contains' && item.collectionId) {
            if (!token || !encKey) { showStatusMessage('Please log in to open nested collections.'); return; }
            const nested = await _resolveCollectionById(item.collectionId, token, encKey);
            if (!nested) { showStatusMessage('Nested collection not found.'); return; }
            await _loadCollectionIntoEditor({ key: nested.key, id: nested.id, name: nested.title, items: nested.items }, token, encKey);
            return;
        }
        if (!item.url) { showStatusMessage('This entry has no content to open yet.'); return; }
        const resp = await fetch(item.url);
        if (!resp.ok) throw new Error(`fetch error ${resp.status}`);
        const text = await resp.text();

        // Snapshot the live, unsaved draft into _activeCollection before leaving —
        // showCollectionEditorPanel() re-renders from _activeCollection.col, so
        // without this, "Back to collection" would silently drop any edits made
        // since the last Save. _activeCollection is null for a brand-new,
        // never-saved collection, so this must set it unconditionally rather
        // than only patching an existing one.
        const liveName = document.getElementById('write-title')?.textContent?.trim();
        _activeCollection = {
            ..._activeCollection,
            col:   { ..._activeCollection?.col, name: liveName || _activeCollection?.col?.name || '', items: _draftItems || [] },
            token, encKey,
        };
        _showCollectionReturnBar(true);

        await loadSavedPage({ type: item.mimeType || 'text/plain', value: text }, null, null);
    } catch (e) {
        console.error('[collection entry] open for edit failed', e);
        showStatusMessage('Could not open for editing: ' + e.message);
    }
}

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
    if (!_activeCollection) { showStatusMessage('No collection to return to.'); return; }
    await initializeEditor('collection');
};

// "Publish" button handler for a local-only (blob:) leaf entry — reuses the
// same CListBin single-page publish pipeline as the regular "Publish" action
// elsewhere, then rewrites the entry's url to the real published URL and
// clears localOnly so it's eligible for export/share/Collab going forward.
async function _publishLocalEntry(item, refresh) {
    if (!item.url || !item.url.startsWith('blob:')) return;
    try {
        const adapter = window.CList.binPublishers?.['CListBin'];
        if (!adapter) { showStatusMessage('Web-page publishing is not available.'); return; }

        let accounts = window.CList.accounts;
        if (!Array.isArray(accounts) || accounts.length === 0) {
            accounts = window.CList.accounts = await getAccounts(window.CList.config.flaskSiteUrl);
        }
        const binAccount = accounts.map(parseAccountValue).filter(Boolean)
            .find(v => v.type === 'CListBin' && (v.permissions || '').includes('b'));
        if (!binAccount) { showStatusMessage('No web-page destination set up yet — log out and back in to add one.'); return; }

        const resp = await fetch(item.url);
        if (!resp.ok) throw new Error(`blob fetch error ${resp.status}`);
        const rawContent = await resp.text();
        const mimeType    = item.mimeType || 'text/plain';
        const id          = `urn:uuid:${crypto.randomUUID()}`;
        const content     = _embedWebPageIdentity(rawContent, mimeType, item.title, id);

        const result = await adapter.publish(content, mimeType, item.title || 'Untitled', binAccount);

        const publishedAt = new Date().toISOString();
        await _saveWebPageRecord({
            id, title: item.title || 'Untitled', url: result.url, serviceId: result.serviceId,
            service: 'CListBin', mimeType, accountInstance: binAccount.instance, publishedAt,
            authorDid: _currentAuthorDid(),
        });

        URL.revokeObjectURL(item.url);
        item.url       = result.url;
        item.localOnly = false;
        showStatusMessage(`Published "${item.title}".`);
        refresh();
    } catch (e) {
        console.error('[collection entry] publish failed', e);
        showStatusMessage('Could not publish: ' + e.message);
    }
}

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
        visible:        () => typeof isRegistered === 'function' && isRegistered(),
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
    };
})();
