# CList UI Component Patterns

Shared CSS classes and JS helpers used across the left and right panes. When adding a new panel, list, or command bar, use these rather than inventing new styles.

---

## Overall layout

CList is a two-pane application. The centre of the screen is split horizontally between a **read pane** (left) and a **write pane** (right), separated by a draggable `#divider`. Each pane has a matching **options pane** that slides in from the edge of the screen.

```
┌──────────────────────────────────────────────────────────────────┐
│  #left-pane (slides in)  │  #main-content  │  #right-pane (slides in)  │
│                          │                 │                           │
│  Login / accounts /      │  #read-pane  │  #write-pane  │  Editor switch /  │
│  feed options            │  (feed reader)  │  (editor)    │  save / post      │
└──────────────────────────────────────────────────────────────────┘
```

### Read pane — `#read-pane`

The left half of `#main-content`. Displays the feed reader.

| Element | Role |
|---------|------|
| `#left-main-command` (`.command`) | Command bar: Read, Find, Chat mode buttons + pane-snap |
| `#feed-menu` | Dynamically populated feed-source buttons |
| `#feed-container` | Feed item list |

Options for the read pane open in **`#left-pane`**, which slides in from the left edge. Its command bar (`#left-command`) holds Login / Register / Logout / Accounts. Its scrollable body (`#left-content`) is replaced each time via `openLeftInterface()` with the relevant list (accounts to read from, search results, etc.).

### Write pane — `#write-pane`

The right half of `#main-content`. Contains the active editor.

| Element | Role |
|---------|------|
| `#right-main-command` (`.command`) | Command bar: Load, Save, Post, Refs, editor-indicator |
| `#write-title` | Editable title field (above the editor) |
| `#write-pane-content` | The active editor lives here; only one editor div is visible at a time |
| `#<editor>-references` | Per-editor reference list, rendered below `#write-pane-content` |

Options for the write pane open in **`#right-pane`**, which slides in from the right edge and is separated from the write pane by a `border-left: 1px solid #ccc`. Its panels (`#editor-list`, `#load-instructions`, `#save-instructions`, `#post-instructions`) are pre-declared children of `#right-content` and shown/hidden via `openRightInterface(panelId)`.

### Status pane — `#statusPane`

A floating `div` at the bottom of the screen for transient messages. Written to by `showStatusMessage(text)` in `utilities.js`; auto-hides after 3 seconds.

---

## Command bars — `.command`

All four command bars (`#left-command`, `#left-main-command`, `#right-command`, `#right-main-command`) share the `.command` class.

```css
.command {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 41px;
    box-sizing: border-box;
    padding: 0 10px;
    background: #ddd;
    border-bottom: 1px solid #ccc;
}
```

Use `class="command"` — do not add ID-specific height or padding overrides.

Buttons inside a command bar that hold a Material Icon use `.icon-btn`:

```html
<button class="icon-btn" onclick="..."><span class="material-icons">search</span></button>
```

---

## Pane status bars — `.pane-status` / `.pane-status-item`

A thin bar below a command bar, used to show the current state (logged-in user, active editor, etc.). Both the left pane (`#current-status`) and right pane (`#right-status`) use this pattern.

```html
<div id="some-status" class="pane-status">
    <div id="some-detail" class="pane-status-item">Label text here</div>
</div>
```

```css
.pane-status  { display: flex; align-items: stretch; height: 41px; background: #fff; border: 1px solid #ddd; }
.pane-status-item { flex: 1; padding: 10px; font-size: 13px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
```

Multiple `.pane-status-item` children share the bar width equally (`flex: 1`).

---

## List panels — `.account-list`, `.list-tip`, `.account-button`

Used whenever a pane shows a selectable list of items (accounts, editors, feeds, etc.).

### Structure

```html
<div class="account-list">
    <div class="list-tip">Instruction text for the user</div>
    <!-- .account-button elements go here -->
</div>
```

