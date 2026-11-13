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
    window.CList.schemas = window.CList.schemas || {};
    window.CList.schemas.PublicFeed = {
        type: 'PublicFeed',
        instanceFromKey: true,
        kvKey: { label: 'Account Name', placeholder: 'Public collection' },
        fields: [
            { key: 'title', label: 'Title', editable: true, inputType: 'text', default: '' },
            { key: 'permissions', label: 'Permissions', editable: false, inputType: 'text', default: 'r' },
            { key: 'serviceUrl', label: 'Collection Service URL', editable: true, inputType: 'text', default: window.CList.defaults.LOCALRSS },
            { key: 'collectionSlug', label: 'Collection', editable: true, inputType: 'text', default: '' },
            { key: 'database', inputType: 'hidden', default: '' },
            { key: 'collectionItems', inputType: 'hidden', default: '' },
            { key: 'collectionId', inputType: 'hidden', default: '' },
        ],
    };
    window.CList.readers = window.CList.readers || {};
    window.CList.readers['PublicFeed'] = {
        name: 'PublicFeed', display: 'Feeds', icon: 'public',
        description: 'Read public, curated RSS collections',
        type: 'feed',
        initialize: async accountData => {
            await loadPublicFeed(accountData.collectionSlug, accountData.title, accountData.serviceUrl, accountData.database);
        },
        feedFunctions: {},
        editCollection: async (key, account) => {
            const personal = await ensurePersonalPublicFeedAccount(key, account);
            await openPublicFeedCollection(key, personal);
        },
        saveCollection: (request, session) => savePublicFeedCollection(request.feedAccount,
            request.name, request.items, request.identity.id, session.token, session.encKey),
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

// Admin-configurable via defaults.js (see defaults.js, index.html) -- the
// server admin can point logged-out visitors' public collections at a
// different LocalRSS instance without editing this file.
const PUBLIC_FEEDS_BASE_URL = window.CList.defaults.LOCALRSS;

// Companion service repositories documented in README.md.
const PUBLIC_CHANGELOG_FEEDS = [
    { slug: 'clist-changelog', title: 'CList Changelog', repo: 'CList', summary: 'Changes to CList, the browser application for reading, writing, publishing, and collaboration.' },
    { slug: 'localrss-changelog', title: 'LocalRSS Changelog', repo: 'localrss_reader', summary: 'Changes to LocalRSS, the feed harvesting service and RSS collection reader.' },
    { slug: 'proxyp-changelog', title: 'proxyp Changelog', repo: 'proxyp', summary: 'Changes to proxyp, the cross-domain HTTP relay used by CList.' },
    { slug: 'kvstore-changelog', title: 'kvstore Changelog', repo: 'kvstore', summary: 'Changes to kvstore, the credential storage and identity service used by CList.' },
    { slug: 'discussions-changelog', title: 'Discussions Changelog', repo: 'Discussions', summary: 'Changes to Discussions, the peer discovery and signaling service for CList chat.' },
    { slug: 'collab-changelog', title: 'collab Changelog', repo: 'collab', summary: 'Changes to collab, the collaborative editing service for rich text and LaTeX.' },
    { slug: 'latex-compile-changelog', title: 'latex_compile Changelog', repo: 'latex_compile', summary: 'Changes to latex_compile, the service that compiles LaTeX documents into PDF.' },
    { slug: 'opml2json-changelog', title: 'opml2json Changelog', repo: 'opml2json', summary: 'Changes to opml2json, the OPML parsing and feed aggregation service.' },
].map(feed => ({ ...feed, author_name: 'Stephen Downes', url: `https://github.com/Downes/${feed.repo}`, feed: `https://github.com/Downes/${feed.repo}/commits.atom` }));

// Fill older collection entries too, without adding back removed feeds or
// replacing the user's entry order and descriptions.
function publicChangelogCollectionItems(items) {
    return items.map(item => {
        const source = PUBLIC_CHANGELOG_FEEDS.find(feed => feed.feed === item.feed || feed.feed === item.url || feed.url === item.url);
        return source ? {
            ...item, url: !item.url || item.url === source.feed ? source.url : item.url,
            author_name: source.author_name,
            feed: item.feed || source.feed, summary: item.summary || source.summary,
        } : { ...item };
    });
}

// Called only after a successful new-user registration and login. These are
// ordinary encrypted accounts, not defaults that get restored on later logins.
async function seedPublicFeedAccounts() {
    const encKey = await getEncKey(window.CList.config.flaskSiteUrl);
    if (!encKey) throw new Error('Encryption key not available');
    const existing = new Set((await window.CList.storage.kv.list()).map(account => account.key));
    async function addCollection(slug, title) {
        const key = `public-feed:${PUBLIC_FEEDS_BASE_URL}:${slug}`;
        if (existing.has(key)) return;
        const account = {
            type: 'PublicFeed', title, permissions: 'r',
            serviceUrl: PUBLIC_FEEDS_BASE_URL, collectionSlug: slug,
        };
        const encrypted = await encryptWithKey(encKey, JSON.stringify(account));
        await window.CList.storage.kv.add(key, encrypted);
        existing.add(key);
    }
    await addCollection('clist-changelog', 'CList Changelog');
    const response = await fetch(`${PUBLIC_FEEDS_BASE_URL}/api/collections`);
    if (!response.ok) throw new Error(`Could not discover public collections (HTTP ${response.status})`);
    const collections = await response.json();
    if (!Array.isArray(collections)) throw new Error('Unexpected public collections response');
    for (const collection of collections) {
        if (!collection.slug) continue;
        await addCollection(collection.slug, collection.title || collection.slug);
    }
}

function _publicFeedPlainText(html) {
    const d = document.createElement('div');
    d.innerHTML = html || '';
    return d.textContent || '';
}

// Fetches the list of available public collections and renders a clickable
// list into container (a DOM element). Idempotent — safe to call more than once.
async function renderPublicFeedsList(container) {
    if (!container) return;
    container.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.id = 'public-feeds-list';
    container.appendChild(wrap);
    const changelog = document.createElement('button');
    changelog.className = 'account-button';
    const icon = document.createElement('span');
    icon.className = 'material-icons';
    icon.textContent = 'public';
    const label = document.createElement('span');
    label.textContent = 'CList Changelog';
    changelog.append(icon, label);
    changelog.onclick = () => loadPublicFeed('clist-changelog', 'CList Changelog');
    wrap.appendChild(changelog);
    try {
        const res = await fetch(`${PUBLIC_FEEDS_BASE_URL}/api/collections`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const collections = await res.json();

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
        showServiceError(container, 'Could not load public feed collections', err.message);
    }
}

// Fetches items for one public collection and renders them into #feed-container
// using the standard makeListing() format.
async function loadPublicFeed(slug, title, serviceUrl = PUBLIC_FEEDS_BASE_URL, database = '') {
    const fc = window.CList.ui.view.feedContainer;
    if (!fc) return;
    fc.innerHTML = '';
    fc.appendChild(createFeedHeader(title || slug));

    try {
        let items;
        if (database) {
            const res = await publicFeedAccountRequest(serviceUrl,
                `/api/items?db=${encodeURIComponent(database)}&filter=all&limit=200`);
            items = await res.json();
            if (!Array.isArray(items)) throw new Error('Unexpected feed response');
            if (slug === 'clist-changelog') {
                items = items.map(item => ({ ...item, author: 'Stephen Downes' }));
                items.sort((a, b) => b.published - a.published);
            }
        } else if (slug === 'clist-changelog') {
            const results = await Promise.allSettled(PUBLIC_CHANGELOG_FEEDS.map(async feed => {
                const res = await fetch(`https://api.github.com/repos/Downes/${feed.repo}/commits`);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();
                if (!Array.isArray(data)) throw new Error('Unexpected feed response');
                return data.map(entry => {
                    const message = entry.commit?.message || '';
                    return {
                        id: `${feed.repo}:${entry.sha}`,
                        link: entry.html_url,
                        title: message.split(/\r?\n/)[0],
                        content_html: escapeHtml(message).replace(/\r?\n/g, '<br>'),
                        feed_title: feed.title,
                        author: feed.author_name,
                        published: Date.parse(entry.commit?.author?.date) / 1000 || 0,
                    };
                });
            }));
            items = [];
            results.forEach((result, index) => {
                if (result.status === 'fulfilled') {
                    items.push(...result.value);
                } else {
                    const feed = PUBLIC_CHANGELOG_FEEDS[index];
                    console.error('Could not load changelog:', feed.repo, result.reason);
                    showServiceError(fc, `Could not load ${feed.title}`, result.reason.message);
                }
            });
            items.sort((a, b) => b.published - a.published);
            if (results.every(result => result.status === 'rejected')) return;
        } else {
            const res = await fetch(`${serviceUrl.replace(/\/$/, '')}/api/collections/${encodeURIComponent(slug)}/items?limit=200`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            items = await res.json();
            if (!Array.isArray(items)) throw new Error('Unexpected feed response');
        }

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
