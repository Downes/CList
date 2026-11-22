// Calendar list/dialog chrome only. Data operations and actions are supplied.
// Reuses existing shared primitives only: window.CList.ui.reader.menu() for
// the Add/Day/Week/Month/Select buttons (same #feed-menu rendering every
// registered reader uses, with its Translate button suppressed here), the
// feed-header class (same title-bar styling Mastodon-type feeds use) for the
// Today/This Week/This Month heading, the left-pane-overlay-section
// convention for the calendar selection pane (same as LocalRSS's Feed
// Options, now also carrying a Share/Options text-button row above the
// source list), status-box/status-content/statusSpecific/status-actions/
// entry-summary (the same read-pane feed-entry styling ordinary feed items
// use, see js/ui.js's makeListing), plus collection-delete-confirm,
// clist-action-btn, btn/btn-small/btn-secondary,
// feed-status-message/error-message) — no new CSS.
window.CList.ui ||= {};
window.CList.ui.calendarBrowser = {
    mount() {
        const container = window.CList.ui.view.feedContainer;
        if (!container) throw new Error('Calendar controls are unavailable.');
        const section = document.getElementById('feed-section');
        if (section) section.style.display = '';
        const menu = window.CList.ui.view.feedMenu;
        if (menu) { menu.style.display = ''; menu.replaceChildren(); }
        container.replaceChildren();
        const root = document.createElement('div'); root.className = 'calendar-browser'; container.appendChild(root);
        return { root };
    },
    message(view, text, error = false) {
        view.root.replaceChildren();
        const message = document.createElement('p'); message.className = error ? 'error-message' : 'feed-status-message';
        message.textContent = text; view.root.appendChild(message);
    },
    list(view, model, actions) {
        view.root.replaceChildren();
        // Same #feed-menu rendering every registered reader's menu uses (see
        // js/reader-view.js's window.CList.ui.reader.menu) -- Calendar has no
        // readers[] entry (it's invoked directly, not through the registry),
        // so this is called straight from here instead of through begin()/
        // runReaderRequest. Calendar suppresses the Translate button (there's
        // nothing to translate here) and may mark two buttons active at once
        // (Select plus the current Day/Week/Month range).
        const selected = model.sourcesOpen ? ['Select', model.viewRange] : [model.viewRange];
        window.CList.ui.reader.menu(['Add', 'Day', 'Week', 'Month', 'Select'], selected, name => {
            if (name === 'Add') actions.add();
            else if (name === 'Select') actions.select();
            else actions.setView(name);
        }, !!model.busy, { translate: false });
        // Reuses the existing .feed-header CSS class (css/reader.css) that
        // Mastodon-type feeds already use for their title bar -- same look,
        // own markup, since window.CList.ui.feedHeader() is tightly coupled
        // to Mastodon feed semantics (hardcoded titles map, thread actions).
        const header = document.createElement('div'); header.className = 'feed-header';
        const heading = document.createElement('h2');
        heading.textContent = { Day: 'Today', Week: 'This Week', Month: 'This Month' }[model.viewRange] || 'Today';
        header.appendChild(heading); view.root.appendChild(header);
        if (model.error) {
            const error = document.createElement('p'); error.className = 'error-message';
            error.textContent = model.error; view.root.appendChild(error);
        }
        if (!model.events.length) {
            const empty = document.createElement('p'); empty.className = 'feed-status-message';
            empty.textContent = 'No events yet. Use the Add button above to add one.'; view.root.appendChild(empty);
        }
        for (const event of model.events) {
            const statusBox = document.createElement('div'); statusBox.className = 'status-box';
            const statusContent = document.createElement('div'); statusContent.className = 'status-content';
            const statusSpecific = document.createElement('div'); statusSpecific.className = 'statusSpecific';
            const titleEl = document.createElement('strong'); titleEl.textContent = event.title;
            statusSpecific.appendChild(titleEl);
            statusSpecific.appendChild(document.createElement('br'));
            const summary = document.createElement('div'); summary.className = 'entry-summary';
            summary.textContent = _calendarEventWhen(event) + (event.location ? ' · ' + event.location : '');
            statusSpecific.appendChild(summary);
            statusContent.appendChild(statusSpecific);

            const statusActions = document.createElement('div'); statusActions.className = 'status-actions';
            const icon = (label, symbol, callback) => {
                const button = document.createElement('button'); button.className = 'clist-action-btn'; button.title = label;
                button.innerHTML = `<span class="material-icons md-18 md-light">${symbol}</span>`;
                button.disabled = !!model.busy; button.onclick = callback; statusActions.appendChild(button);
            };
            // Subscription-sourced rows are display-only -- editing/deleting
            // someone else's feed makes no sense. These act directly on the
            // event itself (not "send it elsewhere"), so they belong in
            // status-actions, same as a feed entry's own edit/delete -- not
            // clist-actions, which is for cross-cutting actions like "Write
            // about this" that carry an item's content into another part of
            // the app.
            if (!event.readOnly) {
                icon('Edit event', 'edit', () => actions.edit(event));
                icon('Delete this event', 'delete_outline', () => actions.confirm(event.id));
            }
            statusContent.appendChild(statusActions);
            statusBox.appendChild(statusContent);
            if (model.confirmId === event.id) {
                const confirm = document.createElement('div'); confirm.className = 'collection-delete-confirm';
                const label = document.createElement('span'); label.textContent = `Delete "${event.title}"? `; confirm.appendChild(label);
                for (const [text, callback] of [['Delete', () => actions.remove(event)], ['Cancel', () => actions.confirm(null)]]) {
                    const button = document.createElement('button'); button.className = 'btn btn-small' + (text === 'Cancel' ? ' btn-secondary' : '');
                    button.textContent = text; button.disabled = !!model.busy; button.onclick = callback; confirm.appendChild(button);
                }
                statusContent.appendChild(confirm);
            }
            view.root.appendChild(statusBox);
        }
    },
    // Left-pane overlay listing calendar sources ('__own__' plus each
    // Calendar account), toggled by the "Select" button in list() above --
    // same left-pane-overlay-section/showLeftOverlaySection convention
    // LocalRSS's "Feed Options" overlay uses (js/localrss_options_view.js),
    // and the same account-list/account-button toggle convention the main
    // account switcher uses. Share/Options live here as a text-button row
    // above the source list, not in the feed-menu above.
    sources(view, sourceAccounts, visibleKeys, actions) {
        const id = 'calendar-sources-section';
        if (!actions.open) {
            const existing = document.getElementById(id);
            if (existing) existing.style.display = 'none';
            return;
        }
        openLeftPane();
        const body = document.getElementById('left-pane-body');
        if (!body) {
            console.error('Calendar: #left-pane-body not found, cannot show calendar selection.');
            showErrorModal('Could not open calendar selection.', { title: 'Calendar selection failed' });
            return;
        }
        document.getElementById(id)?.remove();
        const overlay = document.createElement('div'); overlay.id = id; overlay.className = 'left-pane-overlay-section';
        const header = document.createElement('div'); header.className = 'left-pane-overlay-header';
        const heading = document.createElement('h2'); heading.textContent = 'Calendars'; header.appendChild(heading);
        const refresh = document.createElement('button'); refresh.className = 'clist-action-btn'; refresh.title = 'Refresh calendar sources';
        refresh.innerHTML = '<span class="material-icons md-18 md-light">refresh</span>';
        refresh.onclick = actions.refresh; header.appendChild(refresh);
        const close = document.createElement('button'); close.className = 'clist-action-btn'; close.title = 'Close';
        close.innerHTML = '<span class="material-icons md-18 md-light">close</span>';
        close.onclick = actions.close; header.appendChild(close);
        overlay.appendChild(header);
        // Share/Options live here, above the toggleable source list, rather
        // than in the feed-menu -- text buttons, distinct from the icon-only
        // Refresh/Close row above.
        const toolbar = document.createElement('div'); toolbar.className = 'calendar-sources-toolbar';
        const share = document.createElement('button'); share.className = 'btn btn-small';
        share.textContent = 'Share'; share.onclick = actions.publish; toolbar.appendChild(share);
        const options = document.createElement('button'); options.className = 'btn btn-small';
        options.textContent = 'Options'; options.onclick = actions.options; toolbar.appendChild(options);
        overlay.appendChild(toolbar);
        // Calendars management -- sidebar/merged mode only (actions.calendars is null in
        // single-collection "View as Calendar" mode, where there's nothing to add/remove).
        // Lists which type:'calendar' collections are currently merged into the top-level
        // Calendar view, each with its own remove action, plus an "Add calendar…" row that
        // opens the inverted nesting picker (_showAddCalendarPicker, calendar-browser.js).
        if (actions.calendars) {
            const calendarsHeader = document.createElement('div'); calendarsHeader.className = 'calendar-sources-toolbar';
            const calendarsHeading = document.createElement('strong'); calendarsHeading.textContent = 'Calendars';
            calendarsHeader.appendChild(calendarsHeading);
            overlay.appendChild(calendarsHeader);
            for (const collection of actions.calendars) {
                const row = document.createElement('div'); row.className = 'saved-collection-row';
                const title = document.createElement('span'); title.textContent = collection.title || 'Untitled calendar';
                row.appendChild(title);
                const remove = document.createElement('button'); remove.className = 'clist-action-btn';
                remove.title = 'Remove this calendar from the Calendar view';
                remove.innerHTML = '<span class="material-icons md-18 md-light">remove_circle_outline</span>';
                remove.onclick = () => actions.removeCalendar(collection);
                row.appendChild(remove);
                overlay.appendChild(row);
            }
            const addCalendar = document.createElement('button'); addCalendar.className = 'btn btn-small';
            addCalendar.textContent = 'Add calendar…';
            addCalendar.onclick = () => actions.addCalendar(addCalendar);
            overlay.appendChild(addCalendar);
        }
        const list = makeAccountList('Toggle calendars on/off', sourceAccounts, () => true, key => actions.toggle(key));
        list.querySelectorAll('.account-button[data-key]').forEach(button => {
            const key = button.dataset.key;
            const active = visibleKeys.has(key);
            button.classList.toggle('selected', active);
            button.dataset.selected = String(active);
            button.setAttribute('aria-pressed', String(active));
            if (actions.sourceErrors?.[key]) {
                const error = document.createElement('div'); error.className = 'error-message';
                error.textContent = actions.sourceErrors[key];
                button.insertAdjacentElement('afterend', error);
            }
        });
        overlay.appendChild(list);
        body.appendChild(overlay);
        showLeftOverlaySection(id);
    },
    // Promise-based "Publish my calendar" dialog. Resolves 'publish',
    // 'unpublish', or null (closed/cancelled) -- the controller performs the
    // actual kvstore call; this only collects the user's choice.
    publishDialog(status) {
        return new Promise(resolve => {
            const body = document.createElement('div');
            const p = document.createElement('p');
            p.textContent = status.published
                ? `Your calendar is published at ${status.url}`
                : 'Your calendar is not currently published.';
            body.appendChild(p);
            const buttons = [{ label: 'Close', secondary: true, onClick: close => { close(); resolve(null); } }];
            if (status.published) {
                buttons.unshift({ label: 'Unpublish', secondary: true, onClick: close => { close(); resolve('unpublish'); } });
            } else {
                buttons.unshift({ label: 'Publish', onClick: close => { close(); resolve('publish'); } });
            }
            buildDialogModal('Publish my calendar', body, buttons);
        });
    },
    // Empty placeholder for future calendar options -- same buildDialogModal
    // shell as publishDialog(), with nothing to configure yet.
    optionsDialog() {
        const body = document.createElement('p'); body.className = 'feed-status-message';
        body.textContent = 'No options yet.';
        buildDialogModal('Calendar Options', body, [{ label: 'Close', secondary: true, onClick: close => close() }]);
    },
    status(message) { showStatusMessage(message); },
    error(error) { console.error('[calendar browser]', error); showStatusMessage(error?.message || String(error)); },
};

