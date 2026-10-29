 CList Storage Model — Reference

**Status:** Living reference — implementation status tracked below, update as pieces land
**Scope:** How CList persists key–value account/service data and editor pages. Describes the
*target* architecture and what currently exists; see `storage-architecture-plan.md` for the
original design brief and rationale this doc summarizes for day-to-day reference.

This doc exists so future work touching storage doesn't have to re-derive the architecture from
`storage-architecture-plan.md` (a design brief, not meant to be re-read start to end each time) or
from scattered call sites. Keep it in sync as each phase below actually lands.

---

## Big picture

Four distinct concerns, kept separate:

1. **Authentication/session** — login, registration, session/encryption-key lifecycle. Unchanged
   by this work. Lives in `js/kvstore.js` / `js/local-kvstore.js` / `js/crypto_utils.js`.
2. **KVStore facade** (`js/storage.js`, done) — the one stable API for arbitrary per-user KV
   records (service accounts, collections, DID key, following, etc.), backend-agnostic. All 9
   caller files, `kvstore.js` plus the other 8, are confirmed fully migrated onto it (see
   Implementation status).
3. **KVStore adapters** (`js/kvstore-remote.js`, `js/kvstore-local.js`, done) — do the actual
   HTTP or IndexedDB work for the facade. Receive already-encrypted values; never touch crypto.
4. **PageStore** (`js/page-store.js` + `js/page-store-idb.js`, done) — local-only storage for
   editor page content, independent of KVStore identity/backend, including the export/import UI.
   Replaces the need for direct filesystem writes (the original motivation for this whole effort).

```
              ┌─────────────────────┐
  callers →   │   js/storage.js     │  window.CList.storage.kv.{list,get,add,update,remove,put}
 (all 9 files │  (facade, done)     │  window.CList.storage.mode  →  'local' | 'remote'
  confirmed   │                     │
  migrated)   └──────────┬──────────┘
                        │
            ┌───────────┴───────────┐
            │                       │
  ┌─────────▼─────────┐   ┌─────────▼──────────┐
  │ kvstore-remote.js  │   │  kvstore-local.js   │
  │ → Flask API        │   │  → IndexedDB        │
  │   /get_kvs/ etc.   │   │   clist_local_kvstore│
  └────────────────────┘   └─────────────────────┘

  ┌──────────────────────────────────────────────┐
  │  js/page-store.js  (always local, no backend  │
  │  choice — independent of the facade above)    │
  │  → js/page-store-idb.js → IndexedDB clist_pages│
  └──────────────────────────────────────────────┘
```

PageStore and the KVStore facade/adapters are **mutually unaware of each other** by design (see
`collection-conceptual-model-v1.08.md`'s "Referential membership resolution" — any code that needs
to dereference across the two lives in `collections.js`, never inside `storage.js` or
`page-store.js` themselves).

---

## Cross-cutting rules

These apply to the facade, both KV adapters, and PageStore alike — see `storage-architecture-plan.md`
v1.2 §3–§6 for the full rationale.

- **Operation-level backend/auth snapshot.** Every facade call resolves `mode`, base URL, and auth
  token *once*, at the start, and threads that snapshot through to completion. It never re-reads
  `isLocalMode()` or the active session mid-operation — a slow remote `list()` must not finish
  against a different account/backend than the one active when it started.
