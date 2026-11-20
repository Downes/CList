const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {Element}=require('./helpers/account-fixture.cjs');const read=name=>fs.readFileSync('js/'+name+'.js','utf8');const gate=()=>{let resolve;const promise=new Promise(done=>resolve=done);return{promise,resolve};};
const documentFor=x=>({id:'did:web:store:users:alice',verificationMethod:[{publicKeyJwk:{kty:'OKP',crv:'Ed25519',x}}]});
function fixture(){
 let token='token',local=false,row={value:'KEY'},doc=documentFor('KEY');const removals=[],deletes=[],dialogs=[],completed=[];
 const CList={config:{flaskSiteUrl:'https://store.invalid'},keys:{ACCESS_TOKEN:'access_token',DID_IDENTITY_KEY:'_did_identity_key'},state:{username:'alice'},ui:{},storage:{get mode(){return local?'local':'remote';},kv:{get:async()=>row,remove:async key=>{removals.push(key);row=null;}}},isLocalMode:()=>local};
 const ctx=vm.createContext({window:{CList},document:{createElement:tag=>new Element(tag)},console:{error(){}},getSiteSpecificCookie:()=>token,fetch:async(url,options={})=>{if(options.method==='DELETE'){deletes.push({url,options});doc=null;return{ok:true};}return doc?{ok:true,json:async()=>structuredClone(doc)}:{ok:false,status:404};},
 confirmWithPassword(message,confirm,options){const dialog={open:true,isOpen(){return this.open;},cancel(){this.open=false;options.onCancel();},async approve(){if(!this.open||!options.isCurrent())return;this.open=false;return confirm();}};dialogs.push(dialog);return dialog;}});
 for(const name of ['did-identity','did-removal-workflow','did-removal-view','did-removal'])vm.runInContext(read(name),ctx);
 const open=(overrides={})=>{const root=new Element();for(const id of ['did-btn','did-remove-btn','did-status','did-update-btn','prove-identity-btn']){const el=new Element('button');el.id=id;root.appendChild(el);}const controller=ctx.createDidRemover(root,{onStart(){},onComplete:()=>completed.push(root),refreshIdentity:async()=>{},...overrides});const button=root.querySelector('#did-remove-btn');button.onclick=controller.request;return{root,button,controller};};
 return{ctx,CList,removals,deletes,dialogs,completed,open,token:value=>token=value,local:value=>local=value,row:value=>row=value,doc:value=>doc=value,getRow:()=>row,getDoc:()=>doc};
}
test('hosted removal waits for confirmation, captures targets/auth and never repeats accepted deletion',async()=>{
 const f=fixture(),panel=f.open();await panel.button.onclick();await panel.button.onclick();assert.equal(f.dialogs.length,1);assert.equal(f.removals.length,0);await f.dialogs[0].approve();assert.deepEqual(f.removals,['_did_identity_key']);assert.equal(f.deletes.length,1);assert.equal(f.deletes[0].url,'https://store.invalid/auth/did');assert.equal(f.deletes[0].options.headers.Authorization,'Bearer token');assert.equal(f.CList.state.identityRemoval.phase,'complete');await panel.controller.request();await f.dialogs[0].approve();assert.equal(f.deletes.length,1);assert.equal(f.completed.length,1);
 const other=fixture(),broken=other.open({onComplete:()=>{throw Error('Refresh failed');}});await broken.button.onclick();await other.dialogs[0].approve();assert.equal(other.CList.state.identityRemoval.phase,'complete');assert.match(broken.root.textContent,/removal completed/);await broken.controller.request();assert.equal(other.removals.length,1);assert.equal(other.deletes.length,1);
});
test('Cancel leaves key/document intact; local removal has no hosted calls',async()=>{
 const f=fixture();f.local(true);f.ctx.fetch=()=>{throw Error('No hosted request');};const panel=f.open();await panel.button.onclick();f.dialogs[0].cancel();assert.equal(f.removals.length,0);assert.equal(f.CList.state.identityRemoval.phase,'idle');await panel.button.onclick();await f.dialogs[1].approve();assert.equal(f.removals.length,1);assert.equal(f.deletes.length,0);assert.equal(f.CList.state.identityRemoval.phase,'complete');
});
test('partial key failure does not report complete; retry only removes the remaining key',async()=>{
 const f=fixture();let fail=true;f.CList.storage.kv.remove=async key=>{f.removals.push(key);if(fail){const error=new Error('Delete endpoint not found');error.code='NotFound';throw error;}f.row(null);};const panel=f.open();await panel.button.onclick();await f.dialogs[0].approve();assert.equal(f.deletes.length,1);assert.equal(f.CList.state.identityRemoval.phase,'partial');assert.equal(f.completed.length,0);assert.match(panel.root.textContent,/Stored key removal/);
 await panel.button.onclick();assert.equal(f.removals.length,1);assert.equal(panel.button.textContent,'Retry remaining removal');fail=false;await panel.button.onclick();assert.equal(f.removals.length,2);assert.equal(f.deletes.length,1);assert.equal(f.CList.state.identityRemoval.phase,'complete');
});
test('uncertain public DELETE is checked without replay and pending steps require explicit retry',async()=>{
 for(const accepted of [true,false]){
  const f=fixture();let attempts=0;f.ctx.fetch=async(url,options={})=>{if(options.method==='DELETE'){attempts++;if(attempts===1){if(accepted)f.doc(null);throw Error('Lost');}f.doc(null);return{ok:true};}return f.getDoc()?{ok:true,json:async()=>structuredClone(f.getDoc())}:{ok:false,status:404};};const panel=f.open();await panel.button.onclick();await f.dialogs[0].approve();assert.equal(attempts,1);assert.equal(f.removals.length,1);await panel.button.onclick();assert.equal(attempts,1);
  if(!accepted){assert.equal(panel.button.textContent,'Retry remaining removal');await panel.button.onclick();assert.equal(attempts,2);}assert.equal(f.removals.length,1);assert.equal(f.CList.state.identityRemoval.phase,'complete');
 }
});
test('changed key/public identity/session/panel during confirmation cannot delete a new target',async()=>{
 for(const change of ['key','document','token','panel']){
  const f=fixture(),panel=f.open();await panel.button.onclick();if(change==='key')f.row({value:'NEW'});if(change==='document')f.doc(documentFor('NEW'));if(change==='token')f.token('other');if(change==='panel')f.open();await f.dialogs[0].approve();assert.equal(f.removals.length,0,change);assert.equal(f.deletes.length,0,change);
 }
});
test('accepted key removal survives panel rebuild; old completion cannot delete the public document',async()=>{
 const f=fixture(),pending=gate();f.CList.storage.kv.remove=async key=>{f.removals.push(key);f.row(null);return pending.promise;};const old=f.open();await old.button.onclick();const running=f.dialogs[0].approve();await new Promise(resolve=>setImmediate(resolve));const newer=f.open();await newer.button.onclick();pending.resolve();await running;assert.equal(f.deletes.length,0);await newer.button.onclick();assert.equal(newer.button.textContent,'Retry remaining removal');await newer.button.onclick();assert.equal(f.removals.length,1);assert.equal(f.deletes.length,1);assert.equal(f.completed.includes(old.root),false);assert.ok(f.completed.includes(newer.root));
});
test('removal and other migrated identity mutations wait for one another',async()=>{
 const f=fixture();let other=true;f.ctx.registerDidIdentityMutation('other',()=>other);const panel=f.open();await panel.button.onclick();assert.equal(f.dialogs.length,0);other=false;await panel.button.onclick();const pending=gate();f.CList.storage.kv.remove=()=>pending.promise;const running=f.dialogs[0].approve();await new Promise(resolve=>setImmediate(resolve));assert.equal(f.ctx.didIdentityMutationBusy(f.ctx.didIdentitySession(),['other']),true);f.row(null);pending.resolve();await running;assert.equal(f.ctx.didIdentityMutationBusy(f.ctx.didIdentitySession()),false);assert.equal(JSON.stringify(f.CList.state.identityRemoval).includes('KEY'),false);
});


test('legacy identity mutation dispatch blocks removal until completion without migrating its internals',async()=>{
 const f=fixture(),pending=gate(),running=f.ctx.runDidLegacyMutation(()=>pending.promise);const panel=f.open();await panel.button.onclick();assert.equal(f.dialogs.length,0);assert.equal(f.removals.length,0);pending.resolve();await running;await panel.button.onclick();assert.equal(f.dialogs.length,1);f.dialogs[0].cancel();
});


test('DELETE 404 counts as removed only when a fresh public read confirms absence',async()=>{
 for(const gone of [true,false]){
  const f=fixture();f.ctx.fetch=async(url,options={})=>{if(options.method==='DELETE'){if(gone)f.doc(null);return{ok:false,status:404};}return f.getDoc()?{ok:true,json:async()=>structuredClone(f.getDoc())}:{ok:false,status:404};};const panel=f.open();await panel.button.onclick();await f.dialogs[0].approve();assert.equal(f.CList.state.identityRemoval.phase,gone?'complete':'partial');
 }
});
