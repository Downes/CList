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
