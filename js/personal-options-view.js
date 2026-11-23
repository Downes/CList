function applyPersonalOptionsTheme(enabled) {
    document.documentElement.classList.toggle('dark-mode', enabled);
    const errors = [];
    try {
        if (window.tinymce) window.tinymce.editors.forEach(editor => {
            try {
                const doc = editor.getDoc(); if (!doc) return;
                let style = doc.getElementById('clist-dm');
                if (enabled) { if (!style) { style = doc.createElement('style'); style.id = 'clist-dm'; doc.head.appendChild(style); } style.textContent = 'body{background:#1e1e1e!important;color:#e0e0e0!important}'; }
                else if (style) style.remove();
            } catch (error) { errors.push(error); }
        });
    } catch (error) { errors.push(error); }
    return errors;
}
function createPersonalOptionsView(host) {
    const root = document.createElement('div'); root.className = 'kvcontainer';
    function button(id, text, secondary = false) { const node = document.createElement('button'); node.type = 'button'; node.id = id; node.className = 'btn-small' + (secondary ? ' btn-secondary' : ''); node.textContent = text; root.appendChild(node); return node; }
    const back = button('options-back-btn', '← Back', true), title = document.createElement('h3'); title.textContent = 'Options'; root.appendChild(title);
    const dark = button('options-dark-mode-toggle', 'Dark Mode: Off'), darkHelp = document.createElement('p'); darkHelp.textContent = 'Switch between light and dark colour schemes.'; root.appendChild(darkHelp);
    const web = button('options-webmention-toggle', 'WebMention: Off'), webHelp = document.createElement('p'); webHelp.textContent = 'When on, WebMention notifies source URLs after each publish. '; root.appendChild(webHelp);
    const spec = document.createElement('a'); spec.href = 'https://www.w3.org/TR/webmention/'; spec.textContent = 'About WebMention'; spec.target = '_blank'; spec.rel = 'noopener noreferrer'; webHelp.appendChild(spec);
    const heading = document.createElement('h3'); heading.textContent = 'Migrate Account Data'; root.appendChild(heading);
    const location = document.createElement('p'); location.textContent = 'Right now you are running CList from '; const strong = document.createElement('strong'); strong.id = 'options-current-location'; strong.textContent = host; location.appendChild(strong); root.appendChild(location);
    const instructions = document.createElement('ol'); root.appendChild(instructions);
    for (const text of ['In the old location, Export, enter your password, and save the file.', 'Register and log in at the new location.', 'In the new location, Import the file, then use the old password to unlock it.']) { const item = document.createElement('li'); item.textContent = text; instructions.appendChild(item); }
    const exportButton = button('options-export-local-account', 'Export'), importButton = button('options-import-local-account', 'Import');
    const input = document.createElement('input'); input.id = 'optionsImportLocalAccountInput'; input.type = 'file'; input.accept = 'application/json'; input.style.display = 'none'; root.appendChild(input);
    const about = document.createElement('a'); about.href = 'about.html'; about.textContent = 'About CList'; about.target = '_blank'; about.rel = 'noopener noreferrer'; root.appendChild(about);
    const feedback = document.createElement('div'); feedback.setAttribute('role', 'status'); root.appendChild(feedback);
    const current = () => { if (!root.isConnected) return false; for (let node = root; node; node = node.parentNode) if (node.style?.display === 'none' || node.hidden) return false; return true; };
    return {
        element: root, current,
        bind(controller) { back.onclick = () => current() && controller.back(); dark.onclick = () => current() && controller.toggle('dark'); web.onclick = () => current() && controller.toggle('web'); exportButton.onclick = () => current() && controller.export(); importButton.onclick = () => current() && controller.import();
            input.onchange = () => { const file = input.files?.[0]; input.value = ''; return current() && controller.file(file); }; },
        render(model) { dark.textContent = 'Dark Mode: ' + (model.dark ? 'On' : 'Off'); web.textContent = 'WebMention: ' + (model.web ? 'On' : 'Off'); dark.disabled = web.disabled = model.busy; dark.setAttribute('aria-pressed', String(model.dark)); web.setAttribute('aria-pressed', String(model.web)); },
        pickFile() { if (current()) input.click(); },
        report(text, choices = [], error = false) {
            feedback.innerHTML = ''; feedback.className = error ? 'error-message' : 'feed-status-message'; feedback.textContent = text;
            for (const [label, action] of choices) { const retry = document.createElement('button'); retry.className = 'btn-small'; retry.textContent = label; feedback.appendChild(retry); retry.onclick = () => current() && feedback.contains(retry) && action(); }
        },
    };
}
