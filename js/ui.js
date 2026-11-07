//  ui.js  —  CList.ui factory functions
//  Part of CList, the next generation of learning and connecting with your community
//
//  Each function takes data and returns a DOM element (no side effects), unless
//  noted otherwise. Bare-name globals are aliased immediately after the
//  CList.ui.* function they point to, for backward compatibility with existing
//  call sites.
//
//  Copyright Stephen Downes 2025
//  Licensed under Creative Commons Attribution 4.0 International https://creativecommons.org/licenses/by/4.0/
//
//  This software carries NO WARRANTY OF ANY KIND.
//  This software is provided "AS IS," and you, its user, assume all risks when using it.
//
//  Contents, in order:
//    1. Namespace setup
//    2. Structural DOM refs (window.CList.ui.view)
//    3. Drag-and-drop reference attribution
//    4. Account & selection widgets
//    5. Feed item rendering
//    6. User feedback: status messages, errors, dialogs
//    7. Misc DOM utilities
//    8. Capability gating
//
//  Ordering note: window.CList.ui must be created (section 1) before any
//  window.CList.ui.X assignment runs, since those assignments set properties
//  on it at parse time. Everything else below — function declarations and
//  event-listener registrations alike — only runs later, after the whole
//  script has loaded, so section order otherwise doesn't affect behavior.

// ============================================================================
// 1. Namespace setup
// ============================================================================

window.CList = window.CList || {};
window.CList.ui = {};

// ============================================================================
// 2. Structural DOM refs (window.CList.ui.view)
// ============================================================================
// Single source of truth for structural DOM element references.
// Use window.CList.ui.view.* instead of repeated getElementById calls.

// Initialized at script load time (ui.js is deferred, so the DOM is fully
// parsed by the time this runs — all static index.html elements exist).
// Dynamic elements (read-account-list, account-status, write-column) are
// created at runtime and must be looked up with getElementById when used.
window.CList.ui.view = {
    // App shell
    mainWindow:       document.getElementById('main-window'),
    leftPane:         document.getElementById('left-pane'),
    rightPane:        document.getElementById('right-pane'),
    readPane:         document.getElementById('read-pane'),
    writePaneEl:      document.getElementById('write-pane'),
    identityDiv:      document.getElementById('identityDiv'),
    loadingIndicator: document.getElementById('loading-indicator'),

    // Read pane
    feedMenu:         document.getElementById('feed-menu'),
    feedContainer:    document.getElementById('feed-container'),

    // Write pane
    writePaneContent: document.getElementById('write-pane-content'),
    writeTitle:       document.getElementById('write-title'),
    textColumn:       document.getElementById('text-column'),
    writeTags:        document.getElementById('write-tags'),
    referencesButton: document.getElementById('references-button'),

    // Right pane
    postResult:       document.getElementById('post-result'),
    loadOptions:      document.getElementById('load-options'),
};

// ============================================================================
// 3. Drag-and-drop reference attribution
// ============================================================================
// Dragging a link out of the read pane (or out of a popup opened via
// openInBrowser) into the write pane should attribute the resulting reference
// to whatever was dragged. This section tracks "windows opened from CList" and
// resolves a drop/paste back to the right reference.

// External-window registry for drag-and-drop reference attribution
window.CList._openedWindowRefs    = {};
window.CList._lastOpenedWindowRef = null;

// Tracks which feed entry a drag started from, for the case where text is dragged
// straight out of an entry (no "open in browser" window involved) — the only
// drop case that previously had no mechanism at all to identify its source entry.
window.CList._lastDragStartRef = null;
document.addEventListener('dragstart', function(e) {
    const specific = e.target.closest ? e.target.closest('.statusSpecific') : null;
    window.CList._lastDragStartRef = specific?.reference || null;
}, true);

function _makeMinimalRef(url, title) {
    let host = '';
    try { host = new URL(url).hostname; } catch (_) {}
    return { url, title: title || url, author_name: '', feed: host,
        created_at: new Date().toISOString(), id: url };
}

window.openInBrowser = function(url, itemId) {
    window.open(url, '_blank', 'width=800,height=600,scrollbars=yes');
    let ref = itemId ? document.getElementById(itemId)?.reference : null;
    if (!ref) ref = _makeMinimalRef(url);
    window.CList._openedWindowRefs[url] = ref;
    window.CList._lastOpenedWindowRef   = ref;
};

