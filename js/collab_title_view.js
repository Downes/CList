function createCollabTitleView(doc = document, ui = window.CList.ui.view) {
    const input = doc.getElementById('collab-doc-id'), warning = doc.getElementById('collab-doc-warning'), title = ui.writeTitle;
    const alive = () => !!input?.isConnected && !!warning?.isConnected && doc.getElementById(input.id) === input && doc.getElementById(warning.id) === warning && (!title || (title.isConnected && ui.writeTitle === title));
    const hide = () => { warning.textContent = ''; warning.style.display = 'none'; warning.classList.remove('error-message'); };
    return {
        alive, read: () => input.value.trim(), hide,
        bind(actions) {
            const change = () => { if (alive() && actions.current()) actions.schedule(); };
            const sync = () => { if (alive() && actions.current()) { input.value = title.textContent.trim(); actions.schedule(); } };
            const enter = event => { if (event.key === 'Enter' && alive() && actions.current()) { event.preventDefault(); actions.enter(); } };
            const paste = event => { if (alive() && actions.current()) { const text = event.clipboardData.getData('text').trim(); if (actions.isUrl(text)) { event.preventDefault(); actions.paste(text); } } };
            input.addEventListener('input', change); input.addEventListener('keydown', enter);
            title?.addEventListener('input', sync); title?.addEventListener('paste', paste);
            return () => { input.removeEventListener('input', change); input.removeEventListener('keydown', enter); title?.removeEventListener('input', sync); title?.removeEventListener('paste', paste); };
        },
        exists(hasContent, load) {
            hide(); warning.style.display = 'block';
            const text = doc.createElement('span'); text.textContent = 'Document already exists. '; warning.appendChild(text);
            if (hasContent) { const strong = doc.createElement('strong'); strong.textContent = 'Your current content will be lost. '; warning.appendChild(strong); }
            const button = doc.createElement('button'); button.id = 'collab-load-existing'; button.className = 'btn btn-small'; button.textContent = 'Load it';
            button.onclick = () => { if (alive() && button.parentNode === warning) return load(); }; warning.appendChild(button);
        },
        normalize(value) { input.value = value; if (title) title.textContent = value; },
        error(error, retry) {
            console.error('Collab title action failed:', error); hide(); warning.style.display = 'block'; warning.classList.add('error-message');
            const text = doc.createElement('span'); text.textContent = error.message || String(error); warning.appendChild(text);
            const button = doc.createElement('button'); button.className = 'btn btn-small'; button.textContent = 'Retry';
            button.onclick = () => { if (alive() && button.parentNode === warning) return retry(); }; warning.appendChild(button);
        }
    };
}
