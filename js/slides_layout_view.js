// Shared dialog shell with owned close/observer and literal content.
function createSlidesLayoutView(kind, layout, actions) {
    const body = document.createElement('div'), name = document.createElement('input'), message = document.createElement('p');
    name.type = 'text'; name.maxLength = 120; name.value = layout.label || '';
    const label = document.createElement('label'); label.textContent = 'Layout name'; label.appendChild(name);
    if (kind !== 'delete') body.appendChild(label);
    const description = document.createElement('p'); description.textContent = kind === 'delete' ? 'Remove “' + layout.label + '” from your saved layouts?' : kind === 'save' ? 'Preserves this slide’s objects, text, images, background, and notes.' : 'Rename this saved layout.'; body.appendChild(description);
    message.hidden = true; body.appendChild(message);
    const dialog = buildDialogModal(kind === 'save' ? 'Save slide as layout' : kind === 'delete' ? 'Delete saved layout' : 'Rename saved layout', body, [
        { label: 'Cancel', secondary: true, onClick: () => actions.cancel() },
        { label: kind === 'save' ? 'Save layout' : kind === 'delete' ? 'Delete layout' : 'Rename layout', onClick: () => actions.submit() },
    ]);
    const modal = document.getElementById('generic-modal');
    const current = () => body.isConnected && modal === document.getElementById('generic-modal') && modal?.contains(body);
    if (kind !== 'delete') { name.focus(); name.select(); }
    return {
        current, title: () => name.value,
        close() { if (current()) dialog.close(); },
        busy(value) { if (current()) dialog.buttons.forEach(button => { button.disabled = value; }); },
        action(text) { if (current()) dialog.buttons[1].textContent = text; },
        message(text) { if (current()) { message.hidden = false; message.className = 'feed-status-message'; message.textContent = text; } },
        error(error) { if (current()) { message.hidden = false; message.className = 'error-message'; message.textContent = error.message || String(error); } },
        watch(expire) { if (typeof MutationObserver !== 'function') return () => {}; const observer = new MutationObserver(expire); observer.observe(document.body, { childList: true, subtree: true }); return () => observer.disconnect(); },
    };
}
