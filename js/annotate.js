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

// ── Add-annotation form ────────────────────────────────────────────────────────

async function _submitAnnotation(panel, itemID, url, bodyText, tags, visibility, acct, token) {
    if (acct.type === 'Hypothesis') {
        if (typeof window.hypothesisCreate !== 'function') {
            showStatusMessage('Hypothesis write support not loaded.');
            return;
        }
        try {
            await window.hypothesisCreate(acct, { target_url: url, body: bodyText, tags, visibility });
        } catch (e) {
            showStatusMessage('Failed to save to Hypothesis: ' + e.message);
            console.error('[hypothesis] create error', e);
        }
        return;
    }

    const payload = {
        target_url: url,
        body: bodyText,
        tags: tags.length ? tags : [],
        visibility,
        motivation: 'commenting',
    };

    try {
        const resp = await fetch(`${acct.instance}/annotations`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': 'Bearer ' + token,
            },
            body: JSON.stringify(payload),
        });

        if (resp.ok) {
        } else {
            const err = await resp.json().catch(() => ({}));
            if (resp.status === 403 && (err.detail || '').includes('Not registered')) {
                showStatusMessage('Not registered on this annotation server — please re-add the account in Account Settings.');
            } else {
                showStatusMessage('Failed to save annotation: ' + (err.detail || resp.status));
            }
            console.error('Annotation POST failed', resp.status, err);
        }
    } catch (e) {
        showStatusMessage('Error saving annotation — check your connection and try again.');
        console.error('Annotation POST error', e);
    }
}

function _appendAddForm(panel, itemID, url, writeAccts, token) {
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'margin-top:8px;border-top:1px solid #e8e8e8;padding-top:6px;';

    const toggle = document.createElement('button');
    toggle.textContent = '+ Add annotation';
    toggle.style.cssText = 'color:#2068ba;font-size:0.8rem;margin-bottom:4px;';

    const form = document.createElement('div');
    form.style.display = 'none';

    const textarea = document.createElement('textarea');
    textarea.placeholder = 'Your annotation…';
    textarea.rows = 3;
    textarea.style.cssText = 'width:100%;box-sizing:border-box;font-size:0.82rem;resize:vertical;margin-bottom:4px;';

    const tagsInput = document.createElement('input');
    tagsInput.type = 'text';
    tagsInput.placeholder = 'Tags (comma-separated, optional)';
    tagsInput.style.cssText = 'width:100%;box-sizing:border-box;font-size:0.82rem;margin-bottom:4px;';

    const visRow = document.createElement('div');
    visRow.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:6px;font-size:0.8rem;color:#555;';

    const visLabel = document.createElement('label');
    visLabel.textContent = 'Visibility:';

    const visSelect = document.createElement('select');
    visSelect.style.cssText = 'font-size:0.8rem;width:auto;padding:2px 4px;margin:0;';
    [['public','Public'],['private','Private']].forEach(([val, text]) => {
        const opt = document.createElement('option');
        opt.value = val;
        opt.textContent = text;
        visSelect.appendChild(opt);
    });

    visRow.appendChild(visLabel);
    visRow.appendChild(visSelect);

    // If multiple write stores, let user pick which one
    let storeSelect = null;
    if (writeAccts.length > 1) {
        const storeLabel = document.createElement('label');
        storeLabel.textContent = 'Store:';
        storeSelect = document.createElement('select');
        storeSelect.style.cssText = 'font-size:0.8rem;width:auto;padding:2px 4px;margin:0;';
        writeAccts.forEach((acct, i) => {
            const opt = document.createElement('option');
            opt.value = i;
            opt.textContent = acct.title || acct.instance;
            storeSelect.appendChild(opt);
        });
        visRow.appendChild(storeLabel);
        visRow.appendChild(storeSelect);
    }

    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:6px;';

    const submitBtn = document.createElement('button');
    submitBtn.textContent = 'Save';
    submitBtn.className = 'btn btn-small';

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.className = 'btn btn-small btn-secondary';

    btnRow.appendChild(submitBtn);
    btnRow.appendChild(cancelBtn);

    form.appendChild(textarea);
    form.appendChild(tagsInput);
    form.appendChild(visRow);
    form.appendChild(btnRow);

    toggle.addEventListener('click', () => {
        const shown = form.style.display === 'block';
        form.style.display = shown ? 'none' : 'block';
        toggle.textContent = shown ? '+ Add annotation' : '− Add annotation';
        if (!shown) textarea.focus();
    });

    cancelBtn.addEventListener('click', () => {
        form.style.display = 'none';
        toggle.textContent = '+ Add annotation';
        textarea.value = '';
        tagsInput.value = '';
    });

    submitBtn.addEventListener('click', async () => {
        const bodyText = textarea.value.trim();
        if (!bodyText) { showStatusMessage('Annotation text is required.'); return; }

        const tags = tagsInput.value.split(',').map(t => t.trim()).filter(Boolean);
        const visibility = visSelect.value;
        const acct = storeSelect ? writeAccts[parseInt(storeSelect.value, 10)] : writeAccts[0];

        submitBtn.disabled = true;
        submitBtn.textContent = 'Saving…';
        await _submitAnnotation(panel, itemID, url, bodyText, tags, visibility, acct, token);
        submitBtn.disabled = false;
        submitBtn.textContent = 'Save';
    });

    wrapper.appendChild(toggle);
    wrapper.appendChild(form);
    panel.appendChild(wrapper);
}

