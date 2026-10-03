//  mastodon.js  -  helper and utility functions for Mastodon API
//  Part of CList, the next generation of learning and connecting with your community
//
//  Version version 0.1 created by Stephen Downes on January 27, 2025
//
//  Copyright Stephen Downes 2025, downes.ca
//  Licensed under Creative Commons Attribution 4.0 International https://creativecommons.org/licenses/by/4.0/
//
//  This software carries NO WARRANTY OF ANY KIND.
//  This software is provided "AS IS," and you, its user, assume all risks when using it.

window.CList.schemas = window.CList.schemas || {};
window.CList.schemas['Mastodon'] = {
    type: 'Mastodon',
    instanceFromKey: true,
    kvKey: { label: 'Username', placeholder: 'you@mastodon.social' },
    fields: [
        { key: 'title',       label: 'Title',        editable: true,  inputType: 'text',     placeholder: 'My Mastodon', default: '' },
        { key: 'permissions', label: 'Permissions',  editable: true,  inputType: 'text',     placeholder: 'rw',          default: 'rw' },
        { key: 'id',          label: 'Access Token',   editable: false, inputType: 'oauth', placeholder: '',            default: '' },
        { key: 'maxlength',   label: 'Maximum Length', editable: true,  inputType: 'text',  placeholder: '500',         default: '500' },
    ]
};
// 


// Key functions

//    initializeMasto: Verifies the credentials of the selected Mastodon account. Note that the credential provided is the Mastodon access token 

//    loadMastodonFeed: Fetches various types of timelines (home, local, bookmarks, hashtag, user) and paginates the results.

//    handleMastodonAction: Allows users to perform actions like replying, boosting, favoriting, or bookmarking a status.

//    postMastodonStatus: Posts a new status or replies to an existing one.


// Module-scope credentials — set by initialize(), read by loadMastodonFeed() etc.
// Declared here so they shadow the <div id="baseURL"> / <div id="accessToken"> DOM
// element implicit globals that the browser otherwise exposes on window.
let baseURL     = null;
let accessToken = null;

// -----------------------------------------------------
//
// Handle Mastodon Actions
//

          (function () {
              const mastodonHandler = {
                initialize: async (accountData) => {
                    baseURL     = extractBaseUrl(accountData.instance);
                    accessToken = accountData.id;
                    await initializeMasto(baseURL, accessToken);
                },
                onFeedClick:   (item) => loadMastodonFeed('user', null, '@' + (item.mastodon?.acct || item.author_id || '')),
                onAuthorClick: null,
                statusActions: (item, _itemID, _itemUrl) => {
                    const { statusId, isReblogged, isFavourited, isBookmarked, inThread } = item.mastodon || {};
                    const threadsBtn = inThread
                        ? `<button class="clist-action-btn" title="View thread" onclick="handleMastodonAction('${_heJs(statusId)}', 'thread')"><span class="material-icons md-18 md-light">dynamic_feed</span></button>`
                        : '';
                    return `
                        <button class="clist-action-btn" title="Reply" onclick="handleMastodonAction('${_heJs(statusId)}', 'reply', this.parentElement)"><span class="material-icons md-18 md-light">reply</span></button>
                        <button class="clist-action-btn${isReblogged ? ' action-active' : ''}" title="Boost" onclick="handleMastodonAction('${_heJs(statusId)}', 'boost', this)"><span class="material-icons md-18 md-light">autorenew</span></button>
                        <button class="clist-action-btn${isFavourited ? ' action-active' : ''}" title="Favourite" onclick="handleMastodonAction('${_heJs(statusId)}', 'favorite', this)"><span class="material-icons md-18 md-light">favorite</span></button>
                        <button class="clist-action-btn${isBookmarked ? ' action-active' : ''}" title="Bookmark" onclick="handleMastodonAction('${_heJs(statusId)}', 'bookmark', this)"><span class="material-icons md-18 md-light">bookmarks</span></button>
                        ${threadsBtn}
                        <button class="clist-action-btn" title="Open in browser" onclick="openInBrowser('${_heJs(_itemUrl)}', '${_heJs(_itemID)}')"><span class="material-icons md-18 md-light">launch</span></button>
                    `;
                },
                feedFunctions: {
                    'Post':          () => openLeftInterface(mastodonStatusForm()),
                    'Following':     loadMastodonFeed.bind(null, 'home', null),
                    'Notifications': loadMastodonNotifications.bind(null, null),
                    'Bookmarks':     loadMastodonFeed.bind(null, 'bookmarks', null),
                    'Lists':         loadMastodonLists.bind(null, 'list', null),
                    'Local':         loadMastodonFeed.bind(null, 'local', null),
                    'Hashtag':       () => openLeftInterface(mastodonInputForm('hashtag', 'Enter a hashtag without the #')),
                    'User':          () => openLeftInterface(mastodonInputForm('user', '@username@instance.social'))
                }
              };

              // Ensure readerHandlers exists
              if (typeof window.CList.readers === 'undefined') {
                window.CList.readers = {}; // Create it if it doesn't exist
              }
            
              // Add the handler
              window.CList.readers['Mastodon'] = mastodonHandler;

           })();

