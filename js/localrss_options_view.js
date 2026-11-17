// LocalRSS Options rendering. Legacy sections retain their existing callbacks.
function localrssOptionsPanel(target) {
    const div = document.createElement('div');
    div.id = 'localrss-options-panel';

    div.appendChild(_localrssConnectionRow(target));
    div.appendChild(_localrssDatabaseSwitcher(target));
    _localrssDatabaseSection(div, target);
    _localrssStatsSection(div, target);
    _localrssFeedsSection(div, target);
    _localrssImportExportSection(div, target);

    return div;
}

// Renders as an overlay directly on #left-pane-body (same stacking slot as
// #audio-section/#chat-section) instead of going through openLeftInterface's
// #left-content swap, since that path produced no visible panel for reasons
// not pinned down (no console errors, pane mechanics otherwise identical to
// the working Read/Find/Mastodon panels). The overlay sits above any other
// left-pane content and removes itself via its own close button.
function renderLocalrssOptions(target) {
    openLeftPane();
    const body = document.getElementById('left-pane-body');
    if (!body) {
        console.error('LocalRSS: #left-pane-body not found, cannot show options overlay.');
        showErrorModal('Could not open feed options.', { title: 'Feed options failed' });
        return;
    }

    document.getElementById('feed-options-section')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'feed-options-section';
    overlay.className = 'left-pane-overlay-section';

    const header = document.createElement('div');
    header.id = 'feed-options-header';
    header.className = 'left-pane-overlay-header';
    const heading = document.createElement('h2');
    heading.textContent = 'Feed Options';
    header.appendChild(heading);
    const popOutBtn = document.createElement('button');
    popOutBtn.className = 'clist-action-btn';
    popOutBtn.title = 'Pop out feed options';
    popOutBtn.innerHTML = '<span class="material-icons md-18 md-light">open_in_new</span>';
    header.appendChild(popOutBtn);
    const closeBtn = document.createElement('button');
    closeBtn.className = 'clist-action-btn';
    closeBtn.title = 'Close';
    closeBtn.innerHTML = '<span class="material-icons md-18 md-light">close</span>';
    closeBtn.onclick = () => { target.close(); overlay.remove(); };
    header.appendChild(closeBtn);
    overlay.appendChild(header);

    overlay.appendChild(localrssOptionsPanel(target));
    body.appendChild(overlay);
    showLeftOverlaySection('feed-options-section');

    target.root = overlay;
    return overlay;
}

function _localrssConnectionRow(target) {
    const row = document.createElement('div');
    row.id = 'localrss-connection-row';
    row.className = 'localrss-options-row';

    const status = document.createElement('span');
    status.id = 'localrss-connection-status';
    status.className = 'list-tip';
    status.textContent = target.account ? _localrssConnectionStatusText(target.account) : '';
    row.appendChild(status);

    const reconnectBtn = document.createElement('button');
    reconnectBtn.className = 'btn btn-small';
    reconnectBtn.textContent = 'Reconnect';
    reconnectBtn.title = 'Re-check for a local LocalRSS instance and reload';
    reconnectBtn.onclick = () => target.reconnect();
    row.appendChild(reconnectBtn);

    return row;
}

// One row, directly under the "Feed Options" heading: lets the user switch to
// any other LOCALRSS account (= another database) without leaving the panel.
// Goes through switchReaderAccount() (reader.js) -- the same registry-driven
// path account-switching always uses -- so the main feed, menu, and selected-
// account display all update too, then rebuilds this overlay against the
// newly-active account.
function _localrssDatabaseSwitcher(target = _localrssOptionsTarget) {
    const row = document.createElement('div');
    row.id = 'localrss-db-switcher';
    row.className = 'localrss-options-row';

    const label = document.createElement('label');
    label.htmlFor = 'localrss-db-select';
    label.textContent = 'Database:';

    const select = document.createElement('select');
    select.id = 'localrss-db-select';

    (window.CList.accounts || []).forEach(acc => {
        const data = parseAccountValue(acc);
        if (!data || data.type !== 'LOCALRSS') return;
        const opt = document.createElement('option');
        opt.value = acc.key;
        opt.textContent = data.title || data.database || acc.key;
        if (acc.key === target.accountKey) {
            opt.selected = true;
        }
        select.appendChild(opt);
    });

    select.onchange = () => target.switchAccount(select.value);

    row.appendChild(label);
    row.appendChild(select);
    return row;
}

