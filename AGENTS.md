# CList — /srv/www/clist.mooc.ca

CList is a personal learning and communications application: a 100% client-side browser app for
reading feeds, writing content, and publishing to social platforms.

See [README.md](README.md) for full architecture, kvstore/CORS details, and file structure.

## Testing

Before planning or changing tests, validating an implementation change, or reporting
results, read [Testing instructions for AI coding tools](docs/ai/testing.md).
Maintain the [human testing guide](docs/testing.md), AI instructions, and detailed
[feature test catalogue](tests/README.md) when their commands/coverage change.
Distinguish Node, browser, manual and live-service evidence; never equate a build
or a subset of tests with full validation.

The user performs browser tests. Prepare the affected fixture URLs and expected
results, then ask the user to run them; do not run browser checks yourself unless
the user explicitly delegates them. Record their reported PASS/FAIL separately
from automated Node results.

## Publishing changes

Before writing or changing code that supports or impacts publishing, read
[Publishing instructions for AI coding tools](docs/ai/publishing.md).
This includes service adapters, editor exports, account/session handling,
publication tracking, and publishing UI. Collection editor work is now authorized;
inspect the current implementation and preserve incoming/editor changes.

Publishing data operations must return results or propagate errors; their
controllers/views own visible feedback. Do not add UI to an adapter merely to
satisfy a general error-feedback rule.

## Shared data contracts

- Before changing account, collection, reference, or publishing data shapes,
  read `js/clist-types.js` and `docs/data-contracts.md`.
- Reuse the shared JSDoc typedefs in function `@param`, `@returns`, and variable
  `@type` annotations where applicable; do not invent conflicting local shapes.
- Update typedefs and affected annotations in the same change as their producers
  and consumers. Check optional fields, legacy input, nullability, and service
  extensions against actual code; annotations are not runtime validation.
- Preserve the plain JavaScript architecture and open-ended member/account
  properties. Keep encrypted records, decrypted JSON, and parsed objects distinct.

## Line endings

Use LF for all text edits and new files, including on Windows. Follow
`.gitattributes` and `.editorconfig`; do not introduce CRLF when writing files
through scripts or tools. Preserve binary files unchanged.

## Architecture

- Keep service-specific functions in that service's JavaScript module. When a
  service needs subdivision, use `service_feature.js` (for example,
  `mastodon_account.js`). Aim for files below 500 lines; split by responsibility.
- Custom account setup uses `window.CList.accountFlows[type]` factories. Consult
  `docs/adding-a-service.md` and the shared context typedef before extending them.
- Generic accounts use `account-panel.js` (controller/navigation),
  `account-form.js` (schema view), and `account-state.js` (DOM-free data operations).
  Extend `CList.accountHooks[type]` for service-specific validation, decorations,
  or reauthorization. Keep write errors distinct from post-write refresh failures.

- Ordinary post ordering/content limiting belongs in `publishing-workflow.js`.
  It takes explicit dependencies and emits data updates. Keep UI rendering in
  `publishing-view.js`; `publish.js` owns capture and post-publication effects.
  Post-panel construction/selection rendering also belongs in `publishing-view.js`;
  `populatePostOptions` supplies explicit values and callbacks. Consult
  `docs/publish_structure.md` and shared typedefs before changing this path.

- Standalone page publication uses `web-page-workflow.js` (explicit data operations),
  `web-page-publishing.js` (controller), and `web-page-view.js` (choices/feedback).
  Shared page identity/indexing helpers are in `web-page-records.js`. Preserve
  captured targets/session, matching-destination overwrite rules, and separate
  remote-write success from metadata failures. Collection publishing is separate.

- Collection Post, To Web Page, and direct Republish use `collection-publishing.js` (capture/state/controller),
  `collection-publishing-workflow.js` (explicit data/dependencies), and
  `collection-publishing-view.js` (selection/choice/results). Selection lives in
  `CList.state.collectionPublishing`, not button attributes. To Web Page uses a
  single captured CListBin target through the same workflow. Direct Republish
  updates its captured original resource/format and touches metadata only.
  Local-entry Publish uses `collection-entry-publishing.js` with the shared
  `runWebPagePublication` workflow and page-record helpers. Retain receipts and
  reconcile only the original unchanged member; views own all feedback.

- **No server-side logic** — all files are static HTML/CSS/JS served by Caddy
- **External services**: kvstore (credential storage), opml2json (feed parsing), social platform APIs
- **Credential storage**: encrypted client-side via PBKDF2 + AES-GCM; server stores only ciphertext
- kvstore URL is at `window.CList.config.flaskSiteUrl` (initialized in `index.html`)

## File Structure

```
index.html          — main application entry point
about.html          — about page
js/                 — all JavaScript modules
css/
  interface.css     — layout and UI chrome
  reader.css        — feed reader styles
assets/             — icons and static assets
docs/               — architecture documentation
  feed-structure.md — DOM structure for #feed-section, #feed-menu, #feed-container
```

## Key JS Modules

- `kvstore.js` — login, registration, credential fetch/store
- `crypto_utils.js` — PBKDF2 key derivation, AES-GCM encrypt/decrypt
- `interface.js` — UI logic (loaded last, depends on all others)
- `reader.js` — feed reading
- `publish.js` — publishing dispatch
- `mastodon.js`, `bluesky.js`, `wordpress.js`, `blogger.js`, `discord.js` — platform integrations
- `chatgpt.js`, `summarize.js`, `translate.js` — AI features
- `editors.js` — TinyMCE and plain-text editor management
- `dynamicp2p.js` — PeerJS-based chat

