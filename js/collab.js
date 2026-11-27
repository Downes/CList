//  collab.js  -  TipTap rich-text editor with Hocuspocus real-time collaboration
//  Part of CList, the next generation of learning and connecting with your community
//
//  Copyright Stephen Downes 2025
//  Licensed under Creative Commons Attribution 4.0 International https://creativecommons.org/licenses/by/4.0/
//
//  This software carries NO WARRANTY OF ANY KIND.
//  This software is provided "AS IS," and you, its user, assume all risks when using it.
//
//  js/vendor/collab-editor-bundle.js is a vendored, pre-built bundle of this editor's
//  JS dependencies (TipTap core/starter-kit/collaboration/collaboration-cursor/link,
//  @hocuspocus/provider, yjs) — no CDN is loaded at runtime. To rebuild it after a
//  version bump:
//
//    npm install @tiptap/core@2 @tiptap/starter-kit@2 @tiptap/extension-collaboration@2 \
//      @tiptap/extension-collaboration-cursor@2 @tiptap/extension-link@2 \
//      @hocuspocus/provider@2 yjs@13
//    npx esbuild@0.24.0 entry.js --bundle --format=esm --platform=browser \
//      --minify --outfile=collab-editor-bundle.js
//
//  where entry.js re-exports: Editor (@tiptap/core); StarterKit (@tiptap/starter-kit);
//  Collaboration (@tiptap/extension-collaboration); CollaborationCursor
//  (@tiptap/extension-collaboration-cursor); Link (@tiptap/extension-link);
//  HocuspocusProvider (@hocuspocus/provider); and the whole yjs module namespace as Y.

// Account schema — lets users configure a custom collab server via kvstore
window.CList.schemas = window.CList.schemas || {}
window.CList.schemas['Collab'] = {
    type: 'Collab',
    instanceFromKey: true,
    kvKey: { label: 'WebSocket URL', placeholder: 'wss://collab.mooc.ca' },
    fields: [
        { key: 'title',       label: 'Server name', editable: true, inputType: 'text', placeholder: 'My Collab Server', default: '' },
        { key: 'permissions', label: 'Permissions', editable: true, inputType: 'text', placeholder: 'e',                default: 'e' },
    ]
}

