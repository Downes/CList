const {test} = require('node:test')
const assert = require('node:assert/strict')
const {menuShellDocument} = require('./helpers/menu-shell-dom.cjs')
async function setup() {
  const {mountSlideViews} = await import('../slides/clist-slides-poc/src/slide-views.js')
  const document = menuShellDocument(), root = document.createElement('div')
  root.ownerDocument = document
  const tools = document.createElement('div'), workspace = document.createElement('section'), list = document.createElement('div')
  tools.className = 'tools'; workspace.className = 'workspace'; list.setAttribute('data-control', 'slide-list')
  root.append(tools, workspace); workspace.append(list); document.body.append(root)
  let slides = [{id:'a',text:'<literal> First',active:true},{id:'b',text:'Second',active:false}], enabled = true
  const selected = [], controller = mountSlideViews({root,getSlides:()=>slides,selectSlide:id=>selected.push(id),canChange:()=>enabled})
  return {root, list, selected, controller, slides:value=>slides=value, enable:value=>enabled=value}
}
test('four local views default to slide only and reject invalid/disabled choices', async()=>{
  const f=await setup(); assert.equal(f.controller.mode,'slide')
  for(const mode of ['slide','notes','outline','sorter']) { assert.equal(f.controller.setMode(mode),true); assert.equal(f.root.dataset.slideView,mode) }
  assert.equal(f.controller.setMode('unknown'),false); f.enable(false); assert.equal(f.controller.setMode('notes'),false); assert.equal(f.controller.mode,'sorter')
})
test('outline retains literal text, stable rows, current selection and deck changes', async()=>{
  const f=await setup(); f.controller.setMode('outline')
  const outline=f.root.querySelector('.slide-outline'), row=outline.children[0]
  assert.equal(row.querySelector('.slide-outline-text').textContent,'<literal> First')
  row.querySelector('button').dispatch('click'); assert.deepEqual(f.selected,['a'])
  f.controller.refresh(); assert.equal(outline.children[0],row)
  f.slides([{id:'b',text:'Updated',active:true}]);f.controller.refresh();assert.equal(outline.children.length,1);assert.equal(outline.textContent.includes('Updated'),true)
})
test('destroy removes the picker/outline and rejects stale controls', async()=>{
  const f=await setup(); f.controller.setMode('outline');const button=f.root.querySelector('.slide-outline').querySelector('button')
  f.controller.destroy();button.dispatch('click');assert.equal(f.controller.setMode('slide'),false);assert.deepEqual(f.selected,[])
  assert.equal(f.root.querySelector('.slide-view-picker'),null)
})

test('sorter hit testing distinguishes columns and rows while preserving filmstrip behavior',async()=>{
 const {slideDropBeforeIndex}=await import('../slides/clist-slides-poc/src/slide-views.js')
 const rects=[{left:0,top:0,bottom:100,width:100,height:100},{left:120,top:0,bottom:100,width:100,height:100},{left:0,top:120,bottom:220,width:100,height:100}]
 assert.equal(slideDropBeforeIndex(rects,160,60,true),1)
 assert.equal(slideDropBeforeIndex(rects,200,60,true),2)
 assert.equal(slideDropBeforeIndex(rects,80,200,true),-1)
 assert.equal(slideDropBeforeIndex(rects,80,20,false),0)
})
