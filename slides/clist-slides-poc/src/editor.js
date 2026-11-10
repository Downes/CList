import template from './template.js'
import { importedHtml, normalizedReference } from './import-content.js'
import { mountTextOverflow } from './overflow.js'
import { mountMarquee } from './marquee.js'
import { mountCanvasZoom } from './zoom.js'
import { setToolbarIcon } from './icons.js'
import { createPresenterWindow, renderPresenterText } from './presenter.js'
import { openSlidePrintView } from './print.js'
import { exportPowerPoint, textRuns } from './powerpoint.js'
import { readPowerPoint } from './powerpoint-import.js'
import { createRecoverySnapshot } from './recovery-snapshot.js'
import { moveSelectedSlides, dropSelectedSlides } from './slide-order.js'
import { mountFindReplace } from './find-replace.js'
import { buildStandaloneHtml, exportStandaloneHtml } from './html-export.js'
import { buildSlideArticle } from './article-export.js'
import { prepareSlideCatalogs, validateShapeDefinition, validateThemeDefinition } from './catalogs.js'

// Dependencies are supplied by the host so CList uses one Yjs/Tiptap runtime.
export function createSlideEditor(container, options = {}) {
if (!(container instanceof HTMLElement)) throw new TypeError('A container element is required')
const { Y, Editor, StarterKit, Collaboration, HocuspocusProvider, Link } = options.dependencies
const { shapes: shapeCatalog, layouts: layoutCatalog, themes: themeCatalog } = prepareSlideCatalogs(options.catalogs)
const fallbackShape = prepareSlideCatalogs().shapes.values().next().value
const embeddedShapes = new WeakMap()
const savedLayouts = new Map()
const root = document.createElement('div')
root.className = 'clist-slides app'
root.innerHTML = template
container.append(root)
const SW = 1280, SH = 720
const $ = id => root.querySelector(`[data-control="${id}"]`)
const slideOrderActions = $('slide-order-actions')
for (const button of root.querySelectorAll('.tools button')) setToolbarIcon(button)
for (const definition of shapeCatalog.values()) {
  const button = document.createElement('button')
  button.className = 'btn-small'
  button.dataset.control = 'add-' + definition.id
  button.title = 'Add ' + definition.label
  setToolbarIcon(button, definition)
  button.addEventListener('click', () => addCatalogShape(definition.id))
  $('shape-tools').append(button)
}
for (const layout of layoutCatalog.values()) {
  const option = document.createElement('option')
  option.value = layout.id
  option.textContent = layout.label
  $('slide-layout').append(option)
}
const slide = $('slide')
const verticalGuide = document.createElement('div')
const horizontalGuide = document.createElement('div')
verticalGuide.className = 'alignment-guide vertical'
horizontalGuide.className = 'alignment-guide horizontal'
verticalGuide.hidden = horizontalGuide.hidden = true
slide.append(verticalGuide, horizontalGuide)

let doc = new Y.Doc()
let objects = doc.getMap('slide-objects')
let pages = doc.getMap('slide-pages')
let backgrounds = doc.getMap('slide-backgrounds')
let notes = doc.getMap('slide-notes')
let references = doc.getMap('clist_refs')
let design = doc.getMap('slide-design')
let activeSlide = 'first'
let selectedSlides = new Set(['first']), slideSelectionActive = 'first', slideAnchor = 'first'
const views = new Map()
const objectButtons = new Map()
const thumbnailViews = new Map(), thumbnailObjectSlides = new Map(), thumbnailObjects = new Map(), dirtyThumbnails = new Set()
let thumbnailBoxIds = new WeakMap(), thumbnailTextIds = new WeakMap(), allThumbnailsDirty = true, thumbnailOrder = ''
let provider = null
let connected = false
const selectedIds = new Set()
let selected = null
let editorFocused = null
let seeded = false
let activePointer = null
let connectionAttempt = 0
let replacementTarget = null
let pasteSurfaceActive = false
let pastePoint = null
let objectClipboard = null
let formatClipboard = null
let linkTarget = null
let history = null
let suppressHistory = false
let presenting = false
let presentationFocus = null
let presenter = null
let textOverflow = null
let marquee = null
let inspectorSelection = null
let managingLayout = false
let findReplace = null, navigatingFind = false
const recoverySnapshot = createRecoverySnapshot({ getDocument: () => doc, encode: Y.encodeStateAsUpdate, getName: () => $('doc-name').value,
  onError: error => { console.error('Background recovery failed:', error); status('Background recovery failed: ' + error.message, 'error') } })
const canvasZoom = mountCanvasZoom(root, () => presenting)
let draggedSlide = null
let draggedSlides = []
let slideDropBefore = null


$('server-url').value = options.url || ''
$('doc-name').value = options.documentName || 'clist-slide-demo'

function status(message, kind = '') {
  $('connection-status').textContent = message
  $('connection-status').className = `status ${kind}`
}
function notifyChange(update) { recoverySnapshot.changed(update); findReplace?.changed(); options.onChange?.() }
function actionStatus(message) { if (options.onStatus) options.onStatus(message); else status(message) }
function makeBox(id, x, y, width, height, imageSource = null, imageAlt = '') {
  const box = new Y.Map()
  box.set('x', x); box.set('y', y)
  box.set('width', width); box.set('height', height)
  box.set('rotation', 0)
  box.set('slide', activeSlide)
  box.set('layer', Math.max(-1, ...orderedObjectIds().map(key => objectLayer(objects.get(key)))) + 1)
  if (imageSource) { box.set('kind', 'image'); box.set('source', imageSource); box.set('alt', imageAlt); box.set('imageRatio', width / height); box.set('aspectRatio', width / height); box.set('keepAspectRatio', true) }
  objects.set(id, box)
}
function seedIfEmpty() {
  if (objects.size || seeded) return
  seeded = true
  doc.transact(() => {
    if (objects.size) return
    if (!design.has('theme')) design.set('theme', structuredClone(currentTheme()))
    makeBox('title', 105, 98, 820, 135)
    makeBox('body', 108, 296, 690, 240)
  }, 'init')
  // Seed rich text only when we created the default document.
  views.get('title')?.editor.commands.setContent('<h1>Collaborative slides</h1>')
  views.get('body')?.editor.commands.setContent('<p>Click here to edit together.</p><p>Drag the blue handle to move this box, or resize it from the lower-right corner.</p>')
}
function createView(id, box) {
  const node = document.createElement('div')
  node.className = box.get('kind') === 'shape' ? 'slide-object shape-object' : 'slide-object'
  node.dataset.id = id
  node.tabIndex = 0
  node.setAttribute('aria-label', box.get('kind') === 'shape' ? 'Shape object. Arrow keys move; Delete removes.' : box.get('kind') === 'image' ? 'Image object. Arrow keys move; Delete removes.' : 'Text object. Arrow keys move; Enter edits.')
  const grip = document.createElement('div')
  grip.className = 'object-grip'; grip.textContent = 'Move'
  const content = document.createElement('div')
  content.className = box.get('kind') === 'shape' ? 'shape-content' : box.get('kind') === 'image' ? 'image-content' : 'text-content'
  const resize = document.createElement('div')
  resize.className = 'resize-handle'
  node.append(grip, content, resize)
  slide.append(node)
  // A different named Y.XmlFragment for each text box within the SAME Y.Doc.
  let editor = null
  if (box.get('kind') === 'shape') {
    content.append(document.createElementNS('http://www.w3.org/2000/svg', 'svg'))
  } else if (box.get('kind') === 'image') {
    const image = document.createElement('img')
    image.src = safeImageSource(box.get('source'))
    image.alt = typeof box.get('alt') === 'string' ? box.get('alt') : ''
    image.draggable = false
    image.addEventListener('load', () => { if (views.has(id)) applyGeometry(id) })
    content.append(image)
  } else {
    const fragment = doc.getXmlFragment(`slide-text-${id}`)
    history?.addToScope(fragment)
    suppressHistory = true
    try { editor = new Editor({
    element: content,
    editable: !presenting,
    extensions: [
      StarterKit.configure({ undoRedo: false, history: false, link: false }),
      Link.configure({ openOnClick: false, HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer' } }),
      Collaboration.configure({ document: doc, field: `slide-text-${id}` }),
    ],
    editorProps: {
      attributes: { 'aria-label': `Edit text in ${id}` },
    },
    onFocus: () => { editorFocused = id; select(id, false, selectedIds.has(id)) },
    onBlur: () => { if (editorFocused === id) editorFocused = null; history?.stopCapturing() },
  }) } finally { suppressHistory = false }
  }
  node.addEventListener('pointerdown', e => {
    if (presenting) return
    if (e.shiftKey && e.target !== resize && e.target !== grip) {
      e.preventDefault(); e.stopPropagation()
      select(id, true, false, true)
      root.tabIndex = -1; root.focus({ preventScroll: true })
      return
    }
    if (e.target !== resize && e.target !== grip) select(id, false, false, true)
    if (!editor) node.focus({ preventScroll: true })
  })
  node.addEventListener('focus', () => select(id, false, selectedIds.has(id)))
  grip.addEventListener('pointerdown', e => beginDrag(e, id, 'move'))
  resize.addEventListener('pointerdown', e => beginDrag(e, id, 'resize'))
  views.set(id, { node, editor, box, content })
  applyGeometry(id)
  if (selected === id) node.classList.add('selected')
}
const fontFamilies = {
  system: 'system-ui, sans-serif',
  arial: 'Arial, Helvetica, sans-serif',
  verdana: 'Verdana, Geneva, sans-serif',
  georgia: 'Georgia, serif',
  times: '"Times New Roman", Times, serif',
  courier: '"Courier New", Courier, monospace',
}
function currentTheme() {
  const saved = design.get('theme')
  if (saved) { try { return validateThemeDefinition(saved) } catch (error) { /* Invalid incoming themes use safe defaults. */ } }
  return themeCatalog.values().next().value
}
for (const theme of themeCatalog.values()) {
  const option = document.createElement('option')
  option.value = theme.id; option.textContent = theme.label
  $('theme').append(option)
}
$('theme').addEventListener('change', event => {
  const theme = themeCatalog.get(event.target.value)
  if (!theme || presenting) return
  history?.stopCapturing()
  design.set('theme', structuredClone(theme))
  history?.stopCapturing()
  status('Theme applied: ' + theme.label)
})
function renderTheme() {
  const theme = currentTheme()
  let custom = $('theme').querySelector('[data-document-theme]')
  if (!themeCatalog.has(theme.id)) {
    if (!custom) { custom = document.createElement('option'); custom.dataset.documentTheme = ''; $('theme').append(custom) }
    custom.value = theme.id; custom.textContent = theme.label + ' (saved in presentation)'
  } else custom?.remove()
  $('theme').value = theme.id
  const preview = $('theme-preview')
  preview.replaceChildren()
  for (const colour of [theme.background, theme.textColour, theme.fillColour, theme.borderColour]) {
    const swatch = document.createElement('span'); swatch.style.backgroundColor = colour; preview.append(swatch)
  }
}
function boxStyle(box) {
  const theme = currentTheme()
  const colour = (key, fallback) => /^#[0-9a-f]{6}$/i.test(box.get(key) || '') ? box.get(key) : fallback
  const width = Number(box.get('borderWidth'))
  return {
    fill: box.get('fillEnabled') === true,
    fillColour: colour('fillColour', box.get('kind') === 'shape' ? theme.fillColour : theme.background),
    border: box.get('borderEnabled') === true,
    borderColour: colour('borderColour', theme.borderColour),
    width: Number.isFinite(width) && width >= 1 && width <= 20 ? width : 2,
  }
}
function textStyle(box) {
  const theme = currentTheme()
  const size = Number(box.get('fontSize'))
  const colour = box.get('textColour')
  const align = box.get('textAlign')
  return {
    size: Number.isFinite(size) && size >= 8 && size <= 200 ? size : theme.fontSize,
    colour: typeof colour === 'string' && /^#[0-9a-f]{6}$/i.test(colour) ? colour : theme.textColour,
    align: ['left', 'center', 'right', 'justify'].includes(align) ? align : 'left',
    family: Object.prototype.hasOwnProperty.call(fontFamilies, box.get('fontFamily')) ? box.get('fontFamily') : theme.fontFamily,
  }
}
function objectLayer(box) {
  const value = box.get('layer')
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}
function orderedObjectIds(slideId = activeSlide) {
  return [...objects.keys()].filter(id => {
    const box = objects.get(id)
    return box instanceof Y.Map && (box.get('slide') || 'first') === slideId
  }).sort((a, b) => objectLayer(objects.get(a)) - objectLayer(objects.get(b)) || a.localeCompare(b))
}
function imageCrop(box) {
  const percent = key => {
    const value = box.get(key)
    return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 50
  }
  return { fit: box.get('imageFit') === 'cover' ? 'cover' : 'contain', x: percent('cropX'), y: percent('cropY') }
}
function cropImageSize(box, image) {
  const savedWidth = Number(box.get('cropImageWidth')), savedHeight = Number(box.get('cropImageHeight'))
  if (savedWidth > 0 && savedHeight > 0) return { width: savedWidth, height: savedHeight }
  const ratio = image?.naturalWidth > 0 ? image.naturalWidth / image.naturalHeight : Number(box.get('imageRatio')) || imageAspectRatio(box)
  const width = Math.max(box.get('width'), box.get('height') * ratio)
  return { width, height: width / ratio }
}
function freezeCropSize(box) {
  if (box.get('kind') !== 'image' || box.get('imageFit') !== 'cover') return
  const image = views.get([...objects.keys()].find(id => objects.get(id) === box))?.content.querySelector('img')
  const size = cropImageSize(box, image)
  box.set('cropImageWidth', size.width)
  box.set('cropImageHeight', size.height)
}
function styleImage(image, box, canvasImage = false) {
  const crop = imageCrop(box)
  image.style.objectFit = 'contain'
  image.style.objectPosition = crop.x + '% ' + crop.y + '%'
  if (crop.fit === 'cover') {
    const size = cropImageSize(box, image)
    image.style.position = 'absolute'
    image.style.width = canvasImage ? (size.width / 12.8) + 'cqw' : (100 * size.width / box.get('width')) + '%'
    image.style.height = canvasImage ? (size.height / 12.8) + 'cqw' : (100 * size.height / box.get('height')) + '%'
    image.style.left = canvasImage ? ((box.get('width') - size.width) * crop.x / 1280) + 'cqw' : ((box.get('width') - size.width) * crop.x / box.get('width')) + '%'
    image.style.top = canvasImage ? ((box.get('height') - size.height) * crop.y / 1280) + 'cqw' : ((box.get('height') - size.height) * crop.y / box.get('height')) + '%'
  } else {
    image.style.position = 'static'
    image.style.width = image.style.height = '100%'
    image.style.left = image.style.top = ''
  }
}
function shapeDefinition(box) {
  const embedded = box.get('shapeDefinition')
  if (embedded && typeof embedded === 'object') {
    if (!embeddedShapes.has(embedded)) {
      try { embeddedShapes.set(embedded, validateShapeDefinition(embedded)) }
      catch (error) {
        console.error('Invalid saved shape definition:', error)
        status('A saved shape definition is invalid; showing a fallback shape.', 'error')
        embeddedShapes.set(embedded, fallbackShape)
      }
    }
    return embeddedShapes.get(embedded)
  }
  return shapeCatalog.get(box.get('shapeType')) || fallbackShape
}
function shapeProperties(definition) {
  const { fillColour, borderColour, ...defaults } = definition.defaults
  return { kind: 'shape', shapeType: definition.id, shapeDefinition: structuredClone(definition), ...defaults }
}
function drawShape(svg, box) {
  const ns = 'http://www.w3.org/2000/svg'
  const width = Math.max(1, Number(box.get('width')) || 1), height = Math.max(1, Number(box.get('height')) || 1)
  const appearance = boxStyle(box), definition = shapeDefinition(box)
  const stroke = appearance.border ? Math.min(appearance.width, width, height) : 0
  const [vx, vy, vw, vh] = definition.viewBox
  svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height)
  svg.setAttribute('preserveAspectRatio', 'none')
  const group = document.createElementNS(ns, 'g')
  group.setAttribute('transform', 'translate(' + stroke / 2 + ' ' + stroke / 2 + ') scale(' + Math.max(0.001, width - stroke) / vw + ' ' + Math.max(0.001, height - stroke) / vh + ') translate(' + -vx + ' ' + -vy + ')')
  for (const element of definition.elements) {
    const shape = document.createElementNS(ns, element.tag)
    for (const [key, value] of Object.entries(element.attributes)) shape.setAttribute(key, String(value))
    shape.setAttribute('fill', appearance.fill ? appearance.fillColour : 'none')
    shape.setAttribute('stroke', appearance.border ? appearance.borderColour : 'none')
    shape.setAttribute('vector-effect', 'non-scaling-stroke')
    shape.style.strokeWidth = (100 * stroke / width) + 'cqw'
    shape.setAttribute('stroke-linecap', 'round')
    shape.setAttribute('stroke-linejoin', 'round')
    group.append(shape)
  }
  svg.replaceChildren(group)
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
  node.classList.toggle('locked', box.get('locked') === true)
  node.title = box.get('locked') === true ? 'Locked object: select it and click Unlock to move, resize or delete.' : ''
  node.style.zIndex = String(orderedObjectIds().indexOf(id))
  if (box.get('kind') === 'shape') drawShape(view.content.querySelector('svg'), box)
  else if (!view.editor) {
    const image = view.content.querySelector('img')
    const source = safeImageSource(box.get('source'))
    if (image.getAttribute('src') !== source) image.src = source
    image.alt = typeof box.get('alt') === 'string' ? box.get('alt') : ''
    styleImage(image, box, true)
  }
  if (view.editor) {
    const format = textStyle(box)
    node.style.setProperty('--slide-font-size', (format.size / 12.8) + 'cqw')
    node.style.fontFamily = fontFamilies[format.family]
    node.style.color = format.colour
    node.style.textAlign = format.align
    const appearance = boxStyle(box)
    view.content.style.backgroundColor = appearance.fill ? appearance.fillColour : 'transparent'
    view.content.style.border = appearance.border ? (appearance.width / 12.8) + 'cqw solid ' + appearance.borderColour : 'none'
  }
}
function renderNotes() {
  const value = notes.get(activeSlide)
  const text = typeof value === 'string' ? value : ''
  if ($('speaker-notes').value !== text) $('speaker-notes').value = text
}
$('speaker-notes').addEventListener('input', event => {
  if (!presenting) notes.set(activeSlide, event.target.value)
})
function slideBackground(id) {
  const colour = backgrounds.get(id)
  return typeof colour === 'string' && /^#[0-9a-f]{6}$/i.test(colour) ? colour : currentTheme().background
}
$('slide-background').addEventListener('change', event => {
  if (presenting) return
  const colour = event.target.value
  if (!/^#[0-9a-f]{6}$/i.test(colour)) return
  backgrounds.set(activeSlide, colour)
})
function slideIds() {
  return pages.size ? [...pages.keys()].sort((a, b) => (pages.get(a) - pages.get(b)) || a.localeCompare(b)) : ['first']
}
function indexThumbnailObject(id) {
  const previous = thumbnailObjectSlides.get(id), box = objects.get(id)
  if (previous !== undefined) {
    dirtyThumbnails.add(previous)
    thumbnailObjects.get(previous)?.delete(id)
    if (!thumbnailObjects.get(previous)?.size) thumbnailObjects.delete(previous)
    thumbnailObjectSlides.delete(id)
  }
  if (box instanceof Y.Map) {
    const slideId = box.get('slide') || 'first'
    thumbnailObjectSlides.set(id,slideId); thumbnailBoxIds.set(box,id)
    if (!thumbnailObjects.has(slideId)) thumbnailObjects.set(slideId,new Set())
    thumbnailObjects.get(slideId).add(id)
    dirtyThumbnails.add(slideId)
  }
}
function resetThumbnailIndex() {
  thumbnailObjectSlides.clear(); thumbnailObjects.clear(); dirtyThumbnails.clear()
  thumbnailBoxIds = new WeakMap(); thumbnailTextIds = new WeakMap()
  objects.forEach((box,id)=>indexThumbnailObject(id))
  allThumbnailsDirty = true
}
function markThumbnailChanges(transaction) {
  // This runs before rendering observers, so an object move invalidates both slides.
  for (const id of transaction.changed.get(objects) || []) if (id !== null) indexThumbnailObject(id)
  for (const [type,keys] of transaction.changed) {
    if (type === design) allThumbnailsDirty = true
    else if (type === backgrounds) for (const id of keys) dirtyThumbnails.add(id)
    else if (thumbnailBoxIds.has(type)) indexThumbnailObject(thumbnailBoxIds.get(type))
    else {
      let parent = type
      while (parent.parent) parent = parent.parent
      if (!(parent instanceof Y.XmlFragment)) continue
      if (!thumbnailTextIds.has(parent)) {
        for (const [name,fragment] of doc.share) if (name.startsWith('slide-text-')) thumbnailTextIds.set(fragment,name.slice(11))
      }
      const slideId = thumbnailObjectSlides.get(thumbnailTextIds.get(parent))
      if (slideId !== undefined) dirtyThumbnails.add(slideId)
    }
  }
}
function reconcileSlideSelection(ids = slideIds()) {
  if (!ids.includes(activeSlide)) activeSlide = ids[0]
  if (slideSelectionActive !== activeSlide) {
    selectedSlides = new Set([activeSlide]); slideAnchor = activeSlide
  } else {
    selectedSlides = new Set(ids.filter(id => selectedSlides.has(id)))
    if (!selectedSlides.size) selectedSlides.add(activeSlide)
  }
  slideSelectionActive = activeSlide
  if (!ids.includes(slideAnchor)) slideAnchor = activeSlide
}
function selectedSlideIds() { reconcileSlideSelection(); return slideIds().filter(id => selectedSlides.has(id)) }
function setSlideSelection(ids, active = ids[0], anchor = active) {
  selectedSlides = new Set(ids); activeSlide = active; slideSelectionActive = active; slideAnchor = anchor
  selected = null; selectedIds.clear()
}
function focusActiveSlide() { $('slide-list').querySelector(`[data-slide-id="${activeSlide}"]`)?.focus({preventScroll:true}) }
function selectSlide(id, event = {}) {
  const ids = slideIds()
  if (presenting || !ids.includes(id)) return
  stopDrag(); reconcileSlideSelection(ids)
  if (event.shiftKey) {
    const from = ids.indexOf(slideAnchor), to = ids.indexOf(id)
    const range = ids.slice(Math.min(from,to), Math.max(from,to)+1)
    setSlideSelection(event.ctrlKey || event.metaKey ? [...selectedSlides,...range] : range,id,slideAnchor)
  } else if (event.ctrlKey || event.metaKey) {
    const next = new Set(selectedSlides)
    if (next.has(id) && next.size > 1) next.delete(id)
    else next.add(id)
    setSlideSelection([...next],next.has(id) ? id : next.has(activeSlide) ? activeSlide : [...next][0],id)
  } else setSlideSelection([id],id)
  render()
  focusActiveSlide()
}
function renderObjectList() {
  const list = $('object-list')
  const ids = orderedObjectIds().reverse()
  for (const [id, button] of objectButtons) {
    if (!ids.includes(id)) { button.remove(); objectButtons.delete(id) }
  }
  ids.forEach((id, index) => {
    const box = objects.get(id)
    const image = box.get('kind') === 'image'
    const shape = box.get('kind') === 'shape'
    const text = image ? box.get('alt') : views.get(id)?.editor?.getText()
    const name = (typeof text === 'string' ? text : '').replace(/\s+/g, ' ').trim().slice(0, 60)
    const label = shape ? 'Shape: ' + shapeDefinition(box).label : (image ? 'Image: ' : 'Text: ') + (name || (image ? 'Untitled image' : 'Empty text box'))
    let button = objectButtons.get(id)
    if (!button) {
      button = document.createElement('button')
      button.className = 'btn-small'
      button.dataset.objectId = id
      button.addEventListener('click', event => {
        if (presenting) return
        stopDrag()
        select(id, event.shiftKey, false, true)
        root.tabIndex = -1
        root.focus({ preventScroll: true })
      })
      objectButtons.set(id, button)
    }
    button.textContent = label + (box.get('groupId') ? ' (Grouped)' : '') + (box.get('locked') === true ? ' (Locked)' : '')
    button.title = 'Select ' + label + '. Shift-click to add or remove from selection.'
    button.setAttribute('aria-pressed', String(selectedIds.has(id)))
    if (list.children[index] !== button) list.insertBefore(button, list.children[index] || null)
  })
}
function clearSlideDrop() {
  for (const node of root.querySelectorAll('.slide-drop-before, .slide-drop-after, .slide-dragging')) node.classList.remove('slide-drop-before', 'slide-drop-after', 'slide-dragging')
}
function finishSlideDrag() {
  clearSlideDrop()
  draggedSlide = null
  draggedSlides = []
  slideDropBefore = null
}
const slideRail = root.querySelector('.rail')
slideRail.addEventListener('dragstart', event => {
  const button = event.target.closest('[data-slide-id]')
  if (!button || presenting || slideIds().length < 2 || !event.dataTransfer) { event.preventDefault(); return }
  stopDrag()
  const source = button.dataset.slideId
  reconcileSlideSelection()
  if (!selectedSlides.has(source)) setSlideSelection([source])
  draggedSlide = source
  draggedSlides = selectedSlideIds()
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('text/plain', 'CList slide')
  for (const node of $('slide-list').querySelectorAll('[data-slide-id]')) if (draggedSlides.includes(node.dataset.slideId)) node.classList.add('slide-dragging')
})
slideRail.addEventListener('dragover', event => {
  if (!draggedSlide || presenting) return
  event.preventDefault()
  event.dataTransfer.dropEffect = 'move'
  clearSlideDrop()
  const buttons = [...$('slide-list').querySelectorAll(':scope > [data-slide-id]')]
  const before = buttons.find(button => { const rect = button.getBoundingClientRect(); return event.clientY < rect.top + rect.height / 2 })
  slideDropBefore = before?.dataset.slideId || null
  const marker = before || buttons.at(-1)
  marker?.classList.add(before ? 'slide-drop-before' : 'slide-drop-after')
  for (const button of buttons) if (draggedSlides.includes(button.dataset.slideId)) button.classList.add('slide-dragging')
  const rect = slideRail.getBoundingClientRect()
  if (event.clientY < rect.top + 35) slideRail.scrollTop -= 18
  else if (event.clientY > rect.bottom - 35) slideRail.scrollTop += 18
})
slideRail.addEventListener('dragleave', event => {
  if (!slideRail.contains(event.relatedTarget)) clearSlideDrop()
})
slideRail.addEventListener('dragend', () => { finishSlideDrag(); render() })
slideRail.addEventListener('drop', event => {
  if (!draggedSlide || presenting) return
  event.preventDefault()
  const sources = [...draggedSlides], before = slideDropBefore
  finishSlideDrag()
  const previous = slideIds()
  const next = dropSelectedSlides(previous,sources,before)
  if (next.every((id, index) => id === previous[index])) return
  selected = null; selectedIds.clear()
  history?.stopCapturing()
  doc.transact(() => next.forEach((id, rank) => pages.set(id, rank)))
  history?.stopCapturing()
  focusActiveSlide()
  actionStatus(sources.length === 1 ? 'Slide moved to position ' + (next.indexOf(sources[0]) + 1) : sources.length + ' slides moved')
})
slideRail.addEventListener('keydown', event => {
  if (presenting || event.isComposing) return
  const ids = slideIds(), index = ids.indexOf(activeSlide)
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
    event.preventDefault(); event.stopPropagation()
    setSlideSelection(ids,activeSlide,slideAnchor); render()
    focusActiveSlide()
  } else if (event.key === 'Escape') {
    event.preventDefault(); event.stopPropagation(); selectSlide(activeSlide)
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault(); event.stopPropagation(); if (!$('delete-slide').disabled) $('delete-slide').click()
  } else if (['ArrowUp','ArrowDown'].includes(event.key)) {
    event.preventDefault(); event.stopPropagation()
    const direction = event.key === 'ArrowUp' ? -1 : 1
    if (event.altKey) moveSlide(direction)
    else if (ids[index+direction]) selectSlide(ids[index+direction],event)
  }
})
function renderThumbnails() {
  updatePresenter()
  renderObjectList()
  const ids = slideIds()
  const order = JSON.stringify(ids)
  if (draggedSlide && order !== thumbnailOrder) finishSlideDrag()
  thumbnailOrder = order
  reconcileSlideSelection(ids)
  const list = $('slide-list')
  const current = new Set(ids)
  for (const [id,view] of thumbnailViews) if (!current.has(id)) { view.button.remove(); thumbnailViews.delete(id); dirtyThumbnails.delete(id) }
  let cursor = list.firstElementChild
  ids.forEach((id, index) => {
    let view = thumbnailViews.get(id)
    if (!view) {
      const button = document.createElement('button'), thumb = document.createElement('div'), preview = document.createElement('div'), label = document.createElement('span')
      button.className = 'clist-action-btn'; button.dataset.slideId = id
      preview.className = 'mini-slide'
      thumb.append(preview,label); button.append(thumb)
      button.addEventListener('click',event=>selectSlide(id,event))
      view = {button,thumb,preview,label}; thumbnailViews.set(id,view); dirtyThumbnails.add(id)
    }
    const {button,thumb,preview,label} = view
    const title = 'Slide ' + (index + 1) + '. Ctrl/Cmd-click to toggle; Shift-click for a range. Drag to move selected slides.'
    if (button.title !== title) button.title = title
    const draggable = ids.length > 1 && !presenting
    if (button.draggable !== draggable) button.draggable = draggable
    const pressed = String(selectedSlides.has(id))
    if (button.getAttribute('aria-pressed') !== pressed) button.setAttribute('aria-pressed',pressed)
    if (id === activeSlide) { if (!button.hasAttribute('aria-current')) button.setAttribute('aria-current','true') }
    else if (button.hasAttribute('aria-current')) button.removeAttribute('aria-current')
    const className = 'slide-thumb' + (selectedSlides.has(id) ? ' selected' : '') + (id === activeSlide ? ' active-slide' : '')
    if (thumb.className !== className) thumb.className = className
    if (allThumbnailsDirty || dirtyThumbnails.has(id)) {
      preview.style.backgroundColor = slideBackground(id)
      preview.replaceChildren()
      const boxIds = [...(thumbnailObjects.get(id) || [])].sort((a,b)=>objectLayer(objects.get(a))-objectLayer(objects.get(b)) || a.localeCompare(b))
      boxIds.forEach((boxId,layer) => {
      const box = objects.get(boxId)
      const item = document.createElement('div')
      item.className = 'mini-object'
      item.style.zIndex = String(layer)
      item.style.transform = `rotate(${Number(box.get('rotation')) || 0}deg)`
      item.style.left = (100 * box.get('x') / SW) + '%'
      item.style.top = (100 * box.get('y') / SH) + '%'
      item.style.width = (100 * box.get('width') / SW) + '%'
      item.style.height = (100 * box.get('height') / SH) + '%'
      if (box.get('kind') === 'shape') {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
        drawShape(svg, box)
        item.append(svg)
      } else if (box.get('kind') === 'image') {
        const image = document.createElement('img')
        image.src = safeImageSource(box.get('source'))
        image.alt = ''
        image.draggable = false
        styleImage(image, box)
        item.append(image)
      } else {
        const format = textStyle(box)
        item.style.color = format.colour
        item.style.fontFamily = fontFamilies[format.family]
        item.style.background = 'transparent'
        item.textContent = doc.getXmlFragment('slide-text-' + boxId).toString().replace(/<[^>]*>/g, ' ')
      }
      preview.append(item)
      })
    }
    if (label.textContent !== String(index+1)) label.textContent = String(index+1)
    if (cursor === slideOrderActions) cursor = cursor.nextElementSibling
    if (cursor === button) cursor = cursor.nextElementSibling
    else list.insertBefore(button,cursor)
  })
  const activeButton = thumbnailViews.get(activeSlide)?.button
  if (activeButton && activeButton.nextElementSibling !== slideOrderActions) list.insertBefore(slideOrderActions,activeButton.nextElementSibling)
  dirtyThumbnails.clear(); allThumbnailsDirty = false
  const index = ids.indexOf(activeSlide)
  const count = selectedSlides.size
  $('slide-label').textContent = 'Slide ' + (index + 1) + ' of ' + ids.length + (count > 1 ? ' · ' + count + ' selected' : '')
  $('slide-up').disabled = presenting || moveSelectedSlides(ids,selectedSlides,-1).every((id,i)=>id===ids[i])
  $('slide-down').disabled = presenting || moveSelectedSlides(ids,selectedSlides,1).every((id,i)=>id===ids[i])
  $('duplicate-slide').disabled = presenting
  $('duplicate-slide').title = count > 1 ? 'Duplicate ' + count + ' selected slides' : 'Duplicate the selected slide'
  $('slide-up').title = $('slide-up').ariaLabel = 'Move selected slides earlier'
  $('slide-down').title = $('slide-down').ariaLabel = 'Move selected slides later'
  $('delete-slide').disabled = presenting || count >= ids.length
  $('delete-slide').title = count >= ids.length ? 'At least one slide must remain' : count > 1 ? 'Delete ' + count + ' selected slides' : 'Delete selected slide'
  $('presentation-position').textContent = (index + 1) + ' / ' + ids.length
  $('previous-slide').disabled = index <= 0
  $('next-slide').disabled = index >= ids.length - 1
}
function render() {
  renderTheme()
  const ids = slideIds()
  if (!ids.includes(activeSlide)) { stopDrag(); selected = null; selectedIds.clear(); activeSlide = ids[0] }
  renderNotes()
  slide.style.backgroundColor = slideBackground(activeSlide)
  $('slide-background').value = slideBackground(activeSlide)
  for (const [id, view] of views) {
    if (!objects.has(id) || (objects.get(id).get('slide') || 'first') !== activeSlide) {
      view.editor?.destroy(); view.node.remove(); views.delete(id)
      selectedIds.delete(id)
      if (selected === id) selected = [...selectedIds].at(-1) || null
    }
  }
  objects.forEach((box, id) => {
    if (!(box instanceof Y.Map) || (box.get('slide') || 'first') !== activeSlide) return
    if (!views.has(id)) createView(id, box)
    else { views.get(id).box = box; applyGeometry(id) }
  })
  const images = [...views.values()].filter(view => view.box.get('kind') === 'image').length
  const shapes = [...views.values()].filter(view => view.box.get('kind') === 'shape').length
  const textBoxes = views.size - images - shapes
  $('count').textContent = `${textBoxes} text box${textBoxes === 1 ? '' : 'es'}, ${images} image${images === 1 ? '' : 's'}, ${shapes} shape${shapes === 1 ? '' : 's'}`
  select(selected, false, true)
  renderThumbnails()
}
function groupMembers(id) {
  if (!views.has(id)) return []
  const group = objects.get(id)?.get('groupId')
  return typeof group === 'string' && group ? orderedObjectIds().filter(key => objects.get(key).get('groupId') === group) : [id]
}
function setObjectGroup(ungroup = false) {
  if (presenting || selectionLocked() || !selectedIds.size || (!ungroup && selectedIds.size < 2)) return
  stopDrag()
  const group = 'group-' + crypto.randomUUID()
  history?.stopCapturing()
  doc.transact(() => {
    for (const id of selectedIds) {
      if (ungroup) objects.get(id).delete('groupId')
      else objects.get(id).set('groupId', group)
    }
  })
  history?.stopCapturing()
  status(ungroup ? 'Selected objects ungrouped.' : 'Selected objects grouped.')
}
$('group-objects').addEventListener('click', () => setObjectGroup())
$('ungroup-objects').addEventListener('click', () => setObjectGroup(true))
function copyGroupData(data, groups) {
  const copy = { ...data }
  if (typeof copy.groupId === 'string' && copy.groupId) {
    if (!groups.has(copy.groupId)) groups.set(copy.groupId, 'group-' + crypto.randomUUID())
    copy.groupId = groups.get(copy.groupId)
  }
  return copy
}
function revealSelectionControls(force = false) {
  if (navigatingFind) return
  if (presenting) return
  const key = [...selectedIds].sort().map(id => id + ':' + (objects.get(id)?.get('kind') || 'text')).join('|')
  if (!force && key === inspectorSelection) return
  inspectorSelection = key
  const box = objects.get(selected)
  const panel = selectedIds.size > 1 ? 'arrange' : !box ? 'slide' : box.get('kind') === 'image' ? 'images' : box.get('kind') === 'shape' ? 'appearance' : 'text'
  const inspector = root.querySelector('.inspector')
  const section = inspector.querySelector('[data-panel="' + panel + '"]')
  for (const item of inspector.querySelectorAll(':scope > .control-section')) item.open = item === section
  if (section) inspector.scrollTop += section.getBoundingClientRect().top - inspector.getBoundingClientRect().top - inspector.clientTop
}
function select(id, additive = false, keepGroup = false, reveal = false) {
  for (const key of selectedIds) if (!views.has(key)) selectedIds.delete(key)
  if (additive && id && views.has(id)) {
    const members = groupMembers(id)
    const remove = members.every(key => selectedIds.has(key))
    for (const key of members) { if (remove) selectedIds.delete(key); else selectedIds.add(key) }
  } else if (!keepGroup) {
    selectedIds.clear()
    for (const key of groupMembers(id)) selectedIds.add(key)
  }
  if (keepGroup) for (const key of [...selectedIds]) for (const member of groupMembers(key)) selectedIds.add(member)
  selected = selectedIds.has(id) ? id : [...selectedIds].at(-1) || null
  for (const [other, view] of views) view.node.classList.toggle('selected', selectedIds.has(other))
  const multiple = selectedIds.size > 1
  const hasLocked = selectionLocked()
  root.classList.toggle('multi-selection', multiple)
  const groups = [...selectedIds].map(id => objects.get(id)?.get('groupId'))
  const oneGroup = groups.length > 1 && !!groups[0] && groups.every(group => group === groups[0])
  $('group-objects').disabled = hasLocked || !multiple || oneGroup
  $('ungroup-objects').disabled = hasLocked || !groups.some(Boolean)
  $('lock-objects').disabled = !selectedIds.size || [...selectedIds].every(id => objects.get(id)?.get('locked') === true)
  $('unlock-objects').disabled = !hasLocked
  $('distribute-horizontal').disabled = $('distribute-vertical').disabled = hasLocked || selectedIds.size < 3
  for (const mode of ['left', 'center', 'right', 'top', 'middle', 'bottom']) $('align-' + mode).disabled = hasLocked || !multiple
  const box = selected ? objects.get(selected) : null
  $('selection-details').textContent = multiple ? selectedIds.size + ' objects selected. Drag a Move handle or use arrow keys to move together.' : box
    ? `${selected}\nPosition: ${Math.round(box.get('x'))}, ${Math.round(box.get('y'))}\nSize: ${Math.round(box.get('width'))} × ${Math.round(box.get('height'))}`
    : 'Select an object'
  for (const key of ['x', 'y', 'width', 'height']) {
    const input = $('object-' + key)
    input.disabled = hasLocked || !box || multiple
    input.value = box ? String(Math.round(Number(box.get(key)) || 0)) : ''
  }
  $('keep-aspect-ratio').disabled = hasLocked || multiple || box?.get('kind') !== 'image'
  $('keep-aspect-ratio').checked = box?.get('kind') === 'image' && box.get('keepAspectRatio') !== false
  const crop = box ? imageCrop(box) : { fit: 'contain', x: 50, y: 50 }
  const cropDisabled = hasLocked || multiple || box?.get('kind') !== 'image'
  $('image-description').disabled = cropDisabled
  const imageDescription = !multiple && box?.get('kind') === 'image' && typeof box.get('alt') === 'string' ? box.get('alt') : ''
  if ($('image-description').value !== imageDescription) $('image-description').value = imageDescription
  $('replace-image').disabled = cropDisabled
  $('image-fit').disabled = cropDisabled
  $('image-fit').value = crop.fit
  $('crop-x').disabled = $('crop-y').disabled = cropDisabled || crop.fit !== 'cover'
  $('crop-x').value = String(crop.x)
  $('crop-y').value = String(crop.y)
  $('object-rotation').disabled = hasLocked || !box || multiple
  $('object-rotation').value = box ? String(Number(box.get('rotation')) || 0) : ''
  $('cut-objects').disabled = !selectedIds.size || hasLocked
  $('copy-objects').disabled = !selectedIds.size
  updateFormatButtons()
  $('paste-objects').disabled = !objectClipboard?.items.length
  $('duplicate').disabled = !selected || multiple
  $('delete').disabled = hasLocked || !selected
  const order = orderedObjectIds()
  const layerIndex = order.indexOf(selected)
  $('bring-forward').disabled = hasLocked || multiple || layerIndex < 0 || layerIndex === order.length - 1
  $('send-backward').disabled = hasLocked || multiple || layerIndex <= 0
  $('bold').disabled = multiple || !views.get(selected)?.editor
  $('italic').disabled = multiple || !views.get(selected)?.editor
  $('edit-link').disabled = multiple || !views.get(selected)?.editor
  $('remove-link').disabled = multiple || !views.get(selected)?.editor
  if (linkTarget && selected !== linkTarget) closeLinkControls()
  $('bullet-list').disabled = multiple || !views.get(selected)?.editor
  $('ordered-list').disabled = multiple || !views.get(selected)?.editor
  for (const name of ['font-family', 'font-size', 'text-colour', 'text-align']) $(name).disabled = multiple || !views.get(selected)?.editor
  const appearanceEnabled = box && !multiple && (!!views.get(selected)?.editor || box.get('kind') === 'shape')
  for (const name of ['fill-enabled', 'fill-colour', 'border-enabled', 'border-colour', 'border-width']) $(name).disabled = !appearanceEnabled
  if (appearanceEnabled) {
    const appearance = boxStyle(box)
    $('fill-enabled').checked = appearance.fill
    $('fill-colour').value = appearance.fillColour
    $('fill-colour').disabled = !appearance.fill
    $('border-enabled').checked = appearance.border
    $('border-colour').value = appearance.borderColour
    $('border-width').value = String(appearance.width)
    $('border-colour').disabled = $('border-width').disabled = !appearance.border
  }
  if (box && !multiple && views.get(selected)?.editor) {
    const format = textStyle(box)
    $('font-family').value = format.family
    $('font-size').value = String(Math.round(format.size))
    $('text-colour').value = format.colour
    $('text-align').value = format.align
  }
  renderObjectList()
  revealSelectionControls(reveal)
  textOverflow?.schedule()
}
function beginDrag(e, id, action) {
  if (presenting) return
  if (e.button !== 0) return
  e.preventDefault(); e.stopPropagation()
  history?.stopCapturing()
  if (history) history.captureTimeout = Infinity
  select(id, false, action === 'move' && selectedIds.has(id), true)
  if (selectionLocked()) { stopDrag(); status('Unlock selected objects before moving or resizing.', 'error'); return }
  views.get(id)?.node.focus({ preventScroll: true })
  const box = objects.get(id)
  if (!box) return
  if (action === 'resize') freezeCropSize(box)
  const scale = SW / slide.getBoundingClientRect().width
  const members = [...selectedIds].map(key => ({ id: key, ...objects.get(key).toJSON() }))
  const bounds = selectionBounds(members)
  activePointer = {
    members, id, action, startX: e.clientX, startY: e.clientY, scale,
    original: action === 'move' ? bounds : {
      x: box.get('x'), y: box.get('y'), width: box.get('width'), height: box.get('height'),
    },
  }
  activePointer.target = e.currentTarget
  activePointer.pointerId = e.pointerId
  e.currentTarget.setPointerCapture(e.pointerId)
  e.currentTarget.addEventListener('pointermove', onPointerMove)
  e.currentTarget.addEventListener('pointerup', stopDrag, { once: true })
  e.currentTarget.addEventListener('pointercancel', stopDrag, { once: true })
}
function selectionBounds(members) {
  const x = Math.min(...members.map(box => box.x)), y = Math.min(...members.map(box => box.y))
  return { x, y, width: Math.max(...members.map(box => box.x + box.width)) - x, height: Math.max(...members.map(box => box.y + box.height)) - y }
}
function selectionLocked() {
  return [...selectedIds].some(id => objects.get(id)?.get('locked') === true)
}
function setObjectLocks(locked) {
  if (presenting || !selectedIds.size) return
  stopDrag()
  doc.transact(() => {
    for (const id of selectedIds) objects.get(id)?.set('locked', locked)
  })
  status(locked ? 'Selected objects locked.' : 'Selected objects unlocked.')
}
$('lock-objects').addEventListener('click', () => setObjectLocks(true))
$('unlock-objects').addEventListener('click', () => setObjectLocks(false))
function visibleObjectBounds(box) {
  const angle = (Number(box.rotation) || 0) * Math.PI / 180
  const width = Math.abs(box.width * Math.cos(angle)) + Math.abs(box.height * Math.sin(angle))
  const height = Math.abs(box.width * Math.sin(angle)) + Math.abs(box.height * Math.cos(angle))
  return { x: box.x + (box.width - width) / 2, y: box.y + (box.height - height) / 2, width, height }
}
function alignSelected(mode) {
  if (presenting || selectionLocked() || selectedIds.size < 2) return
  stopDrag()
  const members = [...selectedIds].map(id => ({ id, ...objects.get(id).toJSON() }))
  const bounds = selectionBounds(members.map(visibleObjectBounds))
  history?.stopCapturing()
  doc.transact(() => {
    for (const member of members) {
      const box = objects.get(member.id)
      const visible = visibleObjectBounds(member)
      let dx = 0, dy = 0
      if (mode === 'left') dx = bounds.x - visible.x
      if (mode === 'center') dx = bounds.x + bounds.width / 2 - visible.x - visible.width / 2
      if (mode === 'right') dx = bounds.x + bounds.width - visible.x - visible.width
      if (mode === 'top') dy = bounds.y - visible.y
      if (mode === 'middle') dy = bounds.y + bounds.height / 2 - visible.y - visible.height / 2
      if (mode === 'bottom') dy = bounds.y + bounds.height - visible.y - visible.height
      if (['left', 'center', 'right'].includes(mode)) box.set('x', member.x + dx)
      else box.set('y', member.y + dy)
    }
  }, 'geometry')
  history?.stopCapturing()
}
for (const mode of ['left', 'center', 'right', 'top', 'middle', 'bottom']) {
  $('align-' + mode).addEventListener('click', () => alignSelected(mode))
}
function distributeSelected(vertical) {
  if (presenting || selectionLocked() || selectedIds.size < 3) return
  stopDrag()
  const position = vertical ? 'y' : 'x'
  const dimension = vertical ? 'height' : 'width'
  const members = [...selectedIds].map(id => {
    const box = objects.get(id).toJSON()
    return { id, box, bounds: visibleObjectBounds(box) }
  }).sort((a, b) => a.bounds[position] - b.bounds[position] || a.id.localeCompare(b.id))
  const first = members[0], last = members[members.length - 1]
  const start = first.bounds[position]
  const end = last.bounds[position] + last.bounds[dimension]
  const occupied = members.reduce((sum, member) => sum + member.bounds[dimension], 0)
  const gap = (end - start - occupied) / (members.length - 1)
  if (gap < -0.000001) {
    const axis = vertical ? 'vertically' : 'horizontally'
    const message = 'Not enough room ' + axis + ': the objects need ' + Math.ceil(occupied) + ' px, but their outer edges span only ' + Math.floor(end - start) + ' px. Move the outermost objects farther apart or make the objects smaller.'
    $('distribution-status').textContent = message
    status(message, 'error')
    return
  }
  history?.stopCapturing()
  doc.transact(() => {
    let cursor = start + first.bounds[dimension] + Math.max(0, gap)
    for (let index = 1; index < members.length - 1; index++) {
      const member = members[index]
      objects.get(member.id).set(position, member.box[position] + cursor - member.bounds[position])
      cursor += member.bounds[dimension] + Math.max(0, gap)
    }
  }, 'geometry')
  history?.stopCapturing()
  $('distribution-status').textContent = 'Distributed ' + members.length + ' objects ' + (vertical ? 'vertically' : 'horizontally') + ' with ' + Math.round(Math.max(0, gap)) + ' px gaps.'
}
$('distribute-horizontal').addEventListener('click', () => distributeSelected(false))
$('distribute-vertical').addEventListener('click', () => distributeSelected(true))
function deleteSelected() {
  if (presenting) return
  if (selectionLocked()) { status('Unlock selected objects before deleting.', 'error'); return }
  const ids = [...selectedIds]
  doc.transact(() => ids.forEach(id => objects.delete(id)))
}
function snapAxis(position, size, targets, threshold, limit) {
  let result = { position, guide: null }
  let closest = threshold + 0.000001
  for (const target of targets) {
    for (const offset of [0, size / 2, size]) {
      const candidate = target - offset
      const distance = Math.abs(candidate - position)
      if (candidate >= 0 && candidate <= limit - size && distance < closest) {
        closest = distance
        result = { position: candidate, guide: target }
      }
    }
  }
  return result
}
function moveWithSnapping(id, x, y, width, height, threshold) {
  const xs = [0, SW / 2, SW], ys = [0, SH / 2, SH]
  for (const other of orderedObjectIds()) {
    if (other === id || selectedIds.has(other)) continue
    const box = objects.get(other)
    const ox = Number(box.get('x')), oy = Number(box.get('y'))
    const ow = Number(box.get('width')), oh = Number(box.get('height'))
    if (![ox, oy, ow, oh].every(Number.isFinite)) continue
    xs.push(ox, ox + ow / 2, ox + ow)
    ys.push(oy, oy + oh / 2, oy + oh)
  }
  return { x: snapAxis(x, width, xs, threshold, SW), y: snapAxis(y, height, ys, threshold, SH) }
}
function onPointerMove(e) {
  if (!activePointer) return
  if (selectionLocked()) { stopDrag(); status('Movement stopped because an object was locked.', 'error'); return }
  const { id, action, startX, startY, scale, original } = activePointer
  const box = objects.get(id)
  if (!box) return
  const dx = (e.clientX - startX) * scale
  const dy = (e.clientY - startY) * scale
  doc.transact(() => {
    if (action === 'move') {
      let x = Math.max(0, Math.min(SW - original.width, original.x + dx))
      let y = Math.max(0, Math.min(SH - original.height, original.y + dy))
      verticalGuide.hidden = horizontalGuide.hidden = true
      if (!e.altKey) {
        const snapped = moveWithSnapping(id, x, y, original.width, original.height, 6 * scale)
        x = snapped.x.position
        y = snapped.y.position
        if (snapped.x.guide !== null) {
          verticalGuide.hidden = false
          verticalGuide.style.left = (100 * snapped.x.guide / SW) + '%'
        }
        if (snapped.y.guide !== null) {
          horizontalGuide.hidden = false
          horizontalGuide.style.top = (100 * snapped.y.guide / SH) + '%'
        }
      }
      for (const member of activePointer.members) {
        const target = objects.get(member.id)
        if (!target) continue
        target.set('x', Math.round(member.x + x - original.x))
        target.set('y', Math.round(member.y + y - original.y))
      }
    } else {
      if (box.get('kind') === 'image' && box.get('keepAspectRatio') !== false) {
        const ratio = imageAspectRatio(box)
        const desiredWidth = Math.abs(dx / original.width) >= Math.abs(dy / original.height) ? original.width + dx : (original.height + dy) * ratio
        const crop = box.get('imageFit') === 'cover' ? cropImageSize(box) : { width: SW, height: SH }
        const size = fitImageSize(desiredWidth, ratio, Math.min(SW - original.x, crop.width), Math.min(SH - original.y, crop.height))
        box.set('width', size.width)
        box.set('height', size.height)
      } else {
        const minimumWidth = !views.get(id)?.editor ? 1 : 100
        const minimumHeight = !views.get(id)?.editor ? 1 : 55
        const crop = box.get('imageFit') === 'cover' ? cropImageSize(box) : { width: SW, height: SH }
        box.set('width', Math.max(minimumWidth, Math.min(SW - original.x, crop.width, original.width + dx)))
        box.set('height', Math.max(minimumHeight, Math.min(SH - original.y, crop.height, original.height + dy)))
      }
    }
  }, 'geometry')
}
function stopDrag(e) {
  marquee?.cancel()
  verticalGuide.hidden = horizontalGuide.hidden = true
  const target = activePointer?.target || e?.currentTarget
  target?.removeEventListener('pointermove', onPointerMove)
  target?.removeEventListener('pointerup', stopDrag)
  target?.removeEventListener('pointercancel', stopDrag)
  if (activePointer && target?.hasPointerCapture(activePointer.pointerId)) target.releasePointerCapture(activePointer.pointerId)
  activePointer = null
  if (history) { history.captureTimeout = 500; history.stopCapturing() }
}
doc.on('beforeObserverCalls', markThumbnailChanges)
objects.observeDeep(render)
pages.observe(render)
  design.observe(render)
  backgrounds.observe(render)
  references.observe(notifyReferences)
  notes.observe(renderNotes)
doc.on('update', renderThumbnails)
doc.on('update', notifyChange)
$('add-slide').addEventListener('click', () => {
  if (presenting) return
  stopDrag()
  try {
    if (savedLayouts.has($('slide-layout').value)) { addSavedLayoutSlide(savedLayouts.get($('slide-layout').value)); return }
    const ids = slideIds(), id = 'slide-' + crypto.randomUUID()
    const layout = layoutCatalog.get($('slide-layout').value) || layoutCatalog.values().next().value
    const entries = layout.objects.map(entry => ({ ...entry, id: newId() }))
    const groupIds = new Map()
    activeSlide = id
    selected = null; selectedIds.clear()
    history?.stopCapturing()
    doc.transact(() => {
      if (!pages.size) pages.set('first', 0)
      pages.set(id, Math.max(...ids.map(key => pages.get(key) || 0)) + 1)
      if (layout.background !== undefined) backgrounds.set(id, layout.background)
      if (layout.notes !== undefined) notes.set(id, layout.notes)
      for (const entry of entries) {
        const { id: objectId, text, shapeId, group, ...properties } = entry
        const defaults = entry.kind === 'shape' ? shapeProperties(shapeCatalog.get(shapeId)) : {}
        const values = { ...defaults, rotation: 0, ...properties, slide: id, layer: Math.max(-1, ...orderedObjectIds().map(key => objectLayer(objects.get(key)))) + 1 }
        if (group) {
          if (!groupIds.has(group)) groupIds.set(group, 'group-' + crypto.randomUUID())
          values.groupId = groupIds.get(group)
        }
        if (entry.kind === 'image') values.aspectRatio = entry.width / entry.height
        objects.set(objectId, new Y.Map(Object.entries(values)))
      }
    })
    for (const entry of entries) {
      if (entry.kind !== 'text') continue
      const content = entry.text.split('\n').map(text => ({ type: 'paragraph', content: text ? [{ type: 'text', text }] : [] }))
      views.get(entry.id).editor.commands.setContent({ type: 'doc', content })
    }
    history?.stopCapturing()
    render()
  } catch (error) {
    console.error('Slides layout failed:', error)
    status('Could not create slide: ' + error.message, 'error')
  }
})
$('duplicate-slide').addEventListener('click', () => {
  if (presenting) return
  stopDrag()
  try {
    const sources = selectedSlideIds()
    const order = slideIds()
    const slides = sources.map(source => {
      const id = 'slide-' + crypto.randomUUID(), groupIds = new Map()
      const copies = orderedObjectIds(source).map(objectId => {
        const box = new Y.Map(Object.entries(copyGroupData(objects.get(objectId).toJSON(),groupIds)))
        box.set('slide',id)
        const key = newId(), fragment = doc.getXmlFragment('slide-text-' + key)
        const text = doc.getXmlFragment('slide-text-' + objectId).toArray().map(node=>node.clone())
        history?.addToScope(fragment)
        return {id:key,box,fragment,text}
      })
      return {source,id,copies}
    })
    const duplicates = slides.map(slide=>slide.id)
    order.splice(order.indexOf(sources.at(-1))+1,0,...duplicates)
    setSlideSelection(duplicates)
    history?.stopCapturing()
    doc.transact(() => {
      order.forEach((id, rank) => pages.set(id, rank))
      for (const slide of slides) {
        if (backgrounds.has(slide.source)) backgrounds.set(slide.id,backgrounds.get(slide.source))
        if (typeof notes.get(slide.source) === 'string') notes.set(slide.id,notes.get(slide.source))
        for (const copy of slide.copies) {
          objects.set(copy.id, copy.box)
          if (copy.text.length) copy.fragment.insert(0, copy.text)
        }
      }
    })
    history?.stopCapturing()
    render()
    actionStatus(slides.length === 1 ? 'Slide duplicated' : slides.length + ' slides duplicated')
    focusActiveSlide()
  } catch (error) {
    console.error('Slides duplication failed:', error)
    status('Could not duplicate slide: ' + error.message, 'error')
  }
})
function moveSlide(offset) {
  if (presenting) return
  stopDrag()
  const ids = slideIds()
  const next = moveSelectedSlides(ids,selectedSlideIds(),offset)
  if (next.every((id,i)=>id===ids[i])) return
  history?.stopCapturing()
  doc.transact(() => next.forEach((id, rank) => pages.set(id, rank)))
  history?.stopCapturing()
  focusActiveSlide()
}
$('slide-up').addEventListener('click', () => moveSlide(-1))
$('slide-down').addEventListener('click', () => moveSlide(1))
$('delete-slide').addEventListener('click', () => {
  const targets = selectedSlideIds(), ids = slideIds()
  if (targets.length >= ids.length || presenting) return
  const remove = () => deleteSlides(targets)
  if (typeof window.buildDialogModal === 'function') {
    const body = document.createElement('p')
    body.textContent = targets.length === 1 ? 'Delete slide ' + (ids.indexOf(targets[0])+1) + '? Its objects and speaker notes will be removed.' : 'Delete ' + targets.length + ' selected slides? Their objects and speaker notes will be removed.'
    window.buildDialogModal(targets.length === 1 ? 'Delete slide' : 'Delete slides', body, [
      { label: 'Cancel', secondary: true, onClick: close => close() },
      { label: targets.length === 1 ? 'Delete slide' : 'Delete slides', onClick: close => { close(); remove() } },
    ])
  } else {
    // Standalone demo: use the same standard button classes without CList's shell.
    const dialog = document.createElement('dialog'), body = document.createElement('p')
    body.textContent = 'Delete ' + targets.length + ' selected slide(s)?'
    dialog.append(body)
    for (const [label,secondary,action] of [['Cancel',true,()=>{}],['Delete slides',false,remove]]) {
      const button = document.createElement('button')
      button.className = secondary ? 'btn btn-secondary' : 'btn'; button.textContent = label
      button.addEventListener('click', () => { dialog.close(); dialog.remove(); action() })
      dialog.append(button)
    }
    dialog.addEventListener('cancel',()=>dialog.remove(),{once:true})
    document.body.append(dialog); dialog.showModal()
  }
})
function deleteSlides(targets) {
  const ids = slideIds()
  const removed = new Set(ids.filter(id=>targets.includes(id)))
  if (presenting || !removed.size || removed.size >= ids.length) return
  stopDrag()
  const remaining = ids.filter(id=>!removed.has(id))
  const next = remaining[Math.min(ids.indexOf(activeSlide),remaining.length-1)]
  const fragments = [...objects].filter(([,box])=>removed.has(box.get('slide') || 'first') && (!box.get('kind') || box.get('kind') === 'text')).map(([id])=>doc.getXmlFragment('slide-text-' + id))
  for (const fragment of fragments) history?.addToScope(fragment)
  setSlideSelection([next])
  history?.stopCapturing()
  doc.transact(() => {
    objects.forEach((box, id) => { if (removed.has(box.get('slide') || 'first')) objects.delete(id) })
    for (const fragment of fragments) if (fragment.length) fragment.delete(0,fragment.length)
    // Materialize the implicit first slide before deleting it or other slides.
    if (!pages.size) ids.forEach((id,rank)=>pages.set(id,rank))
    for (const id of removed) { pages.delete(id); backgrounds.delete(id); notes.delete(id) }
  })
  history?.stopCapturing()
  render()
  focusActiveSlide()
}

$('save-layout').disabled = typeof options.onSaveLayout !== 'function'
$('save-layout').addEventListener('click', () => options.onSaveLayout?.())

function safeImageSource(value) {
  return typeof value === 'string' && /^data:image\/(png|jpeg|gif|webp);base64,[a-z0-9+/=\s]+$/i.test(value) ? value : ''
}
async function readImageFile(file) {
  if (!/^image\/(png|jpeg|gif|webp)$/.test(file.type)) throw new Error('Choose a PNG, JPEG, GIF, or WebP image.')
  const source = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error || new Error('Could not read the image.'))
    reader.onabort = () => reject(new Error('Image reading was cancelled.'))
    reader.readAsDataURL(file)
  })
  if (!safeImageSource(source)) throw new Error('Unsupported image data.')
  const image = new Image()
  image.src = source
  await image.decode()
  return { source, image }
}
$('image-description').addEventListener('input', event => {
  const box = objects.get(selected)
  if (presenting || selectedIds.size !== 1 || box?.get('kind') !== 'image' || box.get('locked') === true) return
  box.set('alt', event.target.value.slice(0, 2000))
})
$('replace-image').addEventListener('click', () => {
  const box = objects.get(selected)
  if (presenting || selectedIds.size !== 1 || box?.get('kind') !== 'image' || box.get('locked') === true) return
  replacementTarget = { document: doc, id: selected }
  $('replace-image-file').click()
})
$('replace-image-file').addEventListener('change', async event => {
  const file = event.target.files[0], target = replacementTarget
  replacementTarget = null
  if (!file || !target) return
  try {
    const { source, image } = await readImageFile(file)
    const box = objects.get(target.id)
    if (doc !== target.document || box?.get('kind') !== 'image') throw new Error('The original image is no longer available.')
    if (presenting || box.get('locked') === true) throw new Error('Return to editing and unlock the image before replacing it.')
    history?.stopCapturing()
    doc.transact(() => {
      box.set('source', source)
      box.set('imageRatio', image.naturalWidth / image.naturalHeight)
      box.set('aspectRatio', box.get('width') / box.get('height'))
      box.delete('cropImageWidth'); box.delete('cropImageHeight')
      if (box.get('imageFit') === 'cover') {
        const width = Math.max(box.get('width'), box.get('height') * image.naturalWidth / image.naturalHeight)
        box.set('cropImageWidth', width)
        box.set('cropImageHeight', width * image.naturalHeight / image.naturalWidth)
      }
    })
    history?.stopCapturing()
    status('Image replaced.')
  } catch (error) {
    console.error('Slides image replacement failed:', error)
    status('Could not replace image: ' + error.message, 'error')
  } finally { event.target.value = '' }
})
$('add-image').addEventListener('click', () => $('image-file').click())
$('image-file').addEventListener('change', async event => {
  const file = event.target.files[0]
  if (!file) return
  const targetDoc = doc
  const targetSlide = activeSlide
  try {
    const { source, image } = await readImageFile(file)
    if (doc !== targetDoc || !slideIds().includes(targetSlide)) throw new Error('The destination slide is no longer open.')
    if (presenting) throw new Error('Return to editing before adding an image.')
    activeSlide = targetSlide
    const scale = Math.min(1, 800 / image.naturalWidth, 500 / image.naturalHeight)
    const width = Math.max(1, Math.round(image.naturalWidth * scale))
    const height = Math.max(1, Math.round(image.naturalHeight * scale))
    const id = newId()
    makeBox(id, (SW - width) / 2, (SH - height) / 2, width, height, source, file.name)
    select(id)
    status('Image added')
  } catch (error) {
    console.error('Slides image could not load:', error)
    status('Image could not load: ' + error.message, 'error')
  } finally {
    event.target.value = ''
  }
})

