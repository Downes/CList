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

// Content waiting to be loaded into the next editor that is initialized.
// Shape: { type: string, value: string } — set by switchToEditor() when carrying content, consumed by loadPredefinedContent().
let pendingContent = null;
// 
// Define handlers for each editor
//
// Each handler object has the following fields:
//
//   label         {string}   Human-readable name shown in the editor picker UI.
//   icon          {string}   Material Icons name shown beside the label (e.g. 'edit').
//   contentTypes  {string[]} MIME types this editor prefers (e.g. ['text/html']).
//                            Empty array means the editor accepts any content type.
//   requiresAccount {bool}   true if this editor needs a kvstore account with permission 'e'
//                            and a matching type field (e.g. Etherpad). false for built-ins.
//   initialize()             Set currentEditor, create/show DOM, call loadPredefinedContent().
//   getContent()             Return current editor content as a string.
//   loadContent({type,value}, itemId?)
//                            Insert/append content at cursor. type is a MIME type string.
//
// To add a new editor, create a new JS file and register its handler:
//
//   (function () {
//       editorHandlers['myeditor'] = {
//           label: 'My Editor',
//           contentTypes: ['text/html'],
//           requiresAccount: false,
//           initialize: () => { currentEditor = 'myeditor'; /* … */ loadPredefinedContent('myeditor'); },
//           getContent: () => { /* return content string */ },
//           loadContent: ({ type, value }, itemId) => { /* insert value into editor */ }
//       };
//   })();
//
// Usage:
//   const handler = editorHandlers[currentEditor];
//   if (handler?.getContent) content = handler.getContent();

