/// <reference path="./clist-types.js" />
// Copyright Stephen Downes 2026. CC BY 4.0; provided AS IS, without warranty.

function collectionPublishingState() {
    return window.CList.state.collectionPublishing ||= { busy: false, selectedAccountKeys: [], operation: null };
}
function assertCollectionPublicationSession(session) {
    if (session.storeUrl !== window.CList.config.flaskSiteUrl
        || session.token !== (getSiteSpecificCookie(session.storeUrl, window.CList.keys.ACCESS_TOKEN) || ''))
        throw new Error('The account session changed. Reopen collection publishing.');
}
window.playCollectionPublish = async function playCollectionPublish() {
    const state = collectionPublishingState(), view = window.CList.ui.collectionPublishing;
    if (state.busy) return;
    try {
        if (window.CList.state.publishing?.busy || window.CList.state.webPagePublishing?.busy)
            throw new Error('Wait for the current publication to finish.');
        const fields = view.fields();
        if (!fields.name.trim()) throw new Error('Please enter a collection title before publishing.');
        const storeUrl = window.CList.config.flaskSiteUrl;
        const session = { storeUrl, token: getSiteSpecificCookie(storeUrl, window.CList.keys.ACCESS_TOKEN) || '' };
        const accounts = structuredClone(await ensureAccountsLoaded());
        assertCollectionPublicationSession(session);
        state.selectedAccountKeys = [];
        view.mount(accounts, state.selectedAccountKeys, key => {
            if (state.busy) return state.selectedAccountKeys.includes(key);
            const index = state.selectedAccountKeys.indexOf(key);
            if (index < 0) state.selectedAccountKeys.push(key); else state.selectedAccountKeys.splice(index, 1);
            return state.selectedAccountKeys.includes(key);
        }, () => runCollectionPublication(accounts, session));
    } catch (error) { view.fail(error); }
};

// Collection To Web Page is a single explicit bin target, using the same workflow.
async function postCollectionToWebPage() {
    const storeUrl = window.CList.config.flaskSiteUrl;
    const session = { storeUrl, token: getSiteSpecificCookie(storeUrl, window.CList.keys.ACCESS_TOKEN) || '' };
    return runCollectionPublication(null, session, { webPage: true });
}

/** @param {CListAccountRecord[]|null} accounts
 * @param {CListCollectionPublicationSession} session
 * @param {{webPage?: boolean}} [options]
 * @returns {Promise<CListCollectionPublicationOutcome|null|undefined>} */
