function createCollabFormatView(doc = document) {
    const bar = doc.getElementById('collab-format-toolbar');
    const alive = () => !!bar?.isConnected && doc.getElementById('collab-format-toolbar') === bar;
    let buttons = [];
    return {
        alive,
        mount(definitions, select) {
            bar.textContent = ''; buttons = definitions.map((definition, index) => {
                const button = doc.createElement('button'); button.className = 'btn btn-small';
                button.textContent = definition.label; button.title = definition.title;
                button.onclick = () => { if (alive() && button.parentNode === bar) return select(index); };
                bar.appendChild(button); return button;
            });
        },
        update(active, enabled) {
            if (!alive()) return;
            buttons.forEach((button, index) => {
                button.disabled = !enabled; button.classList.toggle('is-active', !!active[index]);
                button.setAttribute('aria-pressed', String(!!active[index]));
            });
        },
        error(error) { console.error('Collab formatting failed:', error); showStatusMessage('Collab formatting failed. Please try again.'); }
    };
}
