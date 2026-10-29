//  editors.js  -  Functions that handle the interface with the content editor
//  Part of CList, the next generation of learning and connecting with your community
//
//  Version version 0.1 created by Stephen Downes on January 27, 2025
//
//  Copyright Stephen Downes 2025
//  Licensed under Creative Commons Attribution 4.0 International https://creativecommons.org/licenses/by/4.0/
//
//  This software carries NO WARRANTY OF ANY KIND.
//  This software is provided "AS IS," and you, its user, assume all risks when using it.
// 



// Name of the current editor
let currentEditor = 'texteditor'; // Default editor is TinyMCE

// The specific account (raw kvstore entry) backing the current editor, if any —
// e.g. which Etherpad account is active. null for built-in, non-account-backed editors.
let currentEditorAccount = null;

// Content waiting to be loaded into the next editor that is initialized.
// Shape: { type: string, value: string } — set by switchToEditor() when carrying content, consumed by loadPredefinedContent().
let pendingContent = null;

// The My Pages row currently represented by the editor's content, or null. Set by
// loadSavedPage()'s empty-editor/New/Replace paths; cleared by anything that makes
// the editor stop representing that exact page (switching editors, Load blank).
// Shape: { url: string, title: string } | null.
let currentLoadedPage = null;

// Running per-editor state — parked when you switch away from an editor, restored
// when you switch back to it, so each editor keeps its own page/cites independent
// of whatever any other editor is doing, instead of the single shared
// currentLoadedPage/references that switching used to reset on every call. Keyed by
// editorStateKey() so two different accounts on the same account-backed editor type
// (e.g. two Etherpad logins) get separate entries, matching the isCurrent check in
// _populateAccountEditors() below. Not persisted — lost on reload, same as
// currentEditor/currentLoadedPage always have been.
const editorStates = {};

function editorStateKey(editorType, account) {
    return account?.key ? `${editorType}:${account.key}` : editorType;
}

function _parkCurrentEditorState() {
    editorStates[editorStateKey(currentEditor, currentEditorAccount)] = {
        page: currentLoadedPage,
        references: getReferences().slice(),
    };
}

function _restoreEditorState(editorType, account) {
    const parked = editorStates[editorStateKey(editorType, account)];
    setLoadedPage(parked ? parked.page : null);
    setReferences(parked ? parked.references : []);
}
//
// Define handlers for each editor
//
// Each handler object has the following fields:
//
//   label         {string}   Human-readable name shown in the editor picker UI.
//   icon          {string}   Material Icons name shown beside the label (e.g. 'edit').
//   contentTypes  {string[]} MIME types this editor's loadContent() can genuinely accept
//                            (e.g. ['text/html']). Empty array means none — the editor
//                            doesn't support loading generic file/page content at all
//                            (e.g. collection, whose items load via a separate, structured
//                            path) — it is never treated as "accepts anything".
//   requiresAccount {bool}   true if this editor needs a kvstore account with permission 'e'
//                            and a matching type field (e.g. Etherpad). false for built-ins.
//   isActive()     {function, optional} requiresAccount editors only: returns true if there's
//                            already a live connection to resume even without a matching saved
//                            account (e.g. an active guest Etherpad session) — lets the switcher
//                            offer a way back in without requiring a saved account.
//   initialize()             Set currentEditor, create/show DOM, call loadPredefinedContent().
//                            Must be idempotent: if the editor's DOM/connection already exists
//                            and represents what's being asked for, just show it — don't rebuild
//                            or reset state. This is what lets editors "stay open": switching
//                            away and back resumes exactly where you left off.
//   getContent()             Return current editor content as a string.
//   loadContent({type,value}, itemId?)
//                            Insert/append content at cursor. type is a MIME type string.
//   setContent(value)        {function, optional} Replace the entire editor body (no cursor
//                            semantics). Local editors only (texteditor, tinymce) — omit it for
//                            account-backed/collaborative editors (collab, etherpad, collection)
//                            rather than attempting collaborative-doc replace. Used by
//                            loadSavedPage()'s New/Replace options.
//
// To add a new editor, create a new JS file and register its handler:
//
//   (function () {
//       editorHandlers['myeditor'] = {
//           label: 'My Editor',
//           contentTypes: ['text/html'],
//           requiresAccount: false,
//           initialize: () => { currentEditor = 'myeditor'; /* … */ loadPredefinedContent('myeditor'); },
//           getContent: () => { /* return content string */ },
//           loadContent: ({ type, value }, itemId) => { /* insert value into editor */ }
//       };
//   })();
//
// Usage:
//   const handler = editorHandlers[currentEditor];
//   if (handler?.getContent) content = handler.getContent();

