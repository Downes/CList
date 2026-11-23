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
//  file), not aware of, and not called by, the KVStore facade. Registry entries in
//  page-store-save.js and page-store-browser.js require login (requiresLogin: true)
//  even though the storage itself is login-independent —
//  logged-out IndexedDB usage was found to be unreliable, so the Save/Load panels hide this option
//  until the visitor logs in.

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

    /** @param {string} id @returns {Promise<CListNativePageRecord|null>} */
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

    /** @returns {Promise<CListNativePageBundle>} */
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

    /** @param {CListNativePageBundle} bundle Validated before writes, including legacy metadata.
     * @param {{onConflict?:('skip'|'replace'|'duplicate')}} options
     * @returns {Promise<CListNativePageImportResult>}
     */
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
