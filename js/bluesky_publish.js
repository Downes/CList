/// <reference path="./clist-types.js" />
// Bluesky publishing data operations. Reader sessions and form UI remain separate.
// Copyright Stephen Downes 2026. CC BY 4.0; provided AS IS, without warranty.

window.CList.publishers = window.CList.publishers || {};
window.CList.publishers.Bluesky = {
    acceptedFormats: ['text'],
    /** @type {CListPostPublisher['publish']} */
    publish: async (account, title, content, refs = [], options = {}) => {
        const snapshot = structuredClone(account);
        const replies = (refs || []).filter(ref => ref.replyToken?.type === 'Bluesky');
        const parent = replies[0]?.replyToken;
        const reply = parent ? { parent: { uri: parent.uri, cid: parent.cid }, root: { uri: parent.uri, cid: parent.cid } } : null;
        if (replies.length > 1) options.onWarning?.(
            `Replying to "${replies[0].author_name}" on Bluesky. Cannot simultaneously reply to ${replies.length - 1} other Bluesky post${replies.length > 2 ? 's' : ''} - Bluesky only supports one reply target.`);
        const text = removeHtml(content);
        const session = await createBlueskyAccountSession(snapshot);
        return publishBlueskyRecord(session, text, reply, options);
    },
};

/**
 * @param {CListBlueskySession} session
 * @param {string} text
 * @param {CListBlueskyReply|null} [reply]
 * @param {CListPublisherOptions} [options]
 * @returns {Promise<CListPublisherResult>}
 */
async function publishBlueskyRecord(session, text, reply = null, options = {}) {
    const { accessToken, did, pds } = session || {};
    if (!accessToken || !did || !pds) throw new Error('A valid Bluesky session is required before posting.');
    if (!text?.trim()) throw new Error('Please enter a post before publishing to Bluesky.');
    const segmenter = typeof Intl?.Segmenter === 'function' ? new Intl.Segmenter() : null;
    const segments = segmenter ? [...segmenter.segment(text)].map(segment => segment.segment) : null;
    const length = segments ? segments.length : text.length;
    if (length > 300) {
        text = segments ? segments.slice(0, 300).join('') : text.slice(0, 300);
        options.onWarning?.(`Bluesky post truncated to 300 graphemes (was ${length}).`);
    }
    const record = { $type: 'app.bsky.feed.post', text, createdAt: new Date().toISOString() };
    if (reply?.parent?.uri && reply.parent.cid && reply.root?.uri && reply.root.cid) record.reply = structuredClone(reply);
    let response;
    try {
        response = await fetch(`${pds}/xrpc/com.atproto.repo.createRecord`, {
            method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ collection: 'app.bsky.feed.post', repo: did, record }),
        });
    } catch (error) { throw new Error('Could not confirm Bluesky publication: ' + error.message + '. Check your posts before retrying.'); }
    let data;
    try { data = await response.json(); }
    catch {
        if (response.ok) throw new Error('Bluesky returned success, but its response could not be read. Check your posts before retrying.');
        throw new Error(`Bluesky rejected the post (HTTP ${response.status}).`);
    }
    if (!response.ok) throw new Error(`Bluesky rejected the post (HTTP ${response.status}): ${data?.message || data?.error || response.statusText || 'Unknown error'}`);
    const match = typeof data?.uri === 'string' && data.uri.match(/^at:\/\/[^/]+\/app\.bsky\.feed\.post\/([^/?#]+)$/);
    return match ? `https://bsky.app/profile/${did}/post/${encodeURIComponent(match[1])}` : null;
}

/**
 * Authenticate the selected publishing account without touching the reader cache.
 * The handle/password are captured before any asynchronous work.
 * @param {CListAccountData} accountData
 * @returns {Promise<CListBlueskySession>}
 */
async function createBlueskyAccountSession(accountData) {
    const handle = accountData?.instance;
    const appPassword = accountData?.id;
    if (accountData?.type !== 'Bluesky' || typeof handle !== 'string' || !handle
        || typeof appPassword !== 'string' || !appPassword) {
        throw new Error('The selected Bluesky publishing account needs a handle and app password. Check it under Accounts.');
    }
    const { pdsUrl, did: resolvedDid } = await resolveBlueskyPds(handle);
    const response = await fetch(`${pdsUrl}/xrpc/com.atproto.server.createSession`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: handle, password: appPassword }),
    });
    if (!response.ok) throw new Error(`Bluesky login failed for ${handle} (HTTP ${response.status}). Check this account's app password.`);
    const session = await response.json();
    const did = session.did || resolvedDid;
    if (!session.accessJwt || !did) throw new Error('Bluesky did not return a usable session for the selected publishing account.');
    return { accessToken: session.accessJwt, did, pds: pdsUrl };
}

