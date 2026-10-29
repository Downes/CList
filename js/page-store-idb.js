//  page-store-idb.js  -  IndexedDB layer backing PageStore
//  Part of CList, the next generation of learning and connecting with your community
//
//  Copyright Stephen Downes 2026, downes.ca
//  Licensed under Creative Commons Attribution 4.0 International https://creativecommons.org/licenses/by/4.0/
//
//  This software carries NO WARRANTY OF ANY KIND.
//  This software is provided "AS IS," and you, its user, assume all risks when using it.
//
//  Implementation detail of PageStore (js/page-store.js) — see docs/storage-model.md and
//  docs/storage-architecture-plan.md for the architecture. The functions here are prefixed
//  `_` and called only from page-store.js, the same cross-file top-level-function convention
//  publish.js's `_touchOrForkWebPageRecord` already uses for files.js/collections.js.
//
//  Transaction discipline (storage-architecture-plan.md §5): every write-returning promise
//  resolves on transaction.oncomplete, never on an individual request's onsuccess, and
//  rejects on transaction.onerror/onabort. db.onversionchange is handled explicitly. The one
//  check-then-write primitive below (_pageStoreReadThenWrite) performs its existence check
//  and conditional write inside a single read-write transaction, so no other tab's write can
//  land between the check and this one's write.

const PAGE_STORE_DB_NAME = 'clist_pages';
const PAGE_STORE_DB_VERSION = 1;
const PAGE_STORE_STORE_NAME = 'pages';

let _pageStoreDbPromise = null;

function _pageStoreOpenDb() {
    if (_pageStoreDbPromise) return _pageStoreDbPromise;
    _pageStoreDbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(PAGE_STORE_DB_NAME, PAGE_STORE_DB_VERSION);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(PAGE_STORE_STORE_NAME)) {
                const store = db.createObjectStore(PAGE_STORE_STORE_NAME, { keyPath: 'id' });
                store.createIndex('byUpdatedAt', 'updatedAt');
            }
        };
        req.onsuccess = () => {
            const db = req.result;
            // Another tab upgraded the schema — this connection is now stale. Close it and
            // drop the cached promise so the next call reopens fresh, rather than letting
            // every subsequent request on this connection fail opaquely.
            db.onversionchange = () => {
                db.close();
                _pageStoreDbPromise = null;
                if (typeof showStatusMessage === 'function') {
                    showStatusMessage('CList page storage was updated in another tab — reload to pick up the change.');
                }
            };
            resolve(db);
        };
        req.onerror = () => reject(req.error);
    });
    return _pageStoreDbPromise;
}

// Plain read outside any write transaction — no existence-then-write race to guard here.
function _pageStoreGet(id) {
    return _pageStoreOpenDb().then(db => new Promise((resolve, reject) => {
        const req = db.transaction(PAGE_STORE_STORE_NAME, 'readonly').objectStore(PAGE_STORE_STORE_NAME).get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
    }));
}

function _pageStoreGetAll() {
    return _pageStoreOpenDb().then(db => new Promise((resolve, reject) => {
        const req = db.transaction(PAGE_STORE_STORE_NAME, 'readonly').objectStore(PAGE_STORE_STORE_NAME).getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
    }));
}

// The one combined check+write primitive required by save()/remove(): runs `decide`
// against the existing record for `id` (or null) inside a single read-write transaction.
// decide(existing) returns { write: 'put'|'delete'|null, record?, result } — record is
// required when write === 'put'. decide() may throw (e.g. a RevisionConflict) to abort the
// transaction and reject with that exact error, writing nothing.
// Resolves `result` on transaction.oncomplete — never on the inner get/put/delete request's
// own onsuccess — and rejects on transaction.onerror/onabort (surfacing the real cause).
function _pageStoreReadThenWrite(id, decide) {
    return _pageStoreOpenDb().then(db => new Promise((resolve, reject) => {
        const tx = db.transaction(PAGE_STORE_STORE_NAME, 'readwrite');
        const store = tx.objectStore(PAGE_STORE_STORE_NAME);
        let outcome = null;
        let decideError = null;

        const getReq = store.get(id);
        getReq.onsuccess = () => {
            try {
                outcome = decide(getReq.result || null);
            } catch (err) {
                decideError = err;
                tx.abort();
                return;
            }
            if (outcome.write === 'put') store.put(outcome.record);
            else if (outcome.write === 'delete') store.delete(id);
        };

        tx.oncomplete = () => resolve(outcome && outcome.result);
        tx.onerror = () => reject(decideError || tx.error || getReq.error);
        tx.onabort = () => reject(decideError || tx.error || getReq.error || new Error('Transaction aborted'));
    }));
}
