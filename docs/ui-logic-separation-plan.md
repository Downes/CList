# Separating CList application logic and UI

## Implementation and validation checkpoint — 2026-11-23

The user approved this order after the read-only audit. Keep stages small and
reuse the existing data APIs; the earlier checkpoint below records completed work.
The user now requests immediately relevant tests per stage, with a full sweep later.

1. Local saved pages: Save now uses `page-store-save.js`,
   `page-store-save-workflow.js` and `page-store-save-view.js` for captured input,
   revision-preserving writes and safe reconciliation/recovery (23 focused and
   1023/1023 full Node pass; user-reported browser PASS, 29 checks). Real PageStore API with mocked
   IndexedDB/editor/session/feedback effects. Listing/opening now uses
   `page-store-browser*`, with captured list/row reads, literal labels, native
   publication/reference metadata and guarded shared-loader handoff (23 focused
   and 1033/1033 full Node pass; user-reported browser PASS, 34 checks). Real PageStore APIs with mocked
   IndexedDB/shared-loader/editor/session/tool effects. Bundle import/export now
   uses `page-store-bundle*`, capturing file/policy/source, guarding download/import
   dispatch, retaining partial/uncertain results and preventing automatic replay
   (32 focused and 1045/1045 full Node pass; user-reported browser PASS, 31 checks). Real PageStore
   validation/conflicts/remapping with mocked IDB/file/download/editor/session
   effects. Item 1 is complete within the mocked scope; item 2
   (annotation editor) follows. Storage/revision semantics remain unchanged.
2. Annotation editor: draft fields now use `annotate_draft_state.js`,
   `annotate_draft.js` and `annotate_draft_view.js`, retaining live target identity,
   structural metadata/extensions, manual URL registration, pending input and
   guarded commits (81 focused and 1055/1055 full Node pass; user-reported browser
   PASS, 28 checks, plus saved-file recognition regression PASS).
   Real editor/native-file bridges and reference dedup with mocked body/TinyMCE/
   sanitizer/session/reference-panel effects. Description lifecycle now uses
   `annotate_body.js` and `annotate_body_view.js`, with captured unique targets,
   latest pending content, fallback/retry, background preservation and cleanup
   (91 focused and 1065/1065 full Node pass; user-reported browser PASS: 24 body
   checks, 28 field checks and saved-file recognition). TinyMCE/editor/
   session/body-API dependencies mocked, including real queued-content switching
   with delayed/rejected fake startup. Send now uses `annotate_send.js` and
   `annotate_send_view.js`, preserving captured primary-target/account/privacy,
   shared pending locks, session-owned choices and safe accepted-result return
   (76 focused and 1077/1077 full Node pass; saved-file regression PASS,
   user-reported Send browser PASS, 33 checks, fixture `2026-11-22.9`). A browser-event fixture hang
   was reproduced/fixed without application changes; 12 Send Node cases now
   pass through native-style dispatch. Real annotation
   request/workflow/transport with mocked HTTP/accounts/session/body/pickers/
   switching effects. Item 2 is complete within the stated mocked scope. Item 3 (collection draft editor) follows.
3. Collection editor: draft editing, reordering and row callbacks now use
   `collection-draft-state.js`, `collection-draft.js` and `collection-draft-view.js`,
   with the existing editor bridge/live array retained for Save/import/publication.
   Row generations, captured source/session and actual row ownership reject stale
   controls; metadata-only Save/publication updates retain current editing.
   79/79 targeted and 1088/1088 full Node pass; user-reported draft browser PASS,
   34 checks (`2026-11-22.10`). Opening/publishing/import/session dependencies
   are mocked in that fixture. Existing browsing, membership, Save and publishing
   workflows remain separate; dispatch guards do not cancel their internals.
4. Etherpad, then LaTeX: Etherpad connection/list/guest/iframe ownership now uses
   `etherpad_requests.js`, `etherpad_connection.js` and `etherpad_connection_view.js`,
   keeping selected account/auth private, preserving hidden guest resources and
   rejecting superseded reads/controls. 16/16 targeted and 1098/1098 full Node pass;
   user-reported browser PASS, 27 checks (`2026-11-22.11`). Document transport,
   workflow/controller/view now use `etherpad_document*` for captured Create/author,
   account/guest content/export, partial/uncertain creation, accepted-only references
   and literal Share/captured chat handoff. 28/28 targeted and 1110/1110 full Node
   pass. User-reported document PASS (32 checks) and updated connection PASS
   (27 checks), `2026-11-22.12`. HTTP/session/iframe/reference/queued-content/chat/modal/
   text helpers mocked; live Etherpad, remote concurrency and full switching remain
   unverified. LaTeX connection preparation now reuses the shared Collab factory
   through `latex_connection_preparation.js`, capturing session/configuration/editor
   targets before server/module/namespace awaits. 23/23 focused and 1119/1119 full
   Node pass; user-reported preparation browser PASS, 20 checks (`2026-11-22.13`). Server/library/
   namespace/commit effects are mocked; the browser does not exercise the full
   handler/provider. Resource ownership now uses `latex_resource.js` and
   `latex_resource_view.js` for captured constructors/callbacks, parked documents,
   reference/presence isolation, chrome rebinding and full best-effort teardown.
   24/24 focused and 1128/1128 full Node pass; user-reported resource browser PASS, 19 checks
   (`2026-11-22.15`), with vendor/timer/session/reference APIs mocked. The first
   resource browser run failed a fixture-only CSS hex/rgb comparison, reproduced
   and corrected with 9/9 resource Node cases; application code was unchanged by that fixture fix.
   LaTeX compilation/Share/content controls now use `latex_controls_workflow.js`,
   `latex_controls.js`, `latex_controls_view.js` and `latex_content.js`, retaining
   the handler/mount bridge. Captured compile requests, PDF URL ownership, bound
   Share/Copy, owned synchronous content/reference commands and bibliography refresh
   pass 34/34 focused and 1138/1138 full Node checks. User-reported controls browser PASS,
   28 checks (`2026-11-22.16`), with HTTP/resource/vendor/clipboard/PDF effects mocked.
   After browser validation, item 5 (Slides application integration) follows.
