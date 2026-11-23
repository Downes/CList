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

test('migrated provider registrations receive the captured query and context',async()=>{
 const f=fixture(),calls=[];
 for(const name of ['googlesearch','duckduckgo','oasis'])vm.runInContext(read(name),f.ctx);
 f.ctx.googleSearch=async(query,type,start,context)=>calls.push({query,context});
 f.ctx.duckduckgoSearch=async(query,context)=>calls.push({query,context});f.ctx.oasisSearch=async(query,start,context)=>calls.push({query,context});
 f.ctx.playFind();f.type('Captured query');f.input().value='DOM tampered';
 for(const name of ['Google','DuckDuckGo','OASIS OERs'])await f.button(name).onclick();
 assert.equal(calls.length,3);assert.equal(calls.every(call=>call.query==='Captured query'&&call.context.query==='Captured query'),true);
});

test('Find mode navigation retains its captured query and row lifetime across page generations only',async()=>{
 const f=fixture(),contexts=[];f.CList.readers.test={label:'Test',supportsFindContext:true,search:async(query,context)=>contexts.push(context)};
 f.ctx.playFind();f.type('Original query');await f.button('Test').onclick();const context=contexts[0];f.type('New draft');
 await context.next(async()=>{});assert.equal(context.isCurrent(),false);assert.equal(context.isAccountCurrent(),true);
 let seen;await context.navigate(async next=>{seen=next.query;});assert.equal(seen,'Original query');
 f.token('changed-session');assert.equal(context.isAccountCurrent(),false);await context.navigate(async()=>{seen='incorrect';});assert.equal(seen,'Original query');
});


