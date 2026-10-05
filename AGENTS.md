# CList — /srv/www/clist.mooc.ca

CList is a personal learning and communications application: a 100% client-side browser app for
reading feeds, writing content, and publishing to social platforms.

See [README.md](README.md) for full architecture, kvstore/CORS details, and file structure.

## Architecture

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
- `mastodon.js`, `bluesky.js`, `wordpress.js`, `blogger.js` — platform integrations
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
- **`showStatusMessage(text)`** — transient message in `#statusPane`, auto-hides after 3 s.
  Use for action feedback, validation, and background operation results.
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

## Cautions

- `interface.js` must load last (depends on all other scripts)
- All shared state lives under `window.CList`: `config.flaskSiteUrl`, `state.username`,
  `accounts`, `readers`, `publishers`, `savers`, `loaders`, `schemas`
- TinyMCE is loaded from `https://www.downes.ca/assets/tinymce/tinymce.min.js`
- Do **not** use `flask-cors` for kvstore — handle CORS entirely in Caddy (see README.md)
