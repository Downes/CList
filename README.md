# CList

Personal learning and communications application — a browser-based tool for reading feeds,
publishing to social platforms, and managing credentials for those platforms.

## Architecture

CList is 100% client-side HTML/JS. There is no CList server. All pages are static files
served directly by a web server (Caddy, nginx, etc.) or opened from disk.

External services CList talks to:

| Service | Purpose |
|---|---|
| **kvstore** (self-hosted Flask API) | Encrypted credential storage |
| **opml2json** (self-hosted Flask API) | OPML feed parsing |
| Social platform APIs (Mastodon, Bluesky, etc.) | Read/publish |

## kvstore — Credential Storage Backend

Credentials (API tokens, passwords, etc.) are stored encrypted in a companion Flask app
called **kvstore**. The crypto is entirely client-side:

- `encKey = PBKDF2(password, username+"_enc", 100k iters)` — stays in the browser, never sent
- `authHash = PBKDF2(password, username+"_auth", 100k iters)` — sent to server on login
- Values are AES-GCM encrypted with `encKey` before transmission; server stores opaque ciphertext

The server never sees the raw password or the encryption key. See
[`/srv/apps/kvstore/SECURITY.md`](https://github.com/Downes/CList) for full threat model.

### Configuring the kvstore URL

In `index.html`, set `flaskSiteUrl` to your kvstore instance:

```html
<script>
    let flaskSiteUrl = 'https://kvstore.yourdomain.com';
</script>
```

### Deploying kvstore

kvstore is a Python/Flask app intended to run as a Docker container behind Caddy.
Source is in `/srv/apps/kvstore/` on the companion VPS.

**Important — CORS:** Do not use `flask-cors` to handle CORS for this app. It fails to
inject headers into Flask's automatic OPTIONS responses for blueprint routes, causing
browser preflight requests to fail silently with `NetworkError`. Instead, handle CORS
entirely in Caddy:

```caddyfile
kvstore.yourdomain.com {
  @options method OPTIONS
  handle @options {
    header Access-Control-Allow-Origin "https://clist.yourdomain.com"
    header Access-Control-Allow-Credentials "true"
    header Access-Control-Allow-Methods "GET, POST, DELETE, OPTIONS"
    header Access-Control-Allow-Headers "Content-Type, Authorization"
    respond 204
  }
  handle {
    header Access-Control-Allow-Origin "https://clist.yourdomain.com"
    header Access-Control-Allow-Credentials "true"
    reverse_proxy kvstore:5000
  }
}
```

This pattern applies to any Flask API app on this stack that needs browser CORS support.

## File Structure

```
index.html          — main application
js/
  kvstore.js        — login, registration, credential fetch/store
  crypto_utils.js   — PBKDF2 key derivation, AES-GCM encrypt/decrypt
  interface.js      — UI logic
  reader.js         — feed reading
  publish.js        — publishing to social platforms
  mastodon.js       — Mastodon API
  bluesky.js        — Bluesky API
  wordpress.js      — WordPress API
  blogger.js        — Blogger API
  chatgpt.js        — OpenAI API
  ...
css/
  interface.css
  reader.css
assets/
```

## License

Copyright National Research Council of Canada 2025
Licensed under Creative Commons Attribution 4.0 International
https://creativecommons.org/licenses/by/4.0/
