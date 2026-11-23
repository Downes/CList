/// <reference path="./clist-types.js" />
// Collection draft DOM and feedback only. Selection/mutations belong to the controller.
function createCollectionDraftView(container, col) {
    container.innerHTML = '';
    const root = document.createElement('div'); container.appendChild(root);
    if (col.feedAccount) {
        const note = document.createElement('p'); note.className = 'feed-status-message';
        note.textContent = 'Editing your subscribed feeds. Use Save → Save to CList to apply changes to your collection.';
        root.appendChild(note);
    }
    const identity = document.createElement('div'); identity.className = 'list-tip'; root.appendChild(identity);
    const list = document.createElement('div'); list.className = 'collection-editor-list'; root.appendChild(list);
    const feedback = document.createElement('div'); feedback.setAttribute('role', 'status'); root.appendChild(feedback);
    let rows = new Map();
    const disabled = new WeakMap();
    return {
        root, identity,
        isCurrent: () => root.parentNode === container && container.isConnected,
        rowCurrent: ticket => rows.get(ticket)?.parentNode === list,
        error(error) { feedback.className = 'error-message'; feedback.textContent = error.message || String(error); },
        busy(ticket, busy) { const row = rows.get(ticket); if (row) row.querySelectorAll('button').forEach(button => {
            if (busy) { disabled.set(button, button.disabled); button.disabled = true; }
            else button.disabled = disabled.get(button) || false;
        }); },
        render(tickets, controller) {
            list.innerHTML = ''; rows = new Map();
            for (const ticket of tickets) {
                const row = renderCollectionDraftRow(ticket, controller, !!col.feedAccount);
                rows.set(ticket, row); list.appendChild(row);
                if (ticket.busy) row.querySelectorAll('button').forEach(button => { disabled.set(button, button.disabled); button.disabled = true; });
            }
            const row = document.createElement('div'); row.className = 'collection-editor-entry collection-editor-add-row';
            const bar = document.createElement('div'); bar.className = 'collection-editor-entry-bar'; row.appendChild(bar);
            function button(title, icon, action) {
                const node = document.createElement('button'); node.className = 'clist-action-btn'; node.title = title;
                node.innerHTML = '<span class="material-icons md-18 md-light">' + icon + '</span>';
                node.onclick = () => { if (controller.current() && node.parentNode === bar && row.parentNode === list) return action(); };
                bar.appendChild(node); return node;
            }
            button('Add a blank entry', 'add', () => controller.add());
            const file = document.createElement('input'); file.type = 'file'; file.style.display = 'none'; bar.appendChild(file);
            file.onchange = () => { const selected = file.files[0]; file.value = '';
                if (file.parentNode === bar && row.parentNode === list) return controller.file(selected); };
            button('Add entry from a file', 'upload_file', () => file.click());
            const existing = button('Add entry from a saved page or collection', 'library_add', () => controller.existing(existing));
            list.appendChild(row);
        },
    };
}

