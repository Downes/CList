console.log('[annotations] annotate.js loading');
//  annotate.js  -  Annotation store account type for CList
//  Part of CList, the next generation of learning and connecting with your community
//
//  Copyright Stephen Downes 2025, downes.ca
//  Licensed under Creative Commons Attribution 4.0 International https://creativecommons.org/licenses/by/4.0/
//
//  This software carries NO WARRANTY OF ANY KIND.
//  This software is provided "AS IS," and you, its user, assume all risks when using it.

window.CList.schemas = window.CList.schemas || {};
window.CList.schemas['Annotate'] = {
    type: 'Annotate',
    instanceFromKey: true,
    kvKey: { label: 'Store URL', placeholder: 'https://annotations.mooc.ca' },
    fields: [
        { key: 'title',       label: 'Title',       editable: true, inputType: 'text', placeholder: 'My Annotations', default: '' },
        { key: 'permissions', label: 'Permissions', editable: true, inputType: 'text', placeholder: 'rw',              default: 'rw' },
    ]
};

// ── Helpers ────────────────────────────────────────────────────────────────────

// escapeHtml is defined in utilities.js
const _annoHe = escapeHtml;

// Convert a did:web:host:users:username DID to a human-readable profile URL.
// Passes the visitor's kvstore URL (so the profile page can build a Follow link)
// and their token in the URL fragment (fragments are not sent to the server,
// so the token doesn't appear in logs; the follow page uses it to skip re-login).
function _didToProfileUrl(did) {
    const m = String(did || '').match(/^did:web:([^:]+):users:(.+)$/);
    if (!m) return null;
    const base = `https://${m[1]}/users/${m[2]}/did.html`;
    const myKvstore = typeof window.CList.config.flaskSiteUrl !== 'undefined' ? window.CList.config.flaskSiteUrl : null;
    if (!myKvstore) return base;
    const params = `?mykvstore=${encodeURIComponent(myKvstore)}`;
    return base + params;
}

// Derive a short human-readable service label from a creator identifier.
// did:web:kvstore.mooc.ca:users:X  → mooc.ca
// acct:Username@hypothes.is        → hypothes.is
function _serviceLabel(creatorId) {
    if (!creatorId) return '';
    if (creatorId.startsWith('acct:')) {
        const m = creatorId.match(/@(.+)$/);
        return m ? m[1] : '';
    }
    if (creatorId.startsWith('did:web:')) {
        const domain = creatorId.split(':')[2] || '';
        const parts = domain.split('.');
        return parts.length > 2 ? parts.slice(1).join('.') : domain;
    }
    return '';
}

// ── Insert a source quote into the active editor ─────────────────────────────────────────

// Builds the {content, feedTitle} pair for a quote-insert action: the current text
// selection if there is one, else the reference's own summary, attributed via
// referenceDisplayName. HTML-capable editors get the quote escaped and wrapped for HTML;
// plain-text editors keep the quote-only behavior. The bracket citation itself is appended
// by handler.insertLink/insertLinkVia, per editor type. Shared by the arrow button
// (clistAnnotate, below) and the Alt+A "open Annotate editor" shortcut (navigation.js) so
// both quote the same way.
function _buildQuoteContent(reference, handler, capturedSelection) {
    const selectedText = capturedSelection === undefined ? (window.getSelection()?.toString().trim() || '') : capturedSelection;
    const textToQuote = selectedText || reference.summary || '';
    const attribution = referenceDisplayName(reference);
    const feedTitle = attribution;

    const supportsHtml = (handler.contentTypes || []).includes('text/html');
    const content = textToQuote
        ? (supportsHtml
            ? { type: 'text/html', value: `${escapeHtml(attribution)} wrote: "${escapeHtml(textToQuote)}"` }
            : { type: 'text/plain', value: `${attribution} wrote: "${textToQuote}"` })
        : { type: supportsHtml ? 'text/html' : 'text/plain', value: '' };

    return { content, feedTitle };
}

