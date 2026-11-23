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
        statusActions: () => '',
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

// Shared captured descriptors/discovery for registration seeding and the compatibility helper.
function publicFeedSetupAccount(base, slug, title) {
    return {key:`public-feed:${base}:${slug}`,label:title,data:{type:'PublicFeed',title,permissions:'r',serviceUrl:base,collectionSlug:slug}};
}
async function discoverPublicFeedSetup(base, deps) {
    deps.assertCurrent();const response=await deps.fetch(`${base}/api/collections`);deps.assertCurrent();
    if(!response.ok)throw new Error(`Could not discover public collections (HTTP ${response.status})`);
    const collections=await response.json();deps.assertCurrent();
    if(!Array.isArray(collections))throw new Error('Unexpected public collections response');
    return collections.filter(collection=>collection&&typeof collection.slug==='string'&&collection.slug).map(collection=>publicFeedSetupAccount(base,collection.slug,typeof collection.title==='string'&&collection.title?collection.title:collection.slug));
}
// Existing standalone callers retain their Promise contract. Post-login setup uses explicit deps.
async function seedPublicFeedAccounts() {
    const encKey=await getEncKey(window.CList.config.flaskSiteUrl);
    if(!encKey)throw new Error('Encryption key not available');
    const existing=new Set((await window.CList.storage.kv.list()).map(account=>account.key));
    const add=async descriptor=>{
        if(existing.has(descriptor.key))return;
        const encrypted=await encryptWithKey(encKey,JSON.stringify(descriptor.data));
        await window.CList.storage.kv.add(descriptor.key,encrypted);existing.add(descriptor.key);
    };
    await add(publicFeedSetupAccount(PUBLIC_FEEDS_BASE_URL,'clist-changelog','CList Changelog'));
    for(const descriptor of await discoverPublicFeedSetup(PUBLIC_FEEDS_BASE_URL,{assertCurrent(){},fetch}))await add(descriptor);
}

function _publicFeedPlainText(html) {
    const d = document.createElement('div');
    d.innerHTML = html || '';
    return d.textContent || '';
}
