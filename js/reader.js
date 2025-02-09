//  reader.js  -  helper and utility functions for the feed reader
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


// 
// Define handlers for each reader
//
// Definition:
// 
//      Readers are defined as objects that pass content to the feed reader in a standardized format
//      The readerHandlers object contains a set of handlers for each type of reader
//      Each handler must have the following methods:
//          initialize:  Initialize the reader
//          feedFunctions:  A set of functions that the reader supports
//          statusActions:  A set of actions that can be taken on a status item

//      The readerHandlers object is used to call the appropriate methods for the current reader.
//      Usage:
//      
//      Add an reader to the readerHandlers object as follows:
//          (function () {
//              const serviceHandler = {
//                   initialize: async (instance,id) => {    // Initialize the reader    
                                                             // Values for instance and id
                                                             // are passed in from the accounts array               
//                   },
//                   feedFunctions: {                        // Feed functions
//                       'Funcname': function() { },           // Name of the function, which will appear as a button
//                       'Funcname2': function() { }          // Name of the function, which will appear as a button
//                   },
//                   statusActions: (item,itemID,itemLink) => {   // Status actions - icons below each status item
//                   },
//                   search: () => {                         // Search (optional)
//                   },
//               };
//               editorHandlers['service'] = serviceHandler;
//           })();
// 
//      The readerHandlers object is used to call the appropriate methods for the current editor.
//      Usage:
//
//      const handler = readerHandlers[currentReader];
//      if (handler && typeof handler.getContent === 'function') {
//         const buttons = handler.feedFunctions();
//      }
//



const leftContent = document.getElementById('left-content');
if (!leftContent) { console.error('Element with ID "left-content" not found.'); }

// Ensure readerHandlers exists
if (typeof window.readerHandlers === 'undefined') {
    window.readerHandlers = {}; // Create it if it doesn't exist
}



function finderString() {
    const findTextarea = document.getElementById('find-textarea');
    const searchString = findTextarea.value;
    if (!searchString) { alert("Please enter a search value in the form"); return;}
    return searchString;
}

  

// Call the initialize function

async function initializeReader(readerType, baseURL, accessToken) {

    if (readerHandlers[readerType] && typeof readerHandlers[readerType].initialize === 'function') {
        await readerHandlers[readerType].initialize(baseURL, accessToken);
    } else {
        console.error(`reader type '${readerType}' is not supported or does not have an initialize method.`);
    }

}


// This function starts up the reader in the reader div 'read-section'
//  (with some commands located in 'left-content')


async function playRead() {



    openLeftPane();
    const leftContent = document.getElementById('left-content');
    
    // Check if the reader div exists

    let reader = document.getElementById('read-section');
    if (!reader) {
        // Create the reader div if it doesn't exist
        reader = document.createElement('div');
        reader.id = 'read-section';

        

        manualEntry = `<br><button id="manual-button" onclick="toggleDiv('manual-entry')">Manual</button>
                <div id="manual-entry"  style="display:none;">
                    <label for="baseURL">Mastodon Instance URL:</label>
                    <input type="text" id="baseURL" placeholder="https://mastodon.social" required><br>
                    <label for="accessToken">Access Token:</label>
                    <input type="text" id="accessToken" placeholder="Your Access Token" required><br>
                    <label for="instanceType">Instance Type:</label>
                    <input type="text" id="instanceType" placeholder="Mastodon|Bluesky|OPML" required><br>
                </div>
                <script>
                    document.getElementById("manual-button").onclick = function switchReaderAccount() {
                    </select> <button onclick="switchReaderAccount()">Select Account</button>
                        const div = document.getElementById("manual-entry");
                        if (div.style.display === "none") {
                            div.style.display = "block";  // Show the div
                        } else {
                            div.style.display = "none";   // Hide the div
                        }
                    };
                </script>`;


        // Set the content only when the reader div is first created
        reader.innerHTML = `
        <!-- Read Section -->
            <div id="read-header">
                <h2>Read</h2>
                <button 
                    id="read-left-close-button" 
                    onclick="document.getElementById('read-section').style.display='none';">
                    &times;
                </button>
            </div> 
            <!--  Display current Account  -->
            <div id="accountDiv">
                Please select an account
            </div>
            <!-- Select Account-->
            <div id="read-account-list"></div>
            <div id="select-account"></div>

            ${manualEntry}
                
            <div id="account-status"></div>
            <div id="selectedAccountUrl"></div>
    
        `;

        // Append the reader to the left content
        leftContent.prepend(reader);
        console.log("Tuning on read list");
        document.getElementById('read-account-list').style.display = 'block';

    }
    if (!Array.isArray(accounts)) {
        throw new Error('Error: Accounts array not found; maybe you need to log in.');
    }

    try {
        if (!accounts || accounts.length === 0) {
            accounts = await getAccounts(flaskSiteUrl); // Fetch  accounts only if needed
            populateReadAccountList(accounts);
        }
    } catch (error) {
        alert('Error in playRead: ' + error.message);
    }



    reader.style.display = 'block'; // Make the reader visible
    let accList = document.getElementById('read-account-list');
    accList.style.display = 'block'; // Make the accoounts visible

}


