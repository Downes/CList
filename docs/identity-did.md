# DID Identity System

## Overview

CList uses `did:web` as a user's canonical decentralized identity, hosted on their kvstore
instance. The DID document is public, links the user's social accounts as verifiable service
endpoints, and uses an Ed25519 keypair generated in the browser.

---

## Design decisions

**Canonical DID method: `did:web`** — hosted on the user's kvstore instance. Simpler to
implement than did:dht, no external infrastructure, and sufficient for self-hosted use. Unlike
`did:key`, the DID URL is stable across key rotations.

**Upgrade path: `did:dht`** — Mainline DHT (BEP44), portable and server-independent. Adding
did:dht support requires only a gateway addition; the key types and document format are already
compatible. No rewrite needed.

**Blend with `did:key`**: the DID document's `alsoKnownAs` field always includes the `did:key`
derived from the user's Ed25519 public key (prepended by the server). Systems that prefer
did:key can use this without any server dependency.

**Bluesky as `alsoKnownAs`**: Bluesky handles are added as `at://handle` entries in
`alsoKnownAs` rather than service endpoints, matching the AT Protocol convention.

---

## DID identifier format

`did:web:kvstore.mooc.ca:users:alice`

Resolves to: `https://kvstore.mooc.ca/users/alice/did.json`

Each kvstore instance hosts DID documents for its users. Multiple kvstore instances resolve
their own users independently.

**Username constraints:** usernames must match `[a-z0-9][a-z0-9._-]{2,31}` — enforced at
registration on both client and server. This ensures the username is safe in DID identifiers,
URL paths, and the filesystem (SQLite DB filename).

---

## Key types

Two distinct keys per user — separate concerns, separate algorithms:

| Key | Algorithm | Purpose |
|-----|-----------|---------|
| Identity key | Ed25519 | DID verification method; basis for did:key and did:dht |
| Auth key | EC P-256 | kvstore JWT signing — not exposed in DID document |

Ed25519 is chosen for the identity key because did:dht uses it natively (upgrade path
compatibility), and it is well-supported in WebCrypto and DID tooling.

The identity private key is generated in the browser via the WebCrypto API, encrypted with the
user's AES-GCM `encKey`, and stored as the system KV entry `_did_identity_key`. The server
never sees the private key.

---

## DID document structure

The server assembles the full document at serve time from the stored profile + `ISSUER_URL`.
Only the user-controlled parts are stored in the `did_document` column.

```json
{
  "@context": [
    "https://www.w3.org/ns/did/v1",
    "https://w3id.org/security/suites/jws-2020/v1"
  ],
  "id": "did:web:kvstore.mooc.ca:users:alice",
  "alsoKnownAs": [
    "did:key:z6Mk...",
    "at://alice.bsky.social"
  ],
  "verificationMethod": [{
    "id": "did:web:kvstore.mooc.ca:users:alice#key-1",
    "type": "JsonWebKey2020",
    "controller": "did:web:kvstore.mooc.ca:users:alice",
    "publicKeyJwk": { "kty": "OKP", "crv": "Ed25519", "x": "..." }
  }],
  "authentication": ["did:web:kvstore.mooc.ca:users:alice#key-1"],
  "assertionMethod": ["did:web:kvstore.mooc.ca:users:alice#key-1"],
  "service": [
    {
      "id": "did:web:kvstore.mooc.ca:users:alice#kvstore",
      "type": "KVStore",
      "serviceEndpoint": "https://kvstore.mooc.ca"
    },
    {
      "id": "did:web:kvstore.mooc.ca:users:alice#alice-mastodon-social",
      "type": "SocialWebAccount",
      "serviceEndpoint": "alice@mastodon.social"
    }
  ]
}
```

The `KVStore` service entry is always injected by the server. All other service entries come
from the user's stored profile (social accounts marked public in the Me panel).

---

## kvstore endpoints (live)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/users/<username>/did.json` | none | Returns DID document; 404 if not registered |
| `PUT` | `/auth/did` | Bearer | Register or update Ed25519 public key and service endpoints |
| `DELETE` | `/auth/did` | Bearer | Remove DID profile; document returns 404 |

Content-Type for `GET` is `application/did+ld+json` as required by the DID spec.

---

## CList Me panel

The Me panel (`me.html`, opened via the Me button in `#left-command`) provides:

- **DID status** — shows the current DID and did:key, with a link to the live document
- **Generate / Regenerate Key** — generates a new Ed25519 keypair in the browser, stores the
  encrypted private key in kvstore, and registers the public key with the server
- **Public Accounts** — checkboxes for Mastodon, Bluesky, WordPress, and Blogger accounts;
  "Update DID" saves the public flag to each account's encrypted entry and pushes the updated
  service list to the server. Only shown when a DID exists.
- **Remove DID** — deletes `_did_identity_key` and clears the server-side DID document.
  Requires an inline confirmation. Only shown when a DID exists.

---

## Key rotation

Because the canonical identity is `did:web` (not `did:key`), the DID URL is stable across key
rotations. Clicking "Regenerate Key" in the Me panel:

1. Generates a new Ed25519 keypair client-side
2. Overwrites `_did_identity_key` with the new encrypted private key
3. Fetches the existing DID document to preserve service endpoints and `alsoKnownAs` entries
4. PUTs the new public key to `/auth/did` — same DID URL, new verification method
5. Resolvers re-fetch the document and get the new key automatically (no caching in DID resolution)

---

## Portability between kvstore instances

Moving from `kvstore.mooc.ca` to `kvstore.downes.ca`:

1. Export the Ed25519 private key from the old kvstore (`_did_identity_key`, encrypted)
2. Register on the new kvstore instance, import the key
3. The new kvstore publishes the same DID document at the new did:web URL
4. Add the new did:web to `alsoKnownAs` on the old instance
5. Systems using `did:key` (derived from the same Ed25519 key) need no update

---

## did:dht upgrade path

did:dht identifiers are Ed25519-based. Since the identity key is already Ed25519, enabling
did:dht requires only:

1. A gateway component that publishes BEP44 mutable records to Mainline DHT
2. Adding `did:dht:...` to `alsoKnownAs` in the DID document

No client-side key changes, no document format changes.
