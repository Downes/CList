// Save destination list only. The controller supplies selection callbacks and busy state.
let _saveDestinationButtons = [];
let _saveDestinationList = null;
window.CList.ui.saving = {
    mount(options, busy) {
        const root = document.getElementById('save-options');
        if (!root) throw new Error('Save destinations are unavailable.');
        // Service savers can await controls appended to this root (Dropbox's
        // overwrite prompt). Rebuild only our own list while a saver is pending.
        if (!busy) root.innerHTML = '';
        else if (_saveDestinationList?.parentNode === root) _saveDestinationList.remove();
        _saveDestinationButtons = [];
        const list = document.createElement('div'); list.className = 'account-list';
        const tip = document.createElement('div'); tip.className = 'list-tip';
        tip.textContent = 'Select a destination to save to'; list.appendChild(tip);
        for (const option of options) {
            const button = document.createElement('button'); button.className = 'btn-small account-button';
            const icon = document.createElement('span');
            if (option.logoSrc) {
                icon.className = 'service-icon-img';
                icon.style.webkitMask = `url('${option.logoSrc}') no-repeat center / contain`;
                icon.style.mask = `url('${option.logoSrc}') no-repeat center / contain`;
            } else { icon.className = 'material-icons'; icon.textContent = option.icon || 'save'; }
            const name = document.createElement('span'); name.textContent = option.label;
            button.appendChild(icon); button.appendChild(name); button.disabled = busy;
            button.onclick = option.select; list.appendChild(button); _saveDestinationButtons.push(button);
        }
        root.insertBefore(list, root.firstChild || root.children[0] || null);
        _saveDestinationList = list;
    },
    busy(value) { for (const button of _saveDestinationButtons) button.disabled = value; },
    open() { openRightInterface('save-instructions'); },
    close() { closeRightPane(); },
    error(error) {
        console.error('Save failed:', error);
        showErrorModal(error?.message || String(error), { title: 'Save failed' });
    },
    staleError(error) { console.error('Earlier save failed:', error); showStatusMessage('An earlier save failed.'); },
};
