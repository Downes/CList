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


const leftContent = document.getElementById('left-content');
if (!leftContent) { console.error('Element with ID "left-content" not found.'); }

const readerHandlers = {
    Mastodon: {
        initialize: async (baseURL, accessToken) => {
            
            await initializeMasto(baseURL, accessToken);

            // Set up controls in left column 

            // mastodon-lists 
            let mastodonLists = document.getElementById('mastodon-lists');
            if (!mastodonLists) {
                // If it doesn't exist, create the div
                mastodonLists = document.createElement('div');
                mastodonLists.id = 'mastodon-lists'; // Set the ID for the div
                leftContent.appendChild(mastodonLists);
            }

            // mastodon-hashtag-form 
            mastodonFeedFiller('hashtag','Enter a hashtag without the #');

            // mastodon-user-form 
            mastodonFeedFiller('user','@username@instance.social');

            // mastodon-status-form 
            mastodonFormFiller('status','place');    
            
        },
        feedFunctions: {
            'Post': toggleDiv.bind(null, 'mastodon-status-form', 'left', true),
            'Following': loadMastodonFeed.bind(null, 'home', null),
            'Bookmarks': loadMastodonFeed.bind(null, 'bookmarks', null),
            'Lists': loadMastodonLists.bind(null, 'list', null),
            'Local': loadMastodonFeed.bind(null, 'local', null),
            'Hashtag': toggleDiv.bind(null, 'mastodon-hashtag-form', 'left',true),
            'User': toggleDiv.bind(null, 'mastodon-user-form', 'left',true)
        }
    },
    Bluesky: {
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
    },
    OPML: {
        initialize: () => {
        },
        feedFunctions: {
            'Timeline': fetchAndDisplayOPMLData.bind(null, '')
            // Add more named functions as needed
        },
        statusActions: (item,opmlID,itemLink) => {
            let opmlstatusActions = ``;

            // Enlarge Content
            if (item.content) { opmlstatusActions += `<button class="material-icons md-18 md-light" onClick="toggleFormDisplay('${opmlID}-content');toggleFormDisplay('${opmlID}-summary');">zoom_out_map</button>`; }
//alert("Audio3?"+item.audioIcon);

            // Play audio
            if (item.audioIcon && item.audioIcon != '') { opmlstatusActions +=  `${item.audioIcon}`; }

            // Bookmark (needs to be finished)
            opmlstatusActions += `<button class="material-icons md-18 md-light" onClick="Action('${opmlID}', 'bookmark')">bookmarks</button>`;

            // Open link in a new window
            if (item.link) { opmlstatusActions += `<button class="material-icons md-18 md-light" onClick="window.open('${item.link}', '_blank', 'width=800,height=600,scrollbars=yes')">launch</button>`; }

            return opmlstatusActions;
        }

    },
    duckduckgo: {
        statusActions: (item,itemID,itemLink) => {
            return `
            <button class="material-icons md-18 md-light" onClick="window.open('${itemLink}', '_blank', 'width=800,height=600,scrollbars=yes')">launch</button>`;
        }
    },
    google: {
        statusActions: (item,itemID,itemLink) => {
            return  `<button class="material-icons md-18 md-light" onClick="window.open('${itemLink}', '_blank', 'width=800,height=600,scrollbars=yes')">launch</button>`;;
        },
        feedFunctions: {
            'Web': function() { finderHandlers['google'].search(); },
            'Images': function() { finderHandlers['google'].search('image'); }
        }
    },
    oasis: {
        statusActions: (item,itemID,itemLink) => {
            oasisStatusActions = `<button class="material-icons md-18 md-light" onClick="window.open('${itemLink}', '_blank', 'width=800,height=600,scrollbars=yes')">launch</button>`;

            // Enlarge Content
            if (item.full_content) { oasisStatusActions += `<button class="material-icons md-18 md-light" onClick="toggleFormDisplay('${itemID}-content');toggleFormDisplay('${itemID}-summary');">zoom_out_map</button>`; }

            return oasisStatusActions;
        }
    }
}

