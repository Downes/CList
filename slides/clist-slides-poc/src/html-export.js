// All presentation assets and viewer code are embedded; no CList runtime is exported.
const viewerCss = `
:root { --highlight-color:#2e7d32; --highlight-hover:#1b5e20; --highlight-text-color:#fff; font-family:system-ui,sans-serif; }
* { box-sizing:border-box; margin:0; padding:0; }
body { background:#151b23; color:#fff; }
.stage { display:grid; justify-items:center; gap:16px; padding:16px; }
.slide { position:relative; width:min(100%,1280px); aspect-ratio:16/9; overflow:hidden; container-type:inline-size; color:#202b3d; background:#fff; font-family:Inter,ui-sans-serif,system-ui,sans-serif; }
.slide[hidden] { display:none; }
.slide-object { position:absolute; border:0; min-height:0; overflow:visible; }
.text-content { height:100%; width:100%; overflow:hidden; padding:5px 8px; }
.text-content .tiptap { height:100%; line-height:1.2; font-size:var(--slide-font-size,2.6cqw); color:inherit; text-align:inherit; }
.text-content p { margin:0 0 8px; font:inherit; color:inherit; }
.text-content h1 { font-size:1em; } .text-content h2 { font-size:1.5rem; } .text-content h3 { font-size:1.25rem; } .text-content h4 { font-size:1.125rem; }
.text-content h1,.text-content h2,.text-content h3,.text-content h4 { font-weight:650; line-height:1.2; }
.text-content ul,.text-content ol { margin:0 0 .3em; padding:0 0 0 1.5em; font:inherit; color:inherit; list-style-position:outside; }
.text-content ul { list-style-type:disc; } .text-content ol { list-style-type:decimal; }
.text-content li { display:list-item; margin:0; padding:0; font:inherit; color:inherit; }
.text-content li::marker { font-size:1em; color:inherit; } .text-content li>p { margin:0 0 .2em; }
.text-content a { color:#2365bf; text-decoration:underline; }
.image-content { width:100%; height:100%; overflow:hidden; }
.image-content img { width:100%; height:100%; object-fit:contain; display:block; }
.shape-content,.shape-content svg { display:block; width:100%; height:100%; }
.shape-content { container-type:inline-size; }
.controls { position:fixed; inset:auto 0 0; min-height:64px; display:flex; align-items:center; justify-content:center; flex-wrap:wrap; gap:8px; padding:8px; background:#151b23; z-index:1; font-size:14px; }
.controls[hidden] { display:none; }
button { font:inherit; cursor:pointer; border:0; }
.btn { display:inline-block; background:var(--highlight-color); color:var(--highlight-text-color); padding:6px 10px; border-radius:4px; }
.btn:hover { background:var(--highlight-hover); } .btn:disabled { opacity:.45; cursor:default; }
.btn:focus-visible,a:focus-visible { outline:2px solid #fff; outline-offset:2px; }
.interactive .stage { position:fixed; inset:0 0 64px; display:flex; align-items:center; justify-content:center; padding:0; }
.interactive .slide { flex:none; width:min(100vw,calc((100dvh - 64px)*16/9)); }
.viewer-status { position:fixed; bottom:68px; left:8px; right:8px; text-align:center; background:#151b23; }
@media print {
  @page { size:1280px 720px; margin:0; }
  html,body { width:1280px; height:auto; overflow:visible; background:#fff; }
  .stage,.interactive .stage { position:static; display:block; padding:0; }
  .slide,.interactive .slide,.slide[hidden] { display:block!important; width:1280px; height:720px; margin:0; break-inside:avoid; break-after:page; print-color-adjust:exact; -webkit-print-color-adjust:exact; }
  .slide:last-child { break-after:auto; }
  .controls,.viewer-status { display:none!important; }
}
`

