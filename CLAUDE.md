# CList — /srv/www/clist.mooc.ca

CList is a personal learning and communications application: a 100% client-side browser app for
reading feeds, writing content, and publishing to social platforms.

See [README.md](README.md) for full architecture, kvstore/CORS details, and file structure.

## Architecture

- **No server-side logic** — all files are static HTML/CSS/JS served by Caddy
- **External services**: kvstore (credential storage), opml2json (feed parsing), social platform APIs
- **Credential storage**: encrypted client-side via PBKDF2 + AES-GCM; server stores only ciphertext
- kvstore URL is at `window.CList.config.flaskSiteUrl` (initialized in `index.html`)

## Core Design Principles

- **Capability over identity** — gate behavior and UI on what something can actually do or
  actually has (does this account have this capability? does this item carry the required data
  field?), never on hardcoded type/kind/service-name checks. This is why the Load/Save panels gate
  on `requiresLogin`/`requiresAccount` rather than per-service `if` branches, and why UI elements
  gate on actual fields in the Editor States Array rather than ad-hoc kind/type tags.
- **Extend the existing registry, don't write a parallel path** — before adding new logic, check
  whether a registry/handler pattern for this already exists (`window.CList.readers`,
  `publishers`, `savers`, `loaders`, `editorHandlers`, helpers in `ui.js`). Register into it instead
  of adding a new `case` branch, a new one-off function, or a second implementation of the same
  idea elsewhere in the codebase.
- **Reuse shared helpers before writing new logic** — `utilities.js` holds plain top-level helper
  functions (fetch/parse/error-check, account lookup, IndexedDB, base64/crypto, text/HTML cleanup,
  etc.) shared across files; `ui.js` holds shared UI helpers (modals, clipboard, pagination
  buttons — see Modal Pattern / Button Pattern below). Before writing new fetch, parse, validation,
  account-lookup, or DOM-building logic, run `grep -n "^function \|^async function " js/utilities.js`
  and skim `ui.js` for anything UI-related. Extend an existing helper's signature if it's close but
  not quite sufficient, rather than writing a parallel inline version. New general-purpose helpers
  belong in `utilities.js` as plain top-level functions, following the existing convention — not
  namespaced under `window.CList` unless they're UI-specific (then `ui.js`).

## Separate application logic from presentation

Treat application logic as an internal API. This is a direction for incremental work,
not authorization for a broad rewrite. See [the migration plan](docs/ui-logic-separation-plan.md)
before introducing shared state, action definitions, or new layer contracts.

- **Services and domain helpers accept data and return data.** Network/storage adapters may
  perform I/O, but must not accept DOM nodes, query controls, generate interface HTML, change
  CSS, or display messages. Keep transformations pure where practical; a function that fetches
  data is not itself pure. Preserve service-specific fields and capabilities when normalizing.
- **Controllers coordinate actions.** A controller reads application state, invokes the existing
  registered service operation, applies results, and asks a view to render progress, success,
  or failure. Services throw errors to that boundary; controllers log and visibly report them
  using the standard CList helpers. Do not show the same error at multiple layers.
- **Views own interface DOM and input.** Views turn input into explicit controller arguments or
  state changes. Application decisions must not inspect `data-selected`, CSS classes, or DOM
  structure. Such attributes may reflect state for rendering, accessibility, and event routing.
  Editors remain UI components and may use DOM/editor APIs internally.
- **Give each state value one owner.** Use `window.CList.state` for shared application state;
  reuse PageStore and existing editor/document models for the data they already own. Do not
  copy document contents, credentials, DOM nodes, or editor instances into a global state dump.
  Keep transient component details local unless other components need them. UI controls must
  render shared selections from state, including after the controls are rebuilt.
- **Describe shared actions as data.** Reusable menus and action bars should consume plain
  definitions with stable IDs, labels, icons, capability-derived availability, command IDs,
  and data arguments. The central component owns markup, back/close navigation, focus,
  keyboard handling, and standard styling. Resolve commands through a registered dispatcher;
  never evaluate strings or accept arbitrary HTML as menu definitions.
- **Keep calls direct by default.** Use returned promises for a single caller awaiting a result.
  Add subscriptions/events only for genuine independent observers; use an application-owned
  mechanism rather than `document` as the application bus. Define payloads, ownership, and
  unsubscribe/cleanup behaviour. Avoid a universal event bus or a new framework.