- **IndexedDB transaction discipline.** Writes resolve on `transaction.oncomplete`, never on an
  individual request's `onsuccess`; they reject on `transaction.onerror`/`onabort`. `db.onversionchange`
  is handled explicitly (close + prompt reload). An existence check plus its conditional write
  (`update`/`remove`, PageStore's revision check) happen inside **one** read-write transaction, not
  a read transaction followed by a separate write transaction.
- **Error shape:** `{ code, operation, cause }` everywhere. KV categories: `NotAuthenticated` (no
  identity) vs. `NotAuthorized` (valid identity, no access) — different user-facing responses, never
  conflated; `StorageUnavailable` (confirmed not applied) vs. `Indeterminate` (network failure after
  the request was sent — outcome unknown); `NotFound`, `AlreadyExists`, `InvalidData` (absent/empty
  `key` or `value`, matching Flask's 400 — checked once in `storage.js` so both adapters share it).
  PageStore has its own, narrower set (`InvalidData`, `StorageUnavailable`, `RevisionConflict`)
  since there's no server to mirror 404/409 against.
- **No automatic retry of a write** unless its outcome is known safe to retry (e.g. a
  `StorageUnavailable` that fired before the request left the browser). An `Indeterminate` result is
  surfaced to the caller as-is, never silently retried.
- **Migration is the explicit exception** to "the facade always targets the active account": it
  needs two backends at once (source + destination), so it's built against two directly-constructed,
  explicitly scoped adapter instances, never through `CList.storage.kv`.

---

## Implementation status

| Piece | Status | Notes |
|---|---|---|
| `js/storage.js` facade | **Done** | `window.CList.storage.kv.{list,get,add,update,remove,put}` + `window.CList.storage.mode`; see "KVStore facade — target interface" below |
| `js/kvstore-remote.js` | **Done** | HTTP adapter over `get_kvs`/`add_kv`/`update_kv`/`delete_kv`, takes an explicit `{baseUrl, token}` ctx |
| `js/kvstore-local.js` | **Done** | IndexedDB adapter; calls `local-kvstore.js`'s IndexedDB helpers directly via `window.CList._localKvStore`, bypassing the `fetch` interception entirely — see note below |
| IndexedDB transaction discipline, KV side | **Done**, 2026-10-28 | Found missing during an audit, then fixed: `local-kvstore.js`'s `openDb()` now handles `db.onversionchange` and `req.onblocked` (previously had neither, unlike `page-store-idb.js`'s equivalent); `kvstore-local.js`'s `add()` now uses a new `idbAdd()` (native IndexedDB `add()` in one transaction) instead of a separate `idbGet`-then-`idbPut`, closing the check-then-write race called out by name in the Cross-cutting rules above; all of `kvstore-local.js`'s ops now route through a `run()` wrapper that maps any non-`KvStoreError` failure to `StorageUnavailable`. `update`/`remove` later gained their own same-transaction existence check too — see the row below; `put` remains the one deliberate exception |
| Value-domain validation + local update/remove 404-matching | **Done**, 2026-10-28 | `storage.js`'s `kv.add`/`kv.update`/`kv.put` now call `requireValue()`, and `kv.add`/`kv.update`/`kv.remove`/`kv.get`/`kv.put` call `requireKey()`, both throwing `KvStoreError('InvalidData', ...)` for an absent/non-string/empty key or value, matching Flask's 400 exactly; `kvstore-remote.js`'s `codeForStatus()` gained a 400 → `InvalidData` case (previously fell through to `StorageUnavailable`). Separately, explicit user decision: local `update`/`remove` now reject `NotFound` on a missing key instead of upserting/no-op-ing, matching Flask's 404 — `local-kvstore.js` gained `idbUpdateIfExists()`/`idbDeleteIfExists()` (get + conditional put/delete in one read-write transaction, per the Cross-cutting rules existence-check note above), and `kvstore-local.js`'s `run()` wrapper maps that failure to `NotFound`. `put()` is unchanged and stays an intentional upsert (§4) |
| Caller migration (9 files) | **Done**, confirmed 2026-10-28 | `kvstore.js` (~19 call sites: single-key `put`/`add`/`remove`/`update`, plus `loadFollowing()`/DID-panel `loadAccounts()`/`updateDid()` on `list()`) migrated this pass, verified via `node --check` + grep. The other 8 (`collections.js`, `publish.js`, `tags.js`, `annotate.js`, `dynamicp2p.js`, `wordpress.js`, `mastodon.js`, `dropbox.js`) were found to already call only `window.CList.storage.kv.*` — checked by grepping every file for raw `get_kvs`/`add_kv`/`update_kv`/`delete_kv`, zero hits. Repo-wide grep confirms the only files still naming those four endpoints are `kvstore-remote.js` (the adapter) and `local-kvstore.js` (the local fetch-interception layer implementing the sentinel), plus `kvstore.js`'s explicitly-excluded cross-server migration block. `dynamicp2p.js:288`'s `fetch('.../did.json')` is correctly out of scope — the public DID-document endpoint, not generic KV |
| `getAccounts()` denylist → allowlist-by-schema | **Done**, 2026-10-28 | `getAccounts()` (`kvstore.js`) now excludes a decrypted record unless `window.CList.schemas[accountData.type]` exists, replacing the hand-maintained prefix denylist. Verified safe for every previously-excluded prefix (`collection:*`, `clist:pages-catalog`, `social:following:*`, `_did_identity_key`) — each decrypts cleanly under the same `encryptWithKey`/`decryptWithKey` scheme and has no `type` field that could spuriously match a schema |
| Local register/login off `fetch` interception | **Done**, 2026-10-28 | `local-kvstore.js` exposes `registerUser(username, authHash)`/`loginUser(username, authHash)` on `window.CList._localKvStore` (pulled out of `handleLocalRequest`'s `/auth/register`/`/auth/login` branches, which now call them too, so the `fetch`-interception path's behavior is unchanged). `kvstore.js`'s `KVregisterWithCredentials`/`KVloginWithCredentials` call these directly when `isLocalMode()` is true, instead of `fetch`-ing the sentinel. Verified via `node --check`; no browser regression test performed |
| Remove global `fetch` override in `local-kvstore.js` | **Not done — unblocked, pending regression test** | Both prerequisites are now met: (a) every caller migrated — done, see Caller migration row; (b) local register/login re-plumbed off `fetch` — done, see row above. The override itself has not been removed: `storage-architecture-plan.md` §8 step 5 requires the (b) replacement be "in place and tested *first*," and step 7's regression testing is still outstanding (browser testing deferred by the user) — so the override stays in place, now unused in normal operation but left as a safety net until that testing happens |
| `collection:*` / `membership:*` storage split | **Designed, not coded** | Design is final — see `collection-conceptual-model-v1.08.md` v1.09, "Storage split" section. No `membership:` key construction exists in `collections.js` yet (checked 2026-10-28) |
| `js/page-store-idb.js` | **Done** | |
| `js/page-store.js` | **Done** — matches API below | |
| PageStore `savers`/`loaders` registry entries | **Done** | "Save to CList (local)" saver + "CList (local)" loader, registered in `js/page-store.js`; loader renders its own picker into `window.CList.ui.view.loadOptions` (same pattern as "My Pages"), returns `null`, routes through `loadSavedPage()` |
| `recordPublication()` + `publications` field | **Done** | See "PageStore — target interface" below; also resolves one `publish.js`-identity question from "Deferred: editor-state contract" |
| `recordPublication()` wired into `publish.js` (CListBin + per-account social publish) | **Done** | `_performWebPagePublish()`'s non-overwrite branch and `postAll()`'s per-account loop both call it for a `local-page`, instead of forking a `page:` My Pages record |
| `exportPages()` / `importPages()` UI | **Done**, 2026-10-28 | Added to `js/page-store.js`'s "CList (local)" loader: "Export all pages" (`_exportAllPages()`, downloads the bundle as JSON via Blob/anchor-click) and "Import pages..." (`_showImportPagesPicker()`, file input + `onConflict` select, reports `ImportResult` counts via `showStatusMessage`/`showErrorModal`). Verified via `node --check`. |
| Editor-state contract (switch editors / new page / import / fork-remote-to-local) | **Deferred — not in this plan's scope** | Needs its own design pass; see "Deferred: editor-state contract" below |

**Already fixed, independently of this effort** (landed in commit `fd1b426`, 2026-10-28, found while
inventorying call sites for this plan — not something this refactor still needs to do):
- `kvstore.js`'s `getSite()` now reuses `getAccounts()` instead of re-filtering `/get_kvs/` results
  independently — there had been two separately-maintained exclusion lists that had drifted apart;
  now there's one.
- `getAccounts()`'s single denylist now also excludes `social:following:*` (previously didn't).
- A `console.log` that printed the raw Bearer access token was removed.

