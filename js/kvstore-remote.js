//  kvstore-remote.js  -  HTTP adapter for the storage.js facade
//
//  Copyright Stephen Downes 2026, downes.ca
//  Licensed under Creative Commons Attribution 4.0 International https://creativecommons.org/licenses/by/4.0/
//
//  This software carries NO WARRANTY OF ANY KIND.
//  This software is provided "AS IS," and you, its user, assume all risks when using it.
//
//  Talks to a real kvstore Flask server over the four existing endpoints (get_kvs/add_kv/
//  update_kv/delete_kv). Every function takes an explicit ctx = {baseUrl, token} snapshotted
//  once by storage.js rather than reading window.CList.config/cookies itself (operation-level
//  snapshot discipline, docs/storage-architecture-plan.md §3), so this file has no state of its
//  own and no notion of "current" account.
//
//  There is no single-key GET endpoint on the server, so get() lists and finds client-side —
//  same as every existing caller already does.

window.CList = window.CList || {};

(function () {
    const { KvStoreError } = window.CList;

    function codeForStatus(status) {
        if (status === 400) return 'InvalidData';
        if (status === 401) return 'NotAuthenticated';
        if (status === 403) return 'NotAuthorized';
        if (status === 404) return 'NotFound';
        if (status === 409) return 'AlreadyExists';
        return 'StorageUnavailable';
    }

    async function errorMessage(res) {
        try {
            const body = await res.json();
            return body.error || `Server returned ${res.status}`;
        } catch {
            return `Server returned ${res.status}`;
        }
    }

    async function doFetch(operation, ctx, path, init) {
        let res;
        try {
            res = await fetch(`${ctx.baseUrl}${path}`, init);
        } catch (err) {
            throw new KvStoreError('StorageUnavailable', operation, err);
        }
        if (!res.ok) {
            throw new KvStoreError(codeForStatus(res.status), operation, new Error(await errorMessage(res)));
        }
        return res;
    }

    async function list(ctx) {
        const res = await doFetch('list', ctx, '/get_kvs/', {
            headers: { 'Authorization': 'Bearer ' + ctx.token },
        });
        return res.json();
    }

    async function get(ctx, key) {
        const rows = await list(ctx);
        return rows.find(r => r.key === key) || null;
    }

    async function add(ctx, key, value) {
        await doFetch('add', ctx, '/add_kv/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + ctx.token },
            body: JSON.stringify({ key, value }),
        });
    }

    async function update(ctx, key, value) {
        await doFetch('update', ctx, '/update_kv/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + ctx.token },
            body: JSON.stringify({ key, value }),
        });
    }

    async function remove(ctx, key) {
        await doFetch('remove', ctx, '/delete_kv/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + ctx.token },
            body: JSON.stringify({ key }),
        });
    }

    async function put(ctx, key, value) {
        try {
            await add(ctx, key, value);
        } catch (err) {
            if (err.code === 'AlreadyExists') {
                await update(ctx, key, value);
                return;
            }
            throw err;
        }
    }

    window.CList.kvStoreRemote = { list, get, add, update, remove, put };
})();
