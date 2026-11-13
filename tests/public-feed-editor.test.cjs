const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');

class Element {
    constructor(tag) { this.tagName = tag; this.children = []; this.value = ''; this.style = {}; this.listeners = {}; }
    appendChild(child) { child.parent = this; this.children.push(child); return child; }
    append(...children) { children.forEach(child => this.appendChild(child)); }
    insertBefore(child, before) { child.parent = this; this.children.splice(this.children.indexOf(before), 0, child); }
    setAttribute(name, value) { this[name] = value; }
    set textContent(value) { this.text = value; this.children = []; }
    get textContent() { return this.text || this.children.map(child => child.textContent).join(''); }
    set innerHTML(value) { this.text = value.replace(/<[^>]*>/g, ''); this.children = []; }
    addEventListener(name, callback) { this.listeners[name] = callback; }
    async click() { return (this.onclick || this.listeners.click)?.({ stopPropagation() {} }); }
    querySelector(tag) { return find(this, node => node !== this && node.tagName === tag); }
    focus() { this.focused = true; }
    remove() { this.parent.children = this.parent.children.filter(child => child !== this); }
}

// Only supplies XML fixture outlines; native DOMParser is not under test here.
class FixtureParser {
    parseFromString(xml) {
        const outlines = [...xml.matchAll(/<outline\b([^>]+)\/?\s*>/g)].map(match => {
            const attrs = Object.fromEntries([...match[1].matchAll(/(\w+)="([^"]*)"/g)].map(a => [a[1], a[2].replaceAll('&amp;', '&')]));
            return { getAttribute: key => attrs[key] || null };
        });
        return {
            documentElement: { localName: xml.includes('<opml') ? 'opml' : 'html' },
            querySelector: () => null,
            querySelectorAll: () => outlines,
        };
    }
}

function fixture() {
    const publicFeeds = [{ id: 1, url: 'https://one.example/feed', title: 'One' }, { id: 2, url: 'https://two.example/feed', title: 'Two' }];
    const owned = new Map(), records = new Map(), requests = [], errors = [];
    let user = 'alice', imports = 0, failSave = false, failExport = false, nextId = 3;
    const metadata = { type: 'PublicFeed', title: 'My News', serviceUrl: 'https://rss.example', collectionSlug: 'news', permissions: 'r' };
    const key = 'public-feed:https://rss.example:news';
    for (const name of ['alice', 'bob']) records.set(`${name}:${key}`, JSON.stringify(metadata));
    const account = () => ({ ...metadata });
    const ownerKey = db => `${user}:${db}`;
    const feedsFor = db => owned.get(ownerKey(db)) || (db === 'news' ? publicFeeds : undefined);
    const opml = feeds => '<opml><body>' + feeds.map(feed => `<outline xmlUrl="${feed.url}" title="${feed.title}"/>`).join('') + '</body></opml>';
    const fc = new Element('div');
    const editor = new Element('div'), saveOptions = new Element('div'), writeTitle = new Element('div');
    const dom = { collectionEditorDiv: editor, 'save-options': saveOptions, 'write-title': writeTitle, 'write-format': { value: 'opml' } };
    const listings = [], openedWebsites = [], ownedPages = [], loadedPages = [];
    const context = {
        URL, Uint8Array, TextEncoder, FormData, Blob, DOMParser: FixtureParser, crypto: webcrypto, structuredClone,
        _activeCollection: null, currentEditor: 'collection', editorHandlers: {},
        console: { error: (...args) => errors.push(args) },
        document: { createElement: tag => new Element(tag), getElementById: id => dom[id] || null },
        window: { crypto: webcrypto, CList: {
            defaults: { LOCALRSS: 'https://rss.example' }, config: { flaskSiteUrl: 'https://kv.example' }, keys: { ACCESS_TOKEN: 'access_token' },
            accounts: [{ key, value: JSON.stringify(metadata) }],
            ui: { view: { feedContainer: fc } },
            storage: { kv: { remove: async key => records.delete(`${user}:${key}`), get: async key => records.has(`${user}:${key}`) ? { value: records.get(`${user}:${key}`) } : null, update: async (key, value) => {
                if (failSave) { failSave = false; throw new Error('Storage unavailable'); }
                assert.ok(records.has(`${user}:${key}`));
                records.set(`${user}:${key}`, value);
            } } },
        } },
        _localrssAuthHeaders: () => ({ Authorization: `Bearer ${user}`, 'X-Kvstore-Url': 'https://kv.example' }),
        base64UrlEncode: value => Buffer.from(value).toString('base64url'),
        getEncKey: async () => 'encryption-key', encryptWithKey: async (key, value) => value,
        decryptKVJson: async (key, value) => JSON.parse(value),
        getSiteSpecificCookie: () => user,
        parseAccountValue: account => { try { return JSON.parse(account.value); } catch { return null; } },
        openInBrowser: url => openedWebsites.push(url),
        _flattenForExport: async items => items,
        _fetchAllPublishedPages: async () => ownedPages,
        _fetchAllCollections: async () => [],
        loadSavedPage: async (content, page) => loadedPages.push({ content, page }),
        _kvSaveItems: async () => assert.fail('Feed saves must update their subscription, not an unrelated collection record'),
        showStatusMessage: () => {}, showErrorModal: (...args) => errors.push(args),
        findAccountByType: () => null,
        createFeedHeader: () => new Element('h2'), makeListing: item => { listings.push(item); return new Element('article'); },
        escapeHtml: value => value, SafeHtml: class {},
        showServiceError: (...args) => errors.push(args),
        fetch: async (input, options = {}) => {
            const url = new URL(input);
            requests.push({ path: url.pathname, options });
            if (ownedPages.some(page => page.url === input)) return { ok: true, text: async () => '<p>My HTML page</p>' };
            assert.equal(options.headers.Authorization, `Bearer ${user}`);
            assert.equal(options.headers['X-Kvstore-Url'], 'https://kv.example');
            let data;
            const db = url.searchParams.get('db');
            if (url.pathname === '/api/db_list') {
                data = { ok: true, dbs: [...owned.keys()].filter(key => key.startsWith(user + ':')).map(key => key.slice(user.length + 1)) };
            } else if (url.pathname === '/api/opml_export') {
                if (failExport) return { ok: false, status: 503, json: async () => ({ error: 'Export unavailable' }) };
                assert.ok(feedsFor(db));
                return { ok: true, text: async () => opml(feedsFor(db)) };
            } else if (url.pathname === '/api/opml_import') {
                imports++;
                const form = options.body;
                const creating = form.get('mode') === 'newdb';
                const slug = creating ? form.get('new_db_name') : db;
                assert.notEqual(slug, 'news');
                if (creating) assert.ok(!owned.has(ownerKey(slug)), 'must not recreate an existing personal collection');
                else {
                    assert.equal(form.get('mode'), 'merge');
                    assert.ok(owned.has(ownerKey(slug)), 'merge must target a caller-owned collection');
                }
                const xml = await form.get('opml').text();
                const outlines = new FixtureParser().parseFromString(xml).querySelectorAll();
                const members = creating ? [] : feedsFor(slug).slice();
                for (const outline of outlines) {
                    const url = outline.getAttribute('xmlUrl');
                    if (!members.some(feed => feed.url === url)) members.push({ id: publicFeeds.find(feed => feed.url === url)?.id || nextId++, url, title: outline.getAttribute('title') || outline.getAttribute('text') });
                }
                owned.set(ownerKey(slug), members);
                data = { ok: true, db: slug };
            } else if (url.pathname === '/api/feeds') {
                data = { ok: true, feeds: feedsFor(db) };
            } else if (url.pathname === '/api/feed_delete') {
                const body = JSON.parse(options.body);
                assert.ok(owned.has(ownerKey(body.db)), 'removal must target the caller-owned collection');
                owned.set(ownerKey(body.db), feedsFor(body.db).filter(feed => feed.id !== body.id));
                data = { ok: true };
            } else if (url.pathname === '/api/items') {
                data = feedsFor(db).map(feed => ({ id: feed.id, title: feed.title, link: feed.url }));
            } else {
                assert.fail(`Unexpected endpoint (including forbidden shared metadata edits): ${url.pathname}`);
            }
            return { ok: true, json: async () => data };
        },
    };
    vm.createContext(context);
    for (const file of ['collection-formats.js', 'public-feeds.js', 'public-feed-editor.js', 'collection-editor.js']) {
        vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/', file), 'utf8'), context);
    }
    const collectionSource = fs.readFileSync(path.join(__dirname, '../js/collections.js'), 'utf8');
    vm.runInContext(collectionSource.slice(collectionSource.indexOf('async function _fetchReadCollections('), collectionSource.indexOf('window.showSavedCollections =')), context);
    vm.runInContext(collectionSource.slice(collectionSource.indexOf('function _newCollectionIdentity()'), collectionSource.indexOf('// Fetches and decrypts all of the user')), context);
    vm.runInContext(collectionSource.slice(collectionSource.indexOf('async function _loadCollectionIntoEditor('), collectionSource.indexOf('// Remove one membership from a collection')), context);
    vm.runInContext(collectionSource.slice(collectionSource.indexOf('function captureCollectionSaveRequest('), collectionSource.indexOf('window.republishCollection =')), context);
    return { context, key, account, publicFeeds, owned, records, requests, errors, listings, editor, saveOptions, writeTitle, openedWebsites, ownedPages, loadedPages,
        setUser: value => { user = value; }, imports: () => imports,
        failSave: () => { failSave = true; }, failExport: () => { failExport = true; } };
}

function find(root, predicate) {
    return predicate(root) ? root : root.children.map(child => find(child, predicate)).find(Boolean);
}

test('Edit feeds uses the real Collection editor and Save to CList updates only the personal feeds', async () => {
    const f = fixture(), c = f.context;
    const personal = await c.ensurePersonalPublicFeedAccount(f.key, f.account());
    await c.openPublicFeedCollection(f.key, personal);
    assert.equal(f.writeTitle.textContent, 'My News');
    // Remove the first source with the shared editor's Remove entry control.
    await find(f.editor, node => node.title === 'Remove entry').click();
    // Add a new member with the shared editor's blank-entry control.
    await find(f.editor, node => node.title === 'Add a blank entry').click();
    const addedRow = find(f.editor, node => node.className === 'collection-editor-list').children[1];
    assert.equal(addedRow.children[1].style.display, 'block', 'the new entry opens automatically');
    assert.ok(find(addedRow, node => node.textContent === 'expand_less'));
    const url = find(addedRow, node => node.tagName === 'input' && node.type === 'url' && !node.value);
    url.value = 'https://new.example/feed'; url.listeners.input();
    const title = find(addedRow, node => node.tagName === 'input' && node.type === 'text' && !node.value);
    title.value = 'New feed'; title.listeners.input();
    assert.equal(f.owned.get('alice:' + personal.database).length, 2, 'draft edits are not saved immediately');
    f.writeTitle.textContent = 'Updated News';
    await c.window.playCollectionSave();
    await find(f.saveOptions, node => node.tagName === 'button' && node.textContent.endsWith('Save to CList')).click();
    assert.deepEqual(f.errors, []);
    const updated = JSON.parse(f.records.get('alice:' + f.key));
    assert.equal(updated.title, 'Updated News');
    assert.deepEqual(JSON.parse(updated.collectionItems).map(item => item.title), ['Two', 'New feed']);
    assert.ok(updated.collectionId.startsWith('urn:uuid:'));
    await c.window.CList.readers.PublicFeed.initialize(updated);
    assert.deepEqual(f.listings.map(item => item.title), ['Two', 'New feed']);
    assert.deepEqual(f.publicFeeds.map(feed => feed.title), ['One', 'Two']);
    // Reopen the actual editor from the saved subscription, preserving entries.
    await c.openPublicFeedCollection(f.key, updated);
    assert.ok(find(f.editor, node => node.value === 'https://new.example/feed'));
    assert.equal(f.errors.length, 0);
});

test('two users have independent copies and saving one does not change the other', async () => {
    const f = fixture();
    const alice = await f.context.ensurePersonalPublicFeedAccount(f.key, f.account());
    f.setUser('bob');
    const bob = await f.context.ensurePersonalPublicFeedAccount(f.key, f.account());
    await f.context.openPublicFeedCollection(f.key, bob);
    await find(f.editor, node => node.title === 'Remove entry').click();
    await f.context.window.playCollectionSave();
    await find(f.saveOptions, node => node.tagName === 'button' && node.textContent.endsWith('Save to CList')).click();
    assert.equal(f.owned.get('alice:' + alice.database).length, 2);
    assert.equal(f.owned.get('bob:' + bob.database).length, 1);
    assert.equal(f.publicFeeds.length, 2);
});

test('account save failure can retry without duplicating or resetting the imported copy', async () => {
    const f = fixture();
    f.failSave();
    await assert.rejects(f.context.ensurePersonalPublicFeedAccount(f.key, f.account()), /Storage unavailable/);
    const personal = await f.context.ensurePersonalPublicFeedAccount(f.key, f.account());
    assert.equal(f.imports(), 1);
    const requests = f.requests.length;
    await f.context.ensurePersonalPublicFeedAccount(f.key, personal);
    assert.equal(f.requests.length, requests, 'an existing copy is reused');
});

test('failed source export never imports or changes the subscription', async () => {
    const f = fixture(), original = f.records.get('alice:' + f.key);
    f.failExport();
    await assert.rejects(f.context.ensurePersonalPublicFeedAccount(f.key, f.account()), /Export unavailable/);
    assert.equal(f.imports(), 0);
    assert.equal(f.records.get('alice:' + f.key), original);
});

test('the combined changelog imports every repository as one editable collection', async () => {
    const f = fixture();
    const personal = await f.context.ensurePersonalPublicFeedAccount(f.key, { ...f.account(), collectionSlug: 'clist-changelog' });
    const members = f.owned.get('alice:' + personal.database);
    assert.equal(members.length, 8);
    assert.ok(members.some(feed => feed.url === 'https://github.com/Downes/localrss_reader/commits.atom'));
    assert.ok(members.some(feed => feed.url === 'https://github.com/Downes/proxyp/commits.atom'));
    assert.equal(f.imports(), 1);
});

test('local-only identity fails visibly to its caller before attempting remote writes', async () => {
    const f = fixture();
    f.context.window.CList.isLocalMode = () => true;
    await assert.rejects(f.context.ensurePersonalPublicFeedAccount(f.key, f.account()), /server-backed CList login/);
    assert.equal(f.requests.length, 0);
    assert.equal(f.imports(), 0);
});

test('shared editor ordering and descriptions survive saving and reopening', async () => {
    const f = fixture(), c = f.context;
    const personal = await c.ensurePersonalPublicFeedAccount(f.key, f.account());
    const unchanged = f.owned.get('alice:' + personal.database)[0];
    unchanged.history = 'existing harvested entries and read state';
    await c.openPublicFeedCollection(f.key, personal);
    const description = find(f.editor, node => node.tagName === 'textarea');
    description.value = 'My feed description'; description.listeners.input();
    await find(f.editor, node => node.title === 'Move down').click();
    await c.window.playCollectionSave();
    await find(f.saveOptions, node => node.tagName === 'button' && node.textContent.endsWith('Save to CList')).click();
    const saved = JSON.parse(f.records.get('alice:' + f.key));
    assert.deepEqual(JSON.parse(saved.collectionItems).map(item => item.title), ['Two', 'One']);
    assert.equal(JSON.parse(saved.collectionItems)[1].summary, 'My feed description');
    assert.equal(f.owned.get('alice:' + personal.database)[0], unchanged, 'unchanged feeds retain their history');
    await c.openPublicFeedCollection(f.key, saved);
    assert.ok(find(f.editor, node => node.value === 'My feed description'));
    assert.equal(f.errors.length, 0);
});

test('all feeds can be removed, saved, and reopened as an empty collection', async () => {
    const f = fixture(), c = f.context;
    const personal = await c.ensurePersonalPublicFeedAccount(f.key, f.account());
    await c.openPublicFeedCollection(f.key, personal);
    for (let i = 0; i < 2; i++) await find(f.editor, node => node.title === 'Remove entry').click();
    await c.window.playCollectionSave();
    await find(f.saveOptions, node => node.tagName === 'button' && node.textContent.endsWith('Save to CList')).click();
    assert.equal(f.owned.get('alice:' + personal.database).length, 0);
    const updated = JSON.parse(f.records.get('alice:' + f.key));
    await c.openPublicFeedCollection(f.key, updated);
    assert.ok(find(f.editor, node => node.title === 'Add a blank entry'));
    assert.equal(find(f.editor, node => node.title === 'Remove entry'), undefined);
    assert.equal(f.publicFeeds.length, 2);
    assert.equal(f.errors.length, 0);
});

test('incomplete feed entries fail visibly without changing subscriptions', async () => {
    const f = fixture(), c = f.context;
    const personal = await c.ensurePersonalPublicFeedAccount(f.key, f.account());
    await c.openPublicFeedCollection(f.key, personal);
    await find(f.editor, node => node.title === 'Add a blank entry').click();
    await c.window.playCollectionSave();
    await find(f.saveOptions, node => node.tagName === 'button' && node.textContent.endsWith('Save to CList')).click();
    assert.ok(f.errors.some(args => String(args[0]).includes('Save failed: Every feed entry')));
    assert.equal(f.imports(), 1, 'invalid drafts must not submit changes');
    assert.equal(f.owned.get('alice:' + personal.database).length, 2);
});

test('ordinary collections retain the existing Save to CList destination', async () => {
    const f = fixture(), c = f.context;
    let saved;
    c._kvSaveItems = async (...args) => { saved = args; };
    await c._loadCollectionIntoEditor({ name: 'Ordinary collection', items: [{ title: 'A page', url: 'https://page.example' }] }, 'token', 'key');
    await c.window.playCollectionSave();
    await find(f.saveOptions, node => node.tagName === 'button' && node.textContent.endsWith('Save to CList')).click();
    assert.equal(saved[2], 'Ordinary collection');
    assert.equal(f.requests.length, 0, 'ordinary collection saves do not contact LocalRSS');
    assert.equal(f.errors.length, 0);
});

test('changelog metadata fills older entries, excludes AI authors, and survives OPML and account saves', async () => {
    const f = fixture(), c = f.context;
    const imported = c._parseCollectionOPML(c.publicChangelogOpml()).items;
    assert.equal(imported.length, 8);
    assert.ok(imported.every(item => item.author_name === 'Stephen Downes' && item.feed === item.url + '/commits.atom' && item.summary));
    const personal = await c.ensurePersonalPublicFeedAccount(f.key, { ...f.account(), collectionSlug: 'clist-changelog' });
    // A previously edited subset must keep its membership, order, and notes.
    personal.collectionItems = JSON.stringify([
        { title: 'Proxy', url: 'https://github.com/Downes/proxyp/commits.atom', author_name: 'AI author', summary: 'My notes' },
        { title: 'CList', url: 'https://github.com/Downes/CList/commits.atom' },
    ]);
    await c.openPublicFeedCollection(f.key, personal);
    assert.ok(find(f.editor, node => node.value === 'Stephen Downes'));
    assert.ok(find(f.editor, node => node.value === 'My notes'));
    assert.equal(find(f.editor, node => node.value === 'AI author'), undefined);
    await c.window.playCollectionSave();
    await find(f.saveOptions, node => node.tagName === 'button' && node.textContent.endsWith('Save to CList')).click();
    const saved = JSON.parse(f.records.get('alice:' + f.key));
    const entries = JSON.parse(saved.collectionItems);
    assert.deepEqual(entries.map(item => item.title), ['Proxy', 'CList']);
    assert.ok(entries.every(item => item.author_name === 'Stephen Downes' && item.feed === item.url + '/commits.atom' && item.summary));
    assert.equal(entries[0].summary, 'My notes');
    assert.equal(f.errors.length, 0);
});

test('website action reuses openInBrowser while subscription saves retain the separate feed URL', async () => {
    const f = fixture(), c = f.context;
    const personal = await c.ensurePersonalPublicFeedAccount(f.key, { ...f.account(), collectionSlug: 'clist-changelog' });
    await c.openPublicFeedCollection(f.key, personal);
    assert.ok(find(f.editor, node => node.tagName === 'label' && node.textContent === 'Website URL'));
    assert.ok(find(f.editor, node => node.tagName === 'label' && node.textContent === 'Feed URL'));
    const launch = find(f.editor, node => node.title === 'Open website in browser');
    assert.equal(launch.className, 'clist-action-btn');
    await launch.click();
    assert.deepEqual(f.openedWebsites, ['https://github.com/Downes/CList']);
    await c.window.playCollectionSave();
    await find(f.saveOptions, node => node.tagName === 'button' && node.textContent.endsWith('Save to CList')).click();
    const members = f.owned.get('alice:' + personal.database);
    assert.ok(members.some(item => item.url === 'https://github.com/Downes/CList/commits.atom'));
    assert.ok(members.every(item => item.url.endsWith('/commits.atom')), 'website URLs must not be subscribed as feeds');
    const saved = JSON.parse(f.records.get('alice:' + f.key));
    const entry = JSON.parse(saved.collectionItems)[0];
    assert.equal(entry.url, 'https://github.com/Downes/CList');
    assert.equal(entry.feed, 'https://github.com/Downes/CList/commits.atom');
    await c.openPublicFeedCollection(f.key, saved);
    assert.ok(find(f.editor, node => node.value === entry.url));
    assert.ok(find(f.editor, node => node.value === entry.feed));
    assert.equal(f.errors.length, 0);
});

test('external feed members have no resource Edit button but retain inline details and browser actions', async () => {
    const f = fixture(), c = f.context;
    const personal = await c.ensurePersonalPublicFeedAccount(f.key, { ...f.account(), collectionSlug: 'clist-changelog' });
    await c.openPublicFeedCollection(f.key, personal);
    assert.equal(find(f.editor, node => node.title === 'Edit feed details' || node.title === 'Edit this page'), undefined);
    assert.ok(find(f.editor, node => node.title === 'Open website in browser'));
    assert.ok(find(f.editor, node => node.className === 'collection-editor-entry-fields'));
    assert.equal(f.errors.length, 0);
});

test('owned HTML members open through the existing page loader with HTML MIME and saved-page identity', async () => {
    const f = fixture(), c = f.context;
    const page = { pageKey: 'page:mine', kind: 'page', title: 'My HTML page', url: 'https://mine.example/page', mimeType: 'text/html', service: 'CListBin' };
    f.ownedPages.push(page);
    c.editorHandlers.tinymce = { initialize: async () => {}, contentTypes: ['text/html'] };
    await c._loadCollectionIntoEditor({ name: 'Reading', items: [{ title: page.title, url: page.url }] }, 'token', 'key');
    const edit = find(f.editor, node => node.title === 'Edit this page');
    assert.ok(edit);
    await edit.click();
    assert.equal(f.loadedPages[0].content.type, 'text/html');
    assert.equal(f.loadedPages[0].page.pageKey, 'page:mine');
    assert.equal(f.loadedPages[0].content.value, '<p>My HTML page</p>');
    assert.equal(f.errors.length, 0);
});

test('resource Edit availability follows the current member URL and registered editors', async () => {
    const f = fixture(), c = f.context;
    const page = { title: 'Mine', url: 'https://mine.example/page', mimeType: 'text/html' };
    f.ownedPages.push(page);
    c.editorHandlers.tinymce = { initialize: async () => {}, contentTypes: ['text/html'] };
    await c._loadCollectionIntoEditor({ name: 'Reading', items: [{ title: 'External', url: 'https://external.example/' }] }, 'token', 'key');
    assert.equal(find(f.editor, node => node.title === 'Edit this page'), undefined);
    const urlInput = find(f.editor, node => node.value === 'https://external.example/');
    urlInput.value = page.url; urlInput.listeners.input();
    assert.ok(find(f.editor, node => node.title === 'Edit this page'));
    urlInput.value = 'https://external.example/'; urlInput.listeners.input();
    assert.equal(find(f.editor, node => node.title === 'Edit this page'), undefined);
    assert.equal(f.requests.length, 0);
    assert.equal(f.errors.length, 0);
});

test('registered Read menu opens saved Collections and its edit action reveals the shared editor', async () => {
    const f = fixture(), c = f.context;
    const accountList = new Element('div');
    const previousLookup = c.document.getElementById;
    c.document.getElementById = id => id === 'read-account-list' ? accountList : previousLookup(id);
    c.makeAccountList = () => { const list = new Element('div'); list.appendChild(new Element('p')); return list; };
    let registered = true, revealed = 0;
    c.isRegistered = () => registered;
    c.window.CList.isLocalMode = () => true;
    c.revealEditorPane = () => { revealed++; };
    c._collectionsPopstateHandler = null;
    c._fetchAllCollections = async () => [{ key: 'collection:empty', id: 'urn:uuid:empty', title: 'Empty collection', items: [] }];
    const collectionSource = fs.readFileSync(path.join(__dirname, '../js/collections.js'), 'utf8');
    const start = collectionSource.indexOf('async function _fetchReadCollections(');
    vm.runInContext(collectionSource.slice(start, collectionSource.indexOf('\n(function () {', start)), c);
    const readerSource = fs.readFileSync(path.join(__dirname, '../js/reader.js'), 'utf8');
    vm.runInContext(readerSource.slice(readerSource.indexOf('function populateReadAccountList('), readerSource.indexOf('// Function to switch accounts')), c);
    c.populateReadAccountList([]);
    const collections = find(accountList, node => node.tagName === 'button' && node.textContent.includes('Collections'));
    assert.ok(collections, 'Collections is available without a reader account, including local mode');
    await collections.click();
    const feedContainer = c.window.CList.ui.view.feedContainer;
    assert.ok(find(feedContainer, node => node.textContent === 'Empty collection'));
    await find(feedContainer, node => node.title === 'Edit collection').click();
    assert.equal(revealed, 1);
    assert.equal(f.writeTitle.textContent, 'Empty collection');
    assert.ok(find(f.editor, node => node.title === 'Add a blank entry'));
    assert.equal(f.errors.length, 0);
    registered = false;
    c.populateReadAccountList([]);
    assert.equal(find(accountList, node => node.tagName === 'button' && node.textContent.includes('Collections')), undefined);
});

function loadCollectionsView(f) {
    const c = f.context;
    c._collectionsPopstateHandler = null;
    c.revealEditorPane = () => {};
    c.updateUIVisibility = () => {};
    const source = fs.readFileSync(path.join(__dirname, '../js/collections.js'), 'utf8');
    const start = source.indexOf('window.showSavedCollections =');
    vm.runInContext(source.slice(start, source.indexOf('\n(function () {', start)), c);
}

test('Save to CList uses one captured request despite subsequent title, draft and publication edits', async () => {
    const f = fixture(), c = f.context;
    let saved;
    c._kvSaveItems = async (...args) => { saved = args; };
    await c._loadCollectionIntoEditor({
        key: 'collection:original', id: 'urn:uuid:original', name: 'Original title',
        items: [{ title: 'Original page', url: 'https://original.example' }],
        publishedUrls: [{ url: 'https://published.example' }],
    }, 'token', 'key');
    await c.window.playCollectionSave();
    f.writeTitle.textContent = 'Later title';
    const pageTitle = find(f.editor, node => node.value === 'Original page');
    pageTitle.value = 'Later page'; pageTitle.listeners.input();
    c._activeCollection.col.publishedUrls[0].url = 'https://later.example';
    await find(f.saveOptions, node => node.tagName === 'button' && node.textContent.endsWith('Save to CList')).click();
    assert.equal(saved[0], 'collection:original');
    assert.equal(saved[1], 'urn:uuid:original');
    assert.equal(saved[2], 'Original title');
    assert.equal(saved[3][0].title, 'Original page');
    assert.equal(saved[6][0].url, 'https://published.example');
    assert.equal(f.errors.length, 0);
});

test('collection save view displays a persistence failure once and permits an explicit retry', async () => {
    const f = fixture(), c = f.context;
    let attempts = 0;
    c._kvSaveItems = async () => { if (++attempts === 1) throw new Error('Storage unavailable'); };
    await c._loadCollectionIntoEditor({ name: 'Retry collection', items: [] }, 'token', 'key');
    await c.window.playCollectionSave();
    const save = find(f.saveOptions, node => node.tagName === 'button' && node.textContent.endsWith('Save to CList'));
    await save.click();
    assert.equal(save.disabled, false);
    assert.equal(attempts, 1);
    assert.equal(f.errors.filter(args => String(args[0]).startsWith('Save failed:')).length, 1);
    await save.click();
    assert.equal(attempts, 2);
    assert.equal(save.disabled, false);
    assert.equal(f.errors.filter(args => String(args[0]).startsWith('Save failed:')).length, 1);
});

test('completion of an old save does not replace a new collection or close its panel', async () => {
    const f = fixture(), c = f.context;
    let release, closed = 0;
    const gate = new Promise(resolve => { release = resolve; });
    c._kvSaveItems = async () => gate;
    c.closeRightPane = () => { closed++; };
    await c._loadCollectionIntoEditor({ key: 'collection:old', id: 'urn:uuid:old', name: 'Old collection', items: [] }, 'token', 'key');
    await c.window.playCollectionSave();
    const save = find(f.saveOptions, node => node.tagName === 'button' && node.textContent.endsWith('Save to CList'));
    const pending = save.click();
    await Promise.resolve();
    await c._loadCollectionIntoEditor({ key: 'collection:new', id: 'urn:uuid:new', name: 'New collection', items: [] }, 'token', 'key');
    release();
    await pending;
    assert.equal(c._activeCollection.col.key, 'collection:new');
    assert.equal(f.writeTitle.textContent, 'New collection');
    assert.equal(closed, 0);
    assert.equal(f.errors.length, 0);
});

test('a user with only feed collections sees them in Collections and can edit or remove the subscription', async () => {
    const f = fixture(), c = f.context;
    loadCollectionsView(f);
    let readKey;
    c.switchReaderAccount = async key => { readKey = key; };
    await c.window.showSavedCollections();
    const container = c.window.CList.ui.view.feedContainer;
    const title = find(container, node => node.className === 'saved-collection-name');
    assert.equal(title.textContent, 'My News');
    assert.ok(!container.textContent.includes('No collections yet'));
    await title.click();
    assert.equal(readKey, f.key);
    await find(container, node => node.title === 'Edit collection').click();
    assert.equal(f.writeTitle.textContent, 'My News');
    assert.equal(f.imports(), 1);
    await find(container, node => node.title === 'Delete this collection').click();
    await find(container, node => node.tagName === 'button' && node.textContent === 'Delete').click();
    assert.equal(c.window.CList.accounts.length, 0);
    assert.ok(container.textContent.includes('No collections yet'));
    assert.equal(f.errors.length, 0);
});

test('Collections includes saved, public-feed and LocalRSS collections with registered edit operations', async () => {
    const f = fixture(), c = f.context;
    const source = fs.readFileSync(path.join(__dirname, '../js/localrss.js'), 'utf8');
    vm.runInContext(source.slice(0, source.indexOf('// ---- Module state ----')), c);
    c._localrssResolveServiceUrl = async account => { account._effectiveServiceUrl = 'https://rss.example'; };
    const local = { type: 'LOCALRSS', title: 'Local Feeds', permissions: 'r', serviceUrl: 'https://configured.example', database: 'local-db' };
    f.records.set('alice:local-feeds', JSON.stringify(local));
    f.owned.set('alice:local-db', f.publicFeeds.slice());
    c.window.CList.accounts.push({ key: 'local-feeds', value: JSON.stringify(local) });
    c.window.CList.accounts.push({ key: 'social', value: JSON.stringify({ type: 'Mastodon', title: 'Social' }) });
    c._fetchAllCollections = async () => [{ key: 'collection:saved', title: 'Saved collection', items: [] }];
    const collections = await c._fetchReadCollections('token', 'key', c.window.CList.accounts);
    assert.deepEqual(Array.from(collections, col => col.title), ['Saved collection', 'My News', 'Local Feeds']);
    loadCollectionsView(f);
    await c.window.showSavedCollections();
    const localTitle = find(c.window.CList.ui.view.feedContainer, node => node.className === 'saved-collection-name' && node.textContent === 'Local Feeds');
    await find(localTitle.parent, node => node.title === 'Edit collection').click();
    assert.equal(f.writeTitle.textContent, 'Local Feeds');
    await c.window.playCollectionSave();
    await find(f.saveOptions, node => node.tagName === 'button' && node.textContent.endsWith('Save to CList')).click();
    const saved = JSON.parse(f.records.get('alice:local-feeds'));
    assert.equal(saved.type, 'LOCALRSS');
    assert.equal(saved.serviceUrl, 'https://configured.example', 'resolved local/proxy endpoint must not overwrite the configured service');
    assert.equal(JSON.parse(saved.collectionItems).length, 2);
    assert.equal(f.errors.length, 0);
});
