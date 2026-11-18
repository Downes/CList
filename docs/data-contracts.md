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
