# Reader account selection and loading

CList's Read menu lists readable accounts, followed by Annotations (where
available) and Collections (for registered users). Logged-out visitors see the
public collections. Account icons and normal service feed actions are preserved.

The first reader refactoring step separates selection/loading state from panel
rendering. It does not yet rewrite every service's network and rendering code.

## Responsibilities

| Part | Responsibility |
|---|---|
| `reader-state.js` | Plain-data selection/loading transitions and monotonically increasing request IDs |
| `reader.js` | Registry dispatch, detached account/session capture, request ownership, completion and compatibility entry points |
| `reader-view.js` | Read/account menus, feed buttons, selected-account label and central feedback |
| `reader-types.js` | Reader JSDoc contracts, referenced from the shared contract index |
| Service modules | Existing initialization, feed fetching/normalization and service actions; migrate these separately |

`CList.state.reader` contains the account key/type, logical feed name, mode,
loading/ready/failed status, current request ID and error text. It never contains
account credentials or service sessions. Button appearance reflects these values.
Refresh retains the selected feed rather than becoming its own selected filter.

Each account selection captures the actual selected account and account-store
session before awaiting initialization. The registry remains service-independent.
A late completion, error or delayed status cleanup from an older request cannot
change the central selection/status. Logout, session-end and account-server changes
invalidate request ownership. Removing or changing the selected account during a
list refresh invalidates it too. Read-panel account loading checks its captured
session and panel generation before rebuilding the list.

## Guarded service integration

The optional second argument to `initialize(accountData, context)` provides:

- A detached selected account and logical feed name.
- An AbortSignal a service may pass to fetch.
- `isCurrent()` to check request generation, account record and session.
- `commit(callback)` for a synchronous UI change only while current.
- `render(items, options)` using the shared feed renderer with an ownership guard.

The shared renderer checks ownership before changing the container and again after
awaited item normalization, so an old item cannot be appended to a newer feed.
Context-aware handlers can set `supportsRequestContext: true` to receive the same
context in their feed actions. These actions must return/await their loading
promise. Existing handlers retain their zero-argument actions, including bound
functions whose other arguments must not be replaced by a context object.

Initialization disables feed buttons until completion. The controller handles
rejections from awaited feed actions; obsolete failures are suppressed. Existing
services that catch/display errors themselves retain that legacy behaviour.

## Current limit and next step

**This boundary does not yet make every service response safe from late rendering.**
A legacy service can still read its own shared current-account variable or write
to the DOM directly after a fetch. It must adopt the captured account/context and
return its load promise before the controller can guard those writes. Aborting
is cooperative; a signal does not cancel requests that ignore it.

LocalRSS item/feed lists and their pagination now use explicit captured
account/filter/offset inputs, data-returning operations and guarded rendering.
Other services, legacy search providers, annotations/collection-reader internals and
service-specific status/database-management actions still require their own review. Do not equate this
first central boundary with completion of the reader refactor.

## Verification

Run `node --test tests/reader-controller.test.cjs` and the full Node suite.
Open `/tests/reader-boundary.browser.html` through a local server for a fixture
using the real Read/menu view, shared renderer and mocked service requests.
The first implementation passed 231 Node tests and this browser fixture in the
ChatGPT in-app browser on 2026-11-14. No live service accounts were tested.
See [Testing CList](testing.md) for setup and reporting conventions.


## LocalRSS migration

The LocalRSS reader opts into request contexts for initialization, Unread, All,
Bookmarked, Feeds and Refresh. Its split is service-specific:

| Module | Responsibility |
|---|---|
| `localrss_requests.js` | Explicit account/endpoint/database/filter/offset, auth headers and signal; returns item/feed/statistics data or throws, with no UI/global account reads |
| `localrss_reader.js` | Resolve/capture the endpoint, coordinate guarded loads and continuations, maintain safe pagination state and optional audio-icon metadata |
| `localrss_view.js` | Normalize/render content, empty messages, playlists, loader state and retry controls |
| `localrss_options.js` | Captured Options panel lifetime, statistics sequencing and Mark all as read controller |
| `localrss_options_view.js` | Options shell, connection/database/Show controls, statistics and visible feedback |
| `localrss.js` | Registry/schema, local-first resolver and legacy search/feed editing/import/export |

