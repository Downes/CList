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

Annotation target/field operations reuse `CListReference` live objects. Its `id`
is nullable for the existing standalone draft; the native file format is unchanged.
`annotate_draft_state.js` resolves the first document reference or the private
standalone target. Incoming references fill a URL-less target using the existing
truthy structural-field adoption and also preserve open-ended service extensions,
including false-valued extension properties. Established targets remain primary;
additional sources use the shared exact-URL reference helper.

The fields controller keeps pending values/baselines/conflicts privately and
preserves unfinished input through same-target refreshes. Committing after the
underlying field changed requires an explicit new input; duplicate old change
callbacks cannot overwrite accepted metadata. Source/session/account/editor/load
captures and target/form generations reject obsolete edits. Manual URL entry
registers the same target object rather than cloning it. Clear and native restore
invalidate old forms and retain body/target/reference round-trip behavior.
`CListAnnotationFieldsState` exposes generation/busy/dirty-count only. This slice
does not migrate TinyMCE initialization or Send's publication lifecycle.

Annotation body lifecycle now uses `annotate_body.js` / `annotate_body_view.js`.
The private controller owns HTML, original textarea/root, auth source, pending
initialization and editor/listener resources. Each initialization uses a unique
target ID; callers use handler APIs rather than a fixed-ID/global TinyMCE lookup.
Delayed ready callbacks seed the latest same-target content once. Input/change/
undo/redo mirror into the captured fallback; ordinary hide/reactivation preserves
the editor while root/auth expiry removes owned resources and rejects old callbacks.

Rich initialization failure yields a usable textarea plus explicit Retry and is
not an overall mount failure. Queued native/HTML content is delivered to fallback
once and retained through later rich retry. Actual pending-content delivery errors
retain their existing shared-loader behavior. Body read/write failures propagate,
with fallback preserving the last mirrored or desired body; failed reads must not
silently become publication content. `CListAnnotationBodyState` exposes phase/busy
only. Send and full editor-switch internals remain separate; vendor rendering and
resource removal are mocked in automated/browser fixtures.

Annotation Send now uses `annotate_send.js` / `annotate_send_view.js`. The panel
captures source editor/account/session/auth epoch, load/control generations and
its actual controls; account loading failures are distinct from an empty writable
account list. Raw accounts/credentials and registry fingerprints stay private;
views receive label projections. Account index/visibility are controller-owned,
with private record-key preferences retained within the same auth session so
rebuild/reactivation does not reset a private selection to public.

Before awaiting the body API, Send detaches the selected account, primary target,
tags/visibility/session and return intent. It reuses existing annotation request/
workflow/transport semantics, including only URL/title/author/feed metadata for
the primary target. Generic Publish's convergent-target contract is unchanged.
One shared pending editor-Send lock spans capturing, writes and rebuilt panels.
Pre-write source/account/draft changes cancel. Started writes may finish for
their captured target, with old UI/return effects suppressed after source changes.

Results distinguish accepted/rejected/uncertain receipts; no automatic replay
occurs. Explicit Send remains the retry action, with uncertain results instructing
the user to check the server first. Returning to the prior editor additionally
requires unchanged target/body/tags/handler/return intent. A post-write return
check failure keeps the accepted result and draft rather than retrying publication.
`CListAnnotationSendState` contains phase/busy/accountIndex/visibility/receipt only.
The inline compatibility `_submitAnnotation` remains separate; this editor panel
uses the data workflow directly so its own view can guard feedback.

Native editor Save uses `CListNativePageSaveRequest`, a detached title/editor/MIME/
reference snapshot with optional native ID/revision, and a subsequently supplied
string body. Preserve reference/reply/extension fields. Only a captured
`kind:'local-page'` source supplies the existing native ID/revision; other source
kinds retain the existing new-native-copy behavior. The underlying PageStore
transaction, stored record shape and omitted-revision behavior are unchanged.
`CListNativePageSaveResult` documents only fields consumed from the full result.

The controller privately retains source editor/handler/account, page pointer,
live document ID, selection/load/blank generations, session/auth epoch and the
captured PageStore API. Stale captures cancel before writing. Once dispatched,
a write may finish for its original record; late completion cannot replace a
new editor/page. Reconciliation preserves current visible title/references and
attaches accepted native identity/revision. Accepted writes with failed editor
reconciliation retain receipts for explicit metadata-only recovery. Public
`CListNativePageSaveState` contains phase/busy/receipt only, without content or
credentials. This is separate from browser file downloads and remote publication.

Local-page browsing uses the existing `PageStore.list/get` API. Private captures
hold original store functions, panel, editor/handler/account/page/live-document
identity, selection/load/control generations and session/auth epoch. Public
`CListNativePageBrowserState` contains phase/count/opening only. Row identifiers
and retry callbacks belong to the current list generation; late reads cannot
paint a newer panel or open a different document. Labels render literally.

`CListNativePageRecord` documents existing native records with legacy/imported
optional metadata, without changing persistence. Opening validates the returned
ID and string body, detaches references/reply/extension fields and restores native
revision plus latest publication service/account/URL. It delegates content-first
recognition, editor choices, overwrite/insert and reference restoration to
`loadSavedPage`. The handoff guard permits that loader's own editor/UI changes
while rejecting a new source/blank-control generation, session or local list.
Import/export now delegates to the captured bundle-tool controller below.

`CListNativePageBundle` / `CListNativePageImportResult` document the existing
bundle and result formats, without storage migrations. PageStore still performs
whole-bundle validation before writes, original skip/replace/duplicate conflict
semantics and two-pass member-reference remapping. Export JSON preserves complete
records; browser handoff does not confirm a file was saved to disk.

Bundle tools capture file object, conflict policy, store methods, source/editor/
page/document, session/auth and panel/control ownership before asynchronous work.
Changes during file reading cancel before dispatch. Once import is dispatched,
its original PageStore operations can finish after navigation; late completion
does not repaint or reload another panel. Returned partial results retain all
counts, per-record errors and dangling references. A thrown post-dispatch error
other than pre-write `InvalidData` is uncertain, since some writes may have landed.

Private receipts lock the captured File object/policy within the same store/auth
session after an accepted or uncertain attempt, and survive panel rebuilding for
explicit read-only result review. This is not content-hash deduplication or durable
recovery across reloads; explicitly selecting another file/policy starts a new
attempt. `CListNativePageBundleState` contains kind/phase/receipt/busy only, not
bundle contents, filenames, record identifiers or credentials. Back refreshes the
local listing explicitly; completed results are not immediately discarded.


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

`CListFollowingEntry` keeps the original storage `key` separately from its displayed
`did`. Decryption may yield a different DID; deletion still targets the original
key. A corrupt record uses its key-derived DID with visible read warnings and is
not silently discarded. `CListFollowingState` is a safe panel/request/phase/error/
pending-count summary. Tokens, keys, ciphertext, decryption results and node/action
bindings stay in transient captures. Follow record storage formats are unchanged.

`CListDidIdentitySession` is a transient captured store/token/username/mode owner.
It must not enter public metadata, logs or `CListIdentityDisplayState`. That shared
state holds only panel ID plus independent `CListIdentityReadLane` summaries.
`CListDidPublicAccount` is a safe read-view projection: key/title/type/public, not
the full decrypted `CListAccountData`. Original account records/extensions are
unchanged. Legacy DID publication still consumes checkbox checked/data-key values;
that write contract remains outside the read-only slice. `DID_IDENTITY_KEY` names
the existing `_did_identity_key` storage record; it does not introduce a new format.

`CListIdentityProofState` holds only panel/request IDs, progress phase and error.
Captured targets/session, encrypted/decrypted identity keys, challenges, signatures
and verification inputs/results stay transient. The proof workflow returns only
verified/otherLabel/didKey display data; a fetched did:key alias is not trusted as
the verification decision. Existing identity key/account record formats and
cryptographic helper contracts are unchanged.

`CListIdentityPublicationState` is a safe panel/phase/error summary. Existing-key
publication owns transient captured credentials, ciphertext version, derived public
key and `CListDidPublicationReceipt`. A receipt contains didKey/existing/optional
warning, not private keys or credentials. Accepted HTTP status is retained even
when response parsing or follow-up work fails. Unknown outcomes are checked through
public reads before another explicit publication attempt. Identity/account record
formats and existing new-DID PUT payload fields are unchanged.

`CListPasswordConfirmationState` contains only dialog ID, phase and a generic error.
Entered passwords and captured raw verifier/session-key snapshots remain transient
and never enter summaries/logs. `confirmWithPassword(message,onConfirm,opts)` retains
the custom verifier/confirm-label/class contract and adds optional `opts.isCurrent`
for a captured source guard. It forwards the exact verified submission once.
The guard covers callback dispatch, not subsequent caller-owned async operations.
No identity/account storage format or password derivation algorithm changed.

First-time generation uses `CListDidGenerationState` for panel/phase/error only and
`CListDidKeyReceipt` for accepted/reconciled didKey/existing information. Private
keys, raw/encrypted key material and session credentials do not enter these shapes.
The existing encrypted identity record format is unchanged. New storage uses
add-if-absent; regeneration remains separate. Publication accepts an optional
expected did:key from generation and rejects a different subsequently stored key.