// playFind

function playFind() {

    openLeftPane();
    const leftContent = document.getElementById('left-content');
    
    // Check if the reader div exists
    let finder = document.getElementById('find-section');
    if (!finder) {
        // Create the reader div if it doesn't exist
        finder = document.createElement('div');
        finder.id = 'find-section';

        // Set the content only when the reader div is first created
        finder.innerHTML = `
        <!-- Find Section -->
            <div id="find-header">
                <h2>Find</h2>
                <button 
                    id="find-left-close-button" 
                    onclick="document.getElementById('find-section').style.display='none';">
                    &times;
                </button>
            </div> 
            <div id="find-form">
                <textarea id="find-textarea" placeholder="Find what?"></textarea>
            </div>

            <!--  Display current Account  -->
            <div id="find-account-div">
                Find where?
            </div>
            <!-- Select Account-->
            <div id="find-account-list">
            </div>

            <div id="select-find-account">
            <button class="save-button" onClick="readerHandlers['duckduckgo'].search();">Duck Duck Go</button>
            </div>

            <div id="select-find-account">
            <button class="save-button" onClick="readerHandlers['google'].search();">Google</button>
            </div>
                
            <div id="select-find-account">
            <button class="save-button" onClick="readerHandlers['oasis'].search();">OASIS OERs</button>
            </div>

            <div id="find-account-status"></div>
            <div id="selectedFindAccountUrl"></div>
    
        `;

        // Append the reader to the left content
        leftContent.prepend(finder);

    }

    finder.style.display = 'block'; // Make the reader visible

}


// Function to populate the dropdown with account keys
function populateReadAccountList(accounts) {
    console.log("Populating read account list");
    const accountList = document.getElementById('read-account-list');
    accountList.innerHTML = '';                         // Clear previous options
    //accountDropdown.innerHTML = '';                         // Clear previous options
  //  const defaultoption = document.createElement('option'); // Create a blank instruction option
   // defaultoption.value = "";
  //  defaultoption.text = "-- Select Account --";
  //  accountDropdown.appendChild(defaultoption);
    if (!accountList) {
        alert('populateAccountDropdown error: read-account-list not found');
        console.error("Error: can't find an item named read-account-list");
        return;
    }

    const accountDiv = document.getElementById("accountDiv");
    accountDiv.innerHTML = "Please select an account";

    accounts.forEach(account => {                           // Load the options stored in the KVstore
        const parsedValue = JSON.parse(account.value);

        if (parsedValue.permissions.includes('r')) {  // Check if 'permissions' contains 'r'
            const accountItem = document.createElement('button');   // Set the class
            accountItem.className = 'save-button';                  //  Set the class and onclick attribute
            accountItem.setAttribute('onclick', "switchReaderAccount('"+account.key+"');");
            
            accountItem.innerHTML = parsedValue.title;       // Set the innerHTML
            accountList.appendChild(accountItem);             // Append to a parent element 

          //  const option = document.createElement('option');
          //  option.value = account.key;
          //  option.text = `${account.key} (${parsedValue.permissions})`;
          //  accountDropdown.appendChild(option);  // Append the option if condition is met
        }
    });
}


    
// Function to switch accounts
async function switchReaderAccount(key) {

    const selectedAccount = accounts.find(acc => acc.key === key);
    const accountData = JSON.parse(selectedAccount.value);
    const instance = accountData.instance;
    baseURL = extractBaseUrl(accountData.instance);
    accessToken = accountData.id;
    const instanceType = accountData.type;
    console.log("baseURL "+baseURL+" accessRoken "+accessToken+" and Loading feed type "+accountData.type);
    switch (instanceType) {
        // case 'Mastodon': await initializeMasto(baseURL, accessToken); break;
        case 'Mastodon': await initializeReader('Mastodon',baseURL, accessToken); break;
        case 'Bluesky': await initializeReader('Bluesky',instance, accessToken); break;
        case 'OPML': await initializeOPML(baseURL, accessToken); break;
        // Additional cases can be easily added here
        default: console.log("Unsupported instance type:", instanceType);
    }
    // Hide the account selection section
    // Clear status after some time
    setTimeout(() => { 
        document.getElementById('account-status').innerHTML = ''; 
        document.getElementById('account-status').style.display = 'none';
    }, 5000);

    setupFeedButtons(instanceType);  // Different feed buttons for different services
    document.getElementById('feed-container').innerHTML = '';   // Empty feed container
    
}

// Make Listing supports both calling with a single object containing all properties
// (e.g., makeListing(item)), or
// calling with separate parameters 
// (e.g., makeListing(service, url, title, desc, feed, author, date, full_content)).

