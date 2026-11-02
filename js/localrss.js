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
        // Set automatically from the database-wide audio-majority test -- see
        // _localrssSyncHasAudio() -- never user-edited. Drives the podcast
        // icon in the sidebar account list (accountIcon() in reader.js/kvstore.js).
        { key: 'hasAudio',    label: 'Has audio episodes',  editable: false, inputType: 'text', placeholder: '',                            default: false },
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
            'Feeds':      () => localrssLoadFeedList().catch(localrssReportLoadError),
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
            if (item.audioIcon) { a += item.audioIcon; }
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

    // Pseudo-service used only as the item.service tag for rows in the "Feeds" list
    // view (a feed's own title/url/description, not its entries) -- never a
    // switchable account type (no schema, no initialize/feedFunctions). Needs its
    // own entry rather than reusing 'LOCALRSS' because makeListing() resolves
    // statusActions by service, and LOCALRSS's own statusActions wires Mark-read/
    // Bookmark to item.entryId -- an entry id. Reusing it here would send a feed's
    // numeric id to the entry-toggle endpoints.
    window.CList.readers['LOCALRSS_FEED'] = {
        name: 'LOCALRSS_FEED', display: 'LocalRSS Feeds', icon: 'rss_feed',
        description: 'A single feed (not its entries) in a LocalRSS database feed list',
        type: 'feed',
        initialize: null,
        feedFunctions: null,
        onFeedClick:   null,
        onAuthorClick: null,
        statusActions: (item, itemID) => {
            let a = '';
            if (item.link && /^https?:\/\//i.test(item.link)) {
                const safeLink = item.link.replace(/'/g, '%27');
                a += `<button class="clist-action-btn" title="Open feed URL in browser" `
                   + `onclick="openInBrowser('${safeLink}', '${itemID}')">`
                   + `<span class="material-icons md-18 md-light">launch</span></button>`;
            }
            a += `<button class="clist-action-btn" title="Show posts" `
               + `onclick="_localrssRenderFeedItems(${item.feedId}, '${(item.title || '').replace(/'/g, "\\'")}').catch(localrssReportLoadError)">`
               + `<span class="material-icons md-18 md-light">list</span></button>`;
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
// A kvstore-issued bearer token plus the issuing instance, verified locally by the server.

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
        feedUrl:  raw.feed_url || null,
        author:   raw.author || raw.feed_author || '',
        date:     new Date((raw.published || 0) * 1000).toLocaleDateString(),
        link:     raw.link,
        guid:     String(raw.id),
        entryId:  raw.id,
        readAt:   raw.read_at,
        bookmarked: raw.bookmarked,
    };
    if (raw.content_html) item.full_content = typeof window.sanitizeHtml === 'function' ? window.sanitizeHtml(raw.content_html) : raw.content_html;
    if (raw.thumbnail) item.images = [{ url: raw.thumbnail }];
    if (raw.audio_url) {
        audioFiles.push({ src: raw.audio_url, title: raw.title });
        const idx = audioFiles.length - 1;
        item.audioIcon = `<button class="clist-action-btn" title="Play audio" onclick="playAudio(${idx});"><span class="material-icons md-18 md-light">play_arrow</span></button>`;
    }
    return item;
}

// Normalizes a /api/feeds row (the feed itself -- title/url/description -- not its
// entries) for the "Feeds" list view. url is the feed's own RSS/Atom URL, so the
// arrow ("Write about this") and pencil (Annotate) buttons, which read generically
// off makeListing()'s reference object, target the feed as a whole.
async function normalizeLocalrssFeed(raw) {
    return {
        service: 'LOCALRSS_FEED',
        url:      raw.url,
        title:    raw.title || raw.url,
        titleHtml: `<strong>${escapeHtml(raw.title || raw.url)}</strong>`,
        desc:     _localrssPlainText(raw.description || ''),
        feed:     localrssCurrentAccount?.title || localrssCurrentAccount?.database || '',
        feedUrl:  null,
        author:   raw.author || '',
        date:     '',
        link:     raw.url,
        guid:     `localrss-feed:${raw.id}`,
        feedId:   raw.id,
    };
}

// Syncs hasAudio on the account from the database-wide majority test (/api/stats'
// has_audio_majority) rather than "has any loaded item ever carried an audio_url" --
// a database with a handful of enclosures amid mostly-text entries should not get
// stuck showing the podcast icon. Drives the sidebar's podcast icon (accountIcon()
// in reader.js/kvstore.js), which is otherwise rendered from stored account data
// alone, before any feed has been loaded.
async function _localrssSyncHasAudio(accountData) {
    if (!accountData) return;
    let isPodcast = false;
    try {
        const statsUrl = _localrssUrl(accountData, '/api/stats') + `?db=${encodeURIComponent(accountData.database)}`;
        const resp = await fetch(statsUrl, { headers: _localrssAuthHeaders() });
        const data = await resp.json().catch(() => null);
        if (!resp.ok || !data) return;
        isPodcast = !!data.has_audio_majority;
    } catch (err) {
        console.error('LocalRSS: could not check audio majority:', err);
        return;
    }
    if (!!accountData.hasAudio === isPodcast) return;
    const encKey = await getEncKey(window.CList.config.flaskSiteUrl);
    if (!encKey) return;
    const encryptedValue = await encryptWithKey(encKey, JSON.stringify({ ...accountData, hasAudio: isPodcast }));
    await window.CList.storage.kv.put(accountData.instance, encryptedValue);
    accountData.hasAudio = isPodcast;
    window.CList.accounts = await getAccounts(window.CList.config.flaskSiteUrl);
    if (typeof populateReadAccountList === 'function') populateReadAccountList(window.CList.accounts);
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
        // Clear audio state from any previous load; append pages keep it.
        if (!append) {
            audioFiles.length = 0;
            const audioList = document.getElementById('audio-list');
            if (audioList) audioList.innerHTML = '';
        }
        const url = _localrssUrl(localrssCurrentAccount, '/api/items')
            + `?db=${encodeURIComponent(localrssCurrentAccount.database)}`
            + `&filter=${encodeURIComponent(localrssFilter)}`
            + `&limit=${LOCALRSS_PAGE_SIZE}&offset=${localrssOffset}`;
        const resp = await fetch(url, { headers: _localrssAuthHeaders() });
        const items = await resp.json().catch(() => null);
        if (!resp.ok) throw new Error((items && items.error) || `HTTP ${resp.status}`);
        if (!Array.isArray(items)) throw new Error('Unexpected response from server');

        if (!append) {
            _localrssSyncHasAudio(localrssCurrentAccount)
                .catch(err => console.error('LocalRSS: could not sync hasAudio flag:', err));
        }

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

        const audioList = document.getElementById('audio-list');
        if (audioList) audioList.innerHTML = generatePlaylistHTML();
    } catch (err) {
        console.error('LocalRSS: error loading items:', err);
        showServiceError('feed-container', 'LocalRSS error', err.message,
            'Try clicking <strong>Refresh</strong>, or check the Service URL/Database in your account settings.');
    } finally {
        if (window.CList.ui.view.loadingIndicator) window.CList.ui.view.loadingIndicator.style.display = 'none';
    }
}

