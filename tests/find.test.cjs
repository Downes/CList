const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {Element}=require('./helpers/account-fixture.cjs');
const read=name=>fs.readFileSync('js/'+name+'.js','utf8');
const plain=value=>JSON.parse(JSON.stringify(value));
function fixture(){
 const root=new Element(),left=new Element(),feed=new Element(),errors=[],serviceErrors=[],requests=[];
 left.id='left-content';feed.id='feed-container';root.append(left,feed);let token='private-token';
 const CList={state:{username:'user'},config:{flaskSiteUrl:'https://store.invalid'},keys:{ACCESS_TOKEN:'access_token'},accounts:[],readers:{},
  ui:{view:{feedContainer:feed},isHandlerVisible:handler=>!handler.hidden,reader:{reset(){},begin(){},complete(){},busy(){},selected(){},menu(){},render(){},clearStatus(){},failed(){}}}};
 const ctx=vm.createContext({window:{CList},structuredClone,AbortController,URL,URLSearchParams,console:{log(){},error(){}},
  escapeHtml:value=>String(value),document:{getElementById:id=>root.querySelector('#'+id),createElement:tag=>new Element(tag)},
  openLeftInterface:panel=>{left.innerHTML='';left.appendChild(panel);},
  getSiteSpecificCookie:()=>token,showErrorModal:message=>errors.push(message),showServiceError:(container,title,message)=>serviceErrors.push({container,title,message}),
  createFeedHeader:title=>{const el=new Element('h2');el.textContent=title;return el;},
  makeListing:item=>{const el=new Element('div');el.className='result';el.textContent=item.title;return el;},
  parseAccountValue:record=>JSON.parse(record.value),setTimeout(){},isRegistered:()=>true,ensureAccountsLoaded:async()=>{},
  fetch:async(url,options)=>{requests.push({url:String(url),options});return {ok:true,json:async()=>({results:[],meta:{count:0}})}},
 });
 // Exercise the real shared renderer, including async normalization guards.
 const ui=read('ui'),start=ui.indexOf('window.CList.ui.renderLoadMoreButton ='),end=ui.indexOf('// 6. User feedback:',start);
 vm.runInContext(ui.slice(start,end),ctx);
 for(const name of ['reader-state','reader','find-state','find-view','find','openalex','commons'])vm.runInContext(read(name),ctx);
 ctx.normalizeOpenAlexWork=async item=>({title:item.title});ctx.normalizeCommonsPage=async item=>({title:item.title});
 const input=()=>root.querySelector('#find-input');
 const type=value=>{input().value=value;input().listeners.input();};
 const button=label=>{const found=left.querySelectorAll('button').find(el=>el.textContent.endsWith(label));assert.ok(found,label);return found;};
 return{ctx,CList,root,left,feed,errors,serviceErrors,requests,input,type,button,token:value=>token=value};
}
test('plain Find state keeps draft query separate from captured request and ignores stale completion',()=>{
 const ctx=vm.createContext({});vm.runInContext(read('find-state'),ctx);const initial=ctx.createFindState(),opened=ctx.openFindState(initial);
 const first=ctx.beginFindRequest({...opened,query:'draft'},'openalex','captured');assert.equal(initial.panelId,0);
 assert.equal(first.query,'draft');assert.equal(first.requestQuery,'captured');const next=ctx.beginFindRequest(first,'commons','new');
 assert.equal(ctx.finishFindRequest(next,first.requestId),next);assert.equal(ctx.finishFindRequest(next,next.requestId).status,'ready');
});
test('Find filters providers, validates empty query, captures input events and ignores tampered DOM values',async()=>{
 const f=fixture(),calls=[];
 f.CList.readers.test={label:'Test',supportsFindContext:true,search:async(query,context)=>calls.push({query,context})};
 f.CList.readers.hidden={label:'Hidden',hidden:true,search(){throw Error('Hidden');}};f.ctx.playFind();
 await f.button('Test').onclick();assert.deepEqual(f.errors,['Please enter a search term.']);assert.equal(calls.length,0);
 assert.equal(f.left.textContent.includes('Hidden'),false);f.type(' captured & title ');f.input().value='DOM tampering';await f.button('Test').onclick();
 assert.equal(calls[0].query,'captured & title');assert.equal(f.CList.state.find.requestQuery,'captured & title');
 assert.equal(JSON.stringify(f.CList.state.find).includes('private-token'),false);
});
test('legacy providers retain no-argument method binding and finderString reads state, not the DOM',async()=>{
 const f=fixture();let count=0;const handler={label:'Legacy',search(...args){assert.equal(this,handler);assert.equal(args.length,0);assert.equal(f.ctx.finderString(),'Original');count++;}};
 f.CList.readers.legacy=handler;f.ctx.playFind();f.type('Original');f.input().value='Tampered';await f.button('Legacy').onclick();assert.equal(count,1);
});
test('duplicate pending searches are suppressed, but a new query/provider supersedes the old request',async()=>{
 const f=fixture(),pending=[];f.CList.readers.test={label:'Test',supportsFindContext:true,search:(query,context)=>new Promise(resolve=>pending.push({query,context,resolve}))};
 f.ctx.playFind();f.type('First');const first=f.button('Test').onclick();await f.button('Test').onclick();assert.equal(pending.length,1);
 f.type('Second');const second=f.button('Test').onclick();assert.equal(pending.length,2);assert.equal(pending[0].context.signal.aborted,true);
 pending[0].context.empty('Old');pending[0].resolve();await first;assert.equal(f.feed.textContent,'');
 pending[1].context.empty('New');pending[1].resolve();await second;assert.match(f.feed.textContent,/New/);assert.equal(f.CList.state.find.status,'ready');
});
test('old panel callbacks expire on rebuild/close, while closing only Find controls retains owned feed pagination',async()=>{
 const f=fixture();let calls=0,context;
 f.CList.readers.test={label:'Test',supportsFindContext:true,search:async(q,ctx)=>{calls++;context=ctx;}};
 f.ctx.playFind();f.type('Query');const old=f.button('Test');f.ctx.playFind();await old.onclick();assert.equal(calls,0);
 f.type('Current');await f.button('Test').onclick();f.ctx.invalidateFindPanel();await f.button('Test').onclick();assert.equal(calls,1);
 await context.next(async next=>{calls++;next.empty('Next page');});assert.equal(calls,2);assert.match(f.feed.textContent,/Next page/);
});
test('session, registry, feed-target changes and reader account requests reject late results/errors',async()=>{
 for(const change of ['session','store','token','registry','target','reader']){
  const f=fixture();let finish,context;
  f.CList.readers.test={label:'Test',supportsFindContext:true,search:(q,ctx)=>{context=ctx;return new Promise(resolve=>finish=resolve);}};
  f.ctx.playFind();f.type('Old');const pending=f.button('Test').onclick();
  if(change==='session')f.CList.state.username='other';if(change==='store')f.CList.config.flaskSiteUrl='other';if(change==='token')f.token('other');
  if(change==='registry')f.CList.readers.test={};if(change==='target')f.CList.ui.view.feedContainer=new Element();
  if(change==='reader'){
   const account={key:'a',value:JSON.stringify({type:'TestReader',permissions:'r'})};f.CList.accounts=[account];
   f.CList.readers.TestReader={initialize:async()=>{}};await f.ctx.switchReaderAccount('a');
  }
  context.empty('Old result');context.fail('Old error',Error('Stale'));finish();await pending;
  assert.equal(f.feed.textContent,'',change);assert.equal(f.serviceErrors.length,0,change);
 }
});
test('OpenAlex actual requests and pagination retain the captured query, suppress duplicates and expire old callbacks',async()=>{
 const f=fixture(),requests=[];
 f.ctx.fetch=async(url,options)=>{requests.push({url:String(url),options});return{ok:true,json:async()=>({results:[{title:'Page '+requests.length}],meta:{count:75}})};};
 f.ctx.playFind();f.type('Original / query');await f.button('OpenAlex').onclick();const old=f.root.querySelector('#openalex-load-more');
 f.type('Changed draft');await old.onclick();assert.equal(new URL(requests[1].url).searchParams.get('search'),'Original / query');
 assert.equal(new URL(requests[1].url).searchParams.get('page'),'2');assert.match(f.feed.textContent,/Page 1/);assert.match(f.feed.textContent,/Page 2/);
 await old.onclick();assert.equal(requests.length,2);
});
test('Commons actual request encodes query/offset, retains earlier rows and stops after an empty continuation',async()=>{
 const f=fixture(),requests=[];f.ctx.fetch=async url=>{requests.push(String(url));return{ok:true,json:async()=>requests.length===1
  ?{query:{pages:{1:{title:'First image',imageinfo:[{}]}}},continue:{gsroffset:20}}:{query:{pages:{}}}};};
 f.ctx.playFind();f.type('A & B');await f.button('Wikimedia Commons').onclick();const more=f.root.querySelector('#commons-load-more');await more.onclick();
 assert.equal(new URL(requests[1]).searchParams.get('gsrsearch'),'A & B');assert.equal(new URL(requests[1]).searchParams.get('gsroffset'),'20');
 assert.match(f.feed.textContent,/First image/);assert.equal(f.root.querySelector('#commons-load-more'),null);
});
test('failed pagination allows one explicit retry through the original visible control, never an automatic repeat',async()=>{
 const f=fixture();let calls=0;f.ctx.fetch=async()=>{calls++;if(calls===2)throw Error('Page unavailable');
  return{ok:true,json:async()=>({results:[{title:'Page '+calls}],meta:{count:75}})};};
 f.ctx.playFind();f.type('Query');await f.button('OpenAlex').onclick();const more=f.root.querySelector('#openalex-load-more');await more.onclick();
 assert.equal(calls,2);assert.equal(f.CList.state.find.status,'failed');assert.equal(f.serviceErrors.length,1);
 await more.onclick();assert.equal(calls,3);assert.equal(f.CList.state.find.status,'ready');assert.match(f.feed.textContent,/Page 1/);assert.match(f.feed.textContent,/Page 3/);
});
test('late normalization cannot append into a newer search; stale transport errors cannot replace its feedback',async()=>{
 const f=fixture();let normalize,fail;
 f.ctx.normalizeOpenAlexWork=()=>new Promise(resolve=>normalize=resolve);
 f.ctx.fetch=async()=>({ok:true,json:async()=>({results:[{title:'Old'}],meta:{count:1}})});
 f.ctx.playFind();f.type('Old');const first=f.button('OpenAlex').onclick();await new Promise(resolve=>setImmediate(resolve));
 f.CList.readers.new={label:'New',supportsFindContext:true,search:async(q,context)=>context.empty('New results')};
 f.ctx.playFind();f.type('New');await f.button('New').onclick();normalize({title:'Old normalized'});await first;
 assert.match(f.feed.textContent,/New results/);assert.equal(f.feed.textContent.includes('Old normalized'),false);
 f.ctx.fetch=()=>new Promise((resolve,reject)=>fail=reject);f.ctx.playFind();f.type('Old error');const pending=f.button('OpenAlex').onclick();
 f.type('New');await f.button('New').onclick();fail(Error('Stale network'));await pending;assert.equal(f.serviceErrors.length,0);
});
test('empty provider results display literal query text and current failures report once with cleanup',async()=>{
 const f=fixture();f.ctx.playFind();f.type('<script>query</script>');await f.button('OpenAlex').onclick();
 assert.match(f.feed.textContent,/<script>query<\/script>/);assert.equal(f.feed.querySelector('script'),null);
 f.ctx.fetch=async()=>{throw Error('Offline');};await f.button('OpenAlex').onclick();assert.equal(f.serviceErrors.length,1);assert.equal(f.CList.state.find.status,'failed');
 assert.equal(f.button('OpenAlex').getAttribute('aria-busy'),'false');
});
test('view can render provider choices from explicit values without reading shared state',()=>{
 const f=fixture();Object.defineProperty(f.CList,'state',{get(){throw Error('View read state');}});
 const panel=f.CList.ui.find.mount([{key:'x',label:'<img> literal',select(){}}],'Query',()=>{});assert.match(panel.textContent,/<img> literal/);
 assert.equal(panel.querySelector('img'),null);
});

