# CList Slides

Browser slide editor with collaborative Tiptap text, images, SVG shapes, reusable layouts, and Yjs state.

## CList integration

Choose **Slides** in CList's editor picker. The editor mounts directly in a div,
starts locally, and retains its state when switching to another editor and back.
Local editing does not require login. Use CList's Save, Post, and Load controls.
Loading a snapshot replaces the presentation and requires disconnecting first.

Connect uses the configured Collab account (or CList's default server), the current
CList login token, and the current kvstore URL. Log in before connecting. A short
document name is expanded using CList's identity namespace plus `slides/`; a full
namespaced name can be pasted to open a shared document. Connecting merges local
edits with server state, so use a new document name for an independent slide.

`js/slides.js` registers the editor. `clist.js` supplies CList authentication and
loads the shared vendored Tiptap/Yjs/Hocuspocus bundle. `src/editor.js` exports
`createSlideEditor(container, options)` and accepts dependencies from its host;
it does not bundle a second Yjs runtime into CList.

The instance exposes `snapshot()`, `loadSnapshot(snapshot)`, `connect()`,
`disconnect()`, `destroy()`, and `document` / `connected` getters. Snapshot MIME
type: `application/vnd.clist.slides+json`; snapshot format: `clist-slides-yjs-v1`.

## Build and standalone demo

Run `npm install` once for development tools. `npm run build:embed` rebuilds
`dist-embed/editor.js` and `dist-embed/editor.css`. CList serves those static files;
no npm or build process is needed at runtime.

`npm run dev` starts the standalone demo. `npm run collab` starts an optional
local demo server on port 1234; it has no authentication or persistent storage.
`npm run build` builds the standalone demo. The demo uses its own dependencies;
CList uses `js/vendor/collab-editor-bundle.js`.

## Selecting and organizing slides

Click a slide thumbnail to select it. Ctrl-click (Cmd-click on macOS) adds or
removes individual slides; Shift-click selects a range from the selection anchor.
The green outline marks the slide displayed on the canvas; blue borders mark
all selected slides. The existing slide label shows the selection count.

Duplicate, Delete and the up/down arrows act on the selected slides. Duplicates
are inserted together after the last selected slide, in their original order,
including rich text, images, shapes, groups, locked objects, notes and backgrounds.
Drag any selected thumbnail to move the selection together. The arrows move each
selected slide past its adjacent unselected slide; selected slides keep their
relative order. Each batch operation is one undo step. Delete asks for confirmation
and always leaves at least one slide in the presentation.

With focus in the thumbnail rail, Ctrl/Cmd+A selects all slides, Escape returns
to the active slide, and Shift+Up/Down extends the selection. Alt+Up/Down moves
the selection; Delete opens the standard delete confirmation.

Thumbnail buttons and previews are reused across edits, preserving focus,
selection and rail scroll. Text, geometry and background changes redraw only
affected slides; notes and reordering do not rebuild preview content. Moving an
object between slides refreshes both previews. Theme changes and snapshot loads
refresh the whole deck. See `tests/slides-thumbnails.browser.html` for the
200-slide browser regression test.

## Find and Replace

Use the toolbar’s **Find and replace** icon, or press Ctrl/Cmd+F while focused in
Slides. Ctrl/Cmd+H focuses the replacement field. The existing inspector opens
the search controls; no message strip is added above the canvas.

Search literal text across all slide text boxes, with optional Match case and
Whole words. Results identify the slide and show nearby text. Click a result or
use Next/Previous to open its slide and select the exact text. Enter/F3 finds the
next match; Shift+Enter in Find or Shift+F3 finds the previous match. Escape in the
search controls closes the section. The list shows the first 100 results, while
navigation visits every match.

Replace changes the selected match; Replace all changes every editable match in
one undo step. Locked text boxes remain searchable but are skipped by replacement.
Replacements retain the first matched character’s formatting and leave surrounding
text, links and paragraph/list structure intact. Empty replacement text deletes
the match. Speaker notes and image descriptions are outside this search scope.
Find and Replace is disabled in presentation mode, and rechecks live document
content before making changes. Tests are in `tests/slides-find-replace.test.cjs`
and `tests/slides-find-replace.browser.html` at the repository root.

## Local recovery

CList automatically saves a separate local recovery copy after edits, including
images, speaker notes, themes and references. Saving starts after 1.5 seconds of
inactivity, or every 15 seconds during continuous editing. Returning to Slides
after a reload offers saved copies with Restore and Delete recovery copy controls.
Restoring preserves any current edits in their own recovery copy first. Recovery
does not connect to collaboration automatically; disconnect before restoring.
Each editing session gets an independent copy, and revision conflicts fork a new
copy to protect work in other tabs. Named Save remains separate.

Recovery serialization runs in a background worker, which receives incremental
Yjs edits after its first snapshot. Repeated saves avoid rebuilding and base64
encoding the whole presentation on the editing thread. The initial worker setup
still copies the document once; IndexedDB also needs to copy the saved content.
Include `dist-embed/assets/` when deploying the editor bundle.

Routine recovery runs silently, without a status strip above the editor. Recovery
choices open in CList’s standard dialog and can be reopened with **Load > Recover
slides**. Restore/delete confirmations use CList’s transient status message;
failures use its error modal. Leaving the page with pending changes triggers the
browser's unsaved-work warning.
The most recent edits can still be lost in a sudden crash before a save finishes.
Recovery is local to this browser and origin; clearing browser data removes it.

## Limitations

Slides use a fixed 1280 x 720 canvas. Collaboration sharing management UI is not
implemented. Concurrent geometry edits resolve through Yjs.
The standalone demo holds local edits in memory; automatic recovery uses CList's
PageStore and is available in the integrated editor.

Source is MIT licensed; see LICENSE.

## Shape and layout catalogs

`catalogs/shapes.json` defines SVG shapes; `catalogs/layouts.json` defines reusable
slide layouts. CList fetches them when mounting Slides, so adding definitions does
not require editor code changes or a JavaScript rebuild. Reload CList after edits.
See [CATALOGS.md](CATALOGS.md) for schemas, examples, and portability rules.

Choose **Save → Save slide as layout** in CList to save the current slide as a
personal reusable layout. It appears under Saved layouts in the layout picker
and is restored from local CList storage when Slides opens.

## PDF export

In CList choose **Save → Export slides as PDF**. A separate print view contains
the whole presentation in slide order. Click **Print / Save as PDF**, then choose
Save as PDF in the browser dialog. Use all pages, no margins, disable headers and
footers, and enable background graphics. The view requests 16:9 landscape pages;
browser or printer paper settings can override this. Text, images, SVG shapes,
colours and rotation use the read-only presenter renderer. Speaker notes and
editing controls are excluded. Styles, fonts and images load before printing is
enabled. Allow pop-ups for CList. Export works locally without login or a server.

## Standalone HTML export

Choose **Save > Export slides as HTML** to download one self-contained `.html`
file. It includes the slides in order, embedded images, inline SVG shapes, slide
styles and browser navigation. Open it directly from disk or host it as a web
page; no CList, external scripts, stylesheet downloads or login are required.
Speaker notes, recovery copies, editing controls and the editable Yjs snapshot
are excluded. Fonts use those available on the viewer’s computer.

Previous/Next, arrow keys, Page Up/Down, Space and Home/End navigate the slides.
The viewer fits a 16:9 slide to the window, supports full screen where available,
and uses `#slide-N` links when opened as a file or ordinary web page. Printing
includes every slide, one page per slide. Without JavaScript, all slides remain
visible as a scrolling document. A broken image stops export rather than producing
an incomplete download.

**Post > To Web Page** publishes this viewable HTML through CList’s existing web
publisher. Normal Save and local recovery retain the editable CList presentation.
The editor’s optional `getPublishContent()` hook supplies the HTML MIME type and
content specifically for web publishing and republishing.

Tests: `tests/slides-html-export.browser.html` and
`tests/web-page-content.test.cjs` at the repository root.

## Publishing a slide-by-slide article

**Post > select an account > Publish** uses a readable article version of Slides.
Each slide becomes a section with a numbered heading. Text boxes follow reading
order (top to bottom, then left to right), retaining basic headings, paragraphs,
emphasis, lists and links. Photos remain ordinary images, cropped where needed;
vector diagrams become PNG images so services do not need SVG support. Absolute
positioning, viewer scripts, page styles, speaker notes and editable slide data
are excluded. Blog themes control article typography and layout.

For WordPress, embedded images are uploaded through its media API and replaced
with ordinary image URLs before the post is submitted. Repeated images upload
once per post, with alternative text preserved. Failed uploads stop submission
and show the server’s error details. Existing posts are not changed by this code
update. Other account publishers receive the same simple article HTML through
the optional editor `getPostContent()` hook; native saves remain unchanged.

The end-to-end mocked WordPress test is
`tests/slides-article-wordpress.browser.html` at the repository root.

## PowerPoint export

In CList choose **Save > Export slides as PowerPoint** to download a `.pptx` file.
Export preserves slide order, backgrounds, object positions and rotations,
editable text with basic rich formatting, hyperlinks, lists, and speaker notes.
Standard rectangles, circles/ellipses, and lines remain editable shapes. Custom
SVG geometry is exported as an image, with a message after downloading.
Images remain picture objects; their current crop and fit are baked into embedded
PNGs. Group members are exported as individual objects. System fonts map to Arial;
fonts and text wrapping can differ between presentation applications.

Export captures a copy of the deck before loading assets, leaves the working
document unchanged, and stops with an error if an image cannot be prepared.
It uses self-hosted PptxGenJS 4.0.1 (`js/vendor/pptxgen.bundle.js`), loaded only
on demand, and requires no login, CDN or export server. The vendor file is the
unmodified distribution bundle; see `js/vendor/pptxgen.LICENSE` and
`js/vendor/pptxgen-jszip.LICENSE` for licenses. No npm install is needed to run it.

The browser regression test is `tests/slides-powerpoint.browser.html` (relative
to the repository root). Serve the repository locally and open that page, or run
it in Chrome with `--headless --allow-file-access-from-files --dump-dom` and a
virtual time budget. Its result appears in `body.dataset.result`.

## PowerPoint import

Open Slides and choose **Load > Import PowerPoint**, then select a `.pptx` file.
The imported slides are added after the current presentation and selected for
editing. Existing slides remain intact; one Undo removes the entire import.
Normal **Load from file** also recognizes `.pptx` files and routes them to Slides.
Legacy `.ppt` files and strict OOXML presentations are not supported; save them
as a standard `.pptx` first.

Import reads presentation order, editable text with bold/italic/underline/strike,
safe external hyperlinks, lists, embedded PNG/JPEG/GIF/WebP pictures, basic preset
shapes, solid backgrounds and plain-text speaker notes. Placeholder positions and
styles can inherit from layouts and masters; theme colours are resolved. Grouped
objects are flattened into individual editable objects. Pictures retain their
appearance through embedded PNGs when cropping, stretching or mirroring is needed.
Slides with another aspect ratio are centred and fitted onto the 16:9 canvas.

A report lists unsupported or simplified content, including charts, tables,
SmartArt, custom vector geometry, unsupported image formats, linked pictures,
animations, transitions and some text styling. No linked images are fetched.
Each CList text box uses one font, size, colour and alignment, so mixed styles in
those properties use the first text style; inline emphasis and links remain.
Missing or corrupt required parts stop the import before existing slides change.
Imports require local editing (disconnect collaboration and exit presentation
mode first). Limits are 100 MB compressed, 300 MB unpacked and 500 slides.

No upload or extra dependency is needed: import uses JSZip from the self-hosted
PowerPoint bundle. The browser regression test is
`tests/slides-powerpoint-import.browser.html` at the repository root.

## Presenter view

Click Presenter view to open a separate window with current/next slide previews,
speaker notes, navigation, and an elapsed timer. Keep it on the presenter screen
and use Present for the audience window. Notes remain hidden in presentation
mode. Arrow keys navigate in either window; Escape ends the presentation. The
timer runs while presenting, pauses on exit, and has a Reset timer control.
Allow pop-ups for CList if the presenter window is blocked.
