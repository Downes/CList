//  mastodon.js  -  helper and utility functions for Mastodon API
//  Part of CList, the next generation of learning and connecting with your community
//
//  Version version 0.1 created by Stephen Downes on January 27, 2025
//
//  Copyright National Research Council of Canada 2025
//  Licensed under Creative Commons Attribution 4.0 International https://creativecommons.org/licenses/by/4.0/
//
//  This software carries NO WARRANTY OF ANY KIND.
//  This software is provided "AS IS," and you, its user, assume all risks when using it.
// 


// Key functions

//    initializeMasto: Verifies the credentials of the selected Mastodon account. Note that the credential provided is the Mastodon access token 

//    loadMastodonFeed: Fetches various types of timelines (home, local, bookmarks, hashtag, user) and paginates the results.

//    handleMastodonAction: Allows users to perform actions like replying, boosting, favoriting, or bookmarking a status.

//    postMastodonStatus: Posts a new status or replies to an existing one.


// -----------------------------------------------------
    




// Mastodon Feed Functions
// Ensure feedFunctions exists
window.feedFunctions = window.feedFunctions || {};

// Define MastodonFunctions
window.MastodonFunctions = {
    'Post': toggleDiv.bind(null, 'mastodon-status-form', 'left', true),
    'Following': loadMastodonFeed.bind(null, 'home', null),
    'Bookmarks': loadMastodonFeed.bind(null, 'bookmarks', null),
    'Lists': loadMastodonLists.bind(null, 'list', null),
    'Local': loadMastodonFeed.bind(null, 'local', null),
    'Hashtag': toggleDiv.bind(null, 'mastodon-hashtag-form', 'left',true),
    'User': toggleDiv.bind(null, 'mastodon-user-form', 'left',true)
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

        // Display the selected account instance URL      
        document.getElementById('selectedAccountUrl').innerHTML = baseURL;
        

    } catch (error) {
        const accountStatusDiv = document.getElementById('account-status');
        accountStatusDiv.innerHTML = `<p>Error initializing Mastodon client: ${error.message}</p>`;
        console.error('Error initializing Mastodon client:', error);
    }

}





// Functions to create interaction forms in the left pane

function mastodonFeedFiller(type, placeholder) {
    const ucfirstType = ucfirst(type);
    const divId = 'mastodon-' + type + '-form';

    // Check if the div already exists
    let div = document.getElementById(divId);
    if (!div) {
        // If the div does not exist, create the container div
        div = document.createElement('div');
        div.id = divId;
        div.style.display = 'none';
        div.style.marginTop = '10px';
        div.innerHTML = `
            <label for="${type}">Enter a ${ucfirstType}:</label>
            <input type="text" id="${type}" placeholder="${placeholder}" />
        
            <!-- Button to submit the ${type} and close the div -->
            <button id="submit${ucfirstType}Btn" onclick="loadMastodonFeed('${type}');document.getElementById('${divId}').style.display = 'none';">Submit ${ucfirstType}</button>
        `;
    }
    const leftContent = document.getElementById('left-content');
    if (leftContent) { leftContent.prepend(div); } 
    else { console.error("Element with ID 'left-content' not found."); }
    
}


function mastodonFormFiller(type, placeholder) {
    const ucfirstType = ucfirst(type);
    const divId = 'mastodon-status-form'; // Div ID for the form container

    // Check if the container div already exists
    let div = document.getElementById(divId);
    if (!div) {
        // If the div does not exist, create it
        div = document.createElement('div');
        div.id = divId;
        div.style.display = 'none';
        div.style.marginTop = '10px';
        div.innerHTML = `
            <!-- Form to post a status -->
            <form id="${type}Form" onsubmit="post${ucfirstType}FromForm(event);">
                <label class="visually-hidden" for="status">${ucfirstType}:</label><br>
                <textarea id="${type}" name="${type}" rows="4" cols="50" placeholder="${placeholder}"></textarea>
                <!-- Hidden input for the ${type} ID (used for replies) -->
                <input type="hidden" id="${type}IDInput" name="${type}ID" value="">
                <br><br>
                <button type="submit">Post ${ucfirstType}</button>
            </form>
        `;

    }

    
    // Append the div to the left content container
    const leftContent = document.getElementById('left-content');
    if (leftContent) { leftContent.prepend(div); } 
    else { console.error("Element with ID 'left-content' not found.");   }
}




