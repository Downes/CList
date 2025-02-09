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
// Definition:
// 
//      Editors are defined as objects with methods for initializing the editor, 
//      getting content from the editor, and loading content into the editor.
//      Each editor has its own Javascript file (except text, which is below)
//      
//      The editorHandlers object is a dictionary of editor objects, keyed by the editor name.
//      Each editor object has the following methods:
//          - initialize: Initializes the editor
//          - getContent: Gets the content from the editor
//          - loadContent: Loads content into the editor
//      
//      The editorHandlers object is used to call the appropriate methods for the current editor.  
//      The current editor is set by the user and is used to determine which editor to use.
//      
//      Add an editor to the editorHandlers object as follows:
//          (function () {
//              const etherpadHandler = {
//                   initialize: async (content) => {    // Initialize the editor                   
//                      currentEditor = 'etherpad';      // Required for the editor to work
//                   },
//                   getContent: () => {                 // Get the content from the editor 
//                   },
//                   loadContent: (content) => {          // Load content into the editor       
//                   }
//               };
//               editorHandlers['etherpad'] = etherpadHandler;
//           })();
// 
//      The editorHandlers object is used to call the appropriate methods for the current editor.
//      Usage:
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
            // closeAllEditors();

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
        console.error("Error: can't find an div named write-load. It should be created in index.html and it's where we stash the content to be pre-loaded into the editor.");
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
        console.log("write-load-heading created");
    }
    writeLoadHeading.innerHTML = '<h2>Load Content</h2>';

    // Ensure 'write-load-content' exists as a child of 'write-load'
    let writeLoadContent = document.getElementById('write-load-content');
    if (!writeLoadContent) {
        writeLoadContent = document.createElement('div');
        writeLoadContent.id = 'write-load-content';
        writeLoadDiv.appendChild(writeLoadContent);
        console.log("write-load-content created");
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
    console.log(`User choice: ${userChoice}`);

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
            console.log(`Content loaded: ${content.type}`);
            console.log(`Content value: ${content.value}`);
            break;
        case "loadEtherpad":
            console.log("Loading Etherpad...");
            toggleDiv('write-load');
            //toggleDiv('write-title');   // we'll leave this for now until we can reliably always open it when needed
            content = initializeEditor('etherpad'); 
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
    console.log("Moving on to the next step");
    if (writeLoadDiv) {     
        await populateEditorAccountList(content);
        writeLoadDiv.style.display = 'block';
    } else {    // If 'write-load' doesn't exist, alert the user     
        console.error("Error: can't find an item named write-load");
    }

    // Check if 'write-pane-content' exists and set its display to 'none'
    const writePaneContentDiv = document.getElementById('write-pane-content');
    if (writePaneContentDiv) {
       writePaneContentDiv.style.display = 'none';
    } else {    // If 'write-pane-content' doesn't exist, alert the user        
        alert('playEditors error: write-pane-content not found');
        console.error("Error: can't find an div named write-pane-content. It should be created in index.html and it's where we display the editor.");
    }
    console.log("playEditors completed");

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
            const extractedContent = extractCodeContent(template);

            // Remove the form from the page so the generated template is not appended anywhere
            if (formDiv.parentNode) {
                formDiv.parentNode.removeChild(formDiv);
            }

            document.getElementById('loading-indicator').style.display = 'none';
            // Resolve the promise with the generated template
            resolve({
                type: outputFormat,
                value: extractedContent
            });
        });
    });
}

function extractCodeContent(template) {
    // This regex will capture text between the first pair of triple backticks.
    // It optionally allows a language identifier after the opening backticks.
    const regex = /```(?:\w*\n)?([\s\S]*?)```/;
    const match = template.match(regex);
    
    if (match && match[1]) {
      // Return the content between the triple backticks, trimming any extra whitespace.
      return match[1].trim();
    }
    
    // If no triple backticks are found, return the original content.
    return template;
  }
  

// Function to initialize an editor by type

async function populateEditorAccountList(content) {   

    // Check if 'write-load' exists and throw an error if it doesn't
    const writeLoadDiv = document.getElementById('write-load');
    if (!writeLoadDiv) {
        alert('Error: write-load not found');
        console.error("Error: can't find an div named write-load. It should be created in index.html and it's where we stash the content to be pre-loaded into the editor.");
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
    console.log('Content stashed in loadedContent');

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
        if (parsedValue.permissions.includes('e')) {  // Check if 'permissions' contains 'e' for 'edit'
            const accountItem = document.createElement('button');   // Set the class
            accountItem.className = 'save-button';                  //  Set the class and onclick attribute

            // This is specifically for etherpad and I will need to change this when I add additional editors
            accountItem.setAttribute('onclick', "initializeEditor('etherpad');alternateDivs('write-load','write-pane-content');");
            accountItem.innerHTML = parsedValue.title;       // Set the innerHTML
            accountList.appendChild(accountItem);             // Append to a parent element 
        }
    });
}

async function initializeEditor(editorType) {

    // Close all editors
    // Note that we do not remove the editors, we just hide them
    const writePaneContent = document.getElementById('write-pane-content');
    if (writePaneContent) {
        Array.from(writePaneContent.children).forEach(child => {
            child.style.display = 'none';
        });
    } else {   
        console.error("Write pane content not found. Obviously a major programming error.");
        alert("Write pane content not found. Please consult the console for details.");
        return;
    }

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

