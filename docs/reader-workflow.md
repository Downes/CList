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
Other services, search, annotations/collection-reader internals and
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