## Icon Button Pattern

Standard icon button — use this pattern everywhere. It renders as a transparent button with a
green icon (light mode) or the same green on a dark background (dark mode).

**HTML / JS:**
```html
<button class="clist-action-btn" title="Descriptive label">
  <span class="material-icons md-18 md-light">icon_name</span>
</button>
```

- `clist-action-btn` — styled in `interface.css`: no border, transparent background, hover tint
- `material-icons md-18 md-light` — Material Icons font, 18 px, green (`rgb(81,177,88)`)
- `title="…"` — **required on every icon button**, no exceptions
- `escapeHtml()` (`utilities.js`) — use for any untrusted text inserted via `innerHTML`

**Do not** add inline `background`, `border`, or `color` to these buttons. The class handles it.

## Text Button Pattern

Standard text button — use `.btn` for any labelled action button. Renders as white text on green.

**JS:**
```js
const btn = document.createElement('button');
btn.className = 'btn';
btn.textContent = 'Label';
```

- `.btn` — standard labelled action; `--highlight-color` background, `--highlight-text-color` (white) text
- `.btn-small` — compact variant for buttons inside panels, pickers, and inline controls; same colours, smaller padding and font
- `.btn-secondary` — grey (`#888`) override; combine with `.btn` or `.btn-small` for cancel / destructive-abort actions
- **Do not** invent new button styles. Do not add service-specific CSS classes or inline style attributes for buttons.

## Error Handling

Full reference: `docs/error-handling.md`. These rules apply to all new and modified JS code.

**Never use `alert()`, `confirm()` (for errors), or `prompt()`** — use the helpers below instead.

### Helpers (`showServiceError` and `showStatusMessage` are in `ui.js`; `parseAccountValue` is in `utilities.js`)

- **`showServiceError(container, title, message, actionHtml?)`** — persistent red `error-message` div
  appended to a feed container. Use for hard failures: feed loads, API errors, missing credentials.
  `container` can be a DOM element or an ID string.
- **`showStatusMessage(text)`** — transient message in `#identityDiv` (the login-identity bar),
  auto-restores after 3 s. Use for action feedback, validation, and background operation results.
- **`parseAccountValue(account)`** — safe `JSON.parse(account.value)`. Returns `null` on failure
  (logs `console.error`). **Always use this instead of bare `JSON.parse(account.value)`.**

### Rules

1. Every `async` call must be in a `try/catch` **or** have a `.catch()` if called without `await`.
2. Every `catch` block must produce visible feedback — never just `console.error` alone.
3. `parseAccountValue()` in a loop: guard with `if (!parsedValue) return;` to skip corrupt entries.
4. `parseAccountValue()` for a single account: guard with `if (!accountData) { showStatusMessage(...); return; }`.
5. Session/credential setup functions should `throw` on failure — let the feed-loading caller display the error via `showServiceError`.
6. Keep `console.error()` alongside any UI message — don't remove it.

### CSS classes (`reader.css`)

- `.error-message` — red, for hard failures requiring user action
- `.feed-status-message` — neutral grey, for soft/informational states ("No posts found")

## Editor file loading

Editor loading uses `editor-load-state.js` (plain transitions and representation rules),
`editor-load.js` (captured operation/controller), and `editor-load-view.js` (choices and
feedback). `CList.state.editorLoading` contains only generation/phase/target/error;
file bodies, page records and callbacks remain in transient operation captures.
Keep representation choice before draft review, expire old callbacks, and preserve
recognition, native annotation loading and collection-versus-text behavior. Editor
mounting/park-restore and queued content use `editor-switch.js` and existing handlers.
Do not claim that generation checks cancel a service editor's asynchronous mounting.

Editor switching uses `editor-state.js` (plain metadata/phase transitions),
`editor-switch.js` (captured picker, queued mounts, transfers and draft storage),
and `editor-switch-view.js` (picker/transfer/draft controls and shared mount chrome).
`CList.state.editorSwitching` holds public identity keys, phases and detached
parked page/reference metadata, never accounts or bodies. Serialize mounts and
expire stale picker/draft controls. Live collaborative handlers resync references
instead of restoring stale snapshots. Direct `initializeEditor` callers retain
mount-only semantics; service handlers still own their mounting lifecycle.

Load source/blank controls use `editor-controls-state.js` (plain phase and
loaded-page presentation rules), `editor-controls.js` (captured loader/blank
operations and compatibility entry points), and `editor-controls-view.js` (Load,
Blank, template/back, loaded-page/Republish display and toolbar rendering).
`CList.state.editorControls` contains phases/target/error only. Keep returned
loader content on the shared `loadSavedPage` path; self-managing service loaders
still own their internal UI and cannot be cancelled by these guards. Expire old
controls on panel navigation and reject stale editor/account/session/file-load
owners. Preserve full loaded-page metadata and existing publication visibility.

Generic Save destinations use `save-state.js` (panel/in-flight transitions),
`save-panel.js` (captured dispatch/completion controller), and `save-view.js`
(destination rendering/busy/error feedback). `CList.state.saving` contains only
panel/operation IDs, phase, busy, destination label and error. Retain the pending
lock across panel rebuilds, preserve `save()` method binding/no arguments and
`{keepOpen:true}` service forms and pending service prompts during list rebuilds,
and never automatically retry writes. Collection
Save still delegates to its existing controller. These guards do not capture or
cancel a legacy saver's internal content/account reads, UI or service writes.