`CListDidRotationState` is panel/phase/error only. `CListDidRotationSnapshot` and
`CListDidRotationPrepared` distinguish original/replacement ciphertext from parsed
public DID/JWK metadata. They remain in transient session-owned plans, not shared
summaries or persistent records. Public metadata extensions inside service entries
are preserved; encrypted identity record formats are unchanged. Pending plans
survive panel rebuilds in the same captured login and are cleared after accepted
completion or explicit recovery/refresh. The key update is guarded client-side,
not an atomic compare-and-swap. Shared password confirmation adds an optional
synchronous onCancel notification and returns isOpen/cancel dialog ownership;
password/key snapshots remain private to confirmation/crypto operations.

`CListDidRemovalState` is a safe panel/phase/error summary. `CListDidRemovalPlan`
contains a transient original ciphertext/public identity fingerprint and independent
keyRemoved/documentRemoved receipts; these are never put in shared state or stored
as a new record format. Receipts are monotonic and distinguish accepted/confirmed
absence from unknown results. Only remaining steps may be explicitly retried after
read checks. Completion clears the session's obsolete rotation plan and rebuilds
identity controllers so prior generation/publication receipts do not block a new
identity. Migrated mutation checks are client-local coordination, not server CAS.

`CListDidIdentitySelection` contains public booleans only. Its transient
`CListDidAccountSelectionSnapshot` binds choices to source ciphertext versions;
account-list reads now return a private versions Map alongside safe projections.
Neither versions nor record bodies enter UI state. `CListDidAccountUpdateState`
is panel/phase/error only. Pending update plans separately retain visibility and
publication receipts without changing account storage formats. Only public is
changed on account records; extensions/credentials remain intact. `PAGES_CATALOG`
names the existing clist:pages-catalog record. Other public links are preserved;
managed aliases/services reflect the captured choices. Acknowledgement does not
overwrite newer drafts, credentials, catalog metadata or private identity keys.


Migration preparation uses `CListMigrationInput` (transient captured password),
`CListMigrationPlan` (private source/destination tokens, CryptoKeys, detached
ciphertext records and sorted key/value snapshots), and safe
`CListMigrationPreparationState`/`CListMigrationPreview`. No password, auth hash,
key, token or encrypted record enters UI state. Preparation decrypts every source
record but retains only ciphertext, preserving extensions. It never installs the
destination login or copies records. Optional Register creates an account during
preview; transient per-source-session/target receipts distinguish accepted,
uncertain and rejected registration. Ordinary retry checks login without resending
an uncertain/accepted registration; resending needs explicit Retry registration.
Overwrite consent belongs to controller state. Run rechecks exact source and
destination records and consumes the captured plan once. These client-side reads
are not atomic server CAS.

Execution uses private `CListMigrationExecutionPlan`, `CListMigrationCopyStep`
and `CListMigrationIdentityStep` records. It retains original/expected destination
ciphertexts, one generated ciphertext per copy, captured public metadata and
separate ready/uncertain/accepted receipts. `CListDidPublicationPayload` describes
the existing shared one-shot transport. `CListMigrationExecutionState` is only
progress counts, target label, error and action state. Destination credentials,
keys and copy payloads are cleared on completion; source-session ownership remains
private. Pending recovery survives panel rebuilds in the same tab/source session,
not reloads or a new login. Read-only checking reconciles an exact written ciphertext
or matching public payload before any explicit remaining-step retry. Accepted steps
are not repeated; changed source/destination records or public documents stop work.
Unrelated destination records/aliases/services are preserved; conflicting service
metadata needs review. A hosted source must publish its matching identity before
any copies; a Local source needs only its stored key. There is no source record
delete or automatic account switch. Both key conflicts and identity publications
remain explicit, captured operations; client checks are not atomic CAS.


`CListAuthPanelState` contains form mode, modal/picker visibility, generation,
pending/error state and selected/draft server URL. It contains no passwords,
auth hashes, keys or tokens. `CListAuthInput` and `CListAuthAttempt` are private,
transient submission captures; password text is cleared at settlement. The view
reads inputs and renders explicit values; controller-owned mode and draft server
determine actions rather than DOM attributes. Available server URLs are captured
from the existing selector when the controller is created. Preference persistence
precedes config replacement; reader/publishing invalidation follows only an actual
server change. A refresh error after accepted selection is separate from failed
persistence. Submission guards span rebuilt modals. `registration` in public form state is
created/uncertain/rejected/null only. `CListAuthCredentialTarget` privately captures
server, Local adapter, storage key constants and source cookie/key versions.
`CListPreparedAuthCredentials` contains only transient derived auth hash/encryption
key; `CListVerifiedAuthSession` is a validated matching username, opaque token and
future parseable string expiry. None enter presentation state. Registration caches
retain statuses keyed by server/mode/username/source token, not passwords or derived
keys. Accepted and uncertain results survive replaced panels in this tab; they are
not persistent across reload. Login/register compatibility helpers keep two-argument
Promise contracts. Data operations propagate failures for controller-owned feedback.

Session cookie names, 365-day cookie lifetime and `${server}_${username}_encKey`
sessionStorage slots are unchanged. After all asynchronous export/ownership checks,
installation synchronously saves key/username/expiry/token (token last) and verifies
readback. Partial failures attempt reverse restoration of captured prior values;
newer values are preserved and incomplete rollback is visible. This is not a browser
storage transaction or remote session revocation. Registration acceptance is distinct
from later login/storage failure; ordinary retries never resend creation. Post-login
setup is now separately owned by `post-login-*` and is not established by the
credential-only fixture.

`CListPostLoginDescriptor` retains each service's existing account shape/key.
`CListPostLoginStep` and `CListPostLoginPlan` are private captures with separate
registration and encrypted-record receipts; generated ciphertext is retained for
read-only reconciliation. Add conflicts preserve the existing record, including
unknown extensions and unreadable values; no update/put is used. An accepted seed
removed later is not recreated by recovery. Registration-only public subscriptions
reuse `publicFeedSetupAccount`/`discoverPublicFeedSetup`; the standalone
`seedPublicFeedAccounts` compatibility helper remains separate.

`CListPostLoginState` exposes counts, errors and public retry labels/keys only.
Accepted login is never rolled back due to setup or account-refresh failures.
Recovery actions belong to the original source session, auth-panel generation
and live results modal. They expire when that owner/session/modal is replaced.
This is transient recovery, not reload-persistent receipts or server CAS. Unknown
external registration cannot be checked by the KV list; it requires an explicit
service retry after user review, while unknown KV writes reconcile by ciphertext.

`CListSessionSnapshot` is a private source capture of server/Local mode, auth
epoch, cookie token/username/expiry and encoded tab key. It never enters UI state.
`CListSessionLifecycleState` contains generation/phase/error only. Restoration
requires a nonempty tab key and a finite future expiry, then imports the key and
reuses `loadAccountRecords` with a captured session guard. It never changes auth
cookies, seeds accounts or replaces newer reader navigation. Local storage auth
signals and the legacy `SESSION_SIGNAL` schedule captured, superseding reads;
these tests do not prove real cross-tab event delivery.

Auth attempts/credential targets now also capture `authEpoch`; new submissions
and logout advance it. Logout cancels the current form attempt, expires reads,
removes/verifies the original token first, then clears captured username/expiry,
the selected user's key, its legacy slot and every `EDITOR_DRAFT_PREFIX` tab entry.
Other server/user key slots and unrelated preferences remain. Existing names
`clist_logout_message` and `kvstore` are declared as `LOGOUT_MESSAGE` and
`SESSION_SIGNAL`. Logout notice consumption is one-time. Cleanup is not an atomic
storage transaction: token-removal failure stops destructive cleanup; later
failures are reported while proceeding to reload, with a scoped reload-only retry
if navigation fails. No remote token revocation or Local account deletion occurs.

`CListAdminApp` is captured public service metadata. `CListAdminSession` contains
the selected source cookie credentials/epoch privately. `CListAdminField` and
`CListAdminSettingsData` normalize the existing schema/values response; string,
boolean and numeric values become strings, absent booleans retain the legacy true
default. The wire format remains GET `{schema,values}` and PUT changed fields only,
with `{values}` returned. Backend field keys remain open strings; duplicate schema
keys/invalid shapes fail closed. Sensitive values display only Set (hidden)/not set.

`CListAdminWrite` retains private payload, per-field draft versions and independent
pending/accepted/uncertain/rejected receipt state. `CListAdminSettingsState` exposes
only owner/app/phase/error/dirty count/busy. Boolean toggles save one key immediately;
text Save omits unchanged/blank secret fields. Acceptance clears only the original
unchanged drafts, retaining newer input. GET checks preserve drafts; matching
nonsecret values or known HTTP acceptance reconcile receipts. Unknown masked secret
changes stay unconfirmed and require explicit review/save. Pending and unreviewed
writes block overlapping saves across rebuilt panels in the same source session.
No receipt is persisted across reload; no server CAS/atomicity is implied.

`CListPaneState` is presentation-only canonical layout: drawer booleans,
finite nonnegative numeric flex grows, focus/surface and dragging. It contains no
credentials or editor content. `CListPanePreference` retains the four legacy
properties `leftOpen`, `rightOpen`, `readFlex`, `writeFlex`; grow values serialize
as numeric strings. Existing browser-serialized numeric flex shorthands normalize
to grows. No new focus/content/authentication data is persisted.

`PANE_STATE_LOGGED_OUT` (`clist_pane_state`) and `PANE_STATE_LOGGED_IN`
(`clist_pane_state_loggedin`) preserve the two existing shared profiles; these are
not per-user records. Restore reads/applies once without changing either stored
profile, including malformed data. Layout commands save canonical state under the
current profile. Drag source/profile identity stays private and expires on session
change; preview does not write, mouseup writes once for an owned changed drag.
Clamped/zero-width sizing and stale width transitions cannot hide/reopen panes
unexpectedly. Storage failures keep the live layout usable with visible feedback.

