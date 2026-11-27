export function validSlideLink(value) {
  try { return ['http:', 'https:', 'mailto:', 'tel:'].includes(new URL(value).protocol) } catch { return false }
}
export function readLinkFields(value) {
  const href=String(value.href||'').trim(),text=String(value.text||''),title=String(value.title||'').trim(),alt=String(value.alt||'').trim()
  if(!validSlideLink(href))throw new Error('Enter an http, https, mailto, or tel URL.')
  if(!text.trim())throw new Error('Enter the link text.')
  if(title.length>500)throw new Error('Keep the link title under 500 characters.')
  if(alt.length>500)throw new Error('Keep link alt text under 500 characters.')
  return {href,text,title,alt,newTab:!!value.newTab}
}
export function mountSlideLinkPicker(deps) {
  const document=deps.root.ownerDocument
  let opened=null,target=null,generation=0,disposed=false
  function close(restore=false){const captured=target;generation++;opened?.close();opened=null;target=null;deps.closed();if(restore&&captured?.current())captured.restore()}
  function open(){
    if(disposed)return
    try {
      close();target=deps.capture();const captured=target,serial=++generation
      const body=document.createElement('form');body.className='clist-slides slide-insert-picker slide-link-picker';body.dataset.control='link-dialog'
      const heading=document.createElement('h3');heading.textContent='Add or edit link';body.append(heading)
      const inputs={}
      for(const [key,type,label] of [['href','url','Link URL'],['text','text','Link text'],['title','text','Link title (optional)'],['alt','text','Link alt text (optional)']]){
        const field=document.createElement('label'),input=document.createElement('input');input.type=type;input.placeholder=label;input.setAttribute('aria-label',label);input.dataset.linkField=key;input.value=captured.values[key]||''
        if(key==='title'||key==='alt')input.maxLength=500;field.append(input);body.append(field);inputs[key]=input
      }
      const tabLabel=document.createElement('label'),newTab=document.createElement('input');newTab.type='checkbox';newTab.checked=captured.values.newTab;newTab.dataset.linkField='newTab';tabLabel.append(newTab,document.createTextNode('Open in new tab'));body.append(tabLabel)
      const feedback=document.createElement('p');feedback.setAttribute('role','status');feedback.dataset.control='link-feedback';body.append(feedback)
      const actions=document.createElement('div');actions.className='slide-picker-actions'
      const submit=document.createElement('button');submit.type='submit';submit.className='btn-small';submit.textContent='Apply link';submit.title='Apply link';submit.dataset.control='submit-link'
      const cancel=document.createElement('button');cancel.type='button';cancel.className='btn-small btn-secondary';cancel.textContent='Cancel';cancel.title='Cancel link editing';cancel.dataset.control='cancel-link-dialog';actions.append(submit,cancel);body.append(actions)
      const modal=deps.openModal(body);opened=modal;let busy=false
      const current=()=>!disposed&&serial===generation&&modal.current()&&captured.current()
      body.addEventListener('submit',event=>{
        event.preventDefault();if(busy)return
        try {
          if(!current())throw new Error('The selected text changed. Cancel and reopen Add link.')
          const values=readLinkFields({href:inputs.href.value,text:inputs.text.value,title:inputs.title.value,alt:inputs.alt.value,newTab:newTab.checked})
          busy=true;captured.apply(values);close();captured.focus()
        }catch(error){console.error('Slides link:',error);if(modal.current())feedback.textContent=error.message||String(error)}finally{busy=false}
      })
      cancel.addEventListener('click',()=>{if(serial===generation)close(true)})
      body.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();if(serial===generation)close(true)}})
      inputs.href.focus()
    }catch(error){console.error('Slides link:',error);close();deps.error(error)}
  }
  return {open,close,destroy(){disposed=true;close()}}
}
