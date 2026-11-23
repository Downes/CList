const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {Element}=require('./helpers/account-fixture.cjs');const source=name=>fs.readFileSync('js/'+name+'.js','utf8');
const deferred=()=>{let resolve;const promise=new Promise(done=>resolve=done);return{promise,resolve};};
function fixture(){
 let token='fixture-token',local=false;const calls=[],requests=[];const CList={config:{flaskSiteUrl:'https://store.invalid'},keys:{ACCESS_TOKEN:'access_token',DID_IDENTITY_KEY:'_did_identity_key'},state:{username:'alice'},ui:{},storage:{get mode(){return local?'local':'remote';},kv:{get:async key=>{calls.push(['get',key]);return {value:'encrypted'};}}},isLocalMode:()=>local};
 const ctx=vm.createContext({window:{CList},document:{createElement:tag=>new Element(tag)},console:{error(){}},URL,AbortController,
  getSiteSpecificCookie:()=>token,getEncKey:async()=> 'key',decryptIdentityPrivateKey:async()=> 'PRIVATE',signWithIdentityKey:async(key,challenge)=>{calls.push(['sign',key,challenge]);return 'SIGNATURE';},
  verifyIdentitySignature:async(key,challenge,signature)=>{calls.push(['verify',key,challenge,signature]);return true;},
  fetch:async(url,options)=>{requests.push({url,options});return{ok:true,json:async()=>({verificationMethod:[{publicKeyJwk:{kty:'EC'}}],alsoKnownAs:['did:key:other']})};}});
 for(const name of ['did-identity','did-proof-workflow','did-proof-view','did-proof'])vm.runInContext(source(name),ctx);
 const open=()=>{const root=new Element();for(const id of ['prove-other-url','prove-other-username','prove-identity-btn','prove-identity-result']){const node=new Element(id.includes('btn')?'button':'div');node.id=id;node.value=id==='prove-other-url'?'https://other.invalid':id==='prove-other-username'?'Bob':'';root.appendChild(node);}const control=ctx.bindDidIdentityProof(root);return{root,control,button:root.querySelector('#prove-identity-btn'),result:root.querySelector('#prove-identity-result'),edit:()=>root.querySelector('#prove-other-url').oninput()};};
 return{ctx,CList,calls,requests,open,token:value=>token=value,local:value=>local=value};
}
test('proof workflow uses explicit dependencies, encodes targets and verifies the same local challenge/signature',async()=>{
 const ctx=vm.createContext({URL});vm.runInContext(source('did-proof-workflow'),ctx);const stages=[],calls=[];
 const target=ctx.didProofTarget('https://other.invalid/',' A/B ');assert.equal(target.username,'a/b');
 const result=await ctx.runDidIdentityProof(target,{assertCurrent(){},progress:phase=>stages.push(phase),fetch:async url=>{calls.push(url);return{ok:true,json:async()=>({verificationMethod:[{publicKeyJwk:{kty:'EC'}}],alsoKnownAs:['did:key:public']})};},getKey:async()=> 'key',getIdentityKey:async()=>({value:'encrypted'}),decrypt:async()=> 'PRIVATE',challenge:()=> 'challenge',sign:async(key,challenge)=>{assert.equal(key,'PRIVATE');assert.equal(challenge,'challenge');return 'SIGNATURE';},verify:async(key,challenge,signature)=>{assert.equal(key.kty,'EC');assert.equal(challenge,'challenge');assert.equal(signature,'SIGNATURE');return false;}});
 assert.equal(calls[0],'https://other.invalid/users/a%2Fb/did.json');assert.equal(result.verified,false);assert.equal(JSON.stringify(result).includes('PRIVATE'),false);assert.deepEqual(stages,['fetching','signing','verifying']);assert.equal('document' in ctx,false);
});
test('proof controller shows safe results, restores controls and excludes secrets from summary',async()=>{
 const f=fixture(),panel=f.open();f.ctx.fetch=async()=>({ok:true,json:async()=>({verificationMethod:[{publicKeyJwk:{}}],alsoKnownAs:['did:key:<img src=x>']})});await panel.button.onclick();
 assert.match(panel.result.textContent,/Proven/);assert.match(panel.result.textContent,/<img src=x>/);assert.equal(panel.result.querySelector('img'),null);assert.equal(panel.button.disabled,false);assert.equal(f.CList.state.identityProof.phase,'complete');
 const summary=JSON.stringify(f.CList.state.identityProof);for(const secret of ['fixture-token','PRIVATE','SIGNATURE'])assert.equal(summary.includes(secret),false);
});
test('proof rejects invalid targets, missing login/public/private keys and failures with visible feedback',async()=>{
 for(const kind of ['url','login','public','private','verify']){
  const f=fixture(),panel=f.open();if(kind==='url')panel.root.querySelector('#prove-other-url').value='javascript:bad';
  if(kind==='login'){f.token(null);const other=f.open();await other.button.onclick();assert.match(other.result.textContent,/Not logged in/);assert.equal(f.requests.length,0);continue;}
  if(kind==='public')f.ctx.fetch=async()=>({ok:true,json:async()=>({})});if(kind==='private')f.CList.storage.kv.get=async()=>null;if(kind==='verify')f.ctx.verifyIdentitySignature=async()=>{throw Error('Invalid public key');};
  await panel.button.onclick();assert.equal(f.CList.state.identityProof.phase,'failed',kind);assert.equal(panel.button.disabled,false,kind);assert.ok(panel.result.textContent,kind);if(kind==='url')assert.equal(f.requests.length,0);
 }
});
test('duplicate proof clicks are suppressed and input edits supersede the captured target',async()=>{
 const f=fixture(),gate=deferred(),panel=f.open();f.ctx.fetch=(url,options)=>{f.requests.push({url,options});return gate.promise;};const pending=panel.button.onclick();await panel.button.onclick();assert.equal(f.requests.length,1);
 panel.root.querySelector('#prove-other-username').value='Carol';panel.edit();assert.equal(f.requests[0].options.signal.aborted,true);assert.equal(panel.button.disabled,false);
 f.ctx.fetch=async url=>{f.requests.push({url});return{ok:true,json:async()=>({verificationMethod:[{publicKeyJwk:{}}]})};};await panel.button.onclick();assert.match(panel.result.textContent,/carol@other.invalid/);
 gate.resolve({ok:true,json:async()=>({verificationMethod:[{publicKeyJwk:{}}]})});await pending;assert.match(panel.result.textContent,/carol@other.invalid/);assert.equal(f.calls.filter(call=>call[0]==='sign').length,1);
});
test('changed token/server/mode/panel and detached controls reject stale signing and feedback',async()=>{
 for(const change of ['token','server','local','panel','closed']){
  const f=fixture(),gate=deferred(),panel=f.open();f.ctx.getEncKey=()=>gate.promise;const pending=panel.button.onclick();await new Promise(resolve=>setImmediate(resolve));
  if(change==='token')f.token('other');if(change==='server')f.CList.config.flaskSiteUrl='https://changed.invalid';if(change==='local')f.local(true);if(change==='panel')f.open();if(change==='closed')panel.root.isConnected=false;
  gate.resolve('key');await pending;assert.equal(f.calls.length,0,change);assert.equal(panel.result.textContent.includes('Proven.'),false,change);const count=f.requests.length;await panel.button.onclick();assert.equal(f.requests.length,count,change);
 }
});
test('a current cryptographic mismatch is displayed separately from operational failure',async()=>{
 const f=fixture(),panel=f.open();f.ctx.verifyIdentitySignature=async()=>false;await panel.button.onclick();assert.match(panel.result.textContent,/Not the same key/);assert.equal(f.CList.state.identityProof.phase,'complete');
});


test('identity rotation can invalidate a pending proof without signing the old identity',async()=>{
 const f=fixture(),pending=deferred(),panel=f.open();f.ctx.getEncKey=()=>pending.promise;const running=panel.button.onclick();await new Promise(resolve=>setImmediate(resolve));panel.control.invalidate();pending.resolve('key');await running;assert.equal(f.calls.length,0);assert.equal(panel.button.disabled,false);assert.equal(panel.result.textContent,'');
});


test('a concurrent rotation during signature verification rejects the old-key result',async()=>{
 const f=fixture(),panel=f.open();let value='original';f.CList.storage.kv.get=async()=>({value});f.ctx.verifyIdentitySignature=async()=>{value='replacement';return true;};await panel.button.onclick();assert.equal(f.CList.state.identityProof.phase,'failed');assert.match(panel.result.textContent,/identity key changed/);assert.equal(panel.result.textContent.includes('Proven.'),false);
});
