import './style.css'
import * as Y from 'yjs'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Collaboration from '@tiptap/extension-collaboration'
import { HocuspocusProvider } from '@hocuspocus/provider'

const SW = 1280, SH = 720
const $ = id => document.getElementById(id)
const slide = $('slide')
const params = new URLSearchParams(location.search)
const doc = new Y.Doc()
const objects = doc.getMap('slide-objects')
const views = new Map()
let provider = null
let connected = false
let selected = null
let editorFocused = null
let seeded = false
let activePointer = null
const origin = params.get('origin') || location.origin

$('server-url').value = params.get('ws') || ''
$('doc-name').value = params.get('doc') || 'clist-slide-demo'

function status(message, kind = '') {
  $('connection-status').textContent = message
  $('connection-status').className = `status ${kind}`
}
function makeBox(id, x, y, width, height) {
  const box = new Y.Map()
  box.set('x', x); box.set('y', y)
  box.set('width', width); box.set('height', height)
  box.set('rotation', 0)
  objects.set(id, box)
}
function seedIfEmpty() {
  if (objects.size || seeded) return
  seeded = true
  doc.transact(() => {
    if (objects.size) return
    makeBox('title', 105, 98, 820, 135)
    makeBox('body', 108, 296, 690, 240)
  }, 'init')
  // Seed rich text only when we created the default document.
  views.get('title')?.editor.commands.setContent('<h1>Collaborative slides</h1>')
  views.get('body')?.editor.commands.setContent('<p>Click here to edit together.</p><p>Drag the blue handle to move this box, or resize it from the lower-right corner.</p>')
}
function createView(id, box) {
  const node = document.createElement('div')
  node.className = 'slide-object'
  node.dataset.id = id
  const grip = document.createElement('div')
  grip.className = 'object-grip'; grip.textContent = '⠿ Move'
  const content = document.createElement('div')
  content.className = 'text-content'
  const resize = document.createElement('div')
  resize.className = 'resize-handle'
  node.append(grip, content, resize)
  slide.append(node)
  // A different named Y.XmlFragment for each text box within the SAME Y.Doc.
  const editor = new Editor({
    element: content,
    extensions: [
      StarterKit.configure({ undoRedo: false }),
      Collaboration.configure({ document: doc, field: `slide-text-${id}` }),
    ],
    editorProps: {
      attributes: { 'aria-label': `Edit text in ${id}` },
    },
    onFocus: () => { editorFocused = id; select(id) },
    onBlur: () => { if (editorFocused === id) editorFocused = null },
  })
  node.addEventListener('pointerdown', e => { if (e.target !== resize && e.target !== grip) select(id) })
  grip.addEventListener('pointerdown', e => beginDrag(e, id, 'move'))
  resize.addEventListener('pointerdown', e => beginDrag(e, id, 'resize'))
  views.set(id, { node, editor, box })
  applyGeometry(id)
  if (selected === id) node.classList.add('selected')
}
function applyGeometry(id) {
  const view = views.get(id)
  if (!view) return
  const { node, box } = view
  node.style.left = `${100 * Number(box.get('x') || 0) / SW}%`
  node.style.top = `${100 * Number(box.get('y') || 0) / SH}%`
  node.style.width = `${100 * Number(box.get('width') || 0) / SW}%`
  node.style.height = `${100 * Number(box.get('height') || 0) / SH}%`
  node.style.transform = `rotate(${Number(box.get('rotation') || 0)}deg)`
}
function render() {
  for (const [id, view] of views) {
    if (!objects.has(id)) {
      view.editor.destroy(); view.node.remove(); views.delete(id)
      if (selected === id) selected = null
    }
  }
  objects.forEach((box, id) => {
    if (!(box instanceof Y.Map)) return
    if (!views.has(id)) createView(id, box)
    else applyGeometry(id)
  })
  $('count').textContent = `${objects.size} text box${objects.size === 1 ? '' : 'es'}`
  select(selected)
}
function select(id) {
  selected = id && views.has(id) ? id : null
  for (const [other, view] of views) view.node.classList.toggle('selected', other === selected)
  const box = selected ? objects.get(selected) : null
  $('selection-details').textContent = box
    ? `${selected}\nPosition: ${Math.round(box.get('x'))}, ${Math.round(box.get('y'))}\nSize: ${Math.round(box.get('width'))} × ${Math.round(box.get('height'))}`
    : 'Select a text box'
  $('duplicate').disabled = !selected
  $('delete').disabled = !selected
}
function beginDrag(e, id, action) {
  if (e.button !== 0) return
  e.preventDefault(); e.stopPropagation()
  select(id)
  const box = objects.get(id)
  if (!box) return
  const scale = SW / slide.getBoundingClientRect().width
  activePointer = {
    id, action, startX: e.clientX, startY: e.clientY, scale,
    original: {
      x: box.get('x'), y: box.get('y'), width: box.get('width'), height: box.get('height'),
    },
  }
  e.currentTarget.setPointerCapture(e.pointerId)
  e.currentTarget.addEventListener('pointermove', onPointerMove)
  e.currentTarget.addEventListener('pointerup', stopDrag, { once: true })
  e.currentTarget.addEventListener('pointercancel', stopDrag, { once: true })
}
function onPointerMove(e) {
  if (!activePointer) return
  const { id, action, startX, startY, scale, original } = activePointer
  const box = objects.get(id)
  if (!box) return
  const dx = (e.clientX - startX) * scale
  const dy = (e.clientY - startY) * scale
  doc.transact(() => {
    if (action === 'move') {
      box.set('x', Math.round(Math.max(0, Math.min(SW - original.width, original.x + dx))))
      box.set('y', Math.round(Math.max(0, Math.min(SH - original.height, original.y + dy))))
    } else {
      box.set('width', Math.round(Math.max(100, Math.min(SW - original.x, original.width + dx))))
      box.set('height', Math.round(Math.max(55, Math.min(SH - original.y, original.height + dy))))
    }
  }, 'geometry')
}
function stopDrag(e) {
  e.currentTarget.removeEventListener('pointermove', onPointerMove)
  activePointer = null
}
objects.observeDeep(render)

