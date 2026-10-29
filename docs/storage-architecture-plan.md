# CList Storage Architecture — Detailed Implementation Instructions for Claude

**Version:** 1.9  
**Date:** 28 October 2026  
**Status:** Design guidance and implementation brief. §8 steps 1, 3, 4, and 6 are now implemented
(see below, and the per-step notes in §8). Step 5's sub-item (b) is now done too (see "Changes in
1.7"); the global `window.fetch` override itself has *not* yet been removed — that still needs
step 7's regression testing first, per step 5's own acceptance criterion. §5's IndexedDB
transaction-discipline requirements for the KV side (`local-kvstore.js`/`kvstore-local.js`) are now
implemented too (see "Changes in 1.8"), and so is §5's value-domain validation and local
update/remove 404-matching (see "Changes in 1.9"). Still not done: §8 step
2 (baseline backups/tests, never performed), the remainder of §8 step 5 (removing the global
`fetch` override — now unblocked but not yet done, pending step 7), §8 step 7
(regression/browser testing — explicitly deferred by the user until more of the broader refactor
lands), and §8 step 8 (the file-by-file change summary — see `docs/storage-migration-summary.md`,
added in 1.7, not yet updated for 1.8 or 1.9's changes). PageStore's full surface —
`save`/`get`/`list`/`remove`/`recordPublication`/`exportPages`/`importPages` — is now wired
end-to-end including UI (§6, §6a, §7 item 4).

**Changes in 1.9:** Closed the two remaining §5 gaps flagged in 1.8's audit:
1. **Value-domain validation (§5 "Value domain"):** `js/storage.js`'s `kv.add`/`kv.update`/
   `kv.put` now call a new `requireValue(value, operation)` check, and `kv.add`/`kv.update`/
   `kv.remove`/`kv.get`/`kv.put` all call a new `requireKey(key, operation)` check, both throwing
   `KvStoreError('InvalidData', operation, ...)` for an absent/non-string/empty `key` or `value` —
   matching Flask's own `add_kv`/`update_kv`/`delete_kv` validation (`key and value are required`
   / `key is required`, both 400) exactly, and checked once in the facade so both adapters benefit
   and a doomed remote call fails before a wasted network round trip. `KvStoreError`'s code list
   gained `InvalidData`. `kvstore-remote.js`'s `codeForStatus()` had no case for HTTP 400 at all
   (it fell through to `StorageUnavailable`, mis-categorizing a real server-side validation
   rejection) — it now maps 400 → `InvalidData` too, as defense in depth for any validation
   difference the client-side check doesn't happen to replicate.
2. **Update/remove 404-matching (§5 "Update"/"Delete"):** reverses 1.8's "deliberately still do
   not gain a new existence check" decision for `update`/`remove` (not for `put`, which stays an
   intentional upsert per §4) — explicit user decision, 2026-10-28: local `update`/`remove` now
   reject `NotFound` on a missing key, matching Flask's 404, instead of silently
   inserting/no-op-ing. Implemented per this section's same-transaction requirement below:
   `local-kvstore.js` gained `idbUpdateIfExists()`/`idbDeleteIfExists()`, each issuing the `get()`
   and the conditional `put()`/`delete()` against the same read-write transaction (aborting via
   `tx.abort()` on a miss, rejecting a new `LocalNotFoundError` from `tx.onabort`) — not a separate
   `idbGet()` then `idbPut()`/`idbDelete()`, which would reopen the exact TOCTOU gap 1.8 closed for
   `add()`. `kvstore-local.js`'s `update()`/`remove()` now call these instead of plain
   `idbPut()`/`idbDelete()`, and its `run()` wrapper maps `LocalNotFoundError`'s `notFound` flag to
   `KvStoreError('NotFound', operation, ...)`. `kvstore-local.js`'s header comment, which claimed
   this divergence was intentional and documented, is corrected accordingly.

**Changes in 1.7:** Implemented §8 step 5(b): `js/local-kvstore.js` now exposes `registerUser(username, authHash)`
and `loginUser(username, authHash)` on `window.CList._localKvStore` (alongside the existing
`idbGet`/`idbPut`/etc.) — pulled out of `handleLocalRequest`'s `/auth/register`/`/auth/login`
branches, which now call them too and wrap the result/`LocalAuthError` back into a `Response`,
so the fetch-interception path's behavior is unchanged. `js/kvstore.js`'s
`KVregisterWithCredentials`/`KVloginWithCredentials` now check `window.CList.isLocalMode()` and,
when true, call `registerUser`/`loginUser` directly instead of `fetch`-ing
`${flaskSiteUrl}/auth/register`/`/auth/login` — PBKDF2 derivation, cookie storage, and the
`encKey` sessionStorage write are unchanged either way, and only `auth_hash` (never the raw
password or `encKey`) crosses into local-kvstore.js, preserving the no-plaintext-credential
property stated in that file's header. Local register/login no longer depends on the global
`fetch` override at all. Also added `docs/storage-migration-summary.md` (§8 step 8's
file-by-file change summary).

**Changes in 1.8:** Closed three gaps against §5's IndexedDB transaction-discipline requirements,
found during an audit of the plan against the current code (not previously reported):
1. `local-kvstore.js`'s `openDb()` now sets `db.onversionchange` on the resolved connection (close
   it, null out the cached promise, `showStatusMessage()` a reload prompt) — it had none before,
   unlike `page-store-idb.js`'s equivalent, which already did this correctly.
2. `openDb()` now also handles `req.onblocked`, rejecting rather than hanging, and resets the
   cached `dbPromise` on either `onblocked` or `onerror` so a later call can retry instead of being
   stuck on a dead promise.
3. `kvstore-local.js`'s `add()` used to do `idbGet` (its own read transaction) then `idbPut` (a
   separate write transaction) — a check-then-write race across tabs, called out by name in §5.
   `local-kvstore.js` now exposes `idbAdd()`, which uses IndexedDB's native `add()` inside one
   transaction and relies on its native `ConstraintError` on key collision, so there's no gap
   between the check and the write. `kvstore-local.js`'s `add`/`update`/`remove`/`get`/`list`/`put`
   all now also route through a `run(operation, fn)` wrapper (mirroring `kvstore-remote.js`'s
   `doFetch`) that maps any non-`KvStoreError` failure — a blocked/rejected open, a dead
   transaction — to `KvStoreError('StorageUnavailable', ...)` instead of a raw `DOMException` or a
   silent no-op, per §5's requirement.
   `update()`/`remove()`/`put()` deliberately still did **not** gain a new existence check in this
   pass — that upsert/always-succeeds divergence from Flask's 404 semantics was treated as an
   already-documented, intentional local/remote difference (§5's "Semantics that must be
   reconciled" list, and `kvstore-local.js`'s own header comment at the time); this pass fixed only
   the race in `add()`'s check-then-write. **Superseded in 1.9** for `update`/`remove` (not
   `put`) — see "Changes in 1.9".