References use `references-state.js` (plain list/panel transitions),
`references.js` (compatibility API, captured row/action ownership), and
`references-view.js` (citation editing and panel controls). Data stays in
`CList.state.references`; visibility/generation/busy lives in `referencesPanel`.
Keep URL deduplication, structural/reply metadata and legacy live reference-object
identity on inline edits. Expire stale row/document controls; normal Save metadata
updates alone do not represent another document or discard unfinished edits.
Collaborative map synchronization remains handler-owned. The existing collection
picker/storage helper is not migrated or cancelled by this panel extraction.

Write tags use `tags-state.js` (plain selection/suggestion rules),
`tags-workflow.js` (explicit KV/encryption operations), `tags.js` (controller),
and `tags-view.js` (chips/input/dropdown/creation choices). Tags and unsubmitted
input remain global across editor switches; rebind replaced controls without
losing text typed during an asynchronous mount. Collection caches are scoped by
user/server/token/local mode; never store credentials or encryption keys in
`CList.state.writeTags`. Creation preserves the legacy encrypted empty-array
record and add-if-absent semantics. Check the captured session before each
asynchronous preparation/write boundary; never retry an uncertain write.

Find uses `find-state.js` (draft/request state), `find.js` (registry/controller and
captured session/request lifetime), and `find-view.js` (controls/feed feedback).
`supportsFindContext: true` opts `search(query, context)` into explicit queries,
signal, guarded render/empty/fail and pagination. OpenAlex/Commons adopt it.
Legacy search providers keep no-argument `search()` and the state-backed
`finderString()` helper; their internal DOM writes are not newly protected.
Reuse reader invalidation, preserve Google feed-button compatibility, and keep
closing Find controls separate from ownership of visible feed pagination.

## Reader dispatch

The central boundary uses `reader.js` (controller), `reader-state.js` (pure
transitions), and `reader-view.js` (Read/account/feed-menu UI). Read
`docs/reader-workflow.md` and `js/reader-types.js` before changing it. Keep account
credentials/service sessions outside `CList.state.reader`.

LocalRSS list reads use `localrss_requests.js` (explicit data/transport),
`localrss_reader.js` (captured inputs/state/context), and `localrss_view.js`
(rendering/audio/loader). Preserve local-first endpoint resolution and guarded
Load more continuations. `context.next()` starts a new owned request; old callbacks
must not reload another account. Handler `uiActions` such as Options preserve
the displayed feed and pagination while opening controls. `context.updateAccount()` reconciles owned
metadata updates only. LocalRSS read/bookmark actions use `localrss_actions.js` with captured row targets,
explicit toggle transport and view-owned feedback. Preserve earlier-page actions during
pagination, invalidate replaced rows, and never automatically retry toggles. Options panel
lifetime, statistics and Mark all as read use `localrss_options.js` (captured controller),
`localrss_options_view.js` (view) and explicit transport in `localrss_requests.js`.
Post search and Show posts reuse the guarded list loader with captured selection
in `CList.state.localrssReading`; Refresh retains it and normal filters clear it.
Feed discovery/search/edit/retry/delete use `localrss_feeds.js` (panel-owned cache and
editor controller), `localrss_feeds_view.js` (controls/feedback), and explicit requests.
Invalidate captured cache generations on writes; never automatically repeat uncertain writes.
OPML import/export and new-database account creation use `localrss_opml.js`
(controller/receipts), `localrss_opml_view.js` (captured controls) and
`localrss_opml_requests.js` (explicit transport). Reuse `saveAccount`/`loadAccountRecords`;
never repeat an import to recover an account-save or refresh failure.

`initialize(accountData, context)` receives a detached selected account and optional
guarded request context. Existing feed actions receive no arguments. Only handlers
with `supportsRequestContext: true` receive context in feed actions, and they must
return their load promise. Prefer context.render()/commit() and captured accounts;
never claim stale-response protection for legacy direct-DOM service writes that
have not migrated. Keep `setupFeedButtons` compatibility for search providers.


`switchReaderAccount()` in `reader.js` is fully registry-driven — it has no knowledge of individual service types. All reader dispatch goes through:

```js
const handler = window.CList.readers[accountData.type];
await handler.initialize(accountData, context);
```

`initialize(accountData)` receives the full parsed account object. Each handler extracts what it needs (`accountData.instance`, `accountData.id`, etc.). Do **not** add `case` branches to `switchReaderAccount` — register a handler instead.

Full reader handler shape:
```js
window.CList.readers['MyService'] = {
    initialize:    async (accountData) => { … },
    feedFunctions: { 'Timeline': fn, … },   // rendered as buttons in #feed-menu
    onFeedClick:   (item) => { … },         // or null
    onAuthorClick: (item) => { … },         // or null
    statusActions: (item, itemID, itemUrl) => htmlString,  // or null
};
```

See `docs/adding-a-service.md` for the complete pattern.

## Storage Keys

**Never use bare string literals for storage key names.** Use the constants in `window.CList.keys` instead:

| Constant | String value | Used for |
|---|---|---|
| `window.CList.keys.ACCESS_TOKEN` | `'access_token'` | kvstore auth token (site-specific cookie) |
| `window.CList.keys.USERNAME` | `'username'` | logged-in username (site-specific cookie) |
| `window.CList.keys.TOKEN_EXPIRES` | `'token_expires'` | token expiry timestamp (site-specific cookie) |
| `window.CList.keys.OAUTH_CALLBACK_RESULT` | `'oauth_callback_result'` | OAuth popup result (localStorage) |
| `window.CList.keys.KVSTORE_URL` | `'clist_kvstore_url'` | selected kvstore server URL (localStorage) |
| `window.CList.keys.TRANSLATION_ENABLED` | `'translationEnabled'` | translation preference (localStorage) |
| `window.CList.keys.EDITOR_DRAFT_PREFIX` | `'clist_draft_'` | per-editor draft body and `_refs` sessionStorage keys |

