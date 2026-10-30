# CList Write-Pane Editor Architecture

Editors are registered in a global `editorHandlers` object defined in `editors.js`. Each key is the editor's internal identifier (e.g. `'texteditor'`, `'tinymce'`, `'etherpad'`, `'collab'`, `'latex'`). New editors add themselves by registering their handler at load time.

---

## Registering an editor

Each editor lives in its own `.js` file and registers itself in an IIFE so it doesn't pollute the global scope:

```javascript
(function () {
    editorHandlers['myeditor'] = {
        label: 'My Editor',
        icon: 'edit',
        contentTypes: ['text/html'],
        requiresAccount: false,
        initialize: () => { /* ... */ },
        getContent: () => { /* ... */ },
        loadContent: ({ type, value }, itemId) => { /* ... */ }
    };
})();
```

The script tag for the new file goes in `index.html` alongside the other editor scripts (`tinymce.js`, `etherpad.js`, `collab.js`, `latex.js`).

---

## Required handler fields

| Field | Type | Description |
|-------|------|-------------|
| `label` | `string` | Human-readable name shown in the editor switcher (e.g. `'HTML (TinyMCE)'`) |
| `icon` | `string` | Material Icons name shown beside the label (e.g. `'web'`, `'notes'`, `'group'`) |
| `contentTypes` | `string[]` | MIME types the editor's `loadContent()` can genuinely accept, in preference order. Use `['text/html']` for rich editors, `['text/plain']` for plain text, both for editors that handle either. Drives editor routing/matching in `loadSavedPage()` and `populateLoadOptions()`'s auto-switch — see below. An empty array means "accepts no generic content at all" (see note below), never a wildcard. |
| `requiresAccount` | `bool` | `true` if the editor needs a kvstore account with permission `'e'` (e.g. Etherpad). `false` for built-in editors. Account-backed editors only appear in the switcher when a matching account exists. |
| `initialize()` | `function` | Set up and show the editor DOM. See contract below. |
| `getContent()` | `function` | Return the current editor content as a string. May be `async`. |
| `loadContent({ type, value }, itemId?)` | `function` | Insert content into the editor. `type` is a MIME type string. `itemId` is the feed item DOM id, used to attach a reference (optional). |

### Optional handler fields

| Field | Type | Description |
|-------|------|-------------|
| `setContent(value)` | `function` | **Optional, local editors only** (`requiresAccount: false`, content held in the browser — e.g. `texteditor`, `tinymce`). Fully replaces the editor body with `value`, unlike `loadContent()` which inserts at the cursor/selection. Not implemented by service/collaborative editors (Etherpad, Collab, LaTeX, collection editor) — there is no sane "replace" semantics when other people's edits may be live in the document, so those editors are only ever offered Insert when routed through `loadSavedPage()` (below) or `_offerContentTransfer()` (manual switch — see below). |
| `isActive()` | `function` | `requiresAccount` editors only: returns `true` if there's a live connection to resume even without a matching saved account (e.g. an active guest Etherpad session). Lets the switcher and "Load blank" list offer a way back in without a saved account. Also used by `editorHasActiveContent()` in preference to `getContent()` for these editors, since "active" means "has a live connection", not "has text". |
| `visible()` | `function` | Returns `false` to hide this editor from the switcher/"Load blank" list entirely (e.g. not registered or logged in). |
| `formats` | `{id, label}[]` | Populates the `#write-format` `<select>` in the write-pane toolbar (shown only when non-empty). Used by the collection editor (`collection-editor.js`) for its export-format picker. |

### Required-field note — `contentTypes: []`

