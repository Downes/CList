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

## `#feed-container` Structure

All feed display functions (Mastodon `displayMastodonFeed`, Bluesky `displayBlueskyPosts`, RSS `makeListing`) build the same DOM shape inside `#feed-container`:

```
#feed-container
  ├── [feed header]                — createFeedHeader(type), first page only
  ├── #feed-summary                — empty div, reserved for optional summary text
  └── div.status-box               — one per item
        ├── div.status-content
        │     ├── div.reblog-info        (optional — Mastodon reblogs only)
        │     ├── div#[item-id]          — author + translated text; carries .reference object
        │     ├── div.status-images-container  (optional)
        │     │     └── div.image-item × N
        │     └── div.status-actions     — platform action buttons (varies by service)
        │                                  Mastodon: reply, boost, favorite, bookmark, thread, launch
        │                                  Bluesky:  reply, favorite, repost, thread, launch
        │                                  RSS:      service-specific via readerHandlers[service].statusActions()
        └── div.clist-actions      — always: arrow_right → loadContentToTinyMCE(itemID)
  └── [pagination button]          — "Load Next Page" / "Load More" when cursor exists
```

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
    id             // unique item ID (used for DOM id and loadContentToTinyMCE)
}
```

## Known inconsistencies (as of 2026-04-21)

- RSS `makeListing` adds class `statusSpecific` to `div#[item-id]`; Mastodon/Bluesky don't
- Bluesky builds `status-actions` buttons individually in JS; Mastodon uses innerHTML strings
- Bluesky appends an inline `replyForm` div inside `status-content` per item; Mastodon uses `openLeftInterface` for replies

**Why:** The goal is full standardization so all services render identically. Inconsistencies are legacy and should be resolved when refactoring individual service files.

**How to apply:** When adding a new service or display function, follow the structure above exactly. The `div.clist-actions` with `arrow_right` and `.reference` object are mandatory — they wire the item into the write/publish flow.
