const test = require('node:test');
const assert = require('node:assert/strict');
const { fixture, Element } = require('./helpers/account-fixture.cjs');

function formFixture() {
    const f = fixture({ panel: true });
    // Mirrors utilities.js's slugify() without loading that whole module (it touches
    // window.addEventListener at top level, which this minimal panel sandbox lacks).
    f.ctx.slugify = (text, { maxLength = 50, fallback = '' } = {}) => (text || '').toLowerCase()
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, maxLength) || fallback;
    f.load('calendar-subscription.js');
    const root = f.ctx.kvstoreAccountsPanel();
    return { ...f, root };
}
const openCalendarForm = root => {
    root.querySelector('#add-account-btn').click();
    root.querySelectorAll('.account-button').find(button => button.textContent.includes('Calendar')).click();
};
const setTitle = (root, value) => {
    const input = root.querySelector('#titleInput'); input.value = value; input.dispatch('input');
};

test('Calendar schema is registered under the plain type name, with a URL-typed feed field', () => {
    const f = formFixture();
    assert.equal(f.cList.schemas.Calendar.type, 'Calendar');
    assert.equal(f.cList.schemas.Calendar.fields.find(field => field.key === 'url').inputType, 'url');
});

test('creating a Calendar account hides the Account Name field and derives the key from the title', async () => {
    const f = formFixture(); openCalendarForm(f.root);
    assert.equal(f.root.querySelector('#_keyInput').parentNode.style.display, 'none');
    setTitle(f.root, 'Ottawa Senators');
    assert.equal(f.root.querySelector('#_keyInput').value, 'ottawa-senators');
    f.root.querySelector('#urlInput').value = 'https://example.invalid/sens.ics';
    await f.root.querySelector('#submitBtn').click();
    assert.equal(f.records.has('ottawa-senators'), true);
    assert.equal(f.errors.length, 0);
});

test('a duplicate derived key gets a numeric suffix', async () => {
    const f = formFixture();
    f.add('ottawa-senators', { type: 'Calendar', title: 'Ottawa Senators', url: 'https://example.invalid/old.ics', permissions: 'r' });
    f.cList.accounts = [{ key: 'ottawa-senators', value: JSON.stringify({ type: 'Calendar' }) }];
    openCalendarForm(f.root);
    setTitle(f.root, 'Ottawa Senators');
    assert.equal(f.root.querySelector('#_keyInput').value, 'ottawa-senators-2');
});

test('editing an existing Calendar account keeps its original key even if the title changes', async () => {
    const f = formFixture();
    f.add('ottawa-senators', { type: 'Calendar', title: 'Ottawa Senators', url: 'https://example.invalid/sens.ics', permissions: 'r' });
    f.cList.accounts = [{ key: 'ottawa-senators', value: JSON.stringify({ type: 'Calendar' }) }];
    await f.flush();
    await f.root.querySelector('.account-button').click();
    assert.equal(f.root.querySelector('#_keyInput').parentNode.style.display, 'none');
    setTitle(f.root, 'Sens Schedule');
    await f.root.querySelector('#submitBtn').click();
    assert.equal(f.records.has('ottawa-senators'), true);
    assert.equal(JSON.parse(f.records.get('ottawa-senators').slice(10)).title, 'Sens Schedule');
});

test('an ICS feed URL without a scheme is rejected with a clear error, not accepted', async () => {
    const f = formFixture(); openCalendarForm(f.root);
    setTitle(f.root, 'Ottawa Senators');
    f.root.querySelector('#urlInput').value = 'ottawa-senators.ics';
    await f.root.querySelector('#submitBtn').click();
    assert.equal(f.records.has('ottawa-senators'), false);
    assert.equal(f.errors.length, 1);
    assert.match(f.errors[0].message, /valid URL/);
});

test('a well-formed https feed URL is accepted', async () => {
    const f = formFixture(); openCalendarForm(f.root);
    setTitle(f.root, 'Ottawa Senators');
    f.root.querySelector('#urlInput').value = 'https://example.invalid/sens.ics';
    await f.root.querySelector('#submitBtn').click();
    assert.equal(f.errors.length, 0);
    assert.equal(f.records.has('ottawa-senators'), true);
});