// Fetch my list of lists
// Access token and base URL are global variables
async function loadMastodonLists(type,listsDiv) {

    // Important! Function is called only by button press after account has loaded
    // const accessToken = document.getElementById('accessToken').value;
    // const baseURL = document.getElementById('baseURL').value;

    const endpoint = `${baseURL}/api/v1/lists`;
    try {
        const response = await fetch(endpoint, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`, // Replace with your access token
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Error fetching lists: ${response.status} ${response.statusText}`);
        }
        
        // Log the raw response text to see what you're getting
        const rawText = await response.text();
        console.log('Raw Response:', rawText);

        // Try parsing the JSON after logging the raw response
        const lists = JSON.parse(rawText); // Parse manually for better error feedback
        console.log('Parsed Lists:', lists);

                // Create and attach the dropdown
        createMastodonListDropdown(lists, listsDiv);
        // return lists;

    } catch (error) {
        console.error('Error loading lists:', error);
        //return [];
    }
}


// Function to create and attach the dropdown
function createMastodonListDropdown(lists) {
    const listsDiv = document.getElementById('mastodon-lists');
    if (!listsDiv) {
        console.error(`Element with ID "${listsDiv}" not found.`);
        return;
    }

    // Create the select element
    const select = document.createElement('select');
    select.id = 'mastodonList';

    // Add default non-functioning option
    const defaultOption = document.createElement('option');
    defaultOption.text = 'Select a List';
    defaultOption.value = '';
    defaultOption.disabled = true;
    defaultOption.selected = true;
    select.appendChild(defaultOption);

    // Populate the dropdown with list options
    lists.forEach(list => {
        const option = document.createElement('option');
        option.text = list.title;
        option.value = list.id;
        select.appendChild(option);
    });

    // Add change event listener to call loadMastodonFeed('list')
    select.addEventListener('change', () => {
        loadMastodonFeed('list');
    });

    // Attach the select element to the provided container
    listsDiv.appendChild(select);

    // Toggle the display
    toggleFormDisplay('mastodon-lists','left');
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




// Function to load and display Mastodon feeds (GET requests)
// baseURL and accessToken are global variables
let nextPageUrl = null;  // To store the URL for the next page
async function loadMastodonFeed(type, pageUrl = null,typevalue = null) {
console.log("baseURL "+baseURL+" accessRoken "+accessToken+" and Loading feed type "+type);
  //  const accessToken = document.getElementById('accessToken').value;
  //  const baseURL = document.getElementById('baseURL').value;
    const feedContainer = document.getElementById('feed-container');

    if (!accessToken || !baseURL) {
        console.error('Error: Access token or baseURL is missing');
        feedContainer.innerHTML = `<p>Error: Feed client not initialized. Please select an account using the Find button.</p>`;
        return;
    }

    let url;
    let data;
    let page = 1;
    try {

        if (pageUrl) {
            url = pageUrl;  // Use next page URL if provided
            page++;
            data = await getMastodonFeed(url,type);
        } else if (type === 'thread') { // Build data array from ancestors and descendants
            feedContainer.innerHTML = '';  // Clear feed when loading the first page
            statusID = typevalue;   // From the 'thread' button
            url = `${baseURL}/api/v1/statuses/${statusID}/context`;
            threadData = await getMastodonFeed(url,type);
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
            } else if (type === 'hashtag') { // Hashtag value is pre-defined in id='hashtag'
                const hashtag = document.getElementById('mastodon-hashtag').value.trim();  
                if (!hashtag) { feedContainer.innerHTML = `<p>Please enter a hashtag.</p>`; return; }
                url = `${baseURL}/api/v1/timelines/tag/${encodeURIComponent(hashtag)}`;
            } else if (type === 'user' || type === 'username') {
                // Username in 'typevalue' or from form element
                username = typevalue || document.getElementById('mastodon-username').value.trim(); 
                if (!username) { feedContainer.innerHTML = `<p>Please enter a username.</p>`; return; }
                account = await getMastodonUser(username,baseURL);
                if (!account) { return; }
                url = `${baseURL}/api/v1/accounts/${account.id}/statuses`;
            } else {
                throw new Error('Unknown type');
            }
            // alert("Getting feed type "+type+" from "+url);
            data = await getMastodonFeed(url,type);
        }
        

    } catch (error) {
        console.error(`Error fetching ${type}:`, error);
        feedContainer.innerHTML = `<p>Error loading ${type}: ${error.message}</p>`;
    }

    displayMastodonFeed(data,type,page,nextPageUrl,feedContainer);

}