// ── Open write-pane annotation editor ─────────────────────────────────────────

window.clistAnnotate = function(itemId) {
    const el = document.getElementById(itemId);
    if (!el || !el.reference) {
        showStatusMessage('No reference found for this item.');
        return;
    }
    if (typeof currentEditor !== 'undefined' && currentEditor === 'collection') {
        if (typeof window.addItemToCollectionEditor === 'function') {
            window.addItemToCollectionEditor(el.reference);
        }
        return;
    }
    pushReference({ ...el.reference });

    const selection = window.getSelection();
    const selectedText = selection ? selection.toString().trim() : '';
    const textToQuote = selectedText || el.reference.summary || '';
    const isUnknownAuthor = !el.reference.author_name || el.reference.author_name === '(unknown author)';
    const attribution = isUnknownAuthor
        ? (el.reference.feed && el.reference.feed !== '(no feed specified)' ? el.reference.feed : el.reference.service || 'Unknown')
        : el.reference.author_name;
    const content = textToQuote
        ? { type: 'text/plain', value: `${attribution} wrote: "${textToQuote}"\n` }
        : { type: 'text/plain', value: '' };

    if (typeof loadContent === 'function') loadContent(content, itemId);

    if (typeof snapPanes === 'function' && typeof mainContent !== 'undefined' && typeof readPane !== 'undefined') {
        const ratio = readPane.getBoundingClientRect().width / mainContent.getBoundingClientRect().width;
        if (ratio > 0.65) snapPanes('left');
    } else if (typeof mobShowWrite === 'function') {
        mobShowWrite();
    }
};

window.openAnnotationEditor = function(itemId) {
    const el = document.getElementById(itemId);
    if (!el || !el.reference) {
        showStatusMessage('No reference found for this item.');
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
    if (typeof snapPanes === 'function' && typeof mainContent !== 'undefined' && typeof readPane !== 'undefined') {
        const ratio = readPane.getBoundingClientRect().width / mainContent.getBoundingClientRect().width;
        if (ratio > 0.65) snapPanes('left');
    } else if (typeof mobShowWrite === 'function') {
        mobShowWrite();
    }
};

// ── Publish handler ────────────────────────────────────────────────────────────

(function() {
    window.CList.publishers = window.CList.publishers || {};
    window.CList.publishers['Annotate'] = {
        construct: function(title, post) {
            // Extract just the editor body from the packagePost() wrapper
            const parsed = new DOMParser().parseFromString(post, 'text/html');
            const postContent = parsed.getElementById('post-content');
            return postContent ? postContent.innerHTML.trim() : post;
        },
        publish: async function(accountData, title, content) {
            const refs = getReferences();
            if (!refs.length) {
                showStatusMessage('No target — load items into the editor before annotating.');
                return null;
            }

            const token = getSiteSpecificCookie(window.CList.config.flaskSiteUrl, window.CList.keys.ACCESS_TOKEN) || '';
            if (!token) {
                showStatusMessage('Not logged in — cannot post annotation.');
                return null;
            }

            let successCount = 0;
            let failCount = 0;
            let firstId = null;

            for (const ref of refs) {
                if (!ref.url || ref.url === '(no URL provided)') continue;
                const payload = {
                    target_url:      ref.url,
                    target_selector: {
                        title:       ref.title       || '',
                        author_name: ref.author_name || '',
                        feed:        ref.feed        || '',
                        created_at:  ref.created_at  || '',
                        guid:        ref.guid        || '',
                    },
                    body:       content,
                    tags:       window.getWriteTags?.() || [],
                    visibility: 'public',
                    motivation: 'commenting',
                };
                try {
                    const resp = await fetch(`${accountData.instance}/annotations`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Accept': 'application/json',
                            'Authorization': 'Bearer ' + token,
                        },
                        body: JSON.stringify(payload),
                    });
                    if (resp.ok) {
                        const anno = await resp.json();
                        if (!firstId) firstId = anno.id || null;
                        successCount++;
                    } else {
                        const err = await resp.json().catch(() => ({}));
                        if (resp.status === 403 && (err.detail || '').includes('Not registered')) {
                            showStatusMessage('Not registered on this annotation server — please re-add the account in Account Settings.');
                        } else {
                            showStatusMessage('Annotation failed: ' + (err.detail || resp.status));
                        }
                        console.error('Annotation POST failed', resp.status, err, 'for', ref.url);
                        failCount++;
                    }
                } catch (e) {
                    showStatusMessage('Error posting annotation — check your connection and try again.');
                    console.error('Annotation POST error for', ref.url, e);
                    failCount++;
                }
            }

            if (successCount === 0) return null;

            if (successCount === 1) {
                _offerCollectAfterAnnotation(refs[0]).catch(e => console.error('[annotations] offer collect', e));
                // Single item: let the caller display the link in #post-result normally
                return firstId;
            }

            // Convergent: append a link row per item directly into #post-result
            const resultDiv = window.CList.ui.view.postResult;
            if (resultDiv) {
                refs.forEach(ref => {
                    if (!ref.url || ref.url === '(no URL provided)') return;
                    const p = document.createElement('p');
                    p.className = 'feed-status-message';
                    p.innerHTML = `Annotated: <a href="${ref.url}" target="_blank">${ref.url}</a>`;
                    resultDiv.appendChild(p);
                });
            }
            showStatusMessage(`Annotation posted to ${successCount} items (convergent annotation)${failCount ? `, ${failCount} failed` : ''}.`);
            return null;
        }
    };
})();

