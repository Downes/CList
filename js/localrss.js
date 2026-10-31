//  localrss.js  -  LocalRSS personal-database reader for CList
//  Part of CList, the next generation of learning and connecting with your community
//
//  Version 0.1 created by Stephen Downes on October 31, 2026
//
//  Copyright Stephen Downes 2026, downes.ca
//  Licensed under Creative Commons Attribution 4.0 International https://creativecommons.org/licenses/by/4.0/
//
//  This software carries NO WARRANTY OF ANY KIND.
//  This software is provided "AS IS," and you, its user, assume all risks when using it.
//
//  Reads a single (serviceUrl, database) pair against a LocalRSS instance's own
//  /api/items, /api/mark_read, /api/toggle_bookmark routes -- no local storage,
//  the server is the store. One CList account = one LocalRSS database (see
//  /srv/apps/localrss_reader/CLAUDE.md, "Architecture: Global Harvest Store").

// ---- Account schema ----

window.CList.schemas = window.CList.schemas || {};

window.CList.schemas['LOCALRSS'] = {
    type: 'LOCALRSS',
    instanceFromKey: true,
    kvKey: { label: 'Account Name', placeholder: 'My Feeds' },
    fields: [
        { key: 'title',       label: 'Title',               editable: true, inputType: 'text', placeholder: 'My Feeds',                   default: '' },
        { key: 'permissions', label: 'Permissions',         editable: true, inputType: 'text', placeholder: 'r',                           default: 'r' },
        { key: 'serviceUrl',  label: 'LocalRSS Service URL', editable: true, inputType: 'text', placeholder: 'https://localrss.downes.ca', default: 'https://localrss.downes.ca' },
        { key: 'database',    label: 'Database',            editable: true, inputType: 'text', placeholder: 'rss',                         default: 'rss' },
    ]
};

// ---- Reader handler ----

(function () {
    window.CList.readers = window.CList.readers || {};
    window.CList.readers['LOCALRSS'] = {
        name: 'LOCALRSS', display: 'LocalRSS', icon: 'rss_feed',
        description: 'Read a personal LocalRSS database',
        type: 'feed',
        initialize: async (accountData) => { await initializeLocalrss(accountData); },
        feedFunctions: {
            'Unread':     () => { localrssFilter = 'unread';     localrssLoad().catch(localrssReportLoadError); },
            'All':        () => { localrssFilter = 'all';        localrssLoad().catch(localrssReportLoadError); },
            'Bookmarked': () => { localrssFilter = 'bookmarked'; localrssLoad().catch(localrssReportLoadError); },
            'Refresh':    () => localrssLoad().catch(localrssReportLoadError),
            'Options':    () => localrssOptionsOverlay(),
        },
        onFeedClick:   null,
        onAuthorClick: null,
        statusActions: (item, itemID) => {
            let a = '';
            if (item._hasExpandableContent) {
                a += `<button class="clist-action-btn" title="Expand" `
                   + `onclick="toggleEntryExpanded('${itemID}');"><span class="material-icons md-18 md-light">zoom_out_map</span></button>`;
            }
            if (item.link && /^https?:\/\//i.test(item.link)) {
                const safeLink = item.link.replace(/'/g, '%27');
                a += `<button class="clist-action-btn" title="Open in browser" `
                   + `onclick="openInBrowser('${safeLink}', '${itemID}')">`
                   + `<span class="material-icons md-18 md-light">launch</span></button>`;
            }
            const ri = item.readAt ? 'visibility_off' : 'visibility';
            const rt = item.readAt ? 'Mark unread' : 'Mark read';
            a += `<button class="clist-action-btn" `
               + `onclick="localrssToggleRead(${item.entryId},this)" title="${rt}">`
               + `<span class="material-icons md-18 md-light">${ri}</span></button>`;
            const bi = item.bookmarked ? 'bookmark' : 'bookmark_border';
            const bt = item.bookmarked ? 'Remove bookmark' : 'Bookmark';
            a += `<button class="clist-action-btn" `
               + `onclick="localrssToggleBookmark(${item.entryId},this)" title="${bt}">`
               + `<span class="material-icons md-18 md-light">${bi}</span></button>`;
            return a;
        }
    };
})();

// ---- Module state ----

let localrssCurrentAccount = null;
let localrssFilter = 'unread';
let localrssOffset = 0;
const LOCALRSS_PAGE_SIZE = 50;

function localrssReportLoadError(e) {
    console.error(e);
    showErrorModal('Could not load LocalRSS items: ' + e.message, { title: 'LocalRSS error' });
}

// ---- Auth / request helpers ----
// Same header shape rss.js already sends to opml2json: a kvstore-issued
// bearer token plus the issuing instance, verified locally by the server.

function _localrssAuthHeaders() {
    const token = (typeof getSiteSpecificCookie === 'function')
        ? getSiteSpecificCookie(window.CList.config.flaskSiteUrl, window.CList.keys.ACCESS_TOKEN) || ''
        : '';
    const headers = {};
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
        headers['X-Kvstore-Url'] = window.CList.config.flaskSiteUrl;
    }
    return headers;
}

