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
