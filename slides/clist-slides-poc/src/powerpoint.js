// PptxGenJS is self-hosted and loaded only when export is requested.
let library
export function loadPowerPointLibrary() {
  if (window.PptxGenJS) return Promise.resolve(window.PptxGenJS)
  if (!library) library = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    // Keep this as a separate self-hosted script rather than inlining it in the editor bundle.
    const libraryPath = '../../../js/vendor/pptxgen.bundle.js'
    script.src = new URL(libraryPath, import.meta.url).href
    script.onload = () => {
      if (window.PptxGenJS) resolve(window.PptxGenJS)
      else { library = null; script.remove(); reject(new Error('The PowerPoint export library did not initialize.')) }
    }
    script.onerror = () => { library = null; script.remove(); reject(new Error('The PowerPoint export library could not load. Please retry.')) }
    document.head.append(script)
  })
  return library
}

const inches = pixels => pixels / 96
const points = pixels => pixels * 0.75
const colour = hex => hex.replace('#', '')
const fonts = { system: 'Arial', arial: 'Arial', verdana: 'Verdana', georgia: 'Georgia', times: 'Times New Roman', courier: 'Courier New' }

// Read the same safe rich-text DOM as Presenter view. No Yjs/editor writes.
export function textRuns(fragment, fontSize) {
  const runs = []
  function inline(node, options = {}) {
    if (node.nodeType === 3) { if (node.textContent) runs.push({ text: node.textContent, options: { ...options } }); return }
    const tag = node.nodeName.toLowerCase(), next = { ...options }
    if (['strong', 'b'].includes(tag)) next.bold = true
    if (['em', 'i'].includes(tag)) next.italic = true
    if (tag === 'u') next.underline = { style: 'sng' }
    if (['s', 'strike'].includes(tag)) next.strike = 'sngStrike'
    if (['code', 'pre'].includes(tag)) next.fontFace = 'Courier New'
    if (tag === 'a' && /^(https?:|mailto:|tel:)/i.test(node.getAttribute('href') || '')) {
      next.hyperlink = { url: node.getAttribute('href') }; next.color = '2365BF'; next.underline = { style: 'sng' }
    }
    if (tag === 'br') { runs.push({ text: '', options: { ...next, breakLine: true } }); return }
    for (const child of node.childNodes) inline(child, next)
  }
  function block(node, list = null) {
    const tag = node.nodeName.toLowerCase()
    if (tag === 'ul' || tag === 'ol') {
      let index = Number(node.getAttribute('start')) || 1
      for (const child of node.children) block(child, { ordered: tag === 'ol', index: index++, level: (list?.level ?? -1) + 1 })
      return
    }
    if (tag === 'li' || tag === 'blockquote' || tag === 'div') {
      for (const child of node.childNodes) {
        if (child.nodeType === 3) {
          if (child.textContent.trim()) paragraph(child, list)
        } else block(child, list)
      }
    } else paragraph(node, list)
  }
  function paragraph(node, list) {
    const start = runs.length, options = {}
    if (/^H[1-6]$/.test(node.nodeName)) options.bold = true
    inline(node, options)
    if (runs.length === start) runs.push({ text: '\u200b', options: {} })
    for (const run of runs.slice(start)) {
      run.options.paraSpaceAfter = list ? points(fontSize * 0.2) : 6
      if (list) {
        run.options.bullet = list.ordered ? { type: 'number', startAt: list.index, indent: points(fontSize * 1.5) } : { indent: points(fontSize * 1.5) }
        run.options.indentLevel = Math.min(8, list.level)
        run.options.hanging = points(fontSize * 0.3)
      }
    }
    runs[runs.length - 1].options.breakLine = true
  }
  for (const child of fragment.childNodes) block(child)
  if (runs.length) delete runs[runs.length - 1].options.breakLine
  return runs
}

function appearance(style) {
  return {
    fill: style.fill ? { color: colour(style.fillColour) } : { color: 'FFFFFF', transparency: 100 },
    line: style.border ? { color: colour(style.borderColour), width: points(style.width) } : { color: 'FFFFFF', transparency: 100 },
  }
}

