const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {Element}=require('./helpers/account-fixture.cjs');
const source=name=>fs.readFileSync('js/'+name+'.js','utf8');
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};};
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(){
 const CList={config:{flaskSiteUrl:'https://store.invalid'},keys:{ACCESS_TOKEN:'access_token'},state:{username:'alice'},ui:{},storage:{mode:'remote',kv:{}}};
 let token='fixture-token',records=[{key:'social:following:did:web:store.invalid:users:alice',value:JSON.stringify({did:'did:web:store.invalid:users:alice'})}];
 const writes=[],cache=[];CList.storage.kv.list=async()=>records;CList.storage.kv.remove=async key=>{writes.push(key);};
 const ctx=vm.createContext({window:{CList},document:{createElement:tag=>new Element(tag)},console:{error(){}},history:{back(){}},
  getSiteSpecificCookie:()=>token,getEncKey:async()=> 'key',decryptWithKey:async(key,value)=>value,_clistAnnotateInvalidateFollowCache:()=>cache.push(true)});
 for(const name of ['following-workflow','following-view','following'])vm.runInContext(source(name),ctx);
 const open=()=>ctx.kvstoreFollowingPanel();const button=root=>root.querySelectorAll('button').find(button=>button.textContent==='Unfollow');
 return{ctx,CList,writes,cache,open,button,token:value=>token=value,records:value=>records=value};
}
test('Following workflow retains exact keys, fallback identities and visible partial-read warnings without DOM',async()=>{
 const ctx=vm.createContext({});vm.runInContext(source('following-workflow'),ctx);
 const rows=[{key:'social:following:original',value:'valid'},{key:'social:following:fallback',value:'bad'},{key:'other',value:'ignored'}];
 const result=await ctx.readFollowingEntries({assertCurrent(){},list:async()=>rows,getKey:async()=> 'key',decrypt:async(key,value)=>{if(value==='bad')throw Error('Unreadable');return JSON.stringify({did:'did:web:elsewhere.invalid:users:new'});}});
 assert.equal(result.items[0].key,rows[0].key);assert.equal(result.items[0].did,'did:web:elsewhere.invalid:users:new');assert.equal(result.items[1].did,'fallback');assert.equal(result.warnings.length,1);
 const removed=[];await ctx.removeFollowingEntry(result.items[0].key,{assertCurrent(){},remove:async key=>removed.push(key)});assert.deepEqual(removed,[rows[0].key]);
 await assert.rejects(ctx.removeFollowingEntry('account:wrong',{}),/Invalid/);assert.equal('document' in ctx,false);
});
test('Following renders safe labels, empty/login/errors and permits explicit read retry',async()=>{
 const f=fixture();f.records([{key:'social:following:literal',value:JSON.stringify({did:'<img src=x>'})}]);const root=f.open();await flush();
 assert.match(root.textContent,/<img src=x>/);assert.equal(root.querySelector('img'),null);assert.equal(f.CList.state.following.phase,'ready');
 f.CList.storage.kv.list=async()=>{throw Error('Offline');};await f.ctx.window._clistRefreshFollowingPanel();assert.match(root.textContent,/Offline/);
 f.CList.storage.kv.list=async()=>[];await f.ctx.window._clistRefreshFollowingPanel();assert.match(root.textContent,/Not following anyone/);
 f.token(null);const loggedOut=f.open();await flush();assert.match(loggedOut.textContent,/Not logged in/);
 assert.equal(JSON.stringify(f.CList.state.following).includes('fixture-token'),false);
});
test('Following suppresses stale decrypt/list results and old panel callbacks after session or panel changes',async()=>{
 for(const change of ['token','server','username','mode','panel','closed']){
  const f=fixture(),gate=deferred();f.ctx.getEncKey=()=>gate.promise;const root=f.open();await flush();
  if(change==='token')f.token('other');if(change==='server')f.CList.config.flaskSiteUrl='https://other.invalid';if(change==='username')f.CList.state.username='bob';
  if(change==='mode')f.CList.storage.mode='local';if(change==='closed')root.isConnected=false;if(change==='panel')f.open();
  gate.resolve('key');await flush();assert.equal(f.button(root),undefined,change);
 }
});
test('Unfollow captures exact stored key, blocks duplicate/stale controls and invalidates discovery only after acceptance',async()=>{
 const f=fixture(),gate=deferred();f.records([{key:'social:following:original',value:JSON.stringify({did:'did:web:other.invalid:users:display'})}]);
 f.CList.storage.kv.remove=key=>{f.writes.push(key);return gate.promise;};const root=f.open();await flush();const button=f.button(root),first=button.onclick();
 await button.onclick();assert.deepEqual(f.writes,['social:following:original']);assert.equal(button.disabled,true);assert.equal(f.cache.length,0);
 gate.resolve();await first;assert.equal(f.cache.length,1);assert.equal(f.button(root),undefined);assert.match(root.textContent,/Not following anyone/);
 await button.onclick();assert.equal(f.writes.length,1);
});
test('Uncertain Unfollow failure remains visible and never retries automatically; explicit retry can succeed',async()=>{
 const f=fixture();let fail=true;f.CList.storage.kv.remove=async key=>{f.writes.push(key);if(fail)throw Error('Response lost');};const root=f.open();await flush();const button=f.button(root);
 await button.onclick();assert.equal(f.writes.length,1);assert.match(root.textContent,/Response lost/);assert.equal(button.disabled,false);assert.equal(f.cache.length,0);
 fail=false;await button.onclick();assert.equal(f.writes.length,2);assert.equal(f.cache.length,1);assert.equal(f.button(root),undefined);
});
test('refresh/replaced rows stay locked during pending delete and late completion cannot change another session panel',async()=>{
 const f=fixture(),gate=deferred();f.CList.storage.kv.remove=key=>{f.writes.push(key);return gate.promise;};const root=f.open();await flush();const old=f.button(root),pending=old.onclick();
 await f.ctx.window._clistRefreshFollowingPanel();const replacement=f.button(root);assert.notEqual(replacement,old);assert.equal(replacement.disabled,true);await old.onclick();assert.equal(f.writes.length,1);
 f.token('other');f.records([]);const other=f.open();await flush();const before=other.textContent;gate.resolve();await pending;
 assert.equal(other.textContent,before);assert.equal(f.cache.length,0);assert.equal(f.writes.length,1);
});
