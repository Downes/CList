# CList Annotation System

## Overview

CList lets users attach annotations to any web page or feed item and read annotations left by the
people they follow. Annotations are stored on a server you control, identified by your
decentralized identity (DID), and federated across multiple servers through the DID document
system — no central host, no shared database.

The annotation server (`annotations.mooc.ca`) is a W3C Web Annotation store: it receives,
stores, and returns annotations in the standard JSON-LD format. The CList client (`annotate.js`)
handles everything else: authentication, rendering, federation, and social actions such as
following people and "flowing" (re-annotating) annotations you find interesting.

---

## Architecture

```
┌─────────────────────────────────────────────┐
│  CList browser client (annotate.js)         │
│                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │ inline   │  │  thread  │  │  batch   │  │
│  │  panel   │  │   view   │  │  check   │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  │
│       │              │             │         │
│       └──────────────┴─────────────┘         │
│                      │                       │
└──────────────────────┼───────────────────────┘
                       │ HTTPS (W3C Web Annotation API)
         ┌─────────────▼──────────────┐
         │  Annotation server         │
         │  FastAPI / SQLite          │
         │  annotations.mooc.ca       │
         └─────────────┬──────────────┘
                       │ Bearer token verification
         ┌─────────────▼──────────────┐
         │  kvstore (per user)        │
         │  kvstore.mooc.ca           │
         └────────────────────────────┘
```

**Server** (the annotations service repository) — FastAPI application, SQLite database, Docker container.

**Client** (`js/annotate.js`) — pure browser JavaScript; no build step.
Registers an `Annotate` account type in CList's account schema system.

---

## Data model

