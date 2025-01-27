//  utilities.js  -  Utility functions for CList
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


// Set Cookie

function setCookie(name, value, days) {
    let expires = "";
    if (days) {
        const date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        expires = "; expires=" + date.toUTCString();
    }
    document.cookie = name + "=" + (value || "") + expires + "; path=/; Secure; SameSite=None";
}

// Get Cookie
function getCookie(name) {
 
    // Construct the search pattern
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);

     if (parts.length === 2) {
        // Return the value of the cookie
        const result = parts.pop().split(';').shift();
        return result;
    }

    return null;
}

// Site Specific Cookies

function deriveSiteIdentifier(flaskSiteUrl) {
    if (!flaskSiteUrl) { alert('No flaskSiteUrl provided'); console.error("No flask site URL provided."); } //
    return new URL(flaskSiteUrl).hostname.replace(/\./g, '_');
}

function setSiteSpecificCookie(flaskSiteUrl, name, value, days) {
    setCookie(`${name}_${deriveSiteIdentifier(flaskSiteUrl)}`, value, days);
}

function getSiteSpecificCookie(flaskSiteUrl, name) {
    return getCookie(`${name}_${deriveSiteIdentifier(flaskSiteUrl)}`);
}

function deleteSiteSpecificCookie(flaskSiteUrl, name) {
    setCookie(`${name}_${deriveSiteIdentifier(flaskSiteUrl)}`, '', -1);
}

// Extract baseURL  (from username@baseURL.social allowing for submission of baseURL.social)

function extractBaseUrl(accountName) {
    let baseURL;
    // Split username from instance
    if (accountName.includes('@')) { baseURL = accountName.split('@')[1]; }
    else { baseURL = accountName; }
    // Add "https://" if it's missing
    if (!/^https?:\/\//i.test(baseURL)) {
        baseURL = 'https://' + baseURL;
    }
    return baseURL;
}

function extractAccountName(input) {
    const atIndex = input.indexOf('@'); // Find the position of '@'
    
    if (atIndex !== -1) {
        return input.slice(0, atIndex); // Return everything before the '@'
    } else {
        return null; // Return null if '@' is not found
    }
}


function ucfirst(input) {
    if (typeof input !== 'string' || input.length === 0) {
        return input; // Return the input unchanged if it's not a valid string
    }
    return input.charAt(0).toUpperCase() + input.slice(1);
}


function removeHtml(content) {
    let cleanedContent;

    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = content;
    cleanedContent = tempDiv.textContent || tempDiv.innerText || "";  // Extract only the text
    return cleanedContent;
}

function processHtml(input) {
    // Replace <br> or <br /> with a single line feed
    let post = input.replace(/<br\s*\/?>/gi, '\n');

    // Replace </p> and </div> with a double line feed
    post = post.replace(/<\/(p|div)>/gi, '\n\n');

    // Remove all other HTML tags
    post = post.replace(/<[^>]*>/g, '');

    // Trim extra spaces or line breaks
    return post.trim();
}

function cleanHTMLContent(htmlContent) {
    // Extract URLs from href attributes and replace them inline with the desired format
    const withFormattedURLs = htmlContent.replace(
      /<a[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi,
      (_, url, text) => `${text} <${url}>`
    );
  
    // Remove remaining HTML tags
    const noHTML = withFormattedURLs.replace(/<[^>]*>/g, '');
  
    // Format any standalone URLs not in tags
    const fullyFormattedContent = noHTML.replace(
      /https?:\/\/[^\s]+/g,
      url => `<${url}>`
    );
  
    return fullyFormattedContent;
  }

function truncateToGraphemeLimit(text, limit = 300) {
    const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });
    const graphemes = Array.from(segmenter.segment(text), segment => segment.segment); // Extract grapheme strings

    if (graphemes.length > limit) {
        return graphemes.slice(0, limit - 1).join('') + '…'; // Truncate to 299 graphemes and append ellipsis
    }
    return text; // Return the original text if within limit
}

