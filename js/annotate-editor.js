// annotate-editor.js — Annotation editor for the write-pane
// Part of CList, the next generation of learning and connecting with your community
//
// Depends on: utilities.js (escapeHtml, showStatusMessage, showErrorModal, parseAccountValue,
//             getSiteSpecificCookie, getAccounts, cleanHTMLContent), kvstore.js, editors.js
//             (currentEditor, editorHandlers, switchToEditor), tags.js (getWriteTags),
//             tinymce.js (pushAndDisplayReference), references.js (getReferences, pushReference),
//             annotate.js (_submitAnnotation — loads before this file), the global `tinymce`
//             library object (same script tag tinymce.js uses) for the Description field's own
//             small, separate TinyMCE instance (selector '#annotate-edit-body' — independent of
//             tinymce.js's 'write-column' instance, own init-once flag).
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
let _annotateDraftRef = null;

// Resolves to whatever the ref-fields/Send controls should currently operate on: the real
// cited reference if one has been attached, else the standalone draft (created on first need).
// Stays correct as long as the target is always the first thing pushed into getReferences()
// for this editor — guaranteed by _annotateReceiveReference() and the URL field's own change
// handler below, both of which push the target before any later, additional reference.
function _annotateTarget() {
    const ref = getReferences()[0];
    if (ref) return ref;
    if (!_annotateDraftRef) {
        _annotateDraftRef = {
            service: null, author_name: '', author_id: '', feed: '', url: '', title: '',
            created_at: '', cited_at: new Date().toISOString(), id: null, summary: '',
            image: '', replyToken: null,
        };
    }
    return _annotateDraftRef;
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
    if (!reference) return;
    const target = _annotateTarget();
    if (!target.url) {
        ['title', 'url', 'author_name', 'author_id', 'feed', 'image', 'service',
         'created_at', 'cited_at', 'replyToken', 'id', 'summary'].forEach(key => {
            if (reference[key]) target[key] = reference[key];
        });
        pushAndDisplayReference(target, editorDiv);
    } else {
        if (!getReferences().includes(target)) pushAndDisplayReference(target, editorDiv);
        pushAndDisplayReference(reference, editorDiv);
    }
    _refreshAnnotateRefFields();
}

// Scoped-down TinyMCE instance for the Description field — same library/pattern as the main
// 'write-column' editor in tinymce.js, just a smaller toolbar for a short annotation body
// rather than a full document, and its own init-once flag so it doesn't collide with that
// instance. Idempotent like every other editor's initialize() — called once, on first render.
let _annotateTinyMCEInitialized = false;
let _annotateTinyMCEReady = null;

function _initAnnotateTinyMCE() {
    if (_annotateTinyMCEReady) return _annotateTinyMCEReady;
    if (typeof tinymce === 'undefined') {
        throw new Error('TinyMCE failed to load — check your network connection.');
    }
    const dm = document.documentElement.classList.contains('dark-mode');
    _annotateTinyMCEReady = Promise.resolve(tinymce.init({
        selector: '#annotate-edit-body',
        height: 200,
        menubar: false,
        plugins: 'link image code',
        toolbar: 'bold italic link image code',
        skin: dm ? 'oxide-dark' : 'oxide',
        content_style: dm
            ? 'body { background:#1e1e1e; color:#e0e0e0; font-size:14px; }'
            : 'body { font-size:14px; }',
        setup: (editor) => {
            // Smaller toolbar than the main write-column editor's — see .annotate-mini-toolbar
            // in interface.css. Added on init rather than via a fixed selector since TinyMCE
            // generates the toolbar container itself.
            editor.on('init', () => {
                editor.getContainer().classList.add('annotate-mini-toolbar');
                const textarea = document.getElementById('annotate-edit-body');
                if (textarea?.value) editor.setContent(textarea.value);
            });
            // Mirrors tinymceConfig's own setup — keeps the backing textarea's raw value in
            // sync with user edits, since getContent()/setContent() elsewhere in this file
            // read/write that textarea directly as a pre-ready fallback.
            editor.on('change', () => {
                const ta = document.getElementById('annotate-edit-body');
                if (ta) ta.value = editor.getContent();
            });
        },
    })).then(() => { _annotateTinyMCEInitialized = true; }).catch(error => {
        _annotateTinyMCEReady = null; _annotateTinyMCEInitialized = false;
        throw error; // initializeEditor owns visible initialization feedback.
    });
    return _annotateTinyMCEReady;
}

