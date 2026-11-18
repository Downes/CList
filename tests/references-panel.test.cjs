const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {Element}=require('./helpers/account-fixture.cjs');
const plain=value=>JSON.parse(JSON.stringify(value));
const reference=(url='https://source.invalid/a')=>({url,title:'Title',author_name:'Author',feed:'Feed',
 created_at:'2026-01-02T12:00:00Z',cited_at:'2026-11-18T12:00:00Z',service:'Mastodon',author_id:'author',id:'row',summary:'Quote',
 replyToken:{type:'Mastodon',statusId:'thread'},extension:{keep:true}});
function fixture(){
 function element(tag='div'){
  const el=new Element(tag);
  el.classList={add:name=>{el.className=[...new Set((el.className||'').split(' ').filter(Boolean).concat(name))].join(' ');},
   remove:name=>{el.className=(el.className||'').split(' ').filter(item=>item!==name).join(' ');},
   contains:name=>(el.className||'').split(' ').includes(name)};
  el.replaceWith=next=>{const parent=el.parentNode;if(parent){parent.insertBefore(next,el);el.remove();}};
  el.blur=()=>el.listeners.blur?.();return el;
 }
 const root=element(),refsButton=element('button'),errors=[],messages=[];root.appendChild(refsButton);let refreshed=0;
 const ctx=vm.createContext({structuredClone,console:{error(){}},currentEditor:'texteditor',currentEditorAccount:null,currentLoadedPage:null,
  window:{CList:{state:{username:'user'},config:{flaskSiteUrl:'https://store.invalid'},ui:{view:{writeEditorArea:root,referencesButton:refsButton}}}},
  document:{getElementById:id=>root.querySelector('#'+id),createElement:element,createTextNode:text=>{const el=element('span');el.textContent=text;return el;}},
  editorHandlers:{},showErrorModal:message=>errors.push(message),showStatusMessage:message=>messages.push(message),
  _refreshAnnotateSendControls:()=>refreshed++,_refreshAnnotateRefFields:()=>refreshed++,
 });
 ctx.switchToEditor=async key=>{ctx.currentEditor=key;ctx.setReferences([]);return true;};
 for(const name of ['references-state','references-view','references'])vm.runInContext(fs.readFileSync('js/'+name+'.js','utf8'),ctx);
 const button=(title,row=0)=>{
  const found=root.querySelectorAll('button').filter(button=>button.title===title||button.textContent===title)[row];assert.ok(found,title);return found;
 };
 const field=(key,row=0)=>root.querySelectorAll('.status-box')[row].querySelectorAll('span').find(span=>span.dataset.referenceField===key);
 return {ctx,root,refsButton,errors,messages,button,field,refreshed:()=>refreshed};
}
test('pure list transitions retain exact URL rules and structural metadata without mutating input',()=>{
 const ctx=vm.createContext({});vm.runInContext(fs.readFileSync('js/references-state.js','utf8'),ctx);
 const ref=reference(),list=[ref];assert.equal(ctx.appendPanelReference(list,{url:ref.url}),list);assert.equal(ctx.appendPanelReference(list,null),list);
 const added=ctx.appendPanelReference(list,{url:ref.url.toUpperCase()});assert.equal(added.length,2);assert.equal(list.length,1);
 const edited=ctx.editPanelReference(list,0,ref,'title','Edited');assert.equal(ref.title,'Title');assert.equal(edited[0].replyToken.statusId,'thread');
 assert.equal(edited[0].extension.keep,true);assert.equal(ctx.editPanelReference(list,0,ref,'replyToken',null),list);
 assert.equal(ctx.removePanelReference(list,0,{}),list);assert.equal(ctx.removePanelReference(list,0,ref).length,0);
 const state=ctx.nextReferencesPanel(null),next=ctx.nextReferencesPanel(state,{open:true},true);assert.equal(state.open,false);assert.equal(next.generation,1);
});
test('compatibility APIs collect/deduplicate, replace wholesale and preserve citations and reply tokens',()=>{
 const f=fixture(),a=reference();assert.equal(f.ctx.pushReference(a),true);assert.equal(f.ctx.pushReference({...a}),false);
 assert.equal(f.ctx.pushReference({title:'No URL'}),false);assert.deepEqual(plain(f.ctx.getReferences()),[a]);
 const text=f.root.querySelector('#clist-references-panel').textContent;assert.match(text,/2026-01-02/);assert.match(text,/Cited on 2026-11-18/);
 assert.equal(f.refsButton.style.display,'');f.ctx.setReferences([a,a]);assert.equal(f.ctx.getReferences().length,2);
 f.ctx.setReferences(null);assert.equal(f.ctx.getReferences().length,0);assert.equal(f.refsButton.style.display,'none');
});
test('inline click/keyboard edits commit once and preserve readonly fields while subsequent fields remain editable',()=>{
 const f=fixture(),a=reference();f.ctx.setReferences([a]);const title=f.field('title');title.listeners.click();
 const input=f.root.querySelector('input');input.value='Edited';input.listeners.keydown({key:'Enter',preventDefault(){}});input.blur();
 assert.equal(f.ctx.getReferences()[0].title,'Edited');assert.equal(f.ctx.getReferences()[0],a);assert.equal(title.textContent,'Edited');
 const author=f.field('author_name');author.listeners.keydown({key:'Enter',preventDefault(){}});f.root.querySelector('input').value='New author';f.root.querySelector('input').blur();
 assert.equal(f.ctx.getReferences()[0].author_name,'New author');assert.equal(f.ctx.getReferences()[0].replyToken.statusId,'thread');
 assert.equal(f.ctx.getReferences()[0].created_at,a.created_at);assert.equal(f.ctx.getReferences()[0].extension.keep,true);
 // Annotation's existing field handlers retain this exact target object.
 a.feed='Annotation field edit';assert.equal(f.ctx.getReferences()[0].feed,'Annotation field edit');
 f.field('feed').listeners.click();assert.equal(f.root.querySelector('input').value,'Annotation field edit');f.root.querySelector('input').blur();
 title.listeners.click();assert.equal(f.root.querySelector('input').value,'Edited');
});
test('URL editing preserves existing duplicate behavior and removal targets the captured row identity',async()=>{
 const f=fixture(),a=reference(),b=reference('https://source.invalid/b');f.ctx.setReferences([a,b]);
 f.field('url',1).listeners.click();f.root.querySelector('input').value=a.url;f.root.querySelector('input').blur();
 assert.equal(f.ctx.getReferences().length,2);assert.equal(f.ctx.pushReference(reference()),false);
 await f.button('Remove reference',1).onclick();assert.equal(f.ctx.getReferences().length,1);assert.equal(f.ctx.getReferences()[0],a);
});
test('stale inputs and row actions cannot affect a replaced list or newer editor/account/session/doc',async()=>{
 for(const change of ['list','editor','account','session','store','doc','load','mount']){
  const f=fixture();let doc='old';f.ctx.editorHandlers.texteditor={getDocId:()=>doc};f.ctx.setReferences([reference()]);
  const remove=f.button('Remove reference'),annotate=f.button('Annotate this reference');f.field('title').listeners.click();const input=f.root.querySelector('input');input.value='Stale';
  if(change==='list')f.ctx.setReferences([reference('https://new.invalid')]);if(change==='editor')f.ctx.currentEditor='tinymce';
  if(change==='account')f.ctx.currentEditorAccount={key:'other'};
  if(change==='session')f.ctx.window.CList.state.username='other';if(change==='store')f.ctx.window.CList.config.flaskSiteUrl='other';
  if(change==='doc')doc='new';if(change==='load')f.ctx.window.CList.state.editorLoading={id:1};if(change==='mount')f.ctx.window.CList.state.editorSwitching={id:1};
  input.blur();await remove.onclick();await annotate.onclick();assert.equal(f.ctx.getReferences().length,1,change);assert.equal(f.ctx.getReferences()[0].title,'Title',change);
 }
});
test('panel open/close belongs to state, ignores DOM tampering and clear hides and expires controls',async()=>{
 const f=fixture();f.ctx.pushReference(reference());f.ctx.window.playRefs();const panel=f.root.querySelector('#clist-references-panel');
 assert.equal(f.ctx.window.CList.state.referencesPanel.open,true);panel.classList.remove('open');f.ctx.window.playRefs();
 assert.equal(panel.classList.contains('open'),false);assert.equal(f.ctx.window.CList.state.referencesPanel.open,false);
 f.ctx.window.playRefs();const remove=f.button('Remove reference');f.ctx.closeReferencesPanel();await remove.onclick();assert.equal(f.ctx.getReferences().length,1);
 f.ctx.clearReferences();assert.equal(f.refsButton.style.display,'none');assert.equal(panel.textContent,'');assert.equal(panel.classList.contains('open'),false);
 f.ctx.window.playRefs();assert.deepEqual(f.errors,['No references yet.']);
});
test('Annotate captures the full target, strips only its reply token and guards duplicate pending actions',async()=>{
 const f=fixture(),a=reference();f.ctx.setReferences([a]);let finish,calls=0;
 f.ctx.switchToEditor=()=>{calls++;return new Promise(resolve=>finish=()=>{f.ctx.currentEditor='annotate-edit';f.ctx.setReferences([]);resolve(true);});};
 const button=f.button('Annotate this reference'),pending=button.onclick();await button.onclick();assert.equal(calls,1);assert.equal(button.disabled,true);
 finish();await pending;assert.equal(f.ctx.getReferences()[0].replyToken,null);assert.equal(a.replyToken.statusId,'thread');
 assert.equal(f.ctx.getReferences()[0].extension.keep,true);assert.equal(f.refreshed(),2);assert.equal(f.ctx.window.CList.state.referencesPanel.busy,false);
});
test('failed/superseded Annotate switches and changed sessions/file loads do not insert or refresh targets',async()=>{
 for(const mode of ['false','reject','other-editor','session','file','removed']){
  const f=fixture();f.ctx.pushReference(reference());let finish,reject;
  f.ctx.switchToEditor=()=>new Promise((resolve,fail)=>{finish=resolve;reject=fail;});const pending=f.button('Annotate this reference').onclick();
  if(mode==='removed')await f.button('Remove reference').onclick();
  if(mode==='session')f.ctx.window.CList.state.username='new';if(mode==='file')f.ctx.window.CList.state.editorLoading={id:1};
  f.ctx.currentEditor=mode==='other-editor'?'tinymce':'annotate-edit';
  if(mode==='reject')reject(Error('Mount failed'));else finish(mode==='false'?false:true);await pending;
  assert.equal(f.refreshed(),0,mode);assert.equal(f.ctx.window.CList.state.referencesPanel.busy,false,mode);
  assert.equal(f.ctx.getReferences().some(ref=>ref.replyToken===null),false,mode);if(mode==='reject')assert.deepEqual(f.errors,['Mount failed']);
 }
});
test('collection action captures a detached list and original anchor, guards duplicates and reports unavailable/failed helpers',async()=>{
 const f=fixture(),a=reference();f.ctx.setReferences([a]);let finish,items,anchor,calls=0;
 f.ctx.window.importCollectionFromChat=(captured,button)=>{calls++;items=captured;anchor=button;return new Promise(resolve=>finish=resolve);};
 const button=f.button('Save as collection'),pending=button.onclick();await button.onclick();assert.equal(calls,1);assert.equal(anchor,button);
 items[0].title='Helper mutation';assert.equal(f.ctx.getReferences()[0].title,'Title');finish();await pending;
 delete f.ctx.window.importCollectionFromChat;await button.onclick();assert.deepEqual(f.errors,['Collection import not available.']);
 f.ctx.window.importCollectionFromChat=async()=>{throw Error('Import failed');};await button.onclick();assert.equal(f.errors.at(-1),'Import failed');
 f.ctx.setReferences([a]);await button.onclick();assert.equal(calls,1);
});
test('view accepts display values and callbacks without reading global reference state',()=>{
 const f=fixture();Object.defineProperty(f.ctx.window.CList,'state',{get(){throw Error('View must not read state');}});
 f.ctx.window.CList.ui.references.mount([{reference:reference(),edit(){return true;},remove(){},annotate(){}}],{open:true,busy:false,close(){},save(){}});
 assert.match(f.root.textContent,/References/);assert.equal(f.refsButton.style.display,'');
});

