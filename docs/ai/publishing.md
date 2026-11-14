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

The user is changing the collections editor in work that is not yet ready to pull.
Do not edit/refactor the collection editor or its publishing path while that work
is pending. After the pull becomes available, inspect and reconcile the incoming
changes before proposing a collection publishing refactor. Do not apply the
standalone publishing design to an assumed older collection implementation.

This pause does not prevent documenting the currently inspected code. It does
not authorize edits to the user's incoming work. New user instructions determine
when this boundary changes. Preserve unrelated working-tree changes.

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
| Service API operations | Service files, including `mastodon_publish.js`, `bluesky_publish.js`, `wordpress.js`, `blogger.js` | Use explicit account/session values. Return data or reject; never display publication feedback. |
| Collection publishing | [collections.js](../../js/collections.js), [collection-publishing.md](../collection-publishing.md) | Separate legacy path; currently paused for edits as stated above. |

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
and `_findAccountForPage` / `showRepublishStatus` compatibility for collection
republishing until their callers are deliberately migrated.

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
