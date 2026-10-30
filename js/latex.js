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

    const COLLAB_WS_URL = 'wss://collab.mooc.ca'
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
    let cachedDidKey       = null  // did:key fetched from user's DID document, cached
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
        try {
            const accts = (Array.isArray(window.CList.accounts) && window.CList.accounts.length)
                ? window.CList.accounts
                : await getAccounts(window.CList.config.flaskSiteUrl)
            const found = accts.find(a => {
                const d = parseAccountValue(a)
                return d && d.type === 'Collab'
            })
            if (found) {
                const d = parseAccountValue(found)
                if (d.instance) return d.instance
            }
        } catch (e) {
            console.warn('Could not look up Collab account, using default server:', e)
        }
        return COLLAB_WS_URL
    }

    // Convert wss:// URL to https:// for REST calls
    function wsUrlToRestBase(wsUrl) {
        return wsUrl.replace(/^wss?:\/\//, 'https://').replace(/\/$/, '')
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

    // Derive the short-host identifier used in document namespaces.
    function kvShortHost(kvUrl) {
        try {
            const host = new URL(kvUrl).hostname
            return host.startsWith('kvstore.') ? host.slice('kvstore.'.length) : host
        } catch { return '' }
    }

    // Generate a short random slug for new untitled documents (e.g. "a3f8k2")
    function generateDocSlug() {
        return Math.random().toString(36).slice(2, 8)
    }

    // Expand a bare local name to a fully-namespaced document ID, inserting a "latex/"
    // segment so this never collides with a same-named collab.js (rich-text) document.
    async function expandDocId(localName) {
        if (localName.includes('/')) return localName  // already namespaced
        const didKey = await getUserDidKey()
        if (didKey) return `${didKey}/latex/${localName}`
        const myUser = (window.CList.state.username && window.CList.state.username !== 'none' && window.CList.state.username !== '') ? window.CList.state.username : null
        const shortHost = kvShortHost(window.CList.config.flaskSiteUrl)
        if (myUser && shortHost) return `${myUser}@${shortHost}/latex/${localName}`
        return `latex/${localName}`
    }

    // Fetch the current user's did:key from their DID document on the kvstore.
    async function getUserDidKey() {
        if (cachedDidKey) return cachedDidKey
        const myUser = (window.CList.state.username && window.CList.state.username !== 'none' && window.CList.state.username !== '') ? window.CList.state.username : null
        if (!myUser) return null
        try {
            const res = await fetch(`${window.CList.config.flaskSiteUrl}/users/${myUser}/did.json`)
            if (!res.ok) return null
            const doc = await res.json()
            const didKey = (Array.isArray(doc.alsoKnownAs) ? doc.alsoKnownAs : [])
                .find(id => typeof id === 'string' && id.startsWith('did:key:')) || null
            cachedDidKey = didKey
            return cachedDidKey
        } catch {
            return null
        }
    }

    // --- Connect to a collaborative document ---

    async function connectToDoc(docId, mode = 'edit', overrideWsUrl = null) {
        const wsUrl = overrideWsUrl || await getCollabWsUrl()
        currentWsUrl = wsUrl

        await loadDeps()
        const {
            EditorState, EditorView, keymap, lineNumbers, highlightActiveLine,
            defaultKeymap, StreamLanguage, syntaxHighlighting, defaultHighlightStyle,
            stex, yCollab, yUndoManagerKeymap, HocuspocusProvider, Y,
        } = deps

        const statusEl = document.getElementById('latex-status')
        if (statusEl) statusEl.textContent = 'connecting…'

        // Tear down any previous session
        if (hocuspocusProvider) { hocuspocusProvider.destroy(); hocuspocusProvider = null }
        if (cmView)             { cmView.destroy();             cmView = null }

        const rawToken = getSiteSpecificCookie(window.CList.config.flaskSiteUrl, window.CList.keys.ACCESS_TOKEN)
        const token    = (mode === 'read' && !rawToken) ? 'anonymous' : (rawToken || 'anonymous')
        const userName = (window.CList.state.username && window.CList.state.username !== 'none' && window.CList.state.username !== '')
            ? window.CList.state.username
            : 'Anonymous'
        const userColor = '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0')

        // Different document than whatever was previously merged in (if any) — start the
        // locally-displayed reference list clean rather than carrying over the old doc's
        // entries; the sync below repopulates it from this doc's own clist_refs Map.
        setReferences([])

        const ydoc  = new Y.Doc()
        const ytext = ydoc.getText('latex-source')
        sharedRefs  = ydoc.getMap('clist_refs')
        sharedRefs.observe((event) => {
            // Only merge into the shared global reference list while the LaTeX editor is
            // actually on screen — the Hocuspocus connection itself stays alive in the
            // background after switching away (so returning to it is instant), but without
            // this guard its observer would keep overwriting the global list with this
            // document's entries even while a different, currently-visible editor (e.g. a
            // second LaTeX/Collab doc) owns that list.
            if (currentEditor !== 'latex') return
            event.keysChanged.forEach(url => {
                const jsonStr = sharedRefs.get(url)
                if (!jsonStr) return
                try {
                    if (typeof pushReference === 'function') pushReference(JSON.parse(jsonStr))
                } catch { /* skip corrupt entries */ }
            })
        })

        hocuspocusProvider = new HocuspocusProvider({
            url:        wsUrl,
            name:       docId,
            document:   ydoc,
            token,
            parameters: { kvstoreUrl: window.CList.config.flaskSiteUrl, ...(mode === 'read' ? { mode: 'read' } : {}) },
            onStatus: ({ status }) => {
                if (statusEl) statusEl.textContent = status
            },
            onAuthenticationFailed: () => {
                showErrorModal('LaTeX editor: authentication failed — make sure you are logged in.', { title: 'Collab authentication failed' })
            },
        })

        hocuspocusProvider.awareness.setLocalStateField('user', { name: userName, color: userColor })
        hocuspocusProvider.awareness.on('update', updateWhoList)

        // yUndoManagerKeymap replaces @codemirror/commands' history()/historyKeymap —
        // yCollab installs its own Yjs-aware undo manager; running both would double up.
        cmView = new EditorView({
            parent: document.getElementById('cm-editor'),
            state: EditorState.create({
                doc: ytext.toString(),
                extensions: [
                    lineNumbers(),
                    highlightActiveLine(),
                    syntaxHighlighting(defaultHighlightStyle),
                    StreamLanguage.define(stex),
                    keymap.of([...yUndoManagerKeymap, ...defaultKeymap]),
                    yCollab(ytext, hocuspocusProvider.awareness),
                    EditorView.editable.of(mode !== 'read'),
                    EditorView.lineWrapping,
                ],
            }),
        })

        currentDocId = docId
        setTimeout(updateWhoList, 200)  // show self after awareness propagates
    }

    async function connectFromInput() {
        const input = document.getElementById('latex-doc-id')
        const localName = input ? input.value.trim() : ''
        if (!localName) return
        const docId = await expandDocId(localName)
        currentDocTitle = ''
        try {
            await connectToDoc(docId)
            setDocTitle(localPartOf(docId))
        } catch (e) {
            console.error('LaTeX connect error:', e)
            showErrorModal('Connection failed: ' + e.message, { title: 'Collab connection failed' })
        }
    }

    // --- Social: "who's here" awareness list ---

    function updateWhoList() {
        const whoEl = document.getElementById('latex-who')
        if (!whoEl || !hocuspocusProvider) return
        whoEl.textContent = ''
        ;[...hocuspocusProvider.awareness.getStates().values()]
            .filter(s => s.user)
            .forEach((s, i) => {
                if (i > 0) whoEl.appendChild(document.createTextNode(' '))
                const span = document.createElement('span')
                span.className = 'latex-user'
                const safeColor = /^#[0-9a-f]{3,6}$/i.test(s.user.color || '') ? s.user.color : '#888'
                span.style.color = safeColor
                span.textContent = '● ' + (s.user.name || 'Anonymous')
                whoEl.appendChild(span)
            })
    }

    // --- Sharing ---

    function getLatexShareLink(mode) {
        const pathId = currentDocId.split('/').map(encodeURIComponent).join('/')
        return `${wsUrlToRestBase(currentWsUrl)}/doc/${pathId}/${mode}`
    }

    function shareLatexDoc() {
        if (!currentDocId) { showErrorModal('Join a document first before sharing.', { title: 'No document to share' }); return }
        const editLink = getLatexShareLink('edit')
        const readLink = getLatexShareLink('read')
        const docTitle = currentDocTitle || localPartOf(currentDocId)

        function linkRow(link, label) {
            return `
                <div style="margin-bottom:14px">
                    <div style="font-weight:600;font-size:0.85em;margin-bottom:4px">${label}</div>
                    <div style="display:flex;gap:5px;align-items:center">
                        <code class="share-link-code">${escapeHtml(link)}</code>
                        <button class="btn-small" onclick="window.copyLatexLink('${link}')">Copy</button>
                    </div>
                </div>`
        }

        showModal(`
            <div style="width:min(560px,88vw)">
                <h3 style="margin:0 0 14px">Share &ldquo;${escapeHtml(docTitle)}&rdquo;</h3>
                ${linkRow(editLink, 'Co-edit link')}
                ${linkRow(readLink, 'Read-only link')}
            </div>
        `)
    }

    window.copyLatexLink = function(link) {
        navigator.clipboard.writeText(link)
            .then(() => showStatusMessage('Link copied.'))
            .catch(e => showErrorModal('Could not copy link: ' + e.message, { title: 'Copy failed' }))
    }

    // --- Bibliography serializer (references.js's Reference[] → \thebibliography) ---

    const LATEX_ESCAPES = {
        '\\': '\\textbackslash{}', '{': '\\{', '}': '\\}', '$': '\\$', '&': '\\&',
        '%': '\\%', '#': '\\#', '_': '\\_', '^': '\\textasciicircum{}', '~': '\\textasciitilde{}',
    }

    function escapeLatex(str) {
        return String(str ?? '').replace(/[\\{}$&%#_^~]/g, c => LATEX_ESCAPES[c])
    }

    function referencesToLatexBibliography(refs) {
        if (!refs || !refs.length) return ''
        const items = refs.map((ref, i) => {
            const author = escapeLatex(ref.author_name || '')
            const title  = escapeLatex(ref.title || '')
            const feed   = escapeLatex(ref.feed || '')
            const date   = ref.created_at ? ref.created_at.slice(0, 10) : ''
            const url    = escapeLatex(ref.url || '')
            return `\\bibitem{ref${i + 1}} ${author}. ${title}. \\textit{${feed}}. ${date}. ${url}`
        }).join('\n')
        return `\\begin{thebibliography}{99}\n${items}\n\\end{thebibliography}`
    }

    // --- Insert text at the CodeMirror cursor ---

    function insertAtCursor(text) {
        if (!cmView) return
        const { from, to } = cmView.state.selection.main
        cmView.dispatch({ changes: { from, to, insert: text }, selection: { anchor: from + text.length } })
        cmView.focus()
    }

    // --- Insert a bibliography block, refreshing an existing one in place rather than duplicating it ---

    const BIBLIOGRAPHY_RE = /\\begin\{thebibliography\}\{[^}]*\}[\s\S]*?\\end\{thebibliography\}/

    function insertOrRefreshBibliography(block) {
        if (!cmView) return
        const docText = cmView.state.doc.toString()
        const match   = docText.match(BIBLIOGRAPHY_RE)
        if (match) {
            const from = match.index
            const to   = from + match[0].length
            cmView.dispatch({ changes: { from, to, insert: block }, selection: { anchor: from + block.length } })
            cmView.focus()
        } else {
            insertAtCursor('\n' + block + '\n')
        }
    }

    // --- Compile ---

    async function compileCurrentDoc() {
        if (!cmView) return
        const token = getSiteSpecificCookie(window.CList.config.flaskSiteUrl, window.CList.keys.ACCESS_TOKEN)
        if (!token) {
            showErrorModal('Log in to compile a LaTeX document.', { title: 'Login required' })
            return
        }
        const statusEl = document.getElementById('latex-status')
        const dlLink   = document.getElementById('latex-download-link')
        if (dlLink) dlLink.style.display = 'none'
        if (statusEl) statusEl.textContent = 'compiling…'
        try {
            const resp = await fetch(COMPILE_URL, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body:    JSON.stringify({ source: cmView.state.doc.toString() }),
            })
            if (resp.ok) {
                const blob = await resp.blob()
                const url  = URL.createObjectURL(blob)
                if (dlLink) {
                    dlLink.href = url
                    dlLink.style.display = ''
                }
                if (statusEl) statusEl.textContent = 'compiled'
                return
            }
            if (resp.status === 422) {
                const body = await resp.json().catch(() => ({}))
                showErrorModal(body.log || body.error || 'LaTeX compile failed.', { title: 'Compile failed' })
            } else if (resp.status === 413) {
                showErrorModal('Document is too large to compile.', { title: 'Compile failed' })
            } else if (resp.status === 504) {
                showErrorModal('Compile timed out.', { title: 'Compile failed' })
            } else {
                showErrorModal(`Compile service returned an unexpected error (${resp.status}).`, { title: 'Compile failed' })
            }
            if (statusEl) statusEl.textContent = 'compile error'
        } catch (e) {
            console.error('Compile request failed:', e)
            showErrorModal('Compile request failed: ' + e.message, { title: 'Compile failed' })
            if (statusEl) statusEl.textContent = 'compile error'
        }
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
                editorMenu.innerHTML = `
                    <div id="latex-doc-picker">
                        <input id="latex-doc-id" type="hidden">
                        <button id="latex-invite-btn" class="btn btn-small" title="Share this document">Share</button>
                        <button id="latex-insert-bib-btn" class="btn btn-small" title="Insert bibliography from references">Insert bibliography</button>
                        <button id="latex-compile-btn" class="btn btn-small" title="Compile to PDF">Compile</button>
                        <a id="latex-download-link" href="#" target="_blank" class="btn btn-small" style="display:none" title="Download compiled PDF">Download PDF</a>
                    </div>
                    <div id="latex-who"></div>
                    <div id="latex-status"></div>`
                editorMenu.style.display = ''

                const input = document.getElementById('latex-doc-id')

                input.addEventListener('keydown', async (e) => {
                    if (e.key !== 'Enter') return
                    e.preventDefault()
                    await connectFromInput()
                })

                document.getElementById('latex-invite-btn').addEventListener('click', async () => {
                    if (!currentDocId) await connectFromInput()
                    if (currentDocId) shareLatexDoc()
                })

                document.getElementById('latex-insert-bib-btn').addEventListener('click', () => {
                    const refs  = typeof getReferences === 'function' ? getReferences() : []
                    const block = referencesToLatexBibliography(refs)
                    if (!block) {
                        showErrorModal('No references to insert yet.', { title: 'No references' })
                        return
                    }
                    insertOrRefreshBibliography(block)
                })

                document.getElementById('latex-compile-btn').addEventListener('click', compileCurrentDoc)
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
                    const dt = e.dataTransfer
                    if (!dt) return
                    const url   = window._extractDropUrl(dt.getData('text/uri-list'), dt.getData('text/html'))
                    const title = dt.getData('text/x-clist-title') || null
                    window._attributeDroppedContent(url, title)
                }, true)

                latexDiv.dataset.wired = '1'
            }

            try {
                await loadDeps()
            } catch (e) {
                console.error('Failed to load LaTeX editor dependencies:', e)
                showErrorModal('Could not load LaTeX editor library — check your network connection.', { title: 'LaTeX library failed to load' })
                return
            }

            if (currentDocId) {
                // Re-activating after switching away — restore display title
                setDocTitle(localPartOf(currentDocId))
            } else if (!cmView) {
                // Fresh open — generate a slug and connect immediately.
                const slug = generateDocSlug()
                setDocTitle(slug)
                try {
                    const docId = await expandDocId(slug)
                    await connectToDoc(docId)
                } catch (e) {
                    console.error('Failed to start LaTeX document:', e)
                    showErrorModal('Could not start editor — check your network connection.', { title: 'Editor failed to start' })
                }
            }

            loadPredefinedContent('latex')
        },

        getContent: () => cmView ? cmView.state.doc.toString() : '',

        // Which document (if any) this handler is currently connected to — used by
        // editors.js's editor-switch state park/restore to recognize "still the same
        // live document" and resync references from the Y.Map instead of restoring a
        // stale local snapshot. null when not connected (e.g. local-only, pre-title).
        getDocId: () => currentDocId,

        // Rebuild the shared global reference list from this document's own clist_refs
        // Map's current, authoritative state — used on reactivation (switching back to
        // LaTeX) instead of trusting whatever was parked, since the Map keeps syncing
        // in the background (observe() above is gated to skip the global list) while
        // this editor isn't the one on screen.
        resyncReferences: () => {
            setReferences([])
            if (!sharedRefs) return
            sharedRefs.forEach((jsonStr) => {
                try {
                    if (typeof pushReference === 'function') pushReference(JSON.parse(jsonStr))
                } catch { /* skip corrupt entries */ }
            })
        },

        loadContent: ({ type, value }, itemId) => {
            if (!cmView) {
                showErrorModal('Join a document first, then load content into it.', { title: 'No document loaded' })
                return
            }
            const text = (type === 'text/html') ? cleanHTMLContent(value) : value
            insertAtCursor(text)

            if (itemId) {
                const editorDiv = document.getElementById('latexDiv')
                const reference = createReference(itemId, editorDiv)
                displayCurrentReference(reference, editorDiv)
                displayReferences(editorDiv)
                if (sharedRefs) {
                    const specificEl = document.getElementById(itemId)
                    const ref = specificEl?.reference
                    if (ref?.url) sharedRefs.set(ref.url, JSON.stringify(ref))
                }
            }
        },
        // no setContent — collaborative editor, same reasoning as collab/etherpad/collection
    }

    if (typeof editorHandlers !== 'undefined') {
        editorHandlers.latex = latexHandler
    } else {
        console.error('editorHandlers is not defined — latex.js must load after editors.js')
    }

})();
