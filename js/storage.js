//  storage.js  -  KVStore facade for CList
//
//  Copyright Stephen Downes 2026, downes.ca
//  Licensed under Creative Commons Attribution 4.0 International https://creativecommons.org/licenses/by/4.0/
//
//  This software carries NO WARRANTY OF ANY KIND.
//  This software is provided "AS IS," and you, its user, assume all risks when using it.
//
//  Single entry point for generic key/value storage (window.CList.storage.kv.*), per
//  docs/storage-architecture-plan.md §3-§5 and docs/storage-model.md. Callers no longer branch
//  on local vs. remote mode themselves — each call here snapshots mode/baseUrl/token once and
//  delegates to window.CList.kvStoreRemote or window.CList.kvStoreLocal (js/kvstore-remote.js,
//  js/kvstore-local.js), both of which expose the same list/get/add/update/remove/put shape.
//
//  This facade is encryption-agnostic: it stores and returns whatever value a caller gives it.
//  Encrypting/decrypting that value (crypto_utils.js) remains the caller's responsibility, same
//  as it is today.

window.CList = window.CList || {};

(function () {
    class KvStoreError extends Error {
        constructor(code, operation, cause) {
            const causeMsg = cause && cause.message ? ` (${cause.message})` : '';
            super(`${operation} failed: ${code}${causeMsg}`);
            this.name = 'KvStoreError';
            this.code = code;           // NotAuthenticated | NotAuthorized | StorageUnavailable | Indeterminate | NotFound | AlreadyExists | InvalidData
            this.operation = operation; // 'list' | 'get' | 'add' | 'update' | 'remove' | 'put'
            this.cause = cause || null;
        }
    }
    window.CList.KvStoreError = KvStoreError;

    function snapshot() {
        const isLocal = !!(window.CList.isLocalMode && window.CList.isLocalMode());
        const baseUrl = window.CList.config.flaskSiteUrl;
        const token = getSiteSpecificCookie(baseUrl, window.CList.keys.ACCESS_TOKEN);
        return { isLocal, baseUrl, token };
    }

    function adapterFor(ctx) {
        const adapter = ctx.isLocal ? window.CList.kvStoreLocal : window.CList.kvStoreRemote;
        if (!adapter) {
            throw new KvStoreError('StorageUnavailable', 'adapter', new Error(
                ctx.isLocal ? 'kvstore-local.js not loaded' : 'kvstore-remote.js not loaded'
            ));
        }
        return adapter;
    }

    // Matches Flask's own validation (/srv/apps/kvstore/routes.py: add_kv/update_kv require both
    // key and value, delete_kv requires key) so a bad call fails the same way in both modes and
    // local mode doesn't silently store a malformed record Flask would have rejected (§4/§5).
    // Checked here, once, so both adapters benefit without duplicating the rule, and a remote
    // call fails before wasting a network round trip.
    function requireKey(key, operation) {
        if (typeof key !== 'string' || key.length === 0) {
            throw new KvStoreError('InvalidData', operation, new Error('key must be a non-empty string'));
        }
    }
    function requireValue(value, operation) {
        if (typeof value !== 'string' || value.length === 0) {
            throw new KvStoreError('InvalidData', operation, new Error('value must be a non-empty string'));
        }
    }

    async function run(operation, fn) {
        const ctx = snapshot();
        if (!ctx.token) {
            throw new KvStoreError('NotAuthenticated', operation, null);
        }
        try {
            return await fn(adapterFor(ctx), ctx);
        } catch (err) {
            if (err instanceof KvStoreError) throw err;
            throw new KvStoreError('Indeterminate', operation, err);
        }
    }

    window.CList.storage = {
        get mode() {
            return (window.CList.isLocalMode && window.CList.isLocalMode()) ? 'local' : 'remote';
        },
        kv: {
            list:   () =>        run('list',   (adapter, ctx) => adapter.list(ctx)),
            get:    async (key) => { requireKey(key, 'get'); return run('get', (adapter, ctx) => adapter.get(ctx, key)); },
            add:    async (key, value) => { requireKey(key, 'add'); requireValue(value, 'add'); return run('add', (adapter, ctx) => adapter.add(ctx, key, value)); },
            update: async (key, value) => { requireKey(key, 'update'); requireValue(value, 'update'); return run('update', (adapter, ctx) => adapter.update(ctx, key, value)); },
            remove: async (key) => { requireKey(key, 'remove'); return run('remove', (adapter, ctx) => adapter.remove(ctx, key)); },
            put:    async (key, value) => { requireKey(key, 'put'); requireValue(value, 'put'); return run('put', (adapter, ctx) => adapter.put(ctx, key, value)); },
        },
    };
})();
