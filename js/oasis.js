
// Handlers

(function () {
    const oasisHandler = {
        statusActions: (item,itemID,itemLink) => {
            oasisStatusActions = `<button class="material-icons md-18 md-light" onClick="window.open('${itemLink}', '_blank', 'width=800,height=600,scrollbars=yes')">launch</button>`;

            // Enlarge Content
            if (item.full_content) { oasisStatusActions += `<button class="material-icons md-18 md-light" onClick="toggleFormDisplay('${itemID}-content');toggleFormDisplay('${itemID}-summary');">zoom_out_map</button>`; }

            return oasisStatusActions;
        },
        search: async (baseURL, accessToken) => {
            searchString = finderString();
            await oasisSearch(searchString);
        }
    };
    // Ensure readerHandlers exists
    if (typeof window.readerHandlers === 'undefined') {
    window.readerHandlers = {}; // Create it if it doesn't exist
    }

    // Add the handler
    window.readerHandlers['oasis'] = oasisHandler;
 })();


// Functions

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
  