(function () {
    window.CList.publishers = window.CList.publishers || {};
    window.CList.publishers['Mastodon'] = {
        acceptedFormats: ['text'],
        publish: async (accountData, title, content, refs) => {
            const responseDiv = window.CList.ui.view.postResult;
            const cleanContent = removeHtml(content);
            const mastodonRefs = (refs || []).filter(r => r.replyToken?.type === 'Mastodon');
            const replyToId = mastodonRefs[0]?.replyToken?.statusId || null;
            if (mastodonRefs.length > 1) {
                showStatusMessage(
                    `Replying to "${mastodonRefs[0].author_name}" on Mastodon. ` +
                    `Cannot simultaneously reply to ${mastodonRefs.length - 1} other Mastodon ` +
                    `post${mastodonRefs.length > 2 ? 's' : ''} — Mastodon only supports one reply target.`
                );
            }
            await postMastodonStatus(accountData.id, extractBaseUrl(accountData.instance), responseDiv, cleanContent, replyToId);
            return null;
        }
    };
})();


// Mastodon Feed Functions
// Ensure feedFunctions exists
window.feedFunctions = window.feedFunctions || {};

// Define MastodonFunctions
window.MastodonFunctions = {
    'Post':      () => openLeftInterface(mastodonStatusForm()),
    'Following':  loadMastodonFeed.bind(null, 'home', null),
    'Bookmarks':  loadMastodonFeed.bind(null, 'bookmarks', null),
    'Lists':      loadMastodonLists.bind(null, 'list', null),
    'Local':      loadMastodonFeed.bind(null, 'local', null),
    'Hashtag':   () => openLeftInterface(mastodonInputForm('hashtag', 'Enter a hashtag without the #')),
    'User':      () => openLeftInterface(mastodonInputForm('user', '@username@instance.social'))
};

// Add MastodonFunctions to feedFunctions
window.feedFunctions['Mastodon'] = window.MastodonFunctions;

// -----------------------------------------------------
    
// Function to initialize the Mastodon client with a specific account
async function initializeMasto(baseURL, accessToken) {
    if (!accessToken || !baseURL) {
        console.error('Error: Access token or baseURL is missing');
        return;
    }

    try {
        console.log('Attempting to initialize Mastodon client for', baseURL);

        // Make a test request to verify the credentials
        const response = await fetch(`${baseURL}/api/v1/accounts/verify_credentials`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        // Check if the request was successful
        if (!response.ok) {
            throw new Error(`Failed to verify account: ${response.statusText}`);
        }

        const accountData = await response.json();
        console.log('Successfully authenticated:', accountData);

        // Update the UI to reflect the successful account selection
        const accountStatusDiv = document.getElementById('account-status');
        accountStatusDiv.innerHTML = `<p>Successfully switched to the account on ${baseURL}</p>`;
        accountStatusDiv.innerHTML += `<p>Logged in as ${accountData.display_name} (@${accountData.acct})</p>`;


    } catch (error) {
        const accountStatusDiv = document.getElementById('account-status');
        accountStatusDiv.innerHTML = `<p>Error initializing Mastodon client: ${error.message}</p>`;
        console.error('Error initializing Mastodon client:', error);
    }

}





// Functions to create interaction forms in the left pane

// Returns a text-input form for parameterised feed requests (hashtag, user, etc.)
function mastodonInputForm(type, placeholder) {
    const ucfirstType = ucfirst(type);
    const div = document.createElement('div');
    div.innerHTML = `
        <label for="mastodon-${type}">Enter a ${ucfirstType}:</label>
        <input type="text" id="mastodon-${type}" placeholder="${placeholder}" />
        <button onclick="loadMastodonFeed('${type}');">Submit ${ucfirstType}</button>
    `;
    return div;
}

// Returns a status-posting form (new post or reply)
function mastodonStatusForm() {
    const div = document.createElement('div');
    div.innerHTML = `
        <form id="statusForm" onsubmit="postStatusFromForm(event);">
            <label class="visually-hidden" for="status">Status:</label><br>
            <textarea id="status" name="status" rows="4" cols="50" placeholder="What's on your mind?"></textarea>
            <input type="hidden" id="statusIDInput" name="statusID" value="">
            <br><br>
            <button type="submit">Post Status</button>
        </form>
        <div id="response" style="margin-top:10px;"></div>
    `;
    return div;
}




// Fetch my list of lists
// Access token and base URL are global variables
async function loadMastodonLists(type) {
    const endpoint = `${baseURL}/api/v1/lists`;
    try {
        const response = await fetch(endpoint, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });
        if (!response.ok) {
            throw new Error(`Error fetching lists: ${response.status} ${response.statusText}`);
        }
        const lists = await response.json();
        openLeftInterface(createMastodonListDropdown(lists));
    } catch (error) {
        console.error('Error loading lists:', error);
        showStatusMessage('Could not load Mastodon lists: ' + error.message);
    }
}

