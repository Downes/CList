// Dropbox file-picker rendering. Controllers supply data and action callbacks.
window.CList.ui ||= {};
window.CList.ui.dropboxPicker = {
    mount(cancel) {
        const container = window.CList.ui.view.loadOptions;
        if (!container) throw new Error('Load controls are unavailable.');
        container.replaceChildren();
        const root = document.createElement('div'); root.className = 'dropbox-file-picker';
        const body = document.createElement('div'); root.appendChild(body);
        const button = document.createElement('button'); button.className = 'btn btn-secondary';
        button.textContent = 'Cancel'; button.onclick = cancel; root.appendChild(button);
        container.appendChild(root);
        return { root, body };
    },
    message(view, text, error = false) {
        view.body.replaceChildren();
        const message = document.createElement('p'); message.className = error ? 'error-message' : 'list-tip';
        message.textContent = text; view.body.appendChild(message);
    },
    files(view, files, busy, selected, choose, error) {
        view.body.replaceChildren();
        const tip = document.createElement('p'); tip.className = 'list-tip'; tip.textContent = 'Choose a file to load';
        view.body.appendChild(tip);
        const list = document.createElement('div'); list.className = 'account-list';
        for (const file of files) {
            const button = document.createElement('button'); button.className = 'account-button'; button.disabled = busy;
            const icon = document.createElement('span'); icon.className = 'material-icons';
            const format = _detectFormat('', file.name);
            icon.textContent = busy && selected === file ? 'hourglass_top'
                : format === 'html' ? 'article' : ['opml', 'rss', 'json'].includes(format) ? 'list_alt' : 'description';
            const label = document.createElement('span'); label.textContent = busy && selected === file ? 'Loading…' : file.name;
            button.appendChild(icon); button.appendChild(label); button.onclick = () => choose(file); list.appendChild(button);
        }
        view.body.appendChild(list);
        if (error) {
            const message = document.createElement('p'); message.className = 'error-message'; message.textContent = error;
            view.body.appendChild(message);
        }
    },
    close(view) { view.root.remove(); },
    error(error) { console.error('[Dropbox picker]', error); showStatusMessage(error.message || String(error)); },
};
