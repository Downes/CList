//  page-store.js  -  Local-only storage for editor page content (window.CList.pageStore)
//  Part of CList, the next generation of learning and connecting with your community
//
//  Copyright Stephen Downes 2026, downes.ca
//  Licensed under Creative Commons Attribution 4.0 International https://creativecommons.org/licenses/by/4.0/
//
//  This software carries NO WARRANTY OF ANY KIND.
//  This software is provided "AS IS," and you, its user, assume all risks when using it.
//
//  Public API — see docs/storage-model.md "PageStore — target interface" for the authoritative
//  surface this implements. Always local (IndexedDB via js/page-store-idb.js, loaded before this
//  file), independent of KVStore mode/login. Not aware of, and not called by, the KVStore facade.

window.CList = window.CList || {};

(function () {
    function _pageStoreNowIso() {
        return new Date().toISOString();
    }

    class PageStoreError extends Error {
        constructor(code, message, cause) {
            super(message || code);
            this.name = 'PageStoreError';
            this.code = code;
            this.cause = cause;
        }
    }
    window.CList.PageStoreError = PageStoreError;

    function toSummary(record) {
        return {
            id: record.id,
            title: record.title,
            editorType: record.editorType,
            contentType: record.contentType,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
        };
    }

    // id/contentType/editorType must be non-empty strings; content just needs to be a
    // string (an empty page is valid). Returns a problem description, or null if OK.
    function _pageStoreValidateShape(record) {
        if (!record || typeof record !== 'object') return 'not an object';
        if (typeof record.id !== 'string' || !record.id) return 'missing id';
        if (typeof record.content !== 'string') return 'content must be a string';
        if (typeof record.contentType !== 'string' || !record.contentType) return 'missing contentType';
        if (typeof record.editorType !== 'string' || !record.editorType) return 'missing editorType';
        return null;
    }

    // Tier 1 (storage-architecture-plan.md §7): whole-bundle structural validation, run
    // before any write. Any failure rejects the entire import — nothing gets written.
    function _pageStoreValidateBundleTier1(bundle) {
        if (!bundle || !bundle.manifest) {
            throw new PageStoreError('InvalidData', 'Bundle has no manifest');
        }
        if (bundle.manifest.kind !== 'pageStoreBundle') {
            throw new PageStoreError('InvalidData', `Unexpected manifest.kind: ${bundle.manifest.kind}`);
        }
        if (bundle.manifest.version !== 1) {
            throw new PageStoreError('InvalidData', `Unsupported manifest.version: ${bundle.manifest.version}`);
        }
        if (!Array.isArray(bundle.pages)) {
            throw new PageStoreError('InvalidData', 'Bundle has no pages array');
        }
        const seenIds = new Set();
        bundle.pages.forEach((record, index) => {
            const problem = _pageStoreValidateShape(record);
            if (problem) throw new PageStoreError('InvalidData', `Record at index ${index}: ${problem}`);
            if (seenIds.has(record.id)) throw new PageStoreError('InvalidData', `Duplicate id in bundle: ${record.id}`);
            seenIds.add(record.id);
        });
    }

    async function save(page) {
        if (!page || typeof page.content !== 'string') {
            throw new PageStoreError('InvalidData', 'page.content must be a string');
        }
        const id = page.id || crypto.randomUUID();
        const now = _pageStoreNowIso();

        try {
            return await _pageStoreReadThenWrite(id, (existing) => {
                if (!existing) {
                    const record = {
                        id,
                        title: page.title || '',
                        content: page.content,
                        contentType: page.contentType || 'text/plain',
                        editorType: page.editorType || '',
                        createdAt: now,
                        updatedAt: now,
                        revision: 1,
                        sourceUri: page.sourceUri ?? null,
                        sourceId: page.sourceId ?? null,
                        references: Array.isArray(page.references) ? page.references : [],
                        publications: Array.isArray(page.publications) ? page.publications : [],
                    };
                    return { write: 'put', record, result: record };
                }

                // Omitted revision = explicit forced overwrite; given-and-mismatched = conflict.
                if (page.revision !== undefined && page.revision !== existing.revision) {
                    throw new PageStoreError(
                        'RevisionConflict',
                        `Page ${id} was saved elsewhere (stored revision ${existing.revision}, expected ${page.revision})`
                    );
                }

                const record = {
                    ...existing,
                    title: page.title ?? existing.title,
                    content: page.content,
                    contentType: page.contentType || existing.contentType,
                    editorType: page.editorType || existing.editorType,
                    updatedAt: now,
                    revision: existing.revision + 1,
                    sourceUri: page.sourceUri ?? existing.sourceUri,
                    sourceId: page.sourceId ?? existing.sourceId,
                    references: Array.isArray(page.references) ? page.references : existing.references,
                };
                return { write: 'put', record, result: record };
            });
        } catch (err) {
            if (err instanceof PageStoreError) throw err;
            throw new PageStoreError('StorageUnavailable', 'Could not save page', err);
        }
    }

    async function get(id) {
        if (!id) return null;
        try {
            return await _pageStoreGet(id);
        } catch (err) {
            throw new PageStoreError('StorageUnavailable', 'Could not read page', err);
        }
    }

    async function list(options = {}) {
        const { sortBy = 'updatedAt', order = 'desc', limit, offset = 0 } = options;
        let rows;
        try {
            rows = await _pageStoreGetAll();
        } catch (err) {
            throw new PageStoreError('StorageUnavailable', 'Could not list pages', err);
        }
        rows = rows.map(toSummary).sort((a, b) => {
            const av = a[sortBy] || '';
            const bv = b[sortBy] || '';
            if (av < bv) return -1;
            if (av > bv) return 1;
            return 0;
        });
        if (order === 'desc') rows.reverse();
        rows = (limit !== undefined) ? rows.slice(offset, offset + limit) : (offset ? rows.slice(offset) : rows);
        return rows;
    }

    async function remove(id) {
        if (!id) return false;
        try {
            return await _pageStoreReadThenWrite(id, (existing) => {
                if (!existing) return { write: null, result: false };
                return { write: 'delete', result: true };
            });
        } catch (err) {
            if (err instanceof PageStoreError) throw err;
            throw new PageStoreError('StorageUnavailable', 'Could not remove page', err);
        }
    }

    // Upserts by (service, accountId) — current status per destination, not a history log
    // (docs/storage-model.md "recordPublication"). Does not bump revision: that's the
    // content-conflict counter save() relies on, and publishing is a metadata-only change.
    // Does bump updatedAt so list() surfaces the page again.
    async function recordPublication(id, { service, accountId = null, url } = {}) {
        if (!id) return null;
        if (typeof service !== 'string' || !service) {
            throw new PageStoreError('InvalidData', 'recordPublication requires a service');
        }
        if (typeof url !== 'string' || !url) {
            throw new PageStoreError('InvalidData', 'recordPublication requires a url');
        }
        const now = _pageStoreNowIso();
        try {
            return await _pageStoreReadThenWrite(id, (existing) => {
                if (!existing) return { write: null, result: null };

                const publications = Array.isArray(existing.publications) ? existing.publications.slice() : [];
                const idx = publications.findIndex(p => p.service === service && (p.accountId ?? null) === accountId);
                const entry = { service, accountId, url, publishedAt: now, revision: existing.revision };
                if (idx === -1) publications.push(entry);
                else publications[idx] = entry;

                const record = { ...existing, publications, updatedAt: now };
                return { write: 'put', record, result: record };
            });
        } catch (err) {
            if (err instanceof PageStoreError) throw err;
            throw new PageStoreError('StorageUnavailable', 'Could not record publication', err);
        }
    }

    async function exportPages() {
        let rows;
        try {
            rows = await _pageStoreGetAll();
        } catch (err) {
            throw new PageStoreError('StorageUnavailable', 'Could not export pages', err);
        }
        return {
            manifest: {
                app: 'CList',
                kind: 'pageStoreBundle',
                version: 1,
                exportedAt: _pageStoreNowIso(),
                count: rows.length,
            },
            pages: rows,
        };
    }

    async function importPages(bundle, options = {}) {
        const onConflict = options.onConflict || 'skip';
        _pageStoreValidateBundleTier1(bundle);
        if (!['skip', 'replace', 'duplicate'].includes(onConflict)) {
            throw new PageStoreError('InvalidData', `Unknown onConflict policy: ${onConflict}`);
        }

        const result = { imported: 0, skipped: 0, replaced: 0, duplicated: 0, danglingReferences: [], errors: [] };
        const idMap = new Map();        // old bundle id -> new id (duplicate policy only)
        const bundleIds = new Set(bundle.pages.map(r => r.id));
        const writtenTargets = [];      // ids actually written in pass 1
        const failedIds = new Set();    // bundle ids that errored out and were never written

        // Pass 1 — write every record per the conflict policy.
        for (const record of bundle.pages) {
            try {
                const existing = await get(record.id);
                let targetId = record.id;

                if (existing) {
                    if (onConflict === 'skip') {
                        result.skipped++;
                        continue;
                    }
                    if (onConflict === 'duplicate') {
                        targetId = crypto.randomUUID();
                        idMap.set(record.id, targetId);
                    }
                    // 'replace' falls through and overwrites targetId === record.id in place.
                }

                const now = _pageStoreNowIso();
                await _pageStoreReadThenWrite(targetId, () => ({
                    write: 'put',
                    result: true,
                    record: {
                        id: targetId,
                        title: record.title || '',
                        content: record.content,
                        contentType: record.contentType,
                        editorType: record.editorType,
                        createdAt: record.createdAt || now,
                        updatedAt: now,
                        revision: 1,
                        sourceUri: record.sourceUri ?? null,
                        sourceId: record.sourceId ?? null,
                        references: Array.isArray(record.references) ? record.references : [],
                        publications: Array.isArray(record.publications) ? record.publications : [],
                    },
                }));

                writtenTargets.push(targetId);
                if (existing) {
                    if (onConflict === 'replace') result.replaced++;
                    else result.duplicated++;
                } else {
                    result.imported++;
                }
            } catch (err) {
                failedIds.add(record.id);
                result.errors.push({ id: record.id, message: err.message });
            }
        }

        // Pass 2 — rewrite references[].member for ids remapped under 'duplicate', and
        // flag references whose in-bundle target never got written (mechanical failure).
        // References pointing outside the bundle are left untouched.
        for (const targetId of writtenTargets) {
            const current = await get(targetId);
            if (!current || !Array.isArray(current.references) || !current.references.length) continue;

            let changed = false;
            const rewritten = current.references.map(ref => {
                if (ref && bundleIds.has(ref.member)) {
                    if (idMap.has(ref.member)) {
                        changed = true;
                        return { ...ref, member: idMap.get(ref.member) };
                    }
                    if (failedIds.has(ref.member)) {
                        result.danglingReferences.push({ pageId: targetId, member: ref.member });
                    }
                }
                return ref;
            });

            if (changed) {
                await _pageStoreReadThenWrite(targetId, (existing) => {
                    if (!existing) return { write: null, result: true };
                    return { write: 'put', record: { ...existing, references: rewritten }, result: true };
                });
            }
        }

        return result;
    }

    window.CList.pageStore = { save, get, list, remove, exportPages, importPages, recordPublication };
})();

