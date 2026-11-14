# CList Account Schema System

Accounts are credentials stored in the kvstore (encrypted). Each account has a **type** (Mastodon, Bluesky, PublicFeed, LOCALRSS, etc.) and a set of fields defined by that type's schema. The schema drives the Manage Accounts form in `js/account-form.js` and the JSON saved through the selected local or remote account store.

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
    type:        string,   // service type — 'Mastodon', 'Bluesky', 'PublicFeed', 'LOCALRSS', etc.
    instance:    string,   // account identifier used by runtime code (see below)
    title:       string,   // human-readable display name
    permissions: string,   // permission flags — see table below
    id:          string,   // credential (access token, app password, API key, etc.)
                           // absent for types that have no credential (e.g. Proxyp, Collab)
    // ...additional fields defined by the schema
}
```

### The `instance` field

`instance` is read by nearly all runtime code (`reader.js`, `publish.js`, `bluesky.js`, etc.) to identify which server or endpoint to contact. Its value depends on `instanceFromKey` in the schema:

- **`instanceFromKey: true`** — `instance` is automatically set equal to the kvstore `key` on save. This covers all types where the key IS the account identifier (e.g. `downes@mastodon.social`, `downes.bsky.social`, `https://example.com/feeds.opml`).
- **`instanceFromKey: false`** — `instance` is an explicit field the user fills in, separate from the key. Used when the key and the API endpoint differ (currently: AI accounts, where the key is a project ID and `instance` is the API URL).

### Permissions flags

The `permissions` string is checked with `includes()`, so a single account can carry multiple flags (e.g. `'rw'` or `'rwe'`).

| Flag | Checked by | Effect |
|------|------------|--------|
| `r`  | `reader.js` | Shown in the **Read** account list |
| `w`  | `publish.js`, `kvstore.js` | Shown in the **Post** publish list; accepted as a kvstore write credential |
| `p`  | `kvstore.js` | Marks a kvstore credential store account |
| `e`  | `editors.js` | Shown as an available **Editor** (Etherpad, Collab) |
| `t`  | `translate.js` | Used as the **Translation** service |
| `g`  | `chatgpt.js` | Used as the **AI assistant** |
| `z`  | `summarize.js` | Used as the **Summarize** service |
| `s`  | Historical reader model | Legacy relay/subscription flag; not used to register the current feed collection readers |
| `b`  | `collections.js`, `publish.js` | Marks a bin/publish account; shown in the publish-to selector of the collection editor and any other "publish page" UI |

---

## Schema definition

Each service defines its schema at the top of its `.js` file by registering into `window.CList.schemas`:

```js
window.CList.schemas = window.CList.schemas || {};
window.CList.schemas['TypeName'] = {
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
            inputType:   string,    // 'text' | 'password' | 'oauth' | 'hidden'
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

New account creation for Mastodon is special-cased in `selectAccountType()` in `js/kvstore.js` — it shows a username input and redirects to the instance's OAuth authorize endpoint rather than using the generic form.

---

## Schemas by service

| File | Type | kvKey | editable fields | non-editable fields |
|------|------|-------|-----------------|---------------------|
| `mastodon.js` | Mastodon | Username (`you@mastodon.social`) | title, permissions, maxlength | id (oauth) |
| `bluesky.js` | Bluesky | Username (`you.bsky.social`) | title, permissions, id | — |
| `wordpress.js` | WordPress | Username (`you@site`) | title, permissions, id (API key) | — |
| `blogger.js` | Blogger | Blog ID | title, permissions, id (client ID) | — |
| `etherpad.js` | Etherpad | Etherpad API URL | title, permissions, id (proxy URL) | — |
| `collab.js` | Collab | WebSocket URL (`wss://…`) | title, permissions | — (no id; `e` flag) |
| `chatgpt.js` | AI | Project ID | title, instance (API URL), permissions, id (API key) | — |
| `annotate.js` | Annotate | Store URL | title, permissions | — |
| `hypothesis.js` | Hypothesis | Server URL | title, username, apiKey, permissions | — |
| `kvstore.js` | Proxyp | Proxy URL | title, permissions | — (no id field) |
| `jsonbin.js` | JSONBin | Label | title, permissions, id (X-Master-Key) | — (`b` flag) |
| `gist.js` | Gist | Label | title, permissions, id (GitHub PAT) | — (`b` flag) |
| `0x0.js` | 0x0 | Label | title, permissions | — (no id; anonymous; `b` flag) |
| `clistbin.js` | CListBin | Instance URL | title, permissions (current kvstore session supplies the Bearer token) | — (`b` flag) |
| `discord.js` | Discord | Account label (free text) | title, permissions, channel, bot_token | — |

AI accounts have `instanceFromKey: false` — `instance` (the API URL) is an explicit editable field, separate from the project key.

