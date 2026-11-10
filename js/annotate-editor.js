// annotate-editor.js — Annotation editor for the write-pane
// Part of CList, the next generation of learning and connecting with your community
//
// Depends on: utilities.js (escapeHtml, showStatusMessage, showErrorModal, parseAccountValue,
//             getSiteSpecificCookie, getAccounts, cleanHTMLContent), kvstore.js, editors.js
//             (currentEditor, editorHandlers, switchToEditor), tags.js (getWriteTags),
//             tinymce.js (createReference, pushAndDisplayReference, displayCurrentReference,
//             displayReferences), references.js (getReferences), annotate.js
//             (_submitAnnotation — loads before this file).
//
// A normal editor like any other: it takes citations via the shared insertLink/insertLinkVia
// contract (the "Write about this" arrow button, or the Alt+A shortcut in interface.js) and
// keeps its own reference list via the generic editorStates park/restore in editors.js, same
// as texteditor/tinymce/latex/collab. Reached via Alt+A (interface.js) rather than a dedicated
// open button.

// Editor to switch back to after a successful Send — set by whatever opened this editor
// (currently only the Alt+A shortcut in interface.js) when it wasn't already active.
let _annotateReturnEditor = null;

// Render the editor panel: editable Title/URL/Author/Feed/Image fields for the reference being
// annotated, a Description body textarea (content arrives via loadContent/insertLink, same as
// every other editor), and a bottom Send control. Fields modeled on gRSShopper's ghub post-edit
// screen.
async function _renderAnnotateEditor(container) {
    container.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'list-tip';
    header.textContent = 'Annotate';
    container.appendChild(header);

    const fieldsSection = document.createElement('div');
    fieldsSection.id = 'annotate-ref-fields';
    container.appendChild(fieldsSection);
    _renderAnnotateRefFields(fieldsSection);

    const bodyWrapper = document.createElement('div');
    bodyWrapper.className = 'collection-editor-field';
    const bodyLabel = document.createElement('label');
    bodyLabel.textContent = 'Description';
    bodyWrapper.appendChild(bodyLabel);

    const body = document.createElement('textarea');
    body.id = 'annotate-edit-body';
    body.rows = 8;
    body.style.cssText = 'width:100%;box-sizing:border-box;';
    bodyWrapper.appendChild(body);
    container.appendChild(bodyWrapper);

    const sendSection = document.createElement('div');
    sendSection.id = 'annotate-send-section';
    sendSection.style.cssText = 'margin-top:10px;';
    container.appendChild(sendSection);
    await _renderSendControls(sendSection, body);
}

// Editable Title/URL/Author/Feed/Image fields for the reference this annotation targets —
// the same reference (getReferences()[0]) that _renderSendControls's Send handler reads as
// `target`. Edits write straight back into that reference object; no re-render needed.
// Renders nothing until a reference exists (nothing to edit yet).
function _renderAnnotateRefFields(container) {
    container.innerHTML = '';
    const ref = getReferences()[0];
    if (!ref) return;

    const makeField = (label, key) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'collection-editor-field';
        const fieldLabel = document.createElement('label');
        fieldLabel.textContent = label;
        wrapper.appendChild(fieldLabel);
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'collection-editor-input';
        input.value = ref[key] || '';
        input.addEventListener('change', () => { ref[key] = input.value; });
        wrapper.appendChild(input);
        container.appendChild(wrapper);
    };

    makeField('Title', 'title');
    makeField('URL', 'url');
    makeField('Author', 'author_name');
    makeField('Feed', 'feed');
    makeField('Image', 'image');
}

// Re-renders just the Send row (account/visibility pickers + gating message) without
// touching the body textarea — called after a reference is added to an already-open
// annotate-edit editor (insertLink/insertLinkVia/loadContent), since the gating on
// getReferences().length needs to flip from "nothing to annotate yet" to the real controls.
function _refreshAnnotateSendControls() {
    const sendSection = document.getElementById('annotate-send-section');
    const body = document.getElementById('annotate-edit-body');
    if (sendSection && body) _renderSendControls(sendSection, body);
}