5. Slides application integration: saved-layout Save/Rename/Delete now use
   `slides_layout_workflow.js`, `slides_layout.js` and `slides_layout_view.js`,
   reusing PageStore and the shared dialog builder. 21/21 focused and 1147/1147 full
   Node pass; user-reported layout browser PASS, 23 checks (`2026-11-23.1`). IndexedDB/editor/
   session/modal effects are mocked, without embedded source or bundle changes.
   Import/export and initial layout refresh now use `slides_io_workflow.js`,
   `slides_io.js` and `slides_io_view.js`, with captured source/dispatch locks,
   partial refresh, warning presentation and snapshot reference guards. 23/23
   focused and 1159/1159 full Node pass; user-reported IO browser PASS, 26 checks (`2026-11-23.2`).
   Picker/editor/source/storage/deferred/modal effects mocked; embedded converter,
   native picker/download and full mounting integration are not exercised. Existing
   embedded APIs remain unchanged. After browser validation, item 6 follows.
6. Initial OAuth/service account setup: Dropbox's initial form now uses
   `dropbox_setup.js` / `dropbox_setup_view.js`, retaining its registry factory and
   existing start helper. Shared authorization preparation delegates through
   `oauth_start_workflow.js`, preserving runtime/PKCE/state behavior while accepting
   an optional owner guard before persistence/navigation. 30/30 focused and
   1168/1168 full Node pass; user-reported browser PASS, 19 checks (`2026-11-23.3`), with PKCE,
   registration/storage/navigation/session effects mocked. Callback account saving
   now uses `oauth_account_workflow.js`, `oauth_account.js`, `oauth_account_view.js`
   and the existing account validator/encryption helper, with captured sessions,
   write/refresh separation, private receipts and read-only uncertain-write review.
   29/29 focused and 1177/1177 full Node pass; user-reported browser PASS,
   21 checks (`2026-11-23.4`), with KV/crypto/session/provider/navigation/modal effects mocked.
   Standard Mastodon/Dropbox callback exchange/pickup now uses `oauth_callback*`,
   with original cookie-session fingerprints, single-use 30-minute receipts,
   duplicate locks, newer-result preservation and guards through account saving.
   28/28 focused and 1187/1187 full Node pass; user-reported browser PASS,
   39 checks (`2026-11-23.5`).
   Storage/hash/session/exchange/encryption/UI effects mocked; live OAuth and full
   startup/navigation not exercised. WordPress application-password binding now uses
   `wordpress_auth_workflow.js`, `wordpress_auth.js` and `wordpress_auth_view.js`,
   with the existing form/handler, shared receipts/pickup and account saving. Bound
   success/denial URLs, exact canonical site checks, original-session guards,
   duplicate/form expiry, local relay and scoped recovery pass 36/36 focused and
   1196/1196 full Node checks; user-reported browser PASS (`2026-11-23.6`, 34 checks). Session,
   crypto, storage/navigation/UI effects mocked; live services and full startup
   unverified. Next: remaining service setup panels; the WordPress form's full view
   extraction remains separate from this authorization boundary. Mastodon setup now
   uses `mastodon_setup.js` / `mastodon_setup_view.js` through its existing factory,
   reusing shared account-save receipts, persistence and recovery. OAuth/manual
   captures, form/session expiry, rebuild locks and newer-draft protection pass
   47/47 relevant Node tests; user-reported browser PASS (`2026-11-23.7`, 28 checks). OAuth
   login/KV/crypto/session/panel/reader effects mocked; no current full sweep or live
   service validation. Blogger setup now uses `blogger_setup.js` / `blogger_setup_view.js`,
   sharing lifecycle and feedback with Mastodon via `account-setup.js` and
   `account-setup-view.js`. Blogger configuration storage remains separate from
   publication-time Google authorization. 44/44 relevant Node tests pass, including
   Mastodon setup and Blogger publishing; Blogger browser validated (`2026-11-23.8`,
   25 checks), with storage/crypto/session/panel effects mocked. User-reported Blogger
   browser PASS: 25 checks (`2026-11-23.8`). Full sweep deferred. WordPress's remaining
   form now uses `wordpress_setup.js` / `wordpress_setup_view.js`, retaining the
   existing bound auth workflow and adding form-owned errors and pending controls.
   21/21 relevant Node tests pass; user-reported browser PASS (`2026-11-23.9`, 17 checks), with
   sessions/crypto/storage/navigation mocked. Collab setup now uses `collab_setup*`
   for captured registration transport, retained service receipts and shared account
   persistence/recovery. 34/34 relevant Node tests pass; user-reported browser PASS
   (`2026-11-23.10`, 26 checks), with HTTP/session/crypto/storage/panel effects mocked.
   Live registration, WebSockets and full panel integration unverified; full sweep
   deferred. Annotate setup now uses `annotate_setup*`, sharing the registration
   lifecycle/receipts with Collab through `account-registration-setup.js`. Startup
   health probes own their source/draft/generation and cannot overwrite new
   connection/error feedback. 42/42 relevant Node tests pass; user-reported browser PASS
   (`2026-11-23.11`, 29 checks). HTTP/session/crypto/KV/panel effects mocked; live
   services/full integration unverified. Discord subscriptions and admin channels now
   use `discord_setup*` / `discord_admin*`, retaining registry and edit-form bridges,
   captured credentials/commands, add-only writes/exact removal and separate receipt
   recovery. 27/27 relevant Node tests pass; user-reported browser PASS (`2026-11-23.12`,
   35 checks), with HTTP/session/KV/crypto/panel/reader effects mocked. Full sweep
   deferred. The seven custom add-account factories now delegate to separated setup
   modules. Brief follow-up review identified existing-account Re-authorize hooks
   (`account-form.js`) as a separate remaining source/form-guard boundary; they are
   not covered by the completed add-account fixtures.
