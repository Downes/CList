const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

test('publishing view maps data updates to existing progress, success, warning, and failure helpers', () => {
    const calls = [], result = { innerHTML: 'Old results' };
    const context = vm.createContext({ window: { CList: { ui: { view: { postResult: result } } } },
        updatePostProgress: text => calls.push(['progress', text]),
        renderPublishingBusy: value => calls.push(['busy', value]), clearPostProgress: () => calls.push(['finish']),
        renderPublisherProgress: (name, progress) => calls.push(['detail', name, progress.stage]),
        showPublicationSuccess: (name, url) => calls.push(['success', name, url]),
        showPublicationError: (name, error) => calls.push(['failure', name, error]),
        showPostMessage: (container, text) => { assert.equal(container, result); calls.push(['message', text]); },
        showErrorModal: (message, options) => calls.push(['modal', message, options.title]),
    });
    vm.runInContext(fs.readFileSync('js/publishing-view.js', 'utf8'), context);
    const view = context.window.CList.ui.publishing;
    view.begin(); assert.equal(result.innerHTML, ''); view.setBusy(true);
    for (const status of ['publishing', 'published', 'failed', 'skipped', 'unconfirmed']) {
        view.update({ type: 'destination', result: { status, destination: 'Blog', url: 'https://blog.test', error: 'Failed' } });
    }
    view.update({ type: 'progress', destination: 'Blog', progress: { stage: 'creating-post' } });
    view.update({ type: 'warning', message: 'Truncating' }); view.setBusy(false); view.finish();
    assert.deepEqual(calls.filter(call => call[0] === 'success'), [['success', 'Blog', 'https://blog.test']]);
    assert.deepEqual(calls.filter(call => call[0] === 'failure'), [['failure', 'Blog', 'Failed']]);
    assert.equal(calls.filter(call => call[0] === 'message' && call[1].includes('no post link')).length, 1);
    assert.ok(calls.some(call => call[0] === 'detail')); assert.equal(calls.at(-1)[0], 'finish');
    view.fail(Error('Operation failed'));
    assert.equal(calls.filter(call => call[0] === 'modal').length, 1);
});
const { Element } = require('./helpers/account-fixture.cjs');
function panelFixture() {
    const panel = new Element('div'), calls = [];
    panel.querySelectorAll = selector => {
        const walk = element => element.children.flatMap(child => [child, ...walk(child)]);
        return walk(panel).filter(el => el.tagName === 'button' && el.dataset?.key);
    };
    const CList = { state: { publishing: { selectedAccountKeys: [], busy: false } }, ui: {}, publishers: {} };
    const context = vm.createContext({ window: { CList }, structuredClone,
        document: { createElement: tag => new Element(tag), getElementById: () => panel },
        parseAccountValue: record => JSON.parse(record.value),
        renderPublishingBusy: busy => calls.push(['busy', busy]),
        makeAccountList: (label, accounts, eligible, select) => {
            const list = new Element('div');
            for (const record of accounts) {
                const data = JSON.parse(record.value); if (!eligible(data)) continue;
                const button = new Element('button'), classes = new Set();
                button.dataset = { key: record.key, accountType: data.type };
                button.classList = { toggle: (name, value) => value ? classes.add(name) : classes.delete(name), contains: name => classes.has(name) };
                button.onclick = () => select(record.key, data, button); list.appendChild(button);
            }
            return list;
        },
    });
    vm.runInContext(fs.readFileSync('js/publishing-view.js', 'utf8'), context);
    vm.runInContext(fs.readFileSync('js/publish.js', 'utf8'), context);
    context.postAll = async () => calls.push(['publish']);
    context.postToWebPage = async () => calls.push(['web-page']);
    const accounts = [
        { key: 'blog', value: JSON.stringify({ type: 'Blog', permissions: 'w' }) },
        { key: 'anno', value: JSON.stringify({ type: 'Annotate', permissions: 'rw' }) },
        { key: 'reader', value: JSON.stringify({ type: 'Read', permissions: 'r' }) },
        { key: 'legacy', value: JSON.stringify({ type: 'Legacy' }) },
    ];
    return { context, CList, panel, calls, accounts, button: key => panel.querySelectorAll().find(b => b.dataset.key === key) };
}

test('Post panel rebuilds from controller selection and ignores tampered button state', async () => {
    const f = panelFixture(); f.context.populatePostOptions(f.accounts);
    assert.equal(f.button('reader'), undefined); assert.equal(f.button('legacy'), undefined);
    f.button('blog').click(); f.button('anno').click();
    assert.deepEqual(Array.from(f.CList.state.publishing.selectedAccountKeys), ['blog', 'anno']);
    f.context.populatePostOptions(f.accounts);
    assert.equal(f.button('anno').classList.contains('annotate-glow'), true);
    assert.equal(f.button('anno').getAttribute('aria-pressed'), 'true');
    f.button('blog').dataset.selected = 'false'; f.button('blog').click();
    assert.deepEqual(Array.from(f.CList.state.publishing.selectedAccountKeys), ['anno']);
    assert.equal(f.button('blog').getAttribute('aria-pressed'), 'false');
    const publish = f.panel.children.find(el => el.id === 'final-post-button');
    await publish.click();
    const webPageList = f.panel.children.at(-1); await webPageList.children.at(-1).listeners.click();
    assert.equal(f.calls.filter(call => call[0] === 'publish').length, 1);
    assert.equal(f.calls.filter(call => call[0] === 'web-page').length, 1);
});

test('Post view consumes explicit selection/busy values and callbacks without application state access', () => {
    const f = panelFixture(); delete f.CList.state;
    const selected = ['anno'];
    f.CList.ui.publishing.mount(f.accounts, { selectedKeys: selected, busy: true,
        onToggle: () => ['blog'], onPublish() {}, onWebPage() {} });
    assert.equal(f.button('anno').getAttribute('aria-pressed'), 'true');
    f.button('blog').click();
    assert.equal(f.button('blog').getAttribute('aria-pressed'), 'true');
    assert.equal(f.button('anno').getAttribute('aria-pressed'), 'false');
    assert.deepEqual(selected, ['anno']); assert.ok(f.calls.some(call => call[0] === 'busy' && call[1] === true));
});
