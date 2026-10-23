//  etherpad.js  -  helper and utility functions for Etherpad API
//  Part of CList, the next generation of learning and connecting with your community
//
//  Version version 0.1 created by Stephen Downes on January 27, 2025
//
//  Copyright Stephen Downes 2025
//  Licensed under Creative Commons Attribution 4.0 International https://creativecommons.org/licenses/by/4.0/
//
//  This software carries NO WARRANTY OF ANY KIND.
//  This software is provided "AS IS," and you, its user, assume all risks when using it.

window.CList.schemas = window.CList.schemas || {};
window.CList.schemas['Etherpad'] = {
    type: 'Etherpad',
    instanceFromKey: true,
    kvKey: { label: 'Etherpad API URL', placeholder: 'https://etherpad.example.com/api/1.2.15' },
    fields: [
        { key: 'title',       label: 'Title',           editable: true, inputType: 'text', placeholder: 'My Etherpad',                                default: '' },
        { key: 'permissions', label: 'Permissions',     editable: true, inputType: 'text', placeholder: 'e',                                          default: 'e' },
        { key: 'id',          label: 'Proxy Server URL',editable: true, inputType: 'text', placeholder: 'https://www.downes.ca/cgi-bin/proxyp.cgi',   default: '' },
    ]
};
// 


const proxyUrl = 'https://proxyp.mooc.ca';

// The proxyp.mooc.ca relay requires a valid kvstore Bearer token on every request —
// read it the same way every other service integration in this codebase does.
function proxyAuthHeader() {
    const token = getSiteSpecificCookie(window.CList.config.flaskSiteUrl, window.CList.keys.ACCESS_TOKEN);
    return token ? { 'Authorization': `Bearer ${token}` } : {};
}

// The specific Etherpad account (parsed kvstore entry) currently active in the editor,
// set by the handler's initialize() and used by callEtherpadApi() — so API calls target
// the account the user actually selected, not just "the first Etherpad account found".
let currentEtherpadAccount = null;

// The web origin of a third-party Etherpad server the user is connected to as a guest
// (no account, no API key) — e.g. "https://pad.gattini.ninja". Mutually exclusive with
// currentEtherpadAccount: exactly one of the two represents "where is this pad hosted".
let currentEtherpadGuestBase = null;

// Derive a pad's web (browser/iframe) URL from whichever connection is currently active —
// the guest base URL if connected to a third-party pad, otherwise the active account's API
// base URL, e.g. "https://etherpad.example.com/api/1.2.15" -> ".../p/<padName>". This lets
// pad links/iframes point at whichever server is actually in play, so people on different
// Etherpad servers — including ones the user has no account on — can still share and
// co-edit a pad.
function etherpadPadUrl(padName) {
    if (currentEtherpadGuestBase) {
        return `${currentEtherpadGuestBase}/p/${padName}`;
    }
    const apiBase = currentEtherpadAccount?.instance;
    if (!apiBase) {
        showStatusMessage('No Etherpad connection active — cannot build a pad URL.');
        return null;
    }
    const webBase = apiBase.replace(/\/api\/[^/]+\/?$/, '');
    return `${webBase}/p/${padName}`;
}

