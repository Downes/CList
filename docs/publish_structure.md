# Publishing services in CList

Verified against the current client implementation, 2026-11-13. This describes
implemented contracts, including the remaining legacy paths, rather than a future API.

## Choose the integration contract

| Purpose | Registry / entry point | Result |
|---|---|---|
| Publish a post to a platform | `CList.publishers[type].publish` | Post URL string, or `null` |
| Publish a serialized page or collection | `CList.binPublishers[type]` | `{ url, serviceId }` from `publish` |
| Persist personal feed membership | `CList.readers[type].saveCollection` | Resolve on success; throw on failure |
| Save an editor document | `CList.savers` | Existing save-handler contract |

Platform accounts use permission `w`; bin/page publishers use `b`. Collection
subscription persistence is not public publication. Its contract is in
[collection-publishing.md](collection-publishing.md). Registration and account
schemas are covered by [adding-a-service.md](adding-a-service.md).

## Ordinary post workflow

`postAll()` in `js/publish.js` guards the operation with
`CList.state.publishing.busy`. It captures a request, invokes `_postAllSelected`,
and always restores busy/progress presentation in `finally`.

`capturePublicationRequest()` returns:

```js
{
    title,                  // captured title, trimmed
    references,             // detached reference snapshots
    selectedAccountKeys,    // copied from publishing state, not buttons
    accountStoreUrl,         // selected account-store URL
    content                 // packaged editor output
}
```

`readPublicationFields()` in `ui.js` is the control-reading boundary.
`packagePost({ forPublishing: true, title, referenceHtml })` in `files.js` obtains
content through the active editor's API: awaited `getPostContent()` when supplied,
otherwise awaited `getContent()`. It packages title, body, and reference HTML.
Do not extract TinyMCE or collaborative editor contents by reading their mounting
container. See [editors_structure.md](editors_structure.md) for the different
post, web-page, and native-document content getters.

`_postAllSelected(request)` then:

1. Reloads accounts through `getAccounts(request.accountStoreUrl)`, resolves the
   captured keys, and checks current `w` permission. The DOM cannot change targets.
2. Sorts valid accounts by positive `maxlength`, largest first. An absent, empty,
   invalid, or nonpositive limit is treated as unlimited.
3. Calls optional `construct(title, content)` before measuring the candidate.
4. Publishes full content first. A later limited destination can use an earlier
   returned URL in an opening/title plus `see <url>` message. Without a URL, the
   controller warns and truncates. This controller uses JavaScript string length;
   service handlers may additionally enforce platform-specific grapheme limits.
5. Calls each handler with a separate clone of the captured references. A thrown
   destination error is presented and the remaining destinations are attempted.
6. Presents returned links. A missing link is explicitly unconfirmed: the user
   should check the destination before retrying. A successful primary URL is also
   passed to the existing WebMention path when available.

Selection belongs to `CList.state.publishing.selectedAccountKeys`.
`reconcilePublishSelection`, `togglePublishSelection`, and the selection renderer
manage it; button attributes only reflect it. Logout/account-store changes clear
incompatible selections. Publication records for local pages remain in PageStore.

## Platform publisher contract

```js
window.CList.publishers.MyService = {
    // Optional collection serialization preference, not ordinary-post conversion.
    acceptedFormats: ['html', 'text'],
    construct: (title, content) => removeHtml(content), // optional
    publish: async (accountData, title, content, refs, options = {}) => {
        const response = await fetch('https://service.example/posts', {
            method: 'POST',
            headers: {
                Authorization: 'Bearer ' + accountData.id,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ title, content }),
        });
        if (!response.ok) throw new Error('Post request failed (HTTP ' + response.status + ')');
        const data = await response.json();
        return data.url || null;
    },
};
```

| Argument | Meaning |
|---|---|
| `accountData` | Full parsed account; `type`, `instance`, `title`, `permissions`, and service-specific credentials |
| `title` | Captured title; remove HTML if the service requires plain text |
| `content` | Constructed/limited post content; may contain HTML |
| `refs` | Reference snapshots; reply context is in `replyToken`, scoped by its `type` |
| `options` | Optional operation inputs; ordinary multi-posting currently supplies `onProgress` |
| Return value | A published URL string, or `null`; not a bin-publisher result object |

Keep `refs` and `options` optional: `postContentByType()` calls the three-argument
form, and collection publishing calls `publish(accountData, title, content, [])`
without progress options. Do not read editor controls or publishing buttons inside
new service operations. Use `parseAccountValue()` to decode account wrappers.

The account schema key must match the registry key. `maxlength` is an account
field; it is not inferred from `acceptedFormats`. Credentials are service-specific:
`id` is common but not universal. Use `CList.keys` constants for storage-key names.

## Progress, errors, and compatibility

New/extracted operations return data and throw useful errors. They must not also
show a modal or write to a result element: `reportPublisherError` and the invoking
view handle that once. A service may catch an error to add context and rethrow it.
Never automatically retry an external write whose outcome is uncertain.

WordPress is the extracted reference implementation. Its registered handler calls
`publishPost(instance, username, password, title, content, options)`, uploads and
deduplicates embedded images before creating the post, and reports data through:

```js
options.onProgress?.({ stage: 'uploading-images', completed, total });
options.onProgress?.({ stage: 'creating-post' });
```

The publishing controller translates progress through `renderPublisherProgress`.
WordPress propagates API errors, timeout uncertainty, and an accepted post with no
valid link. HTML parsing for content conversion is permitted; mounting UI or
writing result markup in that operation is not.

Migration is incomplete. Some existing platform handlers, including Mastodon and
Bluesky, still display their own feedback and return `null`. They are compatibility
paths, not the recommended error-handling pattern for new integrations. The main
post controller and web-page workflow also retain some UI/state coupling. The
current string-or-null result contract has not been replaced by a universal
`{ id, url, status }` result API.

## Collections and web pages

`playPost()` dispatches the Collection editor to `playCollectionPublish()` rather
than the ordinary request pipeline. Collection publishing resolves export formats,
publishes full-content destinations before link destinations, and records published
URLs. Its selection still lives in button attributes; it has not received the same
state extraction as ordinary post selection.

`postToWebPage()` is a separate path through `CList.binPublishers.CListBin`.
`_getWebPageEditorContent()` prefers the editor's `getPublishContent()` result
`{ type, value }`, falling back to `getContent()` and the editor's native type.
For example, slides can publish viewable HTML while retaining their native format
for saving. This is different from `getPostContent()`, which supplies social/blog
post content. See [collection-publishing.md](collection-publishing.md) for bin
adapters, page records, and Republish.

## Verification

The mocked browser fixtures in `tests/README.md` cover post selection, publication
request capture, WordPress errors/progress, and success feedback. Collection save
request/controller and feed-account checks run with Node as documented there.
These checks do not publish live content or establish a remote deployment's health.