const editorHandlers = {
    texteditor: {
        label: 'Text',
        icon: 'notes',
        contentTypes: ['text/plain'],
        requiresAccount: false,
        initialize: () => {

            currentEditor = 'texteditor';
            // alert(window.CList.config.flaskSiteUrl);
            etherpadUsername = getSiteSpecificCookie(window.CList.config.flaskSiteUrl, window.CList.keys.USERNAME);
            if (!etherpadUsername) { etherpadUsername = 'user' + Math.floor(Math.random() * 1000); }
            // closeAllEditors();

            // Check whether textEditorDiv exists; if it doesn't, create it
            const writePaneContent = window.CList.ui.view.writePaneContent;
            let textEditorDiv = document.getElementById('textEditorDiv');
            if (!textEditorDiv) {
                textEditorDiv = document.createElement('div');
                textEditorDiv.id = 'textEditorDiv';
                textEditorDiv.innerHTML = `<textarea id="text-column"></textarea>
                        <div class="currentReferences"></div>`;
                writePaneContent.appendChild(textEditorDiv);
            }
            textEditorDiv.style.display = 'block';  // Show the editor

            // Check whether <div id="texteditor-references" ...> exists; if it doesn't, create it
            let textEditorReferences = document.getElementById('texteditor-references');
            if (!textEditorReferences) {
                textEditorReferences = document.createElement('div');
                textEditorReferences.id = 'texteditor-references';
                textEditorReferences.className = 'allReferences';
                writePaneContent.parentNode.insertBefore(textEditorReferences, writePaneContent.nextSibling);
            }
            
            // Wire up auto-save once (guard against re-wiring on subsequent initialize calls)
            if (!textEditorDiv.dataset.draftWired) {
                const ta = window.CList.ui.view.textColumn;
                ta.addEventListener('input', debounce(() => saveDraft('texteditor', ta.value), 1000));
                ta.addEventListener('drop', function(e) {
                    const dt = e.dataTransfer;
                    if (!dt) return;
                    const url   = window._extractDropUrl(dt.getData('text/uri-list'), dt.getData('text/html'));
                    const title = dt.getData('text/x-clist-title') || null;
                    window._attributeDroppedContent(url, title);
                });
                textEditorDiv.dataset.draftWired = '1';
            }

            const hasPending = !!pendingContent;
            loadPredefinedContent('texteditor');
            if (!hasPending) offerDraftRestore('texteditor', 'text/plain');

            console.log("Text editor initialized");
        },
        getContent: () => {
            const textarea = window.CList.ui.view.textColumn;
            if (!textarea) {
                console.error("Textarea with ID 'write-column' not found.");
                return ""; // Return an empty string or handle as needed
            }
            return textarea.value.trim();
        },
        loadContent: ({ type, value }, itemId) => {
            // Strip HTML tags when receiving HTML content — the text editor works in plain text
            const itemContent = (type === 'text/html') ? cleanHTMLContent(value) : value;

            const textarea = window.CList.ui.view.textColumn;
            if (textarea) {
                // Get the current selection start position
                const cursorPosition = textarea.selectionStart;
        
                // Split the text content into two parts based on the cursor position
                const textBefore = textarea.value.substring(0, cursorPosition);
                const textAfter = textarea.value.substring(cursorPosition);
        
                // Insert the new content at the cursor position
                textarea.value = textBefore + itemContent + textAfter;
        
                // Update the cursor position to after the inserted content
                const newCursorPosition = cursorPosition + itemContent.length;
                textarea.setSelectionRange(newCursorPosition, newCursorPosition);
            }
    
            // Add to references
            if (itemId) {
                const editorDiv = document.getElementById('textEditorDiv');
                const reference = createReference(itemId, editorDiv);
                displayCurrentReference(reference, editorDiv);
                displayReferences(editorDiv);
            }
        },
        setContent: (value) => {
            const textarea = window.CList.ui.view.textColumn;
            if (textarea) textarea.value = value;
        }
    },
    // Add more editors as needed
};


// Common Editor Functions


//
// Define handlers for each content loader
//
//      The loaders registry is an ordered array of loader objects displayed
//      in the right-pane Load list. Each loader must have:
//
//          label  {string}   Display name shown in the list
//          icon   {string}   Material Icons name (or logoSrc for a masked SVG)
//          load   async () => { type, value } | null
//
//      load() returns { type: 'text/plain'|'text/html', value: string }, or null
//      if loading was cancelled. Register a loader from any service .js file:
//
//          (function () {
//              window.CList.loaders = window.CList.loaders || [];
//              window.CList.loaders.push({
//                  label: 'My Source',
//                  icon:  'source',
//                  load:  async () => { return { type, value }; }
//              });
//          })();
//

window.CList.loaders = window.CList.loaders || [];

// Open the right-pane load list
async function playLoad() {
    populateLoadOptions();
    openRightInterface('load-instructions');
}

// Build the load list from the loaders registry
function populateLoadOptions() {
    const optionsDiv = window.CList.ui.view.loadOptions;
    optionsDiv.innerHTML = '';

    const list = document.createElement('div');
    list.className = 'account-list';

    const tip = document.createElement('div');
    tip.className = 'list-tip';
    tip.textContent = 'Select a source to load from';
    list.appendChild(tip);

    window.CList.loaders.forEach(handler => {
        if (typeof handler.visible === 'function' && !handler.visible()) return;
        const btn = document.createElement('button');
        btn.className = 'account-button';

        const iconEl = document.createElement('span');
        if (handler.logoSrc) {
            iconEl.className = 'service-icon-img';
            iconEl.style.webkitMask = `url('${handler.logoSrc}') no-repeat center / contain`;
            iconEl.style.mask = `url('${handler.logoSrc}') no-repeat center / contain`;
        } else {
            iconEl.className = 'material-icons';
            iconEl.textContent = handler.icon || 'upload';
        }

        const nameEl = document.createElement('span');
        nameEl.textContent = handler.label;

        btn.appendChild(iconEl);
        btn.appendChild(nameEl);

        btn.addEventListener('click', async () => {
            const content = await handler.load();
            if (!content || content.value === undefined || content.type === undefined) return;

            // Delegate to the same routing/empty-check/choice logic "Load a page" (My
            // Pages) already uses, so every load path — file, page, or any other
            // registered loader — behaves identically: strict contentTypes matching,
            // a choice when more than one editor qualifies, and a warn-before-overwrite
            // prompt when the target editor already has content. Cancel returns here
            // (this loader list) rather than My Pages' default.
            // content.page (set by file-based loaders, e.g. files.js's restorePostContent())
            // carries the loaded filename through to the "Loaded: …" indicator.
            await loadSavedPage(content, content.page || null, optionsDiv, () => populateLoadOptions());
        });

        list.appendChild(btn);
    });

    optionsDiv.appendChild(list);
}