`CListNavigationState` exposes only selected index, entry count, gesture-pending
and annotating flags. Nodes, reference snapshots, selection text, credentials and
gesture/session captures remain private to the controller. Key/touch facts use
`CListNavigationKeyFacts` and `CListNavigationTouchFacts` for pure interpretation.
Shared listing rows expose optional `isCListRowCurrent()` backed by their existing
captured row context; navigation filters expired rows through it. Legacy rows
without that guard retain DOM-membership checks only. Pagination preserves selected
earlier-page rows, while request-generation changes expire in-flight gestures and
annotation dispatch. No navigation preference or content is persisted.

`CListActionDefinition` is a transient captured command: stable ID, literal label,
selected/disabled flags and optional run callback. Missing callbacks are disabled.
Commands and pending/focus state belong to the menu instance, outside shared
application state. The view never reads selection or command identity back from
button attributes. Labels use textContent; callbacks retain their feature-owned
account/session guards. The component expires replaced/detached controls but does
not independently authorize service actions or cancel dispatched operations.

Menu shell phase (`inline`, `popout`, `disposed`) is private to its controller.
The view captures the original DOM parent/position and one modal presentation;
no nodes, callbacks or focus targets enter shared application state or storage.
The same menu node moves into the existing stacked-modal shell, retaining command
definitions, pending locks and field values. Back/Close/Escape return that node
and restore focus only from the currently owned dialog to a visible trigger.
Reader menu replacement/reset disposes the shell without focus restoration.
External removal or replacement returns nodes without closing a newer dialog.
These presentation guards do not cancel dispatched feature/service operations.

LocalRSS Options retains its existing private account/header/filter target and
root node while popped out. `current()` now requires a connected root as well as
captured account/session ownership. The optional private `disposePresentation`
callback releases its shared shell when closing/switching databases; it neither
repeats nor cancels pending data operations. Replacing Options closes/removes only
the original presentation. Shared shell views accept an existing nested trigger,
feature-current predicate and literal Back label; no new persistent/public data
shape or service operation is introduced.

`CListChatSessionState` exposes only `phase` (connecting/ready/closed) and
`connectionCount` (including pending channels). The P2P session controller owns
one Peer and channel registry, known/deduplicated peers/messages and peer identity
maps. Peer IDs, source fingerprint, tokens, messages and keys stay private. The
compatibility bridge temporarily aliases these maps for legacy chat helpers.
Same-ID replacement invalidates the old channel before closing it, so saved or
late callbacks cannot remove/update the replacement. Hiding the existing panel
does not destroy its session; replacing controls or source expires ownership.

Delayed DID installation, signed-send dispatch and verified-message output check
the original session/channel before applying results. A heartbeat captures its
session/timer and cannot send for an expired source or stop a newer timer.
These guards neither cancel started transport/cryptography nor fully capture
legacy storage reads. No idle cross-tab/authentication observer is introduced;
activity/reopen checks ownership. Discussion publication, popup/share
and collaboration-card workflows remain separate migration work.

`CListDiscussionEntry` is a detached literal name/peerId pair, normalized from
validated directory responses. Additional service fields are not used by the
listing. `CListDiscussionListState` exposes phase/count/joiningCount only. Captured
directory endpoint, credentials, source fingerprint, entries, accepted peers and
pending Join targets stay private. HTTP 401 maps to login feedback; malformed or
failed responses produce no Join rows. Rows dispatch captured copies rather than
reading labels or peer IDs from DOM attributes. Source/service/list changes and
newer refresh generations expire callbacks/completions. Duplicate peers share a
Join lock; accepted/existing dispatch stays locked until explicit refresh and is
not proof of a live connection. The bridge reuses the current chat session; no
directory or Peer write is automatically retried.

`CListDiscussionActionState` exposes phase/kind/receipt only. Its private record
captures name, peer ID, visibility, endpoint/token, session, prior discussion and
channel identities. The view displays the original name/visibility while keeping
newer drafts. Accepted/rejected/uncertain receipts survive panel rebuilds in this
tab. Uncertain writes block other actions until read-only review and explicit
original-request retry or Done; directory presence/absence proves neither the
write nor visibility. Accepted writes recover local effects without remote retry.
Captured channel-close/notice/refresh progress prevents repeated completed steps;
new discussions/channels/peer IDs block old activation/cleanup. Leave pauses its
owned heartbeat before dispatch and retains connections on rejected/uncertain
results. Heartbeats capture endpoint/token and expire on source/service changes.
There is no reload-persistent recovery or server atomicity/idempotency guarantee.

`CListChatPopupState` contains phase/pending count only. Window handles, opaque
channel names, per-load client IDs, command IDs and content remain private. A
credential-free channel name is passed in the popup URL fragment; it isolates
presentations, without creating an authorization boundary against same-origin
code. Popup reload replaces the client identity and expires old commands/results.
Main request IDs suppress duplicate dispatch; pending/completed acknowledgements
belong to the original channel/client/session. Success means the existing helper
returned, not confirmed peer delivery or completed collaboration publication.
There is no automatic resend or crash/acknowledgement timeout recovery.

The popup retains failed/unacknowledged drafts and clears acknowledged text only
when unchanged. Main teardown disables the client and releases listeners/channel
resources; presentation reopen focuses a live owned window. Old unload timers and
close packets cannot close replacements. Existing message/card rendering remains
view-owned and otherwise follows its previous trust/sanitization behavior.

`CListChatCardsState` exposes card/busy counts only. The main card controller keeps
detached packet/invite snapshots, row identities, callbacks and editor captures
private. Import/invite dispatch retains open-ended extensions and captured anchor
nodes. Pending actions lock one card; expired sessions/detached rows suppress old
callbacks and completion feedback. After editor loading, reference insertion
requires the original row/session/editor handler and switch generation. This does
not cancel a legacy handler's internal asynchronous document writes or detect
every same-editor newer-draft edit.

Card link URLs retain their exact string after HTTP(S) validation; invalid schemes
become literal labels without navigation/Load controls. Collection imports keep
the original member data while popup presentation receives safe link projections.
Main collaboration-invite text relayed as popup HTML is escaped. Existing card
APIs remain compatibility wrappers.

Outgoing Share now uses `CListChatShareState` (phase/busy only); its private record
holds detached reference/text, source row guard, chat session and prior discussion.
The last selection replaces a waiting-peer selection; duplicate clicks on the same
waiting source reuse it. Running creation/dispatch blocks another queued share.
Removed/replaced rows, expired sessions/sources and changed discussions invalidate
continuations. Preparation retains the existing title/author fallback, whitespace
collapse and truncation limits without rereading live content after peer readiness.

Automatic Create passes captured name/visibility to the existing controller and
reads a private receipt/phase/name outcome. It never overwrites current form
values. Only accepted/complete matching creation allows broadcast. Read-only or
local Create recovery does not implicitly share; another explicit Share is needed.
Direct collection/annotation shares retain their call signatures and extensions;
producer-owned type/kind/username/msgId fields cannot be overridden by extensions.
Collaboration invitation remains a synchronous boolean indicating at least one
local send acceptance. Each operation uses detached packets and captured current
channels once; failures are uncertain and replacements are skipped. Local preview
failure does not resend. Progress completion is not proof of peer delivery.

`CListChatMessagesState` contains a busy count only. Detached message packets,
dedup IDs, sender/recipient captures and signature results stay private. Incoming
text must be a string, with an optional string msgId; other legacy extension
fields survive normalization. Missing IDs receive an owned generated ID. The
shared session dedup set is reserved before signature verification so concurrent
duplicates cannot render or relay twice. New/replaced recipients after capture
are skipped. Closed origin/session/root or removed local output invalidates late
results. Other packet types are delegated to the separate peer-control normalizer.
Cancelled outgoing signing/DOM continuations reject while their caller remains
current, so a popup cannot acknowledge an unsent message and clear its draft.

The view treats sender labels as literal text and separately sanitizes message
body HTML before and after existing decoration; popup labels are escaped. The
existing sanitizer and generic transcript helper move into that view module.
Verification true/false/null keeps the existing marker and permissive relay
behavior; signature verification does not authenticate arbitrary display labels.
Transport failures produce visible uncertainty without retry. Actual crypto/key
loading and legacy decoration workflows retain their own internals.

`CListChatControlState` exposes known-peer/identity/pending-Follow counts only.
Peer lists require a nonempty string ID and unique string peers; username updates
require a nonempty string name, nullable string DID claims and nullable object
public JWK. Normalization detaches packets before mutation. Missing identity/key
claims replace old claims, and duplicate equivalent announcements reuse the current
join row. This is structural validation, not DID/key authenticity verification.
Peer registries use null-prototype objects to support IDs such as `constructor`.

Join/Follow records capture the original channel, identity generation, row and
auth token. Replacement/source/root expiry disables stale callbacks; the existing
Follow API receives its guard so its own persistence workflow can expire safely.
Tokens/keys/peer IDs stay private. Identity replies project only explicit public
fields. Service announcements retain exact HTTP(S) URLs, reject unsafe replacements
without changing the previous cache, and clear explicit absence. Expired sessions
expose no announced stores. Outbound discovery/handshake sends use captured current
channels once, exclude discovery origin and report uncertainty without retry.

