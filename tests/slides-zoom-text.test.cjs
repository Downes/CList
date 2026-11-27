const {test}=require('node:test'),assert=require('node:assert/strict')
async function fixture(t){
 const {mountCanvasZoom}=await import('../slides/clist-slides-poc/src/zoom.js')
 const saved=global.ResizeObserver;let notify,disconnected=false,measured=1280,presenting=false;const observed=[]
 global.ResizeObserver=class{constructor(fn){notify=fn}observe(target){observed.push(target)}disconnect(){disconnected=true}}
 t.after(()=>{global.ResizeObserver=saved})
 const controls={};const create=()=>({listeners:{},style:{values:{},setProperty(key,value){this.values[key]=value}},addEventListener(name,fn){this.listeners[name]=fn}})
 for(const name of ['canvas-viewport','slide','canvas-zoom','zoom-out','zoom-in','zoom-fit'])controls[name]=create()
 const viewport=controls['canvas-viewport'],slide=controls.slide,picker=controls['canvas-zoom'];viewport.clientWidth=1328;viewport.clientHeight=768;picker.options=[{}]
 slide.getBoundingClientRect=()=>({width:measured})
 const api=mountCanvasZoom({querySelector:selector=>controls[selector.match(/"([^"]+)"/)[1]]},()=>presenting)
 return {api,slide,observed,choose(value){picker.value=value;picker.listeners.change()},fullscreen(width){presenting=true;measured=width;notify([{target:slide}])},disconnected:()=>disconnected}
}
test('inline text gets exact pixel scale at 50% and 100% zoom',async t=>{
 const f=await fixture(t);f.choose('50');assert.equal(f.slide.style.values['--slide-text-unit'],'0.5px');f.choose('100');assert.equal(f.slide.style.values['--slide-text-unit'],'1px');f.api.destroy()
})
test('slide resize updates text scale independently for presentation and disposes observation',async t=>{
 const f=await fixture(t);assert.ok(f.observed.includes(f.slide));f.fullscreen(1920);assert.equal(f.slide.style.values['--slide-text-unit'],'1.5px');f.api.destroy();assert.equal(f.disconnected(),true)
})
