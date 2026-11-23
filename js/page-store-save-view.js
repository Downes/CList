function createLocalPageSaveView() {
    return {
        title: () => (window.CList.ui.view.writeTitle.innerText || window.CList.ui.view.writeTitle.textContent || '').trim(),
        saved: () => showStatusMessage('Saved to CList (local).'),
        busy: () => showStatusMessage('A local save is already running. Wait for it to finish.'),
        error(error) {
            console.error('[page-store saver] save failed', error);
            if (error.code === 'RevisionConflict') showErrorModal('This page was changed elsewhere since it was opened. Reopen it from Load → CList (local) to see the latest version before saving again.', { title:'Save conflict' });
            else showErrorModal(error.code === 'EmptyContent' ? error.message : 'Save failed: ' + error.message, { title:error.code === 'EmptyContent' ? 'Nothing to save' : 'Save failed' });
        },
        metadataError(error) {
            console.error('[page-store saver] saved, but editor metadata failed', error);
            showErrorModal('Saved locally, but editor information could not refresh: ' + error.message + '. Retry to refresh that information without saving another copy.', { title:'Page saved; editor refresh failed' });
        }
    };
}
