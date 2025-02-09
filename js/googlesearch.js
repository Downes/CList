

// Handler

(function () {
    const googHandler = {
        statusActions: (item,itemID,itemLink) => {
            return  `<button class="material-icons md-18 md-light" onClick="window.open('${itemLink}', '_blank', 'width=800,height=600,scrollbars=yes')">launch</button>`;;
        },
        feedFunctions: {
            'Web': function() { readerHandlers['google'].search(); },
            'Images': function() { readerHandlers['google'].search('image'); }
        },
        search: async (type) => {
            searchString = finderString();
            await googleSearch(searchString,type);
        }
    };
    // Ensure readerHandlers exists
    if (typeof window.readerHandlers === 'undefined') {
    window.readerHandlers = {}; // Create it if it doesn't exist
    }

    // Add the handler
    window.readerHandlers['google'] = googHandler;
 })();



// Functions
    
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