`CListChatIdentityState` exposes phase, signing availability and pending sign/verify
counts only. Captured target/session, encryption keys, decrypted private keys,
ciphertext, peer JWKs and signatures remain private. Identity reads use a captured
hosted public DID URL or the Local identity helpers, with source checks after each
await and a ciphertext reread before accepting a private key. The direct storage
read uses `CList.keys.DID_IDENTITY_KEY`; no key generation or storage writes occur.
Public announcements omit private JWK `d`. Missing keys preserve unsigned chat;
ordinary crypto failures produce visible feedback and null/unknown results.
Stale signing or verification against replaced peer keys rejects completion.
Shared Ed25519 helpers retain their standard Base64 contracts; the chat workflow
converts to/from the existing unpadded Base64URL wire format. Loading and announcing
identity have separate outcomes: failed announcements do not discard loaded keys.

`CListChatHeartbeatState` contains phase (`idle`, `waiting`, `sending`, `expired`)
and busy only. Endpoint, auth token, discussion name, peer ID and ownership guard
stay in a private timer capture. One POST runs at a time. Stop/replacement expires
saved callbacks and late responses. Source, service, peer and discussion must
still match before sends and completion effects. A 401 expires the timer; HTTP
and network failures produce feedback and allow the next scheduled minute tick.
No immediate retry, abort of in-flight HTTP, or server publication guarantee is
provided. Existing heartbeat interval alias is maintained for compatibility.

`CListChatCollaborationState` contains busy only. Chat transcript HTML, discussion
name, selected API and pending promise stay private. Capture DOM rows in the view;
the pure preparation workflow filters empty rows and descendant share cards and
wraps the last 15 eligible row HTML strings in paragraphs. Empty context remains
null, preserving the existing collaboration API contract. Duplicate pending
commands coalesce; replaced session/discussion/transcript or disposed controllers
reject queued dispatch and suppress stale feedback. Already dispatched legacy
collaboration work remains governed by its existing editor lifecycle; the boolean
dispatch result is not proof of document creation or invitation delivery.

Chat link decoration has no persistent state. A recognized presentation model
contains link and literal sender only; nonmatching messages retain their original
content. The existing case-sensitive first quoted/bracketed HTTPS URL/`etherpad`
substring heuristic is preserved, without establishing service authenticity.
The view decodes serialized HTML entities once before assigning the URL, uses
text nodes for metadata and returns HTML to the existing sanitizer/relay path.
Safe ordinary link navigation is preserved; no live Etherpad session is opened
by preparation/rendering.

`CListSummaryState` exposes phase/busy only. Source HTML, AI endpoint/key, generated
text and Load callbacks remain private. Requests preserve the existing model,
prompts, token calculation and empty-result fallback; nonstring response content
is rejected. Source capture omits header/action controls and the captured summary
output itself. Pending duplicates share an operation; changed input supersedes
old results. Reader/session/account/node replacement invalidates completion and
Load controls. The result uses literal text and an output-specific content ID,
then delegates current-user Load intent to the existing editor API. No automatic
AI retries, external publication or editor mounting cancellation is implied.

`CListTranslationState` holds enabled/pending only. Input, API key, source/session,
form nodes and deadline ownership remain private. One captured key is used for
both Google detect and translate requests, with English/`und` short-circuits and
HTML-format English output preserved. Disabled timed calls and missing keys
return original text without requests. Ordinary service failures visibly fall
back to original text; the five-second timed wrapper still rejects on timeout
for existing reader fallbacks. Late detection cannot start translation after
expiry, but already-started HTTP is not aborted. Pending counts describe owned
controller work, not remaining transport activity after timeout.

The stored preference name remains `translationEnabled`, accessed through
`CList.keys.TRANSLATION_ENABLED`. Restoration performs no writes; failed saves
leave the prior setting intact. Concurrent reader rows remain independent.
Manual form requests coalesce duplicates and protect newer text/replaced nodes,
source/account/preference changes. Form results use literal text; reader results
remain HTML passed through the existing service normalization/rendering paths.

`CListTemplateRequestState` exposes pending count only. Account endpoint/key,
session fingerprint, prompts/history and generated text remain private. Account
loading completes before one detached credential capture; source replacement
or loading failure prevents transport. Every response, JSON parse and continuation
checks the original session and selected credential values. The legacy GPT-4,
2000-token and assistant-message continuation contract remains; content strings
concatenate without formatting changes. Unknown finish reasons, malformed content
and empty `length` continuations reject without retry. Independent calls retain
independent histories. Already-started HTTP/account loading is not cancelled.
The legacy form/fence helper/loader remain separate, with no new form or editor
ownership guarantees from this request boundary.

`CListTemplateFormState` contains phase/busy only. Draft choices, generated
content, operation guards and the loader result promise remain private. DOM
events update controller-owned choices; Generate captures custom-or-selected
type and format. Duplicate pending submissions coalesce. Editing choices expires
the old intent without automatically sending another request; explicit Generate
can start the new draft. The optional request caller guard is checked before
account loading, after awaits and before continuations.

Success retains fence extraction and returns `{type:'text/html'|'text/plain',
value:string}` to the existing loader boundary. Back/removal/replacement/session/
editor expiry settles null. Cancel is idempotent; stale errors cannot affect the
new panel. Mutation observation cleans externally removed idle forms; action and
completion checks enforce ownership independently. The view owns progress/error
feedback locally and never mutates the shared loading indicator. No actual HTTP
abort or downstream editor mounting cancellation is implied.

`CListCollabDocumentsState` exposes phase/count/opening only. Captured server,
auth token, account records, document rows and callbacks stay private. Listing
reads use the original session token and resolved selected/default server.
Unreadable account reads fail closed. Server data must be an array of entries
with nonempty string IDs and nullable/string titles; detached presentation rows
retain ID and title only, preserving order and existing local-name fallback.

The self-managing loader still returns null. Rows reject duplicate pending opens,
replaced list/container/session callbacks and old request generations. Opening
receives a detached record, captured server and source/request guard. The existing
editor-opening hook owns mounting/connection/title changes; the list boundary
does not abort its internal asynchronous dependencies or WebSocket work. After
an opening handoff removes the list, current-session errors may use a status
notice. No live connection or downstream draft protection is implied by listing
tests, whose opening hook is mocked.

`CListCollabPreparationState` exposes phase/pending only. Credentials, account/
session/editor fingerprint, element/status nodes, module references and commit
guard are transient private captures. Local and remote preparation share one
generation; a newer start expires the earlier one. Recheck after server lookup,
dependency loading and immediately before resource replacement. Configuration
retains selected/override server, read/edit behavior and legacy anonymous token/
name fallbacks. Dependency/server failures propagate to existing callers.

Preparation cannot construct/destroy editors or sockets. The `collab.js` adapter
uses captured credentials/store/identity/element in its existing constructors
only after the commit guard passes. Old lookup/import work is not aborted;
resource cleanup, provider callbacks, awareness and reference observers remain
on their existing implementation. Mocked preparation evidence does not verify
those lifecycles or live authentication/WebSockets.

`CListCollabConnectionState` contains phase/remote only. Resource handles, map
entries, participant names, credential/configuration captures and timer/listener
callbacks remain private to the owned local/remote resource set. Construction
uses the prepared values. Replacement/failed construction invalidates the old
set before detaching map/awareness listeners, clearing its timer and destroying
editor, provider and Y.Doc. Cleanup continues after failures and is idempotent;
failed destroys are reported without a guarantee of release or automatic retry.

Status/authentication/awareness/reference/timer callbacks reject replaced sets,
expired sessions and replaced editor nodes. Connections remain active while
their mounted editor is hidden; reference merges are limited to visible Collab
and read their original map, retaining structural metadata. Corrupt map entries
produce owned feedback. Presence names render literally with vetted colors.
Captured chrome nodes reject incidental replacement; intentional reactivation
rebinds the active connection view. Local startup releases remote resources and
clears the remote document identity/presence. Expiry cleanup occurs on activity,
not through a newly installed idle session observer. Real vendor synchronization,
authentication and reconnect behavior remain outside mocked validation.

`CListCollabFormattingState` exposes enabled/count only. Command definitions,
captured editor, event listeners and selection/active flags stay private. The
view renders active/pressed/read-only state from controller-provided values;
DOM classes are not input state. Commands retain Bold/Italic/H1–H3/Bullet list/
Ordered list/Blockquote chains and run only for the owned editable editor/bar/
session. Reentrant dispatch is locked. Saved events and controls cannot target
new editors or rebuilt bars; disposal attempts both event removals once and keeps
failed-detach callbacks inert. Failures produce owned feedback, and only a later
explicit command retries a failed command. Existing resource/activation bridges
dispose and rebuild formatting controls as required.

`CListCollabTitleState` exposes phase/busy only. Raw/expanded titles, candidate
document/server, credential captures, editor identity and action callbacks stay
private. Duplicate checks use a 500ms debounce, guarded namespace expansion and
captured auth/server. Blank/current documents skip HTTP; 404 is available and
other failures are visible with explicit Retry. Warning/Load choices are driven
by the current private candidate rather than DOM inspection.

Duplicate actions coalesce. Title edits, source/editor/document/panel changes,
old timers and saved choice callbacks reject stale work. Existing loading uses
the checked server and passes its caller guard through preparation. Successful
loading normalizes both title fields only while the original intent is current.
Mirroring/paste/Enter listeners are captured and detached on rebuild. Enter's
new-document fallback and the pasted-link API retain their existing delegated
behavior; started HTTP and downstream editor work are not generically aborted,
and editor body draft protection remains outside this title-only boundary.

