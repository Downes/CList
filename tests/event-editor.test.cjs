const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { randomUUID } = require('node:crypto');
const { Element } = require('./helpers/account-fixture.cjs');
const source = name => fs.readFileSync('js/' + name + '.js', 'utf8');

// Fakes DOMParser's result for _detectCalendarEventFromHtml — matches the exact
// querySelector/getAttribute calls that function makes, not real HTML parsing (the
// lightweight test Element doesn't support attribute selectors; see file-recognition.test.cjs).
function field({ datetime, content, text } = {}) {
    return { getAttribute: attr => (attr === 'datetime' ? datetime : attr === 'content' ? content : null) ?? null, textContent: text ?? '' };
}
function eventElement(props) {
    return { querySelector: selector => { const m = selector.match(/^\[itemprop="(\w+)"\]$/); return (m && props[m[1]]) || null; } };
}
function domParserFor({ event, bareTime } = {}) {
    return class {
        parseFromString() {
            return { querySelector: selector => (selector === '[itemtype*="schema.org/Event" i]' ? event || null : selector === 'time[datetime]' ? bareTime || null : null) };
        }
    };
}

function fixture() {
    function element(tag = 'div') {
        const el = new Element(tag);
        el.classList = {
            add(name) { el.className = [...new Set((el.className || '').split(' ').concat(name))].join(' '); },
            remove(name) { el.className = (el.className || '').split(' ').filter(x => x !== name).join(' '); },
            contains(name) { return (el.className || '').split(' ').includes(name); },
            toggle(name) { this.contains(name) ? this.remove(name) : this.add(name); },
        };
        return el;
    }
    const root = element(), refsButton = element('button');
    const messages = [], icsCalls = [], downloads = [];
    const CList = { state: {}, ui: { view: { writeEditorArea: root, referencesButton: refsButton } } };
    const ctx = vm.createContext({
        window: { CList }, console, URL, structuredClone, Blob,
        document: {
            getElementById: id => root.querySelector('#' + id),
            createElement: element,
            createTextNode: text => { const el = element('span'); el.textContent = text; return el; },
            documentElement: element('html'),
            addEventListener() {},
        },
        escapeHtml: value => String(value).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])),
        showErrorModal: message => { throw Error(typeof message === 'string' ? message : message?.message || 'error'); },
        showStatusMessage: text => messages.push(text),
        buildIcsCalendar: events => { icsCalls.push(events); return 'BEGIN:VCALENDAR'; },
        downloadBlob: (blob, filename) => downloads.push(filename),
        _calendarFieldToIso: value => value,
        _calendarInputValue: value => value,
        crypto: { randomUUID },
        editorHandlers: {},
        currentEditor: 'event',
        switchToEditor: async () => {},
    });
    for (const name of ['references-state', 'references-view', 'references', 'tinymce']) vm.runInContext(source(name), ctx);
    vm.runInContext(source('event-editor'), ctx);

    const fields = {
        titleInput: { value: '' },
        startInput: { value: '', type: 'datetime-local' },
        endInput: { value: '', type: 'datetime-local' },
        locationInput: { value: '' },
        allDayInput: { checked: false },
        descriptionInput: { value: '', id: 'event-edit-description' },
    };
    ctx._fieldsBridge = fields;
    ctx._headerBridge = { textContent: '' };
    vm.runInContext('_eventEditorFields = _fieldsBridge; _eventEditorHeader = _headerBridge;', ctx);

    const addItem = (id, reference) => { const el = element(); el.id = id; el.reference = reference; root.appendChild(el); };

    return {
        ctx, root, fields, messages, icsCalls, downloads, addItem,
        handlers: vm.runInContext('editorHandlers', ctx),
        savers: () => CList.savers,
        references: () => CList.state.references || [],
        original: () => vm.runInContext('_eventEditorOriginal', ctx),
    };
}

