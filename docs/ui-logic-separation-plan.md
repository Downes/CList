# Separating CList application logic and UI

## Current checkpoint — 2026-11-20

This checkpoint supersedes the historical implementation notes below. Shared
account management, publishing workflows (including collection publication),
central reader dispatch and LocalRSS, editor load/switch/drafts/Load-Blank,
Save panel, References and Tags now have extracted boundaries. Service-owned
internals behind those boundaries still migrate individually. Tags browser
verification passed on 2026-11-19. Find now separates query/request/controller/view
and migrates OpenAlex/Commons to captured guarded search contexts; the Find browser
fixture passed. Google/DDG/OASIS internals now use captured requests and shared
row controls; their browser fixture passed user testing (17 checks).
Local file saving now separates captured export/controller, explicit write/index
operations and filename/result UI. My Pages separates state, listing/loading/delete
workflow, controller and view. Dropbox saving, collection uploads, token-refresh
sessions and the file picker now have separated modules and mocked Node/browser
checks; initial OAuth setup remains on its existing path.

The user-approved remaining order is:

1. Find/search — current slice implemented; retain legacy provider compatibility.
2. File saving internals, My Pages and Dropbox save/picker — implemented and checked.
3. Collection browsing, imports, membership operations and member-opening workflows
   — implemented; 554 Node tests pass. All four collection browser fixtures and
   adjacent saved-file recognition passed user testing after the JSON member fix.
   Existing collection Save/publication boundaries and draft row widgets remain in use.
4. Remaining service readers and row actions — implemented in the working tree;
   all six browser fixtures passed user testing (shared rows 14, Mastodon 13,
   Bluesky 15, Discord/public feeds 15, annotations 14, plus LocalRSS).
   The full Node suite passed 597/597. Mastodon, Bluesky, Discord, public feeds
   and annotations now use captured contexts/views. Shared and LocalRSS row
   controls retain targets in closures rather than HTML. Google/DDG/OASIS
   internals are now implemented as a small follow-up: 604/604 Node tests pass,
   with the new browser fixture passing user testing (17 checks); a fixture-only
   selector correction subsequently passed 23 focused Find Node tests. OpenAlex/Commons row controls now use the shared callback binder (606/606 Node
   tests pass; updated Find browser fixture passed user testing, 28 checks). Annotation controller
   presentation cleanup is now implemented (607/607 Node tests pass; updated
   annotation browser fixture passed user testing, 20 checks). The next area is authentication/identity,
   to be scoped as a small separate slice after validation.
5. Authentication, identity/DID/migration and administrative settings. First small
   slice: Me → Following workflow/controller/view implemented; 613/613 Node tests
   pass, Following browser check passed user testing (17 checks). Login and DID/migration/admin paths
   remain on their existing implementations. DID identity display and public
   account listing now have separated read workflow/controller/view (620/620 Node
   tests pass; browser check passed user testing, 18 checks). Identity write/removal/migration
   lifecycles are outside this read-only slice. Prove Same Identity is now a
   separate workflow/controller/view (626/626 Node tests pass; extended DID browser
   fixture passed user testing, 27 checks). Publish Existing Key now has a separate workflow/controller/view (635/635 Node
   tests pass; extended DID browser fixture passed user testing, 37 checks). Generation/regeneration,
   Update DID, removal/migration and login remain separate. Shared password
   confirmation now has workflow/controller/view boundaries (642/642 Node tests
   pass; browser fixture passed user testing, 21 checks), preserving custom import/export
   verification and adding stale source/session/dialog guards before dispatch.
   First-time identity generation now uses add-only workflow/controller/view and
   existing-key publication (650/650 Node tests pass; extended DID browser fixture
   passed user testing, 48 checks). Confirmed regeneration/rotation now has its
   own workflow/controller/view and partial-write recovery (660/660 Node tests
   pass; extended DID browser fixture passed user testing, 62 checks). Remove DID
   now has separate workflow/controller/view and step receipts (669/669 Node tests
   pass; extended DID browser fixture passed user testing, 75 checks). Update DID and migration internals
   remain separate, with guarded mutation dispatch. Update DID and public-account
   selection now have workflow/controller/view boundaries (677/677 Node tests pass;
   extended DID browser fixture passed user testing, 85 checks). Migration preparation/preview now has workflow/controller/view boundaries,
   fail-closed record checks, registration receipts, captured approval and a revalidated
   one-use execution handoff (685/685 Node tests pass). User reported browser PASS (25 preparation,
   85 DID checks); the preparation-page layout fix was visually confirmed. Copy/link execution and
   recovery now have workflow/controller/view boundaries and a public identity helper.
   Per-step receipts, read-only reconciliation, explicit remaining-step retries and
   tab/source-session recovery pass 696/696 Node tests; the new migration-execution
   browser fixture passed user testing (35 checks; HTTP/storage/crypto mocked).
   Login/register modal validation/navigation and account-server selection now use
   state/controller/view boundaries (705/705 Node tests pass; `auth-panel.browser.html`
   passed user testing, 21 checks with effects mocked). Credential verification/
   registration and session installation now have captured explicit workflows,
   registration receipts, response validation and token-last save/rollback
   (714/714 Node tests pass; `auth-credentials.browser.html` passed user testing,
   27 checks with effects mocked).
   Post-login setup/seeding now has separate workflow/controller/view, captured
   service descriptors, per-step receipts and explicit recovery (723/723 Node
   tests pass; `post-login.browser.html` passed user testing, 22 checks with
   effects mocked). Logout/startup/storage-event restoration now has captured
   workflow/controller/view boundaries, auth epoch cancellation, validated
   restoration, scoped token-first cleanup and reload recovery (733/733 Node
   tests pass). The `session-lifecycle.browser.html` fixture passed user testing,
   24 checks with effects mocked.
   Administrative settings remain to separate.
