//  collab.js  -  TipTap rich-text editor with Hocuspocus real-time collaboration
//  Part of CList, the next generation of learning and connecting with your community
//
//  Copyright National Research Council of Canada 2025
//  Licensed under Creative Commons Attribution 4.0 International https://creativecommons.org/licenses/by/4.0/
//
//  This software carries NO WARRANTY OF ANY KIND.
//  This software is provided "AS IS," and you, its user, assume all risks when using it.

// Account schema — lets users configure a custom collab server via kvstore
window.accountSchemas = window.accountSchemas || {}
window.accountSchemas['Collab'] = {
    type: 'Collab',
    instanceFromKey: true,
    kvKey: { label: 'WebSocket URL', placeholder: 'wss://collab.mooc.ca' },
    fields: [
        { key: 'title',       label: 'Server name', editable: true, inputType: 'text', placeholder: 'My Collab Server', default: '' },
        { key: 'permissions', label: 'Permissions', editable: true, inputType: 'text', placeholder: 'e',                default: 'e' },
    ]
}

;(function () {

    const COLLAB_WS_URL = 'wss://collab.mooc.ca'

    // --- Minimal styles, injected once ---

    function injectStyles() {
        if (document.getElementById('collab-styles')) return
        const s = document.createElement('style')
        s.id = 'collab-styles'
        s.textContent = `
            #collabDiv { display: flex; flex-direction: column; height: 100%; position: relative; }
            #collab-share-post-overlay { position: absolute; top: 0; left: 0; right: 0; bottom: 0;
                background: rgba(255,255,255,0.97); z-index: 20; display: flex; flex-direction: column;
                padding: 12px; border: 1px solid #ccc; border-radius: 4px; }
            #collab-share-post-overlay .overlay-instructions { font-size: 0.85em; color: #555;
                margin: 0 0 8px; }
            #collab-share-post-overlay .overlay-toolbar { display: flex; gap: 6px; margin-top: 8px;
                justify-content: flex-end; }
            #collab-toolbar { display: flex; align-items: center; gap: 8px; padding: 6px 0;
                              border-bottom: 1px solid #ddd; margin-bottom: 8px; flex-wrap: wrap; }
            #collab-doc-picker { display: flex; gap: 6px; align-items: center; }
            #collab-doc-id { font-size: 0.85em; padding: 4px 6px; border: 1px solid #ccc;
                             border-radius: 4px; width: 200px; }
            #collab-doc-picker button { font-size: 0.8em; padding: 2px 8px; border: 1px solid #ccc;
                border-radius: 3px; background: #f5f5f5; color: #333; cursor: pointer; }
            #collab-doc-picker button:hover { background: #e8e8e8; }
            #collab-doc-warning { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
            #collab-doc-warning button { font-size: 0.8em; padding: 1px 7px; border: 1px solid #c00;
                border-radius: 3px; background: #fee; color: #a00; cursor: pointer; }
            #collab-doc-warning button:hover { background: #fcc; }
            #collab-format-toolbar { display: flex; gap: 3px; }
            #collab-format-toolbar button { font-size: 0.8em; padding: 2px 6px; min-width: 26px;
                border: 1px solid #ccc; border-radius: 3px;
                background: #f5f5f5; color: #333; cursor: pointer; }
            #collab-format-toolbar button:hover { background: #e8e8e8; }
            #collab-format-toolbar button.is-active { background: #dde; color: #333; font-weight: bold; }
            #collab-who { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; flex: 1; padding: 0 4px; }
            .collab-user { font-size: 0.75em; white-space: nowrap; }
            #collab-status { font-size: 0.75em; color: #888; }
            .collab-share-btn { font-size: 0.8em; padding: 2px 8px; border: 1px solid #ccc;
                border-radius: 3px; background: #f5f5f5; color: #333; cursor: pointer; }
            .collab-share-btn:hover { background: #e8e8e8; }
            .collab-share-btn:disabled { opacity: 0.6; cursor: default; }
            #collab-editor-container { flex: 1; overflow-y: auto; border: 1px solid #ddd;
                                       border-radius: 4px; background: #fff; }
            #tiptap-editor .ProseMirror { outline: none; min-height: 200px; padding: 10px;
                                          background: #fff; color: #111; }
            #tiptap-editor .ProseMirror p { margin: 0.5em 0; }
            #tiptap-editor .ProseMirror h1 { font-size: 1.6em; margin: 0.8em 0 0.3em; }
            #tiptap-editor .ProseMirror h2 { font-size: 1.3em; margin: 0.7em 0 0.3em; }
            #tiptap-editor .ProseMirror h3 { font-size: 1.1em; margin: 0.6em 0 0.3em; }
            #tiptap-editor .ProseMirror ul, #tiptap-editor .ProseMirror ol { padding-left: 1.5em; }
            #tiptap-editor .ProseMirror blockquote { border-left: 3px solid #ccc; margin: 0.5em 0;
                padding-left: 1em; color: #555; }
            /* Collaboration cursors */
            .collaboration-cursor__caret { border-left: 2px solid; border-right: 2px solid;
                margin-left: -1px; margin-right: -1px; position: relative; }
            .collaboration-cursor__label { border-radius: 3px 3px 3px 0; color: #fff;
                font-size: 0.7em; font-weight: 600; left: -1px; line-height: normal;
                padding: 1px 4px; position: absolute; top: -1.5em;
                user-select: none; white-space: nowrap; }
        `
        document.head.appendChild(s)
    }

    // --- Module-level state ---

    let deps               = null  // loaded TipTap / Hocuspocus modules (cached after first load)
    let tiptapEditor       = null
    let hocuspocusProvider = null
    let currentDocId       = null
    let currentDocTitle    = ''
    let currentWsUrl       = COLLAB_WS_URL  // updated each time we connect
    let cachedDidKey       = null  // did:key fetched from user's DID document, cached
    let dupCheckTimer      = null  // debounce timer for duplicate-title check

    // --- Load CDN dependencies lazily ---
    // esm.sh resolves peer dependencies consistently so Y.Doc instances are shared.

    async function loadDeps() {
        if (deps) return deps
        const [core, sk, collab, cursor, hocus, yjs] = await Promise.all([
            import('https://esm.sh/@tiptap/core@2'),
            import('https://esm.sh/@tiptap/starter-kit@2'),
            import('https://esm.sh/@tiptap/extension-collaboration@2'),
            import('https://esm.sh/@tiptap/extension-collaboration-cursor@2'),
            import('https://esm.sh/@hocuspocus/provider@2'),
            import('https://esm.sh/yjs@13'),
        ])
        deps = {
            Editor:               core.Editor,
            StarterKit:           sk.default,
            Collaboration:        collab.default,
            CollaborationCursor:  cursor.default,
            HocuspocusProvider:   hocus.HocuspocusProvider,
            Y:                    yjs,
        }
        return deps
    }

    // --- Account config: resolve WebSocket URL from kvstore ---

    async function getCollabWsUrl() {
        try {
            const accts = (Array.isArray(accounts) && accounts.length)
                ? accounts
                : await getAccounts(flaskSiteUrl)
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

    // Return true if str looks like a collab share URL (contains /doc/ path).
    function isCollabUrl(str) {
        try { return new URL(str).pathname.startsWith('/doc/') } catch { return false }
    }

    // Parse a collab share URL and open the document in the collab editor.
    // Works for both /doc/{id}/edit and /doc/{id}/read forms.
    async function openCollabUrl(href) {
        try {
            const url    = new URL(href)
            const segs   = url.pathname.slice(5).split('/').filter(Boolean).map(decodeURIComponent)
            const last   = segs[segs.length - 1]
            const mode   = (last === 'edit' || last === 'read') ? last : 'edit'
            const docId  = (last === 'edit' || last === 'read') ? segs.slice(0, -1).join('/') : segs.join('/')
            if (!docId) return
            const wsUrl  = url.origin.replace(/^https:\/\//, 'wss://').replace(/^http:\/\//, 'ws://')
            if (typeof initializeEditor === 'function' && currentEditor !== 'collab') {
                await initializeEditor('collab')
            }
            setDocTitle(localPartOf(docId))
            currentDocTitle = ''
            await connectToDoc(docId, mode, wsUrl)
        } catch (e) {
            console.error('openCollabUrl failed:', e)
            showStatusMessage('Could not open collab link: ' + e.message)
        }
    }
    window.openCollabUrl = openCollabUrl

    // Set the document title in both the collab input and the CList write-title field.
    function setDocTitle(value) {
        const input = document.getElementById('collab-doc-id')
        if (input) input.value = value
        const titleEl = document.getElementById('write-title')
        if (titleEl) titleEl.textContent = value
    }

    // Derive the short-host identifier used in document namespaces.
    // kvstore.mooc.ca  →  mooc.ca   (strip default 'kvstore.' prefix)
    // accounts.mooc.ca →  accounts.mooc.ca  (non-default subdomain, keep as-is)
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

    // Strip the namespace prefix from a document ID for display in the title input.
    // "did:key:z6Mk.../my-notes"  →  "my-notes"
    // "stephen@mooc.ca/my-notes"  →  "my-notes"
    // "my-notes"                  →  "my-notes"
    function localPartOf(docId) {
        if (!docId) return ''
        const slash = docId.lastIndexOf('/')
        return slash >= 0 ? docId.slice(slash + 1) : docId
    }

    // Expand a bare local name to a fully-namespaced document ID using the user's
    // did:key (preferred) or username@shortHost fallback.
    async function expandDocId(localName) {
        if (localName.includes('/')) return localName  // already namespaced
        const didKey = await getUserDidKey()
        if (didKey) return `${didKey}/${localName}`
        const myUser = (typeof window.username !== 'undefined' && window.username !== 'none')
            ? window.username
            : getSiteSpecificCookie(flaskSiteUrl, 'username')
        const shortHost = kvShortHost(flaskSiteUrl)
        if (myUser && shortHost) return `${myUser}@${shortHost}/${localName}`
        return localName
    }

    // Fetch the current user's did:key from their DID document on the kvstore.
    // Returns the did:key string, or null if unavailable.  Result is cached.
    async function getUserDidKey() {
        if (cachedDidKey) return cachedDidKey
        const myUser = (typeof window.username !== 'undefined' && window.username !== 'none')
            ? window.username
            : getSiteSpecificCookie(flaskSiteUrl, 'username')
        if (!myUser) return null
        try {
            const res = await fetch(`${flaskSiteUrl}/users/${myUser}/did.json`)
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

    // Initialize TipTap with a local Y.Doc only (no Hocuspocus) so the editor is
    // immediately usable before the user commits a document title.
    async function initLocalEditor() {
        const { Editor, StarterKit, Collaboration, Y } = await loadDeps()
        if (tiptapEditor) { tiptapEditor.destroy(); tiptapEditor = null }
        const ydoc = new Y.Doc()
        tiptapEditor = new Editor({
            element:    document.getElementById('tiptap-editor'),
            editable:   true,
            extensions: [
                StarterKit.configure({ history: false }),
                Collaboration.configure({ document: ydoc }),
            ],
        })
        buildFormatToolbar()
    }

    // Read the current title input, expand it to a full doc ID, and connect.
    async function connectFromInput() {
        const input = document.getElementById('collab-doc-id')
        const localName = input ? input.value.trim() : ''
        if (!localName) return
        const docId = await expandDocId(localName)
        currentDocTitle = ''
        try {
            await connectToDoc(docId)
            setDocTitle(localPartOf(docId))
        } catch (e) {
            console.error('Collab connect error:', e)
            showStatusMessage('Connection failed: ' + e.message)
        }
    }

    // Check whether a document already exists with the ID derived from the current
    // title input.  Debounced — call on every input event.
    function scheduleDupCheck() {
        if (dupCheckTimer) clearTimeout(dupCheckTimer)
        dupCheckTimer = setTimeout(checkTitleForDuplicate, 500)
    }

    async function checkTitleForDuplicate() {
        const input   = document.getElementById('collab-doc-id')
        const warning = document.getElementById('collab-doc-warning')
        if (!input || !warning) return

        const localName = input.value.trim()
        if (!localName) { warning.style.display = 'none'; pendingDocId = localName; return }

        const docId = await expandDocId(localName)
        pendingDocId = docId

        // If already connected to this doc, no warning needed
        if (currentDocId === docId) { warning.style.display = 'none'; return }

        const wsUrl = await getCollabWsUrl()
        const base  = wsUrlToRestBase(wsUrl)
        const token = getSiteSpecificCookie(flaskSiteUrl, 'access_token') || ''
        try {
            const pathId = docId.split('/').map(encodeURIComponent).join('/')
            const resp = await fetch(`${base}/api/documents/${pathId}`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            })
            if (!resp.ok) { warning.style.display = 'none'; return }

            // Document exists — show warning
            const hasContent = tiptapEditor && tiptapEditor.getText().trim().length > 0
            const loseWarn   = hasContent ? ' <strong>Your current content will be lost.</strong>' : ''
            warning.innerHTML = `Document already exists.${loseWarn}
                <button id="collab-load-existing">Load it</button>`
            warning.style.display = 'block'

            document.getElementById('collab-load-existing').addEventListener('click', async () => {
                warning.style.display = 'none'
                currentDocTitle = ''
                try {
                    await connectToDoc(docId, 'edit', null, null)
                    if (input) input.value = localPartOf(docId)
                } catch (e) {
                    showStatusMessage('Connection failed: ' + e.message)
                }
            })
        } catch {
            warning.style.display = 'none'
        }
    }

    // --- Formatting toolbar ---

    const FORMAT_BUTTONS = [
        { label: 'B',   title: 'Bold',          cmd: e => e.chain().focus().toggleBold().run(),               active: e => e.isActive('bold') },
        { label: 'I',   title: 'Italic',         cmd: e => e.chain().focus().toggleItalic().run(),             active: e => e.isActive('italic') },
        { label: 'H1',  title: 'Heading 1',      cmd: e => e.chain().focus().toggleHeading({ level: 1 }).run(), active: e => e.isActive('heading', { level: 1 }) },
        { label: 'H2',  title: 'Heading 2',      cmd: e => e.chain().focus().toggleHeading({ level: 2 }).run(), active: e => e.isActive('heading', { level: 2 }) },
        { label: 'H3',  title: 'Heading 3',      cmd: e => e.chain().focus().toggleHeading({ level: 3 }).run(), active: e => e.isActive('heading', { level: 3 }) },
        { label: '•',   title: 'Bullet list',    cmd: e => e.chain().focus().toggleBulletList().run(),         active: e => e.isActive('bulletList') },
        { label: '1.',  title: 'Ordered list',   cmd: e => e.chain().focus().toggleOrderedList().run(),        active: e => e.isActive('orderedList') },
        { label: '❝',   title: 'Blockquote',     cmd: e => e.chain().focus().toggleBlockquote().run(),         active: e => e.isActive('blockquote') },
    ]

    function buildFormatToolbar() {
        const bar = document.getElementById('collab-format-toolbar')
        if (!bar) return
        bar.innerHTML = ''
        FORMAT_BUTTONS.forEach(({ label, title, cmd }) => {
            const btn = document.createElement('button')
            btn.textContent = label
            btn.title = title
            btn.addEventListener('click', () => { cmd(tiptapEditor); refreshToolbar() })
            bar.appendChild(btn)
        })
        tiptapEditor.on('selectionUpdate', refreshToolbar)
        tiptapEditor.on('transaction',     refreshToolbar)
    }

    function refreshToolbar() {
        const bar = document.getElementById('collab-format-toolbar')
        if (!bar || !tiptapEditor) return
        bar.querySelectorAll('button').forEach((btn, i) => {
            btn.classList.toggle('is-active', FORMAT_BUTTONS[i].active(tiptapEditor))
        })
    }

    // --- Social: "who's here" awareness list ---

    function updateWhoList() {
        const whoEl = document.getElementById('collab-who')
        if (!whoEl || !hocuspocusProvider) return
        const states = [...hocuspocusProvider.awareness.getStates().values()]
        whoEl.innerHTML = states
            .filter(s => s.user)
            .map(s => `<span class="collab-user" style="color:${s.user.color}">● ${s.user.name}</span>`)
            .join(' ')
    }

    // --- Sharing helpers ---

    function getCollabShareLink(mode) {
        const pathId = currentDocId.split('/').map(encodeURIComponent).join('/')
        return `${wsUrlToRestBase(currentWsUrl)}/doc/${pathId}/${mode}`
    }

    window.copyCollabLink = function(mode) {
        navigator.clipboard.writeText(getCollabShareLink(mode))
            .then(() => showStatusMessage('Link copied to clipboard.'))
            .catch(() => showStatusMessage('Copy failed — select the link and copy manually.'))
    }

    window.shareCollabViaChat = function(mode) {
        if (!currentDocId) return
        const invite = {
            type:   'collab-invite',
            docId:  currentDocId,
            server: currentWsUrl,
            mode,
            title:  currentDocTitle || currentDocId,
            link:   getCollabShareLink(mode),
        }
        if (typeof window.sendCollabInvite === 'function') {
            const sent = window.sendCollabInvite(invite)
            showStatusMessage(sent ? 'Invite sent to chat discussion.' : 'No connected peers to send to.')
        }
    }

    // Open an overlay editor above the collab pane so the user can compose a message
    // containing the share link and post it to any configured account via playPost().
    window.openCollabSharePost = function(mode) {
        const m = document.getElementById('generic-modal')
        if (m) m.remove()

        const link     = getCollabShareLink(mode)
        const docTitle = currentDocTitle || currentDocId
        const linkHtml = mode === 'edit'
            ? `<a href="${link}">${docTitle}</a>`
            : `<a href="${link}">${docTitle} (view only)</a>`

        const existing = document.getElementById('collab-share-post-overlay')
        if (existing) existing.remove()

        const overlay = document.createElement('div')
        overlay.id = 'collab-share-post-overlay'
        overlay.innerHTML = `
            <p class="overlay-instructions">Create a message to share this link, then Post it to any of your accounts using 'Post'.</p>
            <textarea id="collab-share-post-editor"></textarea>
            <div class="overlay-toolbar">
                <button class="collab-share-btn" id="collab-share-post-btn">Post</button>
                <button class="collab-share-btn" id="collab-share-close-btn">Cancel</button>
            </div>
        `
        document.getElementById('collabDiv').appendChild(overlay)

        const prevEditor = typeof currentEditor !== 'undefined' ? currentEditor : null

        function closeOverlay() {
            if (typeof tinymce !== 'undefined') {
                const ed = tinymce.get('collab-share-post-editor')
                if (ed) ed.remove()
            }
            if (typeof editorHandlers !== 'undefined') delete editorHandlers['collab-share']
            if (prevEditor !== null && typeof currentEditor !== 'undefined') currentEditor = prevEditor
            overlay.remove()
        }

        document.getElementById('collab-share-close-btn').addEventListener('click', closeOverlay)
        document.getElementById('collab-share-post-btn').addEventListener('click', () => {
            if (typeof playPost === 'function') {
                window._onPostAllComplete = closeOverlay
                playPost()
            }
        })

        if (typeof editorHandlers !== 'undefined') {
            editorHandlers['collab-share'] = {
                label: 'Share Post',
                getContent: async () => {
                    const ed = typeof tinymce !== 'undefined' && tinymce.get('collab-share-post-editor')
                    return ed ? ed.getContent() : (document.getElementById('collab-share-post-editor')?.value || '')
                },
            }
        }
        if (typeof currentEditor !== 'undefined') currentEditor = 'collab-share'

        setTimeout(() => {
            if (typeof tinymce !== 'undefined') {
                tinymce.init({
                    selector: '#collab-share-post-editor',
                    height: 200,
                    menubar: false,
                    plugins: 'link',
                    toolbar: 'bold italic link | undo redo',
                    statusbar: false,
                    setup(editor) {
                        editor.on('init', () => editor.setContent(`<p>${linkHtml}</p>`))
                    },
                })
            } else {
                const ta = document.getElementById('collab-share-post-editor')
                if (ta) {
                    ta.style.cssText = 'width:100%;flex:1;font-size:0.9em;padding:7px;border:1px solid #ccc;border-radius:3px;box-sizing:border-box;font-family:inherit'
                    ta.value = `${docTitle}: ${link}`
                }
            }
        }, 50)
    }

    async function shareCollabDoc() {
        if (!currentDocId) { showStatusMessage('Join a document first before sharing.'); return }

        const base     = wsUrlToRestBase(currentWsUrl)
        const token    = getSiteSpecificCookie(flaskSiteUrl, 'access_token') || ''
        const docTitle = currentDocTitle || currentDocId

        let allowAnon = false
        try {
            const resp = await fetch(`${base}/api/documents/${encodeURIComponent(currentDocId)}`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            })
            if (resp.ok) allowAnon = !!(await resp.json()).allow_anonymous
        } catch { /* use default */ }

        // Chat buttons only shown when a P2P discussion is currently active
        const chatActive = typeof activeDiscussionName !== 'undefined' && !!activeDiscussionName

        function linkRow(mode, label) {
            const link = getCollabShareLink(mode)
            const chatBtn = chatActive
                ? `<button class="collab-share-btn" onclick="window.shareCollabViaChat('${mode}')">Chat</button>`
                : ''
            return `
                <div style="margin-bottom:14px">
                    <div style="font-weight:600;font-size:0.85em;margin-bottom:4px">${label}</div>
                    <div style="display:flex;gap:5px;align-items:center;margin-bottom:5px">
                        <code style="flex:1;font-size:11px;background:#f5f5f5;padding:3px 6px;
                                     border:1px solid #ddd;border-radius:3px;overflow:hidden;
                                     white-space:nowrap;text-overflow:ellipsis">${link}</code>
                        <button class="collab-share-btn" onclick="window.copyCollabLink('${mode}')">Copy</button>
                    </div>
                    <div style="display:flex;gap:5px">
                        ${chatBtn}
                        <button class="collab-share-btn" onclick="window.openCollabSharePost('${mode}')">Post</button>
                    </div>
                </div>`
        }

        showModal(`
            <div style="width:min(560px,90vw)">
                <h3 style="margin:0 0 14px">Share &ldquo;${docTitle}&rdquo;</h3>
                <label style="display:flex;align-items:center;gap:8px;margin-bottom:16px;cursor:pointer;font-size:0.9em">
                    <input type="checkbox" id="collab-anon-check"${allowAnon ? ' checked' : ''}>
                    <span>Allow anyone to read (no login required)</span>
                </label>
                ${linkRow('edit', 'Co-edit link')}
                ${linkRow('read', 'Read-only link')}
            </div>
        `)

        setTimeout(() => {
            const check = document.getElementById('collab-anon-check')
            if (!check) return
            check.addEventListener('change', async () => {
                try {
                    const r = await fetch(`${base}/api/documents/${encodeURIComponent(currentDocId)}`, {
                        method:  'PATCH',
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                        body:    JSON.stringify({ allow_anonymous: check.checked }),
                    })
                    if (!r.ok) throw new Error(r.status)
                    showStatusMessage(check.checked
                        ? 'Anyone can now read this document.'
                        : 'Login now required to read this document.')
                } catch (e) {
                    console.error('allow_anonymous update failed:', e)
                    showStatusMessage('Could not update sharing settings: ' + e.message)
                    check.checked = !check.checked
                }
            })
        }, 50)
    }

    window.shareCollabDoc = shareCollabDoc

    // --- Connect to a collaborative document ---

    async function connectToDoc(docId, mode = 'edit', overrideWsUrl = null) {
        const wsUrl = overrideWsUrl || await getCollabWsUrl()
        currentWsUrl = wsUrl

        await loadDeps()
        const { Editor, StarterKit, Collaboration, CollaborationCursor, HocuspocusProvider, Y } = deps

        const statusEl = document.getElementById('collab-status')
        if (statusEl) statusEl.textContent = 'connecting…'

        // Tear down any previous session
        if (hocuspocusProvider) { hocuspocusProvider.destroy(); hocuspocusProvider = null }
        if (tiptapEditor)       { tiptapEditor.destroy();       tiptapEditor = null }

        const rawToken = getSiteSpecificCookie(flaskSiteUrl, 'access_token')
        const token    = (mode === 'read' && !rawToken) ? 'anonymous' : (rawToken || 'anonymous')
        const userName = (typeof window.username !== 'undefined' && window.username !== 'none')
            ? window.username
            : getSiteSpecificCookie(flaskSiteUrl, 'username') || 'Anonymous'
        const userColor = '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0')

        const ydoc = new Y.Doc()

        hocuspocusProvider = new HocuspocusProvider({
            url:        wsUrl,
            name:       docId,
            document:   ydoc,
            token,
            parameters: { kvstoreUrl: flaskSiteUrl, ...(mode === 'read' ? { mode: 'read' } : {}) },
            onStatus: ({ status }) => {
                if (statusEl) statusEl.textContent = status
            },
            onAuthenticationFailed: () => {
                showStatusMessage('Collaboration: authentication failed — make sure you are logged in.')
            },
        })

        hocuspocusProvider.awareness.on('update', updateWhoList)

        tiptapEditor = new Editor({
            element:    document.getElementById('tiptap-editor'),
            editable:   mode !== 'read',
            extensions: [
                StarterKit.configure({ history: false }),
                Collaboration.configure({ document: ydoc }),
                CollaborationCursor.configure({
                    provider: hocuspocusProvider,
                    user: { name: userName, color: userColor },
                }),
            ],
        })

        buildFormatToolbar()
        currentDocId = docId
        setTimeout(updateWhoList, 200)  // show self after awareness propagates
    }

    // --- Load handler: browse and open existing collab documents ---

    ;(function () {
        window.loadHandlers = window.loadHandlers || []
        window.loadHandlers.push({
            label: 'Collab documents',
            icon:  'group',
            load:  async () => {
                const optionsDiv = document.getElementById('load-options')
                optionsDiv.innerHTML = '<p class="list-tip">Loading documents…</p>'
                try {
                    const wsUrl = await getCollabWsUrl()
                    const base  = wsUrlToRestBase(wsUrl)
                    const token = getSiteSpecificCookie(flaskSiteUrl, 'access_token') || ''
                    const resp  = await fetch(`${base}/api/documents`, {
                        headers: { Authorization: `Bearer ${token}` }
                    })
                    if (!resp.ok) throw new Error(`Server returned ${resp.status}`)
                    const docs = await resp.json()

                    optionsDiv.innerHTML = ''
                    if (!docs.length) {
                        optionsDiv.innerHTML = '<p class="list-tip">No documents yet — enter a document ID in the Collab editor to create one.</p>'
                        return null
                    }

                    const list = document.createElement('div')
                    list.className = 'account-list'
                    const tip = document.createElement('div')
                    tip.className = 'list-tip'
                    tip.textContent = 'Select a document to open'
                    list.appendChild(tip)

                    docs.forEach(doc => {
                        const btn = document.createElement('button')
                        btn.className = 'account-button'
                        const icon = document.createElement('span')
                        icon.className = 'material-icons'
                        icon.textContent = 'article'
                        const name = document.createElement('span')
                        name.textContent = doc.title || localPartOf(doc.id)
                        btn.appendChild(icon)
                        btn.appendChild(name)
                        btn.addEventListener('click', async () => {
                            if (currentEditor !== 'collab') await initializeEditor('collab')
                            setDocTitle(localPartOf(doc.id))
                            currentDocTitle = doc.title || ''
                            try { await connectToDoc(doc.id) }
                            catch (e) { showStatusMessage('Connection failed: ' + e.message) }
                            closeRightPane()
                        })
                        list.appendChild(btn)
                    })
                    optionsDiv.appendChild(list)
                } catch (e) {
                    console.error('Collab load error:', e)
                    optionsDiv.innerHTML = `<p class="feed-status-message">Could not load documents: ${e.message}</p>`
                }
                return null
            }
        })
    })()

    // --- editorHandlers entry ---

    const collabHandler = {
        label:           'Collab',
        icon:            'group',
        contentTypes:    ['text/html'],
        requiresAccount: false,

        initialize: async () => {
            currentEditor = 'collab'
            injectStyles()

            const writePaneContent = document.getElementById('write-pane-content')
            let collabDiv = document.getElementById('collabDiv')

            if (!collabDiv) {
                collabDiv = document.createElement('div')
                collabDiv.id = 'collabDiv'
                collabDiv.innerHTML = `
                    <div id="collab-toolbar">
                        <div id="collab-doc-picker">
                            <input id="collab-doc-id" type="hidden">
                            <button id="collab-invite-btn" title="Share this document">Share</button>
                        </div>
                        <div id="collab-doc-warning" style="display:none;font-size:0.8em;color:#a00;padding:2px 0;gap:6px;align-items:center"></div>
                        <div id="collab-format-toolbar"></div>
                        <div id="collab-who"></div>
                        <div id="collab-status"></div>
                    </div>
                    <div id="collab-editor-container">
                        <div id="tiptap-editor"></div>
                    </div>`
                writePaneContent.appendChild(collabDiv)
            }

            collabDiv.style.display = 'block'

            // Wire input and share button once
            if (!collabDiv.dataset.wired) {
                const input = document.getElementById('collab-doc-id')

                input.addEventListener('input', scheduleDupCheck)

                // Keep write-title in sync with the collab doc input
                const writeTitle = document.getElementById('write-title')
                if (writeTitle) {
                    writeTitle.addEventListener('input', () => {
                        if (currentEditor !== 'collab') return
                        input.value = writeTitle.textContent.trim()
                        scheduleDupCheck()
                    })
                    // If the user pastes a collab share URL into the title field, open it directly
                    writeTitle.addEventListener('paste', (e) => {
                        const text = e.clipboardData.getData('text').trim()
                        if (isCollabUrl(text)) {
                            e.preventDefault()
                            openCollabUrl(text)
                        }
                    })
                }

                input.addEventListener('keydown', async (e) => {
                    if (e.key !== 'Enter') return
                    e.preventDefault()
                    if (dupCheckTimer) { clearTimeout(dupCheckTimer); dupCheckTimer = null }
                    const warning = document.getElementById('collab-doc-warning')
                    // If warning is visible with a load button, Enter loads the existing doc
                    const loadBtn = warning && warning.querySelector('#collab-load-existing')
                    if (loadBtn) { loadBtn.click(); return }
                    await connectFromInput()
                })

                document.getElementById('collab-invite-btn').addEventListener('click', async () => {
                    if (!currentDocId) await connectFromInput()
                    if (currentDocId) shareCollabDoc()
                })
                collabDiv.dataset.wired = '1'
            }

            // Preload deps so the first connect is fast
            try {
                await loadDeps()
            } catch (e) {
                console.error('Failed to load collab dependencies:', e)
                showStatusMessage('Could not load collaboration library — check your network connection.')
                return
            }

            if (currentDocId) {
                // Re-activating after switching away — restore display title
                setDocTitle(localPartOf(currentDocId))
            } else {
                // Fresh open — show a slug and start local editor; press Enter to connect
                setDocTitle(generateDocSlug())
                await initLocalEditor()
            }

            loadPredefinedContent('collab')
        },

        getContent: async () => {
            if (!tiptapEditor) return ''
            return tiptapEditor.getHTML()
        },

        loadContent: ({ type, value }, itemId) => {
            if (!tiptapEditor) {
                showStatusMessage('Join a document first, then load content into it.')
                return
            }
            const html = (type === 'text/html') ? value : `<p>${value}</p>`
            tiptapEditor.commands.insertContent(html)

            if (itemId) {
                const editorDiv = document.getElementById('collabDiv')
                const reference = createReference(itemId, editorDiv)
                displayCurrentReference(reference, editorDiv)
                displayReferences(editorDiv)
            }
        },
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

    // Called by chat invite cards — switches to Collab editor and connects.
    window.openCollabInvite = async function(invite) {
        try {
            if (typeof initializeEditor === 'function' && currentEditor !== 'collab') {
                await initializeEditor('collab')
            }
            setDocTitle(localPartOf(invite.docId))
            currentDocTitle = invite.title || ''
            await connectToDoc(invite.docId, invite.mode || 'edit', invite.server || null)
        } catch (e) {
            showStatusMessage('Failed to open collab document: ' + e.message)
        }
    }

})()
