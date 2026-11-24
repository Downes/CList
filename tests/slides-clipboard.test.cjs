const {test}=require('node:test'),assert=require('node:assert/strict')
const bounds={x:100,y:80,width:200,height:150}
test('object paste places selection at pointer rather than offset from source',async()=>{
 const {objectPasteOffset:f}=await import('../slides/clist-slides-poc/src/object-clipboard.js')
 assert.deepEqual(f(bounds,{x:400,y:300},1280,720,28),{x:300,y:220})
})
test('pointer placement clamps the entire selection within canvas edges',async()=>{
 const {objectPasteOffset:f}=await import('../slides/clist-slides-poc/src/object-clipboard.js')
 assert.deepEqual(f(bounds,{x:1270,y:710},1280,720),{x:980,y:490})
 assert.deepEqual(f(bounds,{x:-20,y:-30},1280,720),{x:-100,y:-80})
})
test('without a slide pointer, existing offset and cut-in-place fallback remain',async()=>{
 const {objectPasteOffset:f}=await import('../slides/clist-slides-poc/src/object-clipboard.js')
 assert.deepEqual(f(bounds,null,1280,720,28),{x:28,y:28})
 assert.deepEqual(f(bounds,null,1280,720,0),{x:0,y:0})
})


test('focused objects own page-routed copy and stale text targets; text and outside focus retain native commands',async()=>{
 const {ownsObjectClipboard:f}=await import('../slides/clist-slides-poc/src/object-clipboard.js')
 const document={body:{},documentElement:{}},shape={},oldText={},field={isContentEditable:true},outside={}
 const root={contains:node=>[shape,oldText,field].includes(node)}
 assert.equal(f(root,document.body,shape,document),true)
 assert.equal(f(root,oldText,shape,document),true)
 assert.equal(f(root,oldText,field,document),false)
 assert.equal(f(root,document.body,outside,document),false)
 assert.equal(f(root,outside,shape,document),false)
})
