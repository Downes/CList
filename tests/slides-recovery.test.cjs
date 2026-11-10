const { test } = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const vm = require('node:vm')

function setup(records = []) {
    class Element {
        children = []; events = {}; textContent = ''; className = ''
        append(...nodes) { nodes.forEach(node => { node.parent = this; this.children.push(node) }) }
        prepend(node) { node.parent = this; this.children.unshift(node) }
        replaceChildren(...nodes) { this.children = []; this.append(...nodes) }
        remove() { this.parent.children = this.parent.children.filter(node => node !== this) }
        setAttribute() {}
        addEventListener(name, callback) { this.events[name] = callback }
        removeEventListener(name) { delete this.events[name] }
    }
    const document = new Element(), window = new Element(), container = new Element()
    document.createElement = () => new Element()
    const timers = new Map(), reports = [], errors = [], writes = [], rows = new Map(records.map(row => [row.id, row]))
    let choices, dialogOpen = false
    let serial = 0, timerId = 0, state = 'initial', controller
    const store = {
        async list() { return [...rows.values()] },
        async get(id) { return rows.get(id) },
        async remove(id) { rows.delete(id) },
        async save(page) {
            const old = rows.get(page.id)
            if (page.revision !== undefined && page.revision !== old?.revision) throw Object.assign(new Error('Conflict'), { code: 'RevisionConflict' })
            const row = { ...page, revision: (old?.revision || 0) + 1, updatedAt: new Date().toISOString() }
            rows.set(row.id, row); writes.push(row); return row
        },
    }
    const editor = {
        snapshot() { controller.changed(); return { format: 'clist-slides-yjs-v1', update: state } },
        getReferences() { return [{ url: 'https://example.org/' }] },
        loadSnapshot(snapshot) { state = snapshot.update; controller.changed() },
    }
    const context = vm.createContext({ document, window, console: { error() {} }, crypto: { randomUUID: () => String(++serial) }, Date,
        setTimeout: (callback, delay) => { timers.set(++timerId, { callback, delay }); return timerId }, clearTimeout: id => timers.delete(id) })
    vm.runInContext(readFileSync('js/slides-recovery.js', 'utf8').replace('export function', 'function'), context)
    controller = context.createSlideRecovery({ editor, store, report: value => reports.push(value), showError: value => errors.push(value),
        showDialog: body => { choices = body; dialogOpen = true; return () => { dialogOpen = false } } })
    return { controller, store, editor, container, document, window, timers, reports, errors, writes, rows,
        edit(value) { state = value; controller.changed() }, state: () => state,
        choices: () => choices, dialogOpen: () => dialogOpen }
}
const recovery = { id: 'old', revision: 3, contentType: 'application/vnd.clist.slides-recovery+json', content: JSON.stringify({ update: 'recovered' }), updatedAt: '2026-11-10T12:00:00Z' }
const settle = () => new Promise(resolve => setImmediate(resolve))

test('debounces edits, bounds continuous editing, and saves complete snapshots and references', async () => {
    const s = setup(); await s.controller.start()
    assert.equal(s.writes.length, 0)
    assert.equal(s.container.children.length, 0, 'no recovery strip takes up editor space')
    s.edit('one'); s.edit('two')
    assert.deepEqual([...s.timers.values()].map(timer => timer.delay).sort((a, b) => a - b), [1500, 15000])
    await s.controller.flush()
    assert.equal(s.writes.length, 1)
    assert.equal(JSON.parse(s.writes[0].content).update, 'two')
    assert.equal(s.writes[0].references[0].url, 'https://example.org/')
    assert.equal(s.timers.size, 0)
    assert.equal(s.reports.length, 0, 'routine saves are silent')
    assert.equal(s.dialogOpen(), false)
    s.edit('three'); await s.controller.flush()
    assert.equal(s.writes[1].id, s.writes[0].id)
    assert.equal(s.writes[1].revision, 2)
})
test('restores after preserving current edits and resumes saving the recovered copy', async () => {
    const s = setup([recovery]); await s.controller.start()
    s.edit('current edits')
    s.choices().children[0].children[1].events.click(); await settle()
    assert.equal(s.state(), 'recovered')
    assert.equal(s.dialogOpen(), false, 'restore closes the recovery dialog')
    assert.match(s.reports.at(-1), /Presentation restored/)
    assert.equal(JSON.parse(s.writes[0].content).update, 'current edits')
    s.edit('continued'); await s.controller.flush()
    assert.equal(s.writes[1].id, 'old')
    assert.equal(s.writes[1].revision, 4)
})
test('forks rather than overwriting a recovery copy changed by another tab', async () => {
    const s = setup([recovery]); await s.controller.start()
    s.choices().children[0].children[1].events.click(); await settle()
    s.rows.set('old', { ...recovery, revision: 4 })
    s.edit('my edits'); await s.controller.flush()
    assert.notEqual(s.writes[0].id, 'old')
    assert.equal(s.rows.get('old').revision, 4)
})
test('serializes pending saves and retains edits made during a write', async () => {
    const s = setup(); await s.controller.start()
    const save = s.store.save; let release
    s.store.save = async page => { await new Promise(resolve => { release = resolve }); s.store.save = save; return save(page) }
    s.edit('first'); const pending = s.controller.flush()
    await settle()
    s.edit('second'); release(); await pending
    assert.equal(s.writes.length, 2)
    assert.equal(JSON.parse(s.writes[1].content).update, 'second')
})

