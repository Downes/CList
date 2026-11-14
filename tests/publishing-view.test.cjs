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
