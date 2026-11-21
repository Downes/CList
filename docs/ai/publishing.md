# Publishing instructions for AI coding tools

Read this document before writing or changing code that supports or affects
publishing: service adapters, editor exports, account/session handling, workflow
state, publication tracking, or result/progress UI. Read the affected implementation
as well. This document describes contracts, not a substitute for checking code.

For the human explanation, callable service reference, and detailed current
behaviour, see [How CList publishes your work](../publish_structure.md). Consult
[js/clist-types.js](../../js/clist-types.js) and
[data-contracts.md](../data-contracts.md) before changing a data shape.

## Current work boundary

The user has authorized collection editor work after the incoming pull. Preserve
current editor behaviour and unrelated working-tree changes. Collection **Post**,
**To Web Page**, and direct **Republish** now share a separated controller/workflow/view.
**Publish local entry** uses its own small controller with the existing shared
web-page workflow. Preserve the reviewed behaviour of each publishing path.

## Maintain these responsibilities

| Responsibility | Current source | Required boundary |
|---|---|---|
| Ordinary post capture/controller | [publish.js](../../js/publish.js) | Capture editor inputs, own operation lifetime, load accounts, record results, and invoke views. |
| Ordinary publication workflow | [publishing-workflow.js](../../js/publishing-workflow.js) | Explicit dependencies and plain updates/results; no controls, selectors, modals, or global-state reads. |
| Ordinary progress/results view | [publishing-view.js](../../js/publishing-view.js), [ui.js](../../js/ui.js) | DOM and existing feedback components; no external publishing writes. |
| Standalone page controller | [web-page-publishing.js](../../js/web-page-publishing.js) | Capture editor/page/session, await a version choice, guard operations, reconcile only the original active source. |
| Standalone page workflow | [web-page-workflow.js](../../js/web-page-workflow.js) | Explicit adapter/storage/identity dependencies; distinguish external publication from metadata persistence. |
| Page choices/results view | [web-page-view.js](../../js/web-page-view.js) | Standard buttons, choice promises, and feedback; no adapter or metadata writes. |
| Published-page identity/indexing | [web-page-records.js](../../js/web-page-records.js) | Preserve identity/authorship and compatibility with file saving; no UI. |
| Local file saving | `file-save.js`, `file-save-workflow.js`, `file-save-view.js` | Capture export/editor/session, write before indexing, distinguish native write from browser handoff, and reconcile only the original editor/page. Keep native/raw formats and session-scoped handles. |
| My Pages | `my-pages-state.js`, `my-pages-workflow.js`, `my-pages.js`, `my-pages-view.js` | Guard captured rows/session, validate the latest standalone destination, keep uncertain deletions indexed, and retain confirmed-delete receipts for metadata-only retry. Controls and inline feedback belong to the view. |
| Dropbox file operations | `dropbox_session.js`, `dropbox_save_workflow.js`, `dropbox_save.js`, `dropbox_save_view.js`, `dropbox_picker.js`, `dropbox_picker_view.js` | Preserve captured account/folder/body, native formats, explicit overwrite and accepted receipts. Only definite 401 allows refresh/retry; no uncertain upload replay. Views own feedback and pending choice cancellation. Collection exports reuse the save controller. |
| Service API operations | Service files, including `mastodon_publish.js`, `bluesky_publish.js`, `wordpress.js`, `blogger.js` | Use explicit account/session values. Return data or reject; never display publication feedback. |
| Annotation publishing | `annotation-workflow.js`, `annotation-publishing.js`, `annotation-view.js`, `annotate_publish.js`, `hypothesis_publish.js` | Explicit captured targets/session; per-target receipts; transport has no feedback. |
| Collection browse/import/member operations | `collection-session.js`, `collection-workflow.js`, `collection-browser*`, `collection-import*`, `collection-members*`, `collection-opening*`, `collection-entry-*` | Preserve latest record extensions/publications, explicit conflicts, independent duplicate memberships and captured original drafts. Views own choices/feedback; accepted writes reconcile only current owners. Collection Save/publication remains separate. |
| Collection Post / To Web Page / Republish | `collection-publishing.js`, `collection-publishing-workflow.js`, `collection-publishing-view.js`, [collection-publishing.md](../collection-publishing.md) | Capture collection/account/session before awaits; state owns selection/busy; workflow emits data; view owns choices/results. |
| Local-entry Publish | `collection-entry-publishing.js`, `web-page-workflow.js`, `web-page-records.js` | Capture member/session/account/authorship, retain receipts, and reconcile only the unchanged original member; feedback remains in the collection view. |

