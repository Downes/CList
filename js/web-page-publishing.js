/// <reference path="./clist-types.js" />
// Editor/request capture and standalone page publication controller.
// Copyright Stephen Downes 2026. CC BY 4.0; provided AS IS, without warranty.

function _webPagePublishingState() {
    return window.CList.state.webPagePublishing ||= { busy: false, status: 'idle', result: null };
}

async function _getWebPageEditorContent(handler, fallbackType) {
    const result = typeof handler?.getPublishContent === 'function'
        ? await handler.getPublishContent()
        : { type: fallbackType || handler?.contentTypes?.[0] || 'text/plain', value: typeof handler?.getContent === 'function' ? await handler.getContent() : '' };
    if (!result || typeof result.value !== 'string' || typeof result.type !== 'string') throw new Error('The editor returned invalid web-page content.');
    return result;
}

async function postToWebPage() { return _runStandaloneWebPageAction(false); }
async function _republishStandalonePage() { return _runStandaloneWebPageAction(true); }

async function playRepublish() {
    if (window.CList.state.collectionPublishing?.busy) { showStatusMessage('Wait for collection publication to finish.'); return; }
    if (!currentLoadedPage) return;
    if (currentLoadedPage.kind === 'collection') {
        if (typeof window.republishCollection === 'function') await window.republishCollection();
        return;
    }
    return _republishStandalonePage();
}

async function _runStandaloneWebPageAction(republish) {
    const state = _webPagePublishingState();
    if (state.busy) return;
    const view = window.CList.ui.webPagePublishing;
    if (window.CList.state.publishing?.busy || window.CList.state.collectionPublishing?.busy) {
        const kind = window.CList.state.publishing?.busy ? 'post' : 'collection';
        view.fail(new Error('Wait for the current ' + kind + ' publication to finish before publishing a web page.'), republish);
        return;
    }
    const sourcePage = currentLoadedPage;
    const sourceEditor = currentEditor;
    const page = sourcePage ? structuredClone(sourcePage) : null;
    const handler = editorHandlers[sourceEditor];
    const title = republish ? (page?.title || '') : view.readTitle();
    const service = republish ? page?.service : 'CListBin';
    const storeUrl = window.CList.config.flaskSiteUrl;
    const token = getSiteSpecificCookie(storeUrl, window.CList.keys.ACCESS_TOKEN);
    const authorDid = _currentAuthorDid();
    state.busy = true; state.status = 'preparing'; state.result = null; delete state.error;
    try {
        view.begin(republish); view.setBusy(true);
        const output = await _getWebPageEditorContent(handler, republish ? page?.mimeType : undefined);
        if (!output.value.trim()) throw new Error('Nothing to publish - the editor is empty.');
        const session = { storeUrl, token, encKey: await getEncKey(storeUrl), authorDid };
        assertAccountSession(session);
        const accounts = await ensureAccountsLoaded();
        assertAccountSession(session);
        const account = republish ? findWebPageAccount(page, accounts, parseAccountValue)
            : structuredClone(accounts.map(parseAccountValue).filter(Boolean).find(data => data.type === 'CListBin' && (data.permissions || '').includes('b')));
        if (!account) throw new Error('No web-page destination is set up. Log out and back in to add one.');
        const adapter = window.CList.binPublishers?.[service];
        if (!adapter) throw new Error('Web-page publishing is not available for this destination.');
        const request = { title, content: output.value, mimeType: output.type, page, authorDid, service };
        let mode = republish ? 'overwrite' : 'new';
        if (!republish && page?.kind === 'page') {
            state.status = 'awaiting-choice';
            mode = await view.chooseVersion(canOverwriteWebPage(request, account));
            if (mode === 'cancel') { state.status = 'cancelled'; return null; }
        }
        state.status = 'publishing';
        const result = await runWebPagePublication(request, mode, {
            adapter, account, createId: () => `urn:uuid:${crypto.randomUUID()}`, now: () => new Date().toISOString(),
            embedIdentity: _embedWebPageIdentity, assertSession: () => assertAccountSession(session),
            saveRecord: record => _saveWebPageRecord(record, session),
            touchRecord: (key, id, extra) => _touchOrForkWebPageRecord(key, id, extra, session),
            recordLocalPublication: (id, publication) => window.CList.pageStore.recordPublication(id, publication),
        });
        state.result = structuredClone(result); state.status = result.status;
        const sourceStillActive = currentEditor === sourceEditor && currentLoadedPage === sourcePage;
        if (sourceStillActive) {
            if (result.loadedPage) setLoadedPage(result.loadedPage);
            else if (result.localPublication) {
                Object.assign(currentLoadedPage, result.localPublication);
                if (typeof updateLoadedPageUI === 'function') updateLoadedPageUI();
            }
        }
        view.published(result, republish && sourceStillActive);
        return result;
    } catch (error) {
        state.status = 'failed'; state.error = error.message;
        view.fail(error, republish && currentEditor === sourceEditor && currentLoadedPage === sourcePage);
        return null;
    } finally { state.busy = false; view.setBusy(false); }
}
