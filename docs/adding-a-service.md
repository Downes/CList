# Adding a Service to CList

This guide explains how to integrate a new service with CList's registry system. It covers account schemas, the reader, save, and load handlers, and how to wire a script into the page.

For services that publish editor content to an external platform (Mastodon, WordPress, etc.), see `publish_structure.md` for the publish handler contract.

---

## Architecture overview

CList uses a set of global registries — plain JavaScript objects and arrays — that services populate at load time. Each registry handles one concern:

| Registry | Purpose | Key type |
|---|---|---|
| `window.accountSchemas` | Defines the account form fields in the Accounts panel | `'TypeName'` |
| `window.publishHandlers` | Called by **Post** to send content to the service | `'TypeName'` |
| `window.readerHandlers` | Called by **Read** to initialize a session and offer feed views | `'TypeName'` |
| `window.saveHandlers` | Called by **Save** to persist content (local or remote) | push to array |
| `window.loadHandlers` | Called by **Load** to pull content into the editor | push to array |

The registries are initialized in `publish.js` and `editors.js` and must exist before your file runs, so always guard with `window.X = window.X || {}`.

Scripts are loaded via `index.html`. `interface.js` must remain last; add your service script before it.

---

## File layout

Create one file per service: `js/myservice.js`. Wrap each registry registration in an IIFE so it does not pollute the global scope. Helper functions go outside the IIFEs so they can be called from within them.

```javascript
// 1. Account schema (always first — no IIFE needed)
window.accountSchemas = window.accountSchemas || {};
window.accountSchemas['MyService'] = { /* see below */ };

// 2. Publish handler (see publish_structure.md)
(function () {
    window.publishHandlers = window.publishHandlers || {};
    window.publishHandlers['MyService'] = { /* publish, construct */ };
})();

// 3. Reader handler (optional)
(function () {
    window.readerHandlers = window.readerHandlers || {};
    window.readerHandlers['MyService'] = { /* initialize, feedFunctions */ };
})();

// 4. Helper functions (not wrapped — called from the handlers above)
async function myServiceFetch(credential, url) { /* … */ }
```

---

## 1. Account schema

Defines how the Accounts panel renders the form for this service type.

```javascript
window.accountSchemas['MyService'] = {
    type: 'MyService',          // must match the registry key
    instanceFromKey: true,      // derive `accountData.instance` from the kvstore key
    kvKey: { label: 'Username', placeholder: 'you@myservice.example' },
    fields: [
        { key: 'title',       label: 'Display name', editable: true,  inputType: 'text',     placeholder: 'My Account', default: '' },
        { key: 'permissions', label: 'Permissions',  editable: true,  inputType: 'text',     placeholder: 'rw',         default: 'rw' },
        { key: 'id',          label: 'API key',      editable: true,  inputType: 'password', placeholder: '',           default: '' },
    ]
};
```

### `kvKey`
The key stored in kvstore identifies the account and becomes `accountData.instance` when `instanceFromKey: true`. Use `user@instance.example` for federated services (parseable by `extractBaseUrl`), or a bare ID like a blog ID for non-federated services.

### `fields`
Each field is stored inside the encrypted kvstore value alongside `type`. Common fields:

| `key` | Purpose |
|---|---|
| `title` | Friendly label shown in account lists |
| `permissions` | Read/write flags — `'r'`, `'w'`, or `'rw'` |
| `id` | The credential (token, password, API key) |

`inputType` can be `'text'` or `'password'`. `editable: false` means the field is set by an OAuth flow and not editable by hand. Publishing services may add a `maxlength` field — see `publish_structure.md`.

### Permissions field

The `permissions` string controls which panes show this account:
- `'r'` — shown in Read, not Post
- `'w'` — shown in Post, not Read
- `'rw'` — shown in both

---

## 2. Publish handler

See `publish_structure.md` for the full contract. In brief: register `window.publishHandlers['MyService']` with a `publish(accountData, title, content)` method and an optional `construct(title, content)` method.