`CListCollabShareState` contains phase/busy/receipt only. Document/server/token,
settings value, links, discussion/session/resource references and write registry
remain private. Reads accept boolean `allow_anonymous` (missing/null retains the
legacy false default); malformed/failed reads disable changes rather than treating
the setting as known. PATCH sends only changed confirmed boolean intent with the
captured token, fixing the old free-variable credential access.

Write dispatch records uncertainty until a response arrives. 2xx is accepted,
ordinary 4xx rejected, and network/408/429/5xx uncertain. Uncertain settings remain
indeterminate/locked until an explicit successful GET; a later explicit user
change may retry. A private per-target registry keeps pending/uncertain locks
across panel rebuilds, and late results cannot repaint replacement panels. These
are client guards without durable receipts, backend CAS or cross-client ordering.

Copy captures its link and uses the shared clipboard helper with an optional
`isCurrent` feedback guard. Chat validates the captured discussion/session owner
and sends only public invite fields. Post passes captured mode/link/title and a
document-context guard into the existing composer; text is escaped at its HTML
boundary. Composer internals and actual clipboard/chat/publishing effects are
outside the panel fixture's mocked evidence. Local acceptance is not delivery.
Direct compatibility helpers first validate the active resource set; expired
connection aliases are cleared before any new credential/target capture.

Collab Post composer presentation state contains only `phase` and `busy`.
Draft content, TinyMCE instances, temporary editor handlers and completion hooks
remain private. Restore only the owned editor slot; reject delayed instances
and callbacks after replacement. Publication captures its original completion
hook and first content snapshot; later edits remain in the composer. Completion
retains workflow semantics and does not confirm remote publication success.

`CListCollabOpeningState` exposes phase/busy only. Links normalize decoded
namespace/document IDs, edit/read mode and HTTP(S) origin to WS(S). Invites
capture only document ID, optional title/mode/server; missing mode means edit,
missing server uses existing configured-server resolution. Reject empty/control
IDs, unsupported modes and credential-bearing/unsupported server URLs before
editor effects. Duplicate pending targets share one promise; newer targets,
session changes, editor switches/replacement and disposal invalidate old work.
The adapter passes ownership through existing connection preparation, commits
literal titles after setup and treats expired preparation as cancellation.
This does not await provider synchronization or verify live access permissions.

`CListCollabCreationState` exposes phase/busy only. Collection creation snapshots
URL/title projections for HTML export without replacing membership data or
extensions; chat captures its context/title/time before asynchronous selection.
Namespace expansion is guarded against newer connection intent. Links/invites
and creation cancel each other's pending controllers, while existing preparation
and resource lifecycle arbitrate actual connections. Seed callbacks retain the
exact editor/document/server, session/discussion and selected DOM/editor owner.
The 800 ms callback seeds once only when the resource remains empty and has had
no update events, including edits later deleted. Clear timers/detach listeners
on replacement/completion, retaining inert guards for already queued callbacks.
HTML serialization/sanitization belongs in the view. Invites use captured dispatch
and connection metadata; failures never undo the document or automatically retry.
Setup is not a synchronization barrier or server-side creation receipt.

`CListCollabHeaderState` exposes busy/action only. Header controls capture the
current document or local title, source/editor ownership and citation time before
dispatch. Share uses the captured target; local creation revalidates input,
resource and connection intent before using shared preparation/lifecycle. One
pending action locks both controls. Annotation prepares a `CListReference` with
the exact read link, captured title and ISO citation time, then dispatches the
existing blank-content load and pane reveal only while the original target is
current. Rebuilt/disposed headers and stale failures cannot affect newer UI.
This action boundary does not migrate editor mounting or insertion internals.

`CListCollabContentState` exposes phase/busy only. Loads/link/via operations
capture editor/shared map/document, mounted nodes, selection/session source and
source-row reference before editor callbacks. Reuse the shared `pushReference`
deduplication; keep the live reference object and open-ended fields. Shared-map
serialization writes captured JSON only to the original map. Presentation owns
HTML serialization, plaintext escaping, editor insertion and reference feedback.
Check ownership between insertion, reference push, display and mirroring; reject
read-only writes and reentrancy. A later attribution failure leaves the inserted
content intact and visibly fails without automatic reinsertion.

Resync reads all raw records before clearing the local reference list, preserving
the existing list on iteration failure. Parse valid JSON objects, skip corrupt
records with a visible warning and retain raw map entries. Parsed references
retain structural metadata/extensions; no new saved-reference shape is added.
Editor mounting and real TipTap/Yjs synchronization remain outside this slice.

`CListCollabMountState` exposes phase/busy only. Mounting captures the selected
editor/session/account/switch generation and write-pane target, coalesces duplicate
pending activation and keeps the existing surface/resource set on reactivation.
The view owns surface construction, one-time styles, title display and the captured
drop listener; replacing activation releases the listener without destroying
background editor/provider resources. Deferred library/local/pending-content
completion requires the original selection/source/surface. Local preparation uses
the shared caller guard; newer connection intent or title edits are preserved.
Failures propagate `false` to editor mounting, with owned visible feedback.
Shared pending-content loading retains its own contract: guarding dispatch does
not abort a loader already started. Full editor switching, vendor resource behavior
and live WebSockets remain outside the isolated mounting fixture.


Collection draft editing uses `collection-draft-state.js` (DOM-free transitions),
`collection-draft.js` (private row/action controller) and `collection-draft-view.js`
(DOM and feedback), wired by `collection-editor.js`. Initial members are shallow
copies preserving open-ended extensions; `_draftItems` remains the same live array
used by Save/import/local-entry publication. Storage/member schemas are unchanged.
Reorder/remove rebuild row generations; expansion remains private and follows the
member object. Field baselines reject callbacks that would overwrite a newer
external field value. Source/session, actual row attachment and disposal reject
obsolete controls. `CListCollectionDraftState` exposes generation/count/row-busy
only; member data, ownership targets and credentials stay outside public UI state.
Save/publication's explicit identity-display reconciliation adopts metadata-only
source replacements without invalidating current fields. Existing opening/import/
publication APIs retain ownership of their internal effects after dispatch.


Etherpad connection discovery uses an explicit captured read target (API instance,
key, proxy and auth headers). `readEtherpadPads` returns a string list or throws,
without UI or global account reads. `etherpad_connection.js` retains these values
privately; `CListEtherpadConnectionState` contains phase/mode/count only. The view
owns actual root/iframe attachment, list controls and errors. Guest addresses use
HTTP(S) origins without userinfo and encoded pad names; guest mode invalidates
account-list continuations. Hidden resources survive editor switches within the
same auth source; account/auth replacement disposes the owned iframe. Document Create/author/content/Share paths use the separate document boundary
described below. Connection-panel checks alone do not cancel their effects.


Etherpad document operations now use `etherpad_document_requests.js` (explicit API
and relay transport), `etherpad_document_workflow.js` (Create/seed/read/append),
`etherpad_document.js` (captured operations and transient receipts) and
`etherpad_document_view.js` (feedback, captured optional inputs and literal Share).
`etherpad.js` retains handler/compatibility entry points. `CListEtherpadDocumentState`
contains phase/busy/receipt only; full request bodies, targets/keys/headers, pending
callbacks and creation records remain private to the original connection.

Selection reads an existing pad rather than creating it. Create captures its
name/username before the first await, coalesces duplicates and records acceptance
before later preparation. Only a newly confirmed, observed-empty pad receives
welcome text. Accepted partial initialization reopens without another Create or
seed; uncertain Create blocks replay and directs the user to refresh/select the
pad. These are transient, connection-scoped records, not reload durability or
server idempotency. The observed-empty check is not a remote compare-and-swap.

Append preserves read/merge/write semantics, escaping plaintext and preserving
HTML input. It captures one account/guest pad and headers for the entire sequence,
checks ownership before writing and only adds references after accepted writes.
Started writes can finish after navigation, without adding references to another
pad. Reference failure retains accepted content and does not request reinsertion.
Rejected/uncertain writes propagate to shared loaders with visible owned feedback;
none is automatically retried. Guest import requires an explicit successful result.
Exports accept empty strings and propagate invalid content/errors. Remote edits
between read and write can still conflict; the refactor does not provide server
concurrency control or cancel already-dispatched operations.

Share builds literal DOM with validated HTTP(S) links and captures discussion and
recipient channel identities before dispatch through the existing chat API. Pending
duplicates share one operation; a new Share after settlement is an explicit action.
Local chat dispatch is not proof of remote delivery. Shared-link opening validates
and decodes its pad, guards session/superseded completion, and retains the existing
editor switch API; these checks do not cancel that API's internal mounting.


LaTeX connection preparation uses `latex_connection_preparation.js` with the existing
`createCollabConnectionPreparation` factory. Its private snapshot holds original
server/token/username/auth source, account, root/editor/status/title/input nodes and
load/switch generations. Namespace expansion has its own captured intent; an expired
expansion cannot supersede a newer prepared connection. Lookup/library errors
propagate rather than silently choosing another server; expired failures are
classified separately for owned feedback. Before replacing resources, `latex.js`
asserts the prepared guard and uses captured modules, provider token/kvstore URL and
editor parent. `latexConnection` reuses the safe `CListCollabPreparationState` shape
(phase/pending only). This boundary does not own provider callbacks, observers,
resource teardown, compilation or Share, and does not cancel dispatched work.


LaTeX editor/provider/Y.Doc ownership now uses `latex_resource.js` and
`latex_resource_view.js`. Each resource set privately retains its prepared target,
map observer, awareness listener, delayed presence callback and captured vendor
objects. `_cmView` is not introduced: the existing `cmView`/provider/map/document
aliases in `latex.js` are installed/cleared together for compatibility.
`CListLatexResourceState` contains phase only. No vendor objects, references, tokens
or callback closures enter presentation state.

