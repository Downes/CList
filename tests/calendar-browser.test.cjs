const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const plain = value => JSON.parse(JSON.stringify(value));
const deferred = () => { let resolve; const promise = new Promise(done => resolve = done); return { promise, resolve }; };
const flush = () => new Promise(resolve => setImmediate(resolve));
const today = hour => { const d = new Date(); d.setHours(hour, 0, 0, 0); return d.toISOString(); };

// A calendar is now a collection: events are stand-alone calendar:{id} records (unchanged),
// referenced by role:'event' membership entries in a collection's items. calendar-browser.js
// is loaded in isolation here, same as before -- js/calendar.js and js/collection-workflow.js
// are stubbed out rather than loaded, so each of their exports used by calendar-browser.js
// needs its own stand-in below.
function fixture() {
    const calls = [], messages = [], views = [], fetchSubCalls = [], modalMessages = [], openEventEditorCalls = [];
    let token = 'token';
    let idSeq = 0;

    // Default storage: one calendar-type collection ("My Calendar", one event "a") already
    // referenced by the sidebar meta-collection -- as if migration had already run once,
    // so most tests don't need to think about it.
    const myCalendar = { key: 'col-my', id: 'id-my', title: 'My Calendar', name: 'My Calendar', type: 'calendar',
        items: [{ role: 'event', eventId: 'a', title: 'Old', start: today(8), allDay: false, membershipId: 'm-a' }] };
    const sidebarCollection = { key: 'col-sidebar', id: 'id-sidebar', title: 'Calendar', name: 'Calendar',
        items: [{ role: 'contains', collectionId: 'id-my', title: 'My Calendar' }] };
    const collectionStore = [myCalendar, sidebarCollection];
    const findCollection = key => collectionStore.find(record => record.key === key);

    let eventsFor = async collection => (collection.items || []).filter(item => item.role === 'event')
        .map(item => ({ id: item.eventId, title: item.title, start: item.start, allDay: !!item.allDay }))
        .sort((a, b) => a.start.localeCompare(b.start));
    let saving = async event => ({ ...event, id: event.id || 'new-id', created: event.created || 1, updated: 2 });
    let removingEvent = null;
    let migrating = async () => null;
    let fetchingSub = async () => [];
    let publishStatus = async () => ({ published: false, url: 'https://store.invalid/users/alice/calendar.ics' });
    let publishing = async () => ({});
    let unpublishing = async () => {};

    const CList = { state: { username: 'alice', reader: { mode: 'idle', requestId: 1 } },
        config: { flaskSiteUrl: 'https://store.invalid' }, accounts: [],
        ui: { calendarBrowser: {
            mount() { views.forEach(view => view.root.isConnected = false); const view = { root: { isConnected: true } }; views.push(view); return view; },
            message(view, text, error) { view.message = { text, error }; },
            list(view, model, actions) { view.model = model; view.actions = actions; },
            sources(view, sourceAccounts, visibleKeys, actions) { view.sources = { sourceAccounts, visibleKeys, actions }; },
            publishDialog: async () => null,
            optionsDialog() { views.at(-1).optionsOpened = true; },
            status(text) { messages.push(text); }, error(error) { messages.push(error.message); },
        } },
    };

    const ctx = vm.createContext({ console: { error() {} },
        window: { CList, openEventEditor: (owner, event) => openEventEditorCalls.push([owner, event]) },
        beginCollectionSession(options = {}) {
            return { username: CList.state.username, storeUrl: CList.config.flaskSiteUrl, token: options.token || token, encKey: options.encKey };
        },
        async prepareCollectionSession(session) { ctx.assertCollectionSession(session); session.encKey ||= 'key'; },
        assertCollectionSession(session) {
            if (session.username !== CList.state.username || session.storeUrl !== CList.config.flaskSiteUrl || session.token !== token) throw Error('Session changed');
        },
        parseAccountValue(account) { try { return JSON.parse(account.value); } catch { return null; } },
        fetchSubscriptionEvents(key, parsedValue, opts) { fetchSubCalls.push([key, parsedValue, opts]); return fetchingSub(key, parsedValue, opts); },
        ownCalendarPublishStatus: (...args) => publishStatus(...args),
        publishOwnCalendar: (...args) => { calls.push(['publish', ...args]); return publishing(...args); },
        unpublishOwnCalendar: (...args) => { calls.push(['unpublish', ...args]); return unpublishing(...args); },
        showErrorModal(message) { modalMessages.push(message); },

        // js/calendar.js stand-ins.
        listEventsForCollection: (collection, session) => { calls.push(['listEvents', collection.key]); return eventsFor(collection, session); },
        saveCalendarEvent: (...args) => { calls.push(['save', ...args]); return saving(...args); },
        applyEventToCollection(collection, event) {
            calls.push(['applyEvent', collection.key, event.id]);
            const current = findCollection(collection.key) || collection;
            const snapshot = { role: 'event', eventId: event.id, title: event.title, start: event.start, allDay: !!event.allDay };
            const index = current.items.findIndex(item => item.role === 'event' && item.eventId === event.id);
            if (index >= 0) current.items[index] = { ...current.items[index], ...snapshot };
            else current.items.push({ ...snapshot, membershipId: 'm-' + event.id });
            const total = current.items.length, events = current.items.filter(item => item.role === 'event').length;
            current.type = total > 0 && events > total / 2 ? 'calendar' : undefined;
            return Promise.resolve({ ...current, items: current.items.slice() });
        },
        removeEventFromCollection(collection, event) {
            calls.push(['removeEvent', collection.key, event.id]);
            if (removingEvent) return removingEvent(collection, event);
            const current = findCollection(collection.key) || collection;
            current.items = current.items.filter(item => !(item.role === 'event' && item.eventId === event.id));
            return Promise.resolve({ ...current, items: current.items.slice() });
        },
        migrateLegacyCalendarEvents: (...args) => migrating(...args),
        getCalendarSidebarCollection: () => Promise.resolve(sidebarCollection),
        addCalendarToSidebar(calendarCollection) {
            sidebarCollection.items.push({ role: 'contains', collectionId: calendarCollection.id, title: calendarCollection.title });
            return Promise.resolve(sidebarCollection);
        },

        // js/collection-workflow.js stand-ins.
        collectionDependencies(session) {
            return { session, createIdentity: () => { idSeq += 1; return { key: `col-new-${idSeq}`, id: `id-new-${idSeq}` }; } };
        },
        listCollectionRecords: () => Promise.resolve({ collections: collectionStore.slice(), warnings: [] }),
        saveCollectionRecord(key, data) {
            const saved = { ...data, key };
            const existing = findCollection(key);
            if (existing) Object.assign(existing, saved); else collectionStore.push(saved);
            calls.push(['saveCollection', key]);
            return Promise.resolve(saved);
        },
    });
    vm.runInContext(fs.readFileSync('js/calendar-browser.js', 'utf8'), ctx);
    return { ctx, CList, views, calls, messages, modalMessages, collectionStore, myCalendar, sidebarCollection,
        show: () => ctx.window.showCalendar(),
        showFor: (collection, t, encKey) => ctx.showCalendarForCollection(collection, t, encKey),
        view: () => views.at(-1),
        token: value => token = value,
        list: fn => eventsFor = fn,
        saving: fn => saving = fn,
        removingEvent: fn => removingEvent = fn,
        migrating: fn => migrating = fn,
        openEventEditorCalls: () => openEventEditorCalls,
        accounts: list => CList.accounts = list, fetchSubscriptionEvents: fn => fetchingSub = fn, fetchCalls: () => fetchSubCalls,
        publishDialog: fn => CList.ui.calendarBrowser.publishDialog = fn,
        publishStatus: fn => publishStatus = fn, publishing: fn => publishing = fn, unpublishing: fn => unpublishing = fn };
}

