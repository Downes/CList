function createTemplateFormView(doc = document, ui = window.CList.ui.view) {
    const container = ui.loadOptions;
    if (!container?.isConnected) throw Error('The Load panel is no longer available.');
    const root = doc.createElement('div'); root.id = 'generate-template-form';
    const label = (text, id) => { const node = doc.createElement('label'); node.textContent = text; node.htmlFor = id; root.appendChild(node); root.appendChild(doc.createElement('br')); };
    const select = (id, choices) => {
        const node = doc.createElement('select'); node.id = id;
        for (const [value, text] of choices) { const option = doc.createElement('option'); option.value = value; option.textContent = text; node.appendChild(option); }
        node.value = choices[0][0]; root.appendChild(node); root.appendChild(doc.createElement('br')); root.appendChild(doc.createElement('br')); return node;
    };
    label('Choose a template type:', 'templateType');
    const type = select('templateType', [['business letter','Business Letter'],['case study','Case Study'],['lab report','Lab Report'],['resume','Resume'],['newsletter','Newsletter']]);
    label('Or enter your own template type:', 'customTemplateType');
    const custom = doc.createElement('input'); custom.id = 'customTemplateType'; custom.type = 'text'; custom.placeholder = 'e.g., marketing proposal'; root.appendChild(custom); root.appendChild(doc.createElement('br'));
    label('Choose output format:', 'outputFormat'); const format = select('outputFormat', [['text','Text'],['html','HTML']]);
    const generate = doc.createElement('button'); generate.id = 'generateTemplateButton'; generate.className = 'btn final-save-button'; generate.textContent = 'Generate Template';
    const back = doc.createElement('button'); back.id = 'generateTemplateBackBtn'; back.className = 'btn btn-secondary final-save-button'; back.textContent = 'Back';
    const status = doc.createElement('p'); status.className = 'feed-status-message'; root.append(generate, back, status);
    const read = () => ({ type: type.value, custom: custom.value || '', format: format.value });
    const alive = () => !!root.isConnected && root.parentNode === container && ui.loadOptions === container;
    return {
        alive, initial: read,
        mount(commands) {
            container.textContent = ''; container.appendChild(root);
            const changed = () => commands.change(read());
            for (const node of [type, custom, format]) { node.oninput = changed; node.onchange = changed; }
            generate.onclick = event => { event?.preventDefault(); commands.submit(read()); };
            back.onclick = event => { event?.preventDefault(); commands.cancel(true); };
        },
        watch(expire) {
            if (typeof MutationObserver !== 'function') return () => {};
            const observer = new MutationObserver(expire); observer.observe(doc.body, { childList: true, subtree: true });
            return () => observer.disconnect();
        },
        busy(value) { generate.disabled = value; status.className = 'feed-status-message'; status.textContent = value ? 'Generating template... Please wait.' : ''; },
        error(error) { console.error('Could not generate template:', error); status.className = 'template-error error-message'; status.textContent = 'Could not generate template: ' + (error.message || String(error)); },
        remove() { root.remove(); }
    };
}