// Keyboard routing reuses the editor switch queue and quote formatter.
async function annotateNavigationReference(reference, selectedText, isCurrent) {
    const returnTo = currentEditor === 'annotate-edit' ? null : currentEditor;
    const switching = switchToEditor('annotate-edit');
    const switchId = window.CList.state.editorSwitching?.id;
    const success = await switching;
    if(success === false || !isCurrent() || currentEditor !== 'annotate-edit' || window.CList.state.editorSwitching?.id !== switchId) return false;
    const handler = editorHandlers['annotate-edit'];
    if(typeof handler?.insertLink !== 'function') throw new Error('The annotation editor cannot insert a source quote.');
    const {content,feedTitle} = _buildQuoteContent(reference,handler,selectedText);
    if(returnTo) _annotateReturnEditor = returnTo;
    await handler.insertLink({content,entryUrl:reference.url,feedTitle,reference:{...reference}});
    return true;
}

window.clistAnnotate = async function(itemId) {
    const el = document.getElementById(itemId);
    if (!el || !el.reference) {
        showErrorModal('No reference found for this item.', { title: 'No reference' });
        return;
    }
    const reference = el.reference;
    const handler = editorHandlers[currentEditor];
    if (typeof handler?.insertLink !== 'function') {
        showErrorModal('The active editor cannot insert a source quote.', { title: 'Cannot add text' });
        return;
    }
    const { content, feedTitle } = _buildQuoteContent(reference, handler);
    try {
        await handler.insertLink({ content, entryUrl: reference.url, feedTitle, reference: { ...reference } });
    } catch (error) {
        console.error('Could not add text to active editor:', error);
        showErrorModal('Could not add text: ' + error.message, { title: 'Cannot add text' });
        return;
    }

    if (window.innerWidth <= 768) {
        if (typeof mobShowWrite === 'function') mobShowWrite();
    } else if (typeof snapPanes === 'function' && typeof mainContent !== 'undefined' && typeof readPane !== 'undefined') {
        const ratio = readPane.getBoundingClientRect().width / mainContent.getBoundingClientRect().width;
        if (ratio > 0.65) snapPanes('left');
    }
};

window.openAnnotationEditor = function(itemId) {
    const el = document.getElementById(itemId);
    if (!el || !el.reference) {
        showErrorModal('No reference found for this item.', { title: 'No reference' });
        return;
    }
    if (typeof currentEditor !== 'undefined' && currentEditor === 'collection') {
        if (typeof window.addItemToCollectionEditor === 'function') {
            window.addItemToCollectionEditor(el.reference);
        }
        return;
    }
    pushReference({ ...el.reference });

    // Clear the active editor content
    const textarea = window.CList.ui.view.textColumn;
    if (textarea) {
        textarea.value = '';
        textarea.setSelectionRange(0, 0);
    }
    if (window.tinymce && tinymce.activeEditor) {
        tinymce.activeEditor.setContent('');
    }

    // Load empty content so the reference system registers this item
    const handler = typeof editorHandlers !== 'undefined' && editorHandlers[currentEditor];
    if (handler && typeof handler.loadContent === 'function') {
        handler.loadContent({ type: 'text/html', value: '' }, itemId);
    }

    // Show write pane if the divider is at the far right (read pane taking >65% of width)
    if (window.innerWidth <= 768) {
        if (typeof mobShowWrite === 'function') mobShowWrite();
    } else if (typeof snapPanes === 'function' && typeof mainContent !== 'undefined' && typeof readPane !== 'undefined') {
        const ratio = readPane.getBoundingClientRect().width / mainContent.getBoundingClientRect().width;
        if (ratio > 0.65) snapPanes('left');
    }
};

// ── Publish handler ────────────────────────────────────────────────────────────

// Returns the combined list of local + federated + chat-peer annotation accounts,
// deduplicated by instance URL.
async function _allAnnotationAccounts() {
    const local = (window.CList.accounts || [])
        .map(a => parseAccountValue(a))
        .filter(d => d && (d.type === 'Annotate' || d.type === 'Hypothesis') && d.instance);
    const federated = await _getFederatedAnnotationAccounts();
    const hasConfiguredHypothesis = local.some(a => a.type === 'Hypothesis');
    const seen = new Set(local.map(a => a.instance));
    const combined = [...local, ...federated.filter(a => {
        if (a.type === 'Hypothesis') return !hasConfiguredHypothesis;
        return !seen.has(a.instance);
    })];
    // Add annotation stores announced by current chat peers (dynamicp2p.js).
    if (typeof window.getPeerAnnotationStores === 'function') {
        const allSeen = new Set(combined.map(a => a.instance));
        window.getPeerAnnotationStores().forEach(url => {
            if (!allSeen.has(url)) {
                combined.push({ instance: url, _peer: true });
                allSeen.add(url);
            }
        });
    }
    return combined;
}