test('calendar browser loads and sorts events by start', async () => {
    const f = fixture();
    f.list(async () => [{ id: 'b', title: 'Later', start: today(14) }, { id: 'a', title: 'Earlier', start: today(9) }]);
    await f.show();
    assert.deepEqual(plain(f.view().model.events.map(event => event.id)), ['a', 'b']);
});

test('late event listing cannot replace a newer panel or a different reader/session', async () => {
    const f = fixture();
    const gate = deferred();
    f.list(() => gate.promise);
    const pending = f.show();
    await flush(); await flush();
    f.CList.state.reader = { mode: 'idle', requestId: 99 };
    gate.resolve([{ id: 'a', title: 'Late', start: today(8) }]);
    await pending;
    assert.equal(f.view().model, undefined);
});

test("a newer showCalendar() call wins over a slower stale one", async () => {
    const f = fixture();
    const gate = deferred();
    f.list(() => gate.promise);
    const old = f.show();
    await Promise.resolve();
    f.list(async () => []);
    await f.show();
    gate.resolve([{ id: 'a', title: 'Late', start: today(8) }]);
    await old;
    assert.deepEqual(plain(f.view().model.events), []);
});

test('a listing failure is shown as an error message', async () => {
    const f = fixture();
    f.list(async () => { throw Error('Storage offline'); });
    await f.show();
    assert.equal(f.view().model, undefined);
    assert.match(f.view().message.text, /Storage offline/);
    assert.equal(f.view().message.error, true);
});

