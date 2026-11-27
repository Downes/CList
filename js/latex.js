//  latex.js  -  CodeMirror 6 LaTeX source editor with Hocuspocus real-time collaboration
//  Part of CList, the next generation of learning and connecting with your community
//
//  Copyright Stephen Downes 2026
//  Licensed under Creative Commons Attribution 4.0 International https://creativecommons.org/licenses/by/4.0/
//
//  This software carries NO WARRANTY OF ANY KIND.
//  This software is provided "AS IS," and you, its user, assume all risks when using it.
//
//  Rides on the same collab.mooc.ca Hocuspocus server as collab.js (it only stores
//  opaque Yjs binary state) — a Y.Text bound to CodeMirror 6 instead of collab.js's
//  Y.XmlFragment/TipTap. Doc IDs are namespaced with a "latex/" segment so a LaTeX
//  document never collides with a same-named rich-text document in the server's
//  documents table. Compiling to PDF is handled by a separate microservice
//  (texcompile.mooc.ca) — this file only talks to collab.mooc.ca and texcompile.mooc.ca.
//
//  js/vendor/latex-editor-bundle.js is a vendored, pre-built bundle of this
//  editor's JS dependencies (CodeMirror 6, y-codemirror.next, yjs, @hocuspocus/
//  provider) — no CDN is loaded at runtime. To rebuild it after a version bump:
//
//    npm install @codemirror/state@6 @codemirror/view@6 @codemirror/commands@6 \
//      @codemirror/language@6 @codemirror/legacy-modes@6 y-codemirror.next@0.3 \
//      @hocuspocus/provider@2 yjs@13
//    npx esbuild@0.24.0 entry.js --bundle --format=esm --platform=browser \
//      --minify --outfile=latex-editor-bundle.js
//
//  where entry.js re-exports: EditorState (@codemirror/state); EditorView,
//  keymap, lineNumbers, highlightActiveLine (@codemirror/view); defaultKeymap
//  (@codemirror/commands); StreamLanguage, syntaxHighlighting,
//  defaultHighlightStyle (@codemirror/language); stex
//  (@codemirror/legacy-modes/mode/stex); yCollab, yUndoManagerKeymap
//  (y-codemirror.next); HocuspocusProvider (@hocuspocus/provider); and the
//  whole yjs module namespace as Y.

