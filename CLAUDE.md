# CList — /srv/www/clist.mooc.ca

CList is a personal learning and communications application: a 100% client-side browser app for
reading feeds, writing content, and publishing to social platforms.

See [README.md](README.md) for full architecture, kvstore/CORS details, and file structure.

## Architecture

- **No server-side logic** — all files are static HTML/CSS/JS served by Caddy
- **External services**: kvstore (credential storage), opml2json (feed parsing), social platform APIs
- **Credential storage**: encrypted client-side via PBKDF2 + AES-GCM; server stores only ciphertext
- kvstore URL is set in `index.html` via `let flaskSiteUrl = 'https://kvstore.mooc.ca'`

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

## Error Handling

Full reference: `docs/error-handling.md`. These rules apply to all new and modified JS code.

**Never use `alert()`, `confirm()` (for errors), or `prompt()`** — use the helpers below instead.

### Helpers (all in `utilities.js`)

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

## Cautions

- `interface.js` must load last (depends on all other scripts)
- Global variables (`username`, `flaskSiteUrl`, `accounts`, `BaseURL`, `accessCode`) are set in
  `index.html` `<head>` and used across modules
- TinyMCE is loaded from `https://www.downes.ca/assets/tinymce/tinymce.min.js`
- Do **not** use `flask-cors` for kvstore — handle CORS entirely in Caddy (see README.md)