// Render a single collapsible entry row.
function renderCollectionDraftRow(ticket, controller, isFeedCollection) {
    const { item, expanded } = ticket;
    const row      = document.createElement('div');
    row.className  = 'collection-editor-entry';

    const bar      = document.createElement('div');
    bar.className  = 'collection-editor-entry-bar';

    const upBtn    = document.createElement('button');
    upBtn.className = 'clist-action-btn';
    upBtn.title     = 'Move up';
    upBtn.innerHTML = '<span class="material-icons md-18 md-light">arrow_upward</span>';
    upBtn.onclick   = (e) => { e.stopPropagation(); controller.move(ticket, -1); };

    const downBtn   = document.createElement('button');
    downBtn.className = 'clist-action-btn';
    downBtn.title     = 'Move down';
    downBtn.innerHTML = '<span class="material-icons md-18 md-light">arrow_downward</span>';
    downBtn.onclick   = (e) => { e.stopPropagation(); controller.move(ticket, 1); };

    const delBtn    = document.createElement('button');
    delBtn.className = 'clist-action-btn';
    delBtn.title     = 'Remove entry';
    delBtn.innerHTML = '<span class="material-icons md-18 md-light">delete_outline</span>';
    delBtn.onclick   = (e) => { e.stopPropagation(); controller.remove(ticket); };

    const chevron   = document.createElement('span');
    chevron.className   = 'material-icons collection-editor-chevron';
    chevron.textContent = expanded ? 'expand_less' : 'expand_more';

    const labelEl   = document.createElement('span');
    labelEl.className   = 'collection-editor-entry-label';
    const isNested    = item.role === 'contains' && item.collectionId;
    const isLocalLeaf  = !!item.localOnly && !!item.url && item.url.startsWith('blob:');
    const entryLabel   = () => (_collectionItemDisplayTitle(item) || '(untitled)')
        + (isNested ? ' (nested collection)' : '')
        + (isLocalLeaf ? ' (local only)' : '');
    labelEl.textContent = entryLabel();

    let browserBtn = null;
    if (isFeedCollection && !isNested) {
        browserBtn = document.createElement('button');
        browserBtn.type = 'button';
        browserBtn.className = 'clist-action-btn';
        browserBtn.title = 'Open website in browser';
        browserBtn.innerHTML = '<span class="material-icons md-18 md-light">launch</span>';
        browserBtn.disabled = !/^https?:\/\//i.test(item.url || '');
        browserBtn.onclick = event => {
            event.stopPropagation();
            controller.browse(ticket);
        };
    }

    // Member fields are edited by expanding the row. The Edit action opens
    // only an owned resource with a registered content editor.
    let editBtn = null;
    const editTarget = () => controller.canEdit(ticket);
    function updateEditAction() {
        if (!editTarget()) {
            editBtn?.remove();
            editBtn = null;
            return;
        }
        if (editBtn) return;
        editBtn = document.createElement('button');
        editBtn.className = 'clist-action-btn';
        editBtn.title = isNested ? 'Edit nested collection' : 'Edit this page';
        editBtn.innerHTML = '<span class="material-icons md-18 md-light">edit</span>';
        const capturedButton = editBtn;
        editBtn.onclick = event => {
            event.stopPropagation();
            if (capturedButton.parentNode !== bar) return;
            const target = editTarget();
            if (target) return controller.open(ticket);
        };
        bar.insertBefore(editBtn, delBtn);
    }

    // "Publish" — only for a local-only (blob:) entry added via "+ From file".
    let publishBtn = null;
    if (isLocalLeaf) {
        publishBtn = document.createElement('button');
        publishBtn.className = 'clist-action-btn';
        publishBtn.title     = 'Publish this local page';
        publishBtn.innerHTML = '<span class="material-icons md-18 md-light">publish</span>';
        publishBtn.onclick   = (e) => { e.stopPropagation(); return controller.publish(ticket); };
    }

    bar.appendChild(upBtn);
    bar.appendChild(downBtn);
    bar.appendChild(chevron);
    bar.appendChild(labelEl);
    if (browserBtn) bar.appendChild(browserBtn);
    if (publishBtn) bar.appendChild(publishBtn);
    bar.appendChild(delBtn);
    updateEditAction();

    const fields    = document.createElement('div');
    fields.className = 'collection-editor-entry-fields';
    fields.style.display = expanded ? 'block' : 'none';

    bar.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        const open = controller.toggle(ticket);
        if (open === null) return;
        fields.style.display = open ? 'block' : 'none';
        chevron.textContent = open ? 'expand_less' : 'expand_more';
    });

    renderCollectionDraftFields(ticket, controller, fields, () => {
        labelEl.textContent = entryLabel();
        updateEditAction();
        if (browserBtn) browserBtn.disabled = !/^https?:\/\//i.test(item.url || '');
    }, isFeedCollection);

    row.appendChild(bar);
    row.appendChild(fields);
    return row;
}

// Render editable fields for a single entry. A role:'contains' item is a
// nested-collection reference, not a feed item — it has no url/author/feed/
// summary, so it only gets a Title field (plus a note identifying it).
function renderCollectionDraftFields(ticket, controller, container, onTitleChange, isFeedCollection = false) {
    const { item } = ticket;
    if (item.role === 'contains' && item.collectionId) {
        const note = document.createElement('p');
        note.className   = 'feed-status-message';
        note.textContent = 'Nested collection — its items are included when this collection is exported or published.';
        container.appendChild(note);

        const wrapper = document.createElement('div');
        wrapper.className = 'collection-editor-field';
        const labelEl  = document.createElement('label');
        labelEl.textContent = 'Title';
        wrapper.appendChild(labelEl);
        const input = document.createElement('input');
        input.type      = 'text';
        input.value     = item.title || '';
        input.className = 'collection-editor-input';
        let baseline = item.title;
        input.addEventListener('input', () => {
            if (input.parentNode !== wrapper || wrapper.parentNode !== container) return;
            if (!controller.edit(ticket, 'title', input.value, baseline)) return;
            baseline = input.value;
            if (onTitleChange) onTitleChange();
        });
        wrapper.appendChild(input);
        container.appendChild(wrapper);
        return;
    }

    [
        { key: 'title',       label: 'Title',       tag: 'input',    type: 'text' },
        { key: 'url',         label: isFeedCollection ? 'Website URL' : 'URL', tag: 'input', type: 'url' },
        { key: 'author_name', label: 'Author',      tag: 'input',    type: 'text' },
        { key: 'feed',        label: isFeedCollection ? 'Feed URL' : 'Feed', tag: 'input', type: 'url' },
        { key: 'summary',     label: 'Description', tag: 'textarea', type: null   },
    ].forEach(({ key, label, tag, type }) => {
        const wrapper   = document.createElement('div');
        wrapper.className = 'collection-editor-field';

        const labelEl   = document.createElement('label');
        labelEl.textContent = label;
        wrapper.appendChild(labelEl);

        const input     = document.createElement(tag);
        if (type) input.type = type;
        input.value     = item[key] || '';
        input.className = 'collection-editor-input';
        let baseline = item[key];
        input.addEventListener('input', () => {
            if (input.parentNode !== wrapper || wrapper.parentNode !== container) return;
            if (!controller.edit(ticket, key, input.value, baseline)) return;
            baseline = input.value;
            if (onTitleChange) onTitleChange();
        });
        wrapper.appendChild(input);
        container.appendChild(wrapper);
    });
}
