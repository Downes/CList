# Publishing Services in CList

This document describes how to add a service that receives content from the CList editor and publishes it to an external platform — Mastodon, WordPress, Bluesky, Blogger, or any similar target.

For services that also read feeds, save files, or load content, see `adding-a-service.md`.

---

## How publishing works

When the user clicks **Publish**, `postAll()` in `publish.js`:

1. Calls `packagePost()` to collect the write-pane title and editor content as an HTML string.
2. Reads the list of accounts the user has selected (those with `'w'` in their `permissions` field).
3. Sorts selected accounts by `maxlength` descending — unlimited accounts publish first, so their URL is available for length-limited accounts.
4. For each account in order:
   - Calls `handler.construct(title, content)` if defined; otherwise uses the raw HTML.
   - If the result fits within `maxlength`, passes it to `handler.publish()` as-is.
   - If it is too long but a URL was already returned by an earlier account, assembles `"opening… see <url>"` within the limit.
   - If it is too long and no URL exists yet, truncates and warns.
5. Passes the final content string to `handler.publish(accountData, title, content)`.

---

## Registering a publish handler

Wrap the registration in an IIFE so it does not pollute the global scope:

```javascript
(function () {
    window.publishHandlers = window.publishHandlers || {};
    window.publishHandlers['MyService'] = {
        construct: (title, content) => { /* optional — see below */ },
        publish:   async (accountData, title, content) => { /* required */ },
    };
})();
```

The key (`'MyService'`) must exactly match the `type` field in the account schema.

---

## `publish(accountData, title, content)`

The only required method. Called once for each selected account.

| Parameter | Type | Notes |
|---|---|---|
| `accountData` | object | Parsed account from kvstore — see shape below |
| `title` | string | Write-pane title; may contain HTML — strip if the service needs plain text |
| `content` | string | Post body; may be HTML — already truncated to `maxlength` by `postAll()` |
| returns | `string \| null` | Permanent URL of the published post, or `null` |

**Return the URL when the service provides one.** `postAll()` passes it to subsequent shorter-limit accounts so they can publish `"title see <url>"` rather than truncating.

### `accountData` shape

After `parseAccountValue(account)`:

| Field | Value |
|---|---|
| `accountData.type` | `'MyService'` — matches the registry key |
| `accountData.instance` | The kvstore key, e.g. `'you@myservice.example'` |
| `accountData.id` | The credential (access token, app password, API key) |
| `accountData.title` | Friendly display name |
| `accountData.permissions` | `'r'`, `'w'`, or `'rw'` |
| `accountData.maxlength` | String, e.g. `'500'`; absent or `''` means unlimited |

### Minimal example

```javascript
publish: async (accountData, title, content) => {
    try {
        const res = await fetch('https://api.myservice.example/v1/posts', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + accountData.id,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ text: content }),
        });
        if (!res.ok) throw new Error('Server returned ' + res.status);
        const data = await res.json();
        return data.url || null;
    } catch (e) {
        console.error('MyService publish failed:', e);
        showStatusMessage('MyService: ' + e.message);
        return null;
    }
},
```

---

## `construct(title, content)` — optional

Called by `postAll()` *before* length checking. Use it to build the text that should be measured and (if needed) truncated — this is distinct from what `publish()` ultimately sends.

Typical uses:
- Strip HTML so the character count reflects what the service actually receives
- Prepend the title to the body
- Format the text for the platform's conventions

```javascript
construct: (title, content) => {
    const t = removeHtml(title).trim();
    const b = removeHtml(content).trim();
    return t ? t + '\n\n' + b : b;
},
```

If `construct` is absent, `postAll()` uses the raw HTML string for measurement.

---

## Account schema fields for publishing services

The `accountSchemas` entry drives the Accounts panel form. For a publish-only service:

```javascript
window.accountSchemas['MyService'] = {
    type: 'MyService',
    instanceFromKey: true,
    kvKey: { label: 'Username', placeholder: 'you@myservice.example' },
    fields: [
        { key: 'title',       label: 'Account name',   editable: true,  inputType: 'text',     placeholder: 'My Account', default: '' },
        { key: 'permissions', label: 'Permissions',    editable: true,  inputType: 'text',     placeholder: 'w',          default: 'w' },
        { key: 'id',          label: 'API token',      editable: true,  inputType: 'password', placeholder: '',           default: '' },
    ]
};
```