// ── Batch annotation check (runs after feed renders) ──────────────────────────

async function _flowAnnotation(anno, targetUrl, writeAccts, token, btn, session, isCurrent = () => true) {
    if (!btn.isConnected || !isCurrent()) return;
    const view = window.CList.ui.annotations;
    view.flowButton(btn, true);
    let created = false;
    try {
        const outcome = await flowAnnotation(structuredClone(anno), targetUrl, writeAccts, token, session);
        created = outcome.created > 0;
        if (btn.isConnected && isCurrent()) view.show(outcome);
        else showStatusMessage('An earlier annotation Flow completed.');
    } catch (error) {
        console.error('[annotations] flow failed', error);
        if (isCurrent()) showErrorModal(error.message, { title: 'Flow failed' });
        else showStatusMessage('An earlier annotation Flow failed.');
    } finally { if (btn.isConnected && isCurrent()) view.flowButton(btn, false, created); }
}

// Look up a DID by social handle (e.g. "user@mastodon.social") across known kvstore instances.
// Queries each kvstore's /users/by-handle endpoint and returns the first matched DID, or null.
// kvstoreUrls defaults to the user's own window.CList.config.flaskSiteUrl plus any configured kvstore accounts.
async function findDidByHandle(handle) {
    if (!handle) return null;

    // Collect kvstore URLs to search: own + any additional configured kvstore accounts
    const kvUrls = new Set([window.CList.config.flaskSiteUrl].filter(Boolean));
    (window.CList.accounts || []).forEach(a => {
        const d = parseAccountValue(a);
        if (d && d.type === 'kvstore' && d.instance) kvUrls.add(d.instance);
    });

    for (const url of kvUrls) {
        try {
            const resp = await fetch(
                `${url}/users/by-handle?handle=${encodeURIComponent(handle)}`,
                { headers: { Accept: 'application/json' } }
            );
            if (resp.ok) {
                const data = await resp.json();
                if (data.results && data.results.length) return data.results[0].did;
            }
        } catch (e) {
            console.warn('findDidByHandle: error querying', url, e);
        }
    }
    return null;
}

// Fetch the author_did advertised in a feed's metadata via localrss_reader's /feed_meta.
// Uses the configured LOCALRSS account's serviceUrl if available, falling back to the default.
// Returns a DID string or null. No auth needed — /feed_meta is public.
// Results are cached in-memory for the session to avoid repeated lookups in checkAnnotationsBatch.
const _feedAuthorDidCache = new Map();

async function _getAuthorDidFromFeed(feedUrl) {
    if (!feedUrl || feedUrl === '(no feed specified)') return null;
    let serviceUrl = window.CList.defaults.LOCALRSS;
    try {
        const accts = Array.isArray(window.CList.accounts) ? window.CList.accounts : [];
        const found = accts.find(a => {
            const d = parseAccountValue(a);
            return d && d.type === 'LOCALRSS';
        });
        if (found) {
            const d = parseAccountValue(found);
            if (d && d.serviceUrl) serviceUrl = d.serviceUrl;
        }
    } catch (e) { console.error('_getAuthorDidFromFeed: error reading LOCALRSS account, using default', e); }
    const cacheKey = serviceUrl + '|' + feedUrl;
    if (_feedAuthorDidCache.has(cacheKey)) return _feedAuthorDidCache.get(cacheKey);
    let result = null;
    try {
        const resp = await fetch(`${serviceUrl}/feed_meta?url=${encodeURIComponent(feedUrl)}`);
        if (resp.ok) {
            const data = await resp.json();
            result = (data.ok && data.author_did) ? data.author_did : null;
        }
    } catch (e) {
        console.warn('_getAuthorDidFromFeed failed:', e);
    }
    _feedAuthorDidCache.set(cacheKey, result);
    return result;
}

// ── Unified annotation item builder ───────────────────────────────────────────

const _ANNO_BODY_THRESHOLD = 400;

// Builds a first-class feed item for one annotation.
// options.showUrl      — include source-page title/link in statusSpecific (true for showAllAnnotations)
// options.myDid        — logged-in user's DID (no follow/flow buttons on own annotations)
// options.token        — auth token
// options.writeAccts   — write-capable annotation accounts (for Flow)
// options.followedDids — Set of followed DIDs
// options.url          — target URL context for Flow (defaults to anno.target.source)
