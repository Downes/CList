// Copyright Stephen Downes 2026. CC BY 4.0; provided AS IS, without warranty.
// Find controls and feedback. Search ownership and provider work stay with callers.
(function () {
    let panel = null;
    let buttons = new Map();
    const feedContainer = () => window.CList.ui.view.feedContainer;

    window.CList.ui.find = {
        target() { return feedContainer(); },
        mount(options, query, onQuery) {
            panel = document.createElement('div');
            panel.id = 'find-section';
            buttons = new Map();

            const input = document.createElement('input');
            input.type = 'text';
            input.id = 'find-input';
            input.className = 'find-input';
            input.placeholder = 'Search term…';
            input.value = query || '';
            input.addEventListener('input', () => onQuery(input.value));
            panel.appendChild(input);

            const list = document.createElement('div');
            list.className = 'account-list';
            const tip = document.createElement('div');
            tip.className = 'list-tip';
            tip.textContent = 'Enter search term and select service';
            list.appendChild(tip);

            for (const option of options) {
                const button = document.createElement('button');
                button.className = 'btn-small account-button';
                button.onclick = option.select;
                const icon = document.createElement('span');
                if (option.logoSrc) {
                    icon.className = 'service-icon-img';
                    icon.style.mask = `url('${option.logoSrc}') no-repeat center / contain`;
                } else {
                    icon.className = 'material-icons';
                    icon.textContent = option.icon || 'search';
                }
                const label = document.createElement('span');
                label.textContent = option.label || option.key;
                button.appendChild(icon);
                button.appendChild(label);
                list.appendChild(button);
                buttons.set(option.key, button);
            }
            panel.appendChild(list);
            return panel;
        },
        busy(value, selectedKey) {
            panel?.setAttribute('aria-busy', String(!!value));
            for (const [key, button] of buttons) {
                button.setAttribute('aria-busy', String(!!value && key === selectedKey));
            }
        },
        error(error) {
            console.error('Search error:', error);
            showErrorModal('Search failed: ' + (error?.message || String(error)), { title: 'Search Failed' });
        },
        invalidQuery() {
            showErrorModal('Please enter a search term.', { title: 'Search Term Required' });
        },
        render(items, options, isCurrent = () => true) {
            const container = feedContainer();
            if (!container || !isCurrent()) return;
            const current = () => isCurrent() && feedContainer() === container;
            return window.CList.ui.renderFeed(items, container, { ...options, isCurrent: current });
        },
        empty(title, isCurrent = () => true) {
            const container = feedContainer();
            if (!container || !isCurrent()) return;
            container.innerHTML = '';
            const header = document.createElement('div');
            header.className = 'feed-header';
            const heading = document.createElement('h2');
            heading.textContent = title;
            header.appendChild(heading);
            container.appendChild(header);
            const message = document.createElement('p');
            message.className = 'feed-status-message';
            message.textContent = 'No results found.';
            container.appendChild(message);
        },
        requestError(title, error, isCurrent = () => true) {
            const container = feedContainer();
            if (!container || !isCurrent()) return;
            console.error(title, error);
            showServiceError(container, title, error?.message || String(error));
        },
    };
})();
