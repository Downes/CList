// References presentation only. Rows and action callbacks come from the controller.
let _referenceViewActions = [];
function referenceViewEditableField(row, key, placeholder) {
    let value = String(row.reference[key] || ''), editing = false;
    const display = document.createElement('span');
    display.className = 'ref-field-text'; display.tabIndex = 0;
    display.dataset.referenceField = key;
    display.title = 'Edit ' + key.replaceAll('_', ' ');
    display.textContent = value || placeholder;
    const start = () => {
        if (editing) return;
        if (row.read) {
            const latest = row.read(key);
            if (!latest.current) return;
            value = String(latest.value || '');
        }
        editing = true;
        const input = document.createElement('input');
        input.type = 'text'; input.value = value; input.placeholder = placeholder;
        input.className = 'collection-editor-input ref-field-input';
        input.dataset.referenceField = key; input.title = display.title;
        let committed = false;
        const finish = () => {
            if (committed) return;
            committed = true;
            try {
                if (row.edit(key, input.value)) value = input.value;
            } catch (error) { window.CList.ui.references.error(error, 'Reference edit failed'); }
            display.textContent = value || placeholder;
            input.replaceWith(display); editing = false;
        };
        input.addEventListener('blur', finish);
        input.addEventListener('keydown', event => {
            if (event.key === 'Enter') { event.preventDefault(); finish(); display.focus(); }
        });
        display.replaceWith(input); input.focus();
    };
    display.addEventListener('click', start);
    display.addEventListener('keydown', event => {
        if (event.key === 'Enter') { event.preventDefault(); start(); }
    });
    return display;
}
function referenceViewIcon(title, icon, action) {
    const button = document.createElement('button');
    button.className = 'clist-action-btn'; button.title = title;
    const symbol = document.createElement('span');
    symbol.className = 'material-icons md-18 md-light'; symbol.textContent = icon;
    button.appendChild(symbol);
    button.onclick = async () => {
        try { await action(); } catch (error) { window.CList.ui.references.error(error); }
    };
    return button;
}
window.CList.ui.references = {
    mount(rows, options) {
        const root = window.CList.ui.view.writeEditorArea;
        if (!root) return false;
        let panel = document.getElementById('clist-references-panel');
        if (!panel) {
            panel = document.createElement('div'); panel.id = 'clist-references-panel';
            panel.className = 'allReferences';
        }
        if (panel.parentNode !== root) root.appendChild(panel);
        panel.innerHTML = ''; _referenceViewActions = [];
        const headerRow = document.createElement('div'); headerRow.className = 'modal-header-row';
        const header = document.createElement('h2'); header.textContent = 'References';
        const close = document.createElement('button'); close.className = 'btn btn-secondary';
        close.textContent = 'X'; close.title = 'Close';
        close.onclick = () => {
            try { options.close(); } catch (error) { this.error(error); }
        };
        headerRow.appendChild(header); headerRow.appendChild(close); panel.appendChild(headerRow);
        for (const row of rows) {
            const reference = row.reference;
            const container = document.createElement('div'); container.className = 'status-box';
            const line = document.createElement('div'); line.className = 'ref-citation-line';
            const text = value => line.appendChild(document.createTextNode(value));
            const field = (key, placeholder) => line.appendChild(referenceViewEditableField(row, key, placeholder));
            const date = value => {
                const span = document.createElement('span'); span.className = 'ref-citation-date';
                span.textContent = value; line.appendChild(span);
            };
            field('author_name', 'Author unknown'); text('. ');
            if (reference.created_at) { date(String(reference.created_at).slice(0, 10)); text('. '); }
            field('title', 'Untitled'); text('. ('); field('feed', 'Unknown source');
            text('). ['); field('url', 'No URL'); text(']. ');
            if (reference.cited_at) { date('Cited on ' + String(reference.cited_at).slice(0, 10)); text('.'); }
            container.appendChild(line);
            const annotate = referenceViewIcon('Annotate this reference', 'edit', row.annotate);
            const remove = referenceViewIcon('Remove reference', 'remove_circle_outline', row.remove);
            container.appendChild(annotate); container.appendChild(remove); panel.appendChild(container);
            _referenceViewActions.push(annotate);
        }
        const save = document.createElement('button'); save.className = 'btn';
        save.textContent = 'Save as collection';
        save.onclick = async () => {
            try { await options.save(save); } catch (error) { this.error(error); }
        };
        panel.appendChild(save); _referenceViewActions.push(save);
        this.busy(!!options.busy); this.visibility(!!options.open);
        const referencesButton = window.CList.ui.view.referencesButton;
        if (referencesButton) referencesButton.style.display = rows.length ? '' : 'none';
        return true;
    },
    visibility(open) {
        const panel = document.getElementById('clist-references-panel');
        if (panel) {
            if (open) panel.classList.add('open');
            else panel.classList.remove('open');
        }
    },
    busy(value) { for (const button of _referenceViewActions) button.disabled = !!value; },
    clear() {
        const panel = document.getElementById('clist-references-panel');
        if (panel) { panel.innerHTML = ''; panel.classList.remove('open'); }
        _referenceViewActions = [];
        const referencesButton = window.CList.ui.view.referencesButton;
        if (referencesButton) referencesButton.style.display = 'none';
    },
    error(error, title = 'Reference operation failed') {
        console.error(title + ':', error);
        showErrorModal(error?.message || String(error), { title });
    },
    staleError(error) { console.error('Earlier reference action failed:', error); showStatusMessage('An earlier reference action failed.'); },
};
