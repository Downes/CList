function createBloggerSetupView(container) {
    container.innerHTML = ''; container.style.display = 'block';
    const root = document.createElement('div'); container.appendChild(root);
    const heading = document.createElement('h3'); heading.textContent = 'Add Blogger Account'; root.appendChild(heading);
    const fields = {};
    for (const [key, id, label, placeholder] of [['blogId', 'blogger-blog-id', 'Blog ID', '1234567890'], ['clientId', 'blogger-client-id', 'Client ID', '123456.apps.googleusercontent.com'], ['title', 'blogger-title', 'Blog Title', 'My Blog']]) {
        const row = document.createElement('p'), caption = document.createElement('label'), input = document.createElement('input');
        caption.textContent = label; caption.setAttribute('for', id); input.id = id; input.type = 'text'; input.value = ''; input.placeholder = placeholder;
        row.append(caption, input); root.appendChild(row); fields[key] = input;
    }
    function button(parent, id, label, secondary = false) {
        const node = document.createElement('button'); node.id = id; node.className = 'btn-small' + (secondary ? ' btn-secondary' : ''); node.textContent = label; parent.appendChild(node); return node;
    }
    const save = button(root, 'blogger-save-btn', 'Save Account'), back = button(root, 'blogger-back-btn', 'Back', true);
    const details = document.createElement('details'), summary = document.createElement('summary'); summary.textContent = 'How to set up a Blogger account'; details.appendChild(summary); root.appendChild(details);
    const list = document.createElement('ol'); details.appendChild(list);
    for (const [text, href, linkLabel] of [
        ['Open your blog. Its dashboard URL contains blogID=XXXXXXXXXX; paste those digits above.', 'https://www.blogger.com', 'Blogger dashboard'],
        ['Create a Google Cloud project.', 'https://console.cloud.google.com/projectcreate', 'Create project'],
        ['Enable the Blogger API v3 for that project.', 'https://console.cloud.google.com/apis/library/blogger.googleapis.com', 'Enable Blogger API'],
        ['Create an OAuth client ID for a Web application.', 'https://console.cloud.google.com/apis/credentials', 'Credentials'],
        ['Under Authorized JavaScript origins, add:', null, null],
        ['Copy the Client ID into the field above.', null, null],
        ['Under Test users, add your own Google email address.', 'https://console.cloud.google.com/auth/audience', 'Audience'],
    ]) {
        const item = document.createElement('li'); item.textContent = text; list.appendChild(item);
        if (href) { const link = document.createElement('a'); link.href = href; link.textContent = linkLabel; link.target = '_blank'; link.rel = 'noopener noreferrer'; item.textContent = text + ' '; item.appendChild(link); }
        if (text.endsWith('add:')) { const code = document.createElement('code'); code.textContent = window.location.origin; item.appendChild(code); }
    }
    const feedback = document.createElement('div'); feedback.setAttribute('role', 'status'); root.appendChild(feedback);
    const current = () => root.isConnected && root.parentNode === container && container.style.display !== 'none';
    const status = createAccountSetupFeedback(feedback, current, button);
    return {
        current, capture() {
            const values = Object.fromEntries(Object.entries(fields).map(([key, input]) => [key, input.value]));
            return { values, current: () => current() && Object.entries(values).every(([key, value]) => fields[key].isConnected && fields[key].value === value) };
        },
        bind(controller) { save.onclick = () => current() && controller.manual(); back.onclick = () => current() && controller.back(); },
        busy(value) { if (current()) save.disabled = value; }, ...status,
    };
}