7. Personal Options now uses `personal-options.js`, `personal-options-workflow.js`
   and `personal-options-view.js` for state-owned toggles, preference persistence,
   theme/TinyMCE display and panel construction. Transfer controls delegate through
   `personal-options-transfer.js`, preserving existing data APIs while guarding
   panel/file/password handoffs and separating import success from refresh failure.
   18/18 relevant Node tests pass; user-reported browser PASS (`2026-11-23.13`, 26 checks).
   Storage/TinyMCE/session/transfer/picker/history effects mocked; full sweep deferred.
   Account export/import now uses `account-transfer-workflow.js` and
   `account-transfer-controller.js`, with captured source/destination methods and
   key-version/caller guards. Native format remains v1; imports are add-only and
   retain accepted/uncertain receipts for read-only review and explicit remaining
   retries through Options. 29/29 relevant Node tests pass; user-reported browser PASS
   (`2026-11-23.14`, 30 checks), with storage/session/crypto/download effects mocked.
   Existing-account Re-authorize now delegates to `account-reauthorization.js` with
   captured build session, form generation, raw field/node/revision guards and
   pending/redirect locks. Mastodon/Dropbox hooks forward the options to existing
   OAuth preparation. 40/40 relevant Node tests pass; user-reported browser PASS
   (`2026-11-23.15`, 23 checks), with sessions/crypto/registration/storage/navigation
   mocked. The listed targeted boundaries have implementations, but live/full
   integration and the deferred full test sweep remain outstanding. After browser
   validation, review the combined changes and round-trip integration gaps before
   deciding the final validation/commit sequence.

### Closing integration review

Checkpoint committed as `1f8ae18` (no push). User reported Re-authorize browser
PASS: 23 checks at `.15`. The first combined-path review found minimal OAuth
callback records replacing existing metadata. Existing-account callbacks now
read/decrypt/merge the captured destination's latest account, preserve extensions,
retain captured known form choices, reject missing/replaced-type records and
compare encrypted metadata before dispatch. Dropbox omitted refresh tokens remain
scoped to the same app key. Initial account creation is unchanged.

55/55 relevant Node tests pass; new form/start/exchange/pickup/provider/save
integration fixture has 28 assertions. User-reported browser PASS at
`tests/oauth-reauthorization.browser.html`, marker `2026-11-23.16`.
All HTTP, crypto, storage, session and navigation effects are mocked. No atomic
cross-client concurrency, live OAuth, real crypto or startup/popup routing claim.
Next: continue reviewing combined integration paths;
full sweep is still deferred. This follow-up is not part of the checkpoint commit.

The next combined-path check reproduced out-of-order account-save list refreshes:
older successful lists discarded newer accounts and older failures replaced newer
success feedback. The shared saver now sequences refreshes, rejects superseded
installation/navigation/status/failure effects and retains accepted receipts for
explicit refresh-only recovery. Three regression cases add seven assertions to
`oauth-account.browser.html` (28 total), marker `2026-11-23.17`; user-reported browser PASS.
82/82 immediately relevant Node tests pass, zero failures/skips.
The sequence is local to one saver, not an application-wide account-list store.
Provider hooks already dispatched are not cancelled. No full-sweep claim.

### Closing review and full Node sweep — completed within stated scope

User reported PASS: 28 checks for both round-trip `.16` and account-save `.17`.
The user then authorized finishing the review and running the deferred full sweep.
`node --test tests/*.test.cjs`: 1288 passed, zero failures/skips/cancellations.
The main/callback entry points and 107 browser fixtures have 1149 local script
references, no missing targets or duplicate paths. Selected dependency ordering
is correct; interface.js remains the final external tag with its existing eager
startup retained. Localhost serves the current main page/saver/two fixture files
with status 200 and the expected content types. Static/HTTP checks are not browser
execution. No further blocker surfaced in the focused handoff review.

All seven planned extraction areas have implementations and their recorded
mocked-scope results. No new extraction stage is proposed at this checkpoint.
Remaining: the user's final normal-application checks in docs/testing.md,
fix any observed regressions, then review/commit when requested. Live service,
real storage durability, vendor editor and cryptographic behavior are not inferred
from the mocks. The two integration fixes and documentation remain uncommitted;
nothing pushed. Earlier per-stage notes below retain historical test counts and
pending scopes and do not supersede this latest full-sweep result.

## Earlier checkpoint — 2026-11-20

