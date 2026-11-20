const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {Element:Base}=require('./helpers/account-fixture.cjs');
class Element extends Base {
 replaceChildren(...nodes){this.children=[];this.text='';this.append(...nodes);}
 removeAttribute(key){delete this[key];}
 get classList(){const owner=this;return{toggle(key,value){const values=new Set((owner.className||'').split(' ').filter(Boolean));if(value===undefined)value=!values.has(key);if(value)values.add(key);else values.delete(key);owner.className=[...values].join(' ');},contains(key){return(owner.className||'').split(' ').includes(key);}};}
}
const read=name=>fs.readFileSync('js/'+name+'.js','utf8');
const defer=()=>{let resolve;const promise=new Promise(done=>resolve=done);return{promise,resolve};};
function fixture(){
 const requests=[],renders=[],errors=[],messages=[],forms=[],navigation=[];let responder=async()=>({ok:true,status:200,headers:{get:()=>null},json:async()=>[]});
 let currentAccount='a',generation=0;
 const cList={state:{},schemas:{},readers:{},publishers:{},ui:{view:{feedContainer:new Element()},socialPostLine:(author,acct,verb,text)=>author+' '+text}};
 const ctx=vm.createContext({window:{CList:cList},document:{createElement:tag=>new Element(tag)},URL,structuredClone,console:{error(){},log(){}},
  extractBaseUrl:value=>value.startsWith('http')?value:'https://'+value.split('@').at(-1),escapeHtml:value=>String(value||'').replaceAll('<','&lt;'),_he:value=>String(value||'').replaceAll('<','&lt;'),
  OAuthClient:{onCallback(){}},SafeHtml:class{constructor(value){this.value=value;}},processTranslationWithTimeout:async value=>value,
  showStatusMessage:text=>messages.push(text),showServiceError:(root,title,text)=>errors.push(text),showErrorModal:text=>errors.push(text),
  openLeftInterface:root=>forms.push(root),openInBrowser(){},toggleEntryExpanded(){},loadContentToEditor(){},
  fetch:async(url,options)=>{requests.push({url,options});return responder(url,options);}});
 for(const name of ['mastodon','mastodon_requests','mastodon_view','mastodon_actions','mastodon_reader'])vm.runInContext(read(name),ctx);
 function context(id='a'){
  const request=++generation,account={type:'Mastodon',instance:'https://'+id+'.invalid',id:'token-'+id};
  const context={account,signal:undefined,isCurrent:()=>currentAccount===id&&generation===request,isAccountCurrent:()=>currentAccount===id,
   commit:fn=>{if(context.isCurrent())fn();},render:async(items,options)=>{if(context.isCurrent())renders.push({items,options});},
   navigate:async(fn,name)=>{if(!context.isAccountCurrent())return;navigation.push(name);return fn(makeNext());},
   next:async fn=>{if(context.isCurrent())return fn(makeNext());}};
  const makeNext=()=>contextFor(account,id);return context;
 }
 function contextFor(account,id){const next=context(id);next.account=account;return next;}
 const response=(data,next=null)=>({ok:true,status:200,headers:{get:()=>next?'<'+next+'>; rel="next"':null},json:async()=>data});
 function row(){const root=new Element(),bar=new Element();bar.className='status-actions';root.appendChild(bar);return root;}
 return{ctx,cList,requests,renders,errors,messages,forms,navigation,context,row,response,responder:fn=>{responder=fn;},switch:id=>{currentAccount=id;},tick:()=>new Promise(resolve=>setImmediate(resolve))};
}
const status=(id='one')=>({id,url:'https://a.invalid/@author/'+id,account:{acct:'author',display_name:'Author'},content:'<p>Content</p>',media_attachments:[],reblogged:false,favourited:false,bookmarked:false});