const finderHandlers = {
    duckduckgo: {
        search: async (baseURL, accessToken) => {
            searchString = finderString();
            await duckduckgoSearch(searchString);
        }
    },
    google: {
        search: async (type) => {
            searchString = finderString();
            await googleSearch(searchString,type);
        }
    },
    oasis: {
        search: async (baseURL, accessToken) => {
            searchString = finderString();
            await oasisSearch(searchString);
        }
    }
}


function finderString() {
    const findTextarea = document.getElementById('find-textarea');
    const searchString = findTextarea.value;
    if (!searchString) { alert("Please enter a search value in the form"); return;}
    return searchString;
}

async function oasisSearch(query,start) {


    const feedContainer = document.getElementById('feed-container');
    const dateString = new Date().toISOString();

    let proxyUrl = "https://www.downes.ca/cgi-bin/proxyp.cgi";
    let oasisUrl = `http://oasis.geneseo.edu/basic_search.php?search_query=${query}`;
    // ?title=Test&author=&subject=&format=json

    // Construct URL with query parameters
    if (start) { oasisUrl += `&start=${start}`;}

    if (start === undefined || start === null || start === '' || start === 0) {
        // First page will have a title, but not subsequent pages
        feedContainer.innerHTML = '';                         // Clear previous content
        feedContainer.appendChild(createFeedHeader('OASIS Search: '+query));   // Header
    }

    let data;
    let params = {};
    params.url = `${oasisUrl}`;
    //params.apikey = apiKey;

    try {
        const response = await fetch(proxyUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams(params),
        });

        const htmlText = await response.text(); // use .text() instead of .json()
       // const cleanedHtmlText = htmlText.replace(/textarea/g, '');


        const data = parseOasisHtml(htmlText);

        if (data && Array.isArray(data) && data.length > 0) {
            data.forEach((item) => {
                try {
                    // console.log("Item\n");
                    // console.log(item);

                    // Create the listing object - align to main listing item fields
                    // makeListing(service,url,title,desc,feed,author,date,full_content) 
                    item.service = 'oasis';
                    item.desc = `${item.itemType} ${item.description}`;
                    item.content = item.desc;
                    item.feed = item.source;

                    const listing = makeListing(item);
        
                    // Append the listing to the feed container
                    feedContainer.appendChild(listing);
                } catch (error) {
                    console.error(`Error processing item: ${JSON.stringify(item)}`, error);
                }
            });
        } else {
            console.warn('No items found in the parsed data.');
        }

    } catch (error) {
        console.error("Failed to fetch from Oasis Search API:", error);
    }


    console.log(data);
}


/**
 * Takes the raw HTML text from OASIS and returns an
 * array of item objects containing metadata fields:
 *   item-type, title, description, author, source, url, etc.
 */
