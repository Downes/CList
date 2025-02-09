

// Handler

(function () {
    const ddgHandler = {
        statusActions: (item,itemID,itemLink) => {
            return `
            <button class="material-icons md-18 md-light" onClick="window.open('${itemLink}', '_blank', 'width=800,height=600,scrollbars=yes')">launch</button>`;
        },
        search: async (baseURL, accessToken) => {
            searchString = finderString();
            await duckduckgoSearch(searchString);
        }
    };

    // Ensure readerHandlers exists
    if (typeof window.readerHandlers === 'undefined') {
    window.readerHandlers = {}; // Create it if it doesn't exist
    }

    // Add the handler
    window.readerHandlers['duckduckgo'] = ddgHandler;
 })();





// Functions


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