function _localrssUrl(accountData, path) {
    return `${(accountData.serviceUrl || '').replace(/\/$/, '')}${path}`;
}

async function _localrssPost(path, body) {
    const resp = await fetch(_localrssUrl(localrssCurrentAccount, path), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ..._localrssAuthHeaders() },
        body: JSON.stringify({ db: localrssCurrentAccount.database, ...body }),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || data.ok === false) throw new Error(data.error || `HTTP ${resp.status}`);
    return data;
}

function _localrssPlainText(html) {
    const d = document.createElement('div');
    d.innerHTML = html || '';
    return d.textContent || '';
}

// ---- Normalization ----

async function normalizeLocalrssItem(raw) {
    const item = {
        service: 'LOCALRSS',
        url:      raw.link || `local-entry:${raw.id}`,
        title:    raw.title,
        titleHtml: `<strong>${escapeHtml(raw.title || '')}</strong>`,
        expandOnTitleClick: true,
        desc:     _localrssPlainText(raw.content_html),
        feed:     raw.feed_title,
        author:   raw.author || raw.feed_author || '',
        date:     new Date((raw.published || 0) * 1000).toLocaleDateString(),
        link:     raw.link,
        guid:     String(raw.id),
        entryId:  raw.id,
        readAt:   raw.read_at,
        bookmarked: raw.bookmarked,
    };
    if (raw.content_html) item.full_content = window.sanitizeHtml(raw.content_html);
    if (raw.thumbnail) item.images = [{ url: raw.thumbnail }];
    return item;
}

// ---- Public API ----

async function initializeLocalrss(accountData) {
    localrssCurrentAccount = accountData;
    localrssFilter = 'unread';
    await localrssLoad();
}

async function localrssLoad(append = false) {
    if (!localrssCurrentAccount) return;
    const fc = window.CList.ui.view.feedContainer;
    if (!fc) return;
    if (!append) localrssOffset = 0;
    showLoader();
    try {
        const url = _localrssUrl(localrssCurrentAccount, '/api/items')
            + `?db=${encodeURIComponent(localrssCurrentAccount.database)}`
            + `&filter=${encodeURIComponent(localrssFilter)}`
            + `&limit=${LOCALRSS_PAGE_SIZE}&offset=${localrssOffset}`;
        const resp = await fetch(url, { headers: _localrssAuthHeaders() });
        const items = await resp.json().catch(() => null);
        if (!resp.ok) throw new Error((items && items.error) || `HTTP ${resp.status}`);
        if (!Array.isArray(items)) throw new Error('Unexpected response from server');

        if (!append && !items.length) {
            fc.innerHTML = '';
            fc.appendChild(createFeedHeader(localrssCurrentAccount.title || 'LocalRSS'));
            const p = document.createElement('p');
            p.className = 'feed-status-message';
            p.textContent = localrssFilter === 'bookmarked' ? 'No bookmarked items.'
                          : localrssFilter === 'unread'     ? 'All caught up — no unread items.'
                          :                                   'No items found.';
            fc.appendChild(p);
            return;
        }

        const hasMore = items.length === LOCALRSS_PAGE_SIZE;
        await window.CList.ui.renderFeed(items, fc, {
            normalize: normalizeLocalrssItem,
            title: localrssCurrentAccount.title || 'LocalRSS',
            append,
            onLoadMore: hasMore ? () => {
                localrssOffset += LOCALRSS_PAGE_SIZE;
                localrssLoad(true).catch(localrssReportLoadError);
            } : null,
        });
    } catch (err) {
        console.error('LocalRSS: error loading items:', err);
        showServiceError('feed-container', 'LocalRSS error', err.message,
            'Try clicking <strong>Refresh</strong>, or check the Service URL/Database in your account settings.');
    } finally {
        if (window.CList.ui.view.loadingIndicator) window.CList.ui.view.loadingIndicator.style.display = 'none';
    }
}

