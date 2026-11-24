// Direct, lazy-loaded slide editor; dependencies are shared with Collab.
;(function () {
    const snapshotType = 'application/vnd.clist.slides+json'
    const layoutType = 'application/vnd.clist.slide-layout+json'
    const powerPointType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    let instance = null
    let mounting = null
    let recovery = null
    let ioController = null
    function captureIOSource() {
        if (currentEditor !== 'slides' || !instance) throw new Error('Open Slides before importing or exporting.')
        const state = window.CList.state, storeUrl = window.CList.config.flaskSiteUrl
        return { editor: instance, document: instance.document, root: document.getElementById('slidesDiv'), store: window.CList.pageStore,
            storeUrl, username: state.username, epoch: state.authEpoch, token: getSiteSpecificCookie(storeUrl, window.CList.keys.ACCESS_TOKEN),
            loadId: state.editorLoading?.id, switchId: state.editorSwitching?.id, controlsId: state.editorControls?.id }
    }
    function currentIOSource(source) {
        const state = window.CList.state
        return currentEditor === 'slides' && source.editor === instance && source.document === instance.document
            && source.root?.isConnected && source.root === document.getElementById('slidesDiv') && source.store === window.CList.pageStore
            && source.storeUrl === window.CList.config.flaskSiteUrl && source.username === state.username && source.epoch === state.authEpoch
            && source.token === getSiteSpecificCookie(source.storeUrl, window.CList.keys.ACCESS_TOKEN)
            && source.loadId === state.editorLoading?.id && source.switchId === state.editorSwitching?.id && source.controlsId === state.editorControls?.id
    }
    function slideIO() {
        return ioController ||= createSlidesIOController({
            capture: captureIOSource, current: currentIOSource,
            state: value => { window.CList.state.slidesIO = value },
            sync: (source, merge) => { if (merge) source.editor.addReferences(getReferences()); setReferences(source.editor.getReferences()) },
            closeLoad: () => { if (typeof closeLoadSurfaces === 'function') closeLoadSurfaces() },
            report: callback => setTimeout(callback, 0),
            defer: callback => queueMicrotask(callback), log: error => console.error('[Slides IO]', error),
        }, createSlidesIOView())
    }
    function importPowerPointContent(data, filename) { return slideIO().importBytes(data, filename) }
    window.CList.loaders = window.CList.loaders || []
    window.CList.loaders.push({
        label: 'Recover slides', icon: 'restore', requiresLogin: false, requiresAccount: false,
        visible: () => currentEditor === 'slides' && !!recovery,
        load: async () => { await recovery.show(); return null },
    })
    window.CList.loaders.push({
        label: 'Import PowerPoint', icon: 'slideshow', requiresLogin: false, requiresAccount: false,
        visible: () => currentEditor === 'slides' && !!instance,
        load: async () => { await slideIO().pickImport(); return null },
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
    function importReadContent(content, refs) { return slideIO().content(content, refs) }
    function refreshSavedLayouts() { return slideIO().refresh() }
    let layoutController = null
    function captureLayoutSource() {
        if (currentEditor !== 'slides' || !instance || !window.CList.pageStore) throw new Error('Open Slides before managing saved layouts.')
        const state = window.CList.state, storeUrl = window.CList.config.flaskSiteUrl
        return { editor: instance, document: instance.document, store: window.CList.pageStore,
            savePanelId: state.saving?.panelId, saveNode: document.getElementById('save-options'), saveChild: document.getElementById('save-options')?.firstElementChild,
            storeUrl, username: state.username, epoch: state.authEpoch,
            token: getSiteSpecificCookie(storeUrl, window.CList.keys.ACCESS_TOKEN),
            loadId: state.editorLoading?.id, switchId: state.editorSwitching?.id }
    }
    function layoutSourceCurrent(source) {
        const state = window.CList.state
        return currentEditor === 'slides' && instance === source.editor && instance.document === source.document
            && window.CList.pageStore === source.store && window.CList.config.flaskSiteUrl === source.storeUrl
            && state.username === source.username && state.authEpoch === source.epoch
            && getSiteSpecificCookie(source.storeUrl, window.CList.keys.ACCESS_TOKEN) === source.token
            && state.editorLoading?.id === source.loadId && state.editorSwitching?.id === source.switchId
    }
    function slideLayouts() {
        return layoutController ||= createSlidesLayoutController({
            capture: captureLayoutSource, current: layoutSourceCurrent, view: createSlidesLayoutView,
            state: value => { window.CList.state.slidesLayouts = value; if (value.phase === 'working' || value.receipt === 'accepted') ioController?.invalidateRefresh() },
            register: (source, value) => source.editor.registerSavedLayout(value, { select: true }),
            complete: source => {
                const node = document.getElementById('save-options')
                if (typeof closeRightPane === 'function' && node?.isConnected && node === source.saveNode
                    && node.firstElementChild === source.saveChild && node.style.display !== 'none'
                    && window.CList.state.saving?.panelId === source.savePanelId) closeRightPane()
            },
            status: showStatusMessage, log: error => console.error('[Slides layout]', error),
        })
    }
    function manageLayoutDialog(layout, remove) { return slideLayouts().open(remove ? 'delete' : 'rename', layout) }
    function saveLayoutDialog() {
        try {
            const source = captureLayoutSource()
            const layout = source.editor.createSavedLayout('My slide layout')
            slideLayouts().open('save', layout).catch(error => { console.error('[Slides layout]', error); showStatusMessage('Slide layout could not save: ' + error.message) })
        } catch (error) { console.error('[Slides layout]', error); showStatusMessage('Slide layout could not save: ' + error.message) }
        return { keepOpen: true }
    }
    window.CList.savers = window.CList.savers || []
    for (const [format, label, icon] of [['html', 'Export slides as HTML', 'html'], ['powerpoint', 'Export slides as PowerPoint', 'slideshow'], ['pdf', 'Export slides as PDF', 'picture_as_pdf']]) {
        window.CList.savers.push({ label, icon, requiresLogin: false, requiresAccount: false,
            visible: () => currentEditor === 'slides' && !!instance, save: () => slideIO().export(format) })
    }
    window.CList.savers.push({
        label: 'Save slide as layout', icon: 'dashboard', requiresLogin: false, requiresAccount: false,
        visible: () => currentEditor === 'slides' && !!instance && !!window.CList.pageStore,
        save: saveLayoutDialog,
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
            const titleRow = document.getElementById('write-title-row')
            if (titleRow) titleRow.style.display = 'none'
            if (!instance) {
                try {
                    if (!mounting) {
                        mounting = (async () => {
                            const { mountCListSlides } = await import('../slides/clist-slides-poc/clist.js?v=2026-11-24.19')
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
            if (type === powerPointType) return importPowerPointContent(value)
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
                return slideIO().snapshot(value)
            } catch (error) {
                console.error('Slide snapshot could not load:', error)
                showStatusMessage('Slide snapshot could not load: ' + error.message)
            }
        },
    }
})()
