//  files.js  -  helper and utility functions for file management
//  Part of CList, the next generation of learning and connecting with your community
//
//  Version version 0.1 created by Stephen Downes on January 27, 2025
//
//  Copyright Stephen Downes 2025
//  Licensed under Creative Commons Attribution 4.0 International https://creativecommons.org/licenses/by/4.0/
//
//  This software carries NO WARRANTY OF ANY KIND.
//  This software is provided "AS IS," and you, its user, assume all risks when using it.
// 



// Both pickers read bytes; recognition inspects content before extension/MIME hints.
function _decideFileLoad(content, mimeType, filename) {
    return restorePostContent(content, mimeType, filename);
}
async function readLocalFileContent(file) {
    return _decideFileLoad(await file.arrayBuffer(), file.type || '', file.name);
}

async function loadFile() {
    if (window.showOpenFilePicker) {
        try {
            const [fileHandle] = await window.showOpenFilePicker();
            const file = await fileHandle.getFile();

            return await readLocalFileContent(file);
        } catch (err) {
            if (err.name === 'AbortError') return null;
            console.error("File load failed:", err);
            showErrorModal('Could not open file: ' + err.message, { title: 'File load failed' });
            return null;
        }
    } else {
       // document.getElementById('fallbackMessage').style.display = 'block';
        const fileInput = document.getElementById('fileInput');

        return new Promise(resolve => {
            fileInput.onchange = async () => {
                const file = fileInput.files[0];
                if (file) {
                    try {
                        resolve(await readLocalFileContent(file));
                    } catch (err) {
                        console.error("Fallback file load failed:", err);
                        showErrorModal('Could not open file: ' + err.message, { title: 'File load failed' });
                        resolve(null);
                    }
                } else {
                    resolve(null);
                }
            };
            fileInput.oncancel = () => resolve(null);
            fileInput.value = '';
            fileInput.click(); // Trigger the file input
        });

    }
}

function restorePostContent(content, mimeType, filename) {
    const detected = recognizeSavedContent(content, mimeType, filename);
    const metadata = detected.page || {};
    const page = { ...metadata, ...(filename ? { kind: 'file', title: filename } : {}),
        ...(metadata.title ? { documentTitle: metadata.title } : {}) };
    return { ...detected, page, recognized: true };
}

// Save

// Collects data from Write pane and packages it to save as a file or post

async function packagePost({
    forPublishing = false,
    title,
    referenceHtml,
    fileMetadata = null,
    editorHandler = null,
    content
} = {}) {
    // Get title

    const titleValue = title ?? window.CList.ui.view.writeTitle.innerText;

    // Get editor content
    const handler = editorHandler || editorHandlers[currentEditor];
    let contentValue;
    try {
        if (content !== undefined) contentValue = content;
        else if (forPublishing && typeof handler?.getPostContent === 'function') contentValue = await handler.getPostContent();
        else if (typeof handler?.getContent === 'function') contentValue = await handler.getContent();
        else throw new Error('The editor content is unavailable.');
        if (typeof contentValue !== 'string') throw new Error('The editor did not return text content.');
    } catch (error) {
        console.error('Could not prepare editor content:',error);
        showErrorModal('Could not prepare the post: '+error.message,{title:'Post preparation failed'});
        return null;
    }


    // Retrieve references HTML content
    const referenceValue = referenceHtml ??
        (document.getElementById('writeReferences')?.innerHTML || '');

    // Create the parent post div
    const postDiv = document.createElement('div');
    postDiv.id = 'post';

    // Append the title div
    const titleDiv = document.createElement('div');
    titleDiv.id = 'post-title';
    titleDiv.textContent = titleValue;
    postDiv.appendChild(titleDiv);

    // Append the content div
    const contentDiv = document.createElement('div');
    contentDiv.id = 'post-content';
    if (fileMetadata && handler?.contentTypes?.[0] === 'text/plain') contentDiv.textContent = contentValue;
    else contentDiv.innerHTML = contentValue;
    postDiv.appendChild(contentDiv);

    // Append the references div
    const referencesDiv = document.createElement('div');
    referencesDiv.id = 'post-references';
    referencesDiv.innerHTML = referenceValue; // Retrieve HTML from the target div
    postDiv.appendChild(referencesDiv);

    if (fileMetadata) {
        const metadata = document.createElement('script');
        metadata.id = 'clist-file-metadata'; metadata.type = 'application/json';
        const nativeType = (handler?.contentTypes || [])[0] === 'text/plain' ? 'text/plain' : 'text/html';
        metadata.textContent = JSON.stringify({ ...fileMetadata, content: { type: nativeType, value: contentValue } }).replace(/</g, '\\u003c');
        postDiv.appendChild(metadata);
    }

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



(function () {
    window.CList.loaders = window.CList.loaders || [];
    window.CList.loaders.push({
        label: 'Load from file',
        icon:  'upload_file',
        requiresLogin:   false,
        requiresAccount: false,
        load:  async () => await loadFile()
    });
})();

(function () {
    window.CList.savers = window.CList.savers || [];
    window.CList.savers.push({
        label: 'Save to local file',
        icon:  'save',
        requiresLogin:   false,
        requiresAccount: false,
        save:  async () => await saveContent()
    });
})();


// Session-only cache of FileSystemFileHandle, keyed by the page's own urn:uuid
// id — lets a second "Save to local file" of the same resource write straight
// back to the file the user already picked instead of prompting again (which,
// on Chromium, the OS would otherwise save as a numbered copy). Only possible
// when there's a stable id to key off; an anonymous (not logged in, never
// indexed) save always goes through the picker. Lost on page reload — browsers
// don't persist file handles across reloads without IndexedDB-backed permission
// storage, which isn't implemented here.
const _localFileHandles = {};

