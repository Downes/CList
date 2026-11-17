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

Temporary editor test marker: the shared editor status shows `test 2026-11-17.3`
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
