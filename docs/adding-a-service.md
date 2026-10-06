# Adding a Service to CList

This guide explains how to integrate a new service with CList's registry system. It covers account schemas, reader, save, and load handlers, and how to wire a script into the page.

For services that publish editor content to an external platform (Mastodon, WordPress, etc.), see `publish_structure.md` for the publish handler contract.

---

## Architecture overview

CList uses a set of global registries under `window.CList` that services populate at load time. Each registry handles one concern:

| Registry | Purpose | Key type |
|---|---|---|
| `window.CList.schemas` | Defines the account form fields in the Accounts panel | `'TypeName'` |
| `window.CList.publishers` | Called by **Post** to send content to the service | `'TypeName'` |
| `window.CList.readers` | Called by **Read** to initialize a session and offer feed views | `'TypeName'` |
| `window.CList.savers` | Called by **Save** to persist content (local or remote) | push to array |
| `window.CList.loaders` | Called by **Load** to pull content into the editor | push to array |

The `window.CList` namespace is declared in an inline `<script>` in `index.html` before any deferred script loads. All registries are guaranteed to exist — no defensive initialization is needed.

Scripts are loaded via `index.html` with `defer`. `interface.js` must remain last; add your service script before it.

---

## File layout

Create one file per service: `js/myservice.js`. Wrap each registry registration in an IIFE so it does not pollute the global scope. Helper functions go outside the IIFEs so they can be called from within them.

```javascript
// 1. Account schema
(function () {
    window.CList.schemas['MyService'] = { /* see below */ };
})();

// 2. Publish handler (see publish_structure.md)
(function () {
    window.CList.publishers['MyService'] = { /* publish, construct */ };
})();

// 3. Reader handler (optional)
(function () {
    window.CList.readers['MyService'] = { /* initialize, feedFunctions, … */ };
})();

// 4. Helper functions (not wrapped — called from the handlers above)
async function myServiceFetch(credential, url) { /* … */ }
```

---

## 1. Account schema

Defines how the Accounts panel renders the form for this service type.