- **Reuse the current registries and helpers.** Add optional contracts and compatibility
  adapters to `readers`, `publishers`, and other existing extension points. Keep legacy handlers
  working during migration. Do not add a parallel service registry, a second source of truth,
  or a single enormous file containing every view. Shared components belong in the UI layer;
  feature views can remain separate.
- **Separate interface HTML from content HTML.** HTML articles, feed bodies, and exported
  documents are valid data formats. Content serializers and sanitizers may process markup
  without knowing the application layout. Do not mistake these for interface rendering.
- **Change one workflow at a time.** For new features, respect these boundaries. When touching
  legacy code, extract a bounded operation where useful; avoid unrelated rewrites. Verify
  service behaviour with no DOM, UI behaviour with fake services, state after re-rendering,
  and visible error handling. Document any retained coupling and the compatibility contract.

Existing examples below describe current interfaces, including legacy HTML-returning handlers;
they are not a requirement to introduce more coupling. During migration, the error rules apply
at the UI/controller boundary: lower layers may propagate errors without displaying them.

## File Structure

```
index.html          — main application entry point
defaults.js          — admin-configurable base URLs for remote services (window.CList.defaults);
                       loaded by index.html and chat.html; rewritten on disk by kvstore's
                       /admin/settings — see /srv/apps/kvstore/CLAUDE.md "Admin settings"
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

## Modal Pattern

- **`showModal(content, opts)`** (`interface.js`) — the standard modal builder for any dialog or
  panel. Always replaces the single `#generic-modal` instance, so it cannot have two independent
  modals open at once. Accepts `opts.wide` (80vw/80vh) and `opts.hideDefaultClose` (suppresses the
  built-in "Close" button for callers supplying their own). Use the `.modal-header-row` convention
  (title `h2` + "X" button, `justify-content: space-between`) for custom headers instead of
  `hideDefaultClose: false`'s plain footer button, when a modal needs a close control in its header.
- **`showStackedModal(content, opts)` / `closeStackedModal()`** (`interface.js`) — a second,
  independent modal layer (`#generic-modal-stacked`) for a dialog opened *from within* an
  already-open `showModal()` modal (e.g. a help/info popup triggered by a button inside a settings
  panel). Use this instead of a one-off hand-built overlay whenever a modal needs to appear on top
  of another open modal without destroying it — `showModal()` would otherwise remove the modal
  underneath. Same `opts.wide` / `opts.hideDefaultClose` API as `showModal()`. See
  `openAdminSettingsHelpModal()` in `kvstore.js` for the reference usage (Help popup stacked over
  the App Settings modal).
- **`buildDialogModal(title, bodyNode, buttons)`** (`ui.js`) — shared shell for a title + body +
  action-button-row dialog (confirm/cancel, save-as-filename, etc.), built on `showModal()`.
  `buttons` is `[{label, secondary, onClick(close)}, …]`. Use this instead of hand-building the
  box/heading/button-row structure — see `showErrorModal()`, `fallbackDownload()` (`files.js`), and
  `_localrssConfirm()` (`localrss.js`) for existing usage.

## Error Handling

Full reference: `docs/error-handling.md`. These rules apply to all new and modified JS code.

**Never use `alert()`, `confirm()` (for errors), or `prompt()`** — use the helpers below instead.

### Helpers (`showServiceError`, `showStatusMessage`, `showErrorModal` are in `ui.js`; `parseAccountValue` is in `utilities.js`)

- **`showServiceError(container, title, message, actionHtml?)`** — persistent red `error-message` div
  appended to a feed container. Use for hard failures: feed loads, API errors, missing credentials.
  `container` can be a DOM element or an ID string.
- **`showStatusMessage(text)`** — transient message in `#identityDiv` (the login-identity bar),
  auto-restores after 3 s. Use **only** for non-error feedback: confirmations and background-operation
  results ("Account saved.", "Copied to clipboard."). Never use it for anything that went wrong.
- **`showErrorModal(message, { title? })`** — full-screen modal (built on `showModal()`) with an
  "OK" button to dismiss. Use for **any** error or failure — not just save/publish gating: a failed
  fetch, a thrown exception, a blocked action, a missing precondition. It can't be missed or
  auto-dismiss unread, unlike `showStatusMessage`. Pass a specific `title` when the default `"Error"`
  wouldn't tell the user which action failed.
- **`parseAccountValue(account)`** — safe `JSON.parse(account.value)`. Returns `null` on failure
  (logs `console.error`). **Always use this instead of bare `JSON.parse(account.value)`.**

### Rules

1. UI entry points must catch awaited failures or attach `.catch()` to unawaited work. Lower
   layers may propagate rejected promises to that boundary; do not leave detached rejections.
