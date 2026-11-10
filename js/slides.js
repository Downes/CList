// Direct, lazy-loaded slide editor; dependencies are shared with Collab.
;(function () {
    const snapshotType = 'application/vnd.clist.slides+json'
    const layoutType = 'application/vnd.clist.slide-layout+json'
    const powerPointType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    let instance = null
    let mounting = null
    let recovery = null
    let exportingPowerPoint = false
    let importingPowerPoint = false

    function importError(error) {
        console.error('Slides PowerPoint import failed:', error)
        showErrorModal('Could not import PowerPoint: ' + error.message + ' Your existing slides have been kept.', { title: 'PowerPoint import failed' })
    }
    async function importPowerPointContent(data, filename) {
        if (importingPowerPoint) { showStatusMessage('A PowerPoint import is already running.'); return }
        importingPowerPoint = true
        try {
            showStatusMessage('Reading PowerPoint presentation...')
            const result = await instance.importPowerPoint(data, filename)
            if (typeof closeLoadSurfaces === 'function') closeLoadSurfaces()
            if (result.warnings.length) {
                const body = document.createElement('div'), summary = document.createElement('p'), list = document.createElement('ul')
                summary.textContent = result.count + ' slides added after your existing presentation. Use Undo to remove the import. The following content could not be reproduced exactly:'
                for (const warning of result.warnings) {
                    const item = document.createElement('li'); item.textContent = warning; list.append(item)
                }
                body.append(summary, list)
                buildDialogModal('PowerPoint import report', body, [{ label: 'Close', onClick: close => close() }])
            } else showStatusMessage(result.count + ' PowerPoint slides added. Use Undo to remove the import.')
        } catch (error) { importError(error) }
        finally { importingPowerPoint = false }
    }
    window.CList.loaders = window.CList.loaders || []
    window.CList.loaders.push({
        label: 'Recover slides', icon: 'restore', requiresLogin: false, requiresAccount: false,
        visible: () => currentEditor === 'slides' && !!recovery,
        load: async () => { await recovery.show(); return null },
    })
    window.CList.loaders.push({
        label: 'Import PowerPoint', icon: 'slideshow', requiresLogin: false, requiresAccount: false,
        visible: () => currentEditor === 'slides' && !!instance,
        load: async () => {
            try {
                let file
                if (window.showOpenFilePicker) {
                    const [handle] = await window.showOpenFilePicker({ types: [{ description: 'PowerPoint presentation', accept: { [powerPointType]: ['.pptx'] } }], multiple: false })
                    file = await handle.getFile()
                } else {
                    file = await new Promise(resolve => {
                        const input = document.createElement('input')
                        input.type = 'file'; input.accept = '.pptx'; input.hidden = true
                        const finish = value => { input.remove(); resolve(value) }
                        input.addEventListener('change', () => finish(input.files[0] || null), { once: true })
                        input.addEventListener('cancel', () => finish(null), { once: true })
                        document.body.append(input); input.click()
                    })
                }
                if (!file) return null
                if (!/\.pptx$/i.test(file.name)) throw new Error('Choose a .pptx file. Legacy .ppt files are not supported.')
                if (file.size > 100 * 1024 * 1024) throw new Error('Choose a .pptx file smaller than 100 MB.')
                await importPowerPointContent(await file.arrayBuffer(), file.name)
            } catch (error) { if (error.name !== 'AbortError') importError(error) }
            return null
        },
    })

    function syncSlideReferences() {
        if (instance && currentEditor === 'slides') setReferences(instance.getReferences())
    }
    function readPaneReferences(itemId) {
        if (!itemId) return []
        const source = itemId === 'thread' || itemId === 'feed-container' ? window.CList.ui.view.feedContainer : document.getElementById(itemId)
        if (!source) return []
        return [source, ...source.querySelectorAll('[id]')].map(node => node.reference).filter(Boolean)
    }
    function importReadContent(content, refs) {
        if (!instance) throw new Error('Open Slides before importing content.')
        const id = instance.importContent(content, refs)
        syncSlideReferences()
        return id
    }
    async function refreshSavedLayouts() {
        if (!instance || !window.CList.pageStore) return
        try {
            const records = await window.CList.pageStore.list()
            for (const record of records.filter(entry => entry.contentType === layoutType)) {
                try {
                    const saved = await window.CList.pageStore.get(record.id)
                    if (saved) instance.registerSavedLayout(JSON.parse(saved.content))
                } catch (error) {
                    console.error('Saved slide layout could not load:', error)
                    showStatusMessage('A saved slide layout could not load: ' + error.message)
                }
            }
        } catch (error) {
            console.error('Saved slide layouts are unavailable:', error)
            showStatusMessage('Saved slide layouts are unavailable: ' + error.message)
        }
    }
    function manageLayoutDialog(layout, remove) {
        return new Promise(resolve => {
            const body = document.createElement('div')
            const name = document.createElement('input')
            name.type = 'text'
            name.maxLength = 120
            name.value = layout.label
            if (remove) {
                const description = document.createElement('p')
                description.textContent = 'Remove “' + layout.label + '” from your saved layouts?'
                body.append(description)
            } else {
                const label = document.createElement('label')
                label.textContent = 'Layout name'
                label.append(name)
                body.append(label)
            }
            const message = document.createElement('p')
            message.className = 'error-message'
            message.hidden = true
            body.append(message)
            const dialog = buildDialogModal(remove ? 'Delete saved layout' : 'Rename saved layout', body, [
                { label: 'Cancel', secondary: true, onClick: close => { close(); resolve(null) } },
                { label: remove ? 'Delete layout' : 'Rename layout', onClick: async close => {
                    const title = name.value.trim()
                    if (!remove && (!title || title.length > 120)) {
                        message.textContent = 'Enter a layout name of 1–120 characters.'
                        message.hidden = false
                        return
                    }
                    dialog.buttons.forEach(button => { button.disabled = true })
                    message.hidden = true
                    try {
                        const record = await window.CList.pageStore.get(layout.id)
                        if (!record || record.contentType !== layoutType) throw new Error('This saved layout is no longer available.')
                        let result = true
                        if (remove) await window.CList.pageStore.remove(layout.id)
                        else {
                            const value = JSON.parse(record.content)
                            if (value.format !== 'clist-slide-layout-v1' || value.id !== layout.id) throw new Error('This saved layout is invalid.')
                            result = { ...value, label: title }
                            await window.CList.pageStore.save({ ...record, title, content: JSON.stringify(result), revision: record.revision })
                        }
                        close()
                        showStatusMessage(remove ? 'Saved layout deleted.' : 'Saved layout renamed.')
                        resolve(result)
                    } catch (error) {
                        console.error('Saved layout could not ' + (remove ? 'delete' : 'rename') + ':', error)
                        message.textContent = 'Could not ' + (remove ? 'delete' : 'rename') + ' layout: ' + error.message
                        message.hidden = false
                    } finally { dialog.buttons.forEach(button => { button.disabled = false }) }
                } },
            ])
            if (!remove) { name.focus(); name.select() }
        })
    }
    window.CList.savers = window.CList.savers || []
    window.CList.savers.push({
        label: 'Export slides as HTML', icon: 'html', requiresLogin: false, requiresAccount: false,
        visible: () => currentEditor === 'slides' && !!instance,
        save: async () => {
            try { await instance.exportHtml(); showStatusMessage('HTML presentation downloaded.') }
            catch (error) {
                console.error('Slides HTML export failed:',error)
                showErrorModal('Could not export slides as HTML: '+error.message,{title:'HTML export failed'})
            }
        },
    })
    window.CList.savers.push({
        label: 'Export slides as PowerPoint',
        icon: 'slideshow',
        requiresLogin: false,
        requiresAccount: false,
        visible: () => currentEditor === 'slides' && !!instance,
        save: async () => {
            if (exportingPowerPoint) { showStatusMessage('PowerPoint export is already running.'); return }
            exportingPowerPoint = true
            showStatusMessage('Preparing PowerPoint export...')
            try {
                const warnings = await instance.exportPowerPoint()
                showStatusMessage('PowerPoint export downloaded.' + (warnings.length ? ' ' + warnings.join(' ') : ''))
            } catch (error) {
                console.error('Slides PowerPoint export failed:', error)
                showStatusMessage('Slides could not export as PowerPoint: ' + error.message)
            } finally { exportingPowerPoint = false }
        },
    })
    window.CList.savers.push({
        label: 'Export slides as PDF',
        icon: 'picture_as_pdf',
        requiresLogin: false,
        requiresAccount: false,
        visible: () => currentEditor === 'slides' && !!instance,
        save: async () => {
            try { await instance.exportPdf() }
            catch (error) {
                console.error('Slides PDF export failed:', error)
                showStatusMessage('Slides could not export as PDF: ' + error.message)
            }
        },
    })
    window.CList.savers.push({
        label: 'Save slide as layout',
        icon: 'dashboard',
        requiresLogin: false,
        requiresAccount: false,
        visible: () => currentEditor === 'slides' && !!instance && !!window.CList.pageStore,
        save: () => {
            try {
                const layout = instance.createSavedLayout('My slide layout')
                const body = document.createElement('div')
                const label = document.createElement('label')
                label.textContent = 'Layout name'
                const name = document.createElement('input')
                name.type = 'text'
                name.maxLength = 120
                name.value = layout.label
                label.appendChild(name)
                const description = document.createElement('p')
                description.textContent = 'Preserves this slide’s objects, text, images, background, and notes.'
                const message = document.createElement('p')
                message.className = 'error-message'
                message.hidden = true
                body.append(label, description, message)
                const dialog = buildDialogModal('Save slide as layout', body, [
                    { label: 'Cancel', secondary: true, onClick: close => close() },
                    { label: 'Save layout', onClick: async close => {
                        const title = name.value.trim()
                        if (!title || title.length > 120) {
                            message.textContent = 'Enter a layout name of 1–120 characters.'
                            message.hidden = false
                            return
                        }
                        dialog.buttons.forEach(button => { button.disabled = true })
                        message.hidden = true
                        try {
                            const value = { ...layout, label: title }
                            await window.CList.pageStore.save({ id: value.id, title, content: JSON.stringify(value), contentType: layoutType, editorType: 'slides', references: [] })
                            instance.registerSavedLayout(value, { select: true })
                            close()
                            if (typeof closeRightPane === 'function') closeRightPane()
                            showStatusMessage('Slide layout saved. Choose it under New slide layout.')
                        } catch (error) {
                            console.error('Slide layout could not save:', error)
                            message.textContent = 'Slide layout could not save: ' + error.message
                            message.hidden = false
                        } finally { dialog.buttons.forEach(button => { button.disabled = false }) }
                    } },
                ])
                name.focus()
                name.select()
            } catch (error) {
                console.error('Slide layout could not open for saving:', error)
                showStatusMessage('Slide layout could not save: ' + error.message)
            }
            return { keepOpen: true }
        },
    })

    editorHandlers.slides = {
        label: 'Slides',
        icon: 'slideshow',
        contentTypes: [snapshotType, layoutType, powerPointType],
        fileExtension: 'json',
        requiresAccount: false,
        initialize: async () => {
            const loadingContent = !!pendingContent
            let offerRecovery = false
            let container = document.getElementById('slidesDiv')
            if (!container) {
                container = document.createElement('div')
                container.id = 'slidesDiv'
                container.className = 'editor'
                window.CList.ui.view.writePaneContent.appendChild(container)
            }
            container.style.display = 'block'
            if (!instance) {
                try {
                    if (!mounting) {
                        mounting = (async () => {
                            const { mountCListSlides } = await import('../slides/clist-slides-poc/clist.js?v=2')
                            const { createSlideRecovery } = await import('./slides-recovery.js?v=4')
                            const editor = await mountCListSlides(container, { autoConnect: false, presentationTitle: () => window.CList.ui.view.writeTitle?.textContent.trim() || '', onStatus: showStatusMessage, onChange: () => recovery?.changed(), onReferencesChange: refs => { if (currentEditor === 'slides') setReferences(refs) }, onSaveLayout: () => window.CList.savers.find(saver => saver.label === 'Save slide as layout').save(), onRenameSavedLayout: layout => manageLayoutDialog(layout, false), onDeleteSavedLayout: layout => manageLayoutDialog(layout, true) })
                            recovery = createSlideRecovery({ editor, store: window.CList.pageStore, report: showStatusMessage, showError: showErrorModal,
                                showDialog: body => buildDialogModal('Recover slides', body, [{ label: 'Close', onClick: close => close() }]).close })
                            offerRecovery = true
                            return editor
                        })()
                    }
                    instance = await mounting
                } catch (error) {
                    console.error('Slides initialization failed:', error)
                    container.replaceChildren()
                    showServiceError(container, 'Slides could not open', error.message)
                    throw error
                } finally {
                    mounting = null
                }
            }
            currentEditor = 'slides'
            await refreshSavedLayouts()
            await loadPredefinedContent('slides')
            // Callers close their own Load/editor-switch surfaces after awaiting
            // initialization. Offer recovery in the next task, after that cleanup.
            // An explicit file load takes precedence; recovery remains in Load.
            if (offerRecovery && !loadingContent) {
                setTimeout(() => {
                    if (currentEditor === 'slides') recovery.start().catch(error => {
                        console.error('Slides recovery could not open:', error)
                        showErrorModal('Could not open slide recovery: ' + error.message, { title: 'Slides recovery failed' })
                    })
                }, 0)
            }
        },
        getDocId: () => instance ? 'slides' : null,
        resyncReferences: syncSlideReferences,
        getPublishContent: async () => ({type:'text/html',value:instance ? await instance.getHtml() : ''}),
        getPostContent: async () => instance ? await instance.getArticleHtml() : '',
        getContent: () => {
            if (!instance) return ''
            instance.addReferences(getReferences())
            syncSlideReferences()
            return JSON.stringify(instance.snapshot())
        },
        insertLink: ({ content, entryUrl, feedTitle, reference }) => {
            try { importReadContent(content, [reference || { url: entryUrl, title: feedTitle }]) }
            catch (error) { showStatusMessage('Could not import into Slides: ' + error.message) }
        },
        insertLinkVia: ({ content, linkedUrl, linkedTitle, entryUrl, authorOrFeedTitle, reference }) => {
            try { importReadContent(content, [reference || { url: linkedUrl, title: linkedTitle }, { url: entryUrl, title: authorOrFeedTitle }]) }
            catch (error) { showStatusMessage('Could not import into Slides: ' + error.message) }
        },
        loadContent: ({ type, value }, itemId) => {
            if (!instance) return
            if (type === powerPointType) { importPowerPointContent(value).catch(importError); return }
            try {
                if (type === layoutType) {
                    instance.registerSavedLayout(typeof value === 'string' ? JSON.parse(value) : value)
                    showStatusMessage('Layout added to the New slide layout picker.')
                    return
                }
                if (type === 'text/html' || type === 'text/plain') {
                    importReadContent({ type, value }, readPaneReferences(itemId))
                    return
                }
                if (type !== snapshotType) throw new Error('Slides requires a CList slide snapshot or text content.')
                instance.loadSnapshot(typeof value === 'string' ? JSON.parse(value) : value)
                queueMicrotask(() => { if (currentEditor === 'slides') { instance.addReferences(getReferences()); syncSlideReferences() } })
                showStatusMessage('Slide snapshot loaded.')
            } catch (error) {
                console.error('Slide snapshot could not load:', error)
                showStatusMessage('Slide snapshot could not load: ' + error.message)
            }
        },
    }
})()