Plain browser JavaScript remains the deployment architecture. Do not add a
framework, TypeScript conversion, bundler, or end-user Node requirement. Keep
service-specific functions with their service. Subdivide using
`service_feature.js`, aiming for files below 500 lines. Reuse the existing
registries, helpers, and icons rather than introducing parallel dispatch systems.

## Ordinary publisher contract

Register an ordinary publisher as `window.CList.publishers[accountType]`.

```js
window.CList.publishers.MyService = {
    construct(title, content) { return removeHtml(content); }, // optional
    async publish(accountData, title, content, refs = [], options = {}) {
        // Perform this service's authenticated operation using the passed account.
        // Report data through options.onProgress/onWarning when appropriate.
        // Return the published URL, or null only when no publication link is known.
        // Throw/reject actual failures; let the invoking controller display them.
    },
};
```

The snippet is an interface outline, not a complete service. Match a real service's
schema and credentials. Do not copy `accountData.id` as a bearer token without
checking what that field means for that service.

- `publish` resolves to a URL string or `null`, not a bin result or aggregate
  workflow result. Never convert a caught authorization/API failure into `null`.
- Keep references and options optional. Reply context is scoped by
  `refs[].replyToken.type`. Each destination receives a detached reference copy.
- `construct` is synchronous and returns a string. It runs before ordinary
  length measurement; do not perform remote writes in it.
- `acceptedFormats` describes collection serialization preferences, not the
  ordinary editor export or the destination's character limit.
- `options.onProgress` receives data such as `{stage, completed, total}`.
  `options.onWarning` receives a string. Neither callback grants the adapter
  ownership of UI elements. Keep optional callbacks safe for callers that omit them.
- The ordinary workflow, direct controller, and collection callers currently
  supply warning presentation. If adding a new caller, wire that presentation in
  the caller rather than restoring modals inside the adapter.

## Bin/page adapter contract

Register serialized-resource destinations in `window.CList.binPublishers[type]`.
Preserve the existing signatures:

| Operation | Signature | Contract |
|---|---|---|
| Publish | `publish(content, mimeType, titleOrFilename, accountData)` | Resolve `{url, serviceId}`. The third argument is adapter-specific. |
| Update | `update(serviceId, content, mimeType, accountData)` | Update that resource; resolve `{url}` where available. |
| Delete | `delete(serviceId, accountData)` | Delete if supported; report an unsupported operation explicitly. |

Do not replace these with ordinary-post signatures. Check the current adapter:
CListBin, Gist, JSONBin, and 0x0 have different authentication and capabilities.
For example, the 0x0 adapter explicitly rejects update/delete. A registry method
being present does not establish that the operation is supported.

Personal feed membership saving uses `CList.readers[type].saveCollection` and
is not public publication. Do not merge it with bin or ordinary post publishing.

## Editor content and snapshots

- Ordinary posting uses `capturePublicationRequest()` and
  `packagePost({forPublishing: true, ...})`. Preserve awaited `getPostContent()`
  when offered, otherwise awaited `getContent()`. This is how rich/collaborative
  editors supply their contents; do not read their mounting container as content.
- Standalone web pages use `_getWebPageEditorContent()`: prefer
  `getPublishContent()` returning `{type, value}`, otherwise the native getter
  and content type. Preserve native Save behaviour separately. Slides must not
  become a JSON payload in an article because an adapter read the wrong getter.
- Capture title, destination keys, references, loaded-page identity, editor
  identity, and applicable account/session values before asynchronous operations
  can redirect them. Keep content capture through the editor API.
- Work with detached request/account/reference snapshots. A service mutation
  must not alter another destination's references or the live draft.
- HTML parsing for output conversion or identity embedding is allowed. Reading
  application controls from an adapter/workflow is not.

## Authentication and destination isolation

