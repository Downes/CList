/// <reference path="./clist-types.js" />
// My Pages controller. Session keys, row captures and deletion receipts are transient.
let _myPagesOwner = null;
function myPagesState() { return window.CList.state.myPages ||= createMyPagesState(); }
function currentMyPages(owner) {
    return _myPagesOwner === owner && !owner.closed && owner.view.root.isConnected
        && owner.username === window.CList.state.username && owner.session.storeUrl === window.CList.config.flaskSiteUrl
        && owner.session.token === getSiteSpecificCookie(owner.session.storeUrl, window.CList.keys.ACCESS_TOKEN);
}
function myPagesDependencies(owner) {
    const kv = window.CList.storage.kv;
    return { assertSession: () => {
        if (!currentMyPages(owner)) throw new Error('My Pages is no longer current. Reopen it before continuing.');
        assertAccountSession(owner.session);
    }, list: () => kv.list(), remove: key => kv.remove(key), update: (key, value) => kv.update(key, value),
    decrypt: value => decryptKVJson(owner.session.encKey, value), encrypt: value => encryptWithKey(owner.session.encKey, value),
    parseCollection: _parseCollectionData, fetch: url => fetch(url) };
}
function renderMyPages(owner) {
    if (!currentMyPages(owner)) return;
    const state = myPagesState(), slice = sliceMyPages(owner.pages, state);
    state.pageIndex = slice.pageIndex;
    const generation = ++owner.renderGeneration;
    const valid = () => currentMyPages(owner) && owner.renderGeneration === generation;
    const action = callback => (...args) => { if (valid()) return callback(...args); };
    window.CList.ui.myPages.render(owner.view, { state, slice, confirm: owner.confirm,
        warning: [owner.warning, state.error].filter(Boolean).join(' '), canLoad: page => !!page.url && (page.kind === 'page' || !!_collectionFormatParsers[page.format]) }, {
        sort: action(key => { if (state.busy) return; window.CList.state.myPages = sortMyPages(state, key); renderMyPages(owner); }),
        size: action(value => { if (state.busy) return; state.pageSize = value === 'All' ? 'All' : Number(value); state.pageIndex = 0; renderMyPages(owner); }),
        page: action(index => { if (state.busy) return; state.pageIndex = index; renderMyPages(owner); }),
        confirm: action(page => { if (state.busy) return; owner.confirm = page; renderMyPages(owner); }),
        load: action(page => runMyPagesAction(owner, page, 'load')),
        remove: action(page => runMyPagesAction(owner, page, 'delete')),
        open: action(page => { if (!state.busy) window.open(page.url, '_blank', 'noopener'); }),
        copy: action(page => { if (!state.busy) copyToClipboard(page.url, { successMsg: 'URL copied.', failMsg: 'Could not copy URL.' }); }),
    });
}
async function showMyPages() {
    const view = window.CList.ui.myPages;
    const storeUrl = window.CList.config.flaskSiteUrl;
    const owner = { session: { storeUrl, token: getSiteSpecificCookie(storeUrl, window.CList.keys.ACCESS_TOKEN), encKey: null },
        username: window.CList.state.username, pages: [], receipts: new Map(), uncertain: new Set(), renderGeneration: 0, closed: false };
    if (!owner.session.token) { view.error(new Error('Please log in to view your pages.')); return null; }
    const oldGeneration = myPagesState().generation;
    window.CList.state.myPages = createMyPagesState(oldGeneration + 1);
    _myPagesOwner = owner;
    owner.view = view.mount(() => { owner.closed = true; if (_myPagesOwner === owner) myPagesState().phase = 'closed'; });
    view.message(owner.view, 'Loading pages…');
    try {
        owner.session.encKey = await getEncKey(storeUrl);
        const result = await listMyPages(myPagesDependencies(owner));
        if (!currentMyPages(owner)) return null;
        owner.pages = result.pages;
        owner.warning = result.warnings.length ? `${result.warnings.length} unreadable page/collection record(s) were skipped.` : null;
        if (result.warnings.length) console.error('[mypages] unreadable records', result.warnings);
        myPagesState().phase = 'ready'; renderMyPages(owner);
    } catch (error) {
        console.error('[mypages] list failed', error);
        if (currentMyPages(owner)) { myPagesState().phase = 'failed'; myPagesState().error = error.message; view.message(owner.view, 'Could not load pages: ' + error.message, true); }
    }
    return null;
}
async function runMyPagesAction(owner, selected, kind) {
    if (!currentMyPages(owner) || myPagesState().busy || !owner.pages.includes(selected)) return;
    if (kind === 'delete' && owner.uncertain.has(selected)) {
        myPagesState().error = 'The previous remote deletion could not be confirmed. Check the original service before deleting again. The My Pages record was kept.';
        renderMyPages(owner); return;
    }
    const state = myPagesState(); state.busy = kind; state.error = null;
    const page = structuredClone(selected), sourceEditor = currentEditor, sourcePage = currentLoadedPage;
    const sourceAccount = typeof currentEditorAccount === 'undefined' ? null : currentEditorAccount;
    const ids = () => ['editorControls', 'editorLoading', 'editorSwitching'].map(key => window.CList.state[key]?.id || 0).join(':');
    const sourceIds = ids();
    const sourceCurrent = () => currentMyPages(owner) && currentEditor === sourceEditor && currentLoadedPage === sourcePage
        && (typeof currentEditorAccount === 'undefined' ? null : currentEditorAccount) === sourceAccount && ids() === sourceIds;
    renderMyPages(owner);
    try {
        const deps = myPagesDependencies(owner);
        deps.assertSession();
        if (kind === 'load') {
            const text = await fetchMyPage(page, deps);
            if (!sourceCurrent()) return;
            const controlsId = window.CList.state.editorControls?.id;
            const loadOwnerCurrent = () => _myPagesOwner === owner && !owner.closed
                && owner.username === window.CList.state.username && owner.session.storeUrl === window.CList.config.flaskSiteUrl
                && owner.session.token === getSiteSpecificCookie(owner.session.storeUrl, window.CList.keys.ACCESS_TOKEN)
                && controlsId === window.CList.state.editorControls?.id;
            if (page.kind === 'collection') {
                const parsed = _collectionFormatParsers[page.format](text);
                await loadSavedPage({ type: page.mimeType || 'text/plain', value: text, sourceText: text,
                    collection: parsed, format: page.format.toLowerCase(), recognized: true }, page, owner.view.root,
                    () => showMyPages(), loadOwnerCurrent);
            } else await loadSavedPage({ type: page.mimeType, value: text }, page, owner.view.root, () => showMyPages(), loadOwnerCurrent);
        } else {
            const receipt = owner.receipts.get(selected);
            if (page.serviceId && page.service && !receipt?.remoteDeleted) {
                const account = findWebPageAccount(page, window.CList.accounts || [], parseAccountValue);
                const adapter = window.CList.binPublishers?.[page.service];
                if (!adapter?.delete) throw new Error('The original destination cannot delete this page. Its My Pages record was kept.');
                deps.deleteRemote = async id => {
                    deps.assertSession();
                    try { await adapter.delete(id, account); }
                    catch (error) {
                        owner.uncertain.add(selected);
                        throw new Error('Remote deletion could not be confirmed. The My Pages record was kept; check the original service before retrying. ' + (error.message || String(error)));
                    }
                };
            }
            const result = await deleteMyPage(page, receipt, deps);
            owner.receipts.set(selected, result);
            if (!currentMyPages(owner)) return;
            if (result.metadataError) throw new Error((result.remoteDeleted ? 'Remote page deleted, but My Pages cleanup failed. Retry Delete to clean up the record only: ' : 'Could not remove the My Pages record: ') + result.metadataError);
            owner.pages = owner.pages.filter(item => item !== selected); owner.confirm = null;
            window.CList.ui.myPages.status('Page removed.');
        }
    } catch (error) {
        if (currentMyPages(owner)) { console.error('[mypages] operation failed', error); state.error = error.message; }
        else console.error('[mypages] operation ended after its owner expired', error);
    } finally {
        state.busy = null;
        if (currentMyPages(owner)) renderMyPages(owner);
    }
}
window.CList.loaders ||= [];
window.CList.loaders.push({ label: 'My Pages', icon: 'cloud_done', requiresLogin: true, requiresAccount: false, load: showMyPages });
