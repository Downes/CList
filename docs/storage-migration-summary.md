# CList Storage Migration — Change Summary

**Status:** Historical record of what was actually done, as of 2026-10-28. This is `docs/storage-architecture-plan.md`
§8 step 8's deliverable — a snapshot, not a living doc like `storage-architecture-plan.md` and
`storage-model.md`, which continue tracking status as work continues. If those two docs and this
one ever disagree about what landed, trust them, not this file — it was written by cross-checking
against them and the actual code, not the reverse, but it will go stale as new work lands and
nothing re-verifies it automatically.

**Scope:** Everything done under the storage-architecture refactor (`docs/storage-architecture-plan.md`,
§8 steps 1, 3, 4, 5(b), and 6). Does not cover work outside that plan.

---

## New files

| File | Purpose |
|---|---|
| `js/storage.js` | The KVStore facade: `window.CList.storage.kv.{list,get,add,update,remove,put}`, `window.CList.storage.mode`. Backend-agnostic — callers never know or care whether they're talking to Flask or IndexedDB. |
| `js/kvstore-remote.js` | Facade adapter: HTTP calls to Flask's `/get_kvs/`, `/add_kv/`, `/update_kv/`, `/delete_kv/`, given an explicit `{baseUrl, token}` context. |
| `js/kvstore-local.js` | Facade adapter: talks to IndexedDB directly via `window.CList._localKvStore` (exported by `local-kvstore.js`), not through `fetch`. |
| `js/page-store.js` | PageStore's public API (`save`/`get`/`list`/`remove`/`exportPages`/`importPages`/`recordPublication`) plus its `savers`/`loaders` registry entries and the "CList (local)" loader's export/import UI. Always-local, independent of KVStore identity. |
| `js/page-store-idb.js` | PageStore's IndexedDB implementation (`clist_pages` database), including the revision-based optimistic-concurrency check and the shared `_pageStoreReadThenWrite()` primitive `recordPublication()` relies on. |
| `docs/storage-migration-summary.md` | This document. |

## Modified files

### `js/local-kvstore.js`

- Added an additive export, `window.CList._localKvStore`, exposing the file's internal IndexedDB
  helpers (`idbGet`, `idbPut`, `idbDelete`, `idbGetAllByIndex`, `usernameForToken`) so
  `kvstore-local.js` could call IndexedDB directly instead of round-tripping through the
  `window.fetch` sentinel interception. No behavior change to the existing `fetch`-interception
  path at the time this was added.
- **Step 5(b), 2026-10-28:** pulled the `/auth/register` and `/auth/login` logic in
  `handleLocalRequest` out into two standalone functions, `registerUser(username, authHash)` and
  `loginUser(username, authHash)`, which throw a new `LocalAuthError(status, message)` on failure
  instead of building a `Response` directly. `handleLocalRequest`'s two branches now call them and
  wrap the result/error back into a `Response`, so the `fetch`-interception path's observable
  behavior (status codes, JSON bodies) is unchanged. Both functions are also exposed on
  `window.CList._localKvStore` alongside the existing helpers.

### `js/kvstore.js`

- **Caller migration (step 4):** all ~19 direct KV call sites (single-key `put`/`add`/`remove`/`update`)
  now go through `window.CList.storage.kv.*` instead of calling `fetch` on the four raw endpoints
  directly. Three `list()`-then-filter call sites (`loadFollowing()`, the DID panel's
  `loadAccounts()`, `updateDid()`) were migrated the same way, fetching the list once and filtering
  in memory rather than looping calls.
- `updateDid()`'s and `removeDid()`'s per-item `storage.kv` calls are each wrapped in their own
  try/catch that swallows a failure with `console.warn` rather than aborting the loop or the
  subsequent `/auth/did` request — preserving the pre-migration fire-and-forget-per-item behavior.
- `getSite()` now calls `getAccounts()` instead of re-filtering `/get_kvs/` results with its own
  separate denylist (this fix, commit `fd1b426`, predates and was independent of this refactor —
  noted here only because the inventory step found it).
- `getAccounts()`'s remaining denylist (exclude by hand-maintained key prefix) was flipped to an
  allowlist-by-schema: a decrypted record is now shown only if
  `window.CList.schemas[accountData.type]` exists, so a new, unanticipated key prefix is invisible
  to the account list by construction instead of leaking through until someone remembers to add it
  to a denylist.
- The `console.log` that printed the raw Bearer access token was removed.
- **Step 5(b), 2026-10-28:** `KVregisterWithCredentials`/`KVloginWithCredentials` now check
  `window.CList.isLocalMode()`; when true, they call `window.CList._localKvStore.registerUser`/
  `loginUser` directly instead of `fetch`-ing `${flaskSiteUrl}/auth/register`/`/auth/login`. PBKDF2
  key/hash derivation, cookie storage (`ACCESS_TOKEN`/`USERNAME`/`TOKEN_EXPIRES`), and the `encKey`
  `sessionStorage` write are unchanged in either branch — only the transport for the
  register/login round trip itself differs. Remote-mode behavior is byte-for-byte unchanged.

