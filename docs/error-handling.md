# CList Error Handling

## Rules

1. **Never use `alert()`** — it blocks the UI and breaks flow for errors and validation alike.
2. **Never silently swallow errors** — a bare `catch (error) { console.error(...) }` with no UI feedback leaves the user with no idea what went wrong.
3. **Every async call must be covered** — either inside a `try/catch`, or with a `.catch()` handler if called without `await`.
4. **Every error message must do three things**: say what happened, why it likely happened, and what the user should do.

---

## Two helpers — pick the right one

### `showServiceError(container, title, message, actionHtml)` — `utilities.js`

For **hard failures** that need user action: feed loads, API calls, credential problems. Appends a persistent red `error-message` div to a container element.

```javascript
showServiceError(feedContainer, 'Mastodon error', error.message,
    'Check your Mastodon credentials under <strong>Accounts</strong>.');

// container can be an element or an element ID string
showServiceError('feed-container', 'Bluesky error', error.message,
    'Check your Bluesky account credentials under <strong>Accounts</strong>.');
```

Parameters:
- `container` — a DOM element, or an ID string (resolved via `getElementById`)
- `title` — short service name, e.g. `"Mastodon error"`, `"Bluesky error"`
- `message` — the error text, typically `error.message` from the caught exception
- `actionHtml` — optional HTML string with remediation advice; can contain `<strong>` and `<a>` tags

### `showStatusMessage(text)` — `utilities.js`

For **transient action feedback**: post results, validation messages, confirmations. Writes to `#statusPane` (bottom of screen) and auto-hides after 3 seconds.

```javascript
showStatusMessage('Failed to boost — server returned 422.');
showStatusMessage('Name set to: Alice');
showStatusMessage('No publish handler registered for type: Unknown');
```

Use this for:
- Social action results (bookmark, boost, favourite)
- Form validation (empty field, bad format)
- Background operation feedback (account saved, name set)

### `parseAccountValue(account)` — `utilities.js`

Safely parses a stored account's JSON value. Returns the parsed object, or `null` if the value is missing or corrupt. Always use this instead of bare `JSON.parse(account.value)`.

```javascript
const parsedValue = parseAccountValue(account);
if (!parsedValue) return;           // skip corrupt entry in a loop
```

```javascript
const accountData = parseAccountValue(selectedAccount);
if (!accountData) {                 // single-account context
    showStatusMessage('Could not read account data — it may be corrupt.');
    return;
}
```

On parse failure it logs `console.error` with the account key, so corrupt entries are traceable without throwing.

---

## CSS classes

| Class | Style | When to use |
|-------|-------|-------------|
| `.error-message` | Red text, pink border/background | Hard failures requiring user action |
| `.feed-status-message` | Neutral grey | Soft/informational states: "No posts found", "Loading…" |

Both are defined in `reader.css`. Use `.error-message` inside feed containers when constructing error HTML manually (e.g. in `responseDiv`).

---

## Patterns by context

### Feed loading errors

Wrap the entire load function body in `try/catch`. On failure, clear the container and call `showServiceError`:

```javascript
async function loadSomeFeed(type) {
    const feedContainer = document.getElementById('feed-container');
    try {
        // ... fetch and display ...
    } catch (error) {
        console.error(`Error fetching ${type}:`, error);
        feedContainer.innerHTML = '';
        showServiceError(feedContainer, 'Service error', error.message,
            'Check your credentials under <strong>Accounts</strong>, or try again.');
    }
}
```

### Action errors (bookmark, boost, post)

Use `showStatusMessage` — these are transient:

```javascript
} catch (error) {
    console.error('Error boosting:', error);
    showStatusMessage('Failed to boost: ' + error.message);
    return false;
}
```

### Form validation

Use `showStatusMessage` for simple checks; use an inline `responseDiv` message for post forms where the response area is already visible:

```javascript
// Simple validation
if (!inputValue) {
    showStatusMessage('Please enter a value.');
    return;
}

// Post form with a dedicated result area
if (statusText === '') {
    responseDiv.innerHTML = `<p class="error-message">Please enter a status before posting.</p>`;
    return;
}
```

