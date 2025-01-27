//  etherpad.js  -  helper and utility functions for Etherpad API
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


const proxyUrl = 'https://www.downes.ca/cgi-bin/proxyp.cgi';
const etherpadBaseUrl = 'https://etherpad.cloudron.downes.ca/api/1.2.15';
let padName = ''; // Global pad name
let authorID = ''; // Global author ID
let etherpadUsername = 'exampleUser'; // Will be replaced with the actual username

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

// Utility function to make API calls through the proxy
async function callEtherpadApi(endpoint, params) {
    params.url = `${etherpadBaseUrl}/${endpoint}`;
    //params.apikey = apiKey;

    const response = await fetch(proxyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(params),
    });

    if (!response.ok) {
        console.error(`Etherpad API request failed: ${response.statusText}`);
        throw new Error(`Etherpad API request failed: ${response.statusText}`);
    }

    const result = await response.json();
    console.log(`Response from ${endpoint}:`, result); // Log raw response

    if (result) {
        // If result.data is null, return the entire result instead
        return result.data !== null ? result.data : result;
    } else {
        console.error(`Etherpad API error in ${endpoint}: No result returned.`);
        throw new Error(result ? result.message : 'Unknown error');
    }

}

// Update etherpadUsername and reset the authorID
async function setUserName() {
    const userNameInput = document.getElementById('userNameInput');
    const newUserName = userNameInput.value.trim();

    if (!newUserName) {
        alert('Please enter a valid name.');
        return;
    }

    try {
        // Update the username globally
        window.etherpadUsername = newUserName;

        // Retrieve the associated authorID
        authorID = await getAuthorId(etherpadUsername);

        alert(`Your name has been set to: ${newUserName}. You can now create or edit pads.`);
        console.log(`Updated author ID for ${newUserName}: ${authorID}`);
    } catch (error) {
        console.error('Error setting user name:', error);
        alert('Error setting your name. Please check the console for more details.');
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
        etherpadUsername = getSiteSpecificCookie(flaskSiteUrl, 'username');
        if (!etherpadUsername) { etherpadUsername = 'user' + Math.floor(Math.random() * 1000); }
        authorID = await getAuthorId(etherpadUsername);
        console.log('Author ID:', authorID);

        // Step 2: Create Pad
        let createPadData = null;
        try {
            createPadData = await callEtherpadApi('createPad', { padID: padName });
            console.log('Pad creation response:', createPadData);
        } catch (error) {
            console.warn('createPad API call failed:', error);
        }

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
            }

        } else if (createPadData && createPadData.code === 1) {
            console.log('Pad already exists:', padName);
            loadPredefinedContent('etherpad');

        } else {
            throw new Error('Failed to create pad: Unexpected response.');
        }

        // Step 4: Display Etherpad in iframe
        const iframe = document.getElementById('padIframe');
        iframe.src = `https://etherpad.cloudron.downes.ca/p/${padName}`;
        // showPadContent();
        // Show pad name in the interface
        const currentPadNameDiv = document.getElementById('currentPadName');
        currentPadNameDiv.textContent = `${etherpadUsername}: ${padName}`;
        //listAllEtherpads(); // Refresh the pad list



    } catch (error) {
        console.error('Error initializing pad:', error);
        alert('Error initializing pad. Please check the console for more details.');
    }
}


// Example: Embed the pad in an iframe with session context
function embedPadWithSession(padId, sessionId) {
    document.cookie = `sessionID=${sessionId}; path=/; domain=cloudron.downes.ca`;
    const iframe = document.getElementById('padIframe');
    iframe.src = `https://etherpad.cloudron.downes.ca/p/${padId}`;
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
        alert('Error listing pads. Please check the console for more details.');
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
        alert('Error appending content. Please check the console for more details.');
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
        alert('Error extracting pad content. Please check the console for more details.');
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
            alert('Failed to extract content. Please try again.');
        }
    } catch (error) {
        console.error('Error extracting content:', error);
        alert('An error occurred while extracting the content. Check the console for more details.');
    }
}

function sharePad() {

    let padMsg;
    if(window.document.getElementById('chat-messages')) {
        if (connections && Object.keys(connections).length > 0) {
            sendMessage("Hello from Etherpad. Your actual discussion is "+activeDiscussionName+" and the pad is "+padName+" 'https://etherpad.cloudron.downes.ca/p/"+padName+"'");
            padMsg = "Pad named "+padName+" have been shared in the chat discussion "+activeDiscussionName;
        } else {
            padMsg = "There is no active chat discussion. If you are in an active discussion the pad "+
                padName+" would be shared in that discussion";
        }
    }

    const content = "To share this pad, provide the following URL<br>"+
        'https://etherpad.cloudron.downes.ca/p/'+padName+"<br><br>"+padMsg;
    showModal(content)

    

}   

async function showPadShare(link) {


    const match = link.match(/\/p\/([^/]+)$/);
    const padName = match ? match[1] : null;
    alert(`Opening pad: ${padName}`);
    try {
        initializeEditor('etherpad');
        await createAndLoadEtherpad(padName);

        createPadData = await callEtherpadApi('createPad', { padID: padName });
        initializeEtherpad();
        showPadContent();
        console.log('Pad creation response:', createPadData);
    } catch (error) {
        console.warn('createPad API call failed:', error);
    }


}
            // document.addEventListener('DOMContentLoaded', listAllEtherpads);