// Keep the standard catalog shapes as native, editable PowerPoint geometry.
function nativeShape(slide, object, bounds, pptx) {
  const definition = object.definition
  if (definition.elements.length !== 1) return false
  const { tag, attributes: a } = definition.elements[0]
  const [vx, vy, vw, vh] = definition.viewBox
  const fullRect = tag === 'rect' && !a.rx && !a.ry && (a.x || 0) === vx && (a.y || 0) === vy && a.width === vw && a.height === vh
  const fullEllipse = (tag === 'ellipse' && a.cx === vx + vw / 2 && a.cy === vy + vh / 2 && a.rx === vw / 2 && a.ry === vh / 2) ||
    (tag === 'circle' && vw === vh && a.cx === vx + vw / 2 && a.cy === vy + vh / 2 && a.r === vw / 2)
  const diagonal = tag === 'line' && a.x1 === vx && a.y1 === vy && a.x2 === vx + vw && a.y2 === vy + vh
  if (!fullRect && !fullEllipse && !diagonal) return false
  const stroke = object.style.border ? Math.min(object.style.width, object.width, object.height) : 0
  const inset = inches(stroke / 2)
  const style = appearance({ ...object.style, width: stroke })
  if (diagonal) style.fill.transparency = 100
  slide.addShape(fullRect ? pptx.ShapeType.rect : fullEllipse ? pptx.ShapeType.ellipse : pptx.ShapeType.line, {
    ...bounds, x: bounds.x + inset, y: bounds.y + inset, w: Math.max(0.001, bounds.w - inset * 2), h: Math.max(0.001, bounds.h - inset * 2), ...style,
  })
  return true
}

async function pictureData(object) {
  const image = new Image()
  image.src = object.source
  await image.decode()
  const canvas = document.createElement('canvas')
  const scale = Math.min(2, 4096 / Math.max(object.width, object.height))
  canvas.width = Math.max(1, Math.round(object.width * scale))
  canvas.height = Math.max(1, Math.round(object.height * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('The browser could not prepare a presentation image.')
  ctx.scale(canvas.width / object.width, canvas.height / object.height)
  let width, height
  if (object.crop?.fit === 'cover') {
    width = object.crop.width || Math.max(object.width, object.height * image.naturalWidth / image.naturalHeight)
    height = object.crop.height || width * image.naturalHeight / image.naturalWidth
  } else {
    const ratio = Math.min(object.width / image.naturalWidth, object.height / image.naturalHeight)
    width = image.naturalWidth * ratio; height = image.naturalHeight * ratio
  }
  ctx.drawImage(image, (object.width - width) * (object.crop?.x ?? 50) / 100, (object.height - height) * (object.crop?.y ?? 50) / 100, width, height)
  return canvas.toDataURL('image/png')
}

export async function buildPowerPoint(model, Constructor) {
  const PptxGenJS = Constructor || await loadPowerPointLibrary()
  const pptx = new PptxGenJS()
  pptx.defineLayout({ name: 'CLIST', width: inches(1280), height: inches(720) })
  pptx.layout = 'CLIST'
  pptx.title = model.title
  pptx.subject = 'CList presentation'
  pptx.author = ''; pptx.company = ''
  pptx.lang = 'en-CA'
  const warnings = new Set()
  for (const page of model.slides) {
    const slide = pptx.addSlide()
    slide.background = { color: colour(page.background) }
    if (page.notes) slide.addNotes(page.notes)
    for (const object of page.objects) {
      const bounds = { x: inches(object.x), y: inches(object.y), w: inches(object.width), h: inches(object.height), rotate: ((object.rotation || 0) % 360 + 360) % 360, objectName: object.id }
      if (object.kind === 'text') {
        const format = object.format
        slide.addText(object.runs.length ? object.runs : '', {
          ...bounds, ...appearance(object.style), fontFace: fonts[format.family], fontSize: points(format.size),
          color: colour(format.colour), align: format.align, valign: 'top', margin: [points(5), points(8), points(5), points(8)],
          breakLine: false, lineSpacingMultiple: 1.2, paraSpaceAfter: 6, wrap: true, fit: 'none',
        })
      } else if (object.kind === 'shape' && nativeShape(slide, object, bounds, pptx)) {
        // Already added as native geometry.
      } else {
        if (object.kind === 'shape') warnings.add('Custom SVG shapes were exported as images.')
        slide.addImage({ ...bounds, data: await pictureData(object), altText: object.alt || object.definition?.label || '' })
      }
    }
  }
  return { pptx, warnings: [...warnings] }
}

export async function exportPowerPoint(model) {
  const { pptx, warnings } = await buildPowerPoint(model)
  const filename = (model.title.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').replace(/[. ]+$/, '').slice(0, 120) || 'CList presentation') + '.pptx'
  await pptx.writeFile({ fileName: filename, compression: true })
  return warnings
}