test('_detectCalendarEventFromHtml reads schema.org Event microdata', () => {
    const f = fixture();
    f.ctx.DOMParser = domParserFor({
        event: eventElement({
            name: field({ text: 'Launch Party' }),
            startDate: field({ datetime: '2026-12-01T18:00:00Z' }),
            endDate: field({ datetime: '2026-12-01T20:00:00Z' }),
            location: field({ text: 'HQ' }),
            description: field({ text: 'Bring snacks' }),
        }),
    });
    const detected = vm.runInContext('_detectCalendarEventFromHtml("<ignored/>")', f.ctx);
    assert.deepEqual(JSON.parse(JSON.stringify(detected)), { title: 'Launch Party', start: '2026-12-01T18:00:00Z', end: '2026-12-01T20:00:00Z', location: 'HQ', description: 'Bring snacks' });
});

test('_detectCalendarEventFromHtml falls back to a bare <time datetime> with everything else blank', () => {
    const f = fixture();
    f.ctx.DOMParser = domParserFor({ bareTime: field({ datetime: '2026-12-02' }) });
    const detected = vm.runInContext('_detectCalendarEventFromHtml("<ignored/>")', f.ctx);
    assert.deepEqual(JSON.parse(JSON.stringify(detected)), { title: '', start: '2026-12-02', end: '', location: '', description: '' });
});

test('_detectCalendarEventFromHtml returns null when no structural marker is present', () => {
    const f = fixture();
    f.ctx.DOMParser = domParserFor({});
    const detected = vm.runInContext('_detectCalendarEventFromHtml("<p>Just prose, no dates marked up</p>")', f.ctx);
    assert.equal(detected, null);
});

test('loadContent populates fields from recognized content, falls back to the source reference title, and pushes a reference', () => {
    const f = fixture();
    f.ctx.DOMParser = domParserFor({
        event: eventElement({ startDate: field({ datetime: '2026-12-01T10:00:00' }) }), // no name -> title falls back
    });
    f.addItem('item-0', {
        service: 'Calendar', author_name: '', author_id: '', feed: 'Calendar', url: 'clist:event:x',
        title: 'From Feed', created_at: '2026-11-20T00:00:00Z', cited_at: '2026-11-23T00:00:00Z', id: 'item-0', summary: '',
    });

    f.handlers.event.loadContent({ type: 'text/html', value: '<div/>' }, 'item-0');

    assert.equal(f.fields.titleInput.value, 'From Feed');
    assert.equal(f.fields.startInput.value, '2026-12-01T10:00:00');
    assert.equal(f.fields.allDayInput.checked, false);
    assert.equal(f.fields.endInput.value, '');
    assert.equal(f.fields.locationInput.value, '');
    assert.equal(f.original(), null);
    assert.equal(f.references().length, 1);
    assert.equal(f.references()[0].url, 'clist:event:x');
});

test('loadContent falls back to appending into Description, and still pushes a reference, when nothing is recognized', () => {
    const f = fixture();
    f.ctx.DOMParser = domParserFor({});
    f.fields.descriptionInput.value = '<p>Existing</p>';
    f.addItem('item-1', {
        service: 'Mastodon', author_name: 'Someone', author_id: '1', feed: 'Feed', url: 'https://source/y',
        title: 'Y', created_at: '2026-11-20T00:00:00Z', cited_at: '2026-11-23T00:00:00Z', id: 'item-1', summary: '',
    });

    f.handlers.event.loadContent({ type: 'text/html', value: '<p>New</p>' }, 'item-1');

    assert.equal(f.fields.descriptionInput.value, '<p>Existing</p><p>New</p>');
    assert.equal(f.fields.titleInput.value, '');
    assert.equal(f.references().length, 1);
    assert.equal(f.references()[0].url, 'https://source/y');
});