// -- Editor "Save / Load" registry wiring (docs/adding-a-service.md §4-5) -----------------

(function () {
    window.CList.savers = window.CList.savers || [];
    window.CList.savers.push({
        label: 'Save to CList (local)',
        icon: 'save',
        requiresLogin:   false,
        requiresAccount: false,
        save: async () => {
            const handler = editorHandlers[currentEditor];
            const content = (handler && typeof handler.getContent === 'function') ? await handler.getContent() : '';
            if (!content || !content.trim()) {
                showErrorModal('Nothing to save — the editor is empty.', { title: 'Nothing to save' });
                return;
            }

            const title = window.CList.ui.view.writeTitle.innerText.trim();
            const contentType = (handler && Array.isArray(handler.contentTypes) && handler.contentTypes[0]) || 'text/plain';
            const isSamePage = currentLoadedPage && currentLoadedPage.kind === 'local-page';

            const page = {
                id: isSamePage ? currentLoadedPage.id : undefined,
                revision: isSamePage ? currentLoadedPage.revision : undefined,
                title,
                content,
                contentType,
                editorType: currentEditor,
            };

            try {
                const saved = await window.CList.pageStore.save(page);
                setLoadedPage({ kind: 'local-page', id: saved.id, title: saved.title, revision: saved.revision });
                showStatusMessage('Saved to CList (local).');
            } catch (e) {
                console.error('[page-store saver] save failed', e);
                if (e.code === 'RevisionConflict') {
                    showErrorModal(
                        'This page was changed elsewhere since it was opened. Reopen it from Load → CList (local) to see the latest version before saving again.',
                        { title: 'Save conflict' }
                    );
                } else {
                    showErrorModal('Save failed: ' + e.message, { title: 'Save failed' });
                }
            }
        },
    });
})();