async function runCollectionPublication(accounts, session, { webPage = false } = {}) {
    const state = collectionPublishingState(), view = window.CList.ui.collectionPublishing;
    if (state.busy) return;
    state.busy = true; state.operation = { status: 'preparing', destinations: [] };
    try {
        if (window.CList.state.publishing?.busy || window.CList.state.webPagePublishing?.busy
            || window.CList.state.collectionSaving?.active?.size) throw new Error('Wait for the current save or publication to finish.');
        view.setBusy(true); view.begin();
        assertCollectionPublicationSession(session);
        const draft = readActiveCollectionDraft();
        if (!draft?.name.trim()) throw new Error('Open a collection with a title before publishing.');
        const fields = view.fields(), source = _activeCollection?.col;
        const identity = _resolveCollectionIdentity(source?.key, source?.id);
        // Capture draft, identity, source, and session before loading accounts or keys.
        const sourceEditor = typeof currentEditor === 'undefined' ? null : currentEditor;
        const sourcePage = typeof currentLoadedPage === 'undefined' ? null : currentLoadedPage;
        const request = structuredClone({ name: draft.name.trim(), formatId: fields.formatId,
            identity, items: draft.items, publishedUrls: source?.publishedUrls || [],
            page: sourcePage, targets: [], overwriteKey: null });
        _activeCollection = { ..._activeCollection, col: { ...source, ...identity } }; _refreshIdDisplay();
        const active = _activeCollection.col;
        if (webPage) {
            if (!window.CList.binPublishers?.CListBin) throw new Error('Web-page publishing is not available.');
            accounts = structuredClone(await ensureAccountsLoaded());
            assertCollectionPublicationSession(session);
            const record = accounts.find(record => {
                const account = parseAccountValue(record);
                return account?.type === 'CListBin' && (account.permissions || '').includes('b');
            });
            if (!record) throw new Error('No web-page destination is set up. Log out and back in to add one.');
            request.targets = [{ key: record.key, account: structuredClone(parseAccountValue(record)) }];
        } else {
            request.targets = state.selectedAccountKeys.map(key => {
                const record = accounts.find(a => a.key === key);
                const account = record && parseAccountValue(record);
                return account && { key, account: structuredClone(account) };
            }).filter(t => t && ((t.account.permissions || '').includes('b') || (t.account.permissions || '').includes('w')));
        }
        const targets = request.targets;
        if (!targets.length) throw new Error('No destinations selected.');
        const catalogFallback = structuredClone(accounts.map(parseAccountValue).filter(Boolean)
            .find(a => a.type === 'CListBin' && (a.permissions || '').includes('b')) || null);
        session = { ...session, encKey: session.token ? await getEncKey(session.storeUrl) : null };
        assertCollectionPublicationSession(session);
        const match = collectionOverwriteTarget(request.page, targets, request.formatId, window.CList.binPublishers, identity);
        if (match) {
            state.operation.status = 'choosing';
            const choice = await view.choose(match.account);
            if (choice === null) { state.operation.status = 'cancelled'; return null; }
            if (choice === 'overwrite') request.overwriteKey = match.key;
        }
        if (!session.encKey && request.items.some(item => item.role === 'contains'))
            throw new Error('Log in before publishing a collection containing nested collections.');
        state.operation.status = 'publishing';
        const outcome = await runCollectionPublishingWorkflow(request, {
            publishers: window.CList.publishers, bins: window.CList.binPublishers, formats: collectionFormats,
            flatten: items => session.encKey ? _flattenForExport(items, identity.id, session.token, session.encKey)
                : items.filter(item => item.url && !item.url.startsWith('blob:') && item.role !== 'contains'),
            assertSession: () => assertCollectionPublicationSession(session), now: () => new Date().toISOString(),
            save: async (snapshot, urls) => {
                if (!session.token || !session.encKey) throw new Error('Log in to record the published collection in My Pages.');
                await _kvSaveItems(snapshot.identity.key, snapshot.identity.id, snapshot.name,
                    snapshot.items, session.token, session.encKey, urls);
            },
            onUpdate: event => {
                if (event.type === 'destination') {
                    const rows = state.operation.destinations;
                    const i = rows.findIndex(r => r.key === event.result.key);
                    if (i < 0) rows.push(structuredClone(event.result)); else rows[i] = structuredClone(event.result);
                }
                view.update(event);
            },
        });
        state.operation = { ...structuredClone(outcome), status: 'complete' };
        if (outcome.metadataError) view.message('Published, but could not update My Pages: ' + outcome.metadataError, true);
        if (outcome.metadataSaved) {
          try {
            assertCollectionPublicationSession(session);
            if (_activeCollection?.col === active) {
                const newer = readActiveCollectionDraft();
                const sourceStillActive = webPage && newer
                    && (typeof currentEditor === 'undefined' ? null : currentEditor) === sourceEditor
                    && (typeof currentLoadedPage === 'undefined' ? null : currentLoadedPage) === sourcePage
                    && JSON.stringify(sourcePage) === JSON.stringify(request.page)
                    && newer.name.trim() === request.name
                    && JSON.stringify(newer.items) === JSON.stringify(request.items);
                _activeCollection = { ..._activeCollection, col: { ...active,
                    name: newer?.name ?? active.name, items: newer?.items ?? active.items,
                    publishedUrls: structuredClone(outcome.publishedUrls) } };
                if (newer) _refreshIdDisplay();
                if (sourceStillActive) {
                    const account = request.targets[0].account;
                    const publication = outcome.publishedUrls.filter(p => p.url === outcome.primaryUrl
                        && p.service === account.type && p.accountInstance === account.instance).at(-1);
                    if (publication) setLoadedPage({ kind: 'collection', collectionKey: request.identity.key,
                        id: request.identity.id, title: request.name, ...publication });
                }
            }
            const catalog = request.targets.find(t => t.account.type === 'CListBin' && t.account.permissions?.includes('b')
                && outcome.destinations.some(r => r.key === t.key && r.status === 'published'))?.account || catalogFallback;
            if (catalog) await _updatePagesCatalog(session.token, session.encKey, catalog, {
                assertSession: () => assertCollectionPublicationSession(session), throwOnError: true,
            });
          } catch (error) {
            console.error('[collection publish] completion action failed', error);
            view.message('Published and recorded, but the completion action failed: ' + error.message, true);
          }
        }
        return outcome;
    } catch (error) {
        state.operation = { ...state.operation, status: 'failed', error: error.message }; view.fail(error); return null;
    } finally { state.busy = false; view.setBusy(false); }
}