// Loads the current database's feed list itself (title/url/description per feed)
// into the read pane, as opposed to localrssLoad()'s entries. Reuses the same
// generic window.CList.ui.renderFeed() rendering path as every other feed view --
// just with a different normalize function and service tag (normalizeLocalrssFeed /
// LOCALRSS_FEED) so the arrow/pencil buttons target the feed itself.
async function localrssLoadFeedList() {
    if (!localrssCurrentAccount) return;
    const fc = window.CList.ui.view.feedContainer;
    if (!fc) return;
    showLoader();
    try {
        const url = _localrssUrl(localrssCurrentAccount, '/api/feeds')
            + `?db=${encodeURIComponent(localrssCurrentAccount.database)}&limit=1000`;
        const resp = await fetch(url, { headers: _localrssAuthHeaders() });
        const data = await resp.json().catch(() => null);
        if (!resp.ok || !data) throw new Error((data && data.error) || `HTTP ${resp.status}`);
        const feeds = data.feeds || [];

        if (!feeds.length) {
            fc.innerHTML = '';
            fc.appendChild(createFeedHeader(`${localrssCurrentAccount.title || 'LocalRSS'} — Feeds`));
            const p = document.createElement('p');
            p.className = 'feed-status-message';
            p.textContent = 'No feeds in this database.';
            fc.appendChild(p);
            return;
        }

        await window.CList.ui.renderFeed(feeds, fc, {
            normalize: normalizeLocalrssFeed,
            title: `${localrssCurrentAccount.title || 'LocalRSS'} — Feeds`,
            append: false,
            onLoadMore: null,
        });
    } catch (err) {
        console.error('LocalRSS: error loading feed list:', err);
        showServiceError('feed-container', 'LocalRSS error', err.message);
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
// Full feed list for the current database, fetched once and filtered client-side
// on every keystroke in the "Find / update feed" box -- a database only ever has
// a few hundred feeds, small enough that there's no need to round-trip to the
// server (auth + DB query) per keystroke.
let _localrssAllFeedsCache = null;
let _localrssAllFeedsCacheKey = null;

function localrssOptionsPanel() {
    const div = document.createElement('div');
    div.id = 'localrss-options-panel';

    div.appendChild(_localrssDatabaseSwitcher());
    _localrssDatabaseSection(div);
    _localrssStatsSection(div);
    _localrssFeedsSection(div);
    _localrssImportExportSection(div);

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
    closeBtn.onclick = () => overlay.remove();
    header.appendChild(closeBtn);
    overlay.appendChild(header);

    overlay.appendChild(localrssOptionsPanel());
    body.appendChild(overlay);
    showLeftOverlaySection('feed-options-section');

    _localrssRefreshStats();
}

function _localrssSectionHeading(text) {
    const h = document.createElement('h4');
    h.textContent = text;
    return h;
}

// One row, directly under the "Feed Options" heading: lets the user switch to
// any other LOCALRSS account (= another database) without leaving the panel.
// Goes through switchReaderAccount() (reader.js) -- the same registry-driven
// path account-switching always uses -- so the main feed, menu, and selected-
// account display all update too, then rebuilds this overlay against the
// newly-active account.
function _localrssDatabaseSwitcher() {
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
        if (localrssCurrentAccount
            && data.database === localrssCurrentAccount.database
            && data.serviceUrl === localrssCurrentAccount.serviceUrl) {
            opt.selected = true;
        }
        select.appendChild(opt);
    });

    select.onchange = async () => {
        await switchReaderAccount(select.value);
        localrssOptionsOverlay();
    };

    row.appendChild(label);
    row.appendChild(select);
    return row;
}

