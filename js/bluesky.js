//  bluesky.js  -  helper and utility functions for Bluesky API
//  Part of CList, the next generation of learning and connecting with your community
//
//  Version version 0.1 created by Stephen Downes on January 27, 2025
//
//  Copyright Stephen Downes 2025
//  Licensed under Creative Commons Attribution 4.0 International https://creativecommons.org/licenses/by/4.0/
//
//  This software carries NO WARRANTY OF ANY KIND.
//  This software is provided "AS IS," and you, its user, assume all risks when using it.

window.CList.schemas = window.CList.schemas || {};
window.CList.schemas['Bluesky'] = {
    type: 'Bluesky',
    instanceFromKey: true,
    kvKey: { label: 'Username', placeholder: 'you.bsky.social' },
    fields: [
        { key: 'title',       label: 'Title',          editable: true,  inputType: 'text',     placeholder: 'My Bluesky', default: '' },
        { key: 'permissions', label: 'Permissions',    editable: true,  inputType: 'text',     placeholder: 'rw',         default: 'rw' },
        { key: 'id',          label: 'App Password',   editable: true,  inputType: 'password', placeholder: '',           default: '' },
        { key: 'maxlength',   label: 'Maximum Length', editable: true,  inputType: 'text',     placeholder: '300',        default: '300' },
    ]
};

let _bskyToken = null;
let _bskyDid   = null;
let _bskyPds   = null;

// Handlers

(function () {
    const blueskyHandler = {
        initialize: async (_accountData) => {
            await createBlueskySession();
        },
        feedFunctions: {
            'Post':          () => openLeftInterface(blueskyPostForm()),
            'Timeline':      fetchBlueskyTimeline.bind(null, 'home'),
            'Notifications': fetchBlueskyNotifications.bind(null, null),
            'Favorites':     fetchBlueskyFavorites.bind(null,'favorites'),
            'Pinned':        async () => openLeftInterface(await blueskySelectForm('pinned')),
            'Recommended':   async () => openLeftInterface(await blueskySelectForm('recommended')),
            'What\'s Hot':   fetchBlueskyWhatsHotFeed.bind(null,'hot'),
            'Search':        () => openLeftInterface(blueskySearchForm()),
        },
        onFeedClick:   (item) => fetchBlueskyUserFeed(item.bluesky?.handle),
        onAuthorClick: null,
        statusActions: (item, _itemID, _itemUrl) => {
            const { isLiked, isReposted, likeUri, repostUri,
                    inThread, threadUri,
                    parentUri, parentCid, rootUri, rootCid,
                    uri: postUri, cid: postCid, postId, postUrl } = item.bluesky || {};
            return `
                <button class="clist-action-btn" title="Reply" onclick="openLeftInterface(blueskyReplyForm('${_heJs(parentUri)}','${_heJs(parentCid)}','${_heJs(rootUri)}','${_heJs(rootCid)}'))"><span class="material-icons md-18 md-light">reply</span></button>
                <button class="clist-action-btn${isLiked ? ' action-active' : ''}" title="Like" data-record-uri="${_he(likeUri)}" onclick="handleBlueskyAction('${_heJs(postUri)}','${_heJs(postCid)}','${_heJs(postId)}','favorite',this)"><span class="material-icons md-18 md-light">favorite</span></button>
                <button class="clist-action-btn${isReposted ? ' action-active' : ''}" title="Repost" data-record-uri="${_he(repostUri)}" onclick="handleBlueskyAction('${_heJs(postUri)}','${_heJs(postCid)}','${_heJs(postId)}','repost',this)"><span class="material-icons md-18 md-light">autorenew</span></button>
                ${inThread ? `<button class="clist-action-btn" title="View thread" onclick="displayThread('${_heJs(threadUri)}')"><span class="material-icons md-18 md-light">dynamic_feed</span></button>` : ''}
                <button class="clist-action-btn" title="Open in browser" onclick="openInBrowser('${_heJs(postUrl)}', '${_heJs(_itemID)}')"><span class="material-icons md-18 md-light">launch</span></button>
            `;
        },
    };
    if (typeof window.CList.readers === 'undefined') {
        window.CList.readers = {};
    }
    window.CList.readers['Bluesky'] = blueskyHandler;
})();

