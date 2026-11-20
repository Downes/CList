/// <reference path="./clist-types.js" />
// Import operation/controller. Incoming bodies and captured credentials remain private.
let _collectionImportOwner = null;
/** @returns {CListCollectionImportState} */
function collectionImportState() { return window.CList.state.collectionImport ||= { generation: 0, phase: 'idle', busy: false, error: null }; }
function collectionImportBaseCurrent(owner) {
    return _collectionImportOwner === owner && !owner.closed && (!owner.view || owner.view.root.isConnected !== false)
        && owner.readerId === window.CList.state.reader?.requestId && (!owner.external || owner.external());
}
function currentCollectionImport(owner) {
    if (!collectionImportBaseCurrent(owner)) return false;
    try { assertCollectionSession(owner.session); return true; } catch { return false; }
}
function beginCollectionImport(token, encKey, external) {
    if (_collectionImportOwner) _collectionImportOwner.closed = true;
    const state = window.CList.state.collectionImport = { generation: collectionImportState().generation + 1, phase: 'preparing', busy: false, error: null };
    const owner = _collectionImportOwner = { state, readerId: window.CList.state.reader?.requestId, external, closed: false, view: null, renderId: 0 };
    owner.session = beginCollectionSession({ token, encKey, isCurrent: () => collectionImportBaseCurrent(owner) });
    return owner;
}
function collectionImportDependencies(owner) {
    const deps = collectionDependencies(owner.session);
    return { assertCurrent: () => { if (!currentCollectionImport(owner)) throw new Error('The collection import is no longer current.'); },
        read: key => readCollectionSnapshot(key, deps), save: (key, record, options) => saveCollectionRecord(key, record, deps, options) };
}
function collectionImportFail(owner, error) {
    console.error('[collection import]', error);
    if (!collectionImportBaseCurrent(owner)) return;
    if (!currentCollectionImport(owner) && owner.session.token) { owner.state.busy = false; owner.state.phase = 'cancelled'; return; }
    owner.state.busy = false; owner.state.phase = 'failed'; owner.state.error = error?.message || String(error);
    window.CList.ui.collectionImport.busy(owner.view, false); window.CList.ui.collectionImport.failure(owner.view, error);
}
function cancelCollectionImport(owner) {
    if (!currentCollectionImport(owner)) return;
    owner.closed = true; owner.state.phase = 'cancelled'; owner.state.busy = false;
    if (owner.chat) window.CList.ui.collectionImport.close(owner.view);
    else window.showSavedCollections();
}
function showCollectionImportPreview(owner, parsed) {
    if (!currentCollectionImport(owner)) return;
    owner.parsed = structuredClone(parsed); owner.external = null;
    owner.view = window.CList.ui.collectionImport.mount(window.CList.ui.view.feedContainer);
    owner.state.phase = 'preview'; owner.state.busy = false;
    const generation = ++owner.renderId;
    window.CList.ui.collectionImport.preview(owner.view, owner.parsed, {
        save: name => { if (generation === owner.renderId) return saveCollectionImport(owner, name); },
        cancel: () => { if (generation === owner.renderId && !owner.state.busy) cancelCollectionImport(owner); },
    });
}
async function saveCollectionImport(owner, name, selected = null) {
    if (!currentCollectionImport(owner) || owner.state.busy) return;
    owner.state.busy = true; window.CList.ui.collectionImport.busy(owner.view, true);
    try {
        const identity = selected ? (selected.id ? { key: selected.key, id: selected.id } : { key: selected.key, id: _newCollectionIdentity().id })
            : (owner.newIdentity ||= _resolveCollectionIdentity(null, owner.parsed.id));
        const request = captureCollectionImportRequest(owner.parsed, name, identity), deps = collectionImportDependencies(owner);
        const existing = await deps.read(request.key); deps.assertCurrent();
        if (selected && collectionImportSnapshot(existing) !== collectionImportSnapshot(selected)) throw new Error('The destination collection changed. Select it again before saving.');
        if (existing) {
            owner.state.phase = 'conflict'; owner.state.busy = false;
            const generation = ++owner.renderId;
            const choose = mode => {
                if (!currentCollectionImport(owner) || owner.state.busy || generation !== owner.renderId) return;
                return commitCollectionImport(owner, request, mode, existing);
            };
            window.CList.ui.collectionImport.conflict(owner.view, request.name, { overwrite: () => choose('overwrite'), merge: () => choose('merge'),
                cancel: () => {
                    if (!currentCollectionImport(owner) || owner.state.busy || generation !== owner.renderId) return;
                    if (owner.chat) renderChatCollectionChoices(owner); else showCollectionImportPreview(owner, owner.parsed);
                } });
        } else await commitCollectionImport(owner, request, 'new', null);
    } catch (error) { collectionImportFail(owner, error); }
}
async function commitCollectionImport(owner, request, mode, expected) {
    if (!currentCollectionImport(owner)) return;
    owner.state.busy = true; owner.state.phase = 'saving'; window.CList.ui.collectionImport.busy(owner.view, true);
    try {
        const result = await persistCollectionImport(request, mode, expected, collectionImportDependencies(owner));
        owner.state.phase = 'saved'; owner.state.busy = false;
        if (!currentCollectionImport(owner)) return result;
        window.CList.ui.collectionImport.status(mode === 'merge' ? `Added ${result.added} item${result.added === 1 ? '' : 's'} to "${result.name}".` : `Saved as "${result.name}".`);
        owner.closed = true;
        if (owner.chat) window.CList.ui.collectionImport.close(owner.view); else await window.showSavedCollections();
        return result;
    } catch (error) { collectionImportFail(owner, error); }
}
async function readCollectionImport(source, token, encKey, external) {
    const owner = beginCollectionImport(token, encKey, external), ui = window.CList.ui.collectionImport;
    owner.external = null; owner.view = ui.mount(window.CList.ui.view.feedContainer);
    ui.message(owner.view, source.file ? 'Reading file…' : 'Fetching…'); owner.state.phase = 'reading'; owner.state.busy = true;
    try {
        await prepareCollectionSession(owner.session);
        let text, mimeType, name;
        if (source.file) { name = source.file.name; mimeType = source.file.type; text = await source.file.text(); }
        else {
            if (!/^https?:\/\//i.test(source.url || '')) throw new Error('Enter an HTTP or HTTPS collection URL.');
            const response = await fetch(source.url); if (!response.ok) throw new Error(`HTTP ${response.status}`);
            mimeType = response.headers?.get('Content-Type') || ''; name = source.url; text = await response.text();
        }
        if (!currentCollectionImport(owner)) return;
        showCollectionImportPreview(owner, recognizeCollectionImport(text, mimeType, name, recognizeSavedContent));
    } catch (error) { collectionImportFail(owner, error); }
}
async function _showCollectionImportPreview(parsed, token, encKey) {
    const owner = beginCollectionImport(token, encKey);
    try { await prepareCollectionSession(owner.session); showCollectionImportPreview(owner, parsed); }
    catch (error) { window.CList.ui.collectionImport.error(error); }
}
function _importCollectionFromUrl(url, token, encKey) { return readCollectionImport({ url }, token, encKey); }
function _importCollectionFromFile(file, token, encKey) { return readCollectionImport({ file }, token, encKey); }
function mountCollectionImports(target, session, isCurrent) {
    window.CList.ui.collectionImport.sources(target, {
        url: url => { if (isCurrent()) return readCollectionImport({ url }, session.token, session.encKey, isCurrent); },
        file: file => { if (isCurrent()) return readCollectionImport({ file }, session.token, session.encKey, isCurrent); },
    });
}
function renderChatCollectionChoices(owner) {
    if (!currentCollectionImport(owner)) return;
    owner.state.busy = false; owner.state.phase = 'choosing'; ++owner.renderId;
    const generation = owner.renderId;
    window.CList.ui.collectionImport.choices(owner.view, owner.collections, (title, col) => {
        if (generation === owner.renderId) return saveCollectionImport(owner, title, col);
    }, owner.anchor);
}
window.importCollectionFromChat = async function(items, anchorEl) {
    const existing = anchorEl.nextElementSibling;
    if (existing?.classList.contains('collection-picker')) { existing.remove(); return; }
    let owner;
    try {
        owner = beginCollectionImport(); owner.chat = true; owner.anchor = anchorEl;
        owner.parsed = { items: structuredClone(items) }; owner.view = window.CList.ui.collectionImport.chat(anchorEl);
        window.CList.ui.collectionImport.message(owner.view, 'Loading…');
        await prepareCollectionSession(owner.session);
        const result = await listCollectionRecords(collectionDependencies(owner.session));
        if (!currentCollectionImport(owner)) return;
        owner.collections = result.collections; renderChatCollectionChoices(owner);
    } catch (error) { if (owner?.view) collectionImportFail(owner, error); else window.CList.ui.collectionImport.error(error); }
};
