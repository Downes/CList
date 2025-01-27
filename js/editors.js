//  editors.js  -  Functions that handle the interface with the content editor
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



// Name of the current editor

let currentEditor = 'texteditor'; // Default editor is TinyMCE 


// 

// Define handlers for each editor
//
// Usage:
//
//      const handler = editorHandlers[currentEditor];
//      if (handler && typeof handler.getContent === 'function') {
//         const content = handler.getContent();
//      }
//

const editorHandlers = {
    texteditor: {
        initialize: () => {
            currentEditor = 'texteditor';
            // alert(flaskSiteUrl);
            etherpadUsername = getSiteSpecificCookie(flaskSiteUrl, 'username');
            if (!etherpadUsername) { etherpadUsername = 'user' + Math.floor(Math.random() * 1000); }
            closeAllEditors();

            // Check whether textEditorDiv exists; if it doesn't, create it
            const writePaneContent = document.getElementById('write-pane-content');
            let textEditorDiv = document.getElementById('textEditorDiv');
            if (!textEditorDiv) {
                textEditorDiv = document.createElement('div');
                textEditorDiv.id = 'textEditorDiv';
                textEditorDiv.innerHTML = `<textarea id="text-column"></textarea>
                        <div class="currentReferences"></div>`;
                writePaneContent.appendChild(textEditorDiv);
            }
            textEditorDiv.style.display = 'block';  // Show the editor

            // Check whether <div id="texteditor-references" ...> exists; if it doesn't, create it
            let textEditorReferences = document.getElementById('texteditor-references');
            if (!textEditorReferences) {
                textEditorReferences = document.createElement('div');
                textEditorReferences.id = 'texteditor-references';
                textEditorReferences.className = 'allReferences';
                writePaneContent.parentNode.insertBefore(textEditorReferences, writePaneContent.nextSibling);
            }
            
            loadPredefinedContent('texteditor');

            // Initialize the text editor
            // This is a placeholder function
            console.log("Text editor initialized");
        },
        getContent: () => {
            const textarea = document.getElementById('text-column');
            if (!textarea) {
                console.error("Textarea with ID 'write-column' not found.");
                return ""; // Return an empty string or handle as needed
            }
            return textarea.value.trim();
        },
        loadContent: (itemContent, itemId) => {
            // Load content into the textarea

            // Remove HTML from content
            // (This is optional and we could change this)
            itemContent = cleanHTMLContent(itemContent);


            const textarea = document.getElementById('text-column');
            if (textarea) {
                // Get the current selection start position
                const cursorPosition = textarea.selectionStart;
        
                // Split the text content into two parts based on the cursor position
                const textBefore = textarea.value.substring(0, cursorPosition);
                const textAfter = textarea.value.substring(cursorPosition);
        
                // Insert the new content at the cursor position
                textarea.value = textBefore + itemContent + textAfter;
        
                // Update the cursor position to after the inserted content
                const newCursorPosition = cursorPosition + itemContent.length;
                textarea.setSelectionRange(newCursorPosition, newCursorPosition);
            }
    
            // Add to references
            if (itemId) {
                const editorDiv = document.getElementById('textEditorDiv');
                const reference = createReference(itemId, editorDiv);
                displayCurrentReference(reference, editorDiv);
                displayReferences(editorDiv);
            }
        }
    },
    
    etherpad: {

        initialize: async (content) => {

            currentEditor = 'etherpad';
            closeAllEditors();

            // Check whether etherpadDiv exists; if it doesn't, create it
            const writePaneContent = document.getElementById('write-pane-content');
            let etherpadDiv = document.getElementById('etherpadDiv');   

            if (!etherpadDiv) { 
                etherpadDiv = document.createElement('div');
                etherpadDiv.id = 'etherpadDiv';
                writePaneContent.appendChild(etherpadDiv);

            }

            etherpadDiv.style.display = 'block';  // Show the editor
            etherpadDiv.innerHTML = etherpadHTML;


            listAllEtherpads();
            showPadList();
            
            // User clicks on a pad link that calls initializeEtherpad(padName)


        },
        
        getContent: async () => {
            response = await callEtherpadApi('getHTML', { padID: padName });
            return response.html;
        },
        
        loadContent: async (itemContent, itemId) => {
            
            // Ensure padName and authorID are available
            if (!padName || !authorID) {
                alert('Pad or author information is missing. Please select or create a pad.');
                return;
            }

            // Etherpad doesn's support appendHTML as an API method, so we extract
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
            }
   
            // Add to references
            if (itemId) {
                const editorDiv = document.getElementById('etherpadDiv');
                const reference = createReference(itemId, editorDiv);
                displayCurrentReference(reference, editorDiv);
                displayReferences(editorDiv);
            }
        }

    },

    quill: {
        getContent: () => {
            // Retrieve content for Quill
            return quillEditor.root.innerHTML; // Example for Quill
        }
    },
    ckeditor: {
        getContent: () => {
            // Retrieve content for CKEditor
            return CKEDITOR.instances['editor-id'].getData();
        }
    }
    // Add more editors as needed
};


