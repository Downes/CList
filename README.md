# CList

A personal learning and communications application — a browser-based tool for reading feeds,
annotating and composing responses, publishing to social platforms, and collaborating or chatting
with peers. CList has **no server-side logic of its own**: every file is static HTML/CSS/JS,
served by any web host or run directly as a desktop app. A live instance runs at
[clist.mooc.ca](https://clist.mooc.ca); anyone can host their own copy or run it from disk.

Features include feed reading, in-place annotation, multi-platform publishing (Mastodon, Bluesky,
WordPress, Blogger, and more), local and cloud-backed save/load (including Dropbox), AI-assisted
writing, real-time collaborative editing, peer-to-peer chat, and a portable `did:web` identity tied
to a user's own kvstore instance. See [docs/architecture.md](docs/architecture.md) for how these
fit together.

## Download

Pre-built desktop binaries for Windows, macOS, and Linux are available on the
[Releases page](https://github.com/Downes/CList/releases). A new release is built and published
automatically on every push to `main` (see [`.github/workflows/build.yml`](.github/workflows/build.yml)),
so the latest release always matches the current code.

| Platform | File |
|----------|------|
| Windows  | `CList.exe` |
| macOS    | `CList-macos` |
| Linux    | `CList-linux` |

## Architecture

CList is 100% client-side HTML/JS. All pages are static files served directly by a web server
(Caddy, nginx, etc.) or opened from disk. Optional back-end services provide the pieces a static
page can't do on its own:

| Service | Purpose |
|---|---|
| **kvstore** (self-hosted Flask API) | Encrypted credential storage and `did:web` identity |
| **proxyp** (self-hosted Perl/PSGI) | Cross-domain proxy for APIs that don't support CORS |
| **discussions** (self-hosted Flask API) | Peer discovery/signaling for P2P chat |
| **collab** (self-hosted Node/Hocuspocus) | Real-time collaborative editing |
| **opml2json** (self-hosted Flask API) | OPML parsing and feed aggregation |
| Social platform APIs (Mastodon, Bluesky, WordPress, Blogger, Dropbox, etc.) | Read/write/save |

None of these are required to use the core reading, writing, and publishing features — each is
swappable, and a user can point CList at their own instance of any of them, or at none at all.

**Full documentation lives in [`docs/`](docs/)** — start with
[`docs/architecture.md`](docs/architecture.md) for the complete feature-by-feature breakdown, the
`window.CList` namespace, the registry pattern used to add new services, and module load order.
Notable entries:

| Doc | Covers |
|---|---|
| [architecture.md](docs/architecture.md) | Full application and back-end-services overview |
| [adding-a-service.md](docs/adding-a-service.md) | How to register a new reader/publisher/saver/loader |
| [storage-model.md](docs/storage-model.md) | KVStore facade, PageStore, and the save/load capability-flag contract |
| [accounts-structure.md](docs/accounts-structure.md) | Account credential storage format |
| [identity-did.md](docs/identity-did.md) | The `did:web` identity layer |
| [publish_structure.md](docs/publish_structure.md) | Publish handler contract |
| [p2p-chat.md](docs/p2p-chat.md) | WebRTC chat topology and DID-signed messages |
| [error-handling.md](docs/error-handling.md) | Error/status display conventions |

## kvstore — Credential Storage Backend

Credentials (API tokens, passwords, etc.) are stored encrypted in a companion Flask app called
**kvstore**. The crypto is entirely client-side:

- `encKey = PBKDF2(password, username+"_enc", 100k iters)` — stays in the browser, never sent
- `authHash = PBKDF2(password, username+"_auth", 100k iters)` — sent to server on login
- Values are AES-GCM encrypted with `encKey` before transmission; server stores opaque ciphertext

The server never sees the raw password or the encryption key. kvstore also assembles a `did:web`
identity document per user — see [docs/identity-did.md](docs/identity-did.md) for the full model.

### Configuring the kvstore URL

In `index.html`, set `flaskSiteUrl` to your kvstore instance:

```html
<script>
    let flaskSiteUrl = 'https://kvstore.yourdomain.com';
</script>
```

### Deploying kvstore

kvstore is a Python/Flask app intended to run as a Docker container behind a reverse proxy such as
Caddy.

**Important — CORS:** Do not use `flask-cors` to handle CORS for this app. It fails to inject
headers into Flask's automatic OPTIONS responses for blueprint routes, causing browser preflight
requests to fail silently with `NetworkError`. Instead, handle CORS entirely in the proxy:

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

This pattern applies to any Flask API app in this stack (proxyp, discussions, collab) that needs
browser CORS support.

## Privacy

See [privacy.html](privacy.html) / [https://clist.mooc.ca/privacy.html](https://clist.mooc.ca/privacy.html)

## License

Copyright Stephen Downes 2025
Licensed under Creative Commons Attribution 4.0 International
https://creativecommons.org/licenses/by/4.0/
