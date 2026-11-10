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

## Limitations

One 1280 x 720 slide, text boxes, move/resize, duplication, bold/italic, and
snapshot import/export. No slide deck management, images, PPTX conversion, or
collaboration sharing management UI. Concurrent geometry edits resolve through
Yjs. Local edits are held in memory until saved or exported.

Source is MIT licensed; see LICENSE.

## Shape and layout catalogs

`catalogs/shapes.json` defines SVG shapes; `catalogs/layouts.json` defines reusable
slide layouts. CList fetches them when mounting Slides, so adding definitions does
not require editor code changes or a JavaScript rebuild. Reload CList after edits.
See [CATALOGS.md](CATALOGS.md) for schemas, examples, and portability rules.

Choose **Save → Save slide as layout** in CList to save the current slide as a
personal reusable layout. It appears under Saved layouts in the layout picker
and is restored from local CList storage when Slides opens.

## Presenter view

Click Presenter view to open a separate window with current/next slide previews,
speaker notes, navigation, and an elapsed timer. Keep it on the presenter screen
and use Present for the audience window. Notes remain hidden in presentation
mode. Arrow keys navigate in either window; Escape ends the presentation. The
timer runs while presenting, pauses on exit, and has a Reset timer control.
Allow pop-ups for CList if the presenter window is blocked.
