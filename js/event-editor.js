// event-editor.js — Event editor for the write-pane
// Part of CList, the next generation of learning and connecting with your community
//
// Depends on: editors.js (currentEditor, editorHandlers, switchToEditor), calendar.js
//             (saveCalendarEvent, deleteCalendarEvent, applyEventToCollection,
//             removeEventFromCollection, migrateLegacyCalendarEvents, getCalendarSidebarCollection
//             — loads before this file), calendar-browser.js (runCalendarBrowserAction,
//             currentCalendarBrowser, recomputeMerged, renderCalendarBrowser, _createOwnCalendar
//             — loads before this file), calendar-browser-view.js (_buildCalendarEventFields,
//             _applyCalendarEventFieldValues, _calendarFieldToIso — loads before this file),
//             collection-workflow.js / collection-session.js (listCollectionRecords,
//             collectionDependencies, beginCollectionSession — loads before this file),
//             save-panel.js (window.CList.savers — loads before this file), ics.js
//             (buildIcsCalendar), utilities.js (downloadBlob, showStatusMessage), the global
//             `tinymce` library object (same script tag tinymce.js uses) for the Description
//             field's own small, separate TinyMCE instance (selector '#event-edit-description' —
//             independent of tinymce.js's 'write-column' instance, own init-once flag — see
//             js/annotate-editor.js's '#annotate-edit-body' for the pattern this mirrors).
//
// Two save destinations (window.CList.savers below) mirror collections.js's playCollectionSave()
// destination picker: "Save to My Calendar" (kvstore, requiresLogin: true — hidden entirely when
// logged out) and "Download as .ics file" (requiresLogin: false — always available, matching
// Collections' "Save to file"). This is what lets a logged-out visitor still create and keep an
// event, without inventing a new account-free storage layer.
//
// "Save to My Calendar" always upserts the stand-alone calendar:{id} record (saveCalendarEvent),
// then adds/refreshes a role:'event' membership row in whichever collection this editor was
// opened for — `_eventEditorOwner` is either a live calendar-browser owner (grid's Add/Edit,
// owner.view set) or the lighter {session, collection} shape collection-members.js's per-
// collection "Edit" action passes. Both call sites always carry a collection, so there is
// currently no reachable "no collection context" case; _resolveDefaultCalendar() below exists
// only as a defensive fallback (resolve-or-create the sidebar's first calendar) should a future
// entry point ever call openEventEditor() with neither.
//
// Named "Event" rather than "Calendar Event" since this write-pane editor is meant to be reused
// by other event-bearing features later, not just the Calendar module's own Add/Edit flow.
// Currently only opened via window.openEventEditor(owner, event), called by
// calendar-browser.js's runCalendarEventEdit(). Mirrors annotate-editor.js's
// _annotateReturnEditor pattern: captures whichever editor was active before opening, and
// switches back to it once a save succeeds. No bespoke Cancel button of its own — leaving
// without saving uses the generic Editor switcher, same as collection/slides/texteditor.
//
// Saving goes through the generic Save button (registered into window.CList.savers below as
// "Save to My Calendar"), not a bespoke Save button of this editor's own. Deliberately a
// *destination* the generic chooser offers rather than the only path: once writable external
// calendars are supported, that becomes a second saver entry gated the same way (plus its own
// account check) — see js/slides.js for the existing multi-saver-per-editor precedent.
//
// The form's DOM is built exactly once per page load (see initialize()'s `if (!div)` gate,
// matching annotate-editor.js's own idempotent render) rather than on every open/edit/Clear —
// required because the Description field binds a persistent TinyMCE instance to a fixed-id
// textarea; destroying and recreating that node would orphan it. Opening a different event (or
// Clear) instead calls _reloadEventEditorFields(), which loads values onto the existing fields.

// Editor to switch back to once a save succeeds — captured by window.openEventEditor().
let _eventEditorReturnEditor = null;
// The calendar-browser owner this event belongs to, and the original event being edited (null
// for Add). Set by window.openEventEditor(); cleared once this editor is left.
let _eventEditorOwner = null;
let _eventEditorOriginal = null;
// The live field set and header element built by _renderEventEditor()'s one-time DOM build —
// read by _reloadEventEditorFields() and by the "Save to My Calendar" saver below at save time,
// since the generic Save button has no render-time closure.
let _eventEditorFields = null;
let _eventEditorHeader = null;

