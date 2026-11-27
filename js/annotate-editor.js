// annotate-editor.js — Annotation editor for the write-pane
// Part of CList, the next generation of learning and connecting with your community
//
// Depends on: annotate_draft_state.js, annotate_draft_view.js, annotate_draft.js;
//             utilities.js (escapeHtml, showStatusMessage, showErrorModal, parseAccountValue,
//             getSiteSpecificCookie, getAccounts, cleanHTMLContent), kvstore.js, editors.js
//             (currentEditor, editorHandlers, switchToEditor), tags.js (getWriteTags),
//             tinymce.js (pushAndDisplayReference), references.js (getReferences, pushReference),
//             annotate_send.js / annotate_send_view.js (captured Send controls using the
//             shared annotation request/workflow), the global `tinymce`
//             library object (same script tag tinymce.js uses). annotate_body.js and
//             annotate_body_view.js own the captured Description instance, unique target,
//             textarea fallback and cleanup independently of the main write-column editor.
//
// A normal editor like any other: it takes citations via the shared insertLink/insertLinkVia
// contract (the "Write about this" arrow button, or the Alt+A shortcut in interface.js) and
// keeps its own reference list via the generic editorStates park/restore in editors.js, same
// as texteditor/tinymce/latex/collab. Reached via Alt+A (interface.js) rather than a dedicated
// open button.

// Editor to switch back to after a successful Send — set by whatever opened this editor
// (currently only the Alt+A shortcut in interface.js) when it wasn't already active.
let _annotateReturnEditor = null;

// Standalone draft reference used when the editor is opened with nothing cited yet (selected
// directly from the editor list, rather than via "Write about this" or Alt+A). Lets the ref
// fields and Send controls render immediately instead of gating on getReferences().length.
// Kept out of window.CList.state.references (and its url-dedup/panel/park-restore machinery)
// since it's not a real citation until the user fills in a URL and sends it; once a real
// reference is attached via insertLink/loadContent, that takes over as _annotateTarget()'s result.
/** @type {{standalone:CListReference|null}} */
const _annotationDraft = { standalone: null };

// Resolves to whatever the ref-fields/Send controls should currently operate on: the real
// cited reference if one has been attached, else the standalone draft (created on first need).
// Stays correct as long as the target is always the first thing pushed into getReferences()
// for this editor — guaranteed by _annotateReceiveReference() and the URL field's own change
// handler below, both of which push the target before any later, additional reference.
function _annotateTarget() {
    return resolveAnnotationDraftTarget(_annotationDraft, getReferences(), () => new Date().toISOString());
}

let _annotationFields = null;
function annotationDraftSource() {
    return JSON.stringify([window.CList.state.username, window.CList.state.authEpoch || 0,
        window.CList.config?.flaskSiteUrl, typeof currentEditorAccount === 'undefined' ? null : currentEditorAccount,
        ...['editorSwitching','editorLoading','editorControls'].map(key => window.CList.state[key]?.id)]);
}
function getAnnotationFieldsController(container = document.getElementById('annotate-ref-fields')) {
    if (_annotationFields && _annotationFields.container === container && _annotationFields.controller.active()) return _annotationFields.controller;
    _annotationFields?.controller.dispose();
    const source = annotationDraftSource();
    const controller = createAnnotationDraftController({
        current: () => currentEditor === 'annotate-edit' && annotationDraftSource() === source,
        target: _annotateTarget, references: getReferences,
        push: reference => pushReference(reference),
        pushDisplay: (reference, editorDiv) => pushAndDisplayReference(reference, editorDiv),
        state: value => { window.CList.state.annotationFields = value; }
    }, createAnnotationFieldsView(container));
    _annotationFields = { container, controller }; return controller;
}