(function () {
    window.CList.publishers = window.CList.publishers || {};
    window.CList.publishers['Bluesky'] = {
        acceptedFormats: ['text'],
        publish: async (_accountData, _title, content, refs) => {
            const blueskyRefs = (refs || []).filter(r => r.replyToken?.type === 'Bluesky');
            const replyToken = blueskyRefs[0]?.replyToken || null;
            if (blueskyRefs.length > 1) {
                showErrorModal(
                    `Replying to "${blueskyRefs[0].author_name}" on Bluesky. ` +
                    `Cannot simultaneously reply to ${blueskyRefs.length - 1} other Bluesky ` +
                    `post${blueskyRefs.length > 2 ? 's' : ''} — Bluesky only supports one reply target.`,
                    { title: 'Reply target dropped' }
                );
            }
            // Bluesky enforces a 300-grapheme hard limit regardless of account settings
            const BSKY_LIMIT = 300;
            const segmenter = typeof Intl?.Segmenter === 'function' ? new Intl.Segmenter() : null;
            const graphemeCount = segmenter
                ? [...segmenter.segment(removeHtml(content))].length
                : removeHtml(content).length;
            let postContent = removeHtml(content);
            if (graphemeCount > BSKY_LIMIT) {
                showStatusMessage(`Bluesky post truncated to ${BSKY_LIMIT} graphemes (was ${graphemeCount}).`);
                if (segmenter) {
                    const segs = [...segmenter.segment(content)];
                    postContent = segs.slice(0, BSKY_LIMIT).map(s => s.segment).join('');
                } else {
                    postContent = content.slice(0, BSKY_LIMIT);
                }
            }
            const parentUri = replyToken?.uri  || null;
            const parentCid = replyToken?.cid  || null;
            const rootUri   = parentUri;
            const rootCid   = parentCid;
            await submitBlueskyPost(postContent, 'post-result', null, parentUri, parentCid, rootUri, rootCid);
            return null;
        }
    };
})();

// -----------------------------------------------------

// Resolve a Bluesky handle to its PDS URL via handle resolution + DID document lookup.
// This supports any AT Protocol PDS (bsky.social, eurosky.social, self-hosted, etc.)
async function resolveBlueskyPds(handle) {
    const resolveResp = await fetch(
        `https://bsky.social/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`
    );
    if (!resolveResp.ok) throw new Error(`Could not resolve handle ${handle}: ${resolveResp.statusText}`);
    const { did } = await resolveResp.json();

    const didResp = await fetch(`https://plc.directory/${did}`);
    if (!didResp.ok) throw new Error(`Could not fetch DID document for ${handle}: ${didResp.statusText}`);
    const didDoc = await didResp.json();

    const pdsService = didDoc.service?.find(s => s.id === '#atproto_pds');
    if (!pdsService) throw new Error(`No PDS found in DID document for ${handle}`);

    return { pdsUrl: pdsService.serviceEndpoint, did };
}

async function createBlueskySession() {
    console.log("Starting session creation...");
    let appPassword;
    let handle;

    if (_bskyToken && _bskyDid) {
        console.log("Reusing existing session:", { _bskyToken, _bskyDid, _bskyPds });
        return { accessToken: _bskyToken, did: _bskyDid, pds: _bskyPds };
    }

    if (window.CList.accounts.length === 0) {
        try {
            window.CList.accounts = await getAccounts(window.CList.config.flaskSiteUrl);
        } catch (error) {
            throw new Error('Could not load accounts: ' + error.message);
        }
    }

    window.CList.accounts.forEach(account => {
        const parsedValue = parseAccountValue(account);
        if (!parsedValue) return;
        if (parsedValue.type === 'Bluesky') {
            appPassword = parsedValue.id;
            handle = parsedValue.instance;
        }
    });

    if (!appPassword || !handle) {
        throw new Error('No Bluesky account found. Open Accounts and add a Bluesky account.');
    }

    console.log("No session data found. Fetching new session...");

    try {
        const { pdsUrl, did: resolvedDid } = await resolveBlueskyPds(handle);
        console.log("Resolved PDS:", pdsUrl, "DID:", resolvedDid);

        const loginResponse = await fetch(`${pdsUrl}/xrpc/com.atproto.server.createSession`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier: handle, password: appPassword }),
        });

        if (!loginResponse.ok) {
            throw new Error(`Login failed: ${loginResponse.statusText}`);
        }

        const sessionData = await loginResponse.json();
        console.log("Session data received:", sessionData);

        _bskyToken = sessionData.accessJwt;
        _bskyDid   = sessionData.did || resolvedDid;
        _bskyPds   = pdsUrl;

        console.log("Session successfully created:", { _bskyToken, _bskyDid, _bskyPds });
        return { accessToken: _bskyToken, did: _bskyDid, pds: _bskyPds };

    } catch (error) {
        console.error("Error creating session:", error);
        return { accessToken: null, did: null, pds: null };
    }
}

