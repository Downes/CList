# Next Session: Consistent Error Handling

## Goal
Replace scattered `alert()` and `console.error()` calls across service files with
user-visible, actionable error messages — following the pattern already established
by `showGoogleSearchError()` in `googlesearch.js`.

---

## The model to follow

`showGoogleSearchError()` in `googlesearch.js:175` is the gold standard:

```javascript
function showGoogleSearchError(feedContainer, apiError) {
    const msg = document.createElement('div');
    msg.className = 'feed-status-message';
    msg.innerHTML = `
        <p><strong>Google Search error:</strong> ${apiError.message || 'Unknown error'}
            ${apiError.code ? ` (${apiError.code})` : ''}</p>
        <p>Your Google Search account credentials may be missing, expired, or invalid.
           Open <strong>Accounts</strong> and re-enter your API key and Search Engine ID.</p>
        <p><a href="..." target="_blank">Set up instructions</a></p>
    `;
    feedContainer.appendChild(msg);
}
```

Three things every error message must do:
1. **What happened** — the error text (from the caught exception or HTTP status)
2. **Why** — likely cause in plain English
3. **What to do** — a specific action, ideally with a link if relevant

Use `class="error-message"` (red, defined in `reader.css`) for hard failures.
Use `class="feed-status-message"` (neutral grey) for soft/informational messages.

---

## Files to fix, in priority order

### 1. `mastodon.js` — most alerts and silent console.errors

Key locations (line numbers approximate — verify before editing):

| Location | Current | Fix |
|----------|---------|-----|
| `loadMastodonFeed` line ~284 | `console.error('Error: Access token or baseURL is missing')` + no UI feedback | Show in `feedContainer` with advice to select an account |
| `loadMastodonFeed` catch line ~344 | `console.error(...)` + sets `feedContainer.innerHTML` to error string | Upgrade to structured message with cause |
| `getMastodonFeed` line ~371 | `console.error(...)` + throws | Caller already catches — improve the thrown message text |
| `handleMastodonAction` line ~654 | `alert('Error: Mastodon client not initialized...')` | Replace alert with `showStatusMessage()` or inline feed message |
| `handleMastodonAction` line ~715, ~721 | `alert('Failed to...')` | Replace with `showStatusMessage()` (utilities.js) — these are action failures, not feed errors |
| `postMastodonStatus` line ~745 | `console.error` only | Show result in the post form's result area |

### 2. `bluesky.js`

| Location | Current | Fix |
|----------|---------|-----|
| Account fetch line ~109 | `alert('Error getting Editor accounts...')` | Replace with inline message in the relevant container |
| Session creation line ~131 | `alert("ApiKey and url are both required...")` | Replace with message in the Bluesky panel |
| Feed fetch errors lines ~267, ~399, ~433, ~511 | `console.error` only, no UI | Show in `feedContainer` with "check your Bluesky account credentials" |
| Post submit line ~900 | `console.error` only | Show in post result div |

### 3. `wordpress.js`

| Location | Current | Fix |
|----------|---------|-----|
| Publish failure lines ~73–74 | `console.error` + `alert('Failed to publish...')` | Replace alert with message in `#post-result` div |

### 4. `oasis.js`

| Location | Current | Fix |
|----------|---------|-----|
| Feed fetch line ~96 | `console.error` only, no UI | Show in `feedContainer`: "Could not reach Oasis Search. Check your network or account settings." |

### 5. `summarize.js` — already partially fixed this session

The error case in `handleSummarize` now uses `error-message` class. Still to check:
- The `accounts` fetch at the top of `summarizeText` — if `accounts` is empty/not loaded,
  the loop silently finds nothing. Add a guard and throw before checking apiKey/url.

---

## Shared helper to consider

Once the pattern is repeated 3+ times, consider adding a shared helper to `utilities.js`:

```javascript
function showServiceError(container, title, message, actionHtml = '') {
    const msg = document.createElement('div');
    msg.className = 'error-message';
    msg.innerHTML = `<p><strong>${title}:</strong> ${message}</p>`
        + (actionHtml ? `<p>${actionHtml}</p>` : '');
    if (typeof container === 'string') container = document.getElementById(container);
    if (container) container.appendChild(msg);
}
```

This is optional — do it after fixing 2–3 files if the pattern is clearly stable.

---

## What NOT to change

- `console.error()` calls that are in addition to a UI message — keep them for debugging
- Error handling inside `catch` blocks that already set `feedContainer.innerHTML` with a
  readable string — those just need upgrading to structured HTML, not a full rewrite
- The `postMastodonStatus` result display — that has its own `responseDiv` pattern,
  just make sure errors go there too

---

## CSS already in place

`reader.css` has both classes ready:

```css
.feed-status-message { color: #555; border: 1px solid #ddd; ... }   /* neutral */
.error-message       { color: #c00; border: 1px solid #f5c6cb; background: #fff5f5; ... }  /* red */
```

Use `error-message` for failures the user needs to act on.
Use `feed-status-message` for informational states ("No posts found", "Loading...").