function copyObjects() {
  if (presenting || !selectedIds.size) return
  try {
    const clipboardDoc = new Y.Doc()
    const items = orderedObjectIds().filter(id => selectedIds.has(id)).map((id, index) => {
      const children = doc.getXmlFragment('slide-text-' + id).toArray().map(node => node.clone())
      if (children.length) clipboardDoc.getXmlFragment('text-' + index).insert(0, children)
      return { data: objects.get(id).toJSON(), index }
    })
    const urls = new Set(items.flatMap(item => item.data.referenceUrls || []))
    for (const reference of getReferences()) if (urls.has(reference.url)) clipboardDoc.getMap('clist_refs').set(reference.url, JSON.stringify(reference))
    objectClipboard?.document.destroy()
    objectClipboard = { document: clipboardDoc, items, sourceDocument: doc, sourceSlide: activeSlide, pastes: 0, token: crypto.randomUUID() }
    $('paste-objects').disabled = false
    status('Copied ' + items.length + ' object' + (items.length === 1 ? '.' : 's.'))
    return true
  } catch (error) {
    console.error('Slides object copy failed:', error)
    status('Could not copy objects: ' + error.message, 'error')
    return false
  }
}
function pasteObjects() {
  if (presenting || !objectClipboard?.items.length) return
  stopDrag()
  try {
    const bounds = selectionBounds(objectClipboard.items.map(item => item.data))
    const offset = objectClipboard.cut && objectClipboard.pastes === 0 ? 0 : objectClipboard.sourceDocument === doc && objectClipboard.sourceSlide === activeSlide ? 28 * (objectClipboard.pastes + 1) : 28 * objectClipboard.pastes
    const dx = Math.max(-bounds.x, Math.min(SW - bounds.x - bounds.width, offset))
    const dy = Math.max(-bounds.y, Math.min(SH - bounds.y - bounds.height, offset))
    const topLayer = Math.max(-1, ...orderedObjectIds().map(id => objectLayer(objects.get(id))))
    const groupIds = new Map()
    const copies = objectClipboard.items.map((item, index) => {
      const id = newId()
      const box = new Y.Map(Object.entries({ ...copyGroupData(item.data, groupIds), slide: activeSlide, x: item.data.x + dx, y: item.data.y + dy, layer: topLayer + index + 1 }))
      const fragment = doc.getXmlFragment('slide-text-' + id)
      history?.addToScope(fragment)
      const text = objectClipboard.document.getXmlFragment('text-' + item.index).toArray().map(node => node.clone())
      return { id, box, fragment, text }
    })
    history?.stopCapturing()
    doc.transact(() => {
      objectClipboard.document.getMap('clist_refs').forEach(value => { try { addReferences([JSON.parse(value)]) } catch {} })
      for (const copy of copies) {
        objects.set(copy.id, copy.box)
        if (copy.text.length) copy.fragment.insert(0, copy.text)
      }
    })
    history?.stopCapturing()
    objectClipboard.pastes++
    selectedIds.clear()
    for (const copy of copies) selectedIds.add(copy.id)
    selected = copies[copies.length - 1].id
    select(selected, false, true)
    root.tabIndex = -1
    root.focus({ preventScroll: true })
    status('Pasted ' + copies.length + ' object' + (copies.length === 1 ? '.' : 's.'))
  } catch (error) {
    console.error('Slides object paste failed:', error)
    status('Could not paste objects: ' + error.message, 'error')
  }
}
function cutObjects(clipboardEvent = null) {
  if (presenting || !selectedIds.size) return
  if (selectionLocked()) { status('Unlock selected objects before cutting.', 'error'); return }
  if (!copyObjects()) return
  try {
    if (clipboardEvent) writeObjectClipboard(clipboardEvent)
    objectClipboard.cut = true
    const count = selectedIds.size
    history?.stopCapturing()
    deleteSelected()
    history?.stopCapturing()
    root.tabIndex = -1
    root.focus({ preventScroll: true })
    status('Cut ' + count + ' object' + (count === 1 ? '.' : 's.'))
  } catch (error) {
    console.error('Slides object cut failed:', error)
    status('Could not cut objects: ' + error.message, 'error')
  }
}
$('cut-objects').addEventListener('click', () => cutObjects())
$('copy-objects').addEventListener('click', copyObjects)
$('paste-objects').addEventListener('click', pasteObjects)
function clipboardTextTarget(target) {
  return target.isContentEditable || !!target.closest?.('input, textarea, select, [contenteditable="true"]')
}
function writeObjectClipboard(event) {
  event.clipboardData.setData('application/x-clist-slide-objects', objectClipboard.token)
  event.clipboardData.setData('text/plain', objectClipboard.items.map(item => {
    const fragment = objectClipboard.document.getXmlFragment('text-' + item.index)
    return fragment.toString().replace(/<[^>]*>/g, ' ') || item.data.alt || 'Slide object'
  }).join('\n'))
  event.preventDefault()
  event.stopImmediatePropagation()
}
root.addEventListener('copy', event => {
  if (presenting || clipboardTextTarget(event.target) || !selectedIds.size || !event.clipboardData) return
  if (!copyObjects()) return
  try { writeObjectClipboard(event) }
  catch (error) {
    console.error('Slides clipboard write failed:', error)
    status('Could not write objects to clipboard: ' + error.message, 'error')
  }
}, true)
function onSlideCut(event) {
  if (presenting || !selectedIds.size || !event.clipboardData || !root.getClientRects().length) return
  const pageTarget = event.target === document.body || event.target === document.documentElement || event.target === document
  if (!root.contains(event.target) && !(pageTarget && root.contains(document.activeElement))) return
  if (clipboardTextTarget(event.target) || document.activeElement?.closest?.('input, textarea, select')) return
  event.preventDefault()
  event.stopImmediatePropagation()
  cutObjects(event)
}
document.addEventListener('cut', onSlideCut, true)
function onSlidePaste(event) {
  if (presenting || !event.clipboardData || !root.getClientRects().length) return
  const inside = root.contains(event.target)
  const pageTarget = event.target === document.body || event.target === document.documentElement || event.target === document
  if (!inside && !(pasteSurfaceActive && pageTarget)) return
  if (!inside && document.activeElement?.closest?.('input, textarea, select, [contenteditable="true"]')) return
  if (event.target.closest?.('input, textarea, select')) return
  const textObject = event.target.closest?.('.slide-object')
  const editingSelectedBox = clipboardTextTarget(event.target) && textObject && selectedIds.has(textObject.dataset.id) && editorFocused === textObject.dataset.id
  if (editingSelectedBox) return
  const token = event.clipboardData.getData('application/x-clist-slide-objects')
  if (token && token === objectClipboard?.token) {
    event.preventDefault(); event.stopImmediatePropagation()
    pasteObjects()
    return
  }
  const text = event.clipboardData.getData('text/plain')
  if (!text) return
  event.preventDefault(); event.stopImmediatePropagation()
  try {
    stopDrag()
    history?.stopCapturing()
    const id = newId()
    const paragraphs = text.replace(/\r\n?/g, '\n').split('\n').map(line => ({
      type: 'paragraph', content: line ? [{ type: 'text', text: line }] : [],
    }))
    const lines = paragraphs.reduce((sum, paragraph) => sum + Math.max(1, Math.ceil((paragraph.content[0]?.text.length || 0) / 45)), 0)
    const width = 690, height = Math.min(500, Math.max(100, lines * 42))
    const point = pastePoint?.slide === activeSlide ? pastePoint : { x: 160, y: 160 }
    makeBox(id, Math.max(0, Math.min(SW - width, point.x)), Math.max(0, Math.min(SH - height, point.y)), width, height)
    views.get(id).editor.commands.setContent({ type: 'doc', content: paragraphs })
    history?.stopCapturing()
    select(id)
    views.get(id).editor.commands.focus('end')
    status('Pasted text into a new text box.')
  } catch (error) {
    console.error('Slides text paste failed:', error)
    status('Could not paste text: ' + error.message, 'error')
  }
}
document.addEventListener('paste', onSlidePaste, true)
function updatePastePoint(event) {
  const rect = slide.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) return
  pastePoint = { slide: activeSlide, x: Math.round((event.clientX - rect.left) * SW / rect.width), y: Math.round((event.clientY - rect.top) * SH / rect.height) }
}
root.addEventListener('pointermove', updatePastePoint)
textOverflow = mountTextOverflow(root, slide, {
  views: () => [...views.values()],
  selected: () => [...selectedIds].map(id => views.get(id)).filter(Boolean),
  presenting: () => presenting,
  size: box => textStyle(box).size,
  apply: changes => {
    if (!changes.length) return
    history?.stopCapturing()
    doc.transact(() => { for (const { box, size } of changes) box.set('fontSize', size) })
    history?.stopCapturing()
  },
})
marquee = mountMarquee(root, slide, {
  selected: () => [...selectedIds],
  slideId: () => activeSlide,
  objects: () => orderedObjectIds().map(id => ({ id, ...visibleObjectBounds(objects.get(id).toJSON()) })),
  select: ids => { selectedIds.clear(); for (const id of ids) if (views.has(id)) selectedIds.add(id); select(ids.at(-1) || null, false, true) },
})
root.addEventListener('pointerdown', event => {
  const target = event.target
  if (event.button !== 0 || presenting || !target.closest?.('.canvas-space') || target.closest('.slide-object, input, textarea, select, button, a')) return
  event.preventDefault()
  pasteSurfaceActive = true
  updatePastePoint(event)
  stopDrag()
  if (target === slide) marquee.begin(event)
  if (!event.shiftKey) select(null)
  editorFocused = null
  // Clear both DOM focus and the retained contenteditable selection.
  if (root.contains(document.activeElement)) document.activeElement.blur?.()
  window.getSelection()?.removeAllRanges()
  root.tabIndex = -1
  root.focus({ preventScroll: true })
}, true)
function addCatalogShape(type) {
  if (presenting) return
  const definition = shapeCatalog.get(type)
  if (!definition) { status('This shape is not available in the catalog.', 'error'); return }
  const id = newId(), { width, height } = definition
  const box = new Y.Map(Object.entries({ ...shapeProperties(definition), slide: activeSlide, x: Math.min(160, SW - width), y: Math.min(180, SH - height), width, height, rotation: 0, layer: Math.max(-1, ...orderedObjectIds().map(key => objectLayer(objects.get(key)))) + 1 }))
  objects.set(id, box)
  select(id)
  views.get(id).node.focus({ preventScroll: true })
}
function newId() { return `box-${crypto.randomUUID()}` }
$('add-text').addEventListener('click', () => {
  const id = newId()
  makeBox(id, 160, 220, 430, 130)
  select(id)
  views.get(id)?.editor.commands.focus()
})
$('duplicate').addEventListener('click', () => {
  if (presenting || !selected) return
  const sourceId = selected, old = objects.get(sourceId), id = newId()
  const box = new Y.Map(Object.entries({ ...old.toJSON(), locked: false, x: Math.min(SW - old.get('width'), old.get('x') + 28), y: Math.min(SH - old.get('height'), old.get('y') + 28), layer: Math.max(...orderedObjectIds().map(key => objectLayer(objects.get(key)))) + 1 }))
  box.delete('groupId')
  const fragment = doc.getXmlFragment('slide-text-' + id)
  history?.addToScope(fragment)
  const text = doc.getXmlFragment('slide-text-' + sourceId).toArray().map(node => node.clone())
  doc.transact(() => {
    objects.set(id, box)
    if (text.length) fragment.insert(0, text)
  })
  select(id)
})
$('delete').addEventListener('click', deleteSelected)
$('bold').addEventListener('click', () => { if (selected) views.get(selected)?.editor?.chain().focus().toggleBold().run() })
$('italic').addEventListener('click', () => { if (selected) views.get(selected)?.editor?.chain().focus().toggleItalic().run() })