Use the selected account passed to the publisher. Do not scan all accounts and
silently pick another, or reuse a shared reader session. Bluesky publishing
creates an explicit selected-account session without changing its reader cache.
Do not regress this when introducing caching or session refresh.

For standalone pages, keep the captured session checks before external writes
and metadata writes. CListBin's existing adapter uses the current KVStore bearer
token, while other services use their own fields. Use `CList.keys` for cookie/key
names. Do not log tokens, passwords, or entire authenticated session responses.
Credentials stay transient and outside operation summaries and published records.

Ordinary post account loading still uses the legacy `getAccounts()` wrapper.
Review its retained authentication/UI behaviour when changing account-store or
session semantics; the standalone page session guards do not establish that all
other publication paths already use those guards.

## Ordering, limits, and references

Preserve full-content-first ordering based on positive account `maxlength` values.
Missing/invalid/nonpositive limits are treated as unrestricted. A later short
destination can use the first earlier publication URL. Without one, retain
explicit truncation feedback. Do not replace this logic with fixed service-name
ordering or have each service independently fetch live editor contents.

Keep service limits too: Mastodon checks available instance metadata; Bluesky
applies its existing 300-grapheme limit to cleaned text. Preserve reply IDs and
Bluesky parent/root references. Multiple compatible reply targets use the first
and produce a warning rather than silently promising several threaded replies.

## Outcomes, errors, and tracking

Treat these outcomes separately:

1. A service returns a publication URL: report publication success.
2. A service throws/rejects: report that failure once and retain meaningful detail.
3. No usable link is returned: report an unconfirmed result, without implying it
   is safe to repeat the write.
4. Publication succeeds but indexing/metadata fails: keep the published result
   and report the metadata failure separately. Never repeat the external write
   merely to retry tracking.

Do not automatically retry an uncertain external write. Preserve API-provided
error detail and the distinction between an accepted response with incomplete
information and a rejected request. For Blogger, preserve both OAuth and popup
error callbacks so an authorization failure settles the operation.

Workflow status `complete` means attempts finished; inspect each destination's
status. Keep busy/result state in `CList.state.publishing` and
`CList.state.webPagePublishing`; DOM attributes reflect it rather than define it.
Preserve cleanup after failure/cancellation and the guards that prevent ordinary
posting from erasing an outstanding web-page version choice.

Native PageStore documents and encrypted `page:*` publication metadata are
different records. Preserve local document identity, HTML identity embedding,
plain-text contents, My Pages indexing, and verified DID alias/derived-copy
behaviour. Overwrite requires a captured matching service/account/resource.
Reconcile the loaded-page pointer only if the original editor/page is still active.
Keep `_saveWebPageRecord` / `_touchOrForkWebPageRecord` compatibility for file saving
and the existing `showRepublishStatus` UI for collection republishing. The old
`_findAccountForPage` compatibility controller has been removed after migration.

## Verification and maintenance

For a publishing change, run the existing relevant tests from
[tests/README.md](../../tests/README.md). The current automated suite runs with:

```powershell
node --test tests/*.test.cjs
```

Use mocked service/storage responses for regression tests; do not create a live
post merely to verify a refactor. Exercise the behaviours affected: editor APIs,
captured inputs, account isolation, full-first/link handoff, warnings/progress,
partial failures, missing links, metadata-only failures, page switches, busy
guards, and cancellation.

Where browser integration is affected, use the documented browser fixtures.
Report automated results, browser results, and live authorization checks
separately. Do not call an unrun check passed. Validate new script references and
deferred loading order; keep `interface.js` last.

Update JSDoc in the same change as a contract. Keep this guide and the
[combined human guide and technical reference](../publish_structure.md)
consistent with the implementation. Mark remaining legacy paths explicitly;
do not present a proposed interface as already implemented. Show refactoring
scope/edits for the user's review before applying them, and do not commit or push
without the user's instruction.


## Annotation publishing requirements

Use the shared `CListAnnotationRequest`, `CListAnnotationReceipt`,
`CListAnnotationOutcome`, and transient `CListAnnotationSession` contracts.
Post supplies captured references/tags/session through publisher arguments;
never replace them with live editor/global reads. Preserve the service-specific
tag policies and the Send/Flow differences documented in the human reference.