// Appends HTML to the end of the Description field — never at the cursor — per the "content is
// always appended" rule. Writes through the live TinyMCE instance when it's ready; falls back
// to the backing textarea's raw value otherwise (mirrors tinymce.js's own tolerance for the
// narrow window between render and the async tinymce.init() finishing).
function _annotateAppendHTML(html) {
    const editor = tinymce.get('annotate-edit-body');
    if (editor) {
        const existing = editor.getContent();
        editor.setContent(existing ? existing + '<p>' + html + '</p>' : `<p>${html}</p>`);
        const ta = document.getElementById('annotate-edit-body');
        if (ta) ta.value = editor.getContent();
    } else {
        const ta = document.getElementById('annotate-edit-body');
        if (ta) ta.value = ta.value ? ta.value + '<br><br>' + html : html;
    }
}

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
    await _renderSendControls(sendSection);
    await _initAnnotateTinyMCE();
}

// Editable Title/URL/Author/Feed/Image fields for the reference this annotation targets —
// the same reference (_annotateTarget()) that _renderSendControls's Send handler reads as
// `target`. Edits write straight back into that reference object; no re-render needed. Always
// renders — against the draft reference when nothing's been cited yet — so the editor is usable
// for a manually-typed annotation, not just one seeded from a feed item.
function _renderAnnotateRefFields(container) {
    container.innerHTML = '';
    const ref = _annotateTarget();

    const makeField = (label, key) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'collection-editor-field';
        const fieldLabel = document.createElement('label');
        fieldLabel.textContent = label;
        wrapper.appendChild(fieldLabel);
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'collection-editor-input';
        input.value = ref[key] || '';
        input.addEventListener('change', () => {
            ref[key] = input.value;
            // Registers a manually-typed URL as this editor's target the moment it's filled in,
            // so the generic Publish flow (getReferences()-driven) sees it even if the user never
            // triggered "Write about this" — needed for rule 3's "publish throws if no URL" to be
            // correct for a hand-typed annotation, not just a cited one.
            if (key === 'url' && ref.url) pushReference(ref);
        });
        wrapper.appendChild(input);
        container.appendChild(wrapper);
    };

    makeField('Title', 'title');
    makeField('URL', 'url');
    makeField('Author', 'author_name');
    makeField('Feed', 'feed');
    makeField('Image', 'image');
}

// Re-renders just the Send row (account/visibility pickers) without touching the body
// textarea. The Send controls don't depend on reference data, so insertLink/insertLinkVia/
// loadContent no longer call this — only references.js's "Annotate this reference" button
// (switching into this editor fresh) still does, right after _renderAnnotateEditor's own
// initial call.
function _refreshAnnotateSendControls() {
    const sendSection = document.getElementById('annotate-send-section');
    if (sendSection) _renderSendControls(sendSection);
}

// Re-renders the ref-fields block — called after _annotateTarget()'s underlying reference
// gains or changes field data (a new reference filled the target, or an additional convergent
// reference arrived), so the Title/URL/Author/Feed/Image inputs reflect the current target.
function _refreshAnnotateRefFields() {
    const fieldsSection = document.getElementById('annotate-ref-fields');
    if (fieldsSection) _renderAnnotateRefFields(fieldsSection);
}

