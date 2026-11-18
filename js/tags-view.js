// Tag input presentation. Selection, suggestions and action ownership belong to the controller.
let _tagsCreationButton = null;
let _tagsInputPlaceholder = 'Add tag…';
function tagViewAction(action, ...args) {
    try {
        const result = action(...args);
        return result?.catch ? result.catch(error => window.CList.ui.tags.error(error)) : result;
    } catch (error) { window.CList.ui.tags.error(error); }
}
window.CList.ui.tags = {
    mount(model, actions) {
        const root = window.CList.ui.view.writeTags;
        if (!root) return false;
        const focused = document.activeElement?.id === 'write-tag-input';
        root.innerHTML = ''; _tagsCreationButton = null;
        const label = document.createElement('span'); label.className = 'write-tags-label';
        label.textContent = 'Tags:'; root.appendChild(label);
        const row = document.createElement('div'); row.id = 'write-tags-row';
        for (const name of model.selected) {
            const chip = document.createElement('span'); chip.className = 'write-tag-chip';
            chip.appendChild(document.createTextNode(name));
            const remove = document.createElement('button');
            remove.className = 'btn-small write-tag-chip-remove'; remove.title = 'Remove tag';
            remove.textContent = '×';
            remove.onclick = () => tagViewAction(actions.remove, name);
            chip.appendChild(remove); row.appendChild(chip);
        }
        const input = document.createElement('input');
        input.type = 'text'; input.id = 'write-tag-input'; input.autocomplete = 'off';
        _tagsInputPlaceholder = model.selected.length ? '' : 'Add tag…';
        input.placeholder = _tagsInputPlaceholder; input.value = model.query;
        input.addEventListener('focus', () => tagViewAction(actions.focus));
        input.addEventListener('input', event => tagViewAction(actions.input, event.target.value));
        input.addEventListener('keydown', event => {
            try {
                if (actions.key(event.key, event.target.value)) event.preventDefault();
            } catch (error) { this.error(error); }
        });
        input.addEventListener('blur', () => tagViewAction(actions.blur));
        row.appendChild(input); root.appendChild(row);
        if (focused) input.focus();
        return true;
    },
    dropdown(names, choose) {
        this.closeDropdown();
        const root = window.CList.ui.view.writeTags;
        const input = document.getElementById('write-tag-input');
        if (!root || !input || !names.length || document.activeElement !== input) return;
        const dropdown = document.createElement('div'); dropdown.id = 'write-tags-dropdown';
        for (const name of names) {
            const button = document.createElement('button');
            button.className = 'btn btn-small write-tags-dropdown-item'; button.textContent = name;
            button.addEventListener('mousedown', event => {
                event.preventDefault(); tagViewAction(choose, name);
            });
            dropdown.appendChild(button);
        }
        // Fixed coordinates avoid clipping by the editor pane's overflow ancestors.
        const rootRect = root.getBoundingClientRect(), inputRect = input.getBoundingClientRect();
        dropdown.style.position = 'fixed'; dropdown.style.left = rootRect.left + 'px';
        if (window.innerHeight - inputRect.bottom < 180) {
            dropdown.style.bottom = (window.innerHeight - inputRect.top) + 'px'; dropdown.style.top = 'auto';
        } else {
            dropdown.style.top = inputRect.bottom + 'px'; dropdown.style.bottom = 'auto';
        }
        document.body.appendChild(dropdown);
    },
    closeDropdown() { document.getElementById('write-tags-dropdown')?.remove(); },
    offer(name, yes, no, busy = false) {
        this.clearOffer();
        const root = window.CList.ui.view.writeTags;
        if (!root) return;
        const offer = document.createElement('div');
        offer.id = 'write-tags-col-offer'; offer.className = 'write-tags-col-offer';
        const message = document.createElement('span'); message.textContent = `Create collection "${name}"?`;
        const accept = document.createElement('button'); accept.className = 'btn btn-small';
        accept.textContent = 'Yes'; accept.disabled = !!busy; accept.onclick = () => tagViewAction(yes);
        const decline = document.createElement('button'); decline.className = 'btn btn-small btn-secondary';
        decline.textContent = 'No'; decline.onclick = () => tagViewAction(no);
        offer.appendChild(message); offer.appendChild(accept); offer.appendChild(decline); root.appendChild(offer);
        _tagsCreationButton = accept;
    },
    clearOffer() {
        document.getElementById('write-tags-col-offer')?.remove(); _tagsCreationButton = null;
    },
    creationBusy(value) { if (_tagsCreationButton) _tagsCreationButton.disabled = !!value; },
    focus() { document.getElementById('write-tag-input')?.focus(); },
    query(value) {
        const input = document.getElementById('write-tag-input');
        if (input) { input.value = value; input.placeholder = _tagsInputPlaceholder; }
    },
    error(error) {
        console.error('Tag operation failed:', error);
        showErrorModal(error?.message || String(error), { title: 'Tag operation failed' });
    },
    staleError(error) {
        console.error('Earlier tag operation failed:', error);
        showStatusMessage('An earlier tag operation failed.');
    },
};