test('loadContent escapes text/plain content before appending into Description', () => {
    const f = fixture();
    f.ctx.DOMParser = domParserFor({});
    f.addItem('item-2', {
        service: 'Mastodon', author_name: '', author_id: '', feed: 'Feed', url: 'https://source/z',
        title: 'Z', created_at: '2026-11-20T00:00:00Z', cited_at: '2026-11-23T00:00:00Z', id: 'item-2', summary: '',
    });

    f.handlers.event.loadContent({ type: 'text/plain', value: '<b>raw</b>' }, 'item-2');

    assert.equal(f.fields.descriptionInput.value, '&lt;b&gt;raw&lt;/b&gt;');
});

test('insertLink ("Write about this") appends the quote with a link into Description and pushes the reference', () => {
    const f = fixture();
    const reference = {
        service: 'Mastodon', author_name: 'Someone', author_id: '1', feed: 'Feed', url: 'https://source/toot',
        title: '', created_at: '2026-11-20T00:00:00Z', cited_at: '2026-11-23T00:00:00Z', id: 'item-9', summary: 'Hello world',
    };

    f.handlers.event.insertLink({
        content: { type: 'text/plain', value: 'Someone wrote: "Hello world"' },
        entryUrl: reference.url, feedTitle: 'Someone', reference,
    });

    assert.equal(f.fields.descriptionInput.value, 'Someone wrote: "Hello world" [<a href="https://source/toot">Someone</a>]');
    assert.equal(f.references().length, 1);
    assert.equal(f.references()[0].url, 'https://source/toot');
});

test('insertLink escapes an unescaped plain-text quote before inserting as HTML', () => {
    const f = fixture();
    f.handlers.event.insertLink({
        content: { type: 'text/plain', value: '<script>evil</script>' },
        entryUrl: 'https://source/x', feedTitle: 'Feed', reference: null,
    });
    assert.equal(f.fields.descriptionInput.value, '&lt;script&gt;evil&lt;/script&gt; [<a href="https://source/x">Feed</a>]');
    assert.equal(f.references().length, 0);
});

test('insertLinkVia appends the indirect-attribution quote into Description and pushes the reference', () => {
    const f = fixture();
    const reference = {
        service: 'Mastodon', author_name: '', author_id: '', feed: 'Feed', url: 'https://source/entry',
        title: '', created_at: '2026-11-20T00:00:00Z', cited_at: '2026-11-23T00:00:00Z', id: 'item-10', summary: '',
    };

    f.handlers.event.insertLinkVia({
        content: { type: 'text/plain', value: 'Quoted text' },
        linkedUrl: 'https://linked/page', linkedTitle: 'Linked Page',
        entryUrl: reference.url, authorOrFeedTitle: 'Author', reference,
    });

    assert.equal(f.fields.descriptionInput.value, 'Quoted text [<a href="https://linked/page">Linked Page</a>, via <a href="https://source/entry">Author</a>]');
    assert.equal(f.references().length, 1);
    assert.equal(f.references()[0].url, 'https://source/entry');
});

test('references pushed via loadContent survive into the .ics export draft', async () => {
    const f = fixture();
    f.ctx.DOMParser = domParserFor({});
    f.addItem('item-3', {
        service: 'Mastodon', author_name: '', author_id: '', feed: 'Feed', url: 'https://source/w',
        title: 'W', created_at: '2026-11-20T00:00:00Z', cited_at: '2026-11-23T00:00:00Z', id: 'item-3', summary: '',
    });
    f.handlers.event.loadContent({ type: 'text/html', value: '<p>Notes</p>' }, 'item-3');
    f.fields.titleInput.value = 'Launch';
    f.fields.startInput.value = '2026-12-01T10:00:00';

    const icsSaver = f.savers().find(saver => saver.label === 'Download as .ics file');
    await icsSaver.save();

    assert.equal(f.icsCalls.length, 1);
    assert.equal(f.icsCalls[0][0].title, 'Launch');
    assert.deepEqual(JSON.parse(JSON.stringify(f.icsCalls[0][0].references)), JSON.parse(JSON.stringify(f.references())));
    assert.equal(f.downloads.length, 1);
});