// Handles a reference arriving via "Write about this" (insertLink), the Alt+A shortcut,
// drag-via (insertLinkVia), or loadContent's itemId path. If the annotation has no target yet
// (URL field still empty — whether nothing's been cited, or Title/Author/etc. were typed by
// hand but no URL), this reference BECOMES the target: fields are copied in wherever the
// reference has data, and the (now-filled) target is pushed so it claims getReferences()[0].
// Otherwise the target is already set, so the incoming reference is an ADDITIONAL target for
// convergent annotation (the generic Publish flow posts the same body to every reference's
// URL) — pushed alongside, without touching the already-displayed fields.
function _annotateReceiveReference(reference, editorDiv) {
    return getAnnotationFieldsController().receive(reference, editorDiv);
}

// Persistent description resource; all callbacks retain their original element/instance.
let _annotationBody = null;
function annotationBodySource() {
    return JSON.stringify([window.CList.state.username, window.CList.state.authEpoch || 0, window.CList.config?.flaskSiteUrl]);
}
function getAnnotationBodyController() {
    const root = document.getElementById('annotateEditDiv'), element = root?.querySelector('textarea');
    const source = annotationBodySource();
    if (_annotationBody && _annotationBody.root === root && _annotationBody.element === element && _annotationBody.source === source && _annotationBody.controller.owned()) return _annotationBody.controller;
    _annotationBody?.controller.dispose(); _annotationBody = null;
    if (!root || !element) return null;
    let controller;
    controller = createAnnotationBodyController({
        current: () => source === annotationBodySource(),
        available: () => typeof tinymce !== 'undefined' && typeof tinymce.init === 'function',
        init: config => tinymce.init(config), configuration: () => annotationBodyConfiguration(),
        state: value => { if (controller && _annotationBody?.controller === controller) window.CList.state.annotationBody = value; }
    }, createAnnotationBodyView(root, element));
    _annotationBody = { root, element, source, controller };
    window.CList.state.annotationBody = {phase:'idle',busy:false};return controller;
}
function _initAnnotateTinyMCE() { return getAnnotationBodyController()?.initialize() || Promise.resolve(false); }
function _annotateAppendHTML(html) { return getAnnotationBodyController()?.append(html); }

// Render the editor panel: editable Title/URL/Author/Feed/Image fields for the reference being
// annotated, a Description body (HTML, via its own small TinyMCE instance — content arrives via
// loadContent/insertLink, same as every other editor), and a bottom Send control. Fields modeled
// on gRSShopper's ghub post-edit screen.
async function _renderAnnotateEditor(container) {
    container.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'list-tip';
    header.textContent = 'Annotate';
    container.appendChild(header);

    const fieldsSection = document.createElement('div');
    fieldsSection.id = 'annotate-ref-fields';
    container.appendChild(fieldsSection);
    _renderAnnotateRefFields(fieldsSection);

    const bodyWrapper = document.createElement('div');
    bodyWrapper.className = 'collection-editor-field';
    const bodyLabel = document.createElement('label');
    bodyLabel.textContent = 'Description';
    bodyWrapper.appendChild(bodyLabel);

    const body = document.createElement('textarea');
    body.id = 'annotate-edit-body';
    body.rows = 8;
    body.style.cssText = 'width:100%;box-sizing:border-box;';
    bodyWrapper.appendChild(body);
    container.appendChild(bodyWrapper);
    const sendSection = document.createElement('div');
    sendSection.id = 'annotate-send-section';
    sendSection.style.cssText = 'margin-top:10px;';
    container.appendChild(sendSection);

}

// Editable Title/URL/Author/Feed/Image fields for the reference this annotation targets —
// the same reference (_annotateTarget()) that _renderSendControls's Send handler reads as
// `target`. The captured controller commits into that live object and preserves unfinished
// input during same-target refreshes. Always
// renders — against the draft reference when nothing's been cited yet — so the editor is usable
// for a manually-typed annotation, not just one seeded from a feed item.
function _renderAnnotateRefFields(container) {
    return getAnnotationFieldsController(container).refresh();
}

