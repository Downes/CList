

// Handler

(function () {
    const openalexHandler = {
        label: 'OpenAlex',
        icon: 'auto_stories',
        requiresLogin:   false,
        requiresAccount: false,
        statusActions: (item, itemID, itemLink) => {
            let actions = openInBrowserButton(itemLink, itemID);
            if (item._hasExpandableContent) {
                actions += `<button class="clist-action-btn" title="Expand" onClick="toggleEntryExpanded('${itemID}');"><span class="material-icons md-18 md-light">zoom_out_map</span></button>`;
            }
            return actions;
        },
        search: async () => {
            const searchString = finderString();
            if (!searchString) return;
            await openalexSearch(searchString);
        }
    };
    // Ensure readerHandlers exists
    if (typeof window.CList.readers === 'undefined') {
        window.CList.readers = {}; // Create it if it doesn't exist
    }

    // Add the handler
    window.CList.readers['openalex'] = openalexHandler;
})();



// Functions

const OPENALEX_PER_PAGE = 25;

async function openalexSearch(query, page = 1) {
    const feedContainer = window.CList.ui.view.feedContainer;

    const url = new URL('https://api.openalex.org/works');
    url.searchParams.set('search', query);
    url.searchParams.set('per_page', OPENALEX_PER_PAGE);
    url.searchParams.set('page', page);

    let data;
    try {
        const response = await fetch(url);
        data = await response.json();
        // OpenAlex returns its own JSON error body (e.g. rate-limit exceeded)
        // even on a non-200 — surface its message rather than a bare status code.
        if (!response.ok || data.error) {
            throw new Error(data.message || data.error || `HTTP error! Status: ${response.status}`);
        }
    } catch (error) {
        console.error('OpenAlex search failed:', error);
        showServiceError(feedContainer, 'OpenAlex search error', error.message,
            'Could not reach OpenAlex. Try again in a moment.');
        return;
    }

    if (!data.results || !data.results.length) {
        feedContainer.innerHTML = '';
        feedContainer.appendChild(createFeedHeader('OpenAlex: ' + query));
        feedContainer.insertAdjacentHTML('beforeend', '<p class="feed-status-message">No results found.</p>');
        return;
    }

    const hasMore = (page * OPENALEX_PER_PAGE) < (data.meta?.count || 0);

    await window.CList.ui.renderFeed(data.results, feedContainer, {
        normalize:     normalizeOpenAlexWork,
        title:         page === 1 ? 'OpenAlex: ' + query : null,
        append:        page !== 1,
        onLoadMore:    hasMore ? () => openalexSearch(query, page + 1) : null,
        loadMoreBtnId: 'openalex-load-more',
    });
}

// Maps an OpenAlex "Work" object to the shape makeListing() expects.
// desc holds the always-visible metadata line (authors/year/source/citations);
// full_content holds the abstract (when present), reconstructed from OpenAlex's
// non-standard inverted-index representation — see openalexAbstractText below.
async function normalizeOpenAlexWork(raw) {
    const authorsLine = openalexAuthorsLine(raw);
    const source      = raw.primary_location?.source?.display_name || raw.host_venue?.display_name || 'OpenAlex';
    const year         = raw.publication_year || '';
    const oaStr         = raw.open_access?.is_oa ? ' · Open access' : '';
    const abstract     = openalexAbstractText(raw);

    const descParts = [];
    if (authorsLine) descParts.push(authorsLine);
    if (year) descParts.push(String(year));
    descParts.push(source);
    descParts.push(`Cited by ${raw.cited_by_count || 0}${oaStr}`);

    return {
        service:      'openalex',
        url:          raw.primary_location?.landing_page_url || raw.doi || raw.id,
        title:        raw.display_name || raw.title || '(untitled)',
        desc:         descParts.join(' · '),
        full_content: abstract ? new SafeHtml(escapeHtml(abstract)) : null,
        feed:         source,
        author:       authorsLine || null,
        date:         raw.publication_date || (year ? `${year}-01-01` : new Date().toISOString()),
        guid:         raw.id,
    };
}

// First three author display names, "et al." if there are more. No onAuthorClick
// is registered, so this is folded into desc rather than the (unused) author field.
function openalexAuthorsLine(raw) {
    const names = (raw.authorships || []).map(a => a.author?.display_name).filter(Boolean);
    if (!names.length) return '';
    return names.length > 3 ? `${names.slice(0, 3).join(', ')}, et al.` : names.join(', ');
}

// OpenAlex has no plaintext abstract field — it ships an inverted index
// ({ word: [positions...] }) to dodge publisher copyright restrictions on
// redistributing full abstract text. Rebuild the plain text from it.
function openalexAbstractText(raw) {
    const idx = raw.abstract_inverted_index;
    if (!idx) return '';
    const words = [];
    for (const [word, positions] of Object.entries(idx)) {
        for (const pos of positions) words[pos] = word;
    }
    return words.join(' ');
}
