const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { fixture, Element, source } = require('./helpers/account-fixture.cjs');

async function setup() {
    const f = fixture({ panel: true }); f.schema('Example');
    f.add('a', { type: 'Example', title: 'First', id: 'secret', extra: { nested: true } });
    const root = f.ctx.kvstoreAccountsPanel(); await f.flush();
    return { ...f, root };
}
const changeTitle = (root, value) => {
    const input = root.querySelector('#titleInput'); input.value = value; input.dispatch('input');
};

test('generic editing preserves hidden credentials, extension properties, and form scope', async () => {
    const f = await setup();
    await f.root.querySelector('.account-button').click();
    const other = f.ctx.kvstoreAccountsPanel(); await f.flush();
    await other.querySelector('.account-button').click();
    changeTitle(f.root, 'Changed');
    await f.root.querySelector('#submitBtn').click();
    const saved = JSON.parse(f.records.get('a').slice(10));
    assert.equal(saved.id, 'secret'); assert.deepEqual(saved.extra, { nested: true });
    assert.equal(saved.title, 'Changed'); assert.equal('_key' in saved, false);
    assert.equal(other.querySelector('#titleInput').value, 'First');
    assert.equal(f.root.querySelector('#sharedForm').style.display, 'none');
});

test('a failed save retains the draft and presents one failure; a double click cannot duplicate a write', async () => {
    const f = await setup(); await f.root.querySelector('.account-button').click();
    changeTitle(f.root, 'Draft'); f.failWrite(true);
    const save = f.root.querySelector('#submitBtn');
    const pending = save.click(); await save.click(); await pending;
    assert.equal(f.errors.length, 1); assert.match(f.errors[0].message, /write offline/);
    assert.equal(f.root.querySelector('#titleInput').value, 'Draft');
    assert.equal(f.root.querySelector('#sharedForm').style.display, 'block');
    assert.equal(save.disabled, false); assert.equal(f.writes.length, 0);
    f.failWrite(false); await save.click(); assert.equal(f.writes.length, 1);
});

test('creating a schema-based account returns to the managed account list after saving', async () => {
    const f = await setup(); f.schema('Bluesky');
    await f.root.querySelector('#add-account-btn').click();
    f.root.querySelectorAll('.account-button').find(button => button.textContent.includes('Bluesky')).click();
    f.root.querySelector('#_keyInput').value = 'new-account'; changeTitle(f.root, 'New account');
    await f.root.querySelector('#submitBtn').click();
    assert.equal(f.records.has('new-account'), true);
    assert.equal(f.root.querySelector('#sharedForm').style.display, 'none');
    assert.equal(f.root.querySelector('#kvList').style.display, 'block');
    assert.equal(f.root.querySelector('#add-account-header').style.display, '');
});

test('refreshing the list preserves an open dirty form and its captured fields', async () => {
    const f = await setup(); let context;
    f.cList.accountFlows = { Other: ctx => { context = ctx; return { open() {} }; } };
    f.cList.accountHooks.Example = { decorateForm: ctx => { ctx.getAccountFlow('Other'); } };
    await f.root.querySelector('.account-button').click(); changeTitle(f.root, 'Unsaved');
    await context.refreshList(f.session.storeUrl);
    assert.equal(f.root.querySelector('#titleInput').value, 'Unsaved');
    assert.equal(f.root.querySelectorAll('#sharedForm').length, 1);
    f.ctx.confirm = () => false; await f.root.querySelector('#cancelBtn').click();
    assert.equal(f.root.querySelector('#sharedForm').style.display, 'block');
});

test('successful save plus failed refresh stays saved; Retry refresh performs no write', async () => {
    const f = await setup(); await f.root.querySelector('.account-button').click();
    changeTitle(f.root, 'Saved'); f.failList(true);
    await f.root.querySelector('#submitBtn').click();
    assert.equal(f.writes.length, 1); assert.equal(f.errors.length, 0);
    assert.match(f.refreshErrors.at(-1).title, /saved; refresh failed/);
    assert.match(f.refreshErrors.at(-1).message, /do not repeat the save/);
    assert.equal(JSON.parse(f.cList.accounts[0].value).title, 'Saved');
    assert.equal(f.root.querySelector('#sharedForm').style.display, 'none');
    const retry = f.root.querySelectorAll('button').find(button => button.textContent === 'Retry refresh');
    f.failList(false); await retry.click(); assert.equal(f.writes.length, 1);
    assert.equal(f.root.querySelector('.account-button').textContent.includes('Saved'), true);
});

