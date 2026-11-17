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
    fileMetadata = null
} = {}) {
    // Get title

    const titleValue = title ?? window.CList.ui.view.writeTitle.innerText;

    // Get editor content
    const handler = editorHandlers[currentEditor];
    let contentValue;
    try {
        if (forPublishing && typeof handler?.getPostContent === 'function') contentValue = await handler.getPostContent();
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

async function saveContent() {

    // A loaded file (kind: 'file') with no references round-trips as raw,
    // unwrapped content under its exact original filename — same rule as the
    // Dropbox saver (js/dropbox.js). Anything else still gets packagePost()'s
    // HTML wrapper.
    const handler = editorHandlers[currentEditor];
    const isNativeFile = !!handler?.fileExtension;
    const isRawFileRoundTrip = isNativeFile || (currentLoadedPage?.kind === 'file' && getReferences().length === 0);
    let content, nativeType = null;
    if (typeof handler?.getFileContent === 'function') {
        const native = await handler.getFileContent();
        content = native.value; nativeType = native.type;
    } else if (isRawFileRoundTrip) content = await handler.getContent();
    else content = await packagePost({ fileMetadata: {
        format: 'clist-post-v1', editor: currentEditor,
        title: window.CList.ui.view.writeTitle?.textContent || '', references: structuredClone(getReferences()),
    } });
    if (content == null) return;
    const fileContent = String(content);
    const suggestedName = nativeType
        ? (currentLoadedPage?.kind === 'file' ? currentLoadedPage.title : 'annotation.json')
        : isNativeFile
            ? (currentLoadedPage?.kind === 'file' ? currentLoadedPage.title : 'presentation.' + handler.fileExtension)
            : (isRawFileRoundTrip ? currentLoadedPage.title : undefined);

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
            const indexTitle    = isRawFileRoundTrip ? suggestedName : titleValue;
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
    // Ask for a filename via the app's own modal — prompt() is banned project-wide.
    const input = document.createElement('input');
    input.type = 'text';
    input.value = suggestedName || 'content.txt';
    input.style.width = '100%';

    const doDownload = (close) => {
        const fileName = input.value.trim();
        if (!fileName) return;

        downloadBlob(new Blob([fileContent], { type: "text/plain" }), fileName);
        close();
        showStatusMessage('File downloaded — check your downloads folder.');
    };

    const { close } = buildDialogModal('Save file', input, [
        { label: 'Cancel', secondary: true, onClick: (close) => close() },
        { label: 'Save', onClick: doDownload }
    ]);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doDownload(close); });

    input.focus();
    input.select();
}