### `js/publish.js`

- `_performWebPagePublish()`'s non-overwrite branch and `postAll()`'s per-account social-publish
  loop both call `pageStore.recordPublication(id, { service, accountId, url })` for a page whose
  `currentLoadedPage.kind === 'local-page'`, instead of forking a new `page:` KVStore ("My Pages")
  record the way every other first-time publish does. This was found already implemented during a
  plan-vs-code cross-check, not written as part of this pass.

### Confirmed unchanged (checked, not modified)

The other 8 modules that call KV storage (`collections.js`, `tags.js`, `annotate.js`,
`dynamicp2p.js`, `wordpress.js`, `mastodon.js`, `dropbox.js`, plus `publish.js` above for its
non-recordPublication KV calls) were grepped for the four raw endpoint names
(`get_kvs`/`add_kv`/`update_kv`/`delete_kv`) and found to already call only
`window.CList.storage.kv.*` — no changes were needed in any of them.

---

## Compatibility notes

- **No wire-format or storage-format changes.** Existing encrypted KV records, the
  `clist_local_kvstore` IndexedDB schema (`users`/`kv`/`sessions` stores), and the Flask API
  contract are all untouched. This was a caller/plumbing refactor, not a data migration.
- **The global `window.fetch` override in `local-kvstore.js` still exists and still works.**
  Nothing was removed from it. In normal operation nothing calls through it anymore (every KV
  caller uses the facade; register/login call `_localKvStore` directly) — but anything that still
  reached the `http://local.clist` sentinel via raw `fetch` would still be answered correctly.
- **Local-mode security property preserved.** `local-kvstore.js` still never sees a plaintext
  password or the derived `encKey` — only `auth_hash` (itself re-hashed with SHA-256 before
  storage, mirroring the real server's `bcrypt(auth_hash)`). This held before step 5(b) and holds
  after it; step 5(b) changed the transport, not what crosses the boundary.
- **Remote-mode behavior is unchanged.** Every `isLocalMode()`-gated branch added during this
  refactor (in `KVregisterWithCredentials`/`KVloginWithCredentials`) only takes effect for local
  accounts; a remote account's code path is identical to before this refactor, including still
  going through `fetch`.
- **`storage.mode` is derived, never an independent flag** — it reads `isLocalMode()`, the same
  check that already governs the cookie/localStorage split for auth-token storage, so the two can't
  drift apart the way `getSite()`'s and `getAccounts()`'s separate denylists once did.

## Issues intentionally deferred

- **§8 step 2 (baseline backups/focused tests before touching code):** never performed. The user
  explicitly deferred broader testing until more of the refactor landed.
- **§8 step 7 (regression testing both modes in a browser):** not performed, for the same reason.
  This is also why the global `fetch` override in `local-kvstore.js` has not been removed even
  though both of its prerequisites (step 4's caller migration, step 5(b)'s register/login
  re-plumbing) are now done — the plan's own acceptance criteria require the non-`fetch`
  replacement be "tested first," and no browser-level test of local register/login, local KV ops,
  or account switching has been run against this code.
- **§10's editor-state contract** (what happens to in-progress editor state across switching
  editors, starting a new page, importing a page, or loading a remote My Pages document into
  local storage): explicitly out of scope for this plan, needs its own design pass. Only the
  narrower publish-direction question (§6a) was resolved.
- **Cross-server account migration** (copying a local account's KV records to a remote server, or
  between two remote servers): explicitly out of scope (§3's migration exception) and not touched.
- **`collection:*`/`membership:*` storage split:** designed (`collection-conceptual-model-v1.08.md`
  v1.09) but not coded — no `membership:` key construction exists in `collections.js` yet.
- **Native desktop packaging and whether it reproduces the `file://` CORS gap:** not designed here.

## Suggested manual tests (not yet run)

These map to `storage-architecture-plan.md` §9's acceptance criteria and would need a browser, not
just `node --check`:

1. Register and log in a **local** account from scratch; confirm no network request fires to
   `http://local.clist` or any real server (watch the network tab) during either call.
2. Log in an existing local account created *before* this change (if one exists in a test
   profile) — confirms `authHashDigest` verification still matches after the register/login code
   path moved.
3. Create/list/update/delete a KV record in local mode after logging in via the new path; confirm
   it survives a page reload.
4. Repeat login/registration against a **remote** account; confirm behavior and network requests
   are unchanged from before this refactor.
5. Trigger a local login with a wrong password and a duplicate-username registration; confirm the
   error messages shown to the user match what the old `fetch`-based path produced (`Invalid
   credentials` / `Username already taken`).
6. Only once 1–5 pass: consider removing the global `fetch` override in `local-kvstore.js` as a
   separate, explicitly-confirmed follow-up — not bundled into this change.