2. Every user-facing operation failure must produce visible feedback at its UI/controller
   boundary. Lower-layer catches may add context, perform cleanup, or recover; rethrow failures
   instead of swallowing them or importing UI helpers. Never merely log and return success.
3. `parseAccountValue()` in a loop: guard with `if (!parsedValue) return;` to skip corrupt entries.
4. `parseAccountValue()` for a single account: guard with `if (!accountData) { showErrorModal(...); return; }`.
5. Session/credential setup functions should `throw` on failure — let the feed-loading caller display the error via `showServiceError`.
6. Keep `console.error()` alongside any UI message — don't remove it.

### CSS classes (`reader.css`)

- `.error-message` — red, for hard failures requiring user action
- `.feed-status-message` — neutral grey, for soft/informational states ("No posts found")

## Reader dispatch

`switchReaderAccount()` in `reader.js` is fully registry-driven — it has no knowledge of individual service types. All reader dispatch goes through:

```js
const handler = window.CList.readers[accountData.type];
await handler.initialize(accountData);
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

These constants are declared in the inline `<script>` block in `index.html` and are available before any deferred script loads. Using them ensures a rename is a one-line change and prevents typo-silent bugs.

## Desktop Launcher (`launcher.py`)

stdlib-only local HTTP(S) server — `python3 launcher.py`, or a PyInstaller build via
`build-linux.sh` / `build-macos.sh` / `build-windows.ps1` — that serves CList's static files and
proxies cross-origin calls so no CORS configuration is needed.

- `KVSTORE_PREFIX = '/kvstore-api'` — fixed proxy to the configured kvstore server.
- `PROXY_PREFIX = '/proxy'` — generic same-origin relay, path shape
  `/proxy/<base64url-encoded-origin>/<rest>`. Lets any account (e.g. a LocalRSS account pointed at
  a remote server) bypass CORS for whatever origin the JS side encodes, not just one fixed default.

### Bundled LocalRSS ("CList + LocalRSS" builds)

Each platform build comes in two variants: plain CList, and "CList + LocalRSS" which also bundles
a local LocalRSS backend that starts automatically on launch — no separate install. Both are built
by CI and listed on `desktop.html` and the GitHub Releases page.

- `localrss_bundled/` is a vendored snapshot of `/srv/apps/localrss_reader/app.py` + `feeds.opml`,
  pinned to a commit SHA (see the header comment in `app.py`) the same way `kvstore`'s
  `clist-server-admin`/`clist-kvstore-auth` dependencies are pinned — bump it when resyncing. One
  deliberate deviation from the
  source: `import fcntl` was moved out of module scope into `_acquire_scheduler_leadership()`,
  which now also short-circuits on Windows — the top-level import otherwise crashes the whole
  module there, and gunicorn multi-worker leader election is moot in this single-process desktop
  context anyway. **Do not** apply this change to the live `/srv/apps/localrss_reader/app.py`;
  production always runs on Linux under gunicorn.
- `launcher.py`'s `maybe_start_bundled_localrss()` detects the bundle (presence of
  `localrss_bundled/app.py` doubles as the marker), skips if something's already listening on port
  8787, else loads the vendored `app.py` and runs its Flask app in a daemon thread with `RSS_DB`
  pointed at a per-platform data dir (`get_localrss_data_dir()`, mirrors `get_certs_dir()`'s
  pattern). Load/import failures are caught and logged, never fatal to the launcher itself.
- Build scripts take `--with-localrss` (bash) / `-WithLocalRSS` (PowerShell) to produce this
  variant (`clist-localrss` / `CList-LocalRSS` / `CList-LocalRSS.exe`) instead of the plain one.
  Requires `pip install -r requirements-localrss.txt` — pinned to the same
  `clist-server-admin` / `clist-kvstore-auth` commits as
  `/srv/apps/localrss_reader/requirements.txt`; bump both together when resyncing.
- `.github/workflows/build.yml` builds and releases both variants for all three platforms (6
  binaries per release).

## Cautions

- `interface.js` must load last (depends on all other scripts)
- All shared state lives under `window.CList`: `config.flaskSiteUrl`, `state.username`,
  `accounts`, `readers`, `publishers`, `savers`, `loaders`, `schemas`
- TinyMCE is loaded from `https://www.downes.ca/assets/tinymce/tinymce.min.js`
- Do **not** use `flask-cors` for kvstore — handle CORS entirely in Caddy (see README.md)
