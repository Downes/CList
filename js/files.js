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



// Shared by both file-picking paths below: decide whether the file's content is
// collection-shaped (a genuine non-empty RSS/OPML/JSON/HTML item list) and, if
// so, offer a Collection-vs-native choice before falling through to the normal
// restorePostContent() handling — which stays untouched either way, so HTML's
// #post-title/#post-content/#post-references extraction (parseHtmlContent())
// still runs for the native path exactly as before this existed.
function _decideFileLoad(content, mimeType, filename) {
    if (typeof content !== 'string') {
        // Binary content never carries a collection shape.
        return restorePostContent(content, mimeType, filename);
    }
    const format = _detectFormat(mimeType, filename);
    const parsed = _collectionShape(content, format);
    if (!parsed) return restorePostContent(content, mimeType, filename);

    return new Promise(resolve => {
        _offerCollectionChoice(parsed, format, {
            renderTarget: window.CList.ui.view.loadOptions,
            onCancel: () => { resolve(null); if (typeof populateLoadOptions === 'function') populateLoadOptions(); },
            onNative: () => resolve(restorePostContent(content, mimeType, filename)),
        });
    });
}

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

            return await _decideFileLoad(content, mimeType, file.name);
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
                        // Pass the content, MIME type and filename to restorePostContent
                        resolve(await _decideFileLoad(con, mimeType, file.name));
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

function restorePostContent(content, mimeType, filename) {
    console.log("Processing content with MIME type:", mimeType);

    // Loaded-page indicator metadata — lets the editor show which file this
    // content came from (setLoadedPage()/updateLoadedPageUI() in editors.js),
    // same as a page loaded from My Pages shows its title.
    const page = filename ? { kind: 'file', title: filename } : null;

    // Handle string content
    if (typeof content === "string") {
        if (mimeType.startsWith("text/html")) {
            return parseHtmlContent(content, mimeType, page);
        } else if (mimeType.startsWith("text/") || mimeType === "application/json") {
            // Trust the declared MIME type (from the file's own extension) as-is —
            // a .txt file loads as plain text even if its content happens to contain
            // HTML-like tags (e.g. a saved markup fragment meant to be edited as text).
            if (mimeType === "application/json") {
                try {
                    const json = JSON.parse(content);
                    return { type: mimeType, value: json, page };
                } catch (err) {
                    console.error("Invalid JSON content:", err);
                    return { type: "invalid", value: "Invalid JSON content" };
                }
            } else {
                // Treat as plain text
                return { type: mimeType, value: content, page };
            }
        } else {
            console.warn(`Unsupported MIME type: ${mimeType}`);
            return { type: mimeType, value: `Unsupported MIME type: ${mimeType}` };
        }
    }

    // Handle binary content
    if (content instanceof ArrayBuffer) {
        console.log("Binary content received.");
        return { type: mimeType, value: content, page };
    }

    // Fallback for unexpected content types
    console.error("Unexpected content type:", typeof content);
    return { type: "unknown", value: "Unknown content type" };
}

// Helper: Parse HTML Content
function parseHtmlContent(content, mimeType, page) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, "text/html");

    // Check for parser errors
    if (doc.querySelector("parsererror")) {
        console.error("Invalid HTML content.");
        return { type: "invalid", value: "Invalid HTML content" };
    }

    const titleContent = doc.querySelector("#post-title")?.innerHTML || "Untitled";
    // #post-content is CList's own round-trip export marker — a generic HTML file
    // won't have it, so fall back to the whole document body rather than a placeholder.
    const mainContent = doc.querySelector("#post-content")?.innerHTML || doc.body.innerHTML || "";
    const referencesContent = doc.querySelector("#post-references")?.innerHTML || "";

    const titleInput = window.CList.ui.view.writeTitle;
    if (titleInput) titleInput.value = titleContent;

    const referencesDiv = document.getElementById("writeReferences");
    if (referencesDiv) referencesDiv.innerHTML = referencesContent;

    return { type: mimeType, value: mainContent, page };
}

// Save

// Collects data from Write pane and packages it to save as a file or post