// This function is serialized into the exported page. Keep it independent of module state.
function runViewer() {
  const slides = [...document.querySelectorAll('.stage > .slide')]
  const previous = document.querySelector('[data-action="previous"]'), next = document.querySelector('[data-action="next"]')
  const fullscreen = document.querySelector('[data-action="fullscreen"]'), counter = document.querySelector('output'), status = document.querySelector('.viewer-status')
  let index = 0, statusTimer
  function show(position) {
    index = Math.max(0,Math.min(slides.length-1,position))
    slides.forEach((slide,i)=>{ slide.hidden=i!==index })
    previous.disabled = index===0; next.disabled = index===slides.length-1
    counter.textContent = (index+1)+' / '+slides.length
    // Embedded srcdoc previews have no addressable document URL.
    if (['http:','https:','file:'].includes(location.protocol)) history.replaceState(null,'',location.href.split('#')[0]+'#slide-'+(index+1))
  }
  function hashPosition() { const match=location.hash.match(/^#slide-(\d+)$/); return match ? Number(match[1])-1 : 0 }
  previous.addEventListener('click',()=>show(index-1)); next.addEventListener('click',()=>show(index+1))
  fullscreen.disabled = !document.documentElement.requestFullscreen
  fullscreen.addEventListener('click',async()=>{
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await document.documentElement.requestFullscreen()
    } catch(error) {
      console.error('Fullscreen failed:',error)
      status.textContent='Full screen is unavailable. You can continue viewing in this window.'
      clearTimeout(statusTimer); statusTimer=setTimeout(()=>{status.textContent=''},3000)
    }
  })
  document.addEventListener('fullscreenchange',()=>{fullscreen.textContent=document.fullscreenElement?'Exit full screen':'Full screen'})
  window.addEventListener('hashchange',()=>show(hashPosition()))
  document.addEventListener('keydown',event=>{
    if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing || event.target.closest?.('input,textarea,[contenteditable="true"]')) return
    if (event.key===' ' && event.target.closest?.('button')) return
    if (!['ArrowRight','ArrowDown','PageDown',' ','ArrowLeft','ArrowUp','PageUp','Home','End'].includes(event.key)) return
    event.preventDefault()
    if (event.key==='Home') show(0)
    else if(event.key==='End') show(slides.length-1)
    else show(index+(['ArrowRight','ArrowDown','PageDown',' '].includes(event.key)?1:-1))
  })
  document.body.classList.add('interactive')
  document.querySelector('.controls').hidden=false
  show(hashPosition())
}

export async function buildStandaloneHtml({ slideIds, renderSlide, title = 'CList presentation' }) {
  if (!slideIds.length) throw new Error('There are no slides to export.')
  const page = document.implementation.createHTMLDocument(title)
  page.documentElement.lang = 'en'
  const charset=page.createElement('meta');charset.setAttribute('charset','utf-8');page.head.prepend(charset)
  const viewport=page.createElement('meta');viewport.name='viewport';viewport.content='width=device-width, initial-scale=1';page.head.append(viewport)
  const style=page.createElement('style');style.textContent=viewerCss;page.head.append(style)
  const main=page.createElement('main');main.className='stage';main.setAttribute('aria-label',title);page.body.append(main)
  for (const [index,id] of slideIds.entries()) {
    const slide=renderSlide(id,page)
    slide.id='slide-'+(index+1);slide.setAttribute('role','group');slide.setAttribute('aria-label','Slide '+(index+1)+' of '+slideIds.length)
    main.append(slide)
  }
  const footer=page.createElement('nav');footer.className='controls';footer.hidden=true;footer.setAttribute('aria-label','Slide navigation')
  for (const [label,action] of [['Previous','previous'],['Next','next'],['Full screen','fullscreen']]) {
    const button=page.createElement('button');button.type='button';button.className='btn';button.textContent=label;button.title=label;button.dataset.action=action;footer.append(button)
  }
  const counter=page.createElement('output');counter.setAttribute('aria-live','polite');footer.insertBefore(counter,footer.children[1])
  page.body.append(footer)
  const status=page.createElement('p');status.className='viewer-status';status.setAttribute('role','status');page.body.append(status)
  const script=page.createElement('script');script.textContent='('+runViewer.toString()+')();';page.body.append(script)
  // Validate captured image data before offering a file. No remote URLs are fetched.
  await Promise.all([...main.querySelectorAll('img')].map(image=>new Promise((resolve,reject)=>{
    const source=image.getAttribute('src') || ''
    if (!/^data:image\/(png|jpeg|gif|webp);base64,[a-z0-9+/=\s]+$/i.test(source)) { reject(new Error('A slide image is missing or is not embedded.')); return }
    const check=new Image();check.onload=resolve;check.onerror=()=>reject(new Error('A slide image could not be read.'));check.src=source
  })))
  return '<!doctype html>\n'+page.documentElement.outerHTML
}

export async function exportStandaloneHtml(options) {
  const content=await buildStandaloneHtml(options)
  const filename=(options.title.replace(/[<>:"/\\|?*\u0000-\u001f]/g,'-').replace(/[. ]+$/,'').slice(0,120)||'CList presentation')+'.html'
  const url=URL.createObjectURL(new Blob([content],{type:'text/html;charset=utf-8'})), link=document.createElement('a')
  link.href=url;link.download=filename;document.body.append(link)
  try { link.click() } finally { link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000) }
}
