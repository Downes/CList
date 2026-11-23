/// <reference path="./clist-types.js" />
// Copyright Stephen Downes 2026. CC BY 4.0; provided AS IS, without warranty.

window.CList.schemas = window.CList.schemas || {};
window.CList.schemas['gRSShopper'] = {
    type: 'gRSShopper',
    instanceFromKey: true,
    kvKey: { label: 'Site URL', placeholder: 'https://www.downes.ca' },
    fields: [
        { key: 'title',       label: 'Title',       editable: true, inputType: 'text', placeholder: 'gRSShopper', default: 'gRSShopper' },
        { key: 'apiToken',    label: 'API Token',   editable: true, inputType: 'text', placeholder: 'Your gRSShopper CList API token', default: '' },
        { key: 'permissions', label: 'Permissions', editable: true, inputType: 'text', placeholder: 'rw', default: 'rw' },
    ]
};

// Raw call to gRSShopper's token-authenticated cmd=clist_publish endpoint (api/clist.pl's
// api_clist_publish) — creates a post_type='link' record, or updates one in place when
// fields.id is given (api_clist_publish accepts an optional post id; omitted, it dedups by
// link via find_duplicate_post). Shared by grsshopperCreate below (the annotation-pipeline
// adapter) and grsshopper-editor.js's Publish pane, which has no "annotation" framing at all —
// just its own Title/Link/Author/Feed fields and a post id to update once one exists.
/** @param {CListAccountData} account
 * @param {{title: string, description: string, link: string, author?: string, feed?: string, content?: string, id?: string}} fields
 * @returns {Promise<{id: string, url: string}>} */
window.grsshopperSavePost = async function(account, fields) {
    if (!account.apiToken) throw new Error('No gRSShopper API token - check Account Settings.');
    const base = (account.instance || '').replace(/\/$/, '');
    const body = {
        token:       account.apiToken,
        title:       fields.title,
        description: fields.description || '',
        link:        fields.link,
        author:      fields.author || '',
        feed:        fields.feed || '',
        content:     fields.content || '',
    };
    if (fields.id) body.id = fields.id;
    let response;
    try {
        response = await fetch(`${base}/cgi-bin/api.cgi?cmd=clist_publish`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        });
    } catch (error) {
        throw Object.assign(new Error('Connection lost; check gRSShopper before retrying.'), { outcome: 'uncertain' });
    }
    const data = await response.json().catch(() => null);
    if (!response.ok || !data || data.status !== 'OK')
        throw new Error('gRSShopper publish failed: ' + (data?.message || response.status));
    return { id: String(data.post_id), url: data.url };
};

// Post a new annotation to gRSShopper as a post_type='link' record. payload matches
// runAnnotationWorkflow's create() contract: { target_url, body, tags, visibility, motivation,
// target_selector? }. target_selector (title/author_name/feed - see captureAnnotationRequest)
// carries the annotated article's real metadata when the caller requested it (the Annotate
// editor's Title/Author/Feed fields); falls back to a synthesized title when absent.
// Create-only — nothing in the current annotation pipeline carries a postId to update with.
/** @param {CListAccountData} account
 * @param {Object} payload
 * @returns {Promise<Object>} */
window.grsshopperCreate = async function(account, payload) {
    const selector = payload.target_selector || {};
    return window.grsshopperSavePost(account, {
        title:       selector.title || (payload.body || 'Annotation').split('\n')[0].slice(0, 80) || 'Annotation',
        description: payload.body || '',
        link:        payload.target_url,
        author:      selector.author_name || '',
        feed:        selector.feed || '',
    });
};

// Hosts a remote URL (e.g. a feed item's image - see grsshopper-editor.js's Upload pane)
// as a local file on this gRSShopper site, without requiring an existing post to attach it to. Calls the token-authenticated
// cmd=clist_upload endpoint (api/clist.pl's api_clist_upload), which reuses gRSShopper's
// own upload_url()/save_file() (dedup by source URL already built in - re-citing the same
// feed image won't re-fetch or re-store it). Registered under window.CList.uploaders so any
// editor can offer file upload the same way editors offer publish via window.CList.publishers.
/** @param {CListAccountData} account
 * @param {string} sourceUrl
 * @returns {Promise<{url: string, fileId: string}>} */
window.CList.uploaders = window.CList.uploaders || {};
window.CList.uploaders.gRSShopper = {
    async uploadFromUrl(account, sourceUrl) {
        if (!account.apiToken) throw new Error('No gRSShopper API token - check Account Settings.');
        const base = (account.instance || '').replace(/\/$/, '');
        let response;
        try {
            response = await fetch(`${base}/cgi-bin/api.cgi?cmd=clist_upload`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: account.apiToken, source_url: sourceUrl }),
            });
        } catch (error) {
            throw Object.assign(new Error('Connection lost; check gRSShopper before retrying.'), { outcome: 'uncertain' });
        }
        const data = await response.json().catch(() => null);
        if (!response.ok || !data || data.status !== 'OK')
            throw new Error('gRSShopper upload failed: ' + (data?.message || response.status));
        return { url: data.url, fileId: String(data.file_id) };
    },

    // The deferred step of grsshopper-editor.js's three-step upload flow: nothing is sent to
    // gRSShopper until a post exists, so this always carries postId and performs the file
    // save *and* the graph-link (post <-> file) in a single request — cmd=clist_upload_for_post
    // (api/clist.pl's api_clist_upload_for_post), unlike cmd=clist_upload above which only ever
    // creates an unlinked file. Takes either a remote sourceUrl (reuses upload_url() server-side,
    // same as uploadFromUrl) or a local `file` (File/Blob from a <input type="file">), read here
    // into base64 since the token-authenticated JSON API has no multipart form.
    /** @param {CListAccountData} account
     * @param {{postId: string, sourceUrl?: string, file?: File}} selection
     * @returns {Promise<{url: string, fileId: string}>} */
    async uploadForPost(account, { postId, sourceUrl, file }) {
        if (!account.apiToken) throw new Error('No gRSShopper API token - check Account Settings.');
        const base = (account.instance || '').replace(/\/$/, '');
        const body = { token: account.apiToken, post_id: postId };
        if (file) {
            body.filename = file.name;
            body.data = await _grsshopperFileToBase64(file);
        } else if (sourceUrl) {
            body.source_url = sourceUrl;
        } else {
            throw new Error('No file or source URL to upload.');
        }
        let response;
        try {
            response = await fetch(`${base}/cgi-bin/api.cgi?cmd=clist_upload_for_post`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
            });
        } catch (error) {
            throw Object.assign(new Error('Connection lost; check gRSShopper before retrying.'), { outcome: 'uncertain' });
        }
        const data = await response.json().catch(() => null);
        if (!response.ok || !data || data.status !== 'OK')
            throw new Error('gRSShopper upload failed: ' + (data?.message || response.status));
        return { url: data.url, fileId: String(data.file_id) };
    },
};

// Reads a File/Blob into a bare base64 string (no "data:...;base64," prefix) for
// uploadForPost's JSON body. Local helper, not a general utilities.js candidate —
// specific to this one upload path.
function _grsshopperFileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',', 2)[1] || '');
        reader.onerror = () => reject(new Error('Could not read the selected file.'));
        reader.readAsDataURL(file);
    });
}

window.CList.publishers.gRSShopper = {
    construct(title, post) {
        const parsed = new DOMParser().parseFromString(post, 'text/html');
        const body = parsed.getElementById('post-content');
        return body ? body.innerHTML.trim() : post;
    },
    publish(account, title, content, refs = [], options = {}) {
        return publishAnnotationAccount(account, content, refs, options);
    },
};
