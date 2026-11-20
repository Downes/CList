// Annotation row rendering and feed/thread presentation; no data transport.
window.CList.ui ||= {};
window.CList.ui.annotationReading = {
    message(root, text, error = false) {
        root.replaceChildren(); const p = document.createElement('p');
        p.className = error ? 'error-message' : 'feed-status-message'; p.textContent = text; root.appendChild(p);
    },
    warnings(root, warnings) {
        if (!warnings.length) return;
        const p = document.createElement('p'); p.className = 'error-message';
        p.textContent = 'Some annotation sources could not be read: ' + warnings.join(' '); root.appendChild(p);
    },
    rows(root, items, options) {
        for (const annotation of items) root.appendChild(_buildAnnotationItem(annotation, options));
    },
    feed(root, { items, warnings, rowOptions, emptyText }) {
        root.replaceChildren(); this.warnings(root, warnings);
        if (!items.length) {
            const p = document.createElement('p'); p.className = 'feed-status-message';
            p.textContent = emptyText; root.appendChild(p);
        }
        this.rows(root, items, rowOptions);
    },
    followBusy(button, busy) { button.disabled = busy; },
    followed(button, did) {
        button.title = 'Following'; button.innerHTML = '<span class="material-icons md-18 md-light">how_to_reg</span>';
        showStatusMessage('Now following ' + did.replace(/^did:web:[^:]+:users:/, ''));
    },
    thread(root, source, count, close, loggedIn) {
        const saved = { fragment: document.createDocumentFragment(), scroll: root.scrollTop };
        while (root.firstChild) saved.fragment.appendChild(root.firstChild);
        const thread = document.createElement('div'); thread.className = 'annotation-thread';
        const header = document.createElement('div'); header.className = 'annotation-thread-header';
        const button = document.createElement('button'); button.className = 'clist-action-btn'; button.title = 'Close annotations';
        button.innerHTML = '<span class="material-icons md-18 md-light">close</span>'; button.onclick = close;
        const label = document.createElement('span'); label.textContent = `${count} annotation${count === 1 ? '' : 's'} for this item`;
        header.append(button, label); thread.appendChild(header);
        const original = source.closest('.status-box');
        if (original) { const copy = original.cloneNode(true); copy.querySelectorAll('.status-actions,.clist-actions').forEach(node => node.remove()); thread.appendChild(copy); }
        if (!count) { const p = document.createElement('p'); p.className = 'feed-status-message'; p.textContent = loggedIn ? 'No annotations from people you follow.' : 'No public annotations found for this item.'; thread.appendChild(p); }
        root.appendChild(thread); root.scrollTop = 0; return { root: thread, saved };
    },
    restore(root, saved) { root.replaceChildren(); root.appendChild(saved.fragment); root.scrollTop = saved.scroll; },
    count(source, count, open) {
        const actions = source.parentElement?.querySelector(':scope > .status-actions'); if (!actions) return;
        let button = actions.querySelector('.anno-read-btn');
        if (!button && count) {
            button = document.createElement('button'); button.className = 'clist-action-btn anno-read-btn'; button.title = 'Read annotations'; actions.appendChild(button);
        }
        if (button) { button.innerHTML = `<span class="material-icons md-18 md-light">comment</span> (${count})`; button.onclick = open; }
    },
    followButton(source, did, following, click) {
        const actions = source.closest('.status-box')?.querySelector(':scope > .clist-actions');
        if (!actions || actions.querySelector('.anno-follow-author-btn')) return null;
        const button = document.createElement('button'); button.className = 'clist-action-btn anno-follow-author-btn';
        const name = did.replace(/^did:web:[^:]+:users:/, '');
        this.followState(button, following, name); button.onclick = click; actions.appendChild(button); return button;
    },
    followState(button, following, name) {
        button.title = (following ? 'Unfollow ' : 'Follow ') + name;
        button.innerHTML = `<span class="material-icons md-18 md-light">${following ? 'person_remove' : 'person_add'}</span>`;
    },
    feedAuthor(root, did, follow) {
        const banner = document.createElement('div'); banner.className = 'annotation-feed-author-banner';
        const label = document.createElement('span'); label.textContent = 'Feed author: ' + did.replace(/^did:web:[^:]+:users:/, '');
        const button = document.createElement('button'); button.className = 'clist-action-btn'; button.title = 'Follow feed author';
        button.innerHTML = '<span class="material-icons md-18 md-light">person_add</span>';
        button.onclick = () => follow(button, label); banner.append(label, button);
        root.insertBefore(banner, root.children[1] || null);
    },
    feedAuthorFollowed(label,did) { label.textContent = 'Following ' + did.replace(/^did:web:[^:]+:users:/, ''); },
    followFeedback(following) { showStatusMessage(following ? 'Now following feed author.' : 'Unfollowed feed author.'); },
    batchWarnings(warnings) { console.error('[annotation batch] partial failures',warnings); showStatusMessage(warnings.join(' ')); },
    actionError(action,error,current) {
        console.error('[annotation '+action+']',error);
        if (current) showErrorModal(action+' error: '+error.message,{title:action+' failed'});
        else showStatusMessage('An earlier annotation '+action.toLowerCase()+' action stopped.');
    },
    error(error) { console.error('[annotation reader]', error); showStatusMessage(error?.message || String(error)); },
};
function _buildAnnotationItem(anno, options = {}) {
    const {
        showUrl      = true,
        myDid        = '',
        token        = '',
        writeAccts   = [],
        followedDids = new Set(),
        url          = '',
        isCurrent = () => true,
        onFollow, onFlow,
    } = options;

    const guard = () => statusBox.isConnected && isCurrent();
    const sourceUrl   = anno.target?.source || '';
    const title       = anno.target?.selector?.title || sourceUrl || '(untitled)';
    const creatorId   = anno.creator?.id || anno.creator || '';
    const creatorName = anno.creator?.name
        || creatorId.replace(/^did:web:[^:]+:users:/, '').replace(/^acct:([^@]+)@.*$/, '$1')
        || 'Unknown';
    const _b = anno.body;
    const bodyRaw = !_b ? ''
        : typeof _b === 'string'  ? _b
        : Array.isArray(_b)       ? _b.map(i => i?.value || '').join(' ')
        : typeof _b === 'object'  ? (_b.value || '')
        : String(_b);
    const date        = anno.created ? new Date(anno.created).toLocaleDateString() : '';
    const svc         = anno._sourceService || _serviceLabel(creatorId);
    const tags        = Array.isArray(anno.tag) ? anno.tag.join(', ') : '';
    const via         = anno.target_selector?.via || '';
    const isOwn       = !!(myDid && creatorId === myDid);
    const flowUrl     = url || sourceUrl;

    const safeBody = typeof sanitizeHtml === 'function'
        ? sanitizeHtml(bodyRaw).toString() : _annoHe(bodyRaw);

    const itemID    = createUniqueIdFromUrl(anno.id || sourceUrl);
    const plainLen  = bodyRaw.replace(/<[^>]+>/g, '').length;
    const isLong    = plainLen > _ANNO_BODY_THRESHOLD;

    const statusBox = document.createElement('div');
    statusBox.className = 'status-box';

    const statusContent = document.createElement('div');
    statusContent.className = 'status-content';

    const statusSpecific = document.createElement('div');
    statusSpecific.className = 'statusSpecific';
    statusSpecific.id = itemID;

    // Source-page title link — only for showAllAnnotations
    if (showUrl && /^https?:\/\//i.test(sourceUrl)) {
        const titleEl = document.createElement('a');
        titleEl.href = sourceUrl;
        titleEl.target = '_blank';
        titleEl.rel = 'noopener noreferrer';
        titleEl.textContent = title;
        statusSpecific.appendChild(titleEl);
        statusSpecific.appendChild(document.createElement('br'));
    }

    // annotation-meta: creator + follow/following icon (if not own) + source span
    const metaDiv = document.createElement('div');
    metaDiv.className = 'annotation-meta';

    const creatorSpan = document.createElement('span');
    creatorSpan.className = 'annotation-creator';
    creatorSpan.textContent = creatorName;
    metaDiv.appendChild(creatorSpan);

    if (token && !isOwn && creatorId.startsWith('did:')) {
        const alreadyFollowing = followedDids.has(creatorId);
        const followBtn = document.createElement('button');
        followBtn.className = 'clist-action-btn';
        followBtn.title = alreadyFollowing ? 'Following' : 'Follow this person';
        followBtn.innerHTML = `<span class="material-icons md-18 md-light">${alreadyFollowing ? 'how_to_reg' : 'person_add'}</span>`;
        followBtn.disabled = alreadyFollowing;
        if (!alreadyFollowing) {
            followBtn.addEventListener('click', () => { if (guard()) return onFollow?.(creatorId,followBtn,guard); });
        }
        metaDiv.appendChild(followBtn);
    }

    const sourceInner = [date, svc].filter(Boolean).join(' ');
    if (sourceInner) {
        const sourceSpan = document.createElement('span');
        sourceSpan.className = 'annotation-source';
        sourceSpan.title = anno._sourceCreatorId || creatorId;
        const inner = document.createElement('span');
        inner.className = 'annotation-source-inner';
        inner.textContent = sourceInner;
        sourceSpan.appendChild(document.createTextNode('['));
        sourceSpan.appendChild(inner);
        sourceSpan.appendChild(document.createTextNode(']'));
        metaDiv.appendChild(sourceSpan);
    }
    statusSpecific.appendChild(metaDiv);

    // Body — truncated summary + hidden full version when long
    if (isLong) {
        const summaryEl = document.createElement('div');
        summaryEl.id = `${itemID}-summary`;
        summaryEl.className = 'annotation-body';
        summaryEl.textContent = bodyRaw.replace(/<[^>]+>/g, '').slice(0, _ANNO_BODY_THRESHOLD) + '…';
        statusSpecific.appendChild(summaryEl);

        const fullEl = document.createElement('div');
        fullEl.id = `${itemID}-content`;
        fullEl.className = 'annotation-body';
        fullEl.innerHTML = safeBody;
        fullEl.style.display = 'none';
        statusSpecific.appendChild(fullEl);
    } else {
        const bodyEl = document.createElement('div');
        bodyEl.className = 'annotation-body';
        bodyEl.innerHTML = safeBody;
        statusSpecific.appendChild(bodyEl);
    }

    if (tags) {
        const tagsDiv = document.createElement('div');
        tagsDiv.className = 'annotation-tags';
        tagsDiv.textContent = tags;
        statusSpecific.appendChild(tagsDiv);
    }

    if (via) {
        const viaUsername = via.replace(/^did:web:[^:]+:users:/, '');
        const viaUrl = _didToProfileUrl(via);
        const viaEl = document.createElement('div');
        viaEl.className = 'annotation-via';
        viaEl.innerHTML = `↩ via ${viaUrl
            ? `<a href="${_annoHe(viaUrl)}" target="_blank">${_annoHe(viaUsername)}</a>`
            : _annoHe(viaUsername)}`;
        statusSpecific.appendChild(viaEl);
    }

    // reference — read by checkAnnotationsBatch, collectItem, clistAnnotate
    // isAnnotation=true tells checkAnnotationsBatch to check only the annotation's own ID (guid),
    // not the source article URL, so it doesn't inherit the article's annotation count.
    statusSpecific.reference = {
        author_name:  creatorName,
        author_id:    creatorId,
        url:          sourceUrl || '(no URL provided)',
        guid:         anno.id || sourceUrl || '',
        title,
        feed:         svc,
        feedUrl:      null,
        created_at:   '',
        cited_at:     anno.created || new Date().toISOString(),
        id:           itemID,
        isAnnotation: true,
    };

    // ── Status actions ──────────────────────────────────────────────────────

    const statusActions = document.createElement('div');
    statusActions.className = 'status-actions';

    if (isLong) {
        let expanded = false;
        const zoomBtn = document.createElement('button');
        zoomBtn.className = 'clist-action-btn';
        zoomBtn.title = 'Expand';
        zoomBtn.innerHTML = '<span class="material-icons md-18 md-light">zoom_out_map</span>';
        zoomBtn.addEventListener('click', () => {
            if (!guard()) return;
            expanded = !expanded;
            const s = statusBox.querySelector('.annotation-body');
            const f = statusBox.querySelectorAll('.annotation-body')[1];
            if (s) s.style.display = expanded ? 'none' : 'block';
            if (f) f.style.display = expanded ? 'block' : 'none';
            zoomBtn.title   = expanded ? 'Collapse' : 'Expand';
            zoomBtn.innerHTML = `<span class="material-icons md-18 md-light">${expanded ? 'zoom_in_map' : 'zoom_out_map'}</span>`;
        });
        statusActions.appendChild(zoomBtn);
    }

    if (/^https?:\/\//i.test(sourceUrl)) {
        const launchBtn = document.createElement('button');
        launchBtn.className = 'clist-action-btn';
        launchBtn.title = 'Open source page';
        launchBtn.innerHTML = '<span class="material-icons md-18 md-light">launch</span>';
        launchBtn.addEventListener('click', () => { if (guard()) openInBrowser(sourceUrl); });
        statusActions.appendChild(launchBtn);
    }

    // "Read annotations" button injected here by checkAnnotationsBatch when count > 0

    const collectBtn = document.createElement('button');
    collectBtn.className = 'clist-action-btn login-only-btn';
    collectBtn.id = `collect-btn-${itemID}`;
    collectBtn.title = 'Add to collection';
    collectBtn.innerHTML = '<span class="material-icons md-18 md-light">library_add</span>';
    collectBtn.addEventListener('click', () => { if (guard() && document.getElementById(itemID) === statusSpecific) return collectItem(itemID); });
    statusActions.appendChild(collectBtn);

    const chatShareBtn = document.createElement('button');
    chatShareBtn.className = 'clist-action-btn chat-only-btn';
    chatShareBtn.title     = 'Share to chat';
    chatShareBtn.innerHTML = '<span class="material-icons md-18 md-light">chat</span>';
    chatShareBtn.addEventListener('click', () => {
        if (!guard()) return;
        const excerpt = bodyRaw.replace(/<[^>]+>/g, '').slice(0, 300) || null;
        sendShareMessage('annotation', sourceUrl, title, excerpt);
    });
    statusActions.appendChild(chatShareBtn);

    // ── CList actions ───────────────────────────────────────────────────────

    const clistActions = document.createElement('div');
    clistActions.className = 'clist-actions';

    if (token && !isOwn && writeAccts.length) {
        const flowBtn = document.createElement('button');
        flowBtn.className = 'clist-action-btn';
        flowBtn.title = 'Flow — add to your annotations';
        flowBtn.innerHTML = '<span class="material-icons md-18 md-light">forward</span>';
        flowBtn.addEventListener('click', () => { if (guard()) return onFlow?.(anno,flowUrl,flowBtn,guard); });
        clistActions.appendChild(flowBtn);
    }

    const annotateBtn = document.createElement('button');
    annotateBtn.className = 'clist-action-btn';
    annotateBtn.id = `anno-btn-${itemID}`;
    annotateBtn.title = 'Write about this';
    annotateBtn.innerHTML = '<span class="material-icons md-18 md-light">arrow_forward</span>';
    annotateBtn.addEventListener('click', () => { if (guard() && document.getElementById(itemID) === statusSpecific) return clistAnnotate(itemID); });
    clistActions.appendChild(annotateBtn);

    statusContent.appendChild(statusSpecific);
    statusContent.appendChild(statusActions);
    statusBox.appendChild(statusContent);
    statusBox.appendChild(clistActions);

    return statusBox;
}
