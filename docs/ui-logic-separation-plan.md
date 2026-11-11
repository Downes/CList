# Separating CList application logic and UI

Status: proposed architecture and migration plan, 2026-11-11. No runtime migration is
implemented by this document. Each phase is a separately scoped future change.

## Assessment

The feedback identifies a real maintenance problem. CList separates services well, but many
service operations also construct interfaces and display results. A navigation change can
therefore require edits across several integrations. The existing registries, account schemas,
shared UI helpers, and PageStore provide useful foundations; they should be extended.

Verified examples in the current checkout:

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

Proposed shared publishing state is `window.CList.state.publishing`, initially containing
`selectedAccountKeys`, `busy`, and per-target `results`. Use stable account keys, not labels
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