Annotations are stored in, and returned as, [W3C Web Annotations](https://www.w3.org/TR/annotation-model/).
Each annotation has:

| Field | Description |
|-------|-------------|
| `id` | Full URL of the annotation (`BASE_URL/annotations/{uuid}`) |
| `creator` | DID of the author (`did:web:kvstore.mooc.ca:users:alice`) |
| `target.source` | URL of the annotated page |
| `target.selector` | Optional structured metadata (title, author, feed, GUID, or text position) |
| `body.value` | Annotation text (Markdown or HTML; sanitized on display) |
| `body.format` | Always `text/markdown` |
| `motivation` | W3C motivation term (e.g. `commenting`, `flowing`, `highlighting`) |
| `tag` | Optional string array |
| `created` | ISO 8601 UTC timestamp |
| `modified` | ISO 8601 UTC timestamp (only if edited) |
| `visibility` | `public` or `private` |

The `target.selector` field carries whatever context the client wants to store. For inline
panel annotations it holds the selected text position; for publish-handler annotations it holds
the item's title, author, feed URL, GUID, and creation date.

Internally the database adds one extra field — `proof` — reserved for future cryptographic
signing. It is not currently populated.

---

## Authentication and authorisation

**Reading** is unauthenticated by default. The environment variable `REQUIRE_READ_TOKEN=1` locks
reads behind the same bearer-token check as writes.

**Writing** (POST, PUT, DELETE) requires a valid Bearer token. The server verifies every write
token by proxying it to `GET /auth/verify` on the configured kvstore instance
(`KVSTORE_URL`, default `https://kvstore.mooc.ca`). The kvstore returns `{"username": "...",
"did": "..."}` on success; the annotation server constructs the creator DID as
`did:web:{kvstore_domain}:users:{username}`.

A user must also be **registered** on the annotation server (`POST /api/register`) before they
can write. Registration records the username + DID in the local `users` table. Without this
step, write endpoints return `403 Not registered`.

Ownership checks — PUT and DELETE — compare `row["creator"]` against the verified DID. Only
the creator can edit or delete their own annotations.

---

## Visibility

Two levels only:

| Level | Meaning |
|-------|---------|
| `public` | Returned by server read endpoints; CList only shows these to the creator and their followers |
| `private` | Never returned by any public endpoint; effectively only the creator can ever retrieve it |

There is no `followers` tier. Implementing it correctly would require the server to query the
follower's private social graph, which violates the data ownership principle: the follow list
belongs to the follower, not to the annotation server. See `docs/identity-did.md` for the full
policy.

---

## Writing annotations

Annotations are written through the editor. `clistAnnotate()` or `openAnnotationEditor()`
captures the current feed item reference (including any selected text) into `_annotationTarget`
and opens the write pane. When the user clicks Publish, the `Annotate` publish handler:

1. Collects all loaded references (`editorDiv.references`), or falls back to `_annotationTarget`
2. Posts an annotation for each reference URL — "convergent annotation" if more than one
3. Sets `motivation: 'commenting'` and stores item metadata in `target_selector`

---

## Reading annotations

### Inline panel (`showAnnotations`)

When a logged-in user clicks the annotation button on a feed item, all configured Annotate
accounts are queried in parallel (`GET /annotations?target={url}&limit=50`) and the results
are merged and rendered in the panel.

### Thread view (`showAnnotationThread`)

The "read annotations" button (injected by the batch check when annotations exist) opens a
full-screen thread view:

1. Queries both local and federated annotation accounts (see Federation below)
2. Checks both `url` and `guid` for the item (some feed items have a separate GUID)
3. Deduplicates results by annotation `id`
4. Shows only annotations from yourself and people you follow
5. Replaces `#feed-container` contents with the thread (saves and restores the original content
   on close, including scroll position)
6. Supports browser back-button navigation (`history.pushState`)

Each annotation in the thread view renders the creator's username (from their DID), a link to
their DID profile page, the body (sanitized HTML), tags, and a date. For flowed annotations,
a "↩ via {username}" attribution is shown.

Action buttons on each annotation (for logged-in users who don't own the annotation):

- **Flow** — re-annotates the original target with `motivation: 'flowing'` and a `via` pointer
  to the originating DID and annotation ID
- **Follow** — stores an encrypted follow entry in kvstore (`social:following:{did}`)

---

## Federation

CList can discover annotation stores on other servers through DID documents. This is handled
by `_getFederatedAnnotationAccounts()`:

1. Fetches the user's encrypted kvstore entries and decrypts the `social:following:*` keys to
   get a list of followed DIDs
2. For each followed DID, fetches their DID document (`GET /users/{username}/did.json` on their
   kvstore instance)
3. Extracts any `AnnotationService` entries from `doc.service`
4. Returns these as additional virtual accounts, deduplicated against locally configured ones

The result is cached in-memory for 5 minutes (invalidated when a new follow is added).

`_allAnnotationAccounts()` combines local accounts and federated accounts. Both `showAnnotations`
and `showAnnotationThread` use it for reads; the batch check also uses it.

---

## Batch annotation check

After the feed renders, `checkAnnotationsBatch()` is called directly by the feed render code, once per render (`annotate.js`). It does not use a MutationObserver, which causes double runs (see feed-structure.md):

1. Collects all visible feed items that have a `reference.url`
2. Sends `POST /annotations/batch-check` to each annotation account with the full list of URLs
   (up to 500 per request)
3. Merges the counts (summing across multiple stores)
4. For each URL with at least one annotation, injects an `(N)` button into the item's action bar

The batch-check endpoint does not require authentication and only counts `public` annotations.
Rate-limited to 60 requests/minute per IP.

### Follow-author buttons

`checkAnnotationsBatch` also queries feed metadata via the opml2json `/feed_meta` endpoint for
each unique feed URL. If the feed advertises a `author_did` and the user is not already
following that DID, a "Follow" button is injected into the item's action bar.

---

## Server API reference

| Method | Path | Auth | Rate limit | Description |
|--------|------|------|------------|-------------|
| GET | `/health` | none | — | Returns `{"status":"ok"}` |
| POST | `/api/register` | Bearer | 10/hour | Register authenticated user |
| GET | `/.well-known/annotation-service` | none | — | Service discovery document |
| GET | `/annotations/feed` | none | — | Atom feed of public annotations |
| POST | `/annotations/batch-check` | none | 60/min | Count annotations for a list of URLs |
| GET | `/annotations/{id}` | optional | — | Fetch one public annotation (W3C JSON-LD) |
| GET | `/annotations` | optional | — | List public annotations (W3C AnnotationPage) |
| POST | `/annotations` | Bearer | 30/min | Create annotation |
| PUT | `/annotations/{id}` | Bearer | — | Update own annotation |
| DELETE | `/annotations/{id}` | Bearer | — | Delete own annotation |

Query parameters for `GET /annotations`:

| Parameter | Description |
|-----------|-------------|
| `target` | Filter by target URL (exact match) |
| `creator` | Filter by creator DID |
| `since` | Return annotations created or modified after this ISO 8601 timestamp |
| `limit` | Max results (1–200, default 50) |
| `offset` | Pagination offset |

---

## Input validation

All write requests are validated by Pydantic before hitting the database:

| Field | Constraint |
|-------|-----------|
| `target_url` | Must start with `http://` or `https://`; max 4096 characters |
| `body` | Max 50,000 characters |
| `tags` | Max 20 tags; each tag max 100 characters |
| `target_selector` | JSON-serialised size ≤ 4096 bytes |
| `visibility` | Must be `public` or `private` |
| `motivation` | Must be a W3C motivation term (bookmarking, classifying, commenting, describing, editing, flowing, highlighting, identifying, linking, moderating, questioning, replying, tagging) |
| `urls` (batch-check) | Max 500 URLs per request |

---

## Security notes

- Bearer tokens travel only in `Authorization: Bearer` headers — never in URL query strings,
  hash fragments, or link `href` attributes. See `SECURITY.md`.
- Annotation body HTML is passed through `sanitizeHtml()` (from `rss.js`) before rendering,
  which allowlists safe tags and strips scripts, event handlers, and `javascript:` URLs.
  Falls back to plain-text escaping (`_annoHe`) if `rss.js` is not loaded.
- The Atom feed endpoint skips the `<link>` element for any annotation whose `target_url` does
  not start with `http://` or `https://`.
- CORS is open (`allow_origins: ["*"]`) — intentional, as annotations are a public read
  protocol. Write endpoints are protected by the auth check regardless.

## Privacy: annotation servers learn which URLs you read

Every time CList checks for annotations on a feed item, it sends that item's URL to each
configured annotation server (both the native W3C server at `annotations.mooc.ca` and any
Hypothes.is instance). This means those servers — and their operators — learn which URLs you
are reading, and approximately when.

This is an inherent consequence of querying for per-URL annotations. The same issue applies to
DID document fetches: every time CList resolves a followed user's DID, a request is made to
that user's kvstore host, revealing the reader's IP address.

**Planned mitigation (not yet implemented):** a user-configurable annotation privacy level:

| Level | Behaviour |
|-------|-----------|
| **Open** | Query all configured annotation services for every item (current behaviour) |
| **Selective** | Exclude specific annotation servers from automatic queries |
| **On-demand** | Never query annotation servers automatically; only fetch when the user explicitly clicks the annotation count for a specific item |
| **Off** | Disable all annotation services entirely |

This is tracked as a future feature. See `docs/privacy.md` for the broader privacy model.

---

## Configuration

Server environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `/app/data/annotations.db` | SQLite path |
| `BASE_URL` | `https://annotations.mooc.ca` | Public base URL for annotation IDs |
| `KVSTORE_URL` | `https://kvstore.mooc.ca` | kvstore instance for token verification |
| `REQUIRE_READ_TOKEN` | (unset) | Set to `1`/`true`/`yes` to require auth for reads |

---

## Adding an annotation account in CList

1. Open **Account Settings** in CList
2. Choose account type **Annotate**
3. Set the **Store URL** to `https://annotations.mooc.ca` (or your own instance)
4. Set **Permissions** to `rw` (read+write) or `r` (read only)
5. Log in, then call `POST /api/register` once — the CList account settings panel does this
   automatically when the account is saved

Annotate accounts are intentionally hidden from the reader account selector; they appear only
in the annotation panel and thread view.