async function _renderSendControls(sendSection) {
    sendSection.innerHTML = '';
    const renderSession = captureAnnotationSession();
    const token = renderSession.token;
    if (!token) {
        const msg = document.createElement('p');
        msg.className = 'feed-status-message';
        msg.textContent = 'Log in with an annotation account to send.';
        sendSection.appendChild(msg);
        return;
    }

    const accounts = await ensureAccountsLoaded().catch(() => []);
    const writeAccts = accounts.map(parseAccountValue).filter(d =>
        d && (d.type === 'Annotate' || d.type === 'Hypothesis' || d.type === 'gRSShopper') && (d.permissions || 'rw').includes('w')
    );

    if (!writeAccts.length) {
        const msg = document.createElement('p');
        msg.className = 'feed-status-message';
        msg.textContent = 'No annotation account with write permission — add one in Account Settings.';
        sendSection.appendChild(msg);
        return;
    }

    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:8px;flex-wrap:wrap;';

    const storeLabel = document.createElement('label');
    storeLabel.textContent = 'Send to:';
    row.appendChild(storeLabel);

    const storeSelect = buildAccountSelect(writeAccts);
    storeSelect.style.cssText = 'font-size:0.85rem;padding:2px 4px;';
    row.appendChild(storeSelect);

    const visLabel = document.createElement('label');
    visLabel.textContent = 'Visibility:';
    row.appendChild(visLabel);

    const visSelect = buildVisibilitySelect();
    visSelect.style.cssText = 'font-size:0.85rem;padding:2px 4px;';
    row.appendChild(visSelect);

    const sendBtn = document.createElement('button');
    sendBtn.className = 'btn btn-small';
    sendBtn.textContent = 'Send';
    row.appendChild(sendBtn);

    sendSection.appendChild(row);

    sendBtn.addEventListener('click', async () => {
        const draft = _annotateTarget();
        const target = structuredClone(draft);
        const returnTo = _annotateReturnEditor;
        const session = renderSession;
        if (!target.url) {
            showErrorModal('No target URL for this annotation — fill in the URL field above.', { title: 'No target' });
            return;
        }
        const tags = structuredClone(window.getWriteTags?.() || []);
        const acct = structuredClone(writeAccts[parseInt(storeSelect.value, 10)]);
        const visibility = visSelect.value;

        sendBtn.disabled = true;
        sendBtn.textContent = 'Sending…';
        try {
            const bodyText = await editorHandlers['annotate-edit'].getContent();
            const ok = await _submitAnnotation(sendSection, target.id, target.url, bodyText, tags, visibility, acct, session.token, session,
                { title: target.title, author_name: target.author_name, feed: target.feed });
            if (ok) {
                showStatusMessage(`Sent to ${acct.title || acct.instance}.`);
                if (currentEditor === 'annotate-edit' && _annotateTarget() === draft
                    && JSON.stringify(_annotateTarget()) === JSON.stringify(target)
                    && await editorHandlers['annotate-edit'].getContent() === bodyText
                    && _annotateReturnEditor === returnTo) {
                    _annotateReturnEditor = null;
                    if (returnTo && returnTo !== 'annotate-edit') await switchToEditor(returnTo);
                }
            }
        } catch (error) {
            console.error('[annotations] editor send failed', error);
            showErrorModal(error.message, { title: 'Annotation failed' });
        } finally {
            sendBtn.disabled = false;
            sendBtn.textContent = 'Send';
        }
    });
}

// Empties the form to start a new annotation: drops the current target (and any convergent
// references alongside it) and the Description body, then re-renders the ref fields blank.
// Registered as this editor's 'Clear' editorFunctions entry (editor-menu button).
function _annotateClear() {
    clearReferences();
    _annotateDraftRef = null;
    _refreshAnnotateRefFields();
    editorHandlers['annotate-edit'].setContent('');
}

// Native local-file content is independent of getContent(), which remains the
// annotation's publishable HTML body. Keep the full target and convergent references.
function _annotationFileReferences(target, references) {
    const list = references.filter(ref => ref && typeof ref === 'object' && !Array.isArray(ref));
    return target.url ? [target, ...list.filter(ref => ref.url !== target.url)] : list;
}
function _setAnnotationBody(value) {
    const editor = typeof tinymce !== 'undefined' && tinymce.get('annotate-edit-body');
    if (editor) editor.setContent(value);
    const textarea = document.getElementById('annotate-edit-body');
    if (textarea) textarea.value = value;
}
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
        _annotateDraftRef = data.target;
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
        label: 'Annotate',
        icon: 'edit',
        contentTypes: ['text/plain', 'text/html', 'application/vnd.clist.annotation+json'],
        requiresAccount: false,

        editorFunctions: {
            'Clear': () => _annotateClear(),
        },

        initialize: async () => {
            currentEditor = 'annotate-edit';

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
            // Idempotent, like every other editor's initialize() — re-entering this editor
            // (e.g. a second Alt+A press) must not wipe whatever's already been typed.
            div.style.display = 'block';
            if (!_annotateTinyMCEInitialized) await _initAnnotateTinyMCE();
            if (_annotateTinyMCEReady) await _annotateTinyMCEReady;
            if (typeof loadPredefinedContent === 'function') await loadPredefinedContent('annotate-edit');
        },

        getContent: () => {
            const editor = tinymce.get('annotate-edit-body');
            if (editor) return editor.getContent().trim();
            const ta = document.getElementById('annotate-edit-body');
            return ta ? ta.value.trim() : '';
        },

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
