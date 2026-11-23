function createWordPressSetupView(container) {
    container.innerHTML = ''; container.style.display = 'block';
    const root = document.createElement('div'); container.appendChild(root);
    const heading = document.createElement('h3'); heading.textContent = 'Add WordPress Account'; root.appendChild(heading);
    const label = document.createElement('label'); label.textContent = 'Site URL'; label.setAttribute('for', 'wp-site-url'); root.appendChild(label);
    const input = document.createElement('input'); input.type = 'url'; input.id = 'wp-site-url'; input.value = ''; input.placeholder = 'https://your-site.com'; root.appendChild(input);
    const help = document.createElement('p'); help.textContent = 'Enter your WordPress installation URL. WordPress will ask you to approve an application password and return you to CList.'; root.appendChild(help);
    const authorize = document.createElement('button'); authorize.id = 'wp-auth-btn'; authorize.className = 'btn-small'; authorize.textContent = 'Authorize with WordPress';
    const back = document.createElement('button'); back.id = 'wp-back-btn'; back.className = 'btn-small btn-secondary'; back.textContent = 'Back'; root.append(authorize, back);
    const feedback = document.createElement('p'); feedback.setAttribute('role', 'status'); root.appendChild(feedback);
    const current = () => root.isConnected && root.parentNode === container && container.style.display !== 'none' && input.isConnected && root.contains(input);
    const message = (text, error = false) => { if (current()) { feedback.className = error ? 'error-message' : 'feed-status-message'; feedback.textContent = text; } };
    return {
        current, capture() { const value = input.value; return { value, current: () => current() && input.value === value }; },
        bind(controller) { authorize.onclick = () => current() && controller.authorize(); back.onclick = () => current() && controller.back(); },
        busy(value) { if (current()) authorize.disabled = value; }, message, error: error => message(error.message, true),
    };
}