function parseOasisHtml(htmlString) {
    // 1) Parse the HTML string into a Document
console.log(htmlString);
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');
  
    // 2) Select all "cards" (each search result) by their CSS class
    const results = doc.querySelectorAll('.row.sources.results');
    
    const items = [];
  
    results.forEach((resultEl) => {
      const item = {};
  
      // TITLE + URL
      // The anchor under <b><a rel="external" href="...">Some Title</a></b>
      const titleAnchor = resultEl.querySelector('b > a[rel="external"]');
      if (titleAnchor) {
        item.title = titleAnchor.textContent.trim();
        item.url   = titleAnchor.getAttribute('href');
      } else {
        item.title = '';
        item.url   = '';
      }
  
      // AUTHOR
      // Author line often looks like: <b>Author</b>: Name<br/>
      // We can match it with a small regex on the entire element’s HTML:
      const authorMatch = resultEl.innerHTML.match(/<b>Author<\/b>:\s?(.*?)<br\/>/);
      item.author = authorMatch ? authorMatch[1].trim() : '';
  
      // SOURCE
      // Source line looks like: <b>Source</b>: <a ...>OAPEN</a>
      const sourceMatch = resultEl.innerHTML.match(/<b>Source<\/b>:\s?<a.*?>(.*?)<\/a>/);
      item.source = sourceMatch ? sourceMatch[1].trim() : '';
  
      // TYPE
      // Type line looks like: <b>Type</b>: Open Access Book<br>
      const typeMatch = resultEl.innerHTML.match(/<b>Type<\/b>:\s?(.*?)<br/);
      item.itemType = typeMatch ? typeMatch[1].replace(/<.*?>/g, '').trim() : ''; 
      // (Replace any stray HTML tags.)
  
      // DESCRIPTION
      // Descriptions usually appear inside the associated "Detailed Item View" modal (class="modal-body").
      // We'll look for the modal tied to this row (it’s usually right next to it).
      // But to simplify, we can also just do a regex on resultEl's HTML (if it includes the modal):
      const descMatch = resultEl.innerHTML.match(/<strong>Description<br><\/strong>(.*?)<\/div>/);
      item.description = descMatch
        ? descMatch[1].replace(/<br\s*\/?>/g, '\n').trim()
        : '';
  
      items.push(item);
    });
  
    return items;
  }
  

    
async function googleSearch(query,type,start) {

    const feedContainer = document.getElementById('feed-container');
    const dateString = new Date().toISOString();

        // Get generater from accounts
    // Assumes 'accounts' array has been preloaded
    // If necessary, fetch the accounts from the KVstore
    if (accounts.length === 0) {
        try {
            // Fetch the accounts from the KVstore
            accounts = await getAccounts(flaskSiteUrl); 

        } catch (error) {
            alert('Error getting Editor accounts: ' + error.message);
        }
    }
    
    let API_KEY = null;
    let SEARCH_ENGINE_ID = null;

     accounts.forEach(account => {                           // Check the accounts
        const parsedValue = JSON.parse(account.value);
        console.log("checking account: ", parsedValue);
        if (parsedValue.title.includes('Google Search')) {  // Check if 'permissions' contains 'g'
            console.log("FOUND account: ", parsedValue);
            console.log("parsedValue.id: ", parsedValue.id);
            console.log("parsedValue.key: ", parsedValue.key);
            API_KEY = parsedValue.id;
            SEARCH_ENGINE_ID = parsedValue.instance;
        }
    });


    // Check for required values and handle errors
    if (!API_KEY || !SEARCH_ENGINE_ID) {
        alert("ApiKey and url are both required to continue.");
        throw new Error("Missing required values: apiKey or url.");
    }


    // 1. Store API information
    const GOOGLE_SEARCH_URL = "https://www.googleapis.com/customsearch/v1";

    

    // Construct URL with query parameters
    let url = `${GOOGLE_SEARCH_URL}?key=${API_KEY}&cx=${SEARCH_ENGINE_ID}&q=${encodeURIComponent(query)}`;
    if (start) { url += `&start=${start}`;}
    if (type === 'image') { url += '&searchType=image'; }
    if (type === 'video') { url += '&searchType=video'; }    

    if (start === undefined || start === null || start === '' || start === 0) {
        // First page will have a title, but not subsequent pages
        feedContainer.innerHTML = '';                         // Clear previous content
        feedContainer.appendChild(createFeedHeader('GoogleSearch: '+query));   // Header
    }

    try {
        // Make the request
        const response = await fetch(url);
        
        // Convert response to JSON
        const data = await response.json();
        
        // Handle potential errors from the API
        if (data.error) {
            console.error("Google Search API Error: ", data.error);
            return;
        }

        setupFeedButtons('google');  // Different feed buttons for different services
    console.log("RESULTS");
        // Check if items array exists
        if (data.items && data.items.length > 0) {
            data.items.forEach((item) => {
                console.log(JSON.stringify(item, null, 2));

                // Create the listing object - align to main listing item fields
                // makeListing(service,url,title,desc,feed,author,date,full_content) 
                item.service = 'google';
                item.url = item.link;
                item.desc = item.snippet;
                item.feed = 
                    item?.pagemap?.metatags?.[0]?.['og:site_name'] ||
                    item?.pagemap?.metatags?.[0]?.['twitter:site'] ||       // ex: "@BBCWorld"
                    item?.pagemap?.metatags?.[0]?.['application:name'] ||   // made-up fallback
                    item?.displayLink || // e.g. "www.bbc.com"
                    '';
                item.author = extractAuthorFromGoogle(item);
                item.content = item.htmlSnippet;

                // Put image information into standard images array with url preview_url description
                if (type === 'image') {
                    item.images = [];
                    item.images.push({
                        url: item.link,
                        preview_url: item.image.thumbnailLink,
                        description: item.snippet
                    });
                }


                const listing = makeListing(item);
                feedContainer.appendChild(listing);
        
                // For demo, just log it:
                console.log(listing);
                });

            // Show a button to load the next page if there is more data
            let nextPageButton = document.getElementById('nextPageButton');
            if (typeof start === 'undefined') {
                start = 11;
              } else {
                start += 10;
              }
            if (!nextPageButton) {
                nextPageButton = document.createElement('button');
                nextPageButton.id = 'nextPageButton';
                nextPageButton.textContent = 'Load Next Page';
                nextPageButton.onclick = () => googleSearch(query,type,start);
                feedContainer.appendChild(nextPageButton);
            } else if (nextPageButton) {  
                nextPageButton.onclick = () => googleSearch(query,type,start);
            }

            // Push Next Page button to the Bottom
            feedContainer.appendChild(nextPageButton);

        }

      
        // console.log("Google Search results:", data);
        
        
    } catch (error) {
        console.error("Failed to fetch from Google Search API:", error);
    }
}