test('delete goes through an inline confirm step owned by the controller', async () => {
    const f = fixture();
    await f.show();
    const row = f.view().model.events[0];
    f.view().actions.confirm(row.id);
    assert.equal(f.view().model.confirmId, row.id);
    await f.view().actions.remove(row);
    assert.equal(f.calls.some(call => call[0] === 'removeEvent' && call[1] === 'col-my' && call[2] === 'a'), true);
    assert.equal(f.view().model.events.length, 0);
});

test('busy guards against a duplicate concurrent delete', async () => {
    const f = fixture();
    await f.show();
    const row = f.view().model.events[0], gate = deferred();
    f.removingEvent(() => gate.promise);
    const first = f.view().actions.remove(row);
    await f.view().actions.remove(row);
    assert.equal(f.calls.filter(call => call[0] === 'removeEvent').length, 1);
    gate.resolve({ ...f.myCalendar, items: [] });
    await first;
    assert.equal(f.CList.state.calendarBrowsing.busy, false);
});

test('a failed delete keeps its row and a visible error, and can be retried', async () => {
    const f = fixture();
    await f.show();
    const row = f.view().model.events[0];
    f.removingEvent(async () => { throw Error('Uncertain delete'); });
    await f.view().actions.remove(row);
    assert.equal(f.view().model.events.length, 1);
    assert.match(f.view().model.error, /Uncertain delete/);
    f.removingEvent(async (collection, event) => {
        const current = f.collectionStore.find(record => record.key === collection.key);
        current.items = current.items.filter(item => !(item.role === 'event' && item.eventId === event.id));
        return { ...current, items: current.items.slice() };
    });
    await f.view().actions.remove(row);
    assert.equal(f.view().model.events.length, 0);
});

test('Add opens the Event editor (window.openEventEditor) with the owner and no event', async () => {
    const f = fixture();
    await f.show();
    f.view().actions.add();
    const [owner, event] = f.openEventEditorCalls().at(-1);
    assert.equal(event, null);
    assert.ok(owner);
});

test('Edit opens the Event editor with the owner and the selected event, making no save call on its own', async () => {
    const f = fixture();
    await f.show();
    const row = f.view().model.events[0];
    f.view().actions.edit(row);
    const [, event] = f.openEventEditorCalls().at(-1);
    assert.equal(event, row);
    assert.equal(f.calls.some(call => call[0] === 'save'), false);
});