// Common Editor Functions


// Set up editor selection window (write-load)

async function playEditors() {

    // Display a confirmation dialog to the user
    const userConfirmed = confirm("Loading will erase contents in the selected editor. Do you want to continue?");
    
    // Proceed only if the user clicks "OK"
    if (!userConfirmed) {
        console.log("User canceled the operation.");
        return; // Exit the function if the user cancels
    }

    // Check if 'write-load' exists and throw an error if it doesn't
    const writeLoadDiv = document.getElementById('write-load');
    if (!writeLoadDiv) {
        alert('Error: write-load not found');
        console.error("Error: can't find an item named write-load");
        return;
    }
    // Make the 'write-load' div invisible
    writeLoadDiv.style.display = 'block';

    // Ensure 'write-load-heading' exists as a child of 'write-load'
    let writeLoadHeading = document.getElementById('write-load-header');
    if (!writeLoadHeading) {
        writeLoadHeading = document.createElement('div');
        writeLoadHeading.id = 'write-load-heading';
        writeLoadDiv.appendChild(writeLoadHeading);
    }
    writeLoadHeading.innerHTML = '<h2>Load Content</h2>';

    // Ensure 'write-load-content' exists as a child of 'write-load'
    let writeLoadContent = document.getElementById('write-load-content');
    if (!writeLoadContent) {
        writeLoadContent = document.createElement('div');
        writeLoadContent.id = 'write-load-content';
        writeLoadDiv.appendChild(writeLoadContent);
    }
    writeLoadContent.innerHTML = ''; // Clear any existing content

    // Create buttons for the options
    const options = [
        { text: "Load blank editor", action: "loadBlank" },
        { text: "Load from file system", action: "loadFile" },
        { text: "Load template", action: "loadTemplate" },
        { text: "Generate new template", action: "generateTemplate" },
        { text: "Load Etherpad", action: "loadEtherpad" },
    ];

    const userChoice = await new Promise(resolve => {
        options.forEach(option => {
            const button = document.createElement('button');
            button.className = 'save-button';
            button.innerText = option.text;
            button.addEventListener('click', () => resolve(option.action));
            writeLoadContent.appendChild(button);
        });
    });

    // Process the user's selection
    let content = null;

    switch (userChoice) {
        case "loadBlank":
            console.log("Loading blank editor...");
            content = {};
            content.type='text';
            content.value = '';
            break;
        case "loadFile":
            console.log("Loading from file system...");
            content = await loadFile(); // Properly await loadFile
            if (!content) {
                console.error("Error: Content not loaded properly");
                return; // Exit if content is invalid
            }
            console.log("Content loaded successfully:", content);
            break;
        case "loadTemplate":
            console.log("Loading template...");
            content = await loadTemplate(); // Add function to return content
            break;
        case "generateTemplate":
            console.log("Generating new template...");
            content = await generateTemplateContent();
            break;
        case "loadEtherpad":
            console.log("Loading Etherpad...");
            toggleDiv('write-load');
            //toggleDiv('write-title');   // we'll leave this for now until we can reliably always open it when needed
            content = await editorHandlers['etherpad'].initialize(); 
            return;   // No content to process if we're just opening an existing etherpad
        default:
            console.error("Unknown selection");
            break;
    }

    // Ensure content is ready before proceeding
    if (!content || content.value === undefined || content.type === undefined) {
        console.error("Error: Content not loaded properly");
        return; // Exit if content is invalid
    }

    console.log(`Content loaded: ${content.type}`);
    console.log(`Content value: ${content.value}`);

    // Proceed to the next step with the loaded content

    if (writeLoadDiv) {     
        await populateEditorAccountList(content);
        writeLoadDiv.style.display = 'block';
    } else {    // If 'write-load' doesn't exist, alert the user     
        alert('playEditors error: write-load not found');
        console.error("Error: can't find an item named write-load");
    }

    // Check if 'write-pane-content' exists and set its display to 'none'
    const writePaneContentDiv = document.getElementById('write-pane-content');
    if (writePaneContentDiv) {
        writePaneContentDiv.style.display = 'none';
    } else {    // If 'write-pane-content' doesn't exist, alert the user        
        alert('playEditors error: write-pane-content not found');
        console.error("Error: can't find an item named write-pane-content");
    }


}


