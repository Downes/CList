# CList `#feed-section` Standard Structure

The feed pane is `#feed-section`, which contains two children: `#feed-menu` and `#feed-container`.

```
#feed-section
  ├── #feed-menu                   — row of buttons, rebuilt per service on account switch
  │     └── [button] × N          — each calls a function defined in the service's .js file
  │                                  Two button behaviours:
  │                                  1. Opens an interface — calls openLeftInterface(helperFn())
  │                                     (e.g. Mastodon "Post" → openLeftInterface(mastodonStatusForm()))
  │                                     (e.g. Mastodon "Hashtag" → openLeftInterface(mastodonInputForm(...)))
  │                                  2. Directly loads a feed — calls the fetch function immediately
  │                                     (e.g. Mastodon "Following" → loadMastodonFeed('home'))
  │
  └── #feed-container              — rendered feed items (see below)
```

The buttons in `#feed-menu` are defined in each service's `feedFunctions` map (e.g. `window.MastodonFunctions`, `window.BlueskyFunctions`) and wired up by `setupFeedButtons(instanceType)` in `interface.js` when an account is selected.

---

## `openLeftInterface(content)` — the standard left-pane interface

Defined in `interface.js`. All left-pane UI panels go through this function. It:
1. Calls `openLeftPane()`
2. Clears `#left-content` entirely
3. Creates `div#left-interface.left-interface`
4. Appends the content element into it

**All panel content is created on demand** each time the button is clicked — nothing is pre-created or persisted in the DOM. Each panel has a named helper function that returns the element:

| Caller | Helper function | Returns |
|--------|----------------|---------|
| Read button | `readPanel()` | Account list for selecting a read source |
| Find button | `findPanel()` | Search textarea + Duck Duck Go / Google / OASIS buttons |
| Accounts button | `kvstoreAccountsPanel()` | Manage Accounts iframe (flasker.html) |
| Mastodon "Post" | `mastodonStatusForm()` | Post / reply textarea form |
| Mastodon "Hashtag" | `mastodonInputForm('hashtag', ...)` | Text input + submit |
| Mastodon "User" | `mastodonInputForm('user', ...)` | Text input + submit |
| Mastodon "Lists" | `createMastodonListDropdown(lists)` | `<select>` of lists (fetched async in `loadMastodonLists`) |
| Bluesky "Post" | `blueskyPostForm()` | Post textarea form |
| Bluesky "Search" | `blueskySearchForm()` | Query input + sort select |
| Bluesky "Pinned"/"Recommended" | `blueskySelectForm(type)` | `<select>` of feeds (async) |

Input element IDs used by feed-loading functions: `mastodon-hashtag`, `mastodon-user`, `queryInput`, `sortSelect`, `mastodonList`, `blueskyPinnedSelect`, `blueskyRecommendedSelect`.

### Left-pane toolbar (`#left-command`)
Login/logout/accounts buttons live in `#left-command` (above `#left-content`) and are always visible when the pane is open — they are NOT cleared by `openLeftInterface`. `loginRequired()` calls `openLeftPane()` to reveal them; it also explicitly sets `loginButton.style.display='inline-block'`.

---

## Account status bar (`#current-status`)

Sits between `#left-command` and `#left-content` in `#left-pane`. Always visible when the pane is open. Contains two equal-width halves:

```
#current-status
  ├── #identityDiv      — login identity (e.g. "Identity: stephen")
  └── #selectedAccount  — currently active read account: icon + title
                          updated by switchReaderAccount() in reader.js
                          empty until an account is selected
```

`#selectedAccount` is populated by `switchReaderAccount(key)` using `accountIcon(type)` + `accountData.title`.

---

## Account list buttons — `makeAccountList()` / `.account-button`

**`makeAccountList(tip, accounts, filterFn, onClickFn)`** — defined in `reader.js`. Returns a `div.account-list` containing a tip line and one `.account-button` per matching account. Used wherever a list of accounts needs to be presented for selection.

| Parameter | Purpose |
|-----------|---------|
| `tip` | Instruction string shown above the list (e.g. `'Select an account to read'`) |
| `accounts` | The global `accounts` array |
| `filterFn(parsedValue)` | Return `true` to include the account (e.g. `v => v.permissions.includes('r')`) |
| `onClickFn(key, parsedValue)` | Called when a button is clicked |

