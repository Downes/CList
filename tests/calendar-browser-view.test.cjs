const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { Element } = require('./helpers/account-fixture.cjs');
const source = fs.readFileSync('js/calendar-browser-view.js', 'utf8');

function fixture() {
    const CList = { ui: { reader: { menu: () => {} } } };
    const annotateCalls = [], loadContentCalls = [];
    const ctx = vm.createContext({
        window: { CList }, console,
        document: { createElement: tag => new Element(tag) },
        _calendarEventWhen: event => 'When: ' + event.start,
        clistAnnotate: id => annotateCalls.push(id),
        loadContentToEditor: id => loadContentCalls.push(id),
        showStatusMessage: () => {}, showErrorModal: () => {},
    });
    vm.runInContext(source, ctx);
    const root = new Element('div');
    root.replaceChildren = () => { root.children.forEach(child => { child.parentNode = null; }); root.children = []; };
    const view = { root };
    return { ctx, view, CList, annotateCalls, loadContentCalls };
}

test('a calendar row exposes "Write about this", not a separate load-into-editor arrow', () => {
    const f = fixture();
    const model = { viewRange: 'Day', events: [{ id: 'e1', title: 'Launch', start: '2026-12-01T10:00:00Z', description: '<p>Bring <b>snacks</b></p>' }] };
    f.CList.ui.calendarBrowser.list(f.view, model, {});

    const specific = f.view.root.querySelector('#calendar-event-e1');
    assert.ok(specific, 'the statusSpecific div should carry the stable calendar-event-{id} element id');
    const row = f.view.root.querySelector('.status-box');
    assert.ok(row, 'row should be a status-box');

    const clistActions = row.querySelector('.clist-actions');
    assert.ok(clistActions, 'row should have a clist-actions bar');
    const buttons = clistActions.children.filter(child => child.tagName === 'button');
    assert.equal(buttons.length, 1, 'exactly one clist action — no separate load-to-editor arrow');
    assert.equal(buttons[0].title, 'Write about this');
    assert.equal(buttons[0].querySelector('span').textContent.trim(), 'arrow_forward');

    buttons[0].click();
    assert.deepEqual(f.annotateCalls, ['calendar-event-e1']);
    assert.deepEqual(f.loadContentCalls, [], 'loadContentToEditor must never be called for a calendar row');
});

test("a calendar row's reference carries a plain-text description for \"Write about this\" to quote", () => {
    const f = fixture();
    const model = { viewRange: 'Day', events: [{ id: 'e2', title: 'Standup', start: '2026-12-01T09:00:00Z', description: '<p>Bring snacks and coffee</p>' }] };
    f.CList.ui.calendarBrowser.list(f.view, model, {});

    const specific = f.view.root.querySelector('#calendar-event-e2');
    assert.equal(specific.reference.summary, 'Bring snacks and coffee');
    assert.equal(specific.reference.url, 'clist:event:e2');
});

test("a calendar row with no description falls back to its location for the reference summary", () => {
    const f = fixture();
    const model = { viewRange: 'Day', events: [{ id: 'e3', title: 'Offsite', start: '2026-12-01T09:00:00Z', location: 'HQ' }] };
    f.CList.ui.calendarBrowser.list(f.view, model, {});

    const specific = f.view.root.querySelector('#calendar-event-e3');
    assert.equal(specific.reference.summary, 'HQ');
});

test('a calendar row carries its id and reference on .statusSpecific, not .status-box, matching js/ui.js\'s makeListing convention', () => {
    const f = fixture();
    const model = { viewRange: 'Day', events: [{ id: 'e4', title: 'Sync', start: '2026-12-01T09:00:00Z', location: 'HQ' }] };
    f.CList.ui.calendarBrowser.list(f.view, model, {});

    const row = f.view.root.querySelector('.status-box');
    const specific = row.querySelector('.statusSpecific');
    assert.equal(specific.id, 'calendar-event-e4');
    assert.ok(specific.reference, 'the reference lives on .statusSpecific');
    assert.ok(!row.id, 'status-box itself should carry no id, same as ordinary feed rows');
    assert.equal(row.reference, undefined, 'status-box itself should carry no .reference, same as ordinary feed rows');
});
