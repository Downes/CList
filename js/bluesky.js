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

window.accountSchemas = window.accountSchemas || {};
window.accountSchemas['Bluesky'] = {
    type: 'Bluesky',
    instanceFromKey: true,
    kvKey: { label: 'Username', placeholder: 'you.bsky.social' },
    fields: [
        { key: 'title',       label: 'Title',        editable: true,  inputType: 'text',     placeholder: 'My Bluesky', default: '' },
        { key: 'permissions', label: 'Permissions',  editable: true,  inputType: 'text',     placeholder: 'rw',         default: 'rw' },
        { key: 'id',          label: 'App Password', editable: true,  inputType: 'password', placeholder: '',           default: '' },
    ]
};

let accessToken = null;
let did = null;
let pds = null;

// Handlers

(function () {
    const blueskyHandler = {
        initialize: async () => {
            await createBlueskySession();
        },
        feedFunctions: {
            'Post':        () => openLeftInterface(blueskyPostForm()),
            'Timeline':    fetchBlueskyTimeline.bind(null, 'home'),
            'Favorites':   fetchBlueskyFavorites.bind(null,'favorites'),
            'Pinned':      async () => openLeftInterface(await blueskySelectForm('pinned')),
            'Recommended': async () => openLeftInterface(await blueskySelectForm('recommended')),
            'What\'s Hot': fetchBlueskyWhatsHotFeed.bind(null,'hot'),
            'Search':      () => openLeftInterface(blueskySearchForm()),
        }
    };
    if (typeof window.readerHandlers === 'undefined') {
        window.readerHandlers = {};
    }
    window.readerHandlers['Bluesky'] = blueskyHandler;
})();