test('Mastodon explicit transport uses captured credentials and rejects foreign pagination destinations',async()=>{
 const f=fixture(),account={instance:'https://a.invalid',id:'original'};f.responder(async()=>f.response([status()]));
 await f.ctx.readMastodonPage(account,{kind:'hashtag',value:'#two words'});
 assert.match(f.requests[0].url,/timelines\/tag\/two%20words$/);assert.equal(f.requests[0].options.headers.Authorization,'Bearer original');
 await assert.rejects(f.ctx.readMastodonPage(account,{kind:'home'},'https://evil.invalid/next'),/invalid pagination/);
 assert.equal(f.requests.length,1);
});
test('reader account switch rejects a stale feed result and keeps raw page inputs detached',async()=>{
 const f=fixture(),gate=defer(),context=f.context();f.responder(()=>gate.promise);
 const pending=f.ctx.selectMastodonFeed(context,'home');f.switch('b');gate.resolve(f.response([status()]));await pending;
 assert.equal(f.renders.length,0);assert.equal(f.requests[0].options.headers.Authorization,'Bearer token-a');
});
test('pagination uses next owned request and preserves captured selection',async()=>{
 const f=fixture(),context=f.context();f.responder(async(url)=>f.response([status()],url.includes('?page=2')?null:'https://a.invalid/api/v1/bookmarks?page=2'));
 await f.ctx.selectMastodonFeed(context,'bookmarks');const first=f.renders[0];await first.options.onLoadMore();
 assert.equal(f.renders.length,2);assert.equal(f.renders[1].options.append,true);assert.match(f.requests[1].url,/bookmarks\?page=2$/);
 await first.options.onLoadMore();assert.equal(f.requests.length,2,'superseded pagination callbacks do not reload');
});
test('thread combines ancestors/current/descendants and notifications without a status remain visible',async()=>{
 const f=fixture(),account=f.context().account;f.responder(async url=>f.response(url.endsWith('/context')?{ancestors:[status('before')],descendants:[status('after')]}:status('current')));
 const page=await f.ctx.readMastodonPage(account,{kind:'thread',value:'current'});assert.deepEqual(Array.from(page.items,item=>item.id),['before','current','after']);
 const item=await f.ctx.normalizeMastodonReaderItem({id:'n',type:'follow',account:{acct:'follower',display_name:'Follower'}},'notifications');assert.match(item.title,/followed you/);assert.equal(item.mastodon.statusId,null);
});
test('normalization removes inline author/reblog account navigation',async()=>{
 const f=fixture();const item=await f.ctx.normalizeMastodonReaderItem({...status('boost'),reblog:status('actual')},'home');
 assert.equal(item.replyToken.statusId,'actual');assert.equal(item.titleHtml.includes('onclick='),false);assert.equal(item.mastodon.headerActor.acct,'author');
});
test('row actions keep closure-owned flags and captured account across pagination',async()=>{
 const f=fixture(),context=f.context(),row=f.row();f.responder(async()=>f.response({favourited:true}));
 f.ctx.bindMastodonRow({url:status().url,mastodon:{statusId:'original',isFavourited:false}},row,context);
 const favorite=row.querySelectorAll('button').find(button=>button.title==='Favourite');favorite.className+=' action-active';
 await context.next(async()=>{});await favorite.onclick();assert.match(f.requests[0].url,/original\/favourite$/,'button class does not determine action');
 await favorite.onclick();assert.match(f.requests[1].url,/original\/unfavourite$/);assert.equal(f.requests[1].options.headers.Authorization,'Bearer token-a');
});
test('duplicate toggle clicks, removed rows and switched accounts cannot repeat or redirect writes',async()=>{
 const f=fixture(),context=f.context(),row=f.row(),gate=defer();f.responder(()=>gate.promise);
 f.ctx.bindMastodonRow({mastodon:{statusId:'original'}},row,context);const favorite=row.querySelectorAll('button').find(button=>button.title==='Favourite');
 const pending=favorite.onclick();await favorite.onclick();assert.equal(f.requests.length,1);row.isConnected=false;gate.resolve(f.response({}));await pending;
 await favorite.onclick();assert.equal(f.requests.length,1);row.isConnected=true;f.switch('b');await favorite.onclick();assert.equal(f.requests.length,1);
});
test('uncertain action failure is visible, leaves state unchanged and requires explicit retry',async()=>{
 const f=fixture(),context=f.context(),row=f.row();f.responder(async()=>{throw Error('Connection lost');});
 f.ctx.bindMastodonRow({mastodon:{statusId:'one'}},row,context);const button=row.querySelectorAll('button').find(button=>button.title==='Bookmark');
 await button.onclick();assert.equal(f.requests.length,1);assert.equal(button.disabled,false);assert.equal(button.classList.contains('action-active'),false);assert.match(f.messages.at(-1),/Connection lost/);
 f.responder(async()=>f.response({}));await button.onclick();assert.match(f.requests[1].url,/one\/bookmark$/);
});
test('captured Post/Reply forms preserve failed/newer drafts and reject stale owners before transport',async()=>{
 const f=fixture(),context=f.context();let options,gate=defer();
 f.ctx.publishMastodonStatus=async(token,base,text,reply,extra)=>{options={token,base,text,reply,extra};return gate.promise;};
 f.ctx.showMastodonPost(context,'reply-original');let form=f.forms.at(-1);const input=form.querySelector('textarea'),button=form.querySelector('button');input.value='Original';
 const pending=button.onclick();await button.onclick();input.value='Newer';gate.resolve('https://a.invalid/post');await pending;assert.equal(input.value,'Newer');assert.equal(options.reply,'reply-original');assert.equal(options.token,'token-a');
 f.ctx.publishMastodonStatus=async()=>{throw Error('Offline');};await button.onclick();assert.equal(input.value,'Newer');assert.match(form.textContent,/Offline/);
 f.ctx.publishMastodonStatus=async()=> 'https://a.invalid/post';await button.onclick();assert.equal(input.value,'');
 input.value='Stale';f.switch('b');await button.onclick();assert.equal(input.value,'Stale');
});
test('Mastodon publication guard runs after optional limit lookup and before POST',async()=>{
 const f=fixture();vm.runInContext(read('mastodon_publish'),f.ctx);let allowed=true;const gate=defer();f.responder(()=>gate.promise);
 const pending=f.ctx.publishMastodonStatus('captured','https://a.invalid','Draft',null,{assertCurrent(){if(!allowed)throw Error('Form expired');}});
 allowed=false;gate.resolve(f.response({configuration:{statuses:{max_characters:500}}}));await assert.rejects(pending,/Form expired/);assert.equal(f.requests.length,1);assert.match(f.requests[0].url,/api\/v1\/instance$/);
});