These constants are declared in the inline `<script>` block in `index.html` and are available before any deferred script loads. Using them ensures a rename is a one-line change and prevents typo-silent bugs.

## Cautions

- `interface.js` must load last (depends on all other scripts)
- All shared state lives under `window.CList`: `config.flaskSiteUrl`, `state.username`,
  `accounts`, `readers`, `publishers`, `savers`, `loaders`, `schemas`
- TinyMCE is loaded from `https://www.downes.ca/assets/tinymce/tinymce.min.js`
- Do **not** use `flask-cors` for kvstore — handle CORS entirely in Caddy (see README.md)

## Desktop LocalRSS bundles

The optional bundle scripts install `requirements-localrss.txt`, collect backend
packages/resources and check the finished executable with `--check-localrss`.
Keep `localrss_bundle.py` checks aligned with backend imports. Never remove the
checks to work around missing imports. Run Python tests with
`python -m unittest discover -s tests -p 'localrss_*test.py' -v` for bundle/backend
changes; report these separately from Node. Source-launch dependency requirements
are distinct from frozen builds, which must work without end-user pip installs.


## Local file saves and My Pages

Local file saving uses `file-save.js` (captured controller),
`file-save-workflow.js` (explicit export/write/index operations), and
`file-save-view.js` (filename choice and feedback). `files.js` retains shared
serialization/loading and saver registration. Index only after successful write
or browser download handoff; cancellation/failure must not create a saved record.
Keep native/raw filenames and formats, exact document metadata, session-scoped
file handles and safe reconciliation with the original editor/page.

My Pages uses `my-pages-state.js`, `my-pages-workflow.js`, `my-pages.js` and
`my-pages-view.js`; collection browsing remains separate. Preserve captured
session/destination, stale-row/load guards, original identity and native content
routing. Remote deletion uncertainty keeps metadata. Retain accepted deletion
receipts for explicit metadata-only retry; never automatically repeat the delete.
Dropbox file operations use `dropbox_session.js` (captured account/session and
explicit refresh persistence), `dropbox_save_workflow.js` (export/save decisions),
`dropbox_save.js` (controller), `dropbox_save_view.js` (overwrite/feedback), and
`dropbox_picker.js` / `dropbox_picker_view.js` (listing/load state and UI).
`dropbox.js` retains initial OAuth setup and explicit transport. Collection Dropbox
exports delegate to the same captured save controller. Reuse `prepareLocalFile`
for native/raw/document formats. Only definite HTTP 401 rejection permits a single
refresh/retry; never replay an uncertain upload. Preserve explicit overwrite,
accepted receipts, original folders/account/session and the shared content-first
loader guard through editor choices. Apply all folder continuation updates/deletes
in order; cancel expired picker/choice promises so Save/Load can be reopened.


## Collection browsing and membership operations

Collection browser list/detail/My Collections uses `collection-browser.js` and
`collection-browser-view.js`. Imports use `collection-import-workflow.js`,
`collection-import.js` and `collection-import-view.js`; imported identity collisions
require an explicit Overwrite/Merge choice, and newer destination changes expire it.
`collection-session.js` owns transient captured storage credentials;
`collection-workflow.js` owns explicit record/membership operations. Presentation
state contains no credentials, encryption keys or bodies. Preserve unknown stored
extensions, publication metadata, stable storage keys and legacy records.

Membership pickers/rows use `collection-members.js` / `collection-members-view.js`.
Remove one durable membership ID or one selected legacy ordinal; never remove by
URL. Read latest stored siblings before mutation and reconcile only after accepted
writes. A replaced row must invalidate pending preparation/writes even when its
container remains connected; release replacement controls when an old operation
settles. Keep cycle rejection and add-if-absent creation; no automatic write retry.

Collection/member opening uses `collection-opening-workflow.js`,
`collection-opening.js`, `collection-opening-view.js`. Draft file/existing-resource
additions use the analogous `collection-entry-*` modules. Keep original draft/page/
account/session captures, shared content-first routing, explicit Open/Insert/Cancel,
owned-page restrictions, anonymous local blobs and failed-mount rollback that does
not overwrite a newer load. Nested file imports are add-only; conflicts are visible.
The remaining editor row widgets and collection Save/publication paths stay separate.

## Migrated service readers and row bindings

Mastodon uses `mastodon_requests.js`, `mastodon_reader.js`, `mastodon_actions.js`
and `mastodon_view.js`; Bluesky uses corresponding requests/reader/view modules.
Discord and public feeds use their captured reader/view modules. Annotations use
`annotate_requests.js`, `annotate_reader.js`, `annotate_view.js`. Keep selected
accounts, sessions, cursors and targets in transient captures. Reuse existing
publisher/annotation workflows for writes; views own feedback.

`bindRow(item, row, context)` receives private context outside serialized item and
reference data. Use `.service-status-actions` for service controls; shared actions
are appended afterward. Preserve connected earlier-page rows with
`isAccountCurrent`; use `context.navigate` for captured row navigation and `next`
for pagination. Reject detached/replaced rows and stale account/session callbacks.
LocalRSS row binding is in `localrss_row_view.js`. Google/DDG/OASIS now use captured
Find contexts, explicit request functions and `search-provider-view.js` row controls.
Google modes/pagination retain the original query and credential snapshot; reject
changed accounts and stale menus. OpenAlex/Commons also use the shared row binder;
keep earlier-page controls live while rejecting detached/replaced/session-stale rows.

