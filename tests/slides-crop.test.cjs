const {test}=require('node:test')
const assert=require('node:assert/strict')
const {menuShellDocument}=require('./helpers/menu-shell-dom.cjs')
const modulePath='../slides/clist-slides-poc/src/crop-rectangle.js'
test('crop rectangle clamps movement and all four resize corners to image bounds',async()=>{
 const {adjustCrop,normalizeCrop}=await import(modulePath),rect={x:.2,y:.2,width:.5,height:.5}
 assert.deepEqual(adjustCrop(rect,'move',9,-9),{x:.5,y:0,width:.5,height:.5})
 for(const handle of ['nw','ne','sw','se']){const r=adjustCrop(rect,handle,9,-9);assert.ok(r.x>=0&&r.y>=0&&r.width>=.019&&r.height>=.019&&r.x+r.width<=1.001&&r.y+r.height<=1.001)}
 assert.deepEqual(normalizeCrop(),{x:0,y:0,width:1,height:1})
})
test('crop geometry maps exactly to the existing image fields and round trips',async()=>{
 const {cropProperties,currentImageCrop}=await import(modulePath),rect={x:.25,y:.1,width:.5,height:.6},properties=cropProperties(rect,800,400)
 assert.equal(properties.width,400);assert.equal(properties.height,240);assert.equal(properties.cropX,50);assert.equal(properties.cropY,25)
 const box=new Map(Object.entries(properties));const restored=currentImageCrop(box,2)
 for(const key of Object.keys(rect))assert.ok(Math.abs(rect[key]-restored[key])<1e-8)
})
test('rectangle pointer resize and keyboard movement are staged; Cancel and stale Done never commit',async()=>{
 const {mountCropRectangle}=await import(modulePath),document=menuShellDocument(),host=document.createElement('div');host.ownerDocument=document;document.body.append(host)
 let current=true,commits=0,cancels=0
 const crop=mountCropRectangle({container:host,source:'local',ratio:2,current:()=>current,onDone:()=>commits++,onCancel:()=>cancels++})
 const stage=host.querySelector('.slide-crop-stage'),selection=stage.querySelector('.slide-crop-rectangle');stage.getBoundingClientRect=()=>({width:800,height:400})
 const handle=selection.children.find(n=>n.dataset.corner==='se')
 selection.listeners.pointerdown({button:0,pointerId:1,clientX:800,clientY:400,target:handle,preventDefault(){},stopPropagation(){}})
 selection.listeners.pointermove({pointerId:1,clientX:400,clientY:200,preventDefault(){},stopPropagation(){}});selection.listeners.pointerup()
 assert.equal(crop.rect.width,.5);assert.equal(crop.rect.height,.5);assert.equal(commits,0)
 selection.listeners.keydown({key:'ArrowRight',preventDefault(){},stopPropagation(){}});assert.equal(crop.rect.x,.01)
 current=false;host.querySelectorAll('button').find(n=>n.dataset.control==='crop-done').listeners.click();assert.equal(commits,0);assert.equal(cancels,1)
 crop.destroy();assert.equal(host.children.length,0)
})

test('editor capture-phase keyboard routing leaves crop-area arrows for the crop controller',()=>{
 const fs=require('node:fs'),vm=require('node:vm'),source=fs.readFileSync('slides/clist-slides-poc/src/editor.js','utf8')
 const handler=source.slice(source.indexOf('function onHistoryKey('),source.indexOf('function historyBoundary('))
 let objectKeys=0
 const root={contains:()=>true},target={closest:selector=>selector.includes('.slide-crop-stage')?{}:null}
 const context=vm.createContext({root,presenting:false,onObjectKey:()=>objectKeys++,runHistory(){},event:{target,key:'ArrowUp',shiftKey:true}})
 vm.runInContext(handler+';onHistoryKey(event)',context)
 assert.equal(objectKeys,0,'crop key must not reach object movement before its target handler')
 context.event.target={closest:()=>null};vm.runInContext('onHistoryKey(event)',context);assert.equal(objectKeys,1,'normal object shortcuts remain routed')
})

test('canvas capture-phase pointer routing does not deselect a crop grip press',()=>{
 const fs=require('node:fs'),vm=require('node:vm'),source=fs.readFileSync('slides/clist-slides-poc/src/editor.js','utf8')
 const start=source.indexOf("root.addEventListener('pointerdown', event =>",source.indexOf('marquee = mountMarquee'))
 const handler=source.slice(start,source.indexOf('function addCatalogShape(',start))
 let listener,cleared=0
 const root={addEventListener:(name,fn)=>listener=fn,contains:()=>false,focus(){}},target={closest:selector=>selector.includes('.canvas-space')||selector.includes('.slide-crop-stage')?{}:null}
 const context=vm.createContext({root,slide:{},presenting:false,pasteSurfaceActive:false,editorFocused:null,select:()=>cleared++,updatePastePoint(){},stopDrag(){},document:{activeElement:null},window:{getSelection:()=>null}})
 vm.runInContext(handler,context);listener({target,button:0,preventDefault(){}});assert.equal(cleared,0)
 target.closest=selector=>selector.includes('.canvas-space')?{}:null;listener({target,button:0,preventDefault(){}});assert.equal(cleared,1,'ordinary background presses still clear selection')
})
