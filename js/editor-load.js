/// <reference path="./clist-types.js" />
// Editor loading controller. Payloads and callbacks remain transient, outside shared state.
let _editorLoadOperation = null;
function editorLoadState() { return window.CList.state.editorLoading; }
function _savedEditorIsEmpty(handler, value) {
    const plainText = value && handler.contentTypes?.[0] !== 'text/plain' ? removeHtml(value) : '';
    return editorLoadIsEmpty(handler.contentTypes, value, plainText);
}
async function loadSavedPage(content, page, renderTarget, onCancel, isCurrent) {
    window.CList.state ||= {};
    const state = window.CList.state.editorLoading = beginEditorLoad(editorLoadState());
    const operation = _editorLoadOperation = { id: state.id, renderTarget, onCancel, isCurrent };
    return runEditorLoadStep(operation, () => {
        window.refreshWriteTags?.();
        operation.content = structuredClone(content);
        operation.page = page ? structuredClone(page) : null;
        return prepareEditorLoad(operation);
    });
}
function currentEditorLoad(operation) {
    return _editorLoadOperation === operation && editorLoadState().id === operation.id
        && (!operation.isCurrent || operation.isCurrent())
        && !['complete', 'cancelled', 'failed'].includes(editorLoadState().phase);
}
function editorLoadPhase(operation, phase, target, error) {
    window.CList.state.editorLoading = transitionEditorLoad(editorLoadState(), operation.id, phase, target, error);
}
async function runEditorLoadStep(operation, action) {
    if (!currentEditorLoad(operation)) return;
    try { return await action(); }
    catch (error) {
        if (currentEditorLoad(operation)) {
            editorLoadPhase(operation, 'failed', undefined, error.message || String(error));
            window.CList.ui.editorLoad.error(error);
        }
    }
}
function editorLoadCallback(operation, phase, action) {
    return () => runEditorLoadStep(operation, async () => {
        if (editorLoadState().phase !== phase) return;
        if (phase === 'reviewing' && operation.reviewOwner !== undefined && currentEditor !== operation.reviewOwner) {
            editorLoadPhase(operation, 'cancelled'); return;
        }
        if (['reviewing', 'choosing-collection'].includes(phase) && operation.collectionOwner && !editorCollectionOwnerCurrent(operation)) {
            editorLoadPhase(operation, 'cancelled'); return;
        }
        editorLoadPhase(operation, 'loading'); // Claims the callback before its first await.
        return action();
    });
}
function cancelEditorLoad(operation, review = false) {
    if (!currentEditorLoad(operation)) return;
    editorLoadPhase(operation, 'cancelled');
    try {
        const callback = operation.onCancel || (review === 'collection' ? () => {} : review
            ? () => { const loader = (window.CList.loaders || []).find(item => item.label === 'My Pages'); return loader ? loader.load() : populateLoadOptions(); }
            : () => populateLoadOptions());
        Promise.resolve(callback()).catch(error => { if (_editorLoadOperation === operation) window.CList.ui.editorLoad.error(error); });
    } catch (error) { window.CList.ui.editorLoad.error(error); }
}
function editorLoadCapabilities() {
    return Object.entries(editorHandlers).filter(([, handler]) => typeof handler.initialize === 'function'
        && !handler.requiresAccount && !(typeof handler.visible === 'function' && !handler.visible()))
        .map(([key, handler]) => ({ key, label: handler.label || key, icon: handler.icon,
            contentTypes: [...(handler.contentTypes || [])] }));
}
async function prepareEditorLoad(operation) {
    let { content, page } = operation;
    if (!content.recognized && typeof recognizeSavedContent === 'function'
        && (typeof content.value === 'string' || content.value instanceof ArrayBuffer)) {
        const detected = recognizeSavedContent(content.value, content.type, page?.title || '');
        page = { ...page, ...detected.page, ...(page?.title ? { title: page.title } : {}) };
        content = { ...content, ...detected, recognized: true };
    }
    const documentTitle = page?.documentTitle || content.page?.title;
    if (documentTitle) page = { ...page, documentTitle };
    operation.content = content; operation.page = page;
    const view = window.CList.ui.editorLoad;
    if (content.collection) {
        operation.collectionOwner = { editor: currentEditor,
            account: typeof currentEditorAccount === 'undefined' ? null : currentEditorAccount,
            switchId: window.CList.state.editorSwitching?.id };
        editorLoadPhase(operation, 'choosing-collection');
        return view.chooseCollection(content.collection, content.format, operation.renderTarget,
            editorLoadCallback(operation, 'choosing-collection', () => reviewEditorCollection(operation)),
            editorLoadCallback(operation, 'choosing-collection', () => {
                const html = content.format === 'html';
                delete operation.collectionOwner; // Native representation owns its normal editor switch/review.
                operation.content = { type: html ? 'text/html' : 'text/plain', value: content.sourceText ?? content.value, recognized: true };
                return selectEditorRepresentation(operation, html ? 'tinymce' : 'texteditor');
            }), () => cancelEditorLoad(operation));
    }
    const choices = editorLoadRepresentations(content, page, editorLoadCapabilities());
    const keys = Object.keys(choices);
    if (!keys.length || (content.chosenEditor && !choices[content.chosenEditor])) throw new Error('No local editor is available for this content type.');
    if (content.chosenEditor || keys.length === 1) return selectEditorRepresentation(operation, content.chosenEditor || keys[0], choices);
    editorLoadPhase(operation, 'choosing-editor');
    const capabilities = editorLoadCapabilities();
    return view.chooseEditor(keys.map(key => capabilities.find(item => item.key === key)), operation.renderTarget,
        key => editorLoadCallback(operation, 'choosing-editor', () => selectEditorRepresentation(operation, key, choices))(),
        () => cancelEditorLoad(operation));
}
async function reviewEditorCollection(operation) {
    if (!editorCollectionOwnerCurrent(operation)) { editorLoadPhase(operation, 'cancelled'); return; }
    editorLoadPhase(operation, 'reviewing', 'collection');
    operation.reviewOwner = currentEditor;
    const existing = await editorHandlers.collection?.getContent?.();
    if (!currentEditorLoad(operation) || !editorCollectionOwnerCurrent(operation)) return;
    const open = async () => {
        if (!currentEditorLoad(operation) || !editorCollectionOwnerCurrent(operation)) return;
        const opened = await window.openParsedAsCollection(operation.content.collection, operation.page,
            () => currentEditorLoad(operation));
        if (currentEditorLoad(operation)) editorLoadPhase(operation, opened === false ? 'cancelled' : 'complete');
    };
    if (existing && String(existing).trim()) return window.CList.ui.editorLoad.reviewCollection(
        editorLoadCallback(operation, 'reviewing', open), () => cancelEditorLoad(operation, 'collection'));
    return open();
}
function editorCollectionOwnerCurrent(operation) {
    const owner = operation.collectionOwner;
    return !owner || (owner.editor === currentEditor
        && owner.account === (typeof currentEditorAccount === 'undefined' ? null : currentEditorAccount)
        && owner.switchId === window.CList.state.editorSwitching?.id);
}
async function selectEditorRepresentation(operation, key, choices) {
    if (!currentEditorLoad(operation)) return;
    const representations = choices || editorLoadRepresentations(operation.content, operation.page, editorLoadCapabilities());
    const selected = representations[key], handler = editorHandlers[key];
    if (!selected || !handler || !editorLoadCapabilities().some(capability => capability.key === key)) throw new Error('No local editor is available for this content type.');
    operation.content = structuredClone(selected); operation.key = key; operation.handler = handler;
    editorLoadPhase(operation, 'reviewing', key);
    let existing = '';
    if (typeof handler.getContent === 'function') {
        try { existing = await handler.getContent(); }
        catch { existing = ''; } // An editor that has never mounted is empty.
    }
    if (!currentEditorLoad(operation)) return;
    if (_savedEditorIsEmpty(handler, existing)) return applyEditorLoad(operation, 'load');
    if (key !== currentEditor) {
        const initialized = await switchToEditor(key, null);
        if (!currentEditorLoad(operation)) return;
        if (initialized === false) { editorLoadPhase(operation, 'failed', key, 'Editor initialization failed.'); return; }
        window.CList.ui.editorLoad.preparingReview();
    }
    operation.reviewOwner = currentEditor;
    window.CList.ui.editorLoad.reviewEditor(typeof handler.setContent === 'function', operation.renderTarget, {
        new: editorLoadCallback(operation, 'reviewing', () => applyEditorLoad(operation, 'new')),
        replace: editorLoadCallback(operation, 'reviewing', () => applyEditorLoad(operation, 'replace')),
        insert: editorLoadCallback(operation, 'reviewing', () => applyEditorLoad(operation, 'insert')),
        cancel: () => cancelEditorLoad(operation, true),
    });
}
async function applyEditorLoad(operation, mode) {
    if (!currentEditorLoad(operation)) return;
    const { key, handler, content, page } = operation;
    editorLoadPhase(operation, 'loading', key);
    if (mode === 'load' && key !== currentEditor) {
        const initialized = await switchToEditor(key, content);
        if (!currentEditorLoad(operation)) return;
        if (initialized === false) { editorLoadPhase(operation, 'failed', key, 'Editor initialization failed.'); return; }
    }
    else if (mode === 'new') {
        clearDraft(key); window.clearWriteTags?.();
        await handler.setContent(''); await handler.loadContent(content);
    } else if (mode === 'replace') await handler.setContent(content.value);
    else await handler.loadContent(content);
    if (!currentEditorLoad(operation)) return;
    if (mode === 'insert') (page?.references || []).forEach(reference => pushReference(reference));
    else { setLoadedPage(page); setReferences(page?.references || []); }
    window.CList.ui.editorLoad.finished();
    window.CList.ui.editorLoad.removeModal();
    editorLoadPhase(operation, 'complete', key);
}