## Following identity panel

Me → Following uses `following-workflow.js`, `following.js` and
`following-view.js`. Preserve exact stored keys independently of decrypted DIDs,
visible fallback warnings, captured login/server/storage-mode ownership and
pending Unfollow locks across refresh. Do not retry uncertain deletes automatically.
Keep transient credentials/nodes outside `CList.state.following`; the shared state
holds only presentation summaries. Reuse the storage facade and annotation cache
invalidation/refresh hook. Login/DID/migration/admin paths remain separate.

## DID identity display reads

DID identity/account listing uses `did-identity-workflow.js`, `did-identity.js`
and `did-identity-view.js` inside the existing management panel. Capture read-only
session/mode/panel and separate request lanes; reject stale responses/retries.
Keep account projections and displayed metadata free of credentials and render
untrusted text safely. Preserve local identity handling, 404 imported-key fallback,
visible read errors/partial warnings and the existing checkbox contract for legacy
Update DID. Reads use `CList.keys.DID_IDENTITY_KEY`. DID publication/removal/migration
controllers remain legacy paths and are not protected by these read guards.

Prove Same Identity uses `did-proof-workflow.js`, `did-proof.js` and
`did-proof-view.js`. Capture panel/session/target; reject stale input/session/key
continuations and guard duplicates. Reuse existing crypto helpers, never send own
credentials/private key to the other account, and keep proof material outside
shared summaries. Use safe text for untrusted public identity metadata. Mismatch
is a completed verification result, separate from operational failure. Publication,
removal and migration remain separate legacy lifecycles.

Publish Existing Key uses `did-publication-workflow.js`, `did-publication.js` and
`did-publication-view.js`. Preserve the stored key, captured session, fresh public
preflight, ciphertext check, cross-panel pending lock and accepted receipts. Reconcile
matching public identities without replacing documents; reject conflicting keys.
Unknown outcomes require read-only Check publication before a separate explicit
retry. Keep post-write account/collaboration refresh failures distinct from accepted
publication. Do not add automatic PUT retries or leak credentials/private keys into
summaries/payloads. Generation/regeneration, Update DID, removal and migration remain
separate legacy controllers.

Shared password confirmation uses `password-confirmation-workflow.js`,
`password-confirmation.js` and `password-confirmation-view.js`. Preserve the public
verifyPassword/confirmWithPassword APIs, custom import verifiers, trusted caller
HTML and label/class options. New callers should supply `opts.isCurrent` for their
captured source and own their async operation lifetime after confirmation dispatch.
Keep passwords/verifier keys transient, clear closed-dialog inputs, reject stale or
duplicate dispatch, and report async callback failure without replaying it or
replacing a newer modal. This helper does not migrate legacy DID write workflows.

First-time Generate Identity Key uses `did-generation-workflow.js`,
`did-generation.js` and `did-generation-view.js`. Preserve existing/concurrent keys
with add-if-absent; never fall back to put/update. Retain accepted storage receipts,
read-check uncertain adds before a separate explicit retry, and hand hosted
publication to the existing controller bound to the exact stored did:key. Local
creation performs no hosted request. Keep private/encryption material transient.
Regenerate Key, removal, Update DID and migration remain separate legacy paths.

Confirmed Regenerate Key uses `did-rotation-workflow.js`, `did-rotation.js` and
`did-rotation-view.js`. Capture the original key/public identity before confirmation;
recheck after async preparation. Preserve latest services/extensions/non-key aliases.
Keep replacement storage, publication and follow-up receipts distinct, with read-only
checks before separate explicit continuation of unknown outcomes. Never regenerate
or roll back to recover publication. Session-owned transient plans survive panel
rebuilds; never put ciphertext/private keys into UI summaries. A new deliberate
rotation needs fresh confirmation. Client key checks are not server-side CAS.
Invalidate pending proof/read feedback; proof must reject a changed stored key.
Update DID selection/publication, removal and migration remain separate lifecycles.

Remove DID uses `did-removal-workflow.js`, `did-removal.js` and
`did-removal-view.js`. Preserve password confirmation, original target/session
checks, independent key/document receipts, read-only reconciliation and explicit
remaining-step retry. Never replay accepted deletes, treat endpoint 404 alone as
proof of absence, or report completion while a step is unconfirmed. Retain partial
plans across panel rebuilds; completion rebuilds clean controls and clears obsolete
rotation plans. Keep ciphertext/fingerprints out of UI summaries. New identity
mutations must participate in the shared busy checks. Legacy Update DID/migration
Run dispatch guards do not migrate their internal async/session behavior.

Update DID/public choices use `did-update-workflow.js`, `did-update.js` and
`did-update-view.js`, with selection owned by the identity read controller. Never
infer choices from checked/data-key DOM properties. Keep source ciphertext versions
transient and protect credentials/extensions, linked metadata and catalog endpoints.
Account visibility and publication receipts are separate; checks are read-only,
remaining-step retries explicit, and accepted writes never replayed. Changed source
records/drafts/panels expire retries. Use `CList.keys.PAGES_CATALOG`. Update DID
participates in mutation coordination; migration remains separately guarded legacy
work. Client version checks are not backend compare-and-swap.


