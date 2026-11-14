# How CList publishes your work

CList lets you write once and publish to several destinations. You choose the
accounts to use; CList prepares the content for each service and shows what
happened at each destination.

This guide explains the current application. Its final section is a reference
for people adding services. Detailed implementation notes are included in the
Technical reference section below. Coding tools should also read the
[Publishing instructions for AI coding tools on GitHub](https://github.com/Downes/CList/blob/main/docs/ai/publishing.md).

## Save, Post, or To Web Page?

| Choice | What it does |
|---|---|
| **Save** | Keeps or exports a document using the selected storage option. Use this when you want to continue editing it later. |
| **Post** | Sends content to selected publishing accounts, such as a blog or social service. |
| **To Web Page** | Publishes a standalone page through your CListBin destination and returns a link. |
| **Republish** | Updates the destination associated with a previously loaded published page, where that service supports updates. |

A published version and an editable document can have different formats. For
example, a slide presentation can stay editable when saved, while its published
version is a readable web page or an article for a blog.

Publishing does not necessarily mean making something public to everyone. The
destination's visibility settings matter. The current Mastodon posting operation,
for example, sends public posts; do not assume every destination has a matching
privacy control in CList.

## Publishing a post

Open **Post**, choose the destination accounts, and use the publish button.
Accounts must be set up with permission to publish. More than one account can be
selected, including accounts on different services.

CList asks the active editor for its content. It does not just copy the text
visible in the editor's surrounding panel. This matters for rich-text editors,
slides, and collaborative editors that have their own ways of retrieving content.

The title, selected destinations, and references are captured for the operation.
Changing those controls while content is being prepared does not silently change
the operation already underway. Editing and preparation still depend on the
editor's own content API.

The destination determines what can be preserved. A blog can accept a long,
formatted article. A short-post service may receive plain text instead. WordPress
can upload embedded images before creating the article. Other services have
different capabilities; CList does not assume they all support the same content.

## One article, several destinations

Suppose you select WordPress and Mastodon for a long article. CList attempts the
fuller version first. If WordPress returns the article's link, CList can then
send Mastodon a shorter introduction or title with that link.

If no earlier destination returns a link, an overlong post may be shortened with
a warning. A service can also enforce its own length limit. The current ordinary
post workflow orders destinations by their configured limits, with unrestricted
destinations first. It does not decide the order from the service's name alone.

Each destination receives its own copy of the references. Where supported, a
reference can identify the post being replied to. Mastodon and Bluesky use the
first compatible reply target and warn if several were supplied.

## Reading the result

CList reports results separately for each destination. Failure at one destination
does not stop the ordinary post workflow from attempting the others.

| Result | What it means |
|---|---|
| A publication link | The service returned a link for the published item. |
| A failure message | The operation reported an authorization, preparation, or API error. Check the detail before trying again. |
| Publication unconfirmed | No usable publication link was returned. Check the destination before posting again. |
| Published, but metadata could not be saved | The external publication succeeded, but CList could not update its own tracking information. Repeating publication can create another copy. |

A failed or interrupted request can sometimes have reached the service already.
CList does not automatically repeat an uncertain publishing request. A warning
about checking the destination is intended to prevent accidental duplicate posts.

## Publishing a standalone web page

**To Web Page** uses your CListBin account. It asks the editor for a viewable
version of the work, publishes it, and shows the link.

When a published page is already loaded, CList offers an overwrite/new-version
choice. **Overwrite** updates that resource and keeps its identity. **Save as new
version** creates an independent page with a new identity. **Cancel** publishes
nothing. Overwrite is unavailable if the loaded page belongs to a different
service/account or lacks an updateable resource identifier.

The choice applies to the captured page, not another page opened while the
operation is running. CList also guards against duplicate submissions and against
ordinary posting removing an outstanding web-page choice.

For HTML pages, CList includes an identity marker in the published document. It
does not insert a visible identifier into plain text. Publication metadata records
authorship and links. Updating a tracking record under an unverified different
author creates a derived metadata copy rather than silently changing authorship.

Published standalone pages are indexed for **My Pages**. When publishing a native
local document, CList instead records the publication against that document's
local record. It does not replace its editable contents with the web version.

**Republish** uses the loaded page's original destination and account. A metadata
error after a successful update is reported separately from a rejected update.

## Publishing annotations

Use **Post** with an annotation account to annotate the captured reference URLs.
**Send** in the annotation editor uses its primary target, chosen account, tags,
and visibility. Send reads the Description through the editor API, including
its HTML formatting. A draft changed during sending stays open.

Results distinguish created, failed, and uncertain annotations for each target.
An annotation can be created without a returned browser link. If a connection
is lost, check the server before sending again. CList does not automatically
retry that write. **Flow** preserves the original author and annotation reference;
it tries another writable store only after an explicit failure.

## Collections

Collections use a separate publishing path. That path selects export formats and
can publish a fuller collection before sending links to shorter destinations.
Editing or saving a personal feed subscription is a separate action from
publishing a collection for other people to read.

The collection editor is being changed separately. Its publishing path has not
yet received the same UI/state separation as ordinary posts and standalone pages.
See the [collection reference](collection-publishing.md) for the existing details.

## Service integration reference

Service files join CList's existing registries. Keep a small integration in
`service.js`; split larger ones by feature, using names such as
`mastodon_publish.js` and `mastodon_account.js`. The current WordPress publisher
is in `wordpress.js`; there is no required filename named `wordpress-publish.js`.

### Entry points a service implements

| Registry/member | Signature | Result or purpose |
|---|---|---|
| `CList.publishers[type].publish` | `async (accountData, title, content, refs = [], options = {})` | Publish a post; return its URL string, or `null` if no link was returned. Throw failures. |
| `CList.publishers[type].construct` | `(title, content)` | Optional synchronous conversion used before the ordinary workflow measures the post's length. Return text. |
| `CList.publishers[type].acceptedFormats` | Array of format identifiers, where applicable | Collection serialization preferences; this is not the ordinary post conversion function. |
| `CList.binPublishers[type].publish` | `async (content, mimeType, titleOrFilename, accountData)` | Publish a serialized page/file/collection; return `{ url, serviceId }`. The meaning of the third argument follows the adapter. |
| `CList.binPublishers[type].update` | `async (serviceId, content, mimeType, accountData)` | Update an existing resource; normally return `{ url }`. An unsupported update must report that limitation. |
| `CList.binPublishers[type].delete` | `async (serviceId, accountData)` | Delete a resource if supported; otherwise report that limitation. |

`CList` here means `window.CList`. A service also registers its account schema.
Ordinary publishing accounts use the `w` permission; bin destinations use `b`.
The account's `maxlength` controls ordinary destination ordering and initial
length handling. `acceptedFormats` does not establish a character limit.

### Notifications and reusable helpers

| Function/callback | What a service can use it for |
|---|---|
| `options.onProgress?.({ stage, completed, total })` | Report progress as data. Existing WordPress stages are `uploading-images` and `creating-post`; the view supplies the wording. |
| `options.onTargetResult?.(receipt)` | Report an annotation target result as data: target URL, outcome, annotation ID/link, and optional error. |
| `options.onWarning?.(message)` | Report a service notice, such as truncation or use of only one reply target. The invoking controller/view displays it. |
| `derivePlainTitle(title, content)` | Derive a plain title using the shared helper. |
| `removeHtml(content)` | Convert HTML to text using the existing converter, which preserves anchor URLs. This is content conversion, not reading editor controls. |
| `await assertOk(response, label)` | Reject an unsuccessful HTTP response with context. Services may parse a response themselves when they need a more specific error. |
| `parseAccountValue(accountRecord)` | Safely parse the decrypted JSON account wrapper; check for `null` before using it. |

These helpers are in `utilities.js`. The adapter must use the account passed to
it, rather than discovering another account or borrowing a reader session.
Credentials differ by service: `accountData.id` is not a universal authentication
API. CListBin, for example, uses the current KVStore bearer token through its
existing adapter.

### Existing service operation examples

These functions belong to their particular services. New services implement their
own operations through the registry rather than calling another service's helper.

| Operation | Location |
|---|---|
| `publishPost(instance, username, password, title, content, options)` | [wordpress.js](https://github.com/Downes/CList/blob/main/js/wordpress.js) |
| `publishBloggerPost(blogid, clientid, title, content)` | [blogger.js](https://github.com/Downes/CList/blob/main/js/blogger.js) |
| `publishMastodonStatus(token, baseUrl, text, replyToId, options)` | [mastodon_publish.js](https://github.com/Downes/CList/blob/main/js/mastodon_publish.js) |
| `createBlueskyAccountSession(accountData)` | [bluesky_publish.js](https://github.com/Downes/CList/blob/main/js/bluesky_publish.js) |
| `publishBlueskyRecord(session, text, reply, options)` | [bluesky_publish.js](https://github.com/Downes/CList/blob/main/js/bluesky_publish.js) |

### What stays outside a service operation

The controller obtains the editor contents, decides which destinations run, and
invokes the registered adapter. The view displays results. A service operation
must not open a modal, clear an editor, write into a result panel, or read selected
buttons to discover application state.

Controllers/views can reuse `renderPublicationSuccess(container, destination, url)`,
`showPublicationSuccess(destination, url)`, `showPublicationError(destination, detail)`,
and `renderPublisherProgress(destination, progress)` from `ui.js`. They are UI
helpers, not functions for service adapters to call.

For the coding contract, loading order, and verification requirements, consult
[Publishing instructions for AI coding tools on GitHub](https://github.com/Downes/CList/blob/main/docs/ai/publishing.md) and
[Adding a service](adding-a-service.md).

---

## Technical reference

The sections below retain the detailed service contracts, implementation notes,
compatibility boundaries, and verification information from the existing
publishing reference, updated for the current refactoring. The general guide and
service function list above are the starting point for readers.

Verified against the current client implementation, 2026-11-14. This describes
implemented contracts, including the remaining legacy paths, rather than a future API.

### Choose the integration contract

| Purpose | Registry / entry point | Result |
|---|---|---|
| Publish a post to a platform | `CList.publishers[type].publish` | Post URL string, or `null` |
| Publish a serialized page or collection | `CList.binPublishers[type]` | `{ url, serviceId }` from `publish` |
| Persist personal feed membership | `CList.readers[type].saveCollection` | Resolve on success; throw on failure |
| Save an editor document | `CList.savers` | Existing save-handler contract |

Platform accounts use permission `w`; bin/page publishers use `b`. Collection
subscription persistence is not public publication. Its contract is in
[collection-publishing.md](collection-publishing.md). Registration and account
schemas are covered by [adding-a-service.md](adding-a-service.md).

### Ordinary post workflow

`postAll()` in `js/publish.js` guards the operation with
`CList.state.publishing.busy`. It captures a request, invokes `_postAllSelected`,
and always restores busy/progress presentation in `finally`. It calls the
`CList.ui.publishing` interface from `publishing-view.js`; the workflow itself
has no view or global-state dependency.

`capturePublicationRequest()` returns:

```js
{
    title,                  // captured title, trimmed
    references,             // detached reference snapshots
    selectedAccountKeys,    // copied from publishing state, not buttons
    accountStoreUrl,         // selected account-store URL
    content,                // packaged editor output
    localPageId             // captured local page ID, or null
}
```

`readPublicationFields()` in `ui.js` is the control-reading boundary.
`packagePost({ forPublishing: true, title, referenceHtml })` in `files.js` obtains
content through the active editor's API: awaited `getPostContent()` when supplied,
otherwise awaited `getContent()`. It packages title, body, and reference HTML.
Do not extract TinyMCE or collaborative editor contents by reading their mounting
container. See [editors_structure.md](editors_structure.md) for the different
post, web-page, and native-document content getters.

`_postAllSelected(request)` reloads accounts through `getAccounts(request.accountStoreUrl)`,
snapshots the records, then invokes
`runPublishingWorkflow(request, dependencies)` in `js/publishing-workflow.js`.
The dependencies are `accounts`, `publishers`, `parseAccount`, `toText`, and
`onUpdate`. The HTML-to-text converter is an output transformation, not a
control reader. The workflow:

1. Resolves captured keys against the supplied account snapshot and checks `w`
   permission. The controller still uses the legacy `getAccounts()` wrapper for
   account loading; that authentication wrapper has not been migrated here.
2. Sorts valid accounts by positive `maxlength`, largest first. An absent, empty,
   invalid, or nonpositive limit is treated as unlimited.
3. Calls optional `construct(title, content)` before measuring the candidate.
4. Publishes full content first. A later limited destination can use an earlier
   returned URL in an opening/title plus `see <url>` message. Without a URL, the
   workflow reports a warning and truncates. This uses JavaScript string length;
   service handlers may additionally enforce platform-specific grapheme limits.
5. Calls each handler with a separate clone of the captured references. A thrown
   construction or destination error becomes a failed result; the remaining
   destinations are attempted. Updates contain data rather than UI markup.
6. Returns `{ primaryUrl, destinations }`. Destination statuses distinguish
   `published`, `failed`, `skipped` (no handler), and `unconfirmed` (no link).
   The view presents those outcomes using existing CList feedback helpers.

The controller records PageStore publication metadata against `localPageId`,
captured before awaiting editor contents. It updates the live page pointer only
if that same page is still open. It also invokes WebMentions and the existing
completion callback. Metadata/WebMention/completion failures are reported as
post-publication problems and do not repeat external writes.

Selection belongs to `CList.state.publishing.selectedAccountKeys`.
`reconcilePublishSelection`, `togglePublishSelection`, and the selection renderer
manage it; button attributes only reflect it. A plain-data summary of the active
operation lives at `publishing.operation`: `status`, `primaryUrl`, and ordered
`destinations`. No account credentials or DOM elements are stored there.
`complete` means the workflow finished, not that every destination succeeded.
`applyPublishingUpdate()` reduces progress/results into this state; the view
consumes the same data updates through `CList.ui.publishing.update()`. Logout/account-store changes clear
incompatible selections. Publication records for local pages remain in PageStore.

### Platform publisher contract

```js
window.CList.publishers.MyService = {
    // Optional collection serialization preference, not ordinary-post conversion.
    acceptedFormats: ['html', 'text'],
    construct: (title, content) => removeHtml(content), // optional
    publish: async (accountData, title, content, refs, options = {}) => {
        const response = await fetch('https://service.example/posts', {
            method: 'POST',
            headers: {
                Authorization: 'Bearer ' + accountData.id,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ title, content }),
        });
        if (!response.ok) throw new Error('Post request failed (HTTP ' + response.status + ')');
        const data = await response.json();
        return data.url || null;
    },
};
```

| Argument | Meaning |
|---|---|
| `accountData` | Full parsed account; `type`, `instance`, `title`, `permissions`, and service-specific credentials |
| `title` | Captured title; remove HTML if the service requires plain text |
| `content` | Constructed/limited post content; may contain HTML |
| `refs` | Reference snapshots; reply context is in `replyToken`, scoped by its `type` |
| `options` | Optional `onProgress`, `onWarning`, `onTargetResult`, captured `tags`, and transient `annotationSession`; notifications contain no credentials |
| Return value | A published URL string, or `null`; not a bin-publisher result object |

Keep `refs` and `options` optional for older callers. The ordinary workflow,
`postContentByType()`, and collection publishing now supply `onWarning` so service
notices are presented by their invoking UI. Ordinary publishing also supplies
`onProgress`. Do not read editor controls or publishing buttons inside
new service operations. Use `parseAccountValue()` to decode account wrappers.

The per-service string-or-null return contract has not been replaced by a universal
`{ id, url, status }` result API. Aggregate workflow outcomes are a separate contract.

The account schema key must match the registry key. `maxlength` is an account
field; it is not inferred from `acceptedFormats`. Credentials are service-specific:
`id` is common but not universal. Use `CList.keys` constants for storage-key names.

### Progress, errors, and compatibility

New/extracted operations return data and throw useful errors. They must not also
show a modal or write to a result element: `publishing-view.js` presents ordinary
workflow failures once. `reportPublisherError` remains for the separate legacy
`postContentByType()` controller. A service may catch an error to add context and rethrow it.
Never automatically retry an external write whose outcome is uncertain.

WordPress is the extracted reference implementation. Its registered handler calls
`publishPost(instance, username, password, title, content, options)`, uploads and
deduplicates embedded images before creating the post, and reports data through:

```js
options.onProgress?.({ stage: 'uploading-images', completed, total });
options.onProgress?.({ stage: 'creating-post' });
options.onWarning?.('A service-specific limit or reply-target warning.');
```

The publishing view translates progress through the existing `renderPublisherProgress`.
WordPress propagates API errors, timeout uncertainty, and an accepted post with no
valid link. HTML parsing for content conversion is permitted; mounting UI or
writing result markup in that operation is not.

Mastodon and Bluesky registered publishers now live in `mastodon_publish.js` and
`bluesky_publish.js`. They return links or null, throw failures, and report notices
through `options.onWarning`; they do not display UI. Blogger and WordPress also
propagate failures to controllers. This does not claim every other publisher has
been migrated. Standalone web-page/republish now use the separated path below;
collection Post, To Web Page, and direct Republish share a separated controller/workflow/view. Local-entry Publish reuses the shared page workflow through `collection-entry-publishing.js`. Content capture and the legacy authentication wrapper
are also outside the extracted workflow.

### Collections and web pages

`playPost()` dispatches the Collection editor to `playCollectionPublish()` rather
than the ordinary request pipeline. Collection publishing resolves export formats,
publishes full-content destinations before link destinations, and records published
URLs. Its selection still lives in button attributes; it has not received the same
state extraction as ordinary post selection.

`postToWebPage()` and standalone `playRepublish()` now live in
`web-page-publishing.js`. The controller captures title, editor handler, source
page, destination, author, and account session before using awaited output. The
view in `web-page-view.js` owns standard overwrite/new-version/cancel controls
and feedback. The data workflow in `web-page-workflow.js` receives explicit
adapter/storage/identity dependencies and returns a structured outcome. New web
pages use `CList.binPublishers.CListBin`; Republish uses the original service.

`CList.state.webPagePublishing` owns busy/status/result state. Duplicate clicks
cannot start another standalone write, including while the version choice is
pending. Ordinary posting cannot clear an outstanding web-page choice, and web
publishing cannot clear an active ordinary post. Cancellation writes nothing. Overwrite is allowed only when the captured
service/account and resource match the destination; otherwise the view offers
new-version/cancel with overwrite disabled. An editor/page switch cannot redirect
a pending update or replace the newly opened page's loaded-page pointer.

`web-page-records.js` retains the shared identity, DID alias comparison, encrypted
`page:*` indexing, and same-author/derived-copy helpers. File-save callers retain
`_saveWebPageRecord()` / `_touchOrForkWebPageRecord()` compatibility; standalone
publishing passes a captured transient session. HTML embeds its identity marker;
plain text is unchanged. Local documents get PageStore publication annotations,
not an additional published-page KV record.

Remote publication and metadata persistence have separate outcomes. A successful
remote write with metadata failure remains published and is reported as such;
there is no automatic repeated write. Missing new-publication URLs are unconfirmed
and skip metadata indexing. Reconciliation affects only the captured editor/page.
The collection Republish controller now shares the collection publishing workflow
and view; it no longer uses the old account/status compatibility controller.
`_getWebPageEditorContent()` in `web-page-publishing.js` prefers the editor's `getPublishContent()` result
`{ type, value }`, falling back to `getContent()` and the editor's native type.
For example, slides can publish viewable HTML while retaining their native format
for saving. This is different from `getPostContent()`, which supplies social/blog
post content. See [collection-publishing.md](collection-publishing.md) for bin
adapters, page records, and Republish.

### Verification

Run `node --test tests/publishing-workflow.test.cjs tests/publishing-controller.test.cjs tests/publishing-view.test.cjs`
for the new separation checks. The workflow tests run without `window` or a
document. They verify full-first ordering/link handoff, limit handling, separate
reference snapshots, failures, null links, progress/state updates, editor API
capture, busy cleanup, and page switches during publication.

The mocked browser fixtures in `tests/README.md` cover post selection, publication
request capture, WordPress errors/progress, and success feedback. Collection save
request/controller and feed-account checks run with Node as documented there.
These checks do not publish live content or establish a remote deployment's health.


### Mastodon and Bluesky adapters

Load each `service_publish.js` after its main service script. Their registered
publishers accept the existing title/content/references/options arguments and
return a post URL or null. Both distinguish API rejection, uncertain network
outcomes, and missing links without presenting feedback themselves. Published
Mastodon responses use the API's `url`; Bluesky uses the returned AT record key
with the authenticated DID in the existing `bsky.app/profile/.../post/...` format.

Mastodon posting uses explicit token/instance values, retains public visibility
and the first Mastodon reply ID, and respects available instance character limits.
If optional instance metadata is unavailable, it sends the original text for the
server to validate, rather than an undefined status. Bluesky strips content HTML
before applying its existing 300-grapheme limit; it preserves the first compatible
reply token. Multiple-target and truncation notices use `onWarning`.

`createBlueskyAccountSession(accountData)` is now in `bluesky_publish.js`. It
snapshots the selected handle/app password and never reads or changes the shared
reader token/DID/PDS. Missing credentials or failed authentication never fall back
to a reader account. Standalone reader forms keep their reader-session path.
`postMastodonStatus()` and `submitBlueskyPost()` remain UI wrappers around the data
operations. They present feedback and preserve failed or newer drafts; inputs are
cleared only after a completed request and only if the submitted text is unchanged.

### Blogger error boundary

`publishBloggerPost()` returns a published URL, returns null only for a successful
response without a URL, and rejects authorization/API/network failures. It does
not render feedback. `requestBloggerAccessToken()` wraps the existing Google
Identity Services token flow and rejects OAuth denial, missing tokens, SDK errors,
and closed/blocked popups. The popup handling follows Google's documented
[`error_callback`](https://developers.google.com/identity/oauth2/web/reference/js-reference).

The ordinary workflow records a failed destination and the view presents its
error once. Other existing controllers can catch the same rejected promise.
Blogger API success with an unreadable response, or a network interruption after
sending the request, explicitly tells the caller to check the blog before retrying.
No external writes are automatically retried. The account-setup UI is unchanged.


Standalone web-page checks:

```powershell
node --test tests/web-page-content.test.cjs tests/web-page-workflow.test.cjs tests/web-page-publishing.test.cjs tests/web-page-view.test.cjs
```

These use mocked services/storage; no live publication or authorization is performed.

### Changes from the preceding published reference

The earlier published reference described the implementation verified on
2026-11-13. Its substantive contracts are retained above; these implementation
details have since changed:

- `_postAllSelected()` previously combined destination ordering and rendering.
  It now delegates data operations to `publishing-workflow.js` and feedback to
  `publishing-view.js`.
- The direct controller previously called a publisher with three arguments and
  collection publishing commonly used four. References/options remain optional;
  current callers can supply the fifth argument for warning presentation.
- Mastodon and Bluesky previously displayed their own feedback and returned
  `null`. Their extracted publishers now return URLs or throw errors. Blogger
  also propagates failures instead of displaying an adapter-side error modal.
- Standalone web-page publishing and republishing previously mixed operations
  and UI inside `publish.js`. Their workflow, controller, view, and shared record
  helpers are now separate modules.

These changes do not replace the per-service URL-string-or-null result with a
universal `{ id, url, status }` API. Collection publishing remains a separate,
partly legacy workflow. The incoming editor work is available and further collection refactoring is authorized.


### Annotation publishing boundaries

`annotation-workflow.js` captures/validates detached inputs, removes duplicate
and empty/placeholder target URLs, and produces per-target receipts. It has no
DOM or global-state dependency. `annotation-publishing.js` owns transient session
checks and account/target in-flight locks shared by Post, Send, inline forms, and
Flow. Credentials never enter `CList.state.annotationPublishing` summaries.
`annotation-view.js` owns result rows, summaries, Flow button feedback, and the
existing collection action. The read-only collection eligibility query is in the
controller; it uses the successful target, rather than the first reference.

`annotate_publish.js` contains the Annotation-server transport and registered
publisher; `hypothesis_publish.js` registers the Hypothesis publisher and reuses
`hypothesisCreate()` in `hypothesis.js`. Publishers use the supplied reference
snapshot, return the first available annotation URL or null, and throw explicit
all-target failure. `options.onTargetResult` delivers each receipt. The ordinary
workflow retains these receipts and recognizes a confirmed creation without a
URL; it does not incorrectly describe it as unconfirmed.

Receipts contain `targetUrl`, `outcome` (`created`, `failed`, or `uncertain`),
`annotationId`, `annotationUrl`, and optional `error`. Opaque IDs are not links.
An accepted HTTP response confirms creation even if its body supplies no link.
Network failures are uncertain and are never automatically retried.

Post preserves existing service differences: Annotate supplies captured write
tags and reference metadata; Hypothesis Post supplies empty tags. Send supplies
its selected tags/visibility to either service and sends only the primary target.
Flow supplies `motivation: 'flowing'` and `via`/`via_annotation_id` attribution.
The annotation editor retains append-only Description/reference insertion.
Reader rendering remains in the service/reader modules; this split concerns
publishing. Collection publishing remains a separate path.


### Collection Post and To Web Page boundaries

Collection **Post** and **To Web Page** use `collection-publishing.js` for capture/session/state,
`collection-publishing-workflow.js` for explicit data operations, and
`collection-publishing-view.js` for selection, overwrite choices, and results.
State owns destination selection and busy status. The workflow preserves format
negotiation, full-content-first ordering, and link handoff to limited services.
Captured raw members stay separate from flattened exports. A matching captured
collection/account/format/resource is required for overwrite; later editor
switches do not redirect the write. Metadata failures retain successful results,
and completion preserves newer drafts. See [Collection publishing](collection-publishing.md)
for the detailed contract. Local-entry Publish uses `collection-entry-publishing.js`
and the existing shared page workflow. To Web Page uses one captured CListBin target through the shared workflow.
Its loaded-page pointer is updated only when the original editor/collection/page
context and draft title/members are unchanged after successful metadata storage.


Direct collection Republish also uses this shared controller/workflow. It resolves
only the original writable bin account and updates the captured resource in its
original format, with no version-choice prompt. It then touches the matching saved
publication timestamp without replacing stored title/members. Metadata failure
retains remote success. The view uses the original Republish indicator only while
the captured editor/collection/page/draft are still active. The obsolete
`_findAccountForPage` compatibility controller has been removed.


Local-entry Publish captures its member/blob/session/authorship, uses
`runWebPagePublication()` to create and index the page, and keeps its receipt
separate from editor reconciliation. Only the original unchanged active member
receives the published URL and has its old blob revoked. Metadata-only failures
retain upload success; stale members keep their draft and retain the returned link.
The per-entry receipt prevents reuploading a fulfilled operation for the same
source. This leaf operation never changes the collection's loaded-page pointer.

Discord's registered publisher in `discord.js` sends the selected account channel
and converted text to the existing authenticated bridge `/send` endpoint. Missing
channels and bridge/network failures reject for controller-owned feedback. Only
a successful bridge response without a URL returns null. Publishing performs no
modal/result rendering; Discord reader and account controls retain their own UI.

The ordinary Post account panel and To Web Page option are now rendered in
`publishing-view.js`. `populatePostOptions()` delegates to the view after
reconciling selected account keys. Selection/busy state belongs to the controller;
the view receives explicit values and callbacks, including accessible selected
state and annotation highlighting. Button attributes reflect selection and do
not determine publication targets. Save-menu rendering remains separate.