// Generate a template. Assumes the existence of a generative AI account (type 'g')

async function generateTemplateContent() {
    // Create a form dynamically with the provided text
    const formDiv = document.createElement('div');
    formDiv.id = 'generate-template-form';
    formDiv.innerHTML = `
        <div>
            <label for="templateType">Choose a template type:</label>
            <select id="templateType">
                <option value="business letter">Business Letter</option>
                <option value="case study">Case Study</option>
                <option value="lab report">Lab Report</option>
                <option value="resume">Resume</option>
                <option value="newsletter">Newsletter</option>
            </select>
            <br>
            <label for="customTemplateType">Or enter your own template type:</label>
            <input type="text" id="customTemplateType" placeholder="e.g., marketing proposal">
            <br>
            <label for="outputFormat">Choose output format:</label>
            <select id="outputFormat">
                <option value="text">Text</option>
                <option value="html">HTML</option>
            </select>
            <br>
            <button id="generateTemplateButton">Generate Template</button>
        </div>
    `;

    // Clear existing content in 'write-load-content' and append the form
    const writeLoadContent = document.getElementById('write-load-content');
    if (writeLoadContent) {
        writeLoadContent.innerHTML = ''; // Clear any existing content
        writeLoadContent.appendChild(formDiv);
    }

    // Wait for form submission and handle user input
    return new Promise(resolve => {
        const generateButton = document.getElementById('generateTemplateButton');
        generateButton.addEventListener('click', async event => {
            event.preventDefault(); // Prevent any default button behavior

            // Collect user inputs
            const templateType = document.getElementById('templateType').value;
            const customTemplateType = document.getElementById('customTemplateType').value.trim();
            const outputFormat = document.getElementById('outputFormat').value;

            // Determine the final template type
            const finalTemplateType = customTemplateType || templateType;

            // Show loading indicator
            showLoader();

            // Call generateTemplate with user inputs
            const template = await generateTemplateFromChatGPT(finalTemplateType, outputFormat);

            document.getElementById('loading-indicator').style.display = 'none';
            // Resolve the promise with the generated template
            resolve({
                type: outputFormat,
                value: template
            });
        });
    });
}



// Function to initialize an editor by type