This checkpoint supersedes the historical implementation notes below. Shared
account management, publishing workflows (including collection publication),
central reader dispatch and LocalRSS, editor load/switch/drafts/Load-Blank,
Save panel, References and Tags now have extracted boundaries. Service-owned
internals behind those boundaries still migrate individually. Tags browser
verification passed on 2026-11-19. Find now separates query/request/controller/view
and migrates OpenAlex/Commons to captured guarded search contexts; the Find browser
fixture passed. Google/DDG/OASIS internals now use captured requests and shared
row controls; their browser fixture passed user testing (17 checks).
Local file saving now separates captured export/controller, explicit write/index
operations and filename/result UI. My Pages separates state, listing/loading/delete
workflow, controller and view. Dropbox saving, collection uploads, token-refresh
sessions and the file picker now have separated modules and mocked Node/browser
checks; initial OAuth setup remains on its existing path.

The user-approved remaining order is:

1. Find/search — current slice implemented; retain legacy provider compatibility.
2. File saving internals, My Pages and Dropbox save/picker — implemented and checked.
3. Collection browsing, imports, membership operations and member-opening workflows
   — implemented; 554 Node tests pass. All four collection browser fixtures and
   adjacent saved-file recognition passed user testing after the JSON member fix.
   Existing collection Save/publication boundaries and draft row widgets remain in use.
4. Remaining service readers and row actions — implemented in the working tree;
   all six browser fixtures passed user testing (shared rows 14, Mastodon 13,
   Bluesky 15, Discord/public feeds 15, annotations 14, plus LocalRSS).
   The full Node suite passed 597/597. Mastodon, Bluesky, Discord, public feeds
   and annotations now use captured contexts/views. Shared and LocalRSS row
   controls retain targets in closures rather than HTML. Google/DDG/OASIS
   internals are now implemented as a small follow-up: 604/604 Node tests pass,
   with the new browser fixture passing user testing (17 checks); a fixture-only
   selector correction subsequently passed 23 focused Find Node tests. OpenAlex/Commons row controls now use the shared callback binder (606/606 Node
   tests pass; updated Find browser fixture passed user testing, 28 checks). Annotation controller
   presentation cleanup is now implemented (607/607 Node tests pass; updated
   annotation browser fixture passed user testing, 20 checks). The next area is authentication/identity,
   to be scoped as a small separate slice after validation.
5. Authentication, identity/DID/migration and administrative settings. First small
   slice: Me → Following workflow/controller/view implemented; 613/613 Node tests
   pass, Following browser check passed user testing (17 checks). Login and DID/migration/admin paths
   remain on their existing implementations. DID identity display and public
   account listing now have separated read workflow/controller/view (620/620 Node
   tests pass; browser check passed user testing, 18 checks). Identity write/removal/migration
   lifecycles are outside this read-only slice. Prove Same Identity is now a
   separate workflow/controller/view (626/626 Node tests pass; extended DID browser
   fixture passed user testing, 27 checks). Publish Existing Key now has a separate workflow/controller/view (635/635 Node
   tests pass; extended DID browser fixture passed user testing, 37 checks). Generation/regeneration,
   Update DID, removal/migration and login remain separate. Shared password
   confirmation now has workflow/controller/view boundaries (642/642 Node tests
   pass; browser fixture passed user testing, 21 checks), preserving custom import/export
   verification and adding stale source/session/dialog guards before dispatch.
   First-time identity generation now uses add-only workflow/controller/view and
   existing-key publication (650/650 Node tests pass; extended DID browser fixture
   passed user testing, 48 checks). Confirmed regeneration/rotation now has its
   own workflow/controller/view and partial-write recovery (660/660 Node tests
   pass; extended DID browser fixture passed user testing, 62 checks). Remove DID
   now has separate workflow/controller/view and step receipts (669/669 Node tests
   pass; extended DID browser fixture passed user testing, 75 checks). Update DID and migration internals
   remain separate, with guarded mutation dispatch. Update DID and public-account
   selection now have workflow/controller/view boundaries (677/677 Node tests pass;
   extended DID browser fixture passed user testing, 85 checks). Migration preparation/preview now has workflow/controller/view boundaries,
   fail-closed record checks, registration receipts, captured approval and a revalidated
   one-use execution handoff (685/685 Node tests pass). User reported browser PASS (25 preparation,
   85 DID checks); the preparation-page layout fix was visually confirmed. Copy/link execution and
   recovery now have workflow/controller/view boundaries and a public identity helper.
   Per-step receipts, read-only reconciliation, explicit remaining-step retries and
   tab/source-session recovery pass 696/696 Node tests; the new migration-execution
   browser fixture passed user testing (35 checks; HTTP/storage/crypto mocked).
   Login/register modal validation/navigation and account-server selection now use
   state/controller/view boundaries (705/705 Node tests pass; `auth-panel.browser.html`
   passed user testing, 21 checks with effects mocked). Credential verification/
   registration and session installation now have captured explicit workflows,
   registration receipts, response validation and token-last save/rollback
   (714/714 Node tests pass; `auth-credentials.browser.html` passed user testing,
   27 checks with effects mocked).
   Post-login setup/seeding now has separate workflow/controller/view, captured
   service descriptors, per-step receipts and explicit recovery (723/723 Node
   tests pass; `post-login.browser.html` passed user testing, 22 checks with
   effects mocked). Logout/startup/storage-event restoration now has captured
   workflow/controller/view boundaries, auth epoch cancellation, validated
   restoration, scoped token-first cleanup and reload recovery (733/733 Node
   tests pass). The `session-lifecycle.browser.html` fixture passed user testing,
   24 checks with effects mocked.
   Administrative settings now have captured app metadata, workflow/controller/view,
   private drafts and accepted/uncertain PUT receipts (743/743 Node tests pass;
   `admin-settings.browser.html` passed user testing, 25 checks). Backend authorization and
   live services remain outside mocked validation.