test("a direct save (as the Event editor's own Save button performs) inserts the new event in sorted order", async () => {
    const f = fixture();
    await f.show();
    f.view().actions.add();
    const [owner] = f.openEventEditorCalls().at(-1);
    f.saving(async event => ({ ...event, id: 'new-id', created: 1, updated: 1 }));
    await f.ctx.runCalendarBrowserAction(owner, null, 'save', { title: 'New', start: today(3) });
    assert.deepEqual(plain(f.view().model.events.map(event => event.id)), ['new-id', 'a']);
    assert.equal(f.calls.some(call => call[0] === 'applyEvent' && call[1] === 'col-my' && call[2] === 'new-id'), true);
});

test('a save whose selected event no longer exists in the list is rejected', async () => {
    const f = fixture();
    await f.show();
    const stale = { id: 'ghost', title: 'Ghost', start: today(5), _collection: f.myCalendar };
    await f.ctx.runCalendarBrowserAction(f.openEventEditorCalls().length
        ? f.openEventEditorCalls().at(-1)[0] : (f.view().actions.add(), f.openEventEditorCalls().at(-1)[0]), stale, 'save', { title: 'Renamed' });
    assert.equal(f.calls.some(call => call[0] === 'save'), false);
});

test('a pending save is dropped if the reader surface changes before it resolves', async () => {
    const f = fixture();
    await f.show();
    const row = f.view().model.events[0], gate = deferred();
    f.saving(() => gate.promise);
    f.view().actions.edit(row);
    const [owner] = f.openEventEditorCalls().at(-1);
    const pending = f.ctx.runCalendarBrowserAction(owner, row, 'save', { title: 'Renamed' });
    f.CList.state.reader = { mode: 'idle', requestId: 404 };
    gate.resolve({ ...row, title: 'Renamed', updated: 2 });
    await pending;
    assert.equal(f.CList.state.calendarBrowsing.busy, false);
    assert.equal(f.messages.some(message => /Renamed|updated/.test(message)), false);
});

test('showCalendarForCollection loads only that collection, independent of the sidebar', async () => {
    const f = fixture();
    const other = { key: 'col-other', id: 'id-other', title: 'Other', type: 'calendar',
        items: [{ role: 'event', eventId: 'x', title: 'Other event', start: today(6), allDay: false, membershipId: 'm-x' }] };
    f.collectionStore.push(other);
    await f.showFor(other, 'token', undefined);
    assert.deepEqual(plain(f.view().model.events.map(event => event.id)), ['x']);
    assert.equal(f.calls.some(call => call[0] === 'listEvents' && call[1] === 'col-other'), true);
    assert.equal(f.calls.some(call => call[0] === 'listEvents' && call[1] === 'col-my'), false);
});

test('saving a new event in single-collection mode files it into that collection', async () => {
    const f = fixture();
    await f.showFor(f.myCalendar, 'token', undefined);
    f.view().actions.add();
    const [owner] = f.openEventEditorCalls().at(-1);
    f.saving(async event => ({ ...event, id: 'new-id', created: 1, updated: 1 }));
    await f.ctx.runCalendarBrowserAction(owner, null, 'save', { title: 'New', start: today(3) });
    assert.equal(f.calls.some(call => call[0] === 'applyEvent' && call[1] === 'col-my' && call[2] === 'new-id'), true);
    assert.deepEqual(plain(f.view().model.events.map(event => event.id)), ['new-id', 'a']);
});

