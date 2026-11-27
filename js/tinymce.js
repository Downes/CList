/// <reference path="./clist-types.js" />
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

(function () {

    const tinymceHandler = {
        label: 'HTML (TinyMCE)',
        loadDependencies: () => ensureTinyMCE(),
        icon: 'web',
        contentTypes: ['text/html'],
        requiresAccount: false,
        initialize: async () => {
            currentEditor = 'tinymce';
            const writePaneContent = window.CList.ui.view.writePaneContent;
            writePaneContent.style.display = 'block';
            let root = document.getElementById('tinymceEditorDiv');
            if (!root) {
                root = document.createElement('div'); root.id = 'tinymceEditorDiv';
                root.innerHTML = '<textarea id="write-column"></textarea>';
                writePaneContent.appendChild(root);
            }
            root.style.display = 'block';
            if (!document.getElementById('write-column')) throw Error('The HTML editor field is unavailable. Reopen the editor and try again.');
            if (typeof tinymce === 'undefined') throw Error('TinyMCE is unavailable. Reopen the editor to retry loading it.');
            const account = currentEditorAccount;
            const session = () => typeof readerSession === 'function' ? JSON.stringify(readerSession()) : null;
            const source = session();
            const owned = () => currentEditor === 'tinymce' && currentEditorAccount === account && session() === source
                && document.getElementById('tinymceEditorDiv') === root && root.isConnected;
            let editor = tinymce.get('write-column');
            if (TinyMCE_Intialized && editor) {
                await loadPredefinedContent('tinymce');
                return true;
            }
            TinyMCE_Intialized = false;
            const offerDraft = !pendingContent;
            try {
                // A prior failed setup may have left an incomplete instance registered.
                editor?.remove();
                const editors = await tinymce.init(window.tinymceConfig);
                editor = (editors || []).find(value => value.id === 'write-column');
                if (!editor || tinymce.get('write-column') !== editor) throw Error('TinyMCE did not finish creating the HTML editor. Reopen it to retry.');
                if (!owned()) { editor.remove(); return false; }
                let references = document.getElementById('tinymce-references');
                if (!references) {
                    references = document.createElement('div'); references.id = 'tinymce-references';
                    references.className = 'allReferences';
                    writePaneContent.parentNode.insertBefore(references, writePaneContent.nextSibling);
                }
                TinyMCE_Intialized = true;
                if (offerDraft) await offerDraftRestore('tinymce', 'text/html');
                else await loadPredefinedContent('tinymce');
                return true;
            } catch (error) {
                TinyMCE_Intialized = false;
                try { tinymce.get('write-column')?.remove(); }
                catch (cleanupError) { console.error('HTML editor cleanup failed:', cleanupError); }
                console.error('HTML editor initialization failed:', error);
                throw error; // The shared mount controller owns visible feedback and rollback.
            }
        },
        getContent: () => {
            // Retrieve content for TinyMCE  - locatioon defined in tinymceConfig.selector
            return tinymce.get('write-column').getContent();
        },
        loadContent: ({ type, value }, itemId) => {
            // Load content into the TinyMCE editor
            _insertIntoTinymce(value);

            // Add to references
            if (itemId) {
                const editorDiv = document.getElementById('tinymceEditorDiv');
                createReference(itemId, editorDiv);
                displayReferences(editorDiv);
            }
        },
        setContent: (value) => {
            const editor = tinymce.get('write-column');
            if (editor) editor.setContent(value);
            // loadContent() appends directly to the backing textarea's raw value
            // (independent of TinyMCE's own content model) — keep it in sync here,
            // since programmatic setContent() doesn't fire the 'change' handler that
            // normally mirrors TinyMCE's content into it.
            const textarea = document.getElementById('write-column');
            if (textarea) textarea.value = value;
        },
        insertLink: ({ content, entryUrl, feedTitle, reference }) => {
            if (content.value) _insertIntoTinymce(`${content.value} [<a href="${escapeHtml(entryUrl)}">${escapeHtml(feedTitle)}</a>]`);
            if (reference) pushAndDisplayReference(reference, document.getElementById('tinymceEditorDiv'));
        },
        insertLinkVia: ({ content, linkedUrl, linkedTitle, entryUrl, authorOrFeedTitle, reference }) => {
            if (content.value) _insertIntoTinymce(`${content.value} [<a href="${escapeHtml(linkedUrl)}">${escapeHtml(linkedTitle)}</a>, via <a href="${escapeHtml(entryUrl)}">${escapeHtml(authorOrFeedTitle)}</a>]`);
            if (reference) pushAndDisplayReference(reference, document.getElementById('tinymceEditorDiv'));
        }
    };

    // Add the handler to editorHandlers
    if (typeof editorHandlers !== 'undefined') {
        editorHandlers.tinymce = tinymceHandler;
    } else {
        console.error("editorHandlers object is not defined.");
    }

})();



// Inserts HTML at the current cursor position in the TinyMCE editor (and mirrors it
// into the backing textarea's raw value, matching setContent()'s sync behavior). Shared
// by tinymce's loadContent and its insertLink/insertLinkVia.
function _insertIntoTinymce(html) {
    const textarea = document.getElementById('write-column');
    if (textarea) textarea.value += html;
    const editor = tinymce.get('write-column');
    if (editor) {
        editor.focus();
        const selection = editor.selection;
        selection.setContent(selection.getContent() + html, { format: 'raw' });
        const range = selection.getRng();
        range.collapse(false);
        selection.setRng(range);
    }
}

/** Collect source attribution into the document reference list.
 * @returns {CListReference|undefined} */
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

// Pushes and displays an already-resolved reference (no DOM lookup) — for
// insertLink/insertLinkVia, where the reference may come from a dragged-from window or a
// feed entry no longer on screen, rather than a live .statusSpecific element.
/** Add attribution to the document list and refresh its References panel only.
 * @param {CListReference} reference
 * @returns {CListReference|null} */
function pushAndDisplayReference(reference, editorDiv) {
    if (!reference) return null;
    pushReference(reference);
    displayReferences(editorDiv);
    return reference;
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
            window._attributeDroppedContent(e);
        }, true);

        // Initial content/draft delivery is awaited by initialize(), after init resolves.

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