6. Pane persistence/navigation, keyboard/mobile state and reusable action/menu contracts.
7. Collaboration/P2P chat session workflows, then remaining AI feature boundaries.

For each slice: keep current behavior, reuse registries/helpers, capture inputs
and operation lifetime, keep views free of writes, and test stale/duplicate/error
paths. DOM in views/editor widgets and HTML output serializers remains legitimate.
Commit/push only with the user's instruction. Detailed remaining scope was reviewed
against the checkout; do not treat the earlier plan's completed items as a new todo.

## Historical plan and implementation notes

Architecture and migration plan dated 2026-11-11, with incremental implementation
notes below. Each patch is reviewed separately; proposed contracts in the later
sections are not all implemented APIs.

Implementation update, 2026-11-13: the incremental Collections save work now
captures a detached request through `readCollectionSaveFields()` and
`captureCollectionSaveRequest()`. `persistCollectionSave(request, session)` is
the DOM-free storage boundary, dispatching feed saves through the existing reader
registry's optional `saveCollection` operation. `runCollectionSave()` owns save
status, duplicate-write protection, and reconciliation with the active collection.
`CList.state.collectionSaving` keeps an active-target Map and request-status WeakMap;
credentials are passed transiently, not stored in that operation state. The editor
retains ownership of the live draft. Completion preserves newer edits and leaves
a different active collection untouched. The button keeps presentation feedback.
File and Dropbox save workflows remain on their existing paths for later patches.

Account management implementation update: generic navigation/account-list code
now lives in `account-panel.js`, schema rendering/capture in `account-form.js`,
and load/save/delete operations in the DOM-free `account-state.js`. Service
extensions use `accountHooks` rather than generic form branches. `getAccounts()`
is a compatibility wrapper over the shared decoder. Successful writes and
subsequent refresh failures are presented separately; retrying refresh never
repeats a write. Identity, authentication, settings, and custom service-flow
controllers remain separate future work.

Ordinary publishing implementation update: `publishing-workflow.js` now owns
multi-destination ordering, content limits/link handoff, and structured outcomes.
It receives account/publisher snapshots and explicit conversion/update callbacks;
it has no controls, renderers, or global-state reads. `publishing-view.js` maps
updates to existing UI helpers. `publish.js` retains editor request capture,
account loading, busy lifetime, PageStore metadata, WebMentions, and completion
actions. `publishing.operation` stores safe per-destination status/progress.
The subsequent Mastodon/Bluesky extraction moved their publishers into
`service_publish.js` adapters; Blogger also now throws errors without UI.
Other legacy adapters and collection publishing/republishing remain future
work; this extraction does not claim all publishing is UI-free.