async function localrssToggleRead(entryId, btn) {
    try {
        const data = await _localrssPost('/api/toggle_read', { id: entryId });
        if (btn) {
            const icon = btn.querySelector('.material-icons');
            if (icon) icon.textContent = data.read ? 'visibility_off' : 'visibility';
            btn.title = data.read ? 'Mark unread' : 'Mark read';
        }
        if (localrssFilter === 'unread' && data.read) btn?.closest('.status-box')?.remove();
    } catch (err) {
        console.error('LocalRSS: could not toggle read state:', err);
        showErrorModal('Could not update read state: ' + err.message, { title: 'Could not update read state' });
    }
}

async function localrssToggleBookmark(entryId, btn) {
    try {
        const data = await _localrssPost('/api/toggle_bookmark', { id: entryId });
        if (btn) {
            btn.innerHTML = `<span class="material-icons md-18 md-light">${data.bookmarked ? 'bookmark' : 'bookmark_border'}</span>`;
            btn.title = data.bookmarked ? 'Remove bookmark' : 'Bookmark';
        }
        if (localrssFilter === 'bookmarked' && !data.bookmarked) btn?.closest('.status-box')?.remove();
    } catch (err) {
        console.error('LocalRSS: could not toggle bookmark:', err);
        showErrorModal('Could not update bookmark: ' + err.message, { title: 'Could not update bookmark' });
    }
}

// ---- Options panel (left pane) ----
// Mirrors LocalRSS's own admin-UI sidebar (static/index.html), wired against the
// same /api/* routes used there. Every route here already allows CORS from
// clist.mooc.ca and accepts the Bearer + X-Kvstore-Url auth this file already
// sends (see Caddy's localrss.downes.ca block) -- no backend changes needed.

let _localrssOpenFeedId = null;
let _localrssFeedSearchTimer = null;

function localrssOptionsPanel() {
    const div = document.createElement('div');
    div.id = 'localrss-options-panel';

    div.appendChild(_localrssDatabaseSection());
    div.appendChild(_localrssStatsSection());
    div.appendChild(_localrssFeedsSection());
    div.appendChild(_localrssImportExportSection());

    return div;
}

// Renders as an overlay directly on #left-pane-body (same stacking slot as
// #audio-section/#chat-section) instead of going through openLeftInterface's
// #left-content swap, since that path produced no visible panel for reasons
// not pinned down (no console errors, pane mechanics otherwise identical to
// the working Read/Find/Mastodon panels). The overlay sits above any other
// left-pane content and removes itself via its own close button.
function localrssOptionsOverlay() {
    openLeftPane();
    const body = document.getElementById('left-pane-body');
    if (!body) {
        console.error('LocalRSS: #left-pane-body not found, cannot show options overlay.');
        showErrorModal('Could not open feed options.', { title: 'Feed options failed' });
        return;
    }

    document.getElementById('localrss-options-overlay')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'localrss-options-overlay';

    const header = document.createElement('div');
    header.id = 'localrss-options-header';
    const heading = document.createElement('h2');
    heading.textContent = 'Feed Options';
    header.appendChild(heading);
    const closeBtn = document.createElement('button');
    closeBtn.className = 'clist-action-btn';
    closeBtn.title = 'Close';
    closeBtn.innerHTML = '<span class="material-icons md-18 md-light">close</span>';
    closeBtn.onclick = () => overlay.remove();
    header.appendChild(closeBtn);
    overlay.appendChild(header);

    overlay.appendChild(localrssOptionsPanel());
    body.appendChild(overlay);

    _localrssRefreshStats();
    _localrssRefreshErrors();
}

function _localrssSectionHeading(text) {
    const h = document.createElement('h4');
    h.textContent = text;
    return h;
}

function _localrssDatabaseSection() {
    const div = document.createElement('div');
    div.appendChild(_localrssSectionHeading('Database'));

    const dbLine = document.createElement('p');
    dbLine.className = 'list-tip';
    dbLine.textContent = `Current: ${localrssCurrentAccount?.database || ''}`;
    div.appendChild(dbLine);

    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.id = 'localrss-search-input';
    searchInput.placeholder = 'Search posts';
    searchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') _localrssSearchPosts(); });
    div.appendChild(searchInput);

    const searchBtn = document.createElement('button');
    searchBtn.className = 'btn btn-small';
    searchBtn.textContent = 'Search';
    searchBtn.onclick = () => _localrssSearchPosts();
    div.appendChild(searchBtn);

    const status = document.createElement('p');
    status.id = 'localrss-search-status';
    status.className = 'list-tip';
    div.appendChild(status);

    return div;
}