$('bullet-list').addEventListener('click', () => {
  if (!presenting && selected) views.get(selected)?.editor?.chain().focus().toggleBulletList().run()
})
$('ordered-list').addEventListener('click', () => {
  if (!presenting && selected) views.get(selected)?.editor?.chain().focus().toggleOrderedList().run()
})

function validLink(value) {
  try {
    const url = new URL(value)
    return ['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol)
  } catch { return false }
}
function closeLinkControls() {
  $('link-controls').hidden = true
  linkTarget = null
}
$('edit-link').addEventListener('click', () => {
  const editor = views.get(selected)?.editor
  if (presenting || !editor) return
  if (editor.state.selection.empty && !editor.isActive('link')) {
    status('Select the text to link first.', 'error')
    return
  }
  linkTarget = selected
  $('link-url').value = editor.getAttributes('link').href || ''
  $('link-controls').hidden = false
  $('link-url').focus()
})
$('cancel-link').addEventListener('click', closeLinkControls)
$('apply-link').addEventListener('click', () => {
  const editor = views.get(linkTarget)?.editor
  if (presenting || !editor) { closeLinkControls(); return }
  const href = $('link-url').value.trim()
  if (!validLink(href)) { status('Enter an http, https, mailto, or tel URL.', 'error'); return }
  try {
    history?.stopCapturing()
    editor.chain().focus().extendMarkRange('link').setLink({ href }).run()
    history?.stopCapturing()
    closeLinkControls()
  } catch (error) {
    console.error('Slides link failed:', error)
    status('Could not apply link: ' + error.message, 'error')
  }
})
$('remove-link').addEventListener('click', () => {
  const editor = views.get(selected)?.editor
  if (presenting || !editor) return
  try {
    editor.chain().focus().extendMarkRange('link').unsetLink().run()
    closeLinkControls()
  } catch (error) {
    console.error('Slides unlink failed:', error)
    status('Could not remove link: ' + error.message, 'error')
  }
})
root.addEventListener('click', event => {
  const anchor = event.target.closest?.('.text-content a')
  if (!presenting || !anchor) return
  event.preventDefault()
  event.stopImmediatePropagation()
  const href = anchor.getAttribute('href') || ''
  if (validLink(href)) window.open(href, '_blank', 'noopener,noreferrer')
  else {
    console.error('Slides blocked unsupported link:', href)
    $('presentation-status').textContent = 'This link has an unsupported URL.'
  }
}, true)

function moveObjectLayer(offset) {
  if (presenting || selectionLocked() || !selected) return
  const order = orderedObjectIds()
  const index = order.indexOf(selected)
  if (index < 0 || !order[index + offset]) return
  ;[order[index], order[index + offset]] = [order[index + offset], order[index]]
  doc.transact(() => order.forEach((id, layer) => objects.get(id).set('layer', layer)), 'layer')
}
$('bring-forward').addEventListener('click', () => moveObjectLayer(1))
$('send-backward').addEventListener('click', () => moveObjectLayer(-1))

function setImageCrop(key, value) {
  const box = objects.get(selected)
  if (presenting || selectedIds.size !== 1 || box?.get('kind') !== 'image' || box.get('locked') === true) return
  doc.transact(() => {
    if (key === 'imageFit' && value === 'cover' && box.get('imageFit') !== 'cover') {
      box.delete('cropImageWidth'); box.delete('cropImageHeight')
      box.set(key, value)
      freezeCropSize(box)
    } else box.set(key, value)
  })
}
$('image-fit').addEventListener('change', event => {
  if (['contain', 'cover'].includes(event.target.value)) setImageCrop('imageFit', event.target.value)
})
for (const [control, key] of [['crop-x', 'cropX'], ['crop-y', 'cropY']]) {
  $(control).addEventListener('input', event => {
    const value = Number(event.target.value)
    if (Number.isFinite(value) && value >= 0 && value <= 100) setImageCrop(key, value)
  })
}
function imageAspectRatio(box) {
  const ratio = Number(box.get('aspectRatio'))
  return Number.isFinite(ratio) && ratio > 0 ? ratio : Number(box.get('width')) / Number(box.get('height')) || 1
}
function fitImageSize(width, ratio, maxWidth, maxHeight) {
  const maximum = Math.min(maxWidth, maxHeight * ratio)
  const actual = Math.max(Math.min(maximum, Math.max(1, ratio)), Math.min(maximum, width))
  return { width: actual, height: actual / ratio }
}
$('keep-aspect-ratio').addEventListener('change', event => {
  const box = objects.get(selected)
  if (presenting || selectedIds.size !== 1 || box?.get('kind') !== 'image' || box.get('locked') === true) return
  doc.transact(() => {
    // Enabling the option preserves the current frame proportions.
    if (event.target.checked) box.set('aspectRatio', box.get('width') / box.get('height'))
    box.set('keepAspectRatio', event.target.checked)
  })
})
for (const key of ['x', 'y', 'width', 'height']) {
  $('object-' + key).addEventListener('change', event => {
    const box = objects.get(selected)
    if (presenting || box?.get('locked') === true || !box) return
    const value = Number(event.target.value)
    const limit = key === 'x' ? SW - 1 : key === 'y' ? SH - 1 : key === 'width' ? SW : SH
    const minimum = key === 'width' || key === 'height' ? 1 : 0
    if (event.target.value.trim() === '' || !Number.isInteger(value) || value < minimum || value > limit) {
      status(key + ' must be a whole number between ' + minimum + ' and ' + limit + '.', 'error')
      select(selected)
      return
    }
    doc.transact(() => {
      if (['width', 'height'].includes(key)) freezeCropSize(box)
      const cropLimit = box.get('imageFit') === 'cover' ? cropImageSize(box) : { width: SW, height: SH }
      if (box.get('kind') === 'image' && box.get('keepAspectRatio') !== false && ['width', 'height'].includes(key)) {
        const ratio = imageAspectRatio(box)
        const size = fitImageSize(key === 'width' ? value : value * ratio, ratio, Math.min(SW, cropLimit.width), Math.min(SH, cropLimit.height))
        box.set('width', size.width)
        box.set('height', size.height)
        box.set('x', Math.min(box.get('x'), SW - size.width))
        box.set('y', Math.min(box.get('y'), SH - size.height))
        return
      }
      const actual = key === 'width' ? Math.min(value, cropLimit.width) : key === 'height' ? Math.min(value, cropLimit.height) : value
      box.set(key, actual)
      // Keep the whole object within the slide when changing its size or position.
      if (key === 'width') box.set('x', Math.min(Number(box.get('x')) || 0, SW - actual))
      if (key === 'height') box.set('y', Math.min(Number(box.get('y')) || 0, SH - actual))
      if (key === 'x') box.set('x', Math.min(value, SW - Number(box.get('width'))))
      if (key === 'y') box.set('y', Math.min(value, SH - Number(box.get('height'))))
    }, 'geometry')
  })
}

$('object-rotation').addEventListener('change', event => {
  const box = objects.get(selected)
  if (presenting || box?.get('locked') === true || !box) return
  const value = Number(event.target.value)
  if (event.target.value.trim() === '' || !Number.isFinite(value) || value < -180 || value > 180) {
    status('Rotation must be between -180 and 180 degrees.', 'error')
    select(selected)
    return
  }
  box.set('rotation', value)
})

function supportsFormatting(box) {
  return box instanceof Y.Map && box.get('kind') !== 'image'
}
function updateFormatButtons() {
  $('copy-format').disabled = presenting || selectedIds.size !== 1 || !supportsFormatting(objects.get(selected))
  const targets = [...selectedIds].map(id => objects.get(id))
  $('paste-format').disabled = presenting || !formatClipboard || !targets.length || selectionLocked() || !targets.some(supportsFormatting)
}
$('copy-format').addEventListener('click', () => {
  const box = objects.get(selected)
  if (presenting || selectedIds.size !== 1 || !supportsFormatting(box)) return
  const appearance = boxStyle(box)
  const text = textStyle(box)
  formatClipboard = {
    appearance: { fillEnabled: appearance.fill, fillColour: appearance.fillColour, borderEnabled: appearance.border, borderColour: appearance.borderColour, borderWidth: appearance.width },
    text: box.get('kind') === 'shape' ? null : { fontFamily: text.family, fontSize: text.size, textColour: text.colour, textAlign: text.align },
  }
  updateFormatButtons()
  status('Formatting copied. Select targets, then use Apply formatting.')
})
$('paste-format').addEventListener('click', () => {
  if (presenting || !formatClipboard || selectionLocked()) return
  const targets = [...selectedIds].map(id => objects.get(id)).filter(supportsFormatting)
  if (!targets.length) return
  history?.stopCapturing()
  doc.transact(() => {
    for (const box of targets) {
      const style = { ...formatClipboard.appearance, ...(box.get('kind') === 'shape' ? {} : formatClipboard.text || {}) }
      for (const [key, value] of Object.entries(style)) box.set(key, value)
    }
  })
  history?.stopCapturing()
  status('Formatting applied to ' + targets.length + ' object' + (targets.length === 1 ? '.' : 's.'))
})
function updateTextStyle(key, value) {
  const box = objects.get(selected)
  const shapeAppearance = box?.get('kind') === 'shape' && ['fillEnabled', 'fillColour', 'borderEnabled', 'borderColour', 'borderWidth'].includes(key)
  if (presenting || selectedIds.size !== 1 || (!views.get(selected)?.editor && !shapeAppearance)) return
  objects.get(selected).set(key, value)
}
for (const [control, key] of [['fill-enabled', 'fillEnabled'], ['border-enabled', 'borderEnabled']]) {
  $(control).addEventListener('change', event => updateTextStyle(key, event.target.checked))
}
for (const [control, key] of [['fill-colour', 'fillColour'], ['border-colour', 'borderColour']]) {
  $(control).addEventListener('change', event => {
    if (/^#[0-9a-f]{6}$/i.test(event.target.value)) updateTextStyle(key, event.target.value)
  })
}
$('border-width').addEventListener('change', event => {
  const width = Number(event.target.value)
  if (!Number.isInteger(width) || width < 1 || width > 20) {
    status('Border width must be a whole number between 1 and 20 pixels.', 'error')
    select(selected)
    return
  }
  updateTextStyle('borderWidth', width)
})
$('font-family').addEventListener('change', event => {
  if (Object.prototype.hasOwnProperty.call(fontFamilies, event.target.value)) updateTextStyle('fontFamily', event.target.value)
})
$('font-size').addEventListener('change', event => {
  const value = Number(event.target.value)
  if (!Number.isFinite(value) || value < 8 || value > 200) {
    status('Font size must be between 8 and 200 pixels.', 'error')
    select(selected)
    return
  }
  updateTextStyle('fontSize', value)
})
$('text-colour').addEventListener('input', event => {
  if (/^#[0-9a-f]{6}$/i.test(event.target.value)) updateTextStyle('textColour', event.target.value)
})
$('text-align').addEventListener('change', event => {
  if (['left', 'center', 'right', 'justify'].includes(event.target.value)) updateTextStyle('textAlign', event.target.value)
})

function updateSavedLayoutActions() {
  const saved = savedLayouts.has($('slide-layout').value)
  const selectedLayout = savedLayouts.get($('slide-layout').value)
  const available = typeof options.onRenameSavedLayout === 'function' && typeof options.onDeleteSavedLayout === 'function'
  $('saved-layout-hint').textContent = managingLayout ? 'Layout dialog is open.' : !savedLayouts.size ? 'Use CList’s Save menu to save the current slide as a layout.' : !saved ? 'Select an entry under Saved layouts to rename or delete it.' : !available ? 'Layout management is available inside CList.' : 'Selected saved layout: ' + selectedLayout.label
  $('rename-layout').disabled = managingLayout || !saved || typeof options.onRenameSavedLayout !== 'function'
  $('delete-layout').disabled = managingLayout || !saved || typeof options.onDeleteSavedLayout !== 'function'
}
function removeSavedLayout(id) {
  const key = 'user:' + id
  savedLayouts.delete(key)
  const group = $('slide-layout').querySelector('optgroup[data-saved-layouts]')
  const option = group && [...group.children].find(entry => entry.value === key)
  option?.remove()
  if (group && !group.children.length) group.remove()
  if (!$('slide-layout').value) $('slide-layout').value = layoutCatalog.keys().next().value
  updateSavedLayoutActions()
}
async function manageSavedLayout(remove) {
  const saved = savedLayouts.get($('slide-layout').value)
  const callback = remove ? options.onDeleteSavedLayout : options.onRenameSavedLayout
  if (presenting || managingLayout || !saved || typeof callback !== 'function') return
  managingLayout = true
  updateSavedLayoutActions()
  try {
    const result = await callback({ ...saved })
    if (remove && result === true) removeSavedLayout(saved.id)
    else if (!remove && result) registerSavedLayout(result)
  } catch (error) {
    console.error('Saved layout management failed:', error)
    status('Could not ' + (remove ? 'delete' : 'rename') + ' layout: ' + error.message, 'error')
  } finally {
    managingLayout = false
    updateSavedLayoutActions()
  }
}
$('slide-layout').addEventListener('change', updateSavedLayoutActions)
$('rename-layout').addEventListener('click', () => manageSavedLayout(false).catch(error => { console.error('Layout rename failed:', error); status(error.message, 'error') }))
$('delete-layout').addEventListener('click', () => manageSavedLayout(true).catch(error => { console.error('Layout deletion failed:', error); status(error.message, 'error') }))
function createSavedLayout(label) {
  if (typeof label !== 'string' || !label.trim() || label.trim().length > 120) throw new Error('Enter a layout name of 1–120 characters.')
  const templateDoc = new Y.Doc()
  try {
    templateDoc.getMap('slide-pages').set('first', 0)
    templateDoc.getMap('slide-backgrounds').set('first', slideBackground(activeSlide))
    if (typeof notes.get(activeSlide) === 'string') templateDoc.getMap('slide-notes').set('first', notes.get(activeSlide))
    for (const id of orderedObjectIds()) {
      const box = objects.get(id), format = textStyle(box), appearance = boxStyle(box)
      const data = { ...box.toJSON(), slide: 'first', fontFamily: format.family, fontSize: format.size, textColour: format.colour, fillColour: appearance.fillColour, borderColour: appearance.borderColour }
      if (data.kind === 'shape') data.shapeDefinition = structuredClone(shapeDefinition(objects.get(id)))
      templateDoc.getMap('slide-objects').set(id, new Y.Map(Object.entries(data)))
      const text = doc.getXmlFragment('slide-text-' + id).toArray().map(node => node.clone())
      if (text.length) templateDoc.getXmlFragment('slide-text-' + id).insert(0, text)
    }
    const urls = new Set(orderedObjectIds().flatMap(id => objects.get(id).get('referenceUrls') || []))
    for (const reference of getReferences()) if (urls.has(reference.url)) templateDoc.getMap('clist_refs').set(reference.url, JSON.stringify(reference))
    const bytes = Y.encodeStateAsUpdate(templateDoc)
    let binary = ''
    for (const byte of bytes) binary += String.fromCharCode(byte)
    return { format: 'clist-slide-layout-v1', id: 'saved-' + crypto.randomUUID(), label: label.trim(), update: btoa(binary) }
  } finally { templateDoc.destroy() }
}
function decodeSavedLayout(value) {
  if (!value || value.format !== 'clist-slide-layout-v1' || typeof value.id !== 'string' || !/^saved-[a-z0-9-]+$/.test(value.id) || typeof value.label !== 'string' || !value.label.trim() || value.label.length > 120 || typeof value.update !== 'string') throw new Error('Invalid saved slide layout.')
  const templateDoc = new Y.Doc()
  try {
    Y.applyUpdate(templateDoc, Uint8Array.from(atob(value.update), character => character.charCodeAt(0)))
    const templatePages = templateDoc.getMap('slide-pages')
    if (templatePages.size !== 1 || !templatePages.has('first')) throw new Error('A saved layout must contain one slide.')
    templateDoc.getMap('slide-objects').forEach(box => {
      if (!(box instanceof Y.Map) || (box.get('slide') || 'first') !== 'first' || !['x', 'y', 'width', 'height'].every(key => typeof box.get(key) === 'number' && Number.isFinite(box.get(key))) || box.get('width') <= 0 || box.get('height') <= 0) throw new Error('Invalid object in saved slide layout.')
      if (box.get('kind') === 'shape' && box.get('shapeDefinition')) validateShapeDefinition(box.get('shapeDefinition'))
    })
    return templateDoc
  } catch (error) { templateDoc.destroy(); throw error }
}
function registerSavedLayout(value, { select: selectLayout = false } = {}) {
  const templateDoc = decodeSavedLayout(value)
  templateDoc.destroy()
  const copy = { format: value.format, id: value.id, label: value.label.trim(), update: value.update }
  savedLayouts.set('user:' + copy.id, copy)
  let group = $('slide-layout').querySelector('optgroup[data-saved-layouts]')
  if (!group) {
    group = document.createElement('optgroup')
    group.label = 'Saved layouts'
    group.dataset.savedLayouts = ''
    $('slide-layout').append(group)
  }
  let option = [...group.children].find(entry => entry.value === 'user:' + copy.id)
  if (!option) { option = document.createElement('option'); group.append(option) }
  option.value = 'user:' + copy.id
  option.textContent = copy.label
  if (selectLayout) $('slide-layout').value = option.value
  updateSavedLayoutActions()
  return copy
}
function addSavedLayoutSlide(value) {
  const templateDoc = decodeSavedLayout(value)
  try {
    const sourceObjects = templateDoc.getMap('slide-objects'), groupIds = new Map()
    const copies = [...sourceObjects.entries()].sort(([a, x], [b, y]) => objectLayer(x) - objectLayer(y) || a.localeCompare(b)).map(([sourceId, sourceBox]) => {
      const id = newId(), data = copyGroupData(sourceBox.toJSON(), groupIds)
      const fragment = doc.getXmlFragment('slide-text-' + id)
      history?.addToScope(fragment)
      return { id, data, fragment, text: templateDoc.getXmlFragment('slide-text-' + sourceId).toArray().map(node => node.clone()) }
    })
    const ids = slideIds(), slideId = 'slide-' + crypto.randomUUID()
    activeSlide = slideId
    selected = null; selectedIds.clear()
    history?.stopCapturing()
    doc.transact(() => {
      if (!pages.size) pages.set('first', 0)
      pages.set(slideId, Math.max(...ids.map(id => pages.get(id) || 0)) + 1)
      backgrounds.set(slideId, templateDoc.getMap('slide-backgrounds').get('first') || '#ffffff')
      notes.set(slideId, templateDoc.getMap('slide-notes').get('first') || '')
      templateDoc.getMap('clist_refs').forEach(value => { try { addReferences([JSON.parse(value)]) } catch {} })
      for (const copy of copies) {
        objects.set(copy.id, new Y.Map(Object.entries({ ...copy.data, slide: slideId })))
        if (copy.text.length) copy.fragment.insert(0, copy.text)
      }
    })
    history?.stopCapturing()
    render()
  } finally { templateDoc.destroy() }
}
function getReferences() {
  const result = []
  references.forEach(value => {
    try { const reference = normalizedReference(JSON.parse(value)); if (reference) result.push(reference) } catch { /* Ignore invalid remote metadata. */ }
  })
  return result
}
function notifyReferences() { options.onReferencesChange?.(getReferences()) }
function addReferences(values) {
  for (const value of values || []) {
    const reference = normalizedReference(value)
    if (reference && !references.has(reference.url)) references.set(reference.url, JSON.stringify(reference))
  }
}
function importContent(content, sourceReferences = []) {
  if (presenting) throw new Error('Return to editing before importing content.')
  const refs = [...new Map(sourceReferences.map(normalizedReference).filter(Boolean).map(ref => [ref.url, ref])).values()]
  const html = importedHtml(content, refs)
  stopDrag()
  const id = newId()
  history?.stopCapturing()
  doc.transact(() => {
    makeBox(id, 100, 120, 1000, 460)
    objects.get(id).set('referenceUrls', refs.map(ref => ref.url))
    addReferences(refs)
  })
  views.get(id).editor.commands.setContent(html)
  history?.stopCapturing()
  select(id)
  root.tabIndex = -1; root.focus({ preventScroll: true })
  status('Content imported into a new text box' + (refs.length ? ' with source references.' : '.'))
  return id
}
function snapshot() {
  if (!design.has('theme')) doc.transact(() => design.set('theme', structuredClone(currentTheme())), 'init')
  const bytes = Y.encodeStateAsUpdate(doc)
  const chunks = []
  for (let i = 0; i < bytes.length; i += 32768) chunks.push(String.fromCharCode(...bytes.subarray(i, i + 32768)))
  return { format: 'clist-slides-yjs-v1', document: $('doc-name').value, update: btoa(chunks.join('')) }
}
async function importPowerPoint(data, filename) {
  if (provider) throw new Error('Disconnect from collaboration before importing a PowerPoint file.')
  if (presenting) throw new Error('Return to editing before importing a PowerPoint file.')
  const plan = await readPowerPoint(data, filename)
  // Preparation is asynchronous; recheck the editor before committing anything.
  if (provider || presenting) throw new Error('Return to local editing before completing the import.')
  const staged = new Y.Doc()
  function textNode(source) {
    const element = new Y.XmlElement(source.type)
    for (const [key,value] of Object.entries(source.attrs || {})) element.setAttribute(key,value)
    const children = []
    let delta = []
    const flushText = () => { if (delta.length) { const text = new Y.XmlText(); text.applyDelta(delta); children.push(text); delta = [] } }
    for (const item of source.content || []) {
      if (item.type === 'text') {
        const marks = Object.fromEntries((item.marks || []).map(mark => [mark.type,mark.attrs || {}]))
        delta.push({insert:item.text,attributes:marks})
      } else { flushText(); children.push(textNode(item)) }
    }
    flushText()
    if (children.length) element.insert(0,children)
    return element
  }
  try {
    const existing = slideIds(), stagedPages = staged.getMap('pages'), stagedObjects = staged.getMap('objects')
    const firstOrder = Math.max(...existing.map(id=>pages.get(id) || 0)) + 1
    for (const [index,page] of plan.slides.entries()) {
      const id = 'slide-' + crypto.randomUUID()
      stagedPages.set(id,{order:firstOrder+index,background:page.background,notes:page.notes})
      page.objects.forEach((object,layer) => {
        const key = newId(), {text,...properties} = object
        if (properties.shapeDefinition) properties.shapeDefinition = validateShapeDefinition(properties.shapeDefinition)
        stagedObjects.set(key,{...properties,slide:id,layer})
        if (text) {
          const fragment=staged.getXmlFragment('slide-text-' + key)
          fragment.insert(0,text.map(textNode))
        }
      })
    }
    const entries = [...stagedObjects].map(([id,box]) => {
      const fragment = box.kind === 'text' ? doc.getXmlFragment('slide-text-' + id) : null
      if (fragment) history?.addToScope(fragment)
      return {id,box:new Y.Map(Object.entries(box)),fragment,text:fragment ? staged.getXmlFragment('slide-text-' + id).toArray().map(node=>node.clone()) : []}
    })
    stopDrag(); history?.stopCapturing()
    activeSlide = stagedPages.keys().next().value
    selected = null; selectedIds.clear()
    doc.transact(() => {
      if (!pages.size) pages.set('first',0)
      for (const [id,page] of stagedPages) {
        pages.set(id,page.order); backgrounds.set(id,page.background)
        if (page.notes) notes.set(id,page.notes)
      }
      for (const entry of entries) {
        objects.set(entry.id,entry.box)
        if (entry.fragment && entry.text.length) entry.fragment.insert(0,entry.text)
      }
    })
    history?.stopCapturing()
    render()
    status(plan.slides.length + ' PowerPoint slides imported. Use Undo to remove the import.')
    return {count:plan.slides.length,warnings:plan.warnings}
  } finally { staged.destroy() }
}
function loadSnapshot(data) {
  if (provider) throw new Error('Disconnect from Hocuspocus before replacing the document')
  if (!data || data.format !== 'clist-slides-yjs-v1' || typeof data.update !== 'string') {
    throw new Error('Unsupported document format')
  }

  // Decode and validate the incoming state before touching the current document.
  const raw = atob(data.update)
  const bytes = Uint8Array.from(raw, c => c.charCodeAt(0))
  const nextDoc = new Y.Doc()
  try {
    Y.applyUpdate(nextDoc, bytes)
  } catch (err) {
    nextDoc.destroy()
    throw err
  }

  // The existing Tiptap instances and deep observer are bound to the old Y.Doc.
  doc.off('beforeObserverCalls', markThumbnailChanges)
  objects.unobserveDeep(render)
  pages.unobserve(render)
  design.unobserve(render)
  backgrounds.unobserve(render)
  references.unobserve(notifyReferences)
  notes.unobserve(renderNotes)
  doc.off('update', renderThumbnails)
  doc.off('update', notifyChange)
  for (const view of views.values()) {
    view.editor?.destroy()
    view.node.remove()
  }
  views.clear()
  selected = null; selectedIds.clear()
  editorFocused = null
  stopDrag()
  destroyHistory()
  doc.destroy()

  doc = nextDoc
  objects = doc.getMap('slide-objects')
  pages = doc.getMap('slide-pages')
  backgrounds = doc.getMap('slide-backgrounds')
  notes = doc.getMap('slide-notes')
  references = doc.getMap('clist_refs')
  design = doc.getMap('slide-design')
  activeSlide = slideIds()[0]
  resetThumbnailIndex()
  doc.on('beforeObserverCalls', markThumbnailChanges)
  objects.observeDeep(render)
  pages.observe(render)
  design.observe(render)
  backgrounds.observe(render)
  references.observe(notifyReferences)
  notes.observe(renderNotes)
  doc.on('update', renderThumbnails)
  doc.on('update', notifyChange)
  seeded = true
  if (data.document) $('doc-name').value = data.document
  render()
  initializeHistory()
  notifyReferences()
  notifyChange()
}
function disconnect() {
  connectionAttempt++
  const previous = provider
  provider = null
  connected = false
  previous?.destroy()
  status('Local only')
  $('connect').textContent = 'Connect'
}
async function connect() {
  disconnect()
  const attempt = connectionAttempt
  try {
    const url = $('server-url').value.trim()
    let name = $('doc-name').value.trim()
    if (!/^wss?:\/\//i.test(url) || !name) throw new Error('Enter a WebSocket URL and document name')
    if (options.resolveDocumentName) name = await options.resolveDocumentName(name)
    if (attempt !== connectionAttempt) return
    $('doc-name').value = name
    const parameters = typeof options.parameters === 'function' ? options.parameters() : options.parameters
    // Local edits are retained and merged on sync.
    provider = new HocuspocusProvider({
      url, name, document: doc,
      token: options.token || $('token').value || undefined,
      parameters: parameters || {},
      onStatus: ({ status: state }) => {
        if (attempt === connectionAttempt) status(state === 'connected' ? 'Synchronizing...' : state)
      },
      onSynced: ({ state }) => {
        if (attempt !== connectionAttempt || state === false) return
        connected = true
        if (options.seed !== false) seedIfEmpty()
        status('Synced', 'connected')
      },
      onAuthenticationFailed: ({ reason } = {}) => {
        if (attempt !== connectionAttempt) return
        const detail = typeof reason === 'string' && reason.trim()
          ? reason.trim() : 'The server did not provide a reason.'
        console.error('Slides collaboration authentication failed:', detail)
        disconnect()
        status(`Authentication failed: ${detail}`, 'error')
      },
      onDisconnect: () => {
        if (attempt === connectionAttempt) { connected = false; status('Disconnected', 'error') }
      },
    })
    $('connect').textContent = 'Disconnect'
    status('Connecting...')
  } catch (err) {
    if (attempt !== connectionAttempt) return
    console.error('Slides connection failed:', err)
    disconnect()
    status(err.message, 'error')
  }
}
function reportConnectionError(err) {
  console.error('Slides connection failed:', err)
  status(err.message, 'error')
}
$('connect').addEventListener('click', () => {
  if (provider) disconnect()
  else connect().catch(reportConnectionError)
})

function updateHistoryButtons() {
  $('undo').disabled = presenting || !history?.undoStack.length
  $('redo').disabled = presenting || !history?.redoStack.length
}
function trackLocalOrigin(transaction) {
  if (transaction.local && transaction.origin !== 'init' && !suppressHistory) history.trackedOrigins.add(transaction.origin)
}
function initializeHistory() {
  history = new Y.UndoManager([...doc.share.values()], {
    trackedOrigins: new Set([null, 'geometry', 'layer']),
    captureTransaction: transaction => transaction.local && transaction.origin !== 'init' && !suppressHistory,
  })
  doc.on('beforeTransaction', trackLocalOrigin)
  for (const event of ['stack-item-added', 'stack-item-popped', 'stack-cleared', 'stack-item-updated']) history.on(event, updateHistoryButtons)
  updateHistoryButtons()
}
function destroyHistory() {
  doc.off('beforeTransaction', trackLocalOrigin)
  history?.destroy()
  history = null
}
function runHistory(redo = false) {
  if (presenting || !history) return
  stopDrag()
  history.stopCapturing()
  try {
    if (redo) history.redo()
    else history.undo()
    render()
    updateHistoryButtons()
  } catch (error) {
    console.error('Slides history failed:', error)
    status('Could not ' + (redo ? 'redo' : 'undo') + ': ' + error.message, 'error')
  }
}
function onObjectKey(event) {
  if (presenting || event.isComposing || event.ctrlKey || event.metaKey || event.altKey || !selected) return
  const target = event.target
  const editingText = target.isContentEditable || !!target.closest?.('[contenteditable="true"]')
  if (editingText) {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopImmediatePropagation()
      views.get(selected)?.node.focus({ preventScroll: true })
      editorFocused = null
    }
    return
  }
  if (target.closest?.('input, textarea, select, button')) return
  if (selectionLocked() && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Delete', 'Backspace'].includes(event.key)) {
    event.preventDefault(); event.stopImmediatePropagation()
    status('Unlock selected objects before moving or deleting.', 'error')
    return
  }
  const view = views.get(selected)
  if (!view) return
  if (event.key === 'Enter' && view.editor && selectedIds.size === 1) {
    event.preventDefault()
    view.editor.commands.focus()
    return
  }
  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault()
    event.stopImmediatePropagation()
    history?.stopCapturing()
    deleteSelected()
    history?.stopCapturing()
    root.tabIndex = -1
    root.focus({ preventScroll: true })
    return
  }
  const direction = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key]
  if (!direction) return
  event.preventDefault()
  event.stopImmediatePropagation()
  if (!event.repeat) history?.stopCapturing()
  const step = event.shiftKey ? 10 : 1
  const members = [...selectedIds].map(id => ({ id, ...objects.get(id).toJSON() }))
  const bounds = selectionBounds(members)
  const dx = Math.max(-bounds.x, Math.min(SW - bounds.x - bounds.width, direction[0] * step))
  const dy = Math.max(-bounds.y, Math.min(SH - bounds.y - bounds.height, direction[1] * step))
  doc.transact(() => {
    for (const member of members) {
      const box = objects.get(member.id)
      box.set('x', member.x + dx)
      box.set('y', member.y + dy)
    }
  }, 'geometry')
}
function onHistoryKey(event) {
  onObjectKey(event)
  if (presenting || !(event.ctrlKey || event.metaKey) || event.altKey || !root.contains(event.target)) return
  const key = event.key.toLowerCase()
  if (key !== 'z' && key !== 'y') return
  // Keep native editing history for the title/settings fields.
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName) && event.target !== $('speaker-notes')) return
  event.preventDefault()
  event.stopImmediatePropagation()
  runHistory(key === 'y' || event.shiftKey)
}
function historyBoundary() { history?.stopCapturing() }
$('undo').addEventListener('click', () => runHistory())
$('redo').addEventListener('click', () => runHistory(true))
root.addEventListener('click', historyBoundary, true)
root.addEventListener('click', historyBoundary)
root.addEventListener('change', historyBoundary, true)
root.addEventListener('change', historyBoundary)
root.addEventListener('keydown', onHistoryKey, true)

