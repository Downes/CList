const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const plain = value => JSON.parse(JSON.stringify(value));

function fixture() {
    const ctx = vm.createContext({ console: { error() {} } });
    vm.runInContext(fs.readFileSync('js/ics.js', 'utf8'), ctx);
    return ctx;
}

test('parses a minimal timed VEVENT', () => {
    const ics = fixture();
    const text = [
        'BEGIN:VCALENDAR', 'BEGIN:VEVENT',
        'UID:evt-1', 'SUMMARY:Standup', 'DTSTART:20260105T090000Z', 'DTEND:20260105T093000Z',
        'END:VEVENT', 'END:VCALENDAR',
    ].join('\r\n');
    const events = ics.parseIcsCalendar(text);
    assert.deepEqual(plain(events), [{ uid: 'evt-1', title: 'Standup', start: '2026-01-05T09:00:00Z', end: '2026-01-05T09:30:00Z' }]);
});

test('parses an all-day VALUE=DATE event', () => {
    const ics = fixture();
    const text = ['BEGIN:VEVENT', 'UID:evt-2', 'SUMMARY:Holiday', 'DTSTART;VALUE=DATE:20260301', 'END:VEVENT'].join('\r\n');
    const [event] = ics.parseIcsCalendar(text);
    assert.equal(event.start, '2026-03-01');
    assert.equal(event.allDay, true);
});

test('line-folding/unfolding round-trips a long SUMMARY', () => {
    const ics = fixture();
    const longTitle = 'A'.repeat(120);
    const built = ics.buildIcsCalendar([{ id: 'evt-3', title: longTitle, start: '2026-01-05T09:00:00.000Z' }]);
    assert.match(built, /\r\n /); // at least one folded continuation line
    const [event] = ics.parseIcsCalendar(built);
    assert.equal(event.title, longTitle);
});

test('a malformed VEVENT is skipped without dropping the rest of the feed', () => {
    const ics = fixture();
    const text = [
        'BEGIN:VCALENDAR',
        'BEGIN:VEVENT', 'SUMMARY:Missing UID and DTSTART', 'END:VEVENT',
        'BEGIN:VEVENT', 'UID:evt-4', 'SUMMARY:Good', 'DTSTART:20260105T090000Z', 'END:VEVENT',
        'END:VCALENDAR',
    ].join('\r\n');
    const events = ics.parseIcsCalendar(text);
    assert.deepEqual(plain(events.map(event => event.uid)), ['evt-4']);
});

test('an RRULE-bearing VEVENT yields exactly one occurrence and never hangs', () => {
    const ics = fixture();
    const text = [
        'BEGIN:VEVENT', 'UID:evt-5', 'SUMMARY:Weekly', 'DTSTART:20260105T090000Z',
        'RRULE:FREQ=WEEKLY;COUNT=500', 'END:VEVENT',
    ].join('\r\n');
    const events = ics.parseIcsCalendar(text);
    assert.equal(events.length, 1);
    assert.equal(events[0].start, '2026-01-05T09:00:00Z');
});

test('buildIcsCalendar -> parseIcsCalendar round-trips a timed event', () => {
    const ics = fixture();
    const built = ics.buildIcsCalendar([{ id: 'evt-6', title: 'Review; notes, etc.', start: '2026-01-05T09:00:00.000Z',
        end: '2026-01-05T10:00:00.000Z', location: 'Room 4', description: 'Line one\nLine two' }]);
    const [event] = ics.parseIcsCalendar(built);
    assert.equal(event.uid, 'evt-6');
    assert.equal(event.title, 'Review; notes, etc.');
    assert.equal(event.start, '2026-01-05T09:00:00Z');
    assert.equal(event.end, '2026-01-05T10:00:00Z');
    assert.equal(event.location, 'Room 4');
    assert.equal(event.description, 'Line one\nLine two');
    assert.equal(event.allDay, undefined);
});

test('buildIcsCalendar -> parseIcsCalendar round-trips an all-day event', () => {
    const ics = fixture();
    const built = ics.buildIcsCalendar([{ id: 'evt-7', title: 'Day off', start: '2026-03-01', allDay: true }]);
    const [event] = ics.parseIcsCalendar(built);
    assert.equal(event.uid, 'evt-7');
    assert.equal(event.start, '2026-03-01');
    assert.equal(event.allDay, true);
});