// Given a Mastodon API 'GET' url for feed type 'type'
// Retrieve the feed data
// baseURL and accessToken are global variables
async function getMastodonFeed (url,type) {

    // const accessToken = document.getElementById('accessToken').value;
    // const baseURL = document.getElementById('baseURL').value;

    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${accessToken}`
        }
    });

    const data = await response.json();
    // Display content in console
     console.log(data);


    // Extract next page URL from link header
    const linkHeader = response.headers.get('link');
    nextPageUrl = linkHeader ? linkHeader.match(/<([^>]+)>;\s*rel="next"/)?.[1] : null;

    if (data.length === 0) {
        feedContainer.innerHTML = `<p>No content available in ${type}.</p>`;
        return;
    }

    return data;

}

// Given a feed defined by 'data' consisting of a number of individual 'status' items
// Display each status and then add a 'Next Page' button

function displayMastodonFeed(data,type,page,nextPageUrl,feedContainer) {

    if (page ===1) { feedContainer.appendChild(createFeedHeader(type)); }  // Header

    const summary = document.createElement("div");      // Summary container, if desired
    summary.id = "feed-summary";
    feedContainer.appendChild(summary);

    for (const status of data) {                         // Statuses
        // Create the Status Box and append it immediately
        const statusBox = document.createElement('div');
        statusBox.classList.add('status-box');  
        feedContainer.appendChild(statusBox);

        // Update the status box content asynchronously
        if (status.reblog) {
            displayMastodonPost(status.reblog, statusBox, status.account);
        } else {
            displayMastodonPost(status, statusBox);
        }
    }

                                                         // Next Button

    // Show a button to load the next page if there is more data
    let nextPageButton = document.getElementById('nextPageButton');
    if (nextPageUrl) {
        if (!nextPageButton) {
            nextPageButton = document.createElement('button');
            nextPageButton.id = 'nextPageButton';
            nextPageButton.textContent = 'Load Next Page';
            nextPageButton.onclick = () => loadMastodonFeed(type, nextPageUrl);
            feedContainer.appendChild(nextPageButton);
        }
    } else if (nextPageButton) {
        nextPageButton.style.display = 'none';  // Hide the button if no next page is available
    }

    // Push Next Page button to the Bottom
    feedContainer.appendChild(nextPageButton);


}



//  Function to Get User Data
async function getMastodonUser(username,baseURL) {

    
    // Verify and convert username to canonical format @user and @instance.name
    const { usernamePart, instancePart } = validateUsername(username, baseURL);
    console.log("Found "+usernamePart+" and "+instancePart);

    // Return if we don't have a good username
    if (!usernamePart) {
        feedContainer.innerHTML = `<p>Please enter a valid username (e.g., @username@instancename.social) instead of ${username}.</p>`;
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
    if (!accountResponse.ok) { feedContainer.innerHTML = `<p>User not found.</p>`; return; }
    const account = await accountResponse.json();
    if (!account || !account.id) { feedContainer.innerHTML = `<p>User not found.</p>`; return; }

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


    // Display a Mastodon Post inside feedContainer

async function displayMastodonPost(status,statusBox,reblogger) {

        // Create the status content div
        const statusContent = document.createElement('div');
        statusContent.classList.add('status-content');


        // Translate content
        try {       
            translatedContent = await processTranslationWithTimeout(status.content);
           // console.log('Translated Content:', translatedContent);
        } catch (translationError) {
            console.error(`Error translating status ${status.id}:`, translationError);
            translatedContent = "[Translation failed]";
        }                                        
        //const translatedContent = await processTranslation(status.content);
        //  const translatedContent = status.content;
        //console.log(status);

        // Reblog Information
        if (reblogger && Object.keys(reblogger).length > 0) {
 //alert("Adding reblog info");           
            const reblogInfo = document.createElement('div');
            reblogInfo.classList.add('reblog-info');  // Add a class for styling
            reblogInfo.innerHTML=`Reblogged by <a href="#" onclick="loadMastodonFeed('user',null,'@${reblogger.acct}');return false;" title='View User Thread'">${reblogger.display_name}</a> (@${reblogger.acct}):`;
            statusContent.appendChild(reblogInfo);
       }



        // Create the post-specific content div
        const statusSpecific = document.createElement('div');
        statusSpecific.id = `${status.id}`;
        statusSpecific.innerHTML = `
            <p><a href="#" onclick="loadMastodonFeed('user',null,'@${status.account.acct}'); return false;" title='View User Thread';>${status.account.display_name}</a> (@${status.account.acct}) wrote: 
            ${translatedContent}
        `;
        statusContent.appendChild(statusSpecific);



        // Images & media
        const images = getMastodonImageAttachments(status);
        if (images.length > 0) {
            const statusImages = document.createElement('div');
            statusImages.classList.add('status-images-container');
            // Loop through the images and log their url and description
            images.forEach(image => {
                const imageItem = document.createElement('div');
                imageItem.classList.add('image-item');
                imageItem.innerHTML = `
                <a href="${image.url}" target="_blank">
                    <img src="${image.preview_url}" alt="${image.description || 'Image'}"/>
                </a>
                `;
                console.log(`URL: ${image.url}`);
                console.log(`Description: ${image.description}`);
                statusImages.appendChild(imageItem);
            });
            statusContent.appendChild(statusImages);
        }

        // Create reference
        statusSpecific.reference = {
            author_name: status.account.display_name,
            author_id: status.account.acct,
            feed: status.account.acct,
            url: status.url,
            title: 'Mastodon',
            created_at: status.created_at,
            id: status.id,
        };

        console.log(statusSpecific);

        // Determine whether the status is in a thread (ie., a value for in_reply_to_id or for replies_count)
        let threadsButton;
        if (status.in_reply_to_id || status.replies_count > 0) {
            threadsButton = `<button class="material-icons md-18 md-light" onClick="handleMastodonAction('${status.id}', 'thread')">dynamic_feed</button>`; }
        else { threadsButton = ``; }
        

        // Create the action buttons div below the status
        const actionButtons = document.createElement('div');
        actionButtons.classList.add('status-actions');
        actionButtons.innerHTML = `
            <button class="material-icons md-18 md-light" onClick="handleMastodonAction('${status.id}', 'reply',this.parentElement)">reply</button>
            <button class="material-icons md-18 md-light" onClick="handleMastodonAction('${status.id}', 'boost')">autorenew</button>
            <button class="material-icons md-18 md-light" onClick="handleMastodonAction('${status.id}', 'favorite')">star</button>
            <button class="material-icons md-18 md-light" onClick="handleMastodonAction('${status.id}', 'bookmark')">bookmarks</button>
            ${threadsButton}
            <button class="material-icons md-18 md-light" onClick="window.open('${status.url}', '_blank', 'width=800,height=600,scrollbars=yes')">launch</button> 
        `;
        statusContent.appendChild(actionButtons);

        // Create the clist buttons div to the right of the status
        const clistButtons = document.createElement('div');
        clistButtons.classList.add('clist-actions');
        clistButtons.innerHTML = `
            <button class="material-icons md-18 md-light" onClick="handleMastodonAction('${status.id}', 'load',this.parentElement.parentElement)">arrow_right</button>
            
        `;

        // Append content and actions to the status box
        statusBox.appendChild(statusContent);
        statusBox.appendChild(clistButtons);


        // Shorten the displayed text for links
        const links = statusContent.querySelectorAll('a');  // Find all <a> tags
        links.forEach((link) => {
            const originalText = link.textContent.trim();
            if (originalText.length > 30) {
                if (originalText.length > 30) {
                    link.title = originalText;  // Set full link text as title (tooltip)
                    link.textContent = `${originalText.substring(0, 27)}...`;  // Shorten text
                }
            }
        });
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
    async function handleMastodonAction(statusId,actionType,statusElement) {
        //const accessToken = document.getElementById('accessToken').value;
        //const baseURL = document.getElementById('baseURL').value;

        if (!accessToken || !baseURL) {
            alert('Error: Mastodon client not initialized. Please refresh the page.');
            return;
        }

        let url;
        let actionSuccessMessage;

        if (actionType === 'bookmark') {
            url = `${baseURL}/api/v1/statuses/${statusId}/bookmark`;
            await postMastodonAction(url,actionType);
        } else if (actionType === 'boost') {
            url = `${baseURL}/api/v1/statuses/${statusId}/reblog`;
            await postMastodonAction(url,actionType);
        } else if (actionType === 'favorite') {
            url = `${baseURL}/api/v1/statuses/${statusId}/favourite`;
            await postMastodonAction(url,actionType);
        } else if (actionType === 'thread') {
            await loadMastodonFeed(actionType,null,statusId);
        } else if (actionType === 'reply') {
            const statusForm = document.getElementById('mastodon-status-form');
            statusElement.insertAdjacentElement('afterend', statusForm);
            const statusInput = document.getElementById('statusIDInput');
            statusInput.value = statusId;
            statusForm.style.display = 'block';
        } else if (actionType === 'load') {
            loadContentToTinyMCE(statusId);
            actionSuccessMessage = 'Loaded item to write pane.';
        } else if (actionType === 'summarize') {
            alert('summarize'); return;
            actionSuccessMessage = 'Loaded item to write pane.';
        } else {
            console.error("Tried to perform action "+actionType+" but that's an invalid action");
            alert("Tried to perform action "+actionType+" but that's an invalid action");
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
                //alert(actionSuccessMessage);
                showStatusMessage(action+" successful"); 
                console.log('Response Data:', responseData); // Log it to the console
            } else {
                alert(`Failed to ${actionType} status. Please try again.`);
            }

        } catch (error) {
            console.error(`Error ${action}ing status:`, error);
            alert(`An error occurred while ${actionType}ing the status.`);
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
            alert('Error: Mastodon client not initialized. Please refresh the page.');
            return;
        }

        if (!baseURL || !accessToken) {
            console.error('Error: Missing baseURL or accessToken');
            responseDiv.innerHTML = `<p>Error: Mastodon client not initialized.</p>`;
            return;
        }

                
        // Retrieve the status ID from the hidden input field (used for replies)
        const replyToId = document.getElementById('statusIDInput').value;

        postMastodonStatus(accessToken,baseURL,responseDiv,statusText,replyToId);
    }
        
    async function postMastodonStatus(accessToken,baseURL,responseDiv,statusText,replyToId) {

        if (statusText === '') {
            alert('Please enter a status');
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

            const responseData = await response.json();

            // Clear the status input field, if it was used
            const statusElement = document.getElementById('status');
            if (statusElement) { statusElement.value = '';  } 
            else { console.log('Status element is not defined.'); }

            responseDiv.innerHTML = `<p>Status posted successfully! ID: ${responseData.id}</p>`;
            alert(`<p>Status posted successfully! ID: ${responseData.id}</p>`);
        } catch (error) {
            responseDiv.innerHTML = `<p>Error 12 posting status (Error message): ${error.message}</p>`;
            alert(`<p>Error 10 posting status: ${error.message}</p>`);
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