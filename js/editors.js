//  editors.js  -  Functions that handle the interface with the content editor
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



// Temporary visible build marker for browser testing; bump with each test revision.
const EDITOR_TEST_VERSION = '2026-11-18.2';

// Name of the current editor
let currentEditor = 'texteditor'; // Default editor is plain text

// The specific account (raw kvstore entry) backing the current editor, if any —
// e.g. which Etherpad account is active. null for built-in, non-account-backed editors.
let currentEditorAccount = null;

// Content waiting to be loaded into the next editor that is initialized.
// Shape: { type: string, value: string } — set by switchToEditor() when carrying content, consumed by loadPredefinedContent().
let pendingContent = null;

// The My Pages row currently represented by the editor's content, or null. Set by
// loadSavedPage()'s empty-editor/New/Replace paths; cleared by anything that makes
// the editor stop representing that exact page (switching editors, Load blank).
// Shape: { url: string, title: string } | null.
let currentLoadedPage = null;

//
// Define handlers for each editor
//
// Each handler object has the following fields:
//
//   label         {string}   Human-readable name shown in the editor picker UI.
//   icon          {string}   Material Icons name shown beside the label (e.g. 'edit').
//   contentTypes  {string[]} MIME types this editor's loadContent() can genuinely accept
//                            (e.g. ['text/html']). Empty array means none — the editor
//                            doesn't support loading generic file/page content at all
//                            (e.g. collection, whose items load via a separate, structured
//                            path) — it is never treated as "accepts anything".
//   requiresAccount {bool}   true if this editor needs a kvstore account with permission 'e'
//                            and a matching type field (e.g. Etherpad). false for built-ins.
//   isActive()     {function, optional} requiresAccount editors only: returns true if there's
//                            already a live connection to resume even without a matching saved
//                            account (e.g. an active guest Etherpad session) — lets the switcher
//                            offer a way back in without requiring a saved account.
//   initialize()             Set currentEditor, create/show DOM, call loadPredefinedContent().
//                            Must be idempotent: if the editor's DOM/connection already exists
//                            and represents what's being asked for, just show it — don't rebuild
//                            or reset state. This is what lets editors "stay open": switching
//                            away and back resumes exactly where you left off.
//   getContent()             Return current editor content as a string.
//   loadContent({type,value}, itemId?)
//                            Insert/append content at cursor. type is a MIME type string.
//   setContent(value)        {function, optional} Replace the entire editor body (no cursor
//                            semantics). Local editors only (texteditor, tinymce) — omit it for
//                            account-backed/collaborative editors (collab, etherpad, collection)
//                            rather than attempting collaborative-doc replace. Used by
//                            loadSavedPage()'s New/Replace options.
//   insertLink({content, entryUrl, feedTitle, reference})  {function, optional} "Direct"
//                            placement from a feed entry — arrow-click (selection or entry
//                            summary), a drag straight out of an entry, or a drag out of a
//                            window opened via openInBrowser (where content is THAT window's
//                            own selection, not the entry's). content is {type, value}, same
//                            shape as loadContent's first argument. reference is the full
//                            reference object to push (pass to pushAndDisplayReference, or the
//                            editor's own equivalent) — not an itemId, since the source may have
//                            no backing DOM element.
//   insertLinkVia({content, linkedUrl, linkedTitle, entryUrl, authorOrFeedTitle, reference})
//                            {function, optional} "Indirect" placement — content dragged out of
//                            a window opened via openDescriptionLink (a link found INSIDE a feed
//                            entry, distinct from the entry's own URL). linkedUrl/linkedTitle
//                            identify the dragged-from page; entryUrl/authorOrFeedTitle
//                            attribute it back to the entry it was found in.
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

// Splices text into the plain-text editor's textarea at the current cursor position,
// leaving the cursor after the inserted text. Shared by texteditor's loadContent and
// its insertLink/insertLinkVia.
function _insertIntoTextarea(text) {
    const textarea = window.CList.ui.view.textColumn;
    if (!textarea) return;
    const cursorPosition = textarea.selectionStart;
    const textBefore = textarea.value.substring(0, cursorPosition);
    const textAfter = textarea.value.substring(cursorPosition);
    textarea.value = textBefore + text + textAfter;
    const newCursorPosition = cursorPosition + text.length;
    textarea.setSelectionRange(newCursorPosition, newCursorPosition);
}

