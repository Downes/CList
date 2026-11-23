const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {Element}=require('./helpers/account-fixture.cjs');const source=name=>fs.readFileSync('js/'+name+'.js','utf8');
const gate=()=>{let resolve;const promise=new Promise(done=>resolve=done);return{promise,resolve};};
const key=x=>({kty:'OKP',crv:'Ed25519',x}),documentFor=x=>({verificationMethod:[{publicKeyJwk:key(x)}],service:[{type:'KVStore',id:'server'},{type:'SocialWebAccount',id:'keep',extension:{x:1}}],alsoKnownAs:['did:key:'+x,'https://profile.invalid']});
function fixture(){
 let token='token',local=false,stored={value:'OLD'},doc=documentFor('OLD');const generated=[],updates=[],puts=[],dialogs=[],hooks=[];
 const CList={config:{flaskSiteUrl:'https://store.invalid'},keys:{ACCESS_TOKEN:'access_token',DID_IDENTITY_KEY:'_did_identity_key'},state:{username:'alice',identityDisplay:{accounts:{phase:'ready'}}},ui:{},isLocalMode:()=>local,storage:{get mode(){return local?'local':'remote';},kv:{get:async()=>stored,update:async(name,value)=>{updates.push(value);stored={value};}}}};
 const ctx=vm.createContext({window:{CList},document:{createElement:tag=>new Element(tag)},console:{error(){}},getSiteSpecificCookie:()=>token,getEncKey:async()=> 'key',
 generateIdentityKeyPair:async()=>{generated.push(true);return{keyPair:{privateKey:'PRIVATE'},didKey:'did:key:NEW',publicKeyJwk:key('NEW')};},encryptIdentityPrivateKey:async()=> 'NEW',
 fetch:async(url,options={})=>{if(options.method==='PUT'){const body=JSON.parse(options.body);puts.push({url,options,body});doc={verificationMethod:[{publicKeyJwk:body.publicKeyJwk}],service:body.service,alsoKnownAs:[body.didKey,...body.alsoKnownAs]};return{ok:true,json:async()=>({})};}return{ok:true,json:async()=>structuredClone(doc)};},
 confirmWithPassword(message,confirm,options){const dialog={open:true,message,options,async approve(){if(!this.open||!options.isCurrent())return;this.open=false;return confirm('password');},cancel(){if(this.open){this.open=false;options.onCancel();}},isOpen(){return this.open;}};dialogs.push(dialog);return dialog;},refreshCollabRegistrations:async()=>[]});
 for(const name of ['did-identity','did-publication-workflow','did-rotation-workflow','did-rotation-view','did-rotation'])vm.runInContext(source(name),ctx);
 const open=()=>{const root=new Element();for(const id of ['did-btn','did-status']){const node=new Element(id==='did-btn'?'button':'div');node.id=id;root.appendChild(node);}const button=root.querySelector('#did-btn');let controller;controller=ctx.createDidKeyRotator(root,{onStart(){},onComplete(){hooks.push(root);button.onclick=controller.action();},refreshAccounts:async()=>{},refreshIdentity:async()=>hooks.push('refresh')});button.onclick=controller.action();return{root,button,controller};};
 return{ctx,CList,generated,updates,puts,dialogs,hooks,open,token:value=>token=value,local:value=>local=value,stored:value=>stored=value,doc:value=>doc=value,getDoc:()=>doc};
}
test('confirmed rotation preserves latest service extensions/aliases and old actions cannot rotate twice',async()=>{
 const f=fixture(),panel=f.open(),oldAction=panel.button.onclick;await oldAction();assert.equal(f.updates.length,0);assert.equal(f.dialogs.length,1);
 const doc=f.getDoc();doc.service.push({type:'Blog',id:'incoming'});doc.alsoKnownAs.push('https://incoming.invalid');await f.dialogs[0].approve();
 assert.equal(f.generated.length,1);assert.deepEqual(f.updates,['NEW']);assert.equal(f.puts.length,1);assert.deepEqual(f.puts[0].body.service,doc.service.filter(item=>item.type!=='KVStore'));assert.deepEqual(f.puts[0].body.alsoKnownAs,['https://profile.invalid','https://incoming.invalid']);assert.equal(JSON.stringify(f.puts[0].body).includes('PRIVATE'),false);assert.equal(f.CList.state.identityRotation.phase,'complete');
 await oldAction();await f.dialogs[0].approve();assert.equal(f.generated.length,1);await panel.button.onclick();assert.equal(f.dialogs.length,2);assert.equal(f.updates.length,1);f.dialogs[1].cancel();
});
test('Cancel prevents rotation and local rotation never reads or writes hosted DID data',async()=>{
 const f=fixture();f.local(true);f.ctx.fetch=()=>{throw Error('No hosted calls');};const panel=f.open();await panel.button.onclick();f.dialogs[0].cancel();assert.equal(f.generated.length,0);assert.equal(f.CList.state.identityRotation.phase,'idle');await panel.button.onclick();await f.dialogs[1].approve();assert.deepEqual(f.updates,['NEW']);assert.equal(f.puts.length,0);assert.match(panel.root.textContent,/Stored locally only/);
});
test('changed confirmed target/public key and unavailable metadata stop before generating or storing',async()=>{
 for(const change of ['stored','public','metadata']){
  const f=fixture(),panel=f.open();if(change==='metadata')f.ctx.fetch=async()=>({ok:false,status:503});await panel.button.onclick();
  if(change==='metadata'){assert.equal(f.dialogs.length,0);}else{if(change==='stored')f.stored({value:'OTHER'});else f.doc(documentFor('OTHER'));await f.dialogs[0].approve();}
  assert.equal(f.generated.length,0,change);assert.equal(f.updates.length,0,change);assert.equal(f.puts.length,0,change);
 }
});
test('uncertain key update requires read-only reconciliation and never generates another key',async()=>{
 for(const accepted of [true,false]){
  const f=fixture();f.CList.storage.kv.update=async(name,value)=>{f.updates.push(value);if(accepted)f.stored({value});throw Error('Lost response');};const panel=f.open();await panel.button.onclick();await f.dialogs[0].approve();assert.equal(panel.button.textContent,'Check stored key');await panel.button.onclick();assert.equal(f.generated.length,1);assert.equal(f.updates.length,1);assert.equal(f.puts.length,0);
  if(accepted){assert.equal(panel.button.textContent,'Continue publication');await panel.button.onclick();assert.equal(f.puts.length,1);}else{assert.equal(panel.button.textContent,'Retry regeneration');await panel.button.onclick();assert.equal(f.dialogs.length,2);}
 }
});
test('unknown publication is checked without replay; a missing new publication needs explicit continuation',async()=>{
 for(const accepted of [true,false]){
  const f=fixture();let puts=0;f.ctx.fetch=async(url,options={})=>{if(options.method==='PUT'){puts++;if(puts===1){if(accepted)f.doc(documentFor('NEW'));throw Error('Response lost');}f.doc(documentFor('NEW'));return{ok:true,json:async()=>({})};}return{ok:true,json:async()=>structuredClone(f.getDoc())};};const panel=f.open();await panel.button.onclick();await f.dialogs[0].approve();assert.equal(panel.button.textContent,'Check publication');await panel.button.onclick();assert.equal(puts,1);
  if(!accepted){assert.equal(panel.button.textContent,'Continue publication');await panel.button.onclick();assert.equal(puts,2);}assert.equal(f.generated.length,1);assert.equal(f.updates.length,1);assert.equal(f.CList.state.identityRotation.phase,'complete');
 }
});
test('accepted key update survives panel rebuild while old completion cannot publish under the new panel',async()=>{
 const f=fixture(),pending=gate();f.CList.storage.kv.update=async(name,value)=>{f.updates.push(value);f.stored({value});return pending.promise;};const old=f.open();await old.button.onclick();const running=f.dialogs[0].approve();await new Promise(resolve=>setImmediate(resolve));const newer=f.open();await newer.button.onclick();assert.equal(f.dialogs.length,1);pending.resolve();await running;assert.equal(f.puts.length,0);await newer.button.onclick();assert.equal(newer.button.textContent,'Continue publication');await newer.button.onclick();assert.equal(f.generated.length,1);assert.equal(f.puts.length,1);assert.equal(f.hooks.includes(old.root),false);assert.ok(f.hooks.includes(newer.root));
});
test('session/server/mode changes during crypto prevent writes and private data stays out of summaries',async()=>{
 for(const change of ['token','server','mode']){
  const f=fixture(),pending=gate();f.ctx.encryptIdentityPrivateKey=()=>pending.promise;const panel=f.open();await panel.button.onclick();const running=f.dialogs[0].approve();await new Promise(resolve=>setImmediate(resolve));if(change==='token')f.token('other');if(change==='server')f.CList.config.flaskSiteUrl='https://other';if(change==='mode')f.local(true);pending.resolve('NEW');await running;assert.equal(f.updates.length,0,change);assert.equal(f.puts.length,0,change);assert.equal(JSON.stringify(f.CList.state.identityRotation).includes('PRIVATE'),false);
 }
});