// Re-renders just the Send row (account/visibility pickers) without touching the body
// textarea. The Send controls don't depend on reference data, so insertLink/insertLinkVia/
// loadContent do not call this. Initialization/reactivation and references.js's
// "Annotate this reference" action rebuild the row with fresh ownership while
// retaining account/privacy choices for the same auth session.
function _refreshAnnotateSendControls() {
    const sendSection = document.getElementById('annotate-send-section');
    return sendSection ? _renderSendControls(sendSection) : Promise.resolve(null);
}

// Refreshes the ref-fields block — called after _annotateTarget()'s underlying reference
// gains or changes field data (a new reference filled the target, or an additional convergent
// reference arrived), so the Title/URL/Author/Feed/Image inputs reflect the current target.
function _refreshAnnotateRefFields() {
    const fieldsSection = document.getElementById('annotate-ref-fields');
    if (fieldsSection) _renderAnnotateRefFields(fieldsSection);
}

function _renderSendControls(sendSection) { return renderAnnotationSendControls(sendSection); }

// Empties the form to start a new annotation: drops the current target (and any convergent
// references alongside it) and the Description body, then re-renders the ref fields blank.
// Registered as this editor's 'Clear' editorFunctions entry (editor-menu button).
function _annotateClear() {
    clearReferences();
    _annotationDraft.standalone = null;
    _refreshAnnotateRefFields();
    editorHandlers['annotate-edit'].setContent('');
}

// Native local-file content is independent of getContent(), which remains the
// annotation's publishable HTML body. Keep the full target and convergent references.
function _annotationFileReferences(target, references) {
    const list = references.filter(ref => ref && typeof ref === 'object' && !Array.isArray(ref));
    return target.url ? [target, ...list.filter(ref => ref.url !== target.url)] : list;
}
function _setAnnotationBody(value) { return getAnnotationBodyController()?.set(value); }
function _restoreAnnotationFile(value, insert = false) {
    const data = typeof value === 'string' ? JSON.parse(value) : structuredClone(value);
    if (!data || data.format !== 'clist-annotation-v1' || typeof data.body !== 'string'
        || !data.target || typeof data.target !== 'object' || Array.isArray(data.target)
        || !Array.isArray(data.references)) throw new Error('Invalid CList annotation file.');
    const incoming = _annotationFileReferences(data.target, data.references);
    const existingBody = editorHandlers['annotate-edit'].getContent();
    const append = insert && !!existingBody;
    const safeBody = typeof window.sanitizeHtml === 'function'
        ? String(window.sanitizeHtml(data.body)) : escapeHtml(data.body);
    if (append) {
        const merged = [...getReferences()];
        for (const ref of incoming) {
            if (!ref.url || !merged.some(existing => existing.url === ref.url)) merged.push(ref);
        }
        setReferences(merged);
        _setAnnotationBody(existingBody + safeBody);
    } else {
        _annotationDraft.standalone = data.target;
        setReferences(incoming);
        _setAnnotationBody(safeBody);
    }
    _refreshAnnotateRefFields();
}

