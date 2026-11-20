const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { Element } = require('./helpers/account-fixture.cjs');

function fixture() {
    const target = new Element(), errors = [], observers = [];
    const ctx = vm.createContext({ window: { CList: { ui: {} } },
        console: { error: (...args) => errors.push(args) },
        document: { body: target, createElement: name => new Element(name), getElementById: id => id === 'save-options' ? target : null },
        MutationObserver: class {
            constructor(callback) { this.callback = callback; this.disconnected = false; observers.push(this); }
            observe() {}
            disconnect() { this.disconnected = true; }
        },
    });
    vm.runInContext(fs.readFileSync('js/dropbox_save_view.js', 'utf8'), ctx);
    return { ctx, target, errors, observers, ui: ctx.window.CList.ui.dropboxSave,
        button: (view, label) => view.root.querySelectorAll('button').find(button => button.textContent === label) };
}

test('Dropbox save mount owns only its own status area and uses text for status/filenames', async () => {
    const f = fixture(), unrelated = new Element(); unrelated.id = 'other-status'; f.target.appendChild(unrelated);
    const first = f.ui.mount(); f.ui.progress(first, '<b>Checking</b>');
    assert.equal(first.root.textContent, '<b>Checking</b>'); assert.equal(first.root.children.length, 0);
    const pending = f.ui.chooseOverwrite(first, '<img src=x onerror=write()>');
    assert.match(first.root.textContent, /<img src=x onerror=write\(\)>/);
    const second = f.ui.mount();
    assert.equal(await pending, 'cancel'); assert.equal(first.root.parentNode, null);
    assert.equal(unrelated.parentNode, f.target); assert.equal(second.root.parentNode, f.target);
    f.ui.saved(second, { path_display: '/Captured/result.html' });
    assert.equal(second.root.textContent, 'Saved: /Captured/result.html');
});

test('overwrite choice stays pending across destination-list replacement and settles only once', async () => {
    const f = fixture(), view = f.ui.mount(); let settled = false;
    const pending = f.ui.chooseOverwrite(view, 'existing.txt').then(value => { settled = true; return value; });
    await Promise.resolve(); assert.equal(settled, false);
    const list = new Element(); f.target.insertBefore(list, view.root); list.remove();
    const overwrite = f.button(view, 'Overwrite'), cancel = f.button(view, 'Cancel');
    assert.equal(overwrite.className, 'btn btn-small'); assert.equal(cancel.className, 'btn btn-small btn-secondary');
    overwrite.onclick(); cancel.onclick(); overwrite.onclick();
    assert.equal(await pending, 'overwrite'); assert.equal(overwrite.disabled, true); assert.equal(cancel.disabled, true);
    assert.equal(f.observers[0].disconnected, true); assert.equal(view.cancelChoice, null);
});

test('expired and disconnected overwrite choices cancel without touching a replacement view', async () => {
    for (const expire of ['guard', 'disconnect', 'throw']) {
        const f = fixture(), view = f.ui.mount(); let current = true;
        const pending = f.ui.chooseOverwrite(view, 'old.txt', () => { if (expire === 'throw' && !current) throw Error('old session'); return current; });
        const overwrite = f.button(view, 'Overwrite');
        if (expire === 'disconnect') view.root.isConnected = false;
        else current = false;
        overwrite.onclick();
        assert.equal(await pending, 'cancel');
        const replacement = f.ui.mount(); f.ui.progress(replacement, 'New operation');
        overwrite.onclick(); assert.equal(replacement.root.textContent, 'New operation');
    }
});

test('removing a choice or superseding it releases the promise and disconnects its observer', async () => {
    const f = fixture(), view = f.ui.mount();
    const first = f.ui.chooseOverwrite(view, 'first.txt'), oldButton = f.button(view, 'Overwrite');
    const second = f.ui.chooseOverwrite(view, 'second.txt');
    assert.equal(await first, 'cancel'); assert.equal(f.observers[0].disconnected, true);
    oldButton.onclick();
    view.root.isConnected = false; f.observers[1].callback();
    assert.equal(await second, 'cancel'); assert.equal(f.observers[1].disconnected, true);
});
