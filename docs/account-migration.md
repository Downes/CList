# Planned: Moving Data Between Account Servers

**Status: planned, not implemented.** This document describes the goal of moving a user's CList
data from one account server (kvstore instance) to another, including the DID identity. It is
planned future work and is not scheduled for the current release.

---

## Goal

A user can move their accounts, identity, and follow relationships from one kvstore instance to
another, including one they host themselves, without losing their identity or breaking the
people who follow them.

---

## What the code already supports

- **Account entries are self-contained ciphertext.** Each value is `[salt(16) | iv(12) | ciphertext]`,
  encrypted with AES-GCM under a key from PBKDF2-HMAC-SHA256 (100,000 iterations) over the
  passphrase. No server secret is involved, so an entry copied to another kvstore decrypts there
  with the same passphrase. See `crypto_utils.js`.
- **The identity private key is stored the same way.** `_did_identity_key` is an encrypted KV entry
  (see [identity-did.md](identity-did.md)), so it can move with the accounts.
- **`did:key` is server-independent.** It is derived from the Ed25519 public key, so the same key
  gives the same `did:key` on any server.
- **`did:web` is host-bound.** `did:web:kvstore.mooc.ca:users:alice` cannot be re-hosted under a
  different domain. Moving an account therefore creates a new `did:web` identifier.
- **The DID profile accepts free-form `alsoKnownAs` strings** (`PUT /auth/did`). The server
  currently prepends the `did:key` and passes the rest through.
