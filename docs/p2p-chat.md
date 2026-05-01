# P2P Chat — How It Works

## Overview

CList's chat is peer-to-peer WebRTC, brokered by two external pieces:

- **PeerJS** — library + cloud signaling server (`0.peerjs.com`) that hands each browser a random UUID peer ID and brokers the ICE negotiation to punch through NAT.
- **discussions.mooc.ca** — a lightweight Flask bulletin board that stores `{name, peerId, timestamp}` per active discussion so peers can find each other. Auth via kvstore token.

Once two peers connect, all messages travel directly between browsers. discussions.mooc.ca is only used for discovery and keepalive.

---

## Globals

```javascript
const API_URL = 'https://discussions.mooc.ca/api/discussions'; // module-level constant
let p2pInitialized = false;   // set true on first playChat(); guards one-time setup
let heartbeatInterval;        // setInterval ID for the keepalive loop
let peer, connections, knownPeers, processedPeerLists, usernames;
let activeDiscussionName = null;
let myUsername = '';

// DID identity — null if user has no DID
let myDid          = null;  // did:web URL
let myDidKey       = null;  // did:key string
let myPublicKeyJwk = null;  // Ed25519 public key JWK (sent to peers)
let myIdentityKey  = null;  // Ed25519 CryptoKey (private; used to sign messages)
let peerDids          = {}; // peerId → did:key
let peerPublicKeyJwks = {}; // peerId → publicKeyJwk (used to verify signatures)
```

---

## Lifecycle

### 1. Initialization (`playChat()`)

Called when the user clicks the Chat button. Idempotent: the `p2pInitialized` flag ensures setup runs only once per page load. Subsequent calls only re-show the chat section and refresh the username.

1. Makes `#chat-section` visible (`display: 'block'`), calls `openLeftPane()`.
2. If `!p2pInitialized`:
   - Calls `initializeP2PSystem()`, which creates `new Peer()` and initializes `connections {}`, `knownPeers Set`, `processedPeerLists Set`, `usernames {}`, and DOM element references.
   - Reveals `#chatButton` in the left-pane command bar.
   - Calls `initializeDid()` (fire-and-forget with `.catch()`).
   - Attaches Send button + Enter key listener via shared `_doSend` helper.
   - Attaches manual Connect button listener.
   - Registers PeerJS handlers:
     - `peer.on('open')` — displays peer ID, adds self to `knownPeers`, sets username.
     - `peer.on('connection')` — handles inbound connections (see §3).
     - `peer.on('error')` — dispatches on `err.type` (see §3).
   - Sets `p2pInitialized = true`.
3. Reads username from kvstore cookie; calls `setUsername()`.

---

### 2. Discovery

**Creating a discussion:**
1. User types a name and clicks Create → `advertiseDiscussion()`.
2. Guards: checks `peer.id` is available and name is non-empty.
3. POSTs `{name, peerId}` to `API_URL`.
4. On success: logs the name, sets `activeDiscussionName`, starts heartbeat (§5), toggles UI.

**Joining a discussion:**
1. User clicks Join → `refreshDiscussions()`.
2. GETs `API_URL` with Bearer token.
3. On 401: shows "Please log in" message in the discussion list.
4. On network error: shows "Could not load discussions" message.
5. Renders a button per active discussion; clicking → `connectToPeer(peerId, discussionName)`.

---

### 3. Connection Establishment

Two paths — outbound (you join) and inbound (someone joins you).

**Outbound — `connectToPeer(peerId, discussionName)`:**

1. Guard: if already connected to that peer, returns immediately.
2. If `discussionName` provided, logs "Joining: \<name\>" and sets `activeDiscussionName`.
3. Calls `peer.connect(peerId)`. Stores connection in `connections[peerId]` immediately.
4. `conn.on('open')`:
   - Adds peer to `knownPeers`, sets username to "Anonymous" pending update.
   - Sends `username-update` (with DID fields if available).
   - Sends `request-username` to pull the remote peer's username.
   - Toggles UI (hides Create/Join div, shows Leave div).
   - Starts heartbeat.
   - Calls `propagatePeerList()`.
5. `conn.on('data')` — handles incoming messages (see §4).
6. `conn.on('close')` — removes peer from all maps, calls `propagatePeerList()`.
7. `conn.on('error')` — logs error, shows user-facing message.

**Inbound — `peer.on('connection', conn)`:**

1. Stores connection in `connections[conn.peer]`, sets username to "Anonymous".
2. `conn.on('open')` — waits for data channel to be ready, then sends `username-update` and calls `propagatePeerList(conn.peer)`. (Sending before open would silently drop the message.)
3. `conn.on('data')`, `conn.on('close')`, `conn.on('error')` — same as outbound.

**PeerJS error handling — `peer.on('error', err)`:**

| `err.type`            | Response                                           |
|-----------------------|----------------------------------------------------|
| `disconnected`        | Logs message, calls `peer.reconnect()`             |
| `peer-unavailable`    | Logs "peer no longer available"                    |
| `browser-incompatible`| `showStatusMessage()` with browser upgrade advice  |
| anything else         | Logs `(err.type): err.message`                     |

---

### 4. Message Flow

**Sending:**
1. User clicks Send or presses Enter (Shift+Enter is a no-op, for future multi-line use).
2. `_doSend` helper: trims input, clears field, calls `sendMessage(message)` with `.catch()`.
3. `sendMessage(message)`:
   - Sanitizes and displays locally (right-aligned).
   - Calls `signMessage()` — returns a base64url Ed25519 signature, or `null` if no identity key.
   - Sends `{type: 'message', message, did: myDidKey, signature}` to all open connections.