test('saving a new event in sidebar mode with no merged calendars lazily creates "My Calendar"', async () => {
    const f = fixture();
    f.sidebarCollection.items = [];
    await f.show();
    assert.equal(f.view().model.events.length, 0);
    f.view().actions.add();
    const [owner] = f.openEventEditorCalls().at(-1);
    f.saving(async event => ({ ...event, id: 'first-id', created: 1, updated: 1 }));
    await f.ctx.runCalendarBrowserAction(owner, null, 'save', { title: 'First', start: today(3) });
    const created = f.collectionStore.find(record => record.key !== 'col-my' && record.title === 'My Calendar');
    assert.ok(created, 'a new "My Calendar" collection was created');
    assert.equal(f.sidebarCollection.items.some(item => item.role === 'contains' && item.collectionId === created.id), true);
    assert.match(f.messages.at(-1), /added to "My Calendar"/);
});

test('sidebar mode fans out across every merged calendar and tags each event with its source', async () => {
    const f = fixture();
    const second = { key: 'col-second', id: 'id-second', title: 'Team', type: 'calendar',
        items: [{ role: 'event', eventId: 'z', title: 'Team event', start: today(14), allDay: false, membershipId: 'm-z' }] };
    f.collectionStore.push(second);
    f.sidebarCollection.items.push({ role: 'contains', collectionId: 'id-second', title: 'Team' });
    await f.show();
    const events = f.view().model.events;
    assert.deepEqual(plain(events.map(event => event.id)), ['a', 'z']);
    assert.equal(events.find(event => event.id === 'a')._collection.key, 'col-my');
    assert.equal(events.find(event => event.id === 'z')._collection.key, 'col-second');
    const row = events.find(event => event.id === 'z');
    await f.view().actions.remove(row);
    assert.equal(f.calls.some(call => call[0] === 'removeEvent' && call[1] === 'col-second' && call[2] === 'z'), true);
    assert.equal(f.myCalendar.items.some(item => item.eventId === 'a'), true);
});

test('showing the sidebar while logged out renders an empty grid with no error', async () => {
    const f = fixture();
    f.token('');
    await f.show();
    assert.equal(f.view().model.events.length, 0);
    assert.equal(f.messages.length, 0);
});

test('merge includes own events and visible subscription events, tagged with sourceKey/readOnly', async () => {
    const f = fixture();
    f.accounts([{ key: 'sub-1', value: JSON.stringify({ type: 'Calendar', title: 'Team Feed' }) }]);
    f.fetchSubscriptionEvents(async () => [{ id: 'sub-1-event', title: 'Shared', start: today(10) }]);
    await f.show();
    await flush(); await flush();
    const events = f.view().model.events;
    const own = events.find(event => event.id === 'a');
    const sub = events.find(event => event.id === 'sub-1-event');
    assert.equal(own.sourceKey, '__own__');
    assert.equal(own.readOnly, false);
    assert.equal(sub.sourceKey, undefined); // tagged inside subscriptionEvents, not on the raw fetched object
});

test("toggling a subscription off hides its events without fetching; toggling back on fetches and re-merges", async () => {
    const f = fixture();
    f.accounts([{ key: 'sub-1', value: JSON.stringify({ type: 'Calendar', title: 'Team Feed' }) }]);
    f.fetchSubscriptionEvents(async () => [{ id: 'sub-1-event', title: 'Shared', start: today(10) }]);
    await f.show();
    await flush(); await flush();
    f.view().actions.select(); // open sources overlay (not required but mirrors normal flow)
    f.view().sources.actions.toggle('sub-1');
    assert.equal(f.view().model.events.some(event => event.id === 'sub-1-event'), false);
    assert.equal(f.fetchCalls().length, 1);
    f.view().sources.actions.toggle('sub-1');
    await flush(); await flush();
    assert.equal(f.view().model.events.some(event => event.id === 'sub-1-event'), true);
    assert.equal(f.fetchCalls().length, 2);
});