// Open a bare URL found inside a feed item's description (see linkifyBareUrls,
// below in section 5). Unlike openInBrowser — where the opened URL *is* the
// entry's own URL, so the entry's reference fits as-is — this opens a URL
// that's different from the entry it was found in, so the resulting reference
// needs its own identity (url/title) plus `via` attribution back to that entry.
// _attributeDroppedContent reads `ref.via` to append a "(source, via)"
// citation when this reference is later dragged into the editor.
window.openDescriptionLink = function(url, entryUrl, entryFeedTitle) {
    window.open(url, '_blank', 'width=800,height=600,scrollbars=yes');
    let ref = window.CList._openedWindowRefs[url] || _makeMinimalRef(url);
    ref.via = { url: entryUrl, title: entryFeedTitle || '(no feed specified)' };
    window.CList._openedWindowRefs[url] = ref;
    window.CList._lastOpenedWindowRef   = ref;
};

// Standard "Open in browser" action button, shared by every reader's statusActions
// renderer. _heJs is defined in reader.js, which loads after this file — safe here
// since the button's HTML string isn't built until a feed actually renders, well
// after all deferred scripts have run.
window.openInBrowserButton = function(url, itemId) {
    return `<button class="clist-action-btn" title="Open in browser" onclick="openInBrowser('${_heJs(url)}', '${_heJs(itemId)}')"><span class="material-icons md-18 md-light">launch</span></button>`;
};

