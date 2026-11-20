/// <reference path="./clist-types.js" />
// Explicit Bluesky requests. No controls, current-account lookup or visible feedback.
async function blueskyReadJson(session, path, query = {}, signal = null) {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => { if (value !== null && value !== undefined) params.set(key, String(value)); });
    const response = await fetch(`${session.pds}/xrpc/${path}?${params}`, {
        headers: { Authorization: `Bearer ${session.accessToken}` }, ...(signal ? { signal } : {}),
    });
    let data;
    try { data = await response.json(); } catch { throw new Error(`Bluesky returned an unreadable response (HTTP ${response.status}).`); }
    if (!response.ok) throw new Error(`Bluesky request failed (HTTP ${response.status}): ${data?.message || data?.error || 'Unknown error'}`);
    return data;
}
async function fetchCapturedBlueskyPage(session, selection, cursor, signal) {
    const query = { limit: selection.limit || 25, cursor };
    let endpoint;
    switch (selection.kind) {
        case 'notifications': endpoint = 'app.bsky.notification.listNotifications'; break;
        case 'search': endpoint = 'app.bsky.feed.searchPosts'; query.q = selection.query; query.sort = selection.sort || 'top'; break;
        case 'user': endpoint = 'app.bsky.feed.getAuthorFeed'; query.actor = selection.actor; break;
        case 'favorites': endpoint = 'app.bsky.feed.getActorLikes'; query.actor = session.did; break;
        case 'feed': endpoint = 'app.bsky.feed.getFeed'; query.feed = selection.uri; break;
        case 'thread': {
            const data = await blueskyReadJson(session, 'app.bsky.feed.getPostThread', { uri: selection.uri, depth: 6 }, signal);
            if (!data.thread) throw new Error('Bluesky returned no thread.');
            return { posts: parseThreadToPosts(data.thread).map(item => item.post), cursor: null };
        }
        default: endpoint = 'app.bsky.feed.getTimeline';
    }
    const data = await blueskyReadJson(session, endpoint, query, signal);
    if (selection.kind === 'notifications') return { notifications: data.notifications || [], cursor: data.cursor || null };
    const source = selection.kind === 'search' ? (data.posts || []) : (data.feed || []).map(item => item.post);
    const blocked = new Set(['adult', 'sensitive', 'nsfw', 'porn']);
    return { posts: source.filter(post => post && !(post.labels || []).some(label => blocked.has(String(label.val).toLowerCase()))), cursor: data.cursor || null };
}
async function fetchCapturedBlueskyFeeds(session, type, signal) {
    if (type !== 'pinned') {
        const data = await blueskyReadJson(session, 'app.bsky.feed.getSuggestedFeeds', {}, signal);
        return (data.feeds || []).map(feed => ({ title: feed.displayName || feed.name || 'Unnamed Feed', uri: feed.uri }));
    }
    const data = await blueskyReadJson(session, 'app.bsky.actor.getPreferences', {}, signal);
    const preference = (data.preferences || []).find(item => item.$type === 'app.bsky.actor.defs#savedFeedsPrefV2');
    const result = [];
    for (const item of preference?.items || []) {
        if (!item.pinned || !item.value?.startsWith('at://')) continue;
        const feed = await blueskyReadJson(session, 'app.bsky.feed.getFeedGenerator', { feed: item.value }, signal);
        result.push({ title: feed.view?.displayName || 'Unnamed Feed', uri: item.value });
    }
    return result;
}
async function toggleCapturedBlueskyRecord(session, target, action, recordUri) {
    const collection = action === 'favorite' ? 'app.bsky.feed.like' : action === 'repost' ? 'app.bsky.feed.repost' : null;
    if (!collection) throw new Error('Unsupported Bluesky action.');
    if (!target.uri || !target.cid) throw new Error('This Bluesky post has no usable identity.');
    let endpoint, body;
    if (recordUri) {
        const match = recordUri.match(/^at:\/\/([^/]+)\/([^/]+)\/([^/?#]+)$/);
        if (!match || match[1] !== session.did || match[2] !== collection) throw new Error('The action record does not belong to this Bluesky account. Reload the feed.');
        endpoint = 'com.atproto.repo.deleteRecord'; body = { repo: session.did, collection, rkey: match[3] };
    } else {
        endpoint = 'com.atproto.repo.createRecord'; body = { repo: session.did, collection,
            record: { $type: collection, createdAt: new Date().toISOString(), subject: { uri: target.uri, cid: target.cid } } };
    }
    let response;
    try { response = await fetch(`${session.pds}/xrpc/${endpoint}`, {
        method: 'POST', headers: { Authorization: `Bearer ${session.accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }); } catch (error) { throw new Error('The Bluesky action could not be confirmed. Check Bluesky before retrying. ' + error.message); }
    let result;
    try { result = await response.json(); } catch {
        throw new Error('The Bluesky action response could not be read. Check Bluesky before retrying.');
    }
    if (!response.ok) throw new Error(`Bluesky action rejected (HTTP ${response.status}): ${result?.message || result?.error || 'Unknown error'}`);
    if (!recordUri && (typeof result.uri !== 'string' || !result.uri)) throw new Error('Bluesky accepted the action without a record URI. Check Bluesky before retrying.');
    return recordUri ? null : result.uri;
}
