console.log('[collections] collections.js loading');
// collections.js — kvstore-backed collections for CList
// Depends on: utilities.js (escapeHtml, getSiteSpecificCookie, showStatusMessage),
//             kvstore.js (getEncKey), crypto_utils.js (encryptWithKey, decryptWithKey),
//             editors.js (currentEditor), tinymce.js (displayReferences)
// window.CList.config.flaskSiteUrl is a global set in index.html

// ── Collections ──────────────────────────────────────────────────────────────
// Items are saved directly to kvstore under keys collection:<name>.
// Collection names are restricted to letters, digits, #, -, _, and spaces.

const _COLLECTION_NAME_RE = /^[a-zA-Z0-9#\-_ ]+$/;

let _collectionsPopstateHandler = null;
let _activeCollection = null; // set by load button; read by showCollectionEditorPanel
let _draftItems = null;       // live reference to the editor's item array; set by _renderCollectionEditor
let _refreshEditor = null;    // callback to re-render the entry list; set by _renderCollectionEditor
let _idDisplayEl   = null;    // the UUID-display element; set by _renderCollectionEditor

// Refresh the UUID-display element from _activeCollection — called whenever
// Save/Publish assigns a fresh identity to a collection that didn't have one yet.
function _refreshIdDisplay() {
    if (!_idDisplayEl) return;
    const id = _activeCollection?.col?.id;
    _idDisplayEl.textContent = id ? `ID: ${id}` : 'Not yet saved — an ID will be assigned on first save.';
}

// Format registry — add an entry here to expose a new output format in the collection editor.
// Each entry: { label, ext, mimeType, serialize(name, items, id) → string }
// `id` is the collection's own urn:uuid identity (see docs/identification-model-v1.01.md) —
// embedded per format using the most standard mechanism each one supports, so a page keeps
// its identity when read back without CList's own kvstore record (see _collectionFormatParsers
// below for the matching read side). Falsy id → identity field/element is simply omitted.
const collectionFormats = {
    rss: {
        label: 'RSS', ext: 'xml', mimeType: 'application/rss+xml',
        serialize(name, items, id) {
            const safe = items.filter(i => i.url);
            const itemsXml = safe.map(item => {
                const t = escapeHtml(_collectionItemDisplayTitle(item) || item.url);
                const l = escapeHtml(item.url);
                const d = item.summary    ? `\n    <description>${escapeHtml(item.summary)}</description>`       : '';
                const a = item.author_name ? `\n    <author>${escapeHtml(item.author_name)}</author>`            : '';
                return `  <item>\n    <title>${t}</title>\n    <link>${l}</link>${d}${a}\n  </item>`;
            }).join('\n');
            // Dublin Core RSS extension — dc:identifier is the standard way to carry a
            // persistent identifier on an RSS channel.
            const idXml = id ? `\n    <dc:identifier>${escapeHtml(id)}</dc:identifier>` : '';
            return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/">\n  <channel>\n    <title>${escapeHtml(name)}</title>\n    <link></link>\n    <description>${escapeHtml(name)}</description>${idXml}\n${itemsXml}\n  </channel>\n</rss>`;
        },
    },
    opml: {
        label: 'OPML', ext: 'opml', mimeType: 'text/x-opml',
        serialize(name, items, id) {
            const safe = items.filter(i => i.url);
            const outlines = safe.map(item => {
                const t = escapeHtml(_collectionItemDisplayTitle(item) || item.url);
                const u = escapeHtml(item.url);
                return `    <outline text="${t}" type="rss" xmlUrl="${u}" htmlUrl="${u}"/>`;
            }).join('\n');
            // OPML 2.0 has no native document-identity field. <id> is a documented
            // CList-specific extension inside <head> — unknown elements are ignored by
            // conforming OPML parsers, so this is safe to add.
            const idXml = id ? `\n    <id>${escapeHtml(id)}</id>` : '';
            return `<?xml version="1.0" encoding="UTF-8"?>\n<opml version="2.0">\n  <head>\n    <title>${escapeHtml(name)}</title>\n    <dateCreated>${new Date().toUTCString()}</dateCreated>${idXml}\n  </head>\n  <body>\n${outlines}\n  </body>\n</opml>`;
        },
    },
    json: {
        label: 'JSON', ext: 'json', mimeType: 'application/json',
        serialize(name, items, id) {
            return JSON.stringify({
                ...(id ? { id } : {}),
                title: name,
                publishedAt: new Date().toISOString(),
                items: items.filter(i => i.url).map(item => ({
                    title:      _collectionItemDisplayTitle(item) || '',
                    url:        item.url,
                    author:     item.author_name || '',
                    summary:    item.summary     || '',
                    created_at: item.created_at  || '',
                })),
            }, null, 2);
        },
    },
    html: {
        label: 'HTML', ext: 'html', mimeType: 'text/html',
        serialize(name, items, id) {
            const rows = items.filter(i => i.url).map(item => {
                const t = escapeHtml(_collectionItemDisplayTitle(item) || item.url);
                const u = escapeHtml(item.url);
                const a = item.author_name ? ` — ${escapeHtml(item.author_name)}` : '';
                return `  <li><a href="${u}">${t}</a>${a}</li>`;
            }).join('\n');
            // Dublin Core meta + link rel="identifier" — the convention EPUB/Portable
            // Web Publications use for a document's own persistent identifier.
            const idHtml = id
                ? `\n  <meta name="dcterms.identifier" content="${escapeHtml(id)}">\n  <link rel="identifier" href="${escapeHtml(id)}">`
                : '';
            return `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <title>${escapeHtml(name)}</title>${idHtml}\n</head>\n<body>\n<h1>${escapeHtml(name)}</h1>\n<ul>\n${rows}\n</ul>\n</body>\n</html>`;
        },
    },
    md: {
        label: 'Markdown', ext: 'md', mimeType: 'text/markdown',
        serialize(name, items, id) {
            const lines = items.filter(i => i.url).map(item => {
                const t = _collectionItemDisplayTitle(item) || item.url;
                const a = item.author_name ? ` — ${item.author_name}` : '';
                return `- [${t}](${item.url})${a}`;
            });
            // YAML front matter — the de facto standard for Markdown document metadata
            // (Jekyll/Hugo/etc.).
            const front = id ? `---\nid: ${id}\ntitle: ${name}\n---\n\n` : '';
            return `${front}# ${name}\n\n${lines.join('\n')}\n`;
        },
    },
    text: {
        label: 'Text', ext: 'txt', mimeType: 'text/plain',
        serialize(name, items, id) {
            const lines = items.filter(i => i.url).map(item => {
                const t = _collectionItemDisplayTitle(item) || item.url;
                const a = item.author_name ? ` (${item.author_name})` : '';
                return `${t}${a}\n${item.url}`;
            });
            // Plain text has no metadata standard at all — this leading line is an
            // acknowledged CList-specific convention, not a real standard.
            const idLine = id ? `ID: ${id}\n\n` : '';
            return `${idLine}${name}\n${'='.repeat(name.length || 10)}\n\n${lines.join('\n\n')}\n`;
        },
    },
};

// Returns a human-readable display title for a collection item.
// Social platform items (Mastodon, Bluesky) show "Platform (@handle)" instead
// of the bare service name stored in item.title.
function _collectionItemDisplayTitle(item) {
    const isSocial = item.service === 'Mastodon' || item.service === 'Bluesky'
        || item.title   === 'Mastodon' || item.title   === 'Bluesky';
    if (!isSocial) return item.title || item.url || '';
    const platform = item.title || item.service || 'Social';
    if (item.author_id)   return `${platform} (@${item.author_id})`;
    if (item.author_name) return `${platform} (${item.author_name})`;
    return platform;
}

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
    if (!token) { showStatusMessage('Please log in to save to a collection.'); return; }

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

        const resp = await fetch(`${window.CList.config.flaskSiteUrl}/get_kvs/`, {
            headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!resp.ok) throw new Error(`kvstore error ${resp.status}`);
        const kvs = await resp.json();

        const collections = [];
        for (const kv of (kvs || [])) {
            if (!kv.key.startsWith('collection:')) continue;
            let colData = { id: null, title: null, items: [], publishedUrls: [] };
            try { colData = _parseCollectionData(JSON.parse(await decryptWithKey(encKey, kv.value))); } catch {}
            collections.push({ key: kv.key, title: colData.title || kv.key.replace(/^collection:/, ''), colData });
        }

        picker.innerHTML = '';
        _buildCollectionPickerContents(picker, collections, async (title, col) => {
            try {
                const colData = col ? col.colData : { items: [], publishedUrls: [] };
                const specificEl = document.getElementById(itemId);
                const ref   = specificEl?.reference || {};
                const url   = ref.url   || '';
                const itemTitle = ref.title || url || itemId;
                if (url && colData.items.some(i => i.url === url)) {
                    showStatusMessage(`Already in "${title}".`);
                    picker.remove();
                    return;
                }
                colData.items.push({ id: itemId, title: itemTitle, url, ...ref });
                const identity = col ? _resolveCollectionIdentity(col.key, colData.id) : _newCollectionIdentity();
                await _kvSaveItems(identity.key, identity.id, title, colData.items, token, encKey, colData.publishedUrls);
                document.getElementById(`collect-btn-${itemId}`)?.classList.add('action-active');
                picker.remove();
                showStatusMessage(`Added to "${title}".`);
            } catch (e) {
                console.error('[collection] add failed', e);
                showStatusMessage('Could not add to collection: ' + e.message);
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
function _parseCollectionData(raw) {
    if (Array.isArray(raw)) return { id: null, title: null, items: raw, publishedUrls: [] };
    return { id: raw.id || null, title: raw.title || null, items: raw.items || [], publishedUrls: raw.publishedUrls || [] };
}

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

// Encrypt items and upsert to kvstore under an explicit key (add_kv, fallback
// update_kv on 409). Collections are identified by this key, not by title —
// renaming the title and saving must always target the same key.
async function _kvSaveItems(key, id, title, items, token, encKey, publishedUrls = []) {
    const encrypted = await encryptWithKey(encKey, JSON.stringify({ id, title, items, publishedUrls }));
    const kvPayload = { key, value: encrypted };
    const kvHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
    let resp = await fetch(`${window.CList.config.flaskSiteUrl}/add_kv/`, {
        method: 'POST', headers: kvHeaders, body: JSON.stringify(kvPayload),
    });
    if (resp.status === 409) {
        resp = await fetch(`${window.CList.config.flaskSiteUrl}/update_kv/`, {
            method: 'POST', headers: kvHeaders, body: JSON.stringify(kvPayload),
        });
    }
    if (!resp.ok) throw new Error(`kvstore error ${resp.status}`);
}

// Populate a .collection-picker div with existing collection buttons + new-name row.
// onSelect(name, encValue) is called when the user picks or creates a collection.
// anchorEl is excluded from the outside-click handler (pass null if not needed).
function _buildCollectionPickerContents(picker, collections, onSelect, anchorEl) {
    const outsideHandler = (e) => {
        if (!picker.contains(e.target) && e.target !== anchorEl) {
            picker.remove();
            document.removeEventListener('click', outsideHandler, true);
        }
    };
    setTimeout(() => document.addEventListener('click', outsideHandler, true), 0);

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
        if (!name) { showStatusMessage('Please enter a collection name.'); return; }
        if (!_COLLECTION_NAME_RE.test(name)) {
            showStatusMessage('Name may only contain letters, digits, spaces, #, -, and _.');
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
    if (!items?.length) { showStatusMessage('This collection is empty.'); return; }

    // ── Open the collection, as a collection, in the Collection editor ───────
    // (the only place its id/UUID is ever displayed — see _renderCollectionEditor).
    const openInCollectionEditor = async () => {
        _activeCollection = { col, token, encKey };
        const titleEl = document.getElementById('write-title');
        if (titleEl) titleEl.textContent = col.name || '';
        if (typeof currentEditor !== 'undefined' && currentEditor === 'collection') {
            const container = document.getElementById('collectionEditorDiv');
            if (container) _renderCollectionEditor(container, col, token, encKey);
        } else if (typeof initializeEditor === 'function') {
            await initializeEditor('collection');
        }
    };

    // ── Legacy behaviour: flatten the collection into paragraph text in the
    // current editor and push every item into the reference list. Kept as an
    // explicit choice (not the Collection editor) for quoting a reading list
    // into a post.
    const insertAsText = () => {
        const isHtmlEditor = (typeof currentEditor !== 'undefined' && currentEditor === 'tinymce');
        const filteredItems = items.filter(item => item.url);

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
        for (const item of items) {
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
    insertBtn.onclick = () => { document.getElementById('generic-modal')?.remove(); insertAsText(); };
    row.appendChild(insertBtn);

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn btn-secondary';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.onclick = () => document.getElementById('generic-modal')?.remove();
    row.appendChild(cancelBtn);

    box.appendChild(row);
    showModal(box, { hideDefaultClose: true });
}

// Remove one item from a collection in kvstore and update the UI in place.
async function _removeItemFromCollection(col, itemUrl, token, encKey, countSpan, itemsDiv) {
    try {
        col.items = col.items.filter(i => i.url !== itemUrl);
        const encrypted = await encryptWithKey(encKey, JSON.stringify({ id: col.id, title: col.name, items: col.items, publishedUrls: col.publishedUrls || [] }));
        const resp = await fetch(`${window.CList.config.flaskSiteUrl}/update_kv/`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body:    JSON.stringify({ key: col.key, value: encrypted }),
        });
        if (!resp.ok) throw new Error(`kvstore error ${resp.status}`);
        countSpan.textContent = `${col.items.length} item${col.items.length !== 1 ? 's' : ''}`;
        _renderCollectionItems(col, token, encKey, countSpan, itemsDiv);
        showStatusMessage('Item removed.');
    } catch (e) {
        console.error('[collection] remove item failed', e);
        showStatusMessage('Could not remove item: ' + e.message);
    }
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
                removeBtn.onclick   = () => _removeItemFromCollection(col, item.url, token, encKey, countSpan, itemsDiv);
                clistActions.appendChild(removeBtn);
            }

            itemsDiv.appendChild(el);
        } catch (err) {
            console.error('Collection: could not render item', item.url, err);
        }
    }

    window.checkAnnotationsBatch?.();
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
    collabBtn.onclick   = () => {
        if (typeof window.openCollabWithCollection === 'function') {
            window.openCollabWithCollection(col.name, col.items);
        } else {
            showStatusMessage('Collab editor not available.');
        }
    };

    const shareBtn = document.createElement('button');
    shareBtn.className = 'clist-action-btn chat-only-btn';
    shareBtn.title     = 'Share to chat';
    shareBtn.innerHTML = '<span class="material-icons md-18 md-light">chat</span>';
    shareBtn.onclick   = () => {
        const items = col.items.map(i => ({ title: _collectionItemDisplayTitle(i), url: i.url }));
        sendShareMessage('collection', null, col.name, null, { items });
    };

    rightZone.appendChild(collabBtn);
    rightZone.appendChild(shareBtn);
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

// Only a well-formed urn:uuid identifier is trusted as an identity — anything else
// (missing, malformed, someone else's unrelated scheme) is ignored and a fresh
// identity is minted instead, same as a page with no id at all.
const _URN_UUID_RE = /^urn:uuid:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function _validUrnUuid(value) {
    return typeof value === 'string' && _URN_UUID_RE.test(value) ? value : undefined;
}

function _parseCollectionJSON(text) {
    const data  = JSON.parse(text);
    const items = (data.items || [])
        .map(i => ({ title: i.title || i.url || '', url: i.url || '', author_name: i.author || '', summary: i.summary || '' }))
        .filter(i => i.url);
    return { title: data.title || 'Imported collection', items, id: _validUrnUuid(data.id) };
}

function _parseCollectionOPML(text) {
    const doc      = new DOMParser().parseFromString(text, 'text/xml');
    const titleEl  = doc.querySelector('head > title');
    const title    = titleEl?.textContent?.trim() || 'Imported collection';
    const id       = _validUrnUuid(doc.querySelector('head > id')?.textContent?.trim());
    const items    = [...doc.querySelectorAll('body > outline')]
        .map(o => ({
            title: o.getAttribute('text') || o.getAttribute('title') || '',
            url:   o.getAttribute('xmlUrl') || o.getAttribute('htmlUrl') || '',
        }))
        .filter(i => i.url);
    return { title, items, id };
}

function _parseCollectionHTML(text) {
    const doc   = new DOMParser().parseFromString(text, 'text/html');
    const title = doc.querySelector('h1')?.textContent?.trim()
        || doc.querySelector('title')?.textContent?.trim()
        || 'Imported collection';
    const id    = _validUrnUuid(doc.querySelector('link[rel="identifier"]')?.getAttribute('href')?.trim())
        || _validUrnUuid(doc.querySelector('meta[name="dcterms.identifier"]')?.getAttribute('content')?.trim());
    const items = [...doc.querySelectorAll('ul li a')]
        .map(a => ({ title: a.textContent.trim(), url: a.href }))
        .filter(i => i.url && !i.url.startsWith('javascript'));
    return { title, items, id };
}

function _parseCollectionRSS(text) {
    const doc   = new DOMParser().parseFromString(text, 'text/xml');
    const titleEl = doc.querySelector('channel > title, feed > title');
    const title   = titleEl?.textContent?.trim() || 'Imported feed';
    const id      = _validUrnUuid(
        doc.querySelector('channel > dc\\:identifier, feed > dc\\:identifier')?.textContent?.trim()
    );
    const rssItems  = [...doc.querySelectorAll('item')].map(item => ({
        title:       item.querySelector('title')?.textContent?.trim() || '',
        url:         item.querySelector('link')?.textContent?.trim() || '',
        author_name: item.querySelector('author')?.textContent?.trim()
            || item.querySelector('dc\\:creator')?.textContent?.trim() || '',
        summary:     item.querySelector('description')?.textContent?.trim() || '',
    }));
    const atomItems = [...doc.querySelectorAll('entry')].map(entry => ({
        title:       entry.querySelector('title')?.textContent?.trim() || '',
        url:         entry.querySelector('link')?.getAttribute('href') || '',
        author_name: entry.querySelector('author > name')?.textContent?.trim() || '',
        summary:     entry.querySelector('summary, content')?.textContent?.trim() || '',
    }));
    const items = (rssItems.length ? rssItems : atomItems).filter(i => i.url);
    return { title, items, id };
}

// Formats that round-trip back into collection items — used by My Pages' "Load into
// collection editor" action. md/text are export-only (no parser), so they're left out.
const _collectionFormatParsers = {
    rss:  _parseCollectionRSS,
    opml: _parseCollectionOPML,
    json: _parseCollectionJSON,
    html: _parseCollectionHTML,
};

function _detectFormat(contentType, url) {
    if (contentType?.includes('json'))                         return 'json';
    if (contentType?.includes('opml'))                         return 'opml';
    if (contentType?.includes('html'))                         return 'html';
    if (contentType?.includes('rss') || contentType?.includes('atom') || contentType?.includes('xml'))
        return 'rss';
    const lower = (url || '').toLowerCase().split('?')[0];
    if (lower.endsWith('.json'))                               return 'json';
    if (lower.endsWith('.opml'))                               return 'opml';
    if (lower.endsWith('.rss') || lower.endsWith('.atom') || lower.endsWith('.xml')) return 'rss';
    if (lower.endsWith('.html') || lower.endsWith('.htm'))     return 'html';
    if (lower.endsWith('.md') || lower.endsWith('.txt'))       return 'text';
    return 'json'; // default guess
}

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
        if (!name) { showStatusMessage('Please enter a collection name.'); return; }
        if (!_COLLECTION_NAME_RE.test(name)) {
            showStatusMessage('Name may only contain letters, digits, spaces, #, -, and _.');
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
            showStatusMessage('Could not save: ' + e.message);
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

// List all saved collections from kvstore.
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
        const resp = await fetch(`${window.CList.config.flaskSiteUrl}/get_kvs/`, {
            headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!resp.ok) throw new Error(`kvstore error ${resp.status}`);
        const kvs = await resp.json();

        const encKey = await getEncKey(window.CList.config.flaskSiteUrl);
        if (!encKey) throw new Error('Encryption key not available — please log in again.');

        const collections = [];
        for (const kv of (kvs || [])) {
            if (!kv.key.startsWith('collection:')) continue;
            try {
                const raw = JSON.parse(await decryptWithKey(encKey, kv.value));
                const colData = _parseCollectionData(raw);
                collections.push({ key: kv.key, id: colData.id, name: colData.title || kv.key.replace(/^collection:/, ''), items: colData.items, publishedUrls: colData.publishedUrls });
            } catch { /* skip corrupt entries */ }
        }

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
            const wrapper = document.createElement('div');
            wrapper.className = 'saved-collection-wrapper';

            // ── Summary row ──
            const row = document.createElement('div');
            row.className = 'saved-collection-row';

            const nameSpan = document.createElement('span');
            nameSpan.className   = 'saved-collection-name';
            nameSpan.textContent = col.name;
            nameSpan.title       = 'View / edit items';
            nameSpan.onclick     = () => _showCollectionDetail(col, token, encKey);

            const countSpan = document.createElement('span');
            countSpan.className   = 'saved-collection-count';
            countSpan.textContent = `${col.items.length} item${col.items.length !== 1 ? 's' : ''}`;

            const editBtn = document.createElement('button');
            editBtn.className = 'clist-action-btn';
            editBtn.title     = 'View / edit items';
            editBtn.innerHTML = '<span class="material-icons md-18 md-light">edit</span>';
            editBtn.onclick   = () => _showCollectionDetail(col, token, encKey);

            // Delete button — two-step confirmation
            const delBtn = document.createElement('button');
            delBtn.className = 'clist-action-btn';
            delBtn.title     = 'Delete this collection';
            delBtn.innerHTML = '<span class="material-icons md-18 md-light">delete_outline</span>';

            const confirmRow = document.createElement('div');
            confirmRow.className    = 'collection-delete-confirm';
            confirmRow.style.display = 'none';

            const confirmLabel = document.createElement('span');
            confirmLabel.textContent = `Delete "${col.name}"? `;

            const yesBtn = document.createElement('button');
            yesBtn.className   = 'btn collection-confirm-btn';
            yesBtn.textContent = 'Delete';
            yesBtn.onclick     = async () => {
                try {
                    const delResp = await fetch(`${window.CList.config.flaskSiteUrl}/delete_kv/`, {
                        method:  'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                        body:    JSON.stringify({ key: col.key }),
                    });
                    if (!delResp.ok) throw new Error(`kvstore error ${delResp.status}`);
                    showStatusMessage(`Collection "${col.name}" deleted.`);
                    window.showSavedCollections();
                } catch (e) {
                    console.error('[collection] delete failed', e);
                    showStatusMessage('Could not delete: ' + e.message);
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
            if (!url) { showStatusMessage('Please paste a URL to import.'); return; }
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

// ── My Pages loader ───────────────────────────────────────────────────────────
(function () {
    window.CList.loaders = window.CList.loaders || [];
    window.CList.loaders.push({
        label:   'My Pages',
        icon:    'cloud_done',
        visible: () => !!getSiteSpecificCookie(window.CList.config.flaskSiteUrl, window.CList.keys.ACCESS_TOKEN),
        load:    async () => {
            const token = getSiteSpecificCookie(window.CList.config.flaskSiteUrl, window.CList.keys.ACCESS_TOKEN);
            if (!token) {
                showStatusMessage('Please log in to view your published pages.');
                return null;
            }

            // Rendered in a wide, centered modal with its own header row (title +
            // close button), matching the app's standard panel-header convention
            // (#write-load-header) rather than showModal()'s generic Close button.
            const optionsDiv = document.createElement('div');
            optionsDiv.className = 'published-pages-modal';

            const headerRow = document.createElement('div');
            headerRow.className = 'modal-header-row';
            const headerTitle = document.createElement('h2');
            headerTitle.textContent = 'Published pages';
            const headerCloseBtn = document.createElement('button');
            headerCloseBtn.textContent = 'X';
            headerCloseBtn.onclick = () => document.getElementById('generic-modal')?.remove();
            headerRow.appendChild(headerTitle);
            headerRow.appendChild(headerCloseBtn);
            optionsDiv.appendChild(headerRow);

            const body = document.createElement('div');
            body.innerHTML = '<p class="list-tip">Loading published pages…</p>';
            optionsDiv.appendChild(body);

            showModal(optionsDiv, { wide: true, hideDefaultClose: true });

            try {
                const encKey = await getEncKey(window.CList.config.flaskSiteUrl);
                if (!encKey) throw new Error('Encryption key not available');

                const resp = await fetch(`${window.CList.config.flaskSiteUrl}/get_kvs/`, {
                    headers: { 'Authorization': `Bearer ${token}` },
                });
                if (!resp.ok) throw new Error(`kvstore error ${resp.status}`);
                const kvs = await resp.json();

                const pages = [];
                for (const kv of (kvs || [])) {
                    if (kv.key.startsWith('collection:')) {
                        try {
                            const raw = JSON.parse(await decryptWithKey(encKey, kv.value));
                            const col = _parseCollectionData(raw);
                            if (!col.publishedUrls?.length) continue;
                            const colName = col.title || kv.key.replace(/^collection:/, '');
                            for (const pub of col.publishedUrls) {
                                pages.push({ kind: 'collection', collectionKey: kv.key, id: col.id, title: colName, ...pub });
                            }
                        } catch { /* skip corrupt entries */ }
                    } else if (kv.key.startsWith('page:')) {
                        try {
                            const rec = JSON.parse(await decryptWithKey(encKey, kv.value));
                            const format = (rec.mimeType || '').split('/')[1]?.toUpperCase() || '';
                            pages.push({ kind: 'page', pageKey: kv.key, format, ...rec });
                        } catch { /* skip corrupt entries */ }
                    }
                }

                body.innerHTML = '';

                if (!pages.length) {
                    const empty = document.createElement('p');
                    empty.className   = 'list-tip';
                    empty.textContent = 'No published pages yet — publish a collection to get started.';
                    body.appendChild(empty);
                    return null;
                }

                // ── Sort + pagination state — sort reorders the whole `pages`
                // array, not just the rows currently shown; pagination slices the
                // sorted array per renderBody() call. ──
                let sortKey  = 'date', sortDir = 'desc';
                let pageSize = 40,     pageIndex = 0;

                const columns = [
                    { key: 'format', label: 'Format' },
                    { key: 'date',   label: 'Date' },
                    { key: null,     label: 'Buttons' },
                    { key: 'title',  label: 'Title' },
                ];

                const table  = document.createElement('table');
                table.className = 'published-pages-table';
                const thead   = document.createElement('thead');
                const headRow = document.createElement('tr');
                const thEls   = {};

                columns.forEach(col => {
                    const th = document.createElement('th');
                    th.textContent = col.label;
                    if (!col.key) {
                        th.className = 'no-sort';
                    } else {
                        thEls[col.key] = th;
                        th.onclick = () => {
                            if (sortKey === col.key) {
                                sortDir = sortDir === 'asc' ? 'desc' : 'asc';
                            } else {
                                sortKey  = col.key;
                                sortDir  = 'asc';
                            }
                            pageIndex = 0;
                            renderBody();
                        };
                    }
                    headRow.appendChild(th);
                });
                thead.appendChild(headRow);
                table.appendChild(thead);

                const tbody = document.createElement('tbody');
                table.appendChild(tbody);
                body.appendChild(table);

                const pagination = document.createElement('div');
                pagination.className = 'published-pages-pagination';
                body.appendChild(pagination);

                function getSortValue(page, key) {
                    if (key === 'date')   return page.publishedAt || '';
                    if (key === 'format') return (page.format || '').toLowerCase();
                    if (key === 'title')  return (page.title || page.url || '').toLowerCase();
                    return '';
                }

                function getSorted() {
                    const sorted = [...pages].sort((a, b) => {
                        const av = getSortValue(a, sortKey);
                        const bv = getSortValue(b, sortKey);
                        if (av < bv) return -1;
                        if (av > bv) return 1;
                        return 0;
                    });
                    if (sortDir === 'desc') sorted.reverse();
                    return sorted;
                }

                function buildRow(page) {
                    const tr = document.createElement('tr');

                    const formatTd = document.createElement('td');
                    if (page.format) {
                        const fmt = document.createElement('span');
                        fmt.className   = 'published-page-badge';
                        fmt.textContent = page.format.toUpperCase();
                        formatTd.appendChild(fmt);
                    }
                    if (page.service) {
                        const svc = document.createElement('span');
                        svc.className   = 'published-page-badge badge-service';
                        svc.textContent = page.service;
                        formatTd.appendChild(svc);
                    }
                    if (page.savedLocally && !page.url) {
                        const local = document.createElement('span');
                        local.className   = 'published-page-badge badge-service';
                        local.textContent = 'Local only';
                        formatTd.appendChild(local);
                    }
                    tr.appendChild(formatTd);

                    const dateTd = document.createElement('td');
                    if (page.publishedAt) {
                        dateTd.className   = 'published-page-date';
                        dateTd.textContent = page.publishedAt.slice(0, 10);
                    }
                    tr.appendChild(dateTd);

                    // Action buttons
                    const actionsTd = document.createElement('td');
                    const actions = document.createElement('div');
                    actions.className = 'published-page-actions';

                    if (page.kind === 'page' && page.url) {
                        const loadBtn = document.createElement('button');
                        loadBtn.className = 'clist-action-btn';
                        loadBtn.title     = 'Load into editor';
                        loadBtn.innerHTML = '<span class="material-icons md-18 md-light">input</span>';
                        loadBtn.onclick   = async () => {
                            try {
                                const fetched = await fetch(page.url);
                                if (!fetched.ok) throw new Error(`fetch error ${fetched.status}`);
                                const text = await fetched.text();
                                if (typeof loadSavedPage === 'function') {
                                    await loadSavedPage({ type: page.mimeType, value: text }, page, optionsDiv);
                                }
                            } catch (e) {
                                console.error('[mypages] load into editor failed', e);
                                showStatusMessage('Could not load page: ' + e.message);
                            }
                        };
                        actions.appendChild(loadBtn);
                    }

                    if (page.kind === 'collection' && _collectionFormatParsers[page.format]) {
                        const loadBtn = document.createElement('button');
                        loadBtn.className = 'clist-action-btn';
                        loadBtn.title     = 'Load into collection editor';
                        loadBtn.innerHTML = '<span class="material-icons md-18 md-light">input</span>';
                        loadBtn.onclick   = async () => {
                            try {
                                const fetched = await fetch(page.url);
                                if (!fetched.ok) throw new Error(`fetch error ${fetched.status}`);
                                const text   = await fetched.text();
                                const parsed = _collectionFormatParsers[page.format](text);
                                _activeCollection = { col: { key: page.collectionKey, id: page.id, name: parsed.title, items: parsed.items }, token: null, encKey: null };
                                if (typeof initializeEditor === 'function') await initializeEditor('collection');
                                if (typeof setLoadedPage === 'function') setLoadedPage(page);
                                if (typeof closeLoadSurfaces === 'function') closeLoadSurfaces();
                            } catch (e) {
                                console.error('[mypages] load collection into editor failed', e);
                                showStatusMessage('Could not load collection: ' + e.message);
                            }
                        };
                        actions.appendChild(loadBtn);
                    }

                    if (page.url) {
                        const openBtn = document.createElement('button');
                        openBtn.className = 'clist-action-btn';
                        openBtn.title     = 'Open in new tab';
                        openBtn.innerHTML = '<span class="material-icons md-18 md-light">open_in_new</span>';
                        openBtn.onclick   = () => window.open(page.url, '_blank', 'noopener');
                        actions.appendChild(openBtn);

                        const copyBtn = document.createElement('button');
                        copyBtn.className = 'clist-action-btn';
                        copyBtn.title     = 'Copy URL';
                        copyBtn.innerHTML = '<span class="material-icons md-18 md-light">content_copy</span>';
                        copyBtn.onclick   = () => {
                            navigator.clipboard.writeText(page.url).then(
                                () => showStatusMessage('URL copied.'),
                                () => showStatusMessage('Could not copy URL.')
                            );
                        };
                        actions.appendChild(copyBtn);
                    }

                    const delBtn = document.createElement('button');
                    delBtn.className = 'clist-action-btn';
                    delBtn.title     = 'Delete';
                    delBtn.innerHTML = '<span class="material-icons md-18 md-light">delete_outline</span>';

                    // Delete: two-step confirm rendered inline
                    const confirmRow = document.createElement('div');
                    confirmRow.className    = 'published-page-confirm';
                    confirmRow.style.display = 'none';

                    const yesBtn = document.createElement('button');
                    yesBtn.className   = 'btn collection-confirm-btn';
                    yesBtn.textContent = 'Delete';
                    yesBtn.onclick     = async () => {
                        // Optionally remove from remote bin service
                        if (page.serviceId && page.service) {
                            const adapter = window.CList.binPublishers?.[page.service];
                            if (adapter?.delete) {
                                const acct = (window.CList.accounts || [])
                                    .map(a => parseAccountValue(a)).filter(Boolean)
                                    .find(pv => pv.type === page.service && pv.instance === page.accountInstance);
                                if (acct) {
                                    try { await adapter.delete(page.serviceId, acct); }
                                    catch (e) { console.error('[mypages] remote delete failed', e); }
                                }
                            }
                        }
                        if (page.kind === 'page') {
                            // Standalone page — remove its own page:* kvstore entry.
                            try {
                                const delResp = await fetch(`${window.CList.config.flaskSiteUrl}/delete_kv/`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                                    body: JSON.stringify({ key: page.pageKey }),
                                });
                                if (!delResp.ok) throw new Error(`kvstore error ${delResp.status}`);
                                pages.splice(pages.indexOf(page), 1);
                                renderBody();
                                showStatusMessage('Page removed.');
                            } catch (e) {
                                console.error('[mypages] kvstore delete failed', e);
                                showStatusMessage('Could not remove: ' + e.message);
                            }
                            return;
                        }
                        // Published collection — remove this URL from the collection's publishedUrls array
                        try {
                            const getResp = await fetch(`${window.CList.config.flaskSiteUrl}/get_kvs/`, {
                                headers: { 'Authorization': `Bearer ${token}` },
                            });
                            if (!getResp.ok) throw new Error(`kvstore ${getResp.status}`);
                            const allKvs = await getResp.json();
                            const colKv  = (allKvs || []).find(k => k.key === page.collectionKey);
                            if (colKv) {
                                const raw = JSON.parse(await decryptWithKey(encKey, colKv.value));
                                const col = _parseCollectionData(raw);
                                col.publishedUrls = (col.publishedUrls || []).filter(p => p.url !== page.url);
                                const encrypted = await encryptWithKey(encKey, JSON.stringify({ id: col.id, title: col.title, items: col.items, publishedUrls: col.publishedUrls }));
                                await fetch(`${window.CList.config.flaskSiteUrl}/update_kv/`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                                    body: JSON.stringify({ key: colKv.key, value: encrypted }),
                                });
                            }
                            pages.splice(pages.indexOf(page), 1);
                            renderBody();
                            showStatusMessage('Page removed.');
                        } catch (e) {
                            console.error('[mypages] kvstore update failed', e);
                            showStatusMessage('Could not remove: ' + e.message);
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

                    confirmRow.appendChild(document.createTextNode('Delete this page? '));
                    confirmRow.appendChild(yesBtn);
                    confirmRow.appendChild(cancelBtn);

                    actions.appendChild(delBtn);
                    actionsTd.appendChild(actions);
                    actionsTd.appendChild(confirmRow);
                    tr.appendChild(actionsTd);

                    const titleTd = document.createElement('td');
                    titleTd.innerHTML = `<span class="published-page-title"><a href="${escapeHtml(page.url)}" target="_blank" rel="noopener">${escapeHtml(page.title || page.url)}</a></span>`;
                    tr.appendChild(titleTd);

                    return tr;
                }

                function renderBody() {
                    const sorted   = getSorted();
                    const total    = sorted.length;
                    const size     = pageSize === Infinity ? (total || 1) : pageSize;
                    const maxIndex = Math.max(0, Math.ceil(total / size) - 1);
                    if (pageIndex > maxIndex) pageIndex = maxIndex;
                    const start = pageIndex * size;
                    const end   = Math.min(start + size, total);

                    tbody.innerHTML = '';
                    sorted.slice(start, end).forEach(p => tbody.appendChild(buildRow(p)));

                    columns.forEach(col => {
                        if (!col.key) return;
                        const th = thEls[col.key];
                        th.classList.toggle('sort-active', sortKey === col.key);
                        th.innerHTML = '';
                        th.appendChild(document.createTextNode(col.label));
                        if (sortKey === col.key) {
                            const arrow = document.createElement('span');
                            arrow.className   = 'sort-arrow';
                            arrow.textContent = sortDir === 'asc' ? '▲' : '▼';
                            th.appendChild(arrow);
                        }
                    });

                    pagination.innerHTML = '';

                    const rangeText = document.createElement('span');
                    rangeText.textContent = total ? `${start + 1}-${end} of ${total}` : '0 of 0';
                    pagination.appendChild(rangeText);

                    const sizeSelect = document.createElement('select');
                    [20, 40, 100, 'All'].forEach(opt => {
                        const option = document.createElement('option');
                        option.value       = opt;
                        option.textContent = opt === 'All' ? 'All' : String(opt);
                        if ((opt === 'All' && pageSize === Infinity) || opt === pageSize) option.selected = true;
                        sizeSelect.appendChild(option);
                    });
                    sizeSelect.onchange = () => {
                        pageSize  = sizeSelect.value === 'All' ? Infinity : parseInt(sizeSelect.value, 10);
                        pageIndex = 0;
                        renderBody();
                    };
                    pagination.appendChild(sizeSelect);

                    const prevBtn = document.createElement('button');
                    prevBtn.className   = 'btn btn-small';
                    prevBtn.textContent = 'Prev';
                    prevBtn.disabled    = pageIndex === 0;
                    prevBtn.onclick     = () => { pageIndex--; renderBody(); };
                    pagination.appendChild(prevBtn);

                    const nextBtn = document.createElement('button');
                    nextBtn.className   = 'btn btn-small';
                    nextBtn.textContent = 'Next';
                    nextBtn.disabled    = pageIndex >= maxIndex;
                    nextBtn.onclick     = () => { pageIndex++; renderBody(); };
                    pagination.appendChild(nextBtn);
                }

                renderBody();

            } catch (e) {
                console.error('[mypages] load failed', e);
                body.innerHTML = `<p class="list-tip">Could not load pages: ${escapeHtml(e.message)}</p>`;
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
                    const resp = await fetch(url);
                    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                    const contentType = resp.headers.get('Content-Type') || '';
                    const text        = await resp.text();
                    const format      = _detectFormat(contentType, url);

                    if (format === 'rss' || format === 'opml' || format === 'json') {
                        let parsed;
                        if (format === 'rss')       parsed = _parseCollectionRSS(text);
                        else if (format === 'opml') parsed = _parseCollectionOPML(text);
                        else                        parsed = _parseCollectionJSON(text);

                        // Reuse an identity already embedded in the fetched content
                        // (Part B) instead of discarding it — otherwise a page that
                        // already carries a recognized UUID would silently lose it
                        // the moment it's loaded straight into the editor.
                        const { key, id } = _resolveCollectionIdentity(null, parsed.id);
                        _activeCollection = { col: { key, id, name: parsed.title, items: parsed.items }, token: null, encKey: null };
                        if (typeof initializeEditor === 'function') await initializeEditor('collection');
                        if (typeof setLoadedPage === 'function') setLoadedPage(null);
                        if (typeof closeRightPane   === 'function') closeRightPane();
                        resolve(null);
                    } else if (format === 'html') {
                        if (typeof switchToEditor === 'function') {
                            await switchToEditor('tinymce', { type: 'text/html', value: text });
                        }
                        resolve(null);
                    } else {
                        if (typeof switchToEditor === 'function') {
                            await switchToEditor('texteditor', { type: 'text/plain', value: text });
                        }
                        resolve(null);
                    }
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
        showStatusMessage('No collection is open in the editor.');
        return;
    }
    const url = reference?.url || '';
    if (!url) { showStatusMessage('This item has no URL and cannot be added to a collection.'); return; }
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
    if (!token) { showStatusMessage('Please log in to save to a collection.'); return; }

    const picker = document.createElement('div');
    picker.className = 'collection-picker';
    picker.innerHTML = '<p class="feed-status-message">Loading…</p>';
    anchorEl.insertAdjacentElement('afterend', picker);

    try {
        const encKey = await getEncKey(window.CList.config.flaskSiteUrl);
        if (!encKey) throw new Error('Encryption key not available — please log in again.');
        const resp = await fetch(`${window.CList.config.flaskSiteUrl}/get_kvs/`, {
            headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!resp.ok) throw new Error(`kvstore error ${resp.status}`);
        const kvs = await resp.json();
        const collections = [];
        for (const kv of (kvs || [])) {
            if (!kv.key.startsWith('collection:')) continue;
            let colData = { id: null, title: null, items: [], publishedUrls: [] };
            try { colData = _parseCollectionData(JSON.parse(await decryptWithKey(encKey, kv.value))); } catch {}
            collections.push({ key: kv.key, title: colData.title || kv.key.replace(/^collection:/, ''), colData });
        }

        picker.innerHTML = '';

        async function onPickerSelect(title, col) {
            if (col) {
                // Existing collection — show conflict dialog
                const existing = col.colData;
                const existingUrls = new Set(existing.items.map(i => i.url).filter(Boolean));
                const toAdd = items.filter(i => i.url && !existingUrls.has(i.url));
                const identity = _resolveCollectionIdentity(col.key, existing.id);
                _buildCollectionConflictUI(picker, title,
                    async () => {
                        try {
                            await _kvSaveItems(identity.key, identity.id, title, items, token, encKey, existing.publishedUrls);
                            picker.remove();
                            showStatusMessage(`Saved as "${title}".`);
                        } catch (e) {
                            console.error('[collection] overwrite failed', e);
                            showStatusMessage('Could not save: ' + e.message);
                        }
                    },
                    async () => {
                        try {
                            await _kvSaveItems(identity.key, identity.id, title, [...existing.items, ...toAdd], token, encKey, existing.publishedUrls);
                            picker.remove();
                            showStatusMessage(`Added ${toAdd.length} item${toAdd.length !== 1 ? 's' : ''} to "${title}".`);
                        } catch (e) {
                            console.error('[collection] merge failed', e);
                            showStatusMessage('Could not merge: ' + e.message);
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
                    showStatusMessage('Could not save: ' + e.message);
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

window.playCollectionSave = async function playCollectionSave() {
    const name  = (document.getElementById('write-title')?.textContent || '').trim();
    const items = _draftItems || [];
    const formatId = document.getElementById('write-format')?.value || 'rss';

    if (!name) { showErrorModal('Please enter a collection title before saving.'); return; }

    // Resolve identity once, up front, so the downloaded file and the kvstore
    // record embed/store the exact same UUID — even for a brand-new or legacy
    // collection that doesn't have one yet when Save is clicked.
    const identity = _resolveCollectionIdentity(_activeCollection?.col?.key, _activeCollection?.col?.id);
    _activeCollection = {
        ..._activeCollection,
        col: { ..._activeCollection?.col, key: identity.key, id: identity.id },
    };
    _refreshIdDisplay();

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
    fileBtn.addEventListener('click', () => {
        const fmt = collectionFormats[formatId];
        if (!fmt) { showStatusMessage('Unknown format.'); return; }
        const content = fmt.serialize(name, items, identity.id);
        const blob    = new Blob([content], { type: fmt.mimeType });
        const url     = URL.createObjectURL(blob);
        const a       = document.createElement('a');
        a.href        = url;
        a.download    = `${name}.${fmt.ext}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showStatusMessage(`Downloaded as ${name}.${fmt.ext}`);
    });
    list.appendChild(fileBtn);

    // ── Save to kvstore ──
    const token = getSiteSpecificCookie(window.CList.config.flaskSiteUrl, window.CList.keys.ACCESS_TOKEN);
    if (token) {
        const kvBtn = document.createElement('button');
        kvBtn.className = 'account-button';
        kvBtn.innerHTML = '<span class="material-icons">storage</span><span>Save to kvstore</span>';

        kvBtn.addEventListener('click', async () => {
            kvBtn.disabled = true;
            try {
                const encKey = await getEncKey(window.CList.config.flaskSiteUrl);
                // Always update the record this collection was loaded from, no
                // matter what the title now reads. Identity was already resolved
                // above, at the top of playCollectionSave.
                const publishedUrls = _activeCollection?.col?.publishedUrls || [];
                const { key, id } = identity;
                await _kvSaveItems(key, id, name, items, token, encKey, publishedUrls);
                _activeCollection = { col: { key, id, name, items, publishedUrls }, token, encKey };
                _refreshIdDisplay();
                showStatusMessage(`Collection "${name}" saved to kvstore.`);
                if (typeof closeRightPane === 'function') closeRightPane();
            } catch (e) {
                console.error('[collection save] kvstore failed', e);
                showStatusMessage('Save failed: ' + e.message);
            } finally {
                kvBtn.disabled = false;
            }
        });

        list.appendChild(kvBtn);
    }

    saveOptionsDiv.appendChild(list);
    if (typeof openRightInterface === 'function') openRightInterface('save-instructions');
};

// ── Pages catalog ────────────────────────────────────────────────────────────

// Republish: push the Collection Editor's current draft to the single destination
// it was originally loaded from (currentLoadedPage), without going through the
// full Publish panel. Other destinations are untouched — same "single destination"
// scope as the Post-time overwrite prompt.
window.republishCollection = async function republishCollection() {
    const page = currentLoadedPage;
    const adapter = window.CList.binPublishers?.[page.service];
    if (!adapter) {
        showRepublishStatus('Republish is not available for this service.', true);
        return;
    }
    const account = await _findAccountForPage(page);
    if (!account) return;

    const fmt = collectionFormats[page.format];
    if (!fmt) {
        showRepublishStatus('Unknown format.', true);
        return;
    }
    const name = (document.getElementById('write-title')?.textContent || '').trim();
    const content = fmt.serialize(name, _draftItems || [], page.id);

    try {
        await adapter.update(page.serviceId, content, fmt.mimeType, account);
        await _touchPublishedUrlEntry(page.collectionKey, page.serviceId);
        showRepublishStatus('Republished.', false);
    } catch (e) {
        console.error('[republishCollection] failed', e);
        showRepublishStatus('Republish failed: ' + e.message, true);
    }
};

// Bump publishedAt on one entry inside a collection's publishedUrls array — same
// fetch/decrypt/patch/re-encrypt/update_kv shape as _recordPublishedUrls above,
// but patching an existing entry in place rather than appending a new one.
async function _touchPublishedUrlEntry(collectionKey, serviceId) {
    const token = getSiteSpecificCookie(window.CList.config.flaskSiteUrl, window.CList.keys.ACCESS_TOKEN);
    const encKey = await getEncKey(window.CList.config.flaskSiteUrl);
    const resp = await fetch(`${window.CList.config.flaskSiteUrl}/get_kvs/`, {
        headers: { 'Authorization': `Bearer ${token}` },
    });
    const kvs = await resp.json();
    const kv = (kvs || []).find(k => k.key === collectionKey);
    if (!kv) return;
    const raw = JSON.parse(await decryptWithKey(encKey, kv.value));
    const col = _parseCollectionData(raw);
    const entry = (col.publishedUrls || []).find(p => p.serviceId === serviceId);
    if (entry) entry.publishedAt = new Date().toISOString();
    const encrypted = await encryptWithKey(encKey, JSON.stringify({ id: col.id, title: col.title, items: col.items, publishedUrls: col.publishedUrls }));
    await fetch(`${window.CList.config.flaskSiteUrl}/update_kv/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ key: collectionKey, value: encrypted }),
    });
}

// Regenerate the OPML and ActivityPub outbox catalog files on CListBin.
// Silent on failure — catalog update must not interrupt the publish flow.
async function _updatePagesCatalog(token, encKey, binAccount) {
    try {
        const kvHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
        const resp = await fetch(`${window.CList.config.flaskSiteUrl}/get_kvs/`, {
            headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!resp.ok) return;
        const kvs = await resp.json();

        // Load existing catalog serviceIds (so we can update in place)
        let catalogMeta = {};
        const catalogKv = (kvs || []).find(kv => kv.key === 'clist:pages-catalog');
        if (catalogKv) {
            try { catalogMeta = JSON.parse(await decryptWithKey(encKey, catalogKv.value)); } catch {}
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
                    const raw = JSON.parse(await decryptWithKey(encKey, kv.value));
                    const col = _parseCollectionData(raw);
                    if (!col.publishedUrls?.length) continue;
                    const colName = col.title || kv.key.replace(/^collection:/, '');
                    for (const pub of col.publishedUrls) {
                        pages.push({ name: colName, ...pub, id: col.id });
                    }
                } catch {}
            } else if (kv.key.startsWith('page:')) {
                try {
                    const rec = JSON.parse(await decryptWithKey(encKey, kv.value));
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

        if (catalogMeta.opmlServiceId) {
            const r = await binPublisher.update(catalogMeta.opmlServiceId, opmlContent, 'application/xml', binAccount);
            catalogMeta.opmlUrl = r.url;
        } else {
            const r = await binPublisher.publish(opmlContent, 'application/xml', 'pages.opml', binAccount);
            catalogMeta.opmlServiceId = r.serviceId;
            catalogMeta.opmlUrl = r.url;
        }

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
        let saveResp = await fetch(`${window.CList.config.flaskSiteUrl}/add_kv/`, {
            method: 'POST', headers: kvHeaders,
            body: JSON.stringify({ key: 'clist:pages-catalog', value: encrypted }),
        });
        if (saveResp.status === 409) {
            saveResp = await fetch(`${window.CList.config.flaskSiteUrl}/update_kv/`, {
                method: 'POST', headers: kvHeaders,
                body: JSON.stringify({ key: 'clist:pages-catalog', value: encrypted }),
            });
        }
    } catch (e) {
        console.error('[pages catalog] update failed:', e);
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

// Resolve which format to use for a given publisher handler and selected format.
// Returns a format id: the selected format if the handler accepts it, otherwise
// the first format the handler does accept, otherwise the selected format.
function _resolvePublishFormat(acceptedFormats, selectedFormatId) {
    if (!acceptedFormats || acceptedFormats.length === 0) return selectedFormatId;
    if (acceptedFormats.includes(selectedFormatId)) return selectedFormatId;
    return acceptedFormats[0];
}

// Renders the Overwrite / Save as new version / Cancel choice for the single
// destination a collection was originally loaded from — mirrors the
// .published-page-confirm pattern used by offerReplaceOrInsert() in editors.js.
// Resolves to 'overwrite', 'new', or null (cancelled).
function _promptCollectionOverwriteChoice(postResultDiv, accountData) {
    return new Promise(resolve => {
        if (!postResultDiv) { resolve('new'); return; }
        postResultDiv.innerHTML = '';

        const msg = document.createElement('p');
        msg.className = 'list-tip';
        msg.textContent = `This collection was loaded from ${accountData.title || accountData.type}. Overwrite it there, or publish a new version?`;
        postResultDiv.appendChild(msg);

        const row = document.createElement('div');
        row.className = 'published-page-confirm';

        const overwriteBtn = document.createElement('button');
        overwriteBtn.className = 'btn';
        overwriteBtn.textContent = 'Overwrite';
        overwriteBtn.onclick = () => { postResultDiv.innerHTML = ''; resolve('overwrite'); };
        row.appendChild(overwriteBtn);

        const newVersionBtn = document.createElement('button');
        newVersionBtn.className = 'btn';
        newVersionBtn.textContent = 'Save as new version';
        newVersionBtn.onclick = () => { postResultDiv.innerHTML = ''; resolve('new'); };
        row.appendChild(newVersionBtn);

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'btn btn-secondary';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.onclick = () => { postResultDiv.innerHTML = ''; resolve(null); };
        row.appendChild(cancelBtn);

        postResultDiv.appendChild(row);
    });
}

window.playCollectionPublish = async function playCollectionPublish() {
    const name  = (document.getElementById('write-title')?.textContent || '').trim();
    const items = _draftItems || [];

    if (!name) { showErrorModal('Please enter a collection title before publishing.'); return; }

    // Ensure accounts are loaded
    if (!Array.isArray(window.CList.accounts) || !window.CList.accounts.length) {
        try { window.CList.accounts = await getAccounts(window.CList.config.flaskSiteUrl); }
        catch (e) { showStatusMessage('Could not load accounts: ' + e.message); return; }
    }

    const postOptionsDiv = document.getElementById('post-options');
    const postResultDiv  = document.getElementById('post-result');
    postOptionsDiv.innerHTML = '';
    if (postResultDiv) postResultDiv.innerHTML = '';

    function _addPublishResult(text, isError = false) {
        if (!postResultDiv) { showStatusMessage(text); return; }
        const p = document.createElement('p');
        p.className   = isError ? 'error-message' : 'feed-status-message';
        p.style.margin = '4px 0';
        p.textContent  = text;
        postResultDiv.appendChild(p);
    }

    // Build the account list — 'w' publishers and 'b' bin-publishers
    postOptionsDiv.appendChild(makeAccountList(
        'Select destinations to publish to',
        window.CList.accounts,
        v => {
            const perms = v.permissions || '';
            if (perms.includes('w')) return !!window.CList.publishers?.[v.type];
            if (perms.includes('b')) return !!window.CList.binPublishers?.[v.type];
            return false;
        },
        (key, parsedValue, btn) => {
            const isSelected = btn.getAttribute('data-selected') === 'true';
            btn.setAttribute('data-selected', isSelected ? 'false' : 'true');
            btn.classList.toggle('selected', !isSelected);
        }
    ));

    const publishBtn = document.createElement('button');
    publishBtn.textContent = 'Publish';
    publishBtn.id          = 'final-post-button';
    publishBtn.className   = 'final-save-button';
    postOptionsDiv.appendChild(publishBtn);

    publishBtn.addEventListener('click', async () => {
        publishBtn.disabled    = true;
        publishBtn.textContent = 'Publishing…';

        const formatId = document.getElementById('write-format')?.value || 'rss';

        const selected = Array.from(
            document.querySelectorAll('#post-options .account-button[data-selected="true"]')
        ).map(btn => {
            const key     = btn.getAttribute('data-key');
            const account = window.CList.accounts.find(a => a.key === key);
            return account ? parseAccountValue(account) : null;
        }).filter(Boolean);

        if (!selected.length) {
            _addPublishResult('No destinations selected.', false);
            publishBtn.disabled = false; publishBtn.textContent = 'Publish';
            return;
        }

        // Resolve this collection's identity once, up front, so every destination's
        // serialized content embeds the same UUID, and a never-saved collection's
        // first Publish also gets a real identity (same rule as Save).
        const identity = _resolveCollectionIdentity(_activeCollection?.col?.key, _activeCollection?.col?.id);
        _activeCollection = {
            ..._activeCollection,
            col: { ..._activeCollection?.col, key: identity.key, id: identity.id },
        };
        _refreshIdDisplay();

        // If one of the selected destinations is the single destination this
        // collection was loaded from, ask whether to overwrite it in place or
        // publish an independent new version there. Every other destination
        // always gets a fresh publish, regardless of the answer.
        let overwriteMatch = null; // the matched accountData, or null
        if (currentLoadedPage?.kind === 'collection') {
            overwriteMatch = selected.find(accountData => {
                const adapter = window.CList.binPublishers?.[accountData.type];
                if (!adapter || !(accountData.permissions || '').includes('b')) return false;
                if (accountData.type !== currentLoadedPage.service) return false;
                if (accountData.instance !== currentLoadedPage.accountInstance) return false;
                return _resolvePublishFormat(adapter.acceptedFormats, formatId) === currentLoadedPage.format;
            }) || null;
        }

        let doOverwrite = false;
        if (overwriteMatch) {
            const choice = await _promptCollectionOverwriteChoice(postResultDiv, overwriteMatch);
            if (choice === null) {
                publishBtn.disabled = false; publishBtn.textContent = 'Publish';
                return;
            }
            doOverwrite = (choice === 'overwrite');
        }

        // Separate into full-content ('b' bin publishers + unlimited 'w') and link-only (has maxlength)
        const fullContent = [];
        const linkOnly    = [];
        selected.forEach(accountData => {
            const perms    = accountData.permissions || '';
            const maxLen   = parseInt(accountData.maxlength, 10);
            const hasLimit = !isNaN(maxLen) && maxLen > 0;
            if (perms.includes('b') || !hasLimit) fullContent.push(accountData);
            else linkOnly.push(accountData);
        });

        let primaryUrl = null;
        const newPublishedUrls = [];
        let primaryBinAccount  = null;
        const token  = getSiteSpecificCookie(window.CList.config.flaskSiteUrl, window.CList.keys.ACCESS_TOKEN);
        const encKey = fullContent.length ? await getEncKey(window.CList.config.flaskSiteUrl).catch(() => null) : null;

        // ── Full-content destinations first ──
        for (const accountData of fullContent) {
            const perms = accountData.permissions || '';
            try {
                if (perms.includes('b')) {
                    // bin publisher — serialize in resolved format
                    const adapter = window.CList.binPublishers?.[accountData.type];
                    if (!adapter) continue;
                    const fmtId  = _resolvePublishFormat(adapter.acceptedFormats, formatId);
                    const fmt    = collectionFormats[fmtId];
                    if (!fmt) continue;
                    const filename = `${name}.${fmt.ext}`;

                    if (doOverwrite && accountData === overwriteMatch) {
                        // Overwrite the single destination this collection was loaded from —
                        // in place, no new publishedUrls entry.
                        const result = await adapter.update(currentLoadedPage.serviceId, fmt.serialize(name, items, identity.id), fmt.mimeType, accountData);
                        const url = (result && result.url) || currentLoadedPage.url;
                        if (!primaryUrl) primaryUrl = url;
                        if (!primaryBinAccount && accountData.type === 'CListBin') primaryBinAccount = accountData;
                        _addPublishResult(`Republished to ${accountData.title || accountData.type}: ${url}`);
                        continue;
                    }

                    const result = await adapter.publish(fmt.serialize(name, items, identity.id), fmt.mimeType, filename, accountData);
                    if (!primaryUrl) primaryUrl = result.url;
                    if (!primaryBinAccount && accountData.type === 'CListBin') primaryBinAccount = accountData;
                    newPublishedUrls.push({ url: result.url, serviceId: result.serviceId, format: fmtId, service: accountData.type, accountInstance: accountData.instance, publishedAt: new Date().toISOString() });
                    _addPublishResult(`Published to ${accountData.title || accountData.type}: ${result.url}`);
                } else {
                    // 'w' publisher with no char limit
                    const handler = window.CList.publishers?.[accountData.type];
                    if (!handler) continue;
                    const fmtId   = _resolvePublishFormat(handler.acceptedFormats, formatId);
                    const fmt     = collectionFormats[fmtId];
                    if (!fmt) continue;
                    const content = fmt.serialize(name, items, identity.id);
                    const url     = await handler.publish(accountData, name, content, []);
                    if (!primaryUrl && url) primaryUrl = url;
                    if (url) newPublishedUrls.push({ url, format: fmtId, service: accountData.type, accountInstance: accountData.instance, publishedAt: new Date().toISOString() });
                }
            } catch (e) {
                console.error('[collection publish] full-content publish failed', e);
                _addPublishResult(`Failed: ${accountData.title || accountData.type} — ${e.message}`, true);
            }
        }

        // ── Link-only destinations ──
        for (const accountData of linkOnly) {
            try {
                const handler = window.CList.publishers?.[accountData.type];
                if (!handler) continue;
                const maxLen  = parseInt(accountData.maxlength, 10);
                let content;
                if (primaryUrl) {
                    content = `${name}: ${primaryUrl}`;
                } else {
                    // No primary yet — post text summary truncated to limit
                    const fmtId = _resolvePublishFormat(handler.acceptedFormats, formatId);
                    const fmt   = collectionFormats[fmtId] || collectionFormats.text;
                    content     = fmt.serialize(name, items, identity.id).slice(0, maxLen);
                }
                await handler.publish(accountData, name, content, []);
            } catch (e) {
                console.error('[collection publish] link-only publish failed', e);
                _addPublishResult(`Failed: ${accountData.title || accountData.type} — ${e.message}`, true);
            }
        }

        publishBtn.disabled    = false;
        publishBtn.textContent = 'Publish';

        // Save the just-published draft into the collection's own kvstore record
        // (same record regardless of title edits) and append the new publishedUrls.
        if (newPublishedUrls.length && token && encKey) {
            const existingKey = _activeCollection?.col?.key || currentLoadedPage?.collectionKey;
            const existingId  = _activeCollection?.col?.id || currentLoadedPage?.id;
            const existingPublishedUrls = _activeCollection?.col?.publishedUrls || [];
            const identity = _resolveCollectionIdentity(existingKey, existingId);
            const allPublishedUrls = [...existingPublishedUrls, ...newPublishedUrls];
            _kvSaveItems(identity.key, identity.id, name, items, token, encKey, allPublishedUrls).then(() => {
                _activeCollection = { col: { key: identity.key, id: identity.id, name, items, publishedUrls: allPublishedUrls }, token, encKey };
                _refreshIdDisplay();
                const catalogBinAccount = primaryBinAccount
                    || (window.CList.accounts || []).map(a => parseAccountValue(a)).filter(Boolean)
                        .find(pv => pv.type === 'CListBin' && (pv.permissions || '').includes('b'));
                if (catalogBinAccount) _updatePagesCatalog(token, encKey, catalogBinAccount);
            }).catch(e => console.error('[pages catalog] post-publish update failed:', e));
        }

        // Bump publishedAt on the overwritten destination's existing publishedUrls entry.
        if (doOverwrite && overwriteMatch) {
            _touchPublishedUrlEntry(currentLoadedPage.collectionKey, currentLoadedPage.serviceId)
                .catch(e => console.error('[pages catalog] touch failed:', e));
        }
    });

    postOptionsDiv.appendChild(makeCollectionWebPageOption());

    if (typeof openRightInterface === 'function') openRightInterface('post-instructions');
};

// Builds the "To Web Page" option for the Collection Editor's Post panel — mirrors
// makeWebPageOption()/postToWebPage() in publish.js, but serializes the collection's
// draft items in the currently selected format instead of reading an editor handler.
function makeCollectionWebPageOption() {
    const list = document.createElement('div');
    list.className = 'account-list';

    const tip = document.createElement('div');
    tip.className = 'list-tip';
    tip.textContent = 'Or publish the editor content directly';
    list.appendChild(tip);

    const btn = document.createElement('button');
    btn.className = 'account-button';

    const iconEl = document.createElement('span');
    iconEl.className = 'material-icons';
    iconEl.textContent = 'public';

    const nameEl = document.createElement('span');
    nameEl.textContent = 'To Web Page';

    btn.appendChild(iconEl);
    btn.appendChild(nameEl);
    btn.addEventListener('click', postCollectionToWebPage);
    list.appendChild(btn);

    return list;
}

// Publishes the collection's draft items, serialized in the currently selected
// format, directly to the CListBin destination — same "raw content, no account
// checklist" semantics as postToWebPage() in publish.js, adapted for collections.
async function postCollectionToWebPage() {
    const resultDiv = document.getElementById('post-result');
    if (resultDiv) resultDiv.innerHTML = '';

    const name = (document.getElementById('write-title')?.textContent || '').trim();
    if (!name) { showErrorModal('Please enter a collection title before publishing.'); return; }
    const items = _draftItems || [];

    const adapter = window.CList.binPublishers?.['CListBin'];
    if (!adapter) { showStatusMessage('Web-page publishing is not available.'); return; }

    let accounts = window.CList.accounts;
    if (!Array.isArray(accounts) || accounts.length === 0) {
        try { accounts = window.CList.accounts = await getAccounts(window.CList.config.flaskSiteUrl); }
        catch (e) { showStatusMessage('Error getting accounts: ' + e.message); return; }
    }
    const binAccount = accounts.map(parseAccountValue).filter(Boolean)
        .find(v => v.type === 'CListBin' && (v.permissions || '').includes('b'));
    if (!binAccount) { showStatusMessage('No web-page destination set up yet — log out and back in to add one.'); return; }

    const formatId = document.getElementById('write-format')?.value || 'rss';
    const fmtId = _resolvePublishFormat(adapter.acceptedFormats, formatId);
    const fmt = collectionFormats[fmtId];
    if (!fmt) { showStatusMessage('Unknown format.'); return; }

    // Resolve this collection's identity once, up front, so the published
    // content embeds the same UUID as the kvstore record (same rule as Save
    // and Publish), even for a never-saved collection.
    const identity = _resolveCollectionIdentity(_activeCollection?.col?.key, _activeCollection?.col?.id);
    _activeCollection = {
        ..._activeCollection,
        col: { ..._activeCollection?.col, key: identity.key, id: identity.id },
    };
    _refreshIdDisplay();

    const content = fmt.serialize(name, items, identity.id);

    // If this collection's content is the one previously loaded from this same
    // CListBin destination in this format, ask whether to overwrite it in place
    // or publish an independent new version. Otherwise publish as a new page.
    const isLoadedMatch = currentLoadedPage && currentLoadedPage.kind === 'collection'
        && currentLoadedPage.service === 'CListBin' && currentLoadedPage.format === fmtId;
    if (isLoadedMatch) {
        _offerCollectionOverwriteOrNewVersion(resultDiv, adapter, content, fmtId, fmt, name, binAccount);
        return;
    }

    await _performCollectionWebPagePublish(adapter, content, fmtId, fmt, name, binAccount, false, resultDiv);
}

// Renders the Overwrite / Save as new version / Cancel choice — same text and
// pattern as _offerOverwriteOrNewVersion() in publish.js, adapted for collections.
function _offerCollectionOverwriteOrNewVersion(resultDiv, adapter, content, fmtId, fmt, name, binAccount) {
    if (!resultDiv) { _performCollectionWebPagePublish(adapter, content, fmtId, fmt, name, binAccount, false, resultDiv); return; }
    resultDiv.innerHTML = '';

    const msg = document.createElement('p');
    msg.className = 'list-tip';
    msg.textContent = 'This page was loaded from My Pages. Overwrite it, or publish a new version?';
    resultDiv.appendChild(msg);

    const row = document.createElement('div');
    row.className = 'published-page-confirm';

    const overwriteBtn = document.createElement('button');
    overwriteBtn.className = 'btn';
    overwriteBtn.textContent = 'Overwrite';
    overwriteBtn.onclick = () => _performCollectionWebPagePublish(adapter, content, fmtId, fmt, name, binAccount, true, resultDiv);
    row.appendChild(overwriteBtn);

    const newVersionBtn = document.createElement('button');
    newVersionBtn.className = 'btn';
    newVersionBtn.textContent = 'Save as new version';
    newVersionBtn.onclick = () => _performCollectionWebPagePublish(adapter, content, fmtId, fmt, name, binAccount, false, resultDiv);
    row.appendChild(newVersionBtn);

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn btn-secondary';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.onclick = () => { resultDiv.innerHTML = ''; };
    row.appendChild(cancelBtn);

    resultDiv.appendChild(row);
}

// Publishes to the web-page destination, either overwriting the currently loaded
// collection page (isOverwrite) or creating an independent new page — mirrors
// _performWebPagePublish() in publish.js.
async function _performCollectionWebPagePublish(adapter, content, fmtId, fmt, name, binAccount, isOverwrite, resultDiv) {
    if (resultDiv) resultDiv.innerHTML = '';

    if (isOverwrite) {
        try {
            const result = await adapter.update(currentLoadedPage.serviceId, content, fmt.mimeType, binAccount);
            const url = (result && result.url) || currentLoadedPage.url;
            if (resultDiv) {
                const p = document.createElement('p');
                p.className = 'feed-status-message';
                p.innerHTML = `Republished: <a href="${url}" target="_blank">${url}</a>`;
                resultDiv.appendChild(p);
            }
        } catch (e) {
            console.error('[postCollectionToWebPage] overwrite failed', e);
            if (resultDiv) showPostMessage(resultDiv, `Failed to publish to web page: ${e.message}`);
            else showStatusMessage('Failed to publish to web page: ' + e.message);
            return;
        }

        try {
            await _touchPublishedUrlEntry(currentLoadedPage.collectionKey, currentLoadedPage.serviceId);
        } catch (e) {
            console.error('[postCollectionToWebPage] failed to update pages catalog', e);
            showStatusMessage('Published, but could not update My Pages: ' + e.message);
        }
        return;
    }

    let result;
    try {
        result = await adapter.publish(content, fmt.mimeType, `${name}.${fmt.ext}`, binAccount);
        if (resultDiv) {
            const p = document.createElement('p');
            p.className = 'feed-status-message';
            p.innerHTML = `Published: <a href="${result.url}" target="_blank">${result.url}</a>`;
            resultDiv.appendChild(p);
        }
    } catch (e) {
        console.error('[postCollectionToWebPage] publish failed', e);
        if (resultDiv) showPostMessage(resultDiv, `Failed to publish to web page: ${e.message}`);
        else showStatusMessage('Failed to publish to web page: ' + e.message);
        return;
    }

    // Record the new published URL in the collection's own kvstore entry so it
    // shows up in My Pages — same shape as playCollectionPublish()'s newPublishedUrls.
    const publishedAt = new Date().toISOString();
    const newUrl = {
        url: result.url, serviceId: result.serviceId, format: fmtId,
        service: 'CListBin', accountInstance: binAccount.instance, publishedAt,
    };
    try {
        const token = getSiteSpecificCookie(window.CList.config.flaskSiteUrl, window.CList.keys.ACCESS_TOKEN);
        const encKey = await getEncKey(window.CList.config.flaskSiteUrl);
        // Always update the record this collection was loaded from, no matter
        // what the title now reads. A never-saved or legacy (key but no id)
        // collection gets a fresh UUID identity right here.
        const existingPublishedUrls = _activeCollection?.col?.publishedUrls || [];
        const identity = _resolveCollectionIdentity(_activeCollection?.col?.key, _activeCollection?.col?.id);
        const allPublishedUrls = [...existingPublishedUrls, newUrl];
        const items = _draftItems || [];
        await _kvSaveItems(identity.key, identity.id, name, items, token, encKey, allPublishedUrls);
        _activeCollection = { col: { key: identity.key, id: identity.id, name, items, publishedUrls: allPublishedUrls }, token, encKey };
        _refreshIdDisplay();
        // The editor now represents the newly created page, not whatever was
        // loaded before (if anything) — the old record, if any, is untouched.
        setLoadedPage({
            kind: 'collection',
            collectionKey: identity.key,
            id: identity.id,
            title: name,
            url: result.url,
            serviceId: result.serviceId,
            service: 'CListBin',
            format: fmtId,
            accountInstance: binAccount.instance,
            publishedAt,
        });
    } catch (e) {
        console.error('[postCollectionToWebPage] failed to save to My Pages', e);
        showStatusMessage('Published, but could not save to My Pages: ' + e.message);
    }
}

// ── Collection editor panel (opened by collection-editor.js in the write-pane) ──

window.showCollectionEditorPanel = async function showCollectionEditorPanel(container) {
    const titleEl = document.getElementById('write-title');
    if (_activeCollection) {
        const { col, token, encKey } = _activeCollection;
        if (titleEl) titleEl.textContent = col.name || '';
        _renderCollectionEditor(container, col, token, encKey);
    } else {
        if (titleEl) titleEl.textContent = '';
        _renderCollectionEditor(container, { name: '', items: [] }, null, null);
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
            list.appendChild(_renderEntryRow(item, idx, draftItems, renderEntries))
        );
        const addBtn = document.createElement('button');
        addBtn.className   = 'btn';
        addBtn.textContent = '+ Add entry';
        addBtn.style.marginTop = '12px';
        addBtn.onclick = () => { draftItems.push({ title: '', url: '' }); renderEntries(); };
        list.appendChild(addBtn);
    }
    _refreshEditor = renderEntries;
    renderEntries();
}

// Render a single collapsible entry row.
function _renderEntryRow(item, idx, draftItems, refresh) {
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
    labelEl.textContent = _collectionItemDisplayTitle(item) || '(untitled)';

    bar.appendChild(upBtn);
    bar.appendChild(downBtn);
    bar.appendChild(chevron);
    bar.appendChild(labelEl);
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
        labelEl.textContent = _collectionItemDisplayTitle(item) || '(untitled)';
    });

    row.appendChild(bar);
    row.appendChild(fields);
    return row;
}

// Render editable fields for a single entry.
function _renderEntryFields(item, container, onTitleChange) {
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

// Public bridge: parse text as OPML or RSS and open in the collection editor.
// Called by external modules (e.g. dropbox.js) that cannot access module-private variables.
// Returns true if the format was recognised, false otherwise.
window.loadCollectionText = async function (text, filename) {
    const format = _detectFormat('', filename || '');
    let parsed;
    if      (format === 'rss')  parsed = _parseCollectionRSS(text);
    else if (format === 'opml') parsed = _parseCollectionOPML(text);
    else return false;
    // Reuse an identity already embedded in the file (Part B) instead of
    // discarding it on load.
    const { key, id } = _resolveCollectionIdentity(null, parsed.id);
    _activeCollection = { col: { key, id, name: parsed.title, items: parsed.items }, token: null, encKey: null };
    if (typeof initializeEditor === 'function') await initializeEditor('collection');
    if (typeof setLoadedPage === 'function') setLoadedPage(null);
    if (typeof closeRightPane   === 'function') closeRightPane();
    return true;
};
