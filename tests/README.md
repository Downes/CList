# CList architecture regression tests

Start with [Testing CList](../docs/testing.md) for setup, running Node/browser
checks and reporting results. AI coding tools must also read
[Testing instructions](../docs/ai/testing.md). This catalogue retains the detailed
feature checks and acceptance IDs; the guides do not replace them.

Run commands from the repository root.

## Collection save separation

Run `node --test tests/collection-save-request.test.cjs tests/collection-save-controller.test.cjs tests/public-feed-accounts.test.cjs tests/public-feed-editor.test.cjs`.

Request/persistence/controller tests run without a document. They check detached
save inputs and results, registered feed savers, missing credentials, duplicate
invocations, explicit retry, newer draft edits, and collection switches during
a save. The editor fixture checks normal and feed saves through the existing
Save to CList control, visible failures, and protection of a newly opened view.
No live data is written.

## Public feed accounts

Run `node --test tests/public-feed-accounts.test.cjs tests/public-feed-editor.test.cjs`.
These mock network requests and account storage. They cover registration-only
subscriptions, personal collection copying, independent collections for two
users, feed additions/removals, saved-copy reading, export failures, and retry
after an account-save failure. They never change live feed collections.

In CList, open Accounts, edit a subscribed public collection, and select
**Edit Feed Collection**. The first edit copies its feeds into a user-owned LocalRSS
collection and opens it in the existing Collection editor. Use **Save → Save to
CList** to apply edits to the subscribed feeds. Entry order and descriptions
are preserved when reopening; the public collection is unchanged. This uses
LocalRSS's existing authenticated OPML and feed
membership APIs; local-only CList identities cannot authenticate to that service.

## Publishing selection

Open `tests/publish-selection.browser.html` through the local CList
server or desktop launcher. The page must report PASS.

It checks selection toggling, panel rebuilding, accessibility state,
DOM-independent publishing targets, removed accounts, write permissions,
and visible feedback for empty selection. Publishers are mocked.

## WordPress progress

Open `tests/slides-article-wordpress.browser.html` through the local
CList server or desktop launcher. The page must report PASS.

All network requests are mocked. This test never publishes a live post.

| ID | Behaviour |
|---|---|
| WP-P1 | Upload progress reports stage, completed count, and total; counts advance across distinct images |
| WP-P2 | Duplicate images upload once and do not inflate progress totals |
| WP-P3 | Post-creation progress follows successful uploads |
| WP-P4 | Publishing works without a progress callback |
| WP-P5 | The controller translates progress into visible messages |
| WP-P6 | An existing publisher accepts calls containing the optional fifth argument |
| WP-P7 | Failed uploads prevent post requests and post-creation progress |
| WP-P8 | Progress is removed after success or failure |

WP-P6 is covered by `publish-selection.browser.html`.
The remaining WP-P tests are covered by
`slides-article-wordpress.browser.html`.

The WordPress fixture also checks article conversion, image cropping,
media deduplication, URL rewriting, publication links, missing-link
feedback, upload errors, and preservation of editable slide data.

## Publisher error boundaries

All requests and publishers in these checks are mocked.

| ID | Behaviour |
|---|---|
| WP-E1 | Controller preserves the ID of an accepted post with no valid link |
| WP-E2 | WordPress rejects with useful error details |
| WP-E3 | The WordPress operation does not display an error modal |
| WP-E4 | Upload failure prevents post creation |
| WP-E5 | The controller displays one error modal per failed operation |
| WP-E6 | Failure feedback identifies the destination |
| WP-E7 | Known failures do not produce generic missing-link feedback |
| WP-E8 | Publish is enabled again after failure |
| WP-E9 | A failed destination is reported once |
| WP-E10 | Other selected destinations still run |
| WP-E11 | Button and progress cleanup survive destination failure |
| WP-E12 | The direct publishing controller reports rejection and returns null |

WP-E1 through WP-E8 are covered by
`slides-article-wordpress.browser.html`.

WP-E9 through WP-E12 are covered by
`publish-selection.browser.html`.

## Publication success feedback

Open `tests/publication-success.browser.html` through the local
CList server or desktop launcher. The page must report PASS.

| ID | Behaviour |
|---|---|
| PUB-S1 | Standard success feedback contains the destination and URL |
| PUB-S2 | Publication links retain href, new-tab behaviour, and noopener |
| PUB-S3 | Supplied text is not interpreted as HTML |
| PUB-S4 | Additional results preserve earlier feedback |
| PUB-S5 | Success wrapper uses the view-configured container |
| PUB-P1 | Progress uses the standard accessible feedback element |
| PUB-P2 | Progress updates reuse the existing element |
| PUB-P3 | The view formats post-creation progress |
| PUB-P4 | Progress cleanup is safe when repeated |
| PUB-E1 | Error feedback uses the view-configured container |
| PUB-E2 | Error text stays literal and one modal is requested |
| PUB-E3 | A missing results container does not prevent modal feedback |

The mocked WordPress browser test also checks the controller's use
of the real success renderer. No live publication is required.

## Publishing busy state

Covered by `publish-selection.browser.html`, using mocked publishers.

| ID | Behaviour |
|---|---|
| PUB-B1 | Active publishing is represented in application state and UI |
| PUB-B2 | State blocks duplicate submissions despite DOM changes |
| PUB-B3 | Rebuilding the Post panel preserves its busy appearance |
| PUB-B4 | Completion resets busy state and enables the rebuilt button |

WP-E11 also verifies busy-state cleanup after a destination failure.

## Publication request capture

Open `tests/publication-request.browser.html` through the local
CList server or desktop launcher. The page must report PASS.
Editor retrieval and publishers are mocked; no live posts are sent.

| ID | Behaviour |
|---|---|
| PUB-R1 | Publishing awaits the active editor API |
| PUB-R2 | Captured destinations retain full-first ordering |
| PUB-R3 | Captured metadata and retrieved HTML reach the full-content destination |
| PUB-R4 | Destination construction, character limits, and returned-link sharing remain intact |
| PUB-R5 | Reference copies resist live edits and mutations by another publisher |
| PUB-R6 | Account lookup and WebMentions receive captured inputs |
| PUB-R7 | Publication-specific editor content is preferred over native content |
| PUB-R8 | Editor retrieval failure stops publishing and clears busy state |

These tests exercise the editor-handler contract, not the implementation
of every editor's snapshot semantics. They also do not establish that
a changed account-store session can safely complete an earlier request.
Publication-record identity remains a separate follow-up.

## Other existing tests

