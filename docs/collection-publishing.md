# CList collections, subscription saving, and publication

Verified against the current client and bundled LocalRSS code, 2026-11-13.
This is the implemented integration contract; it does not assert that every
remote service instance has the same deployed version or CORS settings.

## Collection types and navigation

For registered users, **Read** lists accounts, then **Annotations** when available,
then **Collections**. The Collections view combines saved `collection:*` records
with account-backed collections discovered through a registered reader's
`editCollection` operation. PublicFeed and LOCALRSS implement that capability.
A registered user needs no separate reader account to access saved collections.

A saved collection's title opens its contents in the read pane. A feed collection's
title uses normal reader dispatch to read its posts. Each row's **Edit collection**
action reveals the write pane and opens the existing Collections editor. Empty
collections can be opened for editing too.

The editor in `collection-editor.js` uses expandable member rows, move up/down,
remove, add blank entry, add from file, and add from a saved page or collection.
Adding a blank entry opens its fields immediately. It uses the shared write-pane
title, format selector, Save, and Post controls; it is not a separate feed-pane
editor or a service-specific editor.

The member Edit icon is separate from inline metadata editing. It appears only
for an owned saved page with a suitable registered editor, an owned nested
collection, or a supported local file resource. Owned pages pass their saved-page
identity and MIME type to `loadSavedPage()`. External feeds have no resource Edit
button. Their website action uses the existing `launch` icon and `openInBrowser()`.

## Website URLs, feed URLs, and metadata

| Collection member field | Meaning |
|---|---|
| `title` | Member label |
| `url` | Website/page URL, used for browser navigation |
| `feed` | RSS/Atom subscription URL for feed members |
| `author_name` | Author |
| `summary` | Description |
| `membershipId` | Membership identity when assigned |
| `role: 'contains'`, `collectionId` | Reference to a nested saved collection |

The feed editor labels the URL fields **Website URL** and **Feed URL**. OPML export
writes `htmlUrl` for the website and `xmlUrl` for a valid HTTP(S) feed URL; legacy
members without a separate feed field fall back to `url`. Import prefers
`htmlUrl` as the website and retains `xmlUrl` as the feed. Optional OPML `author`,
`feed`, and `description` attributes preserve the supported metadata. Older
exports containing only one URL can therefore initially show that URL in both
fields; no website discovery is performed by this import path.

The unmodified combined changelog aggregates GitHub commit API responses directly.
Personal editable copies use the corresponding Atom feeds.

The combined **CList Changelog** includes CList, localrss_reader, proxyp, kvstore,
Discussions, collab, latex_compile, and opml2json. Each default member has a
repository website URL, Atom feed URL, description, and author **Stephen Downes**.
Opening older changelog entries fills missing defaults without restoring removed
members or changing their order and existing descriptions. AI authors are not
included in the default attribution.

## Personal feed subscriptions

After successful registration and login, `seedPublicFeedAccounts()` creates normal
encrypted PublicFeed account records for the public collections and the combined
changelog. It runs only at registration, including Local account registration;
deleted subscriptions are not restored on later logins. Discovery failures are
reported while already saved subscriptions are retained.

PublicFeed accounts initially reference the shared public collection. The first
**Edit Feed Collection** action creates a user-owned LocalRSS database via OPML
import, saves its `database` binding in the account, and opens its members in the
shared editor. Subsequent edits reuse that copy. LOCALRSS accounts edit their
existing database using the service endpoint resolved by the normal local-first
resolver. The configured service URL is not replaced by a transient proxy URL.

LocalRSS verifies a server-backed CList identity. A local-only browser login can
read anonymous public collections and manage its account records, but cannot
currently authenticate to LocalRSS's personal collection editing APIs. Editing
reports this limitation rather than bypassing authentication.

### Optional reader capabilities

```js
window.CList.readers.MyService = {
    // Existing reader properties omitted.
    editCollection: async (accountKey, accountData) => { /* open the shared editor */ },
    saveCollection: async (request, session) => { /* persist this user's membership */ },
};
```

`editCollection` is how the combined Collections view discovers account-backed
collections. `saveCollection` is invoked by collection persistence using
`request.feedAccount.type`; no new service switch is needed. It resolves on
success and throws on failure, without reading controls or displaying feedback.
PublicFeed and LOCALRSS delegate to `savePublicFeedCollection()`.

The feed binding contains `key`, `type`, `serviceUrl`, `database`, and optional
`requestBase` for a resolved endpoint. The adapter rechecks the stored account
before saving. It merges desired feeds through OPML and removes only unwanted
memberships through the existing feed APIs. It does not use shared-metadata
`feed_update`, or destructive replace-import for unchanged feeds. Public
collections and other users' memberships remain unchanged.

## Save to CList: current separated path

`readCollectionSaveFields()` is the title/format view boundary.
`captureCollectionSaveRequest(fields, items, collection)` creates:

```js
{
    name, formatId,
    identity: { key, id },
    items, publishedUrls, feedAccount
}
```

Arrays and the optional binding are detached snapshots. Capture happens when the
Save menu opens, before asynchronous work; subsequent edits are not silently
included in that request. The live document remains owned by the editor.