// Returns a <select> dropdown populated with the user's Mastodon lists
function createMastodonListDropdown(lists) {
    const select = document.createElement('select');
    select.id = 'mastodonList';

    const defaultOption = document.createElement('option');
    defaultOption.text = 'Select a List';
    defaultOption.value = '';
    defaultOption.disabled = true;
    defaultOption.selected = true;
    select.appendChild(defaultOption);

    lists.forEach(list => {
        const option = document.createElement('option');
        option.text = list.title;
        option.value = list.id;
        select.appendChild(option);
    });

    select.addEventListener('change', () => {
        loadMastodonFeed('list');
    });

    return select;
}


async function constructThreadData(threadData, statusID, baseURL, accessToken) {
    const data = []; // Final array to hold all statuses

    try {
        // 1. Append ancestors first
        if (Array.isArray(threadData.ancestors)) {
            data.push(...threadData.ancestors);
        }

        // 2. Fetch the current status using GET
        const response = await fetch(`${baseURL}/api/v1/statuses/${statusID}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const currentStatus = await response.json();
            console.log('Current Status:', currentStatus);

            // Append current status to the array
            data.push(currentStatus);
        } else {
            console.error('Failed to fetch current status:', await response.text());
            return null; // Handle error gracefully
        }

        // 3. Append descendants
        if (Array.isArray(threadData.descendants)) {
            data.push(...threadData.descendants);
        }

        console.log('Constructed Thread Data:', data);
        return data; // Return the combined list of statuses
    } catch (error) {
        console.error('Error constructing thread data:', error);
        return null; // Handle unexpected errors
    }
}




function renderMastodonNextPageButton(feedContainer, nextPageUrl, onLoadNext) {
    let btn = document.getElementById('nextPageButton');
    if (nextPageUrl) {
        if (!btn) {
            btn = document.createElement('button');
            btn.id = 'nextPageButton';
            btn.className = 'btn';
            btn.textContent = 'Load Next Page';
            feedContainer.appendChild(btn);
        }
        btn.onclick = () => onLoadNext(nextPageUrl);
        btn.style.display = '';
    } else if (btn) {
        btn.style.display = 'none';
    }
    if (btn) feedContainer.appendChild(btn);
}

// Function to load and display Mastodon feeds (GET requests)
// baseURL and accessToken are global variables
let nextPageUrl = null;  // To store the URL for the next page
async function loadMastodonFeed(type, pageUrl = null,typevalue = null) {
console.log("baseURL "+baseURL+" accessRoken "+accessToken+" and Loading feed type "+type);
  //  const accessToken = document.getElementById('accessToken').value;
  //  const baseURL = document.getElementById('baseURL').value;
    const feedContainer = window.CList.ui.view.feedContainer;

    if (!accessToken || !baseURL) {
        console.error('Error: Access token or baseURL is missing');
        showServiceError(feedContainer, 'Mastodon error', 'Feed client not initialized.',
            'Select a Mastodon account using the <strong>Find</strong> button.');
        return;
    }

    let url;
    let data;
    let page = 1;
    try {

        if (pageUrl) {
            url = pageUrl;  // Use next page URL if provided
            page++;
            data = await getMastodonFeed(url,type,feedContainer);
        } else if (type === 'thread') { // Build data array from ancestors and descendants
            feedContainer.innerHTML = '';  // Clear feed when loading the first page
            statusID = typevalue;   // From the 'thread' button
            url = `${baseURL}/api/v1/statuses/${statusID}/context`;
            threadData = await getMastodonFeed(url,type,feedContainer);
            data = await constructThreadData(threadData, statusID, baseURL, accessToken)
                .then(result => { 
                    console.log('Final Thread Data:', result); 
                    return result; // Ensure the data is returned
                })
                .catch(err => {
                    console.error('Unexpected Error:', err);
                    return null; // Handle errors gracefully
                });
        } else {
            feedContainer.innerHTML = '';  // Clear feed when loading the first page
            
            if (type === 'home') {
                url = `${baseURL}/api/v1/timelines/home`;   
            } else if (type === 'local') {
                url = `${baseURL}/api/v1/timelines/public?local=true`;  
            } else if (type === 'bookmarks') {
                url = `${baseURL}/api/v1/bookmarks`;   
            } else if (type === 'list'){  // List ID is pre-defined in id='mastodonList'
                const Mastodonlistid = document.getElementById('mastodonList').value.trim();  
                url = `${baseURL}/api/v1/timelines/list/${Mastodonlistid}`;
            } else if (type === 'hashtag') { // Hashtag value from typevalue or form element
                typevalue = typevalue || document.getElementById('mastodon-hashtag').value.trim();
                if (!typevalue) { feedContainer.innerHTML = `<p class="feed-status-message">Please enter a hashtag.</p>`; return; }
                url = `${baseURL}/api/v1/timelines/tag/${encodeURIComponent(typevalue)}`;
            } else if (type === 'user' || type === 'username') {
                // Username in 'typevalue' or from form element
                typevalue = typevalue || document.getElementById('mastodon-user').value.trim();
                if (!typevalue) { feedContainer.innerHTML = `<p class="feed-status-message">Please enter a username.</p>`; return; }
                account = await getMastodonUser(typevalue,baseURL,feedContainer);
                if (!account) { return; }
                url = `${baseURL}/api/v1/accounts/${account.id}/statuses`;
            } else {
                throw new Error('Unknown type');
            }
            // alert("Getting feed type "+type+" from "+url);
            data = await getMastodonFeed(url,type,feedContainer);
        }
        

    } catch (error) {
        console.error(`Error fetching ${type}:`, error);
        feedContainer.innerHTML = '';
        showServiceError(feedContainer, `Mastodon error loading ${type}`, error.message,
            'Check your Mastodon account credentials under <strong>Accounts</strong>, or try again.');
        return;
    }

    if (data) { displayMastodonFeed(data,type,page,nextPageUrl,feedContainer,typevalue); }

}



// Given a Mastodon API 'GET' url for feed type 'type'
// Retrieve the feed data
// baseURL and accessToken are global variables
async function getMastodonFeed (url,type,feedContainer) {

    // const accessToken = document.getElementById('accessToken').value;
    // const baseURL = document.getElementById('baseURL').value;

    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${accessToken}`
        }
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error(`getMastodonFeed HTTP ${response.status} for ${url}:`, errorText);
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`getMastodonFeed (${type}):`, data);

    // Extract next page URL from link header
    const linkHeader = response.headers.get('link');
    nextPageUrl = linkHeader ? linkHeader.match(/<([^>]+)>;\s*rel="next"/)?.[1] : null;

    if (Array.isArray(data) && data.length === 0) {
        feedContainer.innerHTML = `<p class="feed-status-message">No content available in ${type}. (This instance may have disabled this timeline.)</p>`;
        return;
    }

    return data;

}