// Returns a Bluesky post/reply form element
function blueskyPostForm() {
    const div = document.createElement('div');
    div.innerHTML = `
        <textarea id="blueskyPostContent" placeholder="Write something..." rows="4" style="width: 100%;"></textarea>
        <button onclick="submitBlueskyPostFromForm('blueskyPostContent')">Post</button>
        <div id="blueskyPostResponse" class="reply-response"></div>
    `;
    return div;
}

// Returns a Bluesky reply form element for use with openLeftInterface
function blueskyReplyForm(parentUri, parentCid, rootUri, rootCid) {
    const div = document.createElement('div');
    div.innerHTML = `
        <textarea id="blueskyReplyContent" placeholder="Write your reply..." rows="4" style="width: 100%;"></textarea>
        <button onclick="submitBlueskyPostFromForm('blueskyReplyContent','blueskyReplyResponse','${parentUri}','${parentCid}','${rootUri}','${rootCid}')">Submit Reply</button>
        <div id="blueskyReplyResponse" class="reply-response"></div>
    `;
    return div;
}

// Returns a Bluesky search form element
function blueskySearchForm() {
    const div = document.createElement('div');
    div.innerHTML = `
        <label for="queryInput">Query:</label>
        <input type="text" id="queryInput" placeholder="Enter search query" />
        <label for="sortSelect">Sort by:</label>
        <select id="sortSelect">
            <option value="top">Top</option>
            <option value="latest">Latest</option>
        </select>
        <button onclick="executeBlueskySearch()">Search</button>
    `;
    return div;
}

// Fetches pinned or recommended feeds and returns a populated <select> element
async function blueskySelectForm(type) {
    const feeds = type === 'pinned' ? await fetchPinnedFeeds() : await fetchRecommendedFeeds();
    const select = document.createElement('select');
    select.id = type === 'pinned' ? 'blueskyPinnedSelect' : 'blueskyRecommendedSelect';
    select.innerHTML = '<option value="" disabled selected>Select Feed</option>';
    feeds.forEach(feed => {
        const option = document.createElement('option');
        option.value = feed.atUri;
        option.textContent = feed.title;
        select.appendChild(option);
    });
    select.onchange = function() {
        fetchBlueskyFeed(this.options[this.selectedIndex].textContent, this.value, 20);
    };
    return select;
}