Migration preparation uses `migration-preparation-*` (workflow/controller/view).
Keep captured credentials/plans private, fail closed on unreadable records or
failed destination checks, and preserve registration receipts/explicit retry.
Migration execution uses `migration-execution-*` plus `migration-identity-workflow.js`.
Keep per-step accepted/uncertain receipts and ciphertexts private. Check migration
is read-only; explicit Retry remaining steps skips accepted copies/publications.
Never fall back from a conflicting add to blind overwrite. Preserve captured
source/destination/session and public metadata, recheck before each write, and
retain late receipts across panel rebuilds. Recovery lasts only in this tab and
source session; preview tests alone do not validate execution.


Login/register modal navigation, validation and server-picker selection use
`auth-panel-state.js`, `auth-panel.js` and `auth-panel-view.js`. Mode/draft server
live in `CList.state.authPanel`; passwords stay in private submission captures.
Keep duplicate/pending/rebuilt guards and distinguish preference-write failure
from refresh failure after accepted server selection. Credential transport and
session installation use `auth-credentials-workflow.js`, `auth-session-workflow.js`
and `auth-credentials.js`. Capture server/Local adapter/source-session versions
before awaits; validate returned username/token/expiry before saving. Keep
registration receipts private and distinguish accepted creation from login failure;
uncertain creation gets login checks or explicit registration retry only. Prepare
key export before synchronous token-last saving and report incomplete rollback.
Post-login setup uses `post-login-workflow.js`, `post-login.js` and
`post-login-view.js`. Service descriptors remain in `collab_account.js`,
`annotate_account.js`, `clistbin.js` and `public-feeds.js`. Preserve add-only
account writes, registration-only public subscriptions and Local exclusions.
Keep registration/account-save receipts separate; Refresh accounts and Check
setup never seed. Unknown service registration needs its explicit retry. Await
setup before one account refresh, expire old modal/session actions and retain
newer reader navigation. Logout/startup/storage-event restoration use
`session-lifecycle-workflow.js`, `session-lifecycle.js` and
`session-lifecycle-view.js`. Keep captured server/mode/cookie/key versions and
auth epochs private, reject malformed/expired sessions, and never seed accounts
during restoration. Logout invalidates pending authentication/restoration first,
removes the token before keys/drafts, verifies removal and reloads once. Retain
other servers' keys and unrelated storage; report partial cleanup separately.
Use `CList.keys.LOGOUT_MESSAGE` and `CList.keys.SESSION_SIGNAL` for existing names.

Administrative settings use `admin-settings-apps.js` (captured app metadata),
`admin-settings-workflow.js` (explicit GET/PUT/normalization), `admin-settings.js`
(private draft/session/receipt controller) and `admin-settings-view.js` (picker,
form, feedback and stacked Help). Resolve the selected KVStore when opening the
picker. Keep values/secrets/tokens out of `CList.state.adminSettings`. Preserve
boolean autosave, changed-only text saves and blank-secret omission. Retain newer
edits across save/read responses. Unknown writes require a read check and an
explicit reviewed save; HTTP acceptance survives a missing body/replaced panel.
Backend authorization remains authoritative; fixtures never write live settings.

Pane layout uses `pane-state.js` (pure transitions/legacy preference parsing),
`panes.js` (canonical state/persistence/commands) and `pane-view.js` (styles,
geometry/transitions/drag bindings). `CList.state.panes` contains layout only;
source credentials remain in private drag guards. Preserve the two existing
logged-in/out preference names via `CList.keys.PANE_STATE_LOGGED_IN/OUT`.
Restore without writes, save canonical state rather than reading DOM styles,
preserve editor nodes and close/invalidation options, and reject stale drag or
transition callbacks. `mainContent`/`readPane` aliases remain for existing
annotation/collab integrations.

Keyboard/touch navigation uses `navigation-state.js` (pure event rules),
`navigation.js` (private row/gesture/annotation ownership) and `navigation-view.js`
(DOM/events). `CList.state.navigation` contains indices/counts/phases only.
Preserve earlier-page selection during pagination, use shared row guards where
available, and reject captured gestures after reader/session/pane/selection changes.
One gesture dispatches one action; editing controls and modals suppress navigation.
Alt+A captures the reference and selection before queued editor switching. Its
completion guards do not cancel service editor mounting or internal insertion.

Shared labelled commands use `action-menu.js` (captured definitions, disabled/
pending ownership and keyboard focus) and `action-menu-view.js` (literal text and
buttons). The reader feed-menu is the first consumer; legacy service dispatch and
Translate stay in the reader bridge. Dispose replaced menus, suppress detached
callbacks/late failures, and report action failures through the feature's existing
feedback.

Reader menu pop-outs use `menu-shell.js` (private inline/pop-out/disposed lifetime)
and `menu-shell-view.js` (same-node movement, application stacked-modal shell,
Back/Close/Escape, Tab boundaries and focus return). Preserve pending command state
when moving surfaces. Expire old modal callbacks, retain replacement dialogs, and
dispose the shell before replacing/resetting its menu. External removal returns
owned nodes without restoring stale focus. LocalRSS Options now supplies its
existing header trigger and captured target guard to the same shell. It moves the
whole overlay, retaining draft fields/statistics/pending locks; Close or database
switch disposes that presentation. Keep legacy database/feed/import workflows
separate. `.menu-shell-surface` makes moved overlays flow inside the modal; skip
non-rendered controls when setting/trapping focus.

