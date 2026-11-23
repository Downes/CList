// Dropbox setup controls only. All dynamic text uses DOM properties.
function createDropboxSetupView(container) {
    container.innerHTML = ''; container.style.display = 'block';
    const root = document.createElement('div'); container.appendChild(root);
    const heading = document.createElement('h3'); heading.textContent = 'Add Dropbox Account'; root.appendChild(heading);
    const help = document.createElement('p'), link = document.createElement('a');
    link.textContent = 'Full setup instructions'; link.href = 'https://github.com/Downes/CList/wiki/B8-%E2%80%90-Add-Dropbox-to-CList'; link.target = '_blank'; link.rel = 'noopener noreferrer'; help.appendChild(link); root.appendChild(help);
    const instructions = document.createElement('p'); instructions.textContent = 'Create a Scoped Access app at dropbox.com/developers/apps. Enable files.content.write and files.content.read, then Submit. Under Settings, add this OAuth redirect URI and copy the App Key below:'; root.appendChild(instructions);
    const developer = document.createElement('a'); developer.href = 'https://www.dropbox.com/developers/apps'; developer.textContent = 'Open Dropbox app settings'; developer.target = '_blank'; developer.rel = 'noopener noreferrer'; root.appendChild(developer);
    const redirect = document.createElement('code'); redirect.textContent = window.location.origin + '/callback.html'; root.appendChild(redirect);
    const fields = {};
    for (const [key, id, label, value, placeholder] of [['title', 'dropbox-title', 'Label', 'My Dropbox', 'My Dropbox'], ['appKey', 'dropbox-app-key', 'App Key', '', 'xxxxxxxxxxxxxxx'], ['folder', 'dropbox-folder', 'Save Folder', '/CList', '/CList']]) {
        const row = document.createElement('p'), caption = document.createElement('label'), input = document.createElement('input');
        caption.textContent = label; caption.setAttribute('for', id); input.id = id; input.type = 'text'; input.value = value; input.placeholder = placeholder;
        row.append(caption, input); root.appendChild(row); fields[key] = input;
    }
    const authorize = document.createElement('button'); authorize.id = 'dropbox-auth-btn'; authorize.className = 'btn-small'; authorize.textContent = 'Authorize with Dropbox';
    const back = document.createElement('button'); back.id = 'dropbox-back-btn'; back.className = 'btn-small btn-secondary'; back.textContent = 'Back'; root.append(authorize, back);
    const feedback = document.createElement('p'); feedback.setAttribute('role', 'status'); root.appendChild(feedback);
    const current = () => root.parentNode === container && root.isConnected && container.style.display !== 'none' && Object.values(fields).every(input => input.isConnected && root.contains(input));
    return {
        current, values: () => Object.fromEntries(Object.entries(fields).map(([key, node]) => [key, node.value])),
        bind(controller) { authorize.onclick = () => { if (current() && authorize.parentNode === root) return controller.start(); };
            back.onclick = () => { if (current() && back.parentNode === root) controller.back(); };
            Object.values(fields).forEach(input => { input.oninput = () => { if (current()) controller.change(); }; }); },
        busy(value) { if (current()) authorize.disabled = value; },
        started() { if (current()) { feedback.className = 'feed-status-message'; feedback.textContent = 'Authorization started.'; } },
        error(error) { if (current()) { feedback.className = 'error-message'; feedback.textContent = error.message || String(error); } },
    };
}