//
// Each entry in editorHandlers may optionally define:
//     editorFunctions:  A set of functions the editor supports, rendered as buttons in the
//                        shared #editor-menu bar — the editor-side equivalent of a reader's
//                        feedFunctions (reader.js), rendered by setupFeedButtons (interface.js).
//                        { 'Funcname': function() { } }  // label shown on the button
//                    Populated automatically by setupEditorButtons() (below), called from
//                    initializeEditor() right before handler.initialize() runs. A handler that
//                    needs richer toolbar markup than a flat button list (e.g. collab, latex)
//                    skips this field and builds its own markup into #editor-menu directly
//                    inside initialize() instead, which simply overwrites what this rendered.
//
const editorHandlers = {
    texteditor: {
        label: 'Text',
        icon: 'notes',
        contentTypes: ['text/plain'],
        requiresAccount: false,
        initialize: () => {

            currentEditor = 'texteditor';
            // alert(window.CList.config.flaskSiteUrl);
            etherpadUsername = getSiteSpecificCookie(window.CList.config.flaskSiteUrl, window.CList.keys.USERNAME);
            if (!etherpadUsername) { etherpadUsername = 'user' + Math.floor(Math.random() * 1000); }
            // closeAllEditors();

            // Check whether textEditorDiv exists; if it doesn't, create it
            const writePaneContent = window.CList.ui.view.writePaneContent;
            let textEditorDiv = document.getElementById('textEditorDiv');
            if (!textEditorDiv) {
                textEditorDiv = document.createElement('div');
                textEditorDiv.id = 'textEditorDiv';
                textEditorDiv.innerHTML = `<textarea id="text-column"></textarea>`;
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
                const ta = window.CList.ui.view.textColumn;
                ta.addEventListener('input', debounce(() => saveDraft('texteditor', ta.value), 1000));
                ta.addEventListener('drop', function(e) {
                    window._attributeDroppedContent(e);
                });
                textEditorDiv.dataset.draftWired = '1';
            }

            const hasPending = !!pendingContent;
            loadPredefinedContent('texteditor');
            if (!hasPending) offerDraftRestore('texteditor', 'text/plain');

            console.log("Text editor initialized");
        },
        getContent: () => {
            const textarea = window.CList.ui.view.textColumn;
            if (!textarea) {
                console.error("Textarea with ID 'write-column' not found.");
                return ""; // Return an empty string or handle as needed
            }
            return textarea.value.trim();
        },
        loadContent: ({ type, value }, itemId) => {
            // Strip HTML tags when receiving HTML content — the text editor works in plain text
            const itemContent = (type === 'text/html') ? cleanHTMLContent(value) : value;
            _insertIntoTextarea(itemContent);

            // Add to references
            if (itemId) {
                const editorDiv = document.getElementById('textEditorDiv');
                createReference(itemId, editorDiv);
                displayReferences(editorDiv);
            }
        },
        setContent: (value) => {
            const textarea = window.CList.ui.view.textColumn;
            if (textarea) textarea.value = value;
        },
        insertLink: ({ content, entryUrl, feedTitle, reference }) => {
            const itemContent = (content.type === 'text/html') ? cleanHTMLContent(content.value) : content.value;
            if (itemContent) _insertIntoTextarea(`${itemContent} [${feedTitle}]`);
            if (reference) pushAndDisplayReference(reference, document.getElementById('textEditorDiv'));
        },
        insertLinkVia: ({ content, linkedUrl, linkedTitle, entryUrl, authorOrFeedTitle, reference }) => {
            const itemContent = (content.type === 'text/html') ? cleanHTMLContent(content.value) : content.value;
            if (itemContent) _insertIntoTextarea(`${itemContent} [${linkedTitle}, via ${authorOrFeedTitle}]`);
            if (reference) pushAndDisplayReference(reference, document.getElementById('textEditorDiv'));
        }
    },
    // Add more editors as needed
};


// Common Editor Functions


//
// Define handlers for each content loader
//
//      The loaders registry is an ordered array of loader objects displayed
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
//              window.CList.loaders = window.CList.loaders || [];
//              window.CList.loaders.push({
//                  label: 'My Source',
//                  icon:  'source',
//                  load:  async () => { return { type, value }; }
//              });
//          })();
//

window.CList.loaders = window.CList.loaders || [];

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
        const feedContainer = window.CList.ui.view.feedContainer;
        const tempContainer = feedContainer.cloneNode(true);
        tempContainer.querySelectorAll('.feed-header, .collection-detail-header').forEach(el => el.remove());
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