test("one subscription's rejected fetch sets sourceErrors[key] while other sources' events still render", async () => {
    const f = fixture();
    f.accounts([
        { key: 'sub-1', value: JSON.stringify({ type: 'Calendar', title: 'Good' }) },
        { key: 'sub-2', value: JSON.stringify({ type: 'Calendar', title: 'Bad' }) },
    ]);
    f.fetchSubscriptionEvents(async key => {
        if (key === 'sub-2') throw Error('Feed unreachable');
        return [{ id: 'good-event', title: 'Good', start: today(11) }];
    });
    await f.show();
    await flush(); await flush();
    assert.equal(f.view().model.events.some(event => event.id === 'good-event'), true);
    assert.match(f.view().sources.actions.sourceErrors.sub2 || f.CList.state.calendarBrowsing.sourceErrors['sub-2'], /Feed unreachable/);
});

test("add/edit/delete on one's own events never touches subscription state or refetches", async () => {
    const f = fixture();
    f.accounts([{ key: 'sub-1', value: JSON.stringify({ type: 'Calendar', title: 'Team Feed' }) }]);
    f.fetchSubscriptionEvents(async () => [{ id: 'sub-1-event', title: 'Shared', start: today(10) }]);
    await f.show();
    await flush(); await flush();
    const callsBefore = f.fetchCalls().length;
    f.view().actions.add();
    const [owner] = f.openEventEditorCalls().at(-1);
    f.saving(async event => ({ ...event, id: 'new-id', created: 1, updated: 1 }));
    await f.ctx.runCalendarBrowserAction(owner, null, 'save', { title: 'New', start: today(3) });
    assert.equal(f.fetchCalls().length, callsBefore);
    assert.equal(f.view().model.events.some(event => event.id === 'sub-1-event'), true);
});

test('publishing own calendar opens the dialog and reports success', async () => {
    const f = fixture();
    await f.show();
    f.publishDialog(async () => 'publish');
    await f.view().sources.actions.publish();
    assert.equal(f.calls.some(call => call[0] === 'publish'), true);
    assert.equal(f.messages.some(message => /published/i.test(message)), true);
});

test('unpublishing own calendar reports success', async () => {
    const f = fixture();
    await f.show();
    f.publishDialog(async () => 'unpublish');
    await f.view().sources.actions.publish();
    assert.equal(f.calls.some(call => call[0] === 'unpublish'), true);
    assert.equal(f.messages.some(message => /unpublished/i.test(message)), true);
});

test('cancelling the publish dialog makes no publish/unpublish call', async () => {
    const f = fixture();
    await f.show();
    f.publishDialog(async () => null);
    await f.view().sources.actions.publish();
    assert.equal(f.calls.some(call => call[0] === 'publish' || call[0] === 'unpublish'), false);
});

test('a publish failure surfaces as a modal error without crashing', async () => {
    const f = fixture();
    await f.show();
    f.publishDialog(async () => 'publish');
    f.publishing(async () => { throw Error('Publish broke'); });
    await f.view().sources.actions.publish();
    assert.equal(f.modalMessages.some(message => /Publish broke/.test(message)), true);
});

test('Select toggles the calendar sources overlay open/closed, reflected in both list() and sources()', async () => {
    const f = fixture();
    await f.show();
    assert.equal(f.view().model.sourcesOpen, false);
    f.view().actions.select();
    assert.equal(f.view().model.sourcesOpen, true);
    f.view().actions.select();
    assert.equal(f.view().model.sourcesOpen, false);
});

test("the sources overlay's own Close action closes it the same way Select does", async () => {
    const f = fixture();
    await f.show();
    f.view().actions.select();
    assert.equal(f.view().model.sourcesOpen, true);
    f.view().sources.actions.close();
    assert.equal(f.view().model.sourcesOpen, false);
});

test('a failed publish-status check surfaces as a modal error and never opens the dialog', async () => {
    const f = fixture();
    await f.show();
    f.publishStatus(async () => { throw Error('Status check failed'); });
    let dialogOpened = false;
    f.publishDialog(async () => { dialogOpened = true; return null; });
    await f.view().sources.actions.publish();
    assert.equal(f.modalMessages.some(message => /Status check failed/.test(message)), true);
    assert.equal(dialogOpened, false);
});

