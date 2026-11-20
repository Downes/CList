const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=name=>fs.readFileSync('js/'+name+'.js','utf8');
const defer=()=>{let resolve;const promise=new Promise(done=>resolve=done);return{promise,resolve};};
function fixture(){
 let token='a-token',nodes=[],localAccounts=[],records=[],getter=async()=> 'key',http=async()=>({ok:true,json:async()=>({items:[]})});
 const messages=[],writes=[],errors=[],events=[],roots=[],counts=[],rows=[];const feed={isConnected:true,replaceChildren(){rows.length=0;},appendChild(node){rows.push(node);}};
 const cList={state:{username:'alice',reader:{requestId:1,accountKey:'account',mode:'account'}},config:{flaskSiteUrl:'https://store.invalid'},keys:{ACCESS_TOKEN:'access_token'},accounts:[],ui:{view:{feedContainer:feed}}};
 const view={message(root,text,error){root.replaceChildren();events.push(['message',text,error]);},warnings(root,values){events.push(['warnings',values]);},
  thread(root,source,count,close){const value={root:{isConnected:true},saved:{source},close};value.root.appendChild=node=>rows.push(node);roots.push(value);return value;},
  restore(root,saved){events.push(['restore',saved]);},count(source,count,open){counts.push({source,count,open});},
  feed(root,{items,warnings,rowOptions,emptyText}){root.replaceChildren();this.warnings(root,warnings);if(!items.length)root.appendChild({textContent:emptyText});this.rows(root,items,rowOptions);},
  rows(root,items,options){for(const item of items)root.appendChild({anno:item,options});},
  followBusy(button,busy){button.disabled=busy;},followed(button,did){button.title='Following';messages.push('Now following '+did);},
  followButton(){return null;},followState(){},actionError(action,error,current){errors.push({action,message:error.message,current});},error(error){errors.push(error.message);}};
 cList.ui.annotationReading=view;
 const ctx=vm.createContext({window:{CList:cList,addEventListener(){},removeEventListener(){}},structuredClone,URLSearchParams,console:{error(){}},
  document:{querySelectorAll:()=>nodes,getElementById:id=>nodes.find(node=>node.id===id),createElement:()=>({textContent:'',appendChild(){}})},history:{pushState(){}},
  getSiteSpecificCookie:()=>token,getEncKey:(...args)=>getter(...args),encryptWithKey:async(key,value)=>value,decryptKVJson:async(key,value)=>JSON.parse(value),
  parseAccountValue:record=>JSON.parse(record.value),fetch:(...args)=>http(...args),_allAnnotationAccounts:async()=>localAccounts,
  _buildAnnotationItem:(anno,options)=>({anno,options}),_getAuthorDidFromFeed:async()=>null,showStatusMessage:message=>messages.push(message),
  captureReaderSurface(mode){const id=++cList.state.reader.requestId;cList.state.reader.mode=mode;return{isCurrent:()=>cList.state.reader.requestId===id};}});
 cList.storage={kv:{list:async()=>records,put:async(key,value)=>writes.push(['put',key,value]),remove:async key=>writes.push(['remove',key])}};
 for(const name of ['annotate_requests','annotate_reader'])vm.runInContext(read(name),ctx);
 return{ctx,cList,feed,messages,writes,errors,events,roots,counts,rows,setToken:value=>{token=value;},setRecords:value=>{records=value;},setKey:fn=>{getter=fn;},setHttp:fn=>{http=fn;},setAccounts:value=>{localAccounts=value;},setNodes:value=>{nodes=value;}};
}
const anno=(id='one')=>({id,creator:{id:'did:web:store.invalid:users:alice'},target:{source:'https://source.invalid'},body:{value:'Note'},created:'2026-11-20'});