// Given a feed defined by 'data' consisting of a number of individual 'status' items
// Display each status and then add a 'Next Page' button

async function displayMastodonFeed(data, type, page, nextPageUrl, feedContainer, typevalue) {
    await window.CList.ui.renderFeed(data, feedContainer, {
        normalize: (status) => {
            const a = status.account;
            const reblogHeader = status.reblog
                ? `Reblogged by <a href="#" onclick="loadMastodonFeed('user',null,'@${_heJs(a.acct)}');return false;">${_he(a.display_name)}</a> (@${_he(a.acct)}):`
                : null;
            return normalizeMastodonPost(status.reblog || status, reblogHeader);
        },
        title:        type,
        typevalue,
        append:       page > 1,
        onLoadMore:   nextPageUrl ? () => loadMastodonFeed(type, nextPageUrl) : null,
        loadMoreBtnId: 'nextPageButton',
    });
}



// ── Notifications ─────────────────────────────────────────────────────────────

async function loadMastodonNotifications(pageUrl = null) {
    const feedContainer = window.CList.ui.view.feedContainer;
    if (!accessToken || !baseURL) {
        showServiceError(feedContainer, 'Mastodon error', 'Feed client not initialized.',
            'Select a Mastodon account using the <strong>Find</strong> button.');
        return;
    }
    let page = 1;
    if (!pageUrl) {
        feedContainer.innerHTML = '';
    } else {
        page++;
    }
    const url = pageUrl || `${baseURL}/api/v1/notifications`;
    let data;
    try {
        data = await getMastodonFeed(url, 'notifications', feedContainer);
    } catch (error) {
        showServiceError(feedContainer, 'Mastodon notifications error', error.message,
            'Check your Mastodon account credentials under <strong>Accounts</strong>.');
        return;
    }
    if (data) displayMastodonNotifications(data, page, nextPageUrl, feedContainer);
}

