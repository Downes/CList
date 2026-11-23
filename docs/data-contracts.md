# Shared JavaScript data contracts

`js/clist-types.js` contains shared JSDoc typedefs for accounts, collections,
collection saves, references, and publishing. Read it before changing those
structures. Relevant functions reference the definitions with `@param` and
`@returns`; triple-slash reference comments make the shared file discoverable
when a JavaScript editor opens an individual consumer file.

This file contains comments only. It does not need a runtime script tag, a
TypeScript conversion, or a build step. Annotations document contracts; they do
not validate network responses or stored data at runtime.

## Maintaining the contracts

- Update the typedef and affected function annotations in the same change as
  any change to a field, optionality, nullability, or return shape.
- Verify shapes against producers and consumers, including legacy readers.
  Describe normalized output separately from unvalidated input.
- Preserve extra properties on account data and collection members. These are
  extensible objects, not closed schemas.
- Keep ciphertext KV values distinct from decrypted JSON text and parsed data.
- Keep stored collection `title` distinct from editor/save `name`; member `url`
  is the website/resource URL and `feed` is the subscription URL.
- Keep credentials in the transient save session, outside request snapshots
  and persisted collection data.
- Reuse shared types instead of duplicating field descriptions. Add types for
  other core structures when their contracts are established in code.

These contracts describe the current implementation. They do not replace the
conceptual collection model or introduce a storage migration. Native local page
records remain separate from `CListPublishedPageRecord`, the subsequently added
contract for published page metadata.


Account setup also uses `CListAccountFlowContext` and `CListAccountFlow`.
These describe panel-scoped UI callbacks and factory results, rather than
persisted account data. See `adding-a-service.md` for registration and loading.


Generic account management uses `CListAccountSession`, `CListAccountSaveRequest`,
`CListAccountSchema`, `CListAccountForm`, and `CListAccountHooks`. Account state
functions accept explicit credentials and plain data. They return results or
throw; form rendering and feedback are in `account-form.js` / `account-panel.js`.
`prepareSave` returns properties, not a wrapper or ciphertext. Saving preserves
unrecognized properties and separates the storage key from a service's `id`.


Ordinary publishing uses `CListPublishingDependencies`, `CListPublishingUpdate`,
`CListPublishingDestination`, `CListPublishingOutcome`, and
`CListPublishingOperation`. The workflow receives explicit inputs and reports
plain updates; the controller reduces those into state and invokes the view.
Destination summaries contain keys, display names, service types, statuses,
warnings, and URLs/error text, never account credentials. Legacy adapters still
return a URL or null; the workflow's aggregate result does not replace that
service contract. `localPageId` is captured with the request before editor awaits.


`CListBlueskySession` describes a transient `{accessToken, did, pds}` value.
Selected-account publishing creates one from explicit account properties without
reusing or mutating reader session globals. It must not be stored in publishing
operation summaries or persisted in collection/page metadata.


`CListPublisherOptions` includes optional `onProgress` and `onWarning` callbacks.
Warnings are strings consumed by the invoking view/controller; adapters do not
show them directly. Ordinary workflow warnings are retained in destination state
and outcomes. `CListBlueskyReply` describes the parent/root strong references used
by `publishBlueskyRecord()`. Mastodon and Bluesky post operations keep the existing
URL-or-null result contract and reject failures without UI access.


Standalone web publishing uses `CListWebPageRequest`, `CListWebPageSource`,
`CListWebPageDependencies`, and `CListWebPageOutcome`. `CListWebPageSession`
extends account credentials with captured authorship and is passed transiently.
Workflow outcomes separate remote publication status from metadata errors and
contain only reconciliation properties, not credentials or editor controls.
`CListPublishedPageRecord` describes current encrypted page metadata payloads;
legacy input may lack newer fields. It is not a native PageStore document.