function _localrssStatsSection() {
    const div = document.createElement('div');
    div.appendChild(_localrssSectionHeading('Update'));

    const showLabel = document.createElement('label');
    showLabel.textContent = 'Show: ';
    const showSelect = document.createElement('select');
    showSelect.id = 'localrss-show-select';
    [['unread', 'Unread'], ['read', 'Read'], ['bookmarked', 'Bookmarked'], ['all', 'All']].forEach(([val, label]) => {
        const opt = document.createElement('option');
        opt.value = val;
        opt.textContent = label;
        if (val === localrssFilter) opt.selected = true;
        showSelect.appendChild(opt);
    });
    showSelect.onchange = () => {
        localrssFilter = showSelect.value;
        localrssLoad().catch(localrssReportLoadError);
    };
    showLabel.appendChild(showSelect);
    div.appendChild(showLabel);

    const markAllBtn = document.createElement('button');
    markAllBtn.className = 'btn btn-small';
    markAllBtn.textContent = 'Mark all as read';
    markAllBtn.onclick = () => _localrssConfirm(
        'Mark all unread entries in this database as read?',
        'Mark all as read',
        async () => {
            try {
                await _localrssPost('/api/mark_all_read', {});
                showStatusMessage('All entries marked read.');
                _localrssRefreshStats();
                if (localrssFilter === 'unread') localrssLoad().catch(localrssReportLoadError);
            } catch (e) {
                console.error('LocalRSS: mark all read failed', e);
                showErrorModal('Could not mark all as read: ' + e.message, { title: 'Mark all as read failed' });
            }
        }
    );
    div.appendChild(markAllBtn);

    const statsPill = document.createElement('p');
    statsPill.id = 'localrss-stats-pill';
    statsPill.className = 'list-tip';
    statsPill.textContent = 'Loading stats…';
    div.appendChild(statsPill);

    const errorsToggle = document.createElement('button');
    errorsToggle.id = 'localrss-errors-toggle';
    errorsToggle.className = 'btn btn-small';
    errorsToggle.textContent = 'Feed errors: …';
    errorsToggle.onclick = () => {
        const list = document.getElementById('localrss-errors-list');
        if (list) list.style.display = list.style.display === 'none' ? 'block' : 'none';
    };
    div.appendChild(errorsToggle);

    const errorsList = document.createElement('div');
    errorsList.id = 'localrss-errors-list';
    errorsList.className = 'account-list';
    errorsList.style.display = 'none';
    div.appendChild(errorsList);

    return div;
}

function _localrssFeedsSection() {
    const div = document.createElement('div');
    div.appendChild(_localrssSectionHeading('Feeds'));

    const newFeedInput = document.createElement('input');
    newFeedInput.type = 'text';
    newFeedInput.id = 'localrss-new-feed-url';
    newFeedInput.placeholder = 'Add new feed';
    div.appendChild(newFeedInput);

    const createBtn = document.createElement('button');
    createBtn.className = 'btn btn-small';
    createBtn.textContent = 'Create / Discover';
    createBtn.onclick = () => _localrssCreateFeed();
    div.appendChild(createBtn);

    const hint = document.createElement('p');
    hint.className = 'list-tip';
    hint.textContent = 'If you paste a website URL, the reader will look for an RSS/Atom link in the page header.';
    div.appendChild(hint);

    const createStatus = document.createElement('p');
    createStatus.id = 'localrss-create-feed-status';
    createStatus.className = 'list-tip';
    div.appendChild(createStatus);

    const feedSearchInput = document.createElement('input');
    feedSearchInput.type = 'text';
    feedSearchInput.id = 'localrss-feed-search-input';
    feedSearchInput.placeholder = 'Find / update feed';
    feedSearchInput.addEventListener('input', () => {
        clearTimeout(_localrssFeedSearchTimer);
        _localrssFeedSearchTimer = setTimeout(_localrssSearchFeeds, 300);
    });
    div.appendChild(feedSearchInput);

    const feedResults = document.createElement('div');
    feedResults.id = 'localrss-feed-results';
    feedResults.className = 'account-list';
    div.appendChild(feedResults);

    div.appendChild(_localrssFeedEditor());

    return div;
}

function _localrssLabeledInput(id, labelText) {
    const row = document.createElement('div');
    const label = document.createElement('label');
    label.htmlFor = id;
    label.textContent = labelText;
    row.appendChild(label);
    const input = document.createElement('input');
    input.type = 'text';
    input.id = id;
    row.appendChild(input);
    return row;
}

