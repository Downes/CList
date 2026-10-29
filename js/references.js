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
//      created_at:  string (ISO),
//      id:          string,          // DOM item ID
//      summary:     string,
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
function getReferences() {
    return window.CList.state.references;
}

// Toggle the references panel — swaps write-pane-content for the refs list.
window.playRefs = function() {
    const panel = document.getElementById('clist-references-panel');
    if (!panel) {
        if (typeof showStatusMessage === 'function') showStatusMessage('No references yet.');
        return;
    }
    const hidden  = window.getComputedStyle(panel).display === 'none';
    const content = document.getElementById('write-pane-content');
    panel.style.display = hidden ? 'block' : 'none';
    if (content) content.style.display = hidden ? 'none' : '';
};

// Clear all references and hide the panel.
function clearReferences() {
    window.CList.state.references = [];
    const panel = document.getElementById('clist-references-panel');
    if (panel) panel.innerHTML = '';
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

// Render the references panel in the write pane.
function _renderReferencesPanel() {
    const refs = window.CList.state.references;
    let panel = document.getElementById('clist-references-panel');
    if (!panel) {
        panel = document.createElement('div');
        panel.id = 'clist-references-panel';
        panel.className = 'allReferences';
        const writePane = window.CList.ui.view.writePaneEl;
        if (writePane) writePane.appendChild(panel);
    }

    panel.innerHTML = '<h2 class="feed-header">References</h2>';
    panel.innerHTML += refs.map((ref, i) => {
        const replyBadge = ref.replyToken
            ? `<span class="ref-reply-badge" title="Will reply on ${ref.replyToken.type}">↩ ${ref.replyToken.type}</span> `
            : '';
        return `<div class="status-box">
            <p>${replyBadge}<strong>${i + 1}. ${escapeHtml(ref.author_name || '')}.</strong>
            ${escapeHtml(ref.title || '')}. <em>${escapeHtml(ref.feed || '')}</em>.
            ${ref.created_at ? ref.created_at.slice(0, 10) : ''}.
            <a href="${ref.url}" target="_blank">${escapeHtml(ref.url)}</a></p>
        </div>`;
    }).join('');

    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn';
    saveBtn.textContent = 'Save as collection';
    saveBtn.style.margin = '8px 4px 4px 10px';
    saveBtn.addEventListener('click', () => {
        if (typeof window.importCollectionFromChat === 'function') {
            window.importCollectionFromChat([...refs], saveBtn);
        } else {
            showStatusMessage('Collection import not available.');
        }
    });
    panel.appendChild(saveBtn);
}
