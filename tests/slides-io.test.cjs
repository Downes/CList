const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const { menuShellDocument } = require('./helpers/menu-shell-dom.cjs');
const document = menuShellDocument(), create = document.createElement;
document.createElement = tag => { const node = create(tag); node.select = () => {}; node.click = () => { if (!node.disabled) return node.onclick?.(); }; return node; };
const context = vm.createContext({ document, ArrayBuffer, Uint8Array, structuredClone, crypto: require('node:crypto').webcrypto, console: { error() {} }, window: { CList: { state: {}, config: {} }, addEventListener() {} } });
for (const name of ['page-store', 'ui', 'slides_layout_workflow', 'slides_layout', 'slides_layout_view', 'slides_io_workflow', 'slides_io', 'slides_io_view']) vm.runInContext(fs.readFileSync('js/' + name + '.js', 'utf8'), context);
context.buildDialogModal = context.window.CList.ui.buildDialogModal;
for (const name of ['slides-layout-fixture', 'slides-io-fixture']) vm.runInContext(fs.readFileSync('tests/helpers/' + name + '.js', 'utf8'), context);
for (const [name, run] of vm.runInContext('slidesIOCases', context)) test(name, { timeout: 2000 }, () => run((condition, message) => assert.ok(condition, message)));

test('real Slides registry/handler captures embedded instance and returns the PowerPoint load promise', async () => {
    const f = vm.runInContext('slidesIOFixture()', context), gate = vm.runInContext('slidesIOGate()', context);
    context.window.CList.loaders = []; context.window.CList.savers = [];
    context.window.CList.config = { flaskSiteUrl: 'https://identity.invalid' }; context.window.CList.keys = { ACCESS_TOKEN: 'access_token' };
    context.window.CList.state = { username: 'User', authEpoch: 1, editorLoading: { id: 1 } };
    let closed = 0;
    Object.assign(context, { editorHandlers: {}, testSlidesEditor: f.editor, getSiteSpecificCookie: () => 'synthetic-token',
        setReferences() {}, getReferences: () => [], closeLoadSurfaces: () => { closed++; }, queueMicrotask() {} });
    const source = fs.readFileSync('js/slides.js', 'utf8').replace('editorHandlers.slides = {', 'instance = testSlidesEditor; editorHandlers.slides = {');
    vm.runInContext(source, context);
    await context.window.CList.savers.find(saver => saver.label === 'Export slides as HTML').save();
    assert.equal(f.calls.find(call => call[0] === 'html')[1], f.editor);
    f.behavior.import = () => gate.promise;
    const pending = context.editorHandlers.slides.loadContent({ type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', value: new ArrayBuffer(1) });
    assert.equal(typeof pending.then, 'function'); await vm.runInContext('slidesIOFlush()', context);
    context.window.CList.state.editorLoading.id++;
    gate.resolve({ count: 1, warnings: [] }); await pending;
    assert.equal(closed, 0, 'old load does not close newer controls');
    assert.equal(f.calls.filter(call => call[0] === 'import').length, 1);
    f.dispose();
});
