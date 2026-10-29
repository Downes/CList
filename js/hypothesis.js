//  hypothesis.js  -  Hypothes.is annotation account type for CList
//  Part of CList, the next generation of learning and connecting with your community
//
//  Copyright Stephen Downes 2025, downes.ca
//  Licensed under Creative Commons Attribution 4.0 International https://creativecommons.org/licenses/by/4.0/
//
//  This software carries NO WARRANTY OF ANY KIND.
//  This software is provided "AS IS," and you, its user, assume all risks when using it.

window.CList.schemas = window.CList.schemas || {};
window.CList.schemas['Hypothesis'] = {
    type: 'Hypothesis',
    instanceFromKey: true,
    kvKey: { label: 'Server', placeholder: 'https://hypothes.is', default: 'https://hypothes.is' },
    fields: [
        { key: 'title',       label: 'Title',       editable: true, inputType: 'text', placeholder: 'Hypothes.is',              default: 'Hypothes.is' },
        { key: 'username',    label: 'Username',    editable: true, inputType: 'text', placeholder: 'Your Hypothes.is username', default: '' },
        { key: 'apiKey',      label: 'API Key',     editable: true, inputType: 'text', placeholder: 'Your personal API token',   default: '' },
        { key: 'permissions', label: 'Permissions', editable: true, inputType: 'text', placeholder: 'rw',                       default: 'rw' },
    ]
};

// ── Translation ────────────────────────────────────────────────────────────────

