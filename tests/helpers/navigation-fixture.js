// Real navigation modules; event delivery, session/reader/pane state, scrolling and editor APIs mocked.
let previousNavigationFixture=null;
function navigationFixture(){
 if(previousNavigationFixture)previousNavigationFixture.dispose();window.CList.state={};
 const root=document.createElement('div'),left=document.createElement('div');left.id='left-pane';root.appendChild(left);let feed=document.createElement('div');feed.id='feed-container';root.appendChild(feed);fixtureAttach(root);
 let context='private-session',reader=0,pane='read-pane',paneVersion=0,mobile=true,time=0,active=root,selection='captured selection';const events=new Map(),leftEvents=new Map(),shown=[],inserts=[],errors=[],scrolls=[],behavior={};
 const on=(map,name,fn)=>{if(!map.has(name))map.set(name,new Set());map.get(name).add(fn);};
 const nativeAdd=left.addEventListener.bind(left),nativeRemove=left.removeEventListener.bind(left);left.addEventListener=(name,fn,...rest)=>{on(leftEvents,name,fn);nativeAdd(name,fn,...rest);};left.removeEventListener=(name,fn,...rest)=>{leftEvents.get(name)?.delete(fn);nativeRemove(name,fn,...rest);};
 const doc={getElementById:id=>root.querySelector('#'+id),querySelector:selector=>root.querySelector(selector),get activeElement(){return active;},defaultView:{getSelection:()=>({toString:()=>selection})},addEventListener:(name,fn)=>on(events,name,fn),removeEventListener:(name,fn)=>events.get(name)?.delete(fn)};
 const add=name=>{
  const row=document.createElement('div');row.className='status-box';row.id='row-'+name;row.scrollIntoView=()=>scrolls.push(row.id);row.isCListRowCurrent=()=>true;
  const specific=document.createElement('div');specific.className='statusSpecific';specific.id='item-'+name;specific.reference={url:'https://source.invalid/'+name,summary:'Private body '+name,author:'Author'};
  const summary=document.createElement('div');summary.id=specific.id+'-summary';summary.style.display='block';const content=document.createElement('div');content.id=specific.id+'-content';content.className='entry-full-content';content.style.display='none';
  specific.appendChild(summary);specific.appendChild(content);row.appendChild(specific);feed.appendChild(row);return row;
 };
 const rows=[add('a'),add('b'),add('c')],view=createNavigationView(doc,left);
 const deps={context:()=>context,reader:()=>reader,pane:()=>pane,paneVersion:()=>paneVersion,mobile:()=>mobile,now:()=>time,showPane:target=>{shown.push(target);pane=target+'-pane';paneVersion++;},error:message=>errors.push(message),annotate:async(reference,text,current)=>{if(behavior.annotate)await behavior.annotate();if(current())inserts.push({reference,text});}};
 const controller=createNavigationController(deps,view);previousNavigationFixture=controller;
 const emit=async(name,event)=>{for(const fn of events.get(name)||[])await fn(event);};
 const key=(value,options={})=>{const event={key:value,target:active,preventDefault(){event.prevented=true;},...options};const result=emit('keydown',event);return result.then(()=>event);};
 const point=(x,y,id=1)=>({clientX:x,clientY:y,identifier:id});
 const start=(x=100,y=100,target=rows[0],id=1)=>emit('touchstart',{touches:[point(x,y,id)],target});
 const end=(x,y,duration=100,id=1)=>{time+=duration;return emit('touchend',{touches:[],changedTouches:[point(x,y,id)]});};
 return{root,left,rows,add,view,controller,behavior,shown,inserts,errors,scrolls,key,emit,start,end,point,state:()=>window.CList.state.navigation,feed:()=>feed,
  focus:node=>{active=node;},source:()=>{context='replacement-session';},page:()=>{reader++;},pane:value=>{pane=value;paneVersion++;},desktop:()=>{mobile=false;},selection:value=>{selection=value;},
  element:(tag,parent=root)=>{const node=document.createElement(tag);parent.appendChild(node);return node;},modal:()=>{const node=document.createElement('div');node.id='generic-modal';root.appendChild(node);return node;},
  double:row=>emit('dblclick',{target:row}),click:async node=>{for(const fn of leftEvents.get('click')||[])await fn({target:node});},
  replaceFeed(){feed.remove();feed=document.createElement('div');feed.id='feed-container';root.appendChild(feed);return add('replacement');}
 };
}
function navigationGate(){let resolve;const promise=new Promise(done=>resolve=done);return{promise,resolve};}
const navigationCases=[
 ['J/K/X preserve bounds and expanded navigation',async check=>{
  const f=navigationFixture();await f.key('j');check(f.state().selectedIndex===0,'first J selects first row');await f.key('k');check(f.state().selectedIndex===0,'K clamps first row');await f.key('x');check(f.view.expanded(f.rows[0]),'X expands');await f.key('J',{repeat:true});check(f.state().selectedIndex===1&&f.view.expanded(f.rows[1])&&!f.view.expanded(f.rows[0]),'expanded carry and repeated J');await f.key('j');await f.key('j');check(f.state().selectedIndex===2,'J clamps final row');
 }],
 ['editing, modifiers, composition and modal controls own their keys',async check=>{
  const f=navigationFixture();for(const tag of ['input','textarea','select']){f.focus(f.element(tag));check(!(await f.key('j')).prevented,'typing in '+tag+' untouched');}
  const editable=f.element('div');editable.setAttribute('contenteditable','true');f.focus(f.element('span',editable));check(!(await f.key('x')).prevented,'nested editable untouched');f.focus(f.root);
  for(const options of [{ctrlKey:true},{metaKey:true},{altKey:true},{isComposing:true},{defaultPrevented:true}])check(!(await f.key('j',options)).prevented,'modified/composing/handled key untouched');const modal=f.modal();check(!(await f.key('j')).prevented,'modal owns shortcuts');modal.remove();await f.key('j');await f.key('x',{repeat:true});check(!f.view.expanded(f.rows[0]),'repeated X ignored');
 }],
 ['pagination keeps selection and expired rows cannot supply references',async check=>{
  const f=navigationFixture();await f.key('j');f.page();f.add('d');await f.key('j');check(f.state().selectedIndex===1,'earlier-page selection retained across pagination');f.rows[1].isCListRowCurrent=()=>false;await f.key('x');check(!f.view.expanded(f.rows[1]),'expired shared row not expanded');check(f.state().entryCount===3,'expired row removed from navigation');const next=f.replaceFeed();await f.key('x');check(f.view.expanded(next)&&f.state().selectedIndex===0,'replacement feed cannot reuse stale selected node');
 }],
 ['double click ignores interactive controls',async check=>{
  const f=navigationFixture(),link=f.element('a',f.rows[0]);await f.double(link);check(!f.view.expanded(f.rows[0]),'link double click untouched');await f.double(f.rows[0]);check(f.view.expanded(f.rows[0]),'row double click expands');
 }],
 ['Alt+A captures selection/reference and rejects duplicate or stale completion',async check=>{
  const f=navigationFixture();await f.key('j');const gate=navigationGate();f.behavior.annotate=()=>gate.promise;const work=f.key('a',{altKey:true});await f.key('a',{altKey:true});f.selection('later selection');gate.resolve();await work;check(f.inserts.length===1&&f.inserts[0].text==='captured selection','one captured annotation');check(!JSON.stringify(f.state()).includes('Private body')&&!JSON.stringify(f.state()).includes('private-session'),'safe navigation state');
  const g=navigationFixture();await g.key('j');const wait=navigationGate();g.behavior.annotate=()=>wait.promise;const old=g.key('a',{altKey:true});g.source();wait.resolve();await old;check(g.inserts.length===0,'stale source callback cannot insert');
 }],
 ['annotation failures are visible and can be retried',async check=>{
  const f=navigationFixture();await f.key('a',{altKey:true});check(f.errors.length===1,'missing reference visible');await f.key('j');f.behavior.annotate=async()=>{throw Error('Editor failed');};await f.key('a',{altKey:true});check(f.errors.at(-1).includes('Editor failed')&&!f.state().annotating,'failure visible and lock cleared');
 }],
 ['touch direction chooses one action and desktop never swipes panes',async check=>{
  const f=navigationFixture();await f.start();await f.end(30,105);check(f.shown.join(',')==='write','horizontal swipe changes one pane');f.pane('read-pane');await f.start();await f.end(160,160);check(f.shown.length===1&&f.state().selectedIndex===-1,'diagonal gesture ignored');await f.start();await f.end(105,160);check(f.state().selectedIndex===0&&f.shown.length===1,'short vertical feed swipe only navigates row');f.desktop();await f.start();await f.end(20,100);check(f.shown.length===1,'desktop horizontal touch does not move panes');
 }],
 ['controls, multitouch and cancellation suppress swipes',async check=>{
  const f=navigationFixture(),input=f.element('input',f.rows[0]);await f.start(100,100,input);await f.end(20,100);check(f.shown.length===0,'editing control gesture untouched');await f.start();await f.emit('touchmove',{touches:[f.point(90,100),f.point(80,100,2)]});await f.end(20,100);check(f.shown.length===0,'multitouch cancels');await f.start();await f.emit('touchcancel',{});await f.end(20,100);check(f.shown.length===0&&!f.state().gesturePending,'touch cancellation clears capture');
 }],
 ['reader/session/pane changes expire gestures',async check=>{
  for(const changed of ['page','source','pane','selection']){const f=navigationFixture();await f.start();if(changed==='pane')f.pane('left-pane');else if(changed==='selection')await f.key('j');else f[changed]();await f.end(20,100);check(f.shown.length===0,'changed '+changed+' gesture rejected');}
 }],
 ['only mobile reader choices close the drawer and disposed handlers cannot act',async check=>{
  const f=navigationFixture(),list=f.element('div',f.left);list.id='read-account-list';const reader=f.element('button',list);reader.className='account-button';const other=f.element('button',f.left);other.className='account-button';await f.click(other);check(f.shown.length===0,'other left-panel buttons retained');await f.click(reader);check(f.shown.join(',')==='read','reader choice closes mobile drawer');f.controller.dispose();await f.key('j');await f.start();await f.end(20,100);check(f.shown.length===1&&f.state().selectedIndex===-1,'disposed bindings cannot act');
 }]
];
