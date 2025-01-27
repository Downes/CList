//  files.js  -  helper and utility functions for file management
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



async function loadFile() {
    if (window.showOpenFilePicker) {
        try {
            const [fileHandle] = await window.showOpenFilePicker();
            const file = await fileHandle.getFile();

            const mimeType = file.type || "unknown"; // Get MIME type
            let content;

            if (mimeType.startsWith("text/") || mimeType === "application/json" || mimeType === "application/xml") {
                // Text-based files
                content = await file.text();
            } else {
                // Binary files (e.g., images, PDFs)
                content = await file.arrayBuffer(); // Read as ArrayBuffer
            }

            return restorePostContent(content, mimeType);
        } catch (err) {
            console.error("File load failed:", err);
            return null;
        }
    } else {
       // document.getElementById('fallbackMessage').style.display = 'block';
        const fileInput = document.getElementById('fileInput');
        
        return new Promise((resolve, reject) => {
            fileInput.onchange = async () => {
                const file = fileInput.files[0];
                if (file) {
                    try {
                        const mimeType = file.type || "unknown";
                        let con; // Define content in the proper scope
        
                        if (mimeType.startsWith("text/") || mimeType === "application/json" || mimeType === "application/xml") {
                            // Read text-based content
                            con = await file.text();
                        } else {
                            // Read binary content
                            con = await file.arrayBuffer();
                        }
                        // Pass the content and MIME type to restorePostContent
                        resolve(restorePostContent(con, mimeType));
                    } catch (err) {
                        console.error("Fallback file load failed:", err);
                        reject(err);
                    }
                } else {
                    reject(new Error("No file selected"));
                }
            };
            fileInput.click(); // Trigger the file input
        });
        
    }
}

function restorePostContent(content, mimeType) {
    console.log("Processing content with MIME type:", mimeType);

    // Handle string content
    if (typeof content === "string") {
        if (mimeType.startsWith("text/html")) {
            return parseHtmlContent(content, mimeType);
        } else if (mimeType.startsWith("text/") || mimeType === "application/json") {
            // If the MIME type is text/plain or similar, check if it contains HTML
            if (looksLikeHtml(content)) {
                console.warn("Content looks like HTML despite MIME type:", mimeType);
                return parseHtmlContent(content, "text/html");
            } else if (mimeType === "application/json") {
                try {
                    const json = JSON.parse(content);
                    return { type: mimeType, value: json };
                } catch (err) {
                    console.error("Invalid JSON content:", err);
                    return { type: "invalid", value: "Invalid JSON content" };
                }
            } else {
                // Treat as plain text
                return { type: mimeType, value: content };
            }
        } else {
            console.warn(`Unsupported MIME type: ${mimeType}`);
            return { type: mimeType, value: `Unsupported MIME type: ${mimeType}` };
        }
    }

    // Handle binary content
    if (content instanceof ArrayBuffer) {
        console.log("Binary content received.");
        return { type: mimeType, value: content };
    }

    // Fallback for unexpected content types
    console.error("Unexpected content type:", typeof content);
    return { type: "unknown", value: "Unknown content type" };
}

// Helper: Parse HTML Content
function parseHtmlContent(content, mimeType) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, "text/html");

    // Check for parser errors
    if (doc.querySelector("parsererror")) {
        console.error("Invalid HTML content.");
        return { type: "invalid", value: "Invalid HTML content" };
    }

    const titleContent = doc.querySelector("#post-title")?.innerHTML || "Untitled";
    const mainContent = doc.querySelector("#post-content")?.innerHTML || "default content";
    const referencesContent = doc.querySelector("#post-references")?.innerHTML || "";

    const titleInput = document.getElementById("write-title");
    if (titleInput) titleInput.value = titleContent;

    const referencesDiv = document.getElementById("writeReferences");
    if (referencesDiv) referencesDiv.innerHTML = referencesContent;

    return { type: mimeType, value: mainContent };
}

// Helper: Detect HTML Content
function looksLikeHtml(content) {
    // Check for basic HTML tags
    const htmlTags = /<html|<body|<head|<div|<span|<p/i;
    return htmlTags.test(content);
}

