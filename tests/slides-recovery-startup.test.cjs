const { test } = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const vm = require('node:vm')

function setup(loading = false) {
    const source = readFileSync('js/slides.js', 'utf8')
    const start = source.indexOf('initialize: async () => {') + 'initialize: '.length
    let initialize = source.slice(start, source.indexOf('\n        getDocId:', start)).trim().replace(/,$/, '')
    initialize = initialize.replace("await import('../slides/clist-slides-poc/clist.js')", 'await editorModule()')
        .replace(/await import\('\.\/slides-recovery\.js\?v=\d+'\)/, 'await recoveryModule()')
    const timers = [], errors = [], container = { style: {} }
    const context = vm.createContext({
        pendingContent: loading ? { type: 'file', value: 'presentation' } : null,
        instance: null, mounting: null, recovery: null, currentEditor: 'text', modal: 'load-dialog',
        document: { getElementById: () => container },
        window: { CList: { pageStore: {}, savers: [] } },
        editorModule: async () => ({ mountCListSlides: async () => ({}) }),
        recoveryModule: async () => ({ createSlideRecovery: () => ({ start: async () => { context.modal = 'recovery-dialog' } }) }),
        refreshSavedLayouts: async () => {}, loadPredefinedContent: async () => { context.pendingContent = null },
        showStatusMessage() {}, showErrorModal: error => errors.push(error),
        setTimeout: callback => timers.push(callback), console,
    })
    vm.runInContext('this.initialize = ' + initialize, context)
    return { context, timers, errors }
}

test('startup recovery opens after the calling Load flow has closed its dialog', async () => {
    const s = setup()
    await s.context.initialize()
    assert.equal(s.context.modal, 'load-dialog', 'initialization does not open recovery prematurely')
    assert.equal(s.timers.length, 1)
    s.context.modal = null // The caller's post-initialization cleanup.
    s.timers.shift()()
    assert.equal(s.context.modal, 'recovery-dialog', 'recovery survives that cleanup')
    await s.context.initialize()
    assert.equal(s.timers.length, 0, 're-entering a mounted editor does not reopen the prompt')
})

test('explicit file loading and switching away do not show a competing recovery dialog', async () => {
    const loading = setup(true)
    await loading.context.initialize()
    assert.equal(loading.timers.length, 0)
    const switched = setup()
    await switched.context.initialize()
    switched.context.currentEditor = 'text'
    switched.timers.shift()()
    assert.equal(switched.context.modal, 'load-dialog')
})
