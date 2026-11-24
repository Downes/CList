const {test}=require('node:test'),assert=require('node:assert/strict')
const original={x:100,y:100,width:200,height:100}
test('all four edges resize only one dimension and anchor the opposite edge',async()=>{
 const {resizeObjectEdge:r}=await import('../slides/clist-slides-poc/src/object-edge-resize.js')
 assert.deepEqual(r(original,'right',30,10),{x:100,y:100,width:230,height:100})
 assert.deepEqual(r(original,'left',30,10),{x:130,y:100,width:170,height:100})
 assert.deepEqual(r(original,'bottom',30,10),{x:100,y:100,width:200,height:110})
 assert.deepEqual(r(original,'top',30,10),{x:100,y:110,width:200,height:90})
})
test('rotated edge uses local axis, preserving the opposite edge in slide coordinates',async()=>{
 const {resizeObjectEdge:r}=await import('../slides/clist-slides-poc/src/object-edge-resize.js')
 const value=r(original,'right',0,40,90)
 assert.equal(value.width,240);assert.equal(value.height,100)
 assert.equal(value.x,80);assert.equal(value.y,120)
})
test('size limits stop crossings without moving the fixed edge',async()=>{
 const {resizeObjectEdge:r}=await import('../slides/clist-slides-poc/src/object-edge-resize.js')
 const value=r(original,'left',500,0,0,{minWidth:100})
 assert.equal(value.width,100);assert.equal(value.x+value.width,300)
 assert.equal(r(original,'bottom',0,500,0,{maxHeight:150}).height,150)
})