/**
 * Attempt to extract an author from the item’s pagemap, if present.
 * Note: This is not an official or standardized approach; it’s heuristic-based
 * because different pages provide different metadata fields for authors.
 */
function extractAuthorFromGoogle(item) {
    if (!item.pagemap) {
      return "";
    }
  
    const { pagemap } = item;
  
    // 1. Check the metatags array
    if (pagemap.metatags && pagemap.metatags.length > 0) {
      for (const tagObject of pagemap.metatags) {

        // LinkedIn profiles
        const tagObject = item.pagemap.metatags[0];
        const firstName = tagObject["profile:first_name"];
        const lastName = tagObject["profile:last_name"];
        if (firstName || lastName) {
          return `${firstName} ${lastName}`;
        }

        // hcard
        if (item.pagemap.hcard && item.pagemap.hcard.length > 0) {
            const fn = item.pagemap.hcard[0].fn; 
            if (fn) {
              return fn;
            }
        }

        // Some possible keys we might look for:
        const potentialKeys = [
          "author",
          "fediverse:creator",
          "twitter:creator",
          "twitter:title",
          "article:author",
          "og:article:author",
          "og:author",
        ];
  
        for (const key of potentialKeys) {
          if (tagObject[key]) {
            return tagObject[key];
          }
        }
      }
    }
  
    // 2. Check if there's a 'person' array with names (schema.org style)
    if (pagemap.person && pagemap.person.length > 0) {
      if (pagemap.person[0].name) {
        return pagemap.person[0].name;
      }
    }
  
    // 3. Add any other fallback logic here, e.g. checking “pagemap.review” or custom fields
  
    return "";
  }

  