// Scoped-down TinyMCE instance for the Description field — own init-once flag so it doesn't
// collide with tinymce.js's main 'write-column' instance. See js/annotate-editor.js's
// _initAnnotateTinyMCE() for the pattern this mirrors, including reusing the shared
// .tinymce-mini-toolbar CSS class (interface.css) for the same compact toolbar-icon sizing.
let _eventEditorTinyMCEInitialized = false;
let _eventEditorTinyMCEReady = null;

function _initEventEditorTinyMCE() {
    if (_eventEditorTinyMCEReady) return _eventEditorTinyMCEReady;
    if (typeof tinymce === 'undefined') {
        throw new Error('TinyMCE failed to load — check your network connection.');
    }
    const dm = document.documentElement.classList.contains('dark-mode');
    _eventEditorTinyMCEReady = Promise.resolve(tinymce.init({
        selector: '#event-edit-description',
        height: 200,
        menubar: false,
        plugins: 'link image code',
        toolbar: 'bold italic link image code',
        skin: dm ? 'oxide-dark' : 'oxide',
        content_style: dm
            ? 'body { background:#1e1e1e; color:#e0e0e0; font-size:14px; }'
            : 'body { font-size:14px; }',
        setup: (editor) => {
            editor.on('init', () => {
                editor.getContainer().classList.add('tinymce-mini-toolbar');
                const textarea = document.getElementById('event-edit-description');
                if (textarea?.value) editor.setContent(textarea.value);
            });
            // Mirrors annotate-editor.js's own setup — keeps the backing textarea's raw value
            // in sync with user edits, since the saver below reads that textarea directly as a
            // pre-ready fallback.
            editor.on('change', () => {
                const ta = document.getElementById('event-edit-description');
                if (ta) ta.value = editor.getContent();
            });
        },
    })).then(() => { _eventEditorTinyMCEInitialized = true; }).catch(error => {
        _eventEditorTinyMCEReady = null; _eventEditorTinyMCEInitialized = false;
        throw error; // initialize() owns visible initialization feedback.
    });
    return _eventEditorTinyMCEReady;
}

// Opens the Event editor in the write pane to add (event === null) or edit an existing event.
// `owner` is a calendar-browser owner object (see calendar-browser.js) — passed straight through
// to runCalendarBrowserAction() on Save.
window.openEventEditor = function (owner, event) {
    _eventEditorOwner = owner;
    _eventEditorOriginal = event || null;
    _eventEditorReturnEditor = (typeof currentEditor !== 'undefined' && currentEditor && currentEditor !== 'event') ? currentEditor : null;
    switchToEditor('event', null, null);
};

// Switches back to whichever editor was active before this one opened (texteditor if none was
// captured), then clears this editor's state. Called after a successful Save.
async function _returnFromEventEditor() {
    const returnTo = _eventEditorReturnEditor || 'texteditor';
    _eventEditorOwner = null; _eventEditorOriginal = null; _eventEditorReturnEditor = null;
    if (currentEditor === 'event' && returnTo !== 'event') await switchToEditor(returnTo);
}

// Builds the form DOM (reusing calendar-browser-view.js's field builder) — called exactly once,
// from initialize()'s `if (!div)` gate. No Save/Cancel buttons of its own — Save lives in the
// generic Save button/panel (the saver registered below), and leaving without saving uses the
// Editor switcher, same as any other first-class editor.
function _renderEventEditor(container) {
    container.innerHTML = '';
    const header = document.createElement('div'); header.className = 'list-tip';
    container.appendChild(header);
    _eventEditorHeader = header;

    const fields = _buildCalendarEventFields(_eventEditorOriginal);
    _eventEditorFields = fields;
    const form = document.createElement('div');
    for (const row of fields.rows) form.appendChild(row);
    container.appendChild(form);

    _reloadEventEditorFields();
    _initEventEditorTinyMCE();
}

// Loads _eventEditorOriginal's values (or blank, for Add) onto the already-built fields —
// used both for re-opening against a different event and for Clear, since the fields (and the
// Description field's bound TinyMCE instance) must never be rebuilt after the first render.
function _reloadEventEditorFields() {
    if (_eventEditorHeader) _eventEditorHeader.textContent = _eventEditorOriginal ? 'Edit event' : 'Add event';
    if (!_eventEditorFields) return;
    _applyCalendarEventFieldValues(_eventEditorFields, _eventEditorOriginal);
    _eventEditorFields.titleInput.focus();
}