test('session expiry cleans the old busy state and live typing rebinds the panel for a new explicit public search',async()=>{
 const f=fixture();let finish;
 f.CList.readers.test={label:'Test',supportsFindContext:true,search:()=>new Promise(resolve=>finish=resolve)};
 f.ctx.playFind();f.type('Old');const button=f.button('Test'),pending=button.onclick();f.token(null);finish();await pending;
 assert.equal(f.CList.state.find.status,'cancelled');assert.equal(button.getAttribute('aria-busy'),'false');
 let captured;f.CList.readers.test.search=async query=>captured=query;await button.onclick();assert.equal(captured,undefined);
 f.type('Current');await button.onclick();assert.equal(captured,'Current');assert.equal(f.CList.state.find.status,'ready');
});

test('actual legacy provider registrations retain captured initial queries and Google Web/Images arguments',async()=>{
 const f=fixture(),calls=[];
 for(const name of ['googlesearch','duckduckgo','oasis'])vm.runInContext(read(name),f.ctx);
 f.ctx.googleSearch=async(query,type)=>calls.push({provider:'google',query,type});
 f.ctx.duckduckgoSearch=async query=>calls.push({provider:'duckduckgo',query});f.ctx.oasisSearch=async query=>calls.push({provider:'oasis',query});
 f.ctx.playFind();f.type('Captured query');f.input().value='DOM tampered';
 await f.button('Google').onclick();await f.button('DuckDuckGo').onclick();await f.button('OASIS OERs').onclick();
 await f.CList.readers.google.feedFunctions.Images();await f.CList.readers.google.feedFunctions.Web();
 assert.equal(calls.length,5);assert.equal(calls.every(call=>call.query==='Captured query'),true);assert.equal(calls[3].type,'image');assert.equal(calls[4].type,undefined);
 f.type('');await f.CList.readers.google.search();await f.CList.readers.duckduckgo.search();await f.CList.readers.oasis.search();
 assert.equal(calls.length,5);assert.equal(f.errors.length,3);
});
