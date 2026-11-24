import { mountCropRectangle, cropProperties } from './crop-rectangle.js'
// Captured insertion dialogs. File decoding and deck mutations are supplied by
// the editor; the host supplies its existing wide modal shell.
export function mountInsertPickers(deps) {
  const document = deps.root.ownerDocument
  let generation = 0, disposed = false, opened = null
  const node = (tag, text, className) => {
    const result = document.createElement(tag); if (text !== undefined) result.textContent = text
    if (className) result.className = className; return result
  }
  function dialog(title) {
    if (disposed) throw new Error('This slide editor is closed.')
    const id = ++generation, target = deps.capture()
    if (!target()) throw new Error('The destination slide is no longer active.')
    opened?.close()
    const body = node('div', undefined, 'clist-slides slide-insert-picker')
    const heading = node('h2', title), content = node('div'), feedback = node('p'), actions = node('div', undefined, 'slide-picker-actions')
    feedback.setAttribute('role','status'); feedback.dataset.control = 'picker-feedback'
    const close = node('button', 'Cancel', 'btn-small btn-secondary'); close.title = 'Cancel insertion'
    body.append(heading, content, feedback, actions); actions.append(close)
    const modal = deps.openModal(body); opened = modal
    const current = () => !disposed && generation === id && target() && modal.current()
    close.addEventListener('click', () => { if (generation === id) { generation++; modal.close() } })
    const error = failure => { deps.log(failure); if (current()) feedback.textContent = failure.message || String(failure) }
    return {body,content,actions,current,error,close:modal.close}
  }
  function shape() {
    const view = dialog('Choose a shape'), grid = node('div', undefined, 'slide-shape-grid')
    view.content.append(grid)
    for (const definition of deps.shapes) {
      const tile = node('div', undefined, 'slide-shape-tile'), svg = document.createElementNS('http://www.w3.org/2000/svg','svg')
      svg.setAttribute('viewBox',definition.viewBox.join(' ')); svg.setAttribute('aria-hidden','true')
      svg.setAttribute('fill','none'); svg.setAttribute('stroke','currentColor'); svg.setAttribute('stroke-width',String(Math.max(definition.viewBox[2],definition.viewBox[3])/45))
      for (const element of definition.elements) {
        const graphic = document.createElementNS('http://www.w3.org/2000/svg',element.tag)
        for (const [key,value] of Object.entries(element.attributes)) graphic.setAttribute(key,String(value))
        graphic.setAttribute('fill','none'); svg.append(graphic)
      }
      const button = node('button',undefined,'clist-action-btn btn-small slide-shape-choice'); button.title = 'Insert '+definition.label; button.setAttribute('aria-label',definition.label); button.dataset.shape = definition.id; button.append(svg)
      button.addEventListener('click', () => {
        if (!view.current()) return
        try { deps.insertShape(definition.id); view.close() } catch (failure) { view.error(failure) }
      })
      tile.append(button);grid.append(tile)
    }
    return view.body
  }
  function image() {
    const view = dialog('Insert image'), sources = node('div',undefined,'slide-picker-actions')
    const upload = node('button','Choose image file','btn-small'), library = node('button','Image libraries','btn-small btn-secondary')
    upload.title = 'Choose a PNG, JPEG, GIF or WebP image'; library.disabled = true; library.title = 'Image libraries are not available yet'
    const file = node('input'); file.type = 'file'; file.accept = 'image/png,image/jpeg,image/gif,image/webp'; file.hidden = true; file.dataset.control = 'picker-file'
    const libraryNote = node('p','Image library connections can be added here in the future.')
    sources.append(upload,library,file);view.content.append(sources,libraryNote)
    const preview=node('div',undefined,'slide-image-preview'),fields=node('div',undefined,'slide-image-fields')
    preview.hidden=fields.hidden=true
    const altLabel=node('label','Description (alt text)'),alt=node('input');alt.type='text';alt.maxLength=2000;alt.dataset.control='picker-alt';altLabel.append(alt);fields.append(altLabel)
    const insert=node('button','Insert image','btn-small'),adjust=node('button','Adjust crop','btn-small')
    insert.title='Insert this image';insert.disabled=true;insert.dataset.control='picker-insert'
    adjust.title='Adjust the crop rectangle';adjust.hidden=true;adjust.dataset.control='picker-adjust-crop'
    view.actions.insertBefore(insert,view.actions.firstElementChild);view.actions.insertBefore(adjust,insert)
    view.content.append(preview,fields)
    let prepared=null,read=0,busy=false,crop=null,rectangle=null
    function size(){const scale=Math.min(1,800/prepared.image.naturalWidth,500/prepared.image.naturalHeight);return {width:prepared.image.naturalWidth*scale,height:prepared.image.naturalHeight*scale}}
    function showPreview(rect){
      crop?.destroy();crop=null;rectangle=rect;preview.textContent=''
      const base=size(),value=cropProperties(rect,base.width,base.height),frame=node('div',undefined,'slide-cropped-preview'),picture=node('img')
      frame.style.aspectRatio=value.width+'/'+value.height;frame.style.width='min(100%, '+Math.min(640,340*value.width/value.height)+'px)'
      picture.src=prepared.source;picture.alt='Cropped image preview';picture.style.width=100/rect.width+'%';picture.style.height=100/rect.height+'%';picture.style.left=-100*rect.x/rect.width+'%';picture.style.top=-100*rect.y/rect.height+'%'
      frame.append(picture);preview.append(frame);insert.disabled=false;adjust.hidden=false
    }
    function editCrop(){
      if(!view.current()||!prepared||busy)return
      crop?.destroy();preview.textContent='';insert.disabled=true;adjust.hidden=true
      preview.style.width='min(100%, '+Math.min(640,340*prepared.image.naturalWidth/prepared.image.naturalHeight)+'px)'
      crop=mountCropRectangle({container:preview,source:prepared.source,ratio:prepared.image.naturalWidth/prepared.image.naturalHeight,initial:rectangle,current:view.current,
        onDone:showPreview,onCancel:()=>showPreview(rectangle||{x:0,y:0,width:1,height:1})})
    }
    adjust.addEventListener('click',editCrop)
    upload.addEventListener('click',()=>{if(view.current()&&!busy)file.click()})
    file.addEventListener('change',async()=>{
      if(!view.current()||busy||!file.files?.[0])return
      const id=++read,chosen=file.files[0];prepared=null;rectangle=null;crop?.destroy();crop=null;insert.disabled=true;adjust.hidden=true;preview.hidden=fields.hidden=true
      try{
        const result=await deps.readImage(chosen);if(!view.current()||id!==read)return
        prepared=result;alt.value=chosen.name;preview.hidden=fields.hidden=false;editCrop()
      }catch(failure){if(id===read)view.error(failure)}finally{if(id===read)file.value=''}
    })
    insert.addEventListener('click',()=>{
      if(!view.current()||!prepared||!rectangle||crop||busy)return
      busy=true;insert.disabled=true
      try{const base=size(),value=cropProperties(rectangle,base.width,base.height);deps.insertImage({...prepared,...value,alt:alt.value.slice(0,2000)});view.close()}
      catch(failure){view.error(failure);busy=false;insert.disabled=false}
    })
    return view.body
  }
  return {shape,image,destroy(){disposed=true;generation++;opened?.close();opened=null}}
}