Endpoint resolution retains the existing local-first/launcher-proxy/remote policy.
It operates on a detached account and caches only for that account and captured
session. A late probe cannot switch the active account or initiate its obsolete
item request. Configured service URLs are not replaced in saved account metadata.
Auth headers, filter and page offset are captured before asynchronous work.

`CList.state.localrssReading` owns kind/filter/offset. Legacy module variables
mirror successful commits for existing options/actions. Offset advances only
after a successful current-page result. Load more uses `context.next()` to create
a fresh guarded generation; old or duplicate callbacks do nothing. A failed page
retains its previous offset and offers an explicit same-page retry. Refresh keeps
Feeds as a feed list rather than silently changing back to items.

Rendering, empty results, playlist updates and loader cleanup are guarded. Obsolete
items cannot append audio or replace another account/filter's feed. Normalization
uses the captured account for feed attribution. Legacy options callbacks that
reload a list use `reloadReader('LOCALRSS', action)` to obtain a new owned context;
their database mutations remain outside this migration.

Background audio-majority metadata uses the actual account-record key and captured
credentials; it checks ownership before encryption/storage/reconciliation. It
stores only the original account fields plus hasAudio, not transient resolved
endpoints. `context.updateAccount()` reconciles an owned metadata update so it
does not invalidate its own reader session. Metadata failure is separate from
successful feed loading. The shared context also exposes its account key.

LocalRSS coverage is in `tests/localrss-reader.test.cjs` and
`tests/localrss-reader.browser.html`. The latter passed in the ChatGPT in-app
browser on 2026-11-14 with all service requests mocked. Live deployed LocalRSS
behaviour and account authorization were not exercised.


UI-only menu actions can declare `uiActions` on their handler. LocalRSS declares
Options this way: opening an overlay does not replace the current logical feed
or invalidate its pagination. The Options Show filter starts an explicitly named
reader reload, including Read, so Refresh preserves that filter. Legacy mutation
operations inside the overlay remain outside this migration.

The completed LocalRSS step passed 245 Node tests; the updated browser fixture
also passed with mocked requests. This is separate from testing a live service.

## LocalRSS read and bookmark actions

`localrss_actions.js` binds rows to transient detached account/endpoint, entry ID,
auth headers, selected-account/session ownership and filter. The explicit
`toggleLocalrssEntry` operation in `localrss_requests.js` returns a validated
boolean or rejects; button rendering, row removal and errors belong to
`localrss_view.js`. No toggle reads the shared current account.

Buttons remain valid on earlier pages after Load more. Account/session changes
or replacement of the list invalidate them. Duplicate clicks on a pending action
send one write. Late results/errors cannot alter a newer list. Accepted read
changes update the icon while keeping rows visible for toggling back. Unread or
Refresh reloads the unread filter and hides read entries. Removing a bookmark
removes rows from Bookmarked.
A failed or uncertain response restores the control without automatically repeating
the toggle. Search and Show posts also capture targets for their row buttons;
their broader loading/options workflow remains legacy.

The reader context's `isAccountCurrent()` checks selection/session ownership
independently of page request generation. It must be combined with service-owned
row lifetime checks; it does not authorize arbitrary stale rendering.

## Bundled backend responsiveness

`localrss_bundled/app.py` uses `HARVEST_LOCK` to serialize harvest jobs and
`DB_WRITE_LOCK` for short per-feed commits and retention. Automatic, manual and
single-feed harvesting must not hold the database lock while fetching feeds.
Read/bookmark changes can therefore finish between feed results. Completed feeds
remain committed if a later feed fails. This backend fix needs a service restart;
it does not update a separately deployed remote LocalRSS instance.

## LocalRSS Options, statistics and Mark all as read

Options captures its resolved account/database, authentication and selected-account
ownership before asynchronous work. Opening it preserves reader pagination. Closing,
replacing, switching accounts or changing session invalidates its callbacks. Statistics
requests carry a panel sequence so an older result cannot overwrite newer counts.
Mark all confirmation captures the original target, checks panel ownership again before
sending, blocks duplicate writes and never automatically retries uncertain responses.
Write success is reported separately from statistics/list refresh failure. The list
reloads only if it is currently the unread item view; other filters and Feeds stay put.
The database picker selects by record key; reconnect and switching rebuild only the
owned panel. OPML import/export and account creation use the separate OPML modules described below.

## LocalRSS post search and feed posts