async function _offerCollectAfterAnnotation(ref) {
    if (!ref?.url || ref.url === '(no URL provided)') return;
    const itemId = ref.statusID || ref.id;
    if (!itemId) return;

    const token = getSiteSpecificCookie(window.CList.config.flaskSiteUrl, window.CList.keys.ACCESS_TOKEN) || '';
    if (!token) return;

    try {
        const encKey = await getEncKey(window.CList.config.flaskSiteUrl);
        if (!encKey) return;
        const resp = await fetch(`${window.CList.config.flaskSiteUrl}/get_kvs/`,
            { headers: { Authorization: 'Bearer ' + token } });
        if (!resp.ok) return;
        const kvs = await resp.json();
        for (const kv of kvs.filter(k => k.key.startsWith('collection:'))) {
            try {
                const items = JSON.parse(await decryptWithKey(encKey, kv.value)) || [];
                if (items.some(i => i.url === ref.url)) return;
            } catch { continue; }
        }
    } catch (e) {
        console.error('[annotations] collection check error', e);
        return;
    }

    // setTimeout(0) lets publish.js complete its synchronous DOM writes to #post-result
    // before we append the collect prompt below them
    setTimeout(() => {
        const resultDiv = window.CList.ui.view.postResult;
        if (!resultDiv || !document.body.contains(resultDiv)) return;

        const prompt = document.createElement('div');
        prompt.style.cssText = 'margin-top:8px;display:flex;align-items:center;gap:8px;';
        const msg = document.createElement('span');
        msg.style.fontSize = '0.85rem';
        msg.textContent = 'Add this item to a collection?';
        const addBtn = document.createElement('button');
        addBtn.className = 'btn';
        addBtn.textContent = 'Add';
        addBtn.addEventListener('click', () => {
            prompt.remove();
            if (typeof window.collectItem === 'function') window.collectItem(itemId, { glow: true });
        });
        prompt.appendChild(msg);
        prompt.appendChild(addBtn);
        resultDiv.appendChild(prompt);
    }, 0);
}

// ── Annotation fetch dispatch ──────────────────────────────────────────────────

// Fetch annotations for one account, dispatching on account type.
async function _fetchAnnotationsForAccount(acct, url) {
    if (acct.type === 'Hypothesis') {
        return typeof window.hypothesisFetch === 'function'
            ? await window.hypothesisFetch(acct, url)
            : [];
    }
    try {
        const resp = await fetch(
            `${acct.instance}/annotations?target=${encodeURIComponent(url)}&limit=50`,
            { headers: { Accept: 'application/json' } }
        );
        if (!resp.ok) {
            console.error('[annotations] fetch returned', resp.status, 'from', acct.instance);
            return [];
        }
        const data = await resp.json();
        return data.items || [];
    } catch (e) {
        console.error('[annotations] fetch error from', acct.instance, e);
        return [];
    }
}



// ── Federated annotation discovery ────────────────────────────────────────────
// Reads the encrypted follows list, fetches each followed user's DID document,
// and returns any AnnotationService endpoints found there.
// Result is cached for 5 minutes so repeated batch checks don't re-fetch DID documents.

let _federatedCache     = null;
let _federatedCacheTime = 0;
const _FEDERATED_TTL    = 5 * 60 * 1000;

let _followedDidsCache     = null;
let _followedDidsCacheTime = 0;

window._clistAnnotateInvalidateFollowCache = function() {
    _followedDidsCache = null;
    _federatedCache    = null;
};

