# Testing instructions for AI coding tools

Read this before planning validation, adding/changing tests, or reporting that a
CList change works. Also read the affected implementation, the repository's
[AGENTS.md](../../AGENTS.md), the [human testing guide](../testing.md), and the
[detailed feature catalogue](../../tests/README.md). For publishing changes, read
[publishing.md](publishing.md); for data changes, consult
[data-contracts.md](../data-contracts.md) and `js/clist-types.js`.

## Discover the actual scope

Inspect the working tree and preserve unrelated edits. Inventory relevant
`tests/*.test.cjs`, `tests/*.browser.html`, helper fixtures and any tests outside
that directory before claiming complete coverage. Read the assertions and mocks;
do not infer coverage from a filename or a passing count alone.

The standard Node command is:

```powershell
node --test tests/*.test.cjs
```

It covers top-level `.test.cjs` files, not browser pages, manual flows, deployed
APIs or other service repositories. The recorded publishing-refactor baseline on
2026-11-14 was 222 passing Node tests, plus 12 separate browser fixture pages.
Re-discover counts when reporting: 222 is not a target to preserve or a permanent
claim about current results. Some files contain many checks or nested subtests.

The current `.github/workflows/build.yml` builds/releases; it does not execute
the Node suite. Do not use a green build, push or release as proof tests passed.

## Choose checks that establish behaviour

| Changed responsibility | Evidence to seek |
|---|---|
| Data/workflow | Explicit inputs, validation, outputs and rejected operations; no DOM/global-state dependency where separation requires it |
| Controller/state | Captured editor/account/session inputs, duplicates, cancellation, cleanup and completion against the original source |
| Service publisher | Selected-account payload/authentication, API/network failures, optional links and callbacks; no adapter-owned publication UI |
| View/panel | Correct controls, accessible state, rendering and action callbacks; selection must not be inferred from DOM attributes |
| Editor/content export | Real editor API use, HTML/native/viewable format differences, snapshots and newer-draft preservation |
| Collection/metadata | Identity, raw membership versus flattened export, correct destination overwrite, session switches and metadata-only failure |
| Slides/recovery | Affected Node tests plus relevant real-browser editor/worker/download fixtures; rebuild embedded source when necessary |

Prefer behavioural regression tests that fail for the reported defect and pass
for the fix. Do not add counts for their own sake, tests that merely repeat an
implementation, or production compatibility code solely to satisfy an obsolete
source-slicing fixture. Existing fixtures sometimes extract function source or
use small simulated DOM elements; update them deliberately after extraction,
while retaining the same behavioural assertions.

Reuse `node:test`, `node:assert/strict`, `node:vm` and existing helpers, including
`tests/helpers/account-fixture.cjs` and
`tests/helpers/collection-publishing-fixture.cjs` and
`tests/helpers/reader-fixture.cjs` where appropriate. Keep the
plain browser JavaScript architecture. Do not add a framework, bundler, browser
runner or end-user Node requirement simply to test a small change.

## Isolate external effects

Mock service/storage responses for automated regressions. Use synthetic accounts,
credentials and bodies. Fail unexpected network requests instead of letting mocks
fall through to live APIs. Do not send posts/messages, modify subscriptions or
perform real OAuth as an incidental verification step. A live action needs user
authorization for that action; a request to test a refactor does not by itself
require live publication.

Exercise both confirmed failure and uncertainty where relevant. Separate an
accepted remote write from a missing URL or later metadata/catalog failure.
Never automatically repeat the external write to recover metadata. Include
isolation cases: concurrent accounts, session changes, edits after capture,
removed members, switched editors/pages, duplicate clicks and rebuilt panels.
The request snapshot and safe operation results must not expose credentials.

## Prepare the environment without hiding failures

Run from the repository root. Check Node availability and dependencies rather
than guessing at failures. Slides find/replace and worker tests import Yjs from
`slides/clist-slides-poc/node_modules`; worker/browser tests also use
`slides/clist-slides-poc/dist-embed`. When missing, the documented preparation is:

```powershell
npm --prefix slides/clist-slides-poc ci
npm --prefix slides/clist-slides-poc run build:embed
```

Inspect the manifest/lockfile and working tree before installing/building. Use
the embedded project under `slides/`, not the root-level prototype. A source
change that relies on the embedded build must be checked against a current
bundle. Review generated changes separately; do not include them accidentally.
If dependencies, permissions or tooling prevent a check, report it as blocked,
not passed. Do not silently remove tests, weaken assertions or change expected
behaviour merely to obtain a green run.

For an implementation change, run the relevant targeted tests first. After they
pass, run the full Node suite for shared behaviour/refactoring, as required by
the publishing instructions. After a failure or further functional edit, rerun
affected checks. Avoid repeating an unchanged passing suite without a reason.
For documentation-only edits, check facts, paths and links; a new application
regression run is normally unnecessary unless code/test execution changed.

## Browser and manual validation

Serve browser fixtures through the local CList launcher; use the URL it actually
serves (normally `https://localhost:55888`, with HTTP fallback). Do not assume
`file://` is equivalent. The human guide inventories each fixture. Check imported
assets and deferred/module loading order, including new scripts, before reporting
integration success. Preserve `interface.js` ordering.

If a browser capability is available, use it for affected fixtures and record
what the page actually reports. If unavailable, give the human the specific
fixture URL and expected result, and state that it is unrun. Wait for an explicit
final PASS/FAIL: a blank page, timeout, missing module or partial progress is not
a pass. Keep the console error when a fixture fails. Do not infer that all
browsers pass from one tested browser, or that fixture success proves live OAuth.

Use normal-application checks for the affected editor/UI path. Keep them separate
from fixture checks and live-service authorization. Do not invent results from
automated mocks or older user reports. Investigate a browser regression before
calling the implementation stage validated; show proposed refactoring changes
before applying them, following the user's existing review preference.

## Report and maintain

State the command/scope, observed pass/fail/skip totals, browser fixtures actually
run, manual/live actions actually performed, and checks not run with reasons.
Distinguish a pre-existing baseline result from a fresh run. Describe an environment
failure accurately and retain useful error evidence without secrets. Never say
"all tests pass" when only a subset ran; name the suite. Passing assertions are
not a whole-application coverage measurement.

Update the human guide and these instructions when testing policy/commands change.
Update `tests/README.md` when feature coverage, fixture prerequisites or acceptance
checks change. Update JSDoc/data contracts with changed producers and consumers.
Keep feature-specific details in that catalogue rather than silently replacing
it with a shorter generic guide. Link new browser fixtures and test modules so
both humans and future agents can find them. Do not commit or push without the
user's instruction.

For bundled LocalRSS backend changes also run
`python -m unittest discover -s tests -p 'localrss_backend_test.py' -v`.
This isolated Python/SQLite suite extracts actual backend functions and mocks
network calls; report it separately from Node and deployed HTTP/auth checks.
Preserve the separation between harvest serialization and short database writes.
Never hold the database write lock or a write transaction across network awaits.

For bundle/build changes run all `localrss_*test.py` tests and the dependency
preflight through the source launcher and a finished executable where available.
Do not call a mocked import check proof of a working packaged backend. The
preflight does not start LocalRSS or exercise authentication. Source Python runs
need requirements installed; packaged users must not need pip.