Standalone web-page implementation update: new, overwrite, and Republish now use
`web-page-workflow.js` with explicit dependencies. `web-page-publishing.js`
captures editor/source/session data, owns operation lifetime and reconciliation,
and invokes `web-page-view.js` for choices and feedback. `web-page-records.js`
retains shared identity/metadata helpers with compatibility for file saves.
Destination matching, stale-page protection, busy guards, and metadata-only
failure outcomes are verified independently of a browser. Collection publication
and republishing are not included in this extraction.

## Assessment

The feedback identifies a real maintenance problem. CList separates services well, but many
service operations also construct interfaces and display results. A navigation change can
therefore require edits across several integrations. The existing registries, account schemas,
shared UI helpers, and PageStore provide useful foundations; they should be extended.

Original assessment examples (the implementation updates above supersede migrated items):

| Location | Current responsibility crossing | Proposed boundary |
|---|---|---|
| `js/publish.js`: `populatePostOptions`, `_postAllSelected` | Selection is written to and read from button `data-selected` attributes | State owns selected account keys; buttons reflect state |
| `js/mastodon.js`: `postMastodonStatus` | API operation accepts `responseDiv` | Data operation returns a result; controller presents it |
| `js/ui.js`: `window.CList.ui.listing` | Shared renderer inserts service-provided `statusActions` HTML | Renderer consumes action definitions, with legacy fallback |
| `js/interface.js`: `setupFeedButtons` | Existing registry already supplies feed actions | Extend this contract rather than introduce another dispatcher |
| `js/localrss.js`: feed-options panel | Service constructs panel controls and pop-out affordance | Feature view supplies definitions to a reusable navigation component |

Not every DOM reference is misplaced. `editors.js` manages UI components, so editor mounting
and control lookup belong there. Separate reusable document operations from editor controls,
but do not demand DOM-free editors. Likewise, content HTML and standalone presentation
serialization are output formats, not application interface markup.

## Target responsibilities

| Layer | Owns | Must not depend on |
|---|---|---|
| Domain/state | Selection, workflow state, validation, pure transformations | Elements, selectors, CSS, modal helpers |
| Service/storage adapter | Authenticated requests, response parsing, service-specific data, persistence | Layout and rendering |
| Controller | Action orchestration, operation lifetime, state updates, error presentation through views | Concrete markup and service-specific dispatch branches |
| View/component | DOM, form input, rendering, focus, navigation controls, accessibility | Direct remote writes or hidden application state in markup |

Prefer direct calls and promises along this path: input handler calls controller; controller
calls a registered operation; operation returns data; controller updates state and invokes a
view. A controller may depend on a view interface. Independent observers can subscribe to
state changes where needed; events are not mandatory for every operation.

No framework, new app-wide build requirement, or replacement registry is proposed.
Keep deferred script ordering and `interface.js` last. New dependencies must be initialized
explicitly before use. The slide editor's existing separate build remains separate.

## State and result contracts

Implemented shared publishing state is `window.CList.state.publishing`, containing
`selectedAccountKeys`, `busy`, and an `operation` summary with per-destination results. Use stable account keys, not labels
or credentials. Define explicit actions to toggle a target, reconcile account removal, and
begin/finish a publication. Decide and document whether opening Post preserves selections;
logout and account-store changes must clear incompatible selections. Do not persist these
selections by default.

PageStore remains the owner of saved pages and publication records. Editor/Yjs models remain
the owner of live documents. `CList.state` stores references and workflow state, not copies
of these records or secret material. View-local focus, hover, and editor internals need not
become global state. A lightweight subscribe/unsubscribe API is sufficient if multiple views
need notification; do not add proxies or a universal store before a real consumer exists.

For an extracted publisher, a proposed result is `{ id, url, status }`, with nullable fields
and documented status values. Missing links and uncertain outcomes must be explicit; an HTTP
success is not necessarily proof of public publication. Errors propagate with useful operation
context, without credentials. Do not automatically retry external writes: a timeout can occur
after the server accepted the request. A progress callback can report `{ stage, completed,
total }` without containing presentation text or DOM references.

These are proposed contracts, not currently callable APIs. Keep existing URL-returning
publisher handlers working through controller-side adapters until their consumers migrate.

## Reusable menu contract

A proposed serializable definition:

```json
{
  "id": "feed-options",
  "title": "Feed options",
  "items": [
    {
      "id": "refresh",
      "label": "Refresh",
      "icon": "refresh",
      "command": "reader.refresh",
      "args": { "accountKey": "example-account" },
      "enabled": true
    }
  ]
}
```

