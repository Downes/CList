const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {Element}=require('./helpers/account-fixture.cjs');
const plain=value=>JSON.parse(JSON.stringify(value));
function fixture(){
 const body=new Element(),root=new Element();root.id='write-tags';body.appendChild(root);
 root.getBoundingClientRect=()=>({left:10,top:10,bottom:30});
 const errors=[],messages=[],writes=[],encryptions=[],timers=new Map(),frames=[];let timerId=0,reads=0,token='private-token',local=false;
 let list=async()=>[],getKey=async()=>'key',encrypt=async(key,value)=>{encryptions.push([key,value]);return 'encrypted:'+value;},add=async(key,value)=>writes.push([key,value]);
 const ctx=vm.createContext({console:{error(){}},currentEditor:'texteditor',currentEditorAccount:null,
  window:{innerHeight:800,CList:{state:{username:'user'},config:{flaskSiteUrl:'https://store.invalid'},keys:{ACCESS_TOKEN:'access_token'},
   ui:{view:{writeTags:root}},isLocalMode:()=>local,storage:{kv:{list:()=>{reads++;return list();},add:(...args)=>add(...args)}}}},
  document:{body,readyState:'loading',addEventListener(){},getElementById:id=>body.querySelector('#'+id),
   createElement:tag=>{const el=new Element(tag);el.getBoundingClientRect=()=>({left:20,top:10,bottom:30});el.focus=()=>{ctx.document.activeElement=el;};return el;},
   createTextNode:text=>{const el=new Element('span');el.textContent=text;return el;}},
  requestAnimationFrame:fn=>frames.push(fn),setTimeout:fn=>{timers.set(++timerId,fn);return timerId;},clearTimeout:id=>timers.delete(id),
  getSiteSpecificCookie:()=>token,getEncKey:url=>getKey(url),encryptWithKey:(...args)=>encrypt(...args),
  showErrorModal:message=>errors.push(message),showStatusMessage:message=>messages.push(message),
 });
 for(const name of ['tags-state','tags-workflow','tags-view','tags'])vm.runInContext(fs.readFileSync('js/'+name+'.js','utf8'),ctx);
 ctx.window.refreshWriteTags();
 const input=()=>body.querySelector('#write-tag-input');
 const type=value=>{input().focus();input().value=value;return input().listeners.input({target:input()});};
 const key=key=>input().listeners.keydown({key,target:input(),preventDefault(){}});
 const append=name=>{type(name);key('Enter');};
 const button=label=>{const found=body.querySelectorAll('button').find(el=>el.textContent===label||el.title===label);assert.ok(found,label);return found;};
 return{ctx,body,root,errors,messages,writes,encryptions,input,type,key,append,button,reads:()=>reads,focus:()=>{input().focus();return input().listeners.focus();},
  list:fn=>list=fn,getKey:fn=>getKey=fn,encrypt:fn=>encrypt=fn,add:fn=>add=fn,token:value=>token=value,mode:value=>local=value,
  flushTimers(){const callbacks=[...timers.values()];timers.clear();callbacks.forEach(fn=>fn());},timers};
}
test('pure tag rules preserve exact duplicates/case and prefix suggestions without DOM',()=>{
 const ctx=vm.createContext({});vm.runInContext(fs.readFileSync('js/tags-state.js','utf8'),ctx);
 const first=ctx.createWriteTagsState(),one=ctx.addWriteTag(first,'Alpha');assert.equal(first.selected.length,0);
 assert.equal(ctx.addWriteTag(one,'Alpha'),one);assert.deepEqual(plain(ctx.addWriteTag(one,'alpha').selected),['Alpha','alpha']);
 const state={...one,collections:['Alpha','Alpine','Beta'],query:'al'};assert.deepEqual(plain(ctx.suggestedWriteTags(state)),['Alpine']);
 assert.equal(ctx.unknownWriteTag(state,'ALPHA'),false);assert.equal(ctx.removeWriteTag(state,'Alpha').selected.length,0);
});
test('explicit workflow preserves encrypted empty legacy records, add-only semantics and confirmed AlreadyExists',async()=>{
 const ctx=vm.createContext({});vm.runInContext(fs.readFileSync('js/tags-workflow.js','utf8'),ctx);const calls=[];
 const deps={assertSession:()=>calls.push('check'),getKey:async()=>{calls.push('key');return 'key';},encrypt:async(key,value)=>{calls.push([key,value]);return 'cipher';},
  add:async(key,value)=>calls.push([key,value])};
 assert.equal((await ctx.createWriteTagCollection('New',deps)).status,'created');assert.deepEqual(calls.at(-1),['collection:New','cipher']);
 assert.deepEqual(calls[3],['key','[]']);
 deps.add=async()=>{throw Object.assign(Error('Exists'),{code:'AlreadyExists'});};assert.equal((await ctx.createWriteTagCollection('New',deps)).status,'exists');
 deps.add=async()=>{throw Object.assign(Error('Unknown result'),{code:'Indeterminate'});};await assert.rejects(ctx.createWriteTagCollection('New',deps),/Unknown result/);
});
test('typing Enter/comma/Backspace/removal and snapshot API preserve current selection',async()=>{
 const f=fixture();await f.focus();f.append('  Alpha  ');f.type('Beta,');f.key(',');f.append('Alpha');
 assert.deepEqual(plain(f.ctx.window.getWriteTags()),['Alpha','Beta']);const snapshot=f.ctx.window.getWriteTags();snapshot.push('Outside');assert.equal(f.ctx.window.getWriteTags().length,2);
 f.type('');f.key('Backspace');assert.deepEqual(plain(f.ctx.window.getWriteTags()),['Alpha']);await f.button('Remove tag').onclick();assert.equal(f.ctx.window.getWriteTags().length,0);
 assert.equal(f.input().placeholder,'Add tag…');
});
test('focus fetches collection names once and typing before a delayed result displays matching suggestions',async()=>{
 const f=fixture();let finish;f.list(()=>new Promise(resolve=>finish=resolve));const pending=f.focus(),second=f.focus();
 f.type('al');assert.equal(f.reads(),1);finish([{key:'collection:Alpha'},{key:'collection:Beta'}]);await Promise.all([pending,second]);
 assert.deepEqual(f.body.querySelector('#write-tags-dropdown').querySelectorAll('button').map(button=>button.textContent),['Alpha']);
});
test('collection suggestions use case-insensitive prefixes and stale dropdown choices are ignored',async()=>{
 const f=fixture();f.list(async()=>[{key:'collection:Alpha'},{key:'collection:Alpine'},{key:'account:Other'}]);await f.focus();
 f.type('al');const alpha=f.button('Alpha');assert.equal(f.reads(),1);f.type('Alp');await alpha.listeners.mousedown({preventDefault(){}});assert.equal(f.ctx.window.getWriteTags().length,0);
 const alpine=f.button('Alpine');await alpine.listeners.mousedown({preventDefault(){}});assert.deepEqual(plain(f.ctx.window.getWriteTags()),['Alpine']);
 await f.focus();assert.equal(f.reads(),1);f.type('AL');assert.equal(f.body.querySelector('#write-tags-dropdown').querySelectorAll('button').length,1);
});
test('anonymous tagging works without collection requests or a creation offer',async()=>{
 const f=fixture();f.token(null);f.ctx.window.refreshWriteTags();await f.focus();f.append('Offline');
 assert.deepEqual(plain(f.ctx.window.getWriteTags()),['Offline']);assert.equal(f.reads(),0);assert.equal(f.body.querySelector('#write-tags-col-offer'),null);
 assert.equal(f.writes.length,0);assert.deepEqual(f.errors,[]);
});
test('failed collection reads are visible and not cached as an empty success; next explicit focus retries',async()=>{
 const f=fixture();f.list(async()=>{throw Error('List failed');});await f.focus();assert.deepEqual(f.errors,['List failed']);
 assert.equal(f.ctx.window.CList.state.writeTags.collections,null);f.list(async()=>[{key:'collection:Recovered'}]);await f.focus();assert.equal(f.reads(),2);
 assert.deepEqual(plain(f.ctx.window.CList.state.writeTags.collections),['Recovered']);
});
test('session/server/mode cache changes reject old list data without erasing selected tags',async()=>{
 for(const mode of ['token','username','store','mode']){
  const f=fixture();f.append('Keep');let finish;f.list(()=>new Promise(resolve=>finish=resolve));const pending=f.focus();
  if(mode==='token')f.token('other');if(mode==='username')f.ctx.window.CList.state.username='other';
  if(mode==='store')f.ctx.window.CList.config.flaskSiteUrl='https://other.invalid';if(mode==='mode')f.mode(true);
  f.ctx.window.refreshWriteTags();f.list(async()=>[{key:'collection:New'}]);await f.focus();finish([{key:'collection:Old'}]);await pending;
  assert.deepEqual(plain(f.ctx.window.CList.state.writeTags.collections),['New'],mode);assert.deepEqual(plain(f.ctx.window.getWriteTags()),['Keep'],mode);
 }
});
test('clear and new render invalidate old inputs/offers and delayed blur cannot close a refocused dropdown',async()=>{
 const f=fixture();f.list(async()=>[{key:'collection:Alpha'}]);await f.focus();f.type('Al');const old=f.input();old.listeners.blur();
 await f.focus();f.flushTimers();assert.ok(f.body.querySelector('#write-tags-dropdown'));
 f.ctx.window.clearWriteTags();old.value='Stale';old.listeners.keydown({key:'Enter',target:old,preventDefault(){}});assert.equal(f.ctx.window.getWriteTags().length,0);
 f.append('New');const yes=f.button('Yes');f.ctx.window.clearWriteTags();await yes.onclick();assert.equal(f.writes.length,0);
});
test('creation No leaves the tag and Yes sends one encrypted empty collection without retargeting later edits',async()=>{
 const f=fixture();await f.focus();f.append('No create');await f.button('No').onclick();assert.deepEqual(plain(f.ctx.window.getWriteTags()),['No create']);assert.equal(f.writes.length,0);
 f.append('Create');let finish;f.getKey(()=>new Promise(resolve=>finish=resolve));const yes=f.button('Yes'),pending=yes.onclick();await yes.onclick();
 f.append('Later');assert.equal(f.button('Yes').disabled,true);finish('key');await pending;
 assert.deepEqual(f.writes,[['collection:Create','encrypted:[]']]);assert.deepEqual(f.encryptions,[['key','[]']]);
 assert.deepEqual(plain(f.ctx.window.getWriteTags()),['No create','Create','Later']);assert.equal(f.button('Yes').disabled,false);
 assert.equal(JSON.stringify(f.ctx.window.CList.state.writeTags).includes('private-token'),false);
});
test('confirmed existing collection updates suggestions but never overwrites; failed writes remain visible without retry',async()=>{
 const f=fixture();await f.focus();f.append('Existing');let calls=0;
 f.add(async()=>{calls++;throw Object.assign(Error('Already exists'),{code:'AlreadyExists'});});await f.button('Yes').onclick();assert.equal(calls,1);
 assert.ok(f.ctx.window.CList.state.writeTags.collections.includes('Existing'));assert.deepEqual(f.errors,[]);
 f.append('Uncertain');f.add(async()=>{calls++;throw Object.assign(Error('Write uncertain'),{code:'Indeterminate'});});await f.button('Yes').onclick();
 assert.equal(calls,2);assert.deepEqual(f.errors,['Write uncertain']);assert.ok(f.ctx.window.getWriteTags().includes('Uncertain'));assert.equal(f.ctx.window.CList.state.writeTags.creating,false);
});
test('session changes during key retrieval/encryption prevent an add and do not contaminate the new cache',async()=>{
 for(const stage of ['key','encrypt']){
  const f=fixture();await f.focus();f.append('Old request');let finish;
  if(stage==='key')f.getKey(()=>new Promise(resolve=>finish=resolve));else f.encrypt(()=>new Promise(resolve=>finish=resolve));
  const pending=f.button('Yes').onclick();if(stage==='encrypt')await new Promise(resolve=>setImmediate(resolve));
  f.token('other');f.ctx.window.CList.state.username='other';f.ctx.window.refreshWriteTags();finish(stage==='key'?'key':'cipher');await pending;
  assert.equal(f.writes.length,0,stage);assert.deepEqual(f.errors,[]);assert.deepEqual(f.messages,['An earlier tag operation failed.']);
  assert.equal(f.ctx.window.CList.state.writeTags.collections,null);assert.equal(f.ctx.window.CList.state.writeTags.creating,false);
 }
});
test('stale editor inputs cannot edit selection, and editor refresh retains global selected tags',async()=>{
 const f=fixture();f.append('Keep');const old=f.input();f.ctx.currentEditor='tinymce';f.ctx.window.CList.state.editorSwitching={id:1};
 f.ctx.window.refreshWriteTags();
 old.value='Stale';old.listeners.keydown({key:'Enter',target:old,preventDefault(){}});assert.deepEqual(plain(f.ctx.window.getWriteTags()),['Keep']);
 f.ctx.window.refreshWriteTags();f.append('Current');assert.deepEqual(plain(f.ctx.window.getWriteTags()),['Keep','Current']);
});

