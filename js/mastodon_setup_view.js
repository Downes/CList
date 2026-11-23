function createMastodonSetupView(container) {
    container.innerHTML = ''; container.style.display = 'block';
    const root = document.createElement('div'); container.appendChild(root);
    const heading = document.createElement('h3'); heading.textContent = 'Add Mastodon Account'; root.appendChild(heading);
    const fields = {};
    function field(parent, key, id, label, type, value = '') {
        const row = document.createElement('p'), caption = document.createElement('label'), input = document.createElement('input');
        caption.textContent = label; caption.setAttribute('for', id); input.id = id; input.type = type; input.value = value;
        row.append(caption, input); parent.appendChild(row); fields[key] = input;
    }
    function button(parent, id, label, secondary = false) {
        const node = document.createElement('button'); node.id = id; node.className = 'btn-small' + (secondary ? ' btn-secondary' : ''); node.textContent = label; parent.appendChild(node); return node;
    }
    field(root, 'username', 'mastodon-username-input', 'Username (you@instance.social)', 'text');
    const authorize = button(root, 'mastodon-auth-btn', 'Authorize with Mastodon'), back = button(root, 'mastodon-back-btn', 'Back', true);
    const details = document.createElement('details'), summary = document.createElement('summary'); summary.textContent = 'Advanced: enter access token manually'; details.appendChild(summary); root.appendChild(details);
    const help = document.createElement('p'); help.textContent = 'Get a token from your instance under Settings → Development → New Application. Grant read and write scopes.'; details.appendChild(help);
    field(details, 'title', 'mastodon-manual-title', 'Title', 'text');
    field(details, 'permissions', 'mastodon-manual-permissions', 'Permissions', 'text', 'rw');
    field(details, 'token', 'mastodon-manual-token', 'Access token', 'password');
    const save = button(details, 'mastodon-manual-save-btn', 'Save Account'), feedback = document.createElement('div'); feedback.setAttribute('role', 'status'); root.appendChild(feedback);
    const current = () => root.isConnected && root.parentNode === container && container.style.display !== 'none';
    const values = () => Object.fromEntries(Object.entries(fields).map(([key, input]) => [key, input.value]));
    const status = createAccountSetupFeedback(feedback, current, button);
    return {
        current, capture() { const captured = values(); return { values: captured, current: () => current() && Object.entries(captured).every(([key, value]) => fields[key].isConnected && fields[key].value === value) }; },
        bind(controller) { authorize.onclick = () => current() && controller.authorize(); save.onclick = () => current() && controller.manual(); back.onclick = () => current() && controller.back(); },
        busy(value) { if (current()) { authorize.disabled = value; save.disabled = value; } },
        ...status,
    };
}
