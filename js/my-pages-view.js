// My Pages controls and feedback. All storage and editor operations are callbacks.
window.CList.ui ||= {};
window.CList.ui.myPages = {
    mount(onClose) {
        const root = document.createElement('div');
        root.className = 'published-pages-modal';
        const header = document.createElement('div'); header.className = 'modal-header-row';
        const title = document.createElement('h2'); title.textContent = 'My Pages';
        const close = document.createElement('button'); close.className = 'clist-action-btn'; close.title = 'Close My Pages';
        close.innerHTML = '<span class="material-icons md-18 md-light">close</span>';
        close.onclick = () => { onClose(); root.closest('#generic-modal')?.remove(); };
        header.append(title, close); root.append(header);
        const body = document.createElement('div'); root.append(body);
        showModal(root, { wide: true, hideDefaultClose: true });
        return { root, body };
    },
    message(view, text, error = false) {
        view.body.replaceChildren();
        const p = document.createElement('p'); p.className = error ? 'error-message' : 'list-tip'; p.textContent = text;
        view.body.append(p);
    },
    render(view, model, actions) {
        const { state, slice, warning, canLoad } = model;
        view.body.replaceChildren();
        if (warning) { const p = document.createElement('p'); p.className = 'error-message'; p.textContent = warning; view.body.append(p); }
        if (!slice.total) {
            const p = document.createElement('p'); p.className = 'list-tip'; p.textContent = 'No pages yet. Saved and published pages appear here.';
            view.body.append(p); return;
        }
        const table = document.createElement('table'); table.className = 'published-pages-table';
        const head = document.createElement('thead'), header = document.createElement('tr');
        for (const [key, label] of [['format', 'Format'], ['date', 'Date'], [null, 'Buttons'], ['title', 'Title']]) {
            const th = document.createElement('th'); th.textContent = label;
            if (key) {
                th.onclick = () => actions.sort(key);
                if (state.sortKey === key) { th.className = 'sort-active'; th.textContent += state.sortDir === 'asc' ? ' ▲' : ' ▼'; }
            } else th.className = 'no-sort';
            header.append(th);
        }
        head.append(header); table.append(head);
        const tbody = document.createElement('tbody'); table.append(tbody);
        for (const page of slice.rows) {
            const tr = document.createElement('tr'), format = document.createElement('td');
            for (const label of [page.format?.toUpperCase(), page.service, page.savedLocally && !page.url ? 'Local only' : null].filter(Boolean)) {
                const badge = document.createElement('span'); badge.className = 'published-page-badge'; badge.textContent = label; format.append(badge);
            }
            const date = document.createElement('td'); date.className = 'published-page-date';
            date.textContent = (page.publishedAt || page.savedLocallyAt || '').slice(0, 10);
            const controls = document.createElement('td'), buttons = document.createElement('div'); buttons.className = 'published-page-actions';
            function icon(title, name, callback) {
                const button = document.createElement('button'); button.className = 'clist-action-btn'; button.title = title;
                button.innerHTML = `<span class="material-icons md-18 md-light">${name}</span>`;
                button.disabled = !!state.busy; button.onclick = callback; buttons.append(button);
            }
            if (canLoad(page)) icon(page.kind === 'collection' ? 'Load into collection editor' : 'Load into editor', 'input', () => actions.load(page));
            if (/^https?:\/\//i.test(page.url || '')) {
                icon('Open in new tab', 'open_in_new', () => actions.open(page));
                icon('Copy URL', 'content_copy', () => actions.copy(page));
            }
            icon('Delete', 'delete_outline', () => actions.confirm(page));
            controls.append(buttons);
            if (model.confirm === page) {
                const confirm = document.createElement('div'); confirm.className = 'published-page-confirm';
                confirm.append(document.createTextNode('Delete this page? '));
                for (const [label, callback] of [['Delete', () => actions.remove(page)], ['Cancel', () => actions.confirm(null)]]) {
                    const button = document.createElement('button'); button.className = 'btn btn-small' + (label === 'Cancel' ? ' btn-secondary' : '');
                    button.textContent = label; button.disabled = !!state.busy; button.onclick = callback; confirm.append(button);
                }
                controls.append(confirm);
            }
            const title = document.createElement('td');
            const label = document.createElement(/^https?:\/\//i.test(page.url || '') ? 'a' : 'span');
            label.textContent = page.title || page.url || 'Untitled';
            if (label.tagName === 'A') { label.href = page.url; label.target = '_blank'; label.rel = 'noopener'; }
            title.append(label); tr.append(format, date, controls, title); tbody.append(tr);
        }
        view.body.append(table);
        const pagination = document.createElement('div'); pagination.className = 'published-pages-pagination';
        const range = document.createElement('span'); range.textContent = `${slice.start + 1}-${slice.end} of ${slice.total}`; pagination.append(range);
        const size = document.createElement('select'); size.title = 'Pages per page';
        for (const value of [20, 40, 100, 'All']) { const opt = document.createElement('option'); opt.value = value; opt.textContent = String(value); opt.selected = value === state.pageSize; size.append(opt); }
        size.onchange = () => actions.size(size.value); pagination.append(size);
        for (const [label, index, disabled] of [['Prev', slice.pageIndex - 1, !slice.pageIndex], ['Next', slice.pageIndex + 1, slice.pageIndex >= slice.maxIndex]]) {
            const button = document.createElement('button'); button.className = 'btn btn-small'; button.textContent = label;
            button.disabled = disabled; button.onclick = () => actions.page(index); pagination.append(button);
        }
        view.body.append(pagination);
    },
    error(error) { console.error('[mypages]', error); showErrorModal(error.message || String(error), { title: 'My Pages' }); },
    status(message) { showStatusMessage(message); },
};