;(function () {

    const COLLAB_WS_URL = window.CList.defaults.COLLAB.replace(/^http/, 'ws')
    const COMPILE_URL   = 'https://texcompile.mooc.ca/compile'

    // --- Minimal styles, injected once ---

    function injectStyles() {
        if (document.getElementById('latex-styles')) return
        const s = document.createElement('style')
        s.id = 'latex-styles'
        s.textContent = `
            #latexDiv { display: flex; flex-direction: column; height: 100%; position: relative; }
            #latex-doc-picker { display: flex; gap: 6px; align-items: center; }
            #latex-who { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; flex: 1; padding: 0 4px; }
            .latex-user { font-size: 0.75em; white-space: nowrap; }
            #latex-status { font-size: 0.75em; }
            #latex-editor-container { flex: 1; overflow-y: auto; border: 1px solid;
                                       border-radius: 4px; }
            #cm-editor .cm-editor { height: 100%; min-height: 200px; }
            #cm-editor .cm-content { font-family: 'SFMono-Regular', Consolas, Menlo, monospace;
                                      font-size: 0.9em; }
        `
        document.head.appendChild(s)
    }

    // --- Module-level state ---

    let deps               = null  // loaded CodeMirror / Yjs / Hocuspocus modules (cached after first load)
    let cmView              = null
    let hocuspocusProvider = null
    let currentDocId       = null
    let currentDocTitle    = ''
    let currentWsUrl       = COLLAB_WS_URL  // updated each time we connect
    let sharedRefs         = null  // Y.Map synced across all collaborators: url → JSON ref string

    // --- Load dependencies lazily ---
    // Vendored locally (js/vendor/latex-editor-bundle.js — CodeMirror 6 +
    // y-codemirror.next + yjs + @hocuspocus/provider, bundled with esbuild from
    // pinned npm versions) rather than from a CDN at request time: esm.sh's own
    // build backend failed in production (disk-full error building a transitive
    // dependency) with no way for us to retry or fix it on our end. Rebuild the
    // bundle by re-running the esbuild command in this file's header comment
    // if a dependency version ever needs to change.

    async function loadDeps() {
        if (deps) return deps
        const bundle = await import('./vendor/latex-editor-bundle.js')
        deps = {
            EditorState:           bundle.EditorState,
            EditorView:            bundle.EditorView,
            keymap:                bundle.keymap,
            lineNumbers:           bundle.lineNumbers,
            highlightActiveLine:   bundle.highlightActiveLine,
            defaultKeymap:         bundle.defaultKeymap,
            StreamLanguage:        bundle.StreamLanguage,
            syntaxHighlighting:    bundle.syntaxHighlighting,
            defaultHighlightStyle: bundle.defaultHighlightStyle,
            stex:                  bundle.stex,
            yCollab:               bundle.yCollab,
            yUndoManagerKeymap:    bundle.yUndoManagerKeymap,
            HocuspocusProvider:    bundle.HocuspocusProvider,
            Y:                     bundle.Y,
        }
        return deps
    }

    // --- Account config: resolve WebSocket URL from kvstore (reuses the 'Collab' schema) ---

    async function getCollabWsUrl() {
        const accounts = (Array.isArray(window.CList.accounts) && window.CList.accounts.length)
            ? structuredClone(window.CList.accounts)
            : structuredClone(await getAccounts(window.CList.config.flaskSiteUrl))
        const found = findAccountByType('Collab', { accounts })
        return found?.parsedValue?.instance || COLLAB_WS_URL
    }

    let connectionPreparation = null
    function latexPreparation() {
        return connectionPreparation ||= createLatexConnectionPreparation({
            capture: captureLatexConnectionTarget, current: currentLatexConnectionTarget,
            server: getCollabWsUrl, load: loadDeps,
            expand: name => expandDocId(name, { namespace: 'latex' }),
            state: value => { window.CList.state.latexConnection = value },
        })
    }

    // Set the document title in both the doc-id input and the CList write-title field.
    function setDocTitle(value) {
        const input = document.getElementById('latex-doc-id')
        if (input) input.value = value
        const titleEl = window.CList.ui.view.writeTitle
        if (titleEl) titleEl.textContent = value
    }

    // Strip the namespace prefix from a document ID for display in the title input.
    // "did:key:z6Mk.../latex/my-notes"  →  "my-notes"
    function localPartOf(docId) {
        if (!docId) return ''
        const slash = docId.lastIndexOf('/')
        return slash >= 0 ? docId.slice(slash + 1) : docId
    }

    // --- Connect to a collaborative document ---

    let resourceLifecycle = null
    function latexResources() {
        return resourceLifecycle ||= createLatexResourceLifecycle({
            current: currentLatexResourceTarget, visible: () => currentEditor === 'latex',
            view: createLatexResourceView, state: value => { window.CList.state.latexResource = value },
            clearReferences: () => setReferences([]), pushReference: reference => pushReference(reference),
            schedule: (callback, delay) => setTimeout(callback, delay), clear: timer => clearTimeout(timer),
            log: error => console.error('[LaTeX cleanup]', error),
            install: resource => {
                controlsController?.invalidate()
                cmView = resource?.editor || null
                hocuspocusProvider = resource?.provider || null
                sharedRefs = resource?.map || null
                currentDocId = resource?.target.docId || null
                if (resource) currentWsUrl = resource.target.wsUrl
                if(typeof notifyEditorSharingChanged==='function')notifyEditorSharingChanged()
            },
        })
    }
    async function connectToDoc(docId, mode = 'edit', overrideWsUrl = null, current = null) {
        const prepared = await latexPreparation().prepare({ docId, mode, wsUrl: overrideWsUrl, current })
        prepared.color = '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0')
        return latexResources().start(prepared)
    }

    async function connectFromInput() {
        const input = document.getElementById('latex-doc-id')
        const localName = input ? input.value.trim() : ''
        if (!localName) return false
        try {
            const target = await latexPreparation().resolve(localName)
            await connectToDoc(target.docId, 'edit', null, target.current)
            if (!target.current()) return false
            currentDocTitle = ''
            setDocTitle(localPartOf(target.docId))
            return true
        } catch (error) {
            console.error('LaTeX connect error:', error)
            if (error.code !== 'ExpiredCollabPreparation') showErrorModal('Connection failed: ' + error.message, { title: 'Collab connection failed' })
            return false
        }
    }

    // --- Social: "who's here" awareness list ---

    function updateWhoList() { resourceLifecycle?.refresh() }

    // Captured toolbar and content adapters. Vendor resources stay lifecycle-owned.
    let controlsController = null, controlsView = null, contentController = null
    function captureControlSource() {
        if (!resourceLifecycle?.owned() || !cmView) throw new Error('Join a LaTeX document first.')
        const storeUrl = window.CList.config.flaskSiteUrl
        return { editor: cmView, map: sharedRefs, docId: currentDocId, wsUrl: currentWsUrl,
            title: currentDocTitle || localPartOf(currentDocId), text: cmView.state.doc.toString(),
            mode: resourceLifecycle.snapshot()?.target.mode || 'edit', fetch,
            storeUrl, token: getSiteSpecificCookie(storeUrl, window.CList.keys.ACCESS_TOKEN), epoch: window.CList.state.authEpoch }
    }
    function controlSourceCurrent(source, text = false, visible = true) {
        return (!visible || currentEditor === 'latex') && resourceLifecycle?.owned() && source.editor === cmView
            && source.docId === currentDocId && source.storeUrl === window.CList.config.flaskSiteUrl
            && source.epoch === window.CList.state.authEpoch && source.token === getSiteSpecificCookie(source.storeUrl, window.CList.keys.ACCESS_TOKEN)
            && (!text || source.text === source.editor.state.doc.toString())
    }
    function latexControls() {
        return controlsController ||= createLatexControlsController({
            capture: captureControlSource, current: controlSourceCurrent,
            state: value => { window.CList.state.latexControls = value },
            compile: source => compileLatexSource({ url: COMPILE_URL, token: source.token, source: source.text }, { fetch: source.fetch }),
            url: blob => URL.createObjectURL(blob), revoke: url => URL.revokeObjectURL(url),
            link: (source, mode) => getRealtimeDocShareLink(source.wsUrl, source.docId, mode),
            copy: (link, isCurrent) => copyToClipboard(link, { successMsg: 'Link copied.', failMsg: 'Could not copy link — select it and copy manually.', isCurrent }),
            log: error => console.error('[LaTeX controls]', error),
        })
    }
    function latexContent() {
        return contentController ||= createLatexContentController({
            capture: captureControlSource, current: source => controlSourceCurrent(source),
            resolve: id => document.getElementById(id)?.reference,
            plaintext: cleanHTMLContent, displayName: referenceDisplayName,
            references: getReferences, replace: setReferences, push: pushReference,
            display: () => displayReferences(document.getElementById('latexDiv')),
            error: error => controlsView?.error(error), log: error => console.error('[LaTeX content]', error),
        })
    }

    // --- editorHandlers entry ---

    const latexHandler = {
        label:           'LaTeX',
        icon:            'functions',
        contentTypes:    ['text/plain'],
        requiresAccount: false,
        visible:         () => typeof isRegistered === 'function' && isRegistered(),

        initialize: async () => {
            currentEditor = 'latex'
            injectStyles()

            const writePaneContent = window.CList.ui.view.writePaneContent
            let latexDiv = document.getElementById('latexDiv')

            if (!latexDiv) {
                latexDiv = document.createElement('div')
                latexDiv.id = 'latexDiv'
                latexDiv.innerHTML = `
                    <div id="latex-editor-container">
                        <div id="cm-editor"></div>
                    </div>`
                writePaneContent.appendChild(latexDiv)
            }

            latexDiv.style.display = 'block'

            // The toolbar lives in the shared above-title #editor-menu bar, which
            // initializeEditor() wipes on every editor switch — rebuild it (and its
            // wiring) each time this editor is activated.
            const editorMenu = document.getElementById('editor-menu')
            if (editorMenu) {
                const view = controlsView = createLatexControlsView(editorMenu)
                latexControls().bind(view)
                view.bind({
                    compile: () => latexControls().compile(), bibliography: () => latexContent().bibliography(),
                    connect: connectFromInput,
                    share: async () => {
                        if (!currentDocId && !await connectFromInput()) return false
                        if (!view.current() || view !== controlsView) return false
                        return typeof openEditorSharing==='function'?openEditorSharing(editorHandlers.latex.getSharing()):latexControls().share()
                    },
                })
            }

            // Keep write-title in sync with the doc-id input — wired once ever on the
            // persistent write-title element; looks up the (possibly rebuilt) input fresh.
            const writeTitle = window.CList.ui.view.writeTitle
            if (writeTitle && !writeTitle.dataset.latexWired) {
                writeTitle.addEventListener('input', () => {
                    if (currentEditor !== 'latex') return
                    const el = document.getElementById('latex-doc-id')
                    if (el) el.value = writeTitle.textContent.trim()
                })
                writeTitle.dataset.latexWired = '1'
            }

            // Wire the drop zone once — #latex-editor-container persists across activations
            if (!latexDiv.dataset.wired) {
                document.getElementById('latex-editor-container').addEventListener('drop', function(e) {
                    if (currentEditor === 'latex' && resourceLifecycle?.owned() && document.getElementById('latexDiv') === latexDiv) window._attributeDroppedContent(e)
                }, true)

                latexDiv.dataset.wired = '1'
            }

            const activationCurrent = latexPreparation().intent()
            try {
                await loadDeps()
            } catch (e) {
                console.error('Failed to load LaTeX editor dependencies:', e)
                if (activationCurrent()) showErrorModal('Could not load LaTeX editor library — check your network connection.', { title: 'LaTeX library failed to load' })
                return false
            }

            if (!activationCurrent()) return false
            resourceLifecycle?.owned()
            resourceLifecycle?.rebind()
            if (currentDocId) {
                // Re-activating after switching away — restore display title
                setDocTitle(localPartOf(currentDocId))
            } else if (!cmView) {
                // Fresh open — generate a slug and connect immediately.
                const slug = generateDocSlug()
                setDocTitle(slug)
                try {
                    const target = await latexPreparation().resolve(slug)
                    await connectToDoc(target.docId, 'edit', null, target.current)
                } catch (e) {
                    console.error('Failed to start LaTeX document:', e)
                    if (e.code !== 'ExpiredCollabPreparation') showErrorModal('Could not start editor — check your network connection.', { title: 'Editor failed to start' })
                    return false
                }
            }

            loadPredefinedContent('latex')
        },

        getContent: () => { const source = captureControlSource(); return controlSourceCurrent(source, false, false) ? source.text : '' },

        // Which document (if any) this handler is currently connected to — used by
        // editors.js's editor-switch state park/restore to recognize "still the same
        // live document" and resync references from the Y.Map instead of restoring a
        // stale local snapshot. null when not connected (e.g. local-only, pre-title).
        getSharing: () => {if(!resourceLifecycle?.owned()||!currentDocId||!currentWsUrl)return null;const source=captureControlSource();return {docId:source.docId,server:source.wsUrl,title:source.title,current:()=>controlSourceCurrent(source,false,false)};},
        getDocId: () => resourceLifecycle?.owned() ? currentDocId : null,

        // Rebuild the shared global reference list from this document's own clist_refs
        // Map's current, authoritative state — used on reactivation (switching back to
        // LaTeX) instead of trusting whatever was parked, since the Map keeps syncing
        // in the background (observe() above is gated to skip the global list) while
        // this editor isn't the one on screen.
        resyncReferences: () => latexContent().resync(),
        loadContent: (content, itemId) => latexContent().insert(content, null, itemId),
        insertLink: ({ content, reference }) => latexContent().insert(content, reference, null, true),
        insertLinkVia: ({ content, reference }) => latexContent().insert(content, reference, null, true),
    }

    if (typeof editorHandlers !== 'undefined') {
        editorHandlers.latex = latexHandler
    } else {
        console.error('editorHandlers is not defined — latex.js must load after editors.js')
    }

})();