```javascript
window.CList.schemas['MyService'] = {
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

The `permissions` string is checked with `includes()`, so a single account can carry multiple flags (e.g. `'rw'` or `'rwe'`). Each flag opts the account into a specific subsystem:

| Flag | Checked by | Effect |
|---|---|---|
| `r` | `reader.js` | Shown in the **Read** account list |
| `w` | `publish.js`, `kvstore.js` | Shown in the **Post** publish list; also accepted as a kvstore write credential |
| `p` | `kvstore.js` | Marks a kvstore credential store account |
| `e` | `editors.js` | Shown as an available **Editor** (e.g. Etherpad, Collab) |
| `t` | `translate.js` | Used as the **Translation** service |
| `g` | `chatgpt.js` | Used as the **AI assistant** (GPT-style chat) |
| `z` | `summarize.js` | Used as the **Summarize** service |
| `s` | `rss.js` | Marks an RSS relay / OPML subscription source |

Most social services use `'rw'`. Write-only targets (WordPress, Blogger) use `'w'`. Utility accounts (translators, editors, summarizers) use the single letter for their role.

Not every subsystem uses permission flags. Two notable exceptions:

- **Annotate / Hypothesis** — selected by account `type` (`'Annotate'` or `'Hypothesis'`), not by a flag. The `permissions` field still controls read/write within those accounts in the normal way.
- **Collections** — not account-based at all; collection data is stored as kvstore entries with a `collection:` key prefix and has no account-level opt-in.

---

## 2. Publish handler

See `publish_structure.md` for the full contract. In brief: register `window.CList.publishers['MyService']` with a `publish(accountData, title, content, refs)` method and an optional `construct(title, content)` method.

---

## 3. Reader handler (optional)

Register a reader handler to add the service to the **Read** account list. When the user selects the account, `reader.js` dispatches to the handler without any service-specific branching:

```js
const handler = window.CList.readers[accountData.type];
await handler.initialize(accountData);
```

`initialize(accountData)` receives the full parsed account object and is responsible for extracting whatever it needs — credentials, instance URL, etc. The handler then owns all feed loading logic; `reader.js` has no knowledge of individual service types.

### Handler shape

```javascript
(function () {
    window.CList.readers['MyService'] = {

        // Called once when the user selects this account for reading.
        initialize: async (accountData) => {
            const baseURL = extractBaseUrl(accountData.instance);
            const token   = accountData.id;
            await myServiceConnect(baseURL, token);
        },

        // Feed names map to functions called when the user picks that feed view.
        // These are rendered as buttons in #feed-menu by interface.js.
        feedFunctions: {
            'Timeline': loadMyServiceFeed.bind(null, 'home'),
            'Bookmarks': loadMyServiceFeed.bind(null, 'bookmarks'),
            'Search':   () => openLeftInterface(myServiceSearchForm()),
        },

        // Called when the user clicks the feed name in the item summary bar.
        // Receives the normalized item object. null = feed name is not clickable.
        onFeedClick: (item) => loadMyServiceFeed('user', item.myservice?.userId),

        // Called when the user clicks the author name in the item summary bar.
        // Receives the normalized item object. null = author name is not clickable.
        onAuthorClick: null,

        // Returns an HTML string of service-specific action buttons per item.
        // makeListing() appends the collect and share buttons itself — do not include them here.
        statusActions: (item, itemID, itemUrl) => { /* see below */ },
    };
})();
```

### statusActions

Returns an HTML string of **service-specific** buttons only. `makeListing()` always appends the collect (library_add) and share (chat_bubble_outline) buttons after these — do not include them in `statusActions`.

Use `_he(val)` for values in HTML content or attribute context, and `_heJs(val)` for values inside `onclick` JS string literals (i.e. inside `'...'` delimiters). Both are defined in `reader.js` and available in all service files. See the Icon Button Pattern in `CLAUDE.md` for the button markup.

Per-post state (IDs, URIs, flags) should be stored on a service-specific sub-object by the normalizer (see below) and destructured in `statusActions`:

```javascript
statusActions: (item, _itemID, _itemUrl) => {
    const { postId, isLiked } = item.myservice || {};
    return `
        <button class="clist-action-btn${isLiked ? ' action-active' : ''}" title="Like"
                onclick="handleMyServiceAction('${_heJs(postId)}', 'like', this)">
            <span class="material-icons md-18 md-light">favorite</span>
        </button>
        <button class="clist-action-btn" title="Open in browser"
                onclick="window.open('${_heJs(_itemUrl)}','_blank','width=800,height=600,scrollbars=yes')">
            <span class="material-icons md-18 md-light">launch</span>
        </button>
    `;
},
```

The `action-active` class goes on the **outer button**, not the icon span — see the CSS conventions section below.

### Normalization function

Write an async `normalizeMyServicePost(rawItem)` function that maps the API response to the shape `makeListing()` expects. This keeps all API-to-UI translation in one place and makes the feed loop trivial.

```javascript
async function normalizeMyServicePost(raw) {
    let desc;
    try   { desc = await processTranslationWithTimeout(raw.text); }
    catch { desc = raw.text; }

    return {
        service:      'MyService',
        url:          raw.url,                    // required — used as element ID
        titleHtml:    `<a href="#" onclick="loadMyServiceUserFeed('${_heJs(raw.author.handle)}');return false;"
                          title="View user feed">${_he(raw.author.displayName)}</a> wrote:`,
                                                  // optional: overrides default title link
        title:        desc.slice(0, 80),          // plain text fallback if titleHtml is omitted
        desc,                                     // plain text shown in summary bar
        full_content: new SafeHtml(raw.html),     // sanitized HTML; omit if no rich content
        feed:         raw.author.displayName,     // shown in summary bar (clickable if onFeedClick set)
        author:       null,                       // shown in summary bar if onAuthorClick set
        author_id:    raw.author.handle,          // used in reference object for reply targeting
        date:         raw.createdAt,
        images:       (raw.images || []).map(img => ({
                          url:         img.fullsize,
                          preview_url: img.thumb,
                          description: img.alt || '',
                      })),
        guid:         raw.uri || raw.url,
        replyToken:   { type: 'MyService', id: raw.id },  // passed through to publisher
        myservice: {                              // service-specific state for statusActions
            postId:   raw.id,
            isLiked:  !!raw.viewer?.like,
        },
    };
}
```

**`full_content`** must be a `SafeHtml` instance — construct with `new SafeHtml(sanitizedHtml)` after sanitizing the markup. Passing a plain string throws. Omit the field entirely if there is no rich HTML content beyond the plain text `desc`.

**`titleHtml`** is optional. When provided it overrides the default `<a onclick="MyServiceSearch(...)">title</a>` rendering, which is useful when the natural "title" of an item is the author name rather than a document title.

**`author`** and **`feed`** control what appears in the summary bar below the title:
- `feed` — always shown; rendered as a clickable link if `onFeedClick` is set, otherwise a plain span
- `author` — shown as a clickable link only when both `author` is non-null and `onAuthorClick` is set

**`onFeedClick` / `onAuthorClick`** receive the full normalized item, so use the service-specific sub-object (e.g. `item.myservice?.userId`) rather than `item.author` when you need a handle or ID for an API call.

### Feed loading with `renderFeed`

Call `CList.ui.renderFeed(rawItems, container, options)` instead of building the container DOM by hand. It handles clearing, the feed header, the `#feed-summary` div, the per-item normalize+makeListing loop, and the load-more button.