Each `.account-button` is a full-width flex button: service icon on the left, account title on the right.

**`accountIcon(type)`** — also in `reader.js`. Returns a DOM element sized to 18×18px:

| Type | Element | Source |
|------|---------|--------|
| `Mastodon` | `<span class="account-icon-img">` | CSS mask over `assets/icons/mastodon.svg` |
| `Bluesky` | `<span class="material-icons">cloud</span>` | Material Icons |
| `OPML` | `<span class="material-icons">rss_feed</span>` | Material Icons |
| `WordPress` / `Blogger` | `<span class="material-icons">article</span>` | Material Icons |
| _(default)_ | `<span class="material-icons">account_circle</span>` | Material Icons |

The `.account-icon-img` span uses a CSS mask (`mask: url('../assets/icons/mastodon.svg')`) with `background-color: #888` so it renders in the same gray as Material Icons — no tinting filter needed.

**Current callers of `makeAccountList`:**

| Caller | Tip | Filter | On click |
|--------|-----|--------|----------|
| `populateReadAccountList()` in `reader.js` | `'Select an account to read'` | `permissions.includes('r')` | `switchReaderAccount(key)` |

---

## `#feed-container` Structure

All feed display functions build the same DOM shape inside `#feed-container`:

```
#feed-container
  ├── div.feed-header              — createFeedHeader(type, typevalue), first page only
  ├── #feed-summary                — empty div, reserved for optional summary text
  └── div.status-box               — one per item
        ├── div.status-content
        │     ├── div.reblog-info        (optional — Mastodon reblogs and notification headers)
        │     ├── div#[item-id]          — author + summary/content; carries .reference object
        │     ├── div.status-images-container  (optional)
        │     │     └── div.image-item × N
        │     └── div.status-actions     — platform action buttons (see below)
        └── div.clist-actions      — always: arrow_right → loads item to write pane
  └── [pagination button]          — "Load Next Page" / "Load More" when cursor exists
```

### Two rendering approaches

Services render items in one of two ways:

**Direct DOM** (Mastodon, Bluesky) — each service builds its own DOM elements via `createElement` / `innerHTML` directly inside its display function.

**`makeListing()`** (RSS, OPML, OASIS, DuckDuckGo, Google) — services populate a standard item object and pass it to `makeListing()` in `reader.js`, which builds the `div.status-box` and calls `readerHandlers[service].statusActions()` to get the action buttons as an HTML string.

---

## `makeListing(item)` — item object contract

`makeListing()` is defined in `reader.js`. It accepts a single object with the fields below and returns a fully assembled `div.status-box`.

### Field reference

| Field | Type | Required | Description |
|---|---|---|---|
| `service` | string | yes | Key into `readerHandlers` — determines which `statusActions()` is called |
| `url` | string | yes | Canonical URL of the item — used to generate `itemID` via `createUniqueIdFromUrl()` |
| `title` | string | yes | Plain text title. Escaped internally — **do not pre-escape.** |
| `desc` | string | no | Plain text summary. Escaped internally — **do not pre-escape.** Truncated to `summaryLimit` if too long. |
| `feed` | string | no | Plain text feed/source name. Escaped internally — **do not pre-escape.** |
| `author` | string | no | Plain text author name. Escaped internally — **do not pre-escape.** |
| `date` | string | no | Plain text date string. Escaped internally — **do not pre-escape.** |
| `full_content` | `SafeHtml` | no | **Must be a `SafeHtml` instance** (see below). Passing a plain string throws immediately. Omit or pass `''` if there is no full content. |
| `titleHtml` | HTML string | no | If provided, replaces the default `<a onclick>` title link entirely. Caller is responsible for safety — `makeListing` uses it as-is. |
| `feedAction` | JS string | no | If provided, replaces the default `loadMastodonFeed(...)` onclick on the feed-name link. Caller is responsible for safety — `makeListing` uses it as-is. |
| `images` | array | no | Array of `{ url, preview_url, description }`. Only `https?://` URLs are rendered; others are silently skipped. |
| `link` | string | no | (RSS only) Direct item URL; forwarded to `statusActions` for the launch button. |
| `entryId` | string | no | (RSS only) Stable content-hash ID; forwarded to `statusActions` for read/bookmark toggles. |