// More than one local editor can handle the just-loaded content's type (and the
// current editor isn't one of them) — let the user pick instead of silently
// guessing. Called only for keys that exclude currentEditor (loadSavedPage()
// already routes a currentEditor match straight to the empty/replace-or-insert
// check). The chosen editor's DOM/content persists across switches (per-editor
// state park/restore), so it may still hold old content from an earlier visit —
// each choice below checks for that before switching, same as loadSavedPage()'s
// own switch-branch. Rendered in the same right-pane spot, mirroring
// playLoadBlank()'s list styling. page/renderTarget/onCancel mirror loadSavedPage()'s
// own params — passed through so a choice offered mid-"Load a page" or mid-"Load
// from file" lands back in the right place either way.
function _offerEditorChoice(keys, content, page, renderTarget, onCancel) {
    const optionsDiv = renderTarget || window.CList.ui.view.loadOptions;
    if (!optionsDiv) return;
    optionsDiv.innerHTML = '';

    const tip = document.createElement('p');
    tip.className = 'list-tip';
    tip.textContent = 'More than one editor can open this content — choose one:';
    optionsDiv.appendChild(tip);

    const list = document.createElement('div');
    list.className = 'account-list';

    keys.forEach(key => {
        const handler = editorHandlers[key];
        const btn = document.createElement('button');
        btn.className = 'account-button';

        const iconEl = document.createElement('span');
        iconEl.className = 'material-icons';
        iconEl.textContent = handler.icon || 'edit';

        const nameEl = document.createElement('span');
        nameEl.textContent = handler.label || key;

        btn.appendChild(iconEl);
        btn.appendChild(nameEl);
        btn.addEventListener('click', async () => {
            const targetHandler = editorHandlers[key];
            let targetExisting = '';
            if (typeof targetHandler.getContent === 'function') {
                try {
                    targetExisting = await targetHandler.getContent();
                } catch (e) {
                    // Target editor instance doesn't exist yet (never visited this
                    // session) — treat as empty, same as a fresh editor.
                    targetExisting = '';
                }
            }
            const targetIsEmpty = !targetExisting || !removeHtml(targetExisting).trim();

            if (targetIsEmpty) {
                await switchToEditor(key, content);
                setLoadedPage(page || null);
                document.getElementById('generic-modal')?.remove();
                return;
            }

            // Switch without carrying content, so it doesn't get auto-inserted during
            // init — then offer the same Replace/Insert/Cancel choice as other loads.
            // switchToEditor() calls closeRightPane() internally, so reopen it before
            // rendering the dialogue or it ends up invisible in a width:0 pane.
            await switchToEditor(key, null);
            openRightPane();
            offerReplaceOrInsert(key, targetHandler, content, page, renderTarget, onCancel);
            document.getElementById('generic-modal')?.remove();
        });
        list.appendChild(btn);
    });

    optionsDiv.appendChild(list);

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn btn-secondary';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.onclick = onCancel || (() => populateLoadOptions());
    optionsDiv.appendChild(cancelBtn);
}

// Register built-in load handlers
(function () {
    window.CList.loaders = window.CList.loaders || [];

    window.CList.loaders.push({
        label: 'Load blank',
        icon:  'note_add',
        load:  async () => {
            // Self-managing: asks which editor type, warns if the current editor
            // would lose content, then loads a blank instance of the chosen type.
            // See playLoadBlank() below. Returning null tells the generic dispatch
            // in populateLoadOptions() there's nothing more for it to do.
            playLoadBlank();
            return null;
        }
    });

    window.CList.loaders.push({
        label: 'Load template',
        icon:  'folder_open',
        load:  async () => {
            const optionsDiv = window.CList.ui.view.loadOptions;
            if (optionsDiv) optionsDiv.innerHTML = '<p class="list-tip">Template loading is not yet implemented.</p>';
            return null;
        }
    });
})();

// "Load blank" step 1: ask which editor type to load blank. Lists the same
// built-in/resumable-account-less editors as the switcher (_populateBuiltInEditors) —
// account-backed editors otherwise have no clear "blank" meaning (their content lives
// server-side), so they're left out, matching that existing convention.
function playLoadBlank() {
    const optionsDiv = window.CList.ui.view.loadOptions;
    if (!optionsDiv) return;
    optionsDiv.innerHTML = '';

    const tip = document.createElement('p');
    tip.className = 'list-tip';
    tip.textContent = 'Load a blank editor — choose which type:';
    optionsDiv.appendChild(tip);

    const list = document.createElement('div');
    list.className = 'account-list';

    Object.entries(editorHandlers).forEach(([key, handler]) => {
        if (typeof handler.initialize !== 'function') return;
        const resumableWithoutAccount = handler.requiresAccount
            && typeof handler.isActive === 'function' && handler.isActive();
        if (handler.requiresAccount && !resumableWithoutAccount) return;
        if (typeof handler.visible === 'function' && !handler.visible()) return;

        const btn = document.createElement('button');
        btn.className = 'account-button';

        const iconEl = document.createElement('span');
        iconEl.className = 'material-icons';
        iconEl.textContent = handler.icon || 'note_add';

        const nameEl = document.createElement('span');
        nameEl.textContent = handler.label || key;

        btn.appendChild(iconEl);
        btn.appendChild(nameEl);
        btn.addEventListener('click', () => _confirmAndLoadBlank(key, handler));
        list.appendChild(btn);
    });

    optionsDiv.appendChild(list);
}