`.account-list` is a semantic container with no CSS of its own — it groups the tip and the buttons.

`.list-tip` is a muted instruction line at the top of the list:

```css
.list-tip { padding: 8px 10px; font-size: 13px; color: #666; border-bottom: 1px solid #ddd; margin-bottom: 4px; }
```

### Buttons — `.account-button`

Each selectable item is an `.account-button`: a full-width button with a leading icon and a text label.

```css
.account-button { display: flex; align-items: center; gap: 8px; width: 100%; padding: 9px 10px;
    background: none; border: none; border-bottom: 1px solid #eee; font-size: 14px; color: #333; cursor: pointer; }
.account-button .material-icons { font-size: 18px; color: #888; flex-shrink: 0; }
.account-button:hover  { background-color: #f0f0f0; }
.account-button:active { background-color: #d8ead0; }
```

Icons use either a Material Icons ligature (string name) or `.account-icon-img` for SVG service icons (see `accountIcon()` in `reader.js`).

---

## Building lists in JS

### Left pane — `makeAccountList()` (reader.js)

For dynamic left-pane account lists. Returns a fully built `.account-list` DOM element ready to pass to `openLeftInterface()`.

```javascript
const list = makeAccountList(
    'Select an account to read',   // .list-tip text
    accounts,                      // global accounts array
    pv => pv.permissions.includes('r'),  // filter: return true to include
    (key, pv) => loadAccount(key, pv)    // click handler
);
openLeftInterface(list);
```

`makeAccountList` renders the icon via `accountIcon(parsedValue.type)`, which returns either a `.material-icons` span or an `.account-icon-img` masked SVG depending on the service type.

### Right pane — `makeEditorButton()` (editors.js)

For building individual `.account-button` elements when the list container is pre-declared in HTML. Returns a single button element.

```javascript
const btn = makeEditorButton(
    'HTML (TinyMCE)',    // label text
    'web',              // Material Icons name
    () => switchToEditor('tinymce', carriedContent)  // click handler
);
container.appendChild(btn);
```

Signature: `makeEditorButton(label, icon, onClick)` — `onClick` is called asynchronously.

---

## Opening panels

The left and right panes use different approaches because their content lifetimes differ.

### Left pane — `openLeftInterface(content)` (interface.js)

Clears `#left-content` entirely and injects new content into a fresh `#left-interface` div. Pass either a DOM `Element` or an HTML string.

```javascript
openLeftInterface(makeAccountList(...));  // DOM element
openLeftInterface('<h2>Hello</h2>');      // HTML string
```

Use this when the panel content is built dynamically each time it opens.

### Right pane — `openRightInterface(panelId)` (interface.js)

Hides all children of `#right-content`, then shows the child with the given `id`. Panels must be pre-declared in `index.html` as children of `#right-content`.

```javascript
openRightInterface('editor-list');       // shows #editor-list, hides all others
openRightInterface('load-instructions'); // shows #load-instructions
openRightInterface('save-instructions'); // shows #save-instructions
```

Pre-declaring panels in HTML lets `populateEditorList()` and similar functions update their contents independently of the open/close cycle.

**When to use which:** left pane for dynamic, rebuilt-each-time content; right pane for persistent panels whose contents are updated in place.

---

## Adding a new list panel

### In the left pane

1. Call `makeAccountList(tip, accounts, filterFn, onClickFn)` with your filter and handler.
2. Pass the result to `openLeftInterface()`.
3. No HTML changes needed.

### In the right pane

1. Add a child div to `#right-content` in `index.html`:
   ```html
   <div id="my-list" class="account-list" style="display:none;">
       <div class="list-tip">Select something</div>
       <div id="my-list-options"></div>
   </div>
   ```
2. Populate `#my-list-options` with `makeEditorButton(...)` calls (or an equivalent helper).
3. Open it with `openRightInterface('my-list')`.