function _localrssDatabaseSection(div) {
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
    searchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') _localrssSearchPosts(); });
    searchRow.appendChild(searchInput);

    const searchBtn = document.createElement('button');
    searchBtn.className = 'btn btn-small';
    searchBtn.textContent = 'Search';
    searchBtn.onclick = () => _localrssSearchPosts();
    searchRow.appendChild(searchBtn);

    const status = document.createElement('p');
    status.id = 'localrss-search-status';
    status.className = 'list-tip';
    status.style.display = 'none';
    div.appendChild(status);
}

function _localrssStatsSection(div) {
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
        if (val === localrssFilter) opt.selected = true;
        showSelect.appendChild(opt);
    });
    showSelect.onchange = () => {
        localrssFilter = showSelect.value;
        localrssLoad().catch(localrssReportLoadError);
    };
    showRow.appendChild(showSelect);
    div.appendChild(showRow);

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

    div.appendChild(_localrssSectionHeading('Feeds'));

    const statsPill = document.createElement('p');
    statsPill.id = 'localrss-stats-pill';
    statsPill.className = 'list-tip';
    statsPill.textContent = 'Loading stats…';
    div.appendChild(statsPill);
}

function _localrssFeedsSection(div) {
    const newFeedRow = document.createElement('div');
    newFeedRow.className = 'localrss-options-row localrss-feed-box';
    div.appendChild(newFeedRow);

    const newFeedInput = document.createElement('input');
    newFeedInput.type = 'text';
    newFeedInput.id = 'localrss-new-feed-url';
    newFeedInput.placeholder = 'Add new feed';
    newFeedRow.appendChild(newFeedInput);

    const createBtn = document.createElement('button');
    createBtn.className = 'btn btn-small';
    createBtn.textContent = 'Create / Discover';
    createBtn.onclick = () => _localrssCreateFeed();
    newFeedRow.appendChild(createBtn);

    const hint = document.createElement('p');
    hint.className = 'list-tip';
    hint.textContent = 'If you paste a website URL, the reader will look for an RSS/Atom link in the page header.';
    div.appendChild(hint);

    const createStatus = document.createElement('p');
    createStatus.id = 'localrss-create-feed-status';
    createStatus.className = 'list-tip';
    createStatus.style.display = 'none';
    div.appendChild(createStatus);

    const feedSearchInput = document.createElement('input');
    feedSearchInput.type = 'text';
    feedSearchInput.id = 'localrss-feed-search-input';
    feedSearchInput.placeholder = 'Find / update feed';
    feedSearchInput.addEventListener('input', () => { _localrssSearchFeeds(); });
    div.appendChild(feedSearchInput);

    const feedResults = document.createElement('div');
    feedResults.id = 'localrss-feed-results';
    feedResults.className = 'account-list';
    div.appendChild(feedResults);

    div.appendChild(_localrssFeedEditor());
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
    div.className = 'localrss-feed-box';
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

function _localrssImportExportSection(div) {
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

async function _localrssSearchPosts() {
    const input = document.getElementById('localrss-search-input');
    const status = document.getElementById('localrss-search-status');
    const fc = window.CList.ui.view.feedContainer;
    const q = (input?.value || '').trim();
    if (!q || !fc) return;
    if (status) { status.style.display = ''; status.textContent = 'Searching…'; }
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
    if (status) { status.style.display = ''; status.textContent = 'Looking for a feed…'; }
    try {
        const data = await _localrssPost('/api/feed_create', { url });
        if (status) status.textContent = data.existing
            ? `Already in this database: ${data.feed.title || data.feed.url}`
            : `Added: ${data.feed.title || data.feed.url}`;
        input.value = '';
        _localrssInvalidateFeedCache();
        _localrssRefreshStats();
        if (localrssFilter === 'unread') localrssLoad().catch(localrssReportLoadError);
    } catch (e) {
        console.error('LocalRSS: feed create failed', e);
        if (status) status.textContent = 'Could not add feed: ' + e.message;
    }
}

// Fetches every feed in the current database once and caches it, so
// _localrssSearchFeeds() can filter in memory instead of hitting the server
// on every keystroke. Invalidated by anything that changes the feed list
// (create, delete, OPML import) or edits a feed's title.
async function _localrssFetchAllFeeds() {
    const cacheKey = `${localrssCurrentAccount.serviceUrl}|${localrssCurrentAccount.database}`;
    if (_localrssAllFeedsCache && _localrssAllFeedsCacheKey === cacheKey) return _localrssAllFeedsCache;
    const url = _localrssUrl(localrssCurrentAccount, '/api/feeds')
        + `?db=${encodeURIComponent(localrssCurrentAccount.database)}&limit=1000`;
    const resp = await fetch(url, { headers: _localrssAuthHeaders() });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || `HTTP ${resp.status}`);
    _localrssAllFeedsCache = data.feeds;
    _localrssAllFeedsCacheKey = cacheKey;
    return _localrssAllFeedsCache;
}

function _localrssInvalidateFeedCache() {
    _localrssAllFeedsCache = null;
    _localrssAllFeedsCacheKey = null;
}

async function _localrssSearchFeeds() {
    const input = document.getElementById('localrss-feed-search-input');
    const results = document.getElementById('localrss-feed-results');
    if (!input || !results) return;
    const q = input.value.trim().toLowerCase();
    try {
        const feeds = await _localrssFetchAllFeeds();
        const matches = q
            ? feeds.filter(f => (f.title || '').toLowerCase().includes(q) || (f.url || '').toLowerCase().includes(q))
            : feeds;
        results.innerHTML = '';
        for (const feed of matches.slice(0, 50)) {
            const btn = document.createElement('button');
            btn.className = 'account-button';
            const nameEl = document.createElement('span');
            nameEl.textContent = feed.title || feed.url;
            btn.appendChild(nameEl);
            btn.addEventListener('click', () => { results.innerHTML = ''; _localrssOpenFeedEditor(feed); });
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
        document.getElementById('localrss-edit-feed-url').focus();
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
        _localrssInvalidateFeedCache();
        _localrssRefreshStats();
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
    } catch (e) {
        console.error('LocalRSS: feed retry failed', e);
        if (status) status.textContent = 'Retry failed: ' + e.message;
    }
}

// Shared by the Feed Options panel's "Show posts" button and the "Feeds" list
// view's own per-feed "Show posts" action (see LOCALRSS_FEED's statusActions
// above) -- both just want that one feed's entries loaded into the read pane.
async function _localrssRenderFeedItems(feedId, titleText) {
    const fc = window.CList.ui.view.feedContainer;
    if (!feedId || !fc) return;
    try {
        const url = _localrssUrl(localrssCurrentAccount, '/api/items')
            + `?db=${encodeURIComponent(localrssCurrentAccount.database)}&feed_id=${feedId}`;
        const resp = await fetch(url, { headers: _localrssAuthHeaders() });
        const items = await resp.json();
        if (!resp.ok) throw new Error((items && items.error) || `HTTP ${resp.status}`);
        await window.CList.ui.renderFeed(items, fc, {
            normalize: normalizeLocalrssItem,
            title: titleText || 'Feed',
            append: false,
            onLoadMore: null,
        });
    } catch (e) {
        console.error('LocalRSS: could not load feed posts', e);
        showServiceError('feed-container', 'LocalRSS error', e.message);
    }
}

async function _localrssShowFeedPosts() {
    if (!_localrssOpenFeedId) return;
    const titleField = document.getElementById('localrss-edit-feed-title').value.trim();
    await _localrssRenderFeedItems(_localrssOpenFeedId, titleField);
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
                _localrssInvalidateFeedCache();
                _localrssRefreshStats();
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
                + `(${data.skipped} already present).`;
            _localrssConfirm(
                `Set up "${data.db}" as a new LocalRSS account so it's ready to read?`,
                'New database created',
                () => _localrssCreateAccountForDb(data.db, newDbName)
            );
        } else {
            if (status) status.textContent = `Imported ${data.imported} feed${data.imported !== 1 ? 's' : ''} (${data.skipped} already present).`;
            _localrssInvalidateFeedCache();
            _localrssRefreshStats();
            if (localrssFilter === 'unread') localrssLoad().catch(localrssReportLoadError);
        }
        fileInput.value = '';
    } catch (e) {
        console.error('LocalRSS: OPML import failed', e);
        if (status) status.textContent = 'Import failed: ' + e.message;
    }
}