function _localrssFeedEditor() {
    const div = document.createElement('div');
    div.id = 'localrss-feed-editor';
    div.style.display = 'none';

    div.appendChild(_localrssLabeledInput('localrss-edit-feed-url', 'Feed URL'));
    div.appendChild(_localrssLabeledInput('localrss-edit-feed-title', 'Title'));
    div.appendChild(_localrssLabeledInput('localrss-edit-feed-author', 'Author'));
    div.appendChild(_localrssLabeledInput('localrss-edit-feed-image', 'Image URL'));

    const errorMsg = document.createElement('p');
    errorMsg.id = 'localrss-feed-editor-error';
    errorMsg.className = 'error-message';
    errorMsg.style.display = 'none';
    div.appendChild(errorMsg);

    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn btn-small';
    saveBtn.textContent = 'Save';
    saveBtn.onclick = () => _localrssSaveFeed();
    div.appendChild(saveBtn);

    const retryBtn = document.createElement('button');
    retryBtn.className = 'btn btn-small';
    retryBtn.textContent = 'Retry';
    retryBtn.onclick = () => _localrssRetryFeed();
    div.appendChild(retryBtn);

    const showPostsBtn = document.createElement('button');
    showPostsBtn.className = 'btn btn-small';
    showPostsBtn.textContent = 'Show posts';
    showPostsBtn.onclick = () => _localrssShowFeedPosts();
    div.appendChild(showPostsBtn);

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn btn-small btn-secondary';
    deleteBtn.textContent = 'Delete';
    deleteBtn.onclick = () => _localrssDeleteFeed();
    div.appendChild(deleteBtn);

    const status = document.createElement('p');
    status.id = 'localrss-feed-editor-status';
    status.className = 'list-tip';
    div.appendChild(status);

    return div;
}

function _localrssImportExportSection() {
    const div = document.createElement('div');
    div.appendChild(_localrssSectionHeading('Import / Export'));

    const fileLabel = document.createElement('label');
    fileLabel.htmlFor = 'localrss-opml-file';
    fileLabel.textContent = 'Import OPML';
    div.appendChild(fileLabel);

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.id = 'localrss-opml-file';
    fileInput.accept = '.opml,.xml,text/xml,application/xml';
    div.appendChild(fileInput);

    const modeLabel = document.createElement('label');
    modeLabel.htmlFor = 'localrss-opml-mode';
    modeLabel.textContent = 'Import mode';
    div.appendChild(modeLabel);

    const modeSelect = document.createElement('select');
    modeSelect.id = 'localrss-opml-mode';
    [['merge', 'Merge into current database'], ['replace', 'Replace current database'], ['newdb', 'Create new database']]
        .forEach(([val, label]) => {
            const opt = document.createElement('option');
            opt.value = val;
            opt.textContent = label;
            modeSelect.appendChild(opt);
        });
    div.appendChild(modeSelect);

    const newDbRow = document.createElement('div');
    newDbRow.id = 'localrss-new-db-row';
    newDbRow.style.display = 'none';
    const newDbLabel = document.createElement('label');
    newDbLabel.htmlFor = 'localrss-new-db-name';
    newDbLabel.textContent = 'New database name';
    newDbRow.appendChild(newDbLabel);
    const newDbInput = document.createElement('input');
    newDbInput.type = 'text';
    newDbInput.id = 'localrss-new-db-name';
    newDbRow.appendChild(newDbInput);
    div.appendChild(newDbRow);

    modeSelect.onchange = () => { newDbRow.style.display = modeSelect.value === 'newdb' ? 'block' : 'none'; };

    const importBtn = document.createElement('button');
    importBtn.className = 'btn btn-small';
    importBtn.textContent = 'Import';
    importBtn.onclick = () => _localrssImportOpml();
    div.appendChild(importBtn);

    const importStatus = document.createElement('p');
    importStatus.id = 'localrss-opml-import-status';
    importStatus.className = 'list-tip';
    div.appendChild(importStatus);

    const exportBtn = document.createElement('button');
    exportBtn.className = 'btn btn-small';
    exportBtn.textContent = 'Export OPML';
    exportBtn.onclick = () => _localrssExportOpml();
    div.appendChild(exportBtn);

    const exportStatus = document.createElement('p');
    exportStatus.id = 'localrss-opml-export-status';
    exportStatus.className = 'list-tip';
    div.appendChild(exportStatus);

    return div;
}

// ---- Panel actions ----

function _localrssConfirm(message, title, onConfirm) {
    const box = document.createElement('div');

    const heading = document.createElement('h2');
    heading.className = 'error-modal-title';
    heading.textContent = title;
    box.appendChild(heading);

    const msg = document.createElement('p');
    msg.textContent = message;
    box.appendChild(msg);

    const row = document.createElement('div');
    row.className = 'error-modal-actions';

    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'btn';
    confirmBtn.textContent = 'OK';
    confirmBtn.onclick = () => { document.getElementById('generic-modal')?.remove(); onConfirm(); };
    row.appendChild(confirmBtn);

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn btn-secondary';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.onclick = () => document.getElementById('generic-modal')?.remove();
    row.appendChild(cancelBtn);

    box.appendChild(row);
    showModal(box, { hideDefaultClose: true });
}