// _calendarEventWhen() now lives in utilities.js (loads before this file) — shared with
// collection-members-view.js's role:'event' rows rather than duplicated here.

function _calendarInputValue(iso, allDay) {
    if (!iso) return '';
    if (allDay) return iso.slice(0, 10);
    const date = new Date(iso);
    if (isNaN(date.getTime())) return '';
    const pad = n => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
function _calendarFieldToIso(value, allDay) {
    if (!value) return '';
    if (allDay) return value;
    const date = new Date(value);
    return isNaN(date.getTime()) ? '' : date.toISOString();
}

// A native datetime-local input's .value stays '' until every segment — including time —
// is set, even once a date is visibly selected. A brand-new event's Start field used to
// start fully blank, so a user who opened the calendar-icon popup and clicked only a date
// (never touching the time columns) ended up with what looked like a filled-in date but an
// empty startInput.value — failing "Title and start are required." at save with no visible
// cause, and silently skipping the end-before-start check too (both sides read as empty).
// Defaulting Start to a complete value up front means picking a new date through the popup
// only overwrites the date segment, leaving this time in place, so the value stays complete.
function _calendarDefaultStartIso() {
    const date = new Date();
    date.setSeconds(0, 0);
    const remainder = date.getMinutes() % 30;
    if (remainder) date.setMinutes(date.getMinutes() + (30 - remainder));
    return date.toISOString();
}

// Builds the field DOM once. The Description field carries a fixed id ('event-edit-description')
// so event-editor.js can bind its own scoped TinyMCE instance to it (same pattern as
// annotate-editor.js's '#annotate-edit-body') — which is also why this function must only run
// once per editor session, not on every open/edit/Clear: re-creating the node would orphan that
// instance. Re-loading a different event's values onto already-built fields is
// _applyCalendarEventFieldValues()'s job, not this one's.
function _buildCalendarEventFields(event) {
    const makeRow = (labelText, input) => {
        const row = document.createElement('div');
        const label = document.createElement('label'); label.textContent = labelText;
        row.appendChild(label); row.appendChild(document.createElement('br')); row.appendChild(input);
        return row;
    };

    const titleInput = document.createElement('input'); titleInput.type = 'text';
    const titleRow = makeRow('Title', titleInput);

    const allDayInput = document.createElement('input'); allDayInput.type = 'checkbox';
    const allDayRow = document.createElement('div');
    const allDayLabel = document.createElement('label');
    allDayLabel.appendChild(allDayInput); allDayLabel.appendChild(document.createTextNode(' All day'));
    allDayRow.appendChild(allDayLabel);

    const startInput = document.createElement('input');
    const startRow = makeRow('Start', startInput);
    const endInput = document.createElement('input');
    const endRow = makeRow('End (optional)', endInput);
    // Side by side when there's room, stacked on narrow viewports — see
    // .event-editor-datetime-row in interface.css.
    const dateTimeRow = document.createElement('div');
    dateTimeRow.className = 'event-editor-datetime-row';
    dateTimeRow.appendChild(startRow); dateTimeRow.appendChild(endRow);

    // Constrains the native date/time pickers themselves (End can't show a date before Start,
    // Start can't show one after End) and keeps a persistent :invalid state + validity bubble
    // for whatever a picker still lets through, e.g. typing a sub-field by hand — full
    // keystroke-level prevention isn't possible with a plain <input>. The Save-time throw in
    // event-editor.js's _eventEditorBuildDraft() remains the hard backstop either way.
    const validateDateRange = () => {
        endInput.min = startInput.value || '';
        startInput.max = endInput.value || '';
        const startIso = _calendarFieldToIso(startInput.value, allDayInput.checked);
        const endIso = _calendarFieldToIso(endInput.value, allDayInput.checked);
        const invalid = !!(startIso && endIso && endIso < startIso);
        endInput.setCustomValidity(invalid ? 'End must not be before start.' : '');
        if (invalid) endInput.reportValidity();
    };
    startInput.onchange = validateDateRange;
    endInput.onchange = validateDateRange;
    startInput.oninput = validateDateRange;
    endInput.oninput = validateDateRange;

    allDayInput.onchange = () => {
        const startIso = _calendarFieldToIso(startInput.value, !allDayInput.checked);
        const endIso = _calendarFieldToIso(endInput.value, !allDayInput.checked);
        startInput.type = allDayInput.checked ? 'date' : 'datetime-local';
        endInput.type = allDayInput.checked ? 'date' : 'datetime-local';
        startInput.value = _calendarInputValue(startIso, allDayInput.checked);
        endInput.value = _calendarInputValue(endIso, allDayInput.checked);
        validateDateRange();
    };

    const locationInput = document.createElement('input'); locationInput.type = 'text';
    const locationRow = makeRow('Location', locationInput);

    const descriptionInput = document.createElement('textarea'); descriptionInput.id = 'event-edit-description';
    const descriptionRow = makeRow('Description', descriptionInput);

    const fields = {
        rows: [titleRow, allDayRow, dateTimeRow, locationRow, descriptionRow],
        titleInput, allDayInput, startInput, endInput, locationInput, descriptionInput,
    };
    _applyCalendarEventFieldValues(fields, event);
    return fields;
}

// Loads `event`'s (or, for Add, blank) values onto already-built fields, without touching DOM
// structure — used both for re-opening this editor against a different event and for Clear.
// Updates the Description field's live TinyMCE instance directly when one exists (it may not
// yet, during the very first build above) rather than only its backing textarea, matching
// annotate-editor.js's setContent()'s same belt-and-suspenders sync.
function _applyCalendarEventFieldValues(fields, event) {
    fields.titleInput.value = event?.title || '';
    fields.allDayInput.checked = !!event?.allDay;
    fields.startInput.type = fields.allDayInput.checked ? 'date' : 'datetime-local';
    fields.endInput.type = fields.allDayInput.checked ? 'date' : 'datetime-local';
    fields.startInput.value = event ? _calendarInputValue(event.start, fields.allDayInput.checked)
        : _calendarInputValue(_calendarDefaultStartIso(), fields.allDayInput.checked);
    fields.endInput.value = _calendarInputValue(event?.end, fields.allDayInput.checked);
    fields.endInput.min = fields.startInput.value || ''; // re-sync picker constraints, cleared stale flag
    fields.startInput.max = fields.endInput.value || '';
    fields.endInput.setCustomValidity('');
    fields.locationInput.value = event?.location || '';
    fields.descriptionInput.value = event?.description || '';
    const editor = typeof tinymce !== 'undefined' && tinymce.get(fields.descriptionInput.id);
    if (editor) editor.setContent(event?.description || '');
}
