// Startup has no assumed login state. Recovery uses the application's modal shell.
(function () {
    let timer, root = null, stage = 'scripts';
    const dismiss = () => {
        // Never close a newer dialog that replaced our recovery panel.
        if (root?.isConnected) root.closest('#generic-modal')?.remove();
        root = null;
    };
    const addReset = panel => {
        const note = document.createElement('p');
        note.textContent = 'Reset signs you out but keeps local pages, accounts, preferences and editor drafts.';
        panel.appendChild(note);
        const reset = document.createElement('button');
        reset.className = 'btn-small';
        reset.textContent = 'Reset session and reload';
        reset.onclick = () => {
            if (!panel.isConnected) return;
            if (typeof sessionLifecycle !== 'function') {
                note.textContent = 'Startup scripts have not loaded. Try Reload; no saved data has been cleared.';
                return;
            }
            sessionLifecycle().logout({ preserveDrafts: true });
        };
        panel.appendChild(reset);
        const reload = document.createElement('button');
        reload.className = 'btn-small btn-secondary';
        reload.textContent = 'Reload';
        reload.onclick = () => { if (panel.isConnected) window.location.reload(); };
        panel.appendChild(reload);
    };
    const show = () => {
        // The shell loads last; wait for it instead of rendering an inline error.
        if (typeof showModal !== 'function') { timer = setTimeout(show, 250); return; }
        root = document.createElement('div');
        const title = document.createElement('h2');
        title.className = 'error-modal-title';
        title.textContent = stage === 'features' ? 'Application tools are taking longer than expected' : stage === 'accounts' ? 'Account loading is taking longer than expected' : stage === 'key' ? 'Session key loading is taking longer than expected' : 'Startup scripts are taking longer than expected';
        root.appendChild(title);
        addReset(root);
        const close = document.createElement('button');
        close.className = 'btn-small btn-secondary';
        close.textContent = 'Close';
        close.onclick = dismiss;
        root.appendChild(close);
        showModal(root, { hideDefaultClose: true });
    };
    const update = (phase, nextStage) => {
        stage = nextStage || stage;
        clearTimeout(timer);
        dismiss();
        if (phase === 'restoring') timer = setTimeout(show, 5000);
        // Actual failures use the existing failed view with the same reset controls.
    };
    window.CList.ui.startupRecovery = { update, addReset };
    update('restoring');
})();