```javascript
async function loadMyServiceFeed(type, cursor = null) {
    const fc = window.CList.ui.view.feedContainer;
    let data;
    try {
        data = await myServiceFetch(type, cursor);
    } catch (err) {
        console.error('MyService fetch failed:', err);
        showServiceError(fc, 'MyService error', err.message,
            'Check your credentials under <strong>Accounts</strong>.');
        return;
    }
    if (!data.posts.length) {
        fc.innerHTML = '<p class="feed-status-message">No posts found.</p>';
        return;
    }
    await window.CList.ui.renderFeed(data.posts, fc, {
        normalize:    normalizeMyServicePost,
        title:        cursor == null ? type : null,   // null = paginating, skip clear+header
        append:       cursor != null,
        onLoadMore:   data.cursor ? () => loadMyServiceFeed(type, data.cursor) : null,
        loadMoreBtnId: 'myservice-load-more',
    });
}
```

`renderFeed` options:

| Option | Type | Description |
|---|---|---|
| `normalize` | `async (rawItem) => item` | Required. Maps a raw API object to the `makeListing()` item shape. |
| `title` | `string \| null` | Feed type string passed to `createFeedHeader`. `null` = skip clear, header, and summary div. |
| `typevalue` | `string \| null` | Second arg to `createFeedHeader` (e.g. hashtag name, username). |
| `append` | `boolean` | `true` = paginating; skip clear, header, and `#feed-summary`. Default `false`. |
| `onLoadMore` | `function \| null` | Zero-argument callback wired to the load-more button. `null` = no button. |
| `loadMoreBtnId` | `string` | ID for the load-more button. Default `'loadMoreButton'`. |

Catch fetch errors **before** calling `renderFeed` and display them with `showServiceError`. Only call `renderFeed` once you have data to render.

---

## 4. Save handler (optional)

Adds an entry to the **Save** right pane. Use for local or remote persistence that isn't a social post.

```javascript
(function () {
    window.CList.savers.push({
        label: 'Save to MyService',
        icon:  'cloud_upload',          // Material Icons name
        // logoSrc: 'assets/myservice.svg', // alternative: masked SVG icon
        save: async () => {
            const token   = getSiteSpecificCookie(window.CList.config.flaskSiteUrl, 'access_token') || '';
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
    window.CList.loaders.push({
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

`interface.js` (the last script) must remain last.

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

---

## 8. CSS and styling

**Do not create service-specific CSS classes or add style attributes inline.** All visual styling must use the global classes defined in `reader.css` and `interface.css`. This applies to new services and to modifications of existing ones.

### Buttons

| Use case | Class(es) |
|---|---|
| Icon-only action button | `clist-action-btn` + inner `<span class="material-icons md-18 md-light">` |
| Primary labelled button | `btn` |
| Compact labelled button | `btn-small` |
| Secondary / cancel button | `btn-secondary` (combine with `btn` or `btn-small`) |

`btn` and `btn-small` both render with `--highlight-color` background and white text. `btn-secondary` overrides to grey. `btn-small` is for contextual buttons inside panels (collection picker, import controls, etc.).

Toggled state (liked, bookmarked, etc.) is shown by adding `action-active` to the **outer button**:

```html
<button class="clist-action-btn action-active" title="Unlike">
    <span class="material-icons md-18 md-light">favorite</span>
</button>
```

The CSS rule targets `.material-icons` inside an `action-active` button to show the orange tint. Do not add the class to the span directly.

### Typography

All text inherits from `:root` via `font: inherit` on `input / textarea / select / button`. Do not set `font-size`, `font-family`, or `line-height` on service-specific elements — the cascade handles it. Use the utility classes for size variants:

| Class | Size | Use for |
|---|---|---|
| *(default)* | `1rem / 1.5` | Body text, labels, buttons |
| `.caption`, `.meta`, `.help-text` | `0.875rem / 1.4` | Secondary annotations, timestamps |

### Form inputs

Use the `input-field` class on `<input>` and `<textarea>` elements inside panels. It picks up the same border, padding, and `font: inherit` as all other inputs. Do not set `font-size: 14px` or any width/height directly on service inputs.

### Colours

Always use `--highlight-color` (green) for primary interactive elements and `--highlight-text-color` (white) for text on coloured backgrounds. Do not hard-code hex values for these colours.