Use capability checks to produce availability; revalidate arguments, permissions, and current
state when executing. A command ID resolves only to a registered command. No executable
strings, raw interface HTML, credential arguments, or service-name conditionals in the renderer.
Render labels as text and constrain icon names. JSON describes the menu; a component-owned
navigation stack supplies Back and Close, rather than embedding those actions in each service.
The component owns focus restoration, Escape behaviour, accessible names, and standard buttons.

Do not introduce `context_menu_popout` merely because it was named in the feedback. First
inventory the existing left-pane, pop-out, menu, and modal helpers; extend the closest shell.
Keep feature-specific views separate from shared components instead of expanding `ui.js`
into the implementation of every screen.

## Incremental implementation

### 1. Pilot state ownership in publishing

Start with `populatePostOptions` and `_postAllSelected` in `js/publish.js`. Introduce the
small publishing state contract at namespace initialization in `index.html`, and explicit
state actions/selectors in `publish.js`. Change account clicks to update state and render
selection. Publishing reads state, never buttons. Keep the current visual layout and registry.

Acceptance: rebuilding the panel preserves the chosen policy for selection; removing an
account reconciles state; changing DOM classes cannot change publish targets; double-clicks
cannot start duplicate operations. Exercise logout/account changes and no-selection errors.

### 2. Extract one publisher operation

Pilot WordPress because its upload/post workflow already exposes progress, errors, and uncertain
results. Extract request/upload/post functions accepting account data, article content, and
optional progress/abort inputs. Keep article conversion in the content-serialization boundary.
Leave the existing `publishers.WordPress` entry as a compatibility adapter. A publishing
controller translates results into shared state and invokes existing feedback views.

Choose a dedicated feature file only if the extraction warrants it; do not create a generic
service framework. Keep existing validation, upload ordering, and deduplication semantics.

Acceptance: mocked network tests exercise success, rejected media, missing URL, timeout,
partial upload, and an accepted but unconfirmed post with no document or UI globals. View
tests prove progress clears and errors remain visible, exactly once. No live post is required.

### 3. Pilot a shared menu component

Inventory current panel/navigation builders in `interface.js` and `ui.js`, plus LocalRSS
feed options. Select one menu whose existing behaviour is understood. Separate its definition
provider and command execution from its feature view. Extend the existing UI shell to accept
the definition and own Back/Close and focus. Keep the legacy entry point delegating to it.

Acceptance: the same definition can render in the left pane and pop-out without service edits;
Back, Close, Escape, keyboard navigation, and focus restoration work. Unsupported/disabled
commands and malicious label text are handled safely. Preserve existing mobile navigation.

### 4. Migrate reader data and actions by service

Add optional data-fetch and action-definition contracts to the existing reader registry.
Preserve `initialize`, `feedFunctions`, and HTML-returning `statusActions` until each service's
consumers migrate. In `ui.js` listing rendering, prefer definitions when available and otherwise
use the established legacy path. Do not add a new reader registry or service switch statement.

Use normalized common fields with service-specific extensions; retain paging cursors,
permissions, references, and identity information. Controllers own active-account/request
context, cancel superseded reads where supported, and ignore stale responses when an account
switch occurs. Cache updates must not incorrectly render old results into the current view.

Acceptance: one migrated service and one legacy service work together. Test paging, empty
feeds, per-item actions, fast account switches, and failures. Render fixtures without real
network calls; test extracted service operations without a DOM.

### 5. Expand only after the pilots establish the contracts

Apply the proven pattern to other publishers, readers, collections, and save/load workflows
as those features change. Move UI construction into feature views and shared components;
do not rewrite every service at once. Update `docs/adding-a-service.md`,
`docs/publish_structure.md`, `docs/error-handling.md`, and `docs/feed-structure.md` alongside
the relevant contract changes. Remove compatibility adapters only when no consumers remain.

## Validation and scope control

Each future patch should identify the state owner, data contract, controller boundary, and
compatibility path. Use meaningful tests across those boundaries, not snapshots of every DOM
detail. Check static hosted and launcher operation, mobile navigation, standard buttons/modals,
and asynchronous error handling for the affected workflow. A lightweight dependency check for
DOM APIs in extracted data files may help later; do not ban HTML or DOM APIs across all JS.

The first implementation should be phase 1 alone. No broad file moves, framework adoption,
or automatic conversion of existing services is needed to adopt the guidance now.