async function populateEditorAccountList(content) {   

    // Check if 'write-load' exists and throw an error if it doesn't
    const writeLoadDiv = document.getElementById('write-load');
    if (!writeLoadDiv) {
        alert('Error: write-load not found');
        console.error("Error: can't find an item named write-load");
        return;
    }
    // Make the 'write-load' div visible
    writeLoadDiv.style.display = 'block';

    // Set up the default editors
    writeLoadDiv.innerHTML = `
        <div id="loadedContent" stype="display:none;"></div>
        <div id="write-load-header" class="flex-container">
            <h2>Load an Editor</h2>
            <button id="write-load-close-button" onclick="closeWriteLoadPane()">X</button>
        </div>
        <div id="write-load-content">
            <div id="write-load-instructions">
                <p>Choose an editor</p>
            </div>
            <div id="write-load-options"> <!-- Default Editors-->
                <button class="save-button" onclick="loadOpml()">OPML</button>
                <button class="save-button" onclick="initializeEditor('tinymce');alternateDivs('write-load','write-pane-content');">HTML</button>
                <!-- <button class="save-button" onclick="loadMd()">Markdown</button> -->
                <button class="save-button" onclick="initializeEditor('texteditor');alternateDivs('write-load','write-pane-content');">Text</button>
            </div>
            <div id="more-write-load-options"> <!-- Additional Editors-->
                <!-- Additional Editors will be added here dynamically --></div>
        </div>`;

    // Stash the loaded content into the div
    // It will be found and loaded by initializeEditor();
    document.getElementById('loadedContent').textContent = content.value;

    const accountList = document.getElementById('more-write-load-options');
    if (!accountList) {  // I know, I just created it, but just in case of future edits...
        alert('populateAccountList error: '+destination+' not found');
        console.error("Error: can't find an item named "+destination);
        return;
    }
    accountList.innerHTML = '';                             // Clear previous options

    if (!Array.isArray(accounts)) {
        throw new Error('Error: Accounts array not found; maybe you need to log in.');
    }

    // If necessary, fetch the accounts from the KVstore
    if (accounts.length === 0) {
        try {
            // Fetch the accounts from the KVstore
            accounts = await getAccounts(flaskSiteUrl); 

        } catch (error) {
            alert('Error getting Editor accounts: ' + error.message);
        }
    }

    accounts.forEach(account => {                           // Load the options stored in the KVstore
        const parsedValue = JSON.parse(account.value);
        if (parsedValue.permissions.includes('e')) {  // Check if 'permissions' contains 'r'
            const accountItem = document.createElement('button');   // Set the class
            accountItem.className = 'save-button';                  //  Set the class and onclick attribute
            accountItem.setAttribute('onclick', "initializeEditor('etherpad');alternateDivs('write-load','write-pane-content');");
            accountItem.innerHTML = parsedValue.title;       // Set the innerHTML
            accountList.appendChild(accountItem);             // Append to a parent element 
        }
    });
}

async function initializeEditor(editorType) {
    // Check and clear for an editing window
    const writePaneContent = document.getElementById('write-pane-content');
    if (!writePaneContent) {
        console.error("Write pane content not found.");
        alert("Write pane content not found. Please consult the console for details.");
        return;
    }
    writePaneContent.innerHTML = '';

    // Initialize the editor
    if (editorHandlers[editorType] && typeof editorHandlers[editorType].initialize === 'function') {
        try {
            // Await editor initialization if it's asynchronous
            await editorHandlers[editorType].initialize();
        } catch (error) {
            console.error(`Error initializing editor of type '${editorType}':`, error);
            alert(`Failed to initialize editor. Please consult the console for details.`);
            return;
        }
    } else {
        console.error(`Editor type '${editorType}' is not supported or does not have an initialize method.`);
        return;
    }
}

async function loadPredefinedContent(editorType) {

    // Find any predefined content (which will have been stashed in the loadedContent div)
    const loadedContentDiv = document.getElementById('loadedContent');
    if (!loadedContentDiv || !loadedContentDiv.textContent.trim()) {
        console.log('No content found in loadedContent');
        return; // Exit the function if no content is found
    }   
    const content = loadedContentDiv.textContent.trim();

    // Load the content into the editor
    if (typeof editorHandlers[editorType].loadContent === 'function') {
        editorHandlers[editorType].loadContent(content);
    } else {
        console.error(`Editor type '${editorType}' does not have a loadContent method.`);
    }
}


// Close all editors
function closeAllEditors() {
    const editors = document.querySelectorAll('.editor');
    editors.forEach(editor => {
        editor.style.display = 'none';
    });
}

// Load content into the editor
function loadContent(itemContent, itemId) {
    const handler = editorHandlers[currentEditor];
    if (handler && typeof handler.loadContent === 'function') {
        handler.loadContent(itemContent, itemId);
    } else {
        console.error(`No handler defined for editor: ${currentEditor}`);
    }
}

