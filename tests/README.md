# CList architecture regression tests

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
