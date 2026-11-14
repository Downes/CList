/// <reference path="./clist-types.js" />
//  references.js  —  Reference list management for the CList editor session
//
//  A reference is created whenever a feed item is loaded into the editor.
//  It records attribution, the source URL, and any service-specific reply
//  token needed to post a threaded reply back to that service at publish time.
//
//  Reference shape:
//    {
//      service:     string | null,   // 'Mastodon', 'Bluesky', 'RSS', etc.
//      author_name: string,
//      author_id:   string,
//      feed:        string,
//      url:         string,
//      title:       string,
//      created_at:  string (ISO) | '',  // date the SOURCE item was published, if known
//      cited_at:    string (ISO),       // date this reference was captured/cited in CList
//      id:          string,          // DOM item ID
//      summary:     string,
//      image:       string | undefined,  // source item's image URL, if it had one (Annotate
//                                         // editor only — not shown in the References panel)
//      replyToken:  object | null,   // service-specific; see below
//    }
//
//  replyToken shapes (null = no reply support for this service):
//    Mastodon:  { type: 'Mastodon', statusId: string }
//    Bluesky:   { type: 'Bluesky', uri: string, cid: string }
//

window.CList.state.references = window.CList.state.references || [];

// Add a reference if it isn't already in the list (deduplicated by URL).
// Returns true if added, false if duplicate.
/**
 * @param {CListReference} ref
 * @returns {boolean} Whether the reference was added.
 */
function pushReference(ref) {
    if (!ref || !ref.url) return false;
    const isDuplicate = window.CList.state.references.some(r => r.url === ref.url);
    if (isDuplicate) return false;
    window.CList.state.references.push(ref);
    _renderReferencesPanel();
    const refsBtn = window.CList.ui.view.referencesButton;
    if (refsBtn) refsBtn.style.display = '';
    return true;
}

// Return the current reference list.
/** @returns {CListReference[]} */
function getReferences() {
    return window.CList.state.references;
}

// Close the references panel (slides it back down over write-pane-content). Shared by
// playRefs()'s close branch and switchToEditor() (editors.js), which calls this
// unconditionally on every editor switch so a panel left open doesn't turn into a dead end —
// the target editor may have zero references, which hides the Refs toggle button entirely,
// leaving no way to close a panel that's still showing.
function closeReferencesPanel() {
    const panel = document.getElementById('clist-references-panel');
    if (panel) panel.classList.remove('open');
}

// Toggle the references panel — slides it up over write-pane-content as an overlay,
// without reflowing write-tags-bar underneath.
window.playRefs = function() {
    const panel = document.getElementById('clist-references-panel');
    if (!panel) {
        if (typeof showErrorModal === 'function') showErrorModal('No references yet.', { title: 'No references' });
        return;
    }
    panel.classList.toggle('open');
};

// Clear all references and hide the panel.
function clearReferences() {
    window.CList.state.references = [];
    const panel = document.getElementById('clist-references-panel');
    if (panel) { panel.innerHTML = ''; panel.classList.remove('open'); }
    const refsBtn = window.CList.ui.view.referencesButton;
    if (refsBtn) refsBtn.style.display = 'none';
}

// Replace the entire reference list wholesale and re-render — used by editors.js's
// per-editor state park/restore (switching editors) and content-transfer prompt
// (Overwrite/Insert), where the caller has already built the exact list it wants
// (parked state, or a deduped union) rather than appending one deduped-by-url entry
// the way pushReference() does.
function setReferences(list) {
    window.CList.state.references = Array.isArray(list) ? list : [];
    _renderReferencesPanel();
    const refsBtn = window.CList.ui.view.referencesButton;
    if (refsBtn) refsBtn.style.display = window.CList.state.references.length ? '' : 'none';
}

