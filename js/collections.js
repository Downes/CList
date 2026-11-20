/// <reference path="./clist-types.js" />
console.log('[collections] collections.js loading');
// collections.js — kvstore-backed collections for CList
// Depends on: utilities.js (escapeHtml, getSiteSpecificCookie, showStatusMessage),
//             kvstore.js (getEncKey), crypto_utils.js (encryptWithKey, decryptWithKey),
//             editors.js (currentEditor), tinymce.js (displayReferences),
//             collection-editor.js (_renderCollectionEditor, _showCollectionReturnBar —
//             editor-rendering layer; loads after this file but only called at runtime)
// window.CList.config.flaskSiteUrl is a global set in index.html

// ── Collections ──────────────────────────────────────────────────────────────
// Items are saved directly to kvstore under keys collection:<name>.
// Collection names are restricted to letters, digits, #, -, _, and spaces.

const _COLLECTION_NAME_RE = /^[a-zA-Z0-9#\-_ ]+$/;

let _collectionsPopstateHandler = null;
let _activeCollection = null; // set by load button; read by showCollectionEditorPanel

// Called from collect buttons on all feed item types.
window.collectItem = function(itemId, opts) {
    _showCollectionPicker(itemId, opts);
};

async function _showCollectionPicker(itemId, opts = {}) {
    const PICKER_CLASS = 'collection-picker';
    const pickerId     = `collection-picker-${itemId}`;

    // Toggle: if this picker is already open, close it
    const existing = document.getElementById(pickerId);
    document.querySelectorAll('.' + PICKER_CLASS).forEach(el => el.remove());
    if (existing) return;

    const token = getSiteSpecificCookie(window.CList.config.flaskSiteUrl, window.CList.keys.ACCESS_TOKEN);
    if (!token) { showErrorModal('Please log in to save to a collection.', { title: 'Login required' }); return; }

    const specificEl = document.getElementById(itemId);
    if (!specificEl) return;
    const statusBox = specificEl.closest('.status-box');
    if (!statusBox?.parentElement) return;

    const picker = document.createElement('div');
    picker.id        = pickerId;
    picker.className = PICKER_CLASS + (opts.glow ? ' collection-picker-glow' : '');
    picker.innerHTML = '<p class="feed-status-message">Loading collections…</p>';
    statusBox.parentElement.insertBefore(picker, statusBox.nextSibling);

    try {
        const encKey = await getEncKey(window.CList.config.flaskSiteUrl);
        if (!encKey) throw new Error('Encryption key not available — please log in again.');

        const collections = await _fetchAllCollections(token, encKey);

        picker.innerHTML = '';
        _buildCollectionPickerContents(picker, collections, async (title, col) => {
            try {
                const items         = col ? col.items : [];
                const publishedUrls = col ? col.publishedUrls : [];
                const specificEl = document.getElementById(itemId);
                const ref   = specificEl?.reference || {};
                const url   = ref.url   || '';
                const itemTitle = ref.title || url || itemId;
                // Duplicate memberships are allowed (e.g. the same track twice in a
                // playlist) — each membership gets its own id, so this is just a nudge.
                const alreadyIn = url && items.some(i => i.url === url);
                items.push({ membershipId: crypto.randomUUID(), id: itemId, title: itemTitle, url, ...ref });
                const identity = col ? _resolveCollectionIdentity(col.key, col.id) : _newCollectionIdentity();
                await _kvSaveItems(identity.key, identity.id, title, items, token, encKey, publishedUrls);
                document.getElementById(`collect-btn-${itemId}`)?.classList.add('action-active');
                picker.remove();
                showStatusMessage(alreadyIn ? `Already in "${title}" — added again.` : `Added to "${title}".`);
            } catch (e) {
                console.error('[collection] add failed', e);
                showErrorModal('Could not add to collection: ' + e.message, { title: 'Add to collection failed' });
            }
        }, document.getElementById(`collect-btn-${itemId}`));

    } catch (e) {
        console.error('[collection] picker error', e);
        picker.innerHTML = `<p class="feed-status-message">Could not load collections: ${e.message}</p>`;
    }
}

// Normalize a decrypted collection value — handles the old (bare array), the
// pre-UUID ({ items, publishedUrls }), and the current ({ id, title, items,
// publishedUrls }) formats.
// Generate a fresh UUID v4 primary key for a brand-new collection. The kvstore
// key stays a bare UUID (matching the existing page:${uuid} convention); id is
// the same UUID formatted as a urn:uuid: string for display and for the
// decrypted value's own id field.
function _newCollectionIdentity() {
    const uuid = crypto.randomUUID();
    return { key: `collection:${uuid}`, id: `urn:uuid:${uuid}` };
}

// A collection only has a real identity once it has a urn:uuid `id`. A legacy
// collection (saved before this scheme, kvstore-keyed by its old name) has a
// key but no id — it gets a fresh UUID identity too, same as a brand-new one.
// Called on Save AND on Publish, so an unsaved or legacy collection is assigned
// an identity the first time either action touches it. `key` may be omitted
// when `id` was just detected from imported content (Part B) and never had a
// kvstore key of its own — the key is then derived from the id's own uuid, so
// a re-imported page lands back on the same kvstore record it would have used
// originally, not a mismatched new one.
function _resolveCollectionIdentity(key, id) {
    if (!id) return _newCollectionIdentity();
    return { key: key || `collection:${id.replace(/^urn:uuid:/, '')}`, id };
}

// Fetches and decrypts all of the user's saved collections — shared by the
// nesting feature's lookups (add-to-collection picker, cycle guard, export
// flattening). Kept separate from the similar fetch/decrypt loops in
// _showCollectionPicker/showSavedCollections/importCollectionFromChat (each
// of those needs a slightly different parsed shape) rather than refactoring
// those pre-existing call sites.
async function _fetchAllCollections(token, encKey) {
    const records = await fetchDecryptedKvRecordsByPrefix('collection:', encKey);
    return records.map(({ key, value }) => {
        const colData = _parseCollectionData(value);
        return { key, id: colData.id, title: colData.title || key.replace(/^collection:/, ''), items: colData.items, publishedUrls: colData.publishedUrls };
    });
}

// Fetches all standalone published pages (kvstore `page:` records) — the
// leaf-page half of the collection editor's "+ From page or collection"
// picker. Mirrors _fetchAllCollections but for page: records.
async function _fetchAllPublishedPages(token, encKey) {
    const records = await fetchDecryptedKvRecordsByPrefix('page:', encKey);
    return records.map(({ key, value }) => ({ pageKey: key, ...value }));
}

// Finds one collection by its urn:uuid id (as stored in a role:'contains'
// membership's collectionId). A collection with no id yet (never saved) can't
// be nested into another, so there's nothing to resolve for it.
async function _resolveCollectionById(id, token, encKey) {
    if (!id) return null;
    const collections = await _fetchAllCollections(token, encKey);
    return collections.find(c => c.id === id) || null;
}

// Would adding childId as a role:'contains' member of parentId create a
// cycle? Walks childId's own containment graph looking for parentId — if
// found, parentId is already (transitively) inside childId, so parentId ->
// childId would close a loop. This is a plain reachability search (does any
// path from childId to parentId exist), so a single shared `visited` set is
// correct and avoids re-walking a branch once it's been fully explored —
// unlike the read-time traversal guard below, which needs an ancestor-stack
// because it must still expand a legitimately-shared sub-collection reached
// twice via different branches.
async function _wouldCreateCycle(parentId, childId, token, encKey, visited) {
    visited = visited || new Set();
    if (parentId === childId) return true;
    if (visited.has(childId)) return false;
    visited.add(childId);

    const child = await _resolveCollectionById(childId, token, encKey);
    if (!child) return false;

    for (const item of (child.items || [])) {
        if (item.role !== 'contains' || !item.collectionId) continue;
        if (item.collectionId === parentId) return true;
        if (await _wouldCreateCycle(parentId, item.collectionId, token, encKey, visited)) return true;
    }
    return false;
}

// Recursively replaces role:'contains' stub items with their nested
// collection's real leaf items, for export/publish — the six collectionFormats
// serializers already filter to `i.url`, so this is the only place nesting
// needs to be taught to the export path. Uses an ancestor-stack (not a global
// visited set): only an id on the *current* path is a true cycle, so the same
// sub-collection reached via two different branches is still expanded both
// times, matching the read-time rule in docs/collection-conceptual-model.
async function _flattenForExport(items, rootId, token, encKey, ancestors) {
    ancestors = ancestors || new Set(rootId ? [rootId] : []);
    const out = [];
    for (const item of items) {
        if (item.role !== 'contains') {
            // blob: urls are session-local (see _addEntryFromFile) and meaningless
            // outside the current tab — never let one leak into an export/publish.
            if (item.url && !item.url.startsWith('blob:')) out.push(item);
            continue;
        }
        if (!item.collectionId) continue;
        if (ancestors.has(item.collectionId)) {
            console.error('[collection export] cycle detected — skipping nested collection', item.collectionId);
            continue;
        }
        const nested = await _resolveCollectionById(item.collectionId, token, encKey);
        if (!nested) { console.error('[collection export] nested collection not found:', item.collectionId); continue; }
        const childAncestors = new Set(ancestors);
        childAncestors.add(item.collectionId);
        out.push(...await _flattenForExport(nested.items || [], rootId, token, encKey, childAncestors));
    }
    return out;
}

// Encrypt items and upsert to kvstore under an explicit key via storage.kv.put().
// Collections are identified by this key, not by title — renaming the title and
// saving must always target the same key.
async function _kvSaveItems(key, id, title, items, token, encKey, publishedUrls = []) {
    const encrypted = await encryptWithKey(encKey, JSON.stringify({ id, title, items, publishedUrls }));
    try {
        await window.CList.storage.kv.put(key, encrypted);
    } catch (err) {
        throw new Error(kvErrorMessage(err));
    }
}

// Populate a .collection-picker div with existing collection buttons + new-name row.
// onSelect(name, encValue) is called when the user picks or creates a collection.
// anchorEl is excluded from the outside-click handler (pass null if not needed).
function _buildCollectionPickerContents(picker, collections, onSelect, anchorEl) {
    dismissOnOutsideClick(picker, anchorEl);

    if (!collections.length) {
        const msg = document.createElement('p');
        msg.className   = 'feed-status-message';
        msg.textContent = 'No collections yet — create one below.';
        picker.appendChild(msg);
    } else {
        const list = document.createElement('ul');
        list.className = 'collection-picker-list';
        for (const col of collections) {
            const li  = document.createElement('li');
            const btn = document.createElement('button');
            btn.className   = 'collection-pick-btn';
            btn.textContent = col.title;
            btn.addEventListener('click', () => onSelect(col.title, col));
            li.appendChild(btn);
            list.appendChild(li);
        }
        picker.appendChild(list);
    }

    const newRow    = document.createElement('div');
    newRow.className = 'collection-picker-new';
    const nameInput = document.createElement('input');
    nameInput.type        = 'text';
    nameInput.className   = 'input-field';
    nameInput.placeholder = 'New collection name…';
    nameInput.maxLength   = 50;
    const createBtn = document.createElement('button');
    createBtn.className   = 'btn-small';
    createBtn.textContent = 'Create & add';
    createBtn.addEventListener('click', () => {
        const name = nameInput.value.trim();
        if (!name) { showErrorModal('Please enter a collection name.', { title: 'Collection name required' }); return; }
        if (!_COLLECTION_NAME_RE.test(name)) {
            showErrorModal('Name may only contain letters, digits, spaces, #, -, and _.', { title: 'Invalid collection name' });
            return;
        }
        onSelect(name, null);
    });
    nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') createBtn.click(); });
    newRow.appendChild(nameInput);
    newRow.appendChild(createBtn);
    picker.appendChild(newRow);
}

// Open a collection's items as editor references and open the write pane.
async function _loadCollectionIntoEditor(col, token, encKey) {
    const items = col?.items || col; // accept col object or bare items array
    if (!Array.isArray(items)) { showErrorModal('This collection has no valid entries.', { title: 'Invalid collection' }); return; }

    // ── Open the collection, as a collection, in the Collection editor ───────
    // (the only place its id/UUID is ever displayed — see _renderCollectionEditor).
    const openInCollectionEditor = async () => {
        _activeCollection = { col, token, encKey };
        const titleEl = document.getElementById('write-title');
        if (titleEl) titleEl.textContent = col.name || '';
        if (typeof currentEditor !== 'undefined' && currentEditor === 'collection') {
            const container = document.getElementById('collectionEditorDiv');
            if (container) await window.showCollectionEditorPanel(container);
        } else if (typeof initializeEditor === 'function') {
            await initializeEditor('collection');
        }
    };

    // ── Legacy behaviour: flatten the collection into paragraph text in the
    // current editor and push every item into the reference list. Kept as an
    // explicit choice (not the Collection editor) for quoting a reading list
    // into a post.
    const insertAsText = async () => {
        const isHtmlEditor = (typeof currentEditor !== 'undefined' && currentEditor === 'tinymce');
        // Nested role:'contains' members have no url — expand them to their
        // actual leaf items, same as export/publish, instead of silently
        // dropping the nested branch.
        const flatItems = encKey ? await _flattenForExport(items, col?.id, token, encKey) : items.filter(item => item.url && !item.url.startsWith('blob:'));
        const filteredItems = flatItems.filter(item => item.url);

        const paragraphs = filteredItems.map(item => {
            const author = (item.author_name && !item.author_name.startsWith('('))
                ? item.author_name
                : ((item.feed && item.feed !== '(no feed specified)') ? item.feed : (item.service || 'Unknown'));
            const body = item.summary || item.title || '';
            return isHtmlEditor
                ? `<p><strong>${escapeHtml(author)}</strong> wrote: ${escapeHtml(body)}</p>`
                : `${escapeHtml(author)} wrote: ${escapeHtml(body)}`;
        });

        if (paragraphs.length) {
            if (isHtmlEditor) {
                loadContent({ type: 'text/html', value: paragraphs.join('<p><br></p>') });
            } else {
                loadContent({ type: 'text/plain', value: paragraphs.join('\n\n') });
            }
        }

        let added = 0;
        for (const item of filteredItems) {
            if (pushReference({ ...item, statusID: item.id })) added++;
        }

        if (added > 0) showStatusMessage('References loaded — click Refs to view');
        else showStatusMessage('All references already loaded.');
    };

    const alreadyInCollectionEditor = typeof currentEditor !== 'undefined' && currentEditor === 'collection';
    const handler   = typeof editorHandlers !== 'undefined' && editorHandlers[currentEditor];
    const hasContent = !alreadyInCollectionEditor && handler
        && typeof editorHasActiveContent === 'function' && editorHasActiveContent(handler);

    if (alreadyInCollectionEditor || !hasContent) {
        await openInCollectionEditor();
        return;
    }

    // ── Current editor has unsaved content — warn and offer options ──────────
    const box = document.createElement('div');

    const msg = document.createElement('p');
    msg.className = 'list-tip';
    msg.textContent = `The current ${handler.label || currentEditor} editor has unsaved content. ` +
        `Opening "${col.name || 'this collection'}" in the Collection editor will replace it.`;
    box.appendChild(msg);

    const row = document.createElement('div');
    row.className = 'published-page-confirm';

    const openBtn = document.createElement('button');
    openBtn.className = 'btn';
    openBtn.textContent = 'Open in Collection editor';
    openBtn.onclick = () => { document.getElementById('generic-modal')?.remove(); openInCollectionEditor(); };
    row.appendChild(openBtn);

    const insertBtn = document.createElement('button');
    insertBtn.className = 'btn';
    insertBtn.textContent = 'Insert as text';
    insertBtn.onclick = () => {
        document.getElementById('generic-modal')?.remove();
        insertAsText().catch(e => {
            console.error('[collection load] insert as text failed', e);
            showErrorModal('Could not insert collection as text: ' + e.message, { title: 'Insert as text failed' });
        });
    };
    row.appendChild(insertBtn);

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn btn-secondary';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.onclick = () => document.getElementById('generic-modal')?.remove();
    row.appendChild(cancelBtn);

    box.appendChild(row);
    showModal(box, { hideDefaultClose: true });
}

// Remove one membership from a collection in kvstore and update the UI in place.
// Keyed by membershipId (falling back to object identity for older items saved
// before memberships had their own id), not url: duplicate memberships (same
// url) are allowed, so removing "by url" would delete every copy at once.
async function _removeItemFromCollection(col, item, token, encKey, countSpan, itemsDiv) {
    try {
        col.items = col.items.filter(i =>
            item.membershipId ? i.membershipId !== item.membershipId : i !== item);
        const encrypted = await encryptWithKey(encKey, JSON.stringify({ id: col.id, title: col.name, items: col.items, publishedUrls: col.publishedUrls || [] }));
        try {
            await window.CList.storage.kv.update(col.key, encrypted);
        } catch (err) {
            throw new Error(kvErrorMessage(err));
        }
        countSpan.textContent = `${col.items.length} item${col.items.length !== 1 ? 's' : ''}`;
        _renderCollectionItems(col, token, encKey, countSpan, itemsDiv);
        showStatusMessage('Item removed.');
    } catch (e) {
        console.error('[collection] remove item failed', e);
        showErrorModal('Could not remove item: ' + e.message, { title: 'Remove item failed' });
    }
}

// Renders a nested-collection membership (role:'contains') as a clickable
// summary row — reuses the same classes as the "My Collections" list view
// (saved-collection-wrapper/-row/-name/-count) rather than inventing new CSS.
function _renderNestedCollectionRow(item, col, token, encKey, countSpan, itemsDiv) {
    const wrapper = document.createElement('div');
    wrapper.className = 'saved-collection-wrapper';

    const row = document.createElement('div');
    row.className = 'saved-collection-row';

    const nameSpan = document.createElement('span');
    nameSpan.className   = 'saved-collection-name';
    nameSpan.textContent = item.title || 'Untitled collection';
    nameSpan.title       = 'Open nested collection';
    nameSpan.onclick     = async () => {
        try {
            const nested = await _resolveCollectionById(item.collectionId, token, encKey);
            if (!nested) { showErrorModal('That nested collection could not be found — it may have been deleted.', { title: 'Collection not found' }); return; }
            _showCollectionDetail({ ...nested, name: nested.title }, token, encKey);
        } catch (e) {
            console.error('[collection nest] open failed', e);
            showErrorModal('Could not open nested collection: ' + e.message, { title: 'Open nested collection failed' });
        }
    };

    const nestedCountSpan = document.createElement('span');
    nestedCountSpan.className   = 'saved-collection-count';
    nestedCountSpan.textContent = 'Nested collection';

    const removeBtn = document.createElement('button');
    removeBtn.className = 'clist-action-btn';
    removeBtn.title     = 'Remove from collection';
    removeBtn.innerHTML = '<span class="material-icons md-18 md-light">remove_circle_outline</span>';
    removeBtn.onclick   = () => _removeItemFromCollection(col, item, token, encKey, countSpan, itemsDiv);

    row.appendChild(nameSpan);
    row.appendChild(nestedCountSpan);
    row.appendChild(removeBtn);
    wrapper.appendChild(row);
    itemsDiv.appendChild(wrapper);
}

// Render the item list for a collection using makeListing for consistent feed entry display.
function _renderCollectionItems(col, token, encKey, countSpan, itemsDiv) {
    itemsDiv.innerHTML = '';
    if (!col.items.length) {
        const empty = document.createElement('p');
        empty.className   = 'feed-status-message';
        empty.textContent = 'This collection is empty.';
        itemsDiv.appendChild(empty);
        return;
    }

    for (const item of col.items) {
        if (item.role === 'contains' && item.collectionId) {
            _renderNestedCollectionRow(item, col, token, encKey, countSpan, itemsDiv);
            continue;
        }
        if (!item.url) continue;

        const displayTitle = _collectionItemDisplayTitle(item);

        // For social items, build "Platform (@handle)" as the feed byline
        const isSocial   = item.service === 'Mastodon' || item.service === 'Bluesky'
            || item.title   === 'Mastodon' || item.title   === 'Bluesky';
        const platform   = isSocial ? (item.title || item.service) : null;
        const handle     = isSocial && item.author_id ? `@${item.author_id}` : null;
        const feedDisplay = isSocial
            ? (handle ? `${platform} (${handle})` : platform)
            : (item.feed || null);

        try {
            const el = makeListing({
                service:   item.service || 'RSS',
                url:       item.url,
                title:     displayTitle,
                titleHtml: `<a href="${escapeHtml(item.url)}" target="_blank" rel="noopener">${escapeHtml(displayTitle)}</a>`,
                desc:      item.summary || '',
                feed:      feedDisplay,
                feedUrl:   item.feedUrl || null,
                author:    (item.author_name && !item.author_name.startsWith('(')) ? item.author_name : null,
                date:      item.created_at || null,
                guid:      item.guid   || item.url,
                entryId:   item.id     || null,
                link:      item.url,
            });

            // Add a "Remove from collection" button into the entry's clist-actions bar
            const clistActions = el.querySelector('.clist-actions');
            if (clistActions) {
                const removeBtn = document.createElement('button');
                removeBtn.className = 'clist-action-btn';
                removeBtn.title     = 'Remove from collection';
                removeBtn.innerHTML = '<span class="material-icons md-18 md-light">remove_circle_outline</span>';
                removeBtn.onclick   = () => _removeItemFromCollection(col, item, token, encKey, countSpan, itemsDiv);
                clistActions.appendChild(removeBtn);
            }

            itemsDiv.appendChild(el);
        } catch (err) {
            console.error('Collection: could not render item', item.url, err);
        }
    }

    window.checkAnnotationsBatch?.();
}

// "Add to another collection" — nests the currently-viewed collection `col`
// as a role:'contains' member of a collection the user picks from a list.
// Reuses the same picker UI as _showCollectionPicker (item -> collection);
// this is a separate entry point because what's being added is a
// collectionId reference, not a feed item.
async function _showAddToCollectionPicker(col, token, encKey, anchorEl) {
    const PICKER_CLASS = 'collection-picker';
    const pickerId     = 'collection-nest-picker';

    const existing = document.getElementById(pickerId);
    document.querySelectorAll('.' + PICKER_CLASS).forEach(el => el.remove());
    if (existing) return;

    const picker = document.createElement('div');
    picker.id        = pickerId;
    picker.className = PICKER_CLASS;
    picker.innerHTML = '<p class="feed-status-message">Loading collections…</p>';
    anchorEl.parentElement.insertBefore(picker, anchorEl.nextSibling);

    try {
        // A never-saved collection has no durable id yet — it must be
        // persisted first (same rule as Save/Publish), since another
        // collection's role:'contains' member references this id.
        let identity = { key: col.key, id: col.id };
        if (!identity.id) {
            identity = _resolveCollectionIdentity(col.key, col.id);
            await _kvSaveItems(identity.key, identity.id, col.name, col.items, token, encKey, col.publishedUrls || []);
            col.key = identity.key;
            col.id  = identity.id;
        }

        const all        = await _fetchAllCollections(token, encKey);
        const candidates  = all.filter(c => c.key !== identity.key);

        picker.innerHTML = '';
        _buildCollectionPickerContents(picker, candidates, async (title, target) => {
            try {
                let targetIdentity, targetItems, targetPublishedUrls;
                if (target) {
                    if (await _wouldCreateCycle(target.id, identity.id, token, encKey)) {
                        showErrorModal(`Can't add "${col.name}" to "${target.title}" — "${target.title}" is already nested inside "${col.name}".`);
                        return;
                    }
                    targetIdentity      = _resolveCollectionIdentity(target.key, target.id);
                    targetItems         = target.items || [];
                    targetPublishedUrls = target.publishedUrls || [];
                } else {
                    targetIdentity      = _newCollectionIdentity();
                    targetItems         = [];
                    targetPublishedUrls = [];
                }
                targetItems.push({ membershipId: crypto.randomUUID(), role: 'contains', collectionId: identity.id, title: col.name });
                await _kvSaveItems(targetIdentity.key, targetIdentity.id, title, targetItems, token, encKey, targetPublishedUrls);
                picker.remove();
                showStatusMessage(`Added "${col.name}" to "${title}".`);
            } catch (e) {
                console.error('[collection nest] add failed', e);
                showErrorModal('Could not add to collection: ' + e.message, { title: 'Add to collection failed' });
            }
        }, anchorEl);
    } catch (e) {
        console.error('[collection nest] picker error', e);
        picker.innerHTML = `<p class="feed-status-message">Could not load collections: ${e.message}</p>`;
    }
}

// Open a single collection in a detail view, replacing the collection list.
// Browser back button and the in-view back icon both return to the list.
function _showCollectionDetail(col, token, encKey) {
    const feedContainer = window.CList.ui.view.feedContainer;
    if (!feedContainer) return;

    // Push state so the browser back button can return to the list
    history.pushState({ collectionDetail: col.name }, '');

    // One-shot popstate handler: any back navigation from here returns to list
    if (_collectionsPopstateHandler) window.removeEventListener('popstate', _collectionsPopstateHandler);
    _collectionsPopstateHandler = () => {
        window.removeEventListener('popstate', _collectionsPopstateHandler);
        _collectionsPopstateHandler = null;
        window.showSavedCollections();
    };
    window.addEventListener('popstate', _collectionsPopstateHandler);

    feedContainer.innerHTML = '';

    // ── Header: [back + count] [title centred] [load all] ──
    const header = document.createElement('div');
    header.className = 'collection-detail-header';

    const leftZone = document.createElement('div');
    leftZone.className = 'collection-detail-left';

    const backBtn = document.createElement('button');
    backBtn.className = 'clist-action-btn';
    backBtn.title     = 'Back to collections';
    backBtn.innerHTML = '<span class="material-icons md-18 md-light">arrow_back</span>';
    backBtn.onclick   = () => history.back();

    const countSpan = document.createElement('span');
    countSpan.className   = 'saved-collection-count';
    countSpan.textContent = `${col.items.length} item${col.items.length !== 1 ? 's' : ''}`;

    leftZone.appendChild(backBtn);
    leftZone.appendChild(countSpan);

    const titleEl = document.createElement('h3');
    titleEl.className   = 'collection-detail-title';
    titleEl.textContent = col.name;

    const rightZone = document.createElement('div');
    rightZone.className = 'collection-detail-right';

    const loadBtn = document.createElement('button');
    loadBtn.className = 'clist-action-btn';
    loadBtn.title     = 'Load all to editor';
    loadBtn.innerHTML = '<span class="material-icons md-18 md-light">arrow_forward</span>';
    loadBtn.onclick   = () => _loadCollectionIntoEditor(col, token, encKey);

    const collabBtn = document.createElement('button');
    collabBtn.className = 'clist-action-btn';
    collabBtn.title     = 'Open in Collab';
    collabBtn.innerHTML = '<span class="material-icons md-18 md-light">edit_note</span>';
    collabBtn.onclick   = async () => {
        if (typeof window.openCollabWithCollection !== 'function') {
            showErrorModal('Collab editor not available.', { title: 'Collab unavailable' });
            return;
        }
        try {
            // Nested role:'contains' members have no url — expand them to their
            // actual leaf items, same as export/publish, instead of silently
            // dropping the nested branch.
            const flat = encKey ? await _flattenForExport(col.items, col.id, token, encKey) : col.items.filter(i => i.url && !i.url.startsWith('blob:'));
            window.openCollabWithCollection(col.name, flat);
        } catch (e) {
            console.error('[collection collab] flatten failed', e);
            showErrorModal('Could not open collection in Collab: ' + e.message, { title: 'Open in Collab failed' });
        }
    };

    const shareBtn = document.createElement('button');
    shareBtn.className = 'clist-action-btn chat-only-btn';
    shareBtn.title     = 'Share to chat';
    shareBtn.innerHTML = '<span class="material-icons md-18 md-light">chat</span>';
    shareBtn.onclick   = async () => {
        try {
            const flat  = encKey ? await _flattenForExport(col.items, col.id, token, encKey) : col.items.filter(i => i.url && !i.url.startsWith('blob:'));
            const items = flat.map(i => ({ title: _collectionItemDisplayTitle(i), url: i.url }));
            sendShareMessage('collection', null, col.name, null, { items });
        } catch (e) {
            console.error('[collection share] flatten failed', e);
            showErrorModal('Could not share collection: ' + e.message, { title: 'Share failed' });
        }
    };

    const nestBtn = document.createElement('button');
    nestBtn.className = 'clist-action-btn';
    nestBtn.title     = 'Add to another collection';
    nestBtn.innerHTML = '<span class="material-icons md-18 md-light">playlist_add</span>';
    nestBtn.onclick   = () => _showAddToCollectionPicker(col, token, encKey, nestBtn);

    rightZone.appendChild(collabBtn);
    rightZone.appendChild(shareBtn);
    rightZone.appendChild(nestBtn);
    rightZone.appendChild(loadBtn);

    header.appendChild(leftZone);
    header.appendChild(titleEl);
    header.appendChild(rightZone);
    feedContainer.appendChild(header);

    const itemsDiv = document.createElement('div');
    itemsDiv.className = 'collection-items-expanded';
    feedContainer.appendChild(itemsDiv);

    _renderCollectionItems(col, token, encKey, countSpan, itemsDiv);
}


// ── Collection import ────────────────────────────────────────────────────────

// Show a preview panel for a parsed {title, items} so the user can name and save it.
function _showCollectionImportPreview(parsed, token, encKey) {
    const feedContainer = window.CList.ui.view.feedContainer;
    if (!feedContainer) return;

    feedContainer.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'collection-detail-header';
    const leftZone = document.createElement('div');
    leftZone.className = 'collection-detail-left';
    const backBtn = document.createElement('button');
    backBtn.className = 'clist-action-btn';
    backBtn.title     = 'Back to collections';
    backBtn.innerHTML = '<span class="material-icons md-18 md-light">arrow_back</span>';
    backBtn.onclick   = () => window.showSavedCollections();
    leftZone.appendChild(backBtn);
    const titleEl = document.createElement('h3');
    titleEl.className   = 'collection-detail-title';
    titleEl.textContent = 'Import preview';
    header.appendChild(leftZone);
    header.appendChild(titleEl);
    header.appendChild(document.createElement('div'));
    feedContainer.appendChild(header);

    const preview = document.createElement('div');
    preview.style.padding = '0 8px 16px';
    feedContainer.appendChild(preview);

    const itemCount = document.createElement('p');
    itemCount.className   = 'feed-status-message';
    itemCount.textContent = `${parsed.items.length} item${parsed.items.length !== 1 ? 's' : ''} found`;
    preview.appendChild(itemCount);

    if (parsed.items.length) {
        const sampleList = document.createElement('ul');
        sampleList.className = 'collection-publish-items';
        parsed.items.slice(0, 5).forEach(item => {
            const li = document.createElement('li');
            li.className     = 'collection-publish-item';
            li.style.padding = '4px 0';
            li.innerHTML     = `<span style="flex:1;font-size:0.85rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(item.title || item.url)}</span>`;
            sampleList.appendChild(li);
        });
        if (parsed.items.length > 5) {
            const more = document.createElement('li');
            more.className    = 'collection-publish-item';
            more.style.color  = '#888';
            more.style.fontSize = '0.8rem';
            more.textContent  = `…and ${parsed.items.length - 5} more`;
            sampleList.appendChild(more);
        }
        preview.appendChild(sampleList);
    }

    const nameRow = document.createElement('div');
    nameRow.style.cssText = 'display:flex;gap:8px;align-items:center;margin-top:12px;flex-wrap:wrap';
    preview.appendChild(nameRow);

    const nameLabel = document.createElement('label');
    nameLabel.textContent   = 'Save as: ';
    nameLabel.style.fontSize = '0.85rem';
    const nameInput = document.createElement('input');
    nameInput.type        = 'text';
    nameInput.className   = 'input-field';
    nameInput.value       = parsed.title;
    nameInput.maxLength   = 50;
    nameInput.style.cssText = 'flex:1;min-width:120px';
    nameLabel.appendChild(nameInput);
    nameRow.appendChild(nameLabel);

    const saveBtn = document.createElement('button');
    saveBtn.className   = 'btn';
    saveBtn.textContent = 'Save as collection';
    nameRow.appendChild(saveBtn);

    const cancelBtn = document.createElement('button');
    cancelBtn.className   = 'btn btn-secondary';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.onclick     = () => window.showSavedCollections();
    nameRow.appendChild(cancelBtn);

    saveBtn.addEventListener('click', async () => {
        const name = nameInput.value.trim();
        if (!name) { showErrorModal('Please enter a collection name.', { title: 'Collection name required' }); return; }
        if (!_COLLECTION_NAME_RE.test(name)) {
            showErrorModal('Name may only contain letters, digits, spaces, #, -, and _.', { title: 'Invalid collection name' });
            return;
        }
        saveBtn.disabled    = true;
        saveBtn.textContent = 'Saving…';
        try {
            // If the imported content already carries a recognized identity
            // (Part B — read-side detection), reuse it instead of minting a new one.
            const { key, id } = _resolveCollectionIdentity(null, parsed.id);
            await _kvSaveItems(key, id, name, parsed.items, token, encKey);
            showStatusMessage(`Saved as "${name}".`);
            window.showSavedCollections();
        } catch (e) {
            console.error('[collection] import save failed', e);
            showErrorModal('Could not save: ' + e.message, { title: 'Save failed' });
            saveBtn.disabled    = false;
            saveBtn.textContent = 'Save as collection';
        }
    });
}

async function _importCollectionFromUrl(url, token, encKey) {
    const feedContainer = window.CList.ui.view.feedContainer;
    if (!feedContainer) return;
    feedContainer.innerHTML = '<p class="feed-status-message">Fetching…</p>';
    try {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const contentType = resp.headers.get('Content-Type') || '';
        const text        = await resp.text();
        const format      = _detectFormat(contentType, url);
        let parsed;
        if (format === 'rss')       parsed = _parseCollectionRSS(text);
        else if (format === 'opml') parsed = _parseCollectionOPML(text);
        else if (format === 'html') parsed = _parseCollectionHTML(text);
        else                        parsed = _parseCollectionJSON(text);
        _showCollectionImportPreview(parsed, token, encKey);
    } catch (e) {
        console.error('[collection] import fetch failed', e);
        feedContainer.innerHTML = `<p class="feed-status-message">Could not fetch URL: ${escapeHtml(e.message)}</p>
            <button class="btn" style="margin:8px 4px 0">Back</button>`;
        feedContainer.querySelector('button').onclick = () => window.showSavedCollections();
    }
}

async function _importCollectionFromFile(file, token, encKey) {
    const feedContainer = window.CList.ui.view.feedContainer;
    if (!feedContainer) return;
    feedContainer.innerHTML = '<p class="feed-status-message">Reading file…</p>';
    try {
        const text   = await file.text();
        const format = _detectFormat(file.type, file.name);
        let parsed;
        if (format === 'rss')       parsed = _parseCollectionRSS(text);
        else if (format === 'opml') parsed = _parseCollectionOPML(text);
        else if (format === 'html') parsed = _parseCollectionHTML(text);
        else                        parsed = _parseCollectionJSON(text);
        _showCollectionImportPreview(parsed, token, encKey);
    } catch (e) {
        console.error('[collection] file import failed', e);
        feedContainer.innerHTML = `<p class="feed-status-message">Could not read file: ${escapeHtml(e.message)}</p>
            <button class="btn" style="margin:8px 4px 0">Back</button>`;
        feedContainer.querySelector('button').onclick = () => window.showSavedCollections();
    }
}

// Reading collections include both saved content collections and subscribed
// public feed collections. Keep the normal collection lookup unchanged for
// nesting/export callers that require actual collection records.
async function _fetchReadCollections(token, encKey, accounts) {
    const collections = await _fetchAllCollections(token, encKey);
    for (const account of accounts || []) {
        const data = parseAccountValue(account);
        if (!data || typeof window.CList.readers[data.type]?.editCollection !== 'function') continue;
        collections.push({ key: account.key, title: data.title || account.key, items: [], feedSubscription: data });
    }
    return collections;
}

// List the user's saved collections and feed subscriptions.
window.showSavedCollections = async function() {
    // Clean up any detail-view popstate handler if navigating here directly
    if (_collectionsPopstateHandler) {
        window.removeEventListener('popstate', _collectionsPopstateHandler);
        _collectionsPopstateHandler = null;
    }

    const feedSection   = document.getElementById('feed-section');
    const feedMenu      = window.CList.ui.view.feedMenu;
    const feedContainer = window.CList.ui.view.feedContainer;
    if (!feedContainer) return;

    if (feedSection) feedSection.style.display = '';   // restore CSS flex layout
    if (feedMenu)  { feedMenu.style.display = '';  feedMenu.innerHTML = ''; }
    feedContainer.innerHTML = '<p class="feed-status-message">Loading collections…</p>';

    const token = getSiteSpecificCookie(window.CList.config.flaskSiteUrl, window.CList.keys.ACCESS_TOKEN);
    if (!token) {
        feedContainer.innerHTML = '<p class="feed-status-message">Please log in to view your collections.</p>';
        return;
    }

    try {
        const encKey = await getEncKey(window.CList.config.flaskSiteUrl);
        if (!encKey) throw new Error('Encryption key not available — please log in again.');

        const collections = await _fetchReadCollections(token, encKey, window.CList.accounts);

        feedContainer.innerHTML = '';
        const header = document.createElement('div');
        header.className = 'feed-panel-header';
        header.innerHTML = '<h3>My Collections</h3>';
        feedContainer.appendChild(header);

        if (!collections.length) {
            const msg = document.createElement('p');
            msg.className   = 'feed-status-message';
            msg.textContent = 'No collections yet. Use the library_add button on any item to start collecting.';
            feedContainer.appendChild(msg);
            return;
        }

        for (const col of collections) {
            // _fetchAllCollections() returns .title; _showCollectionDetail() and
            // everything downstream of it (_loadCollectionIntoEditor, the Collab/
            // share/nest buttons) read .name instead -- normalize here so those
            // don't show a blank collection name.
            col.name = col.title;

            const wrapper = document.createElement('div');
            wrapper.className = 'saved-collection-wrapper';

            // ── Summary row ──
            const row = document.createElement('div');
            row.className = 'saved-collection-row';

            const nameSpan = document.createElement('span');
            nameSpan.className   = 'saved-collection-name';
            nameSpan.textContent = col.title;
            nameSpan.title       = col.feedSubscription ? 'Read feed collection' : 'View / edit items';
            nameSpan.onclick     = async () => {
                try {
                    if (col.feedSubscription) await switchReaderAccount(col.key);
                    else _showCollectionDetail(col, token, encKey);
                } catch (error) {
                    console.error('Could not open collection:', error);
                    showErrorModal('Could not open collection: ' + error.message, { title: 'Open collection failed' });
                }
            };

            const countSpan = document.createElement('span');
            countSpan.className   = 'saved-collection-count';
            countSpan.textContent = col.feedSubscription ? 'Feed collection' : `${col.items.length} item${col.items.length !== 1 ? 's' : ''}`;

            const editBtn = document.createElement('button');
            editBtn.className = 'clist-action-btn';
            editBtn.title     = 'Edit collection';
            editBtn.innerHTML = '<span class="material-icons md-18 md-light">edit</span>';
            editBtn.onclick   = async () => {
                try {
                    revealEditorPane();
                    if (col.feedSubscription) {
                        await window.CList.readers[col.feedSubscription.type].editCollection(col.key, col.feedSubscription);
                    } else {
                        await _loadCollectionIntoEditor(col, token, encKey);
                    }
                } catch (error) {
                    console.error('Could not edit collection:', error);
                    showErrorModal('Could not edit collection: ' + error.message, { title: 'Edit collection failed' });
                }
            };

            // Delete button — two-step confirmation
            const delBtn = document.createElement('button');
            delBtn.className = 'clist-action-btn';
            delBtn.title     = 'Delete this collection';
            delBtn.innerHTML = '<span class="material-icons md-18 md-light">delete_outline</span>';

            const confirmRow = document.createElement('div');
            confirmRow.className    = 'collection-delete-confirm';
            confirmRow.style.display = 'none';

            const confirmLabel = document.createElement('span');
            confirmLabel.textContent = `Delete "${col.title}"? `;

            const yesBtn = document.createElement('button');
            yesBtn.className   = 'btn collection-confirm-btn';
            yesBtn.textContent = 'Delete';
            yesBtn.onclick     = async () => {
                try {
                    await window.CList.storage.kv.remove(col.key);
                    if (col.feedSubscription) {
                        window.CList.accounts = (window.CList.accounts || []).filter(account => account.key !== col.key);
                        if (typeof populateReadAccountList === 'function') populateReadAccountList(window.CList.accounts);
                        updateUIVisibility();
                    }
                    showStatusMessage(`Collection "${col.title}" deleted.`);
                    await window.showSavedCollections();
                } catch (err) {
                    console.error('[collection] delete failed', err);
                    showErrorModal('Could not delete: ' + (err.code === 'NotAuthenticated' ? 'Not logged in' : err.message), { title: 'Delete failed' });
                }
            };

            const cancelBtn = document.createElement('button');
            cancelBtn.className   = 'btn btn-secondary collection-confirm-btn';
            cancelBtn.textContent = 'Cancel';
            cancelBtn.onclick     = () => {
                confirmRow.style.display = 'none';
                delBtn.style.display     = '';
            };

            delBtn.onclick = () => {
                delBtn.style.display      = 'none';
                confirmRow.style.display  = 'flex';
            };

            confirmRow.appendChild(confirmLabel);
            confirmRow.appendChild(yesBtn);
            confirmRow.appendChild(cancelBtn);

            row.appendChild(nameSpan);
            row.appendChild(countSpan);
            row.appendChild(editBtn);
            row.appendChild(delBtn);
            row.appendChild(confirmRow);

            wrapper.appendChild(row);
            feedContainer.appendChild(wrapper);
        }

        // ── Import from URL section ──
        const importSection = document.createElement('div');
        importSection.style.cssText = 'margin-top:16px;padding:10px 4px 4px;border-top:1px solid #eee;text-align:center';

        const importToggle = document.createElement('button');
        importToggle.textContent = 'Import';

        const importPanel = document.createElement('div');
        importPanel.style.cssText = 'display:none;width:80%;margin:6px auto 0;text-align:left';

        // URL / File option buttons
        const optionRow = document.createElement('div');
        optionRow.style.cssText = 'display:flex;gap:6px;margin-bottom:8px';
        const urlOptBtn  = document.createElement('button');
        urlOptBtn.textContent = 'URL';
        const fileOptBtn = document.createElement('button');
        fileOptBtn.textContent = 'File';
        optionRow.appendChild(urlOptBtn);
        optionRow.appendChild(fileOptBtn);
        importPanel.appendChild(optionRow);

        // URL sub-panel
        const urlPanel = document.createElement('div');
        urlPanel.style.display = 'none';
        const urlInput = document.createElement('input');
        urlInput.type          = 'text';
        urlInput.className     = 'input-field';
        urlInput.placeholder   = 'Paste a URL (RSS, OPML, JSON, HTML)…';
        urlInput.style.cssText = 'width:100%;box-sizing:border-box;margin-bottom:6px';
        const urlGoBtn = document.createElement('button');
        urlGoBtn.textContent = 'Import';
        urlGoBtn.addEventListener('click', () => {
            const url = urlInput.value.trim();
            if (!url) { showErrorModal('Please paste a URL to import.', { title: 'URL required' }); return; }
            _importCollectionFromUrl(url, token, encKey);
        });
        urlInput.addEventListener('keydown', e => { if (e.key === 'Enter') urlGoBtn.click(); });
        urlPanel.appendChild(urlInput);
        urlPanel.appendChild(urlGoBtn);
        importPanel.appendChild(urlPanel);

        // File sub-panel
        const filePanel = document.createElement('div');
        filePanel.style.display = 'none';
        const fileInput = document.createElement('input');
        fileInput.type          = 'file';
        fileInput.accept        = '.rss,.xml,.opml,.json,.html,.htm,.md,.txt';
        fileInput.style.display = 'none';
        fileInput.addEventListener('change', () => {
            const file = fileInput.files[0];
            if (file) _importCollectionFromFile(file, token, encKey);
        });
        const fileBrowseBtn = document.createElement('button');
        fileBrowseBtn.textContent = 'Browse file…';
        fileBrowseBtn.addEventListener('click', () => fileInput.click());
        filePanel.appendChild(fileInput);
        filePanel.appendChild(fileBrowseBtn);
        importPanel.appendChild(filePanel);

        urlOptBtn.addEventListener('click', () => {
            const open = urlPanel.style.display !== 'none';
            urlPanel.style.display  = open ? 'none' : 'block';
            filePanel.style.display = 'none';
            if (!open) setTimeout(() => urlInput.focus(), 0);
        });

        fileOptBtn.addEventListener('click', () => {
            const open = filePanel.style.display !== 'none';
            filePanel.style.display = open ? 'none' : 'block';
            urlPanel.style.display  = 'none';
        });

        importToggle.addEventListener('click', () => {
            const open = importPanel.style.display !== 'none';
            importPanel.style.display = open ? 'none' : 'block';
            if (open) {
                urlPanel.style.display  = 'none';
                filePanel.style.display = 'none';
            }
        });

        importSection.appendChild(importToggle);
        importSection.appendChild(importPanel);
        feedContainer.appendChild(importSection);

    } catch (e) {
        console.error('[collection] load failed', e);
        feedContainer.innerHTML = `<p class="feed-status-message">Could not load collections: ${e.message}</p>`;
    }
};

// ── My Collections loader ───────────────────────────────────────────────────
// Lets the Load panel pick one of the user's saved (kvstore) collections directly,
// instead of only being reachable by round-tripping through a published page (My
// Pages' "Load into collection editor" button). Hands off to the same
// _loadCollectionIntoEditor() the "Load all to editor" button in the collection
// detail view (showSavedCollections -> _showCollectionDetail) already uses, so
// it already opens straight into the Collection editor when that's the current
// editor, and warns before replacing unsaved content otherwise.
(function () {
    window.CList.loaders = window.CList.loaders || [];
    window.CList.loaders.push({
        label: 'My Collections',
        icon:  'collections',
        requiresLogin:   true,
        requiresAccount: false,
        load: async () => {
            const optionsDiv = window.CList.ui.view.loadOptions;
            if (!optionsDiv) return null;

            const token = getSiteSpecificCookie(window.CList.config.flaskSiteUrl, window.CList.keys.ACCESS_TOKEN);
            if (!token) {
                showErrorModal('Please log in to load a collection.', { title: 'Login required' });
                return null;
            }

            optionsDiv.innerHTML = '<p class="list-tip">Loading collections…</p>';

            try {
                const encKey = await getEncKey(window.CList.config.flaskSiteUrl);
                if (!encKey) throw new Error('Encryption key not available');

                const collections = await _fetchAllCollections(token, encKey);

                optionsDiv.innerHTML = '';

                if (!collections.length) {
                    const msg = document.createElement('p');
                    msg.className   = 'list-tip';
                    msg.textContent = 'No collections yet — use the library_add button on any item to start one.';
                    optionsDiv.appendChild(msg);
                } else {
                    const tip = document.createElement('p');
                    tip.className   = 'list-tip';
                    tip.textContent = 'Select a collection to load';
                    optionsDiv.appendChild(tip);

                    const list = document.createElement('div');
                    list.className = 'account-list';

                    for (const col of collections) {
                        col.name = col.title; // see showSavedCollections() for why

                        const btn = document.createElement('button');
                        btn.className = 'account-button';

                        const iconEl = document.createElement('span');
                        iconEl.className   = 'material-icons';
                        iconEl.textContent = 'collections';

                        const nameEl = document.createElement('span');
                        nameEl.textContent = `${col.title} (${col.items.length} item${col.items.length !== 1 ? 's' : ''})`;

                        btn.appendChild(iconEl);
                        btn.appendChild(nameEl);
                        btn.addEventListener('click', () => _loadCollectionIntoEditor(col, token, encKey));

                        list.appendChild(btn);
                    }

                    optionsDiv.appendChild(list);
                }

                _appendBackButton(optionsDiv);
            } catch (e) {
                console.error('[collections loader] load failed', e);
                optionsDiv.innerHTML = `<p class="feed-status-message">Could not load collections: ${escapeHtml(e.message)}</p>`;
                _appendBackButton(optionsDiv);
            }

            return null;
        },
    });
})();

// ── From URL loader ──────────────────────────────────────────────────────────
(function () {
    window.CList.loaders = window.CList.loaders || [];
    window.CList.loaders.push({
        label: 'From URL',
        icon:  'link',
        requiresLogin:   false,
        requiresAccount: false,
        load:  () => new Promise(resolve => {
            const optionsDiv = window.CList.ui.view.loadOptions;
            optionsDiv.innerHTML = '';

            const form = document.createElement('div');
            form.style.cssText = 'display:flex;flex-direction:column;gap:8px;padding:8px 0';

            const urlInput = document.createElement('input');
            urlInput.type        = 'text';
            urlInput.placeholder = 'https://example.com/feed.rss';
            urlInput.className   = 'collection-editor-input';
            urlInput.style.width = '100%';
            form.appendChild(urlInput);

            const status = document.createElement('p');
            status.className = 'feed-status-message';
            status.style.display = 'none';
            form.appendChild(status);

            const btnRow = document.createElement('div');
            btnRow.style.cssText = 'display:flex;gap:6px';

            const loadBtn = document.createElement('button');
            loadBtn.className   = 'btn';
            loadBtn.textContent = 'Load';

            const cancelBtn = document.createElement('button');
            cancelBtn.className   = 'btn btn-secondary';
            cancelBtn.textContent = 'Cancel';
            cancelBtn.onclick     = () => {
                resolve(null);
                if (typeof populateLoadOptions === 'function') populateLoadOptions();
            };

            btnRow.appendChild(loadBtn);
            btnRow.appendChild(cancelBtn);
            form.appendChild(btnRow);
            optionsDiv.appendChild(form);
            requestAnimationFrame(() => urlInput.focus());

            async function doLoad() {
                const url = urlInput.value.trim();
                if (!url) return;

                loadBtn.disabled    = true;
                loadBtn.textContent = 'Loading…';
                status.style.display = 'block';
                status.textContent   = 'Fetching…';

                try {
                    // Routed through proxyp, not a direct fetch(url) — the target site's
                    // CORS policy blocks a raw cross-origin fetch from the browser (see
                    // /srv/apps/proxyp/CLAUDE.md). A Bearer token (logged in) or the
                    // admin-declared access key (logged out, if enabled) authorizes it.
                    const headers = { ...kvstoreAuthHeader(), ...(await proxypAccessKeyHeader()) };
                    const resp = await fetch(`${window.CList.defaults.PROXYP}?${new URLSearchParams({ url })}`, { headers });
                    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                    const contentType = resp.headers.get('Content-Type') || '';
                    const text        = await resp.text();

                    // Proxyp's convention: a reachable-but-failed upstream request still
                    // returns HTTP 200, with a JSON {"error": "..."} body instead of the
                    // real content — resp.ok alone no longer means "got the real page"
                    // once proxied, so check for that shape explicitly.
                    if (contentType.includes('application/json')) {
                        let proxypError = null;
                        try {
                            const parsed = JSON.parse(text);
                            if (parsed && typeof parsed.error === 'string') proxypError = parsed.error;
                        } catch (_) { /* not JSON, or not proxyp's error shape — fall through */ }
                        if (proxypError) throw new Error(proxypError);
                    }

                    await loadSavedPage({ type: contentType, value: text }, null, optionsDiv, () => populateLoadOptions());
                    resolve(null);
                } catch (e) {
                    console.error('[load from URL]', e);
                    status.textContent   = 'Failed: ' + e.message;
                    loadBtn.disabled     = false;
                    loadBtn.textContent  = 'Load';
                }
            }

            loadBtn.addEventListener('click', doLoad);
            urlInput.addEventListener('keydown', e => { if (e.key === 'Enter') doLoad(); });
        }),
    });
})();

// ── Add item from feed to collection editor ───────────────────────────────────

window.addItemToCollectionEditor = function addItemToCollectionEditor(reference) {
    if (!Array.isArray(_draftItems)) {
        showErrorModal('No collection is open in the editor.', { title: 'No collection open' });
        return;
    }
    const url = reference?.url || '';
    if (!url) { showErrorModal('This item has no URL and cannot be added to a collection.', { title: 'Missing URL' }); return; }
    const item = {
        title:       reference.title       || '',
        url,
        author_name: reference.author_name || '',
        feed:        reference.feed        || '',
        summary:     reference.summary     || '',
    };
    _draftItems.push(item);
    if (typeof _refreshEditor === 'function') _refreshEditor();
    showStatusMessage(`Added "${item.title || url}" to collection.`);
};

// ── Import a chat-shared collection into a local kvstore collection ───────────

window.importCollectionFromChat = async function(items, anchorEl) {
    const existing = anchorEl.nextElementSibling;
    if (existing && existing.classList.contains('collection-picker')) {
        existing.remove();
        return;
    }
    const token = getSiteSpecificCookie(window.CList.config.flaskSiteUrl, window.CList.keys.ACCESS_TOKEN);
    if (!token) { showErrorModal('Please log in to save to a collection.', { title: 'Login required' }); return; }

    const picker = document.createElement('div');
    picker.className = 'collection-picker';
    picker.innerHTML = '<p class="feed-status-message">Loading…</p>';
    anchorEl.insertAdjacentElement('afterend', picker);

    try {
        const encKey = await getEncKey(window.CList.config.flaskSiteUrl);
        if (!encKey) throw new Error('Encryption key not available — please log in again.');
        const collections = await _fetchAllCollections(token, encKey);

        picker.innerHTML = '';

        async function onPickerSelect(title, col) {
            if (col) {
                // Existing collection — show conflict dialog
                const existingUrls = new Set(col.items.map(i => i.url).filter(Boolean));
                const toAdd = items.filter(i => i.url && !existingUrls.has(i.url));
                const identity = _resolveCollectionIdentity(col.key, col.id);
                _buildCollectionConflictUI(picker, title,
                    async () => {
                        try {
                            await _kvSaveItems(identity.key, identity.id, title, items, token, encKey, col.publishedUrls);
                            picker.remove();
                            showStatusMessage(`Saved as "${title}".`);
                        } catch (e) {
                            console.error('[collection] overwrite failed', e);
                            showErrorModal('Could not save: ' + e.message, { title: 'Save failed' });
                        }
                    },
                    async () => {
                        try {
                            await _kvSaveItems(identity.key, identity.id, title, [...col.items, ...toAdd], token, encKey, col.publishedUrls);
                            picker.remove();
                            showStatusMessage(`Added ${toAdd.length} item${toAdd.length !== 1 ? 's' : ''} to "${title}".`);
                        } catch (e) {
                            console.error('[collection] merge failed', e);
                            showErrorModal('Could not merge: ' + e.message, { title: 'Merge failed' });
                        }
                    },
                    () => {
                        picker.innerHTML = '';
                        _buildCollectionPickerContents(picker, collections, onPickerSelect, anchorEl);
                    }
                );
            } else {
                // New collection — save directly
                try {
                    const fresh = _newCollectionIdentity();
                    await _kvSaveItems(fresh.key, fresh.id, title, items, token, encKey);
                    picker.remove();
                    showStatusMessage(`Saved as "${title}".`);
                } catch (e) {
                    console.error('[collection] chat import failed', e);
                    showErrorModal('Could not save: ' + e.message, { title: 'Save failed' });
                }
            }
        }

        _buildCollectionPickerContents(picker, collections, onPickerSelect, anchorEl);

    } catch (e) {
        console.error('[collection] chat import picker error', e);
        picker.innerHTML = `<p class="feed-status-message">Could not load collections: ${e.message}</p>`;
    }
};

// ── Shared conflict dialog: Overwrite / Merge / Cancel ───────────────────────

function _buildCollectionConflictUI(container, collectionName, onOverwrite, onMerge, onCancel) {
    container.innerHTML = '';
    const msg = document.createElement('span');
    msg.style.cssText   = 'font-size:0.85rem';
    msg.textContent     = `"${collectionName}" already exists.`;
    const btns = document.createElement('div');
    btns.style.cssText  = 'display:flex;gap:6px;margin-top:6px';
    const overwriteBtn  = document.createElement('button');
    overwriteBtn.className = 'btn-small'; overwriteBtn.textContent = 'Overwrite';
    const mergeBtn      = document.createElement('button');
    mergeBtn.className  = 'btn-small'; mergeBtn.textContent = 'Merge';
    const cancelBtn     = document.createElement('button');
    cancelBtn.className = 'btn-small btn-secondary'; cancelBtn.textContent = 'Cancel';
    btns.appendChild(overwriteBtn);
    btns.appendChild(mergeBtn);
    btns.appendChild(cancelBtn);
    container.appendChild(msg);
    container.appendChild(btns);
    overwriteBtn.addEventListener('click', () => { overwriteBtn.disabled = mergeBtn.disabled = true; onOverwrite(); });
    mergeBtn.addEventListener('click',     () => { overwriteBtn.disabled = mergeBtn.disabled = true; onMerge(); });
    cancelBtn.addEventListener('click',    onCancel);
}

// ── Collection save ──────────────────────────────────────────────────────────

/**
 * @param {CListCollectionSaveFields} fields
 * @param {CListCollectionMember[]} items
 * @param {Partial<CListEditorCollection>} [collection]
 * @returns {CListCollectionSaveRequest}
 */
function captureCollectionSaveRequest(fields, items, collection = {}) {
    const name = fields.name.trim();
    if (!name) {
        throw new Error('Please enter a collection title before saving.');
    }

    return {
        name,
        formatId: fields.formatId,
        identity: _resolveCollectionIdentity(collection.key, collection.id),
        items: structuredClone(items),
        publishedUrls: structuredClone(collection.publishedUrls || []),
        feedAccount: collection.feedAccount
            ? structuredClone(collection.feedAccount)
            : null,
    };
}

// Storage boundary: explicit data in, saved data out; no editor or UI access.
/**
 * @param {CListCollectionSaveRequest} request
 * @param {CListSaveSession} session
 * @returns {Promise<CListCollectionSaveResult>}
 */
async function persistCollectionSave(request, session) {
    const { identity, name, items, publishedUrls, feedAccount } = request;
    const { token, encKey } = session;
    if (!token || !encKey) throw new Error('Please log in before saving this collection.');
    if (feedAccount) {
        const handler = window.CList.readers[feedAccount.type];
        if (typeof handler?.saveCollection !== 'function') {
            throw new Error('This account cannot save collections.');
        }
        await handler.saveCollection(request, session);
    } else {
        await _kvSaveItems(identity.key, identity.id, name, items, token, encKey, publishedUrls);
    }
    return {
        ...identity, name,
        items: structuredClone(items),
        publishedUrls: structuredClone(publishedUrls),
        feedAccount: structuredClone(feedAccount),
    };
}

// Controller state is independent of buttons. Requests own their status while
// an active-target index prevents concurrent writes from rebuilt save panels.
/**
 * @param {CListCollectionSaveRequest} request
 * @param {CListSaveSession} session
 * @returns {Promise<CListCollectionSaveOutcome>}
 */
function runCollectionSave(request, session) {
    window.CList.state = window.CList.state || {};
    if (window.CList.state?.collectionPublishing?.busy) return Promise.reject(new Error('Wait for collection publication to finish before saving.'));
    const state = window.CList.state.collectionSaving ||= {
        active: new Map(), requests: new WeakMap(),
    };
    const target = JSON.stringify([
        window.CList.config.flaskSiteUrl, window.CList.state.username || '',
        request.feedAccount?.key || request.identity.key,
    ]);
    const existing = state.active.get(target);
    if (existing) {
        if (existing.request === request) return existing.promise;
        return Promise.reject(new Error('A save for this collection is already running. Please wait, then save your newer edits.'));
    }
    const operation = { request, status: 'saving', result: null, error: null, promise: null };
    operation.promise = Promise.resolve().then(async () => {
        try {
            const saved = await persistCollectionSave(request, session);
            const activeUpdated = _activeCollection?.col?.key === saved.key
                && _activeCollection?.col?.id === saved.id;
            if (activeUpdated) {
                const draft = readActiveCollectionDraft() || _activeCollection.col;
                _activeCollection = {
                    ..._activeCollection,
                    col: {
                        ..._activeCollection.col, ...saved,
                        name: draft.name ?? saved.name,
                        items: structuredClone(draft.items ?? saved.items),
                    },
                    token: session.token, encKey: session.encKey,
                };
                _refreshIdDisplay();
            }
            operation.result = { ...saved, activeUpdated };
            operation.status = 'saved';
            return operation.result;
        } catch (error) {
            operation.status = 'failed';
            operation.error = error;
            throw error; // The invoking view presents the failure.
        } finally {
            state.active.delete(target);
        }
    });
    state.active.set(target, operation);
    state.requests.set(request, operation);
    return operation.promise;
}

window.playCollectionSave = async function playCollectionSave() {
    if (window.CList.state?.collectionPublishing?.busy) { showStatusMessage('Wait for collection publication to finish.'); return; }
    let request;
    try {
        request = captureCollectionSaveRequest(
            readCollectionSaveFields(),
            _draftItems || [],
            _activeCollection?.col
        );
    } catch (error) {
        console.error('[collection save] invalid request', error);
        showErrorModal(error.message, { title: 'Save failed' });
        return;
    }
    const { name, items, formatId, identity } = request;

    // Resolve identity once, up front, so the downloaded file and the kvstore
    // record embed/store the exact same UUID — even for a brand-new or legacy
    // collection that doesn't have one yet when Save is clicked.
    _activeCollection = {
        ..._activeCollection,
        col: { ..._activeCollection?.col, key: identity.key, id: identity.id },
    };
    _refreshIdDisplay();

    // Fetched once up front (not per-button) so "Save to file" can flatten any
    // nested role:'contains' members the same way the editor's own kvstore
    // record does — the export formats only care about items with a url.
    const token  = getSiteSpecificCookie(window.CList.config.flaskSiteUrl, window.CList.keys.ACCESS_TOKEN);
    const dropboxOwner = { username: window.CList.state.username, storeUrl: window.CList.config.flaskSiteUrl,
        token, collection: _activeCollection };
    const encKey = token ? await getEncKey(dropboxOwner.storeUrl).catch(() => null) : null;

    const saveOptionsDiv = document.getElementById('save-options');
    saveOptionsDiv.innerHTML = '';

    const list = document.createElement('div');
    list.className = 'account-list';

    const tip = document.createElement('div');
    tip.className   = 'list-tip';
    tip.textContent = 'Select a destination';
    list.appendChild(tip);

    // ── Save to file ──
    const fileBtn = document.createElement('button');
    fileBtn.className = 'account-button';
    fileBtn.innerHTML = '<span class="material-icons">download</span><span>Save to file</span>';
    fileBtn.addEventListener('click', async () => {
        const fmt = collectionFormats[formatId];
        if (!fmt) { showErrorModal('Unknown format.', { title: 'Unknown format' }); return; }
        const flatItems = encKey ? await _flattenForExport(items, identity.id, token, encKey) : items;
        const content = fmt.serialize(name, flatItems, identity.id);
        downloadBlob(new Blob([content], { type: fmt.mimeType }), `${name}.${fmt.ext}`);
        showStatusMessage(`Downloaded as ${name}.${fmt.ext}`);
    });
    list.appendChild(fileBtn);

    // ── Save to CList ── (keeps the raw, unflattened items — role:'contains'
    // stubs are only expanded at export/publish time, not in the stored record)
    if (token) {
        const kvBtn = document.createElement('button');
        kvBtn.className = 'account-button';
        kvBtn.innerHTML = '<span class="material-icons">storage</span><span>Save to CList</span>';

        kvBtn.addEventListener('click', async () => {
            kvBtn.disabled = true;
            try {
                const result = await runCollectionSave(request, { token, encKey });
                showStatusMessage(`Collection "${result.name}" saved to CList.`);
                if (result.activeUpdated && typeof closeRightPane === 'function') closeRightPane();
            } catch (e) {
                console.error('[collection save] CList save failed', e);
                showErrorModal('Save failed: ' + e.message, { title: 'Save failed' });
            } finally {
                kvBtn.disabled = false;
            }
        });

        list.appendChild(kvBtn);
    }

    // ── Save to Dropbox ── (same serialized output as "Save to file", uploaded
    // in place of a browser download; mirrors dropbox.js's generic saver, which
    // doesn't apply here since collections need format-specific serialization)
    const dropboxAccount = token ? findAccountByType('Dropbox', { permission: 'b' })?.account : null;
    if (dropboxAccount) {
        const dbxBtn = document.createElement('button');
        dbxBtn.className = 'account-button';
        dbxBtn.innerHTML = '<span class="service-icon-img" style="-webkit-mask:url(\'assets/icons/dropbox.svg\') no-repeat center / contain;mask:url(\'assets/icons/dropbox.svg\') no-repeat center / contain"></span><span>Save to Dropbox</span>';

        dbxBtn.addEventListener('click', async () => {
            if (dbxBtn.disabled) return;
            const fmt = collectionFormats[formatId];
            if (!fmt) { showErrorModal('Unknown format.', { title: 'Unknown format' }); return; }
            dbxBtn.disabled = true;
            try {
                const accountData = parseAccountValue(dropboxAccount);
                if (!accountData) throw new Error('The Dropbox account could not be read.');
                await saveToDropbox({ found: { account: dropboxAccount, parsedValue: accountData }, target: saveOptionsDiv,
                    isCurrent: () => _activeCollection === dropboxOwner.collection
                        && window.CList.state.username === dropboxOwner.username
                        && window.CList.config.flaskSiteUrl === dropboxOwner.storeUrl
                        && getSiteSpecificCookie(dropboxOwner.storeUrl, window.CList.keys.ACCESS_TOKEN) === dropboxOwner.token,
                    prepare: async () => {
                        const flatItems = encKey ? await _flattenForExport(items, identity.id, token, encKey) : items;
                        return { value: fmt.serialize(name, flatItems, identity.id), name: `${name}.${fmt.ext}` };
                    },
                });
            } catch (error) {
                console.error('[collection save] Dropbox save failed', error);
                showErrorModal('Save failed: ' + error.message, { title: 'Save failed' });
            } finally { dbxBtn.disabled = false; }
        });

        list.appendChild(dbxBtn);
    }

    saveOptionsDiv.appendChild(list);
    if (typeof openRightInterface === 'function') openRightInterface('save-instructions');
};

// ── Pages catalog ────────────────────────────────────────────────────────────

// Bump publishedAt on one entry inside a collection's publishedUrls array — same
// list/decrypt/patch/re-encrypt/storage.kv.update() shape as _recordPublishedUrls above,
// but patching an existing entry in place rather than appending a new one.
async function _touchPublishedUrlEntry(collectionKey, serviceId, { session, publication, assertSession = () => {}, strict = false } = {}) {
    assertSession();
    const encKey = session ? session.encKey : await getEncKey(window.CList.config.flaskSiteUrl);
    if (!encKey) throw new Error('Log in to record the republished collection.');
    assertSession();
    const kvs = await window.CList.storage.kv.list();
    const kv = (kvs || []).find(k => k.key === collectionKey);
    if (!kv) { if (strict) throw new Error('The saved collection is no longer available.'); return; }
    const raw = await decryptKVJson(encKey, kv.value);
    const col = _parseCollectionData(raw);
    if (publication?.id && col.id && col.id !== publication.id) throw new Error('The saved collection identity changed.');
    const entry = (col.publishedUrls || []).find(p => p.serviceId === serviceId
        && (!publication || ((!p.service || p.service === publication.service)
            && (!p.accountInstance || p.accountInstance === publication.accountInstance))));
    if (!entry && strict) throw new Error('The publication entry is no longer available.');
    if (entry) entry.publishedAt = new Date().toISOString();
    const encrypted = await encryptWithKey(encKey, JSON.stringify({ id: col.id, title: col.title, items: col.items, publishedUrls: col.publishedUrls }));
    assertSession();
    await window.CList.storage.kv.update(collectionKey, encrypted);
}

// Regenerate the OPML and ActivityPub outbox catalog files on CListBin.
// Silent on failure — catalog update must not interrupt the publish flow.
async function _updatePagesCatalog(token, encKey, binAccount, { assertSession = () => {}, throwOnError = false } = {}) {
    try {
        assertSession();
        let kvs;
        try {
            kvs = await window.CList.storage.kv.list();
        } catch (error) {
            if (throwOnError) throw error;
            return;
        }

        // Load existing catalog serviceIds (so we can update in place)
        let catalogMeta = {};
        const catalogKv = (kvs || []).find(kv => kv.key === 'clist:pages-catalog');
        if (catalogKv) {
            try { catalogMeta = await decryptKVJson(encKey, catalogKv.value); } catch {}
        }

        // Collect all published URLs across all collections and standalone pages —
        // this doubles as CList's page/UUID/authorship index.
        const pageMimeToFormat = {
            'application/rss+xml': 'rss', 'text/x-opml': 'opml', 'application/json': 'json',
            'text/html': 'html', 'text/markdown': 'md', 'text/plain': 'text',
        };
        const pages = [];
        for (const kv of (kvs || [])) {
            if (kv.key.startsWith('collection:')) {
                try {
                    const raw = await decryptKVJson(encKey, kv.value);
                    const col = _parseCollectionData(raw);
                    if (!col.publishedUrls?.length) continue;
                    const colName = col.title || kv.key.replace(/^collection:/, '');
                    for (const pub of col.publishedUrls) {
                        pages.push({ name: colName, ...pub, id: col.id });
                    }
                } catch {}
            } else if (kv.key.startsWith('page:')) {
                try {
                    const rec = await decryptKVJson(encKey, kv.value);
                    if (!rec.url) continue;
                    pages.push({
                        name: rec.title || kv.key.replace(/^page:/, ''),
                        url: rec.url,
                        serviceId: rec.serviceId,
                        format: pageMimeToFormat[rec.mimeType] || 'html',
                        service: rec.service,
                        accountInstance: rec.accountInstance,
                        publishedAt: rec.publishedAt,
                        id: rec.id,
                    });
                } catch {}
            }
        }
        if (!pages.length) return;
        pages.sort((a, b) => (b.publishedAt || '').localeCompare(a.publishedAt || ''));

        const binPublisher = window.CList.binPublishers?.['CListBin'];
        if (!binPublisher) return;

        const opmlContent = _generateCatalogOPML(pages);
        const apContent   = _generateCatalogAP(pages);

        assertSession();
        if (catalogMeta.opmlServiceId) {
            const r = await binPublisher.update(catalogMeta.opmlServiceId, opmlContent, 'application/xml', binAccount);
            catalogMeta.opmlUrl = r.url;
        } else {
            const r = await binPublisher.publish(opmlContent, 'application/xml', 'pages.opml', binAccount);
            catalogMeta.opmlServiceId = r.serviceId;
            catalogMeta.opmlUrl = r.url;
        }

        assertSession();
        if (catalogMeta.apServiceId) {
            const r = await binPublisher.update(catalogMeta.apServiceId, apContent, 'application/json', binAccount);
            catalogMeta.apUrl = r.url;
        } else {
            const r = await binPublisher.publish(apContent, 'application/json', 'pages.json', binAccount);
            catalogMeta.apServiceId = r.serviceId;
            catalogMeta.apUrl = r.url;
        }

        // Save catalog meta so the next publish can update in place and DID update can read the URLs
        const encrypted = await encryptWithKey(encKey, JSON.stringify(catalogMeta));
        assertSession();
        await window.CList.storage.kv.put('clist:pages-catalog', encrypted);
    } catch (e) {
        console.error('[pages catalog] update failed:', e);
        if (throwOnError) throw e;
    }
}

function _generateCatalogOPML(pages) {
    const mimeTypes = { rss: 'rss', opml: 'link', json: 'link', html: 'link', md: 'link', text: 'link' };
    const username = window.CList.state?.username || '';
    const outlines = pages.map(p => {
        const t = escapeHtml(p.name);
        const u = escapeHtml(p.url);
        const type = mimeTypes[p.format] || 'link';
        return `    <outline text="${t}" type="${type}" xmlUrl="${u}" htmlUrl="${u}" datePublished="${escapeHtml(p.publishedAt || '')}" clistId="${escapeHtml(p.id || '')}"/>`;
    }).join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>${escapeHtml(username ? username + "'s Published Pages" : 'Published Pages')}</title>
    <dateCreated>${new Date().toUTCString()}</dateCreated>
  </head>
  <body>
${outlines}
  </body>
</opml>`;
}

function _generateCatalogAP(pages) {
    const mimeTypeMap = {
        rss:  'application/rss+xml',
        opml: 'text/x-opml',
        json: 'application/json',
        html: 'text/html',
        md:   'text/markdown',
        text: 'text/plain',
    };
    const attributedTo = window.CList.state?.username || undefined;
    const items = pages.map(p => ({
        type: 'Create',
        published: p.publishedAt || new Date().toISOString(),
        attributedTo,
        object: {
            id: p.id || undefined,
            type: 'Article',
            name: p.name,
            url:  p.url,
            mediaType: mimeTypeMap[p.format] || 'text/html',
        },
    }));
    return JSON.stringify({
        '@context': 'https://www.w3.org/ns/activitystreams',
        type: 'OrderedCollection',
        totalItems: items.length,
        orderedItems: items,
    }, null, 2);
}

// ── Collection publish ───────────────────────────────────────────────────────

// Public bridge: open an already-parsed {title, items, id} collection shape
// (see collection-formats.js's parsers) in the collection editor. Called by
// external modules (e.g. collection-formats.js's _offerCollectionChoice,
// dropbox.js) that cannot access module-private variables like
// _activeCollection directly.
window.openParsedAsCollection = async function (parsed, page = null, isCurrent = () => true) {
    if (!isCurrent()) return false;
    // Reuse an identity already embedded in the file (Part B) instead of
    // discarding it on load.
    const publication = page?.kind === 'collection' ? structuredClone(page) : null;
    const identity = _resolveCollectionIdentity(publication?.collectionKey, publication?.id || parsed.id);
    const key = publication?.collectionKey || identity.key, id = identity.id;
    if (publication && !publication.id) publication.id = id;
    const previous = _activeCollection;
    const target = { col: { key, id, name: parsed.title, items: parsed.items }, token: null, encKey: null };
    _activeCollection = target;
    const restore = () => { if (_activeCollection === target) _activeCollection = previous; };
    try {
        const mounting = typeof initializeEditor === 'function' ? initializeEditor('collection') : true;
        const switchId = window.CList.state.editorSwitching?.id;
        const initialized = await mounting;
        if (!isCurrent() || switchId !== window.CList.state.editorSwitching?.id) { restore(); return false; }
        if (initialized === false) throw new Error('Collection editor initialization failed.');
        if (typeof setLoadedPage === 'function') setLoadedPage(publication);
        if (publication && typeof closeLoadSurfaces === 'function') closeLoadSurfaces();
        else if (typeof closeRightPane === 'function') closeRightPane();
        return true;
    } catch (error) { restore(); throw error; }
};

// Public bridge: parse text as OPML or RSS and open in the collection editor.
// Called by external modules (e.g. dropbox.js) that cannot access module-private variables.
// Returns true if the format was recognised, false otherwise.
window.loadCollectionText = async function (text, filename) {
    const detected = recognizeSavedContent(text, '', filename);
    if (!detected.collection) return false;
    const parsed = detected.collection;
    await window.openParsedAsCollection(parsed);
    return true;
};
