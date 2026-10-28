# CList Storage Architecture — Detailed Implementation Instructions for Claude

**Version:** 1.1 (revised proposal)  
**Date:** 27 October 2026  
**Status:** Design guidance and implementation brief; not a claim that the refactor has been implemented

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

The current `local-kvstore.js` overrides `window.fetch` globally to intercept a sentinel origin. **Replace that mechanism only after all CList KV call sites have been migrated** to the facade and regression-tested. Network requests for other services, such as social platforms or the real discussions service, should continue through ordinary `fetch`.

### Account lifecycle this refactor must support

The local/remote choice above exists to serve a concrete progression, not a standing either/or:

1. **No account.** A visitor reads feeds with nothing persisted — today's existing anonymous behavior.
2. **"I want to keep this."** Prompted to create an account, defaulting to local (IndexedDB) storage — no server involved. A local account should not be arbitrarily cut off from remote-dependent features (e.g. Collab) that don't actually require a verified remote identity; which features genuinely need one is open, not resolved by this refactor (see below).
   - **Branch:** the same local-first path extends to running CList from `file://` or as a packaged desktop app (Windows/Mac/Linux). `file://` inherits the known, accepted CORS gap (case 6 of the six-configuration matrix). A packaged app may or may not inherit it depending on how it's built (e.g. an app serving its own files over a local HTTP origin behaves like "localhost," not raw `file://`) — not designed here.
3. **"I want this on another browser/device."** The user migrates their account from local to a remote KVStore server. This is the scenario the local/remote adapters exist to make possible, but the migration mechanism itself — walking every local KV record and writing it to a chosen remote server — is not designed or built by this refactor. It corresponds to kvstore's own "Credential migration between kvstore instances" TODO item.

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

This is a proposed public contract, not a drop-in implementation. Keep the values opaque and preserve their existing serialized form. Specify stable error categories (for example, `NotAuthenticated`, `NotFound`, `AlreadyExists`, `StorageUnavailable`) so that interface code is not coupled to HTTP status codes or IndexedDB exceptions.

The facade itself stays UI-agnostic and must not call UI helpers directly. Every caller that consumes a normalized error from `CList.storage.kv` surfaces it the same way the rest of the app already does, per `docs/error-handling.md` and `docs/adding-a-service.md` §7: `showStatusMessage()` for transient feedback, `showErrorModal()` for validation that blocks a save, `showServiceError()` for hard failures, always with `console.error()` alongside. Do not invent a new error-display mechanism for this refactor.

**Server constraint:** `/get_kvs/` returns a complete array, not an endpoint for fetching one key. Implement `get(key)` over `list()` for the remote adapter initially, or add a separate server endpoint only if separately justified and tested. Do not silently assume `/get_kv/<key>` exists.

If a convenience **upsert** operation is desired, name it `put(key, value)` and document it explicitly as add-or-update. Do **not** conflate it with `update` or change existing caller behavior without review.

Keep authentication/token access internal to the relevant auth or remote-adapter path. Preserve callers that currently obtain a session key for client-side cryptography. `js/kvstore.js` should ultimately deal with account records and UI, not construct endpoint URLs for standard KV operations.

## 5. Semantics that must be reconciled

The provided Flask implementation and `local-kvstore.js` do not currently behave identically:

- **Add:** the Flask route rejects absent or empty `key` *or* `value`, and returns 409 if the key exists. The local route checks only the key; an IndexedDB `put()` inside a check-then-write can still race with another tab.
- **Update:** the Flask route returns 404 for a missing key; the local route silently inserts it (an upsert).
- **Delete:** the Flask route returns 404 if absent; the local route reports success even if absent.
- **Authentication:** the Flask service accepts JWTs and older opaque tokens. The local service uses a token recorded in its own IndexedDB `sessions` store, and hashes the provided `auth_hash` with SHA-256 for local verification; this is not the same storage procedure as server-side bcrypt.
- **Session duration:** the local implementation currently issues a one-year token. Preserve behavior during this refactor, but flag the duration for a separate security review rather than silently changing it.

Recommend matching the **documented Flask add/update/delete semantics** within the new public KVStore interface, while providing any intentional `put` operation separately. In IndexedDB, use transactions and `add()` rather than a separate existence check followed by `put()` when enforcing create-only behavior. Verify that every client call site handles 404/409 consistently. Normalize errors in the adapters without modifying values or record keys.

Fix robustness issues during the migration only where demonstrably needed: rejected database-open promises, blocked upgrades, multi-tab changes, and partial failures should be surfaced without falsely reporting successful saves.

Collections are the one KV data kind where the record-size assumption behind this section matters: pre-1.09, a single `collection:*` record could grow to tens of KB as entries accumulated, forcing a decrypt-modify-reencrypt-rewrite of the whole thing on every single membership change, and exposing concurrent edits to lost-update races on that one row. The `collection:*`/`membership:*` split (`docs/collection-conceptual-model-v1.08.md` §"Storage split") resolves this by keeping every KV record small and independently writable — `js/storage.js`'s `add`/`update`/`remove` are already the right shape for this; no new facade operation is needed.

