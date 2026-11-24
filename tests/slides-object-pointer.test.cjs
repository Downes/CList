const {test}=require('node:test')
const assert=require('node:assert/strict')
async function fixture({text=false,current=true}={}) {
 const {bindObjectPointer}=await import('../slides/clist-slides-poc/src/object-pointer.js')
 let moves=0,focus=0,timer;const selections=[],resize={},handlers=new Map(),surfaceHandlers=new Map()
 const surface={addEventListener:(name,fn)=>surfaceHandlers.set(name,fn),removeEventListener:name=>surfaceHandlers.delete(name)}
 const node={isConnected:true,ownerDocument:surface,addEventListener:(name,fn)=>handlers.set(name,fn),removeEventListener:name=>handlers.delete(name)}
 const dispose=bindObjectPointer(node,resize,{text:()=>text,current:()=>current,select:additive=>selections.push(additive),focus:()=>focus++,move:event=>{moves++;event.preventDefault();assert.equal(event.currentTarget,node)},schedule:fn=>{timer=fn;return 1},unschedule:()=>timer=null})
 const dispatch=(values={})=>{let prevented=false,stopped=false;const e={button:0,pointerId:1,clientX:10,clientY:10,currentTarget:node,target:{closest:()=>text?{}:null},preventDefault:()=>prevented=true,stopPropagation:()=>stopped=true,...values};handlers.get('pointerdown')(e);return {prevented,stopped}}
 return {resize,node,dispose,dispatch,selections,expire:()=>{current=false},hold:()=>{const fn=timer;timer=null;fn?.()},surface:(name,values={})=>surfaceHandlers.get(name)?.({pointerId:1,clientX:10,clientY:10,...values}),get moves(){return moves},get focus(){return focus}}
}
test('image/shape body drag routes to the existing mover',async()=>{
 const f=await fixture();const event=f.dispatch();assert.equal(f.moves,1);assert.equal(event.prevented,true)
})
test('text and Shift-text drags keep native cursor/selection without movement or focus stealing',async()=>{
 const f=await fixture({text:true})
 for(const shiftKey of [false,true]){const event=f.dispatch({shiftKey});assert.equal(event.prevented,false);assert.equal(event.stopped,false)}
 assert.equal(f.moves,0);assert.equal(f.focus,0);assert.deepEqual(f.selections,[false,false])
})
test('text borders move, resize stays separate and Shift-object clicks retain multi-selection',async()=>{
 const f=await fixture({text:true});f.dispatch({target:{closest:()=>null}});assert.equal(f.moves,1)
 f.dispatch({target:f.resize});assert.equal(f.moves,1)
 f.dispatch({target:{closest:()=>null},shiftKey:true});assert.deepEqual(f.selections,[true]);assert.equal(f.focus,1)
})
test('secondary pointer/buttons and inactive editors cannot start drag',async()=>{
 const f=await fixture();f.dispatch({button:2});f.dispatch({isPrimary:false});assert.equal(f.moves,0)
 const stale=await fixture({current:false});stale.dispatch();assert.equal(stale.moves,0)
})


test('holding text starts captured whole-box movement; release and immediate text dragging cancel it',async()=>{
 const held=await fixture({text:true});held.dispatch();held.hold();assert.equal(held.moves,1)
 for(const name of ['pointerup','pointercancel','pointerdown','visibilitychange']){
  const f=await fixture({text:true});f.dispatch();f.surface(name);f.hold();assert.equal(f.moves,0)
 }
 const drag=await fixture({text:true});drag.dispatch();drag.surface('pointermove',{clientX:20});drag.hold();assert.equal(drag.moves,0)
})

test('expired, detached and disposed text holds cannot move a box',async()=>{
 for(const invalidate of [f=>f.expire(),f=>f.node.isConnected=false,f=>f.dispose()]){
  const f=await fixture({text:true});f.dispatch();invalidate(f);f.hold();assert.equal(f.moves,0)
 }
})
