const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {Element}=require('./helpers/account-fixture.cjs');
function fixture(){
 const root=new Element(),errors=[],notices=[];let closed=0,opened=0;
 const ctx=vm.createContext({console:{error(){}},currentEditor:'texteditor',currentEditorAccount:null,
  window:{CList:{state:{username:'user'},config:{flaskSiteUrl:'https://store.invalid'},savers:[],
   ui:{isHandlerVisible:handler=>!handler.hidden}}},
  document:{getElementById:()=>root,createElement:tag=>new Element(tag)},
  openRightInterface(){opened++;},closeRightPane(){closed++;ctx.invalidateSavePanel();},
  showErrorModal:message=>errors.push(message),showStatusMessage:message=>notices.push(message),
 });
 for(const name of ['save-state','save-view','save-panel'])vm.runInContext(fs.readFileSync('js/'+name+'.js','utf8'),ctx);
 const button=label=>{const button=root.querySelectorAll('button').find(item=>item.textContent.endsWith(label));assert.ok(button,label);return button;};
 return{ctx,root,errors,notices,button,closed:()=>closed,opened:()=>opened};
}
test('pure save state retains the in-flight lock across panel refresh and ignores obsolete completion',()=>{
 const ctx=vm.createContext({});vm.runInContext(fs.readFileSync('js/save-state.js','utf8'),ctx);
 const ready=ctx.openSavePanelState(),saving=ctx.startSaveState(ready,'File'),reopened=ctx.openSavePanelState(saving);
 assert.equal(ready.busy,false);assert.equal(reopened.busy,true);assert.equal(ctx.startSaveState(reopened,'Other'),reopened);
 assert.equal(ctx.finishSaveState(reopened,0),reopened);assert.equal(ctx.finishSaveState(reopened,saving.operationId).busy,false);
 assert.equal(ctx.finishSaveState(reopened,saving.operationId,'').phase,'failed');
 assert.equal(reopened.panelId,ready.panelId+1);
});
test('Save renders eligible destinations/icons and preserves saver method binding and no-argument contract',async()=>{
 const f=fixture();let called=0;
 const saver={label:'File',icon:'download',save(...args){assert.equal(this,saver);assert.equal(args.length,0);called++;}};
 f.ctx.window.CList.savers.push(saver,{label:'Hidden',hidden:true});await f.ctx.playSave();
 assert.equal(f.opened(),1);assert.equal(f.root.querySelectorAll('button').length,1);await f.button('File').onclick();
 assert.equal(called,1);assert.equal(f.closed(),1);assert.equal(f.ctx.window.CList.state.saving.phase,'complete');
});
test('keepOpen leaves service-rendered controls intact and explicit later saves remain possible',async()=>{
 const f=fixture();let calls=0;
 f.ctx.window.CList.savers.push({label:'Service',logoSrc:'data:image/svg+xml,fixture',save(){calls++;return{keepOpen:true};}});
 f.ctx.populateSaveOptions();const button=f.button('Service');await button.onclick();
 assert.equal(f.closed(),0);assert.equal(button.disabled,false);assert.equal(f.root.querySelector('.service-icon-img').className,'service-icon-img');
 await button.onclick();assert.equal(calls,2);
 f.ctx.window.CList.savers[0].save=()=>{f.root.innerHTML='<p>Destination form</p>';return{keepOpen:true};};
 await button.onclick();assert.equal(f.root.textContent,'Destination form');assert.equal(f.closed(),0);
});
test('pending save disables choices and rebuilding/opening cannot start a duplicate write',async()=>{
 const f=fixture();let finish,calls=0;
 f.ctx.window.CList.savers.push({label:'Slow',save:()=>{calls++;return new Promise(resolve=>finish=resolve);}});
 f.ctx.populateSaveOptions();const first=f.button('Slow'),pending=first.onclick();await first.onclick();
 assert.equal(calls,1);assert.equal(first.disabled,true);await f.ctx.playSave();const second=f.button('Slow');
 assert.equal(second.disabled,true);await second.onclick();assert.equal(calls,1);
 finish();await pending;assert.equal(second.disabled,false);assert.equal(f.closed(),0);
 assert.equal(f.ctx.window.CList.state.saving.busy,false);
});
test('closed, rebuilt or changed editor/account/session/file owners cannot invoke old destination controls',async()=>{
 for(const change of ['close','rebuild','editor','account','session','store','file','mount']){
  const f=fixture();let calls=0;f.ctx.window.CList.savers.push({label:'File',save(){calls++;}});
  f.ctx.populateSaveOptions();const button=f.button('File');
  if(change==='close')f.ctx.invalidateSavePanel();if(change==='rebuild')f.ctx.populateSaveOptions();
  if(change==='editor')f.ctx.currentEditor='tinymce';if(change==='account')f.ctx.currentEditorAccount={key:'other'};
  if(change==='session')f.ctx.window.CList.state.username='other';if(change==='store')f.ctx.window.CList.config.flaskSiteUrl='other';
  if(change==='file')f.ctx.window.CList.state.editorLoading={id:1};if(change==='mount')f.ctx.window.CList.state.editorSwitching={id:1};
  await button.onclick();assert.equal(calls,0,change);
 }
});
test('late completion cannot close a newer panel/editor/file/session and always releases the lock',async()=>{
 for(const change of ['close','rebuild','editor','session','file']){
  const f=fixture();let finish;f.ctx.window.CList.savers.push({label:'Slow',save:()=>new Promise(resolve=>finish=resolve)});
  f.ctx.populateSaveOptions();const pending=f.button('Slow').onclick();
  if(change==='close')f.ctx.invalidateSavePanel();if(change==='rebuild')f.ctx.populateSaveOptions();
  if(change==='editor')f.ctx.currentEditor='tinymce';if(change==='session')f.ctx.window.CList.state.username='other';
  if(change==='file')f.ctx.window.CList.state.editorLoading={id:1};
  finish();await pending;assert.equal(f.closed(),0,change);assert.equal(f.ctx.window.CList.state.saving.busy,false,change);
 }
});
test('save failure is visible, never retries automatically and permits an explicit retry',async()=>{
 const f=fixture();let calls=0;f.ctx.window.CList.savers.push({label:'Fail',save:async()=>{calls++;throw Error('Write failed');}});
 f.ctx.populateSaveOptions();await f.button('Fail').onclick();assert.deepEqual(f.errors,['Write failed']);assert.equal(calls,1);
 assert.equal(f.ctx.window.CList.state.saving.phase,'failed');assert.equal(f.button('Fail').disabled,false);assert.equal(f.closed(),0);
 await f.button('Fail').onclick();assert.equal(calls,2);
});
test('late failures release the lock without replacing newer panel contents with an error modal',async()=>{
 const f=fixture();let reject;f.ctx.window.CList.savers.push({label:'Slow',save:()=>new Promise((resolve,fail)=>reject=fail)});
 f.ctx.populateSaveOptions();const pending=f.button('Slow').onclick();f.ctx.populateSaveOptions();
 reject(Error('Old write failed'));await pending;assert.deepEqual(f.errors,[]);assert.deepEqual(f.notices,['An earlier save failed.']);
 assert.equal(f.button('Slow').disabled,false);assert.equal(f.ctx.window.CList.state.saving.busy,false);
});
test('dispatch revalidates removed/hidden destinations and collection-publication busy state',async()=>{
 for(const change of ['removed','hidden','publishing']){
  const f=fixture();let calls=0;const saver={label:'File',save(){calls++;}};f.ctx.window.CList.savers.push(saver);
  f.ctx.populateSaveOptions();const button=f.button('File');
  if(change==='removed')f.ctx.window.CList.savers=[];if(change==='hidden')saver.hidden=true;
  if(change==='publishing')f.ctx.window.CList.state.collectionPublishing={busy:true};
  await button.onclick();assert.equal(calls,0,change);
 }
});
test('collection Save delegates to the existing controller and guards pending generic saves/publication',async()=>{
 const f=fixture();let calls=0;f.ctx.currentEditor='collection';f.ctx.window.playCollectionSave=async()=>calls++;
 await f.ctx.playSave();assert.equal(calls,1);assert.equal(f.opened(),0);
 f.ctx.window.CList.state.collectionPublishing={busy:true};await f.ctx.playSave();assert.equal(calls,1);
 f.ctx.window.CList.state.collectionPublishing.busy=false;f.ctx.window.CList.state.saving.busy=true;await f.ctx.playSave();assert.equal(calls,1);
});
test('collection controller errors are visible and shared save state contains no account/body payloads',async()=>{
 const f=fixture();f.ctx.currentEditor='collection';f.ctx.currentEditorAccount={key:'a',value:'private credentials'};
 f.ctx.window.playCollectionSave=async()=>{throw Error('Collection failed');};await f.ctx.playSave();assert.deepEqual(f.errors,['Collection failed']);
 assert.equal(JSON.stringify(f.ctx.window.CList.state.saving).includes('private'),false);
});