function displayMastodonNotifications(data, page, nextPageUrl, feedContainer) {
    if (page === 1) feedContainer.appendChild(createFeedHeader('Notifications'));

    const typeLabels = {
        mention:        'mentioned you',
        reblog:         'boosted your post',
        favourite:      'liked your post',
        follow:         'followed you',
        follow_request: 'requested to follow you',
        poll:           'poll ended',
        update:         'edited a post',
        status:         'posted',
    };

    for (const notification of data) {
        const statusBox = document.createElement('div');
        statusBox.classList.add('status-box');
        feedContainer.appendChild(statusBox);

        const acct = notification.account?.acct || '';
        const name = notification.account?.display_name || acct;
        const label = typeLabels[notification.type] || notification.type;
        const headerHtml = `<a href="#" onclick="loadMastodonFeed('user',null,'@${_heJs(acct)}');return false;">${_he(name)}</a> (@${_he(acct)}) ${_he(label)}`;

        if (notification.status) {
            displayMastodonPost(notification.status, statusBox, headerHtml);
        } else {
            const headerDiv = document.createElement('div');
            headerDiv.classList.add('reblog-info');
            headerDiv.innerHTML = headerHtml;
            statusBox.appendChild(headerDiv);
        }
    }

    renderMastodonNextPageButton(feedContainer, nextPageUrl, loadMastodonNotifications);
}


//  Function to Get User Data
async function getMastodonUser(username,baseURL,feedContainer) {

    
    // Verify and convert username to canonical format @user and @instance.name
    const { usernamePart, instancePart } = validateUsername(username, baseURL);
    console.log("Found "+usernamePart+" and "+instancePart);

    // Return if we don't have a good username
    if (!usernamePart) {
        feedContainer.innerHTML = `<p class="feed-status-message">Please enter a valid username (e.g., @username@instancename.social) instead of ${username}.</p>`;
        return;
    }

    // console.log(`Fetching user info for: ${usernamePart}@${instancePart}...`);
    // Build the URL for the user lookup
    const userLookupURL = `${baseURL}/api/v1/accounts/lookup?acct=${encodeURIComponent(`${usernamePart}@${instancePart}`)}`;
 
    // Fetch the user's account details
    const accountResponse = await fetch(userLookupURL, {
        headers: {
            'Authorization': `Bearer ${accessToken}`,  // Replace with your actual access token
        },
    });

    // Make sure we got a valid response
    if (!accountResponse.ok) { feedContainer.innerHTML = `<p class="feed-status-message">User not found.</p>`; return; }
    const account = await accountResponse.json();
    if (!account || !account.id) { feedContainer.innerHTML = `<p class="feed-status-message">User not found.</p>`; return; }

    return account;

}