test('failed deletion retains the form; successful deletion with failed refresh cannot be repeated', async () => {
    const f = await setup(); await f.root.querySelector('.account-button').click();
    f.failWrite(true); await f.root.querySelector('#deleteBtn').click();
    assert.equal(f.errors.length, 1); assert.equal(f.records.has('a'), true);
    assert.equal(f.root.querySelector('#sharedForm').style.display, 'block');
    f.failWrite(false); f.failList(true); await f.root.querySelector('#deleteBtn').click();
    assert.deepEqual(f.writes, [['remove', 'a']]); assert.equal(f.records.has('a'), false);
    assert.match(f.refreshErrors.at(-1).title, /deleted; refresh failed/);
    assert.equal(f.cList.accounts.length, 0); assert.equal(f.root.querySelector('#sharedForm').style.display, 'none');
});

test('unsaved edits can be retained, discarded, or saved before switching to another account', async () => {
    const f = await setup(); f.add('b', { type: 'Example', title: 'Second' });
    // Reopen a panel with both rows.
    const root = f.ctx.kvstoreAccountsPanel(); await f.flush();
    await root.querySelectorAll('.account-button')[0].click(); changeTitle(root, 'Draft');
    f.ctx.confirm = () => false;
    await root.querySelectorAll('.account-button')[1].click();
    assert.equal(root.querySelector('#titleInput').value, 'Draft');
    assert.equal(root.querySelector('#sharedForm').dataset.openFor, 'a');
    f.ctx.confirm = () => true;
    await root.querySelectorAll('.account-button')[1].click();
    assert.equal(JSON.parse(f.records.get('a').slice(10)).title, 'Draft');
    assert.equal(root.querySelector('#titleInput').value, 'Second');
    assert.equal(root.querySelector('#sharedForm').dataset.openFor, 'b');
    // The form belongs to the newly rendered list, rather than a detached old row.
    assert.equal(root.querySelectorAll('#sharedForm').length, 1);
    changeTitle(root, 'Discard me');
    const answers = [false, true]; f.ctx.confirm = () => answers.shift();
    await root.querySelector('#cancelBtn').click();
    assert.equal(root.querySelector('#sharedForm').style.display, 'none');
    assert.equal(f.writes.length, 1);
});

test('Back to the type picker preserves a dirty draft unless the user permits closing it', async () => {
    const f = await setup(); await f.root.querySelector('.account-button').click();
    changeTitle(f.root, 'Draft'); f.ctx.confirm = () => false;
    vm.runInContext('_accountsPanelCtx.showTypePicker(false)', f.ctx); await f.flush();
    assert.equal(f.root.querySelector('#titleInput').value, 'Draft');
    assert.equal(f.root.querySelector('#sharedForm').style.display, 'block');
});

test('factory instances are cached per panel and schema-only types retain generic forms', async () => {
    const f = await setup(); let factories = 0, opens = 0;
    f.cList.accountFlows = { Mastodon: () => { factories++; return { open() { opens++; } }; } };
    await f.root.querySelector('#add-account-btn').click();
    const mastodon = f.root.querySelectorAll('.account-button').find(button => button.textContent.includes('Mastodon'));
    mastodon.click(); mastodon.click(); assert.equal(factories, 1); assert.equal(opens, 2);
    const other = f.ctx.kvstoreAccountsPanel(); await f.flush();
    await other.querySelector('#add-account-btn').click();
    other.querySelectorAll('.account-button').find(button => button.textContent.includes('Mastodon')).click();
    assert.equal(factories, 2);
    f.schema('Bluesky');
    other.querySelectorAll('.account-button').find(button => button.textContent.includes('Bluesky')).click();
    assert.equal(other.querySelector('#sharedForm').dataset.openFor, '__add__');
    assert.equal(other.querySelector('#submitBtn').textContent, 'Add Account');
});

