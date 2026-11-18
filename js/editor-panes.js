/// <reference path="./clist-types.js" />
// Generic pane-switcher for editors with multiple content panes shown/hidden via the shared
// #editor-menu bar (e.g. annotate-edit's Upload overlay, a future gRSShopper-post editor's
// Write/Edit/Upload/Preview/Publish tabs). A pane is {id, container, render(container)};
// render is called fresh every time the pane activates — panes may depend on state that
// changed since they were last shown (e.g. which account is selected elsewhere in the
// editor) — a pane whose content never changes should guard its own render() idempotently,
// the same convention editor initialize() methods already follow. Register once per editor
// instance (typically inside initialize() or whatever it calls); switch from a plain
// editorFunctions entry, same as any other editor-menu button. This is the pilot of the
// "reusable menu contract" in docs/ui-logic-separation-plan.md — deliberately just the
// pane-switch core (no popout nav stack/Back/Close), since panes here are inline divs in the
// write pane, not a modal.

// Shows one registered pane, hiding whichever pane (if any) was previously active for this
// editor. Clicking the already-active pane's button closes it instead (hides, no re-render).
function switchEditorPane(editorType, paneId) {
    const transition = editorPaneTransition(editorType, paneId);
    if (!transition) return;
    const { def, previous, activate } = transition;

    if (previous) window.CList.ui.editorPanes.hide(previous.container);
    if (activate) {
        window.CList.ui.editorPanes.show(def.container);
        if (def.render) def.render(def.container);
    } else {
        window.CList.ui.editorPanes.hide(def.container);
    }
    commitEditorPane(editorType, paneId, activate);
}

// Shared Upload-pane controller: wires the view's thumbnail-pick/submit callbacks to
// window.CList.uploaders (grsshopper_publish.js), the same registry-dispatch shape editors
// already use for window.CList.publishers. Calls onUploaded({url, fileId}) on success so
// each caller decides what to do with the hosted URL (append an <img> to a body, fill a
// cover-image field, …) — extracted out of annotate-editor.js's original
// _renderAnnotateUploadPane so a second editor (grsshopper-editor.js) can use the same UI
// without duplicating it, per the "functions an editor can just plug in" goal.
function renderUploadPane(pane, account, candidates, onUploaded) {
    const runUpload = async (sourceUrl) => {
        if (!sourceUrl) { showErrorModal('Enter or choose an image URL first.', { title: 'URL required' }); return; }
        const uploader = window.CList.uploaders?.[account.type];
        if (typeof uploader?.uploadFromUrl !== 'function') {
            showErrorModal(`Image upload is not available for ${account.type} accounts.`, { title: 'Upload failed' });
            return;
        }
        view.setStatus('Uploading…');
        try {
            const result = await uploader.uploadFromUrl(account, sourceUrl);
            view.setUrl(result.url);
            view.setStatus('Uploaded ✓');
            onUploaded?.(result);
        } catch (error) {
            console.error('[editors] image upload failed', error);
            view.setStatus('');
            showErrorModal(error.message, { title: 'Upload failed' });
        }
    };
    const view = window.CList.ui.editorPanes.renderUpload(pane, candidates, { onPick: runUpload, onSubmit: runUpload });
}