6. Pane persistence/navigation, keyboard/mobile state and reusable action/menu contracts.
   First slice: layout state, legacy two-profile persistence, open/close/snap/reveal
   commands and drag sizing now use `pane-state.js`, `panes.js` and `pane-view.js`
   (753/753 Node tests pass; `panes.browser.html` passed user testing, 23 checks).
   Keyboard/touch interpretation now uses `navigation-state.js`, `navigation.js`
   and `navigation-view.js` (764/764 Node tests pass; `navigation.browser.html`
   passed user testing, 41 checks). Shared labelled action definitions/controller/view
   now pilot the reader feed-menu through `action-menu.js` and `action-menu-view.js`;
   770/770 Node tests pass; the user reported browser PASS, 22 checks.
   Reader pop-out/Back/Close/Escape/focus-return now use `menu-shell.js` and
   `menu-shell-view.js`, moving the same menu node through the existing app modal.
   777/777 Node tests pass; the user reported browser PASS, 26 checks. Service dispatch and Translate are
   preserved. LocalRSS Options now adopts the same shell with its existing header
   trigger and captured target guards; drafts/statistics/pending operations stay
   on the same root (784/784 Node tests pass; user-reported browser PASS, 21 checks). Legacy database/feed/
   import internals remain outside this presentation slice.