async function _getFederatedAnnotationAccounts() {
    if (_federatedCache && Date.now() - _federatedCacheTime < _FEDERATED_TTL) {
        return _federatedCache;
    }

    const token  = getSiteSpecificCookie(window.CList.config.flaskSiteUrl, window.CList.keys.ACCESS_TOKEN);
    const encKey = token ? await getEncKey(window.CList.config.flaskSiteUrl) : null;
    if (!encKey) { _federatedCache = []; return []; }

    // Fetch all KV pairs and find follow entries
    let kvs = [];
    try {
        const resp = await fetch(`${window.CList.config.flaskSiteUrl}/get_kvs/`,
            { headers: { Authorization: 'Bearer ' + token } });
        if (resp.ok) kvs = await resp.json();
    } catch (e) {
        console.error('Federated annotation: KV fetch failed', e);
    }

    const followKvs = kvs.filter(kv => kv.key.startsWith('social:following:'));

    // Decrypt each follow to get the target DID
    const followedDids = (await Promise.all(followKvs.map(async kv => {
        try {
            const data = JSON.parse(await decryptWithKey(encKey, kv.value));
            return data.did || null;
        } catch { return null; }
    }))).filter(Boolean);

    // For each followed DID, fetch their DID document and extract AnnotationService endpoints
    const seen = new Set();
    const fedAccounts = (await Promise.all(followedDids.map(async did => {
        try {
            const m = did.match(/^did:web:([^:]+):users:(.+)$/);
            if (!m) return [];
            const resp = await fetch(`https://${m[1]}/users/${m[2]}/did.json`,
                { headers: { Accept: 'application/json' } });
            if (!resp.ok) return [];
            const doc = await resp.json();
            return (doc.service || [])
                .filter(s => s.type === 'AnnotationService' && s.serviceEndpoint)
                .map(s => {
                    if (s.serviceEndpoint.includes('hypothes.is')) {
                        const m2 = s.serviceEndpoint.match(/\/users\/([^/]+)$/);
                        if (!m2) return null;
                        return { type: 'Hypothesis', instance: 'https://hypothes.is', username: m2[1], apiKey: '', permissions: 'r', _did: did };
                    }
                    return { instance: s.serviceEndpoint, _did: did };
                })
                .filter(Boolean);
        } catch { return []; }
    }))).flat().filter(acct => {
        const key = acct.type === 'Hypothesis' ? `hypothesis:${acct.username}` : acct.instance;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    _federatedCache     = fedAccounts;
    _federatedCacheTime = Date.now();
    return fedAccounts;
}

// Returns the Set of DIDs the logged-in user is following (from encrypted kvstore entries).
// Cached for the same TTL as the federated cache.
async function _getFollowedDids() {
    if (_followedDidsCache && Date.now() - _followedDidsCacheTime < _FEDERATED_TTL) {
        return _followedDidsCache;
    }
    const token  = getSiteSpecificCookie(window.CList.config.flaskSiteUrl, window.CList.keys.ACCESS_TOKEN);
    const encKey = token ? await getEncKey(window.CList.config.flaskSiteUrl) : null;
    if (!encKey) { _followedDidsCache = new Set(); return _followedDidsCache; }
    let kvs = [];
    try {
        const resp = await fetch(`${window.CList.config.flaskSiteUrl}/get_kvs/`,
            { headers: { Authorization: 'Bearer ' + token } });
        if (resp.ok) kvs = await resp.json();
    } catch (e) { console.error('_getFollowedDids: KV fetch failed', e); }
    const dids = new Set((await Promise.all(
        kvs.filter(kv => kv.key.startsWith('social:following:'))
           .map(async kv => {
               try {
                   const data = JSON.parse(await decryptWithKey(encKey, kv.value));
                   return data.did || null;
               } catch { return null; }
           })
    )).filter(Boolean));
    _followedDidsCache     = dids;
    _followedDidsCacheTime = Date.now();
    return dids;
}
window._getFollowedDids = _getFollowedDids;

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

window.checkAnnotationsBatch = async function() {
    console.log('[annotations] checkAnnotationsBatch called');
    try {
        const allAccounts = await _allAnnotationAccounts();
        if (!allAccounts.length) return;

        const items = Array.from(document.querySelectorAll('.statusSpecific'))
            .filter(el => el.reference && el.reference.url && el.reference.url !== '(no URL provided)');
        console.log('[annotations] batch check: found', items.length, 'items with reference URLs');
        if (!items.length) return;

        const urlToItems = {};
        items.forEach(el => {
            const ref = el.reference;
            // For annotation items, only check the annotation's own ID (guid) — not the source
            // article URL, which would inherit the article's count and cause circular display.
            const urlSet = ref.isAnnotation
                ? (ref.guid && ref.guid !== '(no URL provided)' ? [ref.guid] : [])
                : [ref.url, ...(ref.guid && ref.guid !== ref.url ? [ref.guid] : [])];
            urlSet.forEach(u => {
                if (!urlToItems[u]) urlToItems[u] = [];
                urlToItems[u].push(el);
            });
        });
        const urls = Object.keys(urlToItems);
        console.log('[annotations] batch check: sending', urls.length, 'URLs to server');

        const counts = {};

        // Annotate servers support a true batch endpoint
        const batchAccounts = allAccounts.filter(a => a.type !== 'Hypothesis');
        await Promise.all(batchAccounts.map(async acct => {
            try {
                const resp = await fetch(`${acct.instance}/annotations/batch-check`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                    body: JSON.stringify({ urls }),
                });
                if (resp.ok) {
                    const data = await resp.json();
                    console.log('[annotations] batch check response from', acct.instance, data.results);
                    Object.entries(data.results || {}).forEach(([url, cnt]) => {
                        counts[url] = (counts[url] || 0) + cnt;
                    });
                } else {
                    console.error('[annotations] batch check: server returned', resp.status, 'from', acct.instance);
                }
            } catch (e) {
                console.error('[annotations] batch check error from', acct.instance, e);
            }
        }));

        // Hypothesis has no batch endpoint — check each URL in parallel
        const hypothesisAccts = allAccounts.filter(a => a.type === 'Hypothesis');
        if (hypothesisAccts.length && typeof window.hypothesisBatchCheck === 'function') {
            await Promise.all(hypothesisAccts.map(async acct => {
                try {
                    const hCounts = await window.hypothesisBatchCheck(acct, urls);
                    Object.entries(hCounts).forEach(([url, cnt]) => {
                        counts[url] = (counts[url] || 0) + cnt;
                    });
                } catch (e) {
                    console.error('[annotations] Hypothesis batch check failed:', e);
                }
            }));
        }

        const matchedCount = Object.values(counts).filter(c => c > 0).length;
        console.log('[annotations] batch check: counts for', matchedCount, 'URLs:', counts);

        items.forEach(el => {
            const ref = el.reference;
            const count = ref.isAnnotation
                ? (counts[ref.guid] || 0)
                : (counts[ref.url] || counts[ref.guid] || 0);
            if (!count) return;
            const itemId = el.id;
            if (!itemId) { console.warn('[annotations] item has no id', el); return; }
            const liveEl = document.getElementById(itemId);
            if (!liveEl) { console.warn('[annotations] getElementById returned null for', itemId); return; }
            const statusActions = liveEl.parentElement?.querySelector(':scope > .status-actions');
            if (!statusActions) { console.warn('[annotations] no .status-actions found for', itemId, 'parent:', liveEl.parentElement); return; }
            if (statusActions.querySelector('.anno-read-btn')) return;
            console.log('[annotations] injecting button for', itemId, 'count:', count);
            const btn = document.createElement('button');
            btn.className = 'anno-read-btn';
            btn.title = 'Read annotations';
            btn.innerHTML = `<span class="material-icons md-18">comment</span>&thinsp;(${count})`;
            btn.addEventListener('click', () => window.showAnnotationsForItem(itemId));
            statusActions.appendChild(btn);
        });

        // Inject "Follow feed author" buttons for items whose feed advertises a DID.
        // Runs async after annotation counts so it doesn't block the main check.
        const batchToken = getSiteSpecificCookie(window.CList.config.flaskSiteUrl, window.CList.keys.ACCESS_TOKEN) || '';
        if (batchToken) {
            const batchMyKvDomain = (window.CList.config.flaskSiteUrl || '').replace(/^https?:\/\//, '');
            const batchMyDid = window.CList.state.username
                ? `did:web:${batchMyKvDomain}:users:${window.CList.state.username}` : '';
            const batchFollowedDids = await _getFollowedDids();

            // Collect unique feed URLs from all visible items
            const feedUrlToItems = new Map();
            items.forEach(el => {
                const fu = el.reference?.feedUrl;
                if (!fu) return;
                if (!feedUrlToItems.has(fu)) feedUrlToItems.set(fu, []);
                feedUrlToItems.get(fu).push(el);
            });

            await Promise.all([...feedUrlToItems.entries()].map(async ([fu, els]) => {
                const authorDid = await _getAuthorDidFromFeed(fu);
                if (!authorDid || authorDid === batchMyDid || batchFollowedDids.has(authorDid)) return;
                const authorUsername = authorDid.replace(/^did:web:[^:]+:users:/, '');
                els.forEach(el => {
                    const liveEl = document.getElementById(el.id);
                    if (!liveEl) return;
                    const clistActions = liveEl.closest('.status-box')?.querySelector(':scope > .clist-actions');
                    if (!clistActions || clistActions.querySelector('.anno-follow-author-btn')) return;
                    const followBtn = document.createElement('button');
                    followBtn.className = 'clist-action-btn anno-follow-author-btn';
                    followBtn.title = 'Follow ' + authorUsername;
                    followBtn.innerHTML = '<span class="material-icons md-18 md-light">person_add</span>';
                    followBtn.addEventListener('click', () => {
                        _followUser(authorDid, batchToken, followBtn).catch(e => {
                            showStatusMessage('Follow error: ' + e.message);
                            console.error('Follow error', e);
                        });
                        // Remove buttons for all other items from the same feed
                        document.querySelectorAll('.anno-follow-author-btn').forEach(b => {
                            if (b !== followBtn) { b.disabled = true; b.title = 'Following ' + authorUsername; }
                        });
                    });
                    clistActions.appendChild(followBtn);
                });
            }));
        }
    } catch (e) {
        console.error('[annotations] checkAnnotationsBatch failed:', e);
        showStatusMessage('Annotation check failed: ' + e.message);
    }
};


// ── Annotation thread view (replaces feed contents, restores on close) ────────

let _popstateHandler  = null;
let _savedFeedContent = null;
let _savedScrollTop   = 0;

async function _flowAnnotation(anno, targetUrl, writeAccts, token, btn) {
    const body = anno.body?.value || anno.body || '';
    const creatorId = anno.creator?.id || anno.creator || '';
    const payload = {
        target_url: targetUrl,
        body,
        target_selector: { via: creatorId, via_annotation_id: anno.id || '' },
        tags: Array.isArray(anno.tag) ? anno.tag : [],
        visibility: 'public',
        motivation: 'flowing',
    };
    btn.disabled = true;
    let lastErr = null;
    for (const acct of writeAccts.filter(a => a.type === 'Annotate')) {
        try {
            const resp = await fetch(`${acct.instance}/annotations`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json',
                           'Authorization': 'Bearer ' + token },
                body: JSON.stringify(payload),
            });
            if (resp.ok) {
                btn.innerHTML = '<span class="material-icons md-18 md-light">check</span>';
                showStatusMessage('Annotation flowed to ' + (acct.title || acct.instance));
                return;
            }
            const err = await resp.json().catch(() => ({}));
            console.error('Flow failed on', acct.instance, resp.status, err);
            lastErr = err;
        } catch (e) {
            console.error('Flow error on', acct.instance, e);
            lastErr = { detail: e.message };
        }
    }
    // All accounts tried and failed
    showStatusMessage('Flow failed: ' + (lastErr?.detail || 'no writable annotation store succeeded'));
    console.error('Flow failed on all accounts', lastErr);
    btn.disabled = false;
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

// Fetch the author_did advertised in a feed's metadata via opml2json /feed_meta.
// Uses the configured OPML2JSON account URL if available, falling back to the default.
// Returns a DID string or null. No auth needed — /feed_meta is public.
// Results are cached in-memory for the session to avoid repeated lookups in checkAnnotationsBatch.
const _feedAuthorDidCache = new Map();

async function _getAuthorDidFromFeed(feedUrl) {
    if (!feedUrl || feedUrl === '(no feed specified)') return null;
    if (_feedAuthorDidCache.has(feedUrl)) return _feedAuthorDidCache.get(feedUrl);
    let serviceUrl = 'https://opml2json.downes.ca';
    try {
        const accts = Array.isArray(window.CList.accounts) ? window.CList.accounts : [];
        const found = accts.find(a => {
            const d = parseAccountValue(a);
            return d && d.type === 'OPML2JSON';
        });
        if (found) {
            const d = parseAccountValue(found);
            if (d && d.instance) serviceUrl = d.instance;
        }
    } catch (e) { console.error('_getAuthorDidFromFeed: error reading OPML2JSON account, using default', e); }
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
    _feedAuthorDidCache.set(feedUrl, result);
    return result;
}

async function _followUser(did, token, btn) {
    let encKey;
    try {
        encKey = await getEncKey(window.CList.config.flaskSiteUrl);
    } catch (e) {
        console.error('_followUser: getEncKey failed:', e);
        showStatusMessage('Could not retrieve encryption key — please log in again.');
        return;
    }
    if (!encKey) { showStatusMessage('Encryption key not available — please log in.'); return; }
    const key   = `social:following:${did}`;
    const value = { did, since: new Date().toISOString() };
    btn.disabled = true;
    try {
        const encryptedValue = await encryptWithKey(encKey, JSON.stringify(value));
        const resp = await fetch(`${window.CList.config.flaskSiteUrl}/add_kv/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
            body: JSON.stringify({ key, value: encryptedValue }),
        });
        if (resp.ok || resp.status === 409) {
            btn.innerHTML = '<span class="material-icons md-18 md-light">how_to_reg</span>';
            btn.title = 'Following';
            if (resp.ok) {
                showStatusMessage('Now following ' + did.replace(/^did:web:[^:]+:users:/, ''));
                _followedDidsCache = null;
                _federatedCache    = null;
            }
        } else {
            showStatusMessage('Follow failed (server error ' + resp.status + ') — try again or re-add your account.');
            console.error('Follow failed', resp.status);
            btn.disabled = false;
        }
    } catch (e) {
        showStatusMessage('Error following user — check your connection and try again.');
        console.error('Follow error', e);
        btn.disabled = false;
    }
}

window._followUser = _followUser;

// ── Unified annotation item builder ───────────────────────────────────────────

const _ANNO_BODY_THRESHOLD = 400;

// Builds a first-class feed item for one annotation.
// options.showUrl      — include source-page title/link in statusSpecific (true for showAllAnnotations)
// options.myDid        — logged-in user's DID (no follow/flow buttons on own annotations)
// options.token        — auth token
// options.writeAccts   — write-capable annotation accounts (for Flow)
// options.followedDids — Set of followed DIDs
// options.url          — target URL context for Flow (defaults to anno.target.source)
function _buildAnnotationItem(anno, options = {}) {
    const {
        showUrl      = true,
        myDid        = '',
        token        = '',
        writeAccts   = [],
        followedDids = new Set(),
        url          = '',
    } = options;

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
            followBtn.addEventListener('click', () => _followUser(creatorId, token, followBtn).catch(e => {
                showStatusMessage('Follow error: ' + e.message);
                console.error('Follow error', e);
            }));
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
        created_at:   anno.created || new Date().toISOString(),
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
            expanded = !expanded;
            const s = document.getElementById(`${itemID}-summary`);
            const f = document.getElementById(`${itemID}-content`);
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
        launchBtn.addEventListener('click', () => openInBrowser(sourceUrl));
        statusActions.appendChild(launchBtn);
    }

    // "Read annotations" button injected here by checkAnnotationsBatch when count > 0

    const collectBtn = document.createElement('button');
    collectBtn.className = 'clist-action-btn';
    collectBtn.id = `collect-btn-${itemID}`;
    collectBtn.title = 'Add to collection';
    collectBtn.innerHTML = '<span class="material-icons md-18 md-light">library_add</span>';
    collectBtn.addEventListener('click', () => collectItem(itemID));
    statusActions.appendChild(collectBtn);

    const chatShareBtn = document.createElement('button');
    chatShareBtn.className = 'clist-action-btn chat-only-btn';
    chatShareBtn.title     = 'Share to chat';
    chatShareBtn.innerHTML = '<span class="material-icons md-18 md-light">chat</span>';
    chatShareBtn.addEventListener('click', () => {
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
        flowBtn.addEventListener('click', () => _flowAnnotation(anno, flowUrl, writeAccts, token, flowBtn).catch(e => {
            showStatusMessage('Flow error: ' + e.message);
            console.error('Flow error', e);
        }));
        clistActions.appendChild(flowBtn);
    }

    const annotateBtn = document.createElement('button');
    annotateBtn.className = 'clist-action-btn';
    annotateBtn.id = `anno-btn-${itemID}`;
    annotateBtn.title = 'Write about this';
    annotateBtn.innerHTML = '<span class="material-icons md-18 md-light">arrow_forward</span>';
    annotateBtn.addEventListener('click', () => clistAnnotate(itemID));
    clistActions.appendChild(annotateBtn);

    statusContent.appendChild(statusSpecific);
    statusContent.appendChild(statusActions);
    statusBox.appendChild(statusContent);
    statusBox.appendChild(clistActions);

    return statusBox;
}

window.showAnnotationsForItem = async function(itemId) {
    const el = document.getElementById(itemId);
    if (!el || !el.reference) return;
    const fc = window.CList.ui.view.feedContainer;
    if (!fc) return;

    try {
    const url  = el.reference.url;
    const guid = el.reference.guid;
    const checkUrls = guid && guid !== url ? [url, guid] : [url];

    const token = getSiteSpecificCookie(window.CList.config.flaskSiteUrl, window.CList.keys.ACCESS_TOKEN) || '';
    const annotateAccounts = (window.CList.accounts || [])
        .map(a => parseAccountValue(a))
        .filter(d => d && d.type === 'Annotate' && d.instance);
    const writeAccts = token
        ? annotateAccounts.filter(a => (a.permissions || 'rw').includes('w'))
        : [];

    // Compute logged-in user's DID here (before forEach where `username` would be shadowed)
    const myKvDomain = (window.CList.config.flaskSiteUrl || '').replace(/^https?:\/\//, '');
    const myDid = window.CList.state.username
        ? `did:web:${myKvDomain}:users:${window.CList.state.username}` : '';

    const followedDids = await _getFollowedDids();

    // Fetch all annotations for this URL (local + federated servers)
    const rawAnnotations = [];
    await Promise.all((await _allAnnotationAccounts()).map(async acct => {
        try {
            await Promise.all(checkUrls.map(async u => {
                const items = await _fetchAnnotationsForAccount(acct, u);
                rawAnnotations.push(...items);
            }));
        } catch (e) {
            console.error('[annotations] fetch error from', acct.instance, e);
        }
    }));
    const seen = new Set();
    const allAnnotations = rawAnnotations.filter(a => {
        const id = a.id || JSON.stringify(a);
        if (seen.has(id)) return false;
        seen.add(id); return true;
    });

    // When logged in: show only own annotations + annotations from followed users.
    // acct: creators (Hypothesis) are pre-filtered by hypothesisFetch to own + followed, so pass them through.
    // When not logged in: show all (federated set is empty anyway, so these are just local public annotations).
    const displayAnnotations = token
        ? allAnnotations.filter(a => {
              const c = a.creator?.id || a.creator || '';
              return (myDid && c === myDid) || followedDids.has(c) || c.startsWith('acct:');
          })
        : allAnnotations;

    // Correct the button count to match what will actually render
    const liveEl = document.getElementById(itemId);
    if (liveEl) {
        const btn = liveEl.parentElement?.querySelector(':scope > .status-actions .anno-read-btn');
        if (btn) btn.innerHTML = `<span class="material-icons md-18">comment</span>&thinsp;(${displayAnnotations.length})`;
    }

    // Save the current feed and scroll position
    _savedScrollTop   = fc.scrollTop;
    _savedFeedContent = document.createDocumentFragment();
    while (fc.firstChild) _savedFeedContent.appendChild(fc.firstChild);

    // Header with close button
    const header = document.createElement('div');
    header.className = 'annotation-thread-header';
    const closeBtn = document.createElement('button');
    closeBtn.className = 'annotation-thread-close';
    closeBtn.textContent = '✕';
    closeBtn.title = 'Close';
    closeBtn.addEventListener('click', window.closeAnnotationThread);
    const heading = document.createElement('span');
    heading.textContent = displayAnnotations.length
        ? `${displayAnnotations.length} annotation${displayAnnotations.length === 1 ? '' : 's'} for this item`
        : 'Annotations';
    header.appendChild(closeBtn);
    header.appendChild(heading);
    fc.appendChild(header);

    // Async: if the feed advertises a DID and we're not already following, offer a Follow button
    const feedUrl = el.reference?.feedUrl;
    if (feedUrl && token) {
        _getAuthorDidFromFeed(feedUrl).then(authorDid => {
            if (!authorDid || authorDid === myDid || followedDids.has(authorDid)) return;
            const authorUsername = authorDid.replace(/^did:web:[^:]+:users:/, '');
            const banner = document.createElement('div');
            banner.className = 'annotation-feed-author-banner';
            const label = document.createElement('span');
            label.textContent = `Feed author: ${authorUsername}`;
            const followBtn = document.createElement('button');
            followBtn.className = 'clist-action-btn';
            followBtn.title = 'Follow this person';
            followBtn.innerHTML = '<span class="material-icons md-18 md-light">person_add</span> Follow';
            followBtn.addEventListener('click', () => {
                _followUser(authorDid, token, followBtn).catch(e => {
                    showStatusMessage('Follow error: ' + e.message);
                    console.error('Follow error', e);
                });
                label.textContent = 'Following ' + authorUsername;
            });
            banner.appendChild(label);
            banner.appendChild(followBtn);
            const headerEl = fc.querySelector('.annotation-thread-header');
            if (headerEl && headerEl.nextSibling) {
                fc.insertBefore(banner, headerEl.nextSibling);
            } else {
                fc.appendChild(banner);
            }
        }).catch(e => console.warn('Feed author DID lookup failed:', e));
    }

    // Original item (cloned, stripped of action buttons)
    const original = el.closest('.status-box');
    if (original) {
        const clone = original.cloneNode(true);
        clone.querySelectorAll('.status-actions, .clist-actions').forEach(n => n.remove());
        fc.appendChild(clone);
    }

    // Annotations list
    if (!displayAnnotations.length) {
        const empty = document.createElement('p');
        empty.className = 'feed-status-message';
        empty.textContent = token
            ? 'No annotations from people you follow.'
            : 'No public annotations found for this item.';
        fc.appendChild(empty);
    } else {
        displayAnnotations.forEach(anno => {
            fc.appendChild(_buildAnnotationItem(anno, {
                showUrl: false,
                myDid,
                token,
                writeAccts,
                followedDids,
                url,
            }));
        });
        checkAnnotationsBatch();
    }

    fc.scrollTop = 0;

    // Browser back button support
    history.pushState({ annotationThread: true, itemId }, '');
    _popstateHandler = function(e) {
        if (e.state && e.state.annotationThread) return;
        window.closeAnnotationThread();
    };
    window.addEventListener('popstate', _popstateHandler);
    } catch (e) {
        console.error('[annotations] showAnnotationsForItem failed:', e);
        if (_savedFeedContent) {
            while (fc.firstChild) fc.removeChild(fc.firstChild);
            fc.appendChild(_savedFeedContent);
            fc.scrollTop = _savedScrollTop;
            _savedFeedContent = null;
        }
        showStatusMessage('Failed to load annotation thread: ' + e.message);
    }
};

window.closeAnnotationThread = function() {
    const fc = window.CList.ui.view.feedContainer;
    if (_savedFeedContent) {
        while (fc.firstChild) fc.removeChild(fc.firstChild);
        fc.appendChild(_savedFeedContent);
        fc.scrollTop = _savedScrollTop;
        _savedFeedContent = null;
    }
    if (_popstateHandler) {
        window.removeEventListener('popstate', _popstateHandler);
        _popstateHandler = null;
    }
};

// ── Annotation feed ────────────────────────────────────────────────────────────

// Render one annotation as a feed item using the same DOM shape as makeListing.
// reference.url is set to the source page so clistAnnotate loads the right target.
// Fetch recent annotations for one account. Returns W3C annotation objects.
async function _fetchAnnotationFeedForAccount(acct, since) {
    if (acct.type === 'Hypothesis') {
        return typeof window.hypothesisFeedFetch === 'function'
            ? await window.hypothesisFeedFetch(acct, since) : [];
    }
    const creatorDid = acct._did || (
        window.CList.state.username && window.CList.config.flaskSiteUrl
            ? `did:web:${window.CList.config.flaskSiteUrl.replace(/^https?:\/\//, '')}:users:${window.CList.state.username}`
            : null
    );
    if (!creatorDid || !acct.instance) return [];
    try {
        const params = new URLSearchParams({ creator: creatorDid, limit: 50 });
        if (since) params.set('since', since);
        const resp = await fetch(`${acct.instance}/annotations?${params}`,
            { headers: { Accept: 'application/json' } });
        if (!resp.ok) {
            console.error('[annotationfeed] server returned', resp.status, 'for', acct.instance);
            return [];
        }
        return (await resp.json()).items || [];
    } catch (e) {
        console.error('[annotationfeed] fetch error from', acct.instance, e);
        return [];
    }
}

// Show a feed of recent annotations from self + all followed users.
window.showAnnotations = async function showAnnotations(filter) {
    const feedContainer = window.CList.ui.view.feedContainer;
    feedContainer.innerHTML = '<p class="feed-status-message">Loading annotations…</p>';

    let allAccounts;
    try {
        allAccounts = await _allAnnotationAccounts();
    } catch (e) {
        console.error('[annotationfeed] could not load accounts', e);
        showServiceError('feed-container', 'Annotation feed error', e.message,
            'Check your annotation account settings under <strong>Accounts</strong>.');
        return;
    }

    if (!allAccounts.length) {
        feedContainer.innerHTML = '<p class="feed-status-message">No annotation accounts configured.</p>';
        return;
    }

    const token      = getSiteSpecificCookie(window.CList.config.flaskSiteUrl, window.CList.keys.ACCESS_TOKEN) || '';
    const myKvDomain = (window.CList.config.flaskSiteUrl || '').replace(/^https?:\/\//, '');
    const myDid      = window.CList.state.username
        ? `did:web:${myKvDomain}:users:${window.CList.state.username}` : '';

    const since   = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const results = await Promise.all(allAccounts.map(a => _fetchAnnotationFeedForAccount(a, since)));

    const seen = new Set();
    let unique = results.flat()
        .filter(a => { if (seen.has(a.id)) return false; seen.add(a.id); return true; })
        .sort((a, b) => new Date(b.created) - new Date(a.created));

    if (filter === 'my') unique = unique.filter(a => (a.creator?.id || a.creator) === myDid);

    feedContainer.innerHTML = '';
    if (!unique.length) {
        const msg = filter === 'my' ? 'No annotations by you in the last 14 days.' : 'No annotations in the last 14 days.';
        feedContainer.innerHTML = `<p class="feed-status-message">${msg}</p>`;
        return;
    }

    const annotateAccts = (window.CList.accounts || [])
        .map(a => parseAccountValue(a))
        .filter(d => d && d.type === 'Annotate' && d.instance);
    const writeAccts   = token
        ? annotateAccts.filter(a => (a.permissions || 'rw').includes('w'))
        : [];
    const followedDids = await _getFollowedDids();

    for (const anno of unique) {
        feedContainer.appendChild(_buildAnnotationItem(anno, {
            showUrl: true, myDid, token, writeAccts, followedDids,
        }));
    }
    checkAnnotationsBatch();
};

// Collections are in collections.js