### `permissions`

Controls which panes show this account:
- `'r'` — Read pane only
- `'w'` — Post pane only
- `'rw'` — both

### `maxlength`

Add this field for services that enforce a character limit (microblogging, etc.). Omit it for services with no practical limit (blogs, WordPress, etc.).

```javascript
{ key: 'maxlength', label: 'Maximum Length', editable: true, inputType: 'text', placeholder: '500', default: '500' }
```

`postAll()` reads `accountData.maxlength` to sort accounts and decide whether to truncate or reference-link. Accounts without `maxlength` (or with an empty value) are treated as unlimited and publish first.

---

## Content helpers

All defined in `utilities.js`:

| Function | Returns | Use for |
|---|---|---|
| `removeHtml(html)` | plain text | Strip all tags; preserves `link-text url` pairs from `<a href>` |
| `processHtml(html)` | plain text with `\n` | Convert `<p>`, `<br>`, `<div>` to newlines; strip remaining tags |
| `extractBaseUrl(instance)` | `'https://instance.example'` | Parse base URL from `user@instance.example` |
| `extractAccountName(instance)` | `'user'` | Parse username part before `@` |
| `truncateToGraphemeLimit(text, n)` | string | Safe Unicode truncation (counts grapheme clusters, not code units) |

---

## Error handling

Follow `docs/error-handling.md`. For publish handlers specifically:

- **Use `showStatusMessage`** for publish failures — these are transient action results, not hard load failures.
- **Always `return null`** after catching an error, so `postAll()` can continue with the next account.
- **Never use `alert()`** — anywhere.
- Keep `console.error()` alongside the `showStatusMessage` call.

```javascript
} catch (e) {
    console.error('MyService publish failed:', e);
    showStatusMessage('MyService publish failed: ' + e.message);
    return null;
}
```

---

## Existing services as reference

| Service | HTML or plain | Returns URL | Has `maxlength` | Notes |
|---|---|---|---|---|
| WordPress | HTML | yes | no | Uses Basic Auth; `publishPost()` helper |
| Blogger | HTML | yes | no | OAuth via Google GIS token client |
| Mastodon | plain text | no | yes (default 500) | `removeHtml()` in `publish()`; OAuth token in `id` |
| Bluesky | plain text | no | no | App password in `id`; session created lazily |

---

## Complete example — plain-text microblog service

```javascript
// js/myservice.js

window.accountSchemas = window.accountSchemas || {};
window.accountSchemas['MyService'] = {
    type: 'MyService',
    instanceFromKey: true,
    kvKey: { label: 'Username', placeholder: 'you@myservice.example' },
    fields: [
        { key: 'title',     label: 'Account name',   editable: true, inputType: 'text',     placeholder: 'My Account', default: '' },
        { key: 'permissions', label: 'Permissions',  editable: true, inputType: 'text',     placeholder: 'w',          default: 'w' },
        { key: 'id',        label: 'API token',      editable: true, inputType: 'password', placeholder: '',           default: '' },
        { key: 'maxlength', label: 'Maximum Length', editable: true, inputType: 'text',     placeholder: '300',        default: '300' },
    ]
};

(function () {
    window.publishHandlers = window.publishHandlers || {};
    window.publishHandlers['MyService'] = {

        // Build plain text for length measurement
        construct: (title, content) => {
            const t = removeHtml(title).trim();
            const b = removeHtml(content).trim();
            return t ? t + '\n\n' + b : b;
        },

        // Send to the API; content is already truncated by postAll()
        publish: async (accountData, title, content) => {
            try {
                const res = await fetch(extractBaseUrl(accountData.instance) + '/api/v1/posts', {
                    method: 'POST',
                    headers: {
                        'Authorization': 'Bearer ' + accountData.id,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ text: content }),
                });
                if (!res.ok) throw new Error('Server returned ' + res.status);
                const data = await res.json();
                return data.url || null;
            } catch (e) {
                console.error('MyService publish failed:', e);
                showStatusMessage('MyService: ' + e.message);
                return null;
            }
        },
    };
})();
```

Add to `index.html` before `interface.js`:
```html
<script src="js/myservice.js" defer></script>
```