// Re-render the "CList (local)" loader's own list — used after Export/Import so the
// list reflects what's now in the store, without disturbing any other open surface.
function _reloadLocalPagesLoader() {
    const loader = window.CList.loaders.find(l => l.label === 'CList (local)');
    if (loader) loader.load(); else populateLoadOptions();
}

// Export every locally saved page as a single JSON file (the PageStoreBundle shape
// pageStore.exportPages() returns) and trigger a browser download — mirrors the
// Blob/createObjectURL/anchor-click pattern used by collections.js's "Save to file".
async function _exportAllPages() {
    let bundle;
    try {
        bundle = await window.CList.pageStore.exportPages();
    } catch (e) {
        console.error('[page-store export] failed', e);
        showErrorModal('Export failed: ' + e.message, { title: 'Export failed' });
        return;
    }

    const content = JSON.stringify(bundle, null, 2);
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clist-pages-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showStatusMessage(`Exported ${bundle.manifest.count} page(s).`);
}

// Rendered into renderTarget when "Import pages..." is clicked. Lets the user pick a
// previously exported JSON file and a conflict policy, then calls pageStore.importPages()
// and surfaces the result. Tier-1 validation failures and per-record errors are both
// reported without silently dropping anything the import did manage to write.
function _showImportPagesPicker(renderTarget) {
    const optionsDiv = renderTarget || window.CList.ui.view.loadOptions;
    if (!optionsDiv) return;
    optionsDiv.innerHTML = '';

    const tip = document.createElement('p');
    tip.className = 'list-tip';
    tip.textContent = 'Choose a CList pages export file (.json) to import:';
    optionsDiv.appendChild(tip);

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'application/json,.json';
    optionsDiv.appendChild(fileInput);

    const policyTip = document.createElement('p');
    policyTip.className = 'list-tip';
    policyTip.textContent = 'If a page in the file has the same id as one already saved:';
    optionsDiv.appendChild(policyTip);

    const policySelect = document.createElement('select');
    [
        { value: 'skip', label: 'Skip it (default)' },
        { value: 'replace', label: 'Replace it' },
        { value: 'duplicate', label: 'Import as a new copy' },
    ].forEach(opt => {
        const optEl = document.createElement('option');
        optEl.value = opt.value;
        optEl.textContent = opt.label;
        policySelect.appendChild(optEl);
    });
    optionsDiv.appendChild(policySelect);

    const row = document.createElement('div');
    row.className = 'published-page-confirm';

    const importBtn = document.createElement('button');
    importBtn.className = 'btn';
    importBtn.textContent = 'Import';
    importBtn.onclick = async () => {
        const file = fileInput.files[0];
        if (!file) { showErrorModal('Choose a file first.', { title: 'Import' }); return; }

        importBtn.disabled = true;
        try {
            const text = await file.text();
            let bundle;
            try {
                bundle = JSON.parse(text);
            } catch (e) {
                throw new Error('That file is not valid JSON.');
            }

            const result = await window.CList.pageStore.importPages(bundle, { onConflict: policySelect.value });
            const parts = [];
            if (result.imported) parts.push(`${result.imported} imported`);
            if (result.replaced) parts.push(`${result.replaced} replaced`);
            if (result.duplicated) parts.push(`${result.duplicated} duplicated`);
            if (result.skipped) parts.push(`${result.skipped} skipped`);
            if (result.errors.length) parts.push(`${result.errors.length} failed`);
            const summary = parts.length ? parts.join(', ') : 'Nothing to import.';

            if (result.errors.length || result.danglingReferences.length) {
                console.error('[page-store import] partial failure', result);
                showErrorModal(
                    `Import finished with problems: ${summary}.` +
                    (result.danglingReferences.length
                        ? ` ${result.danglingReferences.length} reference(s) now point to pages that failed to import.`
                        : ''),
                    { title: 'Import problems' }
                );
            } else {
                showStatusMessage(`Import complete: ${summary}.`);
            }
        } catch (e) {
            console.error('[page-store import] failed', e);
            showErrorModal('Import failed: ' + e.message, { title: 'Import failed' });
        } finally {
            importBtn.disabled = false;
        }
        _reloadLocalPagesLoader();
    };
    row.appendChild(importBtn);

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn btn-secondary';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.onclick = () => _reloadLocalPagesLoader();
    row.appendChild(cancelBtn);

    optionsDiv.appendChild(row);
}