Use `options.onTargetResult` for detached receipts, not UI. Confirmed creation
and link availability are separate: a successful HTTP write without a link is
created, an opaque ID is not a browser URL, and network loss is uncertain.
All explicit target failures reject once after receipts; partial success retains
both successful and failed targets. Never label failed targets Annotated.

Keep shared in-flight guards in the annotation controller. Capture session,
account, target, tags, visibility, and return-editor context before awaited
editor exports. Reject stale controls/session changes before writing. Only
return from Send when the original editor, target, body, and return context
are still active. Keep incoming HTML/reference append behaviour unchanged.
Flow may try another store after explicit rejection, never after uncertainty.
Collection prompts use the successful captured reference; reuse `collectItem`
and do not move collection editing into annotation publishing.

Run `node --test tests/annotation-publishing.test.cjs` and the full automated
suite. Tests mock network/editor APIs; they do not establish live authorization
or real-browser TinyMCE integration. Keep these verification limits explicit.


## Collection Post and To Web Page requirements

Use `CListCollectionPublicationRequest`, `CListCollectionPublicationOutcome`,
and `CListCollectionPublishingDependencies`. Requests contain transient account
snapshots; never persist those requests or put credentials into operation state.
Capture the title, raw membership, format, identity, existing publication entries,
loaded-page pointer, destination accounts, and session before asynchronous work.
Flatten only the detached export copy. Preserve raw membership in saved records.

Selection and in-flight status belong to `CList.state.collectionPublishing`.
Button attributes/styles reflect controller decisions. Preserve full-content
(bin/unlimited platform) destinations before limited link destinations, format
negotiation, and the first full-content URL handoff. Only the captured matching
collection/service/account/format/resource can be overwritten after a choice.
Cancel must settle without service writes. Guard the shared choice/result panel
against competing Save/Post/To Web Page operations while publication is pending.

Check the captured session before each external write and metadata write. Keep
publication receipts if metadata or catalog updates fail; never repeat an upload
to recover metadata. Reconcile only the original active collection, retaining
newer draft title/items. `_updatePagesCatalog` accepts optional session checks and
error propagation for the new controller; older callers retain their defaults.

Run `node --test tests/collection-publishing.test.cjs` and the full suite. These
mocked tests do not establish real-browser integration or live authorization.


For collection To Web Page, call `postCollectionToWebPage()`; it invokes
`runCollectionPublication` with `{webPage: true}`. Do not recreate a parallel
collection web-page workflow. Capture draft/format/identity/loaded-page context
before awaiting account/key loading. Resolve one writable CListBin account,
snapshot it, and reuse format negotiation and the standard overwrite choice.
Overwrite must match the collection, service, instance, format, and resource.

Keep the transient `CListCollectionPublicationSession` outside operation state.
The shared busy guard covers To Web Page through account loading, choices,
publication, and metadata updates. Successful metadata may reconcile the original
collection, preserving newer title/items. Set a loaded-page pointer only when the
original editor, collection, loaded-page context, title, and membership are still
unchanged. An upload without a URL is unconfirmed, with no fabricated page record.
UI option construction belongs in `collection-publishing-view.js`, using the
existing public icon/account-button pattern and shared disabled-state rendering.


## Direct collection Republish

`window.republishCollection()` invokes the shared controller with
`{republish: true}`. Capture the draft, loaded publication and session before
account/key loading. Resolve exactly its original service/instance with bin
permission, require update support, preserve the loaded format (not the current
format selector or a newly negotiated format), and update its captured service ID.
Do not display a version-choice prompt or fall back to new publication.

The request's optional `republish` flag tells the data workflow to call the
explicit `touch` dependency after a successful update rather than saving draft
members over the collection record. `_touchPublishedUrlEntry` receives captured
credentials/session checks, original identity/service/account, and strict missing
record/entry handling. Preserve stored title/members while updating the timestamp.
A touch failure is metadata-only: retain published status and do not repeat the
remote update. Do not regenerate the catalog in this direct path; preserve its
existing timestamp-only metadata policy.

Republish feedback lives in the view. Use the original status indicator only
while the captured editor, collection, loaded page, and draft are still active;
otherwise show a general result without altering the newer page's indicator.
Reuse `CList.state.collectionPublishing` for all duplicate/overlap guards.