;(function () {

    const COLLAB_WS_URL = window.CList.defaults.COLLAB.replace(/^http/, 'ws')

    // --- Module-level state ---

    let deps               = null  // loaded TipTap / Hocuspocus modules (cached after first load)
    let tiptapEditor       = null
    let hocuspocusProvider = null
    let currentDocId       = null
    let currentDocTitle    = ''
    let currentWsUrl       = COLLAB_WS_URL  // updated each time we connect
    let sharedRefs         = null  // Y.Map synced across all collaborators: url → JSON ref string

    // Capture asynchronous preparation before replacing any live resources.
    let connectionPreparation = null
    function preparationSource() {
        return JSON.stringify([readerSession(), window.CList.state.authEpoch || 0,
            currentEditor, currentEditorAccount, window.CList.accounts || [], window.CList.defaults.COLLAB])
    }
    function getConnectionPreparation() {
        if (!connectionPreparation) connectionPreparation = createCollabConnectionPreparation({
            capture() {
                const session = readerSession()
                return { source: preparationSource(), storeUrl: session.storeUrl, token: session.token,
                    username: session.username || '', color: '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0'),
                    element: document.getElementById('tiptap-editor'), statusElement: document.getElementById('collab-status') }
            },
            current: snapshot => snapshot.source === preparationSource() && !!snapshot.element?.isConnected &&
                document.getElementById('tiptap-editor') === snapshot.element && document.getElementById('collab-status') === snapshot.statusElement,
            server: () => getCollabWsUrl(), load: () => loadDeps(),
            state: value => { window.CList.state.collabPreparation = value }
        })
        return connectionPreparation
    }

    let formatToolbarController = null
    let connectionLifecycle = null
    function getConnectionLifecycle() {
        if (!connectionLifecycle) connectionLifecycle = createCollabConnectionLifecycle({
            source: () => JSON.stringify([readerSession(), window.CList.state.authEpoch || 0]),
            targetCurrent: target => !!target.element?.isConnected && document.getElementById('tiptap-editor') === target.element,
            visible: () => currentEditor === 'collab',
            view: (target, rebind = false) => createCollabConnectionView(rebind ? { ...target, statusElement: document.getElementById('collab-status') } : target),
            clearReferences: () => setReferences([]),
            pushReference: reference => { if (typeof pushReference === 'function') pushReference(reference) },
            install(resources) {
                if (!resources) { formatToolbarController?.dispose(); formatToolbarController = null }
                tiptapEditor = resources?.editor || null
                hocuspocusProvider = resources?.provider || null
                sharedRefs = resources?.map || null
                currentDocId = resources?.target.docId || null
                if (resources?.target.wsUrl) currentWsUrl = resources.target.wsUrl
                if(typeof notifyEditorSharingChanged==='function')notifyEditorSharingChanged()
            },
            ready: () => buildFormatToolbar(),
            schedule: (callback, delay) => setTimeout(callback, delay), clear: timer => clearTimeout(timer),
            state: value => { window.CList.state.collabConnection = value }
        })
        return connectionLifecycle
    }

    // --- Load vendored dependencies lazily ---
    // Bundled locally (see header comment) so Y.Doc instances are shared and no
    // runtime CDN fetch can fail or go down.

    async function loadDeps() {
        if (deps) return deps
        const bundle = await import('./vendor/collab-editor-bundle.js')
        deps = {
            Editor:               bundle.Editor,
            StarterKit:           bundle.StarterKit,
            Collaboration:        bundle.Collaboration,
            CollaborationCursor:  bundle.CollaborationCursor,
            Link:                 bundle.Link,
            HocuspocusProvider:   bundle.HocuspocusProvider,
            Y:                    bundle.Y,
        }
        return deps
    }

    // --- Account config: resolve WebSocket URL from kvstore ---

    async function getCollabWsUrl() {
        try {
            const accts = (Array.isArray(window.CList.accounts) && window.CList.accounts.length)
                ? window.CList.accounts
                : await getAccounts(window.CList.config.flaskSiteUrl)
            const found = findAccountByType('Collab', { accounts: accts })
            if (found && found.parsedValue.instance) return found.parsedValue.instance
        } catch (e) {
            console.warn('Could not look up Collab account, using default server:', e)
        }
        return COLLAB_WS_URL
    }

    // Return true if str looks like a collab share URL (contains /doc/ path).
    function isCollabUrl(str) {
        try { return new URL(str).pathname.startsWith('/doc/') } catch { return false }
    }

    async function selectCollabOpening(current) {
        if (!current()) return null
        const pending = currentEditor !== 'collab' ? initializeEditor('collab') : null
        const switchId = window.CList.state.editorSwitching?.id
        if (pending && await pending === false) return null
        if (!current() || currentEditor !== 'collab' || switchId !== window.CList.state.editorSwitching?.id) return null
        const element = document.getElementById('tiptap-editor'), account = currentEditorAccount
        return () => currentEditor === 'collab' && currentEditorAccount === account &&
            window.CList.state.editorSwitching?.id === switchId && !!element?.isConnected &&
            document.getElementById('tiptap-editor') === element
    }

    let openingController = null
    function getOpeningController() {
        if (!openingController) openingController = createCollabOpeningController({
            capture: () => JSON.stringify([readerSession(), window.CList.state.authEpoch || 0, window.CList.accounts || []]),
            current: source => source === JSON.stringify([readerSession(), window.CList.state.authEpoch || 0, window.CList.accounts || []]),
            select: selectCollabOpening,
            connect: (target, current) => connectToDoc(target.docId, target.mode, target.server, current),
            state: value => { window.CList.state.collabOpening = value }
        }, createCollabOpeningView((label, title) => { setDocTitle(label); currentDocTitle = title }))
        return openingController
    }
    function openIncomingCollab(kind, input) {
        try { normalizeCollabOpening(kind, input); creationController?.dispose() }
        catch { /* The opening controller owns invalid-input feedback. */ }
        return getOpeningController().open(kind, input)
    }
    function openCollabUrl(href) { return openIncomingCollab('url', href) }
    window.openCollabUrl = openCollabUrl

    // Set the document title in both the collab input and the CList write-title field.
    function setDocTitle(value) {
        const input = document.getElementById('collab-doc-id')
        if (input) input.value = value
        const titleEl = window.CList.ui.view.writeTitle
        if (titleEl) titleEl.textContent = value
    }

    // Strip the namespace prefix from a document ID for display in the title input.
    // "did:key:z6Mk.../my-notes"  →  "my-notes"
    // "stephen@mooc.ca/my-notes"  →  "my-notes"
    // "my-notes"                  →  "my-notes"
    function localPartOf(docId) {
        if (!docId) return ''
        const slash = docId.lastIndexOf('/')
        return slash >= 0 ? docId.slice(slash + 1) : docId
    }

    // Initialize TipTap with a local Y.Doc only (no Hocuspocus) so the editor is
    // immediately usable before the user commits a document title.
    async function initLocalEditor(current = () => true) {
        connectionIntent++
        const prepared = await getConnectionPreparation().prepare({ local: true, current })
        return getConnectionLifecycle().start(prepared)
    }

    // Read the current title input, expand it to a full doc ID, and connect.
    async function connectFromInput(current = () => true) {
        const input = document.getElementById('collab-doc-id')
        const localName = input ? input.value.trim() : ''
        if (!localName) return
        const docId = await expandDocId(localName)
        if (!current()) return
        currentDocTitle = ''
        try {
            await connectToDoc(docId, 'edit', null, current)
            if (current()) setDocTitle(localPartOf(docId))
        } catch (e) {
            if (!current()) return
            console.error('Collab connect error:', e)
            showErrorModal('Connection failed: ' + e.message, { title: 'Collab connection failed' })
        }
    }

    let titleController = null
    function getTitleController() {
        if (titleController?.owned()) return titleController
        titleController?.dispose()
        const view = createCollabTitleView()
        if (!view.alive()) return null
        const source = JSON.stringify([readerSession(), window.CList.state.authEpoch || 0, currentEditorAccount, window.CList.accounts || [], window.CList.defaults.COLLAB])
        titleController = createCollabTitleController({
            current: () => currentEditor === 'collab' && source === JSON.stringify([readerSession(), window.CList.state.authEpoch || 0, currentEditorAccount, window.CList.accounts || [], window.CList.defaults.COLLAB]),
            capture: () => ({ token: readerSession().token }), editor: () => tiptapEditor, currentDocId: () => currentDocId,
            inspect: (text, snapshot, assertCurrent) => inspectCollabTitle(text, snapshot, { assertCurrent,
                expand: expandDocId, server: getCollabWsUrl, restBase: wsUrlToRestBase, fetch: (...args) => fetch(...args) }),
            hasContent: () => !!tiptapEditor?.getText().trim(), shortId: localPartOf,
            open: (target, current) => { currentDocTitle = ''; return connectToDoc(target.docId, 'edit', target.wsUrl, current) },
            connectNew: current => connectFromInput(current), openUrl: openCollabUrl, isUrl: isCollabUrl,
            schedule: (callback, delay) => setTimeout(callback, delay), clear: timer => clearTimeout(timer),
            state: value => { window.CList.state.collabTitle = value }
        }, view)
        return titleController
    }

    // --- Formatting toolbar ---

    function buildFormatToolbar() {
        if (formatToolbarController?.owned()) { formatToolbarController.refresh(); return }
        formatToolbarController?.dispose(); formatToolbarController = null
        const editor = tiptapEditor, view = createCollabFormatView()
        if (!editor || !view.alive()) return
        const source = JSON.stringify([readerSession(), window.CList.state.authEpoch || 0, currentEditorAccount])
        formatToolbarController = createCollabFormatController({ editor,
            current: () => tiptapEditor === editor && currentEditor === 'collab' && source === JSON.stringify([readerSession(), window.CList.state.authEpoch || 0, currentEditorAccount]),
            state: value => { window.CList.state.collabFormatting = value }
        }, view)
    }

    // --- Social: "who's here" awareness list ---

    function updateWhoList() { connectionLifecycle?.refresh() }

    // --- Sharing helpers ---

    function getCollabShareLink(mode) {
        return getRealtimeDocShareLink(currentWsUrl, currentDocId, mode)
    }

    function captureShareTarget() {
        if (!connectionLifecycle?.owned() || !currentDocId) throw Error('Join a document first before sharing.')
        const session = readerSession()
        return { docId: currentDocId, server: currentWsUrl, title: currentDocTitle || currentDocId,
            inviteTitle: currentDocTitle || localPartOf(currentDocId), token: session.token,
            source: JSON.stringify([session, window.CList.state.authEpoch || 0]), editor: tiptapEditor,
            element: document.getElementById('tiptap-editor'),
            discussion: typeof activeDiscussionName !== 'undefined' ? activeDiscussionName : null,
            chatOwner: typeof _p2pSession !== 'undefined' ? _p2pSession : null,
            links: { edit: getCollabShareLink('edit'), read: getCollabShareLink('read') } }
    }
    function shareDependencies(target) {
        const contextCurrent = () => target.source === JSON.stringify([readerSession(), window.CList.state.authEpoch || 0]) &&
            currentDocId === target.docId && currentWsUrl === target.server && tiptapEditor === target.editor &&
            target.element?.isConnected && document.getElementById('tiptap-editor') === target.element
        return {
            current: () => contextCurrent() && currentEditor === 'collab', contextCurrent,
            writeKey: JSON.stringify([target.source, target.server, target.docId]),
            read: (captured, assertCurrent) => readCollabAccess(captured, { assertCurrent, restBase: wsUrlToRestBase, fetch: (...args) => fetch(...args) }),
            write: (captured, value, operation, assertCurrent) => writeCollabAccess(captured, value, operation, { assertCurrent, restBase: wsUrlToRestBase, fetch: (...args) => fetch(...args) }),
            link: mode => target.links[mode],
            copy: (link, isCurrent) => copyToClipboard(link, { successMsg: 'Link copied to clipboard.', isCurrent }),
            chatCurrent: () => !!target.discussion && target.discussion === (typeof activeDiscussionName !== 'undefined' ? activeDiscussionName : null) &&
                target.chatOwner === (typeof _p2pSession !== 'undefined' ? _p2pSession : null),
            chat: invite => typeof window.sendCollabInvite === 'function' && window.sendCollabInvite(invite),
            post: captured => window.openCollabSharePost(captured.mode, captured),
            state: value => { window.CList.state.collabSharing = value }
        }
    }
    function directShareAction(action, mode) {
        try {
            const target = captureShareTarget()
            return createCollabShareActions(target, shareDependencies(target), {
                status: showStatusMessage,
                error: error => { console.error('Collab share action failed:', error); showStatusMessage(error.message || String(error)) }
            })[action](mode)
        } catch (error) { console.error('Collab share action failed:', error); showStatusMessage(error.message || String(error)); return false }
    }
    window.copyCollabLink = mode => directShareAction('copy', mode)
    window.shareCollabViaChat = mode => directShareAction('chat', mode)

    // Open an overlay editor above the collab pane so the user can compose a message
    // containing the share link and post it to any configured account via playPost().
    window.openCollabSharePost = function(mode, captured = null) {
        try {
            if (captured && !captured.current()) return false
            if (!['collab', 'collab-share'].includes(currentEditor) && captured?.editorType !== currentEditor) return false
            const target = captured || (() => { const value = captureShareTarget(); return { ...value, mode, link: value.links[mode], current: shareDependencies(value).contextCurrent } })()
            let previous = null
            return openCollabComposer(target, {
                install(handler) {
                    previous = { editor:currentEditor, account:currentEditorAccount, switchId:window.CList.state.editorSwitching?.id, handler:editorHandlers['collab-share'] }
                    editorHandlers['collab-share'] = handler; currentEditor = 'collab-share'
                    if(typeof refreshEditorShareButton==='function')refreshEditorShareButton()
                },
                owns: handler => currentEditor === 'collab-share' && editorHandlers['collab-share'] === handler &&
                    currentEditorAccount === previous?.account && window.CList.state.editorSwitching?.id === previous?.switchId,
                release(handler) {
                    if (editorHandlers['collab-share'] !== handler) return
                    const restore = currentEditor === 'collab-share' && currentEditorAccount === previous.account && window.CList.state.editorSwitching?.id === previous.switchId
                    if (previous.handler) editorHandlers['collab-share'] = previous.handler; else delete editorHandlers['collab-share']
                    if (restore) currentEditor = previous.editor
                    if(typeof refreshEditorShareButton==='function')refreshEditorShareButton()
                },
                ensureRich: () => ensureTinyMCE(), hasRich: () => typeof tinymce !== 'undefined', init: config => tinymce.init(config),
                schedule: (callback, delay) => setTimeout(callback,delay), clear: timer => clearTimeout(timer),
                getCompletion: () => window._onPostAllComplete, setCompletion: callback => { window._onPostAllComplete = callback },
                publishing: () => !!window.CList.state.publishing?.busy,
                post: () => { if (typeof playPost !== 'function') throw Error('Publishing is unavailable.'); return playPost() },
                state: value => { window.CList.state.collabComposer = value }
            })
        } catch(error) { console.error('Could not open share composer:',error); showStatusMessage(error.message || String(error)); return false }
    }

    async function shareCollabDoc() {
        try { if(typeof openEditorSharing==='function')return await openEditorSharing(editorHandlers.collab.getSharing());const target = captureShareTarget(); return await openCollabSharePanel(target, shareDependencies(target)) }
        catch (error) { console.error('Could not open Collab sharing:', error); showErrorModal(error.message || String(error), { title: 'Could not share document' }) }
    }

    window.shareCollabDoc = shareCollabDoc

    // --- Connect to a collaborative document ---

    let connectionIntent = 0
    async function connectToDoc(docId, mode = 'edit', overrideWsUrl = null, current = () => true) {
        connectionIntent++
        const prepared = await getConnectionPreparation().prepare({ docId, mode, wsUrl: overrideWsUrl, current })
        return getConnectionLifecycle().start(prepared)
    }

    // --- Load handler: browse and open existing collab documents ---

    ;(function () {
        window.CList.loaders = window.CList.loaders || []
        window.CList.loaders.push({
            label:   'Collab documents',
            icon:    'group',
            requiresLogin:   true,
            requiresAccount: false,
            load: async () => openCollabDocuments({
                title: localPartOf,
                open: async (record, wsUrl, current) => {
                    if (!current()) return
                    if (currentEditor !== 'collab') await initializeEditor('collab')
                    if (!current()) return
                    setDocTitle(localPartOf(record.id))
                    currentDocTitle = record.title || ''
                    await connectToDoc(record.id, 'edit', wsUrl)
                    if (current()) closeRightPane()
                }
            })
        })
    })()

    let headerController = null
    function mountCollabHeader(menu) {
        const element = document.getElementById('tiptap-editor')
        const source = JSON.stringify([readerSession(), window.CList.state.authEpoch || 0, currentEditorAccount,
            window.CList.state.editorSwitching?.id, window.CList.accounts || []])
        return createCollabHeaderController({
            current: () => currentEditor === 'collab' && element?.isConnected && document.getElementById('tiptap-editor') === element &&
                source === JSON.stringify([readerSession(), window.CList.state.authEpoch || 0, currentEditorAccount,
                    window.CList.state.editorSwitching?.id, window.CList.accounts || []]),
            capture: () => ({ target: currentDocId ? captureShareTarget() : null,
                name: document.getElementById('collab-doc-id')?.value.trim() || '', editor: tiptapEditor, intent: connectionIntent }),
            targetCurrent: target => shareDependencies(target).contextCurrent(), now: () => new Date().toISOString(),
            async ensure(snapshot, current) {
                if (!snapshot.name) throw Error('Enter a document title before sharing.')
                const docId = await expandDocId(snapshot.name)
                const unchanged = () => current() && snapshot.name === document.getElementById('collab-doc-id')?.value.trim()
                if (!unchanged() || snapshot.editor !== tiptapEditor || snapshot.intent !== connectionIntent) return null
                const resource = await connectToDoc(docId, 'edit', null, unchanged)
                if (!current() || tiptapEditor !== resource.editor || currentDocId !== docId) return null
                currentDocTitle = ''; setDocTitle(localPartOf(docId)); return captureShareTarget()
            },
            share: target => openCollabSharePanel(target, shareDependencies(target)),
            reference: reference => { if (typeof pushReference === 'function') return pushReference(reference) },
            load: () => { if (typeof loadContent === 'function') return loadContent({ type: 'text/plain', value: '' }, null) },
            state: value => { window.CList.state.collabHeader = value }
        }, createCollabHeaderView(menu))
    }

    let contentController = null
    function getContentController() {
        if (!contentController) contentController = createCollabContentController({
            capture: () => ({ editor: tiptapEditor, map: sharedRefs, docId: currentDocId,
                container: document.getElementById('collabDiv'), element: document.getElementById('tiptap-editor'),
                source: preparationSource(), switchId: window.CList.state.editorSwitching?.id }),
            current: target => currentEditor === 'collab' && target.source === preparationSource() &&
                target.switchId === window.CList.state.editorSwitching?.id && target.editor === tiptapEditor &&
                target.map === sharedRefs && target.docId === currentDocId && !!target.container && !!target.element &&
                document.getElementById('collabDiv') === target.container && document.getElementById('tiptap-editor') === target.element &&
                !!connectionLifecycle?.owned(),
            reference: itemId => itemId ? document.getElementById(itemId)?.reference : null,
            push: reference => pushReference(reference), replace: references => setReferences(references),
            state: value => { window.CList.state.collabContent = value }
        }, createCollabContentView())
        return contentController
    }

    let mountController = null
    function mountSource() {
        return JSON.stringify([preparationSource(), window.CList.state.editorSwitching?.id])
    }
    function getMountController() {
        if (!mountController) mountController = createCollabMountController({
            capture: () => ({ source: mountSource(), pane: window.CList.ui.view.writePaneContent }),
            current: snapshot => currentEditor === 'collab' && snapshot.source === mountSource() &&
                snapshot.pane === window.CList.ui.view.writePaneContent,
            view: snapshot => createCollabMountView(snapshot.pane),
            controls() {
                titleController?.dispose(); titleController = null
                headerController?.dispose(); headerController = null
                const menu = document.getElementById('editor-menu')
                if (menu) headerController = mountCollabHeader(menu)
                getTitleController()
            },
            intent: () => connectionIntent, load: () => loadDeps(),
            resource() { connectionLifecycle?.owned(); return { editor: tiptapEditor, docId: currentDocId } },
            shortId: localPartOf, slug: generateDocSlug, local: current => initLocalEditor(current),
            rebind() { connectionLifecycle?.rebind(); buildFormatToolbar() },
            predefined: () => loadPredefinedContent('collab'), drop: event => window._attributeDroppedContent(event),
            state: value => { window.CList.state.collabMount = value }
        })
        return mountController
    }

    // --- editorHandlers entry ---

    const collabHandler = {
        label:           'Collab',
        icon:            'group',
        contentTypes:    ['text/html'],
        requiresAccount: false,
        visible:         () => typeof isRegistered === 'function' && isRegistered(),

        initialize: () => {
            currentEditor = 'collab'
            return getMountController().activate()
        },

        getContent: async () => {
            if (!tiptapEditor) return ''
            return tiptapEditor.getHTML()
        },

        // Which document (if any) this handler is currently connected to — used by
        // editors.js's editor-switch state park/restore to recognize "still the same
        // live document" and resync references from the Y.Map instead of restoring a
        // stale local snapshot. null when not connected (e.g. local-only, pre-title).
        getSharing: () => {if(!connectionLifecycle?.owned()||!currentDocId)return null;const target=captureShareTarget();return {docId:target.docId,server:target.server,title:target.title,discussion:target.discussion,chatOwner:target.chatOwner,current:shareDependencies(target).contextCurrent};},
        getDocId: () => currentDocId,

        // Shared references remain authoritative when this document is reactivated.
        resyncReferences: () => getContentController().resync(),
        loadContent: (content, itemId) => getContentController().load(content, itemId),
        insertLink: input => getContentController().link(input),
        insertLinkVia: input => getContentController().via(input),
    }

    if (typeof editorHandlers !== 'undefined') {
        editorHandlers.collab = collabHandler
    } else {
        console.error('editorHandlers is not defined — collab.js must load after editors.js')
    }

    // Intercept clicks on collab share links anywhere in the feed or chat.
    document.addEventListener('click', (e) => {
        const a = e.target.closest('a[href]')
        if (!a) return
        if (isCollabUrl(a.href)) {
            e.preventDefault()
            openCollabUrl(a.href)
        }
    })

    let creationController = null
    function creationSource(kind) {
        return JSON.stringify([readerSession(), window.CList.state.authEpoch || 0, window.CList.accounts || [],
            kind === 'chat' && typeof activeDiscussionName !== 'undefined' ? activeDiscussionName : null])
    }
    function getCreationController() {
        if (!creationController) creationController = createCollabCreationController({
            prepare: (kind, input) => prepareCollabCreation(kind, input, {
                slug: name => slugify(name, { maxLength: 40, fallback: generateDocSlug() }), now: () => new Date()
            }),
            before: () => openingController?.dispose(),
            capture: kind => ({ key: creationSource(kind), invite: window.sendCollabInvite }),
            current: (source, kind) => source.key === creationSource(kind),
            select: selectCollabOpening, intent: () => connectionIntent, expand: slug => expandDocId(slug),
            async connect(docId, current) {
                const resource = await connectToDoc(docId, 'edit', null, current)
                return { resource, editor: resource.editor, docId, server: resource.target.wsUrl }
            },
            resourceCurrent: target => !!target?.editor && tiptapEditor === target.editor && currentDocId === target.docId &&
                currentWsUrl === target.server && !target.resource.closed && getConnectionLifecycle().owned(),
            invite: (source, packet) => { if (typeof source.invite === 'function') source.invite(packet) },
            schedule: (callback, delay) => setTimeout(callback, delay), clear: timer => clearTimeout(timer),
            state: value => { window.CList.state.collabCreation = value }
        }, createCollabCreationView((slug, title) => { setDocTitle(slug); currentDocTitle = title }))
        return creationController
    }
    window.openCollabWithCollection = (name, items) => getCreationController().create('collection', { name, items })
    window.openCollabFromChat = (html, name) => getCreationController().create('chat', { html, name })

    // Called by chat invite cards — switches to Collab editor and connects.
    window.openCollabInvite = invite => openIncomingCollab('invite', invite)

})()