### `SafeHtml` — the `full_content` contract

`makeListing` must render `full_content` as HTML (not escaped text), so it enforces that the caller has sanitized it first. Passing an unsanitized plain string throws:

```
Error: makeListing: full_content must be a SafeHtml instance. Sanitize it before passing.
```

`SafeHtml` is a small opaque class defined in `reader.js` and assigned to `window.SafeHtml`. To produce one, run the content through a sanitizer that returns `new SafeHtml(html)`:

```js
// In rss.js — the reference implementation:
const safeContent = _rssSanitizeHtml(rawHtml);  // returns new SafeHtml(...)
makeListing({ ..., full_content: safeContent });
```

**`_rssSanitizeHtml(html)`** (in `rss.js`) is the standard sanitizer. It:
- Strips dangerous tags with their children: `script`, `noscript`, `style`, `iframe`, `frame`, `frameset`, `object`, `embed`, `applet`, `form`, `input`, `button`, `select`, `textarea`
- Unwraps unknown tags (keeps child text/elements)
- Strips all attributes except an explicit allowlist per tag
- Blocks `javascript:`, `data:`, and `vbscript:` URLs on `href` and `src`
- Forces `target="_blank" rel="noopener noreferrer"` on all links

If you have content that is already safe (e.g. generated entirely by your own code, not from external feeds), you can bypass the sanitizer by wrapping directly: `new SafeHtml(yourHtml)`. Only do this when you are certain the content contains no user- or feed-supplied data.

### Escaping helpers (reader.js)

Two helpers are defined globally in `reader.js` for use by services building item objects or `statusActions` strings:

| Function | Use for |
|---|---|
| `_he(s)` | Escaping plain text for insertion into an **HTML** context (element text, attribute values) |
| `_heJs(s)` | Escaping plain text for insertion into a **JS string literal** inside an `onclick` attribute (delimited by `'`) |

The text fields listed above (`title`, `desc`, `feed`, `author`, `date`) are escaped by `makeListing` itself — callers should pass raw unescaped text. However, fields passed through `feedAction` or `titleHtml` are the caller's responsibility; use `_he`/`_heJs` as appropriate when constructing those strings. See the RSS `statusActions` implementation for a reference example.

### Desc-to-content promotion

If `desc` exceeds `summaryLimit` characters and is longer than `full_content`, `makeListing` promotes the (HTML-escaped) desc text to the full content slot and truncates `desc` to the limit. The expand button is only rendered when `full_content` (or promoted content) is longer than the (truncated) `desc`.

---

**Future recommendations (deferred):**

1. **Move Mastodon and Bluesky action buttons into `readerHandlers[service].statusActions()`** — the same interface the search services use. This gives a single place to look up what actions a service supports without requiring a full `makeListing()` migration. Do this when already touching those files for another reason.

2. **Migrate Mastodon and Bluesky to `makeListing()`** — the right trigger is adding a cross-service feature that needs to work on every item regardless of service (e.g. CList-level bookmarks, save to reading list). At that point the item object format will need standardizing anyway, and the migration earns its keep. Not worth doing as pure cleanup.

---

## `div.status-actions` — post action buttons

Every rendered item has a `div.status-actions` containing buttons for acting on the post. Actions vary by service. The `div.clist-actions` (`arrow_right`) is always present separately and is not part of this set.

### Button markup standard

```html
<button class="material-icons md-18 md-light [action-active]"
        onClick="handleServiceAction('itemId', 'actionType', this)">
  icon_name
</button>
```

The third argument (`this`) passes the button element so the handler can update visual state on success.

### Active state — `action-active`

Toggle actions (boost, bookmark, favourite) have two states:

| State | CSS class | Colour |
|-------|-----------|--------|
| inactive | `material-icons md-18 md-light` | default |
| active | `material-icons md-18 md-light action-active` | orange |

The initial state is set from the API response when the item is first rendered (e.g. `status.bookmarked`, `status.reblogged`, `status.favourited` for Mastodon). Clicking a toggle action calls the reverse endpoint on success (e.g. `unbookmark`, `unreblog`, `unfavourite`) and removes `action-active`.

