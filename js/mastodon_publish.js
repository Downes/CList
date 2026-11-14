/// <reference path="./clist-types.js" />
// Mastodon publishing data operations. No form or feedback elements.
// Copyright Stephen Downes 2026. CC BY 4.0; provided AS IS, without warranty.

window.CList.publishers = window.CList.publishers || {};
window.CList.publishers.Mastodon = {
    acceptedFormats: ['text'],
    /** @type {CListPostPublisher['publish']} */
    publish: async (account, title, content, refs = [], options = {}) => {
        const token = account?.id;
        const instance = account?.instance;
        if (!token || !instance) throw new Error('The selected Mastodon account needs an instance and access token.');
        const replies = (refs || []).filter(ref => ref.replyToken?.type === 'Mastodon');
        if (replies.length > 1) options.onWarning?.(
            `Replying to "${replies[0].author_name}" on Mastodon. Cannot simultaneously reply to ${replies.length - 1} other Mastodon post${replies.length > 2 ? 's' : ''} - Mastodon only supports one reply target.`);
        return publishMastodonStatus(token, extractBaseUrl(instance), removeHtml(content), replies[0]?.replyToken?.statusId || null, options);
    },
};

/**
 * @param {string} token
 * @param {string} baseUrl
 * @param {string} text Plain text from the publisher or standalone form.
 * @param {string|null} [replyToId]
 * @param {CListPublisherOptions} [options]
 * @returns {Promise<CListPublisherResult>}
 */
async function publishMastodonStatus(token, baseUrl, text, replyToId = null, options = {}) {
    if (!token || !baseUrl) throw new Error('Select a Mastodon account before posting.');
    if (!text?.trim()) throw new Error('Please enter a status before posting.');
    const limit = await getCharacterLimit(baseUrl);
    let status = text;
    if (limit !== null && text.length > limit) {
        status = text.slice(0, limit);
        options.onWarning?.(`Mastodon post truncated to this instance's ${limit}-character limit.`);
    }
    const body = { status, visibility: 'public' };
    if (replyToId) body.in_reply_to_id = replyToId;
    let response;
    try {
        response = await fetch(`${baseUrl}/api/v1/statuses`, {
            method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
    } catch (error) { throw new Error('Could not confirm Mastodon publication: ' + error.message + '. Check your posts before retrying.'); }
    let data;
    try { data = await response.json(); }
    catch {
        if (response.ok) throw new Error('Mastodon returned success, but its response could not be read. Check your posts before retrying.');
        throw new Error(`Mastodon rejected the post (HTTP ${response.status}).`);
    }
    if (!response.ok) throw new Error(`Mastodon rejected the post (HTTP ${response.status}): ${data?.error || response.statusText || 'Unknown error'}`);
    return typeof data?.url === 'string' && data.url ? data.url : null;
}

/**
 * @param {string} instanceUrl
 * @returns {Promise<number|null>}
 */
async function getCharacterLimit(instanceUrl) {
    try {
        const response = await fetch(`${instanceUrl}/api/v1/instance`);
        if (!response.ok) return null;
        const data = await response.json();
        const limit = data.configuration?.statuses?.max_characters;
        return typeof limit === 'number' && limit > 0 ? limit : null;
    } catch {
        // Optional metadata: retain the text and let the posting API validate it.
        return null;
    }
}