test('annotation reads report partial store failures while retaining successful annotations',async()=>{
 const f=fixture();f.setHttp(async url=>url.startsWith('https://failed.invalid')?{ok:false,status:503}:{ok:true,json:async()=>({items:[anno()]})});
 const result=await f.ctx.collectAnnotationRecords([{instance:'https://ok.invalid'},{instance:'https://failed.invalid'}],{url:'https://source.invalid'});
 assert.equal(result.items.length,1);assert.equal(result.warnings.length,1);assert.match(result.warnings[0],/503/);
});
test('follow persistence checks captured session again after key/encryption preparation',async()=>{
 const f=fixture(),gate=defer();f.setKey(()=>gate.promise);const button={isConnected:true};
 const pending=f.ctx._followUser('did:web:person.invalid:users:other','a-token',button);f.setToken('b-token');gate.resolve('key');
 await assert.rejects(pending,/no longer current/);assert.equal(f.writes.length,0);assert.equal(button.disabled,false);
});
test('duplicate follow clicks write once and never mutate a removed button after acceptance',async()=>{
 const f=fixture(),gate=defer();f.setKey(()=>gate.promise);const button={isConnected:true};
 const first=f.ctx._followUser('did:web:person.invalid:users:other','a-token',button);await f.ctx._followUser('did:web:person.invalid:users:other','a-token',button);
 gate.resolve('key');button.isConnected=false;await assert.rejects(first,/no longer current/);assert.equal(f.writes.length,0);
 button.isConnected=true;f.setKey(async()=> 'key');await f.ctx._followUser('did:web:person.invalid:users:other','a-token',button);assert.equal(f.writes.length,1);
});
test('discovery cache is scoped by login/server and rejects late old-session cache writes',async()=>{
 const f=fixture(),gate=defer();f.setKey(()=>gate.promise);const first=f.ctx._getFollowedDids();f.setToken('b-token');gate.resolve('key');
 await assert.rejects(first,/session changed/);f.setKey(async()=> 'key');f.setRecords([{key:'social:following:b',value:JSON.stringify({did:'did:web:person.invalid:users:b'})}]);
 f.setHttp(async()=>({ok:true,json:async()=>({service:[]})}));const next=await f.ctx._getFollowedDids();assert.equal(next.has('did:web:person.invalid:users:b'),true);
 f.setRecords([]);f.setToken('c-token');const changed=await f.ctx._getFollowedDids();assert.equal(changed.size,0);
});
test('feed rejects stale completion and presents partial failures visibly on its owned surface',async()=>{
 const f=fixture(),gate=defer();f.setAccounts([{instance:'https://one.invalid'}]);f.setHttp(()=>gate.promise);
 const first=f.ctx.window.showAnnotations('all');await new Promise(resolve=>setImmediate(resolve));f.cList.state.reader.requestId++;
 gate.resolve({ok:true,json:async()=>({items:[anno()]})});await first;assert.equal(f.rows.length,0);
 f.setAccounts([{instance:'https://good.invalid'},{instance:'https://bad.invalid'}]);f.setHttp(async url=>url.includes('bad.invalid')?{ok:false,status:500}:{ok:true,json:async()=>({items:[anno()]})});
 await f.ctx.window.showAnnotations('all');assert.equal(f.rows.some(row=>row.anno?.id==='one'),true);assert.equal(f.events.some(event=>event[0]==='warnings'&&event[1].length===1),true);
});
test('thread close cannot restore saved feed over a newer reader request',async()=>{
 const f=fixture(),source={id:'source',isConnected:true,reference:{url:'https://source.invalid'},closest(){return null;}};f.setNodes([source]);
 f.setAccounts([{instance:'https://store.invalid'}]);f.setHttp(async()=>({ok:true,json:async()=>({items:[anno()]})}));
 await f.ctx.window.showAnnotationsForItem('source');assert.equal(f.roots.length,1);
 f.cList.state.reader.requestId++;f.roots[0].close();assert.equal(f.events.some(event=>event[0]==='restore'),false);
});
test('current thread close restores its parked feed once and retained callbacks are idempotent',async()=>{
 const f=fixture(),source={id:'source',isConnected:true,reference:{url:'https://source.invalid'}};f.setNodes([source]);
 f.setAccounts([{instance:'https://store.invalid'}]);f.setHttp(async()=>({ok:true,json:async()=>({items:[anno()]})}));
 await f.ctx.window.showAnnotationsForItem('source');const close=f.roots[0].close;close();close();assert.equal(f.events.filter(event=>event[0]==='restore').length,1);
 const read=f.counts.find(value=>value.source===source&&value.count===1).open;await read();assert.equal(f.roots.length,2,'Restored source count can open a new thread');
});
test('batch checks snapshot original nodes before discovery and cannot attach counts to a same-ID replacement',async()=>{
 const f=fixture(),gate=defer(),old={id:'same',isConnected:true,reference:{url:'https://old.invalid'}};f.setNodes([old]);f.ctx._allAnnotationAccounts=()=>gate.promise;
 const pending=f.ctx.window.checkAnnotationsBatch();const replacement={id:'same',isConnected:true,reference:{url:'https://new.invalid'}};f.setNodes([replacement]);old.isConnected=false;
 gate.resolve([{instance:'https://store.invalid'}]);f.setHttp(async()=>({ok:true,json:async()=>({results:{'https://old.invalid':3}})}));await pending;assert.equal(f.counts.length,0);
});


test('row commands capture Flow session/targets, reject stale actions and route follow failures to the view',async()=>{
 const f=fixture(),calls=[];let current=true;
 f.ctx.captureAnnotationSession=()=>({token:'captured-session'});
 f.ctx._flowAnnotation=async(...args)=>calls.push(args);
 const writeAccounts=[{type:'Annotate',instance:'https://write.invalid'}];
 const options=f.ctx.annotationRowOptions({token:'a-token',writeAccts:writeAccounts});
 f.ctx.captureAnnotationSession=()=>({token:'new-session'});
 const button={isConnected:true},annotation=anno();
 await options.onFlow(annotation,'https://source.invalid',button,()=>current);
 assert.equal(calls.length,1);assert.equal(calls[0][0],annotation);assert.equal(calls[0][2],writeAccounts);assert.equal(calls[0][5].token,'captured-session');
 current=false;await options.onFlow(annotation,'https://wrong.invalid',button,()=>current);await options.onFollow('did:web:person.invalid',button,()=>current);
 assert.equal(calls.length,1);assert.equal(f.writes.length,0);
 current=true;f.setKey(async()=>{throw Error('Key unavailable');});await options.onFollow('did:web:person.invalid',button,()=>current);
 assert.deepEqual(f.errors,[{action:'Follow',message:'Key unavailable',current:true}]);assert.equal(button.disabled,false);
});
