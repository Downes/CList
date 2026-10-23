
// Handlers

(function () {
    const oasisHandler = {
        label: 'OASIS OERs',
        icon: 'school',
        statusActions: (item,itemID,itemLink) => {
            oasisStatusActions = `<button class="clist-action-btn" title="Open in browser" onClick="openInBrowser('${itemLink}', '${itemID}')"><span class="material-icons md-18 md-light">launch</span></button>`;

            // Enlarge Content
            if (item._hasExpandableContent) { oasisStatusActions += `<button class="clist-action-btn" title="Expand" onClick="toggleEntryExpanded('${itemID}');"><span class="material-icons md-18 md-light">zoom_out_map</span></button>`; }

            return oasisStatusActions;
        },
        search: async (baseURL, accessToken) => {
            searchString = finderString();
            await oasisSearch(searchString);
        }
    };
    // Ensure readerHandlers exists
    if (typeof window.CList.readers === 'undefined') {
    window.CList.readers = {}; // Create it if it doesn't exist
    }

    // Add the handler
    window.CList.readers['oasis'] = oasisHandler;
 })();


// Functions

async function oasisSearch(query,start) {


    const feedContainer = window.CList.ui.view.feedContainer;
    const dateString = new Date().toISOString();

    let proxyUrl = "https://proxyp.mooc.ca";
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
        // proxyp.mooc.ca requires a valid kvstore Bearer token on every request.
        const kvToken = getSiteSpecificCookie(window.CList.config.flaskSiteUrl, window.CList.keys.ACCESS_TOKEN);
        const response = await fetch(proxyUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                ...(kvToken ? { 'Authorization': `Bearer ${kvToken}` } : {}),
            },
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
        showServiceError(feedContainer, 'Oasis Search error', error.message,
            'Could not reach Oasis Search. Check your network connection or try again later.');
    }
    window.checkAnnotationsBatch?.();
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
      // We can match it with a small regex on the entire element's HTML:
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
      // We'll look for the modal tied to this row (it's usually right next to it).
      // But to simplify, we can also just do a regex on resultEl's HTML (if it includes the modal):
      const descMatch = resultEl.innerHTML.match(/<strong>Description<br><\/strong>(.*?)<\/div>/);
      item.description = descMatch
        ? descMatch[1].replace(/<br\s*\/?>/g, '\n').trim()
        : '';
  
      items.push(item);
    });
  
    return items;
  }
  