`persistCollectionSave(request, { token, encKey })` performs storage with no DOM,
editor-state updates, or feedback. Ordinary collections call `_kvSaveItems`;
feed collections call their registered reader's `saveCollection`. The returned
saved data contains identity, name, items, publication metadata, and feed binding.
Credentials are transient inputs, not collection metadata or result fields.

`runCollectionSave()` owns `CList.state.collectionSaving`: an active-target Map
and request-status WeakMap. Status is `saving`, `saved`, or `failed`. Duplicate
invocations of the same in-flight request share the promise. A different snapshot
for the same active target is rejected until that save completes. Failures release
the active operation for an explicit retry; writes are not automatically retried.
Completion reconciles only the matching active collection, preserves newer draft
edits, and leaves a different open collection and its panel untouched. The view
keeps button availability and existing success/error feedback.

Save to file and Save to Dropbox retain their existing paths. Collection
publishing also retains its existing UI/selection logic. Do not assume this save
controller has already migrated those workflows.

## Implemented storage and identity

Ordinary saved collections currently use encrypted `collection:{uuid}` records:
`{ id, title, items, publishedUrls }`. The `id` is `urn:uuid:{uuid}`. Existing
UUID-backed keys survive title edits; legacy names without an ID receive a fresh
identity when saved/published. Older embedded-array/object records remain readable.
This describes `_kvSaveItems` in the current runtime, not the separate-membership
storage target in the conceptual/storage plans; this documentation change does
not perform that migration.

PublicFeed and LOCALRSS account records retain `collectionItems` (a JSON string
containing the full editor entries) and `collectionId`, alongside their database
binding. Hidden schema fields preserve these values when account metadata is
edited. LocalRSS stores actual feed membership, harvested entries, and read state;
the account snapshot preserves editor order and per-user metadata.

## Public publication and service adapters

Saving subscriptions does not publish a collection. **Post** on the Collection
editor calls `playCollectionPublish()`. Eligible destinations are registered `w`
platform publishers and `b` bin publishers.

Formats are defined in `collection-formats.js`:

| ID | MIME type |
|---|---|
| `rss` | `application/rss+xml` |
| `opml` | `text/x-opml` |
| `json` | `application/json` |
| `html` | `text/html` |
| `md` | `text/markdown` |
| `text` | `text/plain` |

`acceptedFormats` is optional. `_resolvePublishFormat` uses the selected format
if accepted, otherwise the first supported format; null/empty accepts the user's
selection. Nested collections are flattened for export; raw membership structure
is retained in ordinary saved records. JSON export is a selected common-field
projection, not a lossless export of every internal property; use the saved
collection/account record to preserve the complete editor entries.

```js
window.CList.binPublishers.MyService = {
    acceptedFormats: null,
    publish: async (content, mimeType, filename, accountData) => ({ url, serviceId }),
    update: async (serviceId, content, mimeType, accountData) => ({ url }),
    delete: async (serviceId, accountData) => {},
};
```

Only expose operations supported by the service. The caller owns serialization;
adapters handle transport and errors. A bin result object is different from the
URL-string-or-null platform publisher contract in [publish_structure.md](publish_structure.md).

| Adapter | Type | Format capability | Authentication |
|---|---|---|---|
| `clistbin.js` | CListBin | Any | Current kvstore Bearer token |
| `jsonbin.js` | JSONBin | JSON | Account API key |
| `gist.js` | Gist | Any | Account GitHub token |
| `0x0.js` | 0x0 | Any | Anonymous |

CListBin's client posts `{ content, mime_type, title }` to the configured instance
root, uses `PUT /{serviceId}` for updates, and `DELETE /{serviceId}` for removal.
Account `instance` selects the server; authentication uses `CList.keys.ACCESS_TOKEN`.
This is the client contract, not verification of a remote server deployment.

Collection publication sends full content to bin and unlimited platform accounts
first. Their first usable URL becomes the link for limited destinations. Without
a primary URL, the limited path serializes a fallback and truncates it. Platform
calls use `publish(accountData, name, content, [])`, without progress options;
`construct()` is not invoked by this collection path. A long post to WordPress
followed by a short link post to Mastodon must keep this ordering.

## Published records, My Pages, and Republish

Collection publication appends `publishedUrls` entries containing URL, format,
service, account instance, timestamp, and service ID when supplied, to the saved
collection record. Standalone To Web Page publication records encrypted
`page:{uuid}` metadata through `_saveWebPageRecord()`. These records are distinct
from PageStore's local document contents and publication annotations.

The existing **My Pages** loader merges published collection URLs and standalone
page records in its Published pages modal, with sorting and pagination. Loading a
page preserves its MIME type and identity through `loadSavedPage()`. Supported
collection exports are parsed back into the Collection editor; Markdown/text
exports have no collection parser. `currentLoadedPage` identifies the destination
for Republish and the overwrite/new-version prompt.

Republish calls the original adapter's `update` operation. When a collection is
published again, overwrite applies only to its matching original service/account
and format; other selected destinations are new publications. To Web Page uses
the CListBin adapter directly. A saved personal feed binding is not a public page
publication record; feed subscription saving remains a separate operation.

## Verification and remaining boundaries

See [tests/README.md](../tests/README.md) for the 36 targeted collection request,
controller, account, and editor checks and the separate publication browser
fixtures. They mock network/storage and do not write live service data. Collection
publish selection and some legacy service handlers remain UI-coupled; updating
these contracts does not claim that all publishing has been refactored.
