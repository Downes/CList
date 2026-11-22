/// <reference path="./clist-types.js" />
// Collection browsing/load controller. Collections, sessions and callbacks stay private.
let _collectionBrowserOwner = null, _collectionBrowserPopstate = null;
/** @returns {CListCollectionBrowseState} */
function collectionBrowserState() {
    return window.CList.state.collectionBrowsing ||= { generation: 0, phase: 'idle', selectedKey: null, confirmKey: null, busy: false, error: null };
}
function clearCollectionBrowserHistory() {
    if (_collectionBrowserPopstate) window.removeEventListener('popstate', _collectionBrowserPopstate);
    _collectionBrowserPopstate = null;
}
function invalidateCollectionBrowser() { clearCollectionBrowserHistory(); _collectionBrowserOwner = null; }
function currentCollectionBrowser(owner) {
    if (_collectionBrowserOwner !== owner || owner.view.root.isConnected === false) return false;
    const reader = window.CList.state.reader;
    if (owner.mode === 'feed' && (reader?.requestId !== owner.readerId || reader?.mode !== owner.readerMode)) return false;
    if (owner.mode === 'load' && owner.controlsId !== window.CList.state.editorControls?.id) return false;
    try { assertCollectionSession(owner.session); return true; } catch { return false; }
}
function collectionBrowserOwner(mode, session) {
    const previous = collectionBrowserState();
    const state = window.CList.state.collectionBrowsing = { generation: previous.generation + 1,
        phase: 'loading', selectedKey: null, confirmKey: null, busy: false, error: null };
    const owner = { mode, state, session, collections: [], renderId: 0, warning: null,
        readerId: window.CList.state.reader?.requestId, readerMode: window.CList.state.reader?.mode,
        controlsId: window.CList.state.editorControls?.id, accountValues: new Map((window.CList.accounts || []).map(account => [account.key, account.value])) };
    _collectionBrowserOwner = owner;
    owner.view = window.CList.ui.collectionBrowser.mount(mode);
    return owner;
}
// Retain the established account-reader integration, with detached service metadata.
async function _fetchReadCollections(token, encKey, accounts) {
    const session = beginCollectionSession({ token, encKey });
    await prepareCollectionSession(session);
    const result = await listCollectionRecords(collectionDependencies(session));
    return addCollectionSubscriptions(result.collections, accounts);
}
function addCollectionSubscriptions(collections, accounts) {
    const result = structuredClone(collections);
    for (const account of accounts || []) {
        const data = parseAccountValue(account);
        if (!data || typeof window.CList.readers[data.type]?.editCollection !== 'function') continue;
        result.push({ key: account.key, title: data.title || account.key, name: data.title || account.key,
            items: [], feedSubscription: structuredClone(data) });
    }
    return result;
}
async function showCollectionBrowser(mode = 'feed') {
    clearCollectionBrowserHistory();
    const view = window.CList.ui.collectionBrowser;
    let owner;
    try {
        if (mode === 'feed' && window.CList.state.reader && window.CList.state.reader.mode !== 'collections'
            && typeof invalidateReader === 'function') invalidateReader('collections');
        const session = beginCollectionSession();
        owner = collectionBrowserOwner(mode, session);
        view.message(owner.view, 'Loading collections…');
        await prepareCollectionSession(session);
        if (!currentCollectionBrowser(owner)) return null;
        const result = await listCollectionRecords(collectionDependencies(session));
        if (!currentCollectionBrowser(owner)) return null;
        owner.collections = mode === 'load' ? result.collections : addCollectionSubscriptions(result.collections, window.CList.accounts);
        owner.collections.forEach(col => { col.name ||= col.title; col.items ||= []; });
        owner.warning = result.warnings?.length ? `${result.warnings.length} unreadable collection record(s) were skipped.` : null;
        if (owner.warning) console.error('[collections browser] unreadable records', result.warnings);
        owner.state.phase = 'list'; renderCollectionBrowser(owner);
    } catch (error) {
        console.error('[collections browser] list failed', error);
        if (owner && _collectionBrowserOwner === owner && owner.view.root.isConnected !== false) {
            owner.state.phase = 'failed'; owner.state.error = error?.message || String(error);
            view.message(owner.view, 'Could not load collections: ' + owner.state.error, true);
        } else view.error(error);
    }
    return null;
}
window.showSavedCollections = () => showCollectionBrowser('feed');
function renderCollectionBrowser(owner) {
    if (!currentCollectionBrowser(owner)) return;
    const renderId = ++owner.renderId;
    const guard = callback => (...args) => {
        if (currentCollectionBrowser(owner) && owner.renderId === renderId) return callback(...args);
    };
    window.CList.ui.collectionBrowser.list(owner.view, { collections: owner.collections, load: owner.mode === 'load',
        busy: owner.state.busy, confirmKey: owner.state.confirmKey, error: owner.state.error, warning: owner.warning }, {
        open: guard(col => owner.mode === 'load' ? runCollectionBrowserAction(owner, col, 'edit')
            : col.feedSubscription ? runCollectionBrowserAction(owner, col, 'read') : _showCollectionDetail(col, owner.session.token, owner.session.encKey)),
        edit: guard(col => runCollectionBrowserAction(owner, col, 'edit')),
        confirm: guard(key => { if (owner.state.busy) return; owner.state.confirmKey = key; renderCollectionBrowser(owner); }),
        remove: guard(col => runCollectionBrowserAction(owner, col, 'delete')),
        back: guard(() => populateLoadOptions()),
    });
    if (owner.view.imports && typeof mountCollectionImports === 'function') {
        mountCollectionImports(owner.view.imports, owner.session, () => currentCollectionBrowser(owner));
    }
}
async function runCollectionBrowserAction(owner, selected, action) {
    if (!currentCollectionBrowser(owner) || owner.state.busy || !owner.collections.includes(selected)) return;
    owner.state.busy = true; owner.state.error = null;
    const col = structuredClone(selected);
    renderCollectionBrowser(owner);
    try {
        assertCollectionSession(owner.session);
        if (col.feedSubscription) {
            const account = (window.CList.accounts || []).find(record => record.key === col.key);
            if (!account || account.value !== owner.accountValues.get(col.key)) throw new Error('The feed account changed. Reopen Collections before continuing.');
            if (action === 'read') await switchReaderAccount(col.key);
            else if (action === 'edit') {
                revealEditorPane();
                await window.CList.readers[col.feedSubscription.type].editCollection(col.key, col.feedSubscription);
            } else {
                await deleteAccount(col.key, { ...owner.session, isCurrent: () => currentCollectionBrowser(owner)
                    && (window.CList.accounts || []).find(record => record.key === col.key)?.value === owner.accountValues.get(col.key) });
                if (!currentCollectionBrowser(owner)) return;
                window.CList.accounts = window.CList.accounts.filter(record => record.key !== col.key || record.value !== owner.accountValues.get(col.key));
                if (typeof populateReadAccountList === 'function') populateReadAccountList(window.CList.accounts);
                if (typeof updateUIVisibility === 'function') updateUIVisibility();
            }
        } else if (action === 'edit') {
            revealEditorPane();
            await _loadCollectionIntoEditor(col, owner.session.token, owner.session.encKey, () => currentCollectionBrowser(owner));
        } else if (action === 'delete') await deleteCollectionRecord(col,
            collectionDependencies({ ...owner.session, isCurrent: () => currentCollectionBrowser(owner) }));
        if (!currentCollectionBrowser(owner)) return;
        if (action === 'delete') {
            owner.collections = owner.collections.filter(item => item !== selected); owner.state.confirmKey = null;
            window.CList.ui.collectionBrowser.status(`Collection "${col.title || col.name}" deleted.`);
        }
    } catch (error) {
        console.error('[collections browser] action failed', error);
        if (currentCollectionBrowser(owner)) owner.state.error = error?.message || String(error);
        else window.CList.ui.collectionBrowser.error(error);
    } finally {
        owner.state.busy = false;
        if (currentCollectionBrowser(owner)) renderCollectionBrowser(owner);
    }
}
async function _showCollectionDetail(col, token, encKey) {
    clearCollectionBrowserHistory();
    const view = window.CList.ui.collectionBrowser;
    try {
    if (window.CList.state.reader && window.CList.state.reader.mode !== 'collections'
        && typeof invalidateReader === 'function') invalidateReader('collections');
    const session = beginCollectionSession({ token, encKey });
    const owner = collectionBrowserOwner('feed', session);
    owner.state.phase = 'detail'; owner.state.selectedKey = col.key;
    const collection = structuredClone(col); collection.name ||= collection.title; collection.items ||= [];
    owner.collections = [collection];
    const current = () => currentCollectionBrowser(owner);
    const act = callback => async (...args) => {
        if (!current() || owner.state.busy) return;
        owner.state.busy = true;
        try { await callback(...args); }
        catch (error) {
            console.error('[collections browser] detail action failed', error);
            if (current()) view.actionError(owner.view, error?.message || String(error));
            else view.error(error);
        } finally { owner.state.busy = false; }
    };
    try {
        assertCollectionSession(session);
        if (typeof history !== 'undefined') history.pushState({ collectionDetail: collection.name }, '');
        _collectionBrowserPopstate = () => { if (current()) window.showSavedCollections(); else clearCollectionBrowserHistory(); };
        window.addEventListener('popstate', _collectionBrowserPopstate);
        owner.view.detail = view.detail(owner.view, collection, {
            back: () => { if (current()) history.back(); },
            load: act(() => _loadCollectionIntoEditor(collection, token, encKey, current)),
            nest: act(anchor => _showAddToCollectionPicker(collection, token, encKey, anchor, current)),
            calendar: act(() => showCalendarForCollection(collection, token, encKey)),
            collab: act(async () => {
                if (typeof window.openCollabWithCollection !== 'function') throw new Error('Collab editor not available.');
                const flat = await _flattenForExport(collection.items, collection.id, token, encKey);
                if (current()) window.openCollabWithCollection(collection.name, flat);
            }),
            share: act(async () => {
                const flat = await _flattenForExport(collection.items, collection.id, token, encKey);
                if (current()) sendShareMessage('collection', null, collection.name, null,
                    { items: flat.map(item => ({ title: _collectionItemDisplayTitle(item), url: item.url })) });
            }),
        });
        await _renderCollectionItems(collection, token, encKey, owner.view.detail.count, owner.view.detail.items, current);
    } catch (error) {
        console.error('[collections browser] detail failed', error);
        if (current()) view.message(owner.view, 'Could not open collection: ' + (error?.message || String(error)), true);
        else view.error(error);
    }
    } catch (error) { view.error(error); }
}
window.CList.loaders ||= [];
window.CList.loaders.push({ label: 'My Collections', icon: 'collections', requiresLogin: true, requiresAccount: false,
    load: () => showCollectionBrowser('load') });
