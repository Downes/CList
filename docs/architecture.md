# CList Architecture

CList is a personal learning and communications application: a browser-based tool for reading feeds, writing content, publishing to social platforms, and chatting with peers. It has **no server-side logic of its own** — all files are static HTML/CSS/JS that can be served from any web host, or run directly as a local desktop application. The instance at `clist.mooc.ca` is one deployment; any user can host their own copy at any URL, or run it offline.

Every feature that requires a back end delegates to one of the purpose-built services described below.

---

## Decentralized design

CList is designed so that **no single server is required and no single operator controls the system**.

**CList itself is per-user.** Each person runs their own instance — a static copy of the HTML/CSS/JS files — hosted wherever they choose: a personal website, a shared server, or a local folder on their desktop. Users pick their own combination of features and service connections; there is no canonical CList server that all users must pass through.

**The supporting services are federated.** kvstore, collab, discussions, and proxyp are each designed to run as multiple independent instances operated by different people. A user connects their CList to whichever instance they trust or host themselves — for example, `kvstore.mooc.ca` or their own `kvstore.downes.ca`. CList holds the URL of each service it uses as a user-configurable setting, not a hardcoded constant.

**There are no required bottlenecks.** Feed reading, writing, and publishing to social platforms all work without any of the optional services. The services that do exist (kvstore for credentials, collab for shared editing, discussions for peer discovery) are swappable: a user can point their CList at a different instance of any service, or run their own. The goal is a system that remains free and accessible even if any individual server goes offline or changes its terms.

---

## Two-pane layout

The interface is split horizontally between a **read pane** (left) and a **write pane** (right). Each pane has a matching **options pane** that slides in from the edge of the screen. A floating `#statusPane` at the bottom shows transient feedback.

The left pane holds the feed reader and (optionally) the P2P chat or audio section. The right pane holds the active editor. Both panes have command bars, account lists, and pre-declared panels that are shown/hidden on demand.

See `ui_components.md` for the full div tree, CSS classes, and JS helpers for building panels and lists.

---

## Features

### Feed reading

The **Read** button opens an account list. Selecting a read-enabled account calls the service's reader handler, which offers one or more feed views (Timeline, Bookmarks, Search, etc.) as buttons in `#feed-menu`. Feed items are rendered into `#feed-container`.

Services register reader handlers via `window.readerHandlers`. See `feed-structure.md` for DOM conventions and `adding-a-service.md` for the registration API.

### Writing and editing

The write pane hosts a pluggable set of editors. Active editors are registered in `window.editorHandlers`, each providing `initialize`, `getContent`, `loadContent`, `setFocus`, `draftKey`, and optional `destroy` methods. The editor chooser (right pane) switches between editors while preserving draft content. Auto-save writes draft content to localStorage on each change.

See `editors_structure.md` for the full contract, the `pendingContent` hand-off flow, and how load and save handlers interact with the editor.

### Publishing

The **Post** button opens an account list of write-enabled accounts. Clicking **Publish** calls `postAll()` in `publish.js`, which:

1. Collects the title and editor content as HTML.
2. Sorts selected accounts by `maxlength` (unlimited first).
3. For each account, optionally calls `handler.construct()` to build the measured text, checks the character limit, then calls `handler.publish()` — passing a URL returned by an earlier account to short-form accounts.

Services register publish handlers via `window.publishHandlers`. Built-in targets: Mastodon, Bluesky, WordPress, Blogger.

See `publish_structure.md` for the full contract, `construct()`, the `accountData` shape, and the URL-referencing behaviour. See `adding-a-service.md` for the broader registry pattern.

### Saving and loading

The **Save** and **Load** buttons open lists built from `window.saveHandlers` and `window.loadHandlers` — plain arrays of `{ label, icon, save/load }` objects. Any service can push a saver or loader without a named registry key. Load handlers return `{ type: 'text/html'|'text/plain', value }` or `null`; the editor's `loadContent()` handles format conversion.

### P2P chat

The **Chat** button opens a peer discovery list populated from `discussions.mooc.ca`. Selecting a discussion connects via PeerJS/WebRTC. CList users form a full mesh with each other; `chat.html` users connect to one CList user who relays messages to the rest.

Chat messages can be signed with the user's Ed25519 identity key and verified against their DID document. Message deduplication (a `processedMsgIds` Set) prevents relay loops.

See `p2p-chat.md` for the full WebRTC lifecycle, hub-and-spoke topology explanation, DID signing, and relay logic.

### Decentralized identity (DID)

Each user can generate an Ed25519 identity key in the browser. The private key is encrypted with their AES-GCM `encKey` and stored as the `_did_identity_key` system KV entry in kvstore — the server never sees it. The public key is registered at `/auth/did` and assembled by kvstore into a `did:web` document at `https://kvstore.mooc.ca/users/{username}/did.json`.

The DID document links the user's social accounts as verifiable service endpoints and includes a `did:key` alias in `alsoKnownAs` for systems that prefer it.

See `identity-did.md` for the full document structure, key rotation, portability between kvstore instances, and the did:dht upgrade path.

### Collaborative editing

The **Collab** editor connects to `collab.mooc.ca` via a Hocuspocus WebSocket. Multiple users editing the same document ID are synchronized in real time via Yjs CRDTs. Documents are namespaced `{username}/{slug}`; the namespace owner creates, anyone may join. Presence (who is currently editing) is shown via the Yjs awareness protocol.