An empty `contentTypes` array (the collection editor) means "doesn't support generic
file/page content at all" — never a wildcard. It's excluded from every `contentTypes`-matching
path (`loadSavedPage()`, `populateLoadOptions()`'s auto-switch) and only ever reached through
its own structured My Collections flow.

---

## `initialize()` contract

`initialize()` is called by `initializeEditor(editorType)` in `editors.js`, which first hides all other editor divs. It must:

1. Set `currentEditor = 'myeditor'`
2. Create the editor DOM inside `#write-pane-content` if it doesn't exist yet; show it
3. Create a `#myeditor-references` div (class `allReferences`) after `#write-pane-content` if it doesn't exist
4. Call `loadPredefinedContent('myeditor')` to consume any content waiting in `pendingContent`
5. For **local editors** (not service-backed): wire up draft auto-save and offer draft restore — see Draft Auto-Save below

After `initialize()` returns, `initializeEditor()` automatically calls `updateEditorIndicator()` to update the command-bar label.

---

## Content flow — `pendingContent`

Content is passed into a newly initialized editor via the module-level variable `pendingContent`:

```
{ type: 'text/html' | 'text/plain', value: string }
```

**Set by:** `switchToEditor(editorType, carriedContent)`'s `carriedContent` parameter. Callers: `_offerEditorChoice()`, `loadSavedPage()` (switching-editor branch), the three transfer buttons in `_offerContentTransfer()` ("Insert" only — see below), and a few service files that deliver loaded file/URL content directly (`dropbox.js`, `collections.js`).

**Consumed by:** `loadPredefinedContent(editorType)` inside `initialize()`. It reads `pendingContent`, clears it, and calls `handler.loadContent(content)`. After this call `pendingContent` is always `null`.

If `pendingContent` is `null` when `initialize()` runs, the editor starts empty (or restores a draft — see below).

**Caution:** delivering content this way does **not** by itself clear the target editor's
parked page/references (see "Running per-editor state" below) — `switchToEditor()` restores
whatever was last parked for that editor *before* `pendingContent` is consumed. Callers that
load content unrelated to any previously-tracked page must call `setLoadedPage(null)` (and,
if appropriate, `clearReferences()`) themselves afterward, the way `loadSavedPage()` and
`_offerEditorChoice()` already do. `dropbox.js` and `collections.js`'s direct
`switchToEditor('tinymce'/'texteditor', { type, value })` calls (loading a dropped file or a
fetched URL straight into an editor) now do this too.

---

## Running per-editor state

Each editor keeps its own independent "page" and "references" state, so switching away from
an editor and back resumes exactly what was there before — switching editors no longer wipes
anything. This is tracked in `editors.js` by:

- **`editorStates`** — a plain object keyed by `editorStateKey(editorType, account)`
  (`` `${editorType}:${account.key}` `` for account-backed editors, so two different accounts
  on the same editor type — e.g. two Etherpad logins — get separate entries; otherwise just the
  bare `editorType`). Each entry holds `{ page, references }`. **In-memory only** — lost on
  reload, same as `currentEditor`/`currentLoadedPage` always have been.
- **`_parkCurrentEditorState()`** — snapshots `currentLoadedPage` and the current references
  list (`getReferences().slice()`) into `editorStates` under the *outgoing* editor's key.
- **`_restoreEditorState(editorType, account)`** — looks up the *target* editor's entry and
  calls `setLoadedPage(parked.page)`, or resets it to `null` if the target has never been
  visited. For references, it defaults to `setReferences(parked.references)` (or `[]` if never
  visited) — **unless** the target handler is a live collaborative editor, in which case it
  calls the handler's `resyncReferences()` instead of trusting the parked snapshot. See
  "Collaborative editors: per-document reference resync" below.

Both are called from inside `switchToEditor()` itself (park the outgoing editor, then restore
the target) — see below. Callers that want to set a specific page right after switching
(`loadSavedPage()`, `_offerEditorChoice()`) call `setLoadedPage()` again immediately afterward,
overriding whatever got restored.

### References are a single global list, swapped on switch

`references.js` was **not** rearchitected to be per-editor-aware — `window.CList.state.references`
and the `#clist-references-panel` DOM stay a single global array/panel, exactly as before. The
eight existing call sites of `pushReference()`/`getReferences()`/`clearReferences()`
(`tinymce.js`, `ui.js`, `publish.js`, `hypothesis.js`, `dynamicp2p.js`, `annotate.js`,
`collab.js`, `collections.js`) are untouched and have no editor-awareness at all. Instead,
`editors.js` swaps the array's *contents* wholesale via a new function:

```js
setReferences(list)   // references.js — replaces window.CList.state.references,
                       // re-renders the panel, shows/hides the References button
```

So "per-editor references" works by park/restore swapping the same single list in and out as
you switch editors — not by maintaining N separate lists live at once. On top of that,
`loadSavedPage()` and `offerReplaceOrInsert()` (2026-10-30) explicitly call
`setReferences(page?.references || [])` — or, for Insert, merge via `pushReference()` — whenever
they land content from a `page` record that itself carries a `references[]` array (e.g. a page
saved to "CList (IndexDB)" via `page-store.js`, which now persists `references` alongside
content). So a **page** switch *within* the same editor now does restore that page's own saved
references, as long as it goes through `loadSavedPage()`; a bare `setContent()`/`loadContent()`
call from somewhere else that bypasses `loadSavedPage()` still won't touch references on its own.

### Collaborative editors: per-document reference resync

Collab and LaTeX layer a second mechanism on top of the park/restore swap above, because they
have a problem park/restore can't solve alone: their Hocuspocus connection (and the Yjs
`clist_refs` `Y.Map` it syncs) **stays alive in the background** after the user switches to a
different editor — it's only torn down when `connectToDoc()` opens a *different* document in
the same editor. While a document stays open elsewhere, its Map keeps changing as other people
edit it, so a snapshot parked at switch-away time can go stale the moment anyone else touches
that document's reference list.

