const minimum = .02
const clamp = (value, low, high) => Math.max(low, Math.min(high, Number(value) || 0))
export function normalizeCrop(rect = {}) {
  rect ||= {}
  const width = clamp(rect.width ?? 1, minimum, 1), height = clamp(rect.height ?? 1, minimum, 1)
  return {x:clamp(rect.x,0,1-width),y:clamp(rect.y,0,1-height),width,height}
}
export function adjustCrop(rect, handle, dx, dy) {
  rect=normalizeCrop(rect)
  if(handle==='move')return {...rect,x:clamp(rect.x+dx,0,1-rect.width),y:clamp(rect.y+dy,0,1-rect.height)}
  let left=rect.x,top=rect.y,right=left+rect.width,bottom=top+rect.height
  if(handle.includes('w'))left=clamp(left+dx,0,right-minimum)
  if(handle.includes('e'))right=clamp(right+dx,left+minimum,1)
  if(handle.includes('n'))top=clamp(top+dy,0,bottom-minimum)
  if(handle.includes('s'))bottom=clamp(bottom+dy,top+minimum,1)
  return {x:left,y:top,width:right-left,height:bottom-top}
}
// Nondestructive crop expressed using the editor's existing image fields.
export function cropProperties(rect, sourceWidth, sourceHeight) {
  rect=normalizeCrop(rect)
  return {width:sourceWidth*rect.width,height:sourceHeight*rect.height,imageFit:'cover',
    cropImageWidth:sourceWidth,cropImageHeight:sourceHeight,
    cropX:rect.width<1?100*rect.x/(1-rect.width):50,cropY:rect.height<1?100*rect.y/(1-rect.height):50,
    aspectRatio:sourceWidth*rect.width/(sourceHeight*rect.height)}
}
export function currentImageCrop(box, ratio) {
  if(box.get('imageFit')!=='cover')return normalizeCrop()
  const width=Number(box.get('cropImageWidth'))||Math.max(box.get('width'),box.get('height')*ratio)
  const height=Number(box.get('cropImageHeight'))||width/ratio
  const w=Math.min(1,box.get('width')/width),h=Math.min(1,box.get('height')/height)
  return normalizeCrop({width:w,height:h,x:(1-w)*(Number.isFinite(Number(box.get('cropX')))?Number(box.get('cropX')):50)/100,y:(1-h)*(Number.isFinite(Number(box.get('cropY')))?Number(box.get('cropY')):50)/100})
}
export function mountCropRectangle({container,source,ratio,initial,current=()=>true,onDone,onCancel,actionsContainer=container}) {
  const document=container.ownerDocument
  let rect=normalizeCrop(initial),gesture=null,disposed=false
  const stage=document.createElement('div');stage.className='slide-crop-stage';stage.style.aspectRatio=String(ratio)
  const image=document.createElement('img');image.src=source;image.alt='Image to crop';image.draggable=false
  const selection=document.createElement('div');selection.className='slide-crop-rectangle';selection.tabIndex=0;selection.dataset.control='crop-rectangle'
  selection.setAttribute('role','group');selection.setAttribute('aria-label','Crop area. Arrow keys move; Shift plus arrows resizes.')
  for(const corner of ['nw','ne','sw','se']){const handle=document.createElement('span');handle.className='slide-crop-handle '+corner;handle.dataset.corner=corner;handle.setAttribute('aria-hidden','true');selection.append(handle)}
  const actions=document.createElement('div');actions.className='slide-picker-actions'
  const done=document.createElement('button'),cancel=document.createElement('button')
  done.className='btn-small';done.textContent='Done';done.title='Apply the selected crop';done.dataset.control='crop-done'
  cancel.className='btn-small btn-secondary';cancel.textContent='Cancel crop';cancel.title='Cancel cropping';cancel.dataset.control='crop-cancel'
  actions.append(done,cancel);stage.append(image,selection);container.append(stage);actionsContainer.append(actions)
  const draw=()=>{selection.style.left=rect.x*100+'%';selection.style.top=rect.y*100+'%';selection.style.width=rect.width*100+'%';selection.style.height=rect.height*100+'%'}
  const release=()=>{if(gesture&&selection.hasPointerCapture?.(gesture.id))selection.releasePointerCapture(gesture.id);gesture=null}
  selection.addEventListener('pointerdown',event=>{
    if(disposed||!current()||event.isPrimary===false||event.button!==0||gesture)return
    const bounds=stage.getBoundingClientRect();if(!bounds.width||!bounds.height)return
    event.preventDefault();event.stopPropagation();gesture={id:event.pointerId,x:event.clientX,y:event.clientY,rect:{...rect},handle:event.target.dataset.corner||'move',bounds}
    selection.setPointerCapture?.(event.pointerId);selection.focus({preventScroll:true})
  })
  selection.addEventListener('pointermove',event=>{
    if(!gesture||event.pointerId!==gesture.id)return
    if(!current()){release();return}
    event.preventDefault();event.stopPropagation();rect=adjustCrop(gesture.rect,gesture.handle,(event.clientX-gesture.x)/gesture.bounds.width,(event.clientY-gesture.y)/gesture.bounds.height);draw()
  })
  selection.addEventListener('pointerup',release)
  selection.addEventListener('pointercancel',()=>{if(gesture){rect=gesture.rect;draw()}release()})
  selection.addEventListener('keydown',event=>{
    if(disposed||!current()||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return
    event.preventDefault();event.stopPropagation();rect=adjustCrop(rect,event.shiftKey?'se':'move',event.key==='ArrowLeft'?-.01:event.key==='ArrowRight'?.01:0,event.key==='ArrowUp'?-.01:event.key==='ArrowDown'?.01:0);draw()
  })
  done.addEventListener('click',()=>{if(disposed)return;release();if(current())onDone({...rect});else onCancel()})
  cancel.addEventListener('click',()=>{if(!disposed){release();onCancel()}})
  draw()
  return {get rect(){return {...rect}},destroy(){disposed=true;release();stage.remove();actions.remove()}}
}
