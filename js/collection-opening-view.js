// Collection opening choices and feedback. No reads or writes to service storage.
let _collectionOpeningChoice = null;
window.CList.ui ||= {};
window.CList.ui.collectionOpening = {
    choose(name, label, isCurrent) {
        _collectionOpeningChoice?.();
        return new Promise(resolve => {
            let settled = false, observer;
            const message = document.createElement('p'); message.className = 'list-tip';
            message.textContent = `The current ${label} editor has unsaved content. Open "${name || 'this collection'}" in the Collection editor, or insert its entries as text?`;
            const finish = choice => {
                if (settled) return;
                settled = true; observer?.disconnect();
                if (_collectionOpeningChoice === cancel) _collectionOpeningChoice = null;
                if (message.isConnected !== false) dialog.close();
                resolve(choice);
            };
            const cancel = () => finish('cancel');
            const current = () => { try { return isCurrent(); } catch { return false; } };
            const choose = choice => { if (!settled) finish(current() ? choice : 'cancel'); };
            const dialog = buildDialogModal('Open collection', message, [
                { label: 'Open in Collection editor', onClick: () => choose('open') },
                { label: 'Insert as text', onClick: () => choose('insert') },
                { label: 'Cancel', secondary: true, onClick: cancel },
            ]);
            _collectionOpeningChoice = cancel;
            if (typeof MutationObserver !== 'undefined') {
                observer = new MutationObserver(() => { if (message.isConnected === false || !current()) cancel(); });
                observer.observe(document.body, { childList: true, subtree: true, attributes: true });
            }
        });
    },
    cancelChoice() { _collectionOpeningChoice?.(); },
    readDraft() { return typeof readActiveCollectionDraft === 'function' ? readActiveCollectionDraft() : null; },
    title(value) { const element = document.getElementById('write-title'); if (element) element.textContent = value; },
    collectionContainer() { return document.getElementById('collectionEditorDiv'); },
    returnBar(show) { if (typeof _showCollectionReturnBar === 'function') _showCollectionReturnBar(show); },
    status(text) { showStatusMessage(text); },
    error(error) { console.error('[collection opening]', error); showErrorModal('Could not open collection content: ' + (error?.message || String(error)), { title: 'Open collection failed' }); },
};
