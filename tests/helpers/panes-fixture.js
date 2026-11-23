// Real pane state/controller/view; geometry, viewport/events, invalidators and preference writes are mocked.
let previousPaneFixture=null;
function panesFixture(){
 if(previousPaneFixture)previousPaneFixture.dispose();window.CList.state={};let mobile=false,loggedIn=false,context='source',leftWidth=100;
 const storage=new Map(),writes=[],notices=[],closed=[],behavior={},listeners=new Map(),nodes=[];
 const make=()=>{const node=document.createElement('div');nodes.push(node);return node;};
 const refs={main:make(),mainWindow:make(),left:make(),right:make(),read:make(),write:make(),divider:make()};
 refs.events={body:{style:{}},addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:(name,fn)=>{if(listeners.get(name)===fn)listeners.delete(name);}};
 const handlers=new Map();for(const node of nodes){
  if(!node.classList){const set=new Set();node.classList={add:value=>set.add(value),remove:value=>set.delete(value),contains:value=>set.has(value)};}
  const add=node.addEventListener.bind(node),remove=node.removeEventListener?node.removeEventListener.bind(node):()=>{};
  node.addEventListener=(name,fn)=>{handlers.set(node+':'+name,fn);add(name,fn);};node.removeEventListener=(name,fn)=>{if(handlers.get(node+':'+name)===fn)handlers.delete(node+':'+name);remove(name,fn);};
 }
 Object.defineProperty(refs.left,'offsetWidth',{configurable:true,get:()=>leftWidth});
 const geometry={left:0,width:1000,readWidth:500,writeWidth:500};refs.main.getBoundingClientRect=()=>({left:geometry.left,width:geometry.width});refs.read.getBoundingClientRect=()=>({width:geometry.readWidth});refs.write.getBoundingClientRect=()=>({width:geometry.writeWidth});
 for(const [name,node] of Object.entries(refs))if(name!=='events'){node.setAttribute('data-pane-test',name);fixtureAttach(node);}
 const deps={keys:{PANE_STATE_LOGGED_OUT:'out',PANE_STATE_LOGGED_IN:'in'},mobile:()=>mobile,loggedIn:()=>loggedIn,context:()=>JSON.stringify([context,loggedIn]),
  get:key=>{if(behavior.read)throw Error('Storage blocked');return storage.get(key)??null;},set:(key,value)=>{if(behavior.write)throw Error('Storage full');writes.push({key,value:JSON.parse(value)});storage.set(key,value);},notice:text=>notices.push(text),closeLeft:()=>closed.push('find'),closeRight:options=>closed.push(options.preserveEditorControls?'preserve-editor-controls':'all-right')};
 const view=createPaneView(refs,()=>mobile),controller=createPaneController(deps,view);previousPaneFixture=controller;
 return{refs,controller,geometry,storage,writes,notices,closed,behavior,mobile:value=>{mobile=value;},login:value=>{loggedIn=value;},context:value=>{context=value;},leftWidth:value=>{leftWidth=value;},state:()=>controller.state(),transition:()=>handlers.get(refs.left+':transitionend'),move:x=>listeners.get('mousemove')?.({clientX:x}),up:()=>listeners.get('mouseup')?.()};
}
const panesCases=[
 ['restoration normalizes legacy values without intermediate writes',check=>{
  const f=panesFixture();f.storage.set('out',JSON.stringify({leftOpen:true,rightOpen:false,readFlex:'0.5 1 0%',writeFlex:'0.5 1 0%'}));f.controller.restore(false);check(f.writes.length===0&&f.state().readFlex===0.5&&f.state().currentPane==='left-pane','one complete read-only restore');check(f.refs.left.style.width==='300px'&&['0px','0'].includes(f.refs.right.style.width),'drawer layout applied');
  check(normalizePaneState({readFlex:'1e-7',writeFlex:'0.9999999'}).readFlex===1e-7,'small canonical sizes round-trip');
 }],
 ['separate existing profiles and safe defaults',check=>{
  const f=panesFixture();f.storage.set('in',JSON.stringify({leftOpen:false,rightOpen:true,readFlex:'0',writeFlex:'1'}));f.controller.restore(false);check(f.state().leftOpen&&f.state().readFlex===1&&f.writes.length===0,'default does not overwrite preferences');f.login(true);f.controller.restore(true);check(f.state().rightOpen&&!f.state().leftOpen&&f.state().writeFlex===1,'signed-in profile restored');f.controller.close('right');check(f.writes.length===1&&f.writes[0].key==='in','command persists to current profile');
 }],
 ['state owns persisted values instead of DOM styles',check=>{
  const f=panesFixture();f.controller.open('left');f.refs.read.style.flex='99';f.refs.left.style.width='0px';window.CList.state.panes.leftOpen=false;f.controller.save();check(f.writes.at(-1).value.leftOpen&&f.writes.at(-1).value.readFlex==='1','DOM/public mutation does not replace state');f.controller.close('right',{preserveEditorControls:true});check(f.closed.includes('preserve-editor-controls'),'explicit editor control preservation');
 }],
 ['snap thresholds and desktop reveal preserve existing editor nodes',check=>{
  const f=panesFixture(),node=f.refs.write;f.geometry.readWidth=800;f.controller.snap('left');check(f.state().readFlex===0.5&&f.state().writeFlex===0.5,'left snap opens split');f.geometry.readWidth=500;f.controller.snap('left');check(f.state().writeFlex===1,'left snap opens writer');f.geometry.readWidth=1000;f.geometry.writeWidth=0;f.controller.reveal();check(f.state().currentPane==='write-pane'&&f.state().readFlex===0.5&&f.refs.write===node,'hidden editor revealed without replacing DOM');
 }],
 ['drag sizing clamps, previews without persistence and saves once',check=>{
  const f=panesFixture();f.controller.beginDrag();f.move(-100);check(f.state().readFlex===0&&f.state().writeFlex===1&&f.writes.length===0,'negative drag clamped without write');f.move(2000);f.up();f.up();check(f.state().readFlex===1&&f.state().writeFlex===0&&f.writes.length===1&&!f.state().dragging,'mouseup writes once');
 }],
 ['drag cannot write into a replacement session/profile',check=>{
  const f=panesFixture();f.controller.beginDrag();f.move(200);f.login(true);f.context('replacement');f.up();check(f.writes.length===0&&!f.state().dragging,'changed drag source not persisted');f.geometry.width=0;f.controller.beginDrag();f.move(100);f.up();check(f.writes.length===0,'zero-width geometry ignored');
 }],
 ['mobile layout/reveal keep state and invalidations aligned',check=>{
  const f=panesFixture();f.mobile(true);f.controller.open('left');f.controller.open('right');check(f.refs.left.style.width==='100%'&&f.refs.right.style.width==='100vw','mobile drawer widths');f.controller.reveal();check(!f.state().leftOpen&&!f.state().rightOpen&&f.state().surface==='write'&&f.refs.mainWindow.style.transform==='translateX(-100vw)','mobile writer reveal');check(f.closed.includes('find')&&f.closed.includes('all-right'),'view ownership invalidated');
 }],
 ['late width transitions and disposed callbacks cannot reopen panes',check=>{
  const f=panesFixture();f.leftWidth(0);f.controller.open('left');const late=f.transition();f.controller.close('left');late({target:f.refs.left,propertyName:'width'});check(!f.refs.left.classList.contains('pane-open'),'old transition cannot reopen closed pane');const n=f.writes.length;f.controller.dispose();f.controller.open('right');check(f.writes.length===n&&!f.state().rightOpen,'disposed controller cannot act');
 }],
 ['invalid/corrupt/blocked preferences leave usable layout and visible feedback',check=>{
  const f=panesFixture();f.storage.set('out','not JSON');f.controller.restore(false);check(f.state().leftOpen&&f.notices.length===1&&f.storage.get('out')==='not JSON','corrupt preference preserved with fallback');f.behavior.write=true;f.controller.open('right');f.controller.close('right');check(f.notices.length===3&&!f.state().rightOpen,'write failures leave current layout usable with feedback');const g=panesFixture();g.storage.set('out',JSON.stringify({readFlex:'url(unsafe)',writeFlex:'1'}));g.controller.restore(false);check(g.notices.length===1&&g.state().readFlex===1,'unsafe sizing rejected');
 }]
];
