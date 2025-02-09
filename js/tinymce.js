//  tinymce.js  -  TinyMCE Editor Handlers
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
// 
// // TinyMCE Editor Handlers

let TinyMCE_Intialized = false;

(function () {

    const tinymceHandler = {
        initialize: () => {
            currentEditor = 'tinymce';
            //closeAllEditors();
            console.log("Not closing editors");

            if (TinyMCE_Intialized) {
                console.log("TinyMCE already initialized.");
                const writePaneContent = document.getElementById('write-pane-content');
                writePaneContent.style.display = 'block'; // Show the content area
                let tinymceEditorDiv = document.getElementById('tinymceEditorDiv');
                tinymceEditorDiv.style.display = 'block'; // Show the editor
                return true;
            }


            // Check whether tinymceEditorDiv exists; if it doesn't, create it
            const writePaneContent = document.getElementById('write-pane-content');
            let tinymceEditorDiv = document.getElementById('tinymceEditorDiv');
            if (!tinymceEditorDiv) {
                console.log("Creating TinyMCE editor div");
                tinymceEditorDiv = document.createElement('div');
                tinymceEditorDiv.id = 'tinymceEditorDiv';
                tinymceEditorDiv.innerHTML = `<textarea id="write-column"></textarea> 
                        <div class="currentReferences"></div>`;
                writePaneContent.appendChild(tinymceEditorDiv);
            }

            // Check whether write-column (used by TinyMCE) exists 
            const editorElement = document.querySelector('#write-column');
            if (editorElement) {
                console.log("Editor element found:", editorElement);
            } else {
                console.error("Editor element not found for selector '#write-column'.");
                alert("Editor element not found for selector '#write-column'.");
            }

            // Check whether the TinyMCE editor is loaded; if it is, don't load it again
            if (typeof tinymce === 'undefined') {
                console.error('TinyMCE is not loaded.');
                alert('TinyMCE is not loaded.');
            } else {
                console.log('TinyMCE is loaded; initializing now:', tinymce);
                tinymce.init(window.tinymceConfig);
            }



            tinymceEditorDiv.style.display = 'block'; // Show the editor



            // Check whether <div id="tinymce-references" ...> exists; if it doesn't, create it
            let tinymceReferences = document.getElementById('tinymce-references');
            if (!tinymceReferences) {
                tinymceReferences = document.createElement('div');
                tinymceReferences.id = 'tinymce-references';
                tinymceReferences.className = 'allReferences';
                writePaneContent.parentNode.insertBefore(tinymceReferences, writePaneContent.nextSibling);
            }

            // Initialize the tinymce editor
            // This is a placeholder function
            loadPredefinedContent('tinymce');
            TinyMCE_Intialized = true;
            console.log("TinyMCE editor initialized");
        },
        getContent: () => {
            // Retrieve content for TinyMCE  - locatioon defined in tinymceConfig.selector
            return tinymce.get('write-column').getContent();
        },
        loadContent: (itemContent, itemId) => {
            // Load content into the TinyMCE editor
            const textarea = document.getElementById('write-column');
            if (textarea) {
                textarea.value += itemContent;
            }
            const editor = tinymce.get("write-column");
            if (editor) {
                // Save the current selection (cursor position)
                editor.focus(); // Ensure the editor is focused
                const selection = editor.selection;
        
                // Insert content at the cursor position
                selection.setContent(selection.getContent() + itemContent, { format: 'raw' });
        
                // Optionally, move the cursor to the end of the inserted content
                const range = selection.getRng(); // Range object
                range.collapse(false); // Collapse to the end of the range
                selection.setRng(range); // Apply the updated range
            }
            
    
            // Add to references
            if (itemId) {
                const editorDiv = document.getElementById('tinymceEditorDiv');
                const reference = createReference(itemId, editorDiv);
                displayCurrentReference(reference, editorDiv);
                displayReferences(editorDiv);
            }
        }
    };

    // Add the handler to editorHandlers
    if (typeof editorHandlers !== 'undefined') {
        editorHandlers.tinymce = tinymceHandler;
    } else {
        console.error("editorHandlers object is not defined.");
    }

})();




// Functions to work with TinyMCE as the editing window
// Expects a div identified by 'itemID' containing content to be loaded