// Render the references panel in the write pane: one row per reference, with
// author_name/title/feed/url editable in place and a delete button; created_at/service/
// replyToken/id/author_id stay read-only (derived/structural, or not meaningful to edit).
function _renderReferencesPanel() {
    const refs = window.CList.state.references;
    let panel = document.getElementById('clist-references-panel');
    if (!panel) {
        panel = document.createElement('div');
        panel.id = 'clist-references-panel';
        panel.className = 'allReferences';
        const writeEditorArea = window.CList.ui.view.writeEditorArea;
        if (writeEditorArea) writeEditorArea.appendChild(panel);
    }

    panel.innerHTML = '';

    const headerRow = document.createElement('div');
    headerRow.className = 'modal-header-row';
    const header = document.createElement('h2');
    header.textContent = 'References';
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'X';
    closeBtn.title = 'Close';
    closeBtn.addEventListener('click', closeReferencesPanel);
    headerRow.appendChild(header);
    headerRow.appendChild(closeBtn);
    panel.appendChild(headerRow);

    refs.forEach((ref, i) => {
        const row = document.createElement('div');
        row.className = 'status-box';

        // One clickable span per editable field, built inline into a single citation
        // line (e.g. "Author unknown. Cited on 2026-11-09. Title. (Feed). [url].")
        // rather than a label/value grid or separate boxes — reads like normal reference
        // text, with each part editable in place, flowing inside one contained unit.
        const makeEditableField = (key, placeholder) => {
            const display = document.createElement('span');
            display.className = 'ref-field-text';
            display.tabIndex = 0;
            display.textContent = ref[key] || placeholder;
            const startEditing = () => {
                const input = document.createElement('input');
                input.type = 'text';
                input.value = ref[key] || '';
                input.placeholder = placeholder;
                input.className = 'collection-editor-input ref-field-input';
                const finishEditing = () => {
                    ref[key] = input.value;
                    display.textContent = input.value || placeholder;
                    input.replaceWith(display);
                };
                input.addEventListener('blur', finishEditing);
                input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.blur(); });
                display.replaceWith(input);
                input.focus();
            };
            display.addEventListener('click', startEditing);
            display.addEventListener('keydown', (e) => { if (e.key === 'Enter') startEditing(); });
            return display;
        };

        const line = document.createElement('div');
        line.className = 'ref-citation-line';

        line.appendChild(makeEditableField('author_name', 'Author unknown'));
        line.appendChild(document.createTextNode('. '));

        // Publication date of the source item (if known) — distinct from cited_at below.
        if (ref.created_at) {
            const pubDateSpan = document.createElement('span');
            pubDateSpan.className = 'ref-citation-date';
            pubDateSpan.textContent = ref.created_at.slice(0, 10);
            line.appendChild(pubDateSpan);
            line.appendChild(document.createTextNode('. '));
        }

        line.appendChild(makeEditableField('title', 'Untitled'));
        line.appendChild(document.createTextNode('. ('));
        line.appendChild(makeEditableField('feed', 'Unknown source'));
        line.appendChild(document.createTextNode('). ['));
        line.appendChild(makeEditableField('url', 'No URL'));
        line.appendChild(document.createTextNode(']. '));

        // Date this reference was captured/cited into CList — normally always known (set
        // at reference-creation time), separate from the source item's own publication date.
        if (ref.cited_at) {
            const citedSpan = document.createElement('span');
            citedSpan.className = 'ref-citation-date';
            citedSpan.textContent = `Cited on ${ref.cited_at.slice(0, 10)}`;
            line.appendChild(citedSpan);
            line.appendChild(document.createTextNode('.'));
        }

        row.appendChild(line);

        const annotateBtn = document.createElement('button');
        annotateBtn.className = 'clist-action-btn';
        annotateBtn.title     = 'Annotate this reference';
        annotateBtn.innerHTML = '<span class="material-icons md-18 md-light">edit</span>';
        annotateBtn.addEventListener('click', async () => {
            // Treated like a regular annotation no matter where it came from — strip any
            // service-specific reply-threading token so it never posts as a threaded reply.
            const target = { ...ref, replyToken: null };
            await switchToEditor('annotate-edit');
            pushReference(target);
            _refreshAnnotateSendControls();
            _refreshAnnotateRefFields();
        });
        row.appendChild(annotateBtn);

        const removeBtn = document.createElement('button');
        removeBtn.className = 'clist-action-btn';
        removeBtn.title     = 'Remove reference';
        removeBtn.innerHTML = '<span class="material-icons md-18 md-light">remove_circle_outline</span>';
        removeBtn.addEventListener('click', () => {
            refs.splice(i, 1);
            setReferences(refs);
        });
        row.appendChild(removeBtn);

        panel.appendChild(row);
    });

    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn';
    saveBtn.textContent = 'Save as collection';
    saveBtn.style.margin = '8px 4px 4px 10px';
    saveBtn.addEventListener('click', () => {
        if (typeof window.importCollectionFromChat === 'function') {
            window.importCollectionFromChat([...refs], saveBtn);
        } else {
            showErrorModal('Collection import not available.', { title: 'Import unavailable' });
        }
    });
    panel.appendChild(saveBtn);
}