## Local-entry Publish

`_publishLocalEntry(item, refresh)` is now in `collection-entry-publishing.js`.
Reuse `runWebPagePublication` with `mode: 'new'`, `page: null`, the captured blob
contents/MIME/title, and the captured CListBin account/session/authorship. Use
`_embedWebPageIdentity` and `_saveWebPageRecord(record, session)`; do not recreate
the upload or page-index workflow in the collection editor. The collection's
loaded-page pointer must not become this leaf page's pointer.

Use the shared collection busy guard. Keep per-entry receipts in
`CList.state.collectionPublishing.entryAttempts`, a WeakMap of
`CListLocalEntryReceipt` keyed by the original member. Receipts contain no
credentials and are scoped by public store/user identity and blob source URL.
A fulfilled result, including a missing-link result, is replayed for the same
source instead of repeating its upload. Changed blob sources can publish anew.
Thrown read/upload failures release the guard for an explicit retry; never
retry writes automatically or retry an upload merely because metadata failed.

Only replace the member URL/clear localOnly/revoke the captured blob when the
original editor/collection/member array still owns the unchanged member and the
captured session is valid. Keep changed/removed members and newer collections
untouched. A confirmed upload can reconcile its unchanged member even if My Pages
metadata failed; the view reports that metadata error separately. Retain the
receipt/link if reconciliation is skipped. Refresh failures must not discard
an already successful upload. Run `tests/collection-entry-publishing.test.cjs`
and the full suite; mocked checks do not prove real-browser/live authorization.

Discord publishing in `discord.js` propagates missing-channel, bridge/API and
network failures to the invoking controller. It preserves the selected account's
channel, existing KV-authenticated `/send` request, and HTML-to-text conversion.
A successful bridge response without a link returns null; failures never return
null or display modals inside the publisher. Reader/account UI remains separate.

The ordinary Post panel is rendered by `CList.ui.publishing.mount()` and
`selection()` in `publishing-view.js`. `populatePostOptions()` remains a thin
controller compatibility entry point for account refresh: reconcile selected keys,
then pass detached selection/busy values and action callbacks to the view. The
view never reads selection from buttons or changes `CList.state.publishing`.
`makeWebPageOption()` remains available from the view and accepts its action as
a callback. Save destinations use `save-state.js`, `save-panel.js`, and `save-view.js`.
`playSave`/`populateSaveOptions` remain compatibility functions in `save-panel.js`.
Keep the registered saver's no-argument method call and `{keepOpen:true}` result
contract; service-owned forms and exports remain in their current modules. The
pending Save lock survives panel rebuilds. Preserve pending service UI controls
when replacing the destination list; Dropbox awaits its overwrite/cancel buttons. Guards own dispatch and completion UI,
not cancellation/capture of a legacy saver's internal asynchronous data operations.
Use `tests/save-panel.test.cjs` plus the full Node suite and the Save browser fixture
for this boundary; mocked UI evidence does not establish actual saved files or
remote writes.

Editor source attribution is collected in the document References list, not a
separate last-loaded-source block. Preserve `pushReference`/`getReferences`, URL
deduplication, collaborative maps and per-editor/document reference park/restore
when changing editor loading or link insertion. Publication snapshots must still
include the full list and its reply tokens. `tests/editor-references.test.cjs`
checks real handlers with editor APIs mocked; its browser fixture uses real DOM
with a mocked TinyMCE API. Neither establishes live collaborative connectivity.

