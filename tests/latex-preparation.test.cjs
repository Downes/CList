const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const { menuShellDocument } = require('./helpers/menu-shell-dom.cjs');
const context = vm.createContext({ document: menuShellDocument(), structuredClone, window: { CList: { state: {}, config: {}, ui: {} } } });
for (const name of ['collab_connection_preparation', 'latex_connection_preparation', 'latex_resource', 'latex_resource_view']) vm.runInContext(fs.readFileSync('js/' + name + '.js', 'utf8'), context);
vm.runInContext(fs.readFileSync('tests/helpers/latex-preparation-fixture.js', 'utf8'), context);
for (const [name, run] of vm.runInContext('latexPreparationCases', context)) test(name, { timeout: 2000 }, () => run((condition, message) => assert.ok(condition, message)));

test('real LaTeX connection commits captured constructor inputs and expires before replacement', async () => {
    const f = vm.runInContext('latexPreparationFixture()', context), constructed = [];
    context.window.CList.defaults = { COLLAB: 'https://default.invalid' };
    const fake = () => ({});
    const modules = {
        Y: { Doc: class { getText() { return { toString: () => '' }; } getMap() { return { observe() {} }; } } },
        HocuspocusProvider: class { constructor(options) { constructed.push(options); this.awareness = { setLocalStateField() {}, on() {}, getStates: () => new Map() }; } destroy() { constructed.push('destroy'); } },
        EditorView: class { static editable = { of: fake }; static lineWrapping = {}; constructor(options) { constructed.push(options); } destroy() { constructed.push('destroy'); } },
        EditorState: { create: value => value }, keymap: { of: fake }, lineNumbers: fake, highlightActiveLine: fake,
        StreamLanguage: { define: fake }, syntaxHighlighting: fake, yCollab: fake, defaultKeymap: [], yUndoManagerKeymap: [],
    };
    const gate = vm.runInContext('latexPreparationGate()', context);
    Object.assign(context, { testModules: modules, getAccounts: () => gate.promise,
        findAccountByType: () => ({ parsedValue: { instance: 'wss://selected.invalid' } }),
        setReferences() {}, setTimeout() {}, editorHandlers: {} });
    const source = fs.readFileSync('js/latex.js', 'utf8')
        .replace("const bundle = await import('./vendor/latex-editor-bundle.js')", 'const bundle = testModules')
        .replace('editorHandlers.latex = latexHandler', 'editorHandlers.latex = latexHandler; globalThis.testLatexConnect = connectToDoc');
    vm.runInContext(source, context);
    const first = context.testLatexConnect('did:example/latex/old').catch(error => error);
    f.token('new-token'); gate.resolve([]);
    assert.equal((await first).code, 'ExpiredCollabPreparation'); assert.equal(constructed.length, 0);
    await context.testLatexConnect('did:example/latex/new');
    assert.equal(constructed[0].token, 'new-token'); assert.equal(constructed[0].parameters.kvstoreUrl, 'https://identity.invalid');
    assert.equal(constructed[1].parent, f.element);
    f.dispose();
});