## 6. Local page persistence: `js/page-store.js`

This is the immediate user-facing motivation for the work. Saving an editor page into IndexedDB replaces the need for Firefox to write directly to arbitrary filesystem paths. **It does not remove or prevent a separate export-to-file feature.**

PageStore being always-local is also a deliberate fit for the account-lifecycle branch where CList runs from `file://` or a packaged app (§3): it has no CORS exposure at all, unlike the remote KVStore adapter's known gap in that case. That's a reason to keep this design, not merely a side effect of it.

The local page API should be independent of KVStore identity:

```javascript
window.CList.pageStore.save(page);          // creates or updates a page
window.CList.pageStore.get(id);             // page or null
window.CList.pageStore.list(options);       // page summaries
window.CList.pageStore.remove(id);          // delete a page
window.CList.pageStore.exportPages();       // downloadable backup data
window.CList.pageStore.importPages(data);   // validated, conflict-aware import
```

Use a separate IndexedDB database, provisionally `clist_pages`, with a versioned `pages` object store keyed by `id`. A first version can store:

- `id`: stable page identifier; reuse an established authoritative identifier when applicable, otherwise generate a UUID v4 for a new locally created page.
- `title`: display title.
- `content`: the current editor's serialized text or HTML, without unwanted conversion.
- `contentType`: such as `text/plain` or `text/html`.
- `editorType`: e.g., textarea, TinyMCE, or Etherpad (actual names should follow the code).
- `createdAt` and `updatedAt`: ISO 8601 timestamps.
- `sourceUri` and `sourceId` where available: references to original material, without replacing the local stable ID.
- `references`: the page's cited/pulled-in sources, stored as an embedded collection — an array of `{ membership, member }` pairs matching the shape in `docs/collection-conceptual-model-v1.08.md`, with each membership's `role` set to `"cites"`. Lives inside this page record, not as a separate `collection:*`/`membership:*` KVStore entity — its lifecycle is the page's lifecycle. Do not add KVStore round-trips for this; it's local, and typically small.

Keep fields extensible, and add an `updatedAt` index for listing. Do **not** impose a new CList content format: the editor's original representation is authoritative. Existing editor contents may refer to externally hosted images or resources; IndexedDB will not automatically copy those dependencies offline. Binary asset support can be added later if a real use case requires it.

Integrate through the existing `window.CList.savers` / `window.CList.loaders` registries (see `docs/adding-a-service.md` §4–5), **not** by modifying each editor file directly. Push one entry onto each — e.g. `{ label: 'Save to CList (local)', icon: 'save', save: async () => { ... } }` and a matching `loaders` entry — that reads the active editor via `editorHandlers[currentEditor].getContent()` (the same way existing remote-save entries do) and then calls `pageStore.save()`; the `loaders` entry calls `pageStore.get()`/`list()` and returns `{ type, value }` for the editor's `loadContent()` to consume. This reaches every editor uniformly through the Save/Load panels already wired for that purpose, instead of adding a bespoke hook per editor. A second save of the *same* local page must update the existing record and its timestamp, not create an unnecessary duplicate. When reopening a page, retain the page ID in the editor state so a subsequent save updates rather than duplicates. Inspect `editorHandlers` and each editor's `getContent()`/`loadContent()` before writing this integration; do not assume every editor exposes its contents through a textarea.

Recommended labels: **Save to CList (local)** for the `savers` entry and **Export to file** for a standard browser download. Preserve the user's ability to export individual pages as well as a separate whole-library backup. Show a successful save only after its IndexedDB transaction completes; surface quota and permission failures via `showStatusMessage()` (transient) or `showErrorModal()` (blocking) per `docs/error-handling.md` — never `alert()`/`confirm()`/`prompt()` — and keep `console.error()` alongside. Any new page-listing/export/import UI must use the existing button classes (`clist-action-btn`, `btn`, `btn-small`, `btn-secondary` — see `CLAUDE.md`'s Icon/Text Button Pattern and `docs/adding-a-service.md` §8) with no new service-specific CSS classes and no inline style attributes.

An IndexedDB page is restricted to the browser profile and origin that wrote it. Firefox and Chrome do not share that database; even the same browser treats different site origins separately. Backups therefore matter. IndexedDB provides local data persistence but does not by itself make the CList application shell available offline: a service worker and cached application assets would be separate work.

**Privacy decision to leave explicit:** PageStore contents are readable by scripts running under the CList origin unless page encryption is designed. Do not assert that pages are encrypted merely because KVStore records are. Preserve current KVStore encryption and treat optional page encryption as a separate, documented design decision.

## 7. Migration and backups

Before touching stored data, create and verify backups of the existing local IndexedDB KV database and, where authorized, the remote user's raw KV records. Do not include plaintext credentials or private keys in application logs. Do not automatically upload any PageStore material to remote KVStore.

Migration requirements:

1. Keep existing database name `clist_local_kvstore` and stores `users`, `kv`, and `sessions` readable; prefer an adapter that reads them in place over an unnecessary copy or schema migration.
2. Preserve **all** KV keys and opaque values, including unfamiliar namespaces, across refactors. Test credentials, RSS collections, DID key access, and following records after migration.
3. Keep source/destination encryption context in mind: copying ciphertext between users or installations does **not** guarantee that another password-derived key can decrypt it. Separate any cross-account migration from this storage refactor.
4. Export/import the **page library** as a versioned, validated JSON bundle with a manifest/version and timestamp. Define visible conflict handling (skip, replace with confirmation, or import as a new page ID) and test round trips.
5. Give users a straightforward backup/restore path, because browser data can be cleared, evicted, or lost with the profile. Optionally request persistent storage where supported; never promise that browsers must grant it.

## 8. Implementation sequence for Claude

1. **Inventory first:** locate all uses of the four KV endpoints, `fetch` interception, account records, key prefixes, and each editor's save/reopen hooks. Record their expected error behavior. Include key prefixes such as `_did_identity_key`, `social:following:`, `collection:`, `membership:`, `account:`, and `clist:`.

   Key-prefix classification is already inconsistent in two places, which is itself the argument for doing this inventory before touching filters:
   - `kvstore.js:1840` excludes `_*`, `social:following:*`, `collection:*`
   - `kvstore.js:3542` excludes `_*`, `collection:*`, `clist:*` — but not `social:following:*`

   Reconcile these, don't just pass both through the new facade unchanged.

   Both are denylists: "exclude everything I currently know isn't an account," with everything else falling through and being shown as an account by default. This is why unrelated records (e.g. page-save test data added later under a `page:` prefix no one had added to either list) silently appeared in Manage Accounts — any future new key prefix will do the same unless someone remembers to update the list by hand. That's worth fixing properly as part of the storage refactor rather than patching the list again: flip it from a denylist to an allowlist — only show rows whose decrypted `type` matches a registered account schema in `window.CList.schemas` — which is exactly the facade/registry model this plan is already proposing (§4). Then a new data kind is invisible to the account list by construction, not by someone remembering to update a filter.
2. **Establish a baseline:** back up data, capture a few anonymized record shapes, and create focused tests against current remote and local behavior. Do not print real secrets in test results.
3. **Introduce `js/storage.js`:** define the facade and configuration selection; add `js/kvstore-remote.js` and `js/kvstore-local.js` using existing data and auth sessions. Expose normalized errors without changing ciphertext.
4. **Migrate KV callers:** change `js/kvstore.js` and other modules to use `CList.storage.kv`. Preserve public login/registration methods, encryption, UI behavior, and remote non-KV requests.
5. **Remove interception safely:** only after verifying every relevant caller, remove the global `window.fetch` wrapper. Retain `CList.isLocalMode()` or migrate its callers to a compatible capability check so local-only feature restrictions remain correct.
6. **Add PageStore:** implement `js/page-store.js` and `js/page-store-idb.js`; wire editor integration through the `window.CList.savers`/`window.CList.loaders` registries as described in §6, not per-editor hooks, then add page listing and export/import using existing button/error conventions.
7. **Regression test both modes:** verify browser reload, account switching, different tabs, offline KV reads in local mode, remote KV reads when online, failed network requests, missing session keys, and error responses. Treat local pages as available regardless of KV mode.
8. **Document actual changes:** provide a file-by-file change summary, compatibility notes, manual tests, and any issues intentionally deferred. Avoid unrelated refactoring.

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

## 10. Boundaries and items requiring inspection

Do **not** change the remote Flask API without necessity; do **not** move DID documents or the discussion registry into generic KVStore; do **not** automatically synchronize pages to the server; do **not** replace CList's existing client-side PBKDF2/AES-GCM cryptography as part of the storage refactor; and do **not** treat a locally issued session as a remotely verifiable identity.

Claude should inspect the current editor-management code before selecting exact integration points. The provided `routes.py` is sufficient to define the existing server KV contract, but it is not sufficient to enumerate every KV record actually present in live databases. Any proposed new key conventions, per-user page namespaces, remote page synchronization, or page encryption should be presented as a separate decision rather than silently introduced.

Referential-membership resolution (a collection's member living in PageStore, or vice versa via a page's `references`) is resolved design, not an open boundary question — see `docs/collection-conceptual-model-v1.08.md` — but implementation of that resolution belongs in `collections.js`, never inside `js/storage.js` or `js/page-store.js`. Those two keep no knowledge of each other.

## Source material consulted

- Supplied `local-kvstore.js` and `routes.py` in this conversation (authoritative for the supplied code, not proof of a deployed server version).
- CList public `js/kvstore.js`: https://raw.githubusercontent.com/Downes/CList/main/js/kvstore.js (reviewed 27 October 2026).
- CList public `js/local-kvstore.js`: https://raw.githubusercontent.com/Downes/CList/main/js/local-kvstore.js (reviewed 27 October 2026).
- CList repository: https://github.com/Downes/CList (reviewed 27 October 2026).