test('the sources overlay carries the Options action, which opens an (empty, for now) dialog', async () => {
    const f = fixture();
    await f.show();
    f.view().sources.actions.options();
    assert.equal(f.view().optionsOpened, true);
});

test('viewRange defaults to Day; setView switches range and re-filters the merged events list', async () => {
    const f = fixture();
    f.list(async () => [{ id: 'a', title: 'Today', start: today(8) }, { id: 'b', title: 'Same month', start: (() => {
        const d = new Date(); d.setDate(d.getDate() === 1 ? 28 : 1); d.setHours(9, 0, 0, 0); return d.toISOString(); })() }]);
    await f.show();
    assert.equal(f.view().model.viewRange, 'Day');
    assert.deepEqual(plain(f.view().model.events.map(event => event.id)), ['a']);
    f.view().actions.setView('Month');
    assert.equal(f.view().model.viewRange, 'Month');
    assert.deepEqual(plain(f.view().model.events.map(event => event.id)).sort(), ['a', 'b']);
});

test('setView ignores an unknown range and a no-op re-selection of the current range', async () => {
    const f = fixture();
    await f.show();
    const renderedBefore = f.view();
    f.view().actions.setView('Year');
    assert.equal(f.view().model.viewRange, 'Day');
    f.view().actions.setView('Day');
    assert.equal(f.view(), renderedBefore);
});

test('_calendarRangeBounds computes Day/Week(Monday-start)/Month as [start, end) around a given moment', () => {
    const f = fixture();
    const now = new Date(2026, 10, 25); // Wednesday
    const [dayStart, dayEnd] = f.ctx._calendarRangeBounds('Day', now);
    assert.equal(dayStart.getDate(), 25); assert.equal(dayEnd.getDate(), 26);
    const [weekStart, weekEnd] = f.ctx._calendarRangeBounds('Week', now);
    assert.equal(weekStart.getDay(), 1); // Monday
    assert.equal((weekEnd - weekStart) / 86400000, 7);
    const [monthStart, monthEnd] = f.ctx._calendarRangeBounds('Month', now);
    assert.equal(monthStart.getDate(), 1);
    assert.equal(monthEnd.getMonth(), 11);
});

test('_calendarEventsInRange keeps point events whose start falls within the window', () => {
    const f = fixture();
    const now = new Date(2026, 10, 25);
    const events = [
        { id: 'in', start: new Date(2026, 10, 25, 9).toISOString() },
        { id: 'before', start: new Date(2026, 10, 24, 9).toISOString() },
        { id: 'after', start: new Date(2026, 10, 26, 9).toISOString() },
        { id: 'invalid', start: 'not-a-date' },
    ];
    const kept = f.ctx._calendarEventsInRange(events, 'Day', now);
    assert.deepEqual(kept.map(event => event.id), ['in']);
});


test('range filtering includes overnight/multi-day overlap and respects exclusive ends', () => {
    const f = fixture(), now = new Date(2026,10,25,12);
    const events = [
        {id:'overnight',start:'2026-11-24T23:00:00',end:'2026-11-25T02:00:00'},
        {id:'multi',start:'2026-11-23',end:'2026-11-27',allDay:true},
        {id:'ended',start:'2026-11-23',end:'2026-11-25',allDay:true},
        {id:'one-day',start:'2026-11-25',allDay:true},
        {id:'tomorrow',start:'2026-11-26',allDay:true},
        {id:'boundary',start:'2026-11-24T23:00:00',end:'2026-11-25T00:00:00'},
    ];
    assert.deepEqual(f.ctx._calendarEventsInRange(events,'Day',now).map(e=>e.id),['overnight','multi','one-day']);
});
