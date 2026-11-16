/// <reference path="./clist-types.js" />
// Copyright Stephen Downes 2026. CC BY 4.0; provided AS IS, without warranty.

window.CList.schemas = window.CList.schemas || {};
window.CList.schemas['gRSShopper'] = {
    type: 'gRSShopper',
    instanceFromKey: true,
    kvKey: { label: 'Site URL', placeholder: 'https://www.downes.ca' },
    fields: [
        { key: 'title',    label: 'Title',     editable: true, inputType: 'text', placeholder: 'gRSShopper', default: 'gRSShopper' },
        { key: 'apiToken', label: 'API Token', editable: true, inputType: 'text', placeholder: 'Your gRSShopper CList API token', default: '' },
    ]
};

// Post a new annotation to gRSShopper as a post_type='link' record (api/clist.pl's
// cmd=clist_publish). payload matches runAnnotationWorkflow's create() contract:
// { target_url, body, tags, visibility, motivation, target_selector? }. target_selector
// (title/author_name/feed - see captureAnnotationRequest) carries the annotated article's
// real metadata when the caller requested it (the Annotate editor's Title/Author/Feed fields);
// falls back to a synthesized title when absent. Create-only — gRSShopper's token-authenticated
// endpoint also supports updating an existing post by id, but nothing in the current annotation
// pipeline carries a postId to use it.
/** @param {CListAccountData} account
 * @param {Object} payload
 * @returns {Promise<Object>} */
window.grsshopperCreate = async function(account, payload) {
    if (!account.apiToken) throw new Error('No gRSShopper API token - check Account Settings.');
    const base = (account.instance || '').replace(/\/$/, '');
    const selector = payload.target_selector || {};
    const body = {
        token:       account.apiToken,
        title:       selector.title || (payload.body || 'Annotation').split('\n')[0].slice(0, 80) || 'Annotation',
        description: payload.body || '',
        link:        payload.target_url,
        author:      selector.author_name || '',
        feed:        selector.feed || '',
    };
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
