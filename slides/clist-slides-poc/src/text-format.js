export const slideFonts = { system: 'system-ui, sans-serif', arial: 'Arial, Helvetica, sans-serif', verdana: 'Verdana, Geneva, sans-serif', georgia: 'Georgia, serif', times: '"Times New Roman", Times, serif', courier: '"Courier New", Courier, monospace' }
export function cleanTextFormat(value = {}) {
  const result = {}
  if (Object.hasOwn(slideFonts, value.fontFamily)) result.fontFamily = value.fontFamily
  if (value.fontSize != null && Number.isFinite(Number(value.fontSize)) && Number(value.fontSize) >= 8 && Number(value.fontSize) <= 200) result.fontSize = Number(value.fontSize)
  for (const key of ['textColour', 'highlightColour']) if (/^#[0-9a-f]{6}$/i.test(value[key] || '')) result[key] = value[key]
  return result
}
export function textFormatAttributes(value) {
  const format = cleanTextFormat(value), attrs = { 'data-slide-text-style': '' }, styles = []
  if (format.fontFamily) { attrs['data-font-family'] = format.fontFamily; styles.push('font-family:' + slideFonts[format.fontFamily]) }
  if (format.fontSize) { attrs['data-font-size'] = String(format.fontSize); styles.push('font-size:' + format.fontSize + 'px', '--slide-text-size:' + format.fontSize) }
  for (const [key, data, css] of [['textColour', 'text-colour', 'color'], ['highlightColour', 'highlight-colour', 'background-color']]) {
    if (format[key]) { attrs['data-' + data] = format[key]; styles.push(css + ':' + format[key]) }
  }
  if (styles.length) attrs.style = styles.join(';')
  return attrs
}
// Build the mark from the host's existing TipTap Mark class to retain one runtime.
export function createSlideTextStyle(Mark) {
  return Mark.create({ name: 'slideTextStyle',
    addAttributes() {
      return Object.fromEntries([['fontFamily','font-family'],['fontSize','font-size'],['textColour','text-colour'],['highlightColour','highlight-colour']].map(([key,data]) => [key, {
        default: null, parseHTML: element => cleanTextFormat({[key]:element.getAttribute('data-' + data)})[key] ?? null,
      }]))
    },
    parseHTML() { return [{tag:'span[data-slide-text-style]'}] },
    renderHTML({mark}) { return ['span',textFormatAttributes(mark.attrs),0] },
  })
}
export function mountTextFormat(root, apply) {
  const document = root.ownerDocument, lower = root.querySelectorAll('.slide-menu-bar')[1], group = document.createElement('div')
  group.className = 'slide-text-format'; group.dataset.control = 'text-format'; group.hidden = true
  group.setAttribute('role','group'); group.setAttribute('aria-label','Selected text formatting')
  let disposed = false
  const controls = {}
  for(const name of ['font-family','font-size','text-colour']) {
    const control=root.querySelector('[data-control="'+name+'"]'),label=control.parentNode
    group.append(control); label.remove(); controls[name]=control
  }
  controls['font-family'].setAttribute('aria-label','Font'); controls['font-size'].setAttribute('aria-label','Font size'); controls['font-size'].step='0.5'; controls['text-colour'].setAttribute('aria-label','Text colour')
  for(const [direction,icon,label] of [[-1,'keyboard_arrow_down','Decrease font size'],[1,'keyboard_arrow_up','Increase font size']]){
    const button=document.createElement('button');button.className='clist-action-btn btn-small';button.title=label;button.setAttribute('aria-label',label);button.dataset.control=direction<0?'font-smaller':'font-larger'
    const span=document.createElement('span');span.className='material-icons md-18 md-light';span.textContent=icon;button.append(span)
    button.addEventListener('click',()=>{if(!disposed&&!group.hidden&&!button.disabled)apply('fontSize',Math.max(8,Math.min(200,Number(controls['font-size'].value)+direction)))})
    group.insertBefore(button,controls['text-colour']);controls[button.dataset.control]=button
  }
  const highlight=document.createElement('input');highlight.type='color';highlight.value='#ffff00';highlight.dataset.control='highlight-colour';highlight.title='Highlighting colour';highlight.setAttribute('aria-label','Highlighting colour')
  highlight.addEventListener('input',()=>{if(!disposed&&!group.hidden&&!highlight.disabled)apply('highlightColour',highlight.value)})
  group.append(highlight);controls['highlight-colour']=highlight
  const clear=document.createElement('button');clear.className='btn-small btn-secondary';clear.textContent='No highlight';clear.title='Remove highlighting';clear.dataset.control='clear-highlight'
  clear.addEventListener('click',()=>{if(!disposed&&!group.hidden&&!clear.disabled)apply('highlightColour',null)});group.append(clear);controls['clear-highlight']=clear

  for(const name of ['bold','italic','edit-link','remove-link','ordered-list','bullet-list']) {
    const control=root.querySelector('[data-control="'+name+'"]')
    group.append(control);controls[name]=control
  }
  const fit=root.querySelector('[data-control="fit-text"]')
  if(fit){fit.textContent='Fit';fit.title='Grow or shrink text to fill the box';group.append(fit);controls['fit-text']=fit}
  const fitStatus=root.querySelector('[data-control="text-overflow-status"]')
  if(fitStatus){fitStatus.hidden=true;group.append(fitStatus)}
  lower.insertBefore(group,root.querySelector('[data-control="object-format"]'))
  return { update(visible,format,enabled){
    if(disposed)return
    group.hidden=!visible;lower.dataset.textFormatOpen=String(visible)
    for(const control of Object.values(controls))control.disabled=!enabled
    if(visible){controls['font-family'].value=format.family;controls['font-size'].value=String(Math.round(format.size*2)/2);controls['text-colour'].value=format.colour;highlight.value=format.highlight||'#ffff00'}
  },destroy(){disposed=true;group.remove();delete lower.dataset.textFormatOpen} }
}
