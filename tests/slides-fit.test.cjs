const {test}=require('node:test'),assert=require('node:assert/strict')
test('Fit searches the full range to grow or shrink to the largest fitting size',async()=>{
 const {largestFittingTextSize:f}=await import('../slides/clist-slides-poc/src/overflow.js')
 assert.equal(f(size=>size<=96),96);assert.equal(f(size=>size<=17),17)
 assert.equal(f(size=>size<=17.8),17.5);assert.equal(f(size=>size<=96.7),96.5);assert.equal(f(()=>true),200);assert.equal(f(()=>false),8)
})
test('Fit scales inline fonts proportionally within supported limits',async()=>{
 const {scaledTextSize:f}=await import('../slides/clist-slides-poc/src/overflow.js')
 assert.equal(f(24,2),48);assert.equal(f(12,2),24);assert.equal(f(8,.1),8);assert.equal(f(100,3),200);assert.equal(f(12,1.24999999999),15)
})