(function () {

    const etherpadHandler = {
        label: 'Etherpad',
        icon: 'group',
        contentTypes: ['text/html', 'text/plain'],
        requiresAccount: true,
        // Resumable even without a saved account — a live guest session counts as "active"
        // so the switcher can offer a way back into it (see editors.js's isActive() contract).
        isActive: () => !!(currentEtherpadGuestBase || currentEtherpadAccount),
        initialize: async (account) => {

            currentEditor = 'etherpad';

            const writePaneContent = window.CList.ui.view.writePaneContent;
            let etherpadDiv = document.getElementById('etherpadDiv');

            // Resume an already-active connection instead of rebuilding from scratch — this is
            // what lets a guest pad connection (or a selected account's pad) survive switching
            // to another editor and back, instead of forcing the address to be re-entered.
            // A live guest session always wins (guest mode is account-independent, so a
            // mismatched/stale account argument shouldn't blow it away); otherwise resume when
            // no specific account was requested, or the requested account matches the active one.
            const isSameAccount = account && currentEtherpadAccount
                && account.instance === currentEtherpadAccount.instance
                && account.id === currentEtherpadAccount.id;
            if (etherpadDiv && (currentEtherpadGuestBase || !account || isSameAccount)) {
                etherpadDiv.style.display = 'block';
                return;
            }

            currentEtherpadAccount = account || null;
            currentEtherpadGuestBase = null; // own-account and guest connections are mutually exclusive

            // HTML elements for Etherpad editor
            let etherpadHTML = `<!-- Pad List Section -->
            <div id="padListSection">
                <h2>Existing Pads</h2>
                <div id="padList" style="border: 1px solid #ccc; padding: 10px; min-height: 100px;"></div>
                <br>
                <div>
                    <label for="newPadName">Create a New Pad: </label>
                    <input type="text" id="newPadName" placeholder="Enter a new pad name">
                    <button onclick="createAndLoadEtherpad()">Create and Load</button>
                </div>
                <br>
                <div id="thirdPartyEtherpadSection">
                    <h3>Connect to a Third-Party Etherpad</h3>
                    <p class="feed-status-message">Open a pad on someone else's Etherpad server. You usually
                        won't have an API key for it, so only the pad itself loads — the pad list and
                        content-sync features above aren't available for a guest connection.</p>
                    <label for="thirdPartyEtherpadUrl">Server address: </label>
                    <input type="text" id="thirdPartyEtherpadUrl" placeholder="https://pad.example.com/">
                    <br>
                    <label for="thirdPartyEtherpadPad">Pad name: </label>
                    <input type="text" id="thirdPartyEtherpadPad" placeholder="their-pad-name">
                    <button onclick="connectToThirdPartyEtherpadFromForm()">Connect</button>
                </div>
            </div>

            <!-- Pad Content Section -->
            <div id="padContentSection" style="display: none;">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
                    <h2 id="currentPadName" style="margin: 0;">Pad Name</h2>
                    <button onclick="sharePad()" style="padding: 5px 10px;">Share</button>
                </div>
                <iframe id="padIframe" style="width: 100%; height: 80vh; border: 1px solid #ccc;"></iframe>
                <br>
                <div style="display: flex; align-items: center; justify-content: center; gap: 10px;">
                    <button onclick="showPadList()" style="margin-left: 10px;">Select Pad</button>
                </div>
            </div>

            <!-- Pad Share Section  -->;
            <div id="padShareSection" style="display: none;">
                <h2>Share</h2>
                
            </div>`;

            padName = ''; // Global pad name
            authorID = ''; // Global author ID
            etherpadUsername = 'exampleUser'; // Will be replaced with the actual username

            // etherpadDiv/writePaneContent declared above — create the div if it doesn't exist
            if (!etherpadDiv) {
                etherpadDiv = document.createElement('div');
                etherpadDiv.id = 'etherpadDiv';
                writePaneContent.appendChild(etherpadDiv);

            }

            etherpadDiv.style.display = 'block';  // Show the editor
            etherpadDiv.innerHTML = etherpadHTML;


            if (currentEtherpadAccount) {
                listAllEtherpads();
            } else {
                const padListDiv = document.getElementById('padList');
                if (padListDiv) {
                    padListDiv.innerText = 'No Etherpad account selected — connect to a specific ' +
                        'pad below, or choose an account from the editor switcher.';
                }
            }
            showPadList();

            // User clicks on a pad link that calls initializeEtherpad(padName)


        },
        
        getContent: async () => {
            response = await callEtherpadApi('getHTML', { padID: padName });
            return response.html;
        },
        
        loadContent: async ({ type, value }, itemId) => {
            const itemContent = value;

            if (!padName) {
                alert('Pad or author information is missing. Please select or create a pad.');
                return;
            }

            if (currentEtherpadGuestBase) {
                // Guest pad — no API key, so there's no getHTML/setHTML. Read the pad's
                // current content via the proxy's GET relay, append the new content, and
                // write the merged result back via Etherpad's own /import endpoint
                // (which replaces the whole pad, hence reading first rather than just
                // overwriting with itemContent alone).
                try {
                    const existingHtml = await fetchGuestPadHtml(currentEtherpadGuestBase, padName);
                    const newHtmlContent = `<body>${existingHtml}${itemContent}</body>`;
                    await importPadViaRelay(currentEtherpadGuestBase, padName, newHtmlContent);
                    console.log("HTML content imported into guest pad successfully.");
                } catch (error) {
                    console.error("Error writing content into guest Etherpad pad:", error);
                    showStatusMessage(isEtherpadConnectionError(error)
                        ? 'Cannot connect to Etherpad server.'
                        : 'Error writing content to the pad. Please check the console for more details.');
                }

                if (itemId) {
                    const editorDiv = document.getElementById('etherpadDiv');
                    const reference = createReference(itemId, editorDiv);
                    displayCurrentReference(reference, editorDiv);
                    displayReferences(editorDiv);
                }
                return;
            }

            if (!authorID) {
                alert('Pad or author information is missing. Please select or create a pad.');
                return;
            }

            // Etherpad doesn't support appendHTML as an API method, so we extract
            // the current HTML content, append new content, and set the HTML content
            try {

                // Make the API call to get the pad content and append the new content
                const response = await callEtherpadApi('getHTML', { padID: padName });
                const content = response.html;
                const newHtmlContent = `<body>${content}${itemContent}</body>`;

                // the updated HTML content back to the pad
                await callEtherpadApi('setHTML', { padID: padName, html: newHtmlContent });

                console.log("HTML content appended successfully.");
            } catch (error) {
                console.error("Error appending HTML content to Etherpad:", error);
                showStatusMessage(isEtherpadConnectionError(error)
                    ? 'Cannot connect to Etherpad server.'
                    : 'Error appending content to Etherpad. Please check the console for more details.');
            }
   
            // Add to references
            if (itemId) {
                const editorDiv = document.getElementById('etherpadDiv');
                const reference = createReference(itemId, editorDiv);
                displayCurrentReference(reference, editorDiv);
                displayReferences(editorDiv);
            }
        }

    };

    // Add the handler to editorHandlers
    if (typeof editorHandlers !== 'undefined') {
        editorHandlers.etherpad = etherpadHandler;
    } else {
        console.error("editorHandlers object is not defined.");
    }

})();