Both `collabHandler` and `latexHandler` expose two extra methods for this:

```js
getDocId: () => currentDocId,          // the doc currently connected, or null/undefined
resyncReferences: () => {
    setReferences([]);
    sharedRefs.forEach((jsonStr) => { /* pushReference(JSON.parse(jsonStr)) */ });
},
```

`_restoreEditorState()` calls `resyncReferences()` instead of restoring the parked snapshot
whenever `getDocId()` reports a live connection — rebuilding the global reference list directly
from the Map's current, authoritative state rather than a point-in-time copy.

Two more pieces keep this correct:

- **Reset on connect** — `connectToDoc()` calls `setReferences([])` before building the new
  `Y.Doc`, so connecting to a *different* document (same editor) starts clean instead of
  carrying over the previous document's references; the sync that follows repopulates the list
  from that document's own `clist_refs` Map.
- **Observer gated to the visible editor** — `sharedRefs.observe()`'s callback only calls
  `pushReference()` when `currentEditor` matches that handler (`'collab'` or `'latex'`). Without
  this guard, a Collab doc and a LaTeX doc connected at the same time would both keep writing
  into the single global reference list regardless of which one is actually on screen.

This only applies to Yjs-backed collaborative editors. **Etherpad has no equivalent** — it's a
cross-origin iframe embed of an external server with no CRDT/push channel and no live DOM
observability, so each collaborator's references stay purely local with no way to reconcile.
Documented as a deferred known limitation in `/srv/TODO.md`; see "Known gaps" below.

### Manual switch: content-transfer prompt

The editor-switch picker (`_populateBuiltInEditors()` / `_populateAccountEditors()`) routes its
button clicks through `_switchToEditorFromPicker(editorType, account)` instead of calling
`switchToEditor()` directly:

- If the outgoing editor has no content worth asking about (`editorHasActiveContent()`
  returns false), it switches straight through — no prompt.
- Otherwise it calls `_offerContentTransfer(targetKey, account)`, which renders into the
  editor-switch overlay: **Overwrite** (only if the target has `setContent`) replaces the
  target's content *and* references with the source's; **Insert** (only if the target has
  `loadContent`) appends the source's content at the cursor and **unions** references
  (deduped by `url`, the same rule `pushReference()` uses); **Don't transfer** switches with
  no content change, leaving whatever `_restoreEditorState()` resumed for the target intact;
  **Cancel** reopens the picker without switching.

