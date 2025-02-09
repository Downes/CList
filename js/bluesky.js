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


let accessToken = null; // Global variable for access token
let did = null; // Global variable to store the DID
let pds = null; // Personal data Server location

// Handlers


(function () {
    const blueskyHandler = {
        initialize: async(instance, accessToken) => {

            createBlueskySession(instance, accessToken);

            blueskyForms();

        },        
        feedFunctions: {
            'Post': toggleFormDisplay.bind(null, 'blueSkyStatusFormDiv','left'),
            'Timeline': fetchBlueskyTimeline.bind(null, 'home'),
            'Favorites': fetchBlueskyFavorites.bind(null,'favorites'),
            'Pinned': selectBlueskyFeed.bind(null,'pinned'),
            'Recommended': selectBlueskyFeed.bind(null,'recommended'),
            'What\'s Hot': fetchBlueskyWhatsHotFeed.bind(null,'hot'),
            'Search': selectBlueskyFeed.bind(null,'search'),
        }
    };
    // Ensure readerHandlers exists
    if (typeof window.readerHandlers === 'undefined') {
    window.readerHandlers = {}; // Create it if it doesn't exist
    }

    // Add the handler
    window.readerHandlers['Bluesky'] = blueskyHandler;
 })();



// -----------------------------------------------------
    

// Bluesky Feed Functions
// Ensure feedFunctions exists
window.feedFunctions = window.feedFunctions || {};