Background resources remain alive across editor selection and toolbar rebuilding.
Only visible LaTeX merges reference callbacks into the shared list; callbacks read
their captured map, and corrupt entries are retained with owned visible feedback.
Reactivation rebinds current status/presence nodes. Source/root/editor expiry is
checked on resource activity and activation, not by a continuous monitor.
Replacement invalidates callbacks before cleanup, detaches observers/listeners,
clears the owned timer and attempts editor/provider/Y.Doc destruction even after
one cleanup fails. Cleanup errors are reported, not proof of actual socket closure.
Constructors that fail internally before returning an object remain vendor-owned;
partial resources returned to the controller are cleaned. Compilation, Share,
content insertion and full vendor synchronization remain separate concerns.


LaTeX toolbar actions now use `latex_controls_workflow.js` (explicit compile
transport and source serializers), `latex_controls.js` (private compilation/PDF
ownership and Share captures), `latex_controls_view.js` (toolbar/modal/feedback)
and `latex_content.js` (captured synchronous editor/reference commands).
`CListLatexControlsState` contains phase/busy only. Source bodies, tokens, resource
identities, PDF URLs, reference objects and callbacks remain private.

Compile captures the original source/token/fetch before requests. Duplicate calls
share a pending promise across rebuilt panels; stale source/session/panel results
cannot install a PDF or display late errors. Owned URLs are revoked on replacement
or resource invalidation. Returning to an unchanged source can rebind the last PDF;
a downloaded result is a source snapshot, not an automatically updated document.
Compile progress has its own status node so provider status does not overwrite it.
Share captures document/server/title and binds Copy to its exact live modal/source,
using the existing guarded clipboard helper without inline JavaScript.

Content commands capture the actual editor/map/read-only mode, use CodeMirror
selection accessors explicitly and guard reentrant calls. HTML-to-text conversion,
LaTeX citation escaping and single-block bibliography refresh preserve prior
formats. Live reference identity/unknown extensions and exact URLs are retained;
map/reference failures after successful insertion show partial failure without
throwing a request to insert the body again. Resync snapshots the map before
replacing local references, retains corrupt records and preserves the current
reference list when map iteration fails. Full CodeMirror/Yjs execution and live
compilation remain outside mocked fixtures.


Slides saved-layout management uses `slides_layout_workflow.js` (explicit native
record reads/writes), `slides_layout.js` (captured dialog/controller/receipts) and
`slides_layout_view.js` (shared dialog shell and owned feedback). `slides.js`
retains the embedded callbacks and Save registry bridge. Existing
`CListSlideLayout` format/id/label/update and extension properties are unchanged;
no embedded source or Yjs format change is introduced. `CListSlidesLayoutState`
contains kind/phase/busy/receipt only. PageStore/editor/document/session targets,
layout updates and full receipts remain private.

Save captures one layout snapshot before opening the form. It checks for an
existing ID and supplies revision zero to native Save so an intervening ordinary
native record cannot be force-overwritten. Rename reads the latest payload,
retains extension/record/reference/publication fields and supplies its revision.
Delete preserves the existing ID-based PageStore API, including deleting a
matching layout record whose JSON has become corrupt; that API does not provide
a revision compare-and-swap between read and delete.

Source/session/document/load/switch checks expire callbacks before writes; already
started writes can finish for their captured record without updating a different
editor. Save registration uses the captured embedded instance. Accepted storage
and a failed editor update are separate, permitting editor-only retry without
another write. Unknown storage failure requires read-only confirmation inside the
live dialog before a further explicit attempt. No writes retry automatically.
Receipts are transient and not durable across dialog closure/reload. Newer typed
names survive an accepted captured-title write. Cancel before dispatch has no
reads/writes; closing after acceptance does not undo the stored record. Replaced
or externally removed modal surfaces settle their original callbacks, and old
controls cannot close a newer modal. These guards do not establish real embedded
rendering, native durability or cross-tab delete concurrency control.


Slides application import/export orchestration now uses `slides_io_workflow.js`
(explicit file/layout reads), `slides_io.js` (captured dispatch/lifetime) and
`slides_io_view.js` (file acquisition, progress/errors and reports). `slides.js`
retains the registries and embedded-editor bridge. `CListSlidesIOState` contains
importing/exports busy counts only; files, bytes, editor/document/store/session
captures and callbacks are transient and private.

The import lock begins before opening the picker. Source expiry before or during
file reading prevents embedded dispatch. Duplicate requests for the same bytes or
picker share an operation; a different in-flight import is rejected rather than
silently receiving another request's result. Filename/100 MB picker validation and
native/fallback acquisition remain compatible. The content-first byte route does
not require a filename. The handler now returns its import promise to shared
loaders. Once the embedded import resolves, reference/report failures are reported
separately and do not request reinsertion of accepted slides.

Exports use bound methods on the captured embedded instance, retain per-format
pending locks and suppress late UI for replaced sources. PDF completion describes
opening a print view rather than a durable download. These application guards do
not abort started embedded conversion, prevent its internal downloads, or provide
same-document concurrency control inside the unchanged embedded API.

Saved-layout refresh captures list/get functions, validates current record type
and native layout identity, preserves other valid entries after per-record failure,
and reuses embedded validation/registration. New refreshes and layout mutations
expire older registry updates. Refresh remains add/update-only and does not claim
cross-tab deletion synchronization. It performs no storage writes. Snapshot's
queued reference merge captures the original post-load document and checks source
ownership before updating references; direct content imports likewise use their
original editor. No embedded source/schema or persistence format changed.


PowerPoint completion reports are deferred to the next task so a shared Load caller
can finish its modal cleanup first. Reports recheck source ownership; an existing
newer modal is retained and receives no replacement, with warnings shown through
the status helper instead. This scheduling does not delay or replay the embedded
import, and does not establish actual native-picker or converter behavior.


Dropbox initial setup uses `dropbox_setup.js` (private captured form controller),
`dropbox_setup_view.js` (scoped controls/feedback), the existing registry factory
in `dropbox_account.js` and `dropboxOAuthStart`. Guarded callers request propagated
errors; unguarded reauthorization keeps the compatibility helper feedback contract.
`CListDropboxSetupState` contains phase/busy only. App-key/title/folder drafts,
session captures, PKCE values and OAuth state payloads remain private.

OAuthClient.login now delegates preparation to `oauth_start_workflow.js`, keeping
existing strategies, dynamic registration/cache, PKCE generation, endpoint/scope/
force-login/offline parameters and state record shape. Optional `isCurrent` is
checked before work, after registration/PKCE, and before navigation; changed raw
field values and detached/hidden/rebuilt setup roots expire the caller. Inputs
are detached before awaits. A failed final guard/navigation removes only its own
new state key. Started dynamic app registration may still complete/cache; this
boundary does not undo it or cancel provider work after navigation.

`CList.keys.OAUTH_STATE_PREFIX` retains the existing `oauth_state_` value. It is
available in the main page and bootstrapped by OAuth config for the standalone
callback page; both producer and callback reader use the same prefix. The callback
page loads the shared preparation dependency. Token exchange, callback ownership,
account writes and post-authorization refresh behavior remain unchanged and are
not newly validated by the setup fixture. No account/storage format changed.


OAuth callback account saving now delegates through `oauth_account_workflow.js`,
`oauth_account.js` and `oauth_account_view.js`. `OAuthClient.saveAccount` keeps its
compatibility arguments and returns a safe status/refreshed result. The controller
detaches account values, supplies a title fallback for the shared account validator,
and preserves service extension fields. `CListAccountSession.put` is an optional
captured persistence dependency; ordinary callers retain the existing KV facade.
Hook validation, encryption and session assertions stay in shared `saveAccount`.

Save-time ownership captures cookie username/token, server, normalized auth epoch,
Local mode and KV facade before awaits. UI username restoration alone does not
expire an otherwise identical cookie session. Reader/editor/modal captures guard
optional provider refresh/navigation dispatch; once dispatched those legacy hooks
retain their own internal ownership semantics. A later source/session change can
allow an already-started original write to finish, without installing accounts or
navigating the new session. Account reads reuse `loadAccountRecords` with a fresh
key under the captured session. `CListOAuthAccountSaveState` holds phase/busy/receipt
only; full account values, keys, ciphertext, operation callbacks and sessions stay
private. Success/refresh failures are distinct.

Pending identical saves coalesce; accepted transient receipts avoid repeated writes.
Receipt reuse requires the original storage/session context to remain current.
Unknown dispatched-write failures retain the exact attempted ciphertext and require
read-only KV confirmation before a further explicit retry. A matching stored value
permits account refresh without another write; unconfirmed state requires review
and an explicit retry. Failed refresh retries only reads/UI work. There are no
automatic account writes or token exchanges in recovery. Receipts are not durable
across reloads. A newer modal is preserved rather than replaced by delayed recovery;
status feedback is used when the original surface has changed.

The save-only fixture above establishes save-time capture. Standard OAuth start,
exchange and pickup now additionally use the binding protocol described below.
Live service authorization, real encryption and full startup/navigation integration
remain outside the mocked evidence.


## Standard OAuth callback binding

`OAuthClient.login` captures cookie username/token, selected store URL and Local
mode before any await. SHA-256 of those values becomes the private flow `issuer`
fingerprint; raw CList credentials are not added to flow/result storage. In-page
guards also compare auth epoch; the epoch is deliberately absent from the digest
so a normal page reload can complete its original redirect. This is client-side
session ownership, not an OAuth/OIDC provider issuer claim or an XSS defense.