async function fetchRecommendedFeeds() {
    const { accessToken } = await createBlueskySession();

    try {
        const response = await fetch('https://public.api.bsky.app/xrpc/app.bsky.feed.getSuggestedFeeds', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch suggested feeds: ${response.statusText}`);
        }

        const data = await response.json();
        const suggestedFeeds = data.feeds.map(feed => ({
            title: feed.displayName || feed.name,
            atUri: feed.uri
        }));

        return suggestedFeeds;

    } catch (error) {
        console.error("Error fetching user feeds:", error);
        throw error;
    }
}

async function fetchPinnedFeeds() {
    const { accessToken, pds } = await createBlueskySession();

    const response = await fetch(`${pds}/xrpc/app.bsky.actor.getPreferences`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        }
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch user preferences: ${response.statusText}`);
    }

    const data = await response.json();

    const savedFeedsPrefV2 = data.preferences.find(pref => pref.$type === 'app.bsky.actor.defs#savedFeedsPrefV2');
    const pinnedFeedUris = savedFeedsPrefV2?.items
        .filter(item => item.pinned)
        .map(item => item.value) || [];

    const pinnedFeeds = await Promise.all(
        pinnedFeedUris.map(async uri => {
            if (!uri.toLowerCase().startsWith('at:')) {
                return { title: "Skipped Feed", atUri: uri };
            }
            const feedResponse = await fetch(`${pds}/xrpc/app.bsky.feed.getFeedGenerator?feed=${encodeURIComponent(uri)}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                }
            });

            if (!feedResponse.ok) {
                console.warn(`Failed to fetch feed details for ${uri}: ${feedResponse.statusText}`);
                return { title: "Unknown Feed", atUri: uri };
            }

            const feedData = await feedResponse.json();
            return {
                title: feedData.view.displayName || "Unnamed Feed",
                atUri: uri
            };
        })
    );

    return pinnedFeeds;
}

async function executeBlueskySearch() {
    const query = document.getElementById("queryInput").value;
    const sort = document.getElementById("sortSelect").value;
    await fetchBlueskySearch(query, sort);
}

async function fetchBlueskySearch(query, sort) {
    try {
        const { accessToken } = await createBlueskySession();
        const searchParams = new URLSearchParams({
            q: query,
            sort: sort,
            limit: 25
        });

        const response = await fetch(`https://bsky.social/xrpc/app.bsky.feed.searchPosts?${searchParams.toString()}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            },
        });

        if (!response.ok) {
            throw new Error(`Error fetching search results: ${response.statusText}`);
        }

        const data = await response.json();
        await displayBlueskyPosts(data.posts.map(post => ({ post })), 'Search', null);
    } catch (error) {
        console.error('Error:', error);
        showServiceError('feed-container', 'Bluesky search error', error.message,
            'Check your Bluesky account credentials under <strong>Accounts</strong>.');
    }
}

async function fetchBlueskyTimeline() {
    await fetchBlueskyFeed("Timeline", "timeline");
}

async function fetchBlueskyUserFeed(handle) {
    await fetchBlueskyFeed(handle, `user:${handle}`);
}

async function fetchBlueskyFavorites() {
    await fetchBlueskyFeed("Favorites", "favorites");
}

// The feed URI is hardcoded to Bluesky Social's "What's Hot (Classic)" feed generator
// (did:plc:z72i7hdynmk6r22z27h6tvur). This is a global AT Protocol feed available to all
// users regardless of PDS instance, but it is Bluesky-operated and may change if Bluesky
// retires or replaces the feed. See wiki page B3 — Add Bluesky to CList for details.
async function fetchBlueskyWhatsHotFeed() {
    const whatsHotFeedUri = 'at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/hot-classic';
    try {
        await fetchBlueskyFeed("What's Hot", whatsHotFeedUri);
    } catch (error) {
        console.error('Error fetching "What\'s Hot" feed:', error);
        showServiceError('feed-container', 'Bluesky error', error.message,
            'Check your Bluesky account credentials under <strong>Accounts</strong>.');
    }
}

async function fetchBlueskyFeed(title, atUri, limit = 20, cursor = null) {
    const { accessToken, did, pds } = await createBlueskySession();

    try {
        let url;
        if (atUri === 'timeline') {
            url = `${pds}/xrpc/app.bsky.feed.getTimeline?limit=${limit}`;
        } else if (atUri === 'favorites') {
            url = `${pds}/xrpc/app.bsky.feed.getActorLikes?actor=${did}`;
        } else if (atUri.startsWith('user:')) {
            const actor = encodeURIComponent(atUri.slice(5));
            url = `https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=${actor}&limit=${limit}`;
        } else {
            url = `https://public.api.bsky.app/xrpc/app.bsky.feed.getFeed?feed=${encodeURIComponent(atUri)}&limit=${limit}`;
        }

        if (cursor) {
            url += `&cursor=${encodeURIComponent(cursor)}`;
        }

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            const errBody = await response.json().catch(() => ({}));
            const errMsg = errBody.message || errBody.error || response.status;
            if (atUri === 'favorites' && response.status === 400) {
                throw new Error(`Likes feed unavailable (HTTP 400: ${errMsg}). Your liked posts may need to be set to public in Bluesky Settings → Privacy.`);
            }
            throw new Error(`Failed to fetch feed: ${errMsg}`);
        }

        const data = await response.json();

        cursor = data.cursor;
        cursor = (cursor && cursor.includes(':')) ? cursor : null;

        const adultKeywords = ["adult", "sensitive", "nsfw", "porn"];

        const posts = data.feed
            .filter(item =>
                item.post &&
                !(item.post.labels || []).some(label =>
                    adultKeywords.includes(label.val.toLowerCase())
                )
            )
            .map(item => ({ post: item.post }));

        await displayBlueskyPosts(posts, title, cursor, atUri);

    } catch (error) {
        console.error("Error fetching feed:", error);
        showServiceError('feed-container', 'Bluesky error', error.message,
            'Check your Bluesky account credentials under <strong>Accounts</strong>.');
    }
}