Post search and both Show posts entry points now use the same guarded loader,
explicit transport and view as normal item lists. `CList.state.localrssReading.selection`
contains only the search term or feed ID/title; credentials remain in transient
reader captures. Each search/feed action starts a new reader request generation.
Refresh repeats the captured selection, including after failure; normal filters
clear it. These views preserve the existing maximum 1,600-item single response
(no Load more), across stored posts regardless of read state/retention. Row actions
use the all filter, so unbookmarking does not remove a search/feed result.
Feed-list Show posts buttons use transient numeric bindings instead of interpolated
titles in inline JavaScript. Replacing the list or switching accounts invalidates
those callbacks. The editor Show posts binding checks its captured Options lifetime
and feed identity; feed management now uses its own captured controller and view.
Search feedback updates only its original, current panel and request. Feed rendering,
audio, empty results, errors and loaders use the shared reader guards.

## LocalRSS feed management and cache

`localrss_feeds.js` owns discovery/create, client-side Find/update filtering, editor
loading, Save, Retry and Delete confirmation. `localrss_feeds_view.js` owns their
controls, captured input reading and feedback; `requestLocalrssFeed` provides explicit
transport in `localrss_requests.js`. Feed lists are cached per Options binding, which
already captures the resolved endpoint, database, authentication and account/session.
Concurrent lookups share one read. Search/editor sequences suppress older responses
and callbacks; closing/replacing Options or changing accounts/session invalidates them.
Writes capture feed ID and fields before awaiting, suppress duplicates and do not retry
uncertain outcomes. Cache generations are invalidated before and after every attempted
write, so an older list read cannot repopulate the cache. OPML retains a compatibility
invalidation entry point but its overall workflow remains legacy.
Save/Retry completion never overwrites newer form fields. Late editor/write results
cannot change a newly selected editor. Delete confirms one captured editor and checks
that ownership again before sending. Accepted writes and subsequent statistics/list
refresh failures are separate outcomes. No credentials are stored in shared reader state.

## LocalRSS OPML and account creation

`localrss_opml_requests.js` handles explicit multipart imports and blob exports.
`localrss_opml.js` captures Options/form lifetime, service/database, file/mode/name
and authentication before awaiting. `localrss_opml_view.js` owns scoped inputs,
feedback, file clearing and downloads' controls. Duplicate import/export clicks
are suppressed. Late results, errors and downloads cannot affect a replaced panel
or changed account/session. Import attempts invalidate feed cache generations;
successful merge/replace also expires the captured feed editor while retaining text.

New-database success retains a receipt independent of the subsequent account save.
The optional confirmation and Create account recovery control use that receipt;
neither repeats the OPML import. Account creation uses shared `saveAccount` and
`loadAccountRecords`, reads current keys before choosing a suffix, reconciles an
existing matching service/database, and serializes its own account creations.
It persists the captured configured service URL, never a transient resolved endpoint.
Acknowledged saves are retained even when account-list refresh fails, so retry
refresh does not write again. A later explicit recovery first reads saved records
to reconcile an earlier uncertain write. Owner/session guards are checked before
encryption and KV persistence. These are client guards, not a server-side atomic
reservation of account keys against other clients.

The optional Add Account seed control captures its exact form and controls, uses
that form's explicit service URL and only fills the database if those original
values remain unchanged. It reports the created database when newer edits are kept.
Seeding does not save an account; the normal Save button still owns persistence.

## Find/search boundary

`find-state.js` owns plain draft/query/provider/request state. `find.js` owns
provider registry dispatch, captured query/session/feed target, duplicate request
suppression and operation lifetime. `find-view.js` builds controls and uses the
existing progressive feed renderer. `playFind`, `findPanel` and `finderString`
remain compatibility functions; the query now comes from input events/state,
not a later DOM lookup. Opening Find starts a fresh input as before. Editing the
query during a request does not alter that captured request or pagination.

Providers opt into `supportsFindContext: true` and `search(query, context)`.
OpenAlex and Wikimedia Commons pass the signal to fetch, guard errors/empty
results and use `context.render` with the renderer's per-normalization ownership
checks. Pagination retains the captured query and expires old controls. Failed
continuations permit an explicit same-page retry without an automatic request;
an empty continuation retains earlier results and removes Load More.

Find invalidates account reading through the existing reader lifetime. Starting
an account/feed request or changing session/provider/feed target expires Find
results. Closing/replacing the Find panel expires its controls while owned feed
pagination remains usable. A late obsolete completion cannot reset a newer
request's busy state. Token expiry cleans up the old pending state; editing the
live input rebinds a subsequent explicit search to the current session.