test('worker snapshots retain edits made while capture is asynchronous', async () => {
    const s = setup(); await s.controller.start()
    let release, captures = 0
    s.editor.snapshotRecovery = () => {
        const content = JSON.stringify({ update: s.state() }); captures++
        if (captures === 1) return new Promise(resolve => { release = () => resolve(content) })
        return Promise.resolve(content)
    }
    s.editor.snapshot = () => { throw new Error('Must use the background snapshot') }
    s.edit('first'); const pending = s.controller.flush()
    s.edit('second'); release(); await pending
    assert.equal(s.writes.length, 2)
    assert.equal(JSON.parse(s.writes[0].content).update, 'first')
    assert.equal(JSON.parse(s.writes[1].content).update, 'second')
})

test('automatic saves defer follow-up work while editing instead of saving continuously', async () => {
    const s = setup(); await s.controller.start()
    let release
    s.editor.snapshotRecovery = () => new Promise(resolve => { release = () => resolve(JSON.stringify({ update: 'first' })) })
    s.edit('first')
    const pending = s.controller.flush(false)
    s.edit('second'); release(); await pending
    assert.equal(s.writes.length, 1)
    assert.equal(s.timers.size, 2)
    assert.equal(s.reports.length, 0, 'pending autosaves do not post messages')
    s.editor.snapshotRecovery = () => Promise.resolve(JSON.stringify({ update: s.state() }))
    await s.controller.flush()
    assert.equal(JSON.parse(s.writes[1].content).update, 'second')
})

test('failed asynchronous snapshots retain the unsaved-work warning and allow retry', async () => {
    const s = setup(); await s.controller.start()
    s.editor.snapshotRecovery = async () => { throw new Error('Worker unavailable') }
    s.edit('valuable'); s.document.visibilityState = 'hidden'
    s.document.events.visibilitychange(); await settle()
    assert.match(s.errors.at(-1), /Worker unavailable/)
    let warned = false
    s.window.events.beforeunload({ preventDefault() { warned = true } })
    assert.equal(warned, true)
    delete s.editor.snapshotRecovery
    await s.controller.flush()
    assert.equal(JSON.parse(s.writes[0].content).update, 'valuable')
})
test('shows storage failures, warns before leaving, and permits retry', async () => {
    const s = setup(); await s.controller.start()
    const save = s.store.save
    s.store.save = async () => { throw new Error('Quota exceeded') }
    s.edit('valuable'); s.document.visibilityState = 'hidden'
    s.document.events.visibilitychange(); await settle()
    assert.match(s.errors.at(-1), /Quota exceeded/)
    assert.equal(s.errors.length, 1)
    assert.equal(s.reports.length, 0)
    let prevented = false
    s.window.events.beforeunload({ preventDefault() { prevented = true } })
    assert.equal(prevented, true)
    s.store.save = save; await s.controller.flush()
    assert.equal(s.writes.length, 1)
    s.controller.destroy(); assert.equal(s.container.children.length, 0)
})
test('failed restore preserves current presentation; deleting a copy is explicit', async () => {
    const s = setup([recovery]); await s.controller.start()
    s.editor.loadSnapshot = () => { throw new Error('Invalid snapshot') }
    s.choices().children[0].children[1].events.click(); await settle()
    assert.equal(s.state(), 'initial'); assert.match(s.errors.at(-1), /Invalid snapshot/)
    s.choices().children[0].children[2].events.click(); await settle()
    assert.equal(s.rows.has('old'), false)
    assert.equal(s.dialogOpen(), false)
})

test('recovery choices can be reopened from Load without inline messages', async () => {
    const s = setup([recovery]); await s.controller.start()
    assert.equal(s.dialogOpen(), true)
    assert.equal(s.container.children.length, 0)
    await s.controller.show()
    assert.equal(s.dialogOpen(), true)
    assert.equal(s.choices().children.length, 1)
    s.choices().children[0].children[2].events.click(); await settle()
    await s.controller.show()
    assert.equal(s.dialogOpen(), false)
    assert.match(s.reports.at(-1), /No slide recovery copies/)
})