async function packagePost() {
    // Get title

    const titleValue = window.CList.ui.view.writeTitle.innerText;

    // Get editor content
    const handler = editorHandlers[currentEditor];
    let contentValue;
    if (handler && typeof handler.getContent === 'function') {
        contentValue = await handler.getContent(); // Assign value to the variable
    } else {
        console.error("Unable to initialize content editor handler for write");
        showErrorModal('Write error — could not read editor content.', { title: 'Write Error' });
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



(function () {
    window.CList.loaders = window.CList.loaders || [];
    window.CList.loaders.push({
        label: 'Load from file',
        icon:  'upload_file',
        load:  async () => await loadFile()
    });
})();

(function () {
    window.CList.savers = window.CList.savers || [];
    window.CList.savers.push({
        label: 'Save to local file',
        icon:  'save',
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

async function saveContent() {

    // A loaded file (kind: 'file') with no references round-trips as raw,
    // unwrapped content under its exact original filename — same rule as the
    // Dropbox saver (js/dropbox.js). Anything else still gets packagePost()'s
    // HTML wrapper.
    const isRawFileRoundTrip = currentLoadedPage?.kind === 'file' && getReferences().length === 0;
    const content = isRawFileRoundTrip
        ? await editorHandlers[currentEditor]?.getContent?.()
        : await packagePost();
    const fileContent = String(content); // Ensure content is treated as a string
    const suggestedName = isRawFileRoundTrip ? currentLoadedPage.title : undefined;

    const loggedIn = !!(window.CList.state && window.CList.state.username);
    let targetId = null;

    // If the resource is already identified (by urn:uuid), record the local
    // save against its existing kvstore index entry — minting one now if it's
    // never been indexed before. Not logged in: no kvstore to index into, so
    // skip straight to the file write with no identity tracking at all.
    if (loggedIn) {
        const titleValue = window.CList.ui.view.writeTitle.innerText.trim();
        const now = new Date().toISOString();

        if (currentLoadedPage && currentLoadedPage.id && currentLoadedPage.pageKey) {
            try {
                const touched = await _touchOrForkWebPageRecord(currentLoadedPage.pageKey, currentLoadedPage.id, {
                    savedLocally: true,
                    savedLocallyAt: now,
                });
                targetId = touched.id;
                currentLoadedPage.id = touched.id;
                currentLoadedPage.pageKey = touched.pageKey;
                if (touched.forked) {
                    showStatusMessage('This page was authored by someone else — saved locally as a new, derived copy in My Pages.');
                }
            } catch (e) {
                console.error('[saveContent] failed to update page record', e);
                showErrorModal('Saved locally, but could not update My Pages: ' + e.message, { title: 'My Pages Update Failed' });
            }
        } else {
            targetId = `urn:uuid:${crypto.randomUUID()}`;
            // A raw file round-trip keeps its own kind/title/mimeType (the
            // filename and its real content type) when indexed — it's still the
            // same loaded file, just now also tracked in My Pages. Anything else
            // (fresh content with no prior identity) is indexed as the HTML
            // 'page' it's actually being saved as.
            const indexTitle    = isRawFileRoundTrip ? currentLoadedPage.title : titleValue;
            const indexMimeType = isRawFileRoundTrip
                ? ((editorHandlers[currentEditor]?.contentTypes || [])[0] || 'text/plain')
                : 'text/html';
            try {
                const pageKey = await _saveWebPageRecord({
                    id: targetId,
                    title: indexTitle,
                    mimeType: indexMimeType,
                    authorDid: _currentAuthorDid(),
                    savedLocally: true,
                    savedLocallyAt: now,
                });
                setLoadedPage({
                    kind: isRawFileRoundTrip ? 'file' : 'page',
                    pageKey,
                    id: targetId,
                    format: isRawFileRoundTrip ? (indexMimeType.split('/')[1] || '').toUpperCase() : 'HTML',
                    title: indexTitle,
                    mimeType: indexMimeType,
                    authorDid: _currentAuthorDid(),
                    savedLocally: true,
                    savedLocallyAt: now,
                });
            } catch (e) {
                console.error('[saveContent] failed to index page record', e);
                showErrorModal('Saved locally, but could not index in My Pages: ' + e.message, { title: 'My Pages Indexing Failed' });
            }
        }
    }

    await _writeLocalFile(fileContent, targetId, suggestedName);
}

async function _writeLocalFile(fileContent, id, suggestedName) {
    const name = suggestedName || "content.txt";
    const ext  = (name.match(/\.([^./]+)$/)?.[1] || 'txt').toLowerCase();
    if (window.showSaveFilePicker) {
        // Modern Browsers: File System Access API
        try {
            let fileHandle = id ? _localFileHandles[id] : null;
            if (fileHandle) {
                // Permission can be revoked by the browser after inactivity —
                // re-request it before reusing a cached handle.
                const granted = await fileHandle.queryPermission({ mode: 'readwrite' }) === 'granted'
                    || await fileHandle.requestPermission({ mode: 'readwrite' }) === 'granted';
                if (!granted) fileHandle = null;
            }
            if (!fileHandle) {
                fileHandle = await window.showSaveFilePicker({
                    suggestedName: name,
                    types: [{ description: "Text Files", accept: { "text/plain": ['.' + ext] } }]
                });
                if (id) _localFileHandles[id] = fileHandle;
            }

            const writableStream = await fileHandle.createWritable();
            await writableStream.write(fileContent);
            await writableStream.close();
            showStatusMessage('File saved successfully.');
        } catch (err) {
            if (err.name !== 'AbortError') {
                console.error("Save failed:", err);
                showErrorModal('Save failed: ' + err.message, { title: 'Save Failed' });
            }
        }
    } else {
        // Fallback for Unsupported Browsers (e.g. Firefox, which doesn't implement
        // showSaveFilePicker) — a plain Blob download. The browser's own download
        // manager decides whether to rename on conflict; there's no API here to
        // control or override that.
        fallbackDownload(fileContent, name);
    }
}

function fallbackDownload(fileContent, suggestedName) {
    // Prompt user for a filename
    const fileName = prompt("Enter a file name:", suggestedName || "content.txt");
    if (!fileName) return; // Exit if the user cancels or doesn't provide a name

    const blob = new Blob([fileContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);

    // Create a temporary download link
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();

    URL.revokeObjectURL(url); // Clean up
    showStatusMessage('File downloaded — check your downloads folder.');
}