// Utility function to make API calls through the proxy
async function callEtherpadApi(endpoint, params) {

    // Use the Etherpad account selected via the editor switcher (set in
    // etherpadHandler.initialize()) — not just "the first Etherpad account found" —
    // so API calls target the instance the user actually picked.
    if (!currentEtherpadAccount) {
        showStatusMessage('No Etherpad account selected.');
        throw new Error('No Etherpad account selected.');
    }
    const { instance: etherpadBaseUrl, id: etherpadId } = currentEtherpadAccount;

    params.url = `${etherpadBaseUrl}/${endpoint}`;
    params.apikey = etherpadId;

    const response = await fetch(proxyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...proxyAuthHeader() },
        body: new URLSearchParams(params),
    });

    if (!response.ok) {
        console.error(`Etherpad API request failed: ${response.statusText}`);
        throw new Error(`Etherpad API request failed: ${response.statusText}`);
    }

    const result = await response.json();
    console.log(`Response from ${endpoint}:`, result); // Log raw response

    // The proxy always answers with HTTP 200, reporting its own failure to reach the
    // target Etherpad server (e.g. the server no longer exists) as a 200 + {error} body
    // rather than a non-2xx status — so that case must be checked explicitly here, or it
    // silently falls through as a successful-but-empty result to the caller.
    if (result && result.error) {
        console.error(`Etherpad API error in ${endpoint}:`, result.error);
        throw new Error(result.error);
    }

    if (result) {
        // If result.data is null, return the entire result instead
        return result.data !== null ? result.data : result;
    } else {
        console.error(`Etherpad API error in ${endpoint}: No result returned.`);
        throw new Error(result ? result.message : 'Unknown error');
    }

}

// Is this error the proxy reporting that it could not reach the target Etherpad server
// at all (e.g. the instance no longer exists), as opposed to some other API-level failure?
function isEtherpadConnectionError(error) {
    return /can't connect to/i.test(error.message);
}

// Update etherpadUsername and reset the authorID
async function setUserName() {
    const userNameInput = document.getElementById('userNameInput');
    const newUserName = userNameInput.value.trim();

    if (!newUserName) {
        showStatusMessage('Please enter a valid name.');
        return;
    }

    try {
        // Update the username globally
        window.etherpadUsername = newUserName;

        // Retrieve the associated authorID
        authorID = await getAuthorId(etherpadUsername);

        showStatusMessage(`Name set to: ${newUserName}`);
        console.log(`Updated author ID for ${newUserName}: ${authorID}`);
    } catch (error) {
        console.error('Error setting user name:', error);
        showStatusMessage(isEtherpadConnectionError(error)
            ? 'Cannot connect to Etherpad server.'
            : 'Error setting name: ' + error.message);
    }

    // Clear input field
    userNameInput.value = '';
}