test('editor/file refresh retains unfinished tag text and rebinds its callbacks and create offer',async()=>{
 const f=fixture();await f.focus();f.append('Offer');f.type('Unfinished');const oldYes=f.button('Yes');
 f.ctx.currentEditor='tinymce';f.ctx.window.CList.state.editorSwitching={id:1};f.ctx.window.refreshWriteTags();
 assert.equal(f.input().value,'Unfinished');assert.equal(f.ctx.window.CList.state.writeTags.offer,'Offer');await oldYes.onclick();assert.equal(f.writes.length,0);
 f.ctx.window.CList.state.editorLoading={id:1};f.ctx.window.refreshWriteTags();assert.equal(f.input().value,'Unfinished');
 f.key('Enter');assert.deepEqual(plain(f.ctx.window.getWriteTags()),['Offer','Unfinished']);
});
test('standalone view uses explicit models and callbacks without reading shared state or storage',()=>{
 const f=fixture();Object.defineProperty(f.ctx.window.CList,'state',{get(){throw Error('View read state');}});
 f.ctx.window.CList.ui.tags.mount({selected:['One'],query:'T'},{remove(){},focus(){},input(){},key(){return false;},blur(){}});
 f.input().focus();
 f.ctx.window.CList.ui.tags.dropdown(['Two'],()=>{});f.ctx.window.CList.ui.tags.offer('Three',()=>{},()=>{});
 assert.ok(f.body.querySelector('#write-tags-dropdown'));assert.equal(f.input().value,'T');
});

