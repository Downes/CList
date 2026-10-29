//  local-kvstore.js  -  in-browser kvstore backend for "Local - nothing leaves your computer"
//  Part of CList, the next generation of learning and connecting with your community
//
//  Copyright Stephen Downes 2026, downes.ca
//  Licensed under Creative Commons Attribution 4.0 International https://creativecommons.org/licenses/by/4.0/
//
//  This software carries NO WARRANTY OF ANY KIND.
//  This software is provided "AS IS," and you, its user, assume all risks when using it.
//
//  When window.CList.config.flaskSiteUrl is set to the sentinel below, every module in CList
//  keeps calling fetch(`${flaskSiteUrl}/add_kv/`) etc. exactly as it does against a real kvstore
//  server — this file just intercepts window.fetch for that one sentinel origin and answers those
//  requests from IndexedDB instead of the network, so nothing ever leaves the device. Everything
//  stored still goes through the same client-side PBKDF2/AES-GCM encryption as the hosted version
//  (crypto_utils.js) — this file never sees a plaintext password or account credential, only
//  whatever ciphertext/opaque blob the caller already produced.

window.CList = window.CList || {};
window.CList.LOCAL_KVSTORE_URL = 'http://local.clist';

(function () {
    const SENTINEL = window.CList.LOCAL_KVSTORE_URL;
    const DB_NAME = 'clist_local_kvstore';
    const DB_VERSION = 1;

    let dbPromise = null;
    function openDb() {
        if (dbPromise) return dbPromise;
        dbPromise = new Promise((resolve, reject) => {
            const req = indexedDB.open(DB_NAME, DB_VERSION);
            req.onupgradeneeded = () => {
                const db = req.result;
                if (!db.objectStoreNames.contains('users')) {
                    db.createObjectStore('users', { keyPath: 'username' });
                }
                if (!db.objectStoreNames.contains('kv')) {
                    const store = db.createObjectStore('kv', { keyPath: ['username', 'key'] });
                    store.createIndex('byUsername', 'username');
                }
                if (!db.objectStoreNames.contains('sessions')) {
                    db.createObjectStore('sessions', { keyPath: 'token' });
                }
            };
            // A stale connection from another tab blocking this upgrade, or the open request
            // itself failing, must not hang silently (docs/storage-architecture-plan.md §5) —
            // reset dbPromise so a later call can retry instead of being stuck on a dead promise.
            req.onblocked = () => {
                dbPromise = null;
                reject(new Error('IndexedDB open blocked — another tab still has an older version open'));
            };
            req.onsuccess = () => {
                const db = req.result;
                // Another tab upgraded the schema out from under this connection — close it and
                // force a reload rather than letting the next request fail opaquely (§5).
                db.onversionchange = () => {
                    db.close();
                    dbPromise = null;
                    if (typeof showStatusMessage === 'function') {
                        showStatusMessage('CList local storage was updated in another tab — reload to pick up the change.');
                    }
                };
                resolve(db);
            };
            req.onerror = () => {
                dbPromise = null;
                reject(req.error);
            };
        });
        return dbPromise;
    }

    function idbGet(storeName, key) {
        return openDb().then(db => new Promise((resolve, reject) => {
            const req = db.transaction(storeName, 'readonly').objectStore(storeName).get(key);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => reject(req.error);
        }));
    }

    function idbPut(storeName, value) {
        return openDb().then(db => new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readwrite');
            tx.objectStore(storeName).put(value);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        }));
    }

    // Create-only write: relies on IndexedDB's native key-collision failure (ConstraintError)
    // instead of a separate get()-then-put(), so there's no gap between the check and the write
    // for another tab to race into (docs/storage-architecture-plan.md §5).
    function idbAdd(storeName, value) {
        return openDb().then(db => new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readwrite');
            tx.objectStore(storeName).add(value);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        }));
    }

    function idbDelete(storeName, key) {
        return openDb().then(db => new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readwrite');
            tx.objectStore(storeName).delete(key);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        }));
    }

    // Thrown by idbUpdateIfExists/idbDeleteIfExists when the key doesn't exist. Callers (e.g.
    // kvstore-local.js's run()) detect it via the `notFound` flag rather than instanceof, the same
    // duck-typed way LocalAuthError's `status` field is read across the file boundary below.
    class LocalNotFoundError extends Error {
        constructor(message) {
            super(message || 'Key not found');
            this.notFound = true;
        }
    }

    // Existence-gated write: the get() and the conditional put() happen against the SAME
    // read-write transaction, so no other write can land between the check and the write
    // (docs/storage-architecture-plan.md §5) — unlike a separate idbGet() then idbPut(), which
    // would reopen the exact TOCTOU gap idbAdd() above was added to close for add().
    function idbUpdateIfExists(storeName, key, value) {
        return openDb().then(db => new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            let missing = false;
            const getReq = store.get(key);
            getReq.onsuccess = () => {
                if (getReq.result === undefined) {
                    missing = true;
                    tx.abort();
                    return;
                }
                store.put(value);
            };
            getReq.onerror = () => reject(getReq.error);
            tx.oncomplete = () => resolve();
            tx.onabort = () => reject(missing ? new LocalNotFoundError() : (tx.error || new Error('Transaction aborted')));
            tx.onerror = () => reject(tx.error);
        }));
    }

    // Same same-transaction existence gate as idbUpdateIfExists, for delete().
    function idbDeleteIfExists(storeName, key) {
        return openDb().then(db => new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            let missing = false;
            const getReq = store.get(key);
            getReq.onsuccess = () => {
                if (getReq.result === undefined) {
                    missing = true;
                    tx.abort();
                    return;
                }
                store.delete(key);
            };
            getReq.onerror = () => reject(getReq.error);
            tx.oncomplete = () => resolve();
            tx.onabort = () => reject(missing ? new LocalNotFoundError() : (tx.error || new Error('Transaction aborted')));
            tx.onerror = () => reject(tx.error);
        }));
    }

    function idbGetAllByIndex(storeName, indexName, value) {
        return openDb().then(db => new Promise((resolve, reject) => {
            const req = db.transaction(storeName, 'readonly').objectStore(storeName).index(indexName).getAll(value);
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => reject(req.error);
        }));
    }

    // Hash auth_hash again before storing it, the same way the real server stores bcrypt(auth_hash)
    // rather than auth_hash itself (see /srv/apps/kvstore CLAUDE.md "Auth design v0.3").
    async function sha256Hex(str) {
        const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
        return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    function jsonResponse(status, body) {
        return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
    }

    // Thrown by registerUser/loginUser below so both the fetch-interception path (which turns
    // it back into a Response) and direct callers (kvstore.js, in local mode) get the same
    // status/message without either side knowing about the other's transport.
    class LocalAuthError extends Error {
        constructor(status, message) {
            super(message);
            this.status = status;
        }
    }

    // Local-mode register/login, callable either via the fetch interception below or directly
    // from kvstore.js (window.CList._localKvStore.registerUser/loginUser) when in local mode —
    // see docs/storage-architecture-plan.md §8 step 5(b). Only ever sees the already-derived
    // auth_hash, never a plaintext password or the encKey (see file header).
    async function registerUser(username, authHash) {
        username = (username || '').toLowerCase();
        if (!username || !authHash) throw new LocalAuthError(400, 'Missing username or auth_hash');
        if (await idbGet('users', username)) throw new LocalAuthError(409, 'Username already taken');
        const authHashDigest = await sha256Hex(authHash);
        await idbPut('users', { username, authHashDigest, createdAt: new Date().toISOString() });
        return { username };
    }

    async function loginUser(username, authHash) {
        username = (username || '').toLowerCase();
        const user = username ? await idbGet('users', username) : null;
        const digest = authHash ? await sha256Hex(authHash) : null;
        if (!user || !digest || user.authHashDigest !== digest) throw new LocalAuthError(401, 'Invalid credentials');
        const token = crypto.randomUUID();
        const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
        await idbPut('sessions', { token, username, expires });
        return { token, username, expires };
    }

    function bearerToken(init) {
        const h = init && init.headers;
        if (!h) return null;
        const auth = (h instanceof Headers) ? h.get('Authorization') : (h['Authorization'] || h['authorization']);
        if (!auth || !auth.startsWith('Bearer ')) return null;
        return auth.slice(7);
    }

    async function usernameForToken(token) {
        if (!token) return null;
        const session = await idbGet('sessions', token);
        if (!session) return null;
        if (new Date(session.expires) < new Date()) return null;
        return session.username;
    }

    async function requireUser(init) {
        return usernameForToken(bearerToken(init));
    }

    async function handleLocalRequest(path, init) {
        const method = ((init && init.method) || 'GET').toUpperCase();
        const body = (init && init.body) ? JSON.parse(init.body) : {};

        if (path === '/auth/register' && method === 'POST') {
            try {
                return jsonResponse(200, await registerUser(body.username, body.auth_hash));
            } catch (err) {
                if (err instanceof LocalAuthError) return jsonResponse(err.status, { error: err.message });
                throw err;
            }
        }

        if (path === '/auth/login' && method === 'POST') {
            try {
                return jsonResponse(200, await loginUser(body.username, body.auth_hash));
            } catch (err) {
                if (err instanceof LocalAuthError) return jsonResponse(err.status, { error: err.message });
                throw err;
            }
        }

        // Every other endpoint needs a valid local session token
        const username = await requireUser(init);
        if (!username) return jsonResponse(401, { error: 'Invalid or missing token' });

        if (path === '/get_kvs/' && method === 'GET') {
            const rows = await idbGetAllByIndex('kv', 'byUsername', username);
            return jsonResponse(200, rows.map(r => ({ key: r.key, value: r.value })));
        }

        if (path === '/add_kv/' && method === 'POST') {
            if (!body.key) return jsonResponse(400, { error: 'Missing key' });
            if (await idbGet('kv', [username, body.key])) return jsonResponse(409, { error: 'Key already exists' });
            await idbPut('kv', { username, key: body.key, value: body.value });
            return jsonResponse(201, { key: body.key });
        }

        if (path === '/update_kv/' && method === 'POST') {
            if (!body.key) return jsonResponse(400, { error: 'Missing key' });
            await idbPut('kv', { username, key: body.key, value: body.value });
            return jsonResponse(200, { key: body.key });
        }

        if (path === '/delete_kv/' && method === 'POST') {
            if (!body.key) return jsonResponse(400, { error: 'Missing key' });
            await idbDelete('kv', [username, body.key]);
            return jsonResponse(200, { key: body.key });
        }

        return jsonResponse(404, { error: 'Not found' });
    }

    const originalFetch = window.fetch.bind(window);
    window.fetch = function (input, init) {
        const url = (typeof input === 'string') ? input : (input && input.url) || '';
        if (url.startsWith(SENTINEL)) {
            const path = url.slice(SENTINEL.length) || '/';
            return handleLocalRequest(path, init || {}).catch(err => {
                console.error('Local kvstore error:', err);
                return jsonResponse(500, { error: err.message || 'Local kvstore error' });
            });
        }
        return originalFetch(input, init);
    };

    // Federation-dependent features (Collab, Annotate/annotations following, CListBin, P2P chat,
    // DID identity) all require an external server to verify the kvstore-issued token — something
    // only a real, network-reachable kvstore instance can do. A local-only account has no public
    // URL, so other code checks this flag to hide those entry points rather than let them fail.
    window.CList.isLocalMode = function () {
        return !!(window.CList.config && window.CList.config.flaskSiteUrl === SENTINEL);
    };

    // Exposed so js/kvstore-local.js (the storage.js facade's local adapter) can talk to the
    // same IndexedDB store directly instead of round-tripping through the fetch interception
    // above — see docs/storage-architecture-plan.md §3-§5. registerUser/loginUser are the same
    // seam used by kvstore.js's KVregisterWithCredentials/KVloginWithCredentials when in local
    // mode (§8 step 5(b)) — both throw LocalAuthError(status, message) on failure.
    window.CList._localKvStore = {
        idbGet, idbPut, idbAdd, idbDelete, idbUpdateIfExists, idbDeleteIfExists, idbGetAllByIndex,
        usernameForToken, registerUser, loginUser
    };
})();
