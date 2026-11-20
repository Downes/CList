const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {Element}=require('./helpers/account-fixture.cjs');const read=name=>fs.readFileSync('js/'+name+'.js','utf8');const gate=()=>{let resolve;const promise=new Promise(done=>resolve=done);return{promise,resolve};};
const key={kty:'OKP',crv:'Ed25519',x:'PUBLIC'},profile=()=>({id:'did:web:self',verificationMethod:[{publicKeyJwk:key}],service:[{id:'did:web:self#mastodon',type:'SocialWebAccount',serviceEndpoint:'https://mastodon',extension:{keep:1}},{id:'external',type:'Custom',extra:{keep:true}}],alsoKnownAs:['did:key:PUBLIC','at://alice.test','https://profile']});
function fixture(){
 let token='token',local=false,doc=profile();const records=new Map([['mastodon',JSON.stringify({type:'Mastodon',instance:'https://mastodon',title:'Masto',id:'SECRET',public:false,extension:{preserve:true}})],['bluesky',JSON.stringify({type:'Bluesky',instance:'alice.test',id:'APP-PASSWORD',public:true})],['clist:pages-catalog',JSON.stringify({opmlUrl:'https://pages/opml',apUrl:'https://pages/outbox'})]]),writes=[],puts=[];
 const CList={config:{flaskSiteUrl:'https://store.invalid'},keys:{ACCESS_TOKEN:'access_token',DID_IDENTITY_KEY:'_did_identity_key',PAGES_CATALOG:'clist:pages-catalog'},state:{username:'alice'},ui:{},isLocalMode:()=>local,storage:{get mode(){return local?'local':'remote';},kv:{list:async()=>[...records].map(([key,value])=>({key,value})),get:async name=>name==='_did_identity_key'?{value:'PRIVATE-CIPHER'}:records.has(name)?{key:name,value:records.get(name)}:null,update:async(name,value)=>{writes.push(name);records.set(name,value);}}}};
 const ctx=vm.createContext({window:{CList},document:{createElement:tag=>new Element(tag)},console:{error(){}},AbortController,getSiteSpecificCookie:()=>token,getEncKey:async()=> 'key',decryptWithKey:async(key,value)=>value,encryptWithKey:async(key,value)=>value,
 derivePublicKeyJwkAndDidKey:async()=>({publicKeyJwk:key,didKey:'did:key:PUBLIC'}),fetch:async(url,options={})=>{if(options.method==='PUT'){const body=JSON.parse(options.body);puts.push({url,options,body});doc={id:'did:web:self',verificationMethod:[{publicKeyJwk:body.publicKeyJwk}],service:body.service,alsoKnownAs:[body.didKey,...body.alsoKnownAs]};return{ok:true,json:async()=>({})};}return{ok:true,json:async()=>structuredClone(doc)};}});
 for(const name of ['did-identity-workflow','did-identity-view','did-identity','did-publication-workflow','did-rotation-workflow','did-update-workflow','did-update-view','did-update'])vm.runInContext(read(name),ctx);
 const open=async()=>{const root=new Element();for(const id of ['did-status','account-list','did-update-btn']){const el=new Element(id.endsWith('btn')?'button':'div');el.id=id;root.appendChild(el);}const reader=ctx.createDidIdentityRead(root,{onState(){}});await reader.accounts();const controller=ctx.createDidAccountUpdater(root,reader),button=root.querySelector('#did-update-btn');button.onclick=controller.update;
  const choose=(name,value)=>{const input=root.querySelectorAll('input').find(input=>input.dataset.key===name);input.checked=value;input.onchange();};return{root,reader,controller,button,choose};};
 return{ctx,CList,records,writes,puts,open,token:value=>token=value,local:value=>local=value,doc:value=>doc=value,getDoc:()=>doc};
}
test('public choices are state-owned and preserve account/service extensions, aliases and page catalogs',async()=>{
 const f=fixture(),panel=await f.open();panel.choose('mastodon',true);panel.choose('bluesky',false);const input=panel.root.querySelectorAll('input')[0];input.dataset.key='tampered';input.checked=false;
 await panel.button.onclick();assert.deepEqual(f.writes,['mastodon','bluesky']);const stored=JSON.parse(f.records.get('mastodon'));assert.equal(stored.public,true);assert.equal(stored.id,'SECRET');assert.deepEqual(stored.extension,{preserve:true});
 const body=f.puts[0].body;assert.equal(f.puts[0].options.headers.Authorization,'Bearer token');assert.equal(body.service.find(item=>item.id==='did:web:self#mastodon').extension.keep,1);assert.ok(body.service.find(item=>item.id==='external'));assert.ok(body.service.find(item=>item.type==='CListPages'));assert.ok(body.service.find(item=>item.type==='OrderedCollection'));assert.deepEqual(body.alsoKnownAs,['https://profile']);assert.equal(JSON.stringify(body).includes('SECRET'),false);assert.equal(JSON.stringify(f.CList.state).includes('APP-PASSWORD'),false);assert.equal(f.CList.state.identityUpdate.phase,'complete');
 await panel.button.onclick();assert.equal(f.puts.length,1);assert.equal(f.writes.length,2);
});
test('checkbox callbacks expire after list rebuild while newer unsaved choices survive a read',async()=>{
 const f=fixture(),panel=await f.open();const old=panel.root.querySelectorAll('input')[0];panel.choose('mastodon',true);await panel.reader.accounts();assert.equal(panel.reader.selection().items.find(item=>item.key==='mastodon').public,true);old.checked=false;old.onchange();assert.equal(panel.reader.selection().items.find(item=>item.key==='mastodon').public,true);
});
test('partial visibility failures retain user choices and accepted publication; retry writes only the remaining flag',async()=>{
 const f=fixture();let fail=true;f.CList.storage.kv.update=async(name,value)=>{f.writes.push(name);if(fail&&name==='mastodon')throw Error('Lost');f.records.set(name,value);};const panel=await f.open();panel.choose('mastodon',true);await panel.button.onclick();assert.equal(f.CList.state.identityUpdate.phase,'partial');assert.equal(f.puts.length,1);await panel.reader.accounts();assert.equal(panel.reader.selection().items.find(item=>item.key==='mastodon').public,true);
 await panel.button.onclick();assert.equal(panel.button.textContent,'Retry remaining update');fail=false;await panel.button.onclick();assert.equal(f.puts.length,1);assert.deepEqual(f.writes,['mastodon','mastodon']);assert.equal(f.CList.state.identityUpdate.phase,'complete');
});
test('lost DID response reconciles by reads without repeating accepted account saves or publication',async()=>{
 const f=fixture();let lost=true;const original=f.ctx.fetch;f.ctx.fetch=async(url,options)=>{const result=await original(url,options);if(options?.method==='PUT'&&lost){lost=false;throw Error('Response lost');}return result;};const panel=await f.open();panel.choose('mastodon',true);await panel.button.onclick();assert.equal(panel.button.textContent,'Check update');const writes=f.writes.length;await panel.button.onclick();assert.equal(f.puts.length,1);assert.equal(f.writes.length,writes);assert.equal(f.CList.state.identityUpdate.phase,'complete');
});
test('changed account/catalog/public metadata is rejected before overwriting newer data',async()=>{
 for(const change of ['account','catalog','profile']){
  const f=fixture(),panel=await f.open();panel.choose('mastodon',true);if(change==='account'){f.records.set('mastodon',JSON.stringify({type:'Mastodon',id:'NEW-CREDENTIAL',public:false}));await panel.button.onclick();assert.equal(f.writes.length,0);assert.equal(f.puts.length,0);continue;}
  const original=f.ctx.encryptWithKey;f.ctx.encryptWithKey=async(key,value)=>{const result=await original(key,value);if(change==='catalog')f.records.set('clist:pages-catalog',JSON.stringify({opmlUrl:'https://new'}));else f.getDoc().service.push({id:'incoming',type:'New'});return result;};await panel.button.onclick();assert.equal(f.puts.length,0,change);assert.equal(f.CList.state.identityUpdate.phase,'partial',change);
 }
});
test('session/panel changes and duplicate clicks reject stale writes and never enable replacement controls',async()=>{
 for(const change of ['duplicate','session','panel']){
  const f=fixture(),panel=await f.open(),pending=gate();panel.choose('mastodon',true);f.ctx.encryptWithKey=()=>pending.promise;const running=panel.button.onclick();await new Promise(resolve=>setImmediate(resolve));if(change==='session')f.token('other');if(change==='panel')await f.open();await panel.button.onclick();pending.resolve(JSON.stringify({type:'Mastodon',instance:'https://mastodon',id:'SECRET',public:true}));await running;
  assert.equal(f.puts.length,change==='duplicate'?1:0,change);assert.equal(f.writes.length,change==='duplicate'?1:0,change);
 }
});
test('a partial update cannot write old choices after the user edits the current selection',async()=>{
 const f=fixture();f.CList.storage.kv.update=async()=>{throw Error('Rejected');};const panel=await f.open();panel.choose('mastodon',true);await panel.button.onclick();await panel.button.onclick();panel.choose('mastodon',false);await panel.button.onclick();assert.match(panel.root.textContent,/choices changed/);assert.equal(f.puts.length,1);
});
test('selection preparation/workflow uses explicit dependencies without DOM and protects local mode',async()=>{
 const ctx=vm.createContext({});vm.runInContext(read('did-update-workflow'),ctx);await assert.rejects(ctx.prepareDidAccountUpdate({items:[]},{local:true},{assertCurrent(){}}),/local account/);assert.equal('document' in ctx,false);
});