function _localrssStatsSection(div, target) {
    const showRow = document.createElement('div');
    showRow.className = 'localrss-options-row';

    const showLabel = document.createElement('label');
    showLabel.htmlFor = 'localrss-show-select';
    showLabel.textContent = 'Show:';
    showRow.appendChild(showLabel);

    const showSelect = document.createElement('select');
    showSelect.id = 'localrss-show-select';
    [['unread', 'Unread'], ['read', 'Read'], ['bookmarked', 'Bookmarked'], ['all', 'All']].forEach(([val, label]) => {
        const opt = document.createElement('option');
        opt.value = val;
        opt.textContent = label;
        if (val === target.filter) opt.selected = true;
        showSelect.appendChild(opt);
    });
    showSelect.onchange = () => target.show(showSelect.value);
    showRow.appendChild(showSelect);
    div.appendChild(showRow);

    const markAllBtn = document.createElement('button');
    markAllBtn.className = 'btn btn-small';
    markAllBtn.textContent = 'Mark all as read';
    markAllBtn.onclick = () => target.confirmMarkAll(markAllBtn);
    div.appendChild(markAllBtn);

    div.appendChild(_localrssSectionHeading('Feeds'));

    const statsPill = document.createElement('p');
    statsPill.id = 'localrss-stats-pill';
    statsPill.className = 'list-tip';
    statsPill.textContent = 'Loading stats…';
    div.appendChild(statsPill);
}


function localrssOptionsStats(target, data) {
    const pill = target.root?.querySelector('#localrss-stats-pill');
    if (pill) pill.textContent = `feeds=${data.feeds}  unread=${data.unread}  bookmarked=${data.bookmarked}  retention=${data.retention_days}d`;
}
function localrssOptionsError(target, action, error) {
    console.error('LocalRSS Options ' + action + ' failed:', error);
    if (action === 'statistics') {
        const pill = target.root?.querySelector('#localrss-stats-pill');
        if (pill) pill.textContent = 'Could not load stats.';
    } else showErrorModal(error.message, { title: 'LocalRSS ' + action + ' failed' });
}

function _localrssDatabaseSection(div, target) {
    const searchRow = document.createElement('div');
    searchRow.className = 'localrss-options-row';
    div.appendChild(searchRow);

    const searchLabel = document.createElement('label');
    searchLabel.htmlFor = 'localrss-search-input';
    searchLabel.textContent = 'Search:';
    searchRow.appendChild(searchLabel);

    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.id = 'localrss-search-input';
    searchInput.placeholder = 'Search posts';
    searchInput.value = localrssReadState().selection?.mode === 'search'
        ? localrssReadState().selection.query : '';
    searchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') _localrssSearchPosts(target); });
    searchRow.appendChild(searchInput);

    const searchBtn = document.createElement('button');
    searchBtn.className = 'btn btn-small';
    searchBtn.textContent = 'Search';
    searchBtn.onclick = () => _localrssSearchPosts(target);
    searchRow.appendChild(searchBtn);

    const status = document.createElement('p');
    status.id = 'localrss-search-status';
    status.className = 'list-tip';
    status.style.display = 'none';
    div.appendChild(status);
}


function localrssSearchInput(target) {
    return (target.root?.querySelector('#localrss-search-input')?.value || '').trim();
}
function localrssSearchStatus(target, text) {
    const status = target.root?.querySelector('#localrss-search-status');
    if (status) { status.style.display = ''; status.textContent = text; }
}
