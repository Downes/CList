function createCollabDocumentsView(doc = document, ui = window.CList.ui.view) {
    const container = ui.loadOptions;
    if (!container?.isConnected) throw Error('The Load panel is no longer available.');
    const root = doc.createElement('div'); root.className = 'collab-documents'; container.textContent = ''; container.appendChild(root);
    const alive = () => root.isConnected && root.parentNode === container && ui.loadOptions === container;
    const message = text => { root.textContent = ''; const tip = doc.createElement('p'); tip.className = 'list-tip'; tip.textContent = text; root.appendChild(tip); };
    return {
        alive,
        loading: () => message('Loading documents…'),
        show(documents, select, title) {
            message(documents.length ? 'Select a document to open' : 'No documents yet — enter a document ID in the Collab editor to create one.');
            const list = doc.createElement('div'); list.className = 'account-list'; root.appendChild(list);
            documents.forEach(record => {
                const button = doc.createElement('button'); button.className = 'btn-small account-button';
                const icon = doc.createElement('span'); icon.className = 'material-icons'; icon.textContent = 'article';
                const name = doc.createElement('span'); name.textContent = record.title || title(record.id); button.append(icon, name);
                const current = () => alive() && button.isConnected && button.parentNode === list && list.parentNode === root;
                button.onclick = () => { if (current()) return select(record, current); };
                list.appendChild(button);
            });
        },
        busy(value) { root.querySelectorAll('.account-button').forEach(button => { button.disabled = value; }); },
        error(error, retry) {
            console.error('Collab document list failed:', error); root.textContent = '';
            showServiceError(root, 'Could not load documents', error.message || String(error));
            const button = doc.createElement('button'); button.className = 'btn btn-small'; button.textContent = 'Retry';
            button.onclick = () => { if (alive() && button.parentNode === root) return retry(); }; root.appendChild(button);
        },
        openError(error) {
            console.error('Collab document opening failed:', error);
            if (alive()) showServiceError(root, 'Collab connection failed', error.message || String(error));
            else showStatusMessage('Collab connection failed. Please reopen the document list to try again.');
        }
    };
}
