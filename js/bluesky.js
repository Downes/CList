//  bluesky.js  -  helper and utility functions for Bluesky API
//  Part of CList, the next generation of learning and connecting with your community
//
//  Version version 0.1 created by Stephen Downes on January 27, 2025
//
//  Copyright National Research Council of Canada 2025
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


let accessToken = null; // Global variable for access token
let did = null; // Global variable to store the DID
let pds = null; // Personal data Server location

// Handlers


(function () {
    const blueskyHandler = {
        initialize: async(instance, accessToken) => {
            createBlueskySession(instance, accessToken);
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
    // Ensure readerHandlers exists
    if (typeof window.readerHandlers === 'undefined') {
    window.readerHandlers = {}; // Create it if it doesn't exist
    }

    // Add the handler
    window.readerHandlers['Bluesky'] = blueskyHandler;
 })();

(function () {
    window.publishHandlers = window.publishHandlers || {};
    window.publishHandlers['Bluesky'] = {
        publish: async (accountData, title, content) => {
            await submitBlueskyPost(content, 'post-result', null, null, null, null, null);
            return null;
        }
    };
})();



// -----------------------------------------------------
    

// Bluesky Feed Functions
// Ensure feedFunctions exists
window.feedFunctions = window.feedFunctions || {};

// Define MastodonFunctions
window.BlueskyFunctions = {
    'Post':        () => openLeftInterface(blueskyPostForm()),
    'Timeline':    fetchBlueskyTimeline.bind(null, 'home'),
    'Favorites':   fetchBlueskyFavorites.bind(null,'favorites'),
    'Pinned':      async () => openLeftInterface(await blueskySelectForm('pinned')),
    'Recommended': async () => openLeftInterface(await blueskySelectForm('recommended')),
    'What\'s Hot': fetchBlueskyWhatsHotFeed.bind(null,'hot'),
    'Search':      () => openLeftInterface(blueskySearchForm()),
};

// Add MastodonFunctions to feedFunctions
window.feedFunctions['Bluesky'] = window.BlueskyFunctions;

// -----------------------------------------------------

async function createBlueskySession() {
    console.log("Starting session creation...");
    let appPassword;
    let handle;
 
    if (accessToken && did) {
        console.log("Reusing existing session:", { accessToken, did, pds });
        return { accessToken, did, pds }; // Reuse existing token and DID
    } else { 


        // Get accessToken and did from accounts
        // If necessary, fetch the accounts from the KVstore
        if (accounts.length === 0) {
            try {
                // Fetch the accounts from the KVstore
                accounts = await getAccounts(flaskSiteUrl); 
            } catch (error) {
                throw new Error('Could not load accounts: ' + error.message);
            }
        }



        // Check for existing login data in accounts
        accounts.forEach(account => {                           // Check the accounts
            const parsedValue = parseAccountValue(account);
            if (!parsedValue) return;
            console.log("checking account: ", parsedValue);
            if (parsedValue.instance.includes('bsky')) {  // Check if 'key' contains 'bluesky'
                console.log("FOUND account: ", parsedValue);
                console.log("parsedValue.id: ", parsedValue.id);
                console.log("parsedValue.key: ", parsedValue.key);
                appPassword = parsedValue.id;
                handle = parsedValue.instance;
            }
        });
    
    
        // Check for required values and handle errors
        if (!appPassword || !handle) {
            throw new Error('No Bluesky account found. Open Accounts and add a Bluesky account (instance URL must include "bsky").');
        }

    }

    console.log("No session data found. Fetching new session...");
    
    try {
        const loginResponse = await fetch('https://bsky.social/xrpc/com.atproto.server.createSession', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                identifier: handle,
                password: appPassword
            }),
        });
        
        if (!loginResponse.ok) {
            console.log("sigh");
            throw new Error(`Login failed: ${loginResponse.statusText}`);
        }

        const sessionData = await loginResponse.json();
        console.log("Session data received:", sessionData);

        // Update global variables with session data
        accessToken = sessionData.accessJwt;
        did = sessionData.did;
        pds = sessionData.serviceEndpoint;

        console.log("Session successfully created:", { accessToken, did, pds });

        return { accessToken, did, pds };

    } catch (error) {

        console.error("Error creating session:", error);
        return { accessToken: null, did: null, pds: null }; // Return null on error
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




        // Function to fetch user feeds from BlueSky API
        async function fetchRecommendedFeeds() {
            // Get session information (accessToken, did)
            const { accessToken, did } = await createBlueskySession();

            try {
                // Call the getSuggestedFeeds endpoint
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
                // Assuming data.feeds contains an array of suggested feeds with titles and AT URIs
                const suggestedFeeds = data.feeds.map(feed => ({
                    title: feed.displayName || feed.name,  // Adjust based on actual feed properties
                    atUri: feed.uri   // Adjust based on actual feed properties
                }));

                return suggestedFeeds;



            } catch (error) {
                console.error("Error fetching user feeds:", error);
                throw error;
            }
        }


        async function fetchPinnedFeeds() {

            // Get session information (accessToken, did)
            const { accessToken, did } = await createBlueskySession();
const pds = 'https://puffball.us-east.host.bsky.network';
            // Call the getPreferences endpoint using POST           
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

            // Extract pinned feed URIs from savedFeedsPrefV2
            const savedFeedsPrefV2 = data.preferences.find(pref => pref.$type === 'app.bsky.actor.defs#savedFeedsPrefV2');
            const pinnedFeedUris = savedFeedsPrefV2?.items
                .filter(item => item.pinned)
                .map(item => item.value) || [];

            // Fetch details for each pinned feed URI to get names
            const pinnedFeeds = await Promise.all(            
                pinnedFeedUris.map(async uri => {            
                    if (!uri.toLowerCase().startsWith('at:')) {  // Must be AT: protocol compliant uri
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
                        title: feedData.view.displayName || "Unnamed Feed",  // Use the display name or a fallback
                        atUri: uri
                    };
                })
            );
            return pinnedFeeds;

        //    console.log('Profilr Data:', JSON.stringify(data, null, 2));

        }



        // Function to populate the dropdown with available feeds and set up selection handling
        function populateFeedDropdown(feeds,select,div) {
            const feedSelect = document.getElementById(select);
            feedSelect.innerHTML = '<option value="" disabled selected>Select Feed</option>'; // Reset dropdown

            feeds.forEach(feed => {
                const option = document.createElement('option');
                option.value = feed.atUri;
                option.textContent = feed.title;
                feedSelect.appendChild(option);
            });

            // Add event listener to handle feed selection
            feedSelect.onchange = function() {
                const selectedOption = this.options[this.selectedIndex];
                const selectedTitle = selectedOption.textContent;
                const selectedUri = selectedOption.value;

                // Hide the dropdown after selection (optional)
                document.getElementById(div).style.display = 'none';

                // Call fetchBlueskyFeed with the selected feed's title and AT URI
                fetchBlueskyFeed(selectedTitle, selectedUri, 20);
            };

        }



 

        // Function to execute the search using the input values
        async function executeBlueskySearch() {
            const query = document.getElementById("queryInput").value;
            const sort = document.getElementById("sortSelect").value;

            // Call fetchBlueskySearch with the input values
            await fetchBlueskySearch(query, sort);

        }

        // Modify fetchBlueskySearch to accept query and sort parameters
        async function fetchBlueskySearch(query, sort) {
            try {
                const { accessToken } = await createBlueskySession(); // Get session information
                const searchParams = new URLSearchParams({
                    q: query,          // User's search query
                    sort: sort,        // Selected sort order
                    limit: 25          // Optional: limit number of posts
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
                // console.log('Search Results Data:', data);
                await displayBlueskyPosts(data.posts.map(post => ({ post })), 'Search', null); // Display with title
            } catch (error) {
                console.error('Error:', error);
                showServiceError('feed-container', 'Bluesky search error', error.message,
                    'Check your Bluesky account credentials under <strong>Accounts</strong>.');
            }
        }


//   Functions to fetch feeds


// Function to fetch and display the user's BlueSky timeline
async function fetchBlueskyTimeline() {

    await fetchBlueskyFeed("Timeline","timeline");


}

// Function to fetch and display the user's BlueSky favorites
async function fetchBlueskyFavorites() {

    await fetchBlueskyFeed("Favorites","favorites");

}


// Function to fetch and display the "What's Hot" BlueSky feed
async function fetchBlueskyWhatsHotFeed() {
    try {
        const { accessToken, did } = await createBlueskySession(); // Get session information
//               const whatsHotFeedUri = `at://${did}/app.bsky.feed.generator/whats-hot`; // Construct URI using did
const whatsHotFeedUri = 'at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/hot-classic';
// https://bsky.app/profile/did:plc:z72i7hdynmk6r22z27h6tvur/feed/hot-classic
        await fetchBlueskyFeed("What's Hot",whatsHotFeedUri); // Call the generic function with the constructed URI
    } catch (error) {
        console.error('Error fetching "What\'s Hot" feed:', error);
        showServiceError('feed-container', 'Bluesky error', error.message,
            'Check your Bluesky account credentials under <strong>Accounts</strong>.');
    }
}




        async function fetchBlueskyFeed(title, atUri, limit = 20, cursor = null) {

            // Create a Bluesky session
            const { accessToken, did } = await createBlueskySession();


            try {

                

                let url;
                if (atUri === 'timeline') {
                    url = 'https://bsky.social/xrpc/app.bsky.feed.getTimeline?limit=20';
                } else if (atUri === 'favorites') {
                    url = `https://bsky.social/xrpc/app.bsky.feed.getActorLikes?actor=${did}`;
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
                
                // Extract the cursor from the data
                cursor = data.cursor;
                cursor = (cursor && cursor.includes(':')) ? cursor : null;   // Test for end of feed

                              
                // console.log('Full Feed Data:', JSON.stringify(data, null, 2));

                // Wrap each post in an object with a `post` key to match displayBlueskyPosts expectations

                // Define keywords to filter out sensitive content
                const adultKeywords = ["adult", "sensitive", "nsfw", "porn"];

                const posts = data.feed
                    .filter(item => 
                        item.post && 
                        !item.post.labels.some(label => 
                            adultKeywords.includes(label.val.toLowerCase())
                        )
                    )
                    .map(item => ({ post: item.post })); // Wrap each post with a `post` key

                // Log the final posts array
                // console.log("Wrapped Posts Array:", posts);

                // Pass the array of posts to the display function
                // console.log('Posts:', JSON.stringify(data, null, 2));
                await displayBlueskyPosts(posts, title, cursor,atUri);

            } catch (error) {
                console.error("Error fetching feed:", error);
                showServiceError('feed-container', 'Bluesky error', error.message,
                    'Check your Bluesky account credentials under <strong>Accounts</strong>.');
            }
        }












        // Function to display BlueSky posts on the page
        async function displayBlueskyPosts(posts, title, cursor = null, atUri) {
            const timelineElement = document.getElementById('feed-container');

            if (title != null) {                                        // First page will have a title, but not subsequent pages
                timelineElement.innerHTML = '';                         // Clear previous content
                if (title === 'Thread') { feedTitle = "Bluesky Thread"}
                else { feedTitle = title; }
                timelineElement.appendChild(createFeedHeader(feedTitle));   // Header
            }

            const summary = document.createElement("div");      // Summary container, if desired
            summary.id = "feed-summary";
            timelineElement.appendChild(summary);

            for (const item of posts) {
                const post = item.post;
                const authorName = post.author.displayName || "Unknown Author";
                const postContent = post.record.text || "No content available";
                const handle = post.author.handle;
                const postId = post.uri.split('/').pop(); // Extract the post ID from the URI
                const postUrl = `https://bsky.app/profile/${handle}/post/${postId}`;

                // Create the Status Box div
                const statusBox = document.createElement('div');
                statusBox.classList.add('status-box');

                // Create the status content div
                const statusContent = document.createElement('div');
                statusContent.classList.add('status-content');
                statusBox.appendChild(statusContent);

                // Translate content
                try {       
                    translatedContent = await processTranslationWithTimeout(postContent);
                // console.log('Translated Content:', translatedContent);
                } catch (translationError) {
                    console.error(`Error translating status ${postId}:`, translationError);
                    translatedContent = "[Translation failed]";
                }                                        
                //const translatedContent = await processTranslation(status.content);
                //  const translatedContent = status.content;
                //console.log(status);

                // Translate content
                // ${postContent}
                // to be added

                // Reblog Information
                // To be added

                // Create the post-specific content div
                const statusSpecific = document.createElement('div');
                statusSpecific.classList.add('statusSpecific');
                statusSpecific.id = `${postId}`;
                statusSpecific.innerHTML = `
                <p><a href="#" onclick="loadMastodonFeed('user',null,'@${authorName}'); return false;" title='View User Thread'>${authorName}</a> (@${authorName}) wrote: 
                ${translatedContent} 
                `;
                statusContent.appendChild(statusSpecific);

                // Check if the post contains images and add them if present
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

                // Create reference
                statusSpecific.reference = {
                    author_name: authorName,
                    author_id: authorName,
                    url: postUrl,
                    title: 'Bluesky',
                    created_at: new Date().toISOString(),
                    id: statusSpecific.id,
                };

                // Determine initial like/repost state from API viewer object
                const isLiked    = !!(post.viewer && post.viewer.like);
                const isReposted = !!(post.viewer && post.viewer.repost);
                const likeUri    = post.viewer?.like   || '';
                const repostUri  = post.viewer?.repost || '';

                // Determine thread URI if this post is part of one
                const inThread = (post.record.reply && post.record.reply.root && post.record.reply.root.uri) || post.replyCount > 0;
                const threadUri = inThread
                    ? (post.record.reply?.root?.uri || post.uri)
                    : null;

                // Reply URIs for reply form
                const parentUri  = post.uri;
                const parentCid  = post.cid;
                const rootUri    = post.record.reply?.root?.uri  || post.uri;
                const rootCid    = post.record.reply?.root?.cid  || post.cid;

                // Build action buttons as innerHTML string (matches Mastodon pattern)
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

                // Create the clist buttons div to the right of the status
                const clistButtons = document.createElement('div');
                clistButtons.classList.add('clist-actions');
                clistButtons.innerHTML = `
                    <button class="material-icons md-18 md-light" onclick="loadContentToEditor('${postId}');" title="Load in editor">arrow_right</button>
                    <button class="clist-action-btn" onclick="shareToChat('${postId}');" title="Share to chat"><span class="material-icons md-18 md-light">chat_bubble_outline</span></button>
                `;
                statusBox.appendChild(clistButtons);

                timelineElement.appendChild(statusBox);

            };


            // Remove any existing "Load More" button before adding a new one
            const existingButton = document.getElementById('loadMoreButton');
            if (existingButton) {
                existingButton.remove();
            }

            // If there's a cursor, create the "Load More" button
            if (cursor && cursor != 1) {
                const loadMoreButton = document.createElement('button');
                loadMoreButton.id = 'loadMoreButton';
                loadMoreButton.innerText = "Load More";
                loadMoreButton.onclick = () => {
                    fetchBlueskyFeed(null,atUri, 20, cursor);
                };
                timelineElement.appendChild(loadMoreButton);
            }


        }

        function loadBlueskyLinkToContent(postId) {

            const item_content = document.getElementById(`${postId}`).innerHTML;
            var childDiv = document.createElement('div');
            childDiv.innerHTML = item_content;          
            childDiv.onclick = function() {
                this.contentEditable = this.contentEditable !== 'true';
                this.focus();
            };
            
            // Loads the textarea
            var textarea = document.getElementById('write-column');
            textarea.value += item_content;
    
            // Loads TinyMCE
            var tinymcecontent = tinymce.get("write-column").getContent();
            tinymcecontent += item_content;
            tinymce.get("write-column").setContent(tinymcecontent);
    
        }
    
    


        // Toggle like or repost on a Bluesky post.
        // button.dataset.recordUri holds the AT URI of the existing record (if active).
        async function handleBlueskyAction(uri, cid, postId, action, button) {
            const { accessToken, did } = await createBlueskySession();
            const isActive = button && button.classList.contains('action-active');
            const collectionMap = { favorite: 'app.bsky.feed.like', repost: 'app.bsky.feed.repost' };
            const collection = collectionMap[action];

            try {
                if (isActive) {
                    // Remove existing record (unlike / unrepost)
                    const recordUri = button.dataset.recordUri;
                    const rkey = recordUri.split('/').pop();
                    const response = await fetch('https://bsky.social/xrpc/com.atproto.repo.deleteRecord', {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ repo: did, collection, rkey }),
                    });
                    if (!response.ok) throw new Error((await response.json()).message);
                    if (button) { button.classList.remove('action-active'); button.dataset.recordUri = ''; }
                } else {
                    // Create new record (like / repost)
                    const record = {
                        '$type': `app.bsky.feed.${action === 'favorite' ? 'like' : 'repost'}`,
                        createdAt: new Date().toISOString(),
                        subject: { uri, cid }
                    };
                    const response = await fetch('https://bsky.social/xrpc/com.atproto.repo.createRecord', {
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

        


        // Function to fetch a post by its URI
        async function fetchPostByUri(uri) {
            const { accessToken } = await createBlueskySession();
            const response = await fetch(`https://bsky.social/xrpc/app.bsky.feed.getPosts?uris=${encodeURIComponent(uri)}`, {
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
               // console.log("\n\n\nDATA POSTS\n\n\n");
               // console.log(JSON.stringify(data.posts, null, 2)); // Pretty-print with 2 spaces
                return data.posts[0]; // Return the first post in the posts array
            } else {
                console.warn(`No post found for URI: ${uri}`);
                return null;
            }
        }


        // Function to fetch the full thread for a specific post by its URI using app.bsky.feed.getPostThread
        async function fetchThreadByUri(uri) {
            const { accessToken } = await createBlueskySession();
            const response = await fetch(`https://bsky.social/xrpc/app.bsky.feed.getPostThread?uri=${encodeURIComponent(uri)}&depth=6`, {
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
            return data.thread || null; // Assuming the full thread is in `data.thread`
        }



        // Function to display the thread of a specific post
        async function displayThread(uri) {
            // console.log(`Fetching full thread for post with URI: ${uri}`);
            const threadData = await fetchThreadByUri(uri);

            if (!threadData) {
                document.getElementById('feed-container').innerText = 'Failed to load thread. No data found for the post thread.';
                return;
            }

            // Parse the thread data to extract posts in the correct order
            const threadPosts = parseThreadToPosts(threadData);

            // console.log("Collected full thread posts:", threadPosts);

            // Display the full thread with displayBlueskyPosts
            await displayBlueskyPosts(threadPosts, 'Thread', null);
        }

        // Helper function to flatten the thread structure into a list of posts
        function parseThreadToPosts(thread) {
            const posts = [];

            function traverse(node) {
                if (!node || !node.post) return;
                posts.push({ post: node.post }); // Add the post to the list

                // Traverse replies recursively, if available
                if (node.replies && Array.isArray(node.replies)) {
                    node.replies.forEach(reply => traverse(reply));
                }
            }

            traverse(thread); // Start with the root of the thread
            return posts;
        }

// Function to receive content from a form to submit a new post or reply

async function submitBlueskyPostFromForm(replyContentId = null, responseDiv = 'blueskyPostResponse',parentUri = null, parentCid = null, rootUri = null, rootCid = null) {
    postContent = replyContentId ? document.getElementById(replyContentId).value : 'No content';
    await submitBlueskyPost(postContent,responseDiv = 'blueskyPostResponse',replyContentId,parentUri, parentCid, rootUri, rootCid);
    document.getElementById(replyContentId).value = '';
}



// Function to submit a new post or reply
 
async function submitBlueskyPost(content,responseDiv,replyContentId = null,parentUri = null, parentCid = null, rootUri = null, rootCid = null) {
    
    // Set up Bluesky account parameters
    const { accessToken, did } = await createBlueskySession();
    const uri = "https://bsky.social/xrpc/com.atproto.repo.createRecord";

    // Construct the request payload
    const record = {
        "$type": "app.bsky.feed.post",
        text: content,
        createdAt: new Date().toISOString(),
    };

    // Set reply structure if needed
    if (parentUri && parentCid && rootUri && rootCid) {
        responseDiv = `replyResponse-${replyContentId.split('-')[1]}`;
        record.reply = {
            root: { uri: rootUri, cid: rootCid },
            parent: { uri: parentUri, cid: parentCid },
        };
    }

    // Compose the request body
    const requestBody = {
        collection: "app.bsky.feed.post",
        repo: did,
        record: record,
    };

    // Send the post
    try {
        const response = await fetch(uri, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(requestBody),
        });

        // Report error, or
        if (!response.ok) {
            const error = await response.json();
            console.error("Error response:", error);
            throw new Error(`Error: ${error.message || response.statusText}`);
        }

        // Acknowledge success
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
            

            


// Opens a div and populares a select dropdown to allow us to select a feed to display
// Types of feed include 'pinned' and 'recommended'
function selectBlueskyFeed(listType) {

        if (listType === 'pinned') {
            if (window.getComputedStyle(blueskyPinnedDiv).display !== 'block') {
                fetchPinnedFeeds().catch(err => showStatusMessage('Could not load pinned feeds: ' + err.message)); }
            toggleFormDisplay('blueskyPinnedDiv','left');
        } else if (listType === 'recommended') {
            if (window.getComputedStyle(blueskyRecommendedDiv).display !== 'block') {
                fetchRecommendedFeeds().catch(err => showStatusMessage('Could not load recommended feeds: ' + err.message)); }
            toggleFormDisplay('blueskyRecommendedDiv','left');
        } else if (listType === 'search') {
            toggleFormDisplay('blueskySearchDiv','left');
        } else {
            console.error("Unrecognized list type for selectBlueskyFeed();")
        }

}


// Not used in CList

        // Function to toggle the visibility of the search div
        function toggleBlueskyDiv(div) {
            const searchDiv = document.getElementById(div);
            searchDiv.style.display = searchDiv.style.display === "none" ? "block" : "none";
        }
