function createP2pControlView(doc = document) {
    const root = doc.getElementById('chat-messages');
    return {
        alive: () => !!root?.isConnected && doc.getElementById('chat-messages') === root,
        current: handle => !!handle.row.isConnected && handle.row.parentNode === root,
        join(model, follow) {
            const row = doc.createElement('div'); row.className = 'chat-event';
            const text = doc.createElement('span'); text.textContent = model.username + (model.did ? ' (DID)' : '') + ' has joined the discussion'; row.appendChild(text);
            let button = null;
            if (model.canFollow) {
                button = doc.createElement('button'); button.type = 'button'; button.className = 'clist-action-btn'; button.title = 'Follow this person';
                const icon = doc.createElement('span'); icon.className = 'material-icons md-18 md-light'; icon.textContent = 'person_add'; button.appendChild(icon);
                button.onclick = () => follow(button); row.appendChild(button);
            }
            root.appendChild(row); return { row, button, text: text.textContent };
        },
        busy(handle, value) { if (handle.button) handle.button.disabled = value; },
        followed(handle) { if (handle.button) { handle.button.title = 'Following'; handle.button.disabled = true; handle.button.querySelector('span').textContent = 'how_to_reg'; } },
        expire(handle) { if (handle.button) { handle.button.disabled = true; handle.button.onclick = null; } },
        event(text) { const row = doc.createElement('div'); row.className = 'chat-event'; row.textContent = text; root.appendChild(row); },
        error(error) { showServiceError(root, 'Chat control failed', error.message || String(error)); }
    };
}
