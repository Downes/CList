# Testing instructions for AI coding tools

Current user-directed testing cadence (2026-11-23): run only the immediately
relevant Node checks for each small refactor, and defer the full sweep until later.
This overrides the per-stage full-suite directions below. Report the exact tested
scope; do not describe focused checks as full validation.

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
| Local files / My Pages | Cancelled/failed writes never indexed, browser handoff distinct from native writes, stale filename/row/load callbacks, original destination checks and metadata-only delete retry; mock all filesystem and service writes |
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

The user performs browser tests. Give them the affected fixture URLs and expected
results, and ask them to run the checks. Leave browser checks pending until they
report their results; use browser tools only when explicitly delegated. Record
what the user or delegated browser actually reports. Wait for an explicit
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


Dropbox file-operation regressions are in `tests/dropbox-save.test.cjs`,
`dropbox-save-view.test.cjs`, `dropbox-picker.test.cjs`, plus the generic Save panel
and collection-export bridge checks in `public-feed-editor.test.cjs`. Run the
matching browser pages with all HTTP and credential persistence mocked. Preserve
ordered continuation updates/deletes, captured refresh writes and definite-401
versus uncertain-upload behavior. Do not use live OAuth or upload files as an
incidental refactor check.


Collection browsing/import/membership/opening checks use the `collection-browser`,
`collection-import`, `collection-members`, `collection-opening` and
`collection-entry` Node fixtures plus `public-feed-editor.test.cjs`. Their four
browser pages are prepared for the user; do not run them without delegation.
Retain latest-record/legacy duplicate ordinal assertions, no optimistic source
mutation after write failure, delayed encryption with same-container row replacement,
cycle guards, explicit import choices, native member routing and unsaved draft
restoration. A prepared browser page is pending evidence, not a pass.

Service-reader checks and six browser handoff pages are catalogued in
`tests/README.md` under "Service readers and row actions". Preserve the distinction
between shared-context real-renderer coverage and service fixtures that mock shared
chrome. Run targeted Node checks, then one full suite after the final functional
change. Browser checks remain the user's responsibility unless delegated. Scope
follow-up work to one small slice; do not expand the migration during final checks.


Slides saved-layout application-boundary checks are in `slides-layout.test.cjs`
and `slides-layout.browser.html`, using real PageStore and shared dialog APIs
with IndexedDB/editor/modal effects mocked. Pair the focused layout cases with
`slides-recovery-startup.test.cjs` and `page-store-save.test.cjs`, then run the full
Node suite after functional changes. The user runs the new browser fixture.
Host-module-only changes do not require rebuilding the unchanged embedded bundle;
embedded source changes still require its documented build and relevant checks.


Slides IO application-boundary checks use `slides-io.test.cjs` and
`slides-io.browser.html`, paired with saved-layout and recovery-startup checks.
Picker/editor/storage/download effects are mocked. Distinguish these from actual
embedded import/export/worker tests and native file-picker/download validation;
returning an embedded export promise is not proof of download durability. Keep
source guards before dispatch, and do not claim they cancel started vendor work.


Initial Dropbox setup uses `dropbox-setup.test.cjs` / `dropbox-setup.browser.html`,
paired with account-flow and account-panel tests. Mock registration, PKCE, storage
and navigation and disable callback dispatch in browser fixtures so tests cannot
redirect the real browser or consume real callback credentials. Preserve shared
OAuth runtime/parameter/state contracts and own-key cleanup. Do not infer callback
persistence or live authorization from guarded-start results.


OAuth callback account-save checks use `oauth-account.test.cjs` and
`oauth-account.browser.html` with the real shared account helper/loader. Pair them
with account-state and account-panel checks, then the full Node suite. Mock KV,
crypto, session and navigation; test accepted-write refresh failure separately from
unknown write outcomes and prohibit automatic replays. This fixture covers
save-time session capture, not callback pickup/exchange or original-flow binding.


Standard OAuth pickup uses `oauth-callback.test.cjs` and
`oauth-callback.browser.html`, paired with Dropbox setup and callback-save checks.
Mock callback/result/session storage and token exchange; do not invoke real page
listeners against actual credentials. Cover deferred registration, malformed and
old unbound state, denial/expiry, one-shot exchanges, original-session mismatch,
newer-result preservation and guard propagation into shared account encryption.
WordPress application-password binding has its own fixture; do not infer its
coverage or live OAuth correctness from these standard-provider fixtures. User browser validation remains separate.


WordPress authorization checks use `wordpress-auth.test.cjs` and
`wordpress-auth.browser.html`, paired with account-flows, callback and callback-save
tests. Mock navigation/random/session/crypto/storage; never dispatch real WordPress
authorization or consume real callback credentials. Test success/denial URLs, exact
canonical site/path, original-session save guards, changed form/Back, single-use
receipts and local relay bytes. Node additionally executes callback.html's real
inline router with mocked effects. The browser fixture exercises helpers/form and
handler, not full callback-page navigation, deployed relay or live authorization.


