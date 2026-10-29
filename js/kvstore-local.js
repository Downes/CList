//  kvstore-local.js  -  direct IndexedDB adapter for the storage.js facade
//
//  Copyright Stephen Downes 2026, downes.ca
//  Licensed under Creative Commons Attribution 4.0 International https://creativecommons.org/licenses/by/4.0/
//
//  This software carries NO WARRANTY OF ANY KIND.
//  This software is provided "AS IS," and you, its user, assume all risks when using it.
//
//  Backs "Local - nothing leaves your computer" mode for the storage.js facade. Talks to the
//  same IndexedDB database as local-kvstore.js (clist_local_kvstore / kv store) directly, via
//  the helpers local-kvstore.js exposes on window.CList._localKvStore — it does NOT go through
//  window.fetch or the sentinel-URL interception local-kvstore.js installs. The two will keep
//  working side by side until the fetch interception itself is removed
//  (docs/storage-architecture-plan.md §8 step 5). Local register/login (kvstore.js's
//  KVregisterWithCredentials/KVloginWithCredentials) also call window.CList._localKvStore
//  directly in local mode now, bypassing the fetch interception the same way this file does for
//  KV ops (§8 step 5(b), done) — that logic lives in kvstore.js, not here, since register/login
//  aren't part of the storage.js KV facade this file implements.
//
//  update()/remove() reject NotFound on a missing key, matching Flask's 404 for /update_kv/ and
//  /delete_kv/ (§5), via local-kvstore.js's idbUpdateIfExists/idbDeleteIfExists — a single
//  read-write transaction does the existence check and the conditional write/delete together, so
//  nothing can race between them. put() is the one deliberate exception: it's documented (§4) as
//  an explicit add-or-update upsert, so it keeps using plain idbPut with no existence check.

window.CList = window.CList || {};

(function () {
    const { KvStoreError } = window.CList;

    function helpers() {
        const h = window.CList._localKvStore;
        if (!h) {
            throw new KvStoreError('StorageUnavailable', 'local-adapter', new Error('local-kvstore.js helpers not available'));
        }
        return h;
    }

    async function usernameFor(ctx) {
        const username = await helpers().usernameForToken(ctx.token);
        if (!username) throw new KvStoreError('NotAuthenticated', 'local', null);
        return username;
    }

    // Centralizes error normalization the way kvstore-remote.js's doFetch() does: anything that
    // isn't already a KvStoreError came from the IndexedDB layer itself (a blocked/rejected
    // open, a stale transaction, etc.) and surfaces as StorageUnavailable rather than a raw
    // DOMException or a silent no-op (docs/storage-architecture-plan.md §5). add()'s native
    // key-collision failure (ConstraintError) and update()/remove()'s missing-key failure
    // (LocalNotFoundError's `notFound` flag, from local-kvstore.js's idbUpdateIfExists/
    // idbDeleteIfExists) are the two cases that map to a specific code instead.
    async function run(operation, fn) {
        try {
            return await fn();
        } catch (err) {
            if (err instanceof KvStoreError) throw err;
            if (err && err.name === 'ConstraintError') throw new KvStoreError('AlreadyExists', operation, err);
            if (err && err.notFound) throw new KvStoreError('NotFound', operation, err);
            throw new KvStoreError('StorageUnavailable', operation, err);
        }
    }

    async function list(ctx) {
        return run('list', async () => {
            const h = helpers();
            const username = await usernameFor(ctx);
            const rows = await h.idbGetAllByIndex('kv', 'byUsername', username);
            return rows.map(r => ({ key: r.key, value: r.value }));
        });
    }

    async function get(ctx, key) {
        return run('get', async () => {
            const h = helpers();
            const username = await usernameFor(ctx);
            const row = await h.idbGet('kv', [username, key]);
            return row ? { key: row.key, value: row.value } : null;
        });
    }

    async function add(ctx, key, value) {
        return run('add', async () => {
            const h = helpers();
            const username = await usernameFor(ctx);
            // Native add() fails with ConstraintError if the key already exists — no separate
            // get()-then-put() needed, so there's no gap for another tab to race into (§5).
            await h.idbAdd('kv', { username, key, value });
        });
    }

    async function update(ctx, key, value) {
        return run('update', async () => {
            const h = helpers();
            const username = await usernameFor(ctx);
            await h.idbUpdateIfExists('kv', [username, key], { username, key, value });
        });
    }

    async function remove(ctx, key) {
        return run('remove', async () => {
            const h = helpers();
            const username = await usernameFor(ctx);
            await h.idbDeleteIfExists('kv', [username, key]);
        });
    }

    async function put(ctx, key, value) {
        return run('put', async () => {
            const h = helpers();
            const username = await usernameFor(ctx);
            await h.idbPut('kv', { username, key, value });
        });
    }

    window.CList.kvStoreLocal = { list, get, add, update, remove, put };
})();
