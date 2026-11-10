import defaultShapes from '../catalogs/shapes.json'
import defaultLayouts from '../catalogs/layouts.json'
import defaultThemes from '../catalogs/themes.json'

const attributes = {
  rect: ['x', 'y', 'width', 'height', 'rx', 'ry'],
  circle: ['cx', 'cy', 'r'], ellipse: ['cx', 'cy', 'rx', 'ry'],
  line: ['x1', 'y1', 'x2', 'y2'], polygon: ['points'], polyline: ['points'], path: ['d'],
}
const colour = value => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)
const number = value => typeof value === 'number' && Number.isFinite(value)
function requireValue(condition, message) { if (!condition) throw new Error('Slide catalog: ' + message) }
function identity(value) {
  requireValue(value && typeof value.id === 'string' && /^[a-z][a-z0-9-]{0,79}$/.test(value.id), 'invalid entry ID')
  requireValue(typeof value.label === 'string' && value.label.trim().length > 0 && value.label.length <= 120, value.id + ' needs a label')
}
function style(value, label) {
  const out = {}
  for (const key of ['fillEnabled', 'borderEnabled', 'keepAspectRatio', 'locked']) {
    if (value[key] !== undefined) { requireValue(typeof value[key] === 'boolean', label + ': invalid ' + key); out[key] = value[key] }
  }
  for (const key of ['fillColour', 'borderColour', 'textColour']) {
    if (value[key] !== undefined) { requireValue(colour(value[key]), label + ': invalid ' + key); out[key] = value[key] }
  }
  for (const [key, min, max] of [['fontSize', 8, 200], ['borderWidth', 1, 20], ['rotation', -180, 180], ['cropX', 0, 100], ['cropY', 0, 100]]) {
    if (value[key] !== undefined) { requireValue(number(value[key]) && value[key] >= min && value[key] <= max, label + ': invalid ' + key); out[key] = value[key] }
  }
  for (const [key, allowed] of [['textAlign', ['left', 'center', 'right', 'justify']], ['fontFamily', ['system', 'arial', 'verdana', 'georgia', 'times', 'courier']], ['imageFit', ['contain', 'cover']]]) {
    if (value[key] !== undefined) { requireValue(allowed.includes(value[key]), label + ': invalid ' + key); out[key] = value[key] }
  }
  return out
}
export function validateShapeDefinition(value) {
  identity(value)
  requireValue(number(value.width) && value.width > 0 && value.width <= 1280 && number(value.height) && value.height > 0 && value.height <= 720, value.id + ': invalid default dimensions')
  requireValue(Array.isArray(value.viewBox) && value.viewBox.length === 4 && value.viewBox.every(number) && value.viewBox[2] > 0 && value.viewBox[3] > 0, value.id + ': invalid SVG viewBox')
  requireValue(Array.isArray(value.elements) && value.elements.length > 0 && value.elements.length <= 64, value.id + ': needs 1–64 SVG elements')
  const elements = value.elements.map(element => {
    requireValue(element && Object.hasOwn(attributes, element.tag), value.id + ': unsupported SVG element')
    requireValue(element.attributes && typeof element.attributes === 'object', value.id + ': missing SVG attributes')
    const attrs = {}
    for (const [key, val] of Object.entries(element.attributes)) {
      requireValue(attributes[element.tag].includes(key), value.id + ': unsupported SVG attribute ' + key)
      if (key === 'd') requireValue(typeof val === 'string' && val.length <= 65536 && /^[MmLlHhVvCcSsQqTtAaZz0-9eE+.,\s-]+$/.test(val), value.id + ': invalid path')
      else if (key === 'points') requireValue(typeof val === 'string' && val.length <= 65536 && /^[0-9eE+.,\s-]+$/.test(val), value.id + ': invalid points')
      else requireValue(number(val), value.id + ': invalid SVG coordinate')
      attrs[key] = val
    }
    return { tag: element.tag, attributes: attrs }
  })
  return { id: value.id, label: value.label, width: value.width, height: value.height, defaults: style(value.defaults || {}, value.id), viewBox: [...value.viewBox], elements }
}
function validateLayout(value, shapes) {
  identity(value)
  requireValue(Array.isArray(value.objects) && value.objects.length <= 100, value.id + ': invalid objects array')
  if (value.background !== undefined) requireValue(colour(value.background), value.id + ': invalid background')
  if (value.notes !== undefined) requireValue(typeof value.notes === 'string', value.id + ': invalid notes')
  const objects = value.objects.map(entry => {
    requireValue(entry && ['text', 'shape', 'image'].includes(entry.kind), value.id + ': unsupported object kind')
    requireValue(['x', 'y', 'width', 'height'].every(key => number(entry[key])) && entry.x >= 0 && entry.y >= 0 && entry.width > 0 && entry.height > 0 && entry.x + entry.width <= 1280 && entry.y + entry.height <= 720, value.id + ': object is outside the slide')
    const result = { kind: entry.kind, x: entry.x, y: entry.y, width: entry.width, height: entry.height, ...style(entry, value.id) }
    if (entry.kind === 'text') { requireValue(typeof entry.text === 'string', value.id + ': text object needs text'); result.text = entry.text }
    if (entry.kind === 'shape') { requireValue(shapes.has(entry.shapeId), value.id + ': unknown shape ' + entry.shapeId); result.shapeId = entry.shapeId }
    if (entry.kind === 'image') {
      requireValue(typeof entry.source === 'string' && /^data:image\/(png|jpeg|gif|webp);base64,[a-z0-9+/=\s]+$/i.test(entry.source), value.id + ': image needs embedded image data')
      result.source = entry.source
      result.alt = typeof entry.alt === 'string' ? entry.alt : ''
    }
    if (entry.group !== undefined) { requireValue(typeof entry.group === 'string' && entry.group.length <= 80, value.id + ': invalid group'); result.group = entry.group }
    return result
  })
  return { id: value.id, label: value.label, objects, ...(value.background !== undefined ? { background: value.background } : {}), ...(value.notes !== undefined ? { notes: value.notes } : {}) }
}
export function validateThemeDefinition(value) {
  identity(value)
  requireValue(['system', 'arial', 'verdana', 'georgia', 'times', 'courier'].includes(value.fontFamily), value.id + ': invalid theme font')
  requireValue(number(value.fontSize) && value.fontSize >= 8 && value.fontSize <= 200, value.id + ': invalid theme font size')
  const result = { id: value.id, label: value.label, fontFamily: value.fontFamily, fontSize: value.fontSize }
  for (const key of ['textColour', 'background', 'fillColour', 'borderColour']) {
    requireValue(colour(value[key]), value.id + ': invalid theme ' + key)
    result[key] = value[key]
  }
  return result
}
export function prepareSlideCatalogs(input = {}) {
  const shapes = new Map(), layouts = new Map(), themes = new Map()
  const shapeEntries = input.shapes === undefined ? defaultShapes.shapes : input.shapes
  const layoutEntries = input.layouts === undefined ? defaultLayouts.layouts : input.layouts
  requireValue(Array.isArray(shapeEntries) && shapeEntries.length > 0, 'shapes must be a nonempty array')
  requireValue(Array.isArray(layoutEntries) && layoutEntries.length > 0, 'layouts must be a nonempty array')
  for (const entry of shapeEntries) { const definition = validateShapeDefinition(entry); requireValue(!shapes.has(entry.id), 'duplicate shape ID ' + entry.id); shapes.set(entry.id, definition) }
  for (const entry of layoutEntries) { const layout = validateLayout(entry, shapes); requireValue(!layouts.has(entry.id), 'duplicate layout ID ' + entry.id); layouts.set(entry.id, layout) }
  const themeEntries = input.themes === undefined ? defaultThemes.themes : input.themes
  requireValue(Array.isArray(themeEntries) && themeEntries.length > 0, 'themes must be a nonempty array')
  for (const entry of themeEntries) { const theme = validateThemeDefinition(entry); requireValue(!themes.has(entry.id), 'duplicate theme ID ' + entry.id); themes.set(entry.id, theme) }
  return { shapes, layouts, themes }
}
export async function loadSlideCatalogs(baseUrl) {
  const results = await Promise.all(['shapes', 'layouts', 'themes'].map(async name => {
    const response = await fetch(new URL(name + '.json', baseUrl), { cache: 'no-cache' })
    if (!response.ok) throw new Error('Could not load slide ' + name + ' catalog (HTTP ' + response.status + ').')
    const data = await response.json()
    requireValue(data && data.version === 1, 'unsupported ' + name + ' catalog version')
    requireValue(Array.isArray(data[name]), name + ' catalog needs a ' + name + ' array')
    return data[name]
  }))
  const raw = { shapes: results[0], layouts: results[1], themes: results[2] }
  prepareSlideCatalogs(raw)
  return raw
}
