// grsshopper-editor.js — Dedicated gRSShopper post editor for the write-pane
// Part of CList, the next generation of learning and connecting with your community
//
// Depends on: utilities.js (escapeHtml, showStatusMessage, showErrorModal, parseAccountValue,
//             ensureAccountsLoaded), ui.js (buildAccountSelect), kvstore.js, editors.js
//             (currentEditor, editorHandlers, registerEditorPanes, switchEditorPane,
//             renderUploadPane), grsshopper_publish.js (window.grsshopperSavePost,
//             window.CList.uploaders.gRSShopper — loads before this file), the global `tinymce`
//             library object (same script tag tinymce.js uses) for this editor's own two TinyMCE
//             instances — the Write pane's long-form content (selector '#grsshopper-post-body')
//             and the Edit pane's short description (selector '#grsshopper-post-description'),
//             matching ghub's own post_content/post_description split — independent of
//             tinymce.js's 'write-column' instance and annotate-editor.js's 'annotate-edit-body',
//             each with its own init-once flag.
//
// A direct editor for a gRSShopper post record (api/clist.pl's cmd=clist_publish /
// cmd=clist_fetch) — not an annotation of something else the way annotate-edit is. Modeled on
// gRSShopper's own ghub post-edit screen's multi-pane Write/Edit/Upload/Publish tabs (editor/
// tabs.pl), using the shared pane-switcher (registerEditorPanes/switchEditorPane, editors.js)
// built for exactly this. Deliberately out of scope for this pass (see /srv/ROADMAP.md):
// scheduled/pub_date-gated posting, a Preview pane, an Analyze pane, and author/feed
// graph-linked autocomplete (gRSShopper's own graph API isn't exposed to CList yet) — Author/
// Feed here are plain text fields. "Publish" is immediate-only: create or update the post
// record via api_clist_publish, which already supports both (optional `id`); social-network
// rebroadcast stays on CList's own native Mastodon/Bluesky publishers, not duplicated here.

// The post record being edited — title/link/author/feed map directly onto api_clist_publish's
// fields; `id` is null until the first successful Publish, after which further Publishes update
// the same post instead of creating a new one. The post's two body fields — long-form content
// (Write pane) and description (Edit pane) — each live in their own TinyMCE instance, not here,
// same split as annotate-edit's ref/body separation.
let _grsshopperPost = { title: '', link: '', author: '', feed: '', id: null };

// gRSShopper write accounts and the live <select> picking among them, refreshed every time the
// Edit pane renders — read by the Upload and Publish panes to resolve which account to use,
// same "resolve from the picker, not findAccountByType" convention as annotate-editor.js's
// _annotateSendState.
let _grsshopperEditState = { accounts: [], accountSelect: null };

function _grsshopperSelectedAccount() {
    const { accounts, accountSelect } = _grsshopperEditState;
    return accountSelect ? accounts[parseInt(accountSelect.value, 10)] : null;
}

let _grsshopperTinyMCEInitialized = false;

function _initGrsshopperTinyMCE() {
    if (_grsshopperTinyMCEInitialized) return;
    if (typeof tinymce === 'undefined') {
        console.error('TinyMCE is not loaded.');
        showErrorModal('TinyMCE failed to load — check your network connection.', { title: 'Editor failed to load' });
        return;
    }
    const dm = document.documentElement.classList.contains('dark-mode');
    tinymce.init({
        selector: '#grsshopper-post-body',
        height: 400,
        menubar: false,
        plugins: 'link image code lists',
        toolbar: 'bold italic link image code bullist numlist',
        skin: dm ? 'oxide-dark' : 'oxide',
        content_style: dm
            ? 'body { background:#1e1e1e; color:#e0e0e0; font-size:14px; }'
            : 'body { font-size:14px; }',
        setup: (editor) => {
            editor.on('change', () => {
                const ta = document.getElementById('grsshopper-post-body');
                if (ta) ta.value = editor.getContent();
            });
        },
    });
    _grsshopperTinyMCEInitialized = true;
}

// Separate TinyMCE instance for the Edit pane's Description field (post_description — the
// standard short description, distinct from the Write pane's long-form post_content above).
// Own init-once flag/selector, same pattern as _initGrsshopperTinyMCE.
let _grsshopperDescTinyMCEInitialized = false;