function providerFixture(){
 const f=fixture(),menus=[];
 for(const name of ['search-provider-view','googlesearch','duckduckgo','oasis'])vm.runInContext(read(name),f.ctx);
 f.CList.ui.reader.menu=(names,selected,select)=>menus.push({names,selected,select});
 f.ctx.kvstoreAuthHeader=()=>({Authorization:'Bearer proxy-fixture'});
 f.CList.accounts=[{key:'google',value:JSON.stringify({title:'Google Search',id:'fixture-api-key',instance:'fixture-engine'})}];
 f.ctx.DOMParser=class{parseFromString(){return{querySelector:()=>null,body:{textContent:''},querySelectorAll:()=>[]};}};
 return {...f,menus};
}
test('Google actual transport captures credentials/query for paging and mode navigation, rejecting old menus and changed accounts',async()=>{
 const f=providerFixture();let pending;const urls=[];
 f.ctx.fetch=async(url,options)=>{urls.push({url:new URL(url),options});return {ok:true,json:async()=>({items:[{link:'https://result.invalid',title:'Page '+urls.length,snippet:'Description'}],queries:{nextPage:[{startIndex:21}]}})};};
 f.ctx.playFind();f.type('Original & query');await f.button('Google').onclick();
 const old=f.menus.at(-1),more=f.feed.querySelector('#google-load-more');f.type('New draft');await more.onclick();
 assert.equal(urls[1].url.searchParams.get('start'),'21');assert.equal(urls[1].url.searchParams.get('q'),'Original & query');
 await old.select('Images');assert.equal(urls[2].url.searchParams.get('searchType'),'image');assert.equal(urls[2].url.searchParams.get('q'),'Original & query');
 assert.equal(urls[2].url.searchParams.get('key'),'fixture-api-key');assert.equal(urls[2].options.signal instanceof AbortSignal,true);
 f.type('Replacement');await f.button('Google').onclick();const count=urls.length;await old.select('Web');assert.equal(urls.length,count);
 const current=f.menus.at(-1);f.CList.accounts[0].value='changed';await current.select('Images');assert.equal(urls.length,count);
});
test('all migrated providers reject stale results/errors and abort superseded transport',async()=>{
 for(const name of ['Google','DuckDuckGo','OASIS OERs']){
  const f=providerFixture();let finish,signal;f.ctx.fetch=(url,options)=>{signal=options.signal;return new Promise(resolve=>finish=resolve);};
  f.CList.readers.other={label:'Other',supportsFindContext:true,search:async(q,context)=>context.empty('Current results')};
  f.ctx.playFind();f.type('Old');const pending=f.button(name).onclick();await new Promise(resolve=>setImmediate(resolve));
  f.type('New');await f.button('Other').onclick();assert.equal(signal.aborted,true,name);
  finish({ok:false,status:403,json:async()=>({error:{message:'Expired'}}),text:async()=>'<div>Old</div>'});await pending;
  assert.match(f.feed.textContent,/Current results/);assert.equal(f.serviceErrors.length,0,name);
 }
});
test('Google failed continuations preserve rows, allow explicit retry and never repeat automatically',async()=>{
 const f=providerFixture();let calls=0;f.ctx.fetch=async()=>{calls++;if(calls===2)throw Error('Unreachable');return {ok:true,json:async()=>({items:[{title:'Page '+calls,link:'https://result.invalid'}],queries:{nextPage:[{startIndex:11}]}})};};
 f.ctx.playFind();f.type('Query');await f.button('Google').onclick();const more=f.feed.querySelector('#google-load-more');await more.onclick();
 assert.equal(calls,2);assert.equal(f.CList.state.find.status,'failed');assert.match(f.feed.textContent,/Page 1/);assert.equal(f.serviceErrors.length,1);
 await more.onclick();assert.equal(calls,3);assert.equal(f.CList.state.find.status,'ready');assert.match(f.feed.textContent,/Page 3/);
});
test('DDG retains every nested topic and OASIS captures encoded query and proxy headers',async()=>{
 const f=providerFixture();f.ctx.fetch=async()=>({ok:true,json:async()=>({Heading:'Topics',RelatedTopics:[{Topics:[{FirstURL:'https://one',Text:'First'},{FirstURL:'https://two',Text:'Second'}]},{FirstURL:'https://three',Text:'Third'}]})});
 f.ctx.playFind();f.type('Topic');await f.button('DuckDuckGo').onclick();assert.match(f.feed.textContent,/FirstSecondThird/);
 const calls=[];f.ctx.fetch=async(url,options)=>{calls.push({url,options});return{ok:true,text:async()=>'<html>Parsed separately</html>'};};
 f.ctx.parseOasisHtml=()=>[{title:'OER result',url:'https://oer',itemType:'Book',description:'Description',source:'Source',author:'Author'}];
 f.type('a & b + c');await f.button('OASIS OERs').onclick();
 const dest=new URL(calls[0].options.body.get('url'));assert.equal(dest.searchParams.get('search_query'),'a & b + c');assert.equal(calls[0].options.headers.Authorization,'Bearer proxy-fixture');assert.match(f.feed.textContent,/OER result/);
});
test('provider request functions run with explicit dependencies and no DOM or shared state',async()=>{
 const ctx=vm.createContext({window:{CList:{readers:{}}},URL,URLSearchParams});
 for(const name of ['googlesearch','duckduckgo','oasis'])vm.runInContext(read(name),ctx);
 const deps={fetch:async()=>({ok:false,status:429,json:async()=>({error:{message:'Rate limited'}})})};
 await assert.rejects(ctx.requestGoogleSearch('q',undefined,1,{id:'key',instance:'engine'},deps),/Rate limited/);
 await assert.rejects(ctx.requestDuckduckgoSearch('q',deps),/429/);await assert.rejects(ctx.requestOasisSearch('q',0,{...deps,headers:{}}),/429/);
 assert.equal('document' in ctx,false);
});
test('search row callbacks use captured targets, preserve old pages and reject detached/session-stale rows',async()=>{
 const f=providerFixture(),calls=[],row=new Element();row.id='original';const bar=new Element();bar.className='service-status-actions';row.appendChild(bar);
 f.ctx.openInBrowser=(url,id)=>calls.push([url,id]);f.ctx.toggleEntryExpanded=id=>calls.push(id);let current=true;
 const item={url:'https://original',_hasExpandableContent:true};f.ctx.bindSearchProviderRow(item,row,{isAccountCurrent:()=>current});item.url='https://changed';
 await bar.children.find(button=>button.title==='Open in browser').click();assert.deepEqual(calls,[['https://original','original']]);
 row.isConnected=false;await bar.children[0].click();current=false;row.isConnected=true;await bar.children[0].click();assert.equal(calls.length,1);
});


