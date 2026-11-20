// Collection lists/detail chrome only. Data operations and actions are supplied.
window.CList.ui ||= {};
window.CList.ui.collectionBrowser = {
    mount(mode = 'feed') {
        const container = mode === 'load' ? window.CList.ui.view.loadOptions : window.CList.ui.view.feedContainer;
        if (!container) throw new Error('Collection controls are unavailable.');
        if (mode === 'feed') {
            const section = document.getElementById('feed-section');
            if (section) section.style.display = '';
            const menu = window.CList.ui.view.feedMenu;
            if (menu) { menu.style.display = ''; menu.replaceChildren(); }
        }
        container.replaceChildren();
        const root = document.createElement('div'); root.className = 'collection-browser'; container.appendChild(root);
        return { root };
    },
    message(view, text, error = false) {
        view.root.replaceChildren();
        const message = document.createElement('p'); message.className = error ? 'error-message' : 'feed-status-message';
        message.textContent = text; view.root.appendChild(message);
    },
    list(view, model, actions) {
        view.root.replaceChildren();
        const heading = document.createElement('div'); heading.className = 'feed-panel-header';
        const title = document.createElement('h3'); title.textContent = model.load ? 'Select a collection to load' : 'My Collections';
        heading.appendChild(title); view.root.appendChild(heading);
        if (model.warning || model.error) {
            const error = document.createElement('p'); error.className = 'error-message';
            error.textContent = [model.warning, model.error].filter(Boolean).join(' '); view.root.appendChild(error);
        }
        if (!model.collections.length) {
            const empty = document.createElement('p'); empty.className = 'feed-status-message';
            empty.textContent = 'No collections yet. Use the library_add button on any item to start collecting.'; view.root.appendChild(empty);
        }
        for (const col of model.collections) {
            const wrapper = document.createElement('div'); wrapper.className = 'saved-collection-wrapper';
            const row = document.createElement('div'); row.className = 'saved-collection-row';
            const name = document.createElement(model.load ? 'button' : 'span');
            name.className = model.load ? 'account-button' : 'saved-collection-name'; name.textContent = col.title || col.name || col.key;
            name.title = model.load ? 'Load collection' : col.feedSubscription ? 'Read feed collection' : 'View / edit items';
            name.onclick = () => actions.open(col); if (model.load) name.disabled = !!model.busy;
            const count = document.createElement('span'); count.className = 'saved-collection-count';
            count.textContent = col.feedSubscription ? 'Feed collection' : `${col.items.length} item${col.items.length === 1 ? '' : 's'}`;
            row.appendChild(name); row.appendChild(count);
            if (!model.load) {
                const icon = (label, symbol, callback) => {
                    const button = document.createElement('button'); button.className = 'clist-action-btn'; button.title = label;
                    button.innerHTML = `<span class="material-icons md-18 md-light">${symbol}</span>`;
                    button.disabled = !!model.busy; button.onclick = callback; row.appendChild(button);
                };
                icon('Edit collection', 'edit', () => actions.edit(col));
                icon('Delete this collection', 'delete_outline', () => actions.confirm(col.key));
                if (model.confirmKey === col.key) {
                    const confirm = document.createElement('div'); confirm.className = 'collection-delete-confirm';
                    const label = document.createElement('span'); label.textContent = `Delete "${col.title || col.name}"? `; confirm.appendChild(label);
                    for (const [text, callback] of [['Delete', () => actions.remove(col)], ['Cancel', () => actions.confirm(null)]]) {
                        const button = document.createElement('button'); button.className = 'btn btn-small' + (text === 'Cancel' ? ' btn-secondary' : '');
                        button.textContent = text; button.disabled = !!model.busy; button.onclick = callback; confirm.appendChild(button);
                    }
                    row.appendChild(confirm);
                }
            }
            wrapper.appendChild(row); view.root.appendChild(wrapper);
        }
        if (model.load) {
            const back = document.createElement('button'); back.className = 'btn btn-secondary'; back.textContent = 'Back'; back.onclick = actions.back;
            view.root.appendChild(back);
        } else {
            view.imports = document.createElement('div'); view.root.appendChild(view.imports);
        }
    },
    detail(view, col, actions) {
        view.root.replaceChildren();
        const header = document.createElement('div'); header.className = 'collection-detail-header';
        const left = document.createElement('div'); left.className = 'collection-detail-left';
        const right = document.createElement('div'); right.className = 'collection-detail-right';
        const icon = (container, label, symbol, callback, extra = '') => {
            const button = document.createElement('button'); button.className = 'clist-action-btn' + extra; button.title = label;
            button.innerHTML = `<span class="material-icons md-18 md-light">${symbol}</span>`; button.onclick = callback; container.appendChild(button); return button;
        };
        icon(left, 'Back to collections', 'arrow_back', actions.back);
        const count = document.createElement('span'); count.className = 'saved-collection-count';
        count.textContent = `${col.items.length} item${col.items.length === 1 ? '' : 's'}`; left.appendChild(count);
        const title = document.createElement('h3'); title.className = 'collection-detail-title'; title.textContent = col.name || col.title;
        icon(right, 'Open in Collab', 'edit_note', actions.collab);
        icon(right, 'Share to chat', 'chat', actions.share, ' chat-only-btn');
        const nest = icon(right, 'Add to another collection', 'playlist_add', () => actions.nest(nest));
        icon(right, 'Load all to editor', 'arrow_forward', actions.load);
        header.appendChild(left); header.appendChild(title); header.appendChild(right); view.root.appendChild(header);
        const error = document.createElement('p'); error.className = 'error-message'; error.hidden = true; view.root.appendChild(error);
        const items = document.createElement('div'); items.className = 'collection-items-expanded'; view.root.appendChild(items);
        return { count, items, error };
    },
    actionError(view, message) {
        const target = view.detail?.error;
        if (target) { target.textContent = message; target.hidden = false; }
    },
    status(message) { showStatusMessage(message); },
    error(error) { console.error('[collections browser]', error); showStatusMessage(error?.message || String(error)); },
};