test('reauthorization hooks receive only this form snapshot; public checkbox and manual token entry remain editable', async () => {
    const f = await setup(), requests = []; f.schema('Mastodon');
    f.cList.accountHooks.Mastodon = { reauthorize: request => requests.push(request) };
    f.add('m', { type: 'Mastodon', title: 'Social', id: 'secret', public: true });
    const root = f.ctx.kvstoreAccountsPanel(); await f.flush();
    await root.querySelectorAll('.account-button')[1].click();
    assert.equal(root.querySelector('#publicCheckbox').checked, true);
    await root.querySelectorAll('button').find(button => button.textContent === 'Re-authorize').click();
    assert.equal(requests[0].key, 'm'); assert.equal(requests[0].data.id, 'secret');
    root.querySelectorAll('button').find(button => button.textContent === 'Enter manually').click();
    assert.equal(root.querySelector('#idInput').type, 'password');
    root.querySelector('#idInput').value = 'replacement'; root.querySelector('#publicCheckbox').checked = false;
    await root.querySelector('#submitBtn').click();
    const data = JSON.parse(f.records.get('m').slice(10)); assert.equal(data.id, 'replacement'); assert.equal(data.public, false);
});

test('Discord edit controls dispatch through the panel-scoped service instance', async () => {
    const f = await setup(); f.schema('Discord');
    f.cList.schemas.Discord.fields.push({ key: 'bot_token', label: 'Bot', editable: true });
    f.add('d', { type: 'Discord', title: 'Channel', bot_token: 'secret' });
    vm.runInContext(source('discord_account.js'), f.ctx);
    const controls = []; f.cList.accountFlows.Discord = () => ({ open() {}, manageChannels: ctx => controls.push(ctx) });
    const root = f.ctx.kvstoreAccountsPanel(); await f.flush();
    await root.querySelectorAll('.account-button')[1].click();
    await root.querySelector('#discord-edit-manage-btn').click();
    assert.equal(controls[0].botTokenEl, root.querySelector('#bot_tokenInput'));
    assert.equal(controls[0].statusEl, root.querySelector('#discord-edit-status'));
});

test('PublicFeed edit hook opens the existing collection editor and retains per-user account updates', async () => {
    const f = await setup(); f.schema('PublicFeed');
    f.cList.schemas.PublicFeed.fields.push({ key: 'database', label: 'Database', inputType: 'hidden' });
    f.add('feeds', { type: 'PublicFeed', title: 'Feeds', database: '' });
    vm.runInContext(source('public-feed-editor.js'), f.ctx);
    let opened, revealed = false;
    f.ctx.revealEditorPane = () => { revealed = true; };
    f.ctx.ensurePersonalPublicFeedAccount = async (key, data) => ({ ...data, database: 'personal' });
    f.ctx.openPublicFeedCollection = async (key, data) => { opened = { key, data }; };
    const root = f.ctx.kvstoreAccountsPanel(); await f.flush();
    await root.querySelectorAll('.account-button')[1].click();
    const button = root.querySelectorAll('button').find(button => button.textContent === 'Edit Feed Collection');
    changeTitle(root, 'Dirty'); await button.click(); assert.equal(opened, undefined);
    assert.match(f.errors.at(-1).message, /Save your account changes/);
    // Discard and reopen the form to test the service-side personal-copy update.
    f.ctx.confirm = () => false;
    const answers = [false, true]; f.ctx.confirm = () => answers.shift(); await root.querySelector('#cancelBtn').click();
    await root.querySelectorAll('.account-button')[1].click();
    await root.querySelectorAll('button').find(button => button.textContent === 'Edit Feed Collection').click();
    assert.equal(revealed, true); assert.equal(opened.key, 'feeds'); assert.equal(opened.data.database, 'personal');
    assert.equal(root.querySelector('#databaseInput').value, 'personal');
    assert.equal(root.querySelector('#sharedForm').style.display, 'none');
});

test('the LocalRSS account hook supplies its own form root to the existing OPML control', () => {
    const f = fixture({ panel: true }), roots = [];
    const text = source('localrss.js');
    vm.runInContext(text.slice(0, text.indexOf("window.CList.schemas['LOCALRSS']")), f.ctx);
    f.ctx._localrssBuildAccountOpmlSection = root => { roots.push(root); return new Element(); };
    const a = new Element(), b = new Element();
    for (const root of [a, b]) f.cList.accountHooks.LOCALRSS.decorateForm({ root, container: root, mode: 'create' });
    assert.deepEqual(roots, [a, b]);
});