function _initGrsshopperDescriptionTinyMCE() {
    if (_grsshopperDescTinyMCEInitialized) return;
    if (typeof tinymce === 'undefined') {
        console.error('TinyMCE is not loaded.');
        showErrorModal('TinyMCE failed to load — check your network connection.', { title: 'Editor failed to load' });
        return;
    }
    const dm = document.documentElement.classList.contains('dark-mode');
    tinymce.init({
        selector: '#grsshopper-post-description',
        height: 200,
        menubar: false,
        plugins: 'link lists',
        toolbar: 'bold italic link bullist numlist',
        skin: dm ? 'oxide-dark' : 'oxide',
        content_style: dm
            ? 'body { background:#1e1e1e; color:#e0e0e0; font-size:14px; }'
            : 'body { font-size:14px; }',
        setup: (editor) => {
            editor.on('change', () => {
                const ta = document.getElementById('grsshopper-post-description');
                if (ta) ta.value = editor.getContent();
            });
        },
    });
    _grsshopperDescTinyMCEInitialized = true;
}

function _grsshopperGetDescription() {
    const editor = tinymce.get('grsshopper-post-description');
    if (editor) return editor.getContent().trim();
    const ta = document.getElementById('grsshopper-post-description');
    return ta ? ta.value.trim() : '';
}

function _grsshopperSetDescription(value) {
    const editor = tinymce.get('grsshopper-post-description');
    if (editor) editor.setContent(value);
    const ta = document.getElementById('grsshopper-post-description');
    if (ta) ta.value = value;
}

// Appends HTML to the end of the post body — never at the cursor — mirrors annotate-editor.js's
// _annotateAppendHTML. Used by the Upload pane to insert an uploaded image.
function _grsshopperAppendHTML(html) {
    const editor = tinymce.get('grsshopper-post-body');
    if (editor) {
        const existing = editor.getContent();
        editor.setContent(existing ? existing + '<p>' + html + '</p>' : `<p>${html}</p>`);
        const ta = document.getElementById('grsshopper-post-body');
        if (ta) ta.value = editor.getContent();
    } else {
        const ta = document.getElementById('grsshopper-post-body');
        if (ta) ta.value = ta.value ? ta.value + '<br><br>' + html : html;
    }
}

// Write pane: just the post body — Title/Link/Author/Feed live on the Edit pane instead, same
// split ghub's own Write/Edit tabs use.
function _grsshopperRenderWritePane(container) {
    if (container.dataset.rendered) return;
    container.innerHTML = '';
    const wrapper = document.createElement('div');
    wrapper.className = 'collection-editor-field';
    const label = document.createElement('label');
    label.textContent = 'Post Body';
    wrapper.appendChild(label);
    const body = document.createElement('textarea');
    body.id = 'grsshopper-post-body';
    body.rows = 16;
    body.style.cssText = 'width:100%;box-sizing:border-box;';
    wrapper.appendChild(body);
    container.appendChild(wrapper);
    _initGrsshopperTinyMCE();
    container.dataset.rendered = '1';
}

// Edit pane: which gRSShopper account to publish to, Title/Link/Author/Feed, and the
// Description field (post_description — ghub's other TinyMCE field, distinct from the Write
// pane's post_content). The account/text fields are rebuilt every time this pane is shown (so a
// newly-added account or state change is picked up), but the Description field's own TinyMCE
// instance must not be torn down on every switch, so it lives in its own sub-div, rendered once
// and left alone — same "render once, append outside the part that gets wiped" split as the
// Write pane's own idempotence guard.
async function _grsshopperRenderEditPane(container) {
    if (!container.dataset.descRendered) {
        const descWrapper = document.createElement('div');
        descWrapper.className = 'collection-editor-field';
        descWrapper.style.cssText = 'border-top:1px solid #ccc;padding-top:8px;margin-top:8px;';
        const descLabel = document.createElement('label');
        descLabel.textContent = 'Description';
        descWrapper.appendChild(descLabel);
        const descTextarea = document.createElement('textarea');
        descTextarea.id = 'grsshopper-post-description';
        descTextarea.rows = 8;
        descTextarea.style.cssText = 'width:100%;box-sizing:border-box;';
        descWrapper.appendChild(descTextarea);
        container.appendChild(descWrapper);
        _initGrsshopperDescriptionTinyMCE();
        container.dataset.descRendered = '1';
    }

    let dynamicSection = document.getElementById('grsshopper-edit-dynamic');
    if (!dynamicSection) {
        dynamicSection = document.createElement('div');
        dynamicSection.id = 'grsshopper-edit-dynamic';
        container.insertBefore(dynamicSection, container.firstChild);
    }
    dynamicSection.innerHTML = '';

    const accountSection = document.createElement('div');
    dynamicSection.appendChild(accountSection);

    const accounts = (await ensureAccountsLoaded().catch(() => [])) || [];
    const writeAccts = accounts.map(parseAccountValue).filter(d =>
        d && d.type === 'gRSShopper' && (d.permissions || 'rw').includes('w')
    );

    if (!writeAccts.length) {
        const msg = document.createElement('p');
        msg.className = 'feed-status-message';
        msg.textContent = 'No gRSShopper account with write permission — add one in Account Settings.';
        accountSection.appendChild(msg);
        _grsshopperEditState = { accounts: [], accountSelect: null };
    } else {
        const row = document.createElement('div');
        row.className = 'collection-editor-field';
        const label = document.createElement('label');
        label.textContent = 'Account';
        row.appendChild(label);
        const select = buildAccountSelect(writeAccts);
        row.appendChild(select);
        accountSection.appendChild(row);
        _grsshopperEditState = { accounts: writeAccts, accountSelect: select };
    }

    const makeField = (fieldLabel, key, placeholder) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'collection-editor-field';
        const labelEl = document.createElement('label');
        labelEl.textContent = fieldLabel;
        wrapper.appendChild(labelEl);
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'collection-editor-input';
        input.value = _grsshopperPost[key] || '';
        if (placeholder) input.placeholder = placeholder;
        input.addEventListener('change', () => { _grsshopperPost[key] = input.value; });
        wrapper.appendChild(input);
        dynamicSection.appendChild(wrapper);
    };

    makeField('Title', 'title');
    // gRSShopper's post table is link-centric (api_clist_publish always writes post_type='link'
    // and requires a link URL) even for an original post written here — there's no "plain post,
    // no link" shape on the server side to target instead.
    makeField('Link URL', 'link', 'required by gRSShopper — the post\'s own URL once published, or a source link');
    makeField('Author', 'author');
    makeField('Feed', 'feed');
}

function _grsshopperRenderUploadPane(container) {
    const account = _grsshopperSelectedAccount();
    container.innerHTML = '';
    if (!account) {
        const msg = document.createElement('p');
        msg.className = 'feed-status-message';
        msg.textContent = 'Select a gRSShopper account on the Edit pane first.';
        container.appendChild(msg);
        return;
    }
    renderUploadPane(container, structuredClone(account), [], (result) => {
        _grsshopperAppendHTML(`<img src="${escapeHtml(result.url)}" alt="">`);
    });
}

function _grsshopperRenderPublishPane(container) {
    container.innerHTML = '';

    const status = document.createElement('p');
    status.className = 'feed-status-message';

    const account = _grsshopperSelectedAccount();
    if (!account) {
        status.textContent = 'Select a gRSShopper account on the Edit pane first.';
        container.appendChild(status);
        return;
    }

    const btn = document.createElement('button');
    btn.className = 'btn';
    btn.textContent = _grsshopperPost.id ? 'Update Post' : 'Publish Post';
    container.appendChild(btn);
    container.appendChild(status);

    btn.addEventListener('click', async () => {
        if (!_grsshopperPost.title || !_grsshopperPost.link || !_grsshopperGetDescription()) {
            showErrorModal('Fill in Title, Link URL, and Description on the Edit pane first.', { title: 'Missing fields' });
            return;
        }
        const acct = structuredClone(account);
        const fields = {
            title: _grsshopperPost.title,
            link: _grsshopperPost.link,
            author: _grsshopperPost.author,
            feed: _grsshopperPost.feed,
            description: _grsshopperGetDescription(),
            content: editorHandlers['grsshopper-post'].getContent(),
            id: _grsshopperPost.id || undefined,
        };
        btn.disabled = true;
        btn.textContent = _grsshopperPost.id ? 'Updating…' : 'Publishing…';
        try {
            const result = await window.grsshopperSavePost(acct, fields);
            _grsshopperPost.id = result.id;
            status.textContent = `Saved: ${result.url}`;
            showStatusMessage(`Saved to ${acct.title || acct.instance}.`);
        } catch (error) {
            console.error('[grsshopper-editor] publish failed', error);
            showErrorModal(error.message, { title: 'Publish failed' });
        } finally {
            btn.disabled = false;
            btn.textContent = _grsshopperPost.id ? 'Update Post' : 'Publish Post';
        }
    });
}

function _grsshopperClear() {
    _grsshopperPost = { title: '', link: '', author: '', feed: '', id: null };
    editorHandlers['grsshopper-post'].setContent('');
    _grsshopperSetDescription('');
    const editPane = document.getElementById('grsshopper-edit-pane');
    if (editPane && editPane.style.display !== 'none') _grsshopperRenderEditPane(editPane);
}

(function () {
    if (typeof editorHandlers === 'undefined') {
        console.error('editorHandlers is not defined — grsshopper-editor.js must load after editors.js');
        return;
    }

    editorHandlers['grsshopper-post'] = {
        label: 'gRSShopper Post',
        icon: 'post_add',
        contentTypes: ['text/html'],
        requiresAccount: false,
        // Hidden from the switcher/picker and blocked from direct init (editors.js's
        // initializeEditor()) unless the user is logged in and has a gRSShopper account
        // with write permission — same pattern as dropbox.js's visible() checks.
        visible: () => typeof isRegistered === 'function' && isRegistered()
            && !!findAccountByType('gRSShopper', { permission: 'w' }),

        editorFunctions: {
            'Write': () => switchEditorPane('grsshopper-post', 'write'),
            'Edit': () => switchEditorPane('grsshopper-post', 'edit'),
            'Upload': () => switchEditorPane('grsshopper-post', 'upload'),
            'Publish': () => switchEditorPane('grsshopper-post', 'publish'),
            'Clear': () => _grsshopperClear(),
        },

        initialize: async () => {
            currentEditor = 'grsshopper-post';

            // This editor has its own Title field (on the Edit pane) — hide the shared
            // #write-title-row, same as annotate-edit. Restored by initializeEditor() on switch.
            const writeTitleRowEl = document.getElementById('write-title-row');
            if (writeTitleRowEl) writeTitleRowEl.style.display = 'none';

            const writePaneContent = window.CList.ui.view.writePaneContent;
            let div = document.getElementById('grsshopperPostEditDiv');
            if (!div) {
                div = document.createElement('div');
                div.id = 'grsshopperPostEditDiv';
                writePaneContent.appendChild(div);

                const writePane = document.createElement('div');
                writePane.id = 'grsshopper-write-pane';
                const editPane = document.createElement('div');
                editPane.id = 'grsshopper-edit-pane';
                editPane.style.display = 'none';
                const uploadPane = document.createElement('div');
                uploadPane.id = 'grsshopper-upload-pane';
                uploadPane.style.display = 'none';
                const publishPane = document.createElement('div');
                publishPane.id = 'grsshopper-publish-pane';
                publishPane.style.display = 'none';
                div.appendChild(writePane);
                div.appendChild(editPane);
                div.appendChild(uploadPane);
                div.appendChild(publishPane);

                registerEditorPanes('grsshopper-post', [
                    { id: 'write', container: writePane, render: _grsshopperRenderWritePane },
                    { id: 'edit', container: editPane, render: _grsshopperRenderEditPane },
                    { id: 'upload', container: uploadPane, render: _grsshopperRenderUploadPane },
                    { id: 'publish', container: publishPane, render: _grsshopperRenderPublishPane },
                ]);
                switchEditorPane('grsshopper-post', 'write');
            }
            // Idempotent, like every other editor's initialize() — re-entering must not wipe
            // whatever's already been typed.
            div.style.display = 'block';
        },

        getContent: () => {
            const editor = tinymce.get('grsshopper-post-body');
            if (editor) return editor.getContent().trim();
            const ta = document.getElementById('grsshopper-post-body');
            return ta ? ta.value.trim() : '';
        },

        setContent: (value) => {
            const editor = tinymce.get('grsshopper-post-body');
            if (editor) editor.setContent(value);
            const ta = document.getElementById('grsshopper-post-body');
            if (ta) ta.value = value;
        },

        loadContent: ({ type, value }) => {
            const itemContent = (type === 'text/html') ? cleanHTMLContent(value) : escapeHtml(value);
            if (itemContent) _grsshopperAppendHTML(itemContent);
        },
    };
})();