function makeListing(
    itemOrService,
    url,
    title,
    desc,
    feed,
    author,
    date,
    full_content
  ) {
    let item;
  
    
    // If the first parameter is an object, treat it as the complete 'item'
    if (
      typeof itemOrService === 'object' &&
      itemOrService !== null &&
      !Array.isArray(itemOrService)
    ) {
      item = itemOrService;
    } 
    // Otherwise, assume the user passed individual arguments
    else {
        item = {
            service: itemOrService || null,
            url: url || null,
            title: title || null,
            desc: desc || null,
            feed: feed || null,
            author: author || null,
            date: date || null,
            full_content: full_content || null
        };
    }

   // alert("Audio2?"+item.audioIcon);
  
    // Extract parameters from item
    // So we can use them more clearly below

    let {
        service: service = null,
        url: itemUrl = null,
        title: itemTitle = null,
        desc: itemDesc = "",
        feed: itemFeed = null,
        author: itemAuthor = null,
        date: itemDate = null,
        full_content: itemFull_content = ""
    } = item || {};
  
    // Create item ID
    // (One day we want this to be a content-based ID)
    const itemID = createUniqueIdFromUrl(itemUrl);
    if (!itemID) { console.error('Could not make itemID'); }

    // Prepare the summary and full content
    if (itemDesc && itemDesc.length > summaryLimit) {
        if (itemDesc.length > itemFull_content.length) {
         
        // Define the full content (which could be the too-long summary)
            itemFull_content = itemDesc;
        }
        // Summary is too long ( more than summaryLimit )
        itemDesc = truncateContent(itemDesc);
    }

    summary = `
        <div id='${itemID}-summary' style='display:block;'>
        <a href="#" onclick="loadMastodonFeed('user',null,'${itemAuthor || 'Unknown Author'}'); return false;" title='View User Thread';>${itemFeed || 'Unknown Source'}</a>: 
        ${itemDesc || 'No Summary'}
        </div>`;

    if (itemFull_content && itemFull_content.length > itemDesc.length) {
            content = `
            <div id='${itemID}-content' style='display:none;'>
                <div class='status-actions'>
                <button class="material-icons md-18 md-light" onClick="toggleFormDisplay('${itemID}-content');toggleFormDisplay('${itemID}-summary');">zoom_in_map</button>
                </div>
                <div class='post'>
                    <h2 class='post-title'>${itemTitle}</h2>
                    <p><em>${itemAuthor || 'Unknown Author'}, ${itemFeed || 'Unknown Source'}, ${itemDate || 'Date unknown'}</em></p>
                    <div class='post-full-content'>${itemFull_content}</div>
                </div>
            </div>`;
        } else {
            content = ``;
        }

  
    // Create the Status Box div
    const statusBox = document.createElement('div');
    statusBox.classList.add('status-box'); // Add a class for styling
  
    // Create the Status Content div
    const statusContent = document.createElement('div');
    statusContent.classList.add('status-content'); // Add a class for styling
  
    // Create the Status Specific div
    const statusSpecific = document.createElement('div');
    statusSpecific.classList.add('statusSpecific'); // Add a class for styling
    statusSpecific.id = itemID; // Specific identity for this status
  
    // Populate StatusSpecific inner HTML
    statusSpecific.innerHTML = `
      <a onclick="${service}Search('${itemTitle}');">${itemTitle}</a><br>
      ${summary}
      ${content}
    `;

    // Images & media
    const images = item.images;
    if (images && images.length > 0) {
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
  
    // Create reference object on the DOM element
    statusSpecific.reference = {
      author_name: itemAuthor || '(unknown author)',
      author_id: '(unknown author ID)',
      url: itemUrl || '(no URL provided)',
      guid: itemUrl || '(no GUID provided)',
      title: itemTitle || '(no title)',
      feed: itemFeed || '(no feed specified)',
      created_at: itemDate || new Date().toISOString(),
      id: itemID || '(no ID)'
    };
  
    // Create status actions
    const statusActions = document.createElement('div');
    statusActions.classList.add('status-actions'); // Add a class for styling
  
    // This assumes you still have the same logic for 'readerHandlers'
    statusActions.innerHTML = readerHandlers[service].statusActions(item,itemID, itemUrl);
  
    // Create CList Actions
    const clistActions = document.createElement('div');
    clistActions.classList.add('clist-actions'); // Add a class for styling
    clistActions.innerHTML = `
      <button class="material-icons md-18 md-light" onClick="loadContentToTinyMCE('${itemID}');">
        arrow_right
      </button>
    `;
  
    // Assemble
    statusContent.appendChild(statusSpecific);
    statusContent.appendChild(statusActions);
  
    statusBox.appendChild(statusContent);
    statusBox.appendChild(clistActions);
  
    return statusBox;
  }
  
