import { loadPowerPointLibrary } from './powerpoint.js'

const P = 'http://schemas.openxmlformats.org/presentationml/2006/main'
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const child = (node, name) => [...(node?.children || [])].find(n => n.localName === name)
const all = (node, name) => [...(node?.getElementsByTagNameNS('*', name) || [])]
const first = (node, name) => all(node, name)[0]
const number = (node, key, fallback = 0) => node?.hasAttribute(key) ? Number(node.getAttribute(key)) : fallback
const truth = value => value === '1' || value === 'true'
const placeholder = node => first(node, 'ph')
const point = (x, y, matrix) => ({ x: matrix[0] * x + matrix[2] * y + matrix[4], y: matrix[1] * x + matrix[3] * y + matrix[5] })
const multiply = (a, b) => [a[0]*b[0]+a[2]*b[1], a[1]*b[0]+a[3]*b[1], a[0]*b[2]+a[2]*b[3], a[1]*b[2]+a[3]*b[3], a[0]*b[4]+a[2]*b[5]+a[4], a[1]*b[4]+a[3]*b[5]+a[5]]
const identity = [1, 0, 0, 1, 0, 0]
const px = value => value / 9525

function pathFrom(source, target) {
  if (!target || /[\\?#]/.test(target) || /^[a-z]+:/i.test(target)) throw new Error('The presentation contains an invalid internal relationship.')
  const parts = target.startsWith('/') ? [] : source.split('/').slice(0, -1)
  for (const part of decodeURIComponent(target).split('/')) {
    if (!part || part === '.') continue
    if (part === '..') { if (!parts.length) throw new Error('A presentation relationship leaves the package.'); parts.pop() }
    else parts.push(part)
  }
  return parts.join('/')
}

export async function readPowerPoint(data, filename = 'Imported presentation.pptx') {
  if (!(data instanceof ArrayBuffer || data instanceof Uint8Array) || data.byteLength > 100 * 1024 * 1024) throw new Error('Choose a .pptx file smaller than 100 MB.')
  await loadPowerPointLibrary()
  const zip = await window.JSZip.loadAsync(data)
  const entries = Object.values(zip.files)
  if (entries.length > 10000 || entries.reduce((sum, entry) => sum + (entry._data?.uncompressedSize || 0), 0) > 300 * 1024 * 1024) throw new Error('This presentation is too large to import in the browser.')
  const xmlCache = new Map(), relCache = new Map(), mediaCache = new Map(), warnings = new Set()
  let slideNumber = 0
  const warn = message => warnings.add((slideNumber ? 'Slide ' + slideNumber + ': ' : '') + message)
  async function xml(path, required = false) {
    if (xmlCache.has(path)) return xmlCache.get(path)
    const file = zip.file(path)
    if (!file) { if (required) throw new Error('The presentation is missing ' + path + '.'); return null }
    if (file._data?.uncompressedSize > 20 * 1024 * 1024) throw new Error('A presentation XML part is too large: ' + path)
    const text = await file.async('string')
    if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw new Error('XML document declarations are not supported in PowerPoint imports.')
    const result = new DOMParser().parseFromString(text, 'application/xml')
    if (result.getElementsByTagName('parsererror').length) throw new Error('The presentation contains invalid XML: ' + path)
    xmlCache.set(path, result)
    return result
  }
  async function relationships(path) {
    if (relCache.has(path)) return relCache.get(path)
    const parts = path.split('/'), name = parts.pop()
    const doc = await xml([...parts, '_rels', name + '.rels'].join('/'))
    const result = new Map(all(doc, 'Relationship').map(node => [node.getAttribute('Id'), {
      type: node.getAttribute('Type').split('/').pop(), external: node.getAttribute('TargetMode') === 'External',
      target: node.getAttribute('Target'),
    }]))
    relCache.set(path, result)
    return result
  }
  async function related(path, type) {
    const relation = [...(await relationships(path)).values()].find(item => item.type === type && !item.external)
    const target = relation && pathFrom(path, relation.target)
    return target ? { path: target, doc: await xml(target, true) } : null
  }
  const rootRels = await relationships('')
  const office = [...rootRels.values()].find(item => item.type === 'officeDocument' && !item.external)
  const presentationPath = office ? pathFrom('', office.target) : 'ppt/presentation.xml'
  const presentation = await xml(presentationPath, true)
  if (presentation.documentElement.namespaceURI !== P) throw new Error('This PowerPoint XML format is not supported. Save it as a standard .pptx file first.')
  const size = first(presentation, 'sldSz'), sourceWidth = px(number(size, 'cx')), sourceHeight = px(number(size, 'cy'))
  if (!(sourceWidth > 0 && sourceHeight > 0)) throw new Error('The presentation has invalid slide dimensions.')
  const scale = Math.min(1280 / sourceWidth, 720 / sourceHeight)
  const offsetX = (1280 - sourceWidth * scale) / 2, offsetY = (720 - sourceHeight * scale) / 2
  if (Math.abs(sourceWidth / sourceHeight - 16 / 9) > 0.01) warn('Slides were fitted and centred on CList’s 16:9 canvas.')
  const slideIds = [...(child(presentation.documentElement, 'sldIdLst')?.children || [])]
  if (!slideIds.length || slideIds.length > 500) throw new Error('Import supports presentations containing 1–500 slides.')
  if (first(presentation, 'custShowLst')) warn('Custom slide shows were not imported.')
  const slides = [], presentationRels = await relationships(presentationPath)

  for (const slideId of slideIds) {
    slideNumber++
    const relation = presentationRels.get(slideId.getAttributeNS(R, 'id'))
    if (!relation || relation.external || relation.type !== 'slide') throw new Error('Slide ' + slideNumber + ' has no valid slide relationship.')
    const path = pathFrom(presentationPath, relation.target), doc = await xml(path, true)
    const layout = await related(path, 'slideLayout'), master = layout && await related(layout.path, 'slideMaster')
    const theme = master && await related(master.path, 'theme')
    const colours = { dk1: '000000', lt1: 'FFFFFF', dk2: '1F497D', lt2: 'EEECE1', accent1: '4F81BD', accent2: 'C0504D', hlink: '0000FF', folHlink: '800080' }
    for (const entry of first(theme?.doc, 'clrScheme')?.children || []) colours[entry.localName] = entry.firstElementChild?.getAttribute('lastClr') || entry.firstElementChild?.getAttribute('val') || colours[entry.localName]
    const colourMap = { bg1: 'lt1', tx1: 'dk1', bg2: 'lt2', tx2: 'dk2' }
    for (const map of [first(master?.doc, 'clrMap'), first(layout?.doc, 'overrideClrMapping'), first(doc, 'overrideClrMapping')]) for (const attr of map?.attributes || []) colourMap[attr.name] = attr.value
    function colour(node, fallback = '#000000') {
      if (!node) return fallback
      const value = node.localName === 'srgbClr' || node.localName === 'schemeClr' || node.localName === 'sysClr' ? node : [...(node.children || [])].find(n => ['srgbClr', 'schemeClr', 'sysClr', 'prstClr'].includes(n.localName))
      if (!value) { warn('An unsupported colour was replaced.'); return fallback }
      let hex = value.localName === 'schemeClr' ? colours[colourMap[value.getAttribute('val')] || value.getAttribute('val')] : value.localName === 'sysClr' ? value.getAttribute('lastClr') : value.getAttribute('val')
      if (!/^[a-f0-9]{6}$/i.test(hex || '')) { warn('An unsupported colour was replaced.'); return fallback }
      let rgb = [0,2,4].map(i => parseInt(hex.slice(i,i+2), 16))
      for (const transform of value.children) {
        const amount = number(transform, 'val') / 100000
        if (transform.localName === 'tint') rgb = rgb.map(v => v + (255-v) * amount)
        else if (['shade', 'lumMod'].includes(transform.localName)) rgb = rgb.map(v => v * amount)
        else if (transform.localName === 'lumOff') rgb = rgb.map(v => v + 255 * amount)
        else if (transform.localName === 'alpha' && amount !== 1 && amount !== 0) warn('Transparency was simplified; image transparency is preserved.')
        else if (!['alpha'].includes(transform.localName)) warn('Some theme colour adjustments were simplified.')
      }
      return '#' + rgb.map(v => Math.round(Math.max(0,Math.min(255,v))).toString(16).padStart(2,'0')).join('')
    }
    function matchPlaceholder(node, source) {
      const ph = placeholder(node)
      if (!ph || !source) return null
      const candidates = all(source, 'sp').filter(shape => placeholder(shape))
      return candidates.find(shape => (placeholder(shape).getAttribute('idx') || '0') === (ph.getAttribute('idx') || '0')) ||
        candidates.find(shape => (placeholder(shape).getAttribute('type') || 'obj') === (ph.getAttribute('type') || 'obj'))
    }
    function inherited(node) {
      const fromLayout = matchPlaceholder(node, layout?.doc)
      return [node, fromLayout, matchPlaceholder(fromLayout || node, master?.doc)].filter(Boolean)
    }
    function shapeStyle(nodes) {
      const properties = nodes.map(n => child(n, 'spPr')).filter(Boolean)
      const fill = properties.map(p => [...p.children].find(n => ['solidFill','noFill','gradFill','pattFill','blipFill','grpFill'].includes(n.localName))).find(Boolean)
      if (fill && !['solidFill','noFill'].includes(fill.localName)) warn('A non-solid shape fill was simplified.')
      const fillRef = nodes.map(n => first(child(n, 'style'), 'fillRef')).find(Boolean)
      const line = properties.map(p => child(p,'ln')).find(Boolean)
      const lineRef = nodes.map(n => first(child(n, 'style'), 'lnRef')).find(Boolean)
      const fillColour = colour(fill?.localName === 'solidFill' ? fill : fillRef, '#51b158')
      const borderColour = colour(child(line, 'solidFill') || lineRef, '#000000')
      const width = px(number(line, 'w', 12700)) * scale
      if (child(line,'prstDash')?.getAttribute('val') && child(line,'prstDash').getAttribute('val') !== 'solid') warn('Dashed shape borders were imported as solid lines.')
      if (child(line,'headEnd')?.getAttribute('type') !== undefined && child(line,'headEnd').getAttribute('type') !== 'none' || child(line,'tailEnd')?.getAttribute('type') !== undefined && child(line,'tailEnd').getAttribute('type') !== 'none') warn('Line arrowheads were not imported.')
      return { fillEnabled: !!fill ? fill.localName !== 'noFill' && !all(fill,'alpha').some(n => number(n,'val') === 0) : !!fillRef && number(fillRef,'idx') !== 0,
        fillColour, borderEnabled: !!line ? !child(line,'noFill') && !all(line,'alpha').some(n => number(n,'val') === 0) : !!lineRef && number(lineRef,'idx') !== 0,
        borderColour, borderWidth: Math.max(1,Math.min(20,width)) }
    }
    function transform(node, matrix, nodes = [node]) {
      const xfrm = nodes.map(n => child(child(n,'spPr'),'xfrm')).find(Boolean)
      if (!xfrm) { warn('An object without a usable position was skipped.'); return null }
      const off = child(xfrm,'off'), ext = child(xfrm,'ext')
      const x = px(number(off,'x')), y = px(number(off,'y')), width = px(number(ext,'cx')), height = px(number(ext,'cy'))
      if (![x,y,width,height].every(Number.isFinite) || width < 0 || height < 0) throw new Error('Slide ' + slideNumber + ' contains an invalid object position.')
      const angle = number(xfrm,'rot') / 60000 * Math.PI / 180
      const rotation = [Math.cos(angle),Math.sin(angle),-Math.sin(angle),Math.cos(angle),0,0]
      const combined = multiply(matrix, rotation), centre = point(x + width/2, y + height/2, matrix)
      const w = Math.max(1, width * Math.hypot(combined[0],combined[1]) * scale), h = Math.max(1, height * Math.hypot(combined[2],combined[3]) * scale)
      if (Math.abs(combined[0]*combined[2]+combined[1]*combined[3]) > 0.001) warn('A rotated object in a stretched group was approximated.')
      return { x: centre.x * scale + offsetX - w/2, y: centre.y * scale + offsetY - h/2, width: w, height: h,
        rotation: Math.atan2(combined[1],combined[0]) * 180 / Math.PI, flipH: truth(xfrm.getAttribute('flipH')) !== (matrix[0]*matrix[3]-matrix[1]*matrix[2] < 0), flipV: truth(xfrm.getAttribute('flipV')) }
    }
    async function imageData(blipFill, ownerPath, bounds) {
      const blip = child(blipFill,'blip'), relation = (await relationships(ownerPath)).get(blip?.getAttributeNS(R,'embed'))
      if (!relation || relation.external || relation.type !== 'image') { warn('A linked or missing picture was skipped; no external images were fetched.'); return null }
      const imagePath = pathFrom(ownerPath,relation.target), extension = imagePath.split('.').pop().toLowerCase()
      const mime = { png:'image/png', jpg:'image/jpeg', jpeg:'image/jpeg', gif:'image/gif', webp:'image/webp' }[extension]
      if (!mime) { warn('A picture in unsupported format .' + extension + ' was skipped.'); return null }
      if (!mediaCache.has(imagePath)) {
        const file = zip.file(imagePath)
        if (!file) throw new Error('A presentation picture is missing: ' + imagePath)
        mediaCache.set(imagePath, 'data:' + mime + ';base64,' + await file.async('base64'))
      }
      let source = mediaCache.get(imagePath)
      const image = new Image()
      await new Promise((resolve,reject) => {
        image.onload = resolve
        image.onerror = () => reject(new Error('Slide ' + slideNumber + ' contains an image the browser could not read.'))
        image.src = source
      })
      const crop = child(blipFill,'srcRect'), l = number(crop,'l') / 100000, t = number(crop,'t') / 100000, r = number(crop,'r') / 100000, b = number(crop,'b') / 100000
      if (l+r >= 1 || t+b >= 1 || ![l,t,r,b].every(Number.isFinite)) throw new Error('Slide ' + slideNumber + ' contains invalid image cropping.')
      if (l || t || r || b || bounds.flipH || bounds.flipV || Math.abs(image.naturalWidth/image.naturalHeight - bounds.width/bounds.height) > 0.001) {
        const canvas = document.createElement('canvas'), ratio = Math.min(2,4096/Math.max(bounds.width,bounds.height))
        canvas.width = Math.max(1,Math.round(bounds.width*ratio)); canvas.height = Math.max(1,Math.round(bounds.height*ratio))
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('The browser could not prepare an imported image.')
        ctx.translate(bounds.flipH ? canvas.width : 0,bounds.flipV ? canvas.height : 0); ctx.scale(bounds.flipH ? -1 : 1,bounds.flipV ? -1 : 1)
        ctx.drawImage(image,l*image.naturalWidth,t*image.naturalHeight,(1-l-r)*image.naturalWidth,(1-t-b)*image.naturalHeight,0,0,canvas.width,canvas.height)
        source = canvas.toDataURL('image/png')
      }
      if (blip?.children.length) warn('Picture effects and SVG-specific extensions were not imported; the embedded raster picture was used.')
      if (child(blipFill,'tile') || [...(first(blipFill,'fillRect')?.attributes || [])].some(a=>Number(a.value))) warn('Picture tiling or fill offsets were simplified.')
      return { kind:'image', source, alt:'', imageFit:'contain', imageRatio: bounds.width/bounds.height, keepAspectRatio:true, aspectRatio:bounds.width/bounds.height }
    }
    function textObject(node, nodes, bounds, ownerRels) {
      const body = child(node,'txBody')
      if (!body) return null
      const phType = placeholder(node)?.getAttribute('type') || 'body'
      const styles = first(master?.doc,'txStyles'), textStyle = child(styles, ['title','ctrTitle'].includes(phType) ? 'titleStyle' : ['body','obj'].includes(phType) ? 'bodyStyle' : 'otherStyle')
      const themeFont = type => first(first(theme?.doc, type === 'major' ? 'majorFont' : 'minorFont'),'latin')?.getAttribute('typeface') || 'Arial'
      let baseFormat = null
      const fonts = { arial:'arial', 'arial narrow':'arial', calibri:'system', aptos:'system', 'aptos display':'system', 'times new roman':'times', verdana:'verdana', georgia:'georgia', 'courier new':'courier' }
      const blocks = []
      const bodyPr = child(body,'bodyPr')
      if (bodyPr?.getAttribute('vert') && bodyPr.getAttribute('vert') !== 'horz') warn('Vertical text was imported horizontally.')
      if (bodyPr?.getAttribute('anchor') && bodyPr.getAttribute('anchor') !== 't') warn('Vertically aligned text was moved to the top of its text box.')
      if (bounds.flipH || bounds.flipV) warn('Mirrored text was imported without mirroring.')
      if (['lIns','rIns','tIns','bIns'].some((key,index)=>bodyPr?.hasAttribute(key) && Math.abs(px(number(bodyPr,key))*scale - (index<2?8:5))>1)) warn('Text box padding was replaced with CList’s standard padding.')
      for (const paragraph of [...body.children].filter(n => n.localName === 'p')) {
        const pPr = child(paragraph,'pPr'), level = Math.max(0,Math.min(8,number(pPr,'lvl')))
        const inheritedProps = nodes.map(n => child(first(n,'lstStyle'),'lvl' + (level+1) + 'pPr')).filter(Boolean)
        const defaults = [child(pPr,'defRPr'),...inheritedProps.map(p=>child(p,'defRPr')),child(child(textStyle,'lvl' + (level+1) + 'pPr'),'defRPr')].filter(Boolean)
        const paragraphProps = [pPr,...inheritedProps,child(textStyle,'lvl' + (level+1) + 'pPr')].filter(Boolean)
        const align = paragraphProps.map(p=>p.getAttribute('algn')).find(Boolean) || 'l'
        const alignName = { l:'left', ctr:'center', r:'right', just:'justify' }[align] || 'left'
        if (!['l','ctr','r','just'].includes(align)) warn('An unsupported paragraph alignment was replaced with left alignment.')
        if (pPr && (number(pPr,'marL') || number(pPr,'marR') || number(pPr,'indent') || child(pPr,'tabLst') || child(pPr,'spcBef') || child(pPr,'lnSpc') || child(pPr,'spcAft'))) warn('Paragraph spacing, indents or tab stops were replaced with CList’s standard text layout.')
        const content = []
        for (const run of paragraph.children) {
          if (run.localName === 'br') { content.push({type:'hardBreak'}); continue }
          if (!['r','fld'].includes(run.localName)) continue
          if (run.localName === 'fld') warn('Dynamic text fields were converted to plain text.')
          const text = child(run,'t')?.textContent || ''
          if (!text) continue
          const properties = [child(run,'rPr'),...defaults].filter(Boolean)
          const attr = (key, fallback) => properties.find(p=>p.hasAttribute(key))?.getAttribute(key) ?? fallback
          let face = properties.map(p=>child(p,'latin')?.getAttribute('typeface')).find(Boolean) || '+mn-lt'
          if (/^\+mj/.test(face)) face = themeFont('major')
          if (/^\+mn/.test(face)) face = themeFont('minor')
          const family = fonts[face.toLowerCase()] || 'arial'
          if (!fonts[face.toLowerCase()] || family === 'system') warn('Font “' + face + '” was replaced with a CList font.')
          const size = Number(attr('sz',2400))/100/0.75*scale
          if (!Number.isFinite(size) || size <= 0) throw new Error('Slide ' + slideNumber + ' has an invalid text size.')
          const format = { fontSize:Math.max(8,Math.min(200,size)), fontFamily:family, textColour:colour(properties.map(p=>child(p,'solidFill')).find(Boolean),'#000000'), textAlign:alignName }
          if (!baseFormat) baseFormat = format
          else if (JSON.stringify(baseFormat) !== JSON.stringify(format)) warn('Mixed font sizes, fonts, colours or alignment within a text box were simplified to its first text style.')
          if (size < 8 || size > 200) warn('A text size was adjusted to CList’s 8–200 pixel range.')
          const marks = []
          if (truth(attr('b','0'))) marks.push({type:'bold'})
          if (truth(attr('i','0'))) marks.push({type:'italic'})
          if (attr('u','none') !== 'none') marks.push({type:'underline'})
          if (attr('strike','noStrike') !== 'noStrike') marks.push({type:'strike'})
          if (Number(attr('baseline',0))) warn('Superscript or subscript text was imported on the baseline.')
          const link = properties.map(p=>child(p,'hlinkClick')).find(Boolean)
          if (link) {
            const rel = ownerRels.get(link.getAttributeNS(R,'id'))
            if (rel?.external && /^(https?:|mailto:|tel:)/i.test(rel.target)) marks.push({type:'link',attrs:{href:rel.target}})
            else warn('An internal or unsupported hyperlink was removed.')
          }
          content.push({type:'text',text,marks})
        }
        const bullet = paragraphProps.map(p=>[...p.children].find(n=>['buNone','buChar','buAutoNum','buBlip'].includes(n.localName))).find(Boolean)
        if (bullet?.localName === 'buBlip') warn('Picture bullets were replaced with standard bullets.')
        if (bullet?.localName === 'buAutoNum' && bullet.getAttribute('type') !== 'arabicPeriod') warn('A numbering style was replaced with decimal numbering.')
        blocks.push({type:'paragraph',content, list:bullet && bullet.localName !== 'buNone' ? {type:bullet.localName === 'buAutoNum' ? 'orderedList':'bulletList',level,start:number(bullet,'startAt',1)} : null})
      }
      // Reconstruct editable nested Tiptap lists, retaining paragraph boundaries.
      const output = [], stack = []
      for (const block of blocks) {
        const {list,...paragraph} = block
        if (!list) { stack.length = 0; output.push(paragraph); continue }
        const depth = Math.min(list.level,stack.length)
        stack.length = Math.min(stack.length,depth+1)
        if (!stack[depth] || stack[depth].type !== list.type) {
          const node = {type:list.type,...(list.type === 'orderedList' ? {attrs:{start:list.start}}:{}),content:[]}
          if (depth && stack[depth-1]?.content.length) stack[depth-1].content.at(-1).content.push(node)
          else output.push(node)
          stack[depth] = node
        }
        stack[depth].content.push({type:'listItem',content:[paragraph]})
      }
      return { kind:'text',...baseFormat || {fontSize:32,fontFamily:'arial',textColour:'#000000',textAlign:'left'}, text:output }
    }
    function shapeDefinition(node, nodes) {
      const properties = nodes.map(n=>child(n,'spPr')).find(p=>child(p,'prstGeom') || child(p,'custGeom')) || child(node,'spPr'), geometry = child(properties,'prstGeom'), preset = geometry?.getAttribute('prst') || (node.localName === 'cxnSp' ? 'line' : 'rect')
      if (child(properties,'custGeom')) { warn('A custom vector shape was skipped.'); return null }
      if (first(geometry,'gd')) warn('Custom adjustments to a preset shape were simplified.')
      const shapes = {
        rect:{tag:'rect',attributes:{x:0,y:0,width:1000,height:1000}}, ellipse:{tag:'ellipse',attributes:{cx:500,cy:500,rx:500,ry:500}},
        roundRect:{tag:'rect',attributes:{x:0,y:0,width:1000,height:1000,rx:160,ry:160}}, line:{tag:'line',attributes:{x1:0,y1:0,x2:1000,y2:1000}},
        triangle:{tag:'polygon',attributes:{points:'500,0 1000,1000 0,1000'}}, rtTriangle:{tag:'polygon',attributes:{points:'0,0 1000,1000 0,1000'}},
        diamond:{tag:'polygon',attributes:{points:'500,0 1000,500 500,1000 0,500'}}, parallelogram:{tag:'polygon',attributes:{points:'250,0 1000,0 750,1000 0,1000'}},
        hexagon:{tag:'polygon',attributes:{points:'250,0 750,0 1000,500 750,1000 250,1000 0,500'}},
      }
      if (!shapes[preset]) { warn('Unsupported shape “' + preset + '” was skipped; any text was retained.'); return null }
      return {id:'pptx-' + preset.toLowerCase(),label:preset,width:100,height:100,defaults:{},viewBox:[0,0,1000,1000],elements:[shapes[preset]]}
    }
    const page = {background:'#ffffff',notes:'',objects:[]}
    async function walk(tree, ownerPath, matrix = identity, templates = false) {
      if (!tree) return
      const rels = await relationships(ownerPath)
      for (const node of tree?.children || []) {
        if (['nvGrpSpPr','grpSpPr','extLst'].includes(node.localName)) continue
        if (node.namespaceURI !== P) { warn('An extension object was skipped.'); continue }
        if (node.localName === 'grpSp') {
          const xfrm = child(child(node,'grpSpPr'),'xfrm'), off=child(xfrm,'off'), ext=child(xfrm,'ext'), chOff=child(xfrm,'chOff'), chExt=child(xfrm,'chExt')
          const sx=number(ext,'cx')/number(chExt,'cx'), sy=number(ext,'cy')/number(chExt,'cy')
          if (!Number.isFinite(sx) || !Number.isFinite(sy)) { warn('A group with invalid dimensions was skipped.'); continue }
          const ox=px(number(off,'x')),oy=px(number(off,'y')),w=px(number(ext,'cx')),h=px(number(ext,'cy')),cx=ox+w/2,cy=oy+h/2
          const angle=number(xfrm,'rot')/60000*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle),fx=truth(xfrm.getAttribute('flipH'))?-1:1,fy=truth(xfrm.getAttribute('flipV'))?-1:1
          const group=multiply([c*fx,s*fx,-s*fy,c*fy,cx,cy],[sx,0,0,sy,ox-cx-px(number(chOff,'x'))*sx,oy-cy-px(number(chOff,'y'))*sy])
          warn('Grouped objects were imported as individual editable objects.')
          await walk(node,ownerPath,multiply(matrix,group),templates); continue
        }
        if (!['sp','pic','cxnSp'].includes(node.localName)) { warn((node.localName === 'graphicFrame' ? 'A chart, table or SmartArt object' : 'Unsupported object “' + node.localName + '”') + ' was skipped.'); continue }
        if (node.localName === 'cxnSp' && (first(node,'stCxn') || first(node,'endCxn'))) warn('An attached connector was imported as an ordinary line.')
        if (templates && placeholder(node)) {
          if (['ftr','hdr','dt','sldNum'].includes(placeholder(node).getAttribute('type')) && all(node,'t').some(n=>n.textContent.trim())) warn('Template footer, header, date or slide-number placeholders were not imported.')
          continue
        }
        if (truth(first(node,'cNvPr')?.getAttribute('hidden'))) { warn('A hidden object was skipped.'); continue }
        const nodes = templates ? [node] : inherited(node), bounds=transform(node,matrix,nodes)
        if (!bounds) continue
        const {flipH,flipV,...geometry}=bounds, style=shapeStyle(nodes)
        if (first(node,'effectLst')?.children.length || first(node,'effectDag') || first(node,'scene3d') || first(node,'sp3d')) warn('Shadows, 3D or other visual effects were not imported.')
        if (node.localName === 'pic') {
          const image=await imageData(child(node,'blipFill'),ownerPath,bounds)
          if (image) {
            image.alt=first(node,'cNvPr')?.getAttribute('descr') || first(node,'cNvPr')?.getAttribute('name') || ''
            const mask=first(child(node,'spPr'),'prstGeom')?.getAttribute('prst')
            if (mask && mask !== 'rect') warn('A picture shape mask was replaced with a rectangular image.')
            page.objects.push({...geometry,...image})
          }
          continue
        }
        const text=textObject(node,nodes,bounds,rels), definition=shapeDefinition(node,nodes)
        if (definition && (style.fillEnabled || style.borderEnabled)) {
          if ((flipH || flipV) && !['rect','ellipse','roundRect'].includes(definition.label)) {
            const [element]=definition.elements
            if (element.tag === 'line') { if(flipH) [element.attributes.x1,element.attributes.x2]=[element.attributes.x2,element.attributes.x1]; if(flipV) [element.attributes.y1,element.attributes.y2]=[element.attributes.y2,element.attributes.y1] }
            else if(element.tag === 'polygon') element.attributes.points=element.attributes.points.split(' ').map(pair=>{const [x,y]=pair.split(',').map(Number);return (flipH?1000-x:x)+','+(flipV?1000-y:y)}).join(' ')
          }
          page.objects.push({...geometry,...style,kind:'shape',shapeDefinition:definition,shapeType:definition.id})
        }
        if (text) page.objects.push({...geometry,...text,fillEnabled:false,borderEnabled:false})
      }
    }
    const background = [first(doc,'bg'),first(layout?.doc,'bg'),first(master?.doc,'bg')].find(Boolean)
    if (background) {
      const props=child(background,'bgPr'), fill=child(props,'solidFill') || child(background,'bgRef')
      if (fill) page.background=colour(fill,'#ffffff')
      else if(child(props,'blipFill')) {
        const owner=first(doc,'bg') ? path : first(layout?.doc,'bg') ? layout.path : master.path
        const bounds={x:offsetX,y:offsetY,width:sourceWidth*scale,height:sourceHeight*scale}
        const image=await imageData(child(props,'blipFill'),owner,bounds)
        if(image) page.objects.push({...bounds,...image})
      } else if(!child(props,'noFill')) warn('An unsupported slide background was replaced with white.')
    }
    if (doc.documentElement.getAttribute('showMasterSp') !== '0' && layout?.doc.documentElement.getAttribute('showMasterSp') !== '0') await walk(first(master?.doc,'spTree'),master?.path,identity,true)
    await walk(first(layout?.doc,'spTree'),layout?.path,identity,true)
    await walk(first(doc,'spTree'),path)
    const notes = await related(path,'notesSlide')
    if (notes) page.notes=all(notes.doc,'sp').filter(shape=>!['sldImg','sldNum','hdr','ftr','dt'].includes(placeholder(shape)?.getAttribute('type'))).map(shape=>all(child(shape,'txBody'),'p').map(p=>all(p,'t').map(t=>t.textContent).join('')).join('\n')).filter(Boolean).join('\n')
    if (notes && (first(notes.doc,'pic') || first(notes.doc,'graphicFrame'))) warn('Images or other non-text content in speaker notes were not imported.')
    if (first(doc,'timing') || first(doc,'transition')) warn('Animations and slide transitions were not imported.')
    if (doc.documentElement.getAttribute('show') === '0') warn('This hidden slide was imported as a visible slide.')
    const rels=await relationships(path)
    for(const rel of rels.values()) if(['chart','diagramData','oleObject','audio','video','media','comments','comment'].includes(rel.type)) warn('Charts, SmartArt, embedded files, media or comments are not supported.')
    if (page.objects.length > 5000 || slides.reduce((sum,s)=>sum+s.objects.length,0) + page.objects.length > 20000) throw new Error('This presentation contains too many objects to import in the browser.')
    slides.push(page)
  }
  return {title:filename.replace(/\.pptx$/i,''),slides,warnings:[...warnings]}
}