### Handler pattern (Mastodon reference implementation)

```js
const active = extraParam?.classList.contains('action-active');
url = `${baseURL}/api/v1/statuses/${id}/${active ? 'unbookmark' : 'bookmark'}`;
const ok = await postMastodonAction(url, active ? 'unbookmark' : 'bookmark');
if (ok && extraParam) extraParam.classList.toggle('action-active');
// postMastodonAction returns true on HTTP success, false on error.
```

### Full actions table — all services

| Action | Icon | Mastodon | Bluesky | OPML | OASIS | DuckDuckGo | Google |
|--------|------|----------|---------|------|-------|------------|--------|
| reply | `reply` | ✓ (left pane) | ✓ (inline form) | — | — | — | — |
| boost / repost | `autorenew` | ✓ toggle | ✓ no toggle | — | — | — | — |
| like / favourite | `star` / `favorite` | ✓ toggle (`star`) | ✓ no toggle (`favorite`) | — | — | — | — |
| bookmark | `bookmarks` | ✓ toggle | — | stub | — | — | — |
| view thread | `dynamic_feed` | conditional | conditional | — | — | — | — |
| expand content | `zoom_out_map` | — | — | conditional | conditional | — | — |
| play audio | (custom) | — | — | conditional | — | — | — |
| launch in window | `launch` | ✓ | ✓ | conditional | ✓ | ✓ | ✓ |

**Notes:**
- *toggle* = supports `action-active` visual state and calls reverse endpoint on second click
- *no toggle* = action fires but button state is not updated (Bluesky limitation — no initial state from API)
- *conditional* = only shown when item has relevant content (thread replies, full content, audio enclosure, link)
- *stub* = wired to an unimplemented `Action()` function; does nothing (OPML bookmark)
- `zoom_out_map` is a content-display control, not a platform action — it lives in `status-actions` for services using `makeListing()` but could reasonably be moved elsewhere
- Mastodon `reply` uses `openLeftInterface`; Bluesky `reply` toggles an inline form per item

---

## `div.clist-actions` — CList item actions

Every rendered item has a `div.clist-actions` positioned to the right of `div.status-content` inside `div.status-box`. These are CList's own actions on an item, distinct from the platform's social actions in `div.status-actions`.

### Current standard action

All services currently provide exactly one clist action per item:

| Button | Icon | Action |
|--------|------|--------|
| Load to write pane | `arrow_right` | `loadContentToEditor(itemID)` |

This loads the item's text into the TinyMCE editor in the write pane, wiring it to the publish/compose flow via the `.reference` object.

### Button markup standard

```html
<button class="material-icons md-18 md-light"
        onClick="loadContentToEditor('itemId')">
  arrow_right
</button>
```

### Notes

- `div.clist-actions` is **stripped automatically** before content is sent to the editor (`summarize.js`, `tinymce.js` both call `querySelectorAll('.clist-actions').forEach(el => el.remove())`).
- The feed header (`div.feed-header`) uses a `p.clist-actions` (not a div) for thread-level actions (summarise + load whole thread). This is a header-level variant, not a per-item action.
- New per-item clist actions should be added here and applied consistently across all service files.

---

## The `.reference` object

Attached directly to the `div#[item-id]` DOM element. Used by the editor and publish flow to identify/use the item without re-fetching:

```js
statusSpecific.reference = {
    author_name,   // display name
    author_id,     // handle / acct
    url,           // canonical post URL
    title,         // service name or post title
    feed,          // feed/source name (RSS) or acct (Mastodon)
    created_at,    // ISO timestamp
    id             // unique item ID (used for DOM id and loadContentToEditor)
}
```

## Known inconsistencies (as of 2026-04-27)

All previously identified inconsistencies have been resolved. The remaining structural gap is that Mastodon and Bluesky still build their feed items directly via DOM/innerHTML rather than going through `makeListing()`. This is a larger refactor deferred for a future session.

**When adding a new service:** follow the `makeListing()` + `readerHandlers` pattern. The `div.clist-actions` with `arrow_right` calling `loadContentToEditor(itemID)` and the `.reference` object on `div#[item-id]` are mandatory — they wire each item into the write/publish flow. See the `makeListing()` field contract above for escaping rules and the `SafeHtml` requirement for `full_content`.