---

## 3. Reader handler (optional)

Register a reader handler to add the service to the **Read** account list. When the user selects the account, `initialize()` is called, then `feedFunctions` entries appear as feed buttons.

```javascript
(function () {
    window.readerHandlers = window.readerHandlers || {};
    window.readerHandlers['MyService'] = {

        // Called once when the user selects this account for reading.
        initialize: async (instance, credential) => {
            await myServiceConnect(instance, credential);
        },

        // Feed names map to functions called when the user picks that feed view.
        feedFunctions: {
            'Timeline': loadMyServiceFeed.bind(null, 'home'),
            'Bookmarks': loadMyServiceFeed.bind(null, 'bookmarks'),
            'Search':   () => openLeftInterface(myServiceSearchForm()),
        },
    };
})();
```

### Feed loading conventions
- Clear `feedContainer.innerHTML = ''` on first page load; skip on pagination.
- Append items by creating DOM elements, not by setting `innerHTML` with external data.
- Wrap the full fetch in `try/catch`; on failure call `showServiceError(feedContainer, …)`.
- If a page returns zero items, set `feedContainer.innerHTML = '<p class="feed-status-message">…</p>'`.

---

## 4. Save handler (optional)

Adds an entry to the **Save** right pane. Use for local or remote persistence that isn't a social post.

```javascript
(function () {
    window.saveHandlers = window.saveHandlers || [];
    window.saveHandlers.push({
        label: 'Save to MyService',
        icon:  'cloud_upload',          // Material Icons name
        // logoSrc: 'assets/myservice.svg', // alternative: masked SVG icon
        save: async () => {
            const token   = getSiteSpecificCookie(flaskSiteUrl, 'access_token') || '';
            const handler = editorHandlers[currentEditor];
            const content = handler ? await handler.getContent() : '';
            try {
                await myServiceSave(token, content);
                showStatusMessage('Saved to MyService.');
            } catch (e) {
                console.error('MyService save failed:', e);
                showStatusMessage('MyService save failed: ' + e.message);
            }
        },
    });
})();
```

---

## 5. Load handler (optional)

Adds an entry to the **Load** right pane. Use to pull content from a remote source into the editor.

```javascript
(function () {
    window.loadHandlers = window.loadHandlers || [];
    window.loadHandlers.push({
        label: 'Load from MyService',
        icon:  'download',
        load: async () => {
            try {
                const html = await myServiceFetch();
                return { type: 'text/html', value: html };
                // or: return { type: 'text/plain', value: plainText };
                // return null to cancel (e.g. user dismissed a picker)
            } catch (e) {
                console.error('MyService load failed:', e);
                showStatusMessage('Could not load from MyService: ' + e.message);
                return null;
            }
        },
    });
})();
```

`load()` must return `{ type, value }` or `null`. The type is a MIME string; use `'text/html'` if the content has markup, `'text/plain'` otherwise. The editor's `loadContent()` method handles conversion.

---

## 6. Wiring it up

### Add the script tag to `index.html`

Add your `<script>` tag in the appropriate group — social services go in the "Social Media" block, publishing targets after "Posts":

```html
<script src="js/myservice.js" defer></script>
```

`interface.js` (the last script, without `defer`) must remain last.

### Version-busting

Add `?v=N` when you want to force a cache refresh for already-deployed users:
```html
<script src="js/myservice.js?v=2" defer></script>
```

---

## 7. Error handling

Follow the rules in `docs/error-handling.md`. Key points for service files:

- **Never use `alert()`, `prompt()`, or `confirm()`** — anywhere, for any reason.
- **Every `async` call must be covered** — either `try/catch` or `.catch()` on fire-and-forget calls.
- **Every `catch` block must produce visible feedback** — `showStatusMessage` for transient errors; `showServiceError` for hard failures (feed loads, authentication).
- For credential setup functions that may throw: let them throw, and catch in the caller where the error display lives.
- Keep `console.error()` alongside any UI message — don't remove it.
