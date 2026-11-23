const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {Element}=require('./helpers/account-fixture.cjs');
const gate=()=>{let resolve;const promise=new Promise(done=>resolve=done);return {promise,resolve};};
function fixture(){
 let token='source-secret',source=[{key:'account',value:'source-cipher',extension:1},{key:'_did_identity_key',value:'did-cipher'}],dest=[],local=false;
 const calls=[],behavior={},CList={config:{flaskSiteUrl:'https://source.invalid'},state:{username:'alice'},keys:{DID_IDENTITY_KEY:'_did_identity_key'},ui:{},storage:{kv:{list:async()=>behavior.list?behavior.list():source}}};
 const session=()=>({storeUrl:CList.config.flaskSiteUrl,username:CList.state.username,token,local});
 const locks=new Map();
 const ctx=vm.createContext({window:{CList},URL,AbortController,document:{createElement:tag=>new Element(tag)},console:{error(){}},
 didIdentitySession:session,registerDidIdentityMutation:(name,check)=>locks.set(name,check),didIdentityMutationBusy:(value,except=[])=>[...locks].some(([name,check])=>!except.includes(name)&&check(JSON.stringify(value))),
 getEncKey:async()=>behavior.key?behavior.key():'source-key',decryptWithKey:async(key,value)=>{if(behavior.corrupt)throw Error('bad cipher');return value;},
 deriveEncKey:async(password,user)=>{calls.push(['derive',password,user]);return 'dest-key';},deriveAuthHash:async()=> 'hash-secret',
 fetch:async(url,options)=>{calls.push([url,options]);if(behavior.fetch)return behavior.fetch(url,options);
 if(url.endsWith('/auth/register'))return {ok:true};if(url.endsWith('/auth/login'))return {ok:!behavior.loginFail,status:401,json:async()=>({token:'dest-secret'})};
 if(url.endsWith('/get_kvs/'))return {ok:!behavior.listFail,status:503,json:async()=>dest};throw Error('Unexpected request');}});
 for(const name of ['workflow','view',''])vm.runInContext(fs.readFileSync('js/migration-preparation'+(name?'-'+name:'')+'.js','utf8'),ctx);
 const open=()=>{
 const root=new Element();for(const id of ['step-1','step-2','new-url','new-username','new-password','register','prepare-btn','cancel-btn','run-btn','preview','progress']){const el=new Element(id.includes('btn')?'button':'div');el.id='migrate-'+id;root.appendChild(el);}
 const get=id=>root.querySelector('#migrate-'+id);get('new-url').value='https://dest.invalid/';get('new-username').value=' BOB ';get('new-password').value='password-secret';
 const controller=ctx.createMigrationPreparation(root);return {root,get,controller,prepare:()=>get('prepare-btn').onclick(),password:()=>get('new-password').value='password-secret'};};
 return {ctx,CList,calls,behavior,open,source:value=>source=value,dest:value=>dest=value,local:value=>local=value,token:value=>token=value};
}
test('captured local source, detached records and safe conflict preview hand off once without writes',async()=>{
 const f=fixture();f.local(true);f.dest([{key:'_did_identity_key',value:'dest-did'}]);const p=f.open();await p.prepare();
 const state=f.CList.state.migrationPreparation;assert.equal(state.phase,'ready');assert.equal(state.preview.conflictCount,1);assert.equal(state.preview.didConflict,true);assert.match(p.root.textContent,/this device/);
 const safe=JSON.stringify(state);for(const secret of ['password-secret','source-secret','dest-secret','source-cipher','did-cipher','hash-secret'])assert.equal(safe.includes(secret),false);
 assert.equal(p.get('new-password').value,'');assert.equal(await p.controller.beginRun(),null);
 const box=p.get('overwrite-confirm');box.checked=true;box.onchange();const plan=await p.controller.beginRun();assert.equal(plan.oldUsername,'alice');assert.equal(plan.newUsername,'bob');assert.equal(plan.kvs[0].extension,1);assert.equal(await p.controller.beginRun(),null);
 assert.equal(f.calls.filter(([url])=>url.startsWith('https:')).every(([url])=>/auth\/login|get_kvs/.test(url)),true);
});
test('bad URLs, same account, corrupt source and failed/malformed destination lists never produce runnable previews',async()=>{
 for(const mode of ['url','same','source','destination','malformed']){
 const f=fixture(),p=f.open();if(mode==='url')p.get('new-url').value='https://user:pass@dest.invalid';
 if(mode==='same'){p.get('new-url').value='https://source.invalid';p.get('new-username').value='alice';}
 if(mode==='source')f.behavior.corrupt=true;if(mode==='destination')f.behavior.listFail=true;
 if(mode==='malformed')f.dest({bad:true});await p.prepare();assert.equal(f.CList.state.migrationPreparation.phase,'failed',mode);assert.equal(await p.controller.beginRun(),null);
 }
});
test('inputs captured before key lookup; duplicate click, edits, Cancel and replaced panel reject late preparation',async()=>{
 const f=fixture(),wait=gate();f.behavior.key=()=>wait.promise;const p=f.open(),first=p.prepare();await p.prepare();
 p.get('new-username').value='changed';p.get('new-username').oninput();wait.resolve('source-key');await first;assert.equal(f.calls.length,0);assert.equal(f.CList.state.migrationPreparation.phase,'idle');
 delete f.behavior.key;p.password();await p.prepare();p.get('cancel-btn').onclick();assert.equal(await p.controller.beginRun(),null);
 const wait2=gate();f.behavior.key=()=>wait2.promise;p.password();const old=p.prepare(),next=f.open();wait2.resolve('source-key');await old;assert.equal(f.CList.state.migrationPreparation.panelId,2);assert.equal(next.get('preview').textContent,'');
});
test('accepted registration survives failed login and panel rebuild without a second registration',async()=>{
 const f=fixture(),p=f.open();p.get('register').checked=true;f.behavior.loginFail=true;await p.prepare();assert.equal(f.CList.state.migrationPreparation.registration,'created');
 await p.get('retry-registration').onclick();assert.equal(f.calls.filter(([url])=>url.endsWith('/auth/register')).length,1);
 f.behavior.loginFail=false;const next=f.open();next.get('register').checked=true;await next.prepare();assert.equal(f.CList.state.migrationPreparation.phase,'ready');assert.equal(f.calls.filter(([url])=>url.endsWith('/auth/register')).length,1);
});
test('uncertain registration checks login on ordinary retry, requires explicit action to send registration again',async()=>{
 const f=fixture(),p=f.open();p.get('register').checked=true;
 f.behavior.fetch=async url=>{if(url.endsWith('/auth/register'))throw Error('lost');return {ok:false,status:401};};
 await p.prepare();assert.equal(f.CList.state.migrationPreparation.registration,'uncertain');await p.prepare();assert.equal(f.calls.filter(([url])=>url.endsWith('/auth/register')).length,1);
 const retry=p.get('retry-registration');await retry.onclick();assert.equal(f.calls.filter(([url])=>url.endsWith('/auth/register')).length,2);
});
test('overwrite decisions belong to state and expired checkbox callbacks cannot alter approval',async()=>{
 const f=fixture();f.dest([{key:'account',value:'destination'}]);const p=f.open();await p.prepare();const old=p.get('overwrite-confirm');old.checked=true;
 assert.equal(await p.controller.beginRun(),null);const current=p.get('overwrite-confirm');current.checked=true;current.onchange();old.checked=false;old.onchange();assert.equal(f.CList.state.migrationPreparation.overwrite,true);assert.ok(await p.controller.beginRun());
});
test('Run rechecks both snapshots, rejects changed records, failed destination auth and stale sessions',async()=>{
 for(const mode of ['source','destination','login','session']){
 const f=fixture(),p=f.open();await p.prepare();if(mode==='source')f.source([]);if(mode==='destination')f.dest([{key:'new',value:'changed'}]);if(mode==='login')f.behavior.listFail=true;if(mode==='session')f.token('new-login');
 assert.equal(await p.controller.beginRun(),null,mode);assert.equal(f.calls.some(([url])=>/add_kv|update_kv|auth\/did/.test(url)),false);
 }
});
test('registration accepted after Cancel retains receipt while stale preview cannot replace newer UI',async()=>{
 const f=fixture(),wait=gate(),p=f.open();p.get('register').checked=true;f.behavior.fetch=url=>url.endsWith('/auth/register')?wait.promise:Promise.reject(Error('Unexpected login'));
 const preparing=p.prepare();while(!f.calls.some(([url])=>url.endsWith('/auth/register')))await new Promise(resolve=>setImmediate(resolve));
 p.get('cancel-btn').onclick();wait.resolve({ok:true});await preparing;assert.equal(f.CList.state.migrationPreparation.phase,'idle');
 delete f.behavior.fetch;p.password();await p.prepare();assert.equal(f.calls.filter(([url])=>url.endsWith('/auth/register')).length,1);assert.equal(f.CList.state.migrationPreparation.phase,'ready');
});
