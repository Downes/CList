const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {Element}=require('./helpers/account-fixture.cjs');
const read=name=>fs.readFileSync('js/'+name+'.js','utf8');
const gate=()=>{let resolve;const promise=new Promise(done=>resolve=done);return{promise,resolve};};
function fixture(){
 let token='fixture-token',local=false,identityKey=null,records=[];const requests=[],states=[];
 const CList={config:{flaskSiteUrl:'https://store.invalid'},keys:{ACCESS_TOKEN:'access_token',DID_IDENTITY_KEY:'_did_identity_key'},state:{username:'alice'},schemas:{},ui:{},isLocalMode:()=>local,storage:{get mode(){return local?'local':'remote';},kv:{get:async()=>identityKey,list:async()=>records}}};
 const ctx=vm.createContext({window:{CList},document:{createElement:tag=>new Element(tag)},console:{error(){}},AbortController,history:{back(){}},
 getSiteSpecificCookie:()=>token,getEncKey:async()=> 'fixture-key',decryptWithKey:async(key,value)=>value,derivePublicKeyJwkAndDidKey:async()=>({didKey:'did:key:local',privateKey:'never-display'}),
 fetch:async(url,options)=>{requests.push({url,options});return{ok:true,json:async()=>({id:'did:web:store.invalid:users:alice',alsoKnownAs:['did:key:public']})};}});
 for(const name of ['did-identity-workflow','did-identity-view','did-identity','did-proof-workflow','did-proof-view','did-proof','did-publication-workflow','did-publication-view','did-publication','did-generation-workflow','did-generation-view','did-generation','did-rotation-workflow','did-rotation-view','did-rotation','did-removal-workflow','did-removal-view','did-removal','did-update-workflow','did-update-view','did-update','migration-preparation-workflow','migration-preparation-view','migration-preparation','migration-identity-workflow','migration-execution-workflow','migration-execution-view','migration-execution'])vm.runInContext(read(name),ctx);
 const root=()=>{const root=new Element();for(const id of ['did-status','account-list','did-regen-help','did-remove-help','prove-identity-section','migrate-section','public-accounts-section']){const node=new Element();node.id=id;node.removeAttribute=name=>delete node[name];root.appendChild(node);}return root;};
 const open=()=>{const node=root(),controller=ctx.createDidIdentityRead(node,{onState:(...args)=>states.push(args)});return{root:node,controller};};
 return{ctx,CList,requests,states,open,token:value=>token=value,local:value=>local=value,key:value=>identityKey=value,records:value=>records=value};
}
test('identity display workflows take explicit read dependencies without DOM and distinguish local/404/HTTP failures',async()=>{
 const ctx=vm.createContext({});vm.runInContext(read('did-identity-workflow'),ctx);const deps={assertCurrent(){},getIdentityKey:async()=>null,fetch:async()=>({ok:false,status:404})};
 assert.equal((await ctx.readDidIdentity({local:true},deps)).kind,'missing');
 assert.equal((await ctx.readDidIdentity({local:false,storeUrl:'https://store',username:'a/b'},deps)).kind,'missing');
 deps.getIdentityKey=async()=>({value:'encrypted'});assert.equal((await ctx.readDidIdentity({local:false,storeUrl:'https://store',username:'alice'},deps)).kind,'unpublished');
 deps.fetch=async()=>({ok:false,status:503});await assert.rejects(ctx.readDidIdentity({local:false,storeUrl:'https://store',username:'alice'},deps),/503/);assert.equal('document' in ctx,false);
});
test('published identity and public account metadata render as text without exposing credentials',async()=>{
 const f=fixture();f.records([{key:'social:<unsafe>',value:JSON.stringify({type:'Mastodon',title:'<img src=x>',public:true,id:'secret'})},{key:'_private',value:'hidden'},{key:'broken',value:'invalid'}]);
 f.ctx.fetch=async()=>({ok:true,json:async()=>({id:'<script>identity</script>'})});const panel=f.open();await panel.controller.start();
 assert.match(panel.root.querySelector('#did-status').textContent,/<script>identity/);assert.equal(panel.root.querySelector('script'),null);assert.equal(panel.root.querySelector('img'),null);
 const checkbox=panel.root.querySelector('input');assert.equal(checkbox.dataset.key,'social:<unsafe>');assert.equal(checkbox.checked,true);assert.match(panel.root.textContent,/unreadable account/);
 assert.equal(panel.root.textContent.includes('secret'),false);assert.equal(JSON.stringify(f.CList.state.identityDisplay).includes('fixture-token'),false);assert.deepEqual(f.states,[[true,'generate']]);
});
test('local identity derives only public display data and never reads hosted accounts or network',async()=>{
 const f=fixture();f.local(true);f.key({value:'ciphertext'});f.ctx.fetch=()=>{throw Error('No hosted reads');};f.CList.storage.kv.list=()=>{throw Error('No local public listing');};
 const panel=f.open();await panel.controller.start();assert.match(panel.root.textContent,/did:key:local/);assert.equal(panel.root.textContent.includes('never-display'),false);assert.equal(f.CList.state.identityDisplay.accounts.phase,'idle');
});
test('identity and account lanes reject session/server/mode/panel changes during reads',async()=>{
 for(const change of ['token','username','server','local','panel','closed']){
  const f=fixture(),pending=gate();f.ctx.fetch=()=>pending.promise;f.ctx.getEncKey=()=>pending.promise.then(()=> 'key');f.records([{key:'account',value:JSON.stringify({type:'Mastodon',title:'Old account'})}]);const panel=f.open(),running=panel.controller.start();await new Promise(resolve=>setImmediate(resolve));
  if(change==='token')f.token('other');if(change==='username')f.CList.state.username='bob';if(change==='server')f.CList.config.flaskSiteUrl='https://other';if(change==='local')f.local(true);if(change==='panel')f.open();if(change==='closed')panel.root.isConnected=false;
  pending.resolve({ok:true,json:async()=>({id:'Stale identity'})});await running;assert.equal(panel.root.textContent.includes('Stale identity'),false,change);assert.equal(panel.root.textContent.includes('Old account'),false,change);assert.equal(f.states.length,0,change);
 }
});
test('current failures show retry and expired retry callbacks cannot start newer requests',async()=>{
 const f=fixture();f.ctx.fetch=async()=>({ok:false,status:500});const panel=f.open();await panel.controller.start();assert.match(panel.root.textContent,/500/);const retry=panel.root.querySelector('#did-status').querySelector('button');
 let calls=0;f.ctx.fetch=async()=>{calls++;return{ok:true,json:async()=>({id:'Recovered'})};};await retry.onclick();assert.match(panel.root.textContent,/Recovered/);assert.equal(panel.root.querySelector('#did-status').className,'me-status');await retry.onclick();assert.equal(calls,1);
});
test('new identity requests supersede previous reads independently of the account list lane',async()=>{
 const f=fixture(),pending=gate();let signal;f.ctx.fetch=(url,options)=>{signal=options.signal;return pending.promise;};const panel=f.open(),old=panel.controller.identity();
 f.ctx.fetch=async()=>({ok:true,json:async()=>({id:'New identity'})});await panel.controller.identity();assert.equal(signal.aborted,true);await panel.controller.accounts();
 pending.resolve({ok:true,json:async()=>({id:'Old identity'})});await old;assert.match(panel.root.textContent,/New identity/);assert.equal(panel.root.textContent.includes('Old identity'),false);
});
test('existing DID panel mounts extracted reads and retains checkbox/write compatibility without writes',async()=>{
 const f=fixture();f.records([{key:'account',value:JSON.stringify({type:'Bluesky',title:'Existing account',public:true})}]);
 const source=read('kvstore'),start=source.indexOf('function kvstoreDidPanel()'),end=source.indexOf('function playOptions()',start);vm.runInContext(source.slice(start,end),f.ctx);
 const root=f.ctx.kvstoreDidPanel();await new Promise(resolve=>setImmediate(resolve));assert.match(root.querySelector('#did-status').textContent,/did:web:/);
 assert.equal(root.querySelector('#did-btn').textContent,'Regenerate Key');assert.equal(root.querySelector('#public-accounts-section').style.display,'');assert.equal(root.querySelector('#account-list').querySelector('input').dataset.key,'account');assert.equal(typeof root.querySelector('#did-update-btn').onclick,'function');
});