window._extractDropUrl = function(uriList, html) {
    if (uriList) {
        const first = uriList.split('\n').map(l => l.trim()).find(l => l && !l.startsWith('#'));
        if (first) return first;
    }
    if (html) {
        const m = html.match(/href=["']([^"'#][^"']*?)["']/i);
        if (m) return m[1];
    }
    return null;
};

// Resolves a drop back to a reference (url from text/uri-list or text/html
// href; title from text/x-clist-title, injected by the CList extension; falling
// back to the entry a plain drag started from, or the last-opened window) and
// dispatches it to the active editor's insertLink/insertLinkVia. Guards against
// a pre-existing double-dispatch: the document-level capture `drop` listener
// below and each editor's own `drop` listener (editors.js/collab.js/latex.js)
// both fire on the same drop for texteditor/collab/latex (TinyMCE's iframe has
// its own document and is unaffected) — whichever runs first calls
// e.preventDefault(), so the second invocation bails out here.
window._attributeDroppedContent = function(e) {
    if (e.defaultPrevented) return;
    const dt = e.dataTransfer;
    if (!dt) return;
    const url   = window._extractDropUrl(dt.getData('text/uri-list'), dt.getData('text/html'));
    const title = dt.getData('text/x-clist-title') || null;

    let ref = url ? window.CList._openedWindowRefs[url] : null;
    if (!ref && url) ref = _makeMinimalRef(url, title);
    if (!ref) ref = window.CList._lastDragStartRef;     // plain drag straight out of an entry
    if (!ref) ref = window.CList._lastOpenedWindowRef;   // legacy fallback
    window.CList._lastDragStartRef = null;
    if (!ref) return;

    _dispatchDroppedRef(e, dt, ref);
};

// Dispatches a resolved drop reference to the active editor's insertLink (ref has
// no `via` — dragged from the entry itself, or a window opened via openInBrowser)
// or insertLinkVia (ref carries `via` — dragged from a window opened via
// openDescriptionLink, i.e. a link found inside the entry, distinct from the
// entry's own URL). `dropped` is read from this drag gesture's own DataTransfer,
// so it's always whatever was actually selected in whichever window the drag
// started in — the opened window, or the feed entry itself.
function _dispatchDroppedRef(e, dt, ref) {
    const handler = editorHandlers[currentEditor];
    if (!handler) return;

    const isHtml = (handler.contentTypes || []).includes('text/html');
    const droppedHtml  = dt.getData('text/html');
    const droppedPlain = dt.getData('text/plain');
    const dropped = isHtml ? (droppedHtml || escapeHtml(droppedPlain || '')) : (droppedPlain || removeHtml(droppedHtml || ''));
    if (!dropped) return; // nothing was actually dragged in — let the native drop stand

    const content = { type: isHtml ? 'text/html' : 'text/plain', value: dropped };

    if (ref.via) {
        if (typeof handler.insertLinkVia !== 'function') return;
        e.preventDefault();
        handler.insertLinkVia({
            content,
            linkedUrl: ref.url,
            linkedTitle: (ref.title && ref.title !== ref.url) ? ref.title : ref.url,
            entryUrl: ref.via.url,
            authorOrFeedTitle: ref.via.title,
            reference: { ...ref },
        });
    } else {
        if (typeof handler.insertLink !== 'function') return;
        e.preventDefault();
        handler.insertLink({
            content,
            entryUrl: ref.url,
            feedTitle: (ref.feed && ref.feed !== '(no feed specified)') ? ref.feed : (ref.service || 'Unknown'),
            reference: { ...ref },
        });
    }
}

// Receive page-identity messages posted by the CList browser extension's content
// script running in popup windows (window.opener.postMessage). When the extension
// is installed, this fires as soon as the popup loads — so the reference is ready
// before the user even starts dragging.
// Global capture drop handler — fires before the browser's native textarea insertion,
// so it works even when Firefox swallows the event in the target phase.
// Scoped to the write pane so drags within the read pane are not mis-attributed.
document.addEventListener('drop', function(e) {
    const writePaneContent = document.getElementById('write-pane-content');
    if (!writePaneContent || !writePaneContent.contains(e.target)) return;
    window._attributeDroppedContent(e);
}, true);

window.addEventListener('message', function(e) {
    if (!e.data || e.data.type !== 'clist-drag-source') return;
    const url   = e.data.url;
    const title = e.data.title || '';

    if (!url || !/^https?:\/\//.test(url)) return;
    // Enrich any existing ref with the actual page title; create a minimal ref otherwise.
    let ref = window.CList._openedWindowRefs[url];
    if (ref) {
        if (title && ref.title === ref.url) ref.title = title;  // fill in placeholder title
    } else {
        ref = _makeMinimalRef(url, title);
    }
    window.CList._openedWindowRefs[url] = ref;
    window.CList._lastOpenedWindowRef   = ref;
});

// ============================================================================
// 4. Account & selection widgets
// ============================================================================

// ── accountList ──────────────────────────────────────────────────────────────
// Returns a div of account-select buttons filtered and styled per type.
// tip       — instruction string shown above the buttons
// accounts  — the global accounts array
// filterFn  — function(parsedValue) → bool; return true to include
// onClickFn — function(key, parsedValue, btn) called on button click

window.CList.ui.accountList = function(tip, accounts, filterFn, onClickFn) {
    const container = document.createElement('div');
    container.className = 'account-list';

    const tipDiv = document.createElement('div');
    tipDiv.className = 'list-tip';
    tipDiv.textContent = tip;
    container.appendChild(tipDiv);

    accounts.forEach(account => {
        const parsedValue = parseAccountValue(account);
        if (!parsedValue || !filterFn(parsedValue)) return;

        const btn = document.createElement('button');
        btn.className = 'account-button';
        btn.setAttribute('data-key', account.key);
        btn.dataset.accountType = parsedValue.type || '';
        btn.onclick = () => onClickFn(account.key, parsedValue, btn);

        const name = document.createElement('span');
        name.textContent = parsedValue.title;

        btn.appendChild(accountIcon(parsedValue.type, parsedValue));
        btn.appendChild(name);
        container.appendChild(btn);
    });

    return container;
};
window.makeAccountList = window.CList.ui.accountList;

// ── editorButton ──────────────────────────────────────────────────────────────
// Returns a button for the editor-switcher panel.

window.CList.ui.editorButton = function(label, icon, onClick) {
    const btn = document.createElement('button');
    btn.className = 'account-button';
    const iconEl = document.createElement('span');
    iconEl.className = 'material-icons';
    iconEl.textContent = icon || 'edit';
    const nameEl = document.createElement('span');
    nameEl.textContent = label;
    btn.appendChild(iconEl);
    btn.appendChild(nameEl);
    btn.addEventListener('click', async () => onClick());
    return btn;
};
window.makeEditorButton = window.CList.ui.editorButton;

// ── buildVisibilitySelect / buildAccountSelect ───────────────────────────────
// Shared <select> builders for the annotation-send UI (annotate.js, annotate-editor.js).
// Callers set their own style.cssText afterward — these only populate options.

window.CList.ui.buildVisibilitySelect = function() {
    const select = document.createElement('select');
    [['public', 'Public'], ['private', 'Private']].forEach(([val, text]) => {
        const opt = document.createElement('option');
        opt.value = val;
        opt.textContent = text;
        select.appendChild(opt);
    });
    return select;
};
window.buildVisibilitySelect = window.CList.ui.buildVisibilitySelect;

window.CList.ui.buildAccountSelect = function(accounts) {
    const select = document.createElement('select');
    accounts.forEach((acct, i) => {
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = acct.title || acct.instance;
        select.appendChild(opt);
    });
    return select;
};
window.buildAccountSelect = window.CList.ui.buildAccountSelect;

// ============================================================================
// 5. Feed item rendering
// ============================================================================

// Shared bare-URL scanner behind both linkifyBareUrls (DOM) and linkifyBareUrlsHtml
// (string) below — walks `text`, calling appendText(str) for plain runs and
// appendLink(url, trailingPunctuation) for each URL found, in order.
function _scanBareUrls(text, appendText, appendLink) {
    const urlRe = /https?:\/\/[^\s<>"']+/g;
    let lastIndex = 0, m;
    while ((m = urlRe.exec(text))) {
        let url = m[0];
        const trailMatch = url.match(/[.,;:!?)\]]+$/);
        const trail = trailMatch ? trailMatch[0] : '';
        if (trail) url = url.slice(0, -trail.length);
        appendText(text.slice(lastIndex, m.index));
        appendLink(url, trail);
        lastIndex = urlRe.lastIndex;
    }
    appendText(text.slice(lastIndex));
}

// Convert bare http(s) URLs in plain text into "[Link]" anchors — the real URL
// shows on hover via `title`, and clicking calls onClick(url) instead of
// navigating away, so callers can route it through the "open in browser"
// convention (see openDescriptionLink). Feed descriptions are plain text
// across every service (search, harvest, social), so this is the one place
// bare-URL handling needs to live for it to apply everywhere.
window.linkifyBareUrls = function(text, onClick) {
    const frag = document.createDocumentFragment();
    _scanBareUrls(text,
        str => frag.appendChild(document.createTextNode(str)),
        (url, trail) => {
            frag.appendChild(document.createTextNode('['));
            const a = document.createElement('a');
            a.href = '#';
            a.title = url;
            a.textContent = 'Link';
            a.addEventListener('click', (e) => { e.preventDefault(); onClick(url); });
            frag.appendChild(a);
            frag.appendChild(document.createTextNode(']' + trail));
        });
    return frag;
};

// String variant of linkifyBareUrls for callers that assemble raw HTML before
// the element exists in the DOM — e.g. a reader's titleHtml (mastodon.js,
// bluesky.js build "Author wrote: <post text>" as a template-literal string,
// not through makeListing's DOM-built summaryDiv). Inline onclick, since
// addEventListener has nothing to attach to yet; routes through the same
// openDescriptionLink convention as the DOM version.
window.linkifyBareUrlsHtml = function(text, entryUrl, entryFeedTitle) {
    let html = '';
    _scanBareUrls(text,
        str => { html += _he(str); },
        (url, trail) => {
            html += `[<a href="#" title="${_he(url)}" onclick="openDescriptionLink('${_heJs(url)}', '${_heJs(entryUrl)}', '${_heJs(entryFeedTitle)}'); return false;">Link</a>]${_he(trail)}`;
        });
    return html;
};

// Standard "<author-link> (@handle) <verb>: <body>" title line shared by every
// social-style reader (Mastodon, Bluesky, ...). authorLinkHtml stays caller-built
// since its onclick (loadMastodonFeed, fetchBlueskyUserFeed, ...) is service-specific;
// everything after it is identical across services and always routed through
// linkifyBareUrlsHtml here, so a bare URL in the body can't slip through unlinkified
// the way it did before this helper existed (each service used to build this whole
// string by hand and had to remember to call linkifyBareUrlsHtml itself).
window.CList.ui.socialPostLine = function(authorLinkHtml, handle, verb, text, entryUrl, entryFeedTitle) {
    return `${authorLinkHtml} (@${_he(handle)}) ${_he(verb)}: ${linkifyBareUrlsHtml(text, entryUrl, entryFeedTitle)}`;
};
window.buildSocialPostLine = window.CList.ui.socialPostLine;

// ── video embeds ──────────────────────────────────────────────────────────────
// Service-specific detection lives in youtube.js / peertube.js, each registering
// under window.CList.video.<name>; this just asks each in turn so makeListing
// stays generic across whatever video services get added later.
function getVideoEmbedUrl(link) {
    const providers = window.CList.video || {};
    for (const key in providers) {
        const embedUrl = providers[key]?.getEmbedUrl?.(link);
        if (embedUrl) return embedUrl;
    }
    return null;
}

// ── listing ───────────────────────────────────────────────────────────────────
// Returns a status-box div for a single feed item.
// full_content must be a SafeHtml instance (or absent).

window.CList.ui.listing = function makeListing(
    itemOrService,
    url,
    title,
    desc,
    feed,
    author,
    date,
    full_content
) {
    let item;

    // If the first parameter is an object, treat it as the complete 'item'
    if (
        typeof itemOrService === 'object' &&
        itemOrService !== null &&
        !Array.isArray(itemOrService)
    ) {
        item = itemOrService;
    }
    // Otherwise, assume the user passed individual arguments
    else {
        item = {
            service: itemOrService || null,
            url: url || null,
            title: title || null,
            desc: desc || null,
            feed: feed || null,
            author: author || null,
            date: date || null,
            full_content: full_content || null
        };
    }

    // Extract parameters from item
    let {
        service: service = null,
        url: itemUrl = null,
        title: itemTitle = null,
        desc: itemDesc = "",
        feed: itemFeed = null,
        feedUrl: itemFeedUrl = null,
        author: itemAuthor = null,
        date: itemDate = null,
        full_content: itemFull_content = ""
    } = item || {};

    // Validate full_content: must be a SafeHtml instance (or absent).
    // Callers are responsible for sanitizing HTML before passing it here.
    let safeContentHtml = '';
    if (itemFull_content instanceof SafeHtml) {
        safeContentHtml = itemFull_content.toString();
    } else if (itemFull_content && itemFull_content !== '') {
        throw new Error('makeListing: full_content must be a SafeHtml instance. Sanitize it before passing.');
    }

    // Create item ID
    if (!itemUrl) throw new Error('makeListing: item.url is required to generate an element ID');
    const itemID = createUniqueIdFromUrl(itemUrl);

    // Prepare the summary: truncate if too long; promote plain-text desc to content if longer.
    if (itemDesc && itemDesc.length > summaryLimit) {
        if (itemDesc.length > safeContentHtml.length) {
            safeContentHtml = _he(itemDesc); // promoted plain text — escape for HTML context
        }
        itemDesc = truncateContent(itemDesc);
    }

    // Build summary div with DOM methods — handlers registered per-service, no inline JS strings
    const summaryDiv = document.createElement('div');
    summaryDiv.id = `${itemID}-summary`;
    summaryDiv.classList.add('entry-summary');
    summaryDiv.style.display = 'block';

    const feedHandler = window.CList.readers[service]?.onFeedClick;
    const feedEl = document.createElement(feedHandler ? 'a' : 'span');
    if (feedHandler) {
        feedEl.href = '#';
        feedEl.title = 'Show only items from this feed';
        feedEl.onclick = (e) => { e.preventDefault(); feedHandler(item); };
    }
    feedEl.textContent = itemFeed || 'Unknown Source';
    summaryDiv.appendChild(feedEl);

    if (!item.noSummaryDesc) {
        const authorHandler = window.CList.readers[service]?.onAuthorClick;
        if (itemAuthor && authorHandler) {
            summaryDiv.appendChild(document.createTextNode(' · '));
            const authorEl = document.createElement('a');
            authorEl.href = '#';
            authorEl.title = 'Show items by this author';
            authorEl.onclick = (e) => { e.preventDefault(); authorHandler(item); };
            authorEl.textContent = itemAuthor;
            summaryDiv.appendChild(authorEl);
        }
        summaryDiv.appendChild(document.createTextNode(': '));
        if (itemDesc) {
            summaryDiv.appendChild(linkifyBareUrls(itemDesc, url => openDescriptionLink(url, itemUrl, itemFeed)));
        } else {
            summaryDiv.appendChild(document.createTextNode('No Summary'));
        }
    }

    // Build content div (if applicable)
    const videoEmbedUrl = getVideoEmbedUrl(itemUrl);
    let contentDiv = null;
    if ((safeContentHtml && safeContentHtml.length > (itemDesc || '').length) || videoEmbedUrl) {
        contentDiv = document.createElement('div');
        contentDiv.id = `${itemID}-content`;
        contentDiv.classList.add('entry-full-content');
        contentDiv.style.display = 'none';
        const videoEmbedHtml = videoEmbedUrl
            ? `<div class="video-embed-wrapper"><iframe src="${_he(videoEmbedUrl)}" loading="lazy" allowfullscreen></iframe></div>`
            : '';
        // Universal rule: whenever the expanded view's title is shown, clicking it opens
        // the item's URL in a browser window -- same action as the "Open in browser"
        // status-action button, same itemID passed through for reference attribution.
        const titleLinkSafe = /^https?:\/\//i.test(itemUrl) ? itemUrl.replace(/'/g, '%27') : null;
        const postTitleHtml = titleLinkSafe
            ? `<h2 class='post-title post-title-link' title="Open in browser" onclick="openInBrowser('${titleLinkSafe}', '${itemID}');">${_he(itemTitle)}</h2>`
            : `<h2 class='post-title'>${_he(itemTitle)}</h2>`;
        contentDiv.innerHTML = `
            <div class='status-actions'>
            <button class="clist-action-btn" title="Collapse" onclick="toggleEntryExpanded('${itemID}');"><span class="material-icons md-18 md-light">zoom_in_map</span></button>
            </div>
            <div class='post'>
                ${postTitleHtml}
                <p><em>${_he(itemAuthor || 'Unknown Author')}, ${_he(itemFeed || 'Unknown Source')}, ${_he(itemDate || 'Date unknown')}</em></p>
                ${videoEmbedHtml}
                <div class='post-full-content'>${safeContentHtml}</div>
            </div>`;
    }

    // Create the Status Box div
    const statusBox = document.createElement('div');
    statusBox.classList.add('status-box');

    // Create the Status Content div
    const statusContent = document.createElement('div');
    statusContent.classList.add('status-content');

    // Create the Status Specific div
    const statusSpecific = document.createElement('div');
    statusSpecific.classList.add('statusSpecific');
    statusSpecific.id = itemID;

    // Assemble statusSpecific: title, then DOM-built summary, then content
    const titleHtmlStr = item.titleHtml || `<a onclick="${service}Search('${_heJs(itemTitle || '')}');">${_he(itemTitle)}</a>`;
    // Services that render plain (non-interactive) titleHtml can opt into
    // click-to-expand by setting item.expandOnTitleClick — left out for
    // services whose titleHtml already has its own click behavior (search,
    // open link, view user feed, etc.) so this doesn't collide with it.
    const titleWrapperHtml = item.expandOnTitleClick
        ? `<span class="entry-title-toggle" onclick="toggleEntryExpanded('${itemID}');">${titleHtmlStr}</span>`
        : titleHtmlStr;
    statusSpecific.innerHTML = `${titleWrapperHtml}<br>`;
    statusSpecific.appendChild(summaryDiv);
    if (contentDiv) statusSpecific.appendChild(contentDiv);

    // Images & media
    const images = item.images;
    if (images && images.length > 0) {
        const statusImages = document.createElement('div');
        statusImages.classList.add('status-images-container');
        images.forEach(image => {
            if (!/^https?:\/\//i.test(image.preview_url)) return; // skip unsafe preview URLs
            const imageItem = document.createElement('div');
            imageItem.classList.add('image-item');
            const a = document.createElement('a');
            if (/^https?:\/\//i.test(image.url)) a.href = image.url;
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            const img = document.createElement('img');
            img.src = image.preview_url;
            img.alt = image.description || 'Image';
            a.appendChild(img);
            imageItem.appendChild(a);
            statusImages.appendChild(imageItem);
        });
        statusContent.appendChild(statusImages);
    }

    // Create reference object on the DOM element
    statusSpecific.reference = {
        service: service || null,
        author_name: itemAuthor || '(unknown author)',
        author_id: item.author_id || '(unknown author ID)',
        url: itemUrl || '(no URL provided)',
        guid: item.guid || itemUrl || '',
        title: itemTitle || '(no title)',
        feed: itemFeed || '(no feed specified)',
        feedUrl: itemFeedUrl || null,
        created_at: itemDate || new Date().toISOString(),
        id: itemID || '(no ID)',
        summary: (itemDesc || '').slice(0, 140),
        ...(item.replyToken && { replyToken: item.replyToken }),
    };

    // Create status actions
    const statusActions = document.createElement('div');
    statusActions.classList.add('status-actions');

    // Tell the service's statusActions handler whether there's actually
    // expandable content, so it can skip rendering the Expand button when
    // there isn't (the contentDiv decision above is the source of truth).
    item._hasExpandableContent = !!contentDiv;

    const _statusActionsHtml = window.CList.readers[service]?.statusActions?.(item, itemID, itemUrl);
    if (_statusActionsHtml == null) {
        console.error('makeListing: no statusActions handler for service', service);
    }
    statusActions.innerHTML = _statusActionsHtml || '';
    statusActions.insertAdjacentHTML('beforeend', `
      <button class="clist-action-btn" id="collect-btn-${itemID}" onclick="collectItem('${itemID}');" title="Add to collection"><span class="material-icons md-18 md-light">library_add</span></button>
      <button class="clist-action-btn chat-only-btn" onclick="shareToChat('${itemID}');" title="Share to chat"><span class="material-icons md-18 md-light">chat_bubble_outline</span></button>
    `);

    // Create CList Actions
    const clistActions = document.createElement('div');
    clistActions.classList.add('clist-actions');
    clistActions.innerHTML = `
      <button class="clist-action-btn" id="anno-btn-${itemID}" onclick="clistAnnotate('${itemID}');" title="Write about this"><span class="material-icons md-18 md-light">arrow_forward</span></button>
      <button class="clist-action-btn" id="anno-edit-btn-${itemID}" onclick="clistAnnotateEdit('${itemID}');" title="Annotate"><span class="material-icons md-18 md-light">edit</span></button>
    `;

    // Assemble
    statusContent.appendChild(statusSpecific);
    statusContent.appendChild(statusActions);
    statusBox.appendChild(statusContent);
    statusBox.appendChild(clistActions);

    return statusBox;
};
window.makeListing = window.CList.ui.listing;

// ── feedHeader ────────────────────────────────────────────────────────────────
// Returns a feed-header div with title, description, and optional action buttons.

window.CList.ui.feedHeader = function(type, typevalue) {
    const titles = {
        home: "Home Feed",
        local: "Local Feed",
        bookmarks: "Bookmarks",
        hashtag: "Hashtag",
        user: "User",
        Notifications: "Notifications",
    };

    const feedHeaderDiv = document.createElement("div");
    feedHeaderDiv.className = "feed-header";

    let title = titles[type] || type;
    if (type === 'hashtag' && typevalue) {
        title = `Hashtag: #${typevalue}`;
    } else if ((type === 'user' || type === 'username') && typevalue) {
        title = `User: ${typevalue}`;
    }

    const heading = document.createElement("h2");
    heading.textContent = title;
    feedHeaderDiv.appendChild(heading);

    if (type === 'thread') {
        const actions = document.createElement("p");
        actions.className = "clist-actions";
        actions.innerHTML = `
            <button class="clist-action-btn" title="Summarize thread" onClick="handleSummarize('feed-container','feed-summary','thread')"><span class="material-icons md-18 md-light">play_for_work</span></button>
            <button class="clist-action-btn" title="Load thread into editor" onClick="handleMastodonAction('thread', 'load',this.parentElement.parentElement)"><span class="material-icons md-18 md-light">arrow_right</span></button>
            `;
        feedHeaderDiv.appendChild(actions);
    } else if (type === 'Bluesky Thread') {
        const actions = document.createElement("p");
        actions.className = "clist-actions";
        actions.innerHTML = `
            <button class="clist-action-btn" title="Summarize thread" onClick="handleSummarize('feed-container','feed-summary','thread')"><span class="material-icons md-18 md-light">play_for_work</span></button>
            <button class="clist-action-btn" title="Load into editor" onClick="loadContentToEditor('feed-container')"><span class="material-icons md-18 md-light">arrow_right</span></button>
            `;
        feedHeaderDiv.appendChild(actions);
    }

    return feedHeaderDiv;
};
window.createFeedHeader = window.CList.ui.feedHeader;

// ── renderLoadMoreButton ─────────────────────────────────────────────────────
// Removes any existing button with btnId, then (if onLoadMore is given) adds a
// fresh one wired to it. Shared by renderFeed below and by feed/list renderers
// that paginate outside renderFeed's own per-item loop (e.g. Bluesky
// notifications' mixed listing/status-box items) but still want the same
// load-more button behavior instead of a one-off copy of it.
window.CList.ui.renderLoadMoreButton = function(container, onLoadMore, { btnId = 'loadMoreButton', label = 'Load More' } = {}) {
    document.getElementById(btnId)?.remove();
    if (onLoadMore) {
        const btn = document.createElement('button');
        btn.id = btnId;
        btn.className = 'btn';
        btn.textContent = label;
        btn.onclick = onLoadMore;
        container.appendChild(btn);
    }
};

// ── renderFeed ────────────────────────────────────────────────────────────────
// Clears container (unless appending), adds a feed header and #feed-summary div,
// then calls normalize(rawItem) per item and appends the makeListing() result.
// normalize is async; items appear progressively as each normalization completes.
//
// options:
//   normalize(rawItem) → Promise<item>  — required; maps raw API object to makeListing shape
//   title        — feed type string passed to createFeedHeader; null = skip clear+header
//   typevalue    — second arg to createFeedHeader (e.g. hashtag name, username)
//   append       — true = paginating; skip clear/header/summary, just add items
//   onLoadMore   — function() wired to load-more button; null = no button
//   loadMoreBtnId — id for the load-more button (default 'loadMoreButton')

window.CList.ui.renderFeed = async function(rawItems, container, {
    normalize,
    title         = null,
    typevalue     = null,
    append        = false,
    onLoadMore    = null,
    loadMoreBtnId = 'loadMoreButton',
} = {}) {
    if (!append) {
        container.innerHTML = '';
        if (title != null) container.appendChild(createFeedHeader(title, typevalue));
        const summary = document.createElement('div');
        summary.id = 'feed-summary';
        container.appendChild(summary);
    }

    for (const rawItem of rawItems) {
        container.appendChild(makeListing(await normalize(rawItem)));
    }

    window.CList.ui.renderLoadMoreButton(container, onLoadMore, { btnId: loadMoreBtnId });

    window.checkAnnotationsBatch?.();
};

// ============================================================================
// 6. User feedback: status messages, errors, dialogs
// ============================================================================

// ── showStatusMessage ─────────────────────────────────────────────────────────
// Transient message in #identityDiv (the same bar that otherwise shows the
// login identity); auto-restores after 3 s. Debounced so that overlapping
// calls don't race to restore the identity label too early.

window.CList.ui.showStatusMessage = function(message) {
    const identityDiv = window.CList.ui.view?.identityDiv;
    if (!identityDiv) {
        console.error('identityDiv element not found.');
        return;
    }
    identityDiv.textContent = message;
    clearTimeout(window.CList.ui._statusMessageTimer);
    window.CList.ui._statusMessageTimer = setTimeout(() => {
        if (typeof renderIdentityLabel === 'function') renderIdentityLabel();
    }, 3000);
};
window.showStatusMessage = window.CList.ui.showStatusMessage;

// ── buildDialogModal ──────────────────────────────────────────────────────────
// Shared shell for the title + body + action-button-row dialogs used by
// showErrorModal below, fallbackDownload (files.js), and _localrssConfirm
// (localrss.js) — all three built this same box/heading/.error-modal-actions
// structure by hand before calling showModal(). `buttons` is an array of
// {label, secondary, onClick(close)}; appended in the order given.
window.CList.ui.buildDialogModal = function(title, bodyNode, buttons) {
    const box = document.createElement('div');

    const heading = document.createElement('h2');
    heading.className = 'error-modal-title';
    heading.textContent = title;
    box.appendChild(heading);

    box.appendChild(bodyNode);

    const row = document.createElement('div');
    row.className = 'error-modal-actions';
    const close = () => document.getElementById('generic-modal')?.remove();

    const buttonEls = buttons.map(spec => {
        const btn = document.createElement('button');
        btn.className = spec.secondary ? 'btn btn-secondary' : 'btn';
        btn.textContent = spec.label;
        btn.onclick = () => spec.onClick(close);
        row.appendChild(btn);
        return btn;
    });
    box.appendChild(row);

    showModal(box, { hideDefaultClose: true });
    return { close, buttons: buttonEls };
};
window.buildDialogModal = window.CList.ui.buildDialogModal;

// ── showErrorModal ────────────────────────────────────────────────────────────
// Full-screen modal (via showModal) for errors that block the user from
// completing an action (e.g. a required-field check before save/publish) —
// unlike showStatusMessage, this can't be missed or auto-dismiss unnoticed.

window.CList.ui.showErrorModal = function(message, { title = 'Error' } = {}) {
    const msg = document.createElement('p');
    msg.className = 'error-message';
    msg.textContent = message;

    const { buttons } = buildDialogModal(title, msg, [
        { label: 'OK', onClick: (close) => close() }
    ]);
    buttons[0].focus();
};
window.showErrorModal = window.CList.ui.showErrorModal;

// ── serviceError ──────────────────────────────────────────────────────────────
// Appends a structured error message div to container (element or ID string).

window.CList.ui.serviceError = function(container, title, message, actionHtml = '') {
    const msg = document.createElement('div');
    msg.className = 'error-message';
    msg.innerHTML = `<p><strong>${title}:</strong> ${message}</p>`
        + (actionHtml ? `<p>${actionHtml}</p>` : '');
    if (typeof container === 'string') container = document.getElementById(container);
    if (container) container.appendChild(msg);
};
window.showServiceError = window.CList.ui.serviceError;

// ============================================================================
// 7. Misc DOM utilities
// ============================================================================

// ── copyToClipboard ───────────────────────────────────────────────────────────
// Copies text and reports success/failure via showStatusMessage/showErrorModal
// — the pattern repeated at every "copy link"/"copy URL" button.
window.CList.ui.copyToClipboard = function(text, { successMsg = 'Copied to clipboard.', failMsg = 'Copy failed — select the text and copy manually.' } = {}) {
    return navigator.clipboard.writeText(text)
        .then(() => showStatusMessage(successMsg))
        .catch(() => showErrorModal(failMsg, { title: 'Copy failed' }));
};
window.copyToClipboard = window.CList.ui.copyToClipboard;

// ── dismissOnOutsideClick ─────────────────────────────────────────────────────
// Removes `el` and detaches itself on the first click outside of `el` (and not
// on `anchorEl`, e.g. the button that opened it — pass null if not needed).
// Listener is attached on a deferred setTimeout so the click that opened `el`
// doesn't itself immediately dismiss it.
window.CList.ui.dismissOnOutsideClick = function(el, anchorEl) {
    const outsideHandler = (e) => {
        if (!el.contains(e.target) && e.target !== anchorEl) {
            el.remove();
            document.removeEventListener('click', outsideHandler, true);
        }
    };
    setTimeout(() => document.addEventListener('click', outsideHandler, true), 0);
};
window.dismissOnOutsideClick = window.CList.ui.dismissOnOutsideClick;

// ============================================================================
// 8. Capability gating
// ============================================================================

// ── isHandlerVisible ──────────────────────────────────────────────────────────
// Shared capability gate for the loaders/savers/editorHandlers registries (see
// docs/storage-model.md "Capability flags"). A handler declares requiresLogin
// and/or requiresAccount; either flag defaults to true (fail closed) when the
// handler doesn't declare it at all, so a handler that forgets to state its
// requirements stays hidden instead of silently showing up for a logged-out
// visitor — the opposite of the old per-file visible()-or-nothing convention,
// which defaulted to always-visible. A handler's own visible() — for checks
// these two flags can't express, e.g. Dropbox needing a Dropbox-TYPED account,
// not just any account — always wins outright over the flags.
window.CList.ui.isHandlerVisible = function(handler) {
    if (typeof handler.visible === 'function') return handler.visible();

    const requiresLogin   = handler.requiresLogin   !== false;
    const requiresAccount = handler.requiresAccount  !== false;

    if (requiresLogin && !(typeof isRegistered === 'function' && isRegistered())) return false;
    if (requiresAccount && !(window.CList.accounts || []).length) return false;
    return true;
};
window.isHandlerVisible = window.CList.ui.isHandlerVisible;
