function createSlidesIOView() {
    return {
        async pick() {
            if (window.showOpenFilePicker) {
                const [handle] = await window.showOpenFilePicker({ types: [{ description: 'PowerPoint presentation', accept: { 'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'] } }], multiple: false });
                return handle ? handle.getFile() : null;
            }
            return new Promise(resolve => {
                const input = document.createElement('input'); input.type = 'file'; input.accept = '.pptx'; input.hidden = true;
                let settled = false;
                const finish = file => { if (settled) return; settled = true; input.remove(); resolve(file); };
                input.addEventListener('change', () => finish(input.files[0] || null), { once: true }); input.addEventListener('cancel', () => finish(null), { once: true });
                document.body.appendChild(input); input.click();
            });
        },
        progress: text => showStatusMessage(text),
        error: (stage, error) => showErrorModal(stage + ' failed: ' + error.message, { title: stage + ' failed' }),
        exported(format, result) {
            if (format === 'pdf') { showStatusMessage('Slides PDF print view opened.'); return; }
            const warnings = Array.isArray(result) ? result : [];
            showStatusMessage((format === 'html' ? 'HTML presentation downloaded.' : 'PowerPoint export downloaded.') + (warnings.length ? ' ' + warnings.join(' ') : ''));
        },
        imported(result) {
            const warnings = Array.isArray(result?.warnings) ? result.warnings : [];
            if (!warnings.length) { showStatusMessage(result.count + ' PowerPoint slides added. Use Undo to remove the import.'); return; }
            if (document.getElementById('generic-modal')) { showStatusMessage(result.count + ' PowerPoint slides added. Warnings: ' + warnings.join('; ')); return; }
            const body = document.createElement('div'), summary = document.createElement('p'), list = document.createElement('ul');
            summary.textContent = result.count + ' slides added after your existing presentation. Use Undo to remove the import. The following content could not be reproduced exactly:';
            warnings.forEach(warning => { const row = document.createElement('li'); row.textContent = String(warning); list.appendChild(row); }); body.append(summary, list);
            buildDialogModal('PowerPoint import report', body, [{ label: 'Close', onClick: close => { if (body.isConnected && document.getElementById('generic-modal')?.contains(body)) close(); } }]);
        },
        layoutWarnings(errors) { showStatusMessage('Some saved slide layouts could not load: ' + errors.map(error => error.message).join('; ')); },
    };
}
