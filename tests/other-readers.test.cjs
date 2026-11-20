const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {Element}=require('./helpers/account-fixture.cjs');
const source=name=>fs.readFileSync('js/'+name+'.js','utf8');
class Node extends Element {
 replaceChildren(...nodes){for(const child of this.children){child.parentNode=null;child.isConnected=false;}this.children=[];this.text='';nodes.forEach(node=>this.appendChild(node));}
 contains(node){return this===node||this.children.some(child=>child.contains?.(node));}
}
const defer=()=>{let resolve;const promise=new Promise(done=>resolve=done);return{promise,resolve};};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const response=(data,status=200)=>({ok:status>=200&&status<300,status,json:async()=>data});
function fixture(){
 const requests=[],renders=[],errors=[],opened=[],notices=[];const feed=new Node(),picker=new Node();let token='alice',serial=0,responder=async()=>response([]);
 const cList={state:{username:'alice'},config:{flaskSiteUrl:'https://store.invalid'},defaults:{LOCALRSS:'https://rss.invalid'},schemas:{},readers:{},publishers:{},ui:{view:{feedContainer:feed}}};
 const sandbox={window:{CList:cList},document:{createElement:tag=>new Node(tag)},structuredClone,URLSearchParams,console:{error(){}},
  kvstoreAuthHeader:()=>({Authorization:'Bearer '+token}),_localrssAuthHeaders:()=>({Authorization:'Bearer '+token,'X-Kvstore-Url':cList.config.flaskSiteUrl}),
  base64UrlEncode:value=>'encoded-'+encodeURIComponent(value),escapeHtml:value=>String(value).replace(/</g,'&lt;').replace(/>/g,'&gt;'),
  SafeHtml:class{constructor(value){this.value=value;}},showServiceError:(container,title,message)=>errors.push({container,title,message}),
  openInBrowser:url=>opened.push(url),toggleEntryExpanded:id=>notices.push(id),fetch:async(url,options)=>{requests.push({url,options});return responder(url,options);}};
 const ctx=vm.createContext(sandbox);
 const context=(account={},key=++serial)=>{const session={token,username:cList.state.username,storeUrl:cList.config.flaskSiteUrl};const current=()=>key===serial&&token===session.token&&cList.state.username===session.username&&cList.config.flaskSiteUrl===session.storeUrl;
  return{account,signal:new AbortController().signal,isCurrent:current,isAccountCurrent:current,commit:fn=>{if(current())fn();},render:async(items,options)=>{if(!current())return;const normalized=[];for(const item of items){normalized.push(await options.normalize(item));if(!current())return;}renders.push({items,normalized,options});}};};
 ctx.readerSession=()=>({token,username:cList.state.username,storeUrl:cList.config.flaskSiteUrl});ctx.captureReaderSurface=()=>context();
 for(const name of ['discord','discord_reader','discord_view','public-feeds','public-feed-requests','public-feed-view','public-feed-reader'])vm.runInContext(source(name),ctx);
 return{ctx,cList,requests,renders,errors,opened,notices,feed,picker,context,response:fn=>{responder=fn;},token:value=>{token=value;},expire:()=>{serial++;}};
}
test('Discord initial selection fetches its captured channel and normalizes it explicitly',async()=>{
 const f=fixture();f.response(async()=>response([{id:'one',content:'Message',author:'Author'}]));const context=f.context({channel:'original channel'});
 const pending=f.cList.readers.Discord.initialize(context.account,context);context.account.channel='changed';f.token('bob');await pending;
 assert.equal(f.requests[0].url,'https://discord.mooc.ca/messages?channel=original%20channel');assert.equal(f.requests[0].options.headers.Authorization,'Bearer alice');assert.equal(f.renders.length,0);
 f.token('alice');const next=f.context({channel:'actual'});await f.cList.readers.Discord.initialize(next.account,next);assert.equal(f.renders[0].normalized[0].feed,'actual');assert.equal(f.renders[0].options.typevalue,'actual');
});
test('Discord stale A response cannot replace B and empty channel has visible feedback',async()=>{
 const f=fixture(),gate=defer();f.response((url)=>url.includes('channel=A')?gate.promise:response([{id:'b',content:'B'}]));
 const a=f.context({channel:'A'}),pending=f.cList.readers.Discord.initialize(a.account,a);await tick();const b=f.context({channel:'B'});await f.cList.readers.Discord.initialize(b.account,b);
 gate.resolve(response([{id:'a',content:'A'}]));await pending;assert.equal(f.renders.length,1);assert.equal(f.renders[0].normalized[0].feed,'B');
 const empty=f.context({channel:''});await f.cList.readers.Discord.initialize(empty.account,empty);assert.match(f.feed.textContent,/No channel selected/);
});
test('Discord transport failures reject to the reader controller without adapter UI writes',async()=>{
 const f=fixture();f.response(async()=>response({},503));const current=f.context({channel:'channel'});
 await assert.rejects(f.cList.readers.Discord.initialize(current.account,current),/HTTP 503/);assert.equal(f.errors.length,0);assert.equal(f.feed.children.length,0);
});
test('public account reads capture private database, proxy route and auth headers while public reads omit credentials',async()=>{
 const f=fixture();f.ctx.window._launcherConfig={proxyBase:'https://proxy.invalid'};
 f.response(async()=>response([{id:1,link:'https://item.invalid',title:'Item',content_html:'<b>Body</b>'}]));
 const c=f.context({collectionSlug:'news',title:'Private',serviceUrl:'https://remote.invalid/',database:'db original'});
 await f.cList.readers.PublicFeed.initialize(c.account,c);
 assert.match(f.requests[0].url,/^https:\/\/proxy.invalid\/encoded-/);assert.match(f.requests[0].url,/db=db\+original/);assert.equal(f.requests[0].options.headers.Authorization,'Bearer alice');
 assert.equal(f.renders[0].normalized[0].title,'Item');assert.equal(f.renders[0].normalized[0].desc,'Body');
 await f.ctx.loadPublicFeed('news','Public','https://rss.invalid','');assert.match(f.requests.at(-1).url,/api\/collections\/news\/items/);assert.equal(f.requests.at(-1).options.headers,undefined);
});
test('public late reads and session changes suppress rendering and visible stale errors',async()=>{
 const f=fixture(),gate=defer();f.response(()=>gate.promise);const pending=f.ctx.loadPublicFeed('news','News');f.token('bob');gate.resolve(response([{link:'https://old.invalid'}]));await pending;
 assert.equal(f.renders.length,0);assert.equal(f.errors.length,0);
});
test('changelog requests return successful repositories and expose partial failures in owned feedback',async()=>{
 const f=fixture();f.response(async(url)=>url.includes('/CList/')?response([{sha:'one',html_url:'https://commit.invalid',commit:{message:'Title\nBody',author:{date:'2026-11-20'}}}]):response({},503));
 await f.ctx.loadPublicFeed('clist-changelog','Changelog');assert.equal(f.renders.length,1);assert.equal(f.renders[0].items.length,1);
 assert.equal(f.renders[0].normalized[0].author,'Stephen Downes');assert.ok(f.errors.length>0);assert.ok(f.errors.every(error=>error.title.startsWith('Could not load')));
});
test('public picker retains literal labels, rejects replaced source callbacks and ignores late lists',async()=>{
 const f=fixture(),gate=defer();f.response(()=>gate.promise);const pending=f.ctx.renderPublicFeedsList(f.picker);const stale=f.picker.querySelector('button');
 f.picker.replaceChildren(new Node());gate.resolve(response([{slug:'old',title:'Old'}]));await pending;const before=f.requests.length;await stale.onclick();assert.equal(f.requests.length,before);
 f.response(async()=>response([{slug:'safe',title:'Literal <b>title</b>'}]));await f.ctx.renderPublicFeedsList(f.picker);const controls=f.picker.querySelectorAll('button');assert.equal(controls.at(-1).textContent,'publicLiteral <b>title</b>');
 const button=controls.at(-1);f.token('new');await button.onclick();assert.equal(f.requests.length,before+1);
});
test('public row bindings capture URLs and reject removed rows or changed accounts',()=>{
 const f=fixture(),row=new Node(),actions=new Node(),specific=new Node();actions.className='status-actions';specific.className='statusSpecific';specific.id='original-item';row.append(actions,specific);
 const context=f.context();f.ctx.bindPublicFeedRow({url:'https://source.invalid',link:'https://source.invalid',_hasExpandableContent:true},row,context);
 const buttons=actions.querySelectorAll('button');buttons[0].onclick();buttons[1].onclick();assert.deepEqual(f.notices,['original-item']);assert.deepEqual(f.opened,['https://source.invalid']);
 row.isConnected=false;buttons[1].onclick();assert.equal(f.opened.length,1);row.isConnected=true;f.expire();buttons[0].onclick();assert.equal(f.notices.length,1);
});