Annotation publication uses `CListAnnotationRequest`, `CListAnnotationReceipt`,
`CListAnnotationOutcome`, and `CListAnnotationSession`. Session credentials stay
transient. Per-target receipts distinguish confirmed creation from link availability
and uncertainty; ordinary publishing retains them via `options.onTargetResult`.

Collection Post and To Web Page use `CListCollectionPublicationRequest`,
`CListCollectionPublicationOutcome`, and `CListCollectionPublishingDependencies`.
Requests contain transient selected account snapshots; operation summaries retain
only destination outcomes/publication metadata. Export flattening is separate
from the captured raw membership saved to the collection record.

`CListCollectionPublicationSession` allows encryption-key loading after draft
capture. Its credentials stay outside operation summaries. To Web Page reuses the
collection request/outcome contracts with one automatic CListBin target; there
is no second incompatible publication result shape.

Direct collection Republish reuses `CListCollectionPublicationRequest` with
`republish: true` and the original loaded format/resource. Its workflow dependency
`touch` preserves stored membership/title; it does not run the normal draft-save
callback. Timestamp persistence failure remains a separate metadata error.

Local-entry Publish reuses `CListWebPageRequest` / `CListWebPageOutcome` and
transient captured session/account properties. `CListLocalEntryReceipt` retains
only the public store/user identity, blob source URL, and workflow result, keyed
by the original member in a WeakMap. Credentials are excluded from receipts.

`CListPublishingPanelOptions` supplies explicit ordinary Post selection/busy inputs
and controller callbacks to the view. The view reflects those values without
reading or modifying publishing state or using button attributes as selection.

Reader contracts live in `js/reader-types.js`, referenced by `js/clist-types.js`.
`CListReaderState` contains only safe selection/loading data. `CListReaderContext`
is transient and may carry credentials in its detached account, so never persist
or log it. Its guard/render methods are cooperative boundaries; services must
adopt them before stale direct-DOM writes are prevented.

LocalRSS reads use `CListLocalrssRequest`, `CListLocalrssPage`, and
`CListLocalrssReadState` in `reader-types.js`. The request/transport dependencies
carry captured account/header/session information transiently; kind/filter/offset
are safe state. Reader contexts now include `accountKey`, `next(load)` for guarded
pagination, and `updateAccount(record)` for reconciling an owned metadata update.
Do not put resolved-account caches or auth headers in UI/operation summaries.

LocalRSS row toggles use `CListLocalrssToggleRequest` (detached account, entry ID,
read/bookmark action) and return `{value: boolean}` from explicit transport.
Credentials remain in transient bindings outside `CList.state`. Regression checks
in `tests/localrss-reader.test.cjs` cover duplicate clicks, account/session switches,
pagination, replaced rows, API/malformed responses and uncertain writes. The
`localrss-reader.browser.html` fixture also checks actual row buttons after pagination.

Document attribution remains `CListReference[]` in `CList.state.references`, exposed
through `getReferences()` and the Refs panel. Source listing `.reference` objects
and collaborative `clist_refs` maps retain their existing shapes. There is no
separate current-reference editor display or state. Do not replace document
reference accumulation with a single latest source; preserve URL deduplication,
reply tokens, per-document park/restore and publication snapshots.

`CListAccountSession.isCurrent` is an optional transient operation-owner guard.
`assertAccountSession` checks it alongside the captured store/token before account
operations, encryption and persistence. LocalRSS OPML receipt saves use it to stop
closed/replaced panel operations from writing. It is never serialized into accounts.

## Saved files

`file-recognition.js` returns a content-derived editor MIME/value plus optional
collection, original editor hint and page metadata. JSON/XML that does not match
an actual supported structure stays text; filenames and MIME claims cannot turn
it into a collection. `CListAnnotationFile` preserves the annotation body, target
fields and references independently of the publishable HTML returned by getContent.
Optional `getFileContent()` returns `CListEditorFileContent` only for local saving.
CList HTML document wrappers carry inert JSON metadata (`clist-post-v1`), including
raw typed content, editor/title and references, so literal Text content round-trips.
New collection JSON/HTML/Markdown/text exports include an explicit collection
marker (RSS/OPML identify themselves by structure). Historical files are supported
where their content is distinctive; unmarked old annotation HTML is indistinguishable
from an ordinary document and must not be guessed into the annotation editor.