// Called after a "newdb" OPML import, once the user confirms the "set up as
// account?" dialog. Creates a new LOCALRSS account pointed at the freshly
// created database, then refreshes everything that lists accounts so it's
// immediately selectable -- without navigating away from this panel.
async function _localrssCreateAccountForDb(dbSlug, displayName) {
    const status = document.getElementById('localrss-opml-import-status');
    const baseName = (displayName || dbSlug || 'LocalRSS').trim();
    const existingKeys = new Set((window.CList.accounts || []).map(acc => acc.key));
    let key = baseName;
    for (let n = 2; existingKeys.has(key); n++) key = `${baseName} (${n})`;

    const encKey = await getEncKey(window.CList.config.flaskSiteUrl);
    if (!encKey) { showErrorModal('Encryption key missing — please log in again.', { title: 'Encryption Key Missing' }); return; }

    const instanceData = {
        type: 'LOCALRSS',
        instance: key,
        title: baseName,
        permissions: 'r',
        serviceUrl: localrssCurrentAccount.serviceUrl,
        database: dbSlug,
    };

    let encryptedValue;
    try {
        encryptedValue = await encryptWithKey(encKey, JSON.stringify(instanceData));
    } catch (err) {
        console.error('Failed to encrypt LocalRSS account data:', err);
        showErrorModal('Could not save LocalRSS account — encryption failed. Try logging in again.', { title: 'Account Save Failed' });
        return;
    }

    try {
        await window.CList.storage.kv.put(key, encryptedValue);
    } catch (err) {
        if (err.code === 'NotAuthenticated') showErrorModal('Please log in to kvstore first.', { title: 'Not Logged In' });
        else showErrorModal('Failed to save the new LocalRSS account to kvstore.', { title: 'Account Save Failed' });
        return;
    }

    try {
        window.CList.accounts = await getAccounts(window.CList.config.flaskSiteUrl);
        if (window.CList.accounts) {
            updateUIVisibility();
            populatePostOptions(window.CList.accounts);
            populateReadAccountList(window.CList.accounts);
            const switcherRow = document.getElementById('localrss-db-switcher');
            if (switcherRow) switcherRow.replaceWith(_localrssDatabaseSwitcher());
        }
        if (status) status.textContent = `Account "${key}" created for database "${dbSlug}" — pick it from the Database dropdown above to read it.`;
        showStatusMessage(`LocalRSS account "${key}" created.`);
    } catch (error) {
        showErrorModal('Account saved — but the display could not refresh. Try reloading: ' + error.message, { title: 'Account Refresh Failed' });
    }
}