Mastodon setup uses `mastodon-setup.test.cjs` / `mastodon-setup.browser.html`, paired
with account-flows, callback-save, account-state and account-panel checks. The fixture
uses actual form DOM/controller, OAuth helper and shared save/loader operations;
OAuth login, storage/encryption and panel effects are mocked. Verify duplicate and
remounted locks, pre-write session/draft expiry, accepted-vs-refresh failures,
uncertain-write read-only checks, explicit retry and newer reader/draft protection.
The user runs the browser fixture; live OAuth/persistence and full app integration
are separate. Follow the focused testing cadence above.


Blogger setup uses `blogger-setup.test.cjs` / `blogger-setup.browser.html`. Pair with
Mastodon setup (shared account-setup controller/feedback), account-flows,
callback-save and Blogger publishing checks. Mock storage/encryption/session and
all panel effects; fail unexpected HTTP or Google authorization during setup.
Check unchanged account fields, safe help/origin, expiry/duplicate/remount guards
and read-only accepted/uncertain recovery. Do not infer publication-time live Google
authorization or full application integration from these setup fixtures.


WordPress setup uses `wordpress-setup.test.cjs` / `wordpress-setup.browser.html`,
paired with WordPress authorization and account-flows. Mock every redirect,
session/fingerprint/random/storage effect. Cover root/raw-input/session expiry,
remount/duplicate locks, inline error ownership and explicit retry. Keep the
existing auth fixture's callback/relay/account-save checks separate; setup fixture
success does not establish live authorization or full account-panel integration.


Collab setup uses `collab-setup.test.cjs` / `collab-setup.browser.html`, paired with
account-flows, callback-save and post-login checks. Mock registration HTTP and all
storage/session/crypto/panel effects. Distinguish accepted registration from its
JSON response, account encryption/write and list refresh; test that those failures
never repeat registration automatically. Uncertain service outcomes need an explicit
service retry after external review. No live registration, WebSocket/editor startup
or real cryptography is established by this fixture.


Annotate setup uses `annotate-setup.test.cjs` / `annotate-setup.browser.html`, paired
with Collab setup (shared registration lifecycle), account-flows, callback-save and
post-login checks. Mock all HTTP/KV/session/crypto/panel effects. Test default/custom
selection, literal labels, credential-free health reads, stale probe ordering,
registration's no-body/204 contract, accepted/uncertain receipt recovery and form
expiry. Keep live registration and annotation editor behavior outside these claims.


Discord setup/channel checks use `discord-setup.test.cjs` /
`discord-setup.browser.html`, paired with account-flows and Discord publishing.
Mock relay HTTP, KV, crypto and sessions; never create/delete real channels or
subscriptions incidentally. Cover both add-account and real edit-hook controls,
captured headers/bot token/IDs, literal metadata, add-only storage/exact removal,
pre-delete stored metadata, partial guild errors, duplicate/stale controls, newer
drafts, accepted refresh recovery and successful read-only review before an explicit
uncertain-command retry. No live Discord or full account/reader integration is proved.


Personal Options uses `personal-options.test.cjs` / `personal-options.browser.html`,
paired with password-confirmation. Mock storage, theme editor documents, session,
transfer APIs, picker and history; never trigger real downloads/import writes or
navigation. Check persisted formats, no-write reads, visible persistence/display
failure and display-only retry, replaced controls and file/password handoffs.
The fixture uses the real parser but mocks transfer operations: do not infer
captured-source safety or real encryption/durability inside account-transfer.js.


Account-transfer data checks use `account-transfer.test.cjs` /
`account-transfer.browser.html`, paired with Personal Options and confirmation.
Use synthetic ciphertext/crypto and a captured add-only mock store; forbid put.
Test concurrent existing keys, partial success, unknown accepted/absent/conflicting
writes, read-only review and explicit remaining retries, plus cookie/key/caller
expiry and accepted in-flight writes staying on their original destination.
Mock every download and confirmation. Do not infer real crypto or backend durability
from this fixture. Options' own fixture still mocks data APIs and is separate evidence.


Existing-account reauthorization uses `account-reauthorization.test.cjs` /
`account-reauthorization.browser.html`, paired with account-panel and the Mastodon/
Dropbox setup fixtures. Exercise real form, hooks, helpers and OAuth start bridge;
mock fingerprint/registration/PKCE/state/navigation so no redirect or real account
write can occur. Cover raw edits with/without events, edit-and-revert, replaced
nodes, manual-token mode, checkbox state, closed/hidden/rebuilt forms and session
expiry, plus pending/redirect locks and owned post-persist cleanup. Keep callback
exchange/save and live round-trip behavior separate from this preparation evidence.