## Annotation file body delivery and HTML fields

Annotations use JSON (`clist-annotation-v1`) as their native local-save format;
the publishable body API remains HTML. XML is not required as a second native
format. HTML can be recognized as an annotation when its fields are explicit:
`#clist-annotation` (or `data-clist-kind="annotation"`) contains
`#annotation-body`/`#annotation-description` and optional `#annotation-title`,
`#annotation-url`, `#annotation-author`, `#annotation-author-id`, `#annotation-feed`,
`#annotation-image`, `#annotation-summary` and `#annotation-service`. Without the
container, body/title/url together form the explicit signature. Field text is
read as data; the body uses the shared sanitizer. Generic old `post-title` and
`post-content` wrappers are not unique annotation signatures, but choosing Annotate
recovers the saved title and body without guessing target fields from arbitrary links.

Annotation initialization now awaits TinyMCE readiness and consumes queued file
content through `loadPredefinedContent`. Initialization failures retain that queue
for retry. Node annotation tests exercise the real switch and initialize functions
with delayed/rejected TinyMCE startup. The browser fixture also exercises the real
queued-content switch (editor widgets remain mocked) and explicit HTML fields.
Rerun the fixture for this revision; previous PASS results predate the startup fix.

`CListEditorLoadState` describes the safe shared editor-loading generation/phase,
selected target and error. `editor-load-state.js` accepts explicit capabilities and
content inputs to compute representations without consulting UI or sessions.
The controller's captured content/page/callbacks are transient, outside that state.

## Editor switching

`CListEditorSwitchState` describes `CList.state.editorSwitching`: mount generation,
phase, target/active editor-account identity keys, error and detached parked
page/reference metadata. Account objects and queued/transferred bodies stay in
transient controller captures. The existing sessionStorage draft body and `_refs`
records retain their format; the key prefix is `CList.keys.EDITOR_DRAFT_PREFIX`.

## Editor Load/Blank controls and page presentation

`CListEditorControlsState` describes `CList.state.editorControls`: panel generation,
phase, blank target and error. Bodies/accounts/handlers remain transient. The
existing extensible `currentLoadedPage` compatibility pointer retains its full
record shape; `CListLoadedPagePresentation` is a separate display-only projection
with label, URL, title, publication visibility and optional transient notice.

## Generic Save panel

`CListSavePanelState` describes `CList.state.saving`: panel/operation IDs, phase,
busy flag, destination label and error. Saver settlement and an actual saved
resource are distinct; there is no invented publication/file receipt here.
Credentials, account objects, body content and callbacks remain outside state.
The existing saver `save()` method and optional `{keepOpen:true}` result do not
change. Busy remains true across panel rebuilds until that dispatched call settles.

## Reference panel lifecycle

`CListReferencesPanelState` documents `CList.state.referencesPanel`: generation,
open, busy and action ID. Reference records remain in the existing references
array with their complete structural/reply/extension fields. Plain helpers return
list changes; accepted inline fields retain the original reference-object
identity for existing editor callbacks. Panel display models contain citation
fields only; source records and callbacks remain transient controller captures.
Annotation and collection dispatch clone their target/list before awaiting.

## Write tags

`CListWriteTagsState` documents `CList.state.writeTags`: selected strings, input
draft, collection-name cache, dropdown/offer/control generations, read/creation
status and errors. It contains no token, account record, crypto key or ciphertext.
Selection keeps exact-case duplicate behavior, while suggestions use the existing
case-insensitive prefix matching. Tags stay global across editors as before.
`getWriteTags()` returns a copy. Optional collection creation retains the existing
legacy `collection:<name>` key with encrypted JSON `[]`; it uses add-if-absent,
not update/put, so existing collection content is preserved. Session checks and
crypto/storage dependencies are transient workflow/controller inputs.