Documents can be shared as read-only or editable links at `collab.mooc.ca/doc/{id}/read` or `/edit`.

See `project_collab.md` in the memory directory for integration status, and the collab app's `CLAUDE.md` for the server API and database schema.

### AI features

`chatgpt.js`, `summarize.js`, and `translate.js` provide AI-powered writing assistance. These call external AI APIs directly from the browser, with credentials stored in kvstore like any other account.

---

## Back-end services

CList is client-side only. The services below provide the infrastructure it relies on.

### kvstore — credential store and identity provider

**Domain:** `kvstore.mooc.ca` | **Stack:** Python/Flask | **Container:** `kvstore:5000`

Stores per-user encrypted KV entries. The server holds only ciphertext; encryption and decryption happen in the browser using a key derived from the user's password (PBKDF2 + AES-GCM). The server never sees the password or the encryption key.

On login, kvstore issues a signed **ES256 JWT** (30-day expiry). Remote services verify the JWT locally by fetching the JWKS endpoint (`/.well-known/jwks.json`) — no callback to kvstore needed at request time.

kvstore also hosts DID documents (`/users/{username}/did.json`) assembled from stored public keys and social account metadata.

See `identity-did.md` for the DID layer and `accounts-structure.md` for how CList reads and writes account credentials.

### proxyp — cross-domain proxy

**Domain:** `proxyp.mooc.ca` | **Stack:** Perl/PSGI | **Container:** `proxyp:8081`

Forwards GET and POST requests from the browser to external APIs, adding CORS headers on the response. This allows CList to reach services that do not support CORS directly. Accepts only `http(s)` URLs with a proper hostname — no bare IPs, no localhost.

### discussions — peer discovery and signaling

**Domain:** `discussions.mooc.ca` | **Stack:** Python/Flask | **Container:** `discussions:8082`

A bulletin board for P2P chat. CList users POST their PeerJS peer ID and a discussion name; other users GET the list to find active discussions. Entries expire after 5 minutes without a heartbeat; the CList client re-POSTs every 60 seconds. Auth via kvstore JWT.

No chat content passes through this server — it is only used to exchange peer IDs before WebRTC connections are established.

### collab — collaborative editing server

**Domain:** `collab.mooc.ca` | **Stack:** Node.js 20 / Hocuspocus v2 / Yjs | **Container:** `collab:3003`

Real-time collaborative editing over WebSocket. Hocuspocus handles Yjs CRDT sync; SQLite persists document state between sessions. Documents without an owner can permit anonymous (read-only) access. Auth via kvstore JWT passed in the WebSocket token.

See `/srv/apps/collab/CLAUDE.md` for the REST API, document ID conventions, and the database schema.

### opml2json — feed aggregation

**Domain:** `opml2json.downes.ca` | **Stack:** Python/Flask | **Container:** `opml2json-opml2json-1:8000`

Converts OPML subscription lists to JSON and aggregates RSS feeds on request. Used by CList's feed reader to parse OPML files and retrieve feed content.

---

## Account system

All credentials are stored in kvstore as AES-GCM encrypted blobs. At runtime, CList decrypts them into an in-memory `accounts` array. Each entry has a `type` field that routes it to the correct service handler.

The Accounts panel is driven by `window.accountSchemas` — one entry per service type, defining the form fields and their labels, input types, and defaults.

See `accounts-structure.md` for the full storage format, `parseAccountValue()`, and the conventions for the `permissions` and `maxlength` fields.

---

## Registry pattern

Services are wired in at load time by populating four global registries and one schema map:

| Registry | Purpose |
|---|---|
| `window.accountSchemas` | Drives the Accounts panel form |
| `window.publishHandlers` | Called by `postAll()` to send content to a platform |
| `window.readerHandlers` | Called by Read to initialize a session and offer feed views |
| `window.saveHandlers` | Array of save destinations shown in the Save pane |
| `window.loadHandlers` | Array of load sources shown in the Load pane |

Each service lives in one file (`js/myservice.js`), loaded via `index.html` before `interface.js`. Registrations are wrapped in IIFEs to avoid polluting the global scope.

See `adding-a-service.md` for the full pattern and `publish_structure.md` for the publish handler contract.

---

## Error handling

All user-visible errors go through two helpers in `utilities.js`:

- **`showServiceError(container, title, message, actionHtml?)`** — persistent red banner for hard failures (feed loads, API errors, missing credentials).
- **`showStatusMessage(text)`** — transient message in `#statusPane`, auto-hides after 3 seconds. For action feedback, validation, and background results.

`alert()`, `confirm()`, and `prompt()` are never used. `innerHTML` is never set with peer-supplied or server-supplied data.

See `error-handling.md` for the full rules, context-specific guidance (P2P chat, standalone pages), and the CSS classes for error display.

---

## JS module load order

Scripts are loaded via `index.html`. `interface.js` depends on all others and must be the last script loaded (no `defer`). All other scripts use `defer`. Service scripts go in the appropriate group before `interface.js`.

Global variables (`username`, `flaskSiteUrl`, `accounts`, `BaseURL`, `accessCode`) are declared in `index.html` `<head>` and read across modules.
