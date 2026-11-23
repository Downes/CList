// DOM and iframe ownership only. No HTTP, accounts or credentials.
function createEtherpadConnectionView(container) {
    let root = document.getElementById('etherpadDiv');
    if (!root) { root = document.createElement('div'); root.id = 'etherpadDiv'; container.appendChild(root); }
    root.innerHTML = ''; root.style.display = 'block';
    const content = document.createElement('div'); root.appendChild(content);
    function element(tag, id, parent, text) {
        const node = document.createElement(tag); if (id) node.id = id; if (text) node.textContent = text; parent.appendChild(node); return node;
    }
    function button(text, parent) { const node = element('button', null, parent, text); node.className = 'btn-small'; return node; }
    function input(id, label, placeholder, parent) {
        const caption = element('label', null, parent, label); caption.setAttribute('for', id);
        const node = element('input', id, parent); node.type = 'text'; node.placeholder = placeholder; return node;
    }
    const listSection = element('div', 'padListSection', content);
    element('h2', null, listSection, 'Existing Pads');
    const list = element('div', 'padList', listSection), refresh = button('Refresh pads', listSection);
    const name = input('newPadName', 'Create a New Pad: ', 'Enter a new pad name', listSection);
    const create = button('Create and Load', listSection);
    const guest = element('div', 'thirdPartyEtherpadSection', listSection);
    element('h3', null, guest, 'Connect to a Third-Party Etherpad');
    const note = element('p', null, guest, 'Guest connections open the pad directly. API-backed pad lists and content features require a saved account.'); note.className = 'feed-status-message';
    const server = input('thirdPartyEtherpadUrl', 'Server address: ', 'https://pad.example.com/', guest);
    const pad = input('thirdPartyEtherpadPad', 'Pad name: ', 'their-pad-name', guest), connect = button('Connect', guest);
    const padSection = element('div', 'padContentSection', content); padSection.style.display = 'none';
    const title = element('h2', 'currentPadName', padSection, 'Pad Name'), share = button('Share', padSection);
    const iframe = element('iframe', 'padIframe', padSection); iframe.title = 'Etherpad document'; iframe.style.width = '100%'; iframe.style.height = '80vh';
    const back = button('Select Pad', padSection);
    const shareSection = element('div', 'padShareSection', content); shareSection.style.display = 'none';
    const feedback = element('div', null, content); feedback.setAttribute('role', 'status');
    let listVersion = 0;
    const current = () => root.parentNode === container && content.parentNode === root && root.isConnected;
    function error(problem, retry) {
        feedback.textContent = problem.message || String(problem); feedback.className = 'error-message';
        if (retry) { const version = listVersion, retryButton = button('Retry pad list', feedback);
            retryButton.onclick = () => { if (current() && version === listVersion && retryButton.parentNode === feedback) return retry(); }; }
    }
    return {
        current, root,
        bind(controller) {
            function bind(button, action) { button.onclick = () => { if (current() && content.contains(button)) return action(); }; }
            bind(create, () => controller.create(name.value.trim())); bind(connect, () => controller.guest(server.value.trim(), pad.value.trim(), true));
            bind(refresh, () => controller.list()); bind(share, () => controller.share()); bind(back, () => controller.showList());
        },
        loading() { listVersion++; list.textContent = 'Loading pads…'; feedback.textContent = ''; },
        pads(pads, select) {
            const version = ++listVersion; list.textContent = ''; feedback.textContent = '';
            if (!pads.length) { list.textContent = 'No pads found.'; return; }
            const ul = element('ul', null, list);
            pads.forEach(pad => { const row = element('li', null, ul), link = element('a', null, row, pad); link.href = '#';
                link.onclick = event => { event.preventDefault(); if (current() && version === listVersion && row.parentNode === ul && ul.parentNode === list && link.parentNode === row) return select(pad); }; });
        },
        noAccount() { listVersion++; list.textContent = 'No Etherpad account selected — connect to a pad below, or choose an account from the editor switcher.'; refresh.disabled = true; },
        error,
        guest(target) { listVersion++; list.textContent = 'Guest connection — API pad listing is unavailable.'; feedback.textContent = ''; refresh.disabled = true;
            iframe.src = target.url; title.textContent = 'Guest: ' + target.pad; listSection.style.display = 'none'; padSection.style.display = 'block'; },
        showList() { listSection.style.display = 'block'; padSection.style.display = 'none'; },
        reveal() { root.style.display = 'block'; },
        dispose() { iframe.src = 'about:blank'; content.remove(); },
    };
}