test('a real delayed editor mount retains tag text typed while the new editor is initializing',async()=>{
 const f=fixture();Object.assign(f.ctx,{structuredClone,pendingContent:null,currentLoadedPage:null,EDITOR_TEST_VERSION:'fixture',
  getReferences:()=>[],setReferences(){},setLoadedPage(){},closeReferencesPanel(){},editorHandlers:{}});
 f.ctx.window.CList.ui.editorSwitch={prepare:()=>()=>{},close(){},indicator(){},choices(){},error:error=>f.errors.push(error.message)};
 for(const name of ['editor-state','editor-switch'])vm.runInContext(fs.readFileSync('js/'+name+'.js','utf8'),f.ctx);
 f.ctx.populateEditorList=async()=>{};let finish;
 f.ctx.editorHandlers.slow={label:'Slow',initialize:()=>{f.ctx.currentEditor='slow';return new Promise(resolve=>finish=resolve);}};
 const pending=f.ctx.switchToEditor('slow');await new Promise(resolve=>setImmediate(resolve));
 f.type('Typed during mount');finish();await pending;
 assert.equal(f.input().value,'Typed during mount');f.key('Enter');assert.deepEqual(plain(f.ctx.window.getWriteTags()),['Typed during mount']);
});

test('token expiry while focused does not disable local tagging or reuse old collection suggestions',async()=>{
 const f=fixture();f.list(async()=>[{key:'collection:Private'}]);await f.focus();f.type('Priv');const old=f.button('Private');
 f.token(null);f.type('Anonymous draft');f.key('Enter');await old.listeners.mousedown({preventDefault(){}});
 assert.deepEqual(plain(f.ctx.window.getWriteTags()),['Anonymous draft']);assert.equal(f.body.querySelector('#write-tags-col-offer'),null);
 assert.equal(f.body.querySelector('#write-tags-dropdown'),null);assert.equal(f.reads(),1);
});

