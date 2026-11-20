// Collection membership controls. All reads and writes are supplied callbacks.
window.CList.ui ||= {};
window.CList.ui.collectionMembers = {
    picker(id, anchor, glow = false) {
        const existing = document.getElementById(id);
        document.querySelectorAll('.collection-picker').forEach(node => node.remove());
        if (existing) return null;
        if (!anchor?.parentElement) throw new Error('The collection picker target is no longer available.');
        const root = document.createElement('div'); root.id = id;
        root.className = 'collection-picker' + (glow ? ' collection-picker-glow' : '');
        anchor.parentElement.insertBefore(root, anchor.nextSibling);
        this.message(root, 'Loading collections…'); return root;
    },
    message(root, text, error = false) {
        if (root.isConnected === false) return;
        root.replaceChildren(); const p = document.createElement('p');
        p.className = error ? 'error-message' : 'feed-status-message'; p.textContent = text; root.appendChild(p);
    },
    error(error) {
        console.error('[collection membership]', error);
        showErrorModal(error?.message || String(error), { title: 'Collection operation failed' });
    },
    status(text) { showStatusMessage(text); },
    collected(id) { document.getElementById(`collect-btn-${id}`)?.classList.add('action-active'); },
    busy(root, value) { root.querySelectorAll('button').forEach(button => { button.disabled = value; }); },
    rows(col, count, root, busy, actions) {
        root.replaceChildren();
        if (count) count.textContent = `${col.items.length} item${col.items.length !== 1 ? 's' : ''}`;
        if (!col.items.length) { this.message(root, 'This collection is empty.'); return; }
        const remove = (target, item) => {
            const button = document.createElement('button'); button.className = 'clist-action-btn';
            button.title = 'Remove from collection'; button.disabled = busy;
            button.innerHTML = '<span class="material-icons md-18 md-light">remove_circle_outline</span>';
            button.onclick = () => actions.remove(item); target.appendChild(button);
        };
        for (const item of col.items) {
            if (item.role === 'contains' && item.collectionId) {
                const wrapper = document.createElement('div'); wrapper.className = 'saved-collection-wrapper';
                const row = document.createElement('div'); row.className = 'saved-collection-row';
                const title = document.createElement('span'); title.className = 'saved-collection-name';
                title.textContent = item.title || 'Untitled collection'; title.title = 'Open nested collection';
                title.onclick = () => actions.nested(item);
                const label = document.createElement('span'); label.className = 'saved-collection-count'; label.textContent = 'Nested collection';
                row.append(title, label); remove(row, item); wrapper.appendChild(row); root.appendChild(wrapper); continue;
            }
            if (!item.url) continue;
            try {
                const title = _collectionItemDisplayTitle(item);
                const social = ['Mastodon', 'Bluesky'].includes(item.service) || ['Mastodon', 'Bluesky'].includes(item.title);
                const platform = item.title || item.service;
                const el = makeListing({ service: item.service || 'RSS', url: item.url, title,
                    titleHtml: `<a href="${escapeHtml(item.url)}" target="_blank" rel="noopener">${escapeHtml(title)}</a>`,
                    desc: item.summary || '', feed: social ? (item.author_id ? `${platform} (@${item.author_id})` : platform) : item.feed || null,
                    feedUrl: item.feedUrl || null, author: item.author_name && !item.author_name.startsWith('(') ? item.author_name : null,
                    date: item.created_at || null, guid: item.guid || item.url, entryId: item.id || null, link: item.url });
                const bar = el.querySelector('.clist-actions'); if (bar) remove(bar, item); root.appendChild(el);
            } catch (error) {
                console.error('[collection membership] render failed', error);
                const p = document.createElement('p'); p.className = 'error-message';
                p.textContent = 'Could not display collection entry: ' + (error?.message || String(error)); root.appendChild(p);
            }
        }
    },
};
function _buildCollectionPickerContents(picker, collections, onSelect, anchorEl) {
    dismissOnOutsideClick(picker, anchorEl);

    if (!collections.length) {
        const msg = document.createElement('p');
        msg.className   = 'feed-status-message';
        msg.textContent = 'No collections yet — create one below.';
        picker.appendChild(msg);
    } else {
        const list = document.createElement('ul');
        list.className = 'collection-picker-list';
        for (const col of collections) {
            const li  = document.createElement('li');
            const btn = document.createElement('button');
            btn.className   = 'btn btn-small';
            btn.textContent = col.title;
            btn.addEventListener('click', () => onSelect(col.title, col));
            li.appendChild(btn);
            list.appendChild(li);
        }
        picker.appendChild(list);
    }

    const newRow    = document.createElement('div');
    newRow.className = 'collection-picker-new';
    const nameInput = document.createElement('input');
    nameInput.type        = 'text';
    nameInput.className   = 'input-field';
    nameInput.placeholder = 'New collection name…';
    nameInput.maxLength   = 50;
    const createBtn = document.createElement('button');
    createBtn.className   = 'btn btn-small';
    createBtn.textContent = 'Create & add';
    createBtn.addEventListener('click', () => {
        const name = nameInput.value.trim();
        if (!name) { showErrorModal('Please enter a collection name.', { title: 'Collection name required' }); return; }
        if (!_COLLECTION_NAME_RE.test(name)) {
            showErrorModal('Name may only contain letters, digits, spaces, #, -, and _.', { title: 'Invalid collection name' });
            return;
        }
        onSelect(name, null);
    });
    nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') createBtn.click(); });
    newRow.appendChild(nameInput);
    newRow.appendChild(createBtn);
    picker.appendChild(newRow);
}