test('reopening a pending real Dropbox overwrite prompt retains its resolving controls and unlocks on Cancel/Overwrite',async()=>{
 for(const mode of ['Cancel','Overwrite']){
  const f=fixture();let writes=0;
  const source=fs.readFileSync('js/dropbox.js','utf8'),start=source.indexOf('function _promptDropboxOverwrite(');
  vm.runInContext(source.slice(start,source.indexOf('(function () {',start)),f.ctx);
  f.ctx.window.CList.savers.push({label:'Dropbox',save(){
   const status=new Element();status.id='dropbox-save-status';f.root.appendChild(status);
   return f.ctx._promptDropboxOverwrite(status,'existing.html',async()=>{writes++;return{path_display:'existing.html'};});
  }});
  f.ctx.populateSaveOptions();const pending=f.button('Dropbox').onclick();
  f.ctx.invalidateSavePanel();await f.ctx.playSave();
  assert.equal(f.button('Dropbox').disabled,true);assert.ok(f.button(mode));
  await f.button(mode).onclick();await pending;
  assert.equal(writes,mode==='Overwrite'?1:0);assert.equal(f.ctx.window.CList.state.saving.busy,false);
  assert.equal(f.button('Dropbox').disabled,false);assert.equal(f.closed(),0);
 }
});

test('a legacy saver rejecting a non-Error value still releases busy state and reports failure',async()=>{
 const f=fixture();f.ctx.window.CList.savers.push({label:'Legacy',save:()=>Promise.reject(null)});
 f.ctx.populateSaveOptions();await f.button('Legacy').onclick();
 assert.equal(f.ctx.window.CList.state.saving.phase,'failed');assert.equal(f.ctx.window.CList.state.saving.busy,false);
 assert.deepEqual(f.errors,['null']);
});
