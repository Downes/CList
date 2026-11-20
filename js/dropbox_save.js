/// <reference path="./clist-types.js" />
// Captured Dropbox save controller. Bodies, accounts and credentials stay private.
/** @returns {CListDropboxSaveState} */
function dropboxSaveState() {
    return window.CList.state.dropboxSaving ||= { busy: false, phase: 'ready', error: null, receipt: null };
}
async function saveToDropbox(options = {}) {
    const state = dropboxSaveState();
    if (state.busy) return { keepOpen: true };
    state.busy = true; state.phase = 'preparing'; state.error = null; state.receipt = null;
    const view = window.CList.ui.dropboxSave;
    let panel;
    try {
        const found = options.found || findAccountByType('Dropbox', { permission: 'b' });
        const capture = captureDropboxSession(found, 'b');
        const source = { editor: currentEditor,
            account: typeof currentEditorAccount === 'undefined' ? null : currentEditorAccount,
            page: currentLoadedPage, controls: window.CList.state.editorControls?.id,
            switching: window.CList.state.editorSwitching?.id, loading: window.CList.state.editorLoading?.id };
        const sourceCurrent = () => source.editor === currentEditor && source.page === currentLoadedPage
            && source.account === (typeof currentEditorAccount === 'undefined' ? null : currentEditorAccount)
            && source.controls === window.CList.state.editorControls?.id
            && source.switching === window.CList.state.editorSwitching?.id
            && source.loading === window.CList.state.editorLoading?.id;
        panel = view.mount(options.target);
        const current = () => {
            assertDropboxSession(capture);
            if (!sourceCurrent() || !panel.root.isConnected || (options.isCurrent && !options.isCurrent())) {
                throw new Error('The Dropbox save controls are no longer current. Reopen Save before continuing.');
            }
        };
        const request = { editor: source.editor, handler: editorHandlers[source.editor],
            page: source.page ? structuredClone(source.page) : null, references: structuredClone(getReferences()),
            title: window.CList.ui.view.writeTitle?.textContent || '',
            referenceHtml: document.getElementById('writeReferences')?.innerHTML || '' };
        current();
        const file = options.prepare ? await options.prepare() : await prepareDropboxFile(request, {
            prepareFile: prepareLocalFile, packagePost,
            slug: value => slugify(value, { maxLength: 60, fallback: 'clist-post' }),
        });
        if (!file) { state.phase = 'cancelled'; return { status: 'cancelled', keepOpen: true }; }
        current();
        const client = createDropboxRequestClient(capture, text => { current(); view.progress(panel, text); });
        const result = await runDropboxFileSave(file, {
            assertCurrent: current, progress: text => { state.phase = 'saving'; view.progress(panel, text); },
            exists: name => client.call(token => _dropboxFileExists(token, capture.data.folder, name)),
            upload: (name, content, mode) => client.call(token => {
                current(); return _dropboxUpload(token, capture.data.folder, name, content, mode);
            }),
            choose: name => { state.phase = 'choosing'; return view.chooseOverwrite(panel, name, () => {
                try { current(); return true; } catch { return false; }
            }); },
        });
        state.phase = result.status; state.receipt = result.receipt || null;
        if (result.status === 'saved') {
            // A confirmed receipt remains even if its editor/panel/session expired.
            try { current(); view.saved(panel, result.receipt); }
            catch { showStatusMessage('An earlier Dropbox save completed.'); }
        } else if (panel.root.isConnected) view.progress(panel, 'Cancelled.');
        return result;
    } catch (error) {
        state.phase = 'failed'; state.error = error?.message || String(error);
        console.error('[Dropbox save]', error);
        if (panel?.root.isConnected) view.error(panel, error);
        else showStatusMessage('Dropbox save failed: ' + state.error);
        return { status: 'failed', keepOpen: true };
    } finally { state.busy = false; }
}
window.CList.savers ||= [];
window.CList.savers.push({ label: 'Save to Dropbox', logoSrc: 'assets/icons/dropbox.svg', requiresLogin: true, requiresAccount: true,
    visible: () => typeof isRegistered === 'function' && isRegistered() && !!findAccountByType('Dropbox', { permission: 'b' }),
    save: () => saveToDropbox() });