The existing per-state sessionStorage record gains `issuer` and `createdAt`.
`oauth_callback_workflow.js` consumes it before one token exchange. Denial, expired
(30 minutes), old unbound state, malformed response and network failure require a
new authorization; exchange is never automatically retried. On acceptance the same
key holds `CListOAuthFlowReceipt` (`phase: exchanged`, fingerprint, provider and
original timestamp), without verifier/client secret. The callback result adds
`flowState`/`issuer`; token and service extension fields retain their existing shape.

`oauth_callback.js` owns shared pickup and registration, waiting until all deferred
providers register. It checks the tab's exchanged receipt, age and current-session
fingerprint before consuming result/receipt and dispatching one detached payload.
It compares the result again after hashing to preserve a newer callback. Failure
feedback is view-owned; invalid results are retained so another tab's valid result
is not erased. Restarting authorization replaces the shared result slot. There is
no automatic handler/exchange replay. Storage errors fail visibly. The receipt is
tab-scoped; another tab cannot claim it simply by reading the shared localStorage
result. The single result slot still does not queue simultaneous completed flows.

Mastodon/Dropbox callback handlers receive `{isCurrent}` and forward it to account
saving, which checks both its save-time source and original callback source before
encryption/persistence/recovery effects. Already dispatched HTTP or writes are not
cancelled. `oauth_callback_view.js` renders restart feedback without tokens. WordPress
now uses the same original-session guard and shared pickup, with its separate
application-password transport described below. No account record format changed.


## WordPress application-password binding

`wordpress_auth*` splits explicit redirect/return preparation from captured start
control and error presentation. The existing form forwards a guard for its root,
generation and raw site input. Start captures the original cookie session and
configuration before hashing; pending starts coalesce and stale form/session work
cannot persist or navigate. Failures are visible and permit an explicit retry.

The success and reject URLs carry random `wp_state`; reject also carries
`wp_denied=1`. The per-state sessionStorage record uses the existing prefix and
stores pending provider/site, fingerprint and timestamp, without CList credentials.
The app UUID derives from the existing cryptographically random flow identifier.
Site normalization accepts HTTP(S), removes trailing slashes and rejects embedded
credentials/query/fragment. Returned `site_url` must exactly match the requested
canonical origin/path; deployments redirecting to another canonical address must
restart with that address. Account keys and stored account fields are unchanged.

The callback workflow consumes a pending record once, checks denial/30-minute age,
site and complete credentials, then replaces it with `CListOAuthFlowReceipt` plus
optional `siteUrl`. The result retains `siteUrl`, `userLogin`, `password` and adds
`flowState`/`issuer`. Accepted receipt storage contains no application password.
A replay cannot erase an accepted receipt awaiting pickup. Shared pickup now
requires binding for WordPress too and compares the result site with the receipt.
The handler carries the original-session guard through account encryption/write.
Old unbound WordPress returns fail closed and require a new authorization.

The existing hosted-HTTPS-to-local-HTTP relay is preserved, forwarding the flow
identifier and returned fields; ports must be in range. The hosted intermediary
does not read a local tab's receipt. The callback shell handles storage/validation
failures visibly and scrubs callback parameters on failure as well as success.
This preserves the existing relay transport, not a verification of its deployment,
live WordPress behavior or full application startup. No automatic credential-save
or authorization replay is added.


## Mastodon account setup boundary

`mastodon_setup.js` supplies service-specific validation and OAuth delegation to
`account-setup.js`, which owns private form captures, mutually exclusive OAuth/manual
operations, session lifetime and guarded completion. `mastodon_setup_view.js` owns
literal DOM fields and busy controls, reusing `account-setup-view.js` feedback/recovery. The factory in
`mastodon_account.js` retains one controller across form remounts. Public
`CList.state.mastodonSetup` contains phase/busy/receipt only; tokens, drafts, source
captures, save jobs and callbacks remain private. Account formats are unchanged.

Manual saving reuses `createOAuthAccountSaveController`, `persistOAuthCallbackAccount`,
`saveAccount`, and the owning panel's account reload. The shared controller supplies
its captured source as an optional third save-dependency argument and second
install-dependency argument; existing adapters ignore them. Mastodon's adapter
combines shared session ownership with the original mounted/raw draft before
encryption and dispatch. Session-owned accepted writes can finish after the form
changes, without closing the new form or repopulating a newer reader. Normal
completion retains panel finish/list refresh. Post-write refresh errors retain
accepted receipts and retry only reads; uncertain writes require a read-only check
before explicit original-request retry. A remount retains pending/uncertain locks
and check/refresh recovery; pre-write retries still require the original unchanged
draft. These guards do not cancel already dispatched storage operations.

The OAuth helper accepts optional `{isCurrent, feedback:false}` for form-owned
failure reporting. Legacy reauthorization calls retain their existing feedback.
The form captures raw values before asynchronous work and passes its guard to the
existing bound OAuth start. Read/write scope and force-login behavior are retained.


## Blogger account setup boundary

`blogger_setup.js` validates and normalizes the Blog ID, Client ID and title into
the unchanged `CListAccountSaveRequest`: key is Blog ID; account data retains
`type: Blogger`, Client ID in `id`, title defaulting to Blog ID and `permissions: w`.
`blogger_setup_view.js` renders literal controls/help and captures raw field values.
`blogger.js` keeps its existing factory and unchanged publication/token functions.
No Google token is requested during setup; publication-time authorization remains
on the existing path and no Google access token is stored by setup.

`account-setup.js` extracts the already-tested Mastodon form controller and shared
save adapter for both services. It retains pending/recovery locks across remounts,
pre-write draft/session guards, captured account targets, accepted/uncertain
receipts and original-form-only pre-write retries. `account-setup-view.js` shares
inline failure/check/retry presentation; service views still own their fields.
`CListServiceAccountSetupState` describes phase/busy/receipt under `bloggerSetup`
and `mastodonSetup`; full fields, ciphertext and recovery closures stay private.
Shared save/loader APIs own persistence, and normal finish/list refresh remains
panel-scoped. Blogger refresh updates post choices, preserving newer readers and
drafts. An already dispatched write may complete after form/session expiry; no
client guard cancels it. There are no account-record format changes.


## WordPress setup form boundary

`wordpress_setup.js` owns captured raw site input, form/source lifetime, pending
and redirect locks. `wordpress_setup_view.js` renders literal fields/help, standard
buttons and inline feedback; `wordpress.js` retains the factory bridge. One
controller survives remounts and rejects detached/replaced controls while keeping
the pending start locked. `CList.state.wordPressSetup` contains phase/busy only
(`CListWordPressSetupState`), never the URL, fingerprint or session.

Validation uses the existing `normalizeWordPressAuthSite`; form-owned guards pass
through `wpAuthStart` into `wordpress_auth*`. The auth controller accepts optional
`onError` to route current form failures inline; callers without it keep their
existing feedback. Back, raw input edits, hidden/remounted roots or changed cookie
sessions expire pending work before persistence/navigation. Redirect and callback
receipt formats, site/session binding and account writes remain unchanged.


## Collab account setup boundary

`collab_setup_workflow.js` validates explicit ws/wss server input and returns the
unchanged account request (WebSocket URL key/instance, `type: Collab`, server title,
`permissions: e`). Registration still uses HTTPS `/api/register` for both ws/wss,
Bearer authentication and `{did}` JSON. The DID is captured from the cookie-owned
username and KV server before awaits; transient UI username restoration cannot
change its identity. Credentials/query/fragment URLs fail before registration.

`collab_setup.js` supplies protocol details to `account-registration-setup.js`,
which keeps source/form captures and registration receipts private,
with `CListCollabSetupState` phase/busy/registration/account receipt only. A 2xx
records acceptance before parsing JSON; a malformed accepted response can continue
account saving explicitly without another registration. Network/5xx/408/429
outcomes remain uncertain and never auto-replay. A definite remaining 4xx permits
explicit registration retry. There is no assumed registration-status endpoint:
the uncertainty action asks the user to check the service before explicitly retrying.

The controller reuses shared account setup dependencies, save/encryption/loader
and account-write receipts. Account-save or refresh recovery never repeats accepted
registration; uncertain account writes use the shared read-only check. Root/input/
session guards run before service dispatch and account persistence; a started HTTP
request or KV write may finish after expiry. Remount retains locks/receipts while
newer forms/readers are preserved. Success uses guarded panel finish/list refresh
instead of the old unguarded 1200ms delayed close. `collab_setup_view.js` owns literal
controls/feedback and reuses shared inline account recovery.

`registerCollabAccount` remains a compatibility data API, now taking the captured
`CListAccountSession`, using the extracted transport and shared `saveAccount`.
It does not retain the setup controller's registration receipts. Default post-login
`collabSetupAccount` descriptors and their separate add-only workflow are unchanged.


## Annotate account setup boundary

`annotate_setup_workflow.js` validates explicit HTTP(S) server/title/permissions,
performs credential-free `/health` reads, and POSTs `/api/register` using the original
Bearer/Content-Type headers without a body. A successful registration needs no JSON
body (including 204). HTTP acceptance is retained before post-await ownership checks.
Account key/instance stays the server URL with a trailing slash removed; title is
required, permissions default to rw, and `type: Annotate` is unchanged.

