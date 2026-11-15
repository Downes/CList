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
