export function mountSlideFormat(root, resetColour) {
  const document=root.ownerDocument,top=root.querySelector('.slide-menu-bar'),lower=root.querySelectorAll('.slide-menu-bar')[1],panel=root.querySelector('[data-panel="slide"]'),colour=root.querySelector('[data-control="slide-background"]')
  const group=document.createElement('div');group.className='slide-slide-format';group.dataset.control='slide-format';group.hidden=true;group.setAttribute('aria-label','Slide formatting')
  const label=document.createElement('label');label.append(document.createTextNode('Slide colour'),colour);group.append(label);panel.remove();lower.append(group)
  const reset=document.createElement('button');reset.className='btn-small btn-secondary';reset.textContent='Use theme colour';reset.title='Remove the custom slide colour and use the theme background';reset.dataset.control='reset-slide-colour';group.append(reset)
  const button=document.createElement('button');button.className='btn-small';button.textContent='Format Slide';button.title='Format the current slide';button.dataset.control='format-slide';top.insertBefore(button,root.querySelector('.slide-menu-right'))
  let active=false,eligible=false,disposed=false
  function render(){button.hidden=!eligible;button.setAttribute('aria-pressed',String(active));group.hidden=!active;lower.dataset.slideFormatOpen=String(active)}
  button.addEventListener('click',()=>{if(!disposed&&eligible){active=!active;render()}})
  reset.addEventListener('click',()=>{if(!disposed&&eligible&&active)resetColour()})
  const choices=[...top.querySelectorAll('[data-menu]')],leave=()=>{if(!disposed&&active){active=false;render()}}
  for(const choice of choices)choice.addEventListener('click',leave)
  render()
  return {update(value){if(disposed)return;eligible=value;if(!eligible)active=false;render()},destroy(){disposed=true;for(const choice of choices)choice.removeEventListener('click',leave);group.remove();button.remove();delete lower.dataset.slideFormatOpen}}
}
