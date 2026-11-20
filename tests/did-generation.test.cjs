const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {Element}=require('./helpers/account-fixture.cjs');const source=name=>fs.readFileSync('js/'+name+'.js','utf8');
const gate=()=>{let resolve;const promise=new Promise(done=>resolve=done);return{promise,resolve};};
function fixture(){
 let token='token',local=false,stored=null;const adds=[],generated=[],hooks=[];
 const CList={config:{flaskSiteUrl:'https://store.invalid'},keys:{ACCESS_TOKEN:'access_token',DID_IDENTITY_KEY:'_did_identity_key'},state:{username:'alice'},ui:{},storage:{get mode(){return local?'local':'remote';},kv:{get:async()=>stored,add:async(key,value)=>{adds.push({key,value});stored={value};}}},isLocalMode:()=>local};
 const ctx=vm.createContext({window:{CList},document:{createElement:tag=>new Element(tag)},console:{error(){}},getSiteSpecificCookie:()=>token,getEncKey:async()=> 'session-key',
 derivePublicKeyJwkAndDidKey:async(value)=>({didKey:'did:key:'+value}),generateIdentityKeyPair:async()=>{generated.push(true);return{keyPair:{privateKey:'PRIVATE'},didKey:'did:key:NEW'};},encryptIdentityPrivateKey:async(key,enc)=>{assert.equal(key,'PRIVATE');assert.equal(enc,'session-key');return 'SEALED';}});
 for(const name of ['did-identity','did-generation-workflow','did-generation-view','did-generation'])vm.runInContext(source(name),ctx);
 const open=(overrides={})=>{const root=new Element();for(const id of ['did-btn','did-status']){const node=new Element(id==='did-btn'?'button':'div');node.id=id;root.appendChild(node);}const controller=ctx.createDidFirstGenerator(root,{onStart:()=>hooks.push('start'),onStored:local=>hooks.push(['stored',local]),publishStored:async expected=>{hooks.push('publish');hooks.push(['expected',expected]);},refreshIdentity:async()=>hooks.push('refresh'),...overrides});return{root,controller,button:root.querySelector('#did-btn')};};
 return{ctx,CList,adds,generated,hooks,open,token:value=>token=value,local:value=>local=value,stored:value=>stored=value};
}
test('first-time creation stores only encrypted key once and reuses existing publication; retained action cannot regenerate',async()=>{
 const f=fixture(),panel=f.open();await panel.controller.generate();assert.deepEqual(f.adds,[{key:'_did_identity_key',value:'SEALED'}]);assert.equal(f.generated.length,1);assert.ok(f.hooks.includes('publish'));assert.ok(f.hooks.some(value=>Array.isArray(value)&&value[0]==='expected'&&value[1]==='did:key:NEW'));assert.equal(f.CList.state.identityGeneration.phase,'stored');
 await panel.controller.generate();assert.equal(f.generated.length,1);assert.equal(JSON.stringify(f.CList.state.identityGeneration).includes('PRIVATE'),false);
});
test('local creation avoids publication and existing keys are preserved without generation or writes',async()=>{
 const f=fixture();f.local(true);const local=f.open();await local.controller.generate();assert.equal(f.hooks.includes('publish'),false);assert.match(local.root.textContent,/Stored locally only/);
 const other=fixture();other.stored({value:'EXISTING'});const panel=other.open();await panel.controller.generate();assert.equal(other.generated.length,0);assert.equal(other.adds.length,0);assert.match(panel.root.textContent,/Existing identity key preserved/);
});
test('add-if-absent conflict preserves concurrent identity and never falls back to overwrite',async()=>{
 const f=fixture();let attempts=0;f.CList.storage.kv.add=async()=>{attempts++;f.stored({value:'CONCURRENT'});const error=new Error('Exists');error.code='AlreadyExists';throw error;};const panel=f.open();await panel.controller.generate();
 assert.equal(attempts,1);assert.match(panel.root.textContent,/did:key:CONCURRENT/);assert.equal(f.CList.state.identityGeneration.phase,'stored');
});
test('uncertain storage is read-checked without generating again; missing key requires separate retry',async()=>{
 for(const accepted of [true,false]){
  const f=fixture();let attempts=0;f.CList.storage.kv.add=async(key,value)=>{attempts++;if(accepted)f.stored({value});throw Error('Response lost');};const panel=f.open();await panel.controller.generate();assert.equal(panel.button.textContent,'Check stored identity');
  await panel.button.onclick();assert.equal(attempts,1);assert.equal(f.generated.length,1);
  if(accepted){assert.equal(f.CList.state.identityGeneration.phase,'stored');assert.ok(f.hooks.includes('publish'));}
  else{assert.equal(panel.button.textContent,'Retry generation');assert.equal(f.hooks.includes('publish'),false);}
 }
});
test('session/mode/panel changes during generation prevent storing or publishing',async()=>{
 for(const change of ['token','server','local','panel','closed']){
  const f=fixture(),pending=gate();f.ctx.generateIdentityKeyPair=()=>pending.promise;const panel=f.open(),running=panel.controller.generate();await new Promise(resolve=>setImmediate(resolve));
  if(change==='token')f.token('other');if(change==='server')f.CList.config.flaskSiteUrl='https://other';if(change==='local')f.local(true);if(change==='panel')f.open();if(change==='closed')panel.root.isConnected=false;
  pending.resolve({keyPair:{privateKey:'PRIVATE'},didKey:'did:key:NEW'});await running;assert.equal(f.adds.length,0,change);assert.equal(f.hooks.includes('publish'),false,change);
 }
});
test('duplicate/rebuilt-panel creation stays locked and post-store failure never creates another key',async()=>{
 const f=fixture(),pending=gate();f.ctx.encryptIdentityPrivateKey=()=>pending.promise;const panel=f.open(),running=panel.controller.generate();await new Promise(resolve=>setImmediate(resolve));await panel.controller.generate();const rebuilt=f.open();await rebuilt.controller.generate();assert.equal(f.generated.length,1);pending.resolve('SEALED');await running;assert.equal(f.adds.length,0);
 const other=fixture(),failed=other.open({publishStored:async()=>{throw Error('Follow-up failed');}});await failed.controller.generate();assert.equal(other.CList.state.identityGeneration.phase,'stored');assert.match(failed.root.textContent,/was stored/);await failed.controller.generate();assert.equal(other.generated.length,1);await failed.button.onclick();assert.ok(other.hooks.includes('refresh'));
});
test('workflow existing-key inspection has explicit dependencies and no DOM',async()=>{
 const ctx=vm.createContext({});vm.runInContext(source('did-generation-workflow'),ctx);const result=await ctx.generateFirstDid({token:'token',username:'alice'},{assertCurrent(){},getIdentityKey:async()=>({value:'encrypted'}),getKey:async()=> 'key',derive:async()=>({didKey:'did:key:existing'})});assert.equal(result.existing,true);assert.equal(result.didKey,'did:key:existing');assert.equal('document' in ctx,false);
});
