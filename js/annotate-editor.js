// annotate-editor.js — Dedicated single-item annotation editor for the write-pane
// Part of CList, the next generation of learning and connecting with your community
//
// Depends on: utilities.js (escapeHtml, showStatusMessage, showErrorModal, parseAccountValue,
//             getSiteSpecificCookie, getAccounts, cleanHTMLContent), kvstore.js, editors.js
//             (currentEditor, editorHandlers, switchToEditor), tags.js (getWriteTags),
//             annotate.js (_submitAnnotation — loads before this file).
//
// Unlike every other editor, this one always targets exactly one feed item, set fresh by the
// "Annotate" (pencil) button each time it's clicked — never resumed from a previous session the
// way editorStates park/restore works for other editors. _annoEditReference is therefore kept
// outside that park/restore system entirely (same reasoning as collection-editor.js's
// _activeCollection/_draftItems), so switching away to another editor and back to a *different*
// item via a fresh pencil click can never show stale data from the last item annotated.

let _annoEditReference = null; // { title, url, author_name, feed, created_at, summary, id, ... } | null

// Pencil-button handler — always opens a fresh editor targeting the clicked item, discarding
// whatever item a previously-open annotation editor was showing. This is intentionally different
// from the "Write about this" arrow button (clistAnnotate, in annotate.js), which inserts quoted
// text into whatever editor is currently open instead of forcing a switch.
window.clistAnnotateEdit = function(itemId) {
    const el = document.getElementById(itemId);
    if (!el || !el.reference) {
        showErrorModal('No reference found for this item.', { title: 'No reference' });
        return;
    }

    _annoEditReference = { ...el.reference };

    if (typeof switchToEditor === 'function') {
        switchToEditor('annotate-edit', null);
    } else {
        console.error('switchToEditor is not defined');
    }

    if (typeof snapPanes === 'function' && typeof mainContent !== 'undefined' && typeof readPane !== 'undefined') {
        const ratio = readPane.getBoundingClientRect().width / mainContent.getBoundingClientRect().width;
        if (ratio > 0.65) snapPanes('left');
    } else if (typeof mobShowWrite === 'function') {
        mobShowWrite();
    }
};

// Render the editor panel: prefilled Title/URL/Author/Feed/Date fields (read-only — they
// describe the item being annotated, not something this editor publishes itself), a body
// textarea pre-seeded with a quoted excerpt, and a bottom Send control.
async function _renderAnnotateEditor(container) {
    container.innerHTML = '';
    const ref = _annoEditReference || {};

    const header = document.createElement('div');
    header.className = 'list-tip';
    header.textContent = 'Annotate this item';
    container.appendChild(header);

    [
        { key: 'title',       label: 'Title' },
        { key: 'url',         label: 'URL' },
        { key: 'author_name', label: 'Author' },
        { key: 'feed',        label: 'Feed / Source' },
        { key: 'created_at',  label: 'Date' },
    ].forEach(({ key, label }) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'collection-editor-field';
        const labelEl = document.createElement('label');
        labelEl.textContent = label;
        wrapper.appendChild(labelEl);
        const input = document.createElement('input');
        input.type = 'text';
        input.value = ref[key] || '';
        input.readOnly = true;
        input.className = 'collection-editor-input';
        wrapper.appendChild(input);
        container.appendChild(wrapper);
    });

    const bodyWrapper = document.createElement('div');
    bodyWrapper.className = 'collection-editor-field';
    const bodyLabel = document.createElement('label');
    bodyLabel.textContent = 'Annotation';
    bodyWrapper.appendChild(bodyLabel);

    const body = document.createElement('textarea');
    body.id = 'annotate-edit-body';
    body.rows = 8;
    body.style.cssText = 'width:100%;box-sizing:border-box;';
    const isUnknownAuthor = !ref.author_name || ref.author_name === '(unknown author)';
    const attribution = isUnknownAuthor
        ? (ref.feed && ref.feed !== '(no feed specified)' ? ref.feed : ref.service || 'Unknown')
        : ref.author_name;
    body.value = ref.summary ? `${attribution} wrote: "${ref.summary}"\n\n` : '';
    bodyWrapper.appendChild(body);
    container.appendChild(bodyWrapper);

    const sendSection = document.createElement('div');
    sendSection.style.cssText = 'margin-top:10px;';
    container.appendChild(sendSection);
    await _renderSendControls(sendSection, body);
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
        if (!_annoEditReference || !_annoEditReference.url) {
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
            const ok = await _submitAnnotation(sendSection, _annoEditReference.id, _annoEditReference.url, bodyText, tags, visibility, acct, token);
            if (ok) showStatusMessage(`Sent to ${acct.title || acct.instance}.`);
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
            }
            div.style.display = 'block';

            await _renderAnnotateEditor(div);
        },

        getContent: () => {
            const ta = document.getElementById('annotate-edit-body');
            return ta ? ta.value.trim() : '';
        },

        // Insertion target for the "Write about this" arrow button (clistAnnotate, via editors.js's
        // global loadContent() dispatch) when this annotation editor is the active one — e.g.
        // quoting a second passage into the annotation body while it's already open. Mirrors
        // texteditor's cursor-splice insertion, minus the generic multi-reference citation-list
        // bookkeeping (createReference/displayReferences), which doesn't apply here: this editor
        // only ever has one target item, already tracked by _annoEditReference.
        loadContent: ({ type, value }) => {
            const itemContent = (type === 'text/html') ? cleanHTMLContent(value) : value;
            const textarea = document.getElementById('annotate-edit-body');
            if (!textarea) return;

            const cursorPosition = textarea.selectionStart;
            const textBefore = textarea.value.substring(0, cursorPosition);
            const textAfter = textarea.value.substring(cursorPosition);
            textarea.value = textBefore + itemContent + textAfter;

            const newCursorPosition = cursorPosition + itemContent.length;
            textarea.setSelectionRange(newCursorPosition, newCursorPosition);
        },
    };
})();