// Create or retrieve the unique author ID
async function getAuthorId(username) {
    const data = await callEtherpadApi('createAuthorIfNotExistsFor', {
        name: username,
        authorMapper: username,
    });
    return data.authorID;
}


async function initializeEtherpad() {
    const initialContent = "Welcome to your new Etherpad document!\n\nThis content was dynamically added via the API.";
    try {
        // Step 0: Do I have some content I specifically want to load? 


        // Step 1: Get or create the author ID
        etherpadUsername = getSiteSpecificCookie(window.CList.config.flaskSiteUrl, window.CList.keys.USERNAME);
        if (!etherpadUsername) { etherpadUsername = 'user' + Math.floor(Math.random() * 1000); }
        authorID = await getAuthorId(etherpadUsername);
        console.log('Author ID:', authorID);

        // Step 2: Create Pad
        // (Let a genuine failure here — e.g. the server being unreachable — propagate to
        // the outer catch, rather than swallowing it and falling through to the generic
        // "Unexpected response" error below, which would mask the real cause.)
        const createPadData = await callEtherpadApi('createPad', { padID: padName });
        console.log('Pad creation response:', createPadData);

        // Handle createPad response
        if (createPadData && createPadData.code === 0) {
            console.log('Pad created successfully.');
            // Step 3: Set Initial Content
            try {
                await callEtherpadApi('setText', {
                    padID: padName,
                    text: initialContent,
                });
                loadPredefinedContent('etherpad');
                console.log('Initial content set successfully.');
            } catch (error) {
                console.error('Failed to set initial content:', error);
                showStatusMessage(isEtherpadConnectionError(error)
                    ? 'Cannot connect to Etherpad server.'
                    : 'Failed to set initial pad content. Please check the console for more details.');
            }

        } else if (createPadData && createPadData.code === 1) {
            console.log('Pad already exists:', padName);
            loadPredefinedContent('etherpad');

        } else {
            throw new Error('Failed to create pad: Unexpected response.');
        }

        // Step 4: Display Etherpad in iframe
        const iframe = document.getElementById('padIframe');
        iframe.src = etherpadPadUrl(padName);
        // showPadContent();
        // Show pad name in the interface
        const currentPadNameDiv = document.getElementById('currentPadName');
        currentPadNameDiv.textContent = `${etherpadUsername}: ${padName}`;
        //listAllEtherpads(); // Refresh the pad list



    } catch (error) {
        console.error('Error initializing pad:', error);
        showStatusMessage(isEtherpadConnectionError(error)
            ? 'Cannot connect to Etherpad server.'
            : 'Error initializing pad. Please check the console for more details.');
    }
}

// Connect to a pad on a third-party Etherpad server the user has no account on. Loads the
// pad directly into the iframe via its public web URL — there is no API key for this
// connection, so none of the API-backed features (pad list, append/extract content, author
// ID) are available; Etherpad's own pad page handles viewing/editing and will create the
// pad on the fly if it doesn't already exist (assuming the server allows that).
function connectToThirdPartyEtherpad(baseUrl, padNameToLoad) {
    currentEtherpadAccount = null;
    currentEtherpadGuestBase = baseUrl.replace(/\/+$/, '');
    padName = padNameToLoad;
    authorID = '';

    const iframe = document.getElementById('padIframe');
    iframe.src = etherpadPadUrl(padName);
    const currentPadNameDiv = document.getElementById('currentPadName');
    currentPadNameDiv.textContent = `Guest: ${padName}`;
    showPadContent();
}

// Read the "Connect to a Third-Party Etherpad" form and connect using its values.
function connectToThirdPartyEtherpadFromForm() {
    const urlInput = document.getElementById('thirdPartyEtherpadUrl').value.trim();
    const padInput = document.getElementById('thirdPartyEtherpadPad').value.trim();

    if (!urlInput || !padInput) {
        showStatusMessage('Please enter both a server address and a pad name.');
        return;
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(padInput)) {
        showStatusMessage('Pad names can only contain letters, numbers, underscores, and dashes.');
        return;
    }

    let origin;
    try {
        origin = new URL(urlInput).origin;
    } catch (error) {
        showStatusMessage('That does not look like a valid URL.');
        return;
    }

    connectToThirdPartyEtherpad(origin, padInput);
}

