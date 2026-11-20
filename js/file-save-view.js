// Filename choice and local-save feedback. No editor export or metadata writes.
function chooseLocalFileDownload(content, suggestedName, assertCurrent = () => {}) {
    return new Promise((resolve, reject) => {
        const input = document.createElement('input');
        input.type = 'text'; input.value = suggestedName || 'content.txt';
        let settled = false, observer = null;
        const finish = (close, result) => {
            if (settled) return;
            settled = true; observer?.disconnect();
            if (input.isConnected !== false) close();
            resolve(result);
        };
        const download = close => {
            if (input.isConnected === false) { finish(() => {}, { status: 'cancelled' }); return; }
            if (settled || !input.value.trim()) return;
            try {
                assertCurrent();
                const name = input.value.trim();
                downloadBlob(new Blob([content], { type: 'text/plain' }), name);
                finish(close, { status: 'downloaded', name });
            } catch (error) { settled = true; observer?.disconnect(); close(); reject(error); }
        };
        const dialog = buildDialogModal('Save file', input, [
            { label: 'Cancel', secondary: true, onClick: close => finish(close, { status: 'cancelled' }) },
            { label: 'Save', onClick: download },
        ]);
        // Other application panels can replace the shared modal. Release the busy
        // operation, and never let its detached Save button start a later download.
        if (typeof MutationObserver !== 'undefined') {
            observer = new MutationObserver(() => {
                if (!input.isConnected) finish(() => {}, { status: 'cancelled' });
            });
            observer.observe(document.body, { childList: true, subtree: true });
        }
        input.addEventListener('keydown', event => {
            if (event.key === 'Enter') { event.preventDefault(); download(dialog.close); }
            if (event.key === 'Escape') { event.preventDefault(); finish(dialog.close, { status: 'cancelled' }); }
        });
        input.focus(); input.select();
    });
}

function showLocalFileSaveResult(result) {
    if (result.status === 'cancelled') return;
    showStatusMessage(result.status === 'downloaded'
        ? 'File download requested — check your downloads folder.' : 'File saved successfully.');
    if (result.metadataError) {
        console.error('[saveContent] My Pages indexing failed', result.metadataError);
        showErrorModal('The file save completed, but My Pages could not be updated: ' + result.metadataError.message,
            { title: 'My Pages Update Failed' });
    } else if (result.forked) {
        showStatusMessage('Saved locally as a new, derived copy in My Pages.');
    }
}