test('Google reports empty/missing credentials and rejects an account changed during the request',async()=>{
 const f=providerFixture();f.ctx.fetch=async()=>({ok:true,json:async()=>({})});
 f.ctx.playFind();f.type('<literal>');await f.button('Google').onclick();assert.match(f.feed.textContent,/<literal>/);assert.match(f.feed.textContent,/No results found/);
 let finish;f.ctx.fetch=()=>new Promise(resolve=>finish=resolve);const pending=f.button('Google').onclick();await new Promise(resolve=>setImmediate(resolve));
 f.CList.accounts[0].value=JSON.stringify({title:'Google Search',id:'changed',instance:'engine'});finish({ok:true,json:async()=>({items:[{title:'Stale account result'}]})});await pending;
 assert.equal(f.feed.textContent.includes('Stale account result'),false);assert.match(f.serviceErrors.at(-1).message,/account changed/);
 f.CList.accounts[0].value=JSON.stringify({title:'Google Search'});await f.button('Google').onclick();assert.match(f.serviceErrors.at(-1).message,/API key/);
});


test('browser provider selection uses the label span rather than Material Icon text',async()=>{
 const f=providerFixture();let selected;f.ctx.oasisSearch=async query=>{selected=query;};
 f.ctx.playFind();f.type('Captured query');
 assert.equal(f.button('OASIS OERs').textContent,'schoolOASIS OERs');
 f.ctx.document.querySelectorAll=()=>f.left.querySelectorAll('button');
 const html=fs.readFileSync('tests/search-providers.browser.html','utf8');
 const select=html.split('\n').find(line=>line.trim().startsWith('const select='));
 await vm.runInContext(select+"\nselect('OASIS OERs');",f.ctx);assert.equal(selected,'Captured query');
});


test('OpenAlex and Commons registry bindings keep captured row actions across pagination and reject replacement',async()=>{
 for(const key of ['openalex','commons']){
  const f=providerFixture(),calls=[],rows=[];let sequence=0;
  f.ctx.openInBrowser=(url,id)=>calls.push({url,id});f.ctx.toggleEntryExpanded=id=>calls.push({id});
  f.ctx.makeListing=(item,{rowContext})=>{const row=new Element();row.id='row-'+(++sequence);row.textContent=item.title;
   const bar=new Element();bar.className='service-status-actions';row.appendChild(bar);f.CList.readers[key].bindRow({...item,_hasExpandableContent:true},row,rowContext);rows.push(row);return row;};
  f.ctx[key==='openalex'?'normalizeOpenAlexWork':'normalizeCommonsPage']=async raw=>({title:raw.title,url:'https://captured.invalid'});
  f.ctx.fetch=async()=>({ok:true,json:async()=>key==='openalex'?{results:[{title:'Result'}],meta:{count:75}}:{query:{pages:{1:{title:'Result',imageinfo:[{url:'https://image.invalid'}]}}},continue:{gsroffset:20}}});
  f.ctx.playFind();f.type('Original');await f.button(key==='openalex'?'OpenAlex':'Wikimedia Commons').onclick();
  assert.equal(f.CList.readers[key].statusActions(), '');const first=rows[0],buttons=first.querySelectorAll('button'),open=buttons.find(button=>button.title==='Open in browser');
  assert.equal(typeof open.onclick,'function');await f.feed.querySelector('#'+key+'-load-more').onclick();await open.click();await buttons.find(button=>button.title==='Expand').click();
  assert.deepEqual(calls,[{url:'https://captured.invalid',id:first.id},{id:first.id}]);
  first.isConnected=false;await open.click();assert.equal(calls.length,2);first.isConnected=true;
  f.type('Replacement');await f.button(key==='openalex'?'OpenAlex':'Wikimedia Commons').onclick();await open.click();assert.equal(calls.length,2);
 }
});