---

## KVStore facade — target interface

```javascript
window.CList.storage.kv.list();              // Promise<[{ key, value }, ...]>
window.CList.storage.kv.get(key);             // Promise<{ key, value } | null>
window.CList.storage.kv.add(key, value);      // Promise<void> — rejects AlreadyExists if key exists
window.CList.storage.kv.update(key, value);   // Promise<void> — rejects NotFound if key doesn't exist
window.CList.storage.kv.remove(key);          // Promise<void> — rejects NotFound if key doesn't exist
window.CList.storage.kv.put(key, value);      // Promise<void> — explicit add-or-update (upsert)
window.CList.storage.mode;                    // getter: 'local' | 'remote' — derived from isLocalMode(),
                                               // never an independently-set flag (see note below)
```

Values are opaque (already encrypted/encoded by the caller) — the facade and adapters never
encrypt, decrypt, or reinterpret them.

**Value domain:** both `key` and `value` are required, non-empty strings, matching Flask's
validation exactly. `null`/`undefined`/empty-string on either is a validation rejection, not
`StorageUnavailable`. There is no null/empty sentinel — a caller needing to represent "no value"
encodes that inside its own serialized value.

**Error categories** — see "Cross-cutting rules" above for the full contract
(`{ code, operation, cause }`, no-auto-retry-on-write): `NotAuthenticated`, `NotAuthorized`,
`NotFound`, `AlreadyExists`, `InvalidData`, `StorageUnavailable`, `Indeterminate`.

