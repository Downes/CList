// Account posts are documents, not standalone applications: use basic HTML only.
export async function buildSlideArticle({ slideIds, renderSlide }) {
  const page = document.implementation.createHTMLDocument('')
  // Capture before the first await so later edits cannot mix into this article.
  const slides = slideIds.map(id=>renderSlide(id,page))
  const article = page.createElement('div')
  const allowed = new Set(['p','strong','em','s','u','code','pre','blockquote','ul','ol','li','hr','br'])
  function copyText(node) {
    if (node.nodeType === 3) return page.createTextNode(node.textContent)
    const tag=node.nodeName.toLowerCase()
    let output
    if (/^h[1-6]$/.test(tag)) output=page.createElement('h3')
    else if (tag==='a' && /^(https?:|mailto:|tel:)/i.test(node.getAttribute('href') || '')) {
      output=page.createElement('a');output.setAttribute('href',node.getAttribute('href'))
    } else if (allowed.has(tag)) output=page.createElement(tag)
    else output=page.createDocumentFragment()
    if(tag==='ol' && /^\d+$/.test(node.getAttribute('start') || '')) output.setAttribute('start',node.getAttribute('start'))
    for(const child of node.childNodes) output.append(copyText(child))
    return output
  }
  async function loadImage(source) {
    return await new Promise((resolve,reject)=>{
      const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('A slide image could not be read.'));image.src=source
    })
  }
  function canvas(width,height) {
    const element=document.createElement('canvas'),scale=Math.min(2,4096/Math.max(width,height))
    element.width=Math.max(1,Math.round(width*scale));element.height=Math.max(1,Math.round(height*scale))
    const context=element.getContext('2d')
    if(!context) throw new Error('The browser could not prepare a slide image.')
    context.scale(element.width/width,element.height/height)
    return {element,context}
  }
  function appendImage(source,alt,width,height) {
    const paragraph=page.createElement('p'),output=page.createElement('img')
    // Explicit HTML dimensions survive services which strip inline CSS. The
    // responsive rule also allows small screens to shrink the image proportionally.
    const scale=Math.min(1,720/width)
    output.width=Math.max(1,Math.round(width*scale))
    output.height=Math.max(1,Math.round(height*scale))
    output.style.maxWidth='100%';output.style.height='auto'
    output.src=source;output.alt=alt
    paragraph.append(output);article.append(paragraph)
  }
  async function diagramImage(slide) {
    // Keep the full visual context: connector lines, labels and pictures must
    // share one coordinate system instead of becoming separate article images.
    const copy=slide.cloneNode(true)
    copy.style.width='1280px';copy.style.height='720px'
    for(const object of copy.children) {
      const width=parseFloat(object.style.width)*12.8
      for(const element of [object,...object.querySelectorAll('[style]')]) {
        const factor=element.closest('.shape-content')?width/100:12.8
        element.setAttribute('style',element.getAttribute('style').replace(/([\d.]+)cqw/g,(_,n)=>Number(n)*factor+'px'))
      }
    }
    const root=page.createElement('div')
    const style=page.createElement('style')
    style.textContent=`
      * {box-sizing:border-box;} .slide {position:relative;overflow:hidden;font-family:Arial,sans-serif;color:#202b3d;}
      .slide-object {position:absolute;} .text-content {width:100%;height:100%;overflow:hidden;padding:5px 8px;}
      .tiptap {font-size:var(--slide-font-size,33.28px);line-height:1.2;}
      p {margin:0 0 8px;} h1 {font-size:1em;} h2 {font-size:24px;} h3 {font-size:20px;}
      ul,ol {margin:0 0 .3em;padding-left:1.5em;} li p {margin-bottom:.2em;}
      .image-content {width:100%;height:100%;overflow:hidden;}
      .image-content img {display:block;width:100%;height:100%;object-fit:contain;}
      .shape-content,.shape-content svg {display:block;width:100%;height:100%;}
    `
    root.append(style,copy)
    const serialized=new XMLSerializer().serializeToString(root)
    const source='data:image/svg+xml;charset=utf-8,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720"><foreignObject width="1280" height="720">'+serialized+'</foreignObject></svg>')
    const bitmap=await loadImage(source),raster=canvas(1280,720)
    raster.context.drawImage(bitmap,0,0,1280,720)
    return raster.element.toDataURL('image/png')
  }
  for(const [index,slide]of slides.entries()) {
    const heading=page.createElement('h2');heading.textContent='Slide '+(index+1);article.append(heading)
    const objects=[...slide.children].sort((a,b)=>parseFloat(a.style.top)-parseFloat(b.style.top) || parseFloat(a.style.left)-parseFloat(b.style.left))
    const hasDiagram=!!slide.querySelector('svg')
    if(hasDiagram) {
      const labels=objects.map(object=>object.querySelector('.tiptap')?.textContent.trim()).filter(Boolean)
      appendImage(await diagramImage(slide),'Slide '+(index+1)+' diagram'+(labels.length?': '+labels.join('; '):''),1280,720)
    }
    for(const object of objects) {
      const text=object.querySelector('.text-content .tiptap')
      if(text) { for(const child of text.childNodes) article.append(copyText(child)); continue }
      if(hasDiagram) continue
      let source,alt
      const image=object.querySelector('img'),svg=object.querySelector('svg')
      let width=parseFloat(object.style.width)*12.8,height=parseFloat(object.style.height)*7.2
      if(image) {
        source=image.getAttribute('src') || '';alt=image.alt
        if(!/^data:image\/(png|jpeg|gif|webp);base64,[a-z0-9+/=\s]+$/i.test(source)) throw new Error('A slide image is missing or is not embedded.')
        const bitmap=await loadImage(source)
        if(image.style.position==='absolute') {
          const crop=canvas(width,height)
          crop.context.drawImage(bitmap,parseFloat(image.style.left)*12.8,parseFloat(image.style.top)*12.8,parseFloat(image.style.width)*12.8,parseFloat(image.style.height)*12.8)
          source=crop.element.toDataURL('image/png')
        } else {
          const scale=Math.min(width/bitmap.width,height/bitmap.height)
          width=bitmap.width*scale;height=bitmap.height*scale
        }
      } else if(svg) {
        const copy=svg.cloneNode(true);copy.setAttribute('width',width);copy.setAttribute('height',height)
        for(const element of copy.querySelectorAll('[vector-effect]')) {
          const stroke=parseFloat(element.style.strokeWidth)*width/100
          element.style.removeProperty('stroke-width');element.setAttribute('stroke-width',Number.isFinite(stroke)?stroke:0)
        }
        const bitmap=await loadImage('data:image/svg+xml;charset=utf-8,'+encodeURIComponent(new XMLSerializer().serializeToString(copy)))
        const raster=canvas(width,height);raster.context.drawImage(bitmap,0,0,width,height)
        source=raster.element.toDataURL('image/png');alt='Diagram on slide '+(index+1)
      } else continue
      appendImage(source,alt || 'Image on slide '+(index+1),width,height)
    }
    if(index<slides.length-1) article.append(page.createElement('hr'))
  }
  return article.innerHTML
}
