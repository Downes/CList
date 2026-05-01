# Identity and DID Architecture

## Decision record

**Canonical DID method: `did:web`** — hosted on the user's kvstore instance.
Simpler to implement, no external infrastructure, and sufficient for self-hosted use.

**Upgrade path: `did:dht`** — Mainline DHT (BEP44), portable and updateable without a server.
Adding did:dht support later requires only a gateway addition; the key types and document
format are compatible. No rewrite needed.

**Blend with `did:key`**: the DID document's `alsoKnownAs` field includes the `did:key`
derived from the user's Ed25519 public key. Systems that prefer did:key can compute it
from the published public key without any server.

## DID identifier format

`did:web:kvstore.mooc.ca:users:alice`

Resolves to: `https://kvstore.mooc.ca/users/alice/did.json`

Each kvstore instance hosts DID documents for its users. Multiple kvstore instances
(kvstore.mooc.ca, kvstore.downes.ca, etc.) each resolve their own users independently.

## Key types

Two distinct keys per user — separate concerns, separate algorithms:

| Key | Algorithm | Purpose |
|-----|-----------|---------|
| Identity key | Ed25519 | DID verification method; basis for did:key and did:dht |
| Auth key | EC P-256 | kvstore JWT signing (existing) — not exposed in DID document |

Ed25519 is chosen for the identity key because:
- did:dht uses Ed25519 natively (upgrade path compatibility)
- did:key encoding for Ed25519 is well-specified (`did:key:z6Mk...`)
- Widely supported in WebCrypto and DID tooling

## DID document structure

```json
{
  "@context": ["https://www.w3.org/ns/did/v1"],
  "id": "did:web:kvstore.mooc.ca:users:alice",
  "alsoKnownAs": ["did:key:z6Mk..."],
  "verificationMethod": [{
    "id": "did:web:kvstore.mooc.ca:users:alice#key-1",
    "type": "JsonWebKey2020",
    "controller": "did:web:kvstore.mooc.ca:users:alice",
    "publicKeyJwk": { "kty": "OKP", "crv": "Ed25519", "x": "..." }
  }],
  "authentication": ["did:web:kvstore.mooc.ca:users:alice#key-1"],
  "service": [
    {
      "id": "did:web:kvstore.mooc.ca:users:alice#kvstore",
      "type": "KVStore",
      "serviceEndpoint": "https://kvstore.mooc.ca"
    }
  ]
}
```

## Portability between kvstore instances

Moving from `kvstore.mooc.ca` to `kvstore.downes.ca`:

1. Export Ed25519 private key from old kvstore (it's a KV entry, encrypted)
2. Register on new kvstore instance, import the key
3. New kvstore publishes the same DID document at the new did:web URL
4. Update old kvstore's DID document: add new did:web to `alsoKnownAs`
5. Systems using `did:key` (derived from the same Ed25519 key) need no update

## Key rotation and recovery

Because the canonical identity is `did:web` (not `did:key`), the DID document can be
updated to use a new verification key. If the Ed25519 private key is compromised:

1. Generate a new Ed25519 key pair client-side
2. PUT to `/auth/did` with the new public key
3. kvstore updates the DID document — same DID, new key
4. Old `did:key` (derived from compromised key) is abandoned; update `alsoKnownAs`

## did:dht upgrade path

did:dht identifiers are also derived from Ed25519 keys. Since we already use Ed25519
for the identity key, enabling did:dht requires only:

1. A gateway component that publishes BEP44 mutable records to Mainline DHT
2. Adding `did:dht:...` to `alsoKnownAs` in the DID document

No client-side key changes, no document format changes.

## kvstore endpoints (to be implemented)

- `GET /users/<username>/did.json` — public, returns DID document (404 if not registered)
- `PUT /auth/did` — authenticated, registers/updates the user's Ed25519 public key and service endpoints