P2P chat initialization/connections use `dynamicp2p_session.js` (captured source,
Peer/connection ownership and cleanup), `dynamicp2p_session_view.js` (control
bindings/lifecycle feedback), and `dynamicp2p_session_bridge.js` (legacy globals
and effects). `CList.state.chatSession` contains phase/count only. Hiding Chat
keeps its peer alive; replaced controls/session sources expire callbacks. Preserve
same-ID connection guards, one open handshake, stale identity/signature checks and
owned heartbeat timer guards. Sharing/collaboration cards and remaining
message/crypto/storage internals still have legacy paths. Source expiry is checked
on activity/reopen, not by a new idle authentication observer.

Discussion listing/Join use `dynamicp2p_discussions_requests.js` (captured GET and
validation), `dynamicp2p_discussions.js` (private request/list/Join ownership and
compatibility bridge) and `dynamicp2p_discussions_view.js` (literal rows/feedback).
Keep directory rows/tokens out of `CList.state.chatDiscussions`; it holds phase/
counts only. Supersede old reads, expire replaced/source/service/list controls,
and reuse captured Peer-session dispatch. A requested/existing connection locks
duplicate rows until refresh; never describe dispatch as confirmed connectivity.
Remaining message and collaboration-editor internals migrate separately.

Create/Leave use `dynamicp2p_discussion_workflow.js` (explicit write receipts),
`dynamicp2p_discussion_actions.js` (private locks/review/recovery),
`dynamicp2p_discussion_view.js` (controls/feedback/layout) and
`dynamicp2p_discussion_bridge.js` (legacy effects). Keep payloads, credentials and
channels outside `CList.state.chatDiscussionAction`. Accepted writes recover local
updates without repeating POST/DELETE. Uncertain writes require read-only review
before explicit original-target retry; directory data cannot prove the write or
visibility. Leave pauses its owned heartbeat before dispatch, retaining local
connections until acceptance. Preserve new discussions/channels/drafts and locks
across rebuilt panels. Recovery is transient, without server CAS/idempotency.

Chat popup communication uses `dynamicp2p_popup.js` (main ownership/bridge),
`dynamicp2p_popup_client.js` (popup commands/acknowledgements) and
`dynamicp2p_popup_view.js` (DOM and existing renderers). Each main presentation has
an opaque private channel; each popup load has its own client identity. Expire old
requests/close events across reload, source changes and replacement windows.
`chatBc` is a guarded legacy forwarder, never a raw shared channel. Session teardown
notifies/disconnects its owned popup. Acknowledgements mean action dispatch, not
peer delivery or collaboration-document completion. Retain drafts on failures
and clear acknowledged text only if unchanged. No channel/IDs/content enter
`CList.state.chatPopup`. Real channel/window policy and legacy popup card rendering remain
separate validation/migration work.

Main share/invite cards now use `dynamicp2p_cards.js` (private snapshots/action
ownership/legacy bridge) and `dynamicp2p_cards_view.js` (literal DOM/callbacks).
`CList.state.chatCards` exposes counts only. Capture full import/invite extensions,
guard session/root/row lifetimes and duplicate pending actions, and push references
only for the original editor generation after loading. HTTP(S)-only card links
and normalized popup link data prevent unsafe navigation schemes; escape invite
relay text. Existing importer/editor/collaboration internals are not cancelled by
these guards.

Outgoing Share uses `dynamicp2p_share_workflow.js` (detached preparation/one-pass
broadcast), `dynamicp2p_share.js` (pending operation/receipt/session ownership and
compatibility bridge) and `dynamicp2p_share_view.js` (source capture/feedback).
Capture content before peer readiness; retain one pending selection and expire
old row/session/discussion continuations. Automatic discussion creation reuses
the Create controller with captured values, without overwriting the form; only
confirmed local completion permits broadcast. Unknown/blocked creation requires
explicit recovery and another Share. Preserve collection/invite extensions and
the synchronous `sendCollabInvite` boolean; reserve protocol identity fields.
Transport counts mean local send acceptance, not peer delivery. Never repeat a
partial/uncertain broadcast or resend to recover a preview failure.

Ordinary chat text uses `dynamicp2p_message_workflow.js` (detached packet/ID
preparation), `dynamicp2p_messages.js` (dedup/sign/verify/relay ownership and legacy
wrappers), and `dynamicp2p_message_view.js` (literal sender labels, decorated/
sanitized body, transcript and sanitizer compatibility helpers). Keep message
content/IDs/signatures outside `CList.state.chatMessages`; it holds a busy count.
Reserve duplicate IDs before awaiting verification and capture sender/recipients
before signing or verification. Skip closed/replaced connections and stale source/
DOM completions. Signature indicators retain the existing permissive render/relay
policy; local send acceptance is not delivery. Identity key/signature operations use the boundary described below.

Peer lists, username/DID claims, username requests, service announcements and
handshakes use `dynamicp2p_control_workflow.js`, `dynamicp2p_control.js` and
`dynamicp2p_control_view.js`. Validate/detach packets before cache mutation; replace
absent identity claims and expire superseded Follow controls. Reuse `_followUser`
with its fourth guard argument and captured token/DID/anchor. Escape join relay
text, restrict annotation URLs to HTTP(S), and expose only safe counts through
`CList.state.chatControl`. Announcements are peer claims, not verified identity.
Keep per-peer registries free of inherited keys. Preserve own public-field
projection, one-pass sends and original-channel guards; never retry uncertain sends.