## Find

`CListFindState` and `CListFindContext` live in `reader-types.js`, already referenced
by the shared contract index. State contains panel/request IDs, current input,
captured query, provider key, status and error. Tokens/provider objects/AbortController
and captured feed elements remain transient. `supportsFindContext` providers
receive explicit query/context arguments; legacy no-argument providers remain
supported. Aborting is cooperative, and direct legacy DOM writes remain outside
the guarded rendering contract.


## Local file saves and My Pages

`CListLocalFileOutput` describes an explicit serialized export, while
`CListLocalFileReceipt` distinguishes a confirmed native write, browser download
handoff and cancellation. `CListLocalFileSaveState` stores progress and safe
receipt/error summaries in `CList.state.fileSave`; captures, credentials, encryption
keys and cached file handles remain transient. Handles are isolated by the
captured username, storage server and authentication session. Metadata indexing
runs after a successful write/handoff; failures retain the receipt without
repeating the file write. Native annotations are indexed with their native MIME
and filename rather than as HTML documents.

`CListMyPagesState` owns presentation and busy/error state under
`CList.state.myPages`. Published page records and collection publications retain
the existing storage shapes. Private row captures and deletion receipts bind
actions to the original session/destination; metadata cleanup after a confirmed
remote deletion can be retried without repeating that deletion. Views own controls
and inline feedback; workflows receive explicit storage/transport dependencies.


My Pages passes a transient fifth `isCurrent` callback to
`loadSavedPage(content, page, renderTarget, onCancel, isCurrent)`. Shared editor
choices/reviews keep checking this guard after the original modal is replaced.
Collection loading uses `openParsedAsCollection(parsed, page, isCurrent)` to retain
the captured collection key/publication metadata and restore the previous active
collection after a failed/expired mount, provided no newer load replaced it.
Legacy collections without an embedded ID keep their original storage key while
a missing ID is minted. The standalone delete workflow rechecks the current
resource/destination before remote deletion and metadata removal; the storage API
has no compare-and-swap guarantee for concurrent changes between these steps.


## Dropbox file operations

`CListDropboxSession` is a transient capture: username, storage URL/token, original
account key/JSON, a detached `CListAccountData` and required permission. It never
enters shared state. `data.id` is the Dropbox access token; the capture's `token`
is the storage login token. Definite authentication rejection refreshes and saves
the original account through `saveAccount` with an explicit guarded session,
retaining extensions and reconciling only the unchanged account. Initial OAuth
creation is separate and retains its existing controller.

`CListDropboxSaveState` and `CListDropboxLoadState` contain only progress,
filename/count, safe receipts and errors. `CListDropboxSaveReceipt` retains the
confirmed path/id/revision independently of panel lifetime. File bodies, account
records, keys, token values, callbacks and transport clients stay private.
Local exports reuse `CListLocalFileOutput`; collection exports supply their own
captured serialized file through `saveToDropbox({found,target,isCurrent,prepare})`.
Both paths share the explicit exists/add/conflict/overwrite workflow. The picker
uses the shared `loadSavedPage` guard through later representation/draft choices.