// Empties the form to start a new event: drops the event being edited (if any — so a
// subsequent Save adds rather than overwrites) and reloads the form blank. Registered as this
// editor's 'Clear' editorFunctions entry (editor-menu button), same position/effect as
// annotate-editor.js's _annotateClear().
function _eventEditorClear() {
    _eventEditorOriginal = null;
    _reloadEventEditorFields();
}

// Resolve-or-create fallback for the (currently unreachable — see the header comment) case
// where openEventEditor() was called with no collection context at all: files the event into
// the sidebar meta-collection's first calendar, lazily creating "My Calendar" if it has none
// yet. Mirrors runCalendarBrowserAction's own sidebar-mode fallback in calendar-browser.js.
async function _resolveDefaultCalendar(session) {
    await prepareCollectionSession(session);
    await migrateLegacyCalendarEvents(session);
    const sidebar = await getCalendarSidebarCollection(session);
    const ids = new Set(sidebar.items.filter(item => item.role === 'contains').map(item => item.collectionId));
    const { collections } = ids.size ? await listCollectionRecords(collectionDependencies(session)) : { collections: [] };
    const existing = collections.find(record => ids.has(record.id) && record.type === 'calendar');
    return existing || await _createOwnCalendar(session);
}

// 'Delete event' editorFunctions entry (editor-menu button, alongside 'Clear'). Unlike the
// calendar grid's own Delete icon (runCalendarBrowserAction's 'delete', membership-removal
// only — the event may belong to other calendars), this always fully deletes the stand-alone
// record, then removes just this editor's own collection's membership row. Any other calendar
// still holding a reference to the same id is left dangling-but-filtered, per the plan.
async function _eventEditorDelete() {
    const owner = _eventEditorOwner, original = _eventEditorOriginal;
    if (!original) { showStatusMessage('Nothing to delete — this event has not been saved yet.'); return; }
    try {
        const session = owner?.session || beginCollectionSession();
        await deleteCalendarEvent(original.id, session);
        const collection = original._collection || owner?.collection;
        if (collection) await removeEventFromCollection(collection, original, session);
        const liveBrowser = owner?.view && typeof currentCalendarBrowser === 'function' && currentCalendarBrowser(owner);
        await _returnFromEventEditor();
        showStatusMessage(`Event "${original.title}" deleted.`);
        if (liveBrowser) {
            owner.events = owner.events.filter(event => event !== original);
            recomputeMerged(owner);
            renderCalendarBrowser(owner);
        }
    } catch (error) {
        console.error('[event editor] delete failed', error);
        showErrorModal(error?.message || String(error), { title: 'Could not delete event' });
    }
}

