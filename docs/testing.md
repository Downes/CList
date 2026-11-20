# Testing CList

CList uses automated regression tests, browser test pages, and manual checks in
its normal interface. Each answers a different question. A passing automated
suite does not establish that every editor, browser, or live account works.

This guide is for people running tests or checking a change. AI coding tools
should also read the [testing instructions on GitHub](https://github.com/Downes/CList/blob/main/docs/ai/testing.md).
The [detailed test catalogue on GitHub](https://github.com/Downes/CList/blob/main/tests/README.md)
retains feature-specific commands and named acceptance checks.

## What we test

| Kind of check | What it exercises | What it does not establish |
|---|---|---|
| Node regression tests (`tests/*.test.cjs`) | Data operations, controller decisions, simulated controls, service requests with mocked responses, and some real slides/worker operations | Real browser layout, every editor integration, live authentication or publication |
| Browser fixtures (`tests/*.browser.html`) | Real browser DOM, modules, events, downloads, rendering and workers, with fixture data and mocked publishing | Normal-account setup or successful access to an external service |
| Manual application checks | The actual CList interface, editor interactions, account changes and visible behaviour | Untested features or browsers |
| Deliberate live-service checks | A selected real account and deployed service | Other accounts, service instances or permissions |

The last recorded full Node run during the publishing refactor passed **222 tests**.
That is a dated baseline (2026-11-14), not a fixed expected count or a coverage
percentage. The count changes as tests are added. At that baseline there were twelve browser pages. Browser pages each contain
multiple checks and are separate from the Node count. The current inventory
below also includes the new reader fixture.

## Running the automated tests

Use a source checkout and a terminal with Node.js installed. Ordinary CList users
do not need Node to run the browser application. From the repository root, run:

```powershell
node --test tests/*.test.cjs
```

For Stephen's Windows checkout, the repository root is `E:\clist`. Use your own
checkout location if different. The command runs all top-level `.test.cjs` files
in `tests/`, including accounts, public feeds, collections, publishing and slides.
It does not run the HTML browser fixtures or external service repositories.

The slides find/replace and recovery-worker tests need Yjs installed under
`slides/clist-slides-poc/node_modules`. Worker tests also need the embedded build.
If these are missing in a fresh checkout, prepare the slides tooling from the
repository root:

```powershell
npm --prefix slides/clist-slides-poc ci
npm --prefix slides/clist-slides-poc run build:embed
```

This is developer/test preparation, not an additional end-user requirement.
It uses the embedded slides project under `slides/`, not the separate root-level
`clist-slides-poc` prototype. Rebuild when testing changes to embedded slides
source; a stale bundle can otherwise test older code. Build output may change:
review it before including generated files in a commit.

A successful Node run exits successfully and reports zero failures. Record the
reported test/pass/fail/skip totals. An import error, missing dependency, unfinished
process or skipped case must not be described as a pass. Keep error output when
reporting a failure; the final totals alone may omit its cause.

For a focused check, supply a specific file, for example:

```powershell
node --test tests/discord-publishing.test.cjs
```

A focused pass is useful while working, but is not a full-suite result.

## Running browser test pages

Start CList locally with its normal launcher. For this Windows checkout:

```powershell
python E:\clist\launcher.py --port 55888
```

Use the address the launcher actually serves. It normally uses
`https://localhost:55888`; it can fall back to HTTP if local TLS is unavailable.
If CList is already running, use that instance. Open test pages through this
server rather than double-clicking HTML files: modules and workers depend on
normal browser URL/origin rules.

Start with [publishing selection](https://localhost:55888/tests/publish-selection.browser.html).
Replace the scheme/port if your launcher uses a different address. Wait for the
page's final **PASS** or **FAIL** result. Most fixtures run on load; read any
instructions displayed on the page. A blank page or a page still saying it is
checking is not a pass. Use the browser developer console to capture the error
if the final result does not appear.

All current fixture paths are relative to the local server's root:

| Browser page under `/tests/` | Main checks |
|---|---|
| `localrss-reader.browser.html` | Real LocalRSS modules with mocked service requests: account/filter isolation, pagination, stale audio/results and Feeds/Refresh |
| `editor-references.browser.html` | Document reference collection and panel DOM without last-source editor blocks; mocked TinyMCE API |
| `reader-boundary.browser.html` | Read/account/menu UI, request ownership, stale completion and guarded feed rendering with mocked services |
| `publish-selection.browser.html` | Selection, rebuilds, busy state, permissions and publishing failures |
| `publication-request.browser.html` | Awaited editor API, captured inputs, destination ordering and link handoff |
| `publication-success.browser.html` | Success links, literal text, progress and error rendering |
| `slides-article-wordpress.browser.html` | Slide article conversion, mocked WordPress uploads/posts, progress and errors |
| `slides-article-layout.browser.html` | Article geometry, labels, transcript and image dimensions |
| `slides-find-replace.browser.html` | Search, selection, replacements, formatting, shortcuts and undo/redo |
| `slides-html-export.browser.html` | Standalone HTML export, embedded media and browser navigation |
| `slides-multiple-selection.browser.html` | Multi-selection, batch slide operations, drag and undo/redo |
| `slides-powerpoint.browser.html` | PowerPoint export, downloads and document preservation |
| `slides-powerpoint-import.browser.html` | PowerPoint import, editable content, warnings and failed-import preservation |
| `slides-recovery-worker.browser.html` | Large recovery snapshots, UI responsiveness, incremental updates and worker shutdown |
| `slides-thumbnails.browser.html` | Large slide lists, targeted redraws, stable controls and focus/scroll preservation |

Slides fixtures load the vendored collaboration bundle and embedded editor/assets
from the checkout. A missing-module/404 error requires checking those files and
build output before treating it as an application regression. Some fixtures
create browser downloads; these are test files. Publishing fixtures use mocked
publishers/requests and do not need real account credentials.

Record the browser name/version, fixture URL and complete final result. Test in
the browser you intend to use; a result in one browser does not cover another.

## Checking the normal interface

Fixtures complement a check in the running application. Use disposable drafts
and a separate test profile or test accounts when account/storage changes matter.
Choose the checks affected by the change rather than repeating unrelated actions.

For publishing changes, first check without sending anything: open Post, select
accounts, reopen it, and confirm selections, disabled controls and Cancel behave
as expected. Check that the chosen editor's content and formatting remain intact.

A deliberate live test is a separate activity: choose a test destination, check
its permissions, then intentionally publish or update test content. Verify both
the visible result and the destination itself. This can create real posts,
annotations, pages or subscription changes; opening the normal app is not a
mocked test. Do not repeat an uncertain write merely because its link or local
metadata is missing. Inspect the destination first.

When testing asynchronous work, check newer drafts and navigation: begin an
intentional test operation, change the draft or open another item while it is
pending, and confirm completion does not replace the newer work. For account
changes, check that logout/server switches do not redirect a pending write.
For collections, distinguish saved subscription membership from public
publication; they are different operations. See [collection publishing](collection-publishing.md)
and [publishing](publish_structure.md) for expected behaviour.

## Reporting a result

Report each kind of evidence separately. A useful report includes:

- The commit or working-tree version, feature and command/URL tested.
- Node test totals and any failures/skips, if run.
- Browser name/version and each fixture's final result, if run.
- Manual actions and expected versus actual behaviour.
- Whether external services were mocked or a specific live test was performed.
- Checks not run, with the reason, and any remaining issue.

Do not include tokens, passwords, private account records or sensitive post bodies
in shared logs/screenshots. Redact them while retaining useful failure details.

The current GitHub workflow builds/releases the application on pushes to `main`;
it does not run `node --test`. A successful push or release therefore is not a
regression-test result. Related services such as LocalRSS and KVStore have their
own repositories and deployments; this checkout's tests do not certify them.

## Checking LocalRSS read and bookmark buttons

In a LocalRSS Unread list, load another page and mark an item on the first page
read: its row should stay visible and offer Mark unread. Click Unread or Refresh
to reload and hide read entries. In Bookmarked, remove a bookmark: that row should
disappear. While a button is awaiting its response it is disabled. Switching
accounts during a pending action must leave the new account's rows unchanged.
These manual checks perform real changes to the selected LocalRSS database.
The mocked `localrss-reader.browser.html` fixture checks the pagination/button
integration without modifying a live service.

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

Verification on 2026-11-15: six isolated Python tests passed in CList and three
concurrency tests passed against the localrss_reader source checkout. A Windows
one-file test executable built with the bundle's collection options passed
`--check-localrss` (exit 0). This checked packaged dependencies/assets without
starting services; full release builds and macOS/Linux executables were not run.

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

Temporary editor test marker: the shared editor status shows `test 2026-11-19.1`
from the running editor script. The relevant file-loading/editor script URLs use
the same version to request fresh copies. If the marker is missing or different,
the current test build has not loaded. Bump the marker and script versions together
for the next browser-testing revision; remove this temporary marker when testing ends.

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


### Migration preparation and preview — user-reported browser PASS

Open `https://localhost:51888/tests/migration-preparation.browser.html` and report
its final PASS/FAIL (including stack on failure). The fixture uses real preparation
workflow/controller/view and shared identity coordination; shell and execution
handoff are fixtures. Source storage, destination registration/login/listing and
crypto are mocked; no external requests or real writes. It checks captured inputs,
conflicts, state-owned overwrite approval, one-use revalidated handoff, cancellation,
stale inputs/session, registration receipts/explicit retry and fail-closed reads.
Execution/recovery and live migration are outside this evidence. Also rerun
`https://localhost:51888/tests/did-identity.browser.html` (expected existing 85
checks) to check the existing panel integration. Editor marker: `test 2026-11-20.14`.
The user reported PASS for migration preparation (25 checks) and the existing
DID fixture (85 checks). They also reported that the migration page is not
displaying as HTML, clarified as plain text. The fixture now uses a normal
scrolling layout and a status paragraph instead of a preformatted block; visual
confirmation of that presentation-only adjustment was reported successful by the user.
Functional fixture results and that presentation issue are recorded separately.

Automated evidence for this slice: 15/15 focused Node tests, then 685/685 full
Node tests (0 failures/skips). Script syntax, fixture script paths and diff whitespace
were checked separately. Browser fixture results above are user-reported; normal-app
and live migration checks were not performed.

### Migration execution and recovery — user-reported browser PASS

Open `https://localhost:51888/tests/migration-execution.browser.html` and report
its final PASS/FAIL. The fixture uses real execution workflow/controller/view,
identity linking and the shared one-shot publication transport. The hosted success
case uses the real preparation controller/view too; the shell and other preparation
handoffs are fixtures. HTTP including copy/link writes, source/destination storage
and cryptography are mocked; no external requests or real writes.

It checks hosted/Local completion, approved existing-record updates, metadata
retention, partial/uncertain copy/link recovery, read-only checks, explicit retries,
new destination/source protection, duplicate/expired callbacks, changed sessions,
and late accepted writes across panel rebuilds. Tab/source-session recovery does
not establish reload/new-login recovery or live service behavior. Marker:
`test 2026-11-20.15`. The user reported PASS: 35 checks. HTTP, storage and
crypto were mocked; no external requests or real writes were performed.
Automated results: 26/26 focused Node tests; 696/696 full Node tests, zero
failures/skips. Browser results for the earlier preparation (25) and DID (85)
fixtures remain distinct, user-reported prior evidence.


### Login/register panel and account-server selection — user-reported browser PASS

Open `https://localhost:51888/tests/auth-panel.browser.html` and report the final
PASS/FAIL. It runs real state/controller/view with the application modal shell.
Preference writes, reader invalidation and submission outcomes are mocked. It
checks form validation, private input capture, state-owned mode/server choice,
Local labels, persistence/refresh failure separation, duplicate/pending/rebuilt
and expired-picker guards, secret clearing and accepted-login feedback. It does
not verify credential transport, session installation or post-login seeding. No
external requests or real storage writes. Marker: `test 2026-11-20.16`.

Node evidence: `node --test tests/auth-panel.test.cjs` passed 9/9, including two
real `submitAuthModal` bridge cases with credential/setup dependencies mocked.
The full `node --test tests/*.test.cjs` suite passed 705/705, zero failures/skips.
The user reported browser PASS: 21 checks, with storage/reader effects and
submission outcomes mocked; no external requests or real writes. Credential
transport/session installation and normal-app/live-service checks remain outside
this fixture evidence.

### Credential verification/registration and session installation — user-reported browser PASS

Open `https://localhost:51888/tests/auth-credentials.browser.html` and report final
PASS/FAIL. It runs real credential/session workflows, compatibility helpers and the
real form controller/view with the application modal shell. HTTP, Local auth,
crypto, cookies and sessionStorage are mocked; no external requests or real writes.
It checks hosted/Local routing, captured server/source session, matching response
validation, accepted/uncertain registration and explicit retry, token-last session
saving, key/partial/silent-cookie failure rollback, incomplete rollback feedback,
stale panels, secret-free presentation and concurrent direct helper calls.
Post-login seeding/setup and real cryptography are not exercised. Marker:
`test 2026-11-20.17`. The user reported browser PASS: 27 checks, with the
stated effects mocked and no external requests or real writes. Normal-app/live
services, post-login setup and real cryptography remain outside this evidence.

`node --test tests/auth-credentials.test.cjs tests/auth-panel.test.cjs` passed 18/18;
`node --test tests/*.test.cjs` passed 714/714, zero failures/skips. The prior form-only
browser result remains user-reported 21 checks, separate from this new fixture.

### Post-login account setup and seeding — user-reported browser PASS

Open `https://localhost:51888/tests/post-login.browser.html` and report final
PASS/FAIL. It uses real setup workflow/controller/view, service descriptors and
public-feed discovery. Accepted login/session, HTTP, KV storage, encryption,
account loading, reader navigation and modal shell are mocked; no external
requests or real writes. It checks registration-only public seeding, Local
exclusions, existing data retention, per-step accepted/uncertain receipts,
read-only refresh/check, explicit remaining/service retry, partial discovery,
refresh failure, stale ownership and newer reader navigation. Live services,
actual browser storage and real cryptography are outside this evidence.
Editor marker: `test 2026-11-20.18`. The user reported browser PASS: 22 checks,
with the stated dependencies mocked and no external requests or real writes.

Focused Node command: `node --test tests/post-login.test.cjs tests/auth-panel.test.cjs tests/public-feed-accounts.test.cjs`
passed 22/22. The full Node suite passed 723/723, zero failures/skips. Prior
credential/session browser PASS (27 checks) is separate user-reported evidence.

### Logout and session restoration — user-reported browser PASS

Open `https://localhost:51888/tests/session-lifecycle.browser.html` and report
final PASS/FAIL. Real lifecycle workflow/controller/view run with cookies, tab
storage, key import, account loading, identity widgets, modal shell, timers and
reload mocked. No external requests, real writes or actual reload. Coverage:
hosted/Local validity, missing keys and malformed/expired expiry, import versus
account-read failures, stale reads/delays, newer-reader retention, token-first
scoped logout, draft cleanup, unrelated data retention, partial failures, duplicate
logout guards, one-time notice and reload retry. Cross-tab delivery, live services,
real cryptography and a normal application's full reload are outside this fixture.
Marker: `test 2026-11-20.19`. The user reported browser PASS: 24 checks,
with the stated dependencies mocked and no external requests, real writes or reload.

Focused auth/lifecycle tests passed 28/28; the separate existing account-state
fixture passed 7/7 after updating its source-extraction boundary for the moved
storage listener. The full Node suite passed 733/733, zero failures/skips.

### Administrative settings — user-reported browser PASS

Open `https://localhost:51888/tests/admin-settings.browser.html` and report final
PASS/FAIL. Real app metadata, settings workflow/controller/view and picker logic
run with HTTP/session/Local mode and modal/navigation shells mocked. No external
requests or real administrative writes. It checks desktop/mobile picker expiry,
current KVStore selection, header isolation, safe labels/Help and hidden secrets,
changed-only payloads, blank-secret omission, boolean rejection, newer drafts,
accepted/uncertain receipts, read-only checks and explicit reviewed saves, pending
panel rebuilds, stale callbacks and malformed/Local rejection. Backend authorization,
live service schemas and full application navigation are not exercised.
Marker: `test 2026-11-20.20`. The user reported browser PASS: 25 checks,
with the stated effects mocked and no external requests or real settings writes.

Focused Node checks passed 10/10 (`node --test tests/admin-settings.test.cjs`).
The full Node suite passed 743/743, zero failures/skips. These results are separate
from prior user-reported lifecycle browser PASS (24 checks).