(function () {
    window.CList.loaders = window.CList.loaders || [];
    window.CList.loaders.push({
        label: 'CList (local)',
        icon: 'folder',
        requiresLogin:   false,
        requiresAccount: false,
        load: async () => {
            let summaries;
            try {
                summaries = await window.CList.pageStore.list();
            } catch (e) {
                console.error('[page-store loader] list failed', e);
                showErrorModal('Could not list local pages: ' + e.message, { title: 'Could not list pages' });
                return null;
            }

            const optionsDiv = window.CList.ui.view.loadOptions;
            if (!optionsDiv) return null;
            optionsDiv.innerHTML = '';

            const tip = document.createElement('p');
            tip.className = 'list-tip';
            tip.textContent = summaries.length
                ? 'Select a locally saved page to load:'
                : 'No locally saved pages yet.';
            optionsDiv.appendChild(tip);

            const list = document.createElement('div');
            list.className = 'account-list';

            summaries.forEach(summary => {
                const btn = document.createElement('button');
                btn.className = 'account-button';

                const iconEl = document.createElement('span');
                iconEl.className = 'material-icons';
                iconEl.textContent = 'description';

                const nameEl = document.createElement('span');
                nameEl.textContent = summary.title || '(untitled)';

                btn.appendChild(iconEl);
                btn.appendChild(nameEl);

                btn.addEventListener('click', async () => {
                    let record;
                    try {
                        record = await window.CList.pageStore.get(summary.id);
                    } catch (e) {
                        console.error('[page-store loader] get failed', e);
                        showErrorModal('Could not load page: ' + e.message, { title: 'Could not load page' });
                        return;
                    }
                    if (!record) {
                        showErrorModal('That page no longer exists.', { title: 'Page not found' });
                        populateLoadOptions();
                        return;
                    }
                    const page = { kind: 'local-page', id: record.id, title: record.title, revision: record.revision };
                    // Restore the most recent publication (recordPublication()'s upsert-by-
                    // service history) so updateLoadedPageUI()'s hasPublicationLocation check
                    // and the Republish button survive a reload, not just the live session.
                    const publications = Array.isArray(record.publications) ? record.publications : [];
                    if (publications.length) {
                        const latest = publications.reduce((a, b) => (a.publishedAt > b.publishedAt ? a : b));
                        page.service         = latest.service;
                        page.accountInstance = latest.accountId;
                        page.publicationUrl  = latest.url;
                    }
                    await loadSavedPage({ type: record.contentType, value: record.content }, page, optionsDiv, () => populateLoadOptions());
                });

                list.appendChild(btn);
            });

            optionsDiv.appendChild(list);

            // Whole-store backup/restore, not a single-page action — kept here, on the
            // one surface that already lists every locally saved page.
            const toolsRow = document.createElement('div');
            toolsRow.className = 'published-page-confirm';

            const exportBtn = document.createElement('button');
            exportBtn.className = 'btn btn-small';
            exportBtn.textContent = 'Export all pages';
            exportBtn.onclick = () => _exportAllPages();
            toolsRow.appendChild(exportBtn);

            const importBtn = document.createElement('button');
            importBtn.className = 'btn btn-small';
            importBtn.textContent = 'Import pages...';
            importBtn.onclick = () => _showImportPagesPicker(optionsDiv);
            toolsRow.appendChild(importBtn);

            optionsDiv.appendChild(toolsRow);

            const cancelBtn = document.createElement('button');
            cancelBtn.className = 'btn btn-secondary';
            cancelBtn.textContent = 'Cancel';
            cancelBtn.onclick = () => populateLoadOptions();
            optionsDiv.appendChild(cancelBtn);

            return null; // this loader manages its own UI, like the built-in "Load blank"
        },
    });
})();
