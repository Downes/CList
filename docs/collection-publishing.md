# CList Collection Publishing

Collections can be published to external services as shareable URLs, in standard formats readable by other CList users or any RSS/OPML-aware tool.

---

## Workflow

1. User opens a collection in the read pane
2. Clicks **Edit & Publish** (new button in collection detail header)
3. A **Collection Editor** panel opens:
   - Editable item list (reorder, remove, edit titles)
   - Format selector: RSS / OPML / JSON / HTML / Markdown / Text
   - Publish-to selector (configured publishing accounts)
   - **Publish** button → returns a URL
4. URL is shown with copy button and optional "Share to chat" shortcut
5. Published entry saved to kvstore for later retrieval

---

## Pages

A published collection is a **page**: a file on a public server that anyone with the URL can read.
Pages are served with no login, so do not publish anything that must stay private. The publishing
account keeps a record of each page, and the **My Pages** view in the Load panel lists them.

---

## Step 1 — `pastebin.mooc.ca` service

Tiny Flask app, deployed as its own container behind the Caddy proxy.

| Endpoint | Auth | Description |
|---|---|---|
| `POST /` | Bearer token | Store content → `{id, url}` |
| `GET /{id}` | none | Serve content publicly |
| `PUT /{id}` | Bearer token | Update existing entry |
| `DELETE /{id}` | Bearer token | Remove entry |

Auth: kvstore JWT pattern (same as annotations, proxyp). SQLite backend.

---

## Step 2 — Publishing account types

Each publishing service has its own JS file, following the same pattern as social services
(`wordpress.js`, `mastodon.js`). Each file registers a schema in `window.CList.schemas` and
an adapter in `window.CList.binPublishers`.

All use permission flag **`b`** (bin/publish) so they appear in the publishing account selector.

| File | Type | kvKey | Credential | Notes |
|---|---|---|---|---|
| `js/jsonbin.js` | `JSONBin` | Label | API key (`X-Master-Key`) | `https://api.jsonbin.io/v3/b` |
| `js/gist.js` | `Gist` | Label | GitHub personal access token | `https://api.github.com/gists` |
| `js/0x0.js` | `0x0` | Label | — (anonymous) | `https://0x0.st` |
| `js/clistbin.js` | `CListBin` | Instance URL | Bearer token | Points to `pastebin.mooc.ca` or self-hosted |

### `window.CList.binPublishers` adapter interface

```js
window.CList.binPublishers['ServiceName'] = {
    publish: async (content, mimeType, title, accountData) → { url, serviceId },
    update:  async (serviceId, content, mimeType, accountData) → { url },
    delete:  async (serviceId, accountData) → void,
};
```

The **format** (JSON/OPML/HTML/RSS) and **content** are determined by the caller (collection editor,
write-pane publish action, etc.). The adapter handles only the HTTP transport.

`b` flag is documented in `docs/accounts-structure.md`.

---

## Step 3 — Collection editor panel

New panel rendered in the feed container, accessed from the collection detail
header via a new **Edit & Publish** (`edit` icon) button.

### UI
- Editable item list: each item shows title (editable inline) + drag handle + remove button
- **Format** selector: RSS / OPML / JSON / HTML / Markdown / Text
- **Publish to** selector: dropdown of `b`-flagged accounts from `window.CList.accounts`
- **Publish** button
- After publishing: URL field (readonly, copy button) + Share to chat button (if chat active)

### State
The editor works on a mutable copy of `col.items` — original collection in kvstore is not modified unless the user explicitly saves.

---

## Step 4 — Publisher adapters (per-service files)

Each service file (`jsonbin.js`, `gist.js`, `0x0.js`, `clistbin.js`) registers its own adapter
in `window.CList.binPublishers`. See Step 2 for the interface definition.

The collection editor calls the adapter for whichever `b`-flagged account the user selects.
Only the collection editor uses these adapters today. Publishing other write-pane documents as pages is planned but not implemented: the write-pane Publish button lists only `w`-flagged accounts.

### Output formats

| Format | MIME | Description |
|---|---|---|
| JSON | `application/json` | `{title, items:[{title,url,author,date,...}]}` |
| OPML | `text/x-opml` | `<opml>` with `<outline>` per item — RSS-reader compatible |
| HTML | `text/html` | Styled page with title, linked item list, CList branding |
| RSS | `application/rss+xml` | RSS feed of the collection's items |
| Markdown | `text/markdown` | Plain Markdown list of the collection's items |
| Text | `text/plain` | Plain text list of the collection's items |

---

## Step 5 — Published pages registry

Each published page stored in kvstore as:

```
key:   published:{uuid}
value: { title, url, format, service, publishedAt, sourceCollection, serviceId }
```

`serviceId` is the service's own ID for the entry (needed for update/delete on JSONBin and Gist).

### My Pages view

New entry in `window.CList.loaders` (appears in the Load panel):

- Lists all `published:*` kvstore entries
- Each row: title, format badge, service badge, URL (clickable), action buttons:
  - **Re-open in editor** — loads the published data back into the collection editor
  - **Copy URL**
  - **Delete** (calls the service's delete endpoint + removes kvstore entry)

---

## Step 6 — Import flow

Accept a published collection URL and import it as a local collection.

Entry points:
- Paste URL into a new "Import from URL" input in the Collections view
- Receive URL via chat share card (kind: `collection`, with a `publishedUrl` field)

Flow:
1. Fetch URL → detect format from `Content-Type` or URL extension
2. Parse JSON / OPML / HTML
3. Show a preview (title + item count)
4. User clicks **Save as collection** → saves to kvstore under a chosen name

---

## Files created / modified

| File | Change |
|---|---|
| Pastebin service | New app — Flask, SQLite, Docker ✓ |
| Caddy proxy config | Add `pastebin.mooc.ca` route ✓ |
| `js/jsonbin.js` | New — JSONBin schema + adapter ✓ |
| `js/gist.js` | New — Gist schema + adapter ✓ |
| `js/0x0.js` | New — 0x0.st schema + adapter ✓ |
| `js/clistbin.js` | New — CListBin schema + adapter ✓ |
| `js/collections.js` | Add Edit & Publish button, editor panel, import input, My Pages loader |
| `index.html` | Add bin publisher script tags ✓ |
| `flasker.html` | Add 4 types to picker + script tags ✓ |
| `docs/accounts-structure.md` | Add `b` flag, 4 schema rows ✓ |
| `CLAUDE.md` | Add pastebin.mooc.ca to services table ✓ |