async function _localrssRefreshStats() {
    const pill = document.getElementById('localrss-stats-pill');
    if (!pill || !localrssCurrentAccount) return;
    try {
        const url = _localrssUrl(localrssCurrentAccount, '/api/stats') + `?db=${encodeURIComponent(localrssCurrentAccount.database)}`;
        const resp = await fetch(url, { headers: _localrssAuthHeaders() });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error || `HTTP ${resp.status}`);
        pill.textContent = `feeds=${data.feeds}  unread=${data.unread}  bookmarked=${data.bookmarked}  retention=${data.retention_days}d`;
    } catch (e) {
        console.error('LocalRSS: could not load stats', e);
        pill.textContent = 'Could not load stats.';
    }
}

async function _localrssRefreshErrors() {
    const toggle = document.getElementById('localrss-errors-toggle');
    const list = document.getElementById('localrss-errors-list');
    if (!toggle || !list || !localrssCurrentAccount) return;
    try {
        const url = _localrssUrl(localrssCurrentAccount, '/api/feeds_errors') + `?db=${encodeURIComponent(localrssCurrentAccount.database)}`;
        const resp = await fetch(url, { headers: _localrssAuthHeaders() });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error || `HTTP ${resp.status}`);
        toggle.textContent = `Feed errors: ${data.feeds.length}`;
        list.innerHTML = '';
        for (const feed of data.feeds) {
            const btn = document.createElement('button');
            btn.className = 'account-button';
            btn.title = feed.error_msg || '';
            const nameEl = document.createElement('span');
            nameEl.textContent = `${feed.title || feed.url} (${feed.fail_count})`;
            btn.appendChild(nameEl);
            btn.addEventListener('click', () => _localrssOpenFeedEditor(feed));
            list.appendChild(btn);
        }
    } catch (e) {
        console.error('LocalRSS: could not load feed errors', e);
        toggle.textContent = 'Feed errors: ?';
    }
}

async function _localrssSearchPosts() {
    const input = document.getElementById('localrss-search-input');
    const status = document.getElementById('localrss-search-status');
    const fc = window.CList.ui.view.feedContainer;
    const q = (input?.value || '').trim();
    if (!q || !fc) return;
    if (status) status.textContent = 'Searching…';
    try {
        const url = _localrssUrl(localrssCurrentAccount, '/api/items')
            + `?db=${encodeURIComponent(localrssCurrentAccount.database)}&q=${encodeURIComponent(q)}`;
        const resp = await fetch(url, { headers: _localrssAuthHeaders() });
        const items = await resp.json();
        if (!resp.ok) throw new Error((items && items.error) || `HTTP ${resp.status}`);
        if (status) status.textContent = `${items.length} result${items.length !== 1 ? 's' : ''}.`;
        if (!items.length) {
            fc.innerHTML = '';
            fc.appendChild(createFeedHeader(`Search: "${q}"`));
            const p = document.createElement('p');
            p.className = 'feed-status-message';
            p.textContent = 'No posts found.';
            fc.appendChild(p);
            return;
        }
        await window.CList.ui.renderFeed(items, fc, {
            normalize: normalizeLocalrssItem,
            title: `Search: "${q}"`,
            append: false,
            onLoadMore: null,
        });
    } catch (e) {
        console.error('LocalRSS: search failed', e);
        if (status) status.textContent = 'Search failed: ' + e.message;
    }
}

async function _localrssCreateFeed() {
    const input = document.getElementById('localrss-new-feed-url');
    const status = document.getElementById('localrss-create-feed-status');
    const url = (input?.value || '').trim();
    if (!url) return;
    if (status) status.textContent = 'Looking for a feed…';
    try {
        const data = await _localrssPost('/api/feed_create', { url });
        if (status) status.textContent = data.existing
            ? `Already in this database: ${data.feed.title || data.feed.url}`
            : `Added: ${data.feed.title || data.feed.url}`;
        input.value = '';
        _localrssRefreshStats();
        if (localrssFilter === 'unread') localrssLoad().catch(localrssReportLoadError);
    } catch (e) {
        console.error('LocalRSS: feed create failed', e);
        if (status) status.textContent = 'Could not add feed: ' + e.message;
    }
}