// Fetch a guest pad's current content via Etherpad's own /export/html endpoint, relayed
// through the proxy's GET passthrough (not the account API — there is no API key here).
async function fetchGuestPadHtml(baseUrl, padNameToLoad) {
    const exportUrl = `${baseUrl}/p/${padNameToLoad}/export/html`;
    const response = await fetch(`${proxyUrl}?url=${encodeURIComponent(exportUrl)}`, {
        method: 'GET',
        headers: proxyAuthHeader(),
    });

    if (!response.ok) {
        throw new Error(`Export relay request failed: ${response.statusText}`);
    }

    const text = await response.text();

    // The proxy reports its own failures as a 200 + JSON {"error": ...} body rather than
    // a non-2xx status (same as the account API calls above) — exported pad HTML will
    // never itself parse as a JSON object, so that's the signal a failure happened here.
    try {
        const maybeError = JSON.parse(text);
        if (maybeError && typeof maybeError === 'object' && maybeError.error) {
            throw new Error(maybeError.error);
        }
    } catch (parseError) {
        if (parseError instanceof SyntaxError) {
            return text; // not JSON — this is the real exported HTML
        }
        throw parseError;
    }

    return text;
}

// Write content into a guest pad via Etherpad's own /import endpoint, relayed through the
// proxy as a multipart file upload. Unlike setHTML (account mode), import REPLACES the
// pad's entire content, so callers must read the current content first (see
// fetchGuestPadHtml) and merge it themselves before calling this.
async function importPadViaRelay(baseUrl, padNameToLoad, htmlContent) {
    const importUrl = `${baseUrl}/p/${padNameToLoad}/import`;
    const formData = new FormData();
    formData.append('url', importUrl);
    formData.append('file', new Blob([htmlContent], { type: 'text/html' }), 'content.html');

    const response = await fetch(proxyUrl, {
        method: 'POST',
        headers: proxyAuthHeader(),
        body: formData,
    });

    if (!response.ok) {
        throw new Error(`Import relay request failed: ${response.statusText}`);
    }

    const result = await response.json();
    if (result && result.error) {
        throw new Error(result.error);
    }
    return result;
}


// Example: Embed the pad in an iframe with session context
function embedPadWithSession(padId, sessionId) {
    document.cookie = `sessionID=${sessionId}; path=/`;
    const iframe = document.getElementById('padIframe');
    iframe.src = etherpadPadUrl(padId);
}

// Switch between pad list and pad content views
function showPadList() {
    document.getElementById('padListSection').style.display = 'block';
    document.getElementById('padContentSection').style.display = 'none';
}

function showPadContent() {
    document.getElementById('padListSection').style.display = 'none';
    document.getElementById('padContentSection').style.display = 'block';
}

// Create and load a new pad
function createAndLoadEtherpad(passedPadName) {
    const padNameInput = document.getElementById('newPadName');
    const newPadName = passedPadName?.trim() || padNameInput.value.trim();


    if (!newPadName) {
        alert('Please enter a pad name.');
        return;
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(newPadName)) {
        alert('Pad names can only contain letters, numbers, underscores, and dashes.');
        return;
    }

    padName = newPadName;
    initializeEtherpad();
    showPadContent();
    padNameInput.value = ''; // Clear input field after submission
}

// List all existing pads
async function listAllEtherpads() {
    try {
        const listPadsData = await callEtherpadApi('listAllPads', {});
        const pads = listPadsData.padIDs;
        console.log('Existing Pads:', pads);

        const padListDiv = document.getElementById('padList');
        padListDiv.innerHTML = '';
        if (pads.length === 0) {
            padListDiv.innerText = 'No pads found.';
        } else {
            const ul = document.createElement('ul');
            pads.forEach(pad => {
                const li = document.createElement('li');
                const link = document.createElement('a');
                link.href = '#';
                link.innerText = pad;
                link.onclick = (event) => {
                    event.preventDefault();
                    padName = pad;
                    initializeEtherpad();
                    showPadContent();
                };
                li.appendChild(link);
                ul.appendChild(li);
            });
            padListDiv.appendChild(ul);
        }
    } catch (error) {
        console.error('Error listing pads:', error);
        if (isEtherpadConnectionError(error)) {
            showStatusMessage('Cannot connect to Etherpad server.');
        } else {
            showStatusMessage('Error listing pads. Please check the console for more details.');
        }
    }
}