function loadContentToTinyMCE (itemId) {

    let item_content;

    // Define the content we're loading
    if (itemId === 'thread' || itemId === 'feed-container') {    // Load the whole thread and clone it
        const feedContainer = document.getElementById("feed-container");
        const tempContainer = feedContainer.cloneNode(true);
        const feedHeader = tempContainer.querySelector(".feed-header");
        if (feedHeader) {  feedHeader.remove(); } // Remove the feedHeader div and all the action buttons
        tempContainer.querySelectorAll(".status-actions").forEach(element => element.remove());
        tempContainer.querySelectorAll(".clist-actions").forEach(element => element.remove());
        tempContainer.querySelectorAll(".material-icons").forEach(element => element.remove());
        item_content = tempContainer.innerHTML;
    } else {
        item_content = document.getElementById(`${itemId}`).innerHTML;
    }

    // Load content to the editor

    loadContent(item_content, itemId);

   

}

function createReference(statusID, editorDiv) {

    // Get the reference from statusID
    const statusSpecific = document.getElementById(statusID);
    const reference = statusSpecific.reference;
    if (!reference) {
        console.error("Reference data not found in the provided statusSpecific object.");
        return;
    }

    // Store the reference data in a readable object format
    if (!editorDiv.references) {
        editorDiv.references = []; // Initialize if not already present
    }

    // Check if the reference already exists based on its URL
    const isDuplicate = editorDiv.references.some(
        (existingReference) => existingReference.url === reference.url
    );

    // Add the reference to the list if it's not a duplicate
    if (!isDuplicate) {
        editorDiv.references.push(reference);
        console.log("Reference added:", reference);
    } else {
        console.log("Duplicate reference detected, not added:", reference);
    }
    return reference;

}

function displayCurrentReference(reference, editorDiv) {

    // Define where we're writing the reference
    let referenceDiv = editorDiv.querySelector('.currentReference');

    if (!referenceDiv) {
        referenceDiv = document.createElement('div');
        referenceDiv.classList.add('currentReference');
        editorDiv.appendChild(referenceDiv);
    }

    // Write the current reference
    referenceDiv.innerHTML = `
        <p><strong>Author Name:</strong> ${reference.author_name}</p>
        <p><strong>Author ID:</strong> ${reference.author_id}</p>
        <p><strong>Feed:</strong> ${reference.feed}</p>
        <p><strong>URL:</strong> <a href="${reference.url}" target="_blank">${reference.url}</a></p>
        <p><strong>Title:</strong> ${reference.title}</p>
        <p><strong>Created At:</strong> ${reference.created_at}</p>
        <p><strong>ID:</strong> ${reference.id}</p>
    `;

}

function displayReferences(editorDiv) {

    // Define where we're writing the references
    let referencesDiv = document.getElementById(currentEditor+'-references');
    let writePane = document.getElementById('write-pane');  
    if (!referencesDiv) {
        referencesDiv = document.createElement('div');
        referencesDiv.classList.add('allReferences');
        referencesDiv.id = currentEditor+'-references';
        writePane.appendChild(referencesDiv);
    }

    // Display the list of references as HTML
    referencesDiv.innerHTML = `<h2 class="feed-header">References</h2>`;
    referencesDiv.innerHTML += editorDiv.references
        .map(
            (ref, index) => `
        <div  class="status-box">
            <p><strong>${index + 1}. ${ref.author_name}. ${ref.title}. <em>${ref.feed}.</em> ${ref.created_at}. <a href="${ref.url}" target="_blank">${ref.url}</a></p>
        </div>`
        )
        .join('');
}


// tinymce-config.js

tinymceConfig = {
    selector: '#write-column',
    height: 500,
    menubar: false,
    plugins: 'link image code',
    toolbar: 'bold italic link image code',
    skin: 'oxide',
    setup: function (editor) {
        editor.on('click', function () {
            console.log('Editor was clicked');
        });

        editor.on('change', function () {
            console.log('Editor was changed');
            var content = editor.getContent();

            var decodedContent = decodeHTMLEntities(content); // Ensure this function is defined elsewhere
            document.getElementById('write-column').value = decodedContent;
            var tempo = document.getElementById('write-column').value;
            console.log(tempo);
        });
    },
    content_style: `
        body {
            background: #fff;
            font-size: 14px;
        }




        @media (min-width: 840px) {
            html {
                background: #eceef4;
                min-height: 100%;
                padding: 0 .5rem;
            }

            body {
                background-color: #ddd;
                box-shadow: 0 0 4px rgba(0, 0, 0, .15);
                box-sizing: border-box;
                margin: 1rem auto 0;
                max-width: 820px;
                min-height: calc(100vh - 1rem);
                
            }
        }
    `,

};