test('a delayed suggestion read cannot open a dropdown after the tag input loses focus',async()=>{
 const f=fixture();let finish;f.list(()=>new Promise(resolve=>finish=resolve));const pending=f.focus();f.type('Al');
 f.ctx.document.activeElement=f.body;finish([{key:'collection:Alpha'}]);await pending;
 assert.equal(f.body.querySelector('#write-tags-dropdown'),null);assert.equal(f.ctx.window.CList.state.writeTags.collections[0],'Alpha');
});

test('stale blur cannot cancel a newer close timer, and missing encryption keys report failure without writes',async()=>{
 const f=fixture();f.list(async()=>[{key:'collection:Alpha'}]);await f.focus();const old=f.input();
 f.ctx.window.refreshWriteTags();f.type('Al');f.input().listeners.blur();old.listeners.blur();f.flushTimers();
 assert.equal(f.body.querySelector('#write-tags-dropdown'),null);
 f.append('Needs key');f.getKey(async()=>null);await f.button('Yes').onclick();
 assert.deepEqual(f.errors,['Encryption key unavailable. Please log in again.']);assert.equal(f.writes.length,0);
 assert.ok(f.ctx.window.getWriteTags().includes('Needs key'));assert.equal(f.ctx.window.CList.state.writeTags.creating,false);
});