//  Function to analyse input username and return it as canonical parts
function validateUsername(username, instanceBase) {
    // Remove http(s):// and leading '@' from the instanceBase
    instanceBase = instanceBase.replace(/^https?:\/\//, '');

    if (/^@[^@]*$/.test(username)) { // Pattern 1: @whatever
        const usernamePart = username.slice(1); // Remove leading '@'
        const instancePart = instanceBase;     // Use instanceBase as is
        console.log("1. Found "+usernamePart+" and "+instancePart);       
        return { usernamePart, instancePart };
    } else if (/^[^@]+@[^@]+$/.test(username)) { // Pattern 2: whatever@some.instance
        const [usernamePart, instancePart] = username.split('@'); // Split at '@'
        console.log("2.  Found "+usernamePart+" and "+instancePart);
        return { usernamePart, instancePart };
    } else if (/^@[^@]+@[^@]+$/.test(username)) { // Pattern 3: @whatever@some.instance
        const parts = username.split('@'); // Split into ['', 'simon', 'simonwillison.net']
        const usernamePart = parts[1]; // Extract 'simon' (ignoring the first empty string)
        const instancePart = parts[2]; // Extract 'simonwillison.net'
        console.log("3. Found " + usernamePart + " and " + instancePart); 
        return { usernamePart, instancePart };
    } else { // Pattern 4: something else
        return 0;
    }
}


async function normalizeMastodonPost(status, headerHtml = null) {
    const acct    = status.account.acct;
    const display = status.account.display_name || acct;

    let translatedContent;
    try {
        translatedContent = await processTranslationWithTimeout(status.content);
    } catch (e) {
        console.error(`Error translating status ${status.id}:`, e);
        translatedContent = status.content;
    }

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = translatedContent;
    const plainText = (tempDiv.textContent || tempDiv.innerText || '').replace(/\s+/g, ' ').trim();

    const authorLink = `<a href="#" onclick="loadMastodonFeed('user',null,'@${_heJs(acct)}');return false;" title="View User Feed">${_he(display)}</a> (@${_he(acct)}) wrote: ${_he(plainText)}`;
    const titleHtml  = headerHtml
        ? `<div class="reblog-info">${headerHtml}</div>${authorLink}`
        : authorLink;

    return {
        service:      'Mastodon',
        url:          status.url,
        titleHtml,
        title:        plainText.slice(0, 80),
        desc:         plainText,
        noSummaryDesc: true,
        full_content: new SafeHtml(translatedContent),
        feed:         '@' + acct,
        author:       display,
        author_id:    acct,
        date:         status.created_at,
        images:       getMastodonImageAttachments(status),
        guid:         status.url,
        replyToken:   { type: 'Mastodon', statusId: status.id },
        mastodon: {
            acct,
            statusId:     status.id,
            isReblogged:  !!status.reblogged,
            isFavourited: !!status.favourited,
            isBookmarked: !!status.bookmarked,
            inThread:     !!(status.in_reply_to_id || status.replies_count > 0),
        },
    };
}

    // Display a Mastodon Post inside feedContainer

async function displayMastodonPost(status, statusBox, headerHtml) {
    const item = await normalizeMastodonPost(status, headerHtml || null);
    const el   = makeListing(item);

    // Rewire hashtag links to load internally instead of navigating away
    el.querySelectorAll('a.mention.hashtag').forEach(link => {
        const tag = link.getAttribute('href')?.split('/tags/')[1];
        if (tag) {
            link.setAttribute('href', '#');
            link.removeAttribute('target');
            link.addEventListener('click', (e) => { e.preventDefault(); loadMastodonFeed('hashtag', null, tag); });
        }
    });

    // Shorten long link display text
    el.querySelectorAll('a').forEach(link => {
        const text = link.textContent.trim();
        if (text.length > 30) { link.title = text; link.textContent = text.substring(0, 27) + '...'; }
    });

    statusBox.replaceWith(el);
}


    // Get Images from a Mastodon Status
    // Function to extract image attachments
    function getMastodonImageAttachments(status) {
        return status.media_attachments
        .filter(attachment => attachment.type === "image")
        .map(image => ({
            url: image.url,
            preview_url: image.preview_url,
            description: image.description || "No description available", // Fallback for null descriptions
        }));
    }
    
    // Function to perform status actions
    // Access token and base URL are global variables
    async function handleMastodonAction(statusId,actionType,extraParam) {
        //const accessToken = document.getElementById('accessToken').value;
        //const baseURL = document.getElementById('baseURL').value;

        if (!accessToken || !baseURL) {
            showStatusMessage('Mastodon not initialized — select an account first.');
            return;
        }

        let url;

        if (actionType === 'bookmark') {
            const active = extraParam?.classList.contains('action-active');
            url = `${baseURL}/api/v1/statuses/${statusId}/${active ? 'unbookmark' : 'bookmark'}`;
            const ok = await postMastodonAction(url, active ? 'unbookmark' : 'bookmark');
            if (ok && extraParam) extraParam.classList.toggle('action-active');
        } else if (actionType === 'boost') {
            const active = extraParam?.classList.contains('action-active');
            url = `${baseURL}/api/v1/statuses/${statusId}/${active ? 'unreblog' : 'reblog'}`;
            const ok = await postMastodonAction(url, active ? 'unreblog' : 'boost');
            if (ok && extraParam) extraParam.classList.toggle('action-active');
        } else if (actionType === 'favorite') {
            const active = extraParam?.classList.contains('action-active');
            url = `${baseURL}/api/v1/statuses/${statusId}/${active ? 'unfavourite' : 'favourite'}`;
            const ok = await postMastodonAction(url, active ? 'unfavourite' : 'favorite');
            if (ok && extraParam) extraParam.classList.toggle('action-active');
        } else if (actionType === 'thread') {
            await loadMastodonFeed(actionType,null,statusId);
        } else if (actionType === 'reply') {
            openLeftInterface(mastodonStatusForm());
            document.getElementById('statusIDInput').value = statusId;
        } else if (actionType === 'load') {
            loadContentToEditor(statusId);
            actionSuccessMessage = 'Loaded item to write pane.';
        } else if (actionType === 'summarize') {
            showStatusMessage('Summarize action not yet implemented here.');
            return;
        } else {
            console.error("Tried to perform action "+actionType+" but that's an invalid action");
            showStatusMessage(`Unknown action: ${actionType}`);
        }
        

    }

    // Function to perform a Mastodon action, like bookm ark for favourite, etc
    // Access token and base URL are global variables
    async function postMastodonAction(url,action) {

        // const accessToken = document.getElementById('accessToken').value;
        // const baseURL = document.getElementById('baseURL').value;

        try {

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                showStatusMessage(action+" successful");
                return true;
            } else {
                showStatusMessage(`Failed to ${action} — server returned ${response.status}.`);
                return false;
            }

        } catch (error) {
            console.error(`Error ${action}ing status:`, error);
            showStatusMessage(`Failed to ${action}: ${error.message}`);
            return false;
        }

    }



    // Function to post a status
    // Access token and base URL are global variables
    async function postStatusFromForm(event) {
        event.preventDefault();

        // const accessToken = document.getElementById('accessToken').value;
        // const baseURL = document.getElementById('baseURL').value;
        const responseDiv = document.getElementById('response');
        const statusText = document.getElementById('status').value;

        if (!accessToken || !baseURL) {
            responseDiv.innerHTML = `<p class="error-message">Mastodon not initialized — select an account first.</p>`;
            return;
        }

                
        // Retrieve the status ID from the hidden input field (used for replies)
        const replyToId = document.getElementById('statusIDInput').value;

        postMastodonStatus(accessToken,baseURL,responseDiv,statusText,replyToId);
    }
        
    async function postMastodonStatus(accessToken,baseURL,responseDiv,statusText,replyToId) {

        if (statusText === '') {
            responseDiv.innerHTML = `<p class="error-message">Please enter a status before posting.</p>`;
            return;
        }


        const charLimit = await getCharacterLimit(baseURL);
       
        let truncatedStatus;

        if (charLimit !== null) {
            // Truncate statusText to the character limit if necessary
            truncatedStatus = statusText.length > charLimit
                ? statusText.slice(0, charLimit)
                : statusText;
        } 

        const statusPayload = {
            status: truncatedStatus,
            visibility: 'public' // Adjust visibility as needed: public, unlisted, private, direct
        };

        // If replying to a specific post, add the reply ID to the payload
        if (replyToId) {
            statusPayload.in_reply_to_id = replyToId;
        }

        try {
            const response = await fetch(`${baseURL}/api/v1/statuses`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(statusPayload),
            });

            if (!response.ok) {
                throw new Error(`Error 11 posting status (Response): ${response.statusText}`);
            }

            await response.json();

            // Clear the status input field, if it was used
            const statusElement = document.getElementById('status');
            if (statusElement) statusElement.value = '';

            responseDiv.innerHTML = `<p>Status posted successfully!</p>`;
            setTimeout(() => { responseDiv.innerHTML = ''; }, 4000);
        } catch (error) {
            responseDiv.innerHTML = `<p>Error posting status: ${error.message}</p>`;
            setTimeout(() => { responseDiv.innerHTML = ''; }, 4000);
        }
    };


   
    // Get the character limit for a Mastodon instance

    async function getCharacterLimit(instanceUrl) {
        const apiUrl = `${instanceUrl}/api/v1/instance`;
        try {
            const response = await fetch(apiUrl);
            if (response.ok) {
                const data = await response.json();
                return data.configuration.statuses.max_characters; // Return the character limit
            } else {
                console.error('Error fetching instance data:', response.statusText);
                return null; // Return null if there is an error
            }
        } catch (error) {
            console.error('Request failed:', error);
            return null; // Return null in case of a failure
        }
    }


