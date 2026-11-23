function createCollabSetupView(container) {
    container.innerHTML = ''; container.style.display = 'block';
    const root = document.createElement('div'); container.appendChild(root);
    const title = document.createElement('h3'); title.textContent = 'Add Collab Server'; root.appendChild(title);
    const label = document.createElement('label'); label.textContent = 'WebSocket URL'; label.setAttribute('for', 'collab-ws-input'); root.appendChild(label);
    const input = document.createElement('input'); input.id = 'collab-ws-input'; input.type = 'text'; input.value = 'wss://collab.mooc.ca'; input.placeholder = input.value; root.appendChild(input);
    function button(parent, id, text, secondary = false) { const node = document.createElement('button'); node.id = id; node.className = 'btn-small' + (secondary ? ' btn-secondary' : ''); node.textContent = text; parent.appendChild(node); return node; }
    const connect = button(root, 'collab-connect-btn', 'Connect & Register'), back = button(root, 'collab-back-btn', 'Back', true);
    const feedback = document.createElement('div'); feedback.id = 'collab-register-status'; feedback.setAttribute('role', 'status'); root.appendChild(feedback);
    const current = () => root.isConnected && root.parentNode === container && container.style.display !== 'none' && input.isConnected;
    const status = createAccountSetupFeedback(feedback, current, button);
    return {
        current, capture() { const url = input.value; return { values: { url }, current: () => current() && input.value === url }; },
        bind(controller) { connect.onclick = () => current() && controller.connect(); back.onclick = () => current() && controller.back(); },
        busy(value) { if (current()) connect.disabled = value; }, ...status,
        registrationFailure(error, receipt, retry, guard) {
            status.error(new Error((receipt === 'accepted' ? 'Server registration accepted. ' : receipt === 'uncertain' ? 'Registration outcome is unknown. Check the server before retrying. ' : '') + error.message));
            const action = button(feedback, '', receipt === 'uncertain' ? 'Retry registration after checking server' : receipt === 'accepted' ? 'Continue account save' : 'Retry registration');
            action.onclick = () => current() && feedback.contains(action) && guard() && retry();
        },
    };
}