The generic feed arrow (`clistAnnotate`) must dispatch to the active editor's
`insertLink` capability and collect attribution there. Do not switch it to
`annotate-edit` or let an inactive annotation draft redirect insertion. Explicit
annotation navigation (Alt+A or the References panel's annotation action) remains
separate. Capture the target handler at invocation and await its insertion errors.

References now use `references-state.js` (plain list/panel transitions),
`references.js` (captured controller and compatibility APIs), and
`references-view.js` (display-only rows and callback-driven edits). Inline edits
retain live reference-object identity required by existing Annotation field
handlers; pure helpers preserve all structural/reply/extension fields. True
editor/document loads expire old controls, while a Save/publication metadata
update leaves the current panel and unfinished fields usable. Explicit Annotate
captures a detached target with a null reply token and checks switch completion
before inserting it. Collection Save passes a detached list to the existing
picker/storage helper; its internal async UI/writes remain a legacy path. Run
`tests/references-panel.test.cjs`, `tests/editor-references.test.cjs` and the full
Node suite, plus the References browser fixtures. Live shared-map edit/delete
propagation is not established or migrated by this boundary.

Write-tag selection uses `tags-state.js`, `tags.js`, `tags-view.js`, and explicit
collection storage/encryption in `tags-workflow.js`. `getWriteTags()` still returns
a detached, exact-case array and `clearWriteTags()` remains the blank/New hook.
Tags and unsubmitted text retain their existing global scope across editors.
Collection suggestions are session/server/mode scoped. New collection creation
uses add-only encrypted JSON `[]` at the existing `collection:<name>` key, without
changing collection serialization or overwriting existing records. Confirmed
AlreadyExists and a failed/uncertain write remain different outcomes. Guard every
key/encryption/write boundary against a changed session and never automatically
retry. Tags tests mock KV/crypto; they do not establish live authorization.

Existing DID-key publication uses `did-publication-workflow.js`,
`did-publication.js` and `did-publication-view.js`. Keep captured stored-key/session
checks, matching-document reconciliation, uncertainty checks and receipts separate
from account/collaboration refresh outcomes. Generation/regeneration, Update DID,
removal and migration remain separate paths; do not infer that the new publication
controller guards those legacy write lifecycles.

First-time identity generation uses `did-generation-*` and add-if-absent storage,
then reuses existing-key publication with an expected did:key guard. Preserve the
stored-key receipt across publication failures/uncertainty; never regenerate to
retry publication. Regeneration/key rotation remains a separate legacy workflow.

Confirmed key rotation uses `did-rotation-*` plus the shared one-shot
`sendDidPublication` transport. Preserve the captured original key/public identity,
latest linked metadata, accepted replacement and publication receipts, and explicit
read checks/continuation after uncertain outcomes. Do not retry by generating a
new key or roll back automatically. Follow-up refresh failures are separate from
accepted rotation. Update DID, removal and migration remain separate.

DID removal uses `did-removal-*` with separate key/document receipts and captured
target checks. Reconcile uncertain outcomes by reads before explicit remaining-step
retries; never replay accepted steps or restore a key automatically. Migrated key
operations share mutation-busy checks; legacy Update DID/migration Run are only
wrapped at dispatch, with their internal lifetime still separate. UI refresh failure
after accepted removal must not become another delete attempt.

Public-account Update DID uses `did-update-*` and shared publication transport.
Preserve state-owned choices, captured account/private-key/catalog/profile versions,
separate visibility/publication receipts and explicit remaining-step recovery.
Retain credentials/extensions and unmapped public links; never silently discard
unreadable metadata. Migration remains a separate legacy internal workflow.


Migration preparation/preview uses `migration-preparation-workflow.js`,
`migration-preparation.js` and `migration-preparation-view.js`. Capture all inputs
before awaits; fail closed on unreadable source or failed/malformed destination
lists. Keep registration side effects explicit, retain accepted/uncertain receipts
across panel rebuilds within the captured source session, and never automatically
repeat registration. Run consumes one state-approved plan after checking both
record snapshots. Execution now uses `migration-execution-workflow.js`, `migration-execution.js`,
`migration-execution-view.js` and `migration-identity-workflow.js`. Private plans
retain each ciphertext and accepted/uncertain copy/publication receipt. Read-only
Check migration reconciles remote results before an explicit Retry remaining steps;
never repeat accepted steps or fall back from add conflict to overwrite. Recheck
source/destination records and public documents before each write, and guard after
every asynchronous boundary. Preserve captured local/hosted identities and public
metadata. Reuse `sendDidPublication` for one-shot identity writes; HTTP failure
must not become success feedback. Recovery is tab/source-session scoped, not
persistent across reload or a new login; expired destination authorization stops
rather than silently changing credentials. Mock registration/login, copy/link
writes, storage and crypto in regressions. No client-side reads provide server CAS.


Auth form and account-server picker now use `auth-panel-*` state/controller/view.
Capture form mode/credentials before dispatch; keep passwords and attempts out of
UI state. Preserve registration validation, exact server choices/Local behavior,
secret clearing and the shared pending-submission lock. Persist server preference
before switching config, and distinguish a rejected preference write from accepted
selection with a failed reader refresh. While credential work is pending, the UI
blocks closing/reopening/changing servers because the existing auth helpers are
not all cancellable. `submitAuthModal` bridges private attempts to captured
`auth-credentials-*` and `auth-session-workflow.js`. Credentials use explicit
transport/crypto/storage dependencies; captured server/mode/Local-adapter/source
session guards apply before/after async boundaries. Registration receipts survive
panel replacement and distinguish created/rejected/uncertain results. A normal retry
checks login without resending an attempted registration; resending uncertain or
rejected creation requires explicit Retry registration. Never retry accepted creation.
Validate username/token/future expiry, export the encryption key before storage,
write the token last and verify saved values. On failure restore only original or
owned values and show incomplete-rollback feedback. Cookie helpers/key slots and
Local direct-adapter routing remain compatible. Post-login setup now uses
`post-login-*`, with service-specific descriptors in the existing service modules.
Capture defaults, installed session and reader generation before awaits; register
services and add encrypted records with separate accepted/uncertain receipts.
Never overwrite an existing record or recreate accepted seeds during recovery.
Public feeds seed only for registration; Local mode excludes hosted registration
and CListBin. Await all attempts before refreshing account controls once. Refresh
accounts and Check setup perform reads only; ordinary remaining-step retry must
not resend unknown service registration. Its named retry action requires the
user to check that service first. Keep late acceptance against the original
target, reject stale panel/session/modal callbacks, preserve newer reader content,
and report setup failure separately from the accepted login. Credential-only
fixtures do not establish setup coverage. Startup/logout/storage-event restoration
now uses `session-lifecycle-*`. Capture server, Local mode, cookie/tab-key values
and auth epoch before asynchronous reads; reject missing/invalid/expired sessions
without deleting their persisted values or seeding anything. Import/read failures
are separate: keep a verified identity when only account loading failed. Expire
old delayed callbacks, read completions and retry controls on source changes.
New authentication attempts and logout advance the auth epoch so an old direct
credential helper cannot install a session after logout, including an originally
empty source. Logout verifies token removal before clearing the captured user key,
legacy key and all tab draft-prefix entries. Preserve unrelated/other-server keys,
avoid repeating accepted cleanup, scope reload-only retry and report partial
cleanup without claiming remote session revocation. Legacy management `getAccounts`
and administrative workflows remain separate from this restoration boundary.

Administrative GET/PUT settings now use `admin-settings-*`, with no DOM in the
workflow. App metadata and session headers are captured before requests; only the
configured LocalRSS app gets the issuing `X-Kvstore-Url`. A Local account cannot
authorize hosted administrative settings. Desktop/mobile picker callbacks expire
on account changes, as do replaced form rows and Help callbacks. Form values,
drafts and PUT receipts stay private; public state is counts/phases/errors only.
Preserve newer text/secret edits during saves and reads. Accepted PUT followed by
an unreadable/incomplete body requires GET, not another write. An uncertain save
blocks writes until Check current settings; only a later explicit Save reviewed
changes may resend intent. Masked secrets cannot be confirmed by GET. These client
guards are not backend authorization or server compare-and-swap.

Pane commands now dispatch through `panes.js` and render via `pane-view.js`.
Preserve `closeRightPane({preserveEditorControls:true})` and the existing
Save/editor-picker/editor-controls invalidations. Revealing an editor changes
layout/focus without remounting its DOM. Signed-in/out preference names remain
unchanged; restoration applies a complete state without intermediate writes.
Drag preview never persists, and mouseup may persist only for its captured
source/profile context. Annotation/collab aliases and public pane helpers remain
compatible. Keyboard/swipe interpretation uses the separate navigation modules.

Alt+A in `navigation.js` captures the selected reference and text before
`annotateNavigationReference` reuses the existing editor-switch queue. Reject
superseded reader/session/row/selection and editor-switch completions before
dispatching insertion. These guards do not cancel an editor handler's mounting or
its internal asynchronous insertion; do not claim full draft protection from them.