// -----------------------------------------------------
//
// Mastodon OAuth2 flow
//
// Called from the Accounts panel (kvstore.js) when user clicks "Authorize with Mastodon".
// Delegates to OAuthClient.login() which handles app registration (with per-instance
// caching), PKCE, and the redirect to the Mastodon authorization page.
// callback.html handles the OAuth callback, stores the result in localStorage,
// and redirects back to /. The DOMContentLoaded listener below picks it up and saves to kvstore.

async function mastodonOAuthStart(title, username, permissions) {
    const parts = username.split('@').filter(Boolean);
    if (parts.length < 2) {
        showStatusMessage('Please enter your Mastodon username as user@instance.social');
        return;
    }
    const instanceUrl = 'https://' + parts[parts.length - 1];

    try {
        await OAuthClient.login(username, 'Mastodon', instanceUrl, {
            forceLogin: true,
            extra: { title: title || username, permissions: permissions || 'rw' },
        });
    } catch (e) {
        showStatusMessage('Could not start Mastodon authorization: ' + e.message);
    }
}

// On page load, check whether we're returning from a Mastodon OAuth callback.
// callback.html stores the result in localStorage; we pick it up here and save to kvstore.
document.addEventListener('DOMContentLoaded', async function () {
    const raw = localStorage.getItem(window.CList.keys.OAUTH_CALLBACK_RESULT);
    if (!raw) return;
    let data;
    try { data = JSON.parse(raw); } catch (e) { console.error('Bad oauth_callback_result', e); return; }
    if (data.providerType !== 'Mastodon') return;
    localStorage.removeItem(window.CList.keys.OAUTH_CALLBACK_RESULT);
    await saveMastodonAccount(data.extra.title || data.accountKey, data.accountKey, data.accessToken, data.extra.permissions);
});

