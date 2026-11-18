/// <reference path="./clist-types.js" />
// Controller: credentials, queued bodies and action captures stay outside shared state.
let _editorMountQueue = Promise.resolve();
let _editorPickerGeneration = 0;
let _editorDraftGeneration = 0;
let _pendingEditorTarget = null;
let _editorContentLoad = null;
function editorSwitchState() {
    window.CList.state ||= {};
    return window.CList.state.editorSwitching ||= { id: 0, phase: 'idle', target: null,
        active: editorStateKey(currentEditor, currentEditorAccount), parked: {}, error: null };
}
function _parkCurrentEditorState() {
    window.CList.state.editorSwitching = parkEditorMetadata(editorSwitchState(),
        editorStateKey(currentEditor, currentEditorAccount), currentLoadedPage, getReferences());
}
function _restoreEditorState(editorType, account) {
    const parked = restoredEditorMetadata(editorSwitchState(), editorStateKey(editorType, account));
    setLoadedPage(parked.page);
    const handler = editorHandlers[editorType];
    if (typeof handler?.getDocId === 'function' && handler.getDocId() && typeof handler.resyncReferences === 'function') {
        handler.resyncReferences();
    } else setReferences(parked.references);
}
function invalidateEditorPicker() { _editorPickerGeneration++; }
function closeEditorSwitchOverlay() { invalidateEditorPicker(); window.CList.ui.editorSwitch.close(); }
function editorHasActiveContent(handler) {
    try {
        if (typeof handler.isActive === 'function') return handler.isActive();
        const value = handler.getContent?.();
        // Async getters are captured later when a transfer is actually requested.
        if (value?.then) { value.catch(error => window.CList.ui.editorSwitch.error(error)); return true; }
        return typeof value === 'string' && value.trim().length > 0;
    } catch { return false; } // Unmounted editors need not have a readable body yet.
}
function editorPickerChoice(key, handler, label, account, generation) {
    const selected = key === currentEditor && (!account || account.key === currentEditorAccount?.key);
    return { label: label + (selected ? ' [Selected]' : editorHasActiveContent(handler) ? ' [Active]' : ''),
        icon: handler.icon, select: () => {
            if (generation !== _editorPickerGeneration) return;
            return selected ? closeEditorSwitchOverlay() : _switchToEditorFromPicker(key, account);
        } };
}
function _populateBuiltInEditors(generation = _editorPickerGeneration) {
    const options = [];
    for (const [key, handler] of Object.entries(editorHandlers)) {
        if (typeof handler.initialize !== 'function' || (handler.visible && !handler.visible())) continue;
        if (handler.requiresAccount && !handler.isActive?.()) continue;
        options.push(editorPickerChoice(key, handler, handler.label || key, null, generation));
    }
    window.CList.ui.editorSwitch.choices(options);
}
async function _populateAccountEditors(generation = _editorPickerGeneration) {
    try {
        if (typeof isRegistered === 'function' && isRegistered()) await ensureAccountsLoaded();
        if (generation !== _editorPickerGeneration) return;
        const options = [];
        for (const account of window.CList.accounts || []) {
            const parsed = parseAccountValue(account);
            if (!parsed || !parsed.permissions?.includes('e')) continue;
            const key = parsed.type?.toLowerCase(), handler = editorHandlers[key];
            if (!handler?.requiresAccount || (handler.visible && !handler.visible())) continue;
            options.push(editorPickerChoice(key, handler, `${parsed.title} (${handler.label})`, structuredClone(account), generation));
        }
        window.CList.ui.editorSwitch.choices(options, true);
    } catch (error) {
        if (generation === _editorPickerGeneration) window.CList.ui.editorSwitch.error(error, 'Could Not Load Accounts');
    }
}
async function populateEditorList() {
    const generation = ++_editorPickerGeneration;
    try { _populateBuiltInEditors(generation); await _populateAccountEditors(generation); }
    catch (error) { window.CList.ui.editorSwitch.error(error); }
}
async function playEditorSwitch() {
    const generation = ++_editorPickerGeneration;
    try {
        _populateBuiltInEditors(generation); window.CList.ui.editorSwitch.open();
        await _populateAccountEditors(generation);
    } catch (error) { window.CList.ui.editorSwitch.error(error); }
}
function updateEditorIndicator() {
    window.CList.ui.editorSwitch.indicator(editorHandlers[currentEditor]?.label || currentEditor, EDITOR_TEST_VERSION);
}
// Legacy service handlers still mutate their own mounting DOM. Serialize mounts;
// generation guards suppress obsolete controller effects, not handler DOM writes.
function queueEditorMount(editorType, account, carriedContent, switching) {
    const target = editorStateKey(editorType, account);
    const state = window.CList.state.editorSwitching = beginEditorSwitch(editorSwitchState(), target);
    invalidateEditorPicker(); _editorDraftGeneration++;
    const capturedAccount = account ? structuredClone(account) : null;
    const capturedContent = carriedContent ? structuredClone(carriedContent) : null;
    const run = async () => {
        if (editorSwitchState().id !== state.id) return false;
        _editorDraftGeneration++;
        _editorContentLoad = null;
        if (switching) { _parkCurrentEditorState(); closeReferencesPanel(); }
        if (capturedContent) { pendingContent = capturedContent; _pendingEditorTarget = target; }
        else if (_pendingEditorTarget && _pendingEditorTarget !== target) { pendingContent = null; _pendingEditorTarget = null; }
        window.CList.state.editorSwitching = transitionEditorSwitch(editorSwitchState(), state.id, 'mounting');
        const success = await mountEditor(editorType, capturedAccount);
        if (success) window.CList.state.editorSwitching = { ...editorSwitchState(),
            active: editorStateKey(currentEditor, currentEditorAccount) };
        // Even a superseded mount must own its restored metadata before the next
        // queued mount parks it. Otherwise the source's references leak to it.
        if (success && switching) _restoreEditorState(currentEditor, currentEditorAccount);
        if (editorSwitchState().id !== state.id) return false;
        if (!success) {
            window.CList.state.editorSwitching = transitionEditorSwitch(editorSwitchState(), state.id, 'failed', 'Editor initialization failed.');
            return false;
        }
        if (switching) {
            window.CList.ui.editorSwitch.close();
            await populateEditorList();
        }
        if (editorSwitchState().id !== state.id) return false;
        updateEditorIndicator();
        window.refreshWriteTags?.();
        window.CList.state.editorSwitching = transitionEditorSwitch(editorSwitchState(), state.id, 'complete');
        return true;
    };
    const result = _editorMountQueue.then(run).catch(error => {
        if (editorSwitchState().id === state.id) {
            window.CList.state.editorSwitching = transitionEditorSwitch(editorSwitchState(), state.id, 'failed', error.message);
            window.CList.ui.editorSwitch.error(error);
        }
        return false;
    });
    _editorMountQueue = result;
    return result;
}
async function switchToEditor(editorType, carriedContent, account) {
    return queueEditorMount(editorType, account ?? null, carriedContent, true);
}
async function initializeEditor(editorType, account) {
    return queueEditorMount(editorType, account === undefined && editorType === currentEditor ? currentEditorAccount : account, null, false);
}
async function mountEditor(editorType, account) {
    const handler = editorHandlers[editorType];
    const previousEditor = currentEditor, previousAccount = currentEditorAccount;
    let undo;
    try {
        if (typeof handler?.initialize !== 'function') throw new Error(`Editor '${editorType}' is not supported.`);
        if (handler.visible && !handler.visible()) throw new Error('That editor is not available. Please register or log in.');
        const parsed = account ? parseAccountValue(account) : null;
        if (account && !parsed) throw new Error('This editor account could not be read.');
        currentEditorAccount = account;
        undo = window.CList.ui.editorSwitch.prepare(handler, editorType);
        const initialized = await handler.initialize(parsed);
        // Some existing handlers invoke this helper without awaiting it. Still
        // wait for content delivery started during initialize before completing.
        const loaded = _editorContentLoad ? await _editorContentLoad : true;
        if (initialized === false || loaded === false) {
            currentEditor = previousEditor; currentEditorAccount = previousAccount; undo?.();
            return false;
        }
        return true;
    } catch (error) {
        currentEditor = previousEditor; currentEditorAccount = previousAccount; undo?.();
        window.CList.ui.editorSwitch.error(error, 'Editor Initialization Failed');
        return false;
    }
}
async function _switchToEditorFromPicker(editorType, account) {
    try {
        const source = editorHandlers[currentEditor];
        if (!source || !editorHasActiveContent(source)) return await switchToEditor(editorType, null, account);
        return await _offerContentTransfer(editorType, account);
    } catch (error) { window.CList.ui.editorSwitch.error(error); }
}
async function _offerContentTransfer(targetKey, account) {
    const generation = ++_editorPickerGeneration, sourceKey = currentEditor, sourceAccount = currentEditorAccount;
    const source = editorHandlers[sourceKey], target = editorHandlers[targetKey];
    const targetAccount = account ? structuredClone(account) : null;
    const references = structuredClone(getReferences());
    const sourcePage = currentLoadedPage;
    const valid = () => generation === _editorPickerGeneration && currentEditor === sourceKey
        && currentEditorAccount === sourceAccount && currentLoadedPage === sourcePage;
    const value = await source.getContent?.() || '';
    if (!valid()) return;
    let claimed = false;
    const action = mode => async () => {
        if (claimed || !valid()) return;
        claimed = true;
        try {
            if (mode === 'cancel') return await populateEditorList();
            if (!await switchToEditor(targetKey, null, targetAccount)) return;
            // A newer request can have been queued while this switch was completing.
            const id = editorSwitchState().id;
            if (currentEditor !== targetKey || editorSwitchState().phase !== 'complete') return;
            if (mode === 'overwrite') await target.setContent(value);
            if (mode === 'insert') await target.loadContent({ type: source.contentTypes?.[0] || 'text/plain', value });
            if (editorSwitchState().id !== id || currentEditor !== targetKey) return;
            if (mode === 'overwrite') setReferences(references);
            if (mode === 'insert') setReferences(mergeEditorReferences(getReferences(), references));
        } catch (error) { window.CList.ui.editorSwitch.error(error, 'Content transfer failed'); }
    };
    window.CList.ui.editorSwitch.transfer(source.label || sourceKey, target.label || targetKey, {
        overwrite: typeof target.setContent === 'function' ? action('overwrite') : null,
        insert: typeof target.loadContent === 'function' ? action('insert') : null,
        none: action('none'), cancel: action('cancel'),
    });
}
function loadPredefinedContent(editorType) {
    if (!pendingContent || !pendingContent.value) return;
    if (_pendingEditorTarget && _pendingEditorTarget !== editorStateKey(editorType, currentEditorAccount)) return;
    const content = pendingContent;
    pendingContent = null;
    _editorContentLoad = (async () => {
        try {
            const handler = editorHandlers[editorType];
            if (typeof handler.loadContent !== 'function') throw new Error(`Editor '${editorType}' cannot load content.`);
            await handler.loadContent(content);
            return true;
        } catch (error) {
            if (!pendingContent) pendingContent = content;
            window.CList.ui.editorSwitch.error(error, 'Editor content load failed');
            return false;
        }
    })();
    return _editorContentLoad;
}
function saveDraft(editorKey, value) {
    try {
        if (!value?.trim()) return;
        const key = window.CList.keys.EDITOR_DRAFT_PREFIX + editorKey;
        sessionStorage.setItem(key, value); sessionStorage.setItem(key + '_refs', JSON.stringify(getReferences()));
    } catch (error) { window.CList.ui.editorSwitch.error(error, 'Draft save failed'); }
}
function clearDraft(editorKey) {
    try {
        const key = window.CList.keys.EDITOR_DRAFT_PREFIX + editorKey;
        sessionStorage.removeItem(key); sessionStorage.removeItem(key + '_refs');
    } catch (error) { window.CList.ui.editorSwitch.error(error, 'Draft discard failed'); }
}
async function offerDraftRestore(editorKey, contentType) {
    const generation = ++_editorDraftGeneration, id = editorSwitchState().id;
    const loadId = window.CList.state.editorLoading?.id;
    const handler = editorHandlers[editorKey], account = currentEditorAccount;
    try {
        if (currentEditor !== editorKey) return;
        const key = window.CList.keys.EDITOR_DRAFT_PREFIX + editorKey;
        const draft = sessionStorage.getItem(key);
        if (!draft) return;
        const rawRefs = sessionStorage.getItem(key + '_refs');
        const before = JSON.stringify(await handler.getContent());
        const valid = () => generation === _editorDraftGeneration && editorSwitchState().id === id
            && window.CList.state.editorLoading?.id === loadId
            && currentEditor === editorKey && currentEditorAccount === account;
        if (!valid()) return;
        let claimed = false;
        const choose = restore => async () => {
            if (claimed || !valid()) return;
            claimed = true;
            try {
                if (sessionStorage.getItem(key) !== draft || sessionStorage.getItem(key + '_refs') !== rawRefs) {
                    showStatusMessage('The saved draft changed. Open the editor again to review it.'); return;
                }
                if (!restore) { clearDraft(editorKey); return; }
                const references = parseEditorDraftReferences(rawRefs);
                const now = JSON.stringify(await handler.getContent());
                if (!valid()) return;
                if (now !== before) { showStatusMessage('The editor has changed. The saved draft was kept.'); return; }
                await handler.loadContent({ type: contentType, value: draft });
                if (valid()) setReferences(references);
            } catch (error) { window.CList.ui.editorSwitch.error(error, 'Draft restore failed'); }
        };
        window.CList.ui.editorSwitch.draft(choose(true), choose(false));
    } catch (error) { window.CList.ui.editorSwitch.error(error, 'Draft restore failed'); }
}