// Re-renders the ref-fields block — called alongside _refreshAnnotateSendControls() for the
// same reason: the fields are empty (not rendered) until a reference exists.
function _refreshAnnotateRefFields() {
    const fieldsSection = document.getElementById('annotate-ref-fields');
    if (fieldsSection) _renderAnnotateRefFields(fieldsSection);
}

async function _renderSendControls(sendSection, body) {
    sendSection.innerHTML = '';
    const token = getSiteSpecificCookie(window.CList.config.flaskSiteUrl, window.CList.keys.ACCESS_TOKEN);
    if (!token) {
        const msg = document.createElement('p');
        msg.className = 'feed-status-message';
        msg.textContent = 'Log in with an annotation account to send.';
        sendSection.appendChild(msg);
        return;
    }

    const accounts = await ensureAccountsLoaded().catch(() => []);
    const writeAccts = accounts.map(parseAccountValue).filter(d =>
        d && (d.type === 'Annotate' || d.type === 'Hypothesis') && (d.permissions || 'rw').includes('w')
    );

    if (!writeAccts.length) {
        const msg = document.createElement('p');
        msg.className = 'feed-status-message';
        msg.textContent = 'No annotation account with write permission — add one in Account Settings.';
        sendSection.appendChild(msg);
        return;
    }

    if (!getReferences().length) {
        const msg = document.createElement('p');
        msg.className = 'feed-status-message';
        msg.textContent = 'Nothing to annotate yet — use "Write about this" on a feed item, or Alt+A.';
        sendSection.appendChild(msg);
        return;
    }

    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:8px;flex-wrap:wrap;';

    const storeLabel = document.createElement('label');
    storeLabel.textContent = 'Send to:';
    row.appendChild(storeLabel);

    const storeSelect = buildAccountSelect(writeAccts);
    storeSelect.style.cssText = 'font-size:0.85rem;padding:2px 4px;';
    row.appendChild(storeSelect);

    const visLabel = document.createElement('label');
    visLabel.textContent = 'Visibility:';
    row.appendChild(visLabel);

    const visSelect = buildVisibilitySelect();
    visSelect.style.cssText = 'font-size:0.85rem;padding:2px 4px;';
    row.appendChild(visSelect);

    const sendBtn = document.createElement('button');
    sendBtn.className = 'btn btn-small';
    sendBtn.textContent = 'Send';
    row.appendChild(sendBtn);

    sendSection.appendChild(row);

    sendBtn.addEventListener('click', async () => {
        const target = getReferences()[0];
        if (!target || !target.url) {
            showErrorModal('No target URL for this annotation.', { title: 'No target' });
            return;
        }
        const bodyText = body.value.trim();
        if (!bodyText) {
            showErrorModal('Annotation text is required.', { title: 'Annotation required' });
            return;
        }

        const tags = window.getWriteTags?.() || [];
        const acct = writeAccts[parseInt(storeSelect.value, 10)];
        const visibility = visSelect.value;

        sendBtn.disabled = true;
        sendBtn.textContent = 'Sending…';
        try {
            const ok = await _submitAnnotation(sendSection, target.id, target.url, bodyText, tags, visibility, acct, token);
            if (ok) {
                showStatusMessage(`Sent to ${acct.title || acct.instance}.`);
                const returnTo = _annotateReturnEditor;
                _annotateReturnEditor = null;
                if (returnTo && returnTo !== 'annotate-edit') {
                    await switchToEditor(returnTo);
                }
            }
        } finally {
            sendBtn.disabled = false;
            sendBtn.textContent = 'Send';
        }
    });
}

