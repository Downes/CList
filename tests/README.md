# CList architecture regression tests

Run commands from the repository root.

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

The mocked WordPress browser test also checks the controller's use
of the real success renderer. No live publication is required.

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
