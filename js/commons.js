

// Handler

(function () {
    const commonsHandler = {
        label: 'Wikimedia Commons',
        icon: 'image',
        requiresLogin:   false,
        requiresAccount: false,
        statusActions: (item, itemID, itemLink) => {
            const expandBtn = item._hasExpandableContent
                ? `<button class="clist-action-btn" title="Expand" onClick="toggleEntryExpanded('${itemID}');"><span class="material-icons md-18 md-light">zoom_out_map</span></button>`
                : '';
            return `
            ${expandBtn}
            ${openInBrowserButton(itemLink, itemID)}`;
        },
        search: async () => {
            const q = finderString();
            if (!q) return;
            await commonsSearch(q);
        }
    };

    // Ensure readerHandlers exists
    if (typeof window.CList.readers === 'undefined') {
        window.CList.readers = {}; // Create it if it doesn't exist
    }

    // Add the handler
    window.CList.readers['commons'] = commonsHandler;
})();




// Functions

const COMMONS_PAGE_SIZE = 20;

// Openly licensed media search via the Wikimedia Commons API — free, no
// account/key, CORS-open (origin=* param), backed by WMF's own infrastructure
// rather than a small aggregator, so no proxyp relay needed. Only File: pages
// are searched (gsrnamespace=6), and everything in Commons' main namespace is
// already under a free license by site policy, so there's no license
// filtering to do (unlike Openverse's cross-source aggregation).
async function commonsSearch(q, offset = 0) {
    const feedContainer = window.CList.ui.view.feedContainer;
    const params = new URLSearchParams({
        action: 'query',
        generator: 'search',
        gsrsearch: q,
        gsrnamespace: '6',
        gsrlimit: String(COMMONS_PAGE_SIZE),
        prop: 'imageinfo',
        iiprop: 'url|extmetadata',
        iiurlwidth: '400',
        format: 'json',
        origin: '*',
    });
    if (offset) params.set('gsroffset', String(offset));

    let data;
    try {
        const response = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`);

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        data = await response.json();

        if (data.error) throw new Error(data.error.info || data.error.code);

    } catch (error) {
        console.error("Error accessing the URL:", error.message);
        showServiceError(feedContainer, 'Search failed', 'Could not reach Wikimedia Commons. Try again in a moment.');
        return;
    }

    const pages = data.query && data.query.pages ? Object.values(data.query.pages) : [];
    // generator=search can surface a File: page with no imageinfo (e.g. one
    // that's since been deleted but still in the search index) — skip those.
    const results = pages.filter(p => Array.isArray(p.imageinfo) && p.imageinfo.length > 0);

    if (results.length === 0) {
        feedContainer.innerHTML = '';
        feedContainer.appendChild(createFeedHeader(`Wikimedia Commons: "${q}"`));
        const statusBox = document.createElement('div');
        statusBox.classList.add('status-box');
        statusBox.textContent = 'No results found.';
        feedContainer.appendChild(statusBox);
        return;
    }

    const nextOffset = data.continue ? data.continue.gsroffset : null;

    await window.CList.ui.renderFeed(results, feedContainer, {
        normalize: normalizeCommonsPage,
        title: offset === 0 ? `Wikimedia Commons: "${q}"` : null,
        append: offset > 0,
        onLoadMore: nextOffset ? () => commonsSearch(q, nextOffset) : null,
        loadMoreBtnId: 'commons-load-more',
    });
}

// Strips HTML out of a Commons extmetadata field — Artist/Credit/Attribution
// routinely embed <a> links to user pages — since makeListing's desc is
// rendered as plain text; raw markup here would otherwise show up literally
// instead of being parsed.
function _commonsPlainText(html) {
    if (!html) return '';
    return new DOMParser().parseFromString(html, 'text/html').body.textContent.trim();
}

// Maps a Commons API page object (generator=search + imageinfo) to
// makeListing()'s expected shape. `url` points at the File: description page
// (not the raw image file) so "Open in browser" and the citation reference
// link back to the page carrying the license/attribution, per Commons' reuse
// terms.
async function normalizeCommonsPage(page) {
    const info = page.imageinfo[0];
    const meta = info.extmetadata || {};
    const title = _commonsPlainText(
        (meta.ObjectName && meta.ObjectName.value) || page.title.replace(/^File:/, '')
    );
    const artist = _commonsPlainText(meta.Artist && meta.Artist.value);
    const license = (meta.LicenseShortName && meta.LicenseShortName.value) || '';
    const desc = [artist, license].filter(Boolean).join(' · ') || 'Wikimedia Commons';

    return {
        service: 'commons',
        url: info.descriptionurl || info.url,
        title: title || '(untitled)',
        desc,
        feed: 'Wikimedia Commons',
        author: artist || null,
        date: (meta.DateTimeOriginal && meta.DateTimeOriginal.value) || (meta.DateTime && meta.DateTime.value) || null,
        guid: String(page.pageid),
        images: [{ url: info.url, preview_url: info.thumburl || info.url, description: title }],
    };
}
