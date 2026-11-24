# CList

Developers and AI agents: shared JavaScript shapes are documented in
[js/clist-types.js](js/clist-types.js). See
[data contract maintenance](docs/data-contracts.md) before changing those shapes.

Publishing documentation:
[How CList publishes your work](docs/publish_structure.md), including the service
API reference, and [instructions for AI coding tools](docs/ai/publishing.md).

A personal learning and communications application — a browser-based tool for reading feeds,
annotating and composing responses, publishing to social platforms, and collaborating or chatting
with peers. The browser application is static HTML/CSS/JS, served by a web host or
through the Python desktop launcher. Optional desktop LocalRSS bundles also run a
local backend; the repository is not limited to static files. A live instance runs at
[clist.mooc.ca](https://clist.mooc.ca); anyone can host their own copy or run it from disk.

Features include calendar browsing and ICS subscriptions, an Event editor, a dedicated
gRSShopper Post editor, feed reading, in-place annotation, multi-platform publishing (Mastodon, Bluesky,
WordPress, Blogger, and more), local and cloud-backed save/load (including Dropbox), AI-assisted
writing, real-time collaborative editing (rich text and native LaTeX, with PDF compilation and a
shared bibliography), peer-to-peer chat, and a portable `did:web` identity tied to a user's own
kvstore instance. See [docs/architecture.md](docs/architecture.md) for how these fit together.

## Download

Pre-built desktop binaries for Windows, macOS, and Linux are available on the
[Releases page](https://github.com/Downes/CList/releases). A new release is built and published
by a workflow triggered on pushes to `main` (see [`.github/workflows/build.yml`](.github/workflows/build.yml)).
A release depends on successful builds; check its commit/tag rather than assuming
it contains every change currently on `main`.

| Platform | File |
|----------|------|
| Windows  | `CList.exe` |
| macOS    | `CList-macos` |
| Linux    | `CList-linux` |

## Architecture

The CList browser application uses client-side HTML/JS. Its pages are static files
served by a web server (Caddy, nginx, etc.) or the desktop launcher. Opening files
directly has feature restrictions, including OAuth. Optional LocalRSS desktop
bundles include a local backend. Optional back-end services provide the pieces a static
page can't do on its own:

| Service | Purpose | Repository |
|---|---|---|
| **kvstore** (self-hosted Flask API) | Encrypted credential storage and `did:web` identity | [github.com/Downes/kvstore](https://github.com/Downes/kvstore) |
| **proxyp** (self-hosted Perl/PSGI) | Cross-domain proxy for APIs that don't support CORS | [github.com/Downes/proxyp](https://github.com/Downes/proxyp) |
| **discussions** (self-hosted Flask API) | Peer discovery/signaling for P2P chat | [github.com/Downes/Discussions](https://github.com/Downes/Discussions) |
| **collab** (self-hosted Node/Hocuspocus) | Real-time collaborative editing (rich text and LaTeX) | [github.com/Downes/collab](https://github.com/Downes/collab) |
| **latex_compile** (self-hosted Flask API) | LaTeX source → PDF compilation (tectonic), for the native LaTeX editor | [github.com/Downes/latex_compile](https://github.com/Downes/latex_compile) |
| **opml2json** (self-hosted Flask API) | OPML parsing and feed aggregation | [github.com/Downes/opml2json](https://github.com/Downes/opml2json) |
| **localrss_reader** (self-hosted Flask API) | Public and personal RSS feed collections; local-first reader resolution and shared collection editing — see [docs/deployment-configurations.md](docs/deployment-configurations.md) | [github.com/Downes/localrss_reader](https://github.com/Downes/localrss_reader) |
| Social platform APIs (Mastodon, Bluesky, WordPress, Blogger, Dropbox, etc.) | Read/write/save | — |

None of these are required to use the core reading, writing, and publishing features — each is
swappable, and a user can point CList at their own instance of any of them, or at none at all.

## Deployment Configurations

CList's files (hosted web, local desktop app, or `file://`) and its data (local browser storage,
or a remote/local service) are independent choices — combining them gives six configurations.
See [docs/deployment-configurations.md](docs/deployment-configurations.md) for the full matrix,
the current LocalRSS integration, authentication limits, and deployment constraints.

**Full documentation lives in [`docs/`](docs)** — start with
[`docs/architecture.md`](docs/architecture.md) for the complete feature-by-feature breakdown, the
`window.CList` namespace, the registry pattern used to add new services, and module load order.
Notable entries:

| Doc | Covers |
|---|---|
| [architecture.md](docs/architecture.md) | Full application and back-end-services overview |
| [deployment-configurations.md](docs/deployment-configurations.md) | The six files×data configurations, what works today, and what's planned |
| [adding-a-service.md](docs/adding-a-service.md) | How to register a new reader/publisher/saver/loader |
| [storage-model.md](docs/storage-model.md) | KVStore facade, PageStore, and the save/load capability-flag contract |
| [accounts-structure.md](docs/accounts-structure.md) | Account credential storage format |
| [identity-did.md](docs/identity-did.md) | The `did:web` identity layer |
| [testing.md](docs/testing.md) | Human guide to automated, browser, manual and live-service checks |
| [publish_structure.md](docs/publish_structure.md) | Platform publisher requests, results, progress, and compatibility |
| [collection-publishing.md](docs/collection-publishing.md) | Collection editing, feed save capabilities, bin publication, and state boundaries |
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

### LocalRSS desktop bundle checks

The optional `-WithLocalRSS` / `--with-localrss` build scripts install
`requirements-localrss.txt`, verify all backend dependencies (including aiohttp),
collect their package resources, and run the resulting executable with
`--check-localrss`. A missing dependency fails the build. Released bundled
executables do not require users to install Python packages.

Running `python launcher.py` directly uses your own Python environment. For that
source-launch workflow, install the complete backend requirements once with
`python -m pip install -r requirements-localrss.txt`; installing only aiohttp may
leave other dependencies missing. Source startup reports that command if backend
loading fails. Build dependencies are installed automatically by bundle scripts.
