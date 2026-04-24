# CList Account Schema System

Accounts are credentials stored in the kvstore (encrypted). Each account has a **type** (Mastodon, Bluesky, OPML, etc.) and a set of fields defined by that type's schema. The schema drives both the edit form in `flasker.html` and the shape of the JSON saved to the kvstore.

---

## Storage format

Each account is a kvstore entry:

```
key   — the account's unique identifier (username, URL, or project ID depending on type)
value — AES-GCM encrypted JSON string (see crypto_utils.js)
```

The decrypted JSON has this shape:

```js
{
    type:        string,   // service type — 'Mastodon', 'Bluesky', 'OPML', etc.
    instance:    string,   // account identifier used by runtime code (see below)
    title:       string,   // human-readable display name
    permissions: string,   // permission flags: r=read, w=write, e=edit, s=summarize,
                           //                   t=translate, g=generate, p=proxy
    id:          string,   // credential (access token, app password, API key, etc.)
                           // absent for types that have no credential (e.g. Proxyp)
    // ...additional fields defined by the schema
}
```

### The `instance` field

`instance` is read by nearly all runtime code (`reader.js`, `publish.js`, `bluesky.js`, etc.) to identify which server or endpoint to contact. Its value depends on `instanceFromKey` in the schema:

- **`instanceFromKey: true`** — `instance` is automatically set equal to the kvstore `key` on save. This covers all types where the key IS the account identifier (e.g. `downes@mastodon.social`, `downes.bsky.social`, `https://example.com/feeds.opml`).
- **`instanceFromKey: false`** — `instance` is an explicit field the user fills in, separate from the key. Used when the key and the API endpoint differ (currently: AI accounts, where the key is a project ID and `instance` is the API URL).

---

## Schema definition

Each service defines its schema at the top of its `.js` file by registering into `window.accountSchemas`:

```js
window.accountSchemas = window.accountSchemas || {};
window.accountSchemas['TypeName'] = {
    type:            string,    // must match the type stored in instanceData
    instanceFromKey: boolean,   // true: instance = kvstore key on save
    kvKey: {
        label:       string,    // form label for the key field
        placeholder: string,    // hint text
    },
    fields: [
        {
            key:         string,    // property name in stored instanceData JSON
            label:       string,    // form label
            inputType:   string,    // 'text' | 'password' | 'oauth'
            placeholder: string,
            editable:    boolean,   // false = display-only when editing; always editable on create
            default:     string,    // value used when field is absent from stored data
        },
        // ...
    ]
};
```

### `editable` flag behaviour

| Mode   | `editable: true`  | `editable: false`            |
|--------|-------------------|------------------------------|
| create | text/password input (all fields editable) | text/password input |
| edit   | text/password input | display text + hidden input  |

The kvstore `key` field follows the same rule: always editable on create, always display-only on edit (changing the key would create a new entry rather than update the existing one).

### `inputType: 'oauth'`

Used for credentials obtained via OAuth redirect rather than direct entry (currently Mastodon only). In both modes the stored token is shown as `(token stored)` or `(no token)`. In edit mode a **Re-authorize** button calls `window.top.mastodonOAuthStart(title, username, permissions)`.

New account creation for Mastodon is special-cased in `selectAccountType()` in `flasker.html` — it shows a username input and redirects to the instance's OAuth authorize endpoint rather than using the generic form.

---

## Schemas by service

| File | Type | kvKey | editable fields | non-editable fields |
|------|------|-------|-----------------|---------------------|
| `mastodon.js` | Mastodon | Username (`you@mastodon.social`) | title, permissions | id (oauth) |
| `bluesky.js` | Bluesky | Username (`you.bsky.social`) | title, permissions, id | — |
| `opml.js` | OPML | OPML URL | title, permissions, id (API endpoint) | — |
| `wordpress.js` | WordPress | Username (`you@site`) | title, permissions, id (API key) | — |
| `blogger.js` | Blogger | Blog ID | title, permissions, id (client ID) | — |
| `etherpad.js` | Etherpad | Etherpad API URL | title, permissions, id (proxy URL) | — |
| `chatgpt.js` | AI | Project | title, instance (API URL), permissions, id (API key) | — |
| `kvstore.js` | Proxyp | Proxy URL | title, permissions | — (no id field) |

AI accounts have `instanceFromKey: false` — `instance` (the API URL) is an explicit editable field, separate from the project key.

---

## Runtime use of account data

When an account is selected (`switchReaderAccount` in `reader.js`), the decrypted JSON is available as `accountData`:

```js
accountData.type        // determines which handler/service to call
accountData.instance    // server URL or account identifier passed to initialize()
accountData.id          // credential (access token, password, API key)
accountData.title       // display name shown in #selectedAccount
accountData.permissions // checked by publish.js, editors.js, summarize.js, etc.
```

The accounts array is populated by `getAccounts(flaskSiteUrl)` in `kvstore.js`, which fetches, decrypts, and parses all kvstore entries. Individual service files (e.g. `bluesky.js`, `chatgpt.js`) also iterate `accounts` directly to find their own credentials by type or permission flag.

---

## Service UI standards

Each service file must follow these conventions consistently across all services.

### Feed buttons

Feed action buttons are registered via `window.readerHandlers['Type']` with an `initialize` function and a `feedFunctions` object. They are rendered automatically by `setupFeedButtons()` in `interface.js` — no manual button HTML is needed.

### Status messages — `.feed-status-message`

All inline status messages written to `feedContainer` (errors, empty results, prompts to enter a value) must use the `feed-status-message` CSS class:

```js
feedContainer.innerHTML = `<p class="feed-status-message">Some message here.</p>`;
```

This class (defined in `reader.css`) adds margin, padding, a light border, and rounded corners so messages don't abut the edge of the feed container. It applies to all message types: errors, "no content" notices, and user prompts (e.g. "Please enter a hashtag.").

---

## Adding a new account type

1. In the service's `.js` file, register a schema:
   ```js
   window.accountSchemas = window.accountSchemas || {};
   window.accountSchemas['MyType'] = { type, instanceFromKey, kvKey, fields };
   ```
2. Add a button for the new type in `showTypePicker()` in `flasker.html`.
3. Implement the service handler (`initialize`, `feedFunctions`, `statusActions`) and register it in `window.readerHandlers['MyType']` if it supports reading.
4. Handle `accountData.type === 'MyType'` in `publish.js` if it supports writing.

The form, save, and load are handled automatically by the schema — no changes to `flasker.html` form logic are needed.
