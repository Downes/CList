function collectionDraftGate() { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; }
async function collectionDraftFlush() { for (let i = 0; i < 25; i++) await Promise.resolve(); }
function collectionDraftFixture(options = {}) {
    const root = document.createElement('div'); root.id = 'collectionEditorDiv'; document.body.appendChild(root);
    const title = document.createElement('div'); title.id = 'write-title'; title.textContent = 'Draft'; document.body.appendChild(title);
    const calls = [], errors = [], behavior = {}; let token = 'private-token';
    window.CList.state = { username: 'Alice', authEpoch: 1 };
    window.CList.config = { flaskSiteUrl: 'https://identity.invalid' }; window.CList.keys = { ACCESS_TOKEN: 'access_token' };
    Object.assign(globalThis, { currentEditor: 'collection', currentEditorAccount: null,
        getSiteSpecificCookie: () => token, getEncKey: async () => 'private-key',
        _collectionItemDisplayTitle: item => item.title || item.url || '',
        openInBrowser: url => calls.push(['browse', url]),
        _openEntryForEdit: async (item, token, key, page) => { calls.push(['open', item, token, key, page]); if (behavior.open) await behavior.open(); },
        _publishLocalEntry: async (item, refresh) => { calls.push(['publish', item]); if (behavior.publish) await behavior.publish(); },
        _addEntryFromFile: async (...args) => { calls.push(['file', ...args]); if (behavior.file) await behavior.file(); },
        _showAddEntryFromExistingPicker: async (...args) => { calls.push(['existing', ...args]); if (behavior.existing) await behavior.existing(); },
        _fetchAllCollections: async () => { if (behavior.targets) await behavior.targets(); return []; },
        _fetchAllPublishedPages: async () => [],
        showStatusMessage: text => errors.push(text), showErrorModal: text => errors.push(text),
    });
    const original = { name: 'Draft', id: 'collection-id', items: [
        { title: '<Literal>', url: 'https://first.invalid', summary: 'Description', extra: { retained: true } },
        { title: 'Second', url: 'https://second.invalid' }], ...options };
    globalThis._activeCollection = { col: original, token, encKey: 'private-key' };
    editorHandlers.text = { initialize() {}, contentTypes: ['text/plain'] };
    const targets = { pages: new Map([['https://first.invalid', { mimeType: 'text/plain', url: 'https://first.invalid' }]]), collections: new Set(['child']) };
    const controller = _renderCollectionEditor(root, original, token, 'private-key', targets);
    const buttons = (label, parent = root) => Array.from(parent.querySelectorAll('button')).filter(button => button.title === label);
    const input = (index, key) => {
        const row = root.querySelector('.collection-editor-list').children[index];
        const fields = Array.from(row.querySelectorAll('.collection-editor-field'));
        return fields.find(field => field.querySelector('label').textContent === key)?.querySelector('input, textarea');
    };
    return { root, title, original, controller, calls, errors, behavior, targets, buttons, input,
        edit(index, key, value) { const node = input(index, key); node.value = value; node.dispatchEvent(new Event('input')); return node; },
        token(value) { token = value; },
        dispose() { controller.dispose(); root.remove(); title.remove(); },
    };
}
const collectionDraftCases = [
    ['real editor bridge retains raw extensions and live draft API with literal labels', async check => {
        const f = collectionDraftFixture();
        check(f.root.textContent.includes('<Literal>') && !f.root.querySelector('Literal'), 'literal title');
        f.edit(0, 'Description', 'Edited');
        check(f.controller.items[0].summary === 'Edited' && f.original.items[0].summary === 'Description', 'detached draft fields');
        check(readActiveCollectionDraft().items === f.controller.items && JSON.parse(editorHandlers.collection.getContent())[0].extra.retained, 'Save/export use same live draft and extensions');
        check(!JSON.stringify(window.CList.state.collectionDraft).includes('private-') && Object.keys(window.CList.state.collectionDraft).sort().join() === 'busy,count,generation', 'safe state'); f.dispose();
    }],
    ['reorder/remove callbacks expire after structural rebuild and retain expansion', async check => {
        const f = collectionDraftFixture(), oldDelete = f.buttons('Remove entry')[0], oldInput = f.input(0, 'Title');
        f.root.querySelector('.collection-editor-entry-bar').dispatchEvent(new Event('click'));
        f.buttons('Move down')[0].click();
        check(f.controller.items[1].title === '<Literal>' && f.root.querySelector('.collection-editor-list').children[1].querySelector('.collection-editor-entry-fields').style.display === 'block', 'reorder preserves expansion');
        oldDelete.click(); oldInput.value = 'obsolete'; oldInput.dispatchEvent(new Event('input'));
        check(f.controller.items.length === 2 && f.controller.items[1].title === '<Literal>', 'retired controls rejected');
        f.buttons('Remove entry')[0].click(); check(f.controller.items.length === 1 && f.controller.items[0].title === '<Literal>', 'remove current exact member'); f.dispose();
    }],
    ['blank and nested rows preserve field contracts and do not mutate nested identity', async check => {
        const f = collectionDraftFixture({ items: [{ role: 'contains', collectionId: 'child', title: 'Child', extension: false }] });
        check(f.root.querySelectorAll('input').length === 2, 'nested title plus hidden file only');
        f.edit(0, 'Title', 'Rename'); check(f.controller.items[0].collectionId === 'child' && f.controller.items[0].extension === false, 'nested identity/extensions retained');
        f.buttons('Add a blank entry')[0].click();
        check(f.controller.items.length === 2 && f.root.querySelector('.collection-editor-list').children[1].querySelector('.collection-editor-entry-fields').style.display === 'block', 'blank row expanded'); f.dispose();
    }],
    ['owned edit actions update with URL and feed launch uses captured current row', async check => {
        const f = collectionDraftFixture({ feedAccount: { type: 'LocalRSS' } });
        check(f.buttons('Edit this page').length === 1 && f.root.textContent.includes('subscribed feeds'), 'owned resource and feed note');
        const retiredEdit = f.buttons('Edit this page')[0]; f.edit(0, 'Website URL', 'javascript:bad');
        check(f.buttons('Edit this page').length === 0 && f.buttons('Open website in browser')[0].disabled, 'unsafe/unowned URL disables actions');
        f.edit(0, 'Website URL', 'https://first.invalid'); retiredEdit.click(); check(f.calls.length === 0, 'retired Edit control rejected after URL restoration');
        f.buttons('Open website in browser')[0].click(); f.buttons('Edit this page')[0].click(); await collectionDraftFlush();
        check(f.calls.find(call => call[0] === 'browse')[1] === 'https://first.invalid' && f.calls.find(call => call[0] === 'open')[2] === 'private-token', 'current targets routed through existing APIs'); f.dispose();
    }],
    ['pending row actions deduplicate through refresh and report failure with explicit retry', async check => {
        const f = collectionDraftFixture(), gate = collectionDraftGate(); let reject = true;
        f.behavior.open = async () => { await gate.promise; if (reject) throw new Error('Open failed'); };
        const old = f.buttons('Edit this page')[0]; old.click(); old.click(); f.controller.refresh(); f.buttons('Edit this page')[0].click();
        check(f.calls.length === 1 && window.CList.state.collectionDraft.busy, 'one pending action after rebuild');
        gate.resolve(); await collectionDraftFlush();
        check(!window.CList.state.collectionDraft.busy && !f.buttons('Edit this page')[0].disabled, 'rebuilt controls unlocked');
        reject = false; f.buttons('Edit this page')[0].click(); await collectionDraftFlush();
        check(f.calls.length === 2, 'explicit retry only'); f.dispose();
    }],
    ['current action failures are visible and source/session/detached rows cannot act', async check => {
        const f = collectionDraftFixture(); f.behavior.open = async () => { throw new Error('Visible failure'); };
        f.buttons('Edit this page')[0].click(); await collectionDraftFlush(); check(f.root.textContent.includes('Visible failure'), 'visible failure');
        f.token('other-token'); f.buttons('Remove entry')[0].click(); f.edit(0, 'Title', 'stale'); f.buttons('Edit this page')[0].click();
        check(f.controller.items.length === 2 && f.controller.items[0].title === '<Literal>' && f.calls.length === 1, 'expired session actions rejected'); f.dispose();
        const g = collectionDraftFixture(), button = g.buttons('Remove entry')[0]; button.parentNode.parentNode.remove(); button.click();
        check(g.controller.items.length === 2, 'detached row rejected'); g.dispose();
    }],
    ['newer external field updates and replaced drafts reject saved input/actions', async check => {
        const f = collectionDraftFixture(), input = f.input(0, 'Title'); f.controller.items[0].title = 'Newer accepted title';
        input.value = 'Old input'; input.dispatchEvent(new Event('input'));
        check(f.controller.items[0].title === 'Newer accepted title', 'newer metadata protected');
        globalThis._activeCollection = { col: { name: 'Other', items: [] } }; f.buttons('Remove entry')[0].click();
        check(f.controller.items.length === 2, 'new collection protected'); f.dispose();
    }],
    ['file/existing/publish controls delegate original draft and block duplicate dispatch', async check => {
        const f = collectionDraftFixture({ items: [{ title: 'Local', url: 'blob:local', localOnly: true, mimeType: 'text/plain' }] }), gate = collectionDraftGate();
        f.behavior.publish = () => gate.promise; f.buttons('Publish this local page')[0].click(); f.buttons('Publish this local page')[0].click();
        check(f.calls.length === 1 && f.calls[0][1] === f.controller.items[0], 'publish retains live original member'); gate.resolve(); await collectionDraftFlush();
        f.buttons('Add entry from a saved page or collection')[0].click(); await collectionDraftFlush();
        check(f.calls.find(call => call[0] === 'existing')[1] === f.controller.items, 'existing picker uses same draft');
        const file = { name: 'synthetic.txt' }; await f.controller.file(file);
        check(f.calls.find(call => call[0] === 'file')[1] === file && f.calls.find(call => call[0] === 'file')[2] === f.controller.items, 'file API captured'); f.dispose();
    }],
    ['superseded async panel cannot replace newer draft or title', async check => {
        const f = collectionDraftFixture(), gate = collectionDraftGate(); f.behavior.targets = () => gate.promise;
        const old = window.showCollectionEditorPanel(f.root);
        const newer = { name: 'Newer', items: [{ title: 'Retain' }] }; globalThis._activeCollection = { col: newer, token: null, encKey: null };
        await window.showCollectionEditorPanel(f.root); gate.resolve(); check(await old === false, 'old lookup rejected');
        check(readActiveCollectionDraft().items[0].title === 'Retain' && f.title.textContent === 'Newer', 'newer panel/title retained'); f.dispose();
    }],
    ['Save/publication metadata reconciliation keeps current controls and newer fields usable', async check => {
        const f = collectionDraftFixture();
        globalThis._activeCollection = { ..._activeCollection, col: { ..._activeCollection.col, publishedUrls: [{ url: 'https://published.invalid' }] } };
        _refreshIdDisplay(); f.edit(0, 'Title', 'After save'); f.buttons('Add a blank entry')[0].click();
        check(f.controller.items[0].title === 'After save' && f.controller.items.length === 3, 'metadata replacement keeps live editing');
        check(f.root.textContent.includes('ID: collection-id'), 'identity display retained'); f.dispose();
        const g = collectionDraftFixture({ id: null });
        globalThis._activeCollection = { col: { ...g.original, id: 'first-save-id' } }; _refreshIdDisplay(); g.edit(0, 'Title', 'First saved');
        check(g.controller.items[0].title === 'First saved' && g.root.textContent.includes('first-save-id'), 'first Save identity assignment retains editing'); g.dispose();
    }],
    ['late failures and disposed/source-expired controls cannot affect newer work', async check => {
        const f = collectionDraftFixture(), gate = collectionDraftGate();
        f.behavior.open = async () => { await gate.promise; throw new Error('Old failure'); };
        f.buttons('Edit this page')[0].click(); window.CList.state.authEpoch++; gate.resolve(); await collectionDraftFlush();
        check(!f.root.textContent.includes('Old failure'), 'stale failure hidden'); f.buttons('Add a blank entry')[0].click();
        check(f.controller.items.length === 2, 'old auth epoch rejects editing'); f.dispose();
        const g = collectionDraftFixture(); globalThis.currentEditor = 'text'; g.buttons('Remove entry')[0].click();
        check(g.controller.items.length === 2, 'other editor protected'); globalThis.currentEditor = 'collection'; g.controller.dispose(); g.buttons('Add a blank entry')[0].click();
        check(g.controller.items.length === 2, 'disposed controls rejected'); g.dispose();
    }],
];