// Normalize a raw Bluesky API post object into the shape makeListing() expects.
// Async because translation (processTranslationWithTimeout) is per-item.
async function normalizeBlueskyPost(post) {
    const authorName  = post.author.displayName || "Unknown Author";
    const handle      = post.author.handle;
    const postId      = post.uri.split('/').pop();
    const postUrl     = `https://bsky.app/profile/${handle}/post/${postId}`;
    const postContent = post.record.text || '';

    let desc;
    try   { desc = await processTranslationWithTimeout(postContent); }
    catch { desc = postContent; }

    const isLiked    = !!(post.viewer?.like);
    const isReposted = !!(post.viewer?.repost);
    const likeUri    = post.viewer?.like   || '';
    const repostUri  = post.viewer?.repost || '';
    const inThread   = !!(post.record.reply?.root?.uri) || post.replyCount > 0;
    const threadUri  = inThread ? (post.record.reply?.root?.uri || post.uri) : null;
    const parentUri  = post.uri;
    const parentCid  = post.cid;
    const rootUri    = post.record.reply?.root?.uri || post.uri;
    const rootCid    = post.record.reply?.root?.cid || post.cid;

    return {
        service:    'Bluesky',
        url:        postUrl,
        titleHtml:  `<a href="#" onclick="fetchBlueskyUserFeed('${_heJs(handle)}'); return false;" title="View User Feed">${_he(authorName)}</a> (@${_he(handle)}) wrote: ${_he(desc)}`,
        title:      postContent.slice(0, 80),
        desc,
        noSummaryDesc: true,
        feed:       '@' + handle,
        author:     authorName,
        date:       post.record.createdAt || new Date().toISOString(),
        images:     (post.embed?.images || []).map(img => ({
                        preview_url: img.thumb,
                        url:         img.fullsize,
                        description: img.alt || ''
                    })),
        guid:       post.uri,
        author_id:  handle,
        replyToken: { type: 'Bluesky', uri: post.uri, cid: post.cid },
        bluesky:    { handle, postId, postUrl,
                      isLiked, isReposted, likeUri, repostUri,
                      inThread, threadUri,
                      parentUri, parentCid, rootUri, rootCid,
                      uri: post.uri, cid: post.cid },
    };
}

async function displayBlueskyPosts(posts, title, cursor = null, atUri) {
    if (title != null) feedTitle = (title === 'Thread') ? "Bluesky Thread" : title;
    await window.CList.ui.renderFeed(posts, window.CList.ui.view.feedContainer, {
        normalize:    (item) => normalizeBlueskyPost(item.post),
        title:        title != null ? feedTitle : null,
        append:       title == null,
        onLoadMore:   (cursor && cursor != 1) ? () => fetchBlueskyFeed(null, atUri, 20, cursor) : null,
        loadMoreBtnId: 'loadMoreButton',
    });
}

// Toggle like or repost on a Bluesky post.
// button.dataset.recordUri holds the AT URI of the existing record (if active).
async function handleBlueskyAction(uri, cid, _postId, action, button) {
    const { accessToken, did, pds } = await createBlueskySession();
    const isActive = button && button.classList.contains('action-active');
    const collectionMap = { favorite: 'app.bsky.feed.like', repost: 'app.bsky.feed.repost' };
    const collection = collectionMap[action];

    try {
        if (isActive) {
            const recordUri = button.dataset.recordUri;
            const rkey = recordUri.split('/').pop();
            const response = await fetch(`${pds}/xrpc/com.atproto.repo.deleteRecord`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ repo: did, collection, rkey }),
            });
            if (!response.ok) throw new Error((await response.json()).message);
            if (button) { button.classList.remove('action-active'); button.dataset.recordUri = ''; }
        } else {
            const record = {
                '$type': `app.bsky.feed.${action === 'favorite' ? 'like' : 'repost'}`,
                createdAt: new Date().toISOString(),
                subject: { uri, cid }
            };
            const response = await fetch(`${pds}/xrpc/com.atproto.repo.createRecord`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ collection, repo: did, record }),
            });
            if (!response.ok) throw new Error((await response.json()).message);
            const result = await response.json();
            if (button) { button.classList.add('action-active'); button.dataset.recordUri = result.uri; }
        }
    } catch (error) {
        console.error(`Bluesky ${action} failed:`, error);
    }
}