This prompt is deliberately scoped to the picker only. Forced, content-type-driven switches
(`_offerEditorChoice()`, `loadSavedPage()`'s switching-editor branch, `_doLoadBlank()`) call
`switchToEditor()` directly and skip it — in those cases the source editor can't even hold the
new content, so there's nothing to ask about.

---

## Content loading — `window.CList.loaders`

The Load button opens a right-pane list built from the `window.CList.loaders` registry — an **ordered array** of loader objects. The first service file that loads creates it (`window.CList.loaders = window.CList.loaders || []`), and each file pushes its own entries (e.g. `files.js`, `dropbox.js`, `chatgpt.js`).

### Registering a loader

Add an entry by pushing to `window.CList.loaders` from any `.js` file:

```javascript
(function () {
    window.CList.loaders = window.CList.loaders || [];
    window.CList.loaders.push({
        label: 'My Source',
        icon:  'source',            // Material Icons name, or set logoSrc for a masked SVG
        load:  async () => {
            // fetch or generate content…
            return { type: 'text/html', value: '<p>…</p>' }; // or null to cancel
        }
    });
})();
```

Entries appear in registration order. Built-in loaders are registered in this order:
`editors.js` → "Load blank", "Load template" · `files.js` → "Load from file" · `chatgpt.js` → "Generate template"

### Automatic editor selection

After a loader returns content, `populateLoadOptions()` checks whether the current editor's `contentTypes` covers the returned `content.type`. If not, it searches `editorHandlers` for the first non-account editor that does and calls `switchToEditor()` automatically — no confirmation needed for a lossless switch.

This means:
- Loading or generating an **HTML** file/template auto-switches to TinyMCE (or whichever HTML editor is registered first)
- Loading a **plain-text** file/template auto-switches to the plain-text editor
- `loadFile()` benefits from this too: loading an `.html` file picks TinyMCE; loading a `.txt` file picks the text editor

If no suitable editor is found (e.g. an unrecognised MIME type), the user is warned that HTML tags will be stripped and asked to confirm before loading into the current editor.

### Type-aware routing with a replace prompt — `loadSavedPage()`

`populateLoadOptions()` above is the generic flow: a loader returns content once, and
at most an automatic lossless editor switch happens. Some sources instead need to land
in a *specific* saved document identity (so a later edit is understood as "updating
this same page", not just "some content") and may need to ask the user how to combine
the incoming content with whatever the target editor already holds. For that case, call
`loadSavedPage(content, page)` directly instead of going through a loader:

- `content` — `{ type, value }`, same shape as everywhere else.
- `page` — the saved-page record (must carry at least `url` and `title`); passed through
  only to drive the "currently loaded page" indicator (see below), not interpreted
  otherwise.
- `renderTarget` — optional DOM element to render the New/Replace/Insert/Cancel prompt
  into if one is needed. Defaults to the right-pane load list
  (`window.CList.ui.view.loadOptions`); My Pages passes its modal body instead (see
  below), since that's where its own list is showing.

`loadSavedPage()`:
1. Finds editors whose `contentTypes` include `content.type`; keeps the current editor
   if it qualifies, otherwise picks the first non-account editor that does.
2. If the target editor isn't the current one, switches to it via `switchToEditor()`
   (which starts empty) and loads directly.
3. If the target editor is current and empty, loads directly.
4. If the target editor is current and **not** empty, calls `offerReplaceOrInsert()`,
   which renders a prompt into `renderTarget` with up to four choices: **New** (blank
   the editor via `setContent('')`, then load — only offered if the handler has
   `setContent`), **Replace** (`setContent(content.value)`, keeps draft/tag state —
   only offered if `setContent` exists), **Insert** (always offered — `loadContent()`,
   cursor-insert, mixed content), **Cancel** (re-opens the My Pages modal).

Whichever path completes an action calls `closeLoadSurfaces()`, which closes both the
right pane and the generic modal (`#generic-modal`) — harmless no-op for whichever of
the two wasn't open, so this works regardless of where the picker UI actually lives.

Currently used by: the "Load into editor" action on standalone pages in **Load → My
Pages** (`collections.js`), for pages published via Post → "To Web Page". My Pages
renders its own list (and, via `renderTarget`, the replace/insert prompt) inside a
wide centered modal — see **`showModal()` wide mode** below — rather than the
right-pane load list, since the list can get long and each row carries several action
buttons.

### `showModal()` wide mode

`showModal(content, opts)` (`interface.js`) is the app's generic modal — a full-screen
dimmed overlay (`#generic-modal`) centering a `#modal-content` box that sizes to fit
its content by default (`max-width`/`max-height: 92vw/92vh`). Passing `{ wide: true }`
adds the `modal-content--wide` class, which fixes the box at `80vw` × `80vh` instead of
shrinking to content — used for lists that need consistent room regardless of how many
items they hold. `content` can be a string (`innerHTML`) or a DOM element (appended).
Calling `showModal()` again replaces any modal already open.

Passing `{ hideDefaultClose: true }` skips `showModal()`'s own absolutely-positioned
plain-text "Close" button, for callers that render their own header/close UI instead
(e.g. the My Pages modal's `.modal-header-row` — see `docs/collection-publishing.md`).
Callers that pass no `opts` (`etherpad.js`, `collab.js`) are unaffected and still get
the default Close button.

### "Currently loaded page" indicator

When content lands via `loadSavedPage()` through the empty-editor path, or the New/
Replace choice in the prompt (not Insert, and not the generic `populateLoadOptions()`
flow) — or a collection is loaded into the Collection Editor from My Pages —
`setLoadedPage(page)` stores the **whole** My Pages row object (`{...page}`, not just
`{url, title}`): `kind` (`'page'`, `'collection'`, `'local-page'`, or `'file'`), `url`,
`title`, `serviceId`, `service`, `accountInstance`, `publishedAt`, and either `pageKey`
+ `mimeType` (standalone pages) or `collectionKey` + `format` (collections). A `'file'`
record (set when content is loaded from the local filesystem or Dropbox — see
`files.js`'s `restorePostContent()`, `dropbox.js`'s `_openInEditor()`) only ever carries
`kind` and `title` — never a publication-location field, by construction, since a
loaded file has nowhere to republish to. This is the record Republish and the Post-time
overwrite/new-version prompt both key off of.

`updateLoadedPageUI()` (renamed from `updateLoadedPageIndicator()`) shows/hides
`#loaded-page-indicator` (inside `#editor-state-row`, directly above `#write-title-row`
— see `docs/ui_components.md`'s "Current-editor-state bars" section) based
on whether `currentLoadedPage` is set at all, and **separately** toggles
`#republish-button`'s visibility based on whether `currentLoadedPage` actually carries a
publication location (`currentLoadedPage.service || .serviceId || .url ||
.publicationUrl`). These are two different conditions, not one unit: a `'file'` load (or
a `'local-page'` that has been saved locally but never published) shows the indicator
but not Republish, since there's `currentLoadedPage` data to display a label for but no
publication location to republish to.

**General principle:** any interface element whose state should depend on "does this
editor's content have property X" must check for the actual data field on
`currentLoadedPage` (the per-editor record in the Editor States Array — see "Running
per-editor state" above), not an ad-hoc `kind` comparison. `kind` is appropriate for
cosmetic/labelling choices only (e.g. the indicator's "Loaded file: …" vs. "Loaded: …"
text prefix), never for gating whether a feature is available. The Republish button is
the canonical example: it was originally gated on `kind !== 'file'`, which only happened
to work for the one case it was written for; checking for an actual publication-location
field instead also correctly handles the never-published `'local-page'` case, and will
keep handling any future `kind` that has no publish target without needing a matching
special case.

The indicator's label also shows the **publication URL** and **format** when known:
`currentLoadedPage.publicationUrl || currentLoadedPage.url` (the latter is set directly
on remote `'page'`-kind records; the former is stamped onto local-page records by
`publish.js` right after `recordPublication()` succeeds, since those records don't
otherwise carry a URL/format of their own) and `currentLoadedPage.format`.

Cleared (`setLoadedPage(null)`) by the "Load blank" loader (`_doLoadBlank()`) and by
the two collection load paths that pull in an *external* collection (not one of ours)
— the "Load from URL" dialog and `window.loadCollectionText`. **Not** cleared by
switching editors any more: `switchToEditor()` now *parks* the outgoing editor's page
(and restores the target editor's own previously-parked page, or `null` if the target
has never been visited) — see "Running per-editor state" above. Callers that need a
specific page set right after a switch (`loadSavedPage()`, `_offerEditorChoice()`) call
`setLoadedPage()` again immediately afterward to override whatever got restored.

### Republish button — `#republish-button` / `playRepublish()`

Shown next to `#post-button` whenever `currentLoadedPage` carries a publication
location (see "Currently loaded page" indicator above) — not merely whenever
`currentLoadedPage` is set. `playRepublish()`
(`js/publish.js`) dispatches the same way `playPost()` does: if
`currentLoadedPage.kind === 'collection'`, it calls `window.republishCollection()`
(`js/collections.js`); otherwise it republishes the standalone page directly via the
bin publisher's `update()` adapter method. Either path saves the current editor
content to the page's *existing* published URL — no new kvstore entry is created, and
no second published URL exists afterward. See `docs/collection-publishing.md`'s
"Republish, and overwrite vs. new version at Post time" section for the full
Post-time overwrite/new-version flow this feeds into.

---

## Save destinations — `window.CList.savers`

The Save button opens a right-pane list built from the `window.CList.savers` registry — an **ordered array** of saver objects defined in `publish.js` and extended by service files.

### Registering a saver

Add an entry by pushing to `window.CList.savers` from any `.js` file:

```javascript
(function () {
    window.CList.savers = window.CList.savers || [];
    window.CList.savers.push({
        label: 'Save to My Service',
        icon:  'cloud_upload',            // Material Icons name, or set logoSrc for a masked SVG
        save:  async () => {
            // fetch content via packagePost(), push to service, etc.
        }
    });
})();
```

Entries appear in registration order. The built-in saver is registered in `files.js`:
`files.js` → "Save to local file"

Account-backed savers (e.g. Google Drive, Dropbox) register here too; their `save()` function handles any account lookup internally.

---

## Drag-and-drop reference attribution

When the user opens an external page via `openInBrowser()` (any "Open in browser" button), CList stores a reference object for that URL in `window.CList._openedWindowRefs`. If the user then drags content from the popup into an editor, a `drop` event handler calls `window._attributeDroppedContent(url)`, which looks up the stored reference and calls `pushReference()` to add it to the references panel.

**Every editor must wire a `drop` listener** so that attribution works. The listener must be added in capture phase (`true` as the third argument) so it fires before the editor's own drag handling (which may call `stopImmediatePropagation`).

### Iframe-based editors (e.g. TinyMCE)

Add the listener to **`editor.getDoc()`** (the iframe's document), not the body, in `init_instance_callback`. The doc-level capture listener fires before any body-level handler TinyMCE may have registered:

```javascript
init_instance_callback: function (editor) {
    editor.getDoc().addEventListener('drop', function(e) {
        const dt = e.dataTransfer;
        if (!dt) return;
        const url = window._extractDropUrl(dt.getData('text/uri-list'), dt.getData('text/html'));
        window._attributeDroppedContent(url);
    }, true);
},
```

### DOM-based editors (e.g. TipTap / ProseMirror, plain textarea)

Add the listener to the **editor's container element** in capture phase. For a `<textarea>`, listen on the textarea itself; for TipTap, listen on the `#collab-editor-container` wrapper. Guard against re-wiring with a data attribute:

```javascript
if (!editorDiv.dataset.draftWired) {
    const editorEl = document.getElementById('my-editor-container');
    editorEl.addEventListener('drop', function(e) {
        const dt = e.dataTransfer;
        if (!dt) return;
        const url = window._extractDropUrl(dt.getData('text/uri-list'), dt.getData('text/html'));
        window._attributeDroppedContent(url);
    }, true);
    editorDiv.dataset.draftWired = '1';
}
```

### How attribution resolves the source

`_attributeDroppedContent(url)` (defined in `ui.js`) uses this priority:
1. **URL match** — if `text/uri-list` or an `href` in `text/html` is extracted from the drop, the stored ref for that URL is used.
2. **Last-opened window** — if the drop contains only plain text (no URL in the drag data), `window.CList._lastOpenedWindowRef` is used. This is set each time `openInBrowser()` is called, so a plain-text drag from the most recently opened popup is correctly attributed.
3. **Nothing** — if neither is available, no reference is added.

---

## Draft auto-save — local editors only

Local editors (those where `requiresAccount: false` and content is held in the browser) should auto-save their content to `sessionStorage` so a page reload doesn't lose work. Service-backed editors (e.g. Etherpad) manage their own persistence server-side and do not need this.

### Three things to implement

**1. Debounced save on content change**

Wire up a listener after the editor DOM is created. Use the `debounce` helper from `utilities.js` with a 1-second delay. Guard against re-wiring on subsequent `initialize()` calls with a data attribute:

```javascript
if (!editorDiv.dataset.draftWired) {
    editorDiv.addEventListener('input', debounce(() => {
        saveDraft('myeditor', /* get current content */);
    }, 1000));
    editorDiv.dataset.draftWired = '1';
}
```

For editors that don't fire DOM `input` events (e.g. TinyMCE), use the editor's own change callback instead.

**2. Offer to restore on initialize**

Check `pendingContent` *before* calling `loadPredefinedContent`. If nothing was waiting, offer to restore the saved draft:

```javascript
const hasPending = !!pendingContent;
loadPredefinedContent('myeditor');
if (!hasPending) offerDraftRestore('myeditor', 'text/plain');
```

`offerDraftRestore()` checks `sessionStorage`, prompts the user ("A draft was saved from your last session. Restore it?"), and loads the content if confirmed. If declined, it discards the draft. If there is no draft, it does nothing.

**3. Clear on Load blank** — handled centrally

`clearDraft(targetKey)` is called automatically in `_doLoadBlank()` when the user picks "Load blank" (via `playLoadBlank()` → `_confirmAndLoadBlank()` → `_doLoadBlank()`). No per-editor code needed.

### Draft helpers (defined in `editors.js`)

| Function | Description |
|----------|-------------|
| `saveDraft(editorKey, value)` | Write `value` to `sessionStorage` under `clist_draft_<editorKey>`. No-op if value is empty. |
| `clearDraft(editorKey)` | Remove the draft from `sessionStorage`. |
| `offerDraftRestore(editorKey, contentType)` | Check for a draft; if found, prompt the user and restore or discard. |

### Persistent cross-session drafts

`sessionStorage` is cleared when the tab closes, which covers accidental reloads but not longer absences. To support persistent drafts (surviving browser close):

- Switch `sessionStorage` → `localStorage` in the three helpers above
- Add a timestamp to the stored value and discard stale drafts on load (e.g. older than 7 days)
- Show a visible "Draft saved" indicator so users on shared computers know content is being persisted
- Call `clearDraft(editorKey)` on kvstore logout so drafts don't outlive the session intentionally
- Consider encrypting draft content with the user's kvstore `encKey` (already available via `crypto_utils.js`) for sensitive content

---

## Central infrastructure — what editors get for free

These are handled by `editors.js` and do not need to be implemented per editor:

| Feature | How it works |
|---------|--------------|
| **Editor switcher UI** | `populateEditorList()` builds the right-pane list from `editorHandlers` automatically. Runs on page load and after every `switchToEditor()` call. New editors appear immediately. |
| **Per-editor state park/restore** | `switchToEditor()` parks the outgoing editor's page/references and restores the target editor's own previously-parked state (or a blank slate) — see "Running per-editor state" above. No per-editor code needed. |
| **Manual-switch content-transfer prompt** | Picker clicks route through `_switchToEditorFromPicker()`, which offers Overwrite/Insert/Don't transfer when the outgoing editor has content — see above. No per-editor code needed; editors only need `getContent`/`loadContent` (and optionally `setContent`) as usual. |
| **Indicator button** | `updateEditorIndicator()` is called by `initializeEditor()` after every successful init. It reads `handler.label` and updates both the command-bar button and the `#editor-status` div in the right pane. |
| **Load blank clears draft** | The "Load blank" entry in `window.CList.loaders` opens `playLoadBlank()`'s type picker; `_doLoadBlank()` calls `clearDraft(targetKey)` once a type is chosen (and confirmed, if the current editor had content). |
| **Account-backed editor listing** | Editors with `requiresAccount: true` appear in the switcher only when the user has a kvstore account with permission `'e'` and a matching `type` field. No extra code needed. |

---

## Known gaps

- **Etherpad has no live reference sync**: Collab and LaTeX keep each document's reference list
  authoritative via the shared Yjs `clist_refs` Map (see "Collaborative editors: per-document
  reference resync" above); Etherpad has no CRDT/push channel to do the same, so collaborators
  editing the same pad can end up with different reference lists with no way to reconcile.
  Deferred — recommended future fix is embedding a delimited references block directly in the
  pad's own text content, so it propagates through Etherpad's own sync. See `/srv/TODO.md`.
