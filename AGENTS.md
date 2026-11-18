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
