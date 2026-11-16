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