function presenterSlide(id, targetDocument) {
  const preview = targetDocument.createElement('div')
  preview.className = 'slide presenter-slide'
  preview.style.backgroundColor = slideBackground(id)
  preview.setAttribute('aria-label', 'Slide preview')
  for (const key of orderedObjectIds(id)) {
    const box = objects.get(key), node = targetDocument.createElement('div'), content = targetDocument.createElement('div')
    node.className = box.get('kind') === 'shape' ? 'slide-object shape-object' : 'slide-object'
    node.style.left = (100 * box.get('x') / SW) + '%'
    node.style.top = (100 * box.get('y') / SH) + '%'
    node.style.width = (100 * box.get('width') / SW) + '%'
    node.style.height = (100 * box.get('height') / SH) + '%'
    node.style.transform = 'rotate(' + (Number(box.get('rotation')) || 0) + 'deg)'
    node.style.zIndex = String(orderedObjectIds(id).indexOf(key))
    if (box.get('kind') === 'image') {
      content.className = 'image-content'
      const image = targetDocument.createElement('img')
      image.src = safeImageSource(box.get('source'))
      image.alt = typeof box.get('alt') === 'string' ? box.get('alt') : ''
      styleImage(image, box, true)
      content.append(image)
    } else if (box.get('kind') === 'shape') {
      content.className = 'shape-content'
      const svg = targetDocument.createElementNS('http://www.w3.org/2000/svg', 'svg')
      drawShape(svg, box)
      content.append(svg)
    } else {
      content.className = 'text-content'
      const format = textStyle(box), appearance = boxStyle(box), text = targetDocument.createElement('div')
      node.style.setProperty('--slide-font-size', (format.size / 12.8) + 'cqw')
      node.style.fontFamily = fontFamilies[format.family]
      node.style.color = format.colour
      node.style.textAlign = format.align
      content.style.backgroundColor = appearance.fill ? appearance.fillColour : 'transparent'
      content.style.border = appearance.border ? (appearance.width / 12.8) + 'cqw solid ' + appearance.borderColour : 'none'
      text.className = 'tiptap'
      text.append(renderPresenterText(doc.getXmlFragment('slide-text-' + key), targetDocument))
      content.append(text)
    }
    node.append(content)
    preview.append(node)
  }
  return preview
}
function powerPointModel() {
  // Capture the entire deck before any asynchronous library/image loading.
  return {
    title: options.presentationTitle?.() || $('doc-name').value || 'CList presentation',
    slides: slideIds().map(id => ({
      background: slideBackground(id),
      notes: typeof notes.get(id) === 'string' ? notes.get(id) : '',
      objects: orderedObjectIds(id).map(key => {
        const box = objects.get(key), kind = box.get('kind') || 'text'
        const object = { id: key, kind, x: Number(box.get('x')) || 0, y: Number(box.get('y')) || 0,
          width: Number(box.get('width')), height: Number(box.get('height')), rotation: Number(box.get('rotation')) || 0, style: boxStyle(box) }
        if (!(object.width > 0 && object.height > 0)) throw new Error('An object has invalid dimensions: ' + key)
        if (kind === 'text') {
          object.format = textStyle(box)
          object.runs = textRuns(renderPresenterText(doc.getXmlFragment('slide-text-' + key), document), object.format.size)
        } else if (kind === 'image') {
          object.source = safeImageSource(box.get('source'))
          if (!object.source) throw new Error('An image has no valid source: ' + key)
          object.alt = typeof box.get('alt') === 'string' ? box.get('alt') : ''
          const crop = imageCrop(box)
          object.crop = { ...crop }
          if (crop.fit === 'cover') Object.assign(object.crop, cropImageSize(box))
        } else if (kind === 'shape') {
          object.definition = structuredClone(shapeDefinition(box))
          const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
          drawShape(svg, box)
          svg.setAttribute('width', object.width); svg.setAttribute('height', object.height)
          // Standalone SVG images have no CSS query container.
          for (const element of svg.querySelectorAll('[vector-effect]')) element.style.strokeWidth = (object.style.border ? Math.min(object.style.width, object.width, object.height) : 0) + 'px'
          object.source = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(svg))
        } else throw new Error('Unsupported slide object: ' + kind)
        return object
      }),
    })),
  }
}
function updatePresenter() {
  if (!presenter) return
  if (presenter.closed) { presenter = null; return }
  const ids = slideIds(), index = ids.indexOf(activeSlide)
  presenter.update({ id: activeSlide, nextId: ids[index + 1], index, total: ids.length, notes: typeof notes.get(activeSlide) === 'string' ? notes.get(activeSlide) : '', presenting })
}
function openPresenterView() {
  try {
    if (presenter && !presenter.closed) { updatePresenter(); presenter.focus(); return }
    presenter = createPresenterWindow({
      renderSlide: presenterSlide,
      navigate: navigatePresentation,
      jump: position => { const ids = slideIds(); activeSlide = position === 'first' ? ids[0] : ids[ids.length - 1]; selected = null; selectedIds.clear(); render() },
      present: startPresentation,
      end: exitPresentation,
    })
    updatePresenter()
  } catch (error) {
    console.error('Presenter view could not open:', error)
    status('Presenter view could not open: ' + error.message, 'error')
    if (presenting) $('presentation-status').textContent = error.message
  }
}
$('presenter-view').addEventListener('click', openPresenterView)
$('presentation-presenter-view').addEventListener('click', openPresenterView)
function navigatePresentation(offset) {
  const ids = slideIds()
  const target = ids[ids.indexOf(activeSlide) + offset]
  if (!target) return
  activeSlide = target
  selected = null; selectedIds.clear()
  render()
}
function setPresenting(value) {
  findReplace?.presenting(value)
  presenting = value
  closeLinkControls()
  updateHistoryButtons()
  stopDrag()
  select(null)
  root.classList.toggle('presenting', value)
  canvasZoom.update()
  $('presentation-controls').hidden = !value
  for (const view of views.values()) view.editor?.setEditable(!value)
  if (value) {
    presentationFocus = document.activeElement
    root.tabIndex = -1
    root.focus()
  } else {
    presentationFocus?.focus?.()
    presentationFocus = null
  }
  renderThumbnails()
}
async function startPresentation() {
  setPresenting(true)
  $('presentation-status').textContent = ''
  try {
    if (root.requestFullscreen) await root.requestFullscreen()
  } catch (error) {
    console.error('Slides fullscreen failed:', error)
    $('presentation-status').textContent = 'Full screen unavailable. Presenting in this window.'
  }
}
async function exitPresentation() {
  setPresenting(false)
  try {
    if (document.fullscreenElement === root) await document.exitFullscreen()
  } catch (error) {
    console.error('Slides fullscreen exit failed:', error)
    status('Could not leave full screen. Press Escape.', 'error')
  }
}
function onPresentationKey(event) {
  if (!presenting || event.altKey || event.ctrlKey || event.metaKey) return
  if (event.key === 'Escape') {
    event.preventDefault()
    exitPresentation().catch(reportConnectionError)
  } else if (['ArrowRight', 'ArrowDown', 'PageDown', 'ArrowLeft', 'ArrowUp', 'PageUp', 'Home', 'End', ' '].includes(event.key)) {
    if (event.key === ' ' && event.target?.tagName === 'BUTTON') return
    event.preventDefault()
    if (event.key === 'Home' || event.key === 'End') {
      const ids = slideIds()
      activeSlide = event.key === 'Home' ? ids[0] : ids[ids.length - 1]
      render()
    } else navigatePresentation(['ArrowLeft', 'ArrowUp', 'PageUp'].includes(event.key) ? -1 : 1)
  }
}
function onFullscreenChange() {
  if (presenting && document.fullscreenElement !== root) setPresenting(false)
}
$('present').addEventListener('click', () => startPresentation().catch(reportConnectionError))
$('exit-presentation').addEventListener('click', () => exitPresentation().catch(reportConnectionError))
$('previous-slide').addEventListener('click', () => navigatePresentation(-1))
$('next-slide').addEventListener('click', () => navigatePresentation(1))
document.addEventListener('keydown', onPresentationKey)
document.addEventListener('fullscreenchange', onFullscreenChange)

