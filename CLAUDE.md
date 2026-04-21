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

## Cautions

- `interface.js` must load last (depends on all other scripts)
- Global variables (`username`, `flaskSiteUrl`, `accounts`, `BaseURL`, `accessCode`) are set in
  `index.html` `<head>` and used across modules
- TinyMCE is loaded from `https://www.downes.ca/assets/tinymce/tinymce.min.js`
- Do **not** use `flask-cors` for kvstore — handle CORS entirely in Caddy (see README.md)