**Changes in 1.6:** Implemented the `exportPages()`/`importPages()` UI that 1.5 identified as the
one remaining PageStore gap. Added to `js/page-store.js`'s existing "CList (local)" loader (the
one surface that already lists every locally saved page): an "Export all pages" button
(`_exportAllPages()` — calls `exportPages()`, `JSON.stringify`s the bundle, triggers a browser
download via the same Blob/`createObjectURL`/anchor-click pattern `collections.js`'s "Save to
file" already uses) and an "Import pages..." button (`_showImportPagesPicker()` — file picker +
`onConflict` select (`skip`/`replace`/`duplicate`), reads the file with `file.text()`, calls
`importPages()`, and reports the `ImportResult` counts via `showStatusMessage`/`showErrorModal`
per `docs/error-handling.md`, with `console.error` alongside on any failure). Reuses existing
button classes (`btn`, `btn-small`, `btn-secondary`) and the `published-page-confirm` row class —
no new CSS. Verified via `node --check js/page-store.js`.

**Changes in 1.5:** Cross-referenced this plan against actual file state (code, not just doc
headers, which had drifted) — see CLAUDE.md's "Keeping CLAUDE.md Files Current" spirit applied to
this living plan doc too. §8 step 4 (caller migration): done — all `js/kvstore.js` call sites
(~19) now go through `window.CList.storage.kv.*`; the only raw `get_kvs`/`add_kv`/`update_kv`
fetches left are the explicitly-excluded cross-server migration block (§3's scoped-adapter
exception), keyed on an explicit `serverUrl` param rather than `flaskSiteUrl`. §8 step 1's
allowlist-by-schema flip: done, in `getAccounts()` (`kvstore.js`), gated on
`window.CList.schemas[type]`. §8 step 6 / §6a: found already implemented — `js/page-store.js`,
`js/page-store-idb.js` exist, are loaded in `index.html`, and are wired through
`window.CList.savers`/`loaders`; both named `publish.js` call sites (`_performWebPagePublish()`'s
non-overwrite branch and `postAll()`'s per-account loop) call `recordPublication()` exactly as
specified. This was done in a prior pass not reflected in this doc's previous revision — doc text
corrected to match, not re-implemented. Not found (at the time, since fixed in 1.6): any UI for
`exportPages()`/`importPages()` (§6's "page-library backup" / §7 item 4) — the functions existed
but nothing called them from a button or screen.

**Changes in 1.3:** publication-status tracking on `PageRecord` — a new `publications` field and a
new `recordPublication()` API (§6a), resolving one of the open questions §10 raised (whether
publishing a local page forks its identity) while leaving the rest of §10 deferred; the two
not-yet-wired `publish.js` call sites this implies are named explicitly (§6a, §8 step 6) as planned,
not implemented, work.

**Changes in 1.2:** operation-level backend/auth snapshotting (§3, §4); IndexedDB transaction-completion
semantics and combined existence-check-and-write transactions (§5, §6); explicit deferral of the
editor page-identity/state contract, with the open scenarios enumerated (§10); a more precise error
contract — `NotAuthorized` distinct from `NotAuthenticated`, an `Indeterminate` outcome distinct from
`StorageUnavailable`, retained `{code, operation, cause}`, no automatic write retries (§4); PageStore
optimistic concurrency via a `revision` field (§6); an explicit scoped-adapter exception for
cross-server migration (§3, §7); precise value-domain and import-integrity rules (§5, §6, §7); and
corresponding acceptance tests (§9).

## 1. Objective

Refactor CList so that persistent key–value operations use one explicit interface with interchangeable **local IndexedDB** and **remote Flask KVStore** adapters. Independently, introduce a **local PageStore** using IndexedDB so the contents of any supported editor can be saved and reopened as a CList page without direct filesystem access.

**Recommended names:** `js/storage.js` for the KVStore facade and selection logic; `js/kvstore-remote.js` and `js/kvstore-local.js` for its adapters; `js/page-store.js` for the local page API and `js/page-store-idb.js` for its IndexedDB implementation. Keep the existing `js/kvstore.js` as the account/UI and identity orchestration layer while migrating its direct storage calls.

This is a refactor of responsibilities, **not** a redesign of authentication, encryption, page representation, federation, or existing stored data. Do not introduce Node.js, npm, React, or a build step; maintain CList's plain browser JavaScript approach.

## 2. Existing behavior and the data that must be preserved

The supplied `routes.py` shows that the remote service exposes `/get_kvs/`, `/add_kv/`, `/update_kv/`, and `/delete_kv/` for arbitrary key–value pairs belonging to an authenticated user. Consequently, KVStore **must not** be modeled merely as an account database.

The current public `js/kvstore.js` provides concrete examples of KVStore records:

- **Service configuration and accounts:** encrypted records describing external readers, publishers, services, permissions, and credentials (including integrations such as Mastodon, Bluesky, WordPress, and others).
- **Collections:** per `docs/collection-conceptual-model-v1.08.md` (v1.09), a collection's own properties live in a `collection:{id}` record; its members live in separate `membership:{collectionId}:{membershipId}` records, one per entry, each carrying an embedded member snapshot or a `{ ref: ... }` pointer into another collection or into PageStore. Do not assume a collection is one KV record containing all its entries — that was the pre-1.09 shape and this refactor should not reintroduce it.
- **DID private-key material:** a client-side encrypted record under `_did_identity_key`.
- **Following relationships:** encrypted records with keys beginning `social:following:`.
- **Other namespaced records:** logic in `getAccounts()` distinguishes keys beginning `_`, `collection:`, and `clist:`. Their complete ownership and use must be inventoried before modifying filters, migrations, or exports. Do not assume these prefixes are disposable.

Two additional facilities in the provided Flask routes are **not ordinary KV records**:

- Public DID documents reside in `User.did_document`, with public resolution and handle-lookup routes.
- The five-minute P2P discussions registry uses `discussions.json` and `/api/discussions`. Discovery through this registry inherently requires a network-reachable account — a local-only (IndexedDB) account has no way to be found by other peers, unlike generic KV data, which works the same in either mode. This is a hard constraint of P2P discovery, not a gap for this refactor to close.

Keep these services and their externally verifiable identities separate from generic KV storage. The local adapter is **not** a fake federation server and must not claim to provide publicly resolvable DID documents or remotely verifiable sessions.

**Evidence boundary:** These are code-defined uses, not an inspection of live database contents. Claude should search the entire repository for every KV endpoint call and every key prefix before finalizing the data inventory.

## 3. Proposed architecture

Keep four concerns distinct:

1. **Authentication/session handling:** login, registration, session and encryption-key lifecycle. Preserve existing user-facing login functions and the current hosted authentication mechanisms (JWT and legacy opaque tokens). The existing local registration/login behavior can remain local. Do not assume local credentials are interchangeable with server credentials.
2. **KVStore facade:** `js/storage.js` owns the stable general-purpose API and chooses the backend for the active KVStore identity/configuration. It does not know whether a record is an account, feed collection, DID secret, or follow record.
3. **KVStore adapters:** `js/kvstore-remote.js` makes authenticated HTTP requests to the Flask API; `js/kvstore-local.js` uses the existing IndexedDB `clist_local_kvstore` database and its user-scoped `kv` records. Adapters receive already-encoded/encrypted values; they must not unexpectedly encrypt, decrypt, reinterpret, or rewrite them.
4. **PageStore:** `js/page-store.js` exposes a page API, backed by `js/page-store-idb.js`, separate from the per-user KV records. It is **always local** in this phase, whether the selected KVStore account is local or remote, and should be usable without a KVStore login.

At initialization, determine the KV backend from the existing configuration, retaining compatibility with the `http://local.clist` sentinel until a deliberate configuration migration. A local or remote KV backend is a choice about *account-related KV persistence*, not a choice about whether local page storage exists.

`storage.mode` (§4) must be a derived, read-only value from this same sentinel check — e.g. a getter returning `isLocalMode() ? 'local' : 'remote'` — never a second, independently-set flag. `isLocalMode()` already drives the cookie/localStorage split for auth-token storage (see the `project_clist_file_protocol` memory's six-storage-configuration matrix); letting `storage.mode` diverge from it would reproduce the same class of bug just fixed between `getAccounts()` and `getSite()` — two independently-maintained answers to the same question quietly drifting apart. This also means the remote adapter (`js/kvstore-remote.js`) inherits the already-deferred, accepted `file://` + remote-KVStore CORS gap (case 6 of that matrix): Caddy's CORS allowlist for `kvstore.mooc.ca` has no entry for `file://`'s null origin, so that combination fails today and is not something this refactor needs to fix.

**Every facade operation must snapshot its backend context once, at the start, and never re-read it
mid-operation.** `js/storage.js` resolves `mode`, the server base URL, and the active auth
token/session exactly once per `list/get/add/update/remove` call, and threads that snapshot through
to completion — it does not call `isLocalMode()` or re-read the active session a second time while
the promise is pending. Concretely: each adapter function receives `{ mode, baseUrl, token }` as an
explicit parameter (or a closure captured at call time), never something it looks up itself partway
through. This matters because a `list()` against the remote server can take long enough for the user
to log out, switch accounts, or flip local/remote mode before it resolves — without a snapshot, the
in-flight call could silently finish against a different destination or with a different identity
than the one that started it. An operation started against account/backend A completes against A (or
fails outright) — it never completes against B just because B became active before the response came
back.

The current `local-kvstore.js` overrides `window.fetch` globally to intercept a sentinel origin. **Replace that mechanism only after all CList KV call sites have been migrated** to the facade and regression-tested. Network requests for other services, such as social platforms or the real discussions service, should continue through ordinary `fetch`.

### Account lifecycle this refactor must support

The local/remote choice above exists to serve a concrete progression, not a standing either/or:

1. **No account.** A visitor reads feeds with nothing persisted — today's existing anonymous behavior.
2. **"I want to keep this."** Prompted to create an account, defaulting to local (IndexedDB) storage — no server involved. A local account should not be arbitrarily cut off from remote-dependent features (e.g. Collab) that don't actually require a verified remote identity; which features genuinely need one is open, not resolved by this refactor (see below).
   - **Branch:** the same local-first path extends to running CList from `file://` or as a packaged desktop app (Windows/Mac/Linux). `file://` inherits the known, accepted CORS gap (case 6 of the six-configuration matrix). A packaged app may or may not inherit it depending on how it's built (e.g. an app serving its own files over a local HTTP origin behaves like "localhost," not raw `file://`) — not designed here.
3. **"I want this on another browser/device."** The user migrates their account from local to a remote KVStore server. This is the scenario the local/remote adapters exist to make possible, but the migration mechanism itself — walking every local KV record and writing it to a chosen remote server — is not designed or built by this refactor. It corresponds to kvstore's own "Credential migration between kvstore instances" TODO item.
   **Explicit exception to the operation-snapshot rule above:** migration is inherently a two-backend
   operation (read from source, write to destination) and must never be forced through
   `CList.storage.kv`, which always targets the single currently active account's backend. Instead,
   construct two explicitly scoped adapter instances directly — e.g.
   `kvstoreLocalAdapter()` as the read source and `kvstoreRemoteAdapter({ baseUrl, token })` as the
   write destination (or the reverse) — and drive the copy loop against those two instances, not
   against the facade. The facade's job is "operate on the active account's backend"; migration's job
   is "operate on two backends that are, by definition, not both the active one at the same time."

**Deferred, not resolved here:** which remote-dependent features require a verified remote identity vs. just "some account to act as"; native desktop packaging and whether it reproduces the `file://` CORS gap; the local→remote migration UX and implementation.

## 4. Explicit KVStore interface (`js/storage.js`)

Expose a simple promise-based interface, for example:

```javascript
window.CList.storage.kv.list();              // [{ key, value }, ...]
window.CList.storage.kv.get(key);             // { key, value } or null
window.CList.storage.kv.add(key, value);      // fails if key already exists
window.CList.storage.kv.update(key, value);   // fails if key does not exist
window.CList.storage.kv.remove(key);          // fails if key does not exist
window.CList.storage.mode;                    // 'local' or 'remote'
```

This is a proposed public contract, not a drop-in implementation. Keep the values opaque and preserve their existing serialized form.

**Error contract.** Specify stable error categories so interface code is never coupled to HTTP
status codes or IndexedDB exceptions, and keep two distinctions that matter for how a caller reacts:

- `NotAuthenticated` (no valid identity at all — the caller should prompt login) vs. `NotAuthorized`
  (a valid, authenticated identity that simply lacks access to this record — the caller should *not*
  prompt login again, since that would never resolve the problem).
- `StorageUnavailable` (the operation definitely did not happen — safe to retry or tell the user to
  retry) vs. `Indeterminate` (a network failure occurred after the request was sent but before a
  response was received, so whether the write actually landed is unknown — the caller must not treat
  this the same as a confirmed failure, and must not silently retry a write whose outcome it can't
  rule out as already-applied).
- Plus `NotFound` and `AlreadyExists` for the documented 404/409 cases (§5), and `InvalidData` for
  the documented 400 value-domain validation case (§5, "Value domain" — implemented 1.9).

Every rejection carries `{ code, operation, cause }` — `code` one of the categories above,
`operation` the facade call that failed (`'kv.add'`, `'kv.update'`, …) for logging/debugging,
`cause` the underlying error (HTTP status/body, or the IndexedDB `DOMException`) rather than a
re-stringified message, so nothing is lost for `console.error()`. **Do not automatically retry a
write** (`add`/`update`/`remove`/`put`) unless its outcome can be determined safely — e.g. a
`StorageUnavailable` that fired before the request left the browser (a thrown error from `fetch`
itself, or a `DOMException` before any IndexedDB request was placed) is safe to retry; an
`Indeterminate` result is not, and must surface to the caller as such rather than being silently
retried or silently swallowed. Reads (`list`/`get`) have no such restriction — retrying a read has no
side effect.

The facade itself stays UI-agnostic and must not call UI helpers directly. Every caller that consumes a normalized error from `CList.storage.kv` surfaces it the same way the rest of the app already does, per `docs/error-handling.md` and `docs/adding-a-service.md` §7: `showStatusMessage()` for transient feedback, `showErrorModal()` for validation that blocks a save, `showServiceError()` for hard failures, always with `console.error()` alongside. Do not invent a new error-display mechanism for this refactor.

**Server constraint:** `/get_kvs/` returns a complete array, not an endpoint for fetching one key. Implement `get(key)` over `list()` for the remote adapter initially, or add a separate server endpoint only if separately justified and tested. Do not silently assume `/get_kv/<key>` exists. Accept the one-`list()`-per-`get()` cost initially, but avoid *repeated* full-list downloads **within a single logical operation** — e.g. a caller resolving several keys in a row (as `getAccounts()` effectively does today) should fetch the list once and filter in memory, not call `storage.kv.get()` in a loop. This doesn't require a new facade method yet: it's a constraint on how multi-key callers are written during migration (§8 step 4), not a `getMany()` API addition — add one later only if a real caller shape demands it.

If a convenience **upsert** operation is desired, name it `put(key, value)` and document it explicitly as add-or-update. Do **not** conflate it with `update` or change existing caller behavior without review.

Keep authentication/token access internal to the relevant auth or remote-adapter path. Preserve callers that currently obtain a session key for client-side cryptography. `js/kvstore.js` should ultimately deal with account records and UI, not construct endpoint URLs for standard KV operations.

## 5. Semantics that must be reconciled

The provided Flask implementation and `local-kvstore.js` do not currently behave identically:

- **Add:** the Flask route rejects absent or empty `key` *or* `value`, and returns 409 if the key exists. The local route checks only the key; an IndexedDB `put()` inside a check-then-write can still race with another tab. *(Fixed in 1.8 — `idbAdd()`'s native `ConstraintError`, no separate check.)*
- **Value domain:** match the Flask route's validation exactly — both `key` and `value` are required, non-empty strings; an absent, `undefined`, `null`, or empty-string `key` or `value` is rejected the same way the server rejects it (a validation error, not `StorageUnavailable`). `null` is **not** a permitted value in either adapter. A caller that needs to represent "no value" must encode that explicitly within its own (already-opaque) serialized value — the facade does not invent a null/empty sentinel on callers' behalf. *(Fixed in 1.9 — `storage.js`'s `requireKey`/`requireValue`, `KvStoreError('InvalidData', ...)`.)*
- **Update:** the Flask route returns 404 for a missing key; the local route used to silently insert it (an upsert). *(Fixed in 1.9 for `update`/`remove` — `idbUpdateIfExists()`/`idbDeleteIfExists()` now reject `NotFound`. `put()` is unchanged and stays an intentional upsert, per §4.)*
- **Delete:** the Flask route returns 404 if absent; the local route used to report success even if absent. *(Fixed in 1.9 — see above.)*
- **Authentication:** the Flask service accepts JWTs and older opaque tokens. The local service uses a token recorded in its own IndexedDB `sessions` store, and hashes the provided `auth_hash` with SHA-256 for local verification; this is not the same storage procedure as server-side bcrypt.
- **Session duration:** the local implementation currently issues a one-year token. Preserve behavior during this refactor, but flag the duration for a separate security review rather than silently changing it.

Recommend matching the **documented Flask add/update/delete semantics** within the new public KVStore interface, while providing any intentional `put` operation separately. Verify that every client call site handles 404/409 consistently. Normalize errors in the adapters without modifying values or record keys.

**IndexedDB transaction discipline (applies to `kvstore-local.js` and `page-store-idb.js` alike):**
a request succeeding (`request.onsuccess`) is not the same guarantee as the transaction it belongs
to actually committing — a later request in the same transaction can still abort the whole thing.
Every write-returning promise must resolve on `transaction.oncomplete`, not on the individual
`request.onsuccess`, and reject on `transaction.onerror`/`transaction.onabort` (surfacing
`event.target.error` as `cause`, per §4's error contract). Also handle `db.onversionchange` (close
the stale connection and prompt a reload rather than leaving it to fail opaquely on the next
request) and a rejected `indexedDB.open()` (blocked upgrade, private-mode restrictions) as
`StorageUnavailable`, not as a silently-swallowed no-op.

For `add()`'s create-only check and `update()`/`remove()`'s existence check, **perform the check and
the write inside the same single read-write transaction** — opening a read transaction to check
existence, closing it, then opening a separate write transaction races against another tab exactly
the way a plain check-then-`put()` does. Use `add()`'s native key-already-exists failure for the
create-only case (no separate read needed), and for update/remove, issue the `get()` request and the
conditional `put()`/`delete()` request against the **same** transaction object so no other write can
interleave between the check and the write.

Fix robustness issues during the migration only where demonstrably needed: rejected database-open promises, blocked upgrades, multi-tab changes, and partial failures should be surfaced without falsely reporting successful saves.

Collections are the one KV data kind where the record-size assumption behind this section matters: pre-1.09, a single `collection:*` record could grow to tens of KB as entries accumulated, forcing a decrypt-modify-reencrypt-rewrite of the whole thing on every single membership change, and exposing concurrent edits to lost-update races on that one row. The `collection:*`/`membership:*` split (`docs/collection-conceptual-model-v1.08.md` §"Storage split") resolves this by keeping every KV record small and independently writable — `js/storage.js`'s `add`/`update`/`remove` are already the right shape for this; no new facade operation is needed.

## 6. Local page persistence: `js/page-store.js`

This is the immediate user-facing motivation for the work. Saving an editor page into IndexedDB replaces the need for Firefox to write directly to arbitrary filesystem paths. **It does not remove or prevent a separate export-to-file feature.**

PageStore being always-local is also a deliberate fit for the account-lifecycle branch where CList runs from `file://` or a packaged app (§3): it has no CORS exposure at all, unlike the remote KVStore adapter's known gap in that case. That's a reason to keep this design, not merely a side effect of it.

The local page API should be independent of KVStore identity:

```javascript
window.CList.pageStore.save(page);          // creates, updates, or rejects on revision conflict
window.CList.pageStore.get(id);             // page or null
window.CList.pageStore.list(options);       // page summaries
window.CList.pageStore.remove(id);          // delete a page
window.CList.pageStore.exportPages();       // downloadable backup data
window.CList.pageStore.importPages(data);   // validated, conflict-aware import
```

**Concurrency and conflict policy for `save(page)`:** every `PageRecord` carries an integer
`revision`, starting at 1 and incremented by exactly 1 on every successful save — a minimal
optimistic-concurrency check, deliberately simpler than a full `updatedAt`-based comparison (clock
skew/resolution makes timestamps a weaker equality check than a monotonic counter). The editor holds
the `revision` it last fetched via `get()`/`list()` and passes it back as `page.revision` on save:

- `page.id` present, existing record found, `page.revision` **matches** the stored revision → the
  write proceeds, stored revision becomes `+1`. This is the ordinary "I opened this page, edited it,
  saving again" path.
- `page.id` present, existing record found, `page.revision` **does not match** → reject with a
  `RevisionConflict` error (new PageStore-specific code, not reused from §4's KV error categories,
  since there is no server involved) and write nothing. The record was changed elsewhere (another
  tab, or an import) since this editor session opened it. The caller decides how to recover —
  re-fetch and show the user both versions, or deliberately force an overwrite by re-reading the
  current revision first — PageStore does not silently merge or silently clobber.
- `page.id` present, existing record found, `page.revision` **omitted** → treated as an explicit
  forced overwrite with no conflict check (the caller is asserting it doesn't care what's currently
  stored). This is the escape hatch for the recovery path above, not the default editor-save path.
- `page.id` absent or no existing record with that id → ordinary create, `revision` starts at 1
  regardless of what (if anything) was passed in `page.revision`.

Use a separate IndexedDB database, provisionally `clist_pages`, with a versioned `pages` object store keyed by `id`. A first version can store:

- `id`: stable page identifier; reuse an established authoritative identifier when applicable, otherwise generate a UUID v4 for a new locally created page.
- `title`: display title.
- `content`: the current editor's serialized text or HTML, without unwanted conversion.
- `contentType`: such as `text/plain` or `text/html`.
- `editorType`: e.g., textarea, TinyMCE, or Etherpad (actual names should follow the code).
- `createdAt` and `updatedAt`: ISO 8601 timestamps.
- `revision`: integer, starts at 1, incremented by exactly 1 on every successful `save()` — the
  optimistic-concurrency check described above.
- `sourceUri` and `sourceId` where available: references to original material, without replacing the local stable ID.
- `references`: the page's cited/pulled-in sources, stored as an embedded collection — an array of `{ membership, member }` pairs matching the shape in `docs/collection-conceptual-model-v1.08.md`, with each membership's `role` set to `"cites"`. Lives inside this page record, not as a separate `collection:*`/`membership:*` KVStore entity — its lifecycle is the page's lifecycle. Do not add KVStore round-trips for this; it's local, and typically small.

**References under import-time ID remapping:** `importPages()` (§7) can mint a fresh id for an
imported page under the `'duplicate'` conflict policy, which raises the question of what happens to
that page's own `references` array. Resolve it as a two-pass import within one bundle: pass one
writes every page in the bundle, building an old-id→new-id map for any id that got remapped; pass
two rewrites each imported page's `references[].member` entries whose target id appears in that
same map (i.e. the reference pointed at another page that was *also* in this bundle and *also* got
remapped) to the new id. A reference whose target id is **not** found in the map — because it points
outside the bundle entirely (a live `collection:*`/`membership:*` KVStore record, or a page already
present in this database) — is left untouched. A reference whose target id was in the bundle but
that target page failed validation and was never written (§7) is left as-is and reported in
`ImportResult` under a `danglingReferences` list, rather than silently dropped — the user can decide
whether to re-import the missing target or accept the gap.

Keep fields extensible, and add an `updatedAt` index for listing. Do **not** impose a new CList content format: the editor's original representation is authoritative. Existing editor contents may refer to externally hosted images or resources; IndexedDB will not automatically copy those dependencies offline. Binary asset support can be added later if a real use case requires it.

Integrate through the existing `window.CList.savers` / `window.CList.loaders` registries (see `docs/adding-a-service.md` §4–5), **not** by modifying each editor file directly. Push one entry onto each — e.g. `{ label: 'Save to CList (local)', icon: 'save', save: async () => { ... } }` and a matching `loaders` entry — that reads the active editor via `editorHandlers[currentEditor].getContent()` (the same way existing remote-save entries do) and then calls `pageStore.save()`; the `loaders` entry calls `pageStore.get()`/`list()` and returns `{ type, value }` for the editor's `loadContent()` to consume. This reaches every editor uniformly through the Save/Load panels already wired for that purpose, instead of adding a bespoke hook per editor. A second save of the *same* local page must update the existing record and its timestamp, not create an unnecessary duplicate. When reopening a page, retain the page ID in the editor state so a subsequent save updates rather than duplicates. Inspect `editorHandlers` and each editor's `getContent()`/`loadContent()` before writing this integration; do not assume every editor exposes its contents through a textarea.

Recommended labels: **Save to CList (local)** for the `savers` entry and **Export to file** for a standard browser download. Preserve the user's ability to export individual pages as well as a separate whole-library backup. Show a successful save only after its IndexedDB transaction completes; surface quota and permission failures via `showStatusMessage()` (transient) or `showErrorModal()` (blocking) per `docs/error-handling.md` — never `alert()`/`confirm()`/`prompt()` — and keep `console.error()` alongside. Any new page-listing/export/import UI must use the existing button classes (`clist-action-btn`, `btn`, `btn-small`, `btn-secondary` — see `CLAUDE.md`'s Icon/Text Button Pattern and `docs/adding-a-service.md` §8) with no new service-specific CSS classes and no inline style attributes.

An IndexedDB page is restricted to the browser profile and origin that wrote it. Firefox and Chrome do not share that database; even the same browser treats different site origins separately. Backups therefore matter. IndexedDB provides local data persistence but does not by itself make the CList application shell available offline: a service worker and cached application assets would be separate work.

**Privacy decision to leave explicit:** PageStore contents are readable by scripts running under the CList origin unless page encryption is designed. Do not assert that pages are encrypted merely because KVStore records are. Preserve current KVStore encryption and treat optional page encryption as a separate, documented design decision.

### 6a. Publication-status tracking on `PageRecord`

A local page that has been published somewhere (CListBin/Pastebin via `js/clistbin.js`, any other
`binPublishers` adapter, or an ordinary social publisher such as Mastodon/Bluesky) should carry that
fact on its own record, so an editor UI can later show "last published to X on date Y" alongside the
page itself, instead of that information living only in a separate, harder-to-correlate KVStore
record. This section specifies the record shape and API.

**Status, 2026-10-28: implemented**, including both named `publish.js` call sites below — found
already done during a plan-vs-code status cross-check (see §8 step 6), not implemented as part of
this revision. This text originally described planned, not-yet-wired work; left below for the
rationale, with status corrected inline.

**New `PageRecord` field:**

```javascript
publications: [
  { service: 'CListBin', accountId: null, url: '...', publishedAt: '2026-10-28T...', revision: 3 },
  // ...
]
```

Defaults to `[]` for a page that has never been published. Entries are **upserted by the pair
`(service, accountId)`** — republishing to the same service/account updates that entry in place
(new `url`/`publishedAt`/`revision`, same array slot); publishing to a different service, or a
different account on the same service, appends a new entry. This models "current publication status
per destination," not a full publish history log, matching the request that "the page information is
updated" when published — a page can be in several places at once (CListBin and Mastodon, say) but
has at most one current status per place.

**New API:**

```javascript
window.CList.pageStore.recordPublication(id, { service, accountId, url });
// -> updated PageRecord, or null if id does not exist
```

- `service`: string identifying the destination (`'CListBin'`, a social publisher's account type, etc).
- `accountId`: the specific account published to, or `null` when the service has no concept of
  multiple accounts (e.g. a single CListBin instance per browser profile). Part of the upsert key.
- `url`: the published URL, exactly as returned by the publish call.
- `publishedAt` and `revision` are **not** supplied by the caller — PageStore stamps them itself,
  reading the page's current stored `revision` fresh inside the same transaction, via the existing
  `_pageStoreReadThenWrite()` primitive (`js/page-store-idb.js`). This keeps "record what revision was
  actually published" accurate even if the caller's own in-memory copy of the page is stale.
- Not-found behaves like `get()`/`remove()`: returns `null`, does not throw. (A caller publishing a
  page that was deleted out from under it has nothing sensible to annotate.)

**Deliberately does not bump `revision`.** §6 defines `revision` as the content optimistic-concurrency
counter `save()`'s conflict check relies on. Bumping it for a metadata-only change would risk a
spurious `RevisionConflict` for an editor session that is mid-edit and still holding the pre-publish
revision number, even though the editable content hasn't changed underneath it. This is a deliberate,
documented exception to "`revision` is the single source of concurrency truth" — not an oversight to
"fix" later by making it consistent.

**Does bump `updatedAt`.** `list()`'s default sort is by `updatedAt` (§6), and publication status is
exactly the kind of change that should surface a page near the top of that list again — the user just
did something to it, even though the editable content is unchanged.

**Resolves one `§10` question, not all of them.** §10 ("Explicitly deferred: the editor-state
contract") left open whether publishing forks a page's identity. For the specific case this section
covers — a PageStore `local-page` being published — the answer is now: **no fork.** Publishing
updates the existing PageStore record via `recordPublication()`; `currentLoadedPage.kind` stays
`'local-page'`; no parallel `page:` KVStore ("My Pages") record is created for it, unlike the fork
that already happens today for every other first-time CListBin publish. §10's other open questions
(switching editors mid-session, starting a new page, importing a page, saving a remote My Pages
document *into* local storage) are **not** resolved by this section and remain deferred.

**Two call sites this implied, now wired (confirmed 2026-10-28):**

1. `_performWebPagePublish()`'s non-overwrite branch (`publish.js`): when `currentLoadedPage?.kind
   === 'local-page'`, it now calls `pageStore.recordPublication(currentLoadedPage.id, { service:
   'CListBin', accountId: binAccount.instance || null, url: result.url })` instead of
   `_saveWebPageRecord`/`setLoadedPage`, and returns early — matching this section's design exactly.
   The overwrite branch (`isOverwrite === true`) is unchanged, as specified.
2. `postAll()`'s per-account social-publish loop (`publish.js`): after a successful publish that
   returns a URL, if `currentLoadedPage?.kind === 'local-page'`, it calls
   `pageStore.recordPublication(currentLoadedPage.id, { service: accountData.type, accountId:
   accountData.id || null, url })` — also matching this section exactly.

## 7. Migration and backups

Before touching stored data, create and verify backups of the existing local IndexedDB KV database and, where authorized, the remote user's raw KV records. Do not include plaintext credentials or private keys in application logs. Do not automatically upload any PageStore material to remote KVStore.

Migration requirements:

1. Keep existing database name `clist_local_kvstore` and stores `users`, `kv`, and `sessions` readable; prefer an adapter that reads them in place over an unnecessary copy or schema migration.
2. Preserve **all** KV keys and opaque values, including unfamiliar namespaces, across refactors. Test credentials, RSS collections, DID key access, and following records after migration.
3. Keep source/destination encryption context in mind: copying ciphertext between users or installations does **not** guarantee that another password-derived key can decrypt it. Separate any cross-account migration from this storage refactor, and build it against two explicitly scoped adapter instances (§3's migration exception) rather than through `CList.storage.kv`.
4. Export/import the **page library** as a versioned, validated JSON bundle with a manifest/version and timestamp. Define visible conflict handling (skip, replace with confirmation, or import as a new page ID) and test round trips.
   **Validate before writing anything, in two tiers:** Tier 1 is bundle-level structural validation —
   run over the *entire* bundle before any IndexedDB write begins: `manifest.kind` is
   `'pageStoreBundle'` and `manifest.version` is a supported value; every record has its required
   fields (`id`, `content`, `contentType`, `editorType`); no two records in the bundle share an
   `id`. Any Tier 1 failure rejects the **whole** import with `PageStoreError('InvalidData')` and
   writes nothing — a structurally broken bundle must not produce a partial database. Tier 2 is
   per-record conflict resolution against the *existing* database (skip/replace/duplicate, per the
   policy in §6), applied only once Tier 1 has passed for the bundle as a whole; a Tier 2 skip is
   reported in `ImportResult`, not treated as an error.
5. Give users a straightforward backup/restore path, because browser data can be cleared, evicted, or lost with the profile. Optionally request persistent storage where supported; never promise that browsers must grant it.

## 8. Implementation sequence for Claude

1. **Inventory first:** locate all uses of the four KV endpoints, `fetch` interception, account records, key prefixes, and each editor's save/reopen hooks. Record their expected error behavior. Include key prefixes such as `_did_identity_key`, `social:following:`, `collection:`, `membership:`, `account:`, and `clist:`.

   **Update, 2026-10-28:** the two-denylist drift described below was already fixed independently
   of this plan, in commit `fd1b426` — `getSite()` (`kvstore.js:1818`) now just calls `getAccounts()`
   (`kvstore.js:1824`) instead of re-filtering `/get_kvs/` results with its own separate list. One
   denylist remained, in `getAccounts()`. **Second update, 2026-10-28:** that remaining denylist has
   now itself been flipped to the allowlist-by-schema check described below — `getAccounts()` now
   excludes a decrypted record unless `window.CList.schemas[accountData.type]` exists, instead of
   excluding by hand-maintained key prefix. Verified safe against every previously-excluded prefix
   (`collection:*`, `clist:pages-catalog`, `social:following:*`, `_did_identity_key`) by checking each
   decrypts without error under the same `encryptWithKey`/`decryptWithKey` scheme and has no `type`
   field that could spuriously match a schema.

   Original finding, kept for context: key-prefix classification was inconsistent in two places, which was itself the argument for doing this inventory before touching filters:
   - `kvstore.js:1840` excludes `_*`, `social:following:*`, `collection:*`
   - `kvstore.js:3542` excludes `_*`, `collection:*`, `clist:*` — but not `social:following:*`

   Both are denylists: "exclude everything I currently know isn't an account," with everything else falling through and being shown as an account by default. This is why unrelated records (e.g. page-save test data added later under a `page:` prefix no one had added to either list) silently appeared in Manage Accounts — any future new key prefix will do the same unless someone remembers to update the list by hand. That's worth fixing properly as part of the storage refactor rather than patching the list again: flip it from a denylist to an allowlist — only show rows whose decrypted `type` matches a registered account schema in `window.CList.schemas` — which is exactly the facade/registry model this plan is already proposing (§4). Then a new data kind is invisible to the account list by construction, not by someone remembering to update a filter.
2. **Establish a baseline:** back up data, capture a few anonymized record shapes, and create focused tests against current remote and local behavior. Do not print real secrets in test results.
3. **Introduce `js/storage.js`:** define the facade and configuration selection; add `js/kvstore-remote.js` and `js/kvstore-local.js` using existing data and auth sessions. Expose normalized errors without changing ciphertext. **Done, 2026-10-28** — see `docs/storage-model.md`'s Implementation status table and "KVStore facade — target interface" for the shipped API (`put()` added as a first-class upsert, not deferred). `kvstore-local.js` calls `local-kvstore.js`'s IndexedDB helpers directly via a small additive export (`window.CList._localKvStore`), not through `fetch` — the global override itself is untouched and step 5 below is unaffected.
4. **Migrate KV callers:** change `js/kvstore.js` and other modules to use `CList.storage.kv`. Preserve public login/registration methods, encryption, UI behavior, and remote non-KV requests. **Done, 2026-10-28** — all ~19 `js/kvstore.js` call sites (single-key `put`/`add`/`remove`/`update` plus the three `list()`-then-filter sites: `loadFollowing()`, the DID panel's `loadAccounts()`, `updateDid()`) now go through `window.CList.storage.kv.*`. `updateDid()`'s per-checkbox `update()` call is wrapped in its own try/catch that swallows a failure (`console.warn`) rather than aborting the loop or the later `/auth/did` PUT, preserving the original fire-and-forget-per-item behavior; same treatment for `removeDid()`'s key-delete call, which must never block DID-document removal. Verified via `node --check` and a grep audit: the only remaining raw `get_kvs`/`add_kv`/`update_kv`/`delete_kv` fetches are inside the explicitly-excluded cross-server migration block (step 3's/§3's scoped-adapter exception), keyed on `serverUrl`, not `flaskSiteUrl`. The other 8 modules named in `docs/storage-model.md`'s "Caller migration (9 files)" row (`collections.js`, `publish.js`, `tags.js`, `annotate.js`, `dynamicp2p.js`, `wordpress.js`, `mastodon.js`, `dropbox.js`) have now been checked (grepped each for the four raw endpoint names): zero hits in all 8. **Caller migration (step 4) is confirmed fully done project-wide**, not just for `kvstore.js`. A repo-wide grep confirms the only files still naming `get_kvs`/`add_kv`/`update_kv`/`delete_kv` are `kvstore-remote.js`, `kvstore-local.js`, and `kvstore.js`'s explicitly-excluded cross-server migration block.
5. **Remove interception safely:** `local-kvstore.js`'s global `window.fetch` override is not just KV plumbing — it is also the *only* thing currently answering local registration and login requests (they're HTTP calls to the `http://local.clist` sentinel, intercepted the same way KV calls are). Before removing the override, `kvstore-local.js` (or an equivalent explicit module) must already implement local register/login directly against IndexedDB — not routed through `fetch` at all — and that replacement must be in place and tested *first*. Only once (a) every KV call site is migrated (step 4) and (b) local register/login has a working non-`fetch` implementation, remove the global `window.fetch` wrapper. Skipping (b) means local auth silently starts issuing a real network request to `http://local.clist`, which fails. Retain `CList.isLocalMode()` or migrate its callers to a compatible capability check so local-only feature restrictions remain correct. **Status, 2026-10-28:** (a) is done — all 9 caller files (`kvstore.js` plus the other 8) confirmed migrated, see step 4. **(b) is now done too, 2026-10-28** — `kvstore.js`'s `KVregisterWithCredentials`/`KVloginWithCredentials` call `window.CList._localKvStore.registerUser`/`loginUser` directly when `isLocalMode()` is true, bypassing `fetch` entirely; verified via `node --check` on both files (no browser-level regression test performed — that's step 7, still deferred). The global `window.fetch` override itself has **not** been removed — the plan's own text above requires it be "in place and tested *first*," and step 7's regression testing hasn't happened, so the override is left in place as a no-longer-load-bearing safety net pending that testing, rather than removed on the strength of a syntax check alone.
6. **Add PageStore:** implement `js/page-store.js` and `js/page-store-idb.js`; wire editor integration through the `window.CList.savers`/`window.CList.loaders` registries as described in §6, not per-editor hooks, then add page listing and export/import using existing button/error conventions. As a later, separately approved step, add `recordPublication()` (§6a) and wire its two `publish.js` call sites. **Mostly done, found already implemented 2026-10-28** (not part of this plan revision's own work — discovered during a status cross-check, so treat as unreviewed by this doc until confirmed with the user): `js/page-store.js`/`js/page-store-idb.js` exist and are loaded in `index.html`; `save`/`get`/`list`/`remove` are wired into `window.CList.savers` ("Save to CList (local)") and `window.CList.loaders` ("CList (local)"), including `RevisionConflict` handling in the saver. `recordPublication()` (§6a) is implemented and wired into both named `publish.js` call sites exactly as specified. **Export/import UI added 2026-10-28** (see "Changes in 1.6" above): "Export all pages" and "Import pages..." buttons on the "CList (local)" loader call `exportPages()`/`importPages()` — the page-library backup/restore path (§6, §7 item 4) is now fully wired, closing out step 6.
7. **Regression test both modes:** verify browser reload, account switching, different tabs, offline KV reads in local mode, remote KV reads when online, failed network requests, missing session keys, and error responses. Treat local pages as available regardless of KV mode.
8. **Document actual changes:** provide a file-by-file change summary, compatibility notes, manual tests, and any issues intentionally deferred. Avoid unrelated refactoring. **Done, 2026-10-28** — see `docs/storage-migration-summary.md`.

## 9. Acceptance tests

The implementation is acceptable when all of the following are demonstrated:

- A local account can register, log in, create/list/update/delete a KV record, and recover it after page reload, without making a KVStore network request.
- A remote account performs the same KV operations against Flask using its current authentication, with successful reads of existing encrypted records.
- Both adapters reject a duplicate `add`, a missing-key `update`, and a missing-key `remove` in the same documented way; an explicit `put`, if provided, has its own tested behavior.
- Existing service accounts, RSS collections, DID private key, and following entries remain decryptable and usable; unknown namespaced records survive untouched.
- Remote-only DID resolution, public identity publication, discussions, and other federation-dependent features are not inadvertently routed to IndexedDB or enabled for local-only accounts.
- Every supported editor saves and reopens a page locally with correct content and stable ID. Local pages remain usable whether the selected KVStore backend is remote or local, and without a KV login.
- A saved page survives application reload; a second save updates the record; file export remains possible; a page-library backup can be imported and verified.
- Browser storage errors do not masquerade as success; the UI does not claim CList is entirely offline merely because its pages are stored in IndexedDB.
- No authentication tokens, decrypted credentials, encryption keys, private-key material, or unredacted account collections are logged to the console. In particular, remove the `getAccounts()` statement that prints the Bearer token.
- The migration does not erase or rewrite the existing IndexedDB KV database and requires no change to server-side data formats.
- An operation's backend, server URL, and auth context are fixed at the moment it starts: switching
  accounts, logging out, or flipping local/remote mode while a `storage.kv` call is still in flight
  does not redirect that call mid-flight to the newly active destination.
- A write resolves only after its IndexedDB transaction's `oncomplete` fires, never merely on the
  individual request's `onsuccess`; a forced transaction abort (e.g. simulated quota exceeded)
  surfaces as a rejected promise, never a false success. An `update()`/`remove()`'s existence check
  and its write happen inside one read-write transaction, not two.
- Two tabs (or two rapid saves from one tab) attempting to save the same PageStore page from a stale
  `revision` produce a detectable `RevisionConflict` rather than a silent lost update; a forced save
  (`revision` omitted) still succeeds.
- Local registration and login work correctly both before and after the global `fetch` interceptor
  is removed, exercised against the explicit non-`fetch` replacement, not merely against the
  interceptor's continued presence.
- After logout or switching accounts, local PageStore pages remain listed and openable, and no
  encryption key, session token, or other state scoped to the previous account is reused for the
  newly active one.
- A page-library bundle with a bad `manifest.version`, a duplicate `id`, or a record missing a
  required field is rejected in full, with nothing written to IndexedDB; a structurally valid bundle
  with per-record conflicts reports accurate skip/replace/duplicate counts, and any reference whose
  target was remapped within the same bundle is rewritten to the new id.
- `recordPublication()` against an existing page appends or upserts (by `service`+`accountId`) a
  `publications` entry with the caller-supplied `url` and a freshly read `revision`/`publishedAt`,
  bumps `updatedAt`, and leaves `revision` itself unchanged; called against a nonexistent `id` it
  resolves `null` and writes nothing. After publishing a `local-page` to CListBin, the page's
  `currentLoadedPage.kind` remains `'local-page'` and no `page:` KVStore record is created for it.

## 10. Boundaries and items requiring inspection

Do **not** change the remote Flask API without necessity; do **not** move DID documents or the discussion registry into generic KVStore; do **not** automatically synchronize pages to the server; do **not** replace CList's existing client-side PBKDF2/AES-GCM cryptography as part of the storage refactor; and do **not** treat a locally issued session as a remotely verifiable identity.

Claude should inspect the current editor-management code before selecting exact integration points. The provided `routes.py` is sufficient to define the existing server KV contract, but it is not sufficient to enumerate every KV record actually present in live databases. Any proposed new key conventions, per-user page namespaces, remote page synchronization, or page encryption should be presented as a separate decision rather than silently introduced.

Referential-membership resolution (a collection's member living in PageStore, or vice versa via a page's `references`) is resolved design, not an open boundary question — see `docs/collection-conceptual-model-v1.08.md` — but implementation of that resolution belongs in `collections.js`, never inside `js/storage.js` or `js/page-store.js`. Those two keep no knowledge of each other.

**Explicitly deferred: the editor-state contract for page identity.** This plan defines how a page
*record* behaves (§6's save/revision semantics) but deliberately does not define what happens to the
*in-progress editor state* across these transitions — that needs its own design pass, after this
plan, not as part of it:

- Opens a page and edits it.
- Switches editors (e.g. plain text → TinyMCE) mid-session.
- Starts a new page.
- Imports a page.
- Saves an existing remote document (My Pages, §2) locally (into PageStore).

Concretely open questions that pass includes, not resolved here: does switching editors carry over
unsaved content or discard it (and is that choice visible to the user before it happens); does it
carry over `currentLoadedPage`'s id/kind or reset it to "new, unsaved"; does importing a page load it
into the active editor automatically or just add it to the PageStore list; does saving a remote
My Pages document locally fork it into a new PageStore id (as `files.js`'s existing
`_touchOrForkWebPageRecord` does for the remote case) or treat it as the same logical page under two
different storage locations. Do not resolve these silently inside the PageStore/editors integration
work (§6, §8 step 6) by picking an arbitrary behavior — implement only what §6 already specifies
(save/get/list/remove/export/import on the record itself), leave the editor-state transitions above
functioning no worse than they do today, and flag this list again when that follow-up design pass is
scheduled.

**One sliver of this now resolved, as of v1.3 — see §6a.** The *publish-direction* fork question
(does publishing a local page to CListBin/Pastebin or a social account fork it into a separate My
Pages record) is answered: no, it keeps its local-page identity and gets a `recordPublication()`
annotation instead. Every other question in this list — including the *opposite* direction, loading
an existing remote My Pages document into local storage — is still open and still deferred.

## Source material consulted

- Supplied `local-kvstore.js` and `routes.py` in this conversation (authoritative for the supplied code, not proof of a deployed server version).
- CList public `js/kvstore.js`: https://raw.githubusercontent.com/Downes/CList/main/js/kvstore.js (reviewed 27 October 2026).
- CList public `js/local-kvstore.js`: https://raw.githubusercontent.com/Downes/CList/main/js/local-kvstore.js (reviewed 27 October 2026).
- CList repository: https://github.com/Downes/CList (reviewed 27 October 2026).