// Convert a Hypothes.is API row to the W3C annotation shape CList's render
// functions expect. creator.id is set to the acct: URI here; hypothesisFetch
// replaces it with the DID when the mapping is known.
function _hypothesisToW3c(row) {
    const user = row.user || '';
    const nameMatch = user.match(/^acct:([^@]+)@/);
    const displayName = nameMatch ? nameMatch[1] : user;

    return {
        '@context': 'http://www.w3.org/ns/anno.jsonld',
        id:         row.links?.html || `https://hypothes.is/a/${row.id}`,
        type:       'Annotation',
        motivation: (row.references && row.references.length) ? 'replying' : 'commenting',
        creator: {
            id:   user,
            type: 'Person',
            name: displayName,
        },
        created:  row.created || null,
        modified: row.updated || null,
        body: {
            type:   'TextualBody',
            value:  row.text || '',
            format: 'text/markdown',
        },
        target: {
            source:   row.uri || row.target?.[0]?.source || '',
            selector: row.target?.[0]?.selector || null,
        },
        tag: Array.isArray(row.tags) ? row.tags : [],
    };
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function _hypothesisApiBase(server) {
    try {
        const url = new URL(server);
        if (url.hostname === 'hypothes.is') return 'https://api.hypothes.is/api';
        return server.replace(/\/$/, '') + '/api';
    } catch {
        return 'https://api.hypothes.is/api';
    }
}

function _hypothesisHeaders(acct) {
    const h = { Accept: 'application/json' };
    if (acct.apiKey) h['Authorization'] = `Bearer ${acct.apiKey}`;
    return h;
}

// Collect acct: URIs to query for a given account: own username + followed users
// whose DID documents advertise a Hypothes.is AnnotationService entry.
// Returns a Map<acctUri, did> so callers can replace acct: creator IDs with DIDs.
async function _hypothesisCollectUsers(acct) {
    const host    = new URL(acct.instance).hostname;
    const userMap = new Map(); // acct:URI → DID ('' if own DID can't be determined)

    if (acct.username) {
        const safeUser = acct.username.split('@')[0];  // strip accidental @host suffix
        const acctUri = `acct:${safeUser}@${host}`;
        let ownerDid;
        if (acct._did) {
            // Federated pseudo-account — the DID was stored when the pseudo-account was created
            ownerDid = acct._did;
        } else {
            // Configured own account — derive from logged-in user's kvstore identity
            const myDomain = (typeof window.CList.config.flaskSiteUrl !== 'undefined' && window.CList.config.flaskSiteUrl)
                ? window.CList.config.flaskSiteUrl.replace(/^https?:\/\//, '') : '';
            const myUser = window.CList.state.username || '';
            ownerDid = myDomain && myUser ? `did:web:${myDomain}:users:${myUser}` : '';
        }
        userMap.set(acctUri, ownerDid);
    }

    if (acct.apiKey && typeof window._getFollowedDids === 'function') {
        const followedDids = await window._getFollowedDids();
        await Promise.all([...followedDids].map(async did => {
            try {
                const m = did.match(/^did:web:([^:]+):users:(.+)$/);
                if (!m) return;
                const resp = await fetch(`https://${m[1]}/users/${m[2]}/did.json`,
                    { headers: { Accept: 'application/json' } });
                if (!resp.ok) return;
                const doc = await resp.json();
                (doc.service || [])
                    .filter(s => s.type === 'AnnotationService' &&
                                 s.serviceEndpoint &&
                                 s.serviceEndpoint.includes('hypothes.is'))
                    .forEach(s => {
                        const m2 = s.serviceEndpoint.match(/\/users\/([^/]+)$/);
                        if (m2) userMap.set(`acct:${m2[1]}@${host}`, did);
                    });
            } catch (e) {
                console.error('[hypothesis] DID doc fetch failed for', did, e);
            }
        }));
    }
    return userMap;
}

// ── Read ───────────────────────────────────────────────────────────────────────

// Fetch annotations for a URL from a Hypothesis account. Queries for the
// logged-in user's own annotations plus annotations from followed users whose
// DID documents advertise a Hypothes.is AnnotationService entry.
window.hypothesisFetch = async function(acct, url) {
    const apiBase = _hypothesisApiBase(acct.instance);
    const host    = new URL(acct.instance).hostname;
    const userMap = await _hypothesisCollectUsers(acct);

    if (!userMap.size) return [];

    const headers = _hypothesisHeaders(acct);

    const rows = [];
    await Promise.all([...userMap.keys()].map(async user => {
        try {
            const params = new URLSearchParams({ uri: url, user, limit: 50 });
            const resp = await fetch(`${apiBase}/search?${params}`, { headers });
            if (resp.ok) {
                const data = await resp.json();
                rows.push(...(data.rows || []));
            } else {
                console.error('[hypothesis] search returned', resp.status, 'for', user);
                showErrorModal(`Hypothes.is: could not load annotations (HTTP ${resp.status}) — check your API key under Accounts.`, { title: 'Could Not Load Annotations' });
            }
        } catch (e) {
            console.error('[hypothesis] search error for', user, e);
        }
    }));

    // Deduplicate (same annotation could appear from multiple followed users)
    const seen = new Set();
    return rows
        .filter(r => { if (seen.has(r.id)) return false; seen.add(r.id); return true; })
        .map(row => {
            const anno = _hypothesisToW3c(row);
            // Replace acct: creator with the DID so downstream display and follow logic
            // treats Hypothesis annotations the same as native W3C annotations.
            const did = userMap.get(row.user || '');
            if (did) {
                anno._sourceCreatorId = anno.creator.id;  // keep acct: URI for hover
                anno.creator.id       = did;
                anno.creator.name     = did.replace(/^did:web:[^:]+:users:/, '');
            }
            // Tag the source service so the display can show "hypothes.is" even after
            // the creator.id has been replaced with a DID.
            anno._sourceService = host;
            return anno;
        });
};

// ── Batch check ────────────────────────────────────────────────────────────────

// Check a list of URLs for annotation counts across own + followed users.
// Uses limit=1 per request (existence check only). Returns { url: totalCount }.
window.hypothesisBatchCheck = async function(acct, urls) {
    const apiBase = _hypothesisApiBase(acct.instance);
    const userMap = await _hypothesisCollectUsers(acct);
    if (!userMap.size || !urls.length) return {};

    const headers = _hypothesisHeaders(acct);

    const counts = {};
    await Promise.all(urls.flatMap(url =>
        [...userMap.keys()].map(async user => {
            try {
                const params = new URLSearchParams({ uri: url, user, limit: 1 });
                const resp = await fetch(`${apiBase}/search?${params}`, { headers });
                if (resp.ok) {
                    const data = await resp.json();
                    if ((data.total || 0) > 0) counts[url] = (counts[url] || 0) + data.total;
                } else {
                    console.error('[hypothesis] batch check returned', resp.status, 'for', user, url);
                }
            } catch (e) {
                console.error('[hypothesis] batch check error for', url, user, e);
            }
        })
    ));
    return counts;
};

// ── Feed ───────────────────────────────────────────────────────────────────────

// Fetch recent annotations by own + followed users without filtering by URL.
// Used by showAnnotationFeed. Returns W3C annotation objects.
window.hypothesisFeedFetch = async function(acct, since) {
    const apiBase = _hypothesisApiBase(acct.instance);
    const host    = new URL(acct.instance).hostname;
    const userMap = await _hypothesisCollectUsers(acct);
    if (!userMap.size) return [];

    const headers = _hypothesisHeaders(acct);
    const rows    = [];

    await Promise.all([...userMap.keys()].map(async user => {
        try {
            const params = new URLSearchParams({ user, limit: 50, sort: 'created', order: 'desc' });
            const resp   = await fetch(`${apiBase}/search?${params}`, { headers });
            if (resp.ok) {
                const items = (await resp.json()).rows || [];
                rows.push(...(since ? items.filter(r => r.created >= since) : items));
            } else {
                console.error('[hypothesis] feed fetch returned', resp.status, 'for', user);
            }
        } catch (e) {
            console.error('[hypothesis] feed fetch error for', user, e);
        }
    }));

    const seen = new Set();
    return rows
        .filter(r => { if (seen.has(r.id)) return false; seen.add(r.id); return true; })
        .map(row => {
            const anno = _hypothesisToW3c(row);
            const did  = userMap.get(row.user || '');
            if (did) {
                anno._sourceCreatorId = anno.creator.id;
                anno.creator.id       = did;
                anno.creator.name     = did.replace(/^did:web:[^:]+:users:/, '');
            }
            anno._sourceService = host;
            return anno;
        });
};

// ── Write ──────────────────────────────────────────────────────────────────────

// Post a new annotation to Hypothes.is. payload matches the CList annotation
// editor output: { target_url, body, tags, visibility }.
// Returns the created annotation translated to W3C shape, or throws on failure.
window.hypothesisCreate = async function(acct, payload) {
    const apiBase = _hypothesisApiBase(acct.instance);
    const host     = new URL(acct.instance).hostname;
    const safeUser = acct.username.split('@')[0];  // strip accidental @host suffix
    const userUri  = `acct:${safeUser}@${host}`;

    const body = {
        uri:    payload.target_url,
        text:   payload.body || '',
        tags:   payload.tags || [],
        group:  '__world__',
        permissions: {
            read:   payload.visibility === 'private' ? [userUri] : ['group:__world__'],
            update: [userUri],
            delete: [userUri],
            admin:  [userUri],
        },
        target:     [{ source: payload.target_url }],
        document:   {},
        references: [],
    };

    const resp = await fetch(`${apiBase}/annotations`, {
        method:  'POST',
        headers: {
            'Content-Type':  'application/json',
            'Accept':        'application/json',
            'Authorization': `Bearer ${acct.apiKey}`,
        },
        body: JSON.stringify(body),
    });

    if (!resp.ok) {
        const err = await resp.text().catch(() => resp.status);
        throw new Error(`Hypothesis POST failed: ${err}`);
    }

    const data = await resp.json();
    return _hypothesisToW3c(data);
};

// ── Publish handler ────────────────────────────────────────────────────────────

(function () {
    window.CList.publishers = window.CList.publishers || {};
    window.CList.publishers['Hypothesis'] = {
        construct: function(title, post) {
            const parsed = new DOMParser().parseFromString(post, 'text/html');
            const postContent = parsed.getElementById('post-content');
            const raw = postContent ? postContent.innerHTML.trim() : post;
            return typeof sanitizeHtml === 'function' ? sanitizeHtml(raw).toString() : raw;
        },
        publish: async function(accountData, title, content) {
            if (!accountData.apiKey) {
                showErrorModal('No API key — add your Hypothes.is API token in Account Settings.', { title: 'API Key Missing' });
                return null;
            }

            const refs = getReferences();
            if (!refs.length) {
                showErrorModal('No target — load items into the editor before annotating.', { title: 'No Target Selected' });
                return null;
            }

            let successCount = 0, failCount = 0, firstId = null;

            for (const ref of refs) {
                if (!ref.url || ref.url === '(no URL provided)') continue;
                try {
                    const anno = await window.hypothesisCreate(accountData, {
                        target_url: ref.url,
                        body:       content,
                        tags:       [],
                        visibility: 'public',
                    });
                    if (!firstId) firstId = anno?.id || null;
                    successCount++;
                } catch (e) {
                    showErrorModal('Hypothesis post failed: ' + e.message, { title: 'Annotation Post Failed' });
                    console.error('[hypothesis] publish error for', ref.url, e);
                    failCount++;
                }
            }

            if (successCount === 0) return null;

            if (successCount === 1) return firstId;

            const resultDiv = window.CList.ui.view.postResult;
            if (resultDiv) {
                refs.forEach(ref => {
                    if (!ref.url || ref.url === '(no URL provided)') return;
                    const p = document.createElement('p');
                    p.className = 'feed-status-message';
                    const a = document.createElement('a');
                    a.target = '_blank';
                    a.textContent = ref.url;
                    if (/^https?:\/\//i.test(ref.url)) a.href = ref.url;
                    p.append('Annotated: ', a);
                    resultDiv.appendChild(p);
                });
            }
            if (failCount) {
                showErrorModal(`Annotation posted to ${successCount} items, ${failCount} failed.`, { title: 'Some annotations failed' });
            } else {
                showStatusMessage(`Annotation posted to ${successCount} items.`);
            }
            return null;
        }
    };
})();
