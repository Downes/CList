const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { Element } = require('./helpers/account-fixture.cjs');

test('web-page choice is a view-only promise, blocks invalid overwrite, and uses standard buttons', async () => {
    const result = new Element(), button = new Element('button'), errors = [], successes = [], status = new Element();
    const context = vm.createContext({
        window: { CList: { ui: { view: { postResult: result, writeTitle: { innerText: ' Title ' } } } } },
        document: { createElement: tag => new Element(tag), getElementById: id => id === 'republish-button' ? button : status },
        renderPublicationSuccess: (...args) => successes.push(args), showStatusMessage() {},
        showErrorModal: (message, options) => errors.push({ message, ...options }),
    });
    vm.runInContext(fs.readFileSync('js/web-page-view.js', 'utf8'), context);
    const view = context.window.CList.ui.webPagePublishing;
    assert.equal(view.readTitle(), 'Title');
    const pending = view.chooseVersion(false), controls = result.querySelectorAll('button');
    assert.equal(controls[0].disabled, true); assert.equal(controls[1].className, 'btn');
    await controls[1].click(); assert.equal(await pending, 'new'); assert.ok(controls.every(control => control.disabled));
    view.setBusy(true); assert.equal(button.disabled, true); view.setBusy(false); assert.equal(button.disabled, false);
    view.published({ status: 'published', url: 'https://bin.test/page', metadataError: 'offline' }, false);
    assert.equal(successes.length, 1); assert.equal(errors.length, 1); assert.match(errors[0].title, /Published/);
    view.published({ status: 'unconfirmed' }, false); assert.equal(successes.length, 1); assert.equal(errors.length, 2);
});
