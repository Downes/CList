/// <reference path="./clist-types.js" />
// Local collection entry controller; uses the shared DOM-free page workflow.
// Copyright Stephen Downes 2026. CC BY 4.0; provided AS IS, without warranty.

/** @param {CListCollectionMember} item
 * @param {function(): void} refresh
 * @returns {Promise<CListWebPageOutcome|null|undefined>} */
async function _publishLocalEntry(item, refresh) {
    if (typeof item.url !== 'string' || !item.url.startsWith('blob:')) return;
    const state = collectionPublishingState(), view = window.CList.ui.collectionPublishing;
    if (state.busy) return;
    const storeUrl = window.CList.config.flaskSiteUrl;
    /** @type {CListCollectionPublicationSession & {authorDid: string|null}} */
    const session = { storeUrl, token: getSiteSpecificCookie(storeUrl, window.CList.keys.ACCESS_TOKEN) || '',
        authorDid: _currentAuthorDid() };
    const owner = JSON.stringify([storeUrl, window.CList.state.username || '']);
    const snapshot = structuredClone(item), fingerprint = JSON.stringify(snapshot);
    const collection = _activeCollection?.col, items = _draftItems;
    const editor = typeof currentEditor === 'undefined' ? null : currentEditor;
    /** @type {WeakMap<CListCollectionMember, CListLocalEntryReceipt>} */
    const attempts = state.entryAttempts ||= new WeakMap();
    const previous = attempts.get(item);
    if (previous?.sourceUrl === snapshot.url && previous.owner === owner) {
        view.localEntryResult(previous.result, snapshot.title || 'Untitled', false);
        return structuredClone(previous.result);
    }
    state.busy = true; state.operation = { status: 'preparing', destinations: [] };
    try {
        if (window.CList.state.publishing?.busy || window.CList.state.webPagePublishing?.busy
            || window.CList.state.collectionSaving?.active?.size) throw new Error('Wait for the current save or publication to finish.');
        if (!items?.includes(item)) throw new Error('This entry is no longer in the active collection.');
        view.setBusy(true);
        const adapter = window.CList.binPublishers?.CListBin;
        if (typeof adapter?.publish !== 'function') throw new Error('Web-page publishing is not available.');
        assertCollectionPublicationSession(session);
        const accounts = structuredClone(await ensureAccountsLoaded());
        assertCollectionPublicationSession(session);
        const account = accounts.map(parseAccountValue).filter(Boolean)
            .find(a => a.type === 'CListBin' && (a.permissions || '').includes('b'));
        if (!account) throw new Error('No web-page destination is set up. Log out and back in to add one.');
        session.encKey = session.token ? await getEncKey(storeUrl) : null;
        assertCollectionPublicationSession(session);
        const response = await fetch(snapshot.url);
        if (!response.ok) throw new Error('Could not read the local entry (HTTP ' + response.status + ').');
        const content = await response.text();
        /** @type {CListWebPageRequest} */
        const request = { title: snapshot.title || 'Untitled', content, mimeType: snapshot.mimeType || 'text/plain',
            authorDid: session.authorDid, page: null, service: 'CListBin' };
        state.operation.status = 'publishing';
        const result = await runWebPagePublication(request, 'new', {
            adapter, account, createId: () => `urn:uuid:${crypto.randomUUID()}`, now: () => new Date().toISOString(),
            embedIdentity: _embedWebPageIdentity,
            assertSession: () => assertCollectionPublicationSession(session),
            saveRecord: record => _saveWebPageRecord(record, session),
        });
        // Retain the receipt even if the entry was removed or its UI changed.
        attempts.set(item, { owner, sourceUrl: snapshot.url, result: structuredClone(result) });
        state.operation = { status: 'complete', entry: structuredClone(result) };
        let updated = false;
        if (result.status === 'published' && _activeCollection?.col === collection && _draftItems === items
            && (typeof currentEditor === 'undefined' ? null : currentEditor) === editor
            && items.includes(item) && JSON.stringify(item) === fingerprint) {
            try {
                assertCollectionPublicationSession(session);
                item.url = result.url; item.localOnly = false; updated = true;
                URL.revokeObjectURL(snapshot.url);
                refresh();
            } catch (error) {
                console.error('[collection entry] reconciliation failed', error);
                view.message('Published, but could not refresh the entry: ' + error.message, true);
            }
        }
        view.localEntryResult(result, request.title, updated);
        return result;
    } catch (error) {
        state.operation = { ...state.operation, status: 'failed', error: error.message };
        view.localEntryFailed(error); return null;
    } finally { state.busy = false; view.setBusy(false); }
}
