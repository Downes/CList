const {test}=require('node:test')
const assert=require('node:assert/strict')
const {menuShellDocument}=require('./helpers/menu-shell-dom.cjs')
const gate=()=>{let resolve;const promise=new Promise(done=>resolve=done);return {resolve,promise}}
async function fixture(){
 const {mountInsertPickers}=await import('../slides/clist-slides-poc/src/insert-picker.js')
 const document=menuShellDocument();const create=document.createElement;document.createElement=tag=>{const node=create(tag);node.ownerDocument=document;return node};document.createElementNS=(ns,tag)=>document.createElement(tag)
 const root=document.createElement('div');root.ownerDocument=document;document.body.append(root)
 let current=true,active=null,read=async()=>({source:'data:image/png;base64,AA==',image:{naturalWidth:1600,naturalHeight:800}})
 const shapes=[],images=[],errors=[]
 const picker=mountInsertPickers({root,shapes:[{id:'rectangle',label:'Rectangle',viewBox:[0,0,100,100],elements:[{tag:'rect',attributes:{x:0,y:0,width:100,height:100}}]}],
 capture:()=>()=>current,openModal(body){active?.remove();active=body;document.body.append(body);return {current:()=>body.isConnected&&active===body,close:()=>{if(active===body)body.remove()}}},
 readImage:file=>read(file),insertShape:id=>shapes.push(id),insertImage:value=>images.push(value),log:error=>errors.push(error)})
 const control=(body,name)=>body.querySelectorAll('input,select,button,p,div').find(node=>node.dataset.control===name)
 const choose=async(body,name='sample.png')=>{const file=control(body,'picker-file');file.files=[{name}];await file.listeners.change()}
 return {picker,control,choose,shapes,images,errors,expire:()=>current=false,read:value=>read=value,modal:()=>active}
}
test('line-art shape choices insert once and reject expired dialogs',async()=>{
 const f=await fixture(),body=f.picker.shape(),button=body.querySelector('button')
 assert.equal(body.querySelector('svg').getAttribute('fill'),'none');button.listeners.click();button.listeners.click();assert.deepEqual(f.shapes,['rectangle'])
 const next=f.picker.shape();f.expire();next.querySelector('button').listeners.click();assert.equal(f.shapes.length,1)
})
test('image rectangle Done captures crop fields and submits once; libraries remain disabled',async()=>{
 const f=await fixture(),body=f.picker.image();assert.equal(body.querySelectorAll('button').find(n=>n.textContent==='Image libraries').disabled,true)
 await f.choose(body);assert.deepEqual(f.errors.map(e=>e.message),[]);const at=name=>f.control(body,name),rect=at('crop-rectangle')
 for(let i=0;i<25;i++)rect.listeners.keydown({key:'ArrowLeft',shiftKey:true,preventDefault(){},stopPropagation(){}})
 at('crop-done').listeners.click();at('picker-insert').listeners.click();at('picker-insert').listeners.click()
 assert.equal(f.images.length,1);assert.ok(Math.abs(f.images[0].width-600)<.001);assert.equal(f.images[0].height,400)
 assert.equal(f.images[0].imageFit,'cover');assert.equal(f.images[0].cropImageWidth,800)
})
test('late and superseded image reads cannot change the current preview or insert',async()=>{
 const f=await fixture(),body=f.picker.image(),slow=gate();let calls=0
 f.read(async()=>++calls===1?slow.promise:{source:'new-source',image:{naturalWidth:100,naturalHeight:50}})
 const first=f.choose(body,'old.png');await f.choose(body,'new.png');slow.resolve({source:'old-source',image:{naturalWidth:40,naturalHeight:20}});await first
 f.control(body,'crop-done').listeners.click();f.control(body,'picker-insert').listeners.click();assert.equal(f.images[0].source,'new-source')
 const next=f.picker.image(),pending=gate();f.read(()=>pending.promise);const read=f.choose(next);f.picker.destroy();pending.resolve({source:'late',image:{naturalWidth:20,naturalHeight:20}});await read
 assert.equal(f.images.length,1)
})
test('incomplete or stale crops and decoder failures never insert',async()=>{
 const f=await fixture(),body=f.picker.image();await f.choose(body);f.control(body,'picker-insert').listeners.click();assert.equal(f.images.length,0)
 f.control(body,'crop-done').listeners.click();f.expire();f.control(body,'picker-insert').listeners.click();assert.equal(f.images.length,0)
 const g=await fixture(),dialog=g.picker.image();g.read(async()=>{throw Error('Unsupported image')});await g.choose(dialog);assert.match(g.control(dialog,'picker-feedback').textContent,/Unsupported image/)
 const cancel=dialog.querySelectorAll('button').find(n=>n.textContent==='Cancel');cancel.listeners.click();assert.equal(dialog.isConnected,false)
})
