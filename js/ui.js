//  ui.js  —  CList.ui factory functions
//  Part of CList, the next generation of learning and connecting with your community
//
//  Each function takes data and returns a DOM element (no side effects).
//  Backward-compatible bare-name globals are aliased at the bottom of this file.
//
//  Copyright Stephen Downes 2025
//  Licensed under Creative Commons Attribution 4.0 International https://creativecommons.org/licenses/by/4.0/
//
//  This software carries NO WARRANTY OF ANY KIND.
//  This software is provided "AS IS," and you, its user, assume all risks when using it.

window.CList = window.CList || {};
window.CList.ui = {};

// ── External-window registry for drag-and-drop reference attribution ─────────
window.CList._openedWindowRefs    = {};
window.CList._lastOpenedWindowRef = null;

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

// url  — extracted from text/uri-list or text/html href; null for plain-text drags
// title — from text/x-clist-title injected by the CList extension; null if not present
window._attributeDroppedContent = function(url, title) {
    let ref = url ? window.CList._openedWindowRefs[url] : null;
    if (!ref && url) ref = _makeMinimalRef(url, title);
    if (!ref) ref = window.CList._lastOpenedWindowRef;
    if (!ref) return;
    if (typeof pushReference === 'function' && pushReference(ref)) {
        showStatusMessage('Reference added: ' + (ref.title !== ref.url ? ref.title : ref.feed || ref.url));
    }
};

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
    const dt = e.dataTransfer;
    if (!dt) return;
    const url   = window._extractDropUrl(dt.getData('text/uri-list'), dt.getData('text/html'));
    const title = dt.getData('text/x-clist-title') || null;
    window._attributeDroppedContent(url, title);
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

        btn.appendChild(accountIcon(parsedValue.type));
        btn.appendChild(name);
        container.appendChild(btn);
    });

    return container;
};

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
        summaryDiv.appendChild(document.createTextNode(': ' + (itemDesc || 'No Summary')));
    }

    // Build content div (if applicable)
    let contentDiv = null;
    if (safeContentHtml && safeContentHtml.length > (itemDesc || '').length) {
        contentDiv = document.createElement('div');
        contentDiv.id = `${itemID}-content`;
        contentDiv.style.display = 'none';
        contentDiv.innerHTML = `
            <div class='status-actions'>
            <button class="clist-action-btn" title="Collapse" onclick="toggleFormDisplay('${itemID}-content');toggleFormDisplay('${itemID}-summary');"><span class="material-icons md-18 md-light">zoom_in_map</span></button>
            </div>
            <div class='post'>
                <h2 class='post-title'>${_he(itemTitle)}</h2>
                <p><em>${_he(itemAuthor || 'Unknown Author')}, ${_he(itemFeed || 'Unknown Source')}, ${_he(itemDate || 'Date unknown')}</em></p>
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
    statusSpecific.innerHTML = `${titleHtmlStr}<br>`;
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

    const _statusActionsHtml = window.CList.readers[service]?.statusActions?.(item, itemID, itemUrl);
    if (_statusActionsHtml == null) {
        console.error('makeListing: no statusActions handler for service', service);
    }
    statusActions.innerHTML = _statusActionsHtml || '';
    statusActions.insertAdjacentHTML('beforeend', `
      <button class="clist-action-btn" id="collect-btn-${itemID}" onclick="collectItem('${itemID}');" title="Add to collection"><span class="material-icons md-18 md-light">library_add</span></button>
      <button class="clist-action-btn" onclick="shareToChat('${itemID}');" title="Share to chat"><span class="material-icons md-18 md-light">chat_bubble_outline</span></button>
    `);

    // Create CList Actions
    const clistActions = document.createElement('div');
    clistActions.classList.add('clist-actions');
    clistActions.innerHTML = `
      <button class="clist-action-btn" id="anno-btn-${itemID}" onclick="clistAnnotate('${itemID}');" title="Write about this"><span class="material-icons md-18 md-light">arrow_forward</span></button>
    `;

    // Assemble
    statusContent.appendChild(statusSpecific);
    statusContent.appendChild(statusActions);
    statusBox.appendChild(statusContent);
    statusBox.appendChild(clistActions);

    return statusBox;
};

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

// ── feedHeader ────────────────────────────────────────────────────────────────
// Returns a feed-header div with title, description, and optional action buttons.

window.CList.ui.feedHeader = function(type, typevalue) {
    const titles = {
        home: "Home Feed",
        local: "Local Feed",
        bookmarks: "Bookmarks",
        hashtag: "Hashtag Feed",
        user: "User Feed",
        Notifications: "Notifications",
    };

    const feedHeaderDiv = document.createElement("div");
    feedHeaderDiv.className = "feed-header";

    const title = titles[type] || type;
    const heading = document.createElement("h2");
    heading.textContent = title;

    let description_text = `Viewing ${title.toLowerCase()}.`;
    if (type === 'hashtag' && typevalue) {
        description_text = `Viewing hashtag feed for #${typevalue}.`;
    } else if ((type === 'user' || type === 'username') && typevalue) {
        description_text = `Viewing posts by ${typevalue}.`;
    }
    const description = document.createElement("p");
    description.textContent = description_text;

    feedHeaderDiv.appendChild(heading);
    feedHeaderDiv.appendChild(description);

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

// ── view ──────────────────────────────────────────────────────────────────────
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
    statusPane:       document.getElementById('statusPane'),
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

// ── showStatusMessage ─────────────────────────────────────────────────────────
// Transient message in #statusPane; auto-hides after 3 s.

window.CList.ui.showStatusMessage = function(message) {
    const statusPane = window.CList.ui.view?.statusPane;
    if (!statusPane) {
        console.error('Status pane element not found.');
        return;
    }
    statusPane.textContent = message;
    statusPane.style.display = 'block';
    setTimeout(() => { statusPane.style.display = 'none'; }, 3000);
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

    document.getElementById(loadMoreBtnId)?.remove();
    if (onLoadMore) {
        const btn = document.createElement('button');
        btn.id = loadMoreBtnId;
        btn.className = 'btn';
        btn.textContent = 'Load More';
        btn.onclick = onLoadMore;
        container.appendChild(btn);
    }

    window.checkAnnotationsBatch?.();
};

// ── backward-compatible globals ───────────────────────────────────────────────
// Existing call sites use bare names; these aliases keep them working.

window.makeAccountList     = window.CList.ui.accountList;
window.makeListing         = window.CList.ui.listing;
window.makeEditorButton    = window.CList.ui.editorButton;
window.createFeedHeader    = window.CList.ui.feedHeader;
window.showServiceError    = window.CList.ui.serviceError;
window.showStatusMessage   = window.CList.ui.showStatusMessage;
