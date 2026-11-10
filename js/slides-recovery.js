// Local recovery copies are separate from named presentations and personal layouts.
export function createSlideRecovery({ editor, store, report, showError, showDialog }) {
    const contentType = 'application/vnd.clist.slides-recovery+json'
    let id = 'slides-recovery-' + crypto.randomUUID()
    let revision
    let dirty = false, suspended = false, capturing = false, saving = null, choosing = false
    let debounce, deadline
    let closeDialog = null

    function fail(error) {
        console.error('Slides recovery failed:', error)
        showError('Local recovery failed: ' + error.message + '. Use Save to protect your presentation.', { title: 'Slides recovery failed' })
    }
    function clearTimers() { clearTimeout(debounce); clearTimeout(deadline); debounce = deadline = null }
    function schedule() {
        clearTimeout(debounce)
        debounce = setTimeout(() => { flush(false).catch(fail) }, 1500)
        if (!deadline) deadline = setTimeout(() => { flush(false).catch(fail) }, 15000)
    }
    function changed() {
        if (suspended || capturing) return
        dirty = true
        schedule()
    }
    async function flush(drain = true) {
        clearTimers()
        if (saving) { await saving; if (dirty && drain) return flush(); if (dirty) schedule(); return }
        if (!dirty || suspended) return
        saving = (async () => {
            dirty = false
            try {
                // Suppress only synchronous setup notifications, never edits made
                // while the worker is preparing the snapshot.
                capturing = true
                let snapshot
                try { snapshot = editor.snapshotRecovery ? editor.snapshotRecovery() : JSON.stringify(editor.snapshot()) }
                finally { capturing = false }
                const content = await snapshot
                let record
                const page = { id, revision, title: 'Slides recovery', content, contentType, editorType: 'slides', references: editor.getReferences() }
                try { record = await store.save(page) }
                catch (error) {
                    if (error.code !== 'RevisionConflict') throw error
                    // Another tab resumed this copy: preserve both presentations.
                    id = 'slides-recovery-' + crypto.randomUUID()
                    revision = undefined
                    record = await store.save({ ...page, id, revision })
                }
                revision = record.revision
            } catch (error) { dirty = true; throw error }
        })()
        try { await saving } finally { saving = null }
        if (dirty && drain) return flush()
        if (dirty && !debounce) schedule()
    }
    function button(label, action) {
        const node = document.createElement('button')
        node.className = 'btn'
        node.textContent = label
        node.addEventListener('click', () => {
            if (choosing) return
            choosing = true
            node.disabled = true
            Promise.resolve().then(action).catch(fail).finally(() => { node.disabled = false; choosing = false })
        })
        return node
    }
    async function show(silent = false) {
        try {
            if (!store) throw new Error('Local storage is unavailable')
            const records = (await store.list()).filter(record => record.contentType === contentType)
            if (!records.length) { if (!silent) report('No slide recovery copies are available.'); return }
            const choices = document.createElement('div')
            for (const record of records) {
                const row = document.createElement('p')
                const label = document.createElement('span')
                label.textContent = 'Presentation recovery from ' + new Date(record.updatedAt).toLocaleString() + ' '
                const restore = button('Restore', async () => {
                    const saved = await store.get(record.id)
                    if (!saved || saved.contentType !== contentType) throw new Error('This recovery copy is no longer available')
                    const snapshot = JSON.parse(saved.content)
                    await flush() // Preserve edits, including any made while reading storage.
                    suspended = true
                    try {
                        editor.loadSnapshot(snapshot)
                        id = saved.id
                        revision = saved.revision
                        dirty = false
                        clearTimers()
                    } finally { suspended = false }
                    closeDialog?.(); closeDialog = null
                    report('Presentation restored. Automatic local recovery is active.')
                })
                const discard = button('Delete recovery copy', async () => {
                    await store.remove(record.id); row.remove()
                    if (!choices.children.length) { closeDialog?.(); closeDialog = null }
                    report('Recovery copy deleted.')
                })
                discard.className += ' btn-secondary'
                row.append(label, restore, discard)
                choices.append(row)
            }
            closeDialog?.()
            closeDialog = showDialog(choices)
        } catch (error) { fail(error) }
    }
    function onHidden() { if (document.visibilityState === 'hidden') flush().catch(fail) }
    function onPageHide() { flush().catch(fail) }
    function onBeforeUnload(event) {
        if (dirty || saving) { event.preventDefault(); event.returnValue = '' }
    }
    document.addEventListener('visibilitychange', onHidden)
    window.addEventListener('pagehide', onPageHide)
    window.addEventListener('beforeunload', onBeforeUnload)
    return { start: () => show(true), show: () => show(), changed, flush, destroy() {
        clearTimers()
        document.removeEventListener('visibilitychange', onHidden)
        window.removeEventListener('pagehide', onPageHide)
        window.removeEventListener('beforeunload', onBeforeUnload)
        closeDialog?.(); closeDialog = null
    } }
}