async function saveMastodonAccount(title, username, accessToken, permissions) {
    const token = getSiteSpecificCookie(window.CList.config.flaskSiteUrl, window.CList.keys.ACCESS_TOKEN);
    if (!token) { showStatusMessage('Please log in to kvstore before authorizing Mastodon.'); return; }

    const encKey = await getEncKey(window.CList.config.flaskSiteUrl);
    if (!encKey) { showStatusMessage('Encryption key missing — please log in again.'); return; }

    const instanceData = { type: 'Mastodon', id: accessToken, title: title, permissions: permissions || 'rw' };
    let encryptedValue;
    try {
        encryptedValue = await encryptWithKey(encKey, JSON.stringify(instanceData));
    } catch (err) {
        console.error('Failed to encrypt Mastodon account data:', err);
        showStatusMessage('Could not save Mastodon account — encryption failed. Try logging in again.');
        return;
    }

    const existing = Array.isArray(window.CList.accounts) && window.CList.accounts.find(a => a.key === username);
    const endpoint = existing ? 'update_kv/' : 'add_kv/';

    const response = await fetch(`${window.CList.config.flaskSiteUrl}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ key: username, value: encryptedValue })
    });

    if (!response.ok) { showStatusMessage('Failed to save Mastodon account to kvstore.'); return; }

    try {
        window.CList.accounts = await getAccounts(window.CList.config.flaskSiteUrl);
        if (window.CList.accounts) {
            updateUIVisibility();
            await playRead();
            populateReadAccountList(window.CList.accounts);
        }
        showStatusMessage('Mastodon account authorized and saved.');
    } catch (error) {
        showStatusMessage('Account saved — but could not refresh feed. Try reloading: ' + error.message);
    }
    playAccounts();
}