// "Load blank" step 2: warn if the *current* editor (not the target) has content
// that would be discarded by switching/clearing. Mirrors offerReplaceOrInsert's
// button-row pattern below.
function _confirmAndLoadBlank(targetKey, targetHandler) {
    // Blanking a *different* editor now switches away first, which parks the
    // current editor's content/cites for later resumption (switchToEditor()) rather
    // than discarding them — nothing is lost, so there's nothing to warn about.
    // Only blanking the editor you're actually in is destructive.
    if (targetKey !== currentEditor) {
        _doLoadBlank(targetKey);
        return;
    }

    const currentHandler = editorHandlers[currentEditor];
    const hasContent = currentHandler && editorHasActiveContent(currentHandler);

    if (!hasContent) {
        _doLoadBlank(targetKey);
        return;
    }

    const optionsDiv = window.CList.ui.view.loadOptions;
    if (!optionsDiv) return;
    optionsDiv.innerHTML = '';

    const title = document.createElement('p');
    title.className = 'list-tip-title';
    title.textContent = 'Discard unsaved content?';
    optionsDiv.appendChild(title);

    const msg = document.createElement('p');
    msg.className = 'list-tip';
    msg.textContent = `The current ${currentHandler.label || currentEditor} editor has unsaved content. ` +
        `Loading a blank ${targetHandler.label || targetKey} editor will discard it.`;
    optionsDiv.appendChild(msg);

    const row = document.createElement('div');
    row.className = 'published-page-confirm';

    const discardBtn = document.createElement('button');
    discardBtn.className = 'btn';
    discardBtn.textContent = 'Discard and continue';
    discardBtn.onclick = () => _doLoadBlank(targetKey);
    row.appendChild(discardBtn);

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn btn-secondary';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.onclick = () => playLoadBlank();
    row.appendChild(cancelBtn);

    optionsDiv.appendChild(row);
}

// "Load blank" step 3: actually load a blank instance of targetKey.
async function _doLoadBlank(targetKey) {
    clearDraft(targetKey);

    // Switch first when targetKey differs — this parks the editor being left (its
    // page/cites get resumed later, same as any other switch) before any clearing
    // below touches the *target's* own just-restored state, not the source's.
    if (targetKey !== currentEditor) {
        await switchToEditor(targetKey); // no carriedContent — resumes targetKey's own parked state
    }

    window.clearWriteTags?.();
    clearReferences(); // global references list/panel
    document.querySelectorAll('.currentReference').forEach(el => el.remove()); // per-editor "last loaded" attribution block
    setLoadedPage(null);

    const handler = editorHandlers[targetKey];
    if (typeof handler.setContent === 'function') {
        handler.setContent('');
    } else if (targetKey === 'collection') {
        _activeCollection = null; // collection has no setContent — blank it directly
    }
    if (targetKey === currentEditor) await initializeEditor(targetKey);

    closeLoadSurfaces();
    updateEditorIndicator();
    showStatusMessage('Blank editor loaded.');
}


// Close the editor-switch overlay and return to the editor, regardless of
// whether the overlay is currently open — safe to call unconditionally.
function closeEditorSwitchOverlay() {
    const overlay = document.getElementById('write-load');
    const content = document.getElementById('write-pane-content');
    if (overlay) overlay.style.display = 'none';
    if (content) content.style.display = 'block';
}


// Does this editor currently hold content worth resuming, independent of whether it's the
// one currently showing? Prefers handler.isActive() (account-based editors like Etherpad,
// where "active" means "has a live connection", not "has text") — falls back to a
// synchronous, non-empty handler.getContent() for text-based editors. An editor that hasn't
// been initialized yet (e.g. getContent() throws because its DOM/instance doesn't exist)
// simply isn't active — that's an expected case, not an error.
function editorHasActiveContent(handler) {
    try {
        if (typeof handler.isActive === 'function') return handler.isActive();
        if (typeof handler.getContent === 'function') {
            const content = handler.getContent();
            return typeof content === 'string' && content.trim().length > 0;
        }
    } catch (e) { /* not initialized — not active */ }
    return false;
}

// Synchronously populate the built-in (no-account) editor buttons. An editor that
// requiresAccount is also listed here when it reports an active account-less connection to
// resume (handler.isActive()) — e.g. a live guest Etherpad session — so there's a way back
// into it from the switcher without needing a saved account.
function _populateBuiltInEditors() {
    const builtInOptions = document.getElementById('editor-switch-options');
    builtInOptions.innerHTML = '';
    Object.entries(editorHandlers).forEach(([key, handler]) => {
        if (typeof handler.initialize !== 'function') return;
        const resumableWithoutAccount = handler.requiresAccount
            && typeof handler.isActive === 'function' && handler.isActive();
        if (handler.requiresAccount && !resumableWithoutAccount) return;
        if (typeof handler.visible === 'function' && !handler.visible()) return;
        const isCurrent = key === currentEditor;
        const tag = isCurrent ? ' [Selected]' : (editorHasActiveContent(handler) ? ' [Active]' : '');
        const label = (handler.label || key) + tag;
        const onClick = isCurrent ? closeEditorSwitchOverlay : () => _switchToEditorFromPicker(key);
        builtInOptions.appendChild(makeEditorButton(label, handler.icon, onClick));
    });
    document.getElementById('editor-switch-account-options').innerHTML = '';
}

// Asynchronously populate account-based editor buttons (may fetch accounts).
async function _populateAccountEditors() {
    if (typeof isRegistered === 'function' && isRegistered()) {
        if (!Array.isArray(window.CList.accounts) || window.CList.accounts.length === 0) {
            try { window.CList.accounts = await getAccounts(window.CList.config.flaskSiteUrl); } catch(e) { showErrorModal('Could not load accounts: ' + e.message, { title: 'Could Not Load Accounts' }); }
        }
    }
    const accountList = document.getElementById('editor-switch-account-options');
    (window.CList.accounts || []).forEach(account => {
        const parsedValue = parseAccountValue(account);
        if (!parsedValue || !parsedValue.permissions.includes('e')) return;
        const editorType = parsedValue.type?.toLowerCase();
        const handler = editorHandlers[editorType];
        if (!handler || !handler.requiresAccount) return;
        const isCurrent = editorType === currentEditor && currentEditorAccount?.key === account.key;
        const tag = isCurrent ? ' [Selected]' : (editorHasActiveContent(handler) ? ' [Active]' : '');
        const label = `${parsedValue.title} (${handler.label})` + tag;
        const onClick = isCurrent ? closeEditorSwitchOverlay : () => _switchToEditorFromPicker(editorType, account);
        accountList.appendChild(makeEditorButton(label, handler.icon, onClick));
    });
}

// Rebuild the editor list in the right pane.
async function populateEditorList() {
    _populateBuiltInEditors();
    await _populateAccountEditors();
}

// Open the editor switcher as an overlay on the write pane — opens immediately
// with built-in editors, then appends account-based editors once accounts are fetched.
// Switching editors never carries typed content across — each editor keeps its own
// independent state (see initialize()'s resume contract above); this is purely a picker.
async function playEditorSwitch() {
    _populateBuiltInEditors();
    document.getElementById('write-load').style.display = 'block';
    document.getElementById('write-pane-content').style.display = 'none';
    await _populateAccountEditors();
}


// Switch to a different editor, optionally delivering freshly-loaded content into it
// (carriedContent — used by the Load dispatch in populateLoadOptions() when the current
// editor can't handle the loaded content's type; never used for picker-driven switches,
// which pass no carriedContent so each editor resumes its own independent state).
// account — the raw kvstore entry for the account-backed editor being switched to, or
// undefined/null for built-in editors.
async function switchToEditor(editorType, carriedContent, account) {
    if (carriedContent) pendingContent = carriedContent;

    // Park the outgoing editor's page/cites, then resume whatever was parked for
    // the target last time it was open (or a clean slate if it's never been visited).
    // Callers carrying a page forward explicitly (loadSavedPage(), _offerEditorChoice())
    // re-set it right after calling us, overriding whatever got restored here.
    _parkCurrentEditorState();
    await initializeEditor(editorType, account ?? null);
    _restoreEditorState(currentEditor, currentEditorAccount);

    closeRightPane();
    closeEditorSwitchOverlay();
    updateEditorIndicator();
    await populateEditorList();
}


// The one true "user manually picked a different editor" entry point — the
// editor-switch picker's built-in and account-based buttons both call this instead
// of switchToEditor() directly. switchToEditor() itself is also used for
// content-type-driven forced switches (_offerEditorChoice, loadSavedPage) where the
// source editor can't even hold the new content, so those keep calling it directly
// and skip this prompt. Only offers a choice when the outgoing editor actually has
// content worth asking about (editorHasActiveContent) — otherwise switches straight
// through, same as before this existed.
async function _switchToEditorFromPicker(editorType, account) {
    const sourceHandler = editorHandlers[currentEditor];
    if (!sourceHandler || !editorHasActiveContent(sourceHandler)) {
        await switchToEditor(editorType, null, account);
        return;
    }
    _offerContentTransfer(editorType, account);
}

// Rendered into the editor-switch overlay when the editor being left has content.
// No automated transfer: Overwrite/Insert/Don't transfer/Cancel, mirroring
// offerReplaceOrInsert()'s New/Replace/Insert pattern for the same reason — Overwrite
// needs targetHandler.setContent, which collab/etherpad/collection editors don't have,
// so it's omitted for those targets (Insert, via loadContent, is still offered).
// Overwrite replaces the target's cites with the source's; Insert unions them
// (deduped by url, same rule pushReference() already uses); Don't transfer leaves
// whatever _restoreEditorState() just resumed for the target untouched.
function _offerContentTransfer(targetKey, account) {
    const sourceHandler = editorHandlers[currentEditor];
    const sourceLabel = sourceHandler.label || currentEditor;
    const targetHandler = editorHandlers[targetKey];
    const targetLabel = targetHandler.label || targetKey;
    const sourceType = (sourceHandler.contentTypes && sourceHandler.contentTypes[0]) || 'text/plain';
    const sourceContent = (typeof sourceHandler.getContent === 'function') ? sourceHandler.getContent() : '';
    const sourceRefs = getReferences().slice();

    const optionsDiv = document.getElementById('editor-switch-options');
    const accountOptionsDiv = document.getElementById('editor-switch-account-options');
    if (!optionsDiv) return;
    if (accountOptionsDiv) accountOptionsDiv.innerHTML = '';
    optionsDiv.innerHTML = '';

    const title = document.createElement('p');
    title.className = 'list-tip-title';
    title.textContent = 'Transfer content to the new editor?';
    optionsDiv.appendChild(title);

    const msg = document.createElement('p');
    msg.className = 'list-tip';
    msg.textContent = `The ${sourceLabel} editor has content. Carry it over to ${targetLabel}?`;
    optionsDiv.appendChild(msg);

    const row = document.createElement('div');
    row.className = 'published-page-confirm';

    if (typeof targetHandler.setContent === 'function') {
        const overwriteBtn = document.createElement('button');
        overwriteBtn.className = 'btn';
        overwriteBtn.textContent = 'Overwrite';
        overwriteBtn.onclick = async () => {
            await switchToEditor(targetKey, null, account);
            targetHandler.setContent(sourceContent);
            setReferences(sourceRefs);
        };
        row.appendChild(overwriteBtn);
    }

    if (typeof targetHandler.loadContent === 'function') {
        const insertBtn = document.createElement('button');
        insertBtn.className = 'btn';
        insertBtn.textContent = 'Insert';
        insertBtn.onclick = async () => {
            await switchToEditor(targetKey, null, account);
            targetHandler.loadContent({ type: sourceType, value: sourceContent });
            const merged = getReferences().slice();
            sourceRefs.forEach(ref => { if (!merged.some(r => r.url === ref.url)) merged.push(ref); });
            setReferences(merged);
        };
        row.appendChild(insertBtn);
    }

    const noneBtn = document.createElement('button');
    noneBtn.className = 'btn btn-secondary';
    noneBtn.textContent = "Don't transfer";
    noneBtn.onclick = () => switchToEditor(targetKey, null, account);
    row.appendChild(noneBtn);

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn btn-secondary';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.onclick = () => populateEditorList();
    row.appendChild(cancelBtn);

    optionsDiv.appendChild(row);
}


// Update the editor indicator button label to match the current editor
function updateEditorIndicator() {
    const handler = editorHandlers[currentEditor];
    const label = handler?.label || currentEditor;
    const status = document.getElementById('editor-status');
    if (status) status.textContent = 'editor: ' + label;
}


// Track/display which My Pages page (if any) the editor's content currently
// represents. page is the My Pages row (kind, url, title, serviceId, service,
// mimeType, accountInstance, pageKey/collectionKey, format, ...) or null.
// Kept as a full copy (not just {url,title}) so Republish and the Post-time
// overwrite check have what they need to find the adapter/account and update
// the right kvstore record.
function setLoadedPage(page) {
    currentLoadedPage = page ? { ...page } : null;
    updateLoadedPageUI();
}

function updateLoadedPageUI() {
    const indicator = document.getElementById('loaded-page-indicator');
    const filenameEl = document.getElementById('loaded-page-filename');
    const republishBtn = document.getElementById('republish-button');
    const statusEl = document.getElementById('republish-status');
    if (indicator) {
        if (currentLoadedPage) {
            if (filenameEl) {
                // publicationUrl covers local-page records (stamped by publish.js after
                // recordPublication, since those don't carry url/format themselves);
                // url/format are already set directly on 'page'-kind records (see
                // setLoadedPage() calls in publish.js).
                const pubUrl = currentLoadedPage.publicationUrl || currentLoadedPage.url || '';
                const format = currentLoadedPage.format;
                // kind === 'file' (files.js's restorePostContent(), dropbox.js's
                // _openInEditor()) has no republish target — labelled distinctly so
                // it's not mistaken for a tracked My Pages/published record.
                const isFile = currentLoadedPage.kind === 'file';
                let label = isFile
                    ? `Loaded file: ${currentLoadedPage.title || ''}`
                    : `Loaded: ${currentLoadedPage.title || pubUrl || ''}`;
                if (pubUrl) label += ` → ${pubUrl}`;
                if (format) label += ` [${format}]`;
                filenameEl.textContent = label;
                filenameEl.title = pubUrl;
            }
            indicator.style.display = '';
        } else {
            indicator.style.display = 'none';
        }
    }
    // Republish is shown/hidden by whether the Editor States Array's record for
    // this editor actually carries a publication location — not by its 'kind'.
    // A 'file' load never has one; a 'local-page' doesn't either until publish.js
    // stamps publicationUrl/url/service/serviceId onto it after a first publish.
    const hasPublicationLocation = !!(currentLoadedPage && (
        currentLoadedPage.service ||
        currentLoadedPage.serviceId ||
        currentLoadedPage.url ||
        currentLoadedPage.publicationUrl
    ));
    if (republishBtn) republishBtn.style.display = hasPublicationLocation ? '' : 'none';
    if (statusEl) { statusEl.textContent = ''; statusEl.removeAttribute('data-state'); }
}



// Function to initialize an editor by type.
// account — the raw kvstore entry backing this editor, if account-backed. When omitted
// (e.g. internal re-init calls like showPadShare()'s initializeEditor('etherpad')), the
// current account is preserved if we're re-initializing the same editor type, otherwise
// there is no account to preserve.
async function initializeEditor(editorType, account) {

    const handler = editorHandlers[editorType];
    if (handler && typeof handler.visible === 'function' && !handler.visible()) {
        showErrorModal('That editor is not available. Please register or log in.', { title: 'Editor unavailable' });
        return;
    }

    if (account === undefined) {
        account = (editorType === currentEditor) ? currentEditorAccount : null;
    }
    currentEditorAccount = account || null;

    // Restore tags row (collection editor hides it; all others need it)
    const writeTagsEl = document.getElementById('write-tags');
    if (writeTagsEl) writeTagsEl.style.display = '';

    // Populate format picker from this handler's formats list
    const formatSelectEl = document.getElementById('write-format');
    if (formatSelectEl) {
        const formats = handler.formats || [];
        formatSelectEl.innerHTML = '';
        if (formats.length) {
            formats.forEach(f => {
                const opt = document.createElement('option');
                opt.value = f.id;
                opt.textContent = f.label;
                formatSelectEl.appendChild(opt);
            });
            formatSelectEl.style.display = '';
        } else {
            formatSelectEl.style.display = 'none';
        }
    }

    // Close all editors
    // Note that we do not remove the editors, we just hide them
    const writePaneContent = window.CList.ui.view.writePaneContent;
    if (writePaneContent) {
        Array.from(writePaneContent.children).forEach(child => {
            child.style.display = 'none';
        });
    } else {
        console.error("Write pane content not found. Obviously a major programming error.");
        showErrorModal('Write pane not found — please reload the page.', { title: 'Write Pane Not Found' });
        return;
    }

    // Initialize the editor, passing the parsed account data (if any) — mirrors the
    // reader dispatch convention of handler.initialize(accountData) in reader.js.
    if (editorHandlers[editorType] && typeof editorHandlers[editorType].initialize === 'function') {
        try {
            const parsedAccount = currentEditorAccount ? parseAccountValue(currentEditorAccount) : null;
            // Await editor initialization if it's asynchronous
            await editorHandlers[editorType].initialize(parsedAccount);
            updateEditorIndicator();
        } catch (error) {
            console.error(`Error initializing editor of type '${editorType}':`, error);
            showErrorModal(`Failed to initialize editor: ${error.message}`, { title: 'Editor Initialization Failed' });
            return;
        }
    } else {
        console.error(`Editor type '${editorType}' is not supported or does not have an initialize method.`);
        return;
    }
}

async function loadPredefinedContent(editorType) {

    if (!pendingContent || !pendingContent.value) {
        console.log('No pending content to load');
        return;
    }

    const content = pendingContent;
    pendingContent = null; // consume it — one editor gets it

    if (typeof editorHandlers[editorType].loadContent === 'function') {
        editorHandlers[editorType].loadContent(content);
    } else {
        console.error(`Editor type '${editorType}' does not have a loadContent method.`);
    }
}


// Draft auto-save helpers — keyed by editor name in localStorage

function saveDraft(editorKey, value) {
    if (value && value.trim()) sessionStorage.setItem('clist_draft_' + editorKey, value);
}

function clearDraft(editorKey) {
    sessionStorage.removeItem('clist_draft_' + editorKey);
}

function offerDraftRestore(editorKey, contentType) {
    const draft = sessionStorage.getItem('clist_draft_' + editorKey);
    if (!draft) return;
    if (confirm('A draft was saved from your last session. Restore it?')) {
        loadContent({ type: contentType, value: draft });
    } else {
        clearDraft(editorKey);
    }
}

// Close all editors
function closeAllEditors() {
    const editors = document.querySelectorAll('.editor');
    editors.forEach(editor => {
        editor.style.display = 'none';
    });
}

// Load content into the active editor.
// content must be { type: string, value: string } — e.g. { type: 'text/html', value: '<p>…</p>' }
function loadContent(content, itemId) {
    const handler = editorHandlers[currentEditor];
    if (handler && typeof handler.loadContent === 'function') {
        handler.loadContent(content, itemId);
    } else {
        console.error(`No handler defined for editor: ${currentEditor}`);
    }
}

// Closes every surface a saved-page pick might have opened: the right pane (legacy
// loaders that render into window.CList.ui.view.loadOptions) and the generic modal
// (My Pages, which renders its list/prompt there instead). Harmless no-op for
// whichever of the two wasn't open.
function closeLoadSurfaces() {
    closeRightPane();
    document.getElementById('generic-modal')?.remove();
}