Run the Node regression tests with:

    node --test tests/*.test.cjs

Other `*.browser.html` files are individual browser test pages.
Their names identify the feature under test. Each must report PASS;
absence of a result is not success.

## Manual checks

After changing authentication or publishing selection:

- Reopen Post and confirm selections persist.
- Change account servers and confirm selection clears.
- Log out and confirm selection resets.
- Confirm the separate collection-publishing flow still opens.

Manual checks are not covered by the automated results above.
Record their outcome separately when performed.


## Service account flows

Run `node --test tests/account-flows.test.cjs` for custom account dispatch,
per-panel instances, OAuth delegation, manual account persistence, registration
adapters, and error handling. These use mocked service responses and DOM controls;
they do not authorize against live services or verify visual rendering.


Generic account data and panel checks:

```powershell
node --test tests/account-state.test.cjs tests/account-panel.test.cjs
```

These cover registered-type filtering, compatibility loading, request snapshots,
service validation hooks, session switches, extension/credential preservation,
panel isolation, dirty navigation, save/delete failures, and refresh-only retries.
The DOM fixture verifies behaviour; it does not verify browser layout or live OAuth.


## Ordinary publishing workflow separation

```powershell
node --test tests/publishing-workflow.test.cjs tests/publishing-controller.test.cjs tests/publishing-view.test.cjs
```

The workflow runs without `window` or `document`. Mocked publishers cover
full-first ordering and returned-link handoff, construction/limit handling,
reference/account snapshots, errors, missing handlers, null links, and progress.
Controller tests cover actual `packagePost()` editor API capture, busy guards,
cleanup, captured page identity, and post-publication metadata/WebMention errors.
View tests verify reuse of existing feedback helpers. No live posts are created.
The existing selection/request/WordPress browser fixtures load both extracted
scripts before `publish.js`; their browser layout/API checks remain separate.


## Bluesky selected publishing account

Run `node --test tests/bluesky-publishing-account.test.cjs`. Mocked HTTP requests
verify that selected and concurrent publishing accounts use their own credentials,
PDS, and repository, without changing a pre-existing reader session. Failed or
missing credentials cannot fall back to the reader. Reply construction and the
standalone reader-post path are also checked. No live authentication or posts occur.


## Blogger publisher errors

Run `node --test tests/blogger-publishing.test.cjs`. Mocked Google token callbacks
and HTTP responses cover authorization denial, popup closure/blocking, SDK errors,
API/network/response parsing failures, missing publication URLs, and successful
HTML posting. Controller integration checks one visible failure without secondary
missing-link feedback; duplicate token callbacks produce only one post request.
No real Google authorization or publication occurs.


## Mastodon and Bluesky adapter separation

Run `node --test tests/social-publishing.test.cjs tests/bluesky-publishing-account.test.cjs tests/publishing-controller.test.cjs`.
Mocked HTTP requests verify URL returns, API/network errors, missing links,
reply IDs/roots, selected-account isolation, instance limits, clean-text Unicode
truncation, warning callbacks/state, and standalone form draft preservation.
Data-operation tests run without a document. These do not authenticate with or
write to live services. Browser layout and real authorization remain separate.


## Standalone web-page publishing and Republish

```powershell
node --test tests/web-page-content.test.cjs tests/web-page-workflow.test.cjs tests/web-page-publishing.test.cjs tests/web-page-view.test.cjs
```

Mocked tests cover awaited editor APIs, viewable versus native formats, new and
independent-version identities, destination-matched overwrite, cancellation,
PageStore annotations, same-author/alias versus derived metadata, page switches,
duplicate guards, session changes, metadata failures after a successful external
write, and standard view controls. Workflow tests run without `window`/`document`.
Collection Republish delegation and file-save helper compatibility are preserved.
No live service writes occur; visual layout and real authorization are not checked.

## Annotation publishing separation

Run `node --test tests/annotation-publishing.test.cjs`, then the full suite.
Mocked tests cover captured targets/tags/session, service payloads, no-DOM
workflow/transport, opaque IDs, partial/uncertain results, accepted responses
without links, in-flight locks, Flow fallback/attribution, collection eligibility,
TinyMCE API HTML capture, append-only insertion, and newer draft preservation.
No live annotations are created. Real browser/editor authorization checks remain
manual: verify Post results across several references, Send with a newer draft,
and Flow on a test account only when a live write is intended.

## Collection Post separation

Run `node --test tests/collection-publishing.test.cjs`, then the full suite.
Mocked tests cover DOM-free workflows, format negotiation/flattening, captured
requests/accounts, full-first/link handoff, partial failures, missing URLs,
metadata-only failures, captured overwrite/cancellation, session guards,
selection/busy state, save/publication overlap, and newer drafts/collection switches.
No live publications are created. Real browser/account authorization checks remain
unrun: verify destination selection, overwrite/cancel, and results manually with
an intentional test publication. Local-entry Publish has its own separated-controller coverage below. To Web Page now shares
the separated collection workflow, with the additional coverage below.


Collection To Web Page coverage in the same suite also checks automatic CListBin
selection, capture before asynchronous account/key loading, exact overwrite
matching, cancellation, overlapping clicks, raw-versus-flattened content, missing
destinations/URLs, changed sessions, metadata-only failure, and loaded-page/draft
reconciliation. The view test checks the existing public icon and disabled state.
These are mocked tests; real-browser and live account checks remain unrun.

## Direct collection Republish separation

Run `node --test tests/collection-republishing.test.cjs`, then the full suite.
Mocked tests check exact service/account/resource/format targeting, update-only
adapters, captured draft/page context, missing accounts and unsupported updates,
shared duplicate guards, metadata-only failures, session changes, timestamp-only
persistence, and status-indicator isolation. Shared collection fixtures are in
`tests/helpers/collection-publishing-fixture.cjs`. No live service writes occur;
real-browser/account checks remain unrun. Local-entry Publish also uses a separated controller.


## Local-entry Publish separation

Run `node --test tests/collection-entry-publishing.test.cjs`, then the full suite.
Mocked checks cover shared workflow/identity/page metadata, captured blob/member/
authorship/account/session inputs, duplicate guards and receipt replay, newer or
removed members, collection switches, missing links, metadata-only failures,
revocation/refresh, and read/upload errors. No live publications occur. Browser
blob lifecycle and live authorization checks remain unrun.

## Discord publishing errors

Run `node --test tests/discord-publishing.test.cjs`. Mocked tests cover the selected
account/channel and existing bridge authentication/payload, missing channels,
bridge/API/network failures, missing links, and one controller-owned failure
result without adapter modals. No Discord messages are sent.

Ordinary Post panel regression checks in `publishing-view.test.cjs` exercise
controller-owned selection through rebuilds, altered button attributes, read-only
account filtering, annotation highlighting/aria state, and publishing/page action
callbacks. The existing `publish-selection.browser.html` fixture still loads the
real view/controller; its real-browser checks remain separate from automated tests.

## Reader selection/loading boundary

Run `node --test tests/reader-controller.test.cjs`, then the full suite.
Mocked checks cover pure transitions, detached account capture, credential-free
state, overlapping initialization/feed requests, errors/cleanup timers, session
changes, removed accounts, Refresh semantics, legacy argument compatibility and
shared rendering after asynchronous normalization. Public-feed editor tests also
preserve Read-menu ordering and the Collections action.

Open `reader-boundary.browser.html` through the local server. It uses the real
Read/account/feed-menu UI and shared renderer with synthetic handlers and no live
requests. It reported PASS in the ChatGPT in-app browser on 2026-11-14; the Node
suite passed 231 tests. Legacy service direct-DOM writes, search/load-more internals
and shared reader-session variables still require service migrations. See
[Reader workflow](../docs/reader-workflow.md) for that explicit limit.

## LocalRSS guarded reader

Run `node --test tests/localrss-reader.test.cjs tests/reader-controller.test.cjs`,
then the full suite. Explicit-transport and integration checks cover captured
endpoints/auth/filter/offsets, local-first reconnect, stale probe/item/error
results, loader ownership, pagination duplicates/retry, Feeds/Refresh, session
changes and audio-majority account metadata. Shared reader fixtures live in
`tests/helpers/reader-fixture.cjs`.

Open `localrss-reader.browser.html` through a local server. It exercises real
reader/LocalRSS modules and normalization/rendering with all service responses
mocked. It reported PASS in the ChatGPT in-app browser on 2026-11-14. This does
not test deployed LocalRSS authorization or migrate its database-management paths.

The LocalRSS step also verifies that Options preserves the current pagination and
its Show filter survives Refresh. The full Node suite passed 245 tests after this
step; the LocalRSS browser fixture was rechecked and passed with mocked services.

LocalRSS row toggles use `CListLocalrssToggleRequest` (detached account, entry ID,
read/bookmark action) and return `{value: boolean}` from explicit transport.
Credentials remain in transient bindings outside `CList.state`. Regression checks
in `tests/localrss-reader.test.cjs` cover duplicate clicks, account/session switches,
pagination, replaced rows, API/malformed responses and uncertain writes. The
`localrss-reader.browser.html` fixture also checks actual row buttons after pagination.

Bookmark controls use the common Material `star` icon and existing `action-active`
orange highlight. LocalRSS action tests verify successful bookmark/unbookmark
updates; Mastodon retains its existing API-backed active state. Bluesky Likes
remain hearts (there is currently no bookmark control in that adapter).

Marking a LocalRSS entry read leaves its row visible and allows toggling back.
Unread/Refresh applies the unread filter on reload. LocalRSS regressions verify
the icon change, retained row and invalidation of old actions after reload.

## Bundled LocalRSS backend concurrency

Run `python -m unittest discover -s tests -p 'localrss_backend_test.py' -v`.
These three tests use the real harvest/toggle functions extracted without Flask
startup, a temporary SQLite database, and mocked network fetching. They check
read/unread/bookmark writes during a stalled harvest, committed-feed isolation
when another feed fails, retention of bookmarks, and lock release. They require
only Python's standard library and are separate from the Node suite. They do not
test deployed HTTP/authentication or restart a running service.

The bundled backend now serializes harvests separately from database writes and
commits each completed feed before awaiting another network result. Restart the
bundled LocalRSS backend to load this change. A remote LocalRSS service needs the
same backend fix deployed separately; CList's launcher timeout is unchanged.

LocalRSS packaging checks: run
`python -m unittest discover -s tests -p 'localrss_*test.py' -v` for backend and
bundle preflight tests (six checks, separate from Node). With backend dependencies
installed, `python launcher.py --check-localrss` verifies dependency imports,
required bundle files and Python syntax without starting servers or touching a DB.
All platform bundle scripts perform this preflight and repeat the check through
the finished executable before reporting success. This executable check verifies
packaged dependencies/assets, not successful authenticated backend HTTP requests.

## Document references without last-source editor blocks

Run `node --test tests/editor-references.test.cjs`, then the full Node suite.
Checks cover real text/TinyMCE/Etherpad/Collab/LaTeX handlers with editor and
transport fakes: source loading, resolved-link insertion after source rows leave
the reader, URL deduplication, reply tokens, shared collaborative map updates and
resynchronization. Document references and the Refs panel remain; the former
per-editor attribution blocks and placeholders are removed.

Open `/tests/editor-references.browser.html` through a local server. It checks
actual DOM collection/rendering and panel opening with a mocked TinyMCE API,
without loading TinyMCE or live collaboration servers. It reported PASS in the
ChatGPT in-app browser on 2026-11-16. Normal live editor/server sessions were not
tested. The complete Node suite passed 255 tests after this change.

Active-editor quote regressions in `editor-references.test.cjs` and the browser
fixture exercise visiting Annotations, activating Text or TinyMCE, then inserting
from the feed arrow. The quote goes to the active editor, the inactive annotation
draft stays unchanged and source metadata is still collected. Generic handlers,
selected-text quotes and unsupported editors are covered. On 2026-11-16 all 257
Node tests passed, and the updated DOM fixture passed in the ChatGPT in-app
browser with editor APIs mocked; live service sessions were not exercised.

## LocalRSS Options regression checks

Run `node --test tests/localrss-reader.test.cjs tests/reader-controller.test.cjs`.
Options checks cover captured database/endpoint/authentication, replaced/closed panels,
account/session changes, statistics request ordering, duplicate/obsolete confirmations,
uncertain writes and separate write/refresh outcomes. The simulated view check covers
Show, reconnect, close, statistics and Mark all controls. Run the full Node suite after
shared changes. `localrss-reader.browser.html` also builds the actual Options panel,
checks statistics, rejects a closed panel confirmation and performs one mocked Mark all
write. All fixture writes are mocked; no live database changes are needed.
For a deliberate manual service check, use a disposable database: open Options,
change Show, reconnect, close/reopen, and verify counts; confirm Mark all only when
intending to change that database. OPML import/export and account creation now use separate guarded modules.

## LocalRSS post search and Show posts checks

Run `node --test tests/localrss-reader.test.cjs tests/reader-controller.test.cjs`
and the full Node suite. Check query/feed capture, overlapping loads, old callbacks,
account/session changes, empty/error responses, row actions and Refresh retaining
both successful and failed selections. The `localrss-reader.browser.html` fixture
adds mocked search and feed-post controls. Its previous PASS predates these additions;
rerun it and wait for the final PASS. In the normal app, search from Options, use
Show posts from Feeds and the feed editor, then Refresh and switch to Unread.
Confirm titles, audio and read/bookmark controls match the displayed results.
Live read/bookmark actions modify the selected database; fixture writes are mocked.

## LocalRSS feed-management checks

Run `node --test tests/localrss-reader.test.cjs tests/reader-controller.test.cjs`, then
`node --test tests/*.test.cjs`. Feed-management checks cover panel-owned cache reuse,
in-flight deduplication/invalidation, stale search/editor responses, captured write
payload/authentication, duplicate clicks and obsolete delete confirmations, uncertain
write outcomes, newer drafts and independent refresh failures. The updated
`localrss-reader.browser.html` builds real controls and mocks create, cached lookup,
editor load/save/retry/delete. Rerun it and wait for its final PASS; earlier PASS results
predate these checks. Manual live feed mutations require a disposable database and
change that database; no live-service mutation is part of the automated fixture.
OPML import/export and account creation have since migrated in a separate step below.

## LocalRSS OPML and account-creation checks

Run `node --test tests/localrss-reader.test.cjs tests/reader-controller.test.cjs`
and the full Node suite. OPML regressions cover captured multipart fields/auth,
malformed and uncertain responses, duplicates, panel/account/session invalidation,
exports/downloads, seed-form edits/navigation, and account writes versus refresh
failures. The account helper's optional lifetime guard is exercised before writing.
The browser fixture `localrss-reader.browser.html` now mocks merge/newdb imports,
export download, encrypted KV account creation and the optional seed form. Rerun
it and wait for the new final PASS; earlier results predate these additions.
No fixture sends a real import, download or KV write. Normal-application checks
and live-service authorization remain separate, unverified evidence.

## Saved-file recognition

Run `node --test tests/file-recognition.test.cjs tests/annotation-file.test.cjs`
then the full Node suite. These checks exercise wrong/absent MIME and extensions,
byte-first browser pickers, BOM/UTF-16, binary signatures, native slides/annotations,
unknown JSON preservation, empty collections, overwrite review and anonymous saves.
Annotation checks use the actual handler with mocked TinyMCE and references.
`/tests/file-recognition.browser.html` uses real DOMParser and Files to round-trip
all six collection formats (empty and populated), XML fallback, exact document
metadata, legacy HTML, native annotation saves and Replace choices. Run through
the local server and wait for final PASS. Editor mounting/sanitizing is mocked;
there are no external requests or filesystem writes. Normal-application checks:
while logged out save/reopen a document, annotation and each collection format;
rename files to .xml/.json/.txt or remove the extension and verify content still
selects the correct editor without losing an existing draft. Older unmarked
annotation HTML remains ambiguous and should load as a document.

## Editor choice before overwrite review

File loads always offer the compatible local editor representations before reading
any existing editor draft. This includes the current editor: loading the same file
again must not bypass selection. Legacy CList HTML wrappers can be opened in Text,
HTML or Annotate even without an annotation marker. This offers a compatible editor;
it does not claim that an unmarked wrapper uniquely identifies an annotation.
Collections always offer Collection versus native text (HTML for HTML exports).
Choosing plain text passes the original XML/JSON/text bytes decoded as text/plain
to the Text editor, never to whichever editor happens to be current. Only after
selection do the existing Insert/Replace/Cancel controls appear. Unknown unsupported
binary types report an unavailable editor instead of loading into an incompatible one.

The saved-file browser fixture now reads the two local regression samples in
`tests/fixtures/legacy-annotation.html` and `tests/fixtures/saved-collection.xml`.
It checks repeated HTML choices with drafts in each editor and RSS plain-text
routing. These are test data, not instructions. Rerun the fixture and wait for PASS.

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

Legacy CList HTML quote recovery recognizes the exact quoted-citation form
`Author wrote: "quote" [linked citation]` within a post paragraph. It restores
that source URL and author when opening in Annotate, and deduplicates repeated
citations without rewriting the saved body. Ordinary body links are not promoted
to targets. A feed name absent from an old file is not inferred from the URL,
author or active feed; native annotation JSON and explicit HTML annotation fields
retain the saved feed. The browser fixture checks the supplied legacy quote's
URL/author, absence of fabricated feed metadata, and native JSON feed retention.

## Separated editor loading

Run `node --test tests/editor-load-state.test.cjs tests/file-recognition.test.cjs tests/annotation-file.test.cjs`,
then `node --test tests/*.test.cjs`. State checks require no DOM and cover immutable
transitions, generation ownership, representation rules and literal XML drafts.
Controller/view checks cover captured payloads, stale choices/reviews, double clicks,
delayed draft checks, manual editor changes, visible failures and unsuccessful mounting.
The existing file-recognition browser fixture loads the real new modules, keeps its
format/annotation regressions, and adds a superseded-choice check plus safe-state
inspection. Rerun it and the normal application after this split; previous browser
PASS results predate it. All fixture editor services remain mocked.

## Editor switching and draft restoration

Run `node --test tests/editor-switch.test.cjs tests/annotation-file.test.cjs tests/editor-references.test.cjs tests/file-recognition.test.cjs tests/loaded-page-messages.test.cjs`,
then the full Node suite. These tests use real state/controller/view modules with
simulated DOM, storage, accounts and editor APIs. They cover account-specific
page/reference restoration, collaborative resync, all transfer choices, duplicate
and stale controls, delayed account listing, serialized mounts, rejected delivery,
corrupt accounts/drafts, retry and newer-content preservation.

Open `https://localhost:51888/tests/editor-switch.browser.html` through the source
launcher (adjust the port to its actual URL). Expect a final `PASS:` covering real
DOM controls and the new modules; editor APIs, accounts and storage are mocked,
with no external requests or file writes. Also rerun
`tests/file-recognition.browser.html` and `tests/editor-references.browser.html`
for the real-handler integration paths. The visible editor marker is
`test 2026-11-19.1`.

In the normal app, switch between Text, HTML and Annotation with bodies, references
and loaded files. Check Overwrite, Insert, Don't transfer and Cancel; confirm that
returning to an editor resumes its page and references. Refresh with a saved local
draft, then test Restore and Discard. Type newer content while the restore dialog
is open and confirm it survives. Check a live collaborative editor separately if
available; fixture success does not establish its connectivity or authorization.

## Load/Blank controls and loaded-page presentation

Run `node --test tests/editor-controls.test.cjs tests/loaded-page-messages.test.cjs tests/editor-switch.test.cjs tests/file-recognition.test.cjs`,
then the full Node suite. These tests exercise real controller/view/state modules
with simulated DOM and mocked editor/storage/loader APIs: filtered sources,
shared routing, duplicate/stale requests, navigation/session/store/editor/file
changes, source failure/retry, blank Cancel/Discard, outgoing page/reference
restoration, newer content, failed/superseded initialization, publication controls
and stale/erroring toolbar actions.

Open `https://localhost:51888/tests/editor-controls.browser.html` through the
source launcher (adjust to its actual port). Expect a final `PASS:` for Load/Blank
and loaded-page controls. It uses real DOM/modules with mocked editors, loaders
and memory-only storage; no external requests or file writes. Also rerun
`tests/editor-switch.browser.html`, `tests/file-recognition.browser.html` and
`tests/editor-references.browser.html`. Marker: `test 2026-11-19.1`.

In the normal app, open Load, select a source and cancel; check Load blank on the
current editor (Cancel and Discard), then on another editor and back. Confirm that
the outgoing content, page and references resume. Check file-load notices and
Republish visibility for unpublished versus published records. Self-managing
service loader UI and live publishing remain separate integration checks.

## Save destination panel

Run `node --test tests/save-panel.test.cjs tests/publishing-controller.test.cjs tests/publishing-view.test.cjs`,
then the full Node suite. Tests use real Save state/controller/view modules with
simulated DOM and mocked savers. Coverage includes filtered destinations/icons,
original method binding/no arguments, keepOpen forms, the real Dropbox overwrite/cancel promise with mocked uploads, pending/duplicate locks
across rebuilds, editor/account/session/store/file/panel ownership, visible errors
and explicit retry, stale completion/failure, and existing collection delegation.

Open `https://localhost:51888/tests/save-panel.browser.html` through the source
launcher (adjust to its actual URL). Expect final `PASS:` from real DOM/modules
with mocked savers/accounts/storage, no external requests or file writes. Also
rerun `tests/publish-selection.browser.html` for adjacent Post-panel behavior.
The normal-app editor marker is `test 2026-11-19.1`.

In the normal app, check the Save destination list, cancellation of local saving,
and successful saving of an existing sample document/annotation. For available
service savers, check that keep-open forms and explicit overwrite choices remain
usable. These manual file/service actions are separate from the mocked fixtures;
no real file, upload or authorization is validated by their PASS result.

## References panel

Run `node --test tests/references-panel.test.cjs tests/editor-references.test.cjs tests/annotation-file.test.cjs`,
then the full Node suite. Coverage uses real References modules and simulated DOM:
exact URL dedup, structural/reply/extension retention, live target identity,
click/keyboard edits, single Enter/blur commit, stale row/editor/account/session/
document controls, state-owned visibility, Save metadata/unfinished edits,
failed/superseded annotation dispatch, detached collection snapshots, visible
errors, and standalone view operation without reference-state reads.

Open `https://localhost:51888/tests/references-panel.browser.html` through the
source launcher (adjust the port as needed), then rerun
`tests/editor-references.browser.html` and `tests/editor-switch.browser.html`.
Expect final `PASS:` from each. The new fixture uses real DOM and modules with
mocked editor switching and collection APIs, with no external requests or
file/storage writes. Normal-app editor marker: `test 2026-11-19.1`.

In the normal app, open Refs, edit author/title/feed/URL, remove a reference and
switch away/back. Check that reply metadata remains intact, explicit Annotate
keeps the source draft, and saving the current document leaves an unfinished
reference edit usable. Check Save as collection with a deliberate authorized
manual save separately. Shared-map synchronization and collection-helper live
writes are separate integration checks, not established by fixture PASS.

## Write tags and collection suggestions

Run `node --test tests/tags.test.cjs tests/editor-switch.test.cjs tests/file-recognition.test.cjs tests/annotation-publishing.test.cjs`,
then the full Node suite. Tags tests load real state/workflow/controller/view
modules with simulated DOM and mocked KV/crypto: exact duplicates/case, API
snapshots, keyboard/removal, prefix suggestions, delayed reads, anonymous and
expired-session tagging, session/server/mode cache isolation, stale dropdowns,
blur/refocus, global draft retention during a real delayed editor mount, creation
No/Yes, encrypted empty-array/add-only payload, AlreadyExists, uncertain failure,
no automatic retry, stale preparation and preservation of newer selections.

Open `https://localhost:51888/tests/tags.browser.html` through the source launcher
(adjust its port if needed). Expect final `PASS:` from real DOM/modules with
mocked storage/encryption/sessions, no external requests or file/storage writes.
Also rerun `tests/editor-switch.browser.html` and
`tests/file-recognition.browser.html` for adjacent mount/load paths. Normal-app
marker: `test 2026-11-19.1`. These browser checks remain separate from Node.

In the normal app, add/remove tags using Enter, comma, Backspace and suggestions;
check that unfinished text and selected tags survive editor switching. Check
anonymous tagging and the No choice without storage writes. A deliberate Yes on
a new test collection and live storage authorization are separate manual actions,
not established by mocked fixture PASS. No real collections are created by the
automated checks.

## Find/search

Run `node --test tests/find.test.cjs tests/reader-controller.test.cjs tests/localrss-reader.test.cjs`,
then the full Node suite. Find tests use real state/controller/view, central reader
invalidation, shared progressive renderer and real OpenAlex/Commons request code,
with mocked requests/normalizers/listing widgets. They cover query capture versus
DOM tampering, visibility, empty input, legacy method binding/no arguments,
duplicates, supersession, session/target/reader invalidation, late normalization,
encoded queries/cursors, retained earlier pages, failed-page explicit retry,
empty continuations, and safe literal feedback. They do not establish live APIs.

Open `https://localhost:51888/tests/find.browser.html` through the source launcher
(adjust the port as needed), plus `tests/reader-boundary.browser.html` for adjacent
central account reading. The Find fixture uses real DOM/modules/shared renderer
and OpenAlex/Commons normalizers, with mocked API responses, listing widgets,
feedback and reader invalidation. Expect final PASS. It does not run live searches
or perform storage writes. Editor marker: `test 2026-11-19.1`.

On 2026-11-19 the Tags fixture (`tests/tags.browser.html`, source marker
2026-11-18.5) was run in the in-app browser and reported its full PASS. The Find
fixture also reported PASS (21 checks), and the adjacent reader-boundary fixture
also reported PASS. These browser observations are separate from Node evidence.
In the normal app, check Find query input, provider changes and pagination; legacy
Google/DuckDuckGo/OASIS service behavior remains a separate integration path.


## Local file saving and My Pages

Run `node --test tests/file-save.test.cjs tests/my-pages.test.cjs tests/file-recognition.test.cjs`
and then the full Node suite. These checks mock browser file APIs, encryption,
accounts and storage. They cover captured native/raw/HTML exports, exact filenames
and document metadata, cancellation, duplicate saves, write-before-index ordering,
metadata-only failures, session/editor changes and permission-revoked handles.
My Pages covers global sorting/pagination, mixed page/collection records, content
routing, stale rows/loads, exact original deletion targets, uncertain deletion and
metadata-only retry after confirmed deletion. Collection cleanup keeps other
publications, members and extension metadata.

Open `/tests/file-save.browser.html`, `/tests/my-pages.browser.html` and
`/tests/file-recognition.browser.html` on the local server. These use real modules
and DOM, with file writes, downloads, service calls and storage mocked. Browser
results are separate from the Node run; no real local file or remote page is
created/deleted by these fixtures.

For normal-app checks, use disposable content: save native annotations/slides,
round-trip a loaded file under its original name, cancel both filename pickers,
then save again. Check My Pages sort, pagination, loading, local-only entries and
the inline delete choice. Real downloads, filesystem permissions and live-service
deletion require separate deliberate checks. Dropbox coverage is described in the following section.


Verified on 2026-11-19 for editor marker `test 2026-11-19.2`: full Node
suite **474/474 pass**, no skips/failures. The in-app browser reported PASS for
local file saving (18 checks), My Pages (23 checks), saved-file recognition,
Load/Blank and editor switching. File/service/storage writes were mocked in
these browser fixtures; ordinary-browser filesystem permissions and live-service
operations were not exercised.


## Dropbox file saving and picker

Run `node --test tests/dropbox-save.test.cjs tests/dropbox-save-view.test.cjs tests/dropbox-picker.test.cjs tests/save-panel.test.cjs tests/public-feed-editor.test.cjs`,
then the full Node suite. All Dropbox HTTP, account persistence and file writes
are mocked. Tests cover captured native/raw/HTML exports, exact filenames and
folders, collection-format exports through the same save controller, explicit
overwrite/Cancel and add-conflict choices, duplicate/stale controls, uncertain
uploads without automatic replay, definite-401 refresh, captured credential
persistence, and accepted upload receipts after an editor/session expires.
Picker tests cover ordered folder continuation updates/deletes, global date
ordering, invalid cursors, exact filenames, content-first routing, explicit read
retry, missing scopes, Cancel and stale/removed source controls.

Open `/tests/dropbox-save.browser.html`, `/tests/dropbox-picker.browser.html` and
`/tests/save-panel.browser.html` through the local server. They use real modules
and DOM with mocked HTTP, account persistence and editor APIs; no external
requests or file/storage writes occur. Verify each final PASS separately.
Normal-account OAuth, live Dropbox permissions, large uploads and actual service
writes remain separate deliberate integration checks. Initial OAuth setup remains
on its existing path; file-operation refresh now uses captured session persistence.

Editor marker: `test 2026-11-19.3`. On 2026-11-19 the full Node run passed
**505/505**, with no failures/skips. The in-app browser reported PASS for Dropbox
saving (24 checks), Dropbox picker (18 checks), and the generic Save panel.


## Collection browsing, imports, memberships and opening

Run `node --test tests/collection-browser.test.cjs tests/collection-import.test.cjs tests/collection-members.test.cjs tests/collection-opening.test.cjs tests/collection-entry.test.cjs tests/public-feed-editor.test.cjs`,
then the full Node suite. The 2026-11-19 full run passed **553/553**, with no
failures or skips. These checks mock storage, encryption, service/editor APIs and
file inputs; they do not establish ordinary-browser or live-service success.

The user performs browser checks. The following new fixtures are **pending**;
open each through the launcher and report its final PASS or FAIL:

- `/tests/collection-browser.browser.html`: saved/feed collection listing, My Collections loading, deletion choices/errors, reader/session isolation and detail actions.
- `/tests/collection-import.browser.html`: content-first URL/file recognition, identity/extensions, Overwrite/Merge/Cancel, incoming destination protection, chat imports and explicit retry.
- `/tests/collection-members.browser.html`: captured feed references, independent duplicate memberships, preserved incoming members/extensions, failed-write isolation, replaced rows/pickers/session guards and nested-cycle rejection.
- `/tests/collection-opening.browser.html`: Open/Insert/Cancel, references and unsaved drafts, failed-mount recovery, stale member loads, local blob entries, add-only nested imports and existing-resource choices.

Each should report its final **PASS**. HTTP, KV storage, encryption, editor APIs,
sharing and file effects are mocked where used; the fixtures make no external
requests or real file/storage writes. Browser fixture preparation is separate
from execution. Editor marker: `test 2026-11-19.4`.

In the normal app, additionally check Collections list/detail/back, feed collection
read/edit, collecting the same item twice and removing one copy, import preview
and conflict Cancel, and return to an unsaved collection after editing one owned
member. Ordinary editor row widgets, collection Save/publication, generic From URL
loading and catalogue publication retain their existing implementations; they
are not newly migrated by this browsing/import/membership slice.


Collection browser results reported by the user: browsing **PASS (15 checks)**,
memberships **PASS (17)** and opening/draft entries **PASS (18)**. Imports failed
at the membership-preservation assertion: the real shared JSON parser discarded
member IDs/extensions. The parser now retains open member fields, native author
metadata and nested memberships. A regression runs actual recognition through
import persistence; the full Node suite passed **554/554**. The user subsequently
reported imports **PASS (23 checks)** and saved-file recognition **PASS** with
marker `test 2026-11-19.5`. All four collection browser fixtures and the adjacent
recognition regression now have user-reported PASS results. These use mocked
services/storage; no live-service or ordinary-account validation is implied.


## Service readers and row actions — 2026-11-20

Fresh automated result: `node --test tests/*.test.cjs` — **597 passed, 0 failed,
0 skipped**. Focused reader/search/public-feed/publishing compatibility checks:
**167 passed**. Script paths and JavaScript syntax checked for `index.html` and
the six pages below; this is not browser execution. Editor marker:
`test 2026-11-20.1`. All six browser fixtures for this stage have user-reported **PASS** results.

Ask the user to open these pages on their existing launcher (port 51888):

- [Shared row context](https://localhost:51888/tests/reader-row-context.browser.html): real shared renderer/context, common controls, private credentials, earlier-page actions and stale row/account/public surface rejection.
- [Mastodon](https://localhost:51888/tests/mastodon-reader.browser.html): captured account, paging, toggles, Reply and newer-draft protection.
- [Bluesky](https://localhost:51888/tests/bluesky-reader.browser.html): selected-account authentication, opaque cursors, toggles, Reply/Search/Recommended and uncertain failures.
- [Discord and public feeds](https://localhost:51888/tests/other-readers.browser.html): captured channel, private/public headers, partial changelog errors and stale public pickers.
- [Annotations](https://localhost:51888/tests/annotation-reader.browser.html): discovery, counts, follow controls, exact node/thread restoration and session isolation.
- [LocalRSS regression](https://localhost:51888/tests/localrss-reader.browser.html): existing full LocalRSS fixture with callback-bound row/audio/Show posts controls.

Each should end with **PASS**. Service HTTP/authentication/storage/publication
and related effects are mocked; these fixtures do not establish live service or
OAuth behavior. The shared-context page uses the real listing renderer and reader
controller; individual service pages mock shared chrome/context as described on
those pages. In the normal app, separately check initial feed selection, paging,
opening a post/thread and returning, account switching and surviving shared row
controls. Do not send live posts or toggle real service data merely to validate
this refactor without the user's authorization.

Google/DuckDuckGo/OASIS internals and remaining stateless search-row controls are
deferred to the next small stage. Annotation controller presentation cleanup,
initial OAuth/identity/admin workflows and later roadmap stages remain separate.

Targeted service checks use:

```powershell
node --test tests/mastodon-reader.test.cjs tests/bluesky-reader.test.cjs tests/annotation-reader.test.cjs tests/other-readers.test.cjs tests/reader-row-context.test.cjs tests/reader-controller.test.cjs tests/localrss-reader.test.cjs tests/find.test.cjs tests/social-publishing.test.cjs tests/public-feed-accounts.test.cjs tests/public-feed-editor.test.cjs
```

Data checks exercise explicit transport without a DOM, captured accounts/targets,
wrong-origin Mastodon cursors, opaque Bluesky cursors, partial read failures and
uncertain writes without automatic retry. Controller/view checks exercise pending
locks, stale account/session/row/read completions, unchanged versus newer form
text, earlier-page actions, public picker replacement, annotation exact-node batch
counts and delayed follow preparation. Existing publishing tests retain their
explicit-account contract. No successful mocked result is a live-service claim.

The shared-row Node checks also preserve thread/summary Load into editor controls
after removing the old Mastodon action dispatcher. They invoke the shared loader
with the original source IDs.

User-reported browser results for the 2026-11-20 service-reader stage:

- Shared row context: **PASS (14 checks)**.
- Mastodon: **PASS (13 checks)**.
- Bluesky: **PASS (15 checks)**.
- Discord/public feeds: **PASS (15 checks)**.
- Annotations: **PASS (14 checks)**.
- LocalRSS: **PASS**, including Options, search, Show posts/Refresh, feed management/cache and OPML/account creation.

These are user-executed browser fixtures with mocked services/actions and no
external requests or writes. They are separate from the recorded **597/597 Node**
result and do not establish live-service, OAuth or normal-account behavior.


## Google, DuckDuckGo and OASIS — small follow-up

The providers now use the existing captured Find boundary and a shared row-control
view. Fresh automated results: **37 focused Node tests passed**, then
`node --test tests/*.test.cjs` — **604 passed, 0 failed, 0 skipped**. Script paths
and JavaScript syntax checked for the app and new fixture. This does not establish
browser or live-service behavior. Editor marker: `test 2026-11-20.2`.

User browser check remains **pending**:
[Search providers](https://localhost:51888/tests/search-providers.browser.html).
Expect final **PASS**. It exercises real Find/provider transport/normalization,
shared rendering, reader menu view and bound row controls. HTTP, accounts, reader
invalidation, listing widgets and external actions are mocked. No external requests
or writes. Coverage includes Google query/credentials, API paging and Web/Images,
stale menus/responses/rows/session, nested DDG topics, actual OASIS HTML parsing,
encoded proxy inputs, metadata and visible empty/error feedback.

In the normal app, separately check Google Web/Images after changing the input
draft, paging, DDG disambiguation groups and OASIS results. Live service/OAuth
checks have not been performed. OpenAlex/Commons inline controls and annotation
presentation cleanup are outside this small stage.

Run focused checks with:

```powershell
node --test tests/find.test.cjs tests/reader-controller.test.cjs tests/reader-row-context.test.cjs
```

The Find Node fixture runs actual provider registrations/controllers and requests.
Request-only tests supply transport dependencies without a DOM. Node substitutes
HTML parsing where needed; the browser page exercises actual DOMParser for DDG
and OASIS. The prior legacy-registration case now asserts the captured context
contract, while the existing third-party no-argument compatibility test remains.


User browser follow-up: the search-provider fixture failed selecting OASIS because
its button text includes the Material Icon name (`school`) before the label. The
fixture now selects the label span and reports missing providers explicitly. A
regression runs that exact selector against real Find controls. **23 Find Node
tests pass** after this fixture-only fix. Browser rerun is pending; the recorded
604-test full-suite result predates this additional regression. Application search
code is unchanged by this fix.

The user reran `search-providers.browser.html` after the label-selector fix and
reported **PASS (17 checks)**: captured Google query/credentials, Web/Images,
paging/earlier-page controls, nested DDG topics, OASIS HTML parsing/proxy headers,
empty/error feedback and stale request/menu/row/session guards. Services/actions
were mocked; no external requests or writes. This supersedes the pending browser
rerun above and completes this small stage's browser validation.


## OpenAlex and Commons row controls — small follow-up

Both providers now use `bindSearchProviderRow` instead of inline HTML action
handlers. Existing request construction, normalization and pagination are retained.
Controls capture the original URL/row ID, survive paging and Find panel closure,
and reject detached/replaced rows and changed sessions. No new component or
transport was introduced. Editor marker: `test 2026-11-20.3`.

Fresh checks: **27 focused Node tests passed** with
`node --test tests/find.test.cjs tests/reader-row-context.test.cjs`, then the full
`node --test tests/*.test.cjs` suite passed **606/606**, with no failures or skips.
App/fixture script paths and JavaScript syntax were checked separately.

User browser rerun **pending**:
[Find boundary](https://localhost:51888/tests/find.browser.html). Expect final
**PASS**. This existing fixture now binds real provider row controls while keeping
listing widgets, HTTP, external actions, feedback and reader invalidation mocked.
It checks callback markup, OpenAlex expansion, earlier-page OpenAlex/Commons browser
actions, replaced rows and session-stale actions alongside existing query/paging
checks. It makes no external requests or writes and does not establish live API
or complete reader integration behavior.


User reran `find.browser.html` and reported **PASS (28 checks)**, including real
OpenAlex/Commons request construction/normalization, captured pagination, callback
row controls and earlier-page/stale-row guards. APIs, listing widgets, feedback,
external actions and reader invalidation were mocked; no external requests or
storage writes. This completes browser validation for this small follow-up and
supersedes its pending rerun above. It does not establish live-service or full
reader integration behavior.


## Annotation presentation cleanup — small follow-up

`annotate_reader.js` now supplies captured Follow/Flow row commands through
`annotationRowOptions`; `annotate_view.js` renders and invokes those callbacks.
Flow retains its captured annotation session and existing publishing workflow.
Stale rows cannot dispatch commands, and follow errors route back to view feedback.
The last feed-author label, follow/unfollow notice and partial-batch warning
presentation now live in the view. Existing discovery, persistence, account/session
ownership, duplicate guards and exact-node thread restoration are retained.

Fresh checks: **31 focused Node tests passed** with
`node --test tests/annotation-reader.test.cjs tests/annotation-publishing.test.cjs`,
then `node --test tests/*.test.cjs` passed **607/607**, no failures or skips.
App and annotation fixture script paths/JavaScript syntax were checked separately.
Editor marker: `test 2026-11-20.4`.

User browser rerun **pending**:
[Annotation reader](https://localhost:51888/tests/annotation-reader.browser.html).
Expect final **PASS**. Existing checks are extended with empty-feed presentation,
real follow feedback using mocked persistence, captured Flow commands, detached
follow/Flow controls and view-owned feed-author text. HTTP, encryption, storage,
reader surfaces, sharing and Flow publication are mocked; no external requests
or actual file/storage writes. Browser preparation does not establish execution,
live-service or ordinary-account behavior.


User reran `annotation-reader.browser.html` and reported **PASS (20 checks)**,
including view-owned empty/follow feedback, captured row Flow commands, stale
controls, exact-node thread restoration and session isolation. HTTP, encryption,
storage, reader surfaces, sharing and Flow publication were mocked; no external
requests or writes. This supersedes the pending annotation rerun above and
completes browser validation for this small stage. It is separate from the
recorded **607/607 Node** result and does not establish live-service behavior.


## Me → Following — first small identity slice

Following now uses `following-workflow.js` for explicit list/decrypt/delete
operations, `following.js` for captured session/panel/request/row ownership, and
`following-view.js` for controls and feedback. `playFollowing` and
`kvstoreFollowingPanel` remain compatibility entry points. The annotation refresh
hook and follow-cache invalidation are retained. Login, DID publication/proofs,
migration and administrative settings are outside this slice.

Delete the exact stored key, even when the decrypted DID differs. Partial
unreadable records retain their key-derived identity and a visible warning.
Unfollow locks persist across list refreshes; old rows and changed login/server/
storage-mode/panel callbacks expire. Failures keep the row and offer explicit
retry through Unfollow; no automatic delete retries. Accepted writes remain
separate from later list refresh errors. Storage uses the existing facade, which
captures its destination/authentication synchronously when the operation starts.
Credentials stay outside `CList.state.following`; it holds only panel/request IDs,
phase, error and pending count. Profile links/labels use safe text and standard
buttons. Unknown DID formats display as text.

Fresh checks: **15 focused Node tests passed** with
`node --test tests/following.test.cjs tests/annotation-reader.test.cjs`, then
`node --test tests/*.test.cjs` passed **613/613**, no failures or skips. Workflow
checks run without DOM; controller/view checks use simulated elements. App and
fixture script paths/JavaScript syntax were checked separately.

User browser check **pending**:
[Following panel](https://localhost:51888/tests/following.browser.html). Expect
final **PASS**. It runs real workflow/controller/view with mocked session, storage,
keys and decryption: safe labels/links, unreadable-entry warnings, exact delete
keys, duplicate/refresh locks, uncertain failures and explicit retry, stale
sessions/panels, empty/login/error feedback and credential-free state. No external
requests or real storage writes. This does not verify deployed authentication,
DID services or the full Me navigation. Editor marker: `test 2026-11-20.5`.


User ran `following.browser.html` and reported **PASS (17 checks)**, covering exact
stored keys, safe labels/links, unreadable-entry warnings, duplicate/refresh locks,
uncertain failure and explicit retry, stale session/panel guards, empty/login/error
feedback and credential-free presentation state. Storage, encryption and session
APIs were mocked; no external requests or real storage writes. This supersedes
the pending Following browser check above and completes validation for this small
slice, separately from the recorded **613/613 Node** result. Live authentication,
DID services and full Me navigation remain unverified by these fixtures.


## DID identity display and public account listing — read-only slice

`did-identity-workflow.js` owns explicit hosted/local identity reads and account
list/decryption/projection. `did-identity.js` captures panel/session/storage mode
and independent identity/account request lanes. `did-identity-view.js` owns safe
status/account rendering, retry controls and section visibility. The existing
`kvstoreDidPanel` builds its unchanged management shell and delegates read startup,
post-write account reloads and visibility rendering. It retains existing identity
write handlers; publishing, proof, removal and migration lifecycles are not migrated
or claimed stale-safe by this slice.

Hosted 404 distinguishes missing identity from an imported unpublished key. Other
HTTP/storage/key failures remain visible and permit explicit read retry rather than
being reported as no identity. Local mode derives public display data only and
skips hosted identity/account reads. Optional aliases and malformed account records
are handled safely; unreadable accounts are skipped with visible partial warnings.
New reads, changed sessions/server/mode, closed/replaced panels and expired retry
callbacks reject stale effects. Both request lanes keep separate ownership.

The public checkbox `checked`/`data-key` contract is retained for legacy Update DID.
Account labels/keys use DOM text/property assignment; the view receives only key,
title, type and public flag, not credentials. This is read/display separation,
not migration of publication selection/state or other write workflows.
`CList.state.identityDisplay` contains only panel/request IDs, phases and errors.
The new read path uses `CList.keys.DID_IDENTITY_KEY` for the existing stored key;
record formats and cryptographic primitives are unchanged.

Fresh checks: **13 focused Node tests passed** with
`node --test tests/did-identity.test.cjs tests/following.test.cjs`, then
`node --test tests/*.test.cjs` passed **620/620**, no failures or skips. Checks
include explicit workflow dependencies without DOM, hosted/local/missing/imported
identity, safe metadata, partial account failures, current failure/retry, independent
request supersession and stale session/server/mode/panel guards. One Node check
mounts the actual existing DID panel builder with extracted reads and checks legacy
checkbox/write-button compatibility without invoking a write. App/fixture script
paths and JavaScript syntax were checked separately.

User browser check **pending**:
[DID identity display](https://localhost:51888/tests/did-identity.browser.html).
Expect final **PASS**. It loads the real existing panel and extracted read modules,
with session/HTTP/storage/key derivation mocked and write attempts blocked. General
application bootstrap is isolated; no external requests or writes are performed.
It does not validate real authentication, cryptography, DID publication, proof,
removal or migration. Editor marker: `test 2026-11-20.6`.


User ran `did-identity.browser.html` and reported **PASS (18 checks)**: real existing
DID panel plus read workflow/controller/view, hosted/local/missing/unpublished
identity, safe metadata/account labels, legacy checkbox compatibility, partial
warnings, HTTP failure/retry, stale panel/session/request guards and private-data
exclusion. HTTP, storage, sessions and key derivation were mocked; no external
requests or writes. This supersedes the pending DID display check above and
completes browser validation for the read-only slice, separately from the recorded
**620/620 Node** result. Publishing, proof, removal, migration and live authentication
remain outside this evidence.


## Prove Same Identity — small identity slice

`did-proof-workflow.js` takes an explicit target and read/crypto dependencies;
`did-proof.js` captures the current DID panel, session/mode and request lifetime;
`did-proof-view.js` owns input capture, controls and progress/result/error rendering.
The existing DID panel binds this controller. No identity/storage publication,
removal or migration writes were added or invoked. Existing crypto helpers remain
unchanged. Verification uses the fetched public JWK and the exact locally signed
challenge/signature; a did:key alias is display metadata, not the proof decision.

Targets require HTTP(S) URLs without embedded credentials/query/fragment and an
encoded normalized username. Own credentials are not sent to the other account.
Duplicate clicks are suppressed. Input edits expire/abort old work and permit a
new request; stale completions cannot reset newer feedback/controls. Session,
server, local/hosted mode, closed/replaced panel and request changes reject pending
key preparation, signing/verification continuation and UI effects. An already
started crypto operation is not cancelled, but its stale continuation is rejected.
Key mismatch is a completed verification outcome, distinct from visible transport,
key/decryption and crypto failures. Explicit retry is available via the normal
proof button; no automatic retries. All result metadata uses text rendering.
`CListIdentityProofState` stores only panel/request IDs, phase and error; decrypted
keys, signatures, challenges and tokens remain transient.

Fresh checks: **13 focused Node tests passed** with
`node --test tests/did-proof.test.cjs tests/did-identity.test.cjs`, then
`node --test tests/*.test.cjs` passed **626/626**, no failures or skips. The focused
cases cover explicit workflows without DOM, exact signing/verification inputs,
validation, missing login/keys, mismatch/error separation, duplicate clicks, input
supersession and stale token/server/mode/panel guards. Crypto and external APIs
are mocked; these results do not validate cryptographic primitives or real servers.
App/fixture script paths and JavaScript syntax were checked separately.

User browser rerun **pending**:
[DID identity and proof](https://localhost:51888/tests/did-identity.browser.html).
Expect final **PASS**. The existing real-panel fixture retains the display checks
and adds captured proof, safe metadata, duplicate/input/session guards and mismatch
feedback. HTTP/storage writes are blocked; session, key operations and signing/
verification are mocked. No external requests or writes. Publication, removal and
migration are not exercised. Editor marker: `test 2026-11-20.7`.


User reran `did-identity.browser.html` and reported **PASS (27 checks)**, retaining
the real-panel identity display/account-list coverage and adding captured identity
proof, duplicate/input/session guards, key mismatch and private-data exclusion.
HTTP, storage, sessions, key derivation and proof cryptography were mocked; no
external requests or writes. This supersedes the pending proof browser rerun above
and completes browser validation for this small stage, separately from the
recorded **626/626 Node** result. Publishing, removal, migration and live services
remain outside this evidence.


## Publish Existing Key — small DID publication slice

`did-publication-workflow.js` derives public material from the existing encrypted
identity key and performs explicit DID checks/publication. It never generates,
replaces or saves a private key. `did-publication.js` captures panel/session/mode,
owns pending locks, accepted receipts and reconciliation. `did-publication-view.js`
owns controls and feedback. The existing Publish Existing Key entry point delegates
to this controller. Generation/regeneration, Update DID selection/publication,
removal and migration remain separate legacy lifecycles.

Before PUT, recheck the captured stored key and current owner. Public DID preflight
uses a fresh GET: an existing matching Ed25519 public key and did:key is reconciled
without replacing its document; a different identity is rejected. A new registration
retains the existing publicKeyJwk/didKey/empty service and aliases request contract.
These are cooperative client checks, not an atomic server-side precondition.
The controller cancels superseded identity display reads before publishing so
old read results/retries cannot replace publication feedback.

HTTP acceptance retains a receipt before reading optional response JSON. Body or
later account/collaboration refresh failures remain distinct from accepted DID
publication and never cause another PUT. Collaboration refresh now returns failed
destinations for visible post-publication feedback while retaining captured auth.
An uncertain transport outcome offers **Check publication**, a read-only check.
Matching publication reconciles it without replay; a confirmed missing document
offers a separate explicit **Retry publication** action. Pending locks span rebuilt
panels in the same captured session. Changed sessions/server/panels and changed
stored keys reject stale preparation/reconciliation; late accepted results do not
change newer panels or launch follow-up requests under another session.

`CList.state.identityPublication` holds only panel ID, phase and error. Tokens,
encrypted key snapshots, derived public material and receipts stay transient;
private key material never enters publication payloads or UI. Follow-up receipts
are in-memory; a new panel recovers accepted publication through public preflight.
No automatic publication retries were introduced.

Fresh checks: **22 focused Node tests passed** with
`node --test tests/did-publication.test.cjs tests/did-identity.test.cjs tests/did-proof.test.cjs`,
then `node --test tests/*.test.cjs` passed **635/635**, no failures or skips. Cases
cover explicit workflow dependencies without DOM, public-only payloads, matching/
conflicting documents, stale keys/session/panels, duplicate/rebuilt-panel locks,
uncertain accepted/missing reconciliation, unreadable accepted response bodies and
collaboration failure reporting with captured authorization. App and fixture
script paths/JavaScript syntax were checked separately.

User browser rerun **pending**:
[DID identity, proof and existing-key publication](https://localhost:51888/tests/did-identity.browser.html).
Expect final **PASS**. Existing real-panel display/proof cases now include mocked
publication, duplicate clicks, public-only payloads, post-publication warnings,
receipt retention, lost-response reconciliation, conflicting identity rejection and
stale session preparation. Only explicitly mocked publication PUTs are permitted;
other writes are blocked. No external requests or real writes occur. Real crypto,
live publication, generation/regeneration, removal and migration are not tested.
Editor marker: `test 2026-11-20.8`.


User reran `did-identity.browser.html` and reported **PASS (37 checks)**, retaining
identity display/proof coverage and adding captured existing-key publication,
receipts/uncertainty, stale publication/conflict guards and private-data exclusion.
HTTP including publication, storage, sessions and key derivation were mocked; no
external requests or real writes. This supersedes the pending publication browser
rerun above and completes validation for Publish Existing Key, separately from the
recorded **635/635 Node** result. Real crypto/live services, generation/regeneration,
Update DID, removal and migration remain outside this evidence.


## Shared password confirmation — small authentication slice

`password-confirmation-workflow.js` verifies a captured session-key snapshot using
explicit derivation/export/encoding dependencies. `password-confirmation.js`
owns dialog/session/source lifetime, pending state, one-time callback dispatch and
compatibility `verifyPassword` / `confirmWithPassword` entry points.
`password-confirmation-view.js` owns controls, modal lifecycle and feedback. The
same crypto helpers and local password-check algorithm remain in use; there is no
server authentication or identity write in this slice.

Default verification captures the original account/session/key. Custom import
verifiers remain supported independently of the current account password. Preserve
trusted message HTML (callers escape untrusted values), custom confirm labels/classes
and callback(password) behavior. Submit captures the password once before awaiting;
it never rereads a changed input after verification. Enter and click share a pending
lock; a completed callback is never dispatched again, even after rejection.

Cancel, replaced/externally closed modals, changed login/server/storage/key and
optional source guards expire pending callbacks. External modal closure clears
password inputs through a view-owned observer. Session/source expiry leaves Cancel
usable. Verification failures permit explicit retry; confirmed action failure is
reported separately without rerunning that action or closing another modal.
DID regenerate/remove and account export/import callers now supply their source
panel guard. These guards govern confirmation dispatch, not the caller's internal
async operations after dispatch: generation/removal and legacy transfer flows are
not thereby migrated or claimed safe against later session changes.

`CList.state.passwordConfirmation` holds only ID, phase and generic error. Passwords
and verification-key snapshots remain transient, are never logged or stored in
summaries, and are cleared from closed dialog controls. The shared status helper
reports callback failures without replacing a newer modal. Standard button classes
are used while preserving callers' existing confirm-class option.

Fresh checks: **7 focused Node tests passed** with
`node --test tests/password-confirmation.test.cjs`, then
`node --test tests/*.test.cjs` passed **642/642**, no failures or skips. Cases cover
explicit workflow dependencies, current-session verification, false/error retries,
custom import verifier and labels, captured passwords, Enter/click duplicates,
Cancel/replaced/external dialogs, session/server/storage/key/source expiry and
single action dispatch including async failures. App and fixture script paths/
JavaScript syntax were checked separately.

User browser check **pending**:
[Password confirmation](https://localhost:51888/tests/password-confirmation.browser.html).
Expect final **PASS**. Real workflow/controller/view; session storage, derivation,
custom verification, action callbacks and modal shell are mocked. Only synthetic
keys/passwords are used; there are no external requests, actual storage writes or
destructive identity actions. This does not establish real password derivation,
production login, export/import or destructive-operation behavior.
Editor marker: `test 2026-11-20.9`.


User ran `password-confirmation.browser.html` and reported **PASS (21 checks)**:
real workflow/controller/view, default/custom verifier contracts, captured passwords,
Enter/click duplicate guards, Cancel/replaced/external modal rejection, session/
source/key expiry, visible failures/explicit retry, single callback dispatch and
secret-free state. Session storage, derivation, custom verification, actions and
modal shell were mocked; no external requests, real storage writes or destructive
identity actions. This supersedes the pending confirmation browser check above and
completes validation for this small slice, separately from **642/642 Node** results.
Real login, key generation/removal and caller-owned async operations remain outside
this fixture evidence.


## First-time Generate Identity Key — small identity slice

`did-generation-workflow.js` owns explicit first-time key inspection/generation/
encryption and add-if-absent storage. `did-generation.js` captures panel/session/
mode, cross-panel pending locks, accepted storage receipts and read-only recovery.
`did-generation-view.js` owns generation/storage feedback. The Generate Identity
Key button delegates here; confirmed Regenerate Key continues through its separate
legacy function. Key removal, migration and Update DID remain separate.

The first-time path never overwrites an existing stored identity. Existing or
concurrently created keys are inspected/derived and preserved. New keys use the
existing storage facade's `add`, not `put`; AlreadyExists never falls back to an
update. Existing crypto primitives and encrypted record format are unchanged.
Guards are checked after key preparation/generation/encryption and before storage;
accepted adds retain their receipt even if the panel/session later changes.
Client guards cooperate with the storage adapter's add-if-absent contract.

Local mode stores the key without hosted requests. Hosted mode hands the stored
key to the existing publication controller, bound to its exact derived did:key;
a subsequently changed identity cannot be published by that captured generation.
Storage completion and publication completion remain separate. Publication recovery
reuses the same stored key and existing publication receipts/checks; it never
regenerates. Unknown add outcomes offer **Check stored identity**, which only reads
and derives a stored key. Missing storage then offers a separate explicit **Retry
generation**. No automatic key generation/storage retries or identity replacement.
Retained Generate callbacks cannot regenerate after an accepted storage receipt.

`CList.state.identityGeneration` holds only panel ID, phase and error. Private keys
and encryption material remain in transient crypto operations; receipts expose only
didKey/existing. Post-storage failure offers read-only identity refresh while
retaining the stored-key outcome. These guards do not migrate Regenerate Key's
legacy internal lifecycle.

Fresh checks: **24 focused Node tests passed** with
`node --test tests/did-generation.test.cjs tests/did-publication.test.cjs tests/did-identity.test.cjs`,
then `node --test tests/*.test.cjs` passed **650/650**, no failures or skips. Cases
cover local/hosted first-time creation, existing/concurrent key preservation,
encrypted add-only payloads, uncertain storage checks, duplicate/rebuilt panels,
stale session/server/mode/closed panels, post-store failure recovery, explicit
workflow dependencies without DOM and publication of the exact stored identity.
App/fixture script paths and JavaScript syntax were checked separately.

User browser rerun **pending**:
[DID identity and first-time generation](https://localhost:51888/tests/did-identity.browser.html).
Expect final **PASS**. Existing cases gain add-only creation, hosted publication
reuse, local-only behavior, storage/publication uncertainty recovery, retained
Generate rejection and stale-session preparation. HTTP/key/storage operations are
mocked; only explicitly mocked add/publication writes are permitted. No external
requests or real writes. Regeneration, removal, migration and real cryptography
are not exercised. Editor marker: `test 2026-11-20.10`.


User reran `did-identity.browser.html` and reported **PASS (48 checks)**, retaining
identity display/proof/publication coverage and adding add-only first-time
generation, storage/publication recovery and private-data exclusion. HTTP including
publication, storage, sessions, key derivation and generation were mocked; no
external requests or real writes. This supersedes the pending generation browser
rerun above and completes validation for this small slice, separately from the
recorded **650/650 Node** result. Regeneration, removal, migration, live services
and real cryptography remain outside this fixture evidence.


## Regenerate Key / confirmed rotation

`did-rotation-workflow.js`, `did-rotation.js` and `did-rotation-view.js` replace
the legacy rotation body. Preparation captures the original encrypted key and
public identity before the shared password prompt; Cancel causes no key change.
The confirmed target, login/server/mode/panel and public key are rechecked before
generation and storage. Linked services (including extension fields) and non-key
aliases come from the latest accepted public document; old did:key aliases and
server-owned KVStore service entries are excluded as before. Metadata read failures
stop rather than silently publishing empty metadata. Local rotation has no hosted
requests. Existing crypto and encrypted key formats remain unchanged.

Replacement storage and publication have separate outcomes. Session-scoped,
in-memory plans retain encrypted replacement snapshots and receipts across panel
rebuilds; no new persistent receipt format is introduced. Unknown storage offers a
read-only check; an accepted replacement offers separate Continue publication.
Unknown publication is checked without replay; continuing publication reuses the
stored replacement, never another generated key. A conflict offers explicit
identity refresh. Successful rotation expires the old action; a subsequent rotation
requires fresh preparation/password confirmation. Shared publication transport
retains HTTP acceptance before response parsing; account/collaboration refresh
failures cannot repeat rotation/publication. No automatic retries or key rollback.
Client checks are cooperative: the storage update API is not compare-and-swap.

Rotation invalidates pending identity reads/proofs. Proof also rechecks its stored
key after verification, rejecting a key changed by another panel. Password
confirmation now returns an owned isOpen/cancel handle and supports a one-time
onCancel notification; existing callers remain compatible. Confirmation guards
govern dispatch; operation guards still govern each asynchronous write boundary.
Private keys stay in crypto operations; ciphertext/plans remain transient and do
not enter `CList.state.identityRotation`, which holds only panel ID/phase/error.

Fresh checks: **40 focused Node tests passed** with
`node --test tests/did-rotation.test.cjs tests/password-confirmation.test.cjs tests/did-publication.test.cjs tests/did-identity.test.cjs tests/did-proof.test.cjs`,
then `node --test tests/*.test.cjs` passed **660/660**, no failures or skips. Coverage
includes confirmation/Cancel, changed targets, metadata preservation, local mode,
partial/uncertain writes, explicit continuation, rebuilt-panel receipts, duplicate/
stale actions, source/session changes and old-key proof rejection. App/fixture
script paths and JavaScript syntax were checked separately.

User browser rerun **pending**:
[DID identity and rotation](https://localhost:51888/tests/did-identity.browser.html).
Expect final **PASS**. The existing real-panel fixture now also runs the real
password dialog with a mocked verifier/modal shell and mocked rotation key/storage/
publication operations. It checks cancellation, confirmed targets, metadata,
local mode, storage/publication recovery, retained actions and stale-session writes.
No external requests or real writes; removal/migration and real crypto/authentication
are not exercised. Editor marker: `test 2026-11-20.11`.


User reran `did-identity.browser.html` and reported **PASS (62 checks)**, retaining
identity display/proof/publication/generation coverage and adding confirmed key
rotation, preserved metadata, partial-rotation recovery and private-data exclusion.
HTTP including publication, storage, sessions, key derivation, regeneration and
password verification were mocked; no external requests or real writes. This
supersedes the pending rotation browser rerun above and completes validation for
this small slice, separately from **660/660 Node** results. Removal, migration,
live authentication/services and real cryptography remain outside this evidence.


## Remove DID — confirmed two-part removal

`did-removal-workflow.js`, `did-removal.js` and `did-removal-view.js` replace the
legacy removal body. Preparation captures the original encrypted-key value and
public identity before password confirmation; Cancel performs no delete. Changed
key/public identity/session/panel targets expire the action. Local mode removes
only the stored key and makes no hosted request.

Stored-key and public-document removal have separate, monotonic accepted/absence
receipts. A failed key deletion may still allow the captured public document to be
removed, preserving the former behavior, but completion is never reported until
both steps are acknowledged/confirmed absent. Partial/unknown outcomes offer
**Check removal** (read-only), then a separate **Retry remaining removal** for
unfinished steps. Accepted steps are not replayed. DELETE 404 needs a fresh public
read confirming absence; a missing delete endpoint alone is not success. KV read
errors are not interpreted as an absent private key. Target conflicts offer explicit
identity refresh and fresh confirmation rather than deleting another identity.

Transient session-owned plans survive panel rebuilds. Accepted old completions do
not drive the new panel; explicit checks reconcile receipts. Completion clears
obsolete rotation recovery plans and rebuilds fresh DID controls, enabling future
first-time generation without old receipts. A controls-refresh failure remains an
accepted-removal outcome and offers read-only recovery, never another delete.
No automatic retries, key restoration or actual tool-driven removal was performed.

Migrated generation/publication/rotation/removal coordinate mutation lifetimes;
first-time generation may delegate its expected key to publication. Legacy Update
DID and migration Run dispatch are guarded while another mutation is active and
hold a compatibility guard until their awaited action settles. Their internals
remain legacy and are not claimed fully captured/stale-safe by this wrapper.
Deletion invalidates pending proof/read feedback. The checks are cooperative client
guards, not cross-client/server atomic transactions.

`CList.state.identityRemoval` holds panel ID/phase/error only. Encrypted target
snapshots, public fingerprints and step receipts stay transient. Existing key/DID
record formats are unchanged. No plaintext private keys are needed for removal.

Fresh checks: **40 focused Node tests passed** with
`node --test tests/did-removal.test.cjs tests/did-generation.test.cjs tests/did-publication.test.cjs tests/did-rotation.test.cjs tests/did-identity.test.cjs`,
then `node --test tests/*.test.cjs` passed **669/669**, no failures or skips. Coverage
includes confirmation/Cancel, local/hosted removal, target changes, partial key
failure, uncertain/public DELETE outcomes, fresh-read validation of 404, exact
remaining-step retry, rebuilt panels, mutation coordination and accepted removal
with a failed UI refresh. App/fixture script paths and syntax were checked separately.

User browser rerun **pending**:
[DID identity and removal](https://localhost:51888/tests/did-identity.browser.html).
Expect final **PASS**. The existing real-panel/dialog fixture now includes mocked
removal, Cancel, partial/unknown recovery without replay, fresh controls after
completion, local mode and changed targets. All key/HTTP deletions are mocked;
no external requests or real writes. Migration, live authentication/storage and
real cryptography are not exercised. Editor marker: `test 2026-11-20.12`.


User reran `did-identity.browser.html` and reported **PASS (75 checks)**, retaining
identity display/proof/publication/generation/rotation coverage and adding confirmed
and partial removal with private-data exclusion. HTTP including publication and
removal, storage, sessions, key derivation, regeneration and password verification
were mocked; no external requests or real writes. This supersedes the pending
removal browser rerun above and completes validation for this slice, separately
from **669/669 Node** results. Migration, live authentication/storage/services and
real cryptography remain outside this fixture evidence.


## Update DID and public-account selection

`did-update-workflow.js`, `did-update.js` and `did-update-view.js` replace the legacy
Update DID body. Public choices live in controller-owned selection with a safe
`CList.state.identitySelection` projection; checkbox changes use captured keys and
expire when rows rebuild. Checked/data-key DOM tampering cannot choose targets.
Selections survive account-list refresh; source ciphertext versions remain transient.

Captured choices preserve account credentials/extensions while changing only public
flags. Account versions, identity key, page catalog and public DID are rechecked
before writes. Managed service extensions, unmapped public links, non-managed aliases
and catalog endpoints are preserved; unchecked managed Bluesky aliases are removed.
The UI explains that other public links are retained. Malformed/unreadable source
metadata fails visibly before publication. These are client checks, not server CAS.

Per-account visibility receipts and DID publication acceptance are independent.
Partial flag saves remain visible even after publication succeeds. Check update is
read-only; explicit Retry remaining update skips accepted steps. Changed drafts or
reopened panels cannot write the old choices without refreshing/start of a fresh
update. Unknown publication is reconciled without replaying flags/PUT. Newer public
metadata cannot be overwritten by retrying an unaccepted old plan. Accepted/newer
metadata is preserved, with a visible notice when applicable. Fresh unchanged choices
cause no writes. Migrated mutation coordination now includes Update DID; only
migration Run remains behind the compatibility dispatch wrapper.

Fresh checks: **15 focused Node tests passed** with
`node --test tests/did-update.test.cjs tests/did-identity.test.cjs`, then
`node --test tests/*.test.cjs` passed **677/677**, no failures or skips. Cases cover
state-owned/tampered selection, metadata/credential/catalog preservation, stale row
callbacks, partial and lost-response recovery, source/draft/session/panel changes,
duplicate dispatch and explicit workflow dependencies. App/fixture script paths and
JavaScript syntax passed separately.

User browser rerun **pending**:
[DID identity and Update DID](https://localhost:51888/tests/did-identity.browser.html).
Expect final **PASS**. The extended real-panel fixture adds state-owned choices,
credential/service/catalog preservation, managed aliases, partial visibility saves,
remaining-step retry and uncertain publication reconciliation. HTTP, storage,
sessions and crypto remain mocked; no external requests or real writes. Migration
is not exercised. Editor marker: `test 2026-11-20.13`.


User reran `did-identity.browser.html` and reported **PASS (85 checks)**, retaining
prior identity coverage and adding state-owned public choices, captured Update DID,
partial-update recovery and private-data exclusion. HTTP including publication,
storage, sessions, key derivation and identity operations were mocked; no external
requests or real writes. This supersedes the pending Update DID browser rerun above
and completes validation for this slice, separately from **677/677 Node** results.
Migration, live authentication/storage/services and real cryptography remain
outside this fixture evidence.


### Migration preparation and preview

`node --test tests/migration-preparation.test.cjs tests/did-identity.test.cjs`
checks real preparation workflow/controller/view plus existing DID-panel mounting.
Eight preparation tests cover detached local/hosted snapshots, conflict/DID counts,
secret-free state, invalid targets/records, captured inputs, duplicate/cancel/panel
lifetimes, accepted/uncertain registration receipts, explicit retry, state-owned
overwrite consent and one-use snapshot-revalidated handoff. Auth/register/storage,
crypto and execution are mocked; no external requests or actual writes.
`migration-preparation.browser.html` is the dedicated user handoff using real DOM
and extracted modules, with fixture shell/execution. `did-identity.browser.html`
loads the new scripts through its existing panel. User reported PASS for both
fixtures (25 preparation checks, 85 DID checks), with a migration-page display
issue subsequently clarified as plain text. The preparation fixture layout/status
presentation adjustment was visually confirmed by the user. Neither fixture exercises copy/link execution/recovery, live
credentials or real cryptography. A registration checkbox intentionally creates
a destination account during normal-app Preview; the UI explicitly says so.

### Migration execution and recovery

`node --test tests/migration-execution.test.cjs tests/migration-preparation.test.cjs tests/did-identity.test.cjs`
passes 26 tests (11 execution cases). `tests/helpers/migration-execution-fixture.js`
is shared by the execution Node test and `migration-execution.browser.html`.
It runs real execution workflow/controller/view, public identity capture/linking,
shared identity coordination and one-shot publication transport. The hosted success
case also uses real preparation/controller/view; other cases mock the approved
handoff, and the panel shell is a fixture. Accounts, HTTP including writes, KV data
and crypto are mocked; no real external requests or writes.

Coverage includes direct update of approved existing records, no add-409 overwrite
fallback, source and unrelated destination retention, metadata merging, per-step
receipts, partial/lost-reply copies and publications, read-only reconciliation,
explicit remaining-step retries, reusing generated ciphertext, stale source/session
and panel ownership, duplicate/expired callbacks and late accepted writes across
panel rebuilds. The user reported browser PASS: 35 checks, with all external
effects mocked. This is not proof of live
migration, real encryption, atomic concurrency or durable recovery across tab reload,
new source login or expired destination authorization. Existing DID mounting still
runs in the focused integration Node fixture; its prior browser result was 85 checks.


### Login/register panel and account-server selection

`node --test tests/auth-panel.test.cjs` has 9 tests. Seven shared cases in
`tests/helpers/auth-panel-fixture.js` also drive `auth-panel.browser.html` using
real state/controller/view and the application modal shell. Cases cover validation,
state-owned mode/draft server, private captured input, safe labels, password reset,
Local selection, Cancel, same-server behavior, preference persistence failure versus
accepted selection/refresh failure, duplicate/pending/rebuilt/expired guards and
post-login feedback. Two Node cases additionally extract real `submitAuthModal`
and mock its credentials/session/account-setup dependencies to check captured
registration order, duplicate suppression and accepted-login setup failure.
No real auth, registration, preference writes or external requests are made.
The user reported browser PASS: 21 checks, with the stated effects mocked.
Existing credential helpers still own
transport, session installation and seeding; their internal effects and registration
recovery are not proved guarded/cancellable by this fixture.

### Credential verification and session installation

`node --test tests/auth-credentials.test.cjs tests/auth-panel.test.cjs` passes 19 tests.
Nine credential cases in `tests/helpers/auth-credentials-fixture.js` drive both Node
and `auth-credentials.browser.html` (user-reported PASS: 27 checks). They use real
credential/session data workflows, compatibility helpers and form controller/view
with the application shell. Hosted/Local auth, derivation/export, cookies and
sessionStorage are mocked; no actual network/storage writes or real cryptography.
Coverage includes captured routing/Local adapter, username/hash-only requests,
matching username/token/future-expiry validation, registration acceptance surviving
login failure/rebuilt panels, uncertain creation/login-check/explicit retry, late
creation acceptance, stale server/session rejection before install, token-last
saving and readback, key/partial/silent-cookie rollback and incomplete restoration,
private presentation state, concurrent direct registration and unchanged helper
contracts. The form bridge tests mock the combined credential entry point and keep
registration/login/setup order assertions. Post-login setup/seeding, remote session
revocation, reload-persistent receipts and real browser storage failure modes are
outside the mocked evidence. Prior form-only browser PASS: 21 checks.

### Post-login account setup and seeding

`node --test tests/post-login.test.cjs tests/auth-panel.test.cjs tests/public-feed-accounts.test.cjs`
passes 22 tests, including nine setup cases shared with `post-login.browser.html`
through `helpers/post-login-fixture.js`. Real setup workflow/controller/view,
Collab/Annotations/CListBin descriptors and public discovery run with accepted
login/session, HTTP, KV/crypto, account loading, reader and modal shell mocked.
No external requests or actual writes. The user reported browser PASS: 22 checks.
Cases cover all seeds before one refresh, registration-only subscriptions, Local
exclusions, existing account data, partial discovery, retained add/registration
receipts, read-only refresh/check, targeted unknown-registration retry, expired
modal/source/panel ownership and preserved reader navigation/default targets.
The former public-subscription test that matched legacy inline source has been
replaced by captured-descriptor behavior; real registration/login gating and
refresh ordering are asserted in the shared setup cases. Normal-app startup,
logout, live service registrations, real encryption and durable reload recovery
remain outside these fixtures.

### Logout and session restoration

`node --test tests/session-lifecycle.test.cjs tests/auth-panel.test.cjs tests/auth-credentials.test.cjs`
passes 28 tests. Nine lifecycle cases in `helpers/session-lifecycle-fixture.js`
also drive `session-lifecycle.browser.html` (user-reported PASS: 24 checks), using real
workflow/controller/view with cookie/tab storage, key import, account loading,
identity widgets, modal shell, timers and reload mocked. No live calls, actual
writes or reload. An additional Node credential case verifies that a logout epoch
rejects pending direct login installation even when source cookies were empty.
The existing DID fixture mocks startup restoration because its scope is the DID
panel; its earlier browser result does not establish lifecycle coverage.

Cases cover hosted/Local read-only restore, invalid/missing/expired inputs,
import versus account-read failure/retry, superseding reads and captured delayed
callbacks, reader navigation, token-first cleanup and duplicate suppression,
preserved unrelated keys/preferences, failed deletion, expired retry, partial
cleanup, one-time notices and reload-only retry. Existing account-loader source
extraction was updated without changing its behavioral assertions (7/7 passed).
Actual browser cookie policy, cross-tab event delivery, full application reload,
remote revocation and real cryptography remain outside the mocked evidence.

Final lifecycle regression evidence: full Node suite 733/733, zero failures/skips.

### Administrative settings

`node --test tests/admin-settings.test.cjs` passes 10 tests. The shared
`helpers/admin-settings-fixture.js` also drives `admin-settings.browser.html`
(user-reported PASS: 25 checks). Real workflow/controller/view/app metadata run with
HTTP, credentials, Local mode and modal/navigation mocked; no external requests
or actual settings writes. Coverage includes captured app/session headers and
LocalRSS-only issuing URL, dynamic KVStore selection, desktop/mobile expired
picker callbacks, safe schema/Help text, hidden secrets, changed-only Save,
blank-sensitive omission, newer text/secret drafts, immediate one-key boolean
saves, duplicate/rebuilt/stale controls, definite rejection, HTTP acceptance with
missing body, uncertain writes and read-only check/explicit reviewed save. Local
authorization and malformed schemas fail closed. Actual server authorization,
server-side races, reload-persistent recovery, live schemas and full application
navigation are outside the mocked evidence. Full Node regression: 743/743.

### Pane persistence and layout commands

`node --test tests/panes.test.cjs` passes 10 tests. Nine cases shared through
`helpers/panes-fixture.js` drive `panes.browser.html` (user-reported PASS: 23 checks).
The real state/controller/view uses DOM nodes while preference storage,
geometry, viewport/event delivery and feature invalidators are mocked. A further
Node case loads the real initial `interface.js` bridge, runs its boot callback,
checks no restore write, verifies public helpers and preserves annotation/collab
aliases. No external requests or actual preference writes.

Coverage includes legacy serialized flex grows, tiny-value round trips, two
profiles, safe defaults/malformed reads, canonical state independent of styles,
editor-node preservation, snap thresholds, clamped drag and one mouseup save,
changed source/profile cancellation, mobile layout commands, transition/disposal
guards and storage failures. Actual browser geometry/transition event delivery,
full application panes, keyboard and swipe interpretation remain unverified by
these mocks. Full Node regression: 753/753, zero failures/skips.

### Keyboard and swipe navigation

`node --test tests/navigation.test.cjs` passes 11 tests. Ten cases shared through
`helpers/navigation-fixture.js` drive `navigation.browser.html` (user-reported
PASS: 41 checks). Real navigation state/controller/view uses DOM rows while events,
selection, scrolling, reader/session/pane state and annotation editor APIs are
mocked. The additional Node case runs real annotation helper code to check captured
selection and superseded editor-switch rejection. No external requests or writes.

Coverage includes J/K/X bounds/repeats/expanded rows; editing, composition, modifier
and modal suppression; earlier-page selection and shared row expiry; double-click
controls; captured Alt+A and duplicate/stale/failure cleanup; one-action horizontal
and vertical gestures, diagonals, desktop restrictions, multitouch/cancel and
source/reader/pane/selection expiry; mobile reader choices and disposed callbacks.
Native gesture/scroll delivery, actual editor mounting and full application
integration are outside these mocks. Full Node regression: 764/764, zero
failures/skips. Editor marker: `2026-11-20.22`.

### Shared reader action menu

`node --test tests/action-menu.test.cjs` passes 6 tests, sharing
`helpers/action-menu-fixture.js` with `action-menu.browser.html` (user-reported
PASS: 22 checks). Real shared controller/view and reader-menu bridge use literal labels,
captured command definitions and callbacks. Tests cover selected/disabled/missing
commands, arrow/Home/End movement and modified-key exclusion, busy and pending
duplicates, synchronous/asynchronous errors and explicit retry, detached/disposed
callbacks and late errors, definition snapshots, Translate and reader reset/empty
menus. Callbacks, reader state, translation, events and focus recording are mocked;
no external requests or writes. Full reader/service integration, native keyboard
delivery and pop-out/Back/Close/focus-restoration shells are not exercised.

Existing reader-boundary, reader-row-context, LocalRSS and search-provider browser
pages now load the shared menu dependencies before reader-view.js; their earlier
reported PASS results are historical, not fresh checks of this integration.
The full Node suite passed 770/770, zero failures/skips. Script paths/order,
JavaScript syntax and LF/diff checks passed. The user reported browser PASS:
22 checks, with the stated dependencies mocked and no external requests or writes.

### Reader menu pop-out shell

`menu-shell.test.cjs` has 7 cases shared through `helpers/menu-shell-fixture.js`
with `menu-shell.browser.html` (user-reported PASS: 26 checks). Run it with
`node --test tests/menu-shell.test.cjs tests/action-menu.test.cjs`.
Real shell controller/view, action menu, reader bridge and app stacked-modal code
exercise same-node/input preservation, exact original placement, Back/Close/Escape,
Tab boundaries/focus return, old presentation callbacks, replaced/external dialogs,
disposal without focus theft, existing-dialog failure/retry, pending command locks
across surfaces, reader rebuild and reset. Service commands, reader state,
translation, keyboard delivery and mutation notifications are mocked; browser
fixture focus/DOM movement use real browser APIs. No external requests or writes.
Full app layout, native input delivery and live services remain unverified.

Reader browser fixtures and the shared action-menu page now load menu-shell-view.js
and menu-shell.js before reader-view.js. Their previous user-reported passes
remain historical; the new pop-out page provides the focused browser handoff.
Focused shell/shared-menu run passed 13/13; full Node suite passed 777/777,
zero failures/skips. Syntax, inline scripts, local script paths/order and LF/diff
checks passed. The user reported browser PASS: 26 checks, with the stated
dependencies mocked and no external requests or writes.

### LocalRSS Options shared pop-out

`localrss-options-shell.test.cjs` has 7 cases shared through
`helpers/localrss-options-shell-fixture.js` with
`localrss-options-shell.browser.html` (user-reported PASS: 21 checks). The real Options
controller/view, shared shell and app modal retain the same root/input fields,
statistics and pending Mark all lock across surfaces. Cases cover captured
database/headers, Back/focus return, close/replaced/session guards, database
switching and existing-dialog error/retry. Browser checks use real DOM/focus and
the app overlay CSS; Node uses `helpers/menu-shell-dom.cjs`. Transport,
reader/account/session APIs, confirmation, feed/import sections, mutation
notifications and error presentation are mocked; no external requests or writes.
Live services, full app layout and native input delivery are not verified.

Focused command: `node --test tests/localrss-options-shell.test.cjs tests/menu-shell.test.cjs tests/localrss-reader.test.cjs tests/action-menu.test.cjs`.
Passed 89/89. Existing Options test mocks now describe connected roots and load the
shared-shell dependencies; original behavioral assertions remain intact. Shared
shell browser pages load the updated view; earlier PASS results are historical.
Full Node suite passed 784/784, zero failures/skips. Syntax, inline scripts,
script/stylesheet paths and script order, LF and diff checks passed; browser
validation: user-reported PASS, 21 checks, with the stated dependencies mocked
and no external requests or writes.

### P2P chat session lifecycle

`node --test tests/p2p-session.test.cjs` passes 10 cases, shared through
`helpers/p2p-session-fixture.js` with `p2p-session.browser.html` (user-reported PASS: 27 checks).
Real session controller/view and compatibility bridge run; selected cases also run
the real guarded DID installation, signed-send, incoming packet verification and
heartbeat helpers. PeerJS emitters/channels, HTTP, crypto, session values, timers,
message rendering and discussion effects are mocked; no external requests/writes.
Node uses the existing small DOM helper; browser controls use real DOM/synthetic
events. Cases cover one initialization/retry, hidden panel retention, captured
Send/Enter/Shift/composition controls, duplicate pending/open/reconnect callbacks,
same-ID inbound replacement, close/disposal/resource cleanup, source/view expiry,
credential-free summaries and stale asynchronous completions/heartbeat timers.
Live WebRTC, real crypto/key storage, native input, full app, discussion advertise/
end/directory, popup/share and collaboration-card workflows remain unverified.
Full Node suite passed 794/794, zero failures/skips; syntax, inline scripts,
local script paths/order and LF/diff checks passed. The user reported browser
PASS: 27 checks, with the stated dependencies mocked and no external requests or writes.

### Discussion directory and Join controls

`p2p-discussions.test.cjs` shares 8 cases through
`helpers/p2p-discussions-fixture.js` with `p2p-discussions.browser.html` (user-reported
PASS: 30 checks). Run `node --test tests/p2p-discussions.test.cjs tests/p2p-session.test.cjs`
(18/18 passed). Real captured GET/normalization, controller/view, compatibility
wrapper and current-session bridge run. HTTP, session values, Peer dispatch and
the shared error helper are mocked; no external requests or writes. Browser rows
use real DOM with captured callback invocation; Node uses the existing DOM helper.
Cases cover safe detached labels/targets, captured credentials/endpoint, abort and
out-of-order results, service/source/list expiry, login/empty/error/retry, malformed
JSON/records, duplicate pending/accepted peers, visible Join failure/explicit retry,
stale callbacks/completions, unavailable sessions and existing-channel reuse.
Live directory/WebRTC, native input, full app and Create/Leave are not exercised.
Full Node suite passed 802/802, zero failures/skips. Syntax, inline scripts,
local script paths/order and LF/diff checks passed. The user reported browser
PASS: 30 checks, with the stated dependencies mocked and no external requests or writes.

### Discussion Create/Leave receipts and recovery

`p2p-discussion-actions.test.cjs` shares 11 cases via
`helpers/discussion-actions-fixture.js` with `p2p-discussion-actions.browser.html`
(user-reported PASS: 32 checks). Real workflow/controller/view, compatibility entry points
and effects bridge cover captured POST/DELETE payloads, body-independent HTTP
acceptance, validation, pending/rebuilt/stale controls, newer drafts, safe state,
4xx rejection, lost/5xx uncertainty, read-only check and explicit original retry,
accepted-write/local-only recovery, changed conversations/sources, partial close/
refresh failure, one notice, deterministic layout and uncertain Leave heartbeat
pause. HTTP, Peer sessions/channels, cookies, heartbeat, notices and directory
refresh are mocked; no external requests or writes. Browser controls use real
DOM; Node uses the existing helper. Session checks also cover captured heartbeat
endpoint/token and service expiry. Earlier browser passes remain historical.

`node --test tests/p2p-discussion-actions.test.cjs tests/p2p-discussions.test.cjs tests/p2p-session.test.cjs`
passed 29/29. Full Node: 813/813, zero failures/skips. Live service/WebRTC, real
crypto and full app are not verified; directory review cannot prove mutation or
visibility. The user reported browser PASS: 32 checks, with the stated dependencies
mocked and no external requests or writes.

### Chat popup communication

`p2p-popup.test.cjs` has 9 cases shared via `helpers/p2p-popup-fixture.js` with
`p2p-popup.browser.html` (user-reported PASS: 25 checks). Real main/client controllers,
popup view and legacy entry/relay bridge run. Broadcast delivery, windows, session
ownership, sends/collaboration and timers are mocked. DOM controls use synthetic
events. No external requests or writes. Coverage includes channel isolation,
ready/focus reuse, credential-free state, pending/completed duplicate IDs, draft
preservation, relay/title reset, collaboration dispatch, source expiry, popup
reload client identity, old close packets/timers, blocked/direct popup URLs,
keyboard/IME and visible action/channel failures, plus the real compatibility
forwarder and owner close. Existing card rendering remains in the view; card/
collaboration workflow completion, live WebRTC, actual channel/window policy and
full app integration are not verified. Acknowledgements do not prove delivery.

Run `node --test tests/p2p-popup.test.cjs tests/p2p-session.test.cjs`.
Passed 19/19; full Node suite passed 822/822, zero failures/skips. Syntax, inline
scripts, local script paths/order and LF/diff checks passed. The user reported
browser PASS: 25 checks, with channels, windows, sessions, actions and timers
mocked; no external requests or writes.

### Main share/invite card controls

`p2p-cards.test.cjs` shares 8 cases via `helpers/p2p-cards-fixture.js` with
`p2p-cards.browser.html` (user-reported PASS: 24 checks). Real card controller/view
and compatibility wrappers cover literal detached fields, exact URL/reference
metadata, HTML escaping, safe link schemes/popup projections, collection/invite
extensions and anchors, per-card duplicate locks, detached/source/editor guards,
visible error/explicit retry, relay failure and bound editor API dispatch.
Session ownership, editor/reference, import, collaboration, navigation, popup
relay and the shared error helper are mocked; no external requests or writes.
Node uses the existing DOM helper; browser rows invoke captured callbacks.
Legacy API internals/mounting, same-editor newer-draft protection, full app/live
services and outgoing share preparation/broadcast are not exercised.

`node --test tests/p2p-cards.test.cjs` passed 8/8. The user reported browser PASS:
24 checks, with the stated dependencies mocked and no external requests or writes.

Full Node suite passed 830/830, zero failures/skips; syntax, inline scripts,
local script paths/order and LF/diff checks passed.

### Outgoing Share preparation and broadcast

`p2p-share.test.cjs` shares 8 cases via `helpers/p2p-share-fixture.js` with
`p2p-share.browser.html` (user-reported PASS: 28 checks). Real preparation/transport workflow,
outgoing controller/view, legacy wrappers and Create controller run. Peer sends,
sessions, Create transport/presentation and card previews are mocked; no external
requests or writes. DOM sources are real in the browser, simulated in Node.
Coverage includes exact captured metadata/title/excerpt limits, one waiting
selection, duplicate/readiness/source/session/row/discussion guards, Create
receipt gating/explicit recovery, preserved form drafts, direct collection/
annotation extensions and protected protocol fields, same-ID channel replacement,
partial/uncertain send feedback without retry, preview-failure separation, and
the strict synchronous collaboration boolean. Local acceptance is not delivery.

`node --test tests/p2p-share.test.cjs tests/p2p-discussion-actions.test.cjs tests/p2p-session.test.cjs`
passed 29/29. Live PeerJS/delivery, full Create/editor integration and real
cryptography are not exercised. The user reported browser PASS: 28 checks,
with Peer channels, sessions, Create transport/presentation and previews mocked;
no external requests or writes.

Full Node suite passed 838/838, zero failures/skips. Syntax, inline scripts,
local script paths/order and LF/diff checks passed.

### Ordinary chat message processing/view

`p2p-messages.test.cjs` shares 8 cases via `helpers/p2p-messages-fixture.js` with
`p2p-messages.browser.html` (user-reported PASS: 21 checks). Real preparation/controller/view,
shared one-pass broadcast and legacy message wrappers run. Sessions/resources,
transport, crypto, decoration, popup relay and the error helper are mocked; no
external requests or writes. Node mocks HTML sanitization; browser uses the real
DOMParser sanitizer with real DOM rendering. Cases cover detached IDs/extensions/
sender data, concurrent dedup before verification, legacy generated IDs, true/
false/unknown verification, captured recipients and stale origin/session/DOM
rejection, literal/escaped labels, browser unsafe HTML/URL removal and preserved
allowed formatting, partial sends, relay failure and compatibility dispatch.
Real crypto/key storage, peer-control packets, WebRTC and full app are unverified.

Run `node --test tests/p2p-messages.test.cjs tests/p2p-session.test.cjs` (18/18).
The existing session fixture now supplies a transcript node and loads the message
modules while retaining its source/connection/signing/verification assertions.
Full Node suite passed 846/846, zero failures/skips; syntax, inline scripts,
local script paths/order and LF/diff checks passed. Cancelled signed sends reject
to preserve popup drafts. The user reported browser PASS: 21 checks, including
real sanitizer validation, with the stated dependencies mocked and no external requests or writes.

### Peer discovery and identity-control packets

`p2p-control.test.cjs` shares 8 cases via `helpers/p2p-control-fixture.js` with
`p2p-control.browser.html` (user-reported PASS: 29 checks). Real normalization/controller/view,
dispatcher and legacy wrappers run. Sessions/channels, connect, identity sources,
Follow persistence, popup relay and error helper are mocked; no external requests
or writes. DOM join controls are real in browser and simulated in Node. Coverage:
deduplicated discovery/self/existing/origin guards, malformed packets, detached
identity keys and literal/escaped joins, claim clearing and duplicate identity
rows, captured Follow arguments/fourth guard, pending/replacement/session expiry,
safe exact service URLs, explicit absence, inbound/outbound handshakes, public-only
identity replies, visible errors/explicit Follow retry and stale store getters.
The real session registry additionally tests an inherited-object-key peer ID.
Live discovery, verified DID/crypto, persistent Follow and WebRTC are unverified.

Run `node --test tests/p2p-control.test.cjs tests/p2p-session.test.cjs` (18/18).
Full Node suite passed 854/854, zero failures/skips; syntax, inline scripts,
local script paths/order and LF/diff checks passed. The user reported browser
PASS: 29 checks, with the stated dependencies mocked and no external requests or writes.
Syntax, inline scripts, local script paths/order and LF/diff checks passed.

### Chat identity loading and signatures — user-reported browser PASS

Open `https://localhost:51888/tests/p2p-identity.browser.html` and report PASS/FAIL.
Marker: `test 2026-11-21.11`. Real identity read/codec workflows, controller/view
and compatibility wrappers run with HTTP, encrypted storage and crypto helpers
mocked; no external requests or writes. Checks cover captured hosted/Local reads,
key-version/source guards, coalesced loads, visible errors/retry, private-data
exclusion, URL-safe signature compatibility, stale signing/peer-key rejection and
unsigned/unknown fallbacks. The user reported browser PASS: 25 checks, with the
stated dependencies mocked and no external requests or writes. Normal-app/live
crypto checks remain unverified.

`node --test tests/p2p-identity.test.cjs tests/p2p-session.test.cjs` passed 19/19
(9 identity and 10 session cases). The ninth identity case uses the actual shared
Ed25519 helpers with mocked WebCrypto to verify byte/codec contracts; it does not
verify real cryptography. Full Node suite passed 863/863, zero failures/skips.
The session fixture now settles identity reads before measuring heartbeat traffic.

Node: `tests/p2p-identity.test.cjs`; shared fixture: `tests/helpers/p2p-identity-fixture.js`.

### Discussion heartbeat — user-reported browser PASS

Node: `tests/p2p-heartbeat.test.cjs`; shared cases:
`tests/helpers/p2p-heartbeat-fixture.js`; browser: `p2p-heartbeat.browser.html`.
Open `https://localhost:51888/tests/p2p-heartbeat.browser.html` (marker
`test 2026-11-21.12`) and report PASS/FAIL. Real transport/controller/view and
legacy wrappers use mocked HTTP, timers, session/peer values and feedback helpers;
no external requests, actual timers or writes. Covers captured URL/auth/payload,
one-minute deferred scheduling, overlap prevention, late replacement/stop/source
guards, changed discussion/service/peer, 401 notice/stop, visible HTTP/network
failures and periodic recovery. State excludes credentials and target details.
Live services and complete app integration are unverified.

`node --test tests/p2p-heartbeat.test.cjs tests/p2p-session.test.cjs tests/p2p-discussion-actions.test.cjs`
passed 28/28 (7 heartbeat, 10 session, 11 Create/Leave). Full Node suite passed
870/870, zero failures/skips. The user reported browser PASS: 25 checks,
with the stated dependencies mocked and no external requests or writes.

### Start document from chat — user-reported browser PASS

`p2p-collaboration.test.cjs` uses six shared cases from
`helpers/p2p-collaboration-fixture.js`; `p2p-collaboration.browser.html` adds two
actual browser DOM assertions. Open
`https://localhost:51888/tests/p2p-collaboration.browser.html` and report PASS/FAIL
(marker `test 2026-11-21.13`). Preparation/controller/view and legacy wrapper are
real; collaboration API, sessions and feedback are mocked. Transcript structures
are mocked in shared cases. No external requests or writes. Covers last-15 row
ordering, card/blank exclusion, preserved HTML, captured API/discussion/contents,
duplicate pending commands, empty context, stale source/view/discussion/disposal,
visible failures/explicit retry and state privacy. The browser separately tests
real row capture and removal. Existing collaboration creation, delayed insertion,
editor mounting and invitations remain unverified.

`node --test tests/p2p-collaboration.test.cjs tests/p2p-popup.test.cjs tests/p2p-session.test.cjs`
passed 25/25 (6 new, 9 popup, 10 session). Full Node passed 876/876, zero
failures/skips. The user reported browser PASS: 22 checks, with
collaboration/session/feedback APIs mocked and no external requests or writes.
Collaboration editor internals were not exercised.

### Chat Etherpad link formatting — user-reported browser PASS

`p2p-decoration.test.cjs` shares four cases through
`helpers/p2p-decoration-fixture.js` with `p2p-decoration.browser.html`.
Open `https://localhost:51888/tests/p2p-decoration.browser.html` and report
PASS/FAIL (marker `test 2026-11-21.14`). Node covers detached literal metadata,
legacy case-sensitive first quoted/bracketed HTTPS URL/substring rules, unchanged
nonmatching input and wrapper dispatch with rendering stubbed. The browser adds
actual HTML view/message renderer/sanitizer checks: exact query URL, safe link
attributes, literal sender, existing emphasis and escaped/sanitized popup relay.
Session, transport and feedback/relay helpers are mocked; no external requests
or writes and no links opened. Node does not verify actual DOM rendering.

`node --test tests/p2p-decoration.test.cjs tests/p2p-messages.test.cjs tests/p2p-session.test.cjs`
passed 22/22 (4 new, 8 messages, 10 session). Full Node passed 880/880,
zero failures/skips. The user reported browser PASS: 18 checks, with the stated
dependencies mocked, no external requests or writes, and links not opened.
Live Etherpad is not exercised.

### Summarize — user-reported browser PASS

`summarize.test.cjs` shares seven cases via `helpers/summarize-fixture.js` with
`summarize.browser.html`. Open `https://localhost:51888/tests/summarize.browser.html`
and report PASS/FAIL (marker `test 2026-11-21.15`). Real request/controller and
compatibility APIs use mocked view/account/HTTP/reader/editor dependencies.
Cases cover preserved model/prompts/token calculation, captured endpoint/key,
empty/malformed/HTTP/network responses, duplicate and superseded requests, source/
view/disposal/account guards, stale Load controls, explicit retry and state privacy.
The browser adds actual DOM capture/rendering, nested-output exclusion, literal
generated text, output-specific Load IDs and detached button rejection. The
existing shared-row test now uses the real extracted summary view, replacing its
obsolete function-source slice. No external requests or writes; live AI and editor
mounting are not exercised.

`node --test tests/summarize.test.cjs tests/reader-row-context.test.cjs` passed
10/10 (7 new, 3 shared-row). Full Node passed 887/887, zero failures/skips.
The user reported browser PASS: 32 checks, with HTTP/accounts/reader/editor
effects mocked and no external requests or writes. Live AI and editor mounting
were not exercised.

### Translate — user-reported browser PASS

`translate.test.cjs` shares eight cases through `helpers/translate-fixture.js`
with `translate.browser.html`. Open
`https://localhost:51888/tests/translate.browser.html` and report PASS/FAIL
(marker `test 2026-11-21.16`). Real workflow/controller/view and wrappers use
mocked HTTP, preference storage, accounts, reader/session values and deadlines.
Browser form/toggle DOM runs directly; Node uses the existing small DOM helper.
No external requests, real storage writes or real timers. Cases cover captured
encoded keys and detect/HTML payloads, independent rows, read-without-write
restoration, failed preference saves, disabled/missing-key/en/und fallbacks,
source/key/toggle/deadline guards, expired follow-up detection, HTTP/malformed/
network errors, explicit later recovery, form duplicates and newer-input/account/
preference isolation, literal output and public-state privacy.

`node --test tests/translate.test.cjs tests/action-menu.test.cjs tests/mastodon-reader.test.cjs tests/bluesky-reader.test.cjs`
passed 32/32 across Translate, menus, Mastodon and Bluesky. Full Node passed
895/895, zero failures/skips. The user reported browser PASS: 31 checks, with
HTTP/storage/accounts/reader/deadlines mocked and no external requests or real
writes. Live translation and full reader rendering were not exercised.
Adjacent reader tests mock translation.

### ChatGPT template requests — user-reported browser PASS

`chatgpt-requests.test.cjs` shares seven cases from
`helpers/chatgpt-requests-fixture.js` with `chatgpt-requests.browser.html`.
Open `https://localhost:51888/tests/chatgpt-requests.browser.html` and report
PASS/FAIL (marker `test 2026-11-21.17`). Transport/continuation workflow, captured
request controller and wrapper are real. HTTP, account loading/selection and
sessions are mocked; no external requests or writes. Cases cover the preserved
model/prompt/limits, original endpoint/key, exact chunk history and concatenation,
fail-closed loading, session/key/JSON expiry, HTTP/malformed/unexpected-reason/
nonprogressing responses, explicit later recovery, independent histories,
existing schema/loader/fence helper and credential-free pending state. No form,
editor transfer/mounting or live AI coverage is implied.

`node --test tests/chatgpt-requests.test.cjs tests/summarize.test.cjs` passed
14/14 (7 new, 7 summary). Full Node passed 902/902, zero failures/skips.
The user reported browser PASS: 34 checks, with HTTP/accounts/sessions mocked
and no external requests or writes. Generation form, editor loading and live AI
were not exercised; generation form is the next separate slice.

### Template generation form — user-reported browser PASS

`template-form.test.cjs` shares seven cases through
`helpers/template-form-fixture.js` with `template-form.browser.html`. Open
`https://localhost:51888/tests/template-form.browser.html` and report PASS/FAIL
(marker `test 2026-11-21.18`). Real form/controller/view, request workflow and
loader wrapper use mocked HTTP/account/session/editor/navigation dependencies.
Node uses the existing small DOM helper; browser controls/progress are real.
Shared cases explicitly deliver removal notifications; the browser adds actual
MutationObserver cleanup. Cases cover trimmed custom override/format/fence and
MIME record, duplicates, edited choices and expired continuations, Back/null
settlement, explicit retry/draft retention, source/editor/panel expiry, saved
callbacks, shared-loader noninterference and state privacy. No external requests
or writes; live AI and downstream editor transfer/mounting are not exercised.

`node --test tests/template-form.test.cjs tests/chatgpt-requests.test.cjs`
passed 14/14 (7 new, 7 request cases). Full Node passed 909/909, zero
failures/skips. The user reported browser PASS: 21 checks, with
HTTP/accounts/sessions/editor/navigation effects mocked and no external requests
or writes. Live AI and editor mounting were not exercised.

### Collab document browsing — user-reported browser PASS

`collab-documents.test.cjs` shares seven cases through
`helpers/collab-documents-fixture.js` with `collab-documents.browser.html`.
Open `https://localhost:51888/tests/collab-documents.browser.html` and report
PASS/FAIL (marker `test 2026-11-21.19`). Real list requests/controller/view and
browser bridge use mocked HTTP/accounts/sessions/shared account/URL helpers and
opening hook. Browser DOM rows run directly; Node uses the small existing DOM
helper. No external requests or writes. Covers endpoint/header/server capture,
lazy/default accounts, fail-closed account errors, empty/HTTP/malformed/login
feedback and explicit Retry, literal titles/local-name fallback, superseded and
expired requests, duplicate pending opens, saved rows, captured open arguments,
visible open failures/explicit retry and private state. Actual editor initialization,
connection and WebSocket lifecycle are outside this fixture.

`node --test tests/collab-documents.test.cjs tests/editor-controls.test.cjs tests/editor-references.test.cjs`
passed 25/25. Full Node passed 916/916, zero failures/skips. The user reported
browser PASS: 22 checks, with HTTP/accounts/sessions/shared helpers/opening hook
mocked and no external requests or writes. Editor initialization, connection and
live WebSocket lifecycle were not exercised.

### Collab connection preparation — user-reported browser PASS

`collab-preparation.test.cjs` shares seven cases through
`helpers/collab-preparation-fixture.js` with `collab-preparation.browser.html`.
Open `https://localhost:51888/tests/collab-preparation.browser.html` and report
PASS/FAIL (marker `test 2026-11-21.20`). Real preparation uses mocked server lookup,
dependency loading, source/editor identity and state delivery; no external
requests or writes. Cases cover captured credentials/configuration, local and
explicit-server routing, anonymous defaults, failures/recovery, stale lookup/
load targets, local/remote supersession, commit guards and pending-count draining.
The browser fixture does not exercise the full adapter or actual resource classes.

An eighth Node case loads the real `collab.js` initializer closures with narrow
dependency/toolbar substitutions and fake Editor/Y.Doc/provider/timer APIs. It
verifies stale dependencies cannot destroy existing resources, read-mode/server/
token/store/element constructor values, and local-start supersession of remote
preparation. It does not verify real TipTap, authentication, provider events,
reference/awareness callbacks, teardown correctness or WebSockets.

`node --test tests/collab-preparation.test.cjs tests/collab-documents.test.cjs tests/editor-references.test.cjs`
passed 21/21. Full Node passed 924/924, zero failures/skips. The user reported
browser PASS: 20 checks, with server/dependency/session/editor-target APIs mocked
and no external requests or writes. Full adapter, provider callbacks, teardown
and live WebSockets were not exercised by the browser fixture.