const editorHandlers = {
    texteditor: {
        label: 'Text',
        icon: 'notes',
        contentTypes: ['text/plain'],
        requiresAccount: false,
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
            
            // Wire up auto-save once (guard against re-wiring on subsequent initialize calls)
            if (!textEditorDiv.dataset.draftWired) {
                const ta = document.getElementById('text-column');
                ta.addEventListener('input', debounce(() => saveDraft('texteditor', ta.value), 1000));
                textEditorDiv.dataset.draftWired = '1';
            }

            const hasPending = !!pendingContent;
            loadPredefinedContent('texteditor');
            if (!hasPending) offerDraftRestore('texteditor', 'text/plain');

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
        loadContent: ({ type, value }, itemId) => {
            // Strip HTML tags when receiving HTML content — the text editor works in plain text
            const itemContent = (type === 'text/html') ? cleanHTMLContent(value) : value;

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
        label: 'Quill (HTML)',
        icon: 'edit',
        contentTypes: ['text/html'],
        requiresAccount: false,
        getContent: () => {
            return quillEditor.root.innerHTML;
        }
    },
    ckeditor: {
        label: 'CKEditor',
        icon: 'edit',
        contentTypes: ['text/html'],
        requiresAccount: false,
        getContent: () => {
            return CKEDITOR.instances['editor-id'].getData();
        }
    }
    // Add more editors as needed
};


// Common Editor Functions


//
// Define handlers for each content loader
//
//      The loadHandlers registry is an ordered array of loader objects displayed
//      in the right-pane Load list. Each loader must have:
//
//          label  {string}   Display name shown in the list
//          icon   {string}   Material Icons name (or logoSrc for a masked SVG)
//          load   async () => { type, value } | null
//
//      load() returns { type: 'text/plain'|'text/html', value: string }, or null
//      if loading was cancelled. Register a loader from any service .js file:
//
//          (function () {
//              window.loadHandlers = window.loadHandlers || [];
//              window.loadHandlers.push({
//                  label: 'My Source',
//                  icon:  'source',
//                  load:  async () => { return { type, value }; }
//              });
//          })();
//

window.loadHandlers = window.loadHandlers || [];

// Open the right-pane load list
async function playLoad() {
    populateLoadOptions();
    openRightInterface('load-instructions');
}

// Build the load list from the loadHandlers registry
function populateLoadOptions() {
    const optionsDiv = document.getElementById('load-options');
    optionsDiv.innerHTML = '';

    const list = document.createElement('div');
    list.className = 'account-list';

    const tip = document.createElement('div');
    tip.className = 'list-tip';
    tip.textContent = 'Select a source to load from';
    list.appendChild(tip);

    loadHandlers.forEach(handler => {
        const btn = document.createElement('button');
        btn.className = 'account-button';

        const iconEl = document.createElement('span');
        if (handler.logoSrc) {
            iconEl.className = 'service-icon-img';
            iconEl.style.webkitMask = `url('${handler.logoSrc}') no-repeat center / contain`;
            iconEl.style.mask = `url('${handler.logoSrc}') no-repeat center / contain`;
        } else {
            iconEl.className = 'material-icons';
            iconEl.textContent = handler.icon || 'upload';
        }

        const nameEl = document.createElement('span');
        nameEl.textContent = handler.label;

        btn.appendChild(iconEl);
        btn.appendChild(nameEl);

        btn.addEventListener('click', async () => {
            const content = await handler.load();
            if (!content || content.value === undefined || content.type === undefined) return;

            const editorHandler = editorHandlers[currentEditor];
            const currentHandlesType = !editorHandler.contentTypes.length
                || editorHandler.contentTypes.includes(content.type);

            if (!currentHandlesType) {
                // Find a non-account editor that handles this content type
                const suitableKey = Object.keys(editorHandlers).find(key => {
                    const h = editorHandlers[key];
                    return !h.requiresAccount
                        && (!h.contentTypes.length || h.contentTypes.includes(content.type));
                });
                if (suitableKey) {
                    await switchToEditor(suitableKey, content); // loads content + closes right pane
                    return;
                }
                // No suitable editor — warn that HTML will be stripped
                if (!confirm('The loaded content is HTML but the current editor is plain text. HTML tags will be stripped. Continue?')) {
                    return;
                }
            }

            loadContent(content);
            closeRightPane();
        });

        list.appendChild(btn);
    });

    optionsDiv.appendChild(list);
}

// Register built-in load handlers
(function () {
    window.loadHandlers = window.loadHandlers || [];

    window.loadHandlers.push({
        label: 'Load blank',
        icon:  'note_add',
        load:  async () => {
            clearDraft(currentEditor);
            return { type: 'text/plain', value: '' };
        }
    });

    window.loadHandlers.push({
        label: 'Load template',
        icon:  'folder_open',
        load:  async () => {
            const optionsDiv = document.getElementById('load-options');
            if (optionsDiv) optionsDiv.innerHTML = '<p class="list-tip">Template loading is not yet implemented.</p>';
            return null;
        }
    });
})();


// Close the write-load panel and return to the editor
function closeWriteLoadPane() {
    alternateDivs('write-load', 'write-pane-content');
}


function makeEditorButton(label, icon, onClick) {
    const btn = document.createElement('button');
    btn.className = 'account-button';
    const iconEl = document.createElement('span');
    iconEl.className = 'material-icons';
    iconEl.textContent = icon || 'edit';
    const nameEl = document.createElement('span');
    nameEl.textContent = label;
    btn.appendChild(iconEl);
    btn.appendChild(nameEl);
    btn.addEventListener('click', async () => onClick());
    return btn;
}

// Rebuild the editor list in the right pane.
// carriedContent — { type, value } to pass into the new editor, or null.
async function populateEditorList(carriedContent) {
    const builtInOptions = document.getElementById('editor-switch-options');
    builtInOptions.innerHTML = '';
    Object.entries(editorHandlers).forEach(([key, handler]) => {
        if (handler.requiresAccount || typeof handler.initialize !== 'function') return;
        if (key === currentEditor) return;
        builtInOptions.appendChild(makeEditorButton(handler.label || key, handler.icon, () => switchToEditor(key, carriedContent)));
    });

    const accountList = document.getElementById('editor-switch-account-options');
    accountList.innerHTML = '';
    if (!Array.isArray(accounts) || accounts.length === 0) {
        try { accounts = await getAccounts(flaskSiteUrl); } catch(e) { showStatusMessage('Could not load accounts: ' + e.message); }
    }
    accounts.forEach(account => {
        const parsedValue = parseAccountValue(account);
        if (!parsedValue || !parsedValue.permissions.includes('e')) return;
        const editorType = parsedValue.type?.toLowerCase();
        const handler = editorHandlers[editorType];
        if (!handler || !handler.requiresAccount) return;
        if (editorType === currentEditor) return;
        accountList.appendChild(makeEditorButton(`${parsedValue.title} (${handler.label})`, handler.icon, () => switchToEditor(editorType, carriedContent)));
    });
}

// Open the editor switcher in the right pane
async function playEditorSwitch() {
    let carriedContent = null;
    const currentHandler = editorHandlers[currentEditor];
    if (currentHandler?.getContent) {
        try {
            const raw = await currentHandler.getContent();
            const currentType = currentHandler.contentTypes[0] || 'text/plain';
            if (typeof raw === 'string' && raw.trim()) carriedContent = { type: currentType, value: raw };
        } catch(e) {
            console.warn('Could not read content from current editor:', e);
        }
    }

    await populateEditorList(carriedContent);
    openRightInterface('editor-list');
}


// Switch to a different editor, optionally carrying content over
async function switchToEditor(editorType, carriedContent) {
    const handler = editorHandlers[editorType];

    // Warn when switching from HTML content to a plain-text editor (lossy)
    if (carriedContent && carriedContent.type === 'text/html'
            && handler.contentTypes.includes('text/plain')
            && !handler.contentTypes.includes('text/html')) {
        if (!confirm(`Switching to ${handler.label} will strip HTML formatting. Continue?`)) return;
    }

    if (carriedContent) pendingContent = carriedContent;

    await initializeEditor(editorType);
    closeRightPane();
    updateEditorIndicator();
    await populateEditorList(null);
}


// Update the editor indicator button label to match the current editor
function updateEditorIndicator() {
    const handler = editorHandlers[currentEditor];
    const label = handler?.label || currentEditor;
    const btn = document.getElementById('editor-indicator');
    if (btn) btn.textContent = label + ' ▾';
    const status = document.getElementById('editor-status');
    if (status) status.textContent = 'editor: ' + label;
}



// Function to initialize an editor by type

async function populateEditorAccountList(content) {   

    // Check if 'write-load' exists and throw an error if it doesn't
    const writeLoadDiv = document.getElementById('write-load');
    if (!writeLoadDiv) {
        console.error("Error: can't find a div named write-load. It should be created in index.html and it's where we stash the content to be pre-loaded into the editor.");
        return;
    }
    // Make the 'write-load' div visible
    writeLoadDiv.style.display = 'block';

    // Stash content so initializeEditor → loadPredefinedContent can pick it up
    pendingContent = content;
    console.log('Content stashed in pendingContent', content.type);

    // Build the picker shell
    writeLoadDiv.innerHTML = `
        <div id="write-load-header" class="flex-container">
            <h2>Load an Editor</h2>
            <button id="write-load-close-button" onclick="closeWriteLoadPane()">X</button>
        </div>
        <div id="write-load-content">
            <div id="write-load-instructions"><p>Choose an editor</p></div>
            <div id="write-load-options"></div>
            <div id="more-write-load-options"></div>
        </div>`;

    // Built-in editors: any handler with requiresAccount=false and an initialize method
    const builtInOptions = document.getElementById('write-load-options');
    Object.entries(editorHandlers).forEach(([key, handler]) => {
        if (handler.requiresAccount || typeof handler.initialize !== 'function') return;
        const btn = document.createElement('button');
        btn.className = 'save-button';
        btn.textContent = handler.label || key;
        btn.addEventListener('click', () => {
            initializeEditor(key);
            alternateDivs('write-load', 'write-pane-content');
        });
        builtInOptions.appendChild(btn);
    });

    // Account-backed editors: accounts with permission 'e' whose type maps to a registered handler
    const accountList = document.getElementById('more-write-load-options');
    if (!Array.isArray(accounts)) {
        throw new Error('Error: Accounts array not found; maybe you need to log in.');
    }

    // If necessary, fetch the accounts from the KVstore
    if (accounts.length === 0) {
        try {
            // Fetch the accounts from the KVstore
            accounts = await getAccounts(flaskSiteUrl); 

        } catch (error) {
            showStatusMessage('Error getting Editor accounts: ' + error.message);
        }
    }

    accounts.forEach(account => {
        const parsedValue = parseAccountValue(account);
        if (!parsedValue || !parsedValue.permissions.includes('e')) return;

        const editorType = parsedValue.type?.toLowerCase();
        const handler = editorHandlers[editorType];
        if (!handler || !handler.requiresAccount) {
            console.warn(`No account-backed editor handler found for type '${parsedValue.type}' — skipping`);
            return;
        }

        const accountItem = document.createElement('button');
        accountItem.className = 'save-button';
        accountItem.textContent = `${parsedValue.title} (${handler.label})`;
        accountItem.addEventListener('click', () => {
            initializeEditor(editorType);
            alternateDivs('write-load', 'write-pane-content');
        });
        accountList.appendChild(accountItem);
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
        showStatusMessage('Write pane not found — please reload the page.');
        return;
    }

    // Initialize the editor
    if (editorHandlers[editorType] && typeof editorHandlers[editorType].initialize === 'function') {
        try {
            // Await editor initialization if it's asynchronous
            await editorHandlers[editorType].initialize();
            updateEditorIndicator();
        } catch (error) {
            console.error(`Error initializing editor of type '${editorType}':`, error);
            showStatusMessage(`Failed to initialize editor: ${error.message}`);
            return;
        }
    } else {
        console.error(`Editor type '${editorType}' is not supported or does not have an initialize method.`);
        return;
    }
}

async function loadPredefinedContent(editorType) {

    if (!pendingContent || !pendingContent.value) {
        console.log('No pending content to load');
        return;
    }

    const content = pendingContent;
    pendingContent = null; // consume it — one editor gets it

    if (typeof editorHandlers[editorType].loadContent === 'function') {
        editorHandlers[editorType].loadContent(content);
    } else {
        console.error(`Editor type '${editorType}' does not have a loadContent method.`);
    }
}


// Draft auto-save helpers — keyed by editor name in localStorage

function saveDraft(editorKey, value) {
    if (value && value.trim()) sessionStorage.setItem('clist_draft_' + editorKey, value);
}

function clearDraft(editorKey) {
    sessionStorage.removeItem('clist_draft_' + editorKey);
}

function offerDraftRestore(editorKey, contentType) {
    const draft = sessionStorage.getItem('clist_draft_' + editorKey);
    if (!draft) return;
    if (confirm('A draft was saved from your last session. Restore it?')) {
        loadContent({ type: contentType, value: draft });
    } else {
        clearDraft(editorKey);
    }
}

// Close all editors
function closeAllEditors() {
    const editors = document.querySelectorAll('.editor');
    editors.forEach(editor => {
        editor.style.display = 'none';
    });
}

// Load content into the active editor.
// content must be { type: string, value: string } — e.g. { type: 'text/html', value: '<p>…</p>' }
function loadContent(content, itemId) {
    const handler = editorHandlers[currentEditor];
    if (handler && typeof handler.loadContent === 'function') {
        handler.loadContent(content, itemId);
    } else {
        console.error(`No handler defined for editor: ${currentEditor}`);
    }
}

// Load a feed item into the active editor by its DOM id.
// Called by the arrow_right clist-action button on every feed item.
function loadContentToEditor(itemId) {
    let item_content;
    if (itemId === 'thread' || itemId === 'feed-container') {
        const feedContainer = document.getElementById('feed-container');
        const tempContainer = feedContainer.cloneNode(true);
        const feedHeader = tempContainer.querySelector('.feed-header');
        if (feedHeader) feedHeader.remove();
        tempContainer.querySelectorAll('.status-actions').forEach(el => el.remove());
        tempContainer.querySelectorAll('.clist-actions').forEach(el => el.remove());
        tempContainer.querySelectorAll('.material-icons').forEach(el => el.remove());
        item_content = tempContainer.innerHTML;
    } else {
        item_content = document.getElementById(itemId).innerHTML;
    }
    loadContent({ type: 'text/html', value: item_content }, itemId);
}

// Set the indicator label once all scripts have loaded
document.addEventListener('DOMContentLoaded', () => { updateEditorIndicator(); });
