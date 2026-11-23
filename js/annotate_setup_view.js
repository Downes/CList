function createAnnotateSetupView(container, defaultServer) {
    container.innerHTML = ''; container.style.display = 'block';
    const root = document.createElement('div'); container.appendChild(root);
    const heading = document.createElement('h3'); heading.textContent = 'Add Annotation Server'; root.appendChild(heading);
    const label = document.createElement('label'); label.textContent = 'Server'; label.setAttribute('for', 'anno-server-select'); root.appendChild(label);
    const select = document.createElement('select'); select.id = 'anno-server-select'; root.appendChild(select);
    if (defaultServer) { const option = document.createElement('option'); option.value = defaultServer; option.textContent = defaultServer; select.appendChild(option); }
    const custom = document.createElement('option'); custom.value = '__custom__'; custom.textContent = 'Custom…'; select.appendChild(custom); select.value = defaultServer || '__custom__';
    const url = document.createElement('input'); url.id = 'anno-custom-url'; url.type = 'url'; url.value = ''; url.placeholder = 'https://annotations.example.com'; root.appendChild(url);
    const fields = {};
    for (const [key, id, title, initial] of [['title', 'anno-title', 'Title', ''], ['permissions', 'anno-perms', 'Permissions', 'rw']]) {
        const caption = document.createElement('label'), input = document.createElement('input'); caption.textContent = title; caption.setAttribute('for', id); input.id = id; input.type = 'text'; input.value = initial; root.append(caption, input); fields[key] = input;
    }
    function button(parent, id, title, secondary = false) { const node = document.createElement('button'); node.id = id; node.className = 'btn-small' + (secondary ? ' btn-secondary' : ''); node.textContent = title; parent.appendChild(node); return node; }
    const add = button(root, 'anno-add-btn', 'Add Account'), back = button(root, 'anno-back-btn', 'Back', true);
    const feedback = document.createElement('div'); feedback.id = 'anno-status'; feedback.setAttribute('role', 'status'); root.appendChild(feedback);
    const current = () => root.isConnected && root.parentNode === container && container.style.display !== 'none' && [select, url, ...Object.values(fields)].every(node => node.isConnected);
    const status = createAccountSetupFeedback(feedback, current, button);
    function visibility() { url.style.display = select.value === '__custom__' ? 'block' : 'none'; } visibility();
    return {
        current, capture() {
            const selected = select.value, raw = url.value, title = fields.title.value, permissions = fields.permissions.value;
            return { values: { url: selected === '__custom__' ? raw : selected, title, permissions }, current: () => current() && selected === select.value && raw === url.value && title === fields.title.value && permissions === fields.permissions.value };
        },
        bind(controller) {
            add.onclick = () => current() && controller.connect(); back.onclick = () => current() && controller.back();
            select.onchange = () => { if (current()) { visibility(); controller.changed?.(); } };
            [url, ...Object.values(fields)].forEach(input => { input.oninput = () => { if (current()) controller.edit?.(); }; });
            url.onchange = () => { if (current()) controller.changed?.(); };
        },
        busy(value) { if (current()) add.disabled = value; }, ...status,
        registrationFailure(error, receipt, retry, guard) {
            status.error(new Error((receipt === 'accepted' ? 'Server registration accepted. ' : receipt === 'uncertain' ? 'Registration outcome is unknown. Check the server before retrying. ' : '') + error.message));
            const action = button(feedback, '', receipt === 'uncertain' ? 'Retry registration after checking server' : receipt === 'accepted' ? 'Continue account save' : 'Retry registration');
            action.onclick = () => current() && feedback.contains(action) && guard() && retry();
        },
    };
}