async function appendEtherpadContent() {
    try {
        const textareaContent = document.getElementById('inputContent').value;

        if (!textareaContent.trim()) {
            alert('Please enter some content to append.');
            return;
        }

        // Ensure padName and authorID are available
        if (!padName || !authorID) {
            alert('Pad or author information is missing. Please select or create a pad.');
            return;
        }

        // Append text to the Etherpad document
        const response = await callEtherpadApi('appendText', {
            padID: padName,
            text: textareaContent,
            authorID: authorID, // Associate content with the current author
        });

        console.log('Content appended successfully:', response);
        alert('Content appended successfully!');
    } catch (error) {
        console.error('Error appending content:', error);
        showStatusMessage(isEtherpadConnectionError(error)
            ? 'Cannot connect to Etherpad server.'
            : 'Error appending content. Please check the console for more details.');
    }
}

async function extractEtherpadContent(format) {
    try {
        // Validate the input format
        if (format !== 'html' && format !== 'text') {
            throw new Error('Invalid format specified. Use "html" or "text".');
        }

        // Make the API call to get the pad content
        const endpoint = format === 'html' ? 'getHTML' : 'getText';
        const response = await callEtherpadApi(endpoint, { padID: padName });

        // Extract the content from the response
        const content = format === 'html' ? response.html : response.text;

        // Log or process the content as needed
        console.log(`Extracted ${format.toUpperCase()} Content:`, content);

        // Return the content for further processing
        return content;
    } catch (error) {
        console.error('Error extracting pad content:', error);
        showStatusMessage(isEtherpadConnectionError(error)
            ? 'Cannot connect to Etherpad server.'
            : 'Error extracting pad content. Please check the console for more details.');
        return null;
    }
}

async function handleExtractContent() {
    const formatSelect = document.getElementById('formatSelect');
    const format = formatSelect.value; // Get selected format (text or html)

    try {
        // Call the extract function
        const content = await extractEtherpadContent(format);

        if (content) {
            // Display the extracted content in the text area
            const textArea = document.getElementById('extractedContent');
            textArea.value = content;
        } else {
            showStatusMessage('Failed to extract content. Please try again.');
        }
    } catch (error) {
        console.error('Error extracting content:', error);
        showStatusMessage('Error extracting content: ' + error.message);
    }
}

function sharePad() {

    const padUrl = etherpadPadUrl(padName);
    if (!padUrl) return;

    let padMsg;
    if(window.document.getElementById('chat-messages')) {
        if (connections && Object.keys(connections).length > 0) {
            sendMessage("Hello from Etherpad. Your actual discussion is "+activeDiscussionName+" and the pad is "+padName+" '"+padUrl+"'");
            padMsg = "Pad named "+padName+" have been shared in the chat discussion "+activeDiscussionName;
        } else {
            padMsg = "There is no active chat discussion. If you are in an active discussion the pad "+
                padName+" would be shared in that discussion";
        }
    }

    const content = "To share this pad, provide the following URL<br>"+
        padUrl+"<br><br>"+padMsg;
    showModal(content)



}

// Open a pad shared by someone else in chat — a link to a specific pad on their
// Etherpad server, which the user normally has no account or API key for. Connects as a
// guest (see connectToThirdPartyEtherpad) rather than trying to use the current/own
// Etherpad account's API, which would target the wrong server entirely.
async function showPadShare(link) {
    const match = link.match(/^(https?:\/\/[^/]+)\/p\/([^/]+)\/?$/);
    if (!match) {
        showStatusMessage('Could not parse the shared Etherpad link.');
        return;
    }
    const [, sharedBaseUrl, sharedPadName] = match;

    try {
        await initializeEditor('etherpad', null);
        connectToThirdPartyEtherpad(sharedBaseUrl, sharedPadName);
    } catch (error) {
        console.error('Error opening shared pad:', error);
        showStatusMessage('Error opening shared pad. Please check the console for more details.');
    }
}
            // document.addEventListener('DOMContentLoaded', listAllEtherpads);


