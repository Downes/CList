// Import controls/preview/choices only. Controllers supply every read/write callback.
window.CList.ui ||= {};
window.CList.ui.collectionImport = {
    sources(target, actions) {
        const root = document.createElement('div'); root.className = 'collection-import-controls';
        const url = document.createElement('input'); url.type = 'url'; url.placeholder = 'Collection URL'; url.title = 'Collection URL';
        const button = document.createElement('button'); button.className = 'btn btn-small'; button.textContent = 'Import URL';
        button.onclick = () => actions.url(url.value.trim());
        const file = document.createElement('input'); file.type = 'file'; file.title = 'Import collection file';
        file.onchange = () => { const selected = file.files?.[0]; if (selected) actions.file(selected); };
        root.append(url, button, file); target.appendChild(root); return root;
    },
    mount(target) { target.replaceChildren(); const root = document.createElement('div'); target.appendChild(root); return { root }; },
    message(view, message, error = false, back) {
        view.root.replaceChildren();
        const text = document.createElement('p'); text.className = error ? 'error-message' : 'feed-status-message'; text.textContent = message;
        view.root.appendChild(text);
        if (back) { const button = document.createElement('button'); button.className = 'btn btn-secondary'; button.textContent = 'Back'; button.onclick = back; view.root.appendChild(button); }
    },
    preview(view, parsed, actions) {
        view.root.replaceChildren();
        const title = document.createElement('h3'); title.textContent = 'Import preview';
        const count = document.createElement('p'); count.className = 'feed-status-message'; count.textContent = `${parsed.items.length} item${parsed.items.length === 1 ? '' : 's'} found`;
        const list = document.createElement('ul'); list.className = 'collection-publish-items';
        parsed.items.slice(0, 5).forEach(item => { const row = document.createElement('li'); row.textContent = item.title || item.url || 'Untitled'; list.appendChild(row); });
        if (parsed.items.length > 5) { const row = document.createElement('li'); row.textContent = `…and ${parsed.items.length - 5} more`; list.appendChild(row); }
        const label = document.createElement('label'); label.textContent = 'Save as: ';
        const name = document.createElement('input'); name.className = 'input-field'; name.type = 'text'; name.value = parsed.title || ''; name.maxLength = 50; label.appendChild(name);
        const save = document.createElement('button'); save.className = 'btn'; save.textContent = 'Save as collection'; save.onclick = () => actions.save(name.value);
        const cancel = document.createElement('button'); cancel.className = 'btn btn-secondary'; cancel.textContent = 'Cancel'; cancel.onclick = actions.cancel;
        const error = document.createElement('p'); error.className = 'error-message';
        view.root.append(title, count, list, label, save, cancel, error);
        view.save = save; view.error = error;
    },
    busy(view, value) { for (const button of view.root.querySelectorAll('button')) button.disabled = value; },
    failure(view, error) {
        const message = error?.message || String(error);
        if (view.error?.isConnected) view.error.textContent = message;
        else { const text = document.createElement('p'); text.className = 'error-message'; text.textContent = message; view.root.appendChild(text); }
    },
    chat(anchor) { const root = document.createElement('div'); root.className = 'collection-picker'; anchor.insertAdjacentElement('afterend', root); return { root }; },
    choices(view, collections, select, anchor) { view.root.replaceChildren(); _buildCollectionPickerContents(view.root, collections, select, anchor); },
    conflict(view, name, actions) {
        view.root.replaceChildren();
        const message = document.createElement('p'); message.textContent = `"${name}" already exists.`; view.root.appendChild(message);
        const row = document.createElement('div'); row.className = 'published-page-confirm';
        for (const [label, action] of [['Overwrite', actions.overwrite], ['Merge', actions.merge], ['Cancel', actions.cancel]]) {
            const button = document.createElement('button'); button.className = 'btn btn-small' + (label === 'Cancel' ? ' btn-secondary' : ''); button.textContent = label; button.onclick = action; row.appendChild(button);
        }
        view.root.appendChild(row);
    },
    close(view) { view.root.remove(); },
    status(text) { showStatusMessage(text); },
    error(error) { console.error('[collection import]', error); showErrorModal(error?.message || String(error), { title: 'Collection import failed' }); },
};