Folder pages follow the ordered continuation protocol in the
[Dropbox List Folder reference](https://docs.dropboxapi.com/dropbox-api/api-reference/user-endpoints/files/list-folder):
latest case-insensitive path updates win and deleted paths disappear. HTTP errors
carry numeric `status`, `missingScope` and structured `conflict` flags; upload
network/receipt failures are uncertain and never trigger automatic replay.


## Collection browsing, importing and memberships

`CListCollectionSession` captures storage URL, username, token, encryption key and
an optional ownership predicate. It stays outside shared state. The explicit
`collectionDependencies(session)` adapter is the storage/encryption boundary;
DOM-free workflows receive these operations rather than reading global selection.
`CListCollectionBrowseRecord` normalizes current objects and legacy bare arrays,
retaining extension properties and adding storage `key` plus a `name` alias for
`title`. Aliases are excluded from stored values. Legacy IDs may be null; adding
to a legacy target keeps its original storage key while assigning a durable ID.

`CListCollectionBrowseState`, `CListCollectionImportState`,
`CListCollectionMembershipState` and `CListCollectionOpeningState` describe safe
phase/generation/busy/error fields under their matching CList.state properties.
Selected records, members, draft bodies, references, account snapshots and choice
callbacks remain transient controller captures.

Membership removal uses the selected membershipId and verifies that member still
matches. Legacy members require an unchanged list and selected ordinal. Neither
operation removes all copies sharing a URL. Add/remove preserve latest siblings,
record extensions and publication metadata; failed writes do not mutate the
captured source list. Storage has no compare-and-swap API, so checks do not provide
transactional protection against another client writing between read and write.

Import recognition reuses the shared content detector, preserves recognized
identity and valid JSON extensions, and captures its new identity once for retry.
Existing targets require explicit Overwrite/Merge; commits recheck the captured
destination. Merge retains existing members and deduplicates leaves by URL while
preserving nested/local memberships by membership or collection identity. Existing
publication metadata survives overwrite/merge. New records use add-if-absent.

Opening captures the original editor/account/page and draft before awaits. Member
fetches route through `loadSavedPage` with a continued lifetime guard. Owned pages
and local blobs remain distinct. Failed/expired collection mounts restore only
their own active target; newer loads and drafts are not reconciled over.


Shared JSON collection parsing retains open member properties (including
membershipId and extension metadata), normalizes title/URL/author/summary aliases,
and retains role:contains members with a collectionId even without a leaf URL.
Native author_name takes precedence over the legacy author alias. Collection
identity continues through the existing validated UUID parser.

Reader row bindings receive `rowContext` separately from normalized/reference
objects. It may carry a captured account/session and must never be serialized or
logged. `bindRow(item, row, context)` owns closures; DOM attributes/classes reflect
presentation only. `context.navigate` starts an owned feed from a live row while
`next` retains paging semantics. Find contexts provide the same selection lifetime
through `isAccountCurrent` and capture the original query for mode navigation.
`CListReaderSurfaceContext` captures accountless public/annotation reader lifetime.
Mastodon safe read state stores `{kind, value}`; annotation read state stores only
`{generation, phase, error}`. Service sessions, forms, bodies and credentials remain
transient. `CListPublisherOptions.assertCurrent` is an optional Mastodon form guard
checked before its write, not a general cancellation guarantee for other publishers.

## Calendar

A calendar is a collection, not a separate storage concept. Events themselves stay
stand-alone, independently stored records exactly as before — `CListCalendarEvent`
(`id`, `title`, `start`/`end` ISO 8601, optional `allDay`, `location`, `description`,
and optional `sourceType`/`sourceId` for a future feature to link a derived event
back to whatever created it, mirroring `sourceUri`/`sourceId` on PageStore records;
still no recurrence/RRULE field or virtual-derived-event registry, deferred until a
second real consumer exists). It also carries an optional `references` field
(`CListReference[]`, same shape every other editor's references list uses) —
populated by the Event editor's `loadContent` when an incoming item is pulled in via
its arrow button, and round-tripped through `_eventEditorBuildDraft`/`saveCalendarEvent`
exactly like any other field. `calendar.js` remains a DOM-free data layer over
`window.CList.storage.kv` (`fetchDecryptedKvRecordsByPrefix`, `encryptWithKey`,
`kvErrorMessage`) for `listCalendarEvents`/`getCalendarEvent`/`saveCalendarEvent`/
`deleteCalendarEvent`, unchanged. It reuses `CListCollectionSession` and its
`beginCollectionSession`/`assertCollectionSession`/`prepareCollectionSession`
helpers directly rather than duplicating them under a calendar-specific name, since
that session shape is generic storage auth/crypto state, not collection-specific.

A calendar is reached by referencing events from an ordinary collection's `items`
array with a new membership entry kind, alongside the existing `role:'contains'`
sub-collection reference (see "Collection browsing, importing and memberships"
above): `{ role: 'event', eventId, title, start, allDay, membershipId }`. `eventId`
is the real reference — the stand-alone `calendar:{eventId}` record is the source
of truth; `title`/`start`/`allDay` are a cached snapshot for cheap chronological
sorting and flat-list rendering, the same bounded-staleness tradeoff leaf entries
already accept for `title`/`author_name`/`summary`. `addCollectionMembership`/
`removeCollectionMembership` (`collection-workflow.js`) handle `role:'event'`
entries unchanged — `duplicate` detection never fires since events have no `url`,
so the same event can belong to more than one calendar with no dedup. An event can
belong to more than one calendar simultaneously, exactly like a post can belong to
more than one collection.

A collection's `type` field is cache-derived, never user-set: `_recomputeCollectionType`
(`collection-workflow.js`) sets `type: 'calendar'` whenever more than half of a
non-empty collection's items are `role:'event'`, and clears it again otherwise, live
after every membership add/remove — never a kind picked at creation time, consistent
with the app's capability-over-identity rule. `calendar.js#listEventsForCollection`
resolves a given collection's current `role:'event'` members against one
`listCalendarEvents` call (filtered/sorted client-side), rather than one
`getCalendarEvent` round-trip per row.

The top-level "Calendar" sidebar button opens a dedicated meta-collection — found by
a one-time sentinel KV key (`getCalendarSidebarCollection`, key
`_calendar_sidebar_set_id`), not by title, so renaming it in My Collections never
breaks the button. Its items are plain `role:'contains'` references to whichever
`type: 'calendar'` collections the user has chosen to merge into that view
(`addCalendarToSidebar`/`removeCalendarFromSidebar`, `calendar.js`), reusing
collection nesting exactly as it already works for a folder of collections — no new
reference shape. Opening a single collection's own detail view instead gets its own
"View as Calendar" action, independent of what's merged into the top-level button.
`calendar-browser.js`'s owner is constructed either way: `calendarBrowserOwner`
single-collection mode scopes `owner.events` to `listEventsForCollection(collection,
...)`, while sidebar/merged mode fans out across every `role:'contains'` member of
the meta-collection, concatenating each one's events and tagging each with its
source collection (needed so save/delete know which collection's membership to
touch) — the same shape of fan-out `recomputeMerged` already used for merging
multiple ICS subscription sources. ICS subscriptions and calendar-publishing
(`calendar-subscriptions.js`, `calendar-publish.js`) stay global per-account rather
than per-collection, merging into whichever view (single or merged) is open.

`migrateLegacyCalendarEvents` (`calendar.js`) is a one-time, idempotent migration
from the pre-collection architecture, gated on its own sentinel KV key
(`_calendar_migration_v1`) rather than title text: if unset, and if any pre-existing
`calendar:{id}` events exist, it creates a "My Calendar" collection with one
`role:'event'` entry per event (immediately recognized as `type: 'calendar'`, since
every item is an event) and wires it into the sidebar meta-collection, so an existing
account's top-level Calendar button shows exactly what it did before. The sentinel
is still written when there is nothing to migrate, so later loads short-circuit on
one cheap key check rather than re-listing every `calendar:{id}` record.

`CListCalendarBrowseState` describes `CList.state.calendarBrowsing`: generation,
phase, inline delete-confirm ID, busy flag and error, mirroring
`CListCollectionBrowseState` but with no detail-view phase or selected-record field,
since the calendar browser only ever shows a flat list.
