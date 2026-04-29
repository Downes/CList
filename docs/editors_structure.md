# CList Write-Pane Editor Architecture

Editors are registered in a global `editorHandlers` object defined in `editors.js`. Each key is the editor's internal identifier (e.g. `'texteditor'`, `'tinymce'`, `'etherpad'`). New editors add themselves by registering their handler at load time.

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

The script tag for the new file goes in `index.html` alongside the other editor scripts (`tinymce.js`, `etherpad.js`).

---

## Required handler fields

| Field | Type | Description |
|-------|------|-------------|
| `label` | `string` | Human-readable name shown in the editor switcher (e.g. `'HTML (TinyMCE)'`) |
| `icon` | `string` | Material Icons name shown beside the label (e.g. `'web'`, `'notes'`, `'group'`) |
| `contentTypes` | `string[]` | MIME types the editor works with, in preference order. Use `['text/html']` for rich editors, `['text/plain']` for plain text, both for editors that handle either. Used to warn on lossy conversions when switching. |
| `requiresAccount` | `bool` | `true` if the editor needs a kvstore account with permission `'e'` (e.g. Etherpad). `false` for built-in editors. Account-backed editors only appear in the switcher when a matching account exists. |
| `initialize()` | `function` | Set up and show the editor DOM. See contract below. |
| `getContent()` | `function` | Return the current editor content as a string. May be `async`. |
| `loadContent({ type, value }, itemId?)` | `function` | Insert content into the editor. `type` is a MIME type string. `itemId` is the feed item DOM id, used to attach a reference (optional). |

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

**Set by:** `switchToEditor()` when carrying content from the previous editor, or by `populateEditorAccountList()` for account-backed editors.

**Consumed by:** `loadPredefinedContent(editorType)` inside `initialize()`. It reads `pendingContent`, clears it, and calls `handler.loadContent(content)`. After this call `pendingContent` is always `null`.

If `pendingContent` is `null` when `initialize()` runs, the editor starts empty (or restores a draft — see below).

---

## Content loading — `loadHandlers`

The Load button opens a right-pane list built from the `loadHandlers` registry — an **ordered array** of loader objects defined in `editors.js` and extended by service files.

### Registering a loader

Add an entry by pushing to `window.loadHandlers` from any `.js` file:

```javascript
(function () {
    window.loadHandlers = window.loadHandlers || [];
    window.loadHandlers.push({
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

---

## Save destinations — `saveHandlers`

The Save button opens a right-pane list built from the `saveHandlers` registry — an **ordered array** of saver objects defined in `publish.js` and extended by service files.

### Registering a saver

Add an entry by pushing to `window.saveHandlers` from any `.js` file:

```javascript
(function () {
    window.saveHandlers = window.saveHandlers || [];
    window.saveHandlers.push({
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

`clearDraft(currentEditor)` is called automatically in `playEditors()` when the user picks "Load blank". No per-editor code needed.

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
| **Content carry-over on switch** | `switchToEditor(editorType, carriedContent)` captures content from the current editor, warns if the conversion is lossy (HTML → plain text strips tags), stashes it in `pendingContent`, then calls `initializeEditor()`. |
| **Indicator button** | `updateEditorIndicator()` is called by `initializeEditor()` after every successful init. It reads `handler.label` and updates both the command-bar button and the `#editor-status` div in the right pane. |
| **Load blank clears draft** | The "Load blank" entry in `loadHandlers` calls `clearDraft(currentEditor)` before returning empty content. |
| **Account-backed editor listing** | Editors with `requiresAccount: true` appear in the switcher only when the user has a kvstore account with permission `'e'` and a matching `type` field. No extra code needed. |

---

## Known gaps

- **Etherpad pending content**: Etherpad's `initialize()` does not call `loadPredefinedContent()`, so if content is waiting in `pendingContent` when Etherpad is selected, it is silently dropped. Fix: call `loadPredefinedContent('etherpad')` at the end of Etherpad's `initialize()`, or move the call into `initializeEditor()` centrally.