async function fetchPostByUri(uri) {
    const { accessToken, pds } = await createBlueskySession();
    const response = await fetch(`${pds}/xrpc/app.bsky.feed.getPosts?uris=${encodeURIComponent(uri)}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${accessToken}`
        }
    });

    if (!response.ok) {
        console.error(`Error fetching post by URI (${uri}):`, response.statusText);
        return null;
    }

    const data = await response.json();
    if (data.posts && data.posts.length > 0) {
        return data.posts[0];
    } else {
        console.warn(`No post found for URI: ${uri}`);
        return null;
    }
}

async function fetchThreadByUri(uri) {
    const { accessToken, pds } = await createBlueskySession();
    const response = await fetch(`${pds}/xrpc/app.bsky.feed.getPostThread?uri=${encodeURIComponent(uri)}&depth=6`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${accessToken}`
        }
    });

    if (!response.ok) {
        console.error(`Error fetching thread for URI (${uri}):`, response.statusText);
        return null;
    }

    const data = await response.json();
    return data.thread || null;
}

async function displayThread(uri) {
    const threadData = await fetchThreadByUri(uri);

    if (!threadData) {
        window.CList.ui.view.feedContainer.innerText = 'Failed to load thread. No data found for the post thread.';
        return;
    }

    const threadPosts = parseThreadToPosts(threadData);
    await displayBlueskyPosts(threadPosts, 'Thread', null);
}

function parseThreadToPosts(thread) {
    const posts = [];

    function traverse(node) {
        if (!node || !node.post) return;
        posts.push({ post: node.post });
        if (node.replies && Array.isArray(node.replies)) {
            node.replies.forEach(reply => traverse(reply));
        }
    }

    traverse(thread);
    return posts;
}

async function submitBlueskyPostFromForm(replyContentId = null, responseDiv = 'blueskyPostResponse', parentUri = null, parentCid = null, rootUri = null, rootCid = null) {
    postContent = replyContentId ? document.getElementById(replyContentId).value : 'No content';
    await submitBlueskyPost(postContent, responseDiv, replyContentId, parentUri, parentCid, rootUri, rootCid);
    document.getElementById(replyContentId).value = '';
}

async function submitBlueskyPost(content, responseDiv, replyContentId = null, parentUri = null, parentCid = null, rootUri = null, rootCid = null) {
    const { accessToken, did, pds } = await createBlueskySession();
    const uri = `${pds}/xrpc/com.atproto.repo.createRecord`;

    const record = {
        "$type": "app.bsky.feed.post",
        text: content,
        createdAt: new Date().toISOString(),
    };

    if (parentUri && parentCid && rootUri && rootCid) {
        if (replyContentId) responseDiv = `replyResponse-${replyContentId.split('-')[1]}`;
        record.reply = {
            root: { uri: rootUri, cid: rootCid },
            parent: { uri: parentUri, cid: parentCid },
        };
    }

    const requestBody = {
        collection: "app.bsky.feed.post",
        repo: did,
        record: record,
    };

    try {
        const response = await fetch(uri, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            const error = await response.json();
            console.error("Error response:", error);
            throw new Error(`Error: ${error.message || response.statusText}`);
        }

        const responseData = await response.json();
        console.log("Bluesky Post Submitted Successfully:", responseData);
        document.getElementById(responseDiv).innerHTML += 'Bluesky Post Submitted Successfully';

    } catch (error) {
        console.error("Failed to submit post:", error.message);
        const resultEl = document.getElementById(responseDiv);
        if (resultEl) {
            const errP = document.createElement('p');
            errP.className = 'error-message';
            errP.textContent = `Failed to post: ${error.message}`;
            resultEl.appendChild(errP);
        }
    }
}

// ── Notifications ─────────────────────────────────────────────────────────────

async function fetchBlueskyNotifications(cursor = null) {
    const feedContainer = window.CList.ui.view.feedContainer;
    try {
        const { accessToken, pds } = await createBlueskySession();
        let url = `${pds}/xrpc/app.bsky.notification.listNotifications?limit=25`;
        if (cursor) url += `&cursor=${encodeURIComponent(cursor)}`;

        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${accessToken}` },
        });
        if (!response.ok) {
            const errBody = await response.json().catch(() => ({}));
            throw new Error(errBody.message || errBody.error || response.status);
        }
        const data = await response.json();
        await displayBlueskyNotifications(data.notifications || [], data.cursor || null, cursor === null);
    } catch (error) {
        showServiceError(feedContainer, 'Bluesky notifications error', error.message,
            'Check your Bluesky account credentials under <strong>Accounts</strong>.');
    }
}