`annotate_setup.js` and `annotate_setup_view.js` own default/custom choices, literal
fields and guarded startup health feedback. Checks capture source, raw draft, root
and generation; changed choices, Back, connect, rebuilt/hidden panels and newer
validation/registration/recovery feedback invalidate late probes. Failed health
checks are read-only and may be explicitly retried. An accepted registration is
not repeated when account encryption/save/list refresh needs recovery.

Collab and Annotate now use `account-registration-setup.js` for pending/remount
locks, source/draft guards and private per-server registration receipts. Their
transports remain service-specific. Uncertain registration needs explicit retry
after external review; uncertain account writes reuse read-only shared checks.
`CListAccountRegistrationSetupState` describes phase/busy/registration/receipt under
`collabSetup` and `annotateSetup`, with no fields, credentials or callbacks in state.
As with Collab, success uses guarded finish/list refresh instead of an unguarded
delayed close. Dispatched work is not cancelled by these ownership checks.

`registerAnnotateAccount` remains a data-only compatibility helper using the
extracted health/registration transport and shared `saveAccount` with captured
`CListAccountSession`. Its progress callback remains supported; controller receipts
are not retained by the helper. Default post-login annotation descriptors and their
separate add-only setup workflow are unchanged.


## Discord account setup and admin channels

`discord_account.js` retains the registry and edit-form hook. Subscription logic
uses `discord_setup.js`, presentation/decorator uses `discord_setup_view.js`, and
service requests live in `discord_setup_requests.js`. `discord_admin.js` and
`discord_admin_view.js` own separate bot-token scopes and captured channel commands.
`CListDiscordAccountSetupState` describes phase/busy/receipt only under
`discordAccountSetup` / `discordAdminSetup`; account values, bot tokens, webhooks,
headers and pending commands stay private. Returned list rows retain literal
name/ID only, stripping other service response fields from presentation data.

The existing relay URLs and payloads remain: `/channels` uses captured KV headers;
admin list/guild reads use captured bot-token query parameters, while Create/Add/
Delete use captured JSON bodies. Path IDs are encoded. A partial guild read failure
keeps available channel rows and explicit feedback. A 2xx command is accepted
without requiring JSON. Definite 4xx failures (except 408/429), uncertain transport
outcomes and later list refresh failures remain distinct.

Subscription selection comes from captured account records, never DOM classes.
Adding reuses shared `saveAccount` with captured KV `add`, preserving the existing
Discord data shape (`channel`, empty `bot_token`, rw permissions). Removing uses
the original stored key and rechecks current context and decrypted stored metadata
before dispatch. There is no server compare-and-swap; another client can still
race the final removal. Unknown adds compare exact attempted ciphertext on read;
unknown removals confirm absence. Unconfirmed state requires explicit original
retry; refresh after accepted writes never repeats them.

Admin actions capture bot token, selected IDs and command fields before awaits,
expire replaced rows/tokens/sessions/hidden surfaces, and serialize pending writes.
Unknown outcomes require a successful read-only list review, followed by explicit
Keep listed result or Retry original change; no automatic remote command retry is
introduced. Manual review is not a guarantee of server-side exactly-once execution.
Accepted writes retain read-only refresh recovery. Newer admin input is preserved
rather than rebuilt by a late completion. Already dispatched requests cannot be
cancelled by these guards. Reusing a panel retains its original input/controller
ownership; new edit input nodes receive their own captured admin controller.


Discord admin write receipts and pending promises are also retained in a private
account-panel coordinator keyed by captured session and bot-token scope. Rebuilding
the add-account DOM cannot bypass an existing pending/uncertain/accepted receipt.
The new view can review or refresh the original outcome; it cannot silently start
another command. These captures remain transient and are not reload-durable.


## Personal Options

`personal-options.js` owns preference values and panel lifetime; explicit persistence
is in `personal-options-workflow.js`, DOM/theme/TinyMCE work in
`personal-options-view.js`. `kvstoreOptionsPanel()` remains a compatibility bridge.
`CListPersonalOptionsState` holds dark/web booleans, busy and phase only. Reads do
not write defaults. An active-panel generation rejects old connected or hidden
controls. Pending toggles coalesce; storage errors keep runtime/visible preferences
unchanged. Accepted preference writes and display failures are distinct, with a
captured display-only retry that never rewrites storage.

`CList.keys.DARK_MODE` retains `clist-dark-mode` and its 1/0 values;
`CList.keys.WEBMENTION_ENABLED` retains `clist_webmention_enabled` and true/false
strings. Keys are bootstrapped before early theme restoration and retained by the
main namespace. Storage-denied theme restoration no longer throws out of its script.
WebMention's existing setter persists before changing its runtime flag; a failed
write cannot silently enable it for publication. Actual WebMention sending is
unchanged. Theme application retains `clist-dm` content styles and reports editor
failures rather than swallowing them.

`personal-options-transfer.js` owns panel/file/password handoffs into existing
account-transfer APIs. It captures the source session and rejects replaced/stale
callbacks before dispatch and visible completion; confirmation inputs and payloads
stay private. `parseLocalAccountExportFile(file, {feedback:false})` optionally throws
data errors so the panel owns feedback; default callers retain their existing
modal/null contract. Null JSON is rejected safely. Confirmed import completion is
separate from account refresh, which can retry without importing again. Host,
skipped keys and feedback use literal DOM text; source usernames are escaped before
the existing trusted-HTML confirmation helper.

The original Options-only fixture above establishes handoff behavior. Account
transfer data operations now additionally capture source/destination and receipts,
as described below. Dispatched writes/downloads still cannot be cancelled. No
account-export format or stored record shape changed.


## Captured account transfer data operations

`account-transfer-workflow.js` owns validation, explicit cryptographic preparation,
add-only import and read-only reconciliation. `account-transfer-controller.js`
captures cookie identity/server/token/auth epoch/Local mode/KV facade and binds
list/get/add before awaits; production also captures the existing password
confirmation key-version snapshot. Optional caller ownership is checked at each
asynchronous boundary. Facade calls are guarded immediately before dispatch; the
existing Local/remote adapters then retain their own per-call contexts. Source or
destination changes cannot redirect later rows to a newer account. An in-flight
original write can finish, but its acceptance is recorded before checking expiry.

`CListAccountExportPayload` retains the v1 wire format, opaque ciphertext rows,
original username/digest/timestamp and input extensions. Missing/null legacy kv
means an empty bundle. Invalid rows, duplicate keys or ambiguous storage reads fail
closed. Export detaches listed ciphertext before crypto awaits and captures the
download function/filename; it still relies on the existing verified password
confirmation. Download handoff is not proof of a durable saved file. Imports
independently verify the source password digest and derive both keys before writes.
Payloads and passwords are never interpreted as instructions or rendered as markup.

Private import plans retain captured ciphertext, derived CryptoKeys and per-row
ready/accepted/existing/uncertain status, never passwords or decrypted records.
Existing destination keys are preserved; each remaining row is rechecked and uses
KV add, not put. AlreadyExists preserves concurrent data under the facade's
add-only contract; backend durability/concurrency is not established by mocks.
Accepted/existing receipts are not replayed, even if a record is later deleted.
Partial errors stop the run and retain completed receipts. Uncertain writes require
a read-only list check: exact attempted ciphertext confirms acceptance, differing
data is preserved as existing, and absence enables a further explicit retry.
Checking never resumes writes by itself.

`createAccountImportOperation` coalesces pending run/check calls and exposes safe
result/current/run/check methods; plans stay in closures. Compatibility import
returns imported/skipped plus complete/remaining/uncertain/error fields. Incomplete
imports throw AccountImportIncomplete with a transient operation handle for UI
recovery. `personal-options-transfer.js` passes its source guard through the data
APIs, accepts single-use password callbacks and renders Check import status or
Retry remaining imports. Complete imports reuse refresh-only recovery. Passwords
are not needed again for that original operation; a changed key/session expires it.
`CListAccountTransferState` exposes only phase/busy and count summaries. Receipts
are transient, not durable across reloads. No automatic import/overwrite retry or
new user-account creation is introduced.


## Existing-account OAuth reauthorization

`account-reauthorization.js` owns one pending authorization per reusable schema
form, captured requests, redirect lock and status. `account-form.js` keeps controls
and inline literal feedback. A form build captures its cookie/session/server/Local
mode/auth epoch through the existing OAuth issuer helpers. Rebuilding invalidates
old controls while preserving the pending lock until the original attempt settles.
Source/visibility, form generation, base metadata identity, raw field values/types/
checkbox state, input node identity and edit revision are revalidated at async
boundaries. Manual token mode also expires an in-flight authorization. A normal
account-list refresh that retains the same form/fields does not itself invalidate it.

`CListAccountHooks.reauthorize` accepts optional `CListAccountReauthorizationOptions`
as a second argument. Mastodon and Dropbox forward `isCurrent` and caller-owned
`feedback:false` into their existing guarded helpers; direct callers omitting the
options retain legacy helper feedback. The generic controller captures the hook
and detached `CListAccountSaveRequest` before awaits, coalesces duplicates, rejects
repeat dispatch after an accepted redirect and displays owned preparation errors
inline without replacing newer UI. `CListAccountReauthorizationState` contains
phase/busy only, never credentials or account request data.

These are preparation/redirect lifetime guards. Started client registration work
is not cancelled or undone. A late invalidation after OAuth state persistence is
handled by the existing start workflow's removal of only that flow's state. Shared
callback session binding and token-save behavior are unchanged, and are outside
the new fixture's round-trip evidence. Custom hooks that ignore the supplied
guard do not acquire stale-response protection merely by using the controller.
