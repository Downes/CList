const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {Element}=require('./helpers/account-fixture.cjs');const read=name=>fs.readFileSync('js/'+name+'.js','utf8');
const gate=()=>{let resolve;const promise=new Promise(done=>resolve=done);return{promise,resolve};};
function fixture(){
 const body=new Element(),notices=[],observers=[];let token='token',storedKey=btoa(String.fromCharCode(1,2));
 const CList={config:{flaskSiteUrl:'https://store.invalid'},keys:{USERNAME:'username',ACCESS_TOKEN:'access_token'},state:{username:'alice'},storage:{mode:'remote'},ui:{}};
 const document={body,getElementById:id=>body.querySelector('#'+id),createElement:tag=>new Element(tag)};
 const ctx=vm.createContext({window:{CList,crypto:{subtle:{exportKey:async(type,key)=>key}}},document,btoa,console:{error(){}},sessionStorage:{getItem:()=>storedKey},getSiteSpecificCookie:(url,key)=>key==='username'?'alice':token,
 deriveEncKey:async password=>Uint8Array.from(password==='correct'?[1,2]:[3,4]).buffer,
 showStatusMessage:text=>notices.push(text),showModal(root){document.getElementById('generic-modal')?.remove();const modal=new Element();modal.id='generic-modal';modal.contains=node=>{while(node){if(node===modal)return true;node=node.parentNode;}return false;};modal.appendChild(root);body.appendChild(modal);},
 MutationObserver:class{constructor(callback){this.callback=callback;observers.push(this);}observe(){this.active=true;}disconnect(){this.active=false;}}});
 for(const name of ['password-confirmation-workflow','password-confirmation-view','password-confirmation'])vm.runInContext(read(name),ctx);
 const open=(callback=()=>{},options={})=>{ctx.confirmWithPassword('Confirm <strong>this action</strong>',callback,options);return{modal:document.getElementById('generic-modal'),input:document.getElementById('confirm-pw-input'),ok:document.getElementById('confirm-pw-ok'),cancel:document.getElementById('confirm-pw-cancel'),error:document.getElementById('confirm-pw-error')};};
 return{ctx,CList,document,notices,open,token:value=>token=value,key:value=>storedKey=value,notify:()=>observers.filter(observer=>observer.active).forEach(observer=>observer.callback())};
}
test('password check workflow uses explicit crypto inputs without DOM or global session',async()=>{
 const ctx=vm.createContext({});vm.runInContext(read('password-confirmation-workflow'),ctx);const calls=[];
 assert.equal(await ctx.verifyPasswordSnapshot('secret',{username:'alice',storedKey:'expected'},{assertCurrent(){},derive:async(password,username)=>{calls.push([password,username]);return 'derived';},exportKey:async key=>key,encode:raw=>raw==='derived'?'expected':'wrong'}),true);
 assert.deepEqual(calls,[['secret','alice']]);assert.equal(await ctx.verifyPasswordSnapshot('anything',{username:null},{}),false);assert.equal('document' in ctx,false);
});
test('default verification supports rejection/explicit retry and dispatches only the verified captured password once',async()=>{
 const f=fixture(),calls=[],dialog=f.open(password=>calls.push(password));dialog.input.value='wrong';await dialog.ok.onclick();assert.equal(dialog.error.textContent,'Incorrect password.');assert.equal(dialog.ok.disabled,false);assert.deepEqual(calls,[]);
 const pending=gate();f.ctx.deriveEncKey=()=>pending.promise;dialog.input.value='correct';const first=dialog.ok.onclick();await dialog.ok.onclick();dialog.input.value='changed';pending.resolve(Uint8Array.from([1,2]).buffer);await first;
 assert.deepEqual(calls,['correct']);assert.equal(dialog.input.value,'');assert.equal(f.document.getElementById('generic-modal'),null);await dialog.ok.onclick();assert.equal(calls.length,1);assert.equal(JSON.stringify(f.CList.state.passwordConfirmation).includes('correct'),false);
});
test('Cancel and dialog replacement expire pending verification without closing a newer modal',async()=>{
 for(const change of ['cancel','replace','external']){
  const f=fixture(),pending=gate(),calls=[],dialog=f.open(password=>calls.push(password),{verify:()=>pending.promise});dialog.input.value='secret';const checking=dialog.ok.onclick();let newer;
  if(change==='cancel')dialog.cancel.onclick();if(change==='replace')newer=f.open();if(change==='external'){dialog.modal.remove();f.notify();}
  pending.resolve(true);await checking;assert.deepEqual(calls,[],change);assert.equal(dialog.input.value,'',change);if(newer){assert.equal(f.document.getElementById('generic-modal'),newer.modal);assert.equal(newer.ok.disabled,false);}
 }
});
test('session/server/storage/key/source changes expire verification and Cancel remains available',async()=>{
 for(const change of ['token','server','mode','key','source']){
  const f=fixture(),pending=gate(),calls=[];let source=true;const dialog=f.open(password=>calls.push(password),{verify:()=>pending.promise,isCurrent:()=>source});dialog.input.value='secret';const checking=dialog.ok.onclick();
  if(change==='token')f.token('other');if(change==='server')f.CList.config.flaskSiteUrl='https://other';if(change==='mode')f.CList.storage.mode='local';if(change==='key')f.key('other-key');if(change==='source')source=false;
  pending.resolve(true);await checking;assert.deepEqual(calls,[],change);assert.match(dialog.error.textContent,/changed/);assert.equal(dialog.input.value,'');dialog.cancel.onclick();assert.equal(f.document.getElementById('generic-modal'),null);
 }
});
test('verification exceptions are visible/retryable and failed confirmed actions are never dispatched twice',async()=>{
 const f=fixture();let attempt=0,actions=0;const dialog=f.open(async()=>{actions++;throw Error('Action failed');},{verify:async()=>{if(++attempt===1)throw Error('Verifier unavailable');return true;}});
 dialog.input.value='secret';await dialog.ok.onclick();assert.match(dialog.error.textContent,/Could not verify/);assert.equal(dialog.ok.disabled,false);await dialog.ok.onclick();assert.equal(actions,1);assert.equal(f.notices.length,1);assert.equal(f.CList.state.passwordConfirmation.phase,'action-failed');await dialog.ok.onclick();assert.equal(actions,1);
});
test('custom import verifier retains label/style/HTML contract and Enter shares the duplicate guard',async()=>{
 const f=fixture(),pending=gate(),calls=[];f.token(null);const dialog=f.open(password=>calls.push(password),{confirmLabel:'Import',confirmClass:'kv-save-btn',verify:()=>pending.promise});
 assert.equal(dialog.ok.textContent,'Import');assert.match(dialog.ok.className,/kv-save-btn/);assert.ok(dialog.modal.querySelector('strong'));
 dialog.input.value='import-password';const checking=dialog.input.listeners.keydown({key:'Enter',preventDefault(){}});await dialog.ok.onclick();pending.resolve(true);await checking;assert.deepEqual(calls,['import-password']);assert.equal(JSON.stringify(f.CList.state.passwordConfirmation).includes('import-password'),false);
});
test('standalone verifyPassword retains the existing current-session crypto contract',async()=>{
 const f=fixture();assert.equal(await f.ctx.verifyPassword('correct'),true);assert.equal(await f.ctx.verifyPassword('wrong'),false);
});


test('confirmation exposes owned-dialog handle and notifies cancellation exactly once',()=>{
 const f=fixture();let cancelled=0;const handle=f.ctx.confirmWithPassword('Confirm',()=>{},{onCancel:()=>cancelled++});assert.equal(handle.isOpen(),true);handle.cancel();handle.cancel();f.notify();assert.equal(handle.isOpen(),false);assert.equal(cancelled,1);
});