(function () {
    window.publishHandlers = window.publishHandlers || {};
    window.publishHandlers['Bluesky'] = {
        publish: async (_accountData, _title, content) => {
            await submitBlueskyPost(content, 'post-result', null, null, null, null, null);
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

    if (accessToken && did) {
        console.log("Reusing existing session:", { accessToken, did, pds });
        return { accessToken, did, pds };
    }

    if (accounts.length === 0) {
        try {
            accounts = await getAccounts(flaskSiteUrl);
        } catch (error) {
            throw new Error('Could not load accounts: ' + error.message);
        }
    }

    accounts.forEach(account => {
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

        accessToken = sessionData.accessJwt;
        did = sessionData.did || resolvedDid;
        pds = pdsUrl;

        console.log("Session successfully created:", { accessToken, did, pds });
        return { accessToken, did, pds };

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

async function displayBlueskyPosts(posts, title, cursor = null, atUri) {
    const timelineElement = document.getElementById('feed-container');

    if (title != null) {
        timelineElement.innerHTML = '';
        if (title === 'Thread') { feedTitle = "Bluesky Thread"; }
        else { feedTitle = title; }
        timelineElement.appendChild(createFeedHeader(feedTitle));
    }

    const summary = document.createElement("div");
    summary.id = "feed-summary";
    timelineElement.appendChild(summary);

    for (const item of posts) {
        const post = item.post;
        const authorName = post.author.displayName || "Unknown Author";
        const postContent = post.record.text || "No content available";
        const handle = post.author.handle;
        const postId = post.uri.split('/').pop();
        const postUrl = `https://bsky.app/profile/${handle}/post/${postId}`;

        const statusBox = document.createElement('div');
        statusBox.classList.add('status-box');

        const statusContent = document.createElement('div');
        statusContent.classList.add('status-content');
        statusBox.appendChild(statusContent);

        try {
            translatedContent = await processTranslationWithTimeout(postContent);
        } catch (translationError) {
            console.error(`Error translating status ${postId}:`, translationError);
            translatedContent = "[Translation failed]";
        }

        const statusSpecific = document.createElement('div');
        statusSpecific.classList.add('statusSpecific');
        statusSpecific.id = `${postId}`;
        statusSpecific.innerHTML = `
        <p><a href="#" onclick="fetchBlueskyUserFeed('${handle}'); return false;" title='View User Feed'>${authorName}</a> (@${handle}) wrote:
        ${translatedContent}
        `;
        statusContent.appendChild(statusSpecific);

        if (post.embed && post.embed.images) {
            const statusImages = document.createElement('div');
            statusImages.classList.add('status-images-container');

            post.embed.images.forEach(image => {
                const imageElement = document.createElement('div');
                imageElement.classList.add('image-item');
                imageElement.innerHTML = `
                    <a href="${image.fullsize}" target="_blank">
                        <img src="${image.thumb}" alt="${image.alt || 'Image'}"/>
                    </a>
                `;
                statusImages.appendChild(imageElement);
            });

            statusContent.appendChild(statusImages);
        }

        statusSpecific.reference = {
            author_name: authorName,
            author_id: handle,
            url: postUrl,
            title: 'Bluesky',
            created_at: new Date().toISOString(),
            id: statusSpecific.id,
        };

        const isLiked    = !!(post.viewer && post.viewer.like);
        const isReposted = !!(post.viewer && post.viewer.repost);
        const likeUri    = post.viewer?.like   || '';
        const repostUri  = post.viewer?.repost || '';

        const inThread = (post.record.reply && post.record.reply.root && post.record.reply.root.uri) || post.replyCount > 0;
        const threadUri = inThread
            ? (post.record.reply?.root?.uri || post.uri)
            : null;

        const parentUri  = post.uri;
        const parentCid  = post.cid;
        const rootUri    = post.record.reply?.root?.uri  || post.uri;
        const rootCid    = post.record.reply?.root?.cid  || post.cid;

        const blueskyActionButtons = document.createElement('div');
        blueskyActionButtons.classList.add('status-actions');
        blueskyActionButtons.innerHTML = `
            <button class="material-icons md-18 md-light" onclick="openLeftInterface(blueskyReplyForm('${parentUri}','${parentCid}','${rootUri}','${rootCid}'))">reply</button>
            <button class="material-icons md-18 md-light${isLiked ? ' action-active' : ''}" data-record-uri="${likeUri}" onclick="handleBlueskyAction('${post.uri}','${post.cid}','${postId}','favorite',this)">favorite</button>
            <button class="material-icons md-18 md-light${isReposted ? ' action-active' : ''}" data-record-uri="${repostUri}" onclick="handleBlueskyAction('${post.uri}','${post.cid}','${postId}','repost',this)">autorenew</button>
            ${inThread ? `<button class="material-icons md-18 md-light" onclick="displayThread('${threadUri}')">dynamic_feed</button>` : ''}
            <button class="material-icons md-18 md-light" onclick="window.open('${postUrl}','_blank','width=800,height=600,scrollbars=yes')">launch</button>
        `;
        statusContent.appendChild(blueskyActionButtons);

        const clistButtons = document.createElement('div');
        clistButtons.classList.add('clist-actions');
        clistButtons.innerHTML = `
            <button class="material-icons md-18 md-light" onclick="loadContentToEditor('${postId}');" title="Load in editor">arrow_right</button>
            <button class="clist-action-btn" onclick="shareToChat('${postId}');" title="Share to chat"><span class="material-icons md-18 md-light">chat_bubble_outline</span></button>
        `;
        statusBox.appendChild(clistButtons);

        timelineElement.appendChild(statusBox);
    }

    const existingButton = document.getElementById('loadMoreButton');
    if (existingButton) {
        existingButton.remove();
    }

    if (cursor && cursor != 1) {
        const loadMoreButton = document.createElement('button');
        loadMoreButton.id = 'loadMoreButton';
        loadMoreButton.innerText = "Load More";
        loadMoreButton.onclick = () => {
            fetchBlueskyFeed(null, atUri, 20, cursor);
        };
        timelineElement.appendChild(loadMoreButton);
    }
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
        document.getElementById('feed-container').innerText = 'Failed to load thread. No data found for the post thread.';
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
        responseDiv = `replyResponse-${replyContentId.split('-')[1]}`;
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
