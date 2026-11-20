// Dropbox save controls and feedback. Controllers supply all operations and guards.
const _dropboxSaveViews = new WeakMap();
window.CList.ui ||= {};
window.CList.ui.dropboxSave = {
    mount(target = document.getElementById('save-options')) {
        if (!target || target.isConnected === false) throw new Error('Dropbox save controls are unavailable.');
        const previous = _dropboxSaveViews.get(target);
        previous?.cancelChoice?.();
        previous?.root.remove();
        const root = document.createElement('div');
        root.id = 'dropbox-save-status'; root.className = 'feed-status-message';
        target.appendChild(root);
        const view = { root, cancelChoice: null };
        _dropboxSaveViews.set(target, view);
        return view;
    },
    progress(view, text) {
        view.cancelChoice?.();
        if (view.root.isConnected === false) return;
        view.root.className = 'feed-status-message'; view.root.textContent = text;
    },
    error(view, error) {
        console.error('[Dropbox save]', error);
        view.cancelChoice?.();
        if (view.root.isConnected === false) return;
        view.root.className = 'error-message';
        view.root.textContent = 'Save failed: ' + (error?.message || String(error));
    },
    saved(view, receipt) {
        const name = receipt?.path_display || receipt?.path || receipt?.name;
        this.progress(view, name ? 'Saved: ' + name : 'Saved to Dropbox.');
    },
    chooseOverwrite(view, filename, isCurrent = () => true) {
        view.cancelChoice?.();
        return new Promise(resolve => {
            const root = view.root;
            let settled = false, observer = null;
            const buttons = [];
            const current = () => {
                if (root.isConnected === false) return false;
                try { return isCurrent() !== false; } catch { return false; }
            };
            const finish = result => {
                if (settled) return;
                settled = true; observer?.disconnect();
                buttons.forEach(button => { button.disabled = true; });
                if (view.cancelChoice === cancel) view.cancelChoice = null;
                resolve(result);
            };
            const cancel = () => finish('cancel');
            view.cancelChoice = cancel;
            if (!current()) { cancel(); return; }
            root.innerHTML = ''; root.className = 'feed-status-message';
            const title = document.createElement('p'); title.className = 'list-tip-title';
            title.textContent = `Overwrite "${filename}"?`;
            const message = document.createElement('p'); message.className = 'list-tip';
            message.textContent = `"${filename}" already exists in Dropbox.`;
            const row = document.createElement('div'); row.className = 'published-page-confirm';
            for (const [label, result] of [['Overwrite', 'overwrite'], ['Cancel', 'cancel']]) {
                const button = document.createElement('button');
                button.className = 'btn btn-small' + (result === 'cancel' ? ' btn-secondary' : '');
                button.textContent = label;
                button.onclick = () => { if (!settled) finish(current() ? result : 'cancel'); };
                row.appendChild(button); buttons.push(button);
            }
            root.appendChild(title); root.appendChild(message); root.appendChild(row);
            if (typeof MutationObserver !== 'undefined') {
                observer = new MutationObserver(() => { if (!current()) cancel(); });
                observer.observe(document.body, { childList: true, subtree: true, attributes: true });
            }
        });
    },
};
