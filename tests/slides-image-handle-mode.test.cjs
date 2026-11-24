const {test}=require('node:test'),assert=require('node:assert/strict')
test('Resize scales existing cropped content with its frame, including independent edges',async()=>{
 const {imageHandleProperties:f}=await import('../slides/clist-slides-poc/src/image-handle-mode.js')
 const result=f({width:100,height:50},{width:200,height:50},'resize',{width:300,height:150})
 assert.equal(result.cropImageWidth,600);assert.equal(result.cropImageHeight,150)
 assert.equal(result.aspectRatio,4)
})
test('Crop keeps underlying image fixed while the visible frame changes',async()=>{
 const {imageHandleProperties:f}=await import('../slides/clist-slides-poc/src/image-handle-mode.js')
 assert.deepEqual(f({width:100,height:50},{width:80,height:40},'crop',{width:300,height:150}),{imageFit:'cover',cropImageWidth:300,cropImageHeight:150})
})
test('corner Resize preserves the cropped region at larger and smaller sizes',async()=>{
 const {imageHandleProperties:f}=await import('../slides/clist-slides-poc/src/image-handle-mode.js')
 for(const scale of [.5,2]){
  const result=f({width:100,height:50},{width:100*scale,height:50*scale},'resize',{width:300,height:150})
  assert.equal(result.cropImageWidth,300*scale);assert.equal(result.cropImageHeight,150*scale)
 }
})
