/// <reference path="./clist-types.js" />
// Copyright Stephen Downes 2026. CC BY 4.0; provided AS IS, without warranty.

window.CList.publishers.Hypothesis = {
    construct(title, post) {
        const parsed = new DOMParser().parseFromString(post, 'text/html');
        const body = parsed.getElementById('post-content');
        const raw = body ? body.innerHTML.trim() : post;
        return typeof sanitizeHtml === 'function' ? sanitizeHtml(raw).toString() : raw;
    },
    publish(account, title, content, refs = [], options = {}) {
        return publishAnnotationAccount(account, content, refs, options);
    },
};