Google, DuckDuckGo and OASIS now opt into `search(query, context)`. Explicit
service request functions receive query, signal and transport dependencies; the
controllers own feedback and use the shared progressive renderer. Direct calls
without context do not start requests. No-argument third-party compatibility
remains in the Find dispatcher. Their listing controls use callback bindings in
`search-provider-view.js`; no target state is inferred from inline handlers.

Google captures the configured account record and credentials after account
loading, validates that record before reads/commits, and retains it with the
original query for pagination and Web/Images navigation. Paging uses the API's
next start index, with the legacy ten-result fallback when absent. Old menu
callbacks cannot navigate a newer query; duplicate pending mode clicks are
suppressed. Empty continuations retain earlier rows. Failed pages permit explicit
retry through the original control without automatically repeating the request.
Credentials are neither logged nor copied into listing/reference data.

DDG recursively retains every nested topic and parses Result HTML as detached
text, with Text/URL fallback. Abstract content retains escaped full text. OASIS
captures proxy headers before transport, encodes the nested query URL, rejects
HTTP failures and keeps HTML parsing separate from request/render operations.
Its existing result-card format remains supported; no new paging protocol is
inferred from the HTML. Empty results and current failures are visible; stale
responses and errors cannot overwrite a newer Find/account/session selection.

## Service readers and row actions — 2026-11-20

Mastodon uses `mastodon_requests.js`, `mastodon_reader.js`, `mastodon_actions.js`
and `mastodon_view.js`. Bluesky uses `bluesky_requests.js`, `bluesky_reader.js`
and `bluesky_view.js`. Read transport accepts captured accounts/sessions, selection,
cursors and abort signals; controllers retain operation ownership. Views render
menus, forms, row controls and feedback. Mastodon pagination validates cursor
origin; Bluesky retains opaque cursors. Bluesky authenticates the selected account,
not the first matching account. Tokens remain outside shared reader state.

`context.next(load)` owns pagination. `context.navigate(load, feedName)` owns new
feeds/threads selected by live earlier-page rows. `isCurrent()` guards read results;
`isAccountCurrent()` lets connected earlier-page actions survive pagination. Account,
session and replaced-row guards still expire those actions. Initial selection skips
registry `uiActions` and Refresh so a reading view opens first.

The shared renderer passes a private `rowContext` as a rendering option, never in
normalized items, serialized references or persisted accounts. `bindRow(item, row,
context)` attaches service controls after row construction. Use the outer
`.service-status-actions` host; expanded content has its own `.status-actions`.
Common Collect/Share/Write-about controls are appended after service binding and
retain their own connected-row guards. Like/repost/read/bookmark state lives in
captured operation bindings, not HTML attributes. Failed uncertain toggles are
never automatically replayed. Removed row controls cannot send new writes.

Mastodon/Bluesky Post and Reply capture account, target and form lifetime. Pending
and stale submissions are rejected; failure and newer text are preserved. Mastodon
checks its optional `assertCurrent` again after limit preparation before POST.
These client guards cannot cancel a remote write already sent.

Discord uses `discord_reader.js` / `discord_view.js` with an explicit captured
channel and bridge headers. Public feeds use `public-feed-requests.js`,
`public-feed-reader.js` and `public-feed-view.js`: picker lifetime, private database
headers, partial changelog failures and accountless public selection are guarded.
`captureReaderSurface(mode)` shares reader/session invalidation with public and
annotation feeds without putting credentials in shared state.

Annotations use `annotate_requests.js`, `annotate_reader.js` and `annotate_view.js`.
Discovery caches are scoped to the captured session. Thread Back restores the
parked feed only while its original reader remains current. Batch counts/follow
controls capture exact nodes/references before awaits, reject replaced nodes even
with the same ID, and preserve live earlier-page actions. Follow persistence uses
explicit dependencies and no automatic write retries. Flow continues through the
existing captured annotation publishing workflow; partial read failures stay visible.

LocalRSS now attaches its row controls in `localrss_row_view.js`, retaining the
existing explicit action transport/bindings and earlier-page behavior. Audio
indices and feed selections are callback captures rather than inline JavaScript.

Browser fixtures for this stage are prepared for user execution; Node results
are separate evidence. Initial OAuth, identity/admin setup, service editor mounting,
collaboration and AI feature workflows remain separate refactoring stages.


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
