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
| `POST /` | Bearer token | Store content → `{id, url}` (`url` is `{BASE_URL}/{username}/{id}`) |
| `GET /{id}` | none | Serve content publicly |
| `GET /{username}/{id}` | none | Same as above; `username` is cosmetic, not checked against the owner |
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
The write-pane **Post** panel also uses the `CListBin` adapter directly via its
**To Web Page** option (`js/publish.js`'s `postToWebPage()`), publishing the active
editor's raw content as-is rather than a collection export.

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

As actually implemented (not the originally-planned `published:{uuid}` key below):

- A published **collection** export is recorded inline on the collection itself:
  `collection:{name}` → `{ items, publishedUrls: [{ title, url, format, service,
  publishedAt, serviceId, accountInstance }] }`.
- A published **standalone page** (write-pane **Post → To Web Page**) is recorded
  as its own entry: `page:{uuid}` → `{ title, url, serviceId, service, mimeType,
  accountInstance, publishedAt }` (`js/publish.js`'s `postToWebPage()`).

`serviceId` is the service's own ID for the entry (needed for update/delete on JSONBin and Gist).

### My Pages view

Entry in `window.CList.loaders` (appears in the Load panel), implemented in
`js/collections.js`. In practice it stores published collections inline on the
`collection:*` record (`col.publishedUrls`, not a separate `published:*` key), and
also lists standalone pages published via the write-pane **Post → To Web Page**
action, stored as `page:*` kvstore entries (`js/publish.js`'s `postToWebPage()`).

Rendered as a wide modal titled **"Published pages"**, with its own header row
(`.modal-header-row` — `h2` + a single "X" close button, matching the app's
standard panel-header convention) rather than `showModal()`'s generic Close
button (`showModal(optionsDiv, { wide: true, hideDefaultClose: true })`).

- Lists all `collection:*` entries that have `publishedUrls`, plus all `page:*`
  entries, merged into one flat `pages` array (one row per published URL, not
  per collection/page record).
- Displayed as a `<table class="published-pages-table">` with columns, in this
  order: **Format**, **Date**, **Buttons**, **Title**. Format/Date/Title column
  headers are sortable — click to sort ascending, click again to reverse
  (▲/▼ indicator on the active column); the Buttons column is not sortable.
  Sorting re-orders the entire `pages` array, not just the rows currently
  visible on the page.
- **Pagination**: 40 rows per page by default, with a footer below the table
  showing `"{start}-{end} of {total}"`, a page-size `<select>` (20 / 40 / 100 /
  All), and Prev/Next buttons (disabled at the ends). Changing sort, page size,
  or page resets/re-slices from the full sorted array — all driven by a single
  `renderBody()` closure.
- Each row's **Buttons** cell:
  - **Load into editor** — pages: fetches the page's content and routes it into
    the right editor via `loadSavedPage()` (`js/editors.js`), per the
    New/Replace/Insert logic in `docs/editors_structure.md`. Collections: fetches
    the published export, parses it back into `{title, items}` with the format's
    parser (`_collectionFormatParsers` in `js/collections.js` — covers `rss`,
    `opml`, `json`, `html`), and opens it straight into the Collection Editor via
    `_activeCollection` + `initializeEditor('collection')`. Only shown when
    `page.format` has a parser — `md`/`text` are export-only (no parser), so those
    rows don't get this button. Either way, loading a row also calls
    `setLoadedPage(page)` so the editor shows the page's filename and the
    Republish button (see `docs/editors_structure.md`).
  - **Open** (new tab), **Copy URL**, **Delete** (calls the service's delete
    endpoint + removes the kvstore entry, then removes the row from the live
    `pages` array and re-renders) — both row kinds.

### Republish, and overwrite vs. new version at Post time

Once a page or collection has been loaded from My Pages (or just published),
`currentLoadedPage` (`js/editors.js`) tracks which published entry the editor's
content corresponds to, and the write-pane shows a filename indicator plus a
**Republish** button (`#republish-button`, `playRepublish()` in `js/publish.js`).

- **Republish** saves the current editor content directly to the page's
  existing published URL via the bin publisher's `update()` adapter method
  (`js/clistbin.js`) — no new kvstore entry, no second published URL. For
  collections this is `window.republishCollection()` (`js/collections.js`),
  which re-serializes `_draftItems` in the loaded page's original format and
  calls `update()` on the one destination the page was loaded from.
- Clicking **Post** on a standalone page that has a loaded page filename offers
  a choice instead of publishing immediately: **Overwrite** (same as
  Republish — updates the existing URL in place) or **Save as new version**
  (publishes a brand-new, independent entry; the old entry and its URL are left
  completely untouched — there is no formal version chain, just two unlinked
  entries). The same choice appears in the Collection Editor's Publish panel,
  but only applies to the single destination the collection was originally
  loaded from — any other destination selected in that Publish action is
  always a fresh `publish()`, exactly as before.

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