async function displayBlueskyNotifications(notifications, cursor, isFirstPage) {
    const feedContainer = window.CList.ui.view.feedContainer;

    if (isFirstPage) {
        feedContainer.innerHTML = '';
        feedContainer.appendChild(createFeedHeader('Notifications'));
        const summary = document.createElement('div');
        summary.id = 'feed-summary';
        feedContainer.appendChild(summary);
    }

    const reasonLabels = {
        like:    'liked your post',
        repost:  'reposted your post',
        follow:  'followed you',
        mention: 'mentioned you',
        reply:   'replied to your post',
        quote:   'quoted your post',
    };

    for (const notif of notifications) {
        const statusBox = document.createElement('div');
        statusBox.classList.add('status-box');

        const statusContent = document.createElement('div');
        statusContent.classList.add('status-content');
        statusBox.appendChild(statusContent);

        const handle = notif.author.handle;
        const name   = notif.author.displayName || handle;
        const label  = reasonLabels[notif.reason] || notif.reason;

        const headerDiv = document.createElement('div');
        headerDiv.classList.add('reblog-info');
        headerDiv.innerHTML = `<a href="#" onclick="fetchBlueskyUserFeed('${handle}'); return false;">${name}</a> (@${handle}) ${label}`;
        statusContent.appendChild(headerDiv);

        // mention / reply / quote carry the post text in the notification record
        if (['mention', 'reply', 'quote'].includes(notif.reason) && notif.record?.text) {
            const postId  = notif.uri.split('/').pop();
            const postUrl = `https://bsky.app/profile/${handle}/post/${postId}`;

            let translatedContent;
            try {
                translatedContent = await processTranslationWithTimeout(notif.record.text);
            } catch (e) {
                translatedContent = notif.record.text;
            }

            const statusSpecific = document.createElement('div');
            statusSpecific.classList.add('statusSpecific');
            statusSpecific.id = postId;
            statusSpecific.innerHTML = `<p>${translatedContent}</p>`;
            statusContent.appendChild(statusSpecific);

            statusSpecific.reference = {
                service:     'Bluesky',
                author_name: name,
                author_id:   handle,
                url:         postUrl,
                title:       'Bluesky',
                created_at:  notif.indexedAt,
                id:          postId,
                summary:     notif.record.text.slice(0, 140),
                replyToken:  { type: 'Bluesky', uri: notif.uri, cid: notif.cid },
            };

            const actionButtons = document.createElement('div');
            actionButtons.classList.add('status-actions');
            actionButtons.innerHTML = `
                <button class="clist-action-btn" title="Open in browser" onclick="openInBrowser('${postUrl}', '${postId}')"><span class="material-icons md-18 md-light">launch</span></button>
                <button class="clist-action-btn" id="collect-btn-${postId}" onclick="collectItem('${postId}');" title="Add to collection"><span class="material-icons md-18 md-light">library_add</span></button>
                <button class="clist-action-btn chat-only-btn" onclick="shareToChat('${postId}');" title="Share to chat"><span class="material-icons md-18 md-light">chat_bubble_outline</span></button>
            `;
            statusContent.appendChild(actionButtons);

            const clistButtons = document.createElement('div');
            clistButtons.classList.add('clist-actions');
            clistButtons.innerHTML = `
                <button class="clist-action-btn" onclick="loadContentToEditor('${postId}');" title="Load in editor"><span class="material-icons md-18 md-light">arrow_right</span></button>
                <button class="clist-action-btn" id="anno-btn-${postId}" onclick="openAnnotationEditor('${postId}');" title="Write about this"><span class="material-icons md-18 md-light">arrow_forward</span></button>
            `;

            statusBox.appendChild(clistButtons);
        }

        feedContainer.appendChild(statusBox);
    }

    const existingButton = document.getElementById('loadMoreButton');
    if (existingButton) existingButton.remove();
    if (cursor) {
        const loadMoreButton = document.createElement('button');
        loadMoreButton.id = 'loadMoreButton';
        loadMoreButton.className = 'btn';
        loadMoreButton.innerText = 'Load More';
        loadMoreButton.onclick = () => fetchBlueskyNotifications(cursor);
        feedContainer.appendChild(loadMoreButton);
    }
}
