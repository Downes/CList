/// <reference path="./clist-types.js" />
// Copyright Stephen Downes 2026. CC BY 4.0; provided AS IS, without warranty.

// Annotation-server transport. Explicit credentials; no controls or feedback.
/** @param {CListAccountData} account
 * @param {Object} payload
 * @param {CListAnnotationSession} session
 * @returns {Promise<Object>} */
async function createStoreAnnotation(account, payload, session) {
    if (!session.token) throw new Error('Not logged in - cannot post annotation.');
    let response;
    try {
        response = await fetch(`${account.instance.replace(/\/$/, '')}/annotations`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json',
                Authorization: 'Bearer ' + session.token }, body: JSON.stringify(payload),
        });
    } catch (error) {
        throw Object.assign(new Error('Connection lost; check the annotation server before retrying.'), { outcome: 'uncertain' });
    }
    if (!response.ok) {
        const detail = await response.json().catch(() => ({}));
        throw new Error(response.status === 403 && String(detail.detail || '').includes('Not registered')
            ? 'Not registered on this annotation server - please re-add the account in Account Settings.'
            : 'Annotation failed: ' + (detail.detail || response.status));
    }
    // An accepted write is confirmed even when no receipt/link was returned.
    return await response.json().catch(() => ({}));
}
window.CList.publishers.Annotate = {
    construct(title, post) {
        const parsed = new DOMParser().parseFromString(post, 'text/html');
        const body = parsed.getElementById('post-content');
        return body ? body.innerHTML.trim() : post;
    },
    publish(account, title, content, refs = [], options = {}) {
        return publishAnnotationAccount(account, content, refs, options);
    },
};