7. Collaboration/P2P chat session workflows, then remaining AI feature boundaries.
   Initialization, captured control/Peer/channel lifecycle and teardown now use
   `dynamicp2p_session.js`, `dynamicp2p_session_view.js` and
   `dynamicp2p_session_bridge.js`. Focused Node checks pass 10/10 and the full
   Node suite passes 794/794; the user reported browser PASS, 27 checks.
   Discussion listing/Join now use captured request/controller/view modules;
   focused directory/session Node checks pass 18/18, full Node passes 802/802,
   and the user reported browser PASS, 30 checks. Create/Leave now have captured
   workflow/controller/view/bridge boundaries and local-only recovery (29 focused
   checks and 813/813 full Node pass; user-reported browser PASS, 32 checks).
   Popup main/client communication and view now use `dynamicp2p_popup*` with
   isolated channels, per-load request ownership, draft-safe acknowledgements and
   teardown guards (19 focused and 822/822 full Node pass; user-reported browser PASS, 25 checks). Message formatting/crypto/storage
   remains legacy. Main incoming share/invite cards now have controller/view and
   captured action boundaries (8 focused cases and 830/830 full Node pass;
   user-reported browser PASS, 24 checks).
   Outgoing preparation/one-pending-share/broadcast now uses `dynamicp2p_share*`,
   captured Create outcomes and one-pass current-channel dispatch (8 focused
   cases and 838/838 full Node pass; user-reported browser PASS, 28 checks), with completion guards
   at the session boundary. Ordinary text message processing/rendering now uses
   `dynamicp2p_message*` with captured packets, dedup/sign/verification/relay guards
   and view-owned transcript/sanitizer helpers (18 focused checks, 846/846 full
   Node pass; user-reported browser PASS, 21 checks).
   Peer discovery/identity-control normalization/controller/view, guarded Follow
   rows and shared handshakes now use `dynamicp2p_control*` (18 focused checks,
   854/854 full Node pass; user-reported browser PASS, 29 checks). Chat identity loading/signing/verification now uses `dynamicp2p_identity*`,
   shared crypto helpers and captured key/source guards (19 focused and 863/863 full
   Node pass; user-reported browser PASS, 25 checks). No real crypto or storage writes tested.
   Discussion heartbeat now uses `dynamicp2p_heartbeat*`, with captured transport,
   timer/overlap ownership and view feedback (28 focused and 870/870 full Node
   pass; user-reported browser PASS, 25 checks). HTTP/timers/session/feedback helpers mocked.
   Continue with one small slice.

   Start document from chat now uses `dynamicp2p_collaboration*` for transcript
   snapshots and captured/coalesced dispatch (25 focused and 876/876 full Node
   pass; user-reported browser PASS, 22 checks). Collaboration editor API/session/feedback
   mocked; document creation and invitation internals remain separate.

   Stateless Etherpad link decoration now reuses the message workflow/view and
   legacy wrappers (22 focused and 880/880 full Node pass; user-reported browser
   PASS, 18 checks). Recognition preserves legacy rules; real DOM formatting,
   sanitizer and query-link behavior passed the mocked browser fixture. Links
   were not opened. No extra controller/state introduced.

   Summarize now has explicit request/controller/view modules, captured AI/reader/
   input ownership and bound output Load controls (10 focused and 887/887 full
   Node pass; user-reported browser PASS, 32 checks). HTTP/accounts/reader/editor
   effects mocked; actual DOM capture/rendering passed the fixture.
   Translate now has request/controller/view boundaries, captured credentials,
   preference/deadline guards and stale-safe form controls (32 focused and 895/895
   full Node pass; user-reported browser PASS, 31 checks). HTTP/storage/accounts/reader/deadlines
   mocked. ChatGPT template transport/continuations and captured request ownership
   now use `chatgpt_requests.js` and `chatgpt_template_requests.js` (14 focused and
   902/902 full Node pass; user-reported browser PASS, 34 checks). HTTP/accounts/sessions mocked;
   Template generation form now uses `chatgpt_template_form.js` and
   `chatgpt_template_view.js`, with private choices, guarded loader settlement,
   local progress and observer cleanup (14 focused and 909/909 full Node pass;
   user-reported browser PASS, 21 checks). HTTP/accounts/sessions/editor/navigation effects
   mocked. Collab document browsing now uses `collab_documents*` for captured
   requests, list/row ownership, literal rendering and opening dispatch (25
   focused and 916/916 full Node pass; user-reported browser PASS, 22 checks). HTTP/accounts/
   sessions/shared helpers/opening hook mocked. Local/remote connection preparation
   now shares captured credentials/targets and commit guards through
   `collab_connection_preparation.js` (21 focused and 924/924 full Node pass;
   user-reported browser PASS, 20 checks). Node additionally exercises real Collab initializers
   with resource/dependency fakes; browser fixture covers preparation only.
   Provider/resource lifecycle and status/presence now use `collab_connection.js`
   and `collab_connection_view.js`, with captured callbacks, owned cleanup,
   background/reference guards and explicit resume rebinding (22 focused and
   932/932 full Node pass; user-reported browser PASS, 22 checks). Resource/timer/session/reference
   APIs mocked. Real vendor synchronization/authentication remain unverified;
   Formatting controls now use `collab_format.js` and `collab_format_view.js`,
   captured editor chains, read-only/active presentation and listener cleanup
   (23 focused and 939/939 full Node pass; user-reported browser PASS, 18 checks). TipTap events/
   chains, ownership and feedback mocked. Duplicate-title checks, warning choices
   and title-listener ownership now use `collab_title*`, with captured checked
   targets and guarded existing-document loading (23 focused and 947/947 full
   Node pass; user-reported browser PASS, 26 checks). Identity/HTTP/server/ownership/timers/opening
   effects mocked. Share panel/access-setting requests and captured Copy/Chat/
   Post handoff now use `collab_share*`, with per-target pending/uncertain locks
   and read-only recovery (25 focused and 956/956 full Node pass; user-reported browser PASS, 27 checks).
   HTTP/session/document/chat/clipboard/composer/modal effects mocked. Post
   composer now uses `collab_composer.js` and `collab_composer_view.js`, with
   owned delayed initialization, temporary-handler restoration, draft protection
   and captured publication completion hooks (26 focused and 966/966 full Node
   pass; user-reported browser PASS, 21 checks). TinyMCE/session/publishing/timers mocked.
   Link/invite opening now uses `collab_opening*` for normalization, duplicate and
   superseded intents, captured session/editor guards and owned title feedback
   (17 focused and 975/975 full Node pass; user-reported browser PASS, 27 checks). Editor selection,
   connection and modal effects mocked in its browser fixture; Node also checks
   the actual Collab adapter with mocked provider dependencies. Collection/chat
   creation now uses `collab_creation*`, with captured seeds, shared selection,
   namespace/connection-intent guards and owned timer/update-listener cleanup.
   Delayed seeds skip changed/nonempty or replaced resources (27 focused and
   985/985 full Node pass; user-reported browser PASS, 27 checks). Sessions, editor/provider APIs,
   sanitizer, timers and invitations mocked; live synchronization remains untested.
   Header Share/Annotate controls now use `collab_header.js` and
   `collab_header_view.js`, retaining structural slots and guarding captured
   targets, local creation, annotation references and staged load/reveal
   (17 focused and 994/994 full Node pass; user-reported browser PASS, 20 checks). Services, sessions,
   editor/reference effects and pane/modal APIs mocked. Content/reference
   insertion/resync now use `collab_content*`, with captured resources/source
   references, literal plaintext, retained reference identity/extensions,
   guarded operation stages and partial-failure feedback (23 focused and
   1003/1003 full Node pass; user-reported browser PASS, 25 checks). Editor/session/source/panel APIs
   mocked; maps/JSON and reference deduplication real. Main Collab mounting now
   uses `collab_mount.js` and `collab_mount_view.js`, preserving local/remote
   resources and guarding library/local/drop/pending-content stages, duplicate
   activations and newer titles/intents (18 focused and 1013/1013 full Node pass;
   user-reported browser PASS, 28 checks). Selection, library, resources, loader and modal mocked in
   its fixture; Node also runs the actual initializer with mocked provider APIs.
   Audit remaining UI/state boundaries after its browser result; full editor
   switching and live vendor synchronization remain separately unverified.

For each slice: keep current behavior, reuse registries/helpers, capture inputs
and operation lifetime, keep views free of writes, and test stale/duplicate/error
paths. DOM in views/editor widgets and HTML output serializers remains legitimate.
Commit/push only with the user's instruction. Detailed remaining scope was reviewed
against the checkout; do not treat the earlier plan's completed items as a new todo.

## Historical plan and implementation notes

Architecture and migration plan dated 2026-11-11, with incremental implementation
notes below. Each patch is reviewed separately; proposed contracts in the later
sections are not all implemented APIs.

Implementation update, 2026-11-13: the incremental Collections save work now
captures a detached request through `readCollectionSaveFields()` and
`captureCollectionSaveRequest()`. `persistCollectionSave(request, session)` is
the DOM-free storage boundary, dispatching feed saves through the existing reader
registry's optional `saveCollection` operation. `runCollectionSave()` owns save
status, duplicate-write protection, and reconciliation with the active collection.
`CList.state.collectionSaving` keeps an active-target Map and request-status WeakMap;
credentials are passed transiently, not stored in that operation state. The editor
retains ownership of the live draft. Completion preserves newer edits and leaves
a different active collection untouched. The button keeps presentation feedback.
File and Dropbox save workflows remain on their existing paths for later patches.

