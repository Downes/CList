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

let _activeCollection = null; // set by load button; read by showCollectionEditorPanel

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
