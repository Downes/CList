/// <reference path="./reader-types.js" />
// Copyright Stephen Downes 2026. CC BY 4.0; provided AS IS, without warranty.
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
async function normalizeLocalrssFeed(raw, account) {
    return {
        service: 'LOCALRSS_FEED',
        url:      raw.url,
        title:    raw.title || raw.url,
        titleHtml: `<strong>${escapeHtml(raw.title || raw.url)}</strong>`,
        desc:     _localrssPlainText(raw.description || ''),
        feed:     account?.title || account?.database || '',
        feedUrl:  null,
        author:   raw.author || '',
        date:     '',
        link:     raw.url,
        guid:     `localrss-feed:${raw.id}`,
        feedId:   raw.id,
    };
}


window.CList.ui.localrssReader = {
    busy(value) {
        if (value) showLoader();
        else if (window.CList.ui.view.loadingIndicator) window.CList.ui.view.loadingIndicator.style.display = 'none';
    },
    begin(kind, append) {
        this.busy(true);
        if (kind === 'items' && !append) {
            audioFiles.length = 0;
            const list = document.getElementById('audio-list'); if (list) list.innerHTML = '';
        }
    },
    async render(page, context, request, append, onLoadMore) {
        const title = request.account.title || 'LocalRSS';
        if (!append && !page.items.length) {
            context.commit(() => {
                const container = window.CList.ui.view.feedContainer; container.innerHTML = '';
                container.appendChild(createFeedHeader(request.kind === 'feeds' ? title + ' - Feeds' : title));
                const message = document.createElement('p'); message.className = 'feed-status-message';
                message.textContent = request.kind === 'feeds' ? 'No feeds in this database.'
                    : request.filter === 'bookmarked' ? 'No bookmarked items.'
                    : request.filter === 'unread' ? 'All caught up - no unread items.' : 'No items found.';
                container.appendChild(message);
            });
            return;
        }
        await context.render(page.items, {
            normalize: request.kind === 'feeds' ? raw => normalizeLocalrssFeed(raw, request.account) : normalizeLocalrssItem,
            title: request.kind === 'feeds' ? title + ' - Feeds' : title, append, onLoadMore,
        });
        if (request.kind === 'items') context.commit(() => {
            const list = document.getElementById('audio-list'); if (list) list.innerHTML = generatePlaylistHTML();
        });
    },
    retry(onLoadMore) { window.CList.ui.renderLoadMoreButton(window.CList.ui.view.feedContainer, onLoadMore); },
    connection(account) {
        const status = document.getElementById('localrss-connection-status');
        if (status) status.textContent = _localrssConnectionStatusText(account);
    },
    metadataError(error) { console.error('LocalRSS metadata update failed:', error); showStatusMessage('LocalRSS loaded, but its account icon could not be updated: ' + error.message); },
};