// Save

// Collects data from Write pane and packages it to save as a file or post

async function packagePost() {
    // Get title

    const titleValue = document.getElementById('write-title').innerText;
    if (!titleValue) { alert("Please enter a title for the post"); return; }

    // Get editor content
    const handler = editorHandlers[currentEditor];
    let contentValue;
    if (handler && typeof handler.getContent === 'function') {
        contentValue = await handler.getContent(); // Assign value to the variable
    } else {
        console.error("Unable to initialize content editor handler for write");
        alert("Write error, please consult the console for details");
    }


    // Retrieve references HTML content
    const referenceDivElement = document.getElementById('writeReferences'); // Replace with the actual ID
    const referenceValue = referenceDivElement ? referenceDivElement.innerHTML : '';

    // Create the parent post div
    const postDiv = document.createElement('div');
    postDiv.id = 'post';

    // Append the title div
    const titleDiv = document.createElement('div');
    titleDiv.id = 'post-title';
    titleDiv.innerHTML = titleValue; // Set HTML directly
    postDiv.appendChild(titleDiv);

    // Append the content div
    const contentDiv = document.createElement('div');
    contentDiv.id = 'post-content';
    contentDiv.innerHTML = contentValue; // Set HTML directly
    postDiv.appendChild(contentDiv);

    // Append the references div
    const referencesDiv = document.createElement('div');
    referencesDiv.id = 'post-references';
    referencesDiv.innerHTML = referenceValue; // Retrieve HTML from the target div
    postDiv.appendChild(referencesDiv);

    // Return the outerHTML of the constructed post div
    return postDiv.outerHTML;
}


// Creates a status shorter than 'length'
// Uses title and/or URL if available
// Uses data from divs id = write-title and write-column

function packageStatus(charlimit, input, publishedURL) {

    let saveStatus;

    let post = processHtml(input).trim(); // No formatting

    // Combine post and publishedURL with a space if publishedURL exists
    saveStatus = post + (publishedURL ? ` ${publishedURL}` : "");

    // Check if the result exceeds the character limit
    if (saveStatus.length > charlimit) {
        // Calculate the maximum allowed length for the post
        const maxPostLength = charlimit - (publishedURL ? publishedURL.length + 1 : 0); // +1 for the space
        if (maxPostLength > 3) {
            // Shorten the post and add ellipsis
            post = post.substring(0, maxPostLength - 3) + "...";
        } else {
            // If not enough space for ellipsis, truncate without ellipsis
            post = post.substring(0, maxPostLength);
        }

        // Remove 'undefined' from the beginning of the post
        post = post.startsWith('undefined') ? post.slice('undefined'.length) : post;

        // Recombine shortened post with publishedURL
        saveStatus = post + (publishedURL ? ` ${publishedURL}` : "");
    }

    return saveStatus;

}



async function saveContent() {

    content = await packagePost(); // Package the post content
    suggestedName = "content.html"
   // const fileContent = typeof content === "string" ? content : content.outerHTML;
   const fileContent = String(content); // Ensure content is treated as a string

    if (window.showSaveFilePicker) {
        // Modern Browsers: File System Access API
        try {
            const fileHandle = await window.showSaveFilePicker({
                suggestedName: "content.txt",
                types: [{ description: "Text Files", accept: { "text/plain": [".txt"] } }]
            });

            const writableStream = await fileHandle.createWritable();
            await writableStream.write(fileContent);
            await writableStream.close();
            alert("File saved successfully!");
        } catch (err) {
            console.error("Save failed:", err);
        }
    } else {
        // Fallback for Unsupported Browsers
        fallbackDownload(fileContent);
    }
}

function fallbackDownload(fileContent) {
    // Display fallback message
    document.getElementById('fallbackMessage').style.display = 'block';

    // Prompt user for a filename
    const fileName = prompt("Enter a file name:", "content.txt");
    if (!fileName) return; // Exit if the user cancels or doesn't provide a name

    const blob = new Blob([fileContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);

    // Create a temporary download link
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();

    URL.revokeObjectURL(url); // Clean up
    alert("File downloaded. Check your default download folder.");
}