// Summarize content by truncating
// const summaryLimit = 100; // Example limit, adjust as needed, place where needed

function truncateContent(content) {
    // If content is within the limit, return immediately
    if (content.length <= summaryLimit) {
        return content;
    }

    // Remove HTML tags
    let cleanedContent = removeHtml(content).trim();

    // If after cleaning HTML it's still within the limit, return as-is
    if (cleanedContent.length <= summaryLimit) {
        return cleanedContent;
    }

    // Truncate to summaryLimit, but ensure we end on a word boundary.
    // First, truncate strictly to summaryLimit characters
    let truncated = cleanedContent.slice(0, summaryLimit);

    // Find the last space in truncated; this ensures we don't cut a word in half
    const lastSpace = truncated.lastIndexOf(" ");
    if (lastSpace > 0) {
        truncated = truncated.slice(0, lastSpace);
    }

    // Add ellipsis, ensuring we don't exceed summaryLimit
    // We removed from the text so we should have space to add the ellipsis.
    // If not, consider using a shorter ellipsis or handle differently.
    const ellipsis = "…";
    if (truncated.length + ellipsis.length <= summaryLimit) {
        truncated += ellipsis;
    } else {
        // In a rare case where truncated is exactly summaryLimit, we might have to
        // drop the last character to fit the ellipsis.
        truncated = truncated.slice(0, truncated.length - ellipsis.length) + ellipsis;
    }

    // Check for balanced quotes. If there's an odd number of quotes, add one to close them.
    const doubleQuotesCount = (truncated.match(/"/g) || []).length;
    const singleQuotesCount = (truncated.match(/'/g) || []).length;
    
    // If there's an odd number of double quotes, add another one if space allows
    if (doubleQuotesCount % 2 !== 0) {
        if (truncated.length + 1 <= summaryLimit) {
            truncated += '"';
        } else {
            // If adding a quote would exceed the limit, consider removing something else 
            // or just skip closing this quote.
        }
    }

    // If there's an odd number of single quotes, add another one if space allows
    if (singleQuotesCount % 2 !== 0) {
        if (truncated.length + 1 <= summaryLimit) {
            truncated += "'";
        } else {
            // Same consideration as with double quotes
        }
    }

    // At this point, truncated should meet the requirements.
    return truncated;
}




// Function to decode HTML-escaped text
// Used specifically by tinymce.js
function decodeHTMLEntities(content) {
    content = content.replace(/&lt;/g, "LT")
    .replace(/&gt;/g, "GT")
    .replace(/&amp;/g, "AMP")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'");
    return content;

}

// Function to decode escaped HTML entities
function decodeHTML(html) {
    return new DOMParser()
        .parseFromString(html, "text/html")
        .body.textContent || html;
}

function createUniqueIdFromUrl(url) {
    const prefix = 'item-'; // Ensure the id starts with a letter
    const sanitizedUrl = encodeURIComponent(url); // Encode the URL to make it safe
    return prefix + sanitizedUrl;
}


// Utility function to apply a timeout to any async operation
function withTimeout(promise, ms) {
    return Promise.race([
        promise,
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout exceeded')), ms)
        )
    ]);
}


// More subtle than an alert and doesn't interrupt the user
function showStatusMessage(message) {
    const statusPane = document.getElementById('statusPane');

    if (!statusPane) {
        console.error('Status pane element not found.');
        return;
    }

    // Set the message and make the pane visible
    statusPane.textContent = message;
    statusPane.style.display = 'block';

    // Hide the status pane after 10 seconds
    setTimeout(() => {
        statusPane.style.display = 'none';
    }, 3000); // 10000ms = 10 seconds
}



function callIfAvailable(functionName, ...args) {
    if (typeof window[functionName] === "function") {
        // Call the function with the provided arguments
        return window[functionName](...args);
    } else {
        console.log(`Function ${functionName} is not available.`);
        return null;
    }
}
