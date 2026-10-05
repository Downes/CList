//  tinymce.js  -  TinyMCE Editor Handlers
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
// 
// // TinyMCE Editor Handlers

let TinyMCE_Intialized = false;
let pendingTinymceDraftOffer = false;

(function () {

    const tinymceHandler = {
        label: 'HTML (TinyMCE)',
        icon: 'web',
        contentTypes: ['text/html'],
        requiresAccount: false,
        initialize: () => {
            currentEditor = 'tinymce';
            //closeAllEditors();
            console.log("Not closing editors");

            if (TinyMCE_Intialized) {
                console.log("TinyMCE already initialized.");
                const writePaneContent = window.CList.ui.view.writePaneContent;
                writePaneContent.style.display = 'block'; // Show the content area
                let tinymceEditorDiv = document.getElementById('tinymceEditorDiv');
                tinymceEditorDiv.style.display = 'block'; // Show the editor
                return true;
            }


            // Check whether tinymceEditorDiv exists; if it doesn't, create it
            const writePaneContent = window.CList.ui.view.writePaneContent;
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
                showStatusMessage("Editor element not found — please reload the page.");
            }

            // Check whether the TinyMCE editor is loaded; if it is, don't load it again
            if (typeof tinymce === 'undefined') {
                console.error('TinyMCE is not loaded.');
                showStatusMessage('TinyMCE failed to load — check your network connection.');
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
            pendingTinymceDraftOffer = !pendingContent;
            loadPredefinedContent('tinymce');
            TinyMCE_Intialized = true;
            console.log("TinyMCE editor initialized");
        },
        getContent: () => {
            // Retrieve content for TinyMCE  - locatioon defined in tinymceConfig.selector
            return tinymce.get('write-column').getContent();
        },
        loadContent: ({ type, value }, itemId) => {
            // Load content into the TinyMCE editor
            const itemContent = value;
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



function createReference(statusID, editorDiv) {
    const statusSpecific = document.getElementById(statusID);
    const reference = statusSpecific?.reference;
    if (!reference) {
        console.error("Reference data not found for statusID:", statusID);
        return;
    }
    pushReference(reference);
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

function displayReferences(_editorDiv) {
    _renderReferencesPanel();
}


// tinymce-config.js

const _dm = document.documentElement.classList.contains('dark-mode');

tinymceConfig = {
    selector: '#write-column',
    height: 500,
    menubar: false,
    plugins: 'link image code',
    toolbar: 'bold italic link image code',
    skin: _dm ? 'oxide-dark' : 'oxide',
    setup: function (editor) {
        editor.on('click', function () {
            console.log('Editor was clicked');
        });

        editor.on('change', function () {
            var content = editor.getContent();
            var decodedContent = decodeHTMLEntities(content);
            document.getElementById('write-column').value = decodedContent;
        });

        const debouncedSave = debounce(() => saveDraft('tinymce', editor.getContent()), 1000);
        editor.on('input change', debouncedSave);

    },
    init_instance_callback: function (editor) {
        // Listen on the iframe document in capture phase — fires before any body-level
        // handler, including TinyMCE's own drag plugin which may stopImmediatePropagation on body.
        editor.getDoc().addEventListener('drop', function(e) {
            const dt = e.dataTransfer;
            if (!dt) return;
            const url   = window._extractDropUrl(dt.getData('text/uri-list'), dt.getData('text/html'));
            const title = dt.getData('text/x-clist-title') || null;
            window._attributeDroppedContent(url, title);
        }, true);

        if (pendingTinymceDraftOffer) {
            pendingTinymceDraftOffer = false;
            offerDraftRestore('tinymce', 'text/html');
        }
    },
    content_style: _dm ? `
        body { background: #1e1e1e; color: #e0e0e0; font-size: 14px; }
        @media (min-width: 840px) {
            html { background: #111; min-height: 100%; padding: 0 .5rem; }
            body { background-color: #252525; box-shadow: 0 0 4px rgba(0,0,0,.5);
                   box-sizing: border-box; margin: 1rem auto 0;
                   max-width: 820px; min-height: calc(100vh - 1rem); }
        }
    ` : `
        body { background: #fff; font-size: 14px; }
        @media (min-width: 840px) {
            html { background: #eceef4; min-height: 100%; padding: 0 .5rem; }
            body { background-color: #ddd; box-shadow: 0 0 4px rgba(0,0,0,.15);
                   box-sizing: border-box; margin: 1rem auto 0;
                   max-width: 820px; min-height: calc(100vh - 1rem); }
        }
    `,

};

