const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {Element}=require('./helpers/account-fixture.cjs');const source=name=>fs.readFileSync('js/'+name+'.js','utf8');
const gate=()=>{let resolve;const promise=new Promise(done=>resolve=done);return{promise,resolve};};
const publicKey={kty:'OKP',crv:'Ed25519',x:'PUBLIC'},didKey='did:key:PUBLIC';
const doc=()=>({alsoKnownAs:[didKey],verificationMethod:[{publicKeyJwk:publicKey}]});
function fixture(){
 let token='fixture-token',stored={value:'CIPHER'},published=null;const requests=[],hooks=[];
 const CList={config:{flaskSiteUrl:'https://store.invalid'},keys:{ACCESS_TOKEN:'access_token',DID_IDENTITY_KEY:'_did_identity_key'},state:{username:'alice',identityDisplay:{accounts:{phase:'ready'}}},ui:{},storage:{mode:'remote',kv:{get:async()=>stored}},isLocalMode:()=>false};
 const ctx=vm.createContext({window:{CList},document:{createElement:tag=>new Element(tag)},console:{error(){}},AbortController,
  getSiteSpecificCookie:()=>token,getEncKey:async()=> 'key',derivePublicKeyJwkAndDidKey:async()=>({publicKeyJwk:publicKey,didKey,privateKey:'PRIVATE'}),
  fetch:async(url,options={})=>{requests.push({url,options});if(options.method==='PUT'){published=doc();return{ok:true,json:async()=>({didKey})};}return published?{ok:true,json:async()=>published}:{ok:false,status:404};},refreshCollabRegistrations:async()=>[]});
 for(const name of ['did-identity','did-publication-workflow','did-publication-view','did-publication'])vm.runInContext(source(name),ctx);
 const open=()=>{const root=new Element();for(const id of ['did-btn','did-status']){const node=new Element(id==='did-btn'?'button':'div');node.id=id;root.appendChild(node);}const controller=ctx.createDidExistingPublisher(root,{onStart:()=>hooks.push('start'),onPublished:()=>hooks.push('published'),refreshAccounts:async()=>hooks.push('refresh')});return{root,controller,button:root.querySelector('#did-btn')};};
 return{ctx,CList,requests,hooks,open,token:value=>token=value,stored:value=>stored=value,published:value=>published=value};
}
test('existing-key publication sends only captured public material and retains accepted receipt across refresh failures',async()=>{
 const f=fixture();f.ctx.refreshCollabRegistrations=async()=>['failed-server'];const panel=f.open();await panel.controller.publish();
 const put=f.requests.find(request=>request.options.method==='PUT');assert.equal(put.url,'https://store.invalid/auth/did');assert.equal(put.options.headers.Authorization,'Bearer fixture-token');
 assert.deepEqual(JSON.parse(put.options.body),{publicKeyJwk:publicKey,didKey,service:[],alsoKnownAs:[]});assert.equal(put.options.body.includes('PRIVATE'),false);assert.match(panel.root.textContent,/DID published/);assert.match(panel.root.textContent,/collaboration registrations/);
 assert.equal(f.CList.state.identityPublication.phase,'confirmed');await panel.controller.publish();assert.equal(f.requests.filter(request=>request.options.method==='PUT').length,1);assert.equal(JSON.stringify(f.CList.state.identityPublication).includes('fixture-token'),false);
});
test('preflight matches the actual public key and preserves existing documents without PUT; conflicting DID is rejected',async()=>{
 for(const match of [true,false]){
  const f=fixture();f.published(match?doc():{alsoKnownAs:[didKey],verificationMethod:[{publicKeyJwk:{...publicKey,x:'OTHER'}}]});const panel=f.open();await panel.controller.publish();
  assert.equal(f.requests.filter(request=>request.options.method==='PUT').length,0);assert.match(panel.root.textContent,match?/already published/:/different identity/);
 }
});
test('uncertain publication is checked without replaying an accepted PUT',async()=>{
 const f=fixture();let puts=0;f.ctx.fetch=async(url,options={})=>{if(options.method==='PUT'){puts++;throw Error('Response lost');}return puts?{ok:true,json:async()=>doc()}:{ok:false,status:404};};
 const panel=f.open();await panel.controller.publish();assert.equal(f.CList.state.identityPublication.phase,'uncertain');assert.equal(panel.button.textContent,'Check publication');assert.equal(puts,1);
 await panel.button.onclick();assert.equal(puts,1);assert.equal(f.CList.state.identityPublication.phase,'confirmed');assert.match(panel.root.textContent,/already published/);
});
test('a missing publication after uncertainty needs a separate explicit retry',async()=>{
 const f=fixture();let puts=0;f.ctx.fetch=async(url,options={})=>{if(options.method==='PUT'){puts++;if(puts===1)throw Error('Lost');return{ok:true,json:async()=>({})};}return{ok:false,status:404};};
 const panel=f.open();await panel.controller.publish();await panel.button.onclick();assert.equal(puts,1);assert.equal(panel.button.textContent,'Retry publication');await panel.button.onclick();assert.equal(puts,2);
});
test('key/session/panel changes during preparation prevent publication and old completion cannot update a newer panel',async()=>{
 for(const change of ['key','token','server','panel']){
  const f=fixture(),pending=gate();f.ctx.derivePublicKeyJwkAndDidKey=()=>pending.promise;const panel=f.open(),running=panel.controller.publish();await new Promise(resolve=>setImmediate(resolve));
  if(change==='key')f.stored({value:'NEW'});if(change==='token')f.token('new-token');if(change==='server')f.CList.config.flaskSiteUrl='https://other.invalid';if(change==='panel')f.open();
  pending.resolve({publicKeyJwk:publicKey,didKey});await running;assert.equal(f.requests.filter(request=>request.options.method==='PUT').length,0,change);assert.equal(f.hooks.includes('published'),false,change);
 }
});
test('duplicate and rebuilt-panel clicks stay locked while a PUT is pending',async()=>{
 const f=fixture(),pending=gate();let puts=0;f.ctx.fetch=async(url,options={})=>{if(options.method==='PUT'){puts++;return pending.promise;}return{ok:false,status:404};};
 const panel=f.open(),running=panel.controller.publish();await new Promise(resolve=>setImmediate(resolve));await panel.controller.publish();const replacement=f.open();await replacement.controller.publish();assert.equal(puts,1);
 pending.resolve({ok:true,json:async()=>({didKey})});await running;assert.equal(f.hooks.includes('published'),false);assert.equal(replacement.root.textContent.includes('DID published.'),false);
});
test('accepted HTTP with unreadable body remains confirmed and cannot repeat the PUT',async()=>{
 const f=fixture();let puts=0;f.ctx.fetch=async(url,options={})=>options.method==='PUT'?(puts++,{ok:true,json:async()=>{throw Error('Invalid JSON');}}):{ok:false,status:404};const panel=f.open();await panel.controller.publish();
 assert.equal(f.CList.state.identityPublication.phase,'confirmed');assert.match(panel.root.textContent,/accepted publication/);await panel.controller.publish();assert.equal(puts,1);
});