(function () {
    if (typeof editorHandlers === 'undefined') {
        console.error('editorHandlers is not defined — annotate-editor.js must load after editors.js');
        return;
    }

    editorHandlers['annotate-edit'] = {
        loadDependencies: () => ensureTinyMCE(),
        label: 'Annotate',
        icon: 'edit',
        contentTypes: ['text/plain', 'text/html', 'application/vnd.clist.annotation+json'],
        requiresAccount: false,

        editorFunctions: {
            'Clear': () => _annotateClear(),
        },

        initialize: async () => {
            currentEditor = 'annotate-edit';
            const activation = annotationDraftSource();

            // This editor has its own Title field (ref.title, in _renderAnnotateRefFields) —
            // hide the shared #write-title-row so there isn't a second, redundant title input.
            // Restored by editors.js's initializeEditor() when switching to any other editor.
            const writeTitleRowEl = document.getElementById('write-title-row');
            if (writeTitleRowEl) writeTitleRowEl.style.display = 'none';

            const writePaneContent = window.CList.ui.view.writePaneContent;
            let div = document.getElementById('annotateEditDiv');
            if (!div) {
                div = document.createElement('div');
                div.id = 'annotateEditDiv';
                writePaneContent.appendChild(div);
                await _renderAnnotateEditor(div);
            }
            if (currentEditor !== 'annotate-edit' || annotationDraftSource() !== activation || document.getElementById('annotateEditDiv') !== div) return false;
            div.style.display = 'block';
            _refreshAnnotateRefFields();
            const sendControls = _refreshAnnotateSendControls();
            await _initAnnotateTinyMCE();
            if (currentEditor !== 'annotate-edit' || annotationDraftSource() !== activation || document.getElementById('annotateEditDiv') !== div) return false;
            // A failed rich initialization leaves an editable, preserved textarea.
            const loaded = typeof loadPredefinedContent === 'function' ? await loadPredefinedContent('annotate-edit') : true;
            await sendControls;
            return loaded !== false && currentEditor === 'annotate-edit' && annotationDraftSource() === activation;
        },

        getContent: () => getAnnotationBodyController()?.read().trim() || '',

        getFileContent: () => {
            const target = structuredClone(_annotateTarget());
            return { type: 'application/vnd.clist.annotation+json', value: JSON.stringify({
                format: 'clist-annotation-v1', body: editorHandlers['annotate-edit'].getContent(),
                target, references: structuredClone(_annotationFileReferences(target, getReferences())),
            }) };
        },

        setContent: (value) => {
            if (value && typeof value === 'object') return _restoreAnnotationFile(value);
            _setAnnotationBody(value);
        },

        // Insertion target for the "Write about this" arrow button (clistAnnotate) and the
        // Alt+A shortcut. Content is always appended to the end of the Description field
        // (never cursor-spliced — an annotation is a running note, not a document being edited
        // at a cursor position). Any accompanying reference goes through
        // _annotateReceiveReference(), which decides whether it fills the (empty) target or
        // joins it as an additional convergent target.
        loadContent: ({ type, value }, itemId) => {
            if (type === 'application/vnd.clist.annotation+json') return _restoreAnnotationFile(value, true);
            const itemContent = (type === 'text/html')
                ? (typeof window.sanitizeHtml === 'function' ? String(window.sanitizeHtml(value)) : escapeHtml(value))
                : escapeHtml(value);
            if (itemContent) _annotateAppendHTML(itemContent);

            if (itemId) {
                const el = document.getElementById(itemId);
                const reference = el && el.reference ? { ...el.reference } : null;
                _annotateReceiveReference(reference, document.getElementById('annotateEditDiv'));
            }
        },

        insertLink: ({ content, entryUrl, feedTitle, reference }) => {
            const itemContent = (content.type === 'text/html') ? cleanHTMLContent(content.value) : escapeHtml(content.value);
            if (itemContent) {
                _annotateAppendHTML(`${itemContent} [<a href="${escapeHtml(entryUrl)}">${escapeHtml(feedTitle)}</a>]`);
            }
            _annotateReceiveReference(reference, document.getElementById('annotateEditDiv'));
        },

        insertLinkVia: ({ content, linkedUrl, linkedTitle, entryUrl, authorOrFeedTitle, reference }) => {
            const itemContent = (content.type === 'text/html') ? cleanHTMLContent(content.value) : escapeHtml(content.value);
            if (itemContent) {
                _annotateAppendHTML(
                    `${itemContent} [<a href="${escapeHtml(linkedUrl)}">${escapeHtml(linkedTitle)}</a>, via <a href="${escapeHtml(entryUrl)}">${escapeHtml(authorOrFeedTitle)}</a>]`
                );
            }
            _annotateReceiveReference(reference, document.getElementById('annotateEditDiv'));
        },
    };
})();
