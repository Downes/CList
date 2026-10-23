//  public-feeds.js  -  public, no-login RSS collections served by localrss_reader
//  Part of CList, the next generation of learning and connecting with your community
//
//  Not to be confused with collections.js (personal, kvstore-backed saved items).
//  These are curated, server-side RSS collections (e.g. "News") that anyone can
//  read without an account — listed in the left pane for logged-out visitors.
//
//  Copyright Stephen Downes 2025, downes.ca
//  Licensed under Creative Commons Attribution 4.0 International https://creativecommons.org/licenses/by/4.0/
//
//  This software carries NO WARRANTY OF ANY KIND.
//  This software is provided "AS IS," and you, its user, assume all risks when using it.

(function () {
    window.CList.readers = window.CList.readers || {};
    window.CList.readers['PublicFeed'] = {
        name: 'PublicFeed', display: 'Feeds', icon: 'public',
        description: 'Read public, curated RSS collections',
        type: 'feed',
        initialize: async () => {},
        feedFunctions: {},
        onFeedClick: null,
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
            return a;
        }
    };
})();

const PUBLIC_FEEDS_BASE_URL = 'https://localrss.downes.ca';

function _publicFeedPlainText(html) {
    const d = document.createElement('div');
    d.innerHTML = html || '';
    return d.textContent || '';
}

// Fetches the list of available public collections and renders a clickable
// list into container (a DOM element). Idempotent — safe to call more than once.
async function renderPublicFeedsList(container) {
    if (!container) return;
    try {
        const res = await fetch(`${PUBLIC_FEEDS_BASE_URL}/api/collections`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const collections = await res.json();

        container.innerHTML = '';
        const wrap = document.createElement('div');
        wrap.id = 'public-feeds-list';
        container.appendChild(wrap);
        if (!Array.isArray(collections) || collections.length === 0) return;

        collections.forEach(c => {
            const btn = document.createElement('button');
            btn.className = 'account-button';
            const icon = document.createElement('span');
            icon.className = 'material-icons';
            icon.textContent = 'public';
            const label = document.createElement('span');
            label.textContent = c.title || c.slug;
            btn.appendChild(icon);
            btn.appendChild(label);
            btn.onclick = () => loadPublicFeed(c.slug, c.title || c.slug);
            wrap.appendChild(btn);
        });
    } catch (err) {
        console.error('Could not load public feed collections:', err);
    }
}

// Fetches items for one public collection and renders them into #feed-container
// using the standard makeListing() format.
async function loadPublicFeed(slug, title) {
    const fc = window.CList.ui.view.feedContainer;
    if (!fc) return;
    fc.innerHTML = '';
    fc.appendChild(createFeedHeader(title || slug));

    try {
        const res = await fetch(`${PUBLIC_FEEDS_BASE_URL}/api/collections/${encodeURIComponent(slug)}/items?limit=200`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const items = await res.json();

        if (!Array.isArray(items) || items.length === 0) {
            const p = document.createElement('p');
            p.className = 'feed-status-message';
            p.textContent = 'No items found.';
            fc.appendChild(p);
            return;
        }

        for (const it of items) {
            const contentHtml = it.content_html || '';
            fc.appendChild(makeListing({
                service:      'PublicFeed',
                url:          it.link,
                title:        it.title,
                desc:         _publicFeedPlainText(contentHtml),
                feed:         it.feed_title || '',
                titleHtml:    `<strong>${escapeHtml(it.title || '')}</strong>`,
                expandOnTitleClick: true,
                author:       it.author || it.feed_author || '',
                date:         it.published ? new Date(it.published * 1000).toLocaleDateString() : '',
                full_content: typeof window.sanitizeHtml === 'function'
                                  ? window.sanitizeHtml(contentHtml)
                                  : new SafeHtml(escapeHtml(_publicFeedPlainText(contentHtml))),
                link:         it.link,
                guid:         it.id != null ? String(it.id) : it.link,
            }));
        }
    } catch (err) {
        console.error('Could not load feed collection:', slug, err);
        showServiceError('feed-container', 'Could not load feed', err.message,
            'Try again later.');
    }

    window.checkAnnotationsBatch?.();
}

window.renderPublicFeedsList = renderPublicFeedsList;
window.loadPublicFeed = loadPublicFeed;