(function () {
    if (typeof editorHandlers === 'undefined') {
        console.error('editorHandlers is not defined — annotate-editor.js must load after editors.js');
        return;
    }

    editorHandlers['annotate-edit'] = {
        label: 'Annotate',
        icon: 'edit',
        contentTypes: ['text/plain', 'text/html'],
        requiresAccount: false,

        initialize: async () => {
            currentEditor = 'annotate-edit';

            const writePaneContent = window.CList.ui.view.writePaneContent;
            let div = document.getElementById('annotateEditDiv');
            if (!div) {
                div = document.createElement('div');
                div.id = 'annotateEditDiv';
                writePaneContent.appendChild(div);
                await _renderAnnotateEditor(div);
            }
            // Idempotent, like every other editor's initialize() — re-entering this editor
            // (e.g. a second Alt+A press) must not wipe whatever's already been typed.
            div.style.display = 'block';
        },

        getContent: () => {
            const ta = document.getElementById('annotate-edit-body');
            return ta ? ta.value.trim() : '';
        },

        setContent: (value) => {
            const ta = document.getElementById('annotate-edit-body');
            if (ta) ta.value = value;
        },

        // Insertion target for the "Write about this" arrow button (clistAnnotate) and the
        // Alt+A shortcut — mirrors texteditor's cursor-splice insertion plus the generic
        // multi-reference citation-list bookkeeping shared by every editor.
        loadContent: ({ type, value }, itemId) => {
            const itemContent = (type === 'text/html') ? cleanHTMLContent(value) : value;
            const textarea = document.getElementById('annotate-edit-body');
            if (!textarea) return;

            const cursorPosition = textarea.selectionStart;
            const textBefore = textarea.value.substring(0, cursorPosition);
            const textAfter = textarea.value.substring(cursorPosition);
            textarea.value = textBefore + itemContent + textAfter;

            const newCursorPosition = cursorPosition + itemContent.length;
            textarea.setSelectionRange(newCursorPosition, newCursorPosition);

            if (itemId) {
                const editorDiv = document.getElementById('annotateEditDiv');
                const reference = createReference(itemId, editorDiv);
                displayCurrentReference(reference, editorDiv);
                displayReferences(editorDiv);
                _refreshAnnotateSendControls();
                _refreshAnnotateRefFields();
            }
        },

        insertLink: ({ content, entryUrl, feedTitle, reference }) => {
            const itemContent = (content.type === 'text/html') ? cleanHTMLContent(content.value) : content.value;
            const textarea = document.getElementById('annotate-edit-body');
            if (itemContent && textarea) {
                const cursorPosition = textarea.selectionStart;
                const textBefore = textarea.value.substring(0, cursorPosition);
                const textAfter = textarea.value.substring(cursorPosition);
                const insert = `${itemContent} [${feedTitle}]`;
                textarea.value = textBefore + insert + textAfter;
                const newCursorPosition = cursorPosition + insert.length;
                textarea.setSelectionRange(newCursorPosition, newCursorPosition);
            }
            if (reference) {
                pushAndDisplayReference(reference, document.getElementById('annotateEditDiv'));
                _refreshAnnotateSendControls();
                _refreshAnnotateRefFields();
            }
        },

        insertLinkVia: ({ content, linkedUrl, linkedTitle, entryUrl, authorOrFeedTitle, reference }) => {
            const itemContent = (content.type === 'text/html') ? cleanHTMLContent(content.value) : content.value;
            const textarea = document.getElementById('annotate-edit-body');
            if (itemContent && textarea) {
                const cursorPosition = textarea.selectionStart;
                const textBefore = textarea.value.substring(0, cursorPosition);
                const textAfter = textarea.value.substring(cursorPosition);
                const insert = `${itemContent} [${linkedTitle}, via ${authorOrFeedTitle}]`;
                textarea.value = textBefore + insert + textAfter;
                const newCursorPosition = cursorPosition + insert.length;
                textarea.setSelectionRange(newCursorPosition, newCursorPosition);
            }
            if (reference) {
                pushAndDisplayReference(reference, document.getElementById('annotateEditDiv'));
                _refreshAnnotateSendControls();
                _refreshAnnotateRefFields();
            }
        },
    };
})();