(function () {
    if (typeof editorHandlers === 'undefined') {
        console.error('editorHandlers is not defined — event-editor.js must load after editors.js');
        return;
    }

    editorHandlers['event'] = {
        label: 'Event',
        icon: 'event',
        contentTypes: [],
        requiresAccount: false,

        editorFunctions: {
            'Clear': () => _eventEditorClear(),
            'Delete event': () => _eventEditorDelete(),
        },

        initialize: () => {
            currentEditor = 'event';

            // This editor has its own Title field (via _buildCalendarEventFields) — hide the
            // shared #write-title-row/#write-tags so there isn't a second, redundant title
            // input. Restored by editor-switch-view.js's prepare() when switching to any other
            // editor.
            const writeTitleRowEl = document.getElementById('write-title-row');
            if (writeTitleRowEl) writeTitleRowEl.style.display = 'none';
            const writeTagsEl = document.getElementById('write-tags');
            if (writeTagsEl) writeTagsEl.style.display = 'none';

            const writePaneContent = window.CList.ui.view.writePaneContent;
            let div = document.getElementById('eventEditorDiv');
            if (!div) {
                div = document.createElement('div'); div.id = 'eventEditorDiv'; writePaneContent.appendChild(div);
                div.style.display = 'block';
                _renderEventEditor(div);
            } else {
                div.style.display = 'block';
                _reloadEventEditorFields();
            }
        },

        // No exportable plain-text body — the content is the structured fields above, saved via
        // the generic Save button (window.CList.savers), not exported as plain text. Still
        // defined (not optional-chained everywhere it's read, e.g. file-save-workflow.js).
        getContent: () => '',
    };

    // Reads and validates the form into a CListCalendarEvent-shaped draft — shared by both
    // savers below, same validation either destination needs.
    function _eventEditorBuildDraft() {
        const fields = _eventEditorFields;
        if (!fields) throw new Error('Nothing to save.');
        const titleValue = fields.titleInput.value.trim();
        const startValue = fields.startInput.value;
        if (!titleValue || !startValue) throw new Error('Title and start are required.');
        return {
            title: titleValue,
            allDay: fields.allDayInput.checked,
            start: _calendarFieldToIso(startValue, fields.allDayInput.checked),
            end: _calendarFieldToIso(fields.endInput.value, fields.allDayInput.checked) || undefined,
            location: fields.locationInput.value.trim() || undefined,
            description: ((typeof tinymce !== 'undefined' && tinymce.get('event-edit-description')?.getContent()) || fields.descriptionInput.value).trim() || undefined,
        };
    }

    window.CList.savers ||= [];

    // Destination 1: the user's own encrypted My Calendar store (kvstore). Mirrors Collections'
    // "Save to CList" — requiresLogin: true keeps it out of the generic Save panel entirely when
    // logged out, same as collections.js's playCollectionSave() only offering this destination
    // if (token).
    window.CList.savers.push({
        label: 'Save to My Calendar',
        icon: 'event',
        requiresLogin: true,
        requiresAccount: false,
        // isHandlerVisible() (ui.js) lets a handler's own visible() short-circuit the
        // requiresLogin/requiresAccount flags entirely, so the login check has to be folded
        // into this function explicitly rather than left to the flags alone.
        visible: () => currentEditor === 'event' && isRegistered(),
        save: async () => {
            const draft = _eventEditorBuildDraft();
            const owner = _eventEditorOwner, original = _eventEditorOriginal;
            // Live calendar-browser owner (grid's Add/Edit) -- switch back first, then fire the
            // save through runCalendarBrowserAction exactly as before, which owns its own
            // status/error feedback against that still-open grid. `owner?.view` guards against
            // the lighter {session, collection} owner shape below, which currentCalendarBrowser()
            // would otherwise throw on (it assumes a mounted browser view).
            if (owner?.view && typeof currentCalendarBrowser === 'function' && currentCalendarBrowser(owner)) {
                await _returnFromEventEditor();
                runCalendarBrowserAction(owner, original, 'save', draft);
                return;
            }
            // {session, collection} owner (collection-members.js's per-collection "Edit" action)
            // -- or, defensively, no owner at all -- save directly rather than through
            // runCalendarBrowserAction, which assumes a mounted browser view neither case has.
            try {
                const session = owner?.session || beginCollectionSession();
                const saved = await saveCalendarEvent({ ...(original || {}), ...draft }, session);
                const target = owner?.collection || await _resolveDefaultCalendar(session);
                const updated = await applyEventToCollection(target, saved, session);
                await _returnFromEventEditor();
                showStatusMessage(original ? `Event "${saved.title}" updated.` : `Event "${saved.title}" added to "${updated.title}".`);
            } catch (error) {
                console.error('[event editor] save failed', error);
                showErrorModal(error?.message || String(error), { title: 'Could not save event' });
            }
        },
    });

    // Destination 2: download as a standalone .ics file — no login needed, mirrors Collections'
    // "Save to file" (always offered regardless of account state). Reuses js/ics.js's
    // buildIcsCalendar() (already used for Calendar publishing) and utilities.js's downloadBlob(),
    // rather than writing a second ICS serializer.
    window.CList.savers.push({
        label: 'Download as .ics file',
        icon: 'download',
        requiresLogin: false,
        requiresAccount: false,
        visible: () => currentEditor === 'event',
        save: async () => {
            const draft = _eventEditorBuildDraft();
            const original = _eventEditorOriginal;
            const ics = buildIcsCalendar([{ ...draft, id: original?.id || crypto.randomUUID() }]);
            const filename = (draft.title.replace(/[^\w-]+/g, '_') || 'event') + '.ics';
            downloadBlob(new Blob([ics], { type: 'text/calendar' }), filename);
            await _returnFromEventEditor();
            showStatusMessage(`Downloaded "${draft.title}" as ${filename}.`);
        },
    });
})();