function newId() { return `box-${crypto.randomUUID()}` }
$('add-text').addEventListener('click', () => {
  const id = newId()
  makeBox(id, 160, 220, 430, 130)
  select(id)
  views.get(id)?.editor.commands.focus()
})
$('duplicate').addEventListener('click', () => {
  if (!selected) return
  const old = objects.get(selected)
  const id = newId()
  makeBox(id, Math.min(SW - old.get('width'), old.get('x') + 28), Math.min(SH - old.get('height'), old.get('y') + 28), old.get('width'), old.get('height'))
  // Copy rich content through Tiptap's supported JSON representation.
  const src = views.get(selected)?.editor
  const dst = views.get(id)?.editor
  if (src && dst) dst.commands.setContent(src.getJSON())
  select(id)
})
$('delete').addEventListener('click', () => { if (selected) objects.delete(selected) })
$('bold').addEventListener('click', () => { if (selected) views.get(selected)?.editor.chain().focus().toggleBold().run() })
$('italic').addEventListener('click', () => { if (selected) views.get(selected)?.editor.chain().focus().toggleItalic().run() })

function snapshot() {
  const bytes = Y.encodeStateAsUpdate(doc)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return { format: 'clist-slides-yjs-v1', document: $('doc-name').value, update: btoa(binary) }
}
function loadSnapshot(data) {
  if (!data || data.format !== 'clist-slides-yjs-v1' || typeof data.update !== 'string') throw new Error('Unsupported document format')
  const raw = atob(data.update)
  const bytes = Uint8Array.from(raw, c => c.charCodeAt(0))
  Y.applyUpdate(doc, bytes)
}
$('export').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(snapshot(), null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = 'clist-slide-demo.json'; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
})
$('import').addEventListener('click', () => $('import-file').click())
$('import-file').addEventListener('change', async e => {
  const file = e.target.files[0]; if (!file) return
  try { loadSnapshot(JSON.parse(await file.text())); status('Snapshot merged into document') }
  catch (err) { status(`Import failed: ${err.message}`, 'error') }
  e.target.value = ''
})

function disconnect() {
  provider?.destroy(); provider = null; connected = false
  status('Local only')
  $('connect').textContent = 'Connect'
}
function connect() {
  if (provider) { disconnect(); return }
  const url = $('server-url').value.trim()
  const name = $('doc-name').value.trim()
  if (!/^wss?:\/\//i.test(url) || !name) { status('Enter a WebSocket URL and document name', 'error'); return }
  // If the page was already edited locally, retain those edits and merge on sync.
  provider = new HocuspocusProvider({
    url, name, document: doc,
    ...( $('token').value ? { token: $('token').value } : {} ),
    onStatus: ({ status: state }) => { status(state === 'connected' ? 'Connected' : 'Connecting…', state === 'connected' ? 'connected' : '') },
    onSynced: () => { connected = true; seedIfEmpty(); status('Synced', 'connected') },
    onAuthenticationFailed: () => status('Authentication failed', 'error'),
    onDisconnect: () => { connected = false; status('Disconnected', 'error') },
  })
  $('connect').textContent = 'Disconnect'
  status('Connecting…')
}
$('connect').addEventListener('click', connect)

// Embed API: origin must be explicitly provided (?origin=https://clist.example).
// Non-sensitive ready metadata can be broadcast to a parent; document data cannot.
function messageParent(kind, payload = {}, target = origin) {
  if (window.parent !== window) window.parent.postMessage({ app: 'clist-slides', kind, ...payload }, target)
}
window.addEventListener('message', ({ data, origin: sender }) => {
  if (window.parent === window || sender !== origin || !data || data.app !== 'clist-slides') return
  try {
    if (data.kind === 'get-snapshot') messageParent('snapshot', { requestId: data.requestId, snapshot: snapshot() }, sender)
    if (data.kind === 'load-snapshot') {
      loadSnapshot(data.snapshot)
      messageParent('loaded', { requestId: data.requestId }, sender)
    }
  } catch (err) { messageParent('error', { requestId: data.requestId, message: err.message }, sender) }
})

// When connecting, wait until the first sync before creating the starter boxes.
// Otherwise two new clients might race to seed the presentation.
if (params.get('ws')) connect()
else seedIfEmpty()
render()
messageParent('ready', { version: 1 })
window.addEventListener('beforeunload', () => { provider?.destroy(); for (const v of views.values()) v.editor.destroy(); doc.destroy() })
