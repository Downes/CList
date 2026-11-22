/// <reference path="./clist-types.js" />
// Captured local-save controller. Credentials remain transient, outside shared state.
let _localFileHandleSession = null;
async function saveContent() {
    /** @type {CListLocalFileSaveState} */
    const state = window.CList.state.fileSave ||= { busy: false, status: 'ready' };
    if (state.busy) return null;
    state.busy = true; state.status = 'preparing'; state.result = null; state.error = null;
    try {
        const sourceEditor = currentEditor, sourcePage = currentLoadedPage;
        const switchId = window.CList.state.editorSwitching?.id, loadId = window.CList.state.editorLoading?.id;
        const controlsId = window.CList.state.editorControls?.id;
        const sourceAccount = typeof currentEditorAccount === 'undefined' ? null : currentEditorAccount;
        // 'none' is the logged-out sentinel (kvstore.js), not a real username — treat it the
        // same way isRegistered() does everywhere else, or a guest save wrongly tries to index
        // itself into My Pages and fails with a confusing "log in again" error. assertCurrent()
        // re-reads live state later, so it must normalize the same way to compare apples to apples.
        const normalizeUsername = raw => (raw && raw !== 'none') ? raw : null;
        const username = normalizeUsername(window.CList.state.username);
        const storeUrl = window.CList.config.flaskSiteUrl;
        const token = username ? getSiteSpecificCookie(storeUrl, window.CList.keys.ACCESS_TOKEN) : null;
        const request = { editor: sourceEditor, handler: editorHandlers[sourceEditor],
            page: sourcePage ? structuredClone(sourcePage) : null, references: structuredClone(getReferences()),
            title: window.CList.ui.view.writeTitle?.textContent || window.CList.ui.view.writeTitle?.innerText || '',
            referenceHtml: document.getElementById('writeReferences')?.innerHTML || '',
            loggedIn: !!username, authorDid: username ? _currentAuthorDid() : null,
            id: username ? (sourcePage?.pageKey && sourcePage.id ? sourcePage.id : `urn:uuid:${crypto.randomUUID()}`) : null };
        const assertCurrent = () => {
            if (normalizeUsername(window.CList.state.username) !== username || window.CList.config.flaskSiteUrl !== storeUrl
                || (username && getSiteSpecificCookie(storeUrl, window.CList.keys.ACCESS_TOKEN) !== token)) {
                throw new Error('The session changed. Save the file again from the current session.');
            }
        };
        let session;
        const getSession = async () => {
            if (!session) session = { storeUrl, token, authorDid: request.authorDid, encKey: await getEncKey(storeUrl), isCurrent: () => {
                assertCurrent(); return true;
            } };
            assertAccountSession(session);
            return session;
        };
        const output = await prepareLocalFile(request, { packagePost });
        if (!output) { state.status = 'cancelled'; return null; }
        state.status = 'saving';
        const result = await runLocalFileSave(request, output, {
            assertCurrent, now: () => new Date().toISOString(),
            write: (content, id, name) => {
                assertCurrent();
                const scope = _localFileHandleSession;
                if (!scope || scope.username !== username || scope.storeUrl !== storeUrl || scope.token !== token) {
                    for (const key of Object.keys(_localFileHandles)) delete _localFileHandles[key];
                    _localFileHandleSession = { username, storeUrl, token };
                }
                return _writeLocalFile(content, id, name, assertCurrent);
            },
            saveRecord: async record => _saveWebPageRecord(record, await getSession()),
            touch: async (key, id, extra) => _touchOrForkWebPageRecord(key, id, extra, await getSession()),
            aliasHandle: (from, to) => { if (_localFileHandles[from]) _localFileHandles[to] = _localFileHandles[from]; },
        });
        state.status = result.metadataError ? 'metadata-failed' : result.status;
        // Keep receipts without retaining Error objects, editor APIs, handles or credentials in state.
        state.result = { status: result.status, receipt: result.receipt || null,
            metadataError: result.metadataError?.message || null };
        let sameSession = true;
        try { assertCurrent(); } catch { sameSession = false; }
        if (sameSession && result.loadedPage && currentEditor === sourceEditor && currentLoadedPage === sourcePage
            && window.CList.state.editorSwitching?.id === switchId && window.CList.state.editorLoading?.id === loadId
            && window.CList.state.editorControls?.id === controlsId
            && (typeof currentEditorAccount === 'undefined' ? null : currentEditorAccount) === sourceAccount) {
            setLoadedPage(result.loadedPage);
        }
        showLocalFileSaveResult(result);
        return result;
    } catch (error) {
        state.status = 'failed'; state.error = error.message;
        console.error('[saveContent] Save failed', error);
        showErrorModal('Save failed: ' + error.message, { title: 'Save Failed' });
        throw error;
    } finally { state.busy = false; }
}

function _writeLocalFile(content, id, name, assertCurrent = () => {}) {
    return writeLocalFileTransport(content, id, name, {
        handles: _localFileHandles, assertCurrent,
        pickFile: window.showSaveFilePicker ? options => window.showSaveFilePicker(options) : null,
        download: (value, filename) => fallbackDownload(value, filename, assertCurrent),
    });
}
function fallbackDownload(content, name, assertCurrent) {
    return chooseLocalFileDownload(content, name, assertCurrent);
}