async function duckduckgoSearch(q) {

    const URL = `https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&t=h_&format=json`;
    const feedContainer = document.getElementById('feed-container');
    const dateString = new Date().toISOString();
    let data;
    try {
        const response = await fetch(URL);

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }


        data = await response.json();
        console.log("Data received:", data);

    } catch (error) {
        console.error("Error accessing the URL:", error.message);
    }

    let ddgHeading = data.Heading || "No heading found";
    let ddgAbstract = data.Abstract || "";
    let listing;

    // If there's no abstract, check if we have a disambiguation page
    if (!ddgAbstract && data.RelatedTopics && data.RelatedTopics.length > 0) {
        // Mark the heading as disambiguation
        ddgHeading += " (Disambiguation)";
        if (ddgHeading != null) {  // First page will have a title, but not subsequent pages
            feedContainer.innerHTML = '';                         // Clear previous content
            feedContainer.appendChild(createFeedHeader(ddgHeading));   // Header
        }

        // Loop through related topics to find titles & descriptions
        data.RelatedTopics.forEach((item) => {
        // Some related topic items have the shape:
        // {
        //   "FirstURL": "https://duckduckgo.com/...",
        //   "Text": "Topic Title - short description"
        // }
        //
        // Others might be sub-group items with a "Topics" array. We’ll handle both cases:

            if (item.Topics && Array.isArray(item.Topics)) {
                // It's a subgroup
                item.Topics.forEach((subItem) => {
                    const { title, description } = getDDGTitleAndDescription(subItem.FirstURL,subItem.Result);
                    // makeListing(service,url,title,desc,feed,author,date,full_content) 
                    listing = makeListing('duckduckgo',subItem.FirstURL,title,description,data.AbstractSource,'',dateString,subItem.AbstractText);
                });

            } else if (item.Text) {
                // It's a direct item

                const { title, description } = getDDGTitleAndDescription(item.FirstURL,item.Result);

                // makeListing(service,url,title,desc,feed,author,date,full_content) 
                listing = makeListing('duckduckgo',item.FirstURL,title,description,data.AbstractSource,'',dateString,item.AbstractText);
            }
            feedContainer.appendChild(listing);
        });
    
        // Since there's no actual abstract, set a default
        ddgAbstract = "No abstract found (Disambiguation page).";
    } else if (!ddgAbstract) {
        // There's no abstract and no disambiguation
        feedContainer.appendChild(createFeedHeader("No Result"));   // Header
        const statusBox = document.createElement('div');
        statusBox.classList.add('status-box');  // Add a class for styling
        statusBox.innerHTML = `Duck Duck Go does not have a full search API. Results are generated from a 'fastAPI' that returns results from specific sources such as Wikipedia. This search is not
        found in any of these sources. A full search service is recommended. Open 'accounts' and create a 'search' account.`
        feedContainer.appendChild(statusBox);

    } else {

        if (ddgHeading != null) {  // First page will have a title, but not subsequent pages
            feedContainer.innerHTML = '';                         // Clear previous content
            feedContainer.appendChild(createFeedHeader(ddgHeading));   // Header
        }
        console.log("ddg-abstract:", ddgAbstract);
        // makeListing(service,url,title,desc,feed,author,date,full_content) 
        listing = makeListing('duckduckgo',data.AbstractURL,ddgHeading,ddgAbstract,data.AbstractSource,'',dateString,data.AbstractSource,data.AbstractText); 
        feedContainer.appendChild(listing);

    }
    

 
}

// Helper function to extract title and description from text
function getDDGTitleAndDescription(url, fullText) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(fullText, "text/html");

    // Extract the <a> tag and its text
    const linkTag = doc.querySelector("a");
    if (!linkTag) {
        console.log("Could not parse link/tag in Result:", fullText);
        return { title: "(no title)", description: "(no description)" };
    }
    const title = linkTag.textContent.trim();

    // The rest of the string after the link is the description
    let leftoverHtml = doc.body.innerHTML.replace(linkTag.outerHTML, "").trim();
    leftoverHtml = leftoverHtml.replace(/<br\s*\/?>/gi, "").trim();
    const description = leftoverHtml || "(no description)";

    return { title, description };
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
            <button class="save-button" onClick="finderHandlers['duckduckgo'].search();">Duck Duck Go</button>
            </div>

            <div id="select-find-account">
            <button class="save-button" onClick="finderHandlers['google'].search();">Google</button>
            </div>
                
            <div id="select-find-account">
            <button class="save-button" onClick="finderHandlers['oasis'].search();">OASIS OERs</button>
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
  
