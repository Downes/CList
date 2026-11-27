// Reuse object controls; Arrange is an explicit mode owned by the selected object.
export function mountObjectFormat(root) {
  const document=root.ownerDocument,lower=root.querySelectorAll('.slide-menu-bar')[1],top=root.querySelector('.slide-menu-bar'),group=document.createElement('div')
  group.className='slide-object-format';group.dataset.control='object-format';group.hidden=true
  const appearance=root.querySelector('[data-panel="appearance"]'),arrange=root.querySelector('[data-panel="arrange"]')
  const colours=appearance.querySelector('.control-section-body'),commands=arrange.querySelector('.control-section-body')
  colours.classList.add('slide-object-colours');commands.classList.add('slide-arrange-controls');commands.setAttribute('aria-label','Arrange selected objects')
  const label=document.createElement('span');label.textContent='Arrange';commands.insertBefore(label,commands.firstChild)
  const imagePanel=root.querySelector('[data-panel="images"]'),imageControls=imagePanel?.querySelector('.control-section-body')
  if(imageControls){imageControls.classList.add('slide-image-properties');const description=imageControls.querySelector('textarea');if(description)description.rows=1;group.append(imageControls);imagePanel.remove()}
  group.append(colours,commands);appearance.remove();arrange.remove();lower.append(group)
  const button=document.createElement('button');button.className='btn-small';button.textContent='Arrange';button.title='Arrange selected objects';button.dataset.control='arrange-objects'
  top.insertBefore(button,root.querySelector('.slide-menu-right'))
  let selection=[],owner=null,showColours=false,disposed=false
  function render(){
    const active=!!owner
    button.hidden=!selection.length;button.setAttribute('aria-pressed',String(active))
    const image=selection.length===1&&selection[0]?.get?.('kind')==='image'
    if(imageControls)imageControls.hidden=!image||active
    group.hidden=!selection.length||(!showColours&&!active&&!image);colours.hidden=!showColours||active;commands.hidden=!active
    lower.dataset.objectSelected=String(!!selection.length);lower.dataset.arrangeOpen=String(active)
  }
  button.addEventListener('click',()=>{if(disposed||!selection.length)return;owner=selection[0];render()})
  render()
  return {update(objects,coloursEnabled){
    if(disposed)return
    selection=objects;showColours=coloursEnabled
    if(owner&&!selection.includes(owner))owner=null
    render()
  },destroy(){disposed=true;group.remove();button.remove();delete lower.dataset.objectSelected;delete lower.dataset.arrangeOpen}}
}