Discord accounts also have `instanceFromKey: false` — there is no per-account server URL (the bridge's base URL is a fixed constant in `discord.js`), so `instanceFromKey` is simply unused for this type and the kvstore key is a free-text label the user chooses.

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

The accounts array is populated by `getAccounts(flaskSiteUrl)` in `kvstore.js`, which delegates decoding to `loadAccountRecords(session)` in `account-state.js`. Individual service files (e.g. `bluesky.js`, `chatgpt.js`) also iterate `accounts` directly to find their own credentials by type or permission flag.

---

## Service UI standards

Each service file must follow these conventions consistently across all services.

### Reader handler shape

Reader handlers are registered in `window.CList.readers` and dispatched to by `reader.js` without any service-specific branching:

```js
(function () {
    window.CList.readers['MyService'] = {
        initialize:    async (accountData) => { … },  // called when account is selected
        feedFunctions: { 'Timeline': fn, … },         // rendered as buttons in #feed-menu
        onFeedClick:   (item) => { … },               // null = feed name not clickable
        onAuthorClick: (item) => { … },               // null = author name not clickable
        statusActions: (item, itemID, itemUrl) => htmlString,  // per-item action buttons
    };
})();
```

`statusActions` returns an HTML string of **service-specific** buttons only. `makeListing()` always appends the collect and share buttons after these — do not include them.

See `docs/adding-a-service.md` for the complete pattern including the normalization function and `renderFeed` usage.

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
   window.CList.schemas = window.CList.schemas || {};
   window.CList.schemas['MyType'] = { type, instanceFromKey, kvKey, fields };
   ```
2. Add a button for the new type to the type list in `showTypePicker()` in `js/account-panel.js`.
3. Implement the service handler and register it in `window.CList.readers['MyType']` if it supports reading.
4. Register `window.CList.publishers['MyType']` if it supports writing.

The form, save, and load are handled automatically by the schema — no service branches in `account-form.js` or `account-state.js` are needed. Use the optional account hooks for custom behaviour.

## Feed collection accounts and save operations

| Type | Account binding | Extra saved editor metadata |
|---|---|---|
| `PublicFeed` | `serviceUrl`, `collectionSlug`, optional personal `database` | `collectionItems`, `collectionId` |
| `LOCALRSS` | Configured `serviceUrl` and `database` | `collectionItems`, `collectionId`, existing `hasAudio` |

Both normally use `r` permission. The hidden `collectionItems` field is a JSON
string of the editor's full entries; `collectionId` preserves the collection's
identity. Hidden schema fields round-trip through account edits without becoming
user-facing inputs. Feed member `url` and `feed` are respectively the website and
subscription URLs. Reader `editCollection` and `saveCollection` capabilities
integrate these accounts with the combined Collections view and save controller.

New registration seeds PublicFeed accounts once. The first edit copies public
membership into a user-owned LocalRSS database. Deleting the account removes the
subscription; it does not delete the shared public collection. Session credentials
are supplied to service operations at runtime and are not saved in collection
metadata. See [collection-publishing.md](collection-publishing.md).

The old OPML/RSS `rss.js` account model is not the current reader implementation
in this checkout. Use PublicFeed or LOCALRSS rather than adding a dependency on
that removed module. The historical `s` permission description above is not a
new feed-reader integration contract.

Account keys are identifiers, not universally service URLs. In particular,
PublicFeed keys such as `public-feed:{serviceUrl}:{slug}` are opaque account keys;
feed services must use their schema's `serviceUrl`, `collectionSlug`, and
`database` fields. `getAccounts()` includes decrypted records only when their
`type` has a registered account schema, so ordinary `collection:*` and `page:*`
records do not become credentials or publishing destinations.


## Service account setup modules

`account-panel.js` owns the generic panel, navigation, and account list;
`account-form.js` renders schema fields and captures detached form values.
`account-state.js` loads, saves, and deletes account data without DOM access.
Custom Add Account UI is dispatched through `window.CList.accountFlows` factories,
instantiated once per panel. Mastodon, Dropbox, Collab, Annotate, and Discord
setup lives in their respective `service_account.js` files. Blogger and
WordPress setup remains in `blogger.js` and `wordpress.js`.

Service-owned edit behaviour uses optional `CList.accountHooks[type]` hooks:
`prepareSave(data)` validates/normalizes plain properties, `decorateForm(context)`
adds controls, and `reauthorize(request)` launches the existing OAuth helpers.
Hypothesis verification, PublicFeed collection editing, Discord administration,
LocalRSS OPML controls, and Mastodon/Dropbox reauthorization stay in their
respective service modules.

`getAccounts()` remains a compatibility wrapper in `kvstore.js`. Its login
feedback and retry behaviour remain there; its account decoding delegates to
`loadAccountRecords(session)` so the schema allowlist has one implementation.
The new panel calls the DOM-free loader directly. The current server and token
must still match the captured session before a save reaches storage.

A successful write is recorded before the panel refreshes. If refresh fails,
the saved/deleted result remains reflected locally, the form closes, and a
persistent message offers **Retry refresh**, which only reloads data. A failed
write retains the draft. Navigation keeps dirty drafts until the user saves or
discards them. Unknown account properties and hidden credentials survive edits.

Authentication, identity/DID controls, app settings, and custom service add-flow
controllers still retain legacy UI coupling. See `adding-a-service.md` for the
extension contract; this patch does not claim a complete UI/state migration.