Chat identity uses `dynamicp2p_identity_workflow.js` (explicit read/codec operations),
`dynamicp2p_identity.js` (captured ownership/private key lifetime and legacy wrappers)
and `dynamicp2p_identity_view.js` (feedback). Reuse the shared identity crypto helpers;
preserve the URL-safe chat wire format and true/false/null verification policy.
Keep keys/ciphertext/signatures out of `CList.state.chatIdentity`, which contains
availability/phase/counts only. Capture hosted/Local targets, check ownership after
awaits and reread ciphertext before accepting keys. Reject stale signing and
replaced-peer-key verification; never turn a stale signature into an unsigned send.
Missing/unavailable keys retain the existing unsigned fallback with owned failure
feedback. Separate announcement failures from successful identity loading.

Discussion activity uses `dynamicp2p_heartbeat_workflow.js` (captured POST),
`dynamicp2p_heartbeat.js` (timer/ownership/overlap controller and compatibility
bridge) and `dynamicp2p_heartbeat_view.js` (feedback). Preserve the one-minute
schedule and `startHeartbeat`/`stopHeartbeat` callers. Skip overlapping requests;
invalidate old timers/results on discussion, peer, service or source changes.
401 stops the timer; other failures remain visible and the next scheduled tick
may try again. No immediate retry or publication/delivery confirmation is implied.
`CList.state.chatHeartbeat` contains phase/busy only, never target credentials.

Start document from chat uses `dynamicp2p_collaboration_workflow.js` (last-15
transcript preparation), `dynamicp2p_collaboration.js` (captured dispatch/busy
ownership) and `dynamicp2p_collaboration_view.js` (DOM snapshot/feedback). Reuse
`openCollabFromChat` without duplicating editor creation. Capture the API and
discussion before deferred dispatch, coalesce pending clicks and reject stale
source/discussion/transcript callbacks. These guards do not cancel the existing
collaboration API's internal mounting, writes or invitation dispatch.

Stateless Etherpad chat decoration uses `prepareP2pEtherpadLink` in the existing
message workflow and `renderP2pEtherpadLink` in its view. Keep legacy wrappers and
the first quoted/bracketed HTTPS URL heuristic. Render sender labels as text,
decode serialized link entities once, and retain the shared message sanitizer.
Serialized links use safe ordinary navigation; DOM listeners do not survive HTML
serialization. Do not add a separate controller/state for this synchronous step.

Summarize uses `summarize-workflow.js` (explicit account/request/prompt),
`summarize-controller.js` (captured reader/account/input and operation ownership),
and `summarize-view.js` (DOM capture/output/Load feedback). Keep legacy APIs in
`summarize.js` and reuse `requireAccountWithPermission('z', ...)`. Preserve model,
prompts and token limits. Exclude nested summary output from source snapshots;
coalesce duplicates and reject stale responses/Load controls. Request failures
propagate to the view. No account credentials or content in `state.summarizing`.

Translate uses `translate-workflow.js` (explicit detect/translate requests),
`translate-controller.js` (preference, captured key/source, concurrent operations
and deadline/form ownership) and `translate-view.js` (labels/form/feedback).
`translate.js` retains compatibility APIs and the `translationEnabled` alias.
Reuse the preference key constant and shared timeout helper. Preserve independent
row requests, English/undefined-language and original-text fallbacks, and timed
wrapper rejection on timeout. Source/key/toggle/deadline expiry prevents follow-up
translation and stale form output; started HTTP is not cancelled. Public state
holds enabled/pending only. Request adapters propagate errors, views own feedback.

ChatGPT template transport/continuations use `chatgpt_requests.js`; captured
account loading, session/credential checks and request counts use
`chatgpt_template_requests.js`. Keep schema/loader/compatibility APIs in
`chatgpt.js`. Account-loading failures must stop generation, and continuation
chunks must retain one captured URL/key and exact assistant history. Reject
malformed/nonprogressing responses without automatic retry. Errors propagate to
callers; no UI in request helpers. Public request state holds pending only.

The generation form uses `chatgpt_template_form.js` (private choices, pending
intent, loader result and captured ownership) and `chatgpt_template_view.js`
(controls/local progress/errors/observer cleanup). Keep schema, fence extraction
and compatibility loader in `chatgpt.js`. Pass the optional caller guard through
generation requests so Back/changed choices prevent subsequent chunks. Back and
replaced/expired panels settle null; explicit retry preserves draft choices.
Progress is form-owned, not a shared-loader mutation. Public form state contains
phase/busy only. Existing editor controls still own returned-content routing.

Collab document browsing uses `collab_documents_requests.js` (captured account/
server/session GET and normalization), `collab_documents.js` (request/row lifetime
and opening lock) and `collab_documents_view.js` (literal list/feedback/retry).
The registered loader in `collab.js` supplies its existing title/opening hooks.
Keep lazy/default account resolution, fail closed on unreadable accounts, pass
the listed server into opening and reject stale saved rows. Opening errors may
use session-owned status feedback after editor mounting removes the list. The
legacy editor/dependency/WebSocket lifecycle itself is not cancelled by these
guards. Public list state contains phase/count/opening only.

Local/remote Collab initialization now shares `collab_connection_preparation.js`.
Capture credentials, server lookup ownership and editor/status nodes before any
await; recheck the returned commit guard before replacing live resources.
Local/remote starts supersede each other. Use captured element, token, store URL
and identity in the existing constructors, and expose phase/pending only through
`state.collabPreparation`. Started lookup/import work is not aborted. Provider
callbacks, resource cleanup, reference observation and awareness UI remain on
their existing lifecycle and need separate migration.