**Receiving:**
1. `data.type === 'message'`:
   - Looks up sender username.
   - Sanitizes message; runs through `chatOptions()` (Etherpad link detection).
   - If `data.signature` is present: calls `verifySignature()`.
     - `true` → appends ` ✓` to sender label.
     - `false` → logs console warning, appends ` ⚠` to sender label.
     - `null` → no mark (no public key stored for that peer yet).
   - Appends `sender[mark]: message` to `#chat-messages`.
2. `data.type === 'username-update'`:
   - Stores username, `did:key`, and `publicKeyJwk` for the peer.
   - Checks `didWeb` username segment vs claimed username; logs console warning on mismatch.
   - Appends "X has joined" (with "(DID)" label if DID present).
3. `data.type === 'request-username'`: replies immediately with own `username-update`.
4. `data.type === 'peer-list'`: deduplicates by message ID, connects to unknown peers, re-propagates.

**Peer mesh topology:**
Every peer connects to every other peer (full mesh). `propagatePeerList()` broadcasts the current known-peer set, deduplicated by a `Date.now()`-based message ID stored in `processedPeerLists`. The Set is cleared when it exceeds 500 entries. When a new peer joins A, A shares all known peers; the new peer then dials each one directly. Scales to ~8–10 peers comfortably.

---

### 5. Keepalive (Heartbeat)

`startHeartbeat()` runs every 60 seconds, re-POSTing `{name, peerId}` to discussions.mooc.ca. The server updates the timestamp; discussions expire after 5 minutes without a heartbeat.

On 401 response: logs a warning, calls `showStatusMessage()` asking the user to log in again, and stops the heartbeat (to avoid repeated 401 noise).

Note: the server only stores the *first* entry per discussion name (finds by name, updates timestamp only). Joiners are only discoverable via peer list propagation, not via discussions.mooc.ca directly.

---

### 6. Ending a Discussion

`endDiscussion()`:
1. DELETEs from discussions.mooc.ca by name (no ownership check — any authenticated user can delete any discussion by name).
2. Stops heartbeat.
3. Closes all open connections (each triggers `conn.on('close')`).
4. Clears state **in-place**: `Object.keys(connections).forEach(k => delete connections[k])` and same for `usernames`, `peerDids`. `knownPeers.clear()`. (Globals are never reassigned, so pending `close` handlers still reference the correct objects.)
5. Clears `activeDiscussionName`, toggles UI, refreshes discussion list.

---

### 7. DID Identity

#### Layer 1 — Identity broadcast (live)

`initializeDid()` fetches `${flaskSiteUrl}/users/${user}/did.json`. On success:
- `myDid` — full `did:web` URL (e.g. `did:web:kvstore.mooc.ca:users:alice`)
- `myDidKey` — `did:key` string derived from the Ed25519 public key
- `myPublicKeyJwk` — Ed25519 public key in JWK format
- `myIdentityKey` — Ed25519 `CryptoKey` (private), decrypted from `_did_identity_key` in kvstore via `loadIdentityKey()` → `decryptIdentityPrivateKey()`

All four are included in every `username-update` message. Receiving peers store `did:key` in `peerDids` and `publicKeyJwk` in `peerPublicKeyJwks` for later verification. If the user has no DID, all globals stay null and chat works normally.

#### Layer 2 — Message signing (live)

Every outgoing message is signed with `signMessage(message)`:
- Uses `crypto.subtle.sign('Ed25519', myIdentityKey, msgBytes)`.
- Encodes signature as base64url.
- Returns `null` if `myIdentityKey` is null.

Every incoming signed message is verified with `verifySignature(message, signature, peerId)`:
- Imports the peer's stored `publicKeyJwk` via `crypto.subtle.importKey`.
- Returns `true` (valid), `false` (invalid), or `null` (no key available).
- `false` result is shown to the user with a ⚠ warning — invalid signatures are visible but not rejected, as the infrastructure for trust decisions is not yet built.

#### Identity cross-check

On receiving `username-update`, the last segment of `didWeb` is compared to the claimed `username`. A mismatch logs a console warning. This is a heuristic check only — the cryptographic proof is the signature on messages, not the username match.

---

## Open Design Issues

**1. Discovery server only stores creator's peer ID**

When a new user checks the discussion list, they get the *creator's* peer ID. If the creator has left (but others kept it alive via heartbeat), the new user can't connect via discovery — only via the peer mesh. Options: store all peer IDs per discussion; have each peer advertise separately; or document the limitation.

**2. PeerJS cloud signaling is a third-party dependency**

`0.peerjs.com` is outside our control. Consider running a self-hosted PeerJS server (small Node app) as a fallback.

**3. No reconnection logic for dropped connections**

If a connection drops (network hiccup), the peer is removed from the mesh. The user must manually rejoin.

**4. Full mesh does not scale past ~10 peers**

Each peer connects directly to every other peer. Past 8–10, this becomes heavy. A hub-and-spoke or SFU model would be needed for larger groups.

**5. User-selectable discussions server (federation)**

`API_URL` is a module-level constant. For federation, users should be able to choose their discussions server (stored in kvstore). The constant is marked with a TODO comment.

**6. No ownership on `endDiscussion()`**

Any authenticated user can DELETE any discussion by name. Server-side ownership tracking would prevent accidental or malicious termination.