test('publication workflow runs without DOM and rejects local accounts before any transport',async()=>{
 const ctx=vm.createContext({});vm.runInContext(source('did-publication-workflow'),ctx);let requested=false;
 await assert.rejects(ctx.publishStoredDid({local:true},{assertCurrent(){},fetch:async()=>{requested=true;}}),/local account/);assert.equal(requested,false);assert.equal('document' in ctx,false);
});


test('existing collaboration refresh reports rejected/network destinations with captured authorization',async()=>{
 const f=fixture();f.ctx.console.warn=()=>{};f.ctx.parseAccountValue=record=>JSON.parse(record.value);
 f.CList.accounts=['ok','rejected','offline'].map(name=>({value:JSON.stringify({type:'Collab',instance:'wss://'+name+'.invalid'})}));
 const sent=[];f.ctx.fetch=async(url,options)=>{sent.push({url,options});if(url.includes('offline'))throw Error('Offline');return {ok:!url.includes('rejected'),status:503};};
 const sourceText=source('kvstore'),start=sourceText.indexOf('window.refreshCollabRegistrations = async function()'),end=sourceText.indexOf('// =============================================================================',start);
 vm.runInContext(sourceText.slice(start,end),f.ctx);const pending=f.ctx.window.refreshCollabRegistrations();f.token('new-token');const failures=await pending;
 assert.deepEqual(Array.from(failures),['https://rejected.invalid','https://offline.invalid']);assert.equal(sent.every(request=>request.options.headers.Authorization==='Bearer fixture-token'),true);
});


test('automatic generation publication cannot publish a different subsequently stored key',async()=>{
 const f=fixture(),panel=f.open();await panel.controller.publish('did:key:EXPECTED');assert.equal(f.requests.length,0);assert.match(panel.root.textContent,/stored identity key changed/);
});
