// Loading UI only. Controllers supply choices and action callbacks.
window.CList.ui.editorLoad = {
    chooseEditor(options, target, select, cancel) {
        const root = target && target.isConnected !== false ? target : window.CList.ui.view.loadOptions;
        if (!root) throw new Error('Editor choices are unavailable.');
        root.innerHTML = '';
        const tip = document.createElement('p'); tip.className = 'list-tip';
        tip.textContent = 'More than one editor can open this content — choose one:'; root.appendChild(tip);
        const list = document.createElement('div'); list.className = 'account-list';
        for (const option of options) {
            const button = document.createElement('button'); button.className = 'account-button';
            const icon = document.createElement('span'); icon.className = 'material-icons'; icon.textContent = option.icon || 'edit';
            const name = document.createElement('span'); name.textContent = option.label || option.key;
            button.appendChild(icon); button.appendChild(name);
            button.onclick = () => select(option.key); list.appendChild(button);
        }
        root.appendChild(list);
        const button = document.createElement('button'); button.className = 'btn btn-secondary';
        button.textContent = 'Cancel'; button.onclick = cancel; root.appendChild(button);
    },
    chooseCollection(parsed, format, target, select, native, cancel) {
        _offerCollectionChoice(parsed, format, { renderTarget: target, onCollection: select, onNative: native, onCancel: cancel });
    },
    reviewEditor(canReplace, target, actions) {
        const root = target && target.isConnected !== false ? target : window.CList.ui.view.loadOptions;
        if (!root) throw new Error('Editor review is unavailable.');
        root.innerHTML = '';
        const title = document.createElement('p'); title.className = 'list-tip-title';
        title.textContent = 'Content detected in the destination editor.'; root.appendChild(title);
        const message = document.createElement('p'); message.className = 'list-tip';
        message.textContent = 'This editor already has content.'; root.appendChild(message);
        const row = document.createElement('div'); row.className = 'published-page-confirm';
        const button = (label, action, secondary = false) => {
            const element = document.createElement('button'); element.className = secondary ? 'btn btn-secondary' : 'btn';
            element.textContent = label; element.onclick = action; row.appendChild(element);
        };
        if (canReplace) { button('New (insert into blank editor)', actions.new); button('Replace', actions.replace); }
        button('Insert', actions.insert); button('Cancel', actions.cancel, true);
        root.appendChild(row);
    },
    reviewCollection(open, cancel) {
        const message = document.createElement('p');
        message.textContent = 'The collection editor already has content. Open this collection in its place?';
        buildDialogModal('Open collection', message, [
            { label: 'Cancel', secondary: true, onClick: close => { close(); return cancel(); } },
            { label: 'Open collection', onClick: close => { close(); return open(); } },
        ]);
    },
    preparingReview() { openRightPane(); this.removeModal(); },
    removeModal() { document.getElementById('generic-modal')?.remove(); },
    finished() { closeLoadSurfaces(); },
    error(error) { console.error('Editor load failed:', error); showErrorModal(error.message || String(error), { title: 'Editor load failed' }); },
};