**`storage.mode` must be a derived read-only getter**, e.g. `isLocalMode() ? 'local' : 'remote'` —
never a second flag maintained alongside `isLocalMode()`. `isLocalMode()` (from `local-kvstore.js`)
already drives the cookie/localStorage split for auth-token storage (see
`project_clist_file_protocol` memory's six-storage-configuration matrix) — a second, independently
set `storage.mode` would reproduce the exact class of bug just fixed between `getSite()` and
`getAccounts()` above: two answers to the same question, quietly drifting apart.

**Known accepted gap inherited by `kvstore-remote.js`:** `file://` + remote KVStore fails due to
Caddy's CORS allowlist having no entry for `file://`'s null origin (case 6 of the six-configuration
matrix in `project_clist_file_protocol` memory). Not this refactor's problem to fix.

**Server constraint:** `/get_kvs/` returns the full array — no endpoint for fetching one key.
`kvstore-remote.js`'s `get(key)` is implemented over `list()` unless a dedicated endpoint is later
added and justified separately.

**`put()` as a first-class upsert.** Added to the facade from the start rather than deferred —
inventorying the 9 caller files found ~15 sites independently reimplementing add→409→update (or a
precomputed existence check) by hand. `kvstore-remote.js` implements it that way (`add`, falling
back to `update` on `AlreadyExists`); `kvstore-local.js` implements it as a single unconditional
`idbPut` (cheaper). `put()` is now the *only* KV op that upserts without an existence check —
`update()`/`remove()` reject `NotFound` on a missing key as of 2026-10-28 (see Implementation
status above), so `put` is a deliberate, documented exception to that rule, not a shared default.

**`kvstore-local.js` and the global `fetch` override.** This adapter does not call `fetch` at all —
it calls IndexedDB helpers (`idbGet`, `idbPut`, `idbAdd`, `idbDelete`, `idbUpdateIfExists`,
`idbDeleteIfExists`, `idbGetAllByIndex`, `usernameForToken`) that `local-kvstore.js` now exposes on
`window.CList._localKvStore` for exactly this purpose (a
small, additive, non-behavioral export — the `fetch` interception and the sentinel URL are
untouched). `window.CList._localKvStore` also now exposes `registerUser`/`loginUser`, which
`kvstore.js`'s local-mode register/login call directly the same way (§8 step 5(b), done). The two
paths currently coexist: `handleLocalRequest` still answers anything that calls `fetch` against
the `local.clist` sentinel directly, exactly as before, while both KV ops (via `storage.js`) and
register/login (via `kvstore.js`) now go straight to IndexedDB in normal operation. Removing the
`fetch` override itself (see Implementation status above) is unblocked but not yet done — it's
gated on step 7's regression testing, not on any remaining re-plumbing work.

---

## PageStore — target interface

Always local (IndexedDB), regardless of the active KVStore backend, and usable without a KV login.

```javascript
window.CList.pageStore.save(page);          // → PageRecord  (create, update, or RevisionConflict)
window.CList.pageStore.get(id);             // → PageRecord | null
window.CList.pageStore.list(options);       // → PageSummary[]
window.CList.pageStore.remove(id);          // → boolean (true if deleted)
window.CList.pageStore.exportPages();       // → PageBundle (plain object, caller handles download)
window.CList.pageStore.importPages(bundle, options);  // → ImportResult
window.CList.pageStore.recordPublication(id, { service, accountId, url });
                                             // → PageRecord | null — see below
```

**Storage:** IndexedDB database `clist_pages`, object store `pages` (keyPath `id`), index on
`updatedAt`.

**`save(page)` semantics** — this is what prevents a second save from creating a duplicate:
- `page.id` matches an existing record → update in place: `createdAt` preserved, `updatedAt`
  bumped, all other given fields overwritten.
- `page.id` given, no existing record → create new record with that id (lets a caller reuse an
  existing authoritative identifier, e.g. a `urn:uuid:` already minted elsewhere — PageStore
  doesn't parse or validate id format).
- `page.id` omitted → a bare `crypto.randomUUID()` is generated.
- Throws `PageStoreError('InvalidData')` if `content` isn't a string.

**Optimistic concurrency via `revision`:** an integer, starts at 1, +1 on every successful save —
simpler and more reliable than comparing `updatedAt` timestamps (clock skew/resolution). The caller
passes back the `revision` it last read:
- Matches the stored revision → write proceeds, stored revision becomes `+1`. Normal editor-save path.
- Doesn't match → rejects with `PageStoreError('RevisionConflict')`, writes nothing. Something else
  (another tab, an import) changed the record since this session opened it — the caller decides how
  to recover; PageStore never silently merges or clobbers.
- Omitted → forced overwrite, no check. The explicit escape hatch for conflict recovery, not the
  default save path.
- No existing record (create) → `revision` starts at 1 regardless of what was passed.

**PageRecord:**

```javascript
{
  id:          string,   // bare UUID v4, or a reused authoritative id
  title:       string,
  content:     string,   // editor's native serialized form, unmodified
  contentType: string,   // 'text/plain' | 'text/html' — open-ended, not enum-enforced
  editorType:  string,   // currentEditor key: 'texteditor' | 'tinymce' | 'etherpad' | ...
  createdAt:   string,   // ISO 8601, set once
  updatedAt:   string,   // ISO 8601, bumped every save
  revision:    number,   // starts at 1, +1 per successful save — optimistic-concurrency check
  sourceUri:   string | null,
  sourceId:    string | null,
  references:  Array<{ membership, member }>,  // default []; see "Editor references as a
                                                 // page-scoped collection" in the collection model doc
  publications: Array<{                        // default []; current status per destination,
    service:     string,                        // not a full publish history — see below
    accountId:   string | null,
    url:         string,
    publishedAt: string,   // ISO 8601
    revision:    number,   // the page's stored revision at the moment of publishing
  }>
}
```

**`recordPublication(id, { service, accountId, url })`.** Annotates an
existing page with its publication status; does not create a page. Entries in `publications` are
**upserted by the pair `(service, accountId)`** — republishing to the same service/account updates
that entry in place; a different service, or a different account on the same service, appends a new
entry. This is "current status per destination," not an append-only history log — matches a page
being live in several places at once (e.g. CListBin and Mastodon) with at most one current status
per place.

- `publishedAt` and `revision` are stamped by PageStore itself, not supplied by the caller — read
  fresh inside the same `_pageStoreReadThenWrite()` transaction used by `save()`/`remove()`, so the
  recorded revision is accurate even if the caller's in-memory copy of the page is stale.
- **Does not bump `revision`.** `revision` is specifically the content-conflict counter `save()`'s
  optimistic-concurrency check relies on (above). Bumping it for a metadata-only change would risk a
  spurious `RevisionConflict` for an editor session mid-edit, still holding the pre-publish revision,
  even though the editable content hasn't changed. Deliberate, documented exception — not an
  inconsistency to later "fix."
- **Does bump `updatedAt`** — so `list()`'s default sort surfaces a just-published page near the top,
  same as any other change worth noticing.
- Not-found behaves like `get()`/`remove()`: resolves `null`, never throws.

**Resolves one editor-state-contract question, not the others — see "Deferred" below.** Publishing a
`local-page` (to CListBin/Pastebin via `js/clistbin.js`, or to an ordinary social publisher) keeps its
`local-page` identity: `recordPublication()` annotates the existing record, `currentLoadedPage.kind`
stays `'local-page'`, and no parallel `page:` KVStore ("My Pages") record is created for it — unlike
the fork that happens today for every other first-time CListBin publish. Both call sites are wired:
- `_performWebPagePublish()`'s non-overwrite branch (`publish.js`): when
  `currentLoadedPage?.kind === 'local-page'`, calls `recordPublication(currentLoadedPage.id, {
  service: 'CListBin', accountId: binAccount.instance || null, url: result.url })` and returns,
  instead of `_saveWebPageRecord()` + `setLoadedPage({kind: 'page', ...})`. Every other case
  (nothing loaded, or a page loaded from My Pages) keeps that unchanged behavior.
- `postAll()`'s per-account social-publish loop (`publish.js`): after a successful publish that
  returns a URL, if `currentLoadedPage?.kind === 'local-page'`, calls `recordPublication(
  currentLoadedPage.id, { service: accountData.type, accountId: accountData.id || null, url })`.

**`list(options)`** returns `PageSummary` rows — `{ id, title, editorType, contentType, createdAt,
updatedAt }` — deliberately excluding `content`/`references` to keep listing cheap. Fetch the full
record via `get(id)` when a page is actually opened. `options: { sortBy = 'updatedAt', order =
'desc', limit?, offset? }`.

**`exportPages()` / `importPages()`:**
- `PageBundle`: `{ manifest: { app: 'CList', kind: 'pageStoreBundle', version: 1, exportedAt, count }, pages: PageRecord[] }` (full records).
- `exportPages()` is DOM-free — returns the object; the saver/UI code does `JSON.stringify` and
  triggers the actual browser download. Mirrors the facade's "stays UI-agnostic" rule.
- `importPages(bundle, { onConflict = 'skip' })` — `onConflict` is `'skip' | 'replace' |
  'duplicate'` (`'duplicate'` mints a fresh id so an imported page is never silently dropped or
  overwritten).
- **Two-tier validation, nothing written until Tier 1 passes for the whole bundle:** Tier 1 —
  structural checks over every record before any write: `manifest.kind === 'pageStoreBundle'`,
  supported `manifest.version`, every record has its required fields, no duplicate `id`s within the
  bundle. Any Tier 1 failure rejects the **entire** import with `PageStoreError('InvalidData')` —
  never a partial write. Tier 2 — per-record conflict resolution against the existing database
  (skip/replace/duplicate), only runs once Tier 1 has passed; a Tier 2 skip is reported, not an error.
- **Reference remapping:** a two-pass write — pass one writes every page, building an old-id→new-id
  map for ids that got remapped (`'duplicate'` policy); pass two rewrites each imported page's
  `references[].member` entries whose target id is in that map to the new id. A reference pointing
  outside the bundle (a live KVStore record, or a page already in the database) is left untouched. A
  reference whose target was in the bundle but failed validation and was never written is left as-is
  and reported under `danglingReferences`, not silently dropped.
- `ImportResult`: `{ imported, skipped, replaced, duplicated, danglingReferences, errors: [{ id, message }] }`.

**Error type:** `PageStoreError` (code: `'InvalidData'` | `'StorageUnavailable'` |
`'RevisionConflict'`) — narrower than the KV facade's categories above, since PageStore has no
server to mirror 404/409 against; "not found" is expressed as `null`/`false` returns, not a thrown
error.

**Editor integration:** one `window.CList.savers` entry ("Save to CList (local)") and one
`window.CList.loaders` entry, registered the same IIFE way every service does (see
`docs/adding-a-service.md` §4–5) — not per-editor hooks. The saver reads the existing
`currentLoadedPage` state (`js/editors.js`) to decide create vs. update, using a new
`kind: 'local-page'` value alongside the existing `'page'` (My Pages, remote) and `'collection'`
kinds — no new tracking mechanism needed.

**Integration wart, fixed:** `editors.js`'s `updateLoadedPageUI()` read `currentLoadedPage.url`
unconditionally for a tooltip. A `kind: 'local-page'` object has no `url`, so without a guard the
tooltip attribute became the literal string `"undefined"`. Fixed with an `|| ''` fallback on both
the label text and the `title` attribute.

---

## Deferred: editor-state contract

This plan defines page-*record* behavior (save/revision semantics above) but deliberately leaves
the in-progress *editor state* across these transitions undefined — a separate design pass, not
part of this plan:

- Opens a page and edits it.
- Switches editors mid-session (e.g. plain text → TinyMCE).
- Starts a new page.
- Imports a page.
- Saves an existing remote document (My Pages) locally into PageStore.

Open questions include: does switching editors carry over unsaved content or discard it (visibly to
the user, or silently); does it reset `currentLoadedPage` to "new, unsaved" or carry its id/kind
forward; does importing a page load it into the active editor or just add it to the PageStore list;
does saving a remote My Pages document locally fork it into a new PageStore id (mirroring
`files.js`'s `_touchOrForkWebPageRecord` for the remote case) or treat it as one logical page under
two storage locations. The PageStore/editors integration work implements only what's specified above
(save/get/list/remove/export/import on the record) and leaves these transitions no worse than they
behave today — it does not pick an arbitrary answer to any of the open questions along the way.

**One sliver now resolved — see `recordPublication()` above.** The *publish-direction* question
(does publishing a local page fork it into a separate My Pages record) is answered: no, it keeps its
local-page identity and gets a `recordPublication()` annotation instead. The *opposite* direction —
loading an existing remote My Pages document into local storage — and every other question in this
list remain open and deferred.

---

## Data inventory (KV key prefixes)

From `storage-architecture-plan.md` §2 and §8, confirmed against current code:

| Prefix | Meaning | Notes |
|---|---|---|
| `_*` (e.g. `_did_identity_key`) | System/internal records | Excluded from Manage Accounts |
| `collection:{id}` | A collection's own properties | Pre-1.09: whole collection incl. items. Post-1.09 (not yet coded): properties only |
| `membership:{collectionId}:{membershipId}` | One collection entry | Not yet coded — see status table above |
| `social:following:*` | Following relationships | Excluded from Manage Accounts |
| `clist:*` | Other namespaced records | Excluded from Manage Accounts; full ownership not yet separately inventoried |
| `page:{urn:uuid:...}` | "My Pages" — remote, KVStore-backed page records, written automatically on publish | Distinct from PageStore (`clist_pages` IndexedDB, always local) — not a `savers` entry, created by `publish.js`/`collections.js`'s publish flow |
| (no prefix / account type keys) | Service accounts | Everything else — shown in Manage Accounts via allowlist-by-schema as of 2026-10-28 (see status table); previously a denylist |

Two non-KV facilities, kept separate from generic KV storage (not touched by this refactor):
- Public DID documents (`User.did_document`, public resolution/handle-lookup routes).
- The 5-minute P2P discussions registry (`discussions.json`, `/api/discussions`) — requires a
  network-reachable account; a local-only account has no public URL to be discovered by.

---

## Source documents

- `storage-architecture-plan.md` — original design brief (KVStore facade + PageStore), implementation
  sequence, acceptance tests, explicit boundaries.
- `collection-conceptual-model-v1.08.md` (content now v1.09) — collection/membership conceptual
  model, the `collection:*`/`membership:*` storage split, referential membership resolution, and
  editor references as a page-scoped `cites` collection.
- `adding-a-service.md` — registry patterns (`schemas`, `publishers`, `readers`, `savers`,
  `loaders`) that both the facade migration and PageStore's editor integration must follow.
- `error-handling.md` — `showStatusMessage`/`showErrorModal`/`showServiceError` conventions that
  all new storage-layer error surfacing must use.