// Offered inside the "Add New Account" create-form when the selected type is
// LOCALRSS (see js/kvstore.js, buildFormFields) -- lets a brand-new account
// be seeded straight from an OPML file instead of "create empty account,
// then go import via Feed Options" afterwards. Uses the same newdb import
// endpoint as _localrssImportOpml above, but writes the resulting db slug
// back into the still-open create form rather than creating the account
// itself, since the form's own Save button is what actually persists it.
function _localrssBuildAccountOpmlSection() {
    const wrapper = document.createElement('div');
    wrapper.id = 'localrss-create-opml-section';

    const label = document.createElement('label');
    label.textContent = 'Seed with OPML (optional)';
    wrapper.appendChild(label);

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.id = 'localrss-create-opml-file';
    fileInput.accept = '.opml,.xml,text/xml';
    wrapper.appendChild(fileInput);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn-small';
    btn.textContent = 'Import OPML';
    wrapper.appendChild(btn);

    const status = document.createElement('div');
    status.id = 'localrss-create-opml-status';
    status.className = 'feed-status-message';
    wrapper.appendChild(status);

    btn.onclick = async () => {
        const file = fileInput.files?.[0];
        if (!file) { status.textContent = 'Choose an OPML file first.'; return; }

        const serviceUrlEl = document.getElementById('serviceUrlInput');
        const dbEl = document.getElementById('databaseInput');
        const serviceUrl = (serviceUrlEl?.value || '').trim();
        if (!serviceUrl) { status.textContent = 'Enter the LocalRSS Service URL above first.'; return; }

        const formData = new FormData();
        formData.append('opml', file);
        formData.append('mode', 'newdb');
        formData.append('new_db_name', (dbEl?.value || '').trim());

        status.textContent = 'Importing…';
        try {
            const url = _localrssUrl({ serviceUrl }, '/api/opml_import');
            const resp = await fetch(url, { method: 'POST', headers: _localrssAuthHeaders(), body: formData });
            const data = await resp.json();
            if (!resp.ok || data.ok === false) throw new Error(data.error || `HTTP ${resp.status}`);
            if (dbEl) dbEl.value = data.db;
            status.textContent = `Created database "${data.db}" with ${data.imported} feed${data.imported !== 1 ? 's' : ''} `
                + `(${data.skipped} already present). Click Save to finish creating the account.`;
            fileInput.value = '';
        } catch (e) {
            console.error('LocalRSS: account-creation OPML import failed', e);
            status.textContent = 'Import failed: ' + e.message;
        }
    };

    return wrapper;
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