async function _localrssSearchFeeds() {
    const input = document.getElementById('localrss-feed-search-input');
    const results = document.getElementById('localrss-feed-results');
    if (!input || !results) return;
    const q = input.value.trim();
    try {
        const url = _localrssUrl(localrssCurrentAccount, '/api/feeds')
            + `?db=${encodeURIComponent(localrssCurrentAccount.database)}&q=${encodeURIComponent(q)}&limit=50`;
        const resp = await fetch(url, { headers: _localrssAuthHeaders() });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error || `HTTP ${resp.status}`);
        results.innerHTML = '';
        for (const feed of data.feeds) {
            const btn = document.createElement('button');
            btn.className = 'account-button';
            const nameEl = document.createElement('span');
            nameEl.textContent = feed.title || feed.url;
            btn.appendChild(nameEl);
            btn.addEventListener('click', () => _localrssOpenFeedEditor(feed));
            results.appendChild(btn);
        }
    } catch (e) {
        console.error('LocalRSS: feed search failed', e);
        results.innerHTML = '';
        const p = document.createElement('p');
        p.className = 'feed-status-message';
        p.textContent = 'Could not search feeds: ' + e.message;
        results.appendChild(p);
    }
}

async function _localrssOpenFeedEditor(feedSummary) {
    const editor = document.getElementById('localrss-feed-editor');
    const errorMsg = document.getElementById('localrss-feed-editor-error');
    const status = document.getElementById('localrss-feed-editor-status');
    if (!editor) return;
    try {
        const url = _localrssUrl(localrssCurrentAccount, `/api/feed/${feedSummary.id}`)
            + `?db=${encodeURIComponent(localrssCurrentAccount.database)}`;
        const resp = await fetch(url, { headers: _localrssAuthHeaders() });
        const data = await resp.json();
        if (!resp.ok || !data.ok) throw new Error((data && data.error) || `HTTP ${resp.status}`);
        const feed = data.feed;
        _localrssOpenFeedId = feed.id;
        document.getElementById('localrss-edit-feed-url').value = feed.url || '';
        document.getElementById('localrss-edit-feed-title').value = feed.title || '';
        document.getElementById('localrss-edit-feed-author').value = feed.author || '';
        document.getElementById('localrss-edit-feed-image').value = feed.image || '';
        if (feed.fail_count > 0 && feed.error_msg) {
            errorMsg.textContent = `${feed.fail_count} failed attempt${feed.fail_count !== 1 ? 's' : ''}: ${feed.error_msg}`;
            errorMsg.style.display = 'block';
        } else {
            errorMsg.style.display = 'none';
        }
        if (status) status.textContent = '';
        editor.style.display = 'block';
        editor.scrollIntoView({ block: 'nearest' });
    } catch (e) {
        console.error('LocalRSS: could not load feed', e);
        showErrorModal('Could not load feed: ' + e.message, { title: 'Feed load failed' });
    }
}

async function _localrssSaveFeed() {
    const status = document.getElementById('localrss-feed-editor-status');
    if (!_localrssOpenFeedId) return;
    const body = {
        id: _localrssOpenFeedId,
        url: document.getElementById('localrss-edit-feed-url').value.trim(),
        title: document.getElementById('localrss-edit-feed-title').value.trim(),
        author: document.getElementById('localrss-edit-feed-author').value.trim(),
        image: document.getElementById('localrss-edit-feed-image').value.trim(),
    };
    try {
        await _localrssPost('/api/feed_update', body);
        if (status) status.textContent = 'Saved.';
        _localrssRefreshStats();
        _localrssRefreshErrors();
    } catch (e) {
        console.error('LocalRSS: feed update failed', e);
        if (status) status.textContent = 'Could not save: ' + e.message;
    }
}

async function _localrssRetryFeed() {
    const status = document.getElementById('localrss-feed-editor-status');
    const errorMsg = document.getElementById('localrss-feed-editor-error');
    if (!_localrssOpenFeedId) return;
    try {
        const data = await _localrssPost('/api/feed_retry', { id: _localrssOpenFeedId });
        const feed = data.feed;
        if (feed.fail_count > 0 && feed.error_msg) {
            errorMsg.textContent = `${feed.fail_count} failed attempt${feed.fail_count !== 1 ? 's' : ''}: ${feed.error_msg}`;
            errorMsg.style.display = 'block';
        } else {
            errorMsg.style.display = 'none';
        }
        if (status) status.textContent = feed.fail_count > 0 ? 'Still failing.' : 'Fetched successfully.';
        _localrssRefreshStats();
        _localrssRefreshErrors();
    } catch (e) {
        console.error('LocalRSS: feed retry failed', e);
        if (status) status.textContent = 'Retry failed: ' + e.message;
    }
}