// Load a page or file into the right editor — the one shared routing path for
// every loader (My Pages' "Load a page", "Load from file", or any other
// registered loader), following the routing rules:
//  1. If the current editor supports the content type, use it.
//  2. Otherwise, if exactly one local (non-account) editor supports it, use that one.
//     If more than one does, let the user choose.
//  3. If the target editor is empty, load the content and make it active.
//  4. If it already has content, ask the user (New / Replace / Insert / Cancel).
// content = { type, value }. page = the My Pages row (for the loaded-page indicator),
// or null for a loader with no such row (e.g. "Load from file").
// renderTarget = DOM element to render a choice/New-Replace-Insert-Cancel prompt into
// if needed (defaults to the right-pane load list); My Pages passes its modal body.
// onCancel = what Cancel does on that prompt (defaults to reopening My Pages if
// registered, else the right-pane load list) — callers outside My Pages (e.g.
// "Load from file") pass their own, so Cancel returns to where the user actually was.
async function loadSavedPage(content, page, renderTarget, onCancel) {
    // Empty contentTypes means "doesn't support generic file/page content at all"
    // (e.g. collection, which only loads structured items via its own My Collections
    // path) — never a wildcard. A handler also needs a working initialize() to ever
    // be switched into.
    const candidates = Object.keys(editorHandlers).filter(key => {
        const h = editorHandlers[key];
        return typeof h.initialize === 'function' && (h.contentTypes || []).includes(content.type);
    });

    if (!candidates.length) {
        if (!confirm('No editor registered for this content type. Load into the current editor anyway? Formatting may be lost.')) return;
        loadContent(content);
        closeLoadSurfaces();
        return;
    }

    let targetKey;
    if (candidates.includes(currentEditor)) {
        targetKey = currentEditor;
    } else {
        const localCandidates = candidates.filter(key => !editorHandlers[key].requiresAccount);
        if (localCandidates.length > 1) {
            _offerEditorChoice(localCandidates, content, page, renderTarget, onCancel);
            return;
        }
        targetKey = localCandidates[0];
    }

    if (!targetKey) {
        showErrorModal('No local editor is available for this content type.', { title: 'Editor Unavailable' });
        return;
    }

    if (targetKey !== currentEditor) {
        // The target editor's DOM/content persists across switches (per-editor state
        // park/restore), so it may still hold old content from earlier in the session —
        // check before switching, same as the same-editor branch below. switchToEditor()
        // already closes the right pane; the modal (if any) still needs closing.
        const targetHandler = editorHandlers[targetKey];
        let targetExisting = '';
        if (typeof targetHandler.getContent === 'function') {
            try {
                targetExisting = await targetHandler.getContent();
            } catch (e) {
                // Target editor instance doesn't exist yet (never visited this session) —
                // treat as empty, same as a fresh editor.
                targetExisting = '';
            }
        }
        const targetIsEmpty = !targetExisting || !removeHtml(targetExisting).trim();

        if (targetIsEmpty) {
            await switchToEditor(targetKey, content);
            setLoadedPage(page);
            document.getElementById('generic-modal')?.remove();
            return;
        }

        // Switch without carrying content, so it doesn't get auto-inserted during
        // init — then offer the same Replace/Insert/Cancel choice as same-editor loads.
        // switchToEditor() calls closeRightPane() internally, so reopen it before
        // rendering the dialogue or it ends up invisible in a width:0 pane.
        await switchToEditor(targetKey, null);
        openRightPane();
        offerReplaceOrInsert(targetKey, targetHandler, content, page, renderTarget, onCancel);
        document.getElementById('generic-modal')?.remove();
        return;
    }

    const handler = editorHandlers[targetKey];
    const existing = (typeof handler.getContent === 'function') ? await handler.getContent() : '';
    const isEmpty = !existing || !removeHtml(existing).trim();

    if (isEmpty) {
        handler.loadContent(content);
        setLoadedPage(page);
        closeLoadSurfaces();
        return;
    }

    offerReplaceOrInsert(targetKey, handler, content, page, renderTarget, onCancel);
}

// Rendered into renderTarget (the right-pane load list by default, or the caller's
// own surface — e.g. My Pages' modal body) when the target editor already has
// content. New/Replace require handler.setContent — editors that don't have it
// (collab/etherpad/collection) only offer Insert/Cancel. onCancel overrides the
// default Cancel behavior (see loadSavedPage() above).
function offerReplaceOrInsert(targetKey, handler, content, page, renderTarget, onCancel) {
    const optionsDiv = renderTarget || window.CList.ui.view.loadOptions;
    if (!optionsDiv) return;
    optionsDiv.innerHTML = '';

    const title = document.createElement('p');
    title.className = 'list-tip-title';
    title.textContent = 'Content detected in the destination editor.';
    optionsDiv.appendChild(title);

    const msg = document.createElement('p');
    msg.className = 'list-tip';
    msg.textContent = 'This editor already has content.';
    optionsDiv.appendChild(msg);

    const row = document.createElement('div');
    row.className = 'published-page-confirm';

    if (typeof handler.setContent === 'function') {
        const newBtn = document.createElement('button');
        newBtn.className = 'btn';
        newBtn.textContent = 'New (insert into blank editor)';
        newBtn.onclick = () => {
            clearDraft(targetKey);
            window.clearWriteTags?.();
            handler.setContent('');
            handler.loadContent(content);
            setLoadedPage(page);
            closeLoadSurfaces();
        };
        row.appendChild(newBtn);

        const replaceBtn = document.createElement('button');
        replaceBtn.className = 'btn';
        replaceBtn.textContent = 'Replace';
        replaceBtn.onclick = () => {
            handler.setContent(content.value);
            setLoadedPage(page);
            closeLoadSurfaces();
        };
        row.appendChild(replaceBtn);
    }

    const insertBtn = document.createElement('button');
    insertBtn.className = 'btn';
    insertBtn.textContent = 'Insert';
    insertBtn.onclick = () => {
        handler.loadContent(content);
        closeLoadSurfaces();
    };
    row.appendChild(insertBtn);

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn btn-secondary';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.onclick = onCancel || (() => {
        const myPagesLoader = window.CList.loaders.find(l => l.label === 'My Pages');
        if (myPagesLoader) myPagesLoader.load(); else populateLoadOptions();
    });
    row.appendChild(cancelBtn);

    optionsDiv.appendChild(row);
}

// Load a feed item into the active editor by its DOM id.
// Called by the arrow_right clist-action button on every feed item.
function loadContentToEditor(itemId) {
    let item_content;
    if (itemId === 'thread' || itemId === 'feed-container') {
        const feedContainer = window.CList.ui.view.feedContainer;
        const tempContainer = feedContainer.cloneNode(true);
        tempContainer.querySelectorAll('.feed-header, .collection-detail-header').forEach(el => el.remove());
        tempContainer.querySelectorAll('.status-actions').forEach(el => el.remove());
        tempContainer.querySelectorAll('.clist-actions').forEach(el => el.remove());
        tempContainer.querySelectorAll('.material-icons').forEach(el => el.remove());
        item_content = tempContainer.innerHTML;
    } else {
        item_content = document.getElementById(itemId).innerHTML;
    }
    loadContent({ type: 'text/html', value: item_content }, itemId);
}

// Set the indicator label once all scripts have loaded
document.addEventListener('DOMContentLoaded', () => { updateEditorIndicator(); });
