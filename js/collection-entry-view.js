// Existing-resource picker rendering for collection editor entries. No storage operations.
window.CList.ui ||= {};
window.CList.ui.collectionEntries = {
    picker(anchor) {
        document.querySelectorAll('.collection-picker').forEach(element => element.remove());
        const root = document.createElement('div'); root.id = 'collection-add-entry-picker'; root.className = 'collection-picker';
        anchor.parentElement.insertBefore(root, anchor.nextSibling);
        dismissOnOutsideClick(root, anchor);
        return { root };
    },
    message(view, text, error = false) {
        if (view.root.isConnected === false) return;
        view.root.replaceChildren(); const element = document.createElement('p');
        element.className = error ? 'error-message' : 'feed-status-message'; element.textContent = text; view.root.appendChild(element);
    },
    render(view, records, choose) {
        view.root.replaceChildren();
        if (!records.collections.length && !records.pages.length) return this.message(view, 'No saved collections or published pages yet.');
        const list = document.createElement('ul'); list.className = 'collection-picker-list';
        for (const [kind, items] of [['collection', records.collections], ['page', records.pages]]) for (const record of items) {
            const row = document.createElement('li'), button = document.createElement('button');
            button.className = 'btn btn-small'; button.textContent = kind === 'collection' ? `${record.title || record.name} (collection)` : record.title || record.url;
            button.onclick = () => choose({ kind, record }); row.appendChild(button); list.appendChild(row);
        }
        view.root.appendChild(list);
    },
    busy(view, value) { view.root.querySelectorAll('button').forEach(button => { button.disabled = value; }); },
    close(view) { view.root.remove(); },
    status(text) { showStatusMessage(text); },
    error(error) { console.error('[collection entry]', error); showErrorModal('Could not add entry: ' + (error?.message || String(error)), { title: 'Could not add entry' }); },
};