// Define MastodonFunctions
window.BlueskyFunctions = {
        'Post': toggleFormDisplay.bind(null, 'blueSkyStatusFormDiv','left'),
        'Timeline': fetchBlueskyTimeline.bind(null, 'home'),
        'Favorites': fetchBlueskyFavorites.bind(null,'favorites'),
        'Pinned': selectBlueskyFeed.bind(null,'pinned'),
        'Recommended': selectBlueskyFeed.bind(null,'recommended'),
        'What\'s Hot': fetchBlueskyWhatsHotFeed.bind(null,'hot'),
        'Search': selectBlueskyFeed.bind(null,'search'),
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
                alert('Error getting Editor accounts: ' + error.message);
            }
        }



        // Check for existing login data in accounts
        accounts.forEach(account => {                           // Check the accounts
            const parsedValue = JSON.parse(account.value);
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
            alert("ApiKey and url are both required to continue.");
            throw new Error("Missing required values: apiKey or url.");
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



function blueskyForms() {

    let divId = 'blueSkyStatusFormDiv';
    let div = document.getElementById(divId);
    if (!div) {

        // Post Status
        pdiv = document.createElement('div');
        pdiv.id = divId;
        pdiv.style.display = 'none';
        pdiv.innerHTML = `
            <textarea id="blueskyPostContent" placeholder="Write something..." rows="4" style="width: 100%;"></textarea>
            <button onclick="submitBlueskyPostFromForm('blueskyPostContent')">Post</button>
            <div id="blueskyPostResponse" class="reply-response"></div>
        `;
        // Append the div to the left content container
        const leftContent = document.getElementById('left-content');
        if (leftContent) { leftContent.prepend(pdiv); } 
        else { console.error("Element with ID 'left-content' not found.");   }

        // Pinned
        pndiv = document.createElement('blueskyPinnedDiv');
        pndiv.id = divId;
        pndiv.style.display = 'none';
        pndiv.innerHTML = `
            <select id="blueskyPinnedSelect">
                <option value="" disabled selected>Select Feed</option>
            </select>
        `;
        leftContent.prepend(pndiv);  

        // Recommended
        rdiv = document.createElement('blueskyRecommendedDiv');
        rdiv.id = divId;
        rdiv.style.display = 'none';
        rdiv.innerHTML = `
            <select id="blueskyRecommendedSelect">
                <option value="" disabled selected>Select Feed</option>
            </select>
        `;
        leftContent.prepend(rdiv); 

        sdiv = document.createElement('blueskyRecommendedDiv');
        sdiv.id = divId;
        sdiv.style.display = 'none';
        sdiv.innerHTML = `
            <label for="queryInput">Query:</label>
            <input type="text" id="queryInput" placeholder="Enter search query" />

            <label for="sortSelect">Sort by:</label>
            <select id="sortSelect">
                <option value="top">Top</option>
                <option value="latest">Latest</option>
            </select>

            <button onclick="executeBlueskySearch()">Search</button>
            `;
        leftContent.prepend(sdiv);

    }


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

                // Populate the dropdown with suggested feeds
                populateFeedDropdown(suggestedFeeds,'blueskyRecommendedSelect','blueskyRecommendedDiv');



            } catch (error) {
                console.error("Error fetching user feeds:", error);
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
            // Populate the dropdown with pinned feeds
            populateFeedDropdown(pinnedFeeds,'blueskyPinnedSelect','blueskyPinnedDiv');

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

                // Call fetchBlueskyFeed with the selected feed’s title and AT URI
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
                document.getElementById('feed-container').innerText = 'Failed to load search results. Please check console for details.';
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
                    throw new Error(`Failed to fetch feed: ${response.statusText}`);
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

                // Create the action buttons div below the status
                const blueskyActionButtons = document.createElement('div');
                blueskyActionButtons.classList.add('status-actions');
                
                // Create the reply button
                const replyButton = document.createElement('button');
                replyButton.setAttribute('class', 'material-icons md-18 md-light');
                replyButton.innerText = "reply";
                replyButton.onclick = () => {
                    replyForm.style.display = replyForm.style.display === 'none' ? 'block' : 'none';
                };
                blueskyActionButtons.appendChild(replyButton);

                // Create the favorite button
                const favoriteButton = document.createElement('button');
                favoriteButton.setAttribute('class', 'material-icons md-18 md-light');
                favoriteButton.innerText = "favorite";
                favoriteButton.onclick = () => {
                    handleBlueskyAction(post.uri, post.cid, postId, 'favorite');
                };
                blueskyActionButtons.appendChild(favoriteButton);

                // Create the repost button
                const repostButton = document.createElement('button');
                repostButton.setAttribute('class', 'material-icons md-18 md-light');
                repostButton.innerText = "autorenew";
                repostButton.onclick = () => {
                    handleBlueskyAction(post.uri, post.cid, postId, 'repost');
                };
                blueskyActionButtons.appendChild(repostButton);

                // Check if the post is part of a thread and add "Thread" button if so
                if ((post.record.reply && post.record.reply.root && post.record.reply.root.uri) || post.replyCount > 0) {

                    // Determine the URI for the thread
                    const threadUri = post.record.reply && post.record.reply.root && post.record.reply.root.uri 
                    ? post.record.reply.root.uri 
                    : post.uri; // Use the post's own URI if it’s the root

                    // Create the thread button
                    const threadButton = document.createElement('button');
                    threadButton.setAttribute('class', 'material-icons md-18 md-light');
                    threadButton.innerText = "dynamic_feed";
                    threadButton.onclick = () => {
                        displayThread(threadUri);
                    };
                    blueskyActionButtons.appendChild(threadButton);                 

                }


                // Create the launch button (opens the post in a new window)
                const launchButton = document.createElement('button');
                launchButton.setAttribute('class', 'material-icons md-18 md-light');
                launchButton.innerText = "launch";
                launchButton.onclick = () => {
                    window.open(postUrl, '_blank', 'width=800,height=600,scrollbars=yes');
                };
                blueskyActionButtons.appendChild(launchButton);


                statusContent.appendChild(blueskyActionButtons);

                // Response to actions
                
                const blueskyReplyForm = document.createElement('div');
                blueskyReplyForm.id = 'blueskyPostResponse';

                // Create the reply form
                const replyForm = document.createElement('div');
                replyForm.style.display = 'none'; // Hidden by default
                replyForm.classList.add('reply-form');
                replyForm.innerHTML = `
                    <textarea id="replyContent-${postId}" placeholder="Type your reply here"></textarea>
                    <button onclick="submitBlueskyPostFromForm('replyContent-${postId}','replyResponse-${postId}','${post.uri}', '${post.cid}', '${post.record.reply ? post.record.reply.root.uri : post.uri}', '${post.record.reply ? post.record.reply.root.cid : post.cid}')">Submit Reply</button>
                    <div id="replyResponse-${postId}" class="reply-response"></div>
                `;
                statusContent.appendChild(replyForm);

                // Create the clist buttons div to the right of the status
                const clistButtons = document.createElement('div');
                clistButtons.classList.add('clist-actions');
                clistButtons.innerHTML = `
                    <button class="material-icons md-18 md-light" onClick="loadContentToTinyMCE('${postId}');">arrow_right</button>
                    
                `;
                statusBox.appendChild(clistButtons);

                timelineElement.appendChild(statusBox);

            };


            // Remove any existing "Load More" button before adding a new one
            const existingButton = document.getElementById('loadMoreButton');
            if (existingButton) {
                existingButton.remove();
            }

            // If there’s a cursor, create the "Load More" button
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
    
    


        // Function to favorite or repost a post
        async function handleBlueskyAction(uri, cid, postId, action) {
            const { accessToken, did } = await createBlueskySession();
            const responseElement = document.getElementById(`replyResponse-${postId}`) || document.getElementById('blueskyPostResponse');

            try {
                const { accessToken } = await createBlueskySession();

                const actionMap = {
                    favorite: {
                        "$type": "app.bsky.feed.like",
                        collection: "app.bsky.feed.like"
                    },
                    repost: {
                        "$type": "app.bsky.feed.repost",
                        collection: "app.bsky.feed.repost"
                    }
                };

                if (!actionMap[action]) {
                    throw new Error('Invalid action specified. Use "favorite" or "repost".');
                }

                const record = {
                    "$type": actionMap[action].$type,
                    createdAt: new Date().toISOString(),
                    subject: {
                        uri: uri,
                        py_type: 'com.atproto.repo.strongRef',
                        cid: cid
                    }
                };

                const response = await fetch('https://bsky.social/xrpc/com.atproto.repo.createRecord', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        collection: actionMap[action].collection,
                        repo: did,
                        record: record
                    }),
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(`Error performing action: ${errorData.message || JSON.stringify(errorData)}`);
                }

                // Confirm the action
                responseElement.innerHTML = action === 'favorite' 
                    ? 'Post added to favorites!' 
                    : 'Post reposted successfully!';
                alert("Completed adding "+action);
                setTimeout(() => {
                    responseElement.innerHTML = '';
                }, 3000);
                
            } catch (error) {
                console.error('Error:', error);
                responseElement.innerText = `Failed to perform action (${action}). Check console for details.`;
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
    }
}
            

            


// Opens a div and populares a select dropdown to allow us to select a feed to display
// Types of feed include 'pinned' and 'recommended'
function selectBlueskyFeed(listType) {

        if (listType === 'pinned') {
            if (window.getComputedStyle(blueskyPinnedDiv).display !== 'block') {
                fetchPinnedFeeds(); }  // Don't fetch when we're closing an open div
            toggleFormDisplay('blueskyPinnedDiv','left');
        } else if (listType === 'recommended') {
            if (window.getComputedStyle(blueskyRecommendedDiv).display !== 'block') {
                fetchRecommendedFeeds(); }  // Don't fetch when we're closing an open div
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
