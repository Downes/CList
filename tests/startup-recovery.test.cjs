const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function fixture() {
    let pending, delay, modal = null, resetOptions;
    const make = () => ({children: [], isConnected: false,
        appendChild(child) {this.children.push(child);},
        closest() {return modal;}
    });
    const context = vm.createContext({
        window: {CList: {ui: {}}}, document: {createElement: make},
        setTimeout(fn, ms) {pending = fn; delay = ms; return 1;},
        clearTimeout() {pending = null;},
        showModal(root, options) {
            assert.equal(options.hideDefaultClose, true);
            if (modal) modal.remove();
            root.isConnected = true;
            modal = {root, remove() {root.isConnected = false; modal = null;}};
        },
        sessionLifecycle: () => ({logout: options => {resetOptions = options;}})
    });
    vm.runInContext(fs.readFileSync('js/startup-recovery.js', 'utf8'), context);
    return {context, pending: () => pending, delay: () => delay, modal: () => modal, options: () => resetOptions};
}
test('five-second recovery uses modal, dismisses on completion, and preserves drafts', () => {
    const f = fixture();
    assert.equal(f.delay(), 5000); assert.equal(f.modal(), null);
    f.pending()();
    const panel = f.modal().root;
    assert.match(panel.children[0].textContent, /Startup scripts/);
    assert.equal(panel.children[0].className, 'error-modal-title');
    assert.equal(panel.children.at(-1).className, 'btn-small btn-secondary');
    panel.children.find(el => el.textContent === 'Reset session and reload').onclick();
    assert.equal(f.options().preserveDrafts, true);
    f.context.window.CList.ui.startupRecovery.update('ready');
    assert.equal(f.modal(), null); assert.equal(f.pending(), null);
});
test('recovery cannot close a replacement modal and completed startup cancels timer', () => {
    const f = fixture(); f.pending()();
    const stale = f.modal().root.children.find(el => el.textContent === 'Reset session and reload');
    f.context.showModal({isConnected: false}, {hideDefaultClose:true});
    const newer = f.modal();
    f.context.window.CList.ui.startupRecovery.update('guest');
    assert.equal(f.modal(), newer);
    stale.onclick(); assert.equal(f.options(), undefined);
    f.context.window.CList.ui.startupRecovery.update('restoring');
    assert.equal(f.delay(), 5000);
    f.context.window.CList.ui.startupRecovery.update('failed');
    assert.equal(f.pending(), null);
});
test('initial HTML makes no guest or authenticated claim before restoration', () => {
    const html = fs.readFileSync('index.html', 'utf8');
    for (const id of ['loginButton', 'logoutButton', 'registerButton', 'accountButton']) {
        const tag = html.match(new RegExp('<button[^>]*id="' + id + '"[^>]*>'))?.[0];
        assert.match(tag, /style="display:none"/);
    }
    assert.ok(!html.includes('id="session-recovery"'));
});

test('real UI namespace initialization preserves early recovery and completion cancels its timer', () => {
    const f = fixture(), hook = f.context.window.CList.ui.startupRecovery;
    const source = fs.readFileSync('js/ui.js', 'utf8');
    vm.runInContext(source.slice(0, source.indexOf('window.CList.ui.view =')), f.context);
    assert.equal(f.context.window.CList.ui.startupRecovery, hook);
    hook.update('ready');
    assert.equal(f.pending(), null); assert.equal(f.modal(), null);
});
test('recovery identifies account loading separately from session key loading', () => {
    const f = fixture(), hook = f.context.window.CList.ui.startupRecovery;
    hook.update('restoring', 'key'); f.pending()();
    assert.match(f.modal().root.children[0].textContent, /Session key loading/);
    hook.update('restoring', 'accounts'); f.pending()();
    assert.match(f.modal().root.children[0].textContent, /Account loading/);
});