### Decryption / encryption failures

`decryptWithKey` and `encryptWithKey` (from `crypto_utils.js`) are async and can throw — always wrap them.

**In a loop** (building an account list): catch, log, and continue. Do not surface per-entry errors in the UI — they produce noise when the list is large.

```javascript
try {
    const decryptedString = await decryptWithKey(encKey, kv.value);
    parsedValue = decryptedString ? JSON.parse(decryptedString) : null;
} catch (err) {
    console.error(`Decryption failed for key "${kv.key}" — entry may be unreadable or from a different key.`, err);
}
```

If `parsedValue` is `null` after the loop iteration, render the entry with a fallback label and an `account-button--unreadable` class so it's visually distinguishable but not blocking.

**In a save operation**: catch and show `showStatusMessage` — the user must know the save failed.

```javascript
let encryptedValue;
try {
    encryptedValue = await encryptWithKey(encKey, JSON.stringify(data));
} catch (err) {
    console.error('Encryption failed:', err);
    showStatusMessage('Could not save — encryption failed. ' + err.message);
    return;
}
```

**Common root cause**: `crypto_utils.js` not loaded in the page. If every entry fails to decrypt, check that `<script src="js/crypto_utils.js"></script>` is present.

---

### Fire-and-forget async calls

Any `async` function called without `await` **must** have a `.catch()` — otherwise a rejection becomes unhandled and silent:

```javascript
// Wrong
fetchPinnedFeeds();

// Correct
fetchPinnedFeeds().catch(err => showStatusMessage('Could not load pinned feeds: ' + err.message));
```

### Session / credential setup functions

Functions like `createBlueskySession()` that are called from feed-loading callers should `throw` on failure rather than `alert`. The caller's catch block handles display:

```javascript
// In the session setup function — just throw
if (!appPassword || !handle) {
    throw new Error('No Bluesky account found. Open Accounts and add a Bluesky account.');
}

// In the feed-loading caller — catch and show
} catch (error) {
    showServiceError('feed-container', 'Bluesky error', error.message,
        'Check your Bluesky account credentials under <strong>Accounts</strong>.');
}
```

---

## What to keep

- `console.error()` alongside a UI message — keep it for debugging; don't remove it
- Soft empty-state messages using `.feed-status-message` — these are correct and intentional
- `response.ok` checks that `throw` — the outer `catch` handles display

### P2P chat errors (dynamicp2p.js)

The chat pane has no `#statusPane`. Use `appendMessage(text, true)` to surface errors inline in the chat transcript:

```javascript
} catch (e) {
    console.error('Chat connection error:', e)
    appendMessage('Connection failed: ' + e.message, true)
}
```

Use the second argument `true` to mark the message as a system/error line (distinct styling from user messages).

### Standalone page errors (share page, etc.)

Pages served by backend services (e.g. the collab share page at `/doc/…/edit`) have no access to CList utility functions. In this context:

- Display errors inline with DOM methods: create an element, set `.textContent`, append it.
- For input validation, show an inline error span and a red border — do **not** close the form.
- **Never** use `alert()`, `prompt()`, or `confirm()` — these block the UI and are prohibited everywhere, including standalone pages.

```javascript
// Inline validation feedback on a standalone page
const err = document.getElementById('link-err')
if (!/^https?:\/\//i.test(url)) {
    inp.style.borderColor = '#c00'
    err.style.display = 'inline'
    return
}
```

---

## What to avoid

- `alert()` — anywhere, for any reason
- `prompt()` or `confirm()` — anywhere, for any reason
- `catch (e) { console.error(e) }` with no UI feedback
- Setting `feedContainer.innerHTML` to a plain string error — use `showServiceError` instead
- Bare `await someAsyncFn()` at the call site without try/catch or `.catch()`
- `innerHTML` with peer-supplied or server-supplied data — use DOM methods and validate CSS values