test('an old close callback cannot close a rebuilt panel and a newer Annotate mount rejects old completion',async()=>{
 const f=fixture();f.ctx.pushReference(reference());f.ctx.window.playRefs();const close=f.button('Close');
 f.ctx.setReferences([reference('https://new.invalid')]);await close.onclick();assert.equal(f.ctx.window.CList.state.referencesPanel.open,true);
 let finish;f.ctx.switchToEditor=()=>new Promise(resolve=>finish=resolve);
 const pending=f.button('Annotate this reference').onclick();f.ctx.currentEditor='annotate-edit';
 f.ctx.window.CList.state.editorSwitching={id:2,phase:'mounting'};finish(true);await pending;
 assert.equal(f.ctx.getReferences()[0].replyToken.statusId,'thread');assert.equal(f.refreshed(),0);
});

test('normal Save metadata updates preserve current References controls and unfinished field edits',async()=>{
 const f=fixture();for(const name of ['editor-controls-state','editor-controls-view','editor-controls'])vm.runInContext(fs.readFileSync('js/'+name+'.js','utf8'),f.ctx);
 f.ctx.pushReference(reference());f.ctx.window.playRefs();f.field('title').listeners.click();const input=f.root.querySelector('input');input.value='Keep unfinished edit';
 f.ctx.setLoadedPage({kind:'local-page',id:'just-saved',title:'Saved document'});
 assert.equal(f.root.querySelector('input'),input);input.blur();assert.equal(f.ctx.getReferences()[0].title,'Keep unfinished edit');
 await f.button('Remove reference').onclick();assert.equal(f.ctx.getReferences().length,0);
 await f.button('Close').onclick();assert.equal(f.ctx.window.CList.state.referencesPanel.open,false);
});

test('a late collection error releases busy state without replacing a newer editor with an old error modal',async()=>{
 const f=fixture();f.ctx.pushReference(reference());let fail;
 f.ctx.window.importCollectionFromChat=()=>new Promise((resolve,reject)=>fail=reject);
 const pending=f.button('Save as collection').onclick();f.ctx.currentEditor='other';fail(Error('Old import failed'));await pending;
 assert.deepEqual(f.errors,[]);assert.deepEqual(f.messages,['An earlier reference action failed.']);
 assert.equal(f.ctx.window.CList.state.referencesPanel.busy,false);
});
