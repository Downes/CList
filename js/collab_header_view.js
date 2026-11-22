function createCollabHeaderView(menu, doc = document) {
    menu.innerHTML = '';
    const node = (tag, id) => { const element = doc.createElement(tag); element.id = id; return element; };
    const picker = node('div', 'collab-doc-picker'), input = node('input', 'collab-doc-id'); input.type = 'hidden';
    const button = (id, text, title) => { const element = node('button', id); element.className = 'btn btn-small'; element.textContent = text; element.title = title; return element; };
    const share = button('collab-invite-btn', 'Share', 'Share this document');
    const annotate = button('collab-annotate-btn', 'Annotate', 'Annotate this document');
    picker.append(input, share, annotate);
    const warning = node('div', 'collab-doc-warning'); warning.style.display = 'none';
    menu.append(picker, warning, node('div', 'collab-format-toolbar'), node('div', 'collab-who'), node('div', 'collab-status')); menu.style.display = '';
    const alive = () => !!menu.isConnected && doc.getElementById('collab-doc-picker') === picker;
    let onShare, onAnnotate;
    return {
        alive,
        bind(actions) { onShare = () => actions.share(); onAnnotate = () => actions.annotate(); share.onclick = onShare; annotate.onclick = onAnnotate; },
        busy(value) { if (alive()) { share.disabled = value; annotate.disabled = value; } },
        reveal() {
            if (typeof snapPanes === 'function' && typeof mainContent !== 'undefined' && typeof readPane !== 'undefined') {
                const width = mainContent.getBoundingClientRect().width;
                if (width && readPane.getBoundingClientRect().width / width > 0.65) snapPanes('left');
            }
        },
        error(action, error) {
            console.error('Collab ' + action + ' action failed:', error);
            showErrorModal(error.message || String(error), { title: action === 'share' ? 'Could not share document' : 'Could not annotate document' });
        },
        dispose() { if (share.onclick === onShare) share.onclick = null; if (annotate.onclick === onAnnotate) annotate.onclick = null; }
    };
}