async function _localrssShowFeedPosts() {
    const fc = window.CList.ui.view.feedContainer;
    if (!_localrssOpenFeedId || !fc) return;
    const titleField = document.getElementById('localrss-edit-feed-title').value.trim();
    try {
        const url = _localrssUrl(localrssCurrentAccount, '/api/items')
            + `?db=${encodeURIComponent(localrssCurrentAccount.database)}&feed_id=${_localrssOpenFeedId}`;
        const resp = await fetch(url, { headers: _localrssAuthHeaders() });
        const items = await resp.json();
        if (!resp.ok) throw new Error((items && items.error) || `HTTP ${resp.status}`);
        await window.CList.ui.renderFeed(items, fc, {
            normalize: normalizeLocalrssItem,
            title: titleField || 'Feed',
            append: false,
            onLoadMore: null,
        });
    } catch (e) {
        console.error('LocalRSS: could not load feed posts', e);
        showServiceError('feed-container', 'LocalRSS error', e.message);
    }
}

function _localrssDeleteFeed() {
    const status = document.getElementById('localrss-feed-editor-status');
    const titleField = document.getElementById('localrss-edit-feed-title').value.trim() || 'this feed';
    if (!_localrssOpenFeedId) return;
    _localrssConfirm(
        `Remove "${titleField}" from this database? Its entries will be removed from this database too (shared feeds are unaffected elsewhere).`,
        'Delete feed',
        async () => {
            try {
                await _localrssPost('/api/feed_delete', { id: _localrssOpenFeedId });
                document.getElementById('localrss-feed-editor').style.display = 'none';
                _localrssOpenFeedId = null;
                document.getElementById('localrss-feed-results').innerHTML = '';
                document.getElementById('localrss-feed-search-input').value = '';
                _localrssRefreshStats();
                _localrssRefreshErrors();
                if (status) status.textContent = '';
            } catch (e) {
                console.error('LocalRSS: feed delete failed', e);
                showErrorModal('Could not delete feed: ' + e.message, { title: 'Delete failed' });
            }
        }
    );
}

async function _localrssImportOpml() {
    const fileInput = document.getElementById('localrss-opml-file');
    const mode = document.getElementById('localrss-opml-mode').value;
    const newDbName = document.getElementById('localrss-new-db-name').value.trim();
    const status = document.getElementById('localrss-opml-import-status');
    const file = fileInput?.files?.[0];
    if (!file) { if (status) status.textContent = 'Choose an OPML file first.'; return; }

    const formData = new FormData();
    formData.append('opml', file);
    formData.append('mode', mode);
    if (mode === 'newdb') formData.append('new_db_name', newDbName);

    if (status) status.textContent = 'Importing…';
    try {
        const url = _localrssUrl(localrssCurrentAccount, '/api/opml_import')
            + `?db=${encodeURIComponent(localrssCurrentAccount.database)}`;
        const resp = await fetch(url, { method: 'POST', headers: _localrssAuthHeaders(), body: formData });
        const data = await resp.json();
        if (!resp.ok || data.ok === false) throw new Error(data.error || `HTTP ${resp.status}`);
        if (mode === 'newdb') {
            if (status) status.textContent = `Created database "${data.db}" with ${data.imported} feed${data.imported !== 1 ? 's' : ''} `
                + `(${data.skipped} already present). To read it here, set this account's Database field to "${data.db}".`;
        } else {
            if (status) status.textContent = `Imported ${data.imported} feed${data.imported !== 1 ? 's' : ''} (${data.skipped} already present).`;
            _localrssRefreshStats();
            if (localrssFilter === 'unread') localrssLoad().catch(localrssReportLoadError);
        }
        fileInput.value = '';
    } catch (e) {
        console.error('LocalRSS: OPML import failed', e);
        if (status) status.textContent = 'Import failed: ' + e.message;
    }
}

async function _localrssExportOpml() {
    const status = document.getElementById('localrss-opml-export-status');
    if (status) status.textContent = 'Exporting…';
    try {
        const url = _localrssUrl(localrssCurrentAccount, '/api/opml_export')
            + `?db=${encodeURIComponent(localrssCurrentAccount.database)}`;
        const resp = await fetch(url, { headers: _localrssAuthHeaders() });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const blob = await resp.blob();
        const objectUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = objectUrl;
        a.download = `${localrssCurrentAccount.database || 'feeds'}.opml`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(objectUrl);
        if (status) status.textContent = 'Exported.';
    } catch (e) {
        console.error('LocalRSS: OPML export failed', e);
        if (status) status.textContent = 'Export failed: ' + e.message;
    }
}