if (options.url) connect().catch(reportConnectionError)
else if (options.seed !== false) seedIfEmpty()
render()
initializeHistory()
updateSavedLayoutActions()
findReplace = mountFindReplace({
  root, Y, getDocument:()=>doc, canEdit:()=>!presenting,
  getEntries:()=>slideIds().flatMap((slideId,index)=>[...(thumbnailObjects.get(slideId) || [])]
    .sort((a,b)=>objectLayer(objects.get(a))-objectLayer(objects.get(b)) || a.localeCompare(b))
    .filter(id=>!objects.get(id).get('kind') || objects.get(id).get('kind')==='text')
    .map(id=>({id,slideId,slideNumber:index+1,locked:objects.get(id).get('locked')===true,fragment:doc.getXmlFragment('slide-text-'+id)}))),
  selectedText:()=>{const editor=views.get(selected)?.editor;return editor ? editor.state.doc.textBetween(editor.state.selection.from,editor.state.selection.to,'\n') : ''},
  jump:match=>{
    navigatingFind = true
    try {
      stopDrag(); setSlideSelection([match.entry.slideId]); render(); select(match.entry.id)
      const view = views.get(match.entry.id)
      if (view?.editor) { view.editor.commands.setTextSelection({from:match.from,to:match.to}); view.editor.view.focus() }
      view?.node.scrollIntoView({block:'nearest',inline:'nearest'})
    } finally { navigatingFind = false }
  },
  transact:(matches,action)=>{
    if (presenting) return
    for (const fragment of new Set(matches.map(match=>match.entry.fragment))) history?.addToScope(fragment)
    history?.stopCapturing()
    doc.transact(action)
    history?.stopCapturing()
  },
  report:actionStatus,
  onError:error=>{
    console.error('Slides find/replace failed:',error)
    if (typeof window.showErrorModal==='function') window.showErrorModal(error.message,{title:'Find and replace failed'})
    else status('Find and replace failed: '+error.message,'error')
  },
})
return {
  getArticleHtml: () => buildSlideArticle({slideIds:slideIds(),renderSlide:presenterSlide}),
  getHtml: () => buildStandaloneHtml({slideIds:slideIds(),renderSlide:presenterSlide,title:options.presentationTitle?.() || $('doc-name').value || 'CList presentation'}),
  exportHtml: () => exportStandaloneHtml({slideIds:slideIds(),renderSlide:presenterSlide,title:options.presentationTitle?.() || $('doc-name').value || 'CList presentation'}),
  snapshotRecovery: recoverySnapshot.snapshot,
  importPowerPoint,
  exportPowerPoint: () => exportPowerPoint(powerPointModel()),
  exportPdf: () => openSlidePrintView({ slideIds: slideIds(), renderSlide: presenterSlide, title: options.presentationTitle?.() || $('doc-name').value || 'CList presentation' }),
  snapshot, loadSnapshot, importContent, getReferences, addReferences, connect, disconnect, createSavedLayout, registerSavedLayout, removeSavedLayout,
  get document() { return doc },
  get connected() { return connected },
  destroy() {
    findReplace?.destroy()
    recoverySnapshot.destroy()
    textOverflow.destroy()
    marquee.destroy()
    canvasZoom.destroy()
    presenter?.close()
    presenter = null
    document.removeEventListener('cut', onSlideCut, true)
    document.removeEventListener('paste', onSlidePaste, true)
    document.removeEventListener('keydown', onPresentationKey)
    document.removeEventListener('fullscreenchange', onFullscreenChange)
    if (presenting) exitPresentation().catch(reportConnectionError)
    disconnect()
    stopDrag()
    doc.off('beforeObserverCalls', markThumbnailChanges)
    objects.unobserveDeep(render)
  pages.unobserve(render)
  design.unobserve(render)
  backgrounds.unobserve(render)
  references.unobserve(notifyReferences)
  notes.unobserve(renderNotes)
  doc.off('update', renderThumbnails)
    doc.off('update', notifyChange)
    for (const view of views.values()) view.editor?.destroy()
    views.clear()
    destroyHistory()
    objectClipboard?.document.destroy()
    objectClipboard = null
    formatClipboard = null
    doc.destroy()
    root.remove()
  },
}
}