Account management implementation update: generic navigation/account-list code
now lives in `account-panel.js`, schema rendering/capture in `account-form.js`,
and load/save/delete operations in the DOM-free `account-state.js`. Service
extensions use `accountHooks` rather than generic form branches. `getAccounts()`
is a compatibility wrapper over the shared decoder. Successful writes and
subsequent refresh failures are presented separately; retrying refresh never
repeats a write. Identity, authentication, settings, and custom service-flow
controllers remain separate future work.

Ordinary publishing implementation update: `publishing-workflow.js` now owns
multi-destination ordering, content limits/link handoff, and structured outcomes.
It receives account/publisher snapshots and explicit conversion/update callbacks;
it has no controls, renderers, or global-state reads. `publishing-view.js` maps
updates to existing UI helpers. `publish.js` retains editor request capture,
account loading, busy lifetime, PageStore metadata, WebMentions, and completion
actions. `publishing.operation` stores safe per-destination status/progress.
The subsequent Mastodon/Bluesky extraction moved their publishers into
`service_publish.js` adapters; Blogger also now throws errors without UI.
Other legacy adapters and collection publishing/republishing remain future
work; this extraction does not claim all publishing is UI-free.

Standalone web-page implementation update: new, overwrite, and Republish now use
`web-page-workflow.js` with explicit dependencies. `web-page-publishing.js`
captures editor/source/session data, owns operation lifetime and reconciliation,
and invokes `web-page-view.js` for choices and feedback. `web-page-records.js`
retains shared identity/metadata helpers with compatibility for file saves.
Destination matching, stale-page protection, busy guards, and metadata-only
failure outcomes are verified independently of a browser. Collection publication
and republishing are not included in this extraction.

## Assessment

The feedback identifies a real maintenance problem. CList separates services well, but many
service operations also construct interfaces and display results. A navigation change can
therefore require edits across several integrations. The existing registries, account schemas,
shared UI helpers, and PageStore provide useful foundations; they should be extended.

Original assessment examples (the implementation updates above supersede migrated items):

| Location | Current responsibility crossing | Proposed boundary |
|---|---|---|
| `js/publish.js`: `populatePostOptions`, `_postAllSelected` | Selection is written to and read from button `data-selected` attributes | State owns selected account keys; buttons reflect state |
| `js/mastodon.js`: `postMastodonStatus` | API operation accepts `responseDiv` | Data operation returns a result; controller presents it |
| `js/ui.js`: `window.CList.ui.listing` | Shared renderer inserts service-provided `statusActions` HTML | Renderer consumes action definitions, with legacy fallback |
| `js/interface.js`: `setupFeedButtons` | Existing registry already supplies feed actions | Extend this contract rather than introduce another dispatcher |
| `js/localrss.js`: feed-options panel | Service constructs panel controls and pop-out affordance | Feature view supplies definitions to a reusable navigation component |

Not every DOM reference is misplaced. `editors.js` manages UI components, so editor mounting
and control lookup belong there. Separate reusable document operations from editor controls,
but do not demand DOM-free editors. Likewise, content HTML and standalone presentation
serialization are output formats, not application interface markup.

## Target responsibilities

| Layer | Owns | Must not depend on |
|---|---|---|
| Domain/state | Selection, workflow state, validation, pure transformations | Elements, selectors, CSS, modal helpers |
| Service/storage adapter | Authenticated requests, response parsing, service-specific data, persistence | Layout and rendering |
| Controller | Action orchestration, operation lifetime, state updates, error presentation through views | Concrete markup and service-specific dispatch branches |
| View/component | DOM, form input, rendering, focus, navigation controls, accessibility | Direct remote writes or hidden application state in markup |

Prefer direct calls and promises along this path: input handler calls controller; controller
calls a registered operation; operation returns data; controller updates state and invokes a
view. A controller may depend on a view interface. Independent observers can subscribe to
state changes where needed; events are not mandatory for every operation.

No framework, new app-wide build requirement, or replacement registry is proposed.
Keep deferred script ordering and `interface.js` last. New dependencies must be initialized
explicitly before use. The slide editor's existing separate build remains separate.

## State and result contracts

Implemented shared publishing state is `window.CList.state.publishing`, containing
`selectedAccountKeys`, `busy`, and an `operation` summary with per-destination results. Use stable account keys, not labels
or credentials. Define explicit actions to toggle a target, reconcile account removal, and
begin/finish a publication. Decide and document whether opening Post preserves selections;
logout and account-store changes must clear incompatible selections. Do not persist these
selections by default.

PageStore remains the owner of saved pages and publication records. Editor/Yjs models remain
the owner of live documents. `CList.state` stores references and workflow state, not copies
of these records or secret material. View-local focus, hover, and editor internals need not
become global state. A lightweight subscribe/unsubscribe API is sufficient if multiple views
need notification; do not add proxies or a universal store before a real consumer exists.

For an extracted publisher, a proposed result is `{ id, url, status }`, with nullable fields
and documented status values. Missing links and uncertain outcomes must be explicit; an HTTP
success is not necessarily proof of public publication. Errors propagate with useful operation
context, without credentials. Do not automatically retry external writes: a timeout can occur
after the server accepted the request. A progress callback can report `{ stage, completed,
total }` without containing presentation text or DOM references.

These are proposed contracts, not currently callable APIs. Keep existing URL-returning
publisher handlers working through controller-side adapters until their consumers migrate.

## Reusable menu contract

A proposed serializable definition:

```json
{
  "id": "feed-options",
  "title": "Feed options",
  "items": [
    {
      "id": "refresh",
      "label": "Refresh",
      "icon": "refresh",
      "command": "reader.refresh",
      "args": { "accountKey": "example-account" },
      "enabled": true
    }
  ]
}
```

Use capability checks to produce availability; revalidate arguments, permissions, and current
state when executing. A command ID resolves only to a registered command. No executable
strings, raw interface HTML, credential arguments, or service-name conditionals in the renderer.
Render labels as text and constrain icon names. JSON describes the menu; a component-owned
navigation stack supplies Back and Close, rather than embedding those actions in each service.
The component owns focus restoration, Escape behaviour, accessible names, and standard buttons.

Do not introduce `context_menu_popout` merely because it was named in the feedback. First
inventory the existing left-pane, pop-out, menu, and modal helpers; extend the closest shell.
Keep feature-specific views separate from shared components instead of expanding `ui.js`
into the implementation of every screen.

## Incremental implementation

### 1. Pilot state ownership in publishing

Start with `populatePostOptions` and `_postAllSelected` in `js/publish.js`. Introduce the
small publishing state contract at namespace initialization in `index.html`, and explicit
state actions/selectors in `publish.js`. Change account clicks to update state and render
selection. Publishing reads state, never buttons. Keep the current visual layout and registry.

Acceptance: rebuilding the panel preserves the chosen policy for selection; removing an
account reconciles state; changing DOM classes cannot change publish targets; double-clicks
cannot start duplicate operations. Exercise logout/account changes and no-selection errors.

### 2. Extract one publisher operation

Pilot WordPress because its upload/post workflow already exposes progress, errors, and uncertain
results. Extract request/upload/post functions accepting account data, article content, and
optional progress/abort inputs. Keep article conversion in the content-serialization boundary.
Leave the existing `publishers.WordPress` entry as a compatibility adapter. A publishing
controller translates results into shared state and invokes existing feedback views.

Choose a dedicated feature file only if the extraction warrants it; do not create a generic
service framework. Keep existing validation, upload ordering, and deduplication semantics.

Acceptance: mocked network tests exercise success, rejected media, missing URL, timeout,
partial upload, and an accepted but unconfirmed post with no document or UI globals. View
tests prove progress clears and errors remain visible, exactly once. No live post is required.

### 3. Pilot a shared menu component

Inventory current panel/navigation builders in `interface.js` and `ui.js`, plus LocalRSS
feed options. Select one menu whose existing behaviour is understood. Separate its definition
provider and command execution from its feature view. Extend the existing UI shell to accept
the definition and own Back/Close and focus. Keep the legacy entry point delegating to it.

Acceptance: the same definition can render in the left pane and pop-out without service edits;
Back, Close, Escape, keyboard navigation, and focus restoration work. Unsupported/disabled
commands and malicious label text are handled safely. Preserve existing mobile navigation.

### 4. Migrate reader data and actions by service

Add optional data-fetch and action-definition contracts to the existing reader registry.
Preserve `initialize`, `feedFunctions`, and HTML-returning `statusActions` until each service's
consumers migrate. In `ui.js` listing rendering, prefer definitions when available and otherwise
use the established legacy path. Do not add a new reader registry or service switch statement.

Use normalized common fields with service-specific extensions; retain paging cursors,
permissions, references, and identity information. Controllers own active-account/request
context, cancel superseded reads where supported, and ignore stale responses when an account
switch occurs. Cache updates must not incorrectly render old results into the current view.

Acceptance: one migrated service and one legacy service work together. Test paging, empty
feeds, per-item actions, fast account switches, and failures. Render fixtures without real
network calls; test extracted service operations without a DOM.

### 5. Expand only after the pilots establish the contracts

Apply the proven pattern to other publishers, readers, collections, and save/load workflows
as those features change. Move UI construction into feature views and shared components;
do not rewrite every service at once. Update `docs/adding-a-service.md`,
`docs/publish_structure.md`, `docs/error-handling.md`, and `docs/feed-structure.md` alongside
the relevant contract changes. Remove compatibility adapters only when no consumers remain.

## Validation and scope control

Each future patch should identify the state owner, data contract, controller boundary, and
compatibility path. Use meaningful tests across those boundaries, not snapshots of every DOM
detail. Check static hosted and launcher operation, mobile navigation, standard buttons/modals,
and asynchronous error handling for the affected workflow. A lightweight dependency check for
DOM APIs in extracted data files may help later; do not ban HTML or DOM APIs across all JS.

The first implementation should be phase 1 alone. No broad file moves, framework adoption,
or automatic conversion of existing services is needed to adopt the guidance now.


## Post-merge verification — 2026-11-23

At upstream commit `d7e165d`, `node --test tests/*.test.cjs` passed **1396 tests**,
zero failures/skips/cancellations. This supersedes earlier totals as the latest
Node result, without changing their historical evidence. No browser, live-service
or Python backend tests were run in this sweep. Normal-application checks remain
pending. New upstream features are not covered by the earlier refactor-completion
claim: calendar browsing/subscriptions/ICS, Event and gRSShopper Post editors,
and reusable inline editor panes must be assessed on their own current code/tests.

Additional Node modules: `calendar.test.cjs`, `calendar-ics.test.cjs`,
`calendar-browser.test.cjs`, `calendar-browser-view.test.cjs`,
`calendar-subscription.test.cjs`, `calendar-subscriptions.test.cjs`,
`event-editor.test.cjs`, and `grsshopper-editor.test.cjs` under `tests/`.
Their simulated DOM, service and storage evidence is not proof of live calendar
publication, real TinyMCE rendering or remote gRSShopper writes.
