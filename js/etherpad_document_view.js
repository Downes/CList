// Captured document controls, literal Share card and local feedback.
function createEtherpadDocumentView(connection) {
    const root = connection.root, iframe = root.querySelector('#padIframe'), title = root.querySelector('#currentPadName');
    const list = root.querySelector('#padListSection'), content = root.querySelector('#padContentSection'), name = root.querySelector('#newPadName');
    const feedback = document.createElement('div'); feedback.setAttribute('role', 'status'); root.appendChild(feedback);
    const current = () => connection.current() && iframe.parentNode === content && feedback.parentNode === root;
    return {
        busy(busy) { if (current()) root.querySelectorAll('button').forEach(button => {
            if (['Create and Load', 'Share'].includes(button.textContent)) button.disabled = busy;
        }); },
        error(error) { if (current()) { feedback.className = 'error-message'; feedback.textContent = error.message || String(error); } },
        opened(model) { if (current()) { iframe.src = model.url; title.textContent = model.label; list.style.display = 'none'; content.style.display = 'block'; feedback.textContent = ''; } },
        clearName(value) { if (current() && name.value.trim() === value) name.value = ''; },
        share(url, pad) {
            if (!current()) return;
            if(typeof openEditorSharing==='function'){openEditorSharing(editorHandlers.etherpad.getSharing()).catch(error=>{console.error('Etherpad sharing:',error);showStatusMessage(error.message)});return;}
            const card = document.createElement('div'), heading = document.createElement('p'), link = document.createElement('a');
            heading.textContent = 'Share Etherpad: ' + pad; link.href = url; link.textContent = url; link.target = '_blank'; link.rel = 'noopener noreferrer';
            card.appendChild(heading); card.appendChild(link); showModal(card);
        },
    };
}
// Legacy optional controls read here, never in transport/workflows.
async function runEtherpadInputAction(kind) {
    const owner = _etherpadConnection, selectedPad = padName;
    const node = document.getElementById(kind === 'author' ? 'userNameInput' : 'inputContent');
    const value = node?.value || '';
    const api = etherpadDocuments();
    const result = await (kind === 'author' ? api.author(value) : api.appendText(value));
    if (node?.isConnected && node.value === value && _etherpadConnection === owner && owner.controller.active()
        && currentEditor === 'etherpad' && padName === selectedPad) node.value = '';
    return result;
}
async function displayEtherpadExtract() {
    const format = document.getElementById('formatSelect'), output = document.getElementById('extractedContent');
    const selected = format?.value, previous = output?.value, owner = _etherpadConnection, selectedPad = padName;
    const value = await etherpadDocuments().read(selected);
    if (_etherpadConnection === owner && owner.controller.active() && currentEditor === 'etherpad' && padName === selectedPad
        && format?.isConnected && output?.isConnected
        && format.value === selected && output.value === previous) output.value = value;
    return value;
}
