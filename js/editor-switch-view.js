// Editor switching UI. Rendered controls receive callbacks, never account credentials.
window.CList.ui.editorSwitch = {
    shell() {
        if (document.getElementById('editor-switch-options')) return;
        const root = document.getElementById('editor-instructions');
        if (!root) return;
        const list = document.createElement('div'); list.className = 'account-list';
        const tip = document.createElement('div'); tip.className = 'list-tip';
        tip.textContent = 'Select an editor to use'; list.appendChild(tip);
        for (const id of ['editor-switch-options', 'editor-switch-account-options']) {
            const container = document.createElement('div'); container.id = id; list.appendChild(container);
        }
        root.appendChild(list);
    },
    choices(options, account = false) {
        this.shell();
        const root = document.getElementById(account ? 'editor-switch-account-options' : 'editor-switch-options');
        if (!root) return;
        root.innerHTML = '';
        for (const option of options) root.appendChild(makeEditorButton(option.label, option.icon, option.select));
        if (!account) {
            const accounts = document.getElementById('editor-switch-account-options');
            if (accounts) accounts.innerHTML = '';
        }
    },
    transfer(source, target, actions) {
        this.shell();
        const root = document.getElementById('editor-switch-options');
        if (!root) throw new Error('Editor choices are unavailable.');
        root.innerHTML = '';
        const accounts = document.getElementById('editor-switch-account-options');
        if (accounts) accounts.innerHTML = '';
        const title = document.createElement('p'); title.className = 'list-tip-title';
        title.textContent = 'Transfer content to the new editor?'; root.appendChild(title);
        const message = document.createElement('p'); message.className = 'list-tip';
        message.textContent = `The ${source} editor has content. Carry it over to ${target}?`; root.appendChild(message);
        const row = document.createElement('div'); row.className = 'published-page-confirm';
        for (const [label, action, secondary] of [
            ['Overwrite', actions.overwrite], ['Insert', actions.insert],
            ["Don't transfer", actions.none, true], ['Cancel', actions.cancel, true],
        ]) {
            if (!action) continue;
            const button = document.createElement('button'); button.className = secondary ? 'btn btn-secondary' : 'btn';
            button.textContent = label; button.onclick = action; row.appendChild(button);
        }
        root.appendChild(row);
    },
    open() { openRightInterface('editor-instructions'); },
    close() { if (typeof closeRightPane === 'function') closeRightPane({ preserveEditorControls: true }); },
    prepare(handler, editorType) {
        const root = window.CList.ui.view.writePaneContent;
        if (!root) throw new Error('Write pane not found — please reload the page.');
        const chrome = ['write-tags', 'write-title-row', 'write-format', 'editor-menu']
            .map(id => document.getElementById(id)).filter(Boolean)
            .map(element => ({ element, display: element.style.display, value: element.value,
                nodes: Array.from(element.childNodes || element.children) }));
        for (const id of ['write-tags', 'write-title-row']) {
            const element = document.getElementById(id); if (element) element.style.display = '';
        }
        const format = document.getElementById('write-format');
        if (format) {
            format.innerHTML = '';
            for (const item of handler.formats || []) {
                const option = document.createElement('option'); option.value = item.id;
                option.textContent = item.label; format.appendChild(option);
            }
            format.style.display = handler.formats?.length ? '' : 'none';
        }
        const menu = document.getElementById('editor-menu');
        if (menu) { menu.innerHTML = ''; menu.style.display = 'none'; }
        setupEditorButtons(editorType);
        const previous = Array.from(root.children).map(child => [child, child.style.display]);
        for (const [child] of previous) child.style.display = 'none';
        return () => {
            for (const child of root.children) child.style.display = 'none';
            for (const [child, display] of previous) child.style.display = display;
            for (const { element, display, value, nodes } of chrome) {
                element.innerHTML = '';
                for (const node of nodes) element.appendChild(node);
                element.style.display = display; element.value = value;
            }
        };
    },
    indicator(label, version) {
        const status = document.getElementById('editor-status');
        if (status) {
            status.textContent = 'editor: ' + label + ' · test ' + version;
            status.title = 'Temporary editor test version: ' + version;
        }
    },
    draft(restore, discard) {
        const message = document.createElement('p');
        message.textContent = 'A draft was saved from your last session. Restore it?';
        buildDialogModal('Restore draft', message, [
            { label: 'Discard', secondary: true, onClick: close => { close(); return discard(); } },
            { label: 'Restore', onClick: close => { close(); return restore(); } },
        ]);
    },
    error(error, title = 'Editor operation failed') {
        console.error(title + ':', error); showErrorModal(error.message || String(error), { title });
    },
};
