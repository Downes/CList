/// <reference path="./reader-types.js" />
// Copyright Stephen Downes 2026. CC BY 4.0; provided AS IS, without warranty.
// Returns a DOM element for the icon appropriate for the given account type.
// accountData (the parsed account, if available) lets a type's icon vary by
// the account's own data -- e.g. LOCALRSS shows a podcast icon once hasAudio
// is set (see _localrssMaybePersistHasAudio() in localrss.js), never by name.
function accountIcon(type, accountData) {
    if (type === 'Mastodon') {
        const span = document.createElement('span');
        span.className = 'account-icon-img';
        span.setAttribute('aria-label', 'Mastodon');
        return span;
    }
    if (type === 'LOCALRSS') {
        const span = document.createElement('span');
        span.className = 'material-icons';
        span.textContent = (accountData && accountData.hasAudio) ? 'podcasts' : 'rss_feed';
        return span;
    }
    const materialIcons = {
        'Bluesky':   'cloud',
        'WordPress': 'article',
        'Blogger':   'article',
    };
    const span = document.createElement('span');
    span.className = 'material-icons';
    span.textContent = materialIcons[type] || 'account_circle';
    return span;
}


const _readerFeedMenus = new WeakMap();
function readPanel() {
    const panel = document.createElement('div'); panel.id = 'read-section';
    panel.innerHTML = '<div id="read-account-list"></div><div id="select-account"></div><div id="account-status"></div>';
    return panel;
}
window.CList.ui.reader = {
    open() { openLeftInterface(readPanel()); },
    openPublic() {
        openLeftInterface(document.createElement('div'));
        if (typeof renderPublicFeedsList === 'function') renderPublicFeedsList(document.getElementById('left-content'));
    },
    accounts(accounts, { annotations, collections, onAccount, onAnnotations, onCollections }) {
        const container = document.getElementById('read-account-list'); if (!container) return;
        container.innerHTML = '';
        const list = makeAccountList('Select an account to read', accounts,
            account => (account.permissions || '').includes('r') && !['Annotate', 'Hypothesis'].includes(account.type), onAccount);
        for (const [visible, label, icon, action] of [[annotations, 'Annotations', 'rate_review', onAnnotations],
            [collections, 'Collections', 'collections_bookmark', onCollections]]) {
            if (!visible) continue;
            const button = document.createElement('button'); button.className = 'account-button'; button.onclick = action;
            const symbol = document.createElement('span'); symbol.className = 'material-icons'; symbol.textContent = icon;
            const text = document.createElement('span'); text.textContent = label; button.append(symbol, text); list.appendChild(button);
        }
        container.appendChild(list);
    },
    menu(names, selected, onAction, busy) {
        const container = window.CList.ui.view.feedMenu; if (!container) return;
        _readerFeedMenus.get(container)?.dispose();
        container.innerHTML = '';
        if (!names.length) return;
        const definitions = names.map(name => ({ id: name, label: name,
            selected: name === selected, run: () => onAction(name) }));
        const menu = createActionMenu(definitions,
            createActionMenuView(container, 'btn btn-small feed-filter-btn'), error => this.failed(error));
        menu.setBusy(busy);
        const translate = document.createElement('button'); translate.id = 'translation-toggle-btn'; translate.className = 'btn btn-small';
        translate.textContent = 'Translate: ' + (translationEnabled ? 'ON' : 'OFF'); translate.onclick = toggleTranslation;
        container.appendChild(translate);
        const shell = createMenuShell(createMenuShellView(container,
            { title: 'Feed menu', popoutTitle: 'Pop out feed menu' }), error => showStatusMessage(error.message));
        _readerFeedMenus.set(container, { setBusy: value => menu.setBusy(value),
            dispose() { shell.dispose(); menu.dispose(); } });
    },
    busy(value) { const container = window.CList.ui.view.feedMenu; if (container) _readerFeedMenus.get(container)?.setBusy(value); },
    selected(account) {
        const container = document.getElementById('selectedAccount'); if (!container) return;
        container.innerHTML = ''; container.appendChild(accountIcon(account.type, account));
        container.appendChild(document.createTextNode(account.title || account.type));
    },
    begin(account, state, names, onAction, initialize) {
        this.menu(names, state.feedName, onAction, true); this.selected(account);
        if (initialize && window.CList.ui.view.feedContainer) window.CList.ui.view.feedContainer.innerHTML = '';
        if (initialize && window.CList.ui.view.loadingIndicator) window.CList.ui.view.loadingIndicator.style.display = 'none';
    },
    complete(account) { this.selected(account); this.busy(false); },
    clearStatus() {
        const status = document.getElementById('account-status'); if (!status) return;
        status.innerHTML = ''; status.style.display = 'none';
    },
    reset() {
        if (window.CList.ui.view.loadingIndicator) window.CList.ui.view.loadingIndicator.style.display = 'none';
        const selected = document.getElementById('selectedAccount'); if (selected) selected.innerHTML = '';
        const menu = window.CList.ui.view.feedMenu;
        if (menu) _readerFeedMenus.get(menu)?.dispose();
        if (menu) menu.innerHTML = '';
        this.clearStatus();
    },
    render(items, options) { return window.CList.ui.renderFeed(items, window.CList.ui.view.feedContainer, options); },
    failed(error) { console.error('Error loading feed:', error); showServiceError('feed-container', 'Could not load feed', error.message); },
    accountsFailed(error) { console.error('Could not load accounts:', error); showErrorModal('Could not load accounts: ' + error.message, { title: 'Could Not Load Accounts' }); },
    invalidAccount() { showErrorModal('Could not read a readable account. It may have been removed or changed.', { title: 'Account Data Error' }); },
    unsupported(type) { showErrorModal('Unsupported reader account type: ' + type, { title: 'Unsupported Account Type' }); },
};
