const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const read=name=>fs.readFileSync('js/'+name+'.js','utf8');
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const post=(uri='at://did:author/app.bsky.feed.post/post')=>({uri,cid:'post-cid',author:{handle:'author.test',displayName:'Author'},record:{text:'Body',createdAt:'2026-11-20'},viewer:{}});
function fixture(){
 const auth=[],requests=[],rendered=[],errors=[],states=[],forms=[],navigations=[];let responder=async()=>({ok:true,json:async()=>({feed:[{post:post()}],cursor:null})});
 let accountAlive=true,requestAlive=true;
 const cList={state:{},schemas:{},readers:{},ui:{socialPostLine:(author,handle,label,desc)=>author+' '+label+' '+desc}};
 const ctx=vm.createContext({window:{CList:cList},structuredClone,URLSearchParams,console:{error(){},log(){}},
  _he:value=>String(value),_heJs:value=>String(value),processTranslationWithTimeout:async value=>value,
  createBlueskyAccountSession:async account=>{auth.push(structuredClone(account));return{accessToken:account.instance+'-token',did:'did:'+account.instance,pds:'https://'+account.instance};},
  fetch:async(url,options)=>{requests.push({url,options});return responder(url,options);},
  showStatusMessage:message=>errors.push(message),openInBrowser(){},toggleEntryExpanded(){},
  publishBlueskyRecord:async(session,text,reply)=>{forms.push({session,text,reply});return'https://post.invalid';},
 });
 for(const name of ['bluesky','bluesky_requests','bluesky_reader'])vm.runInContext(read(name),ctx);
 cList.ui.blueskyReader={buttons(row,item,callbacks){row.actions=callbacks;return{favorite:{},repost:{}};},toggle:(button,active,busy)=>states.push({button,active,busy}),
  error:error=>errors.push(error.message),compose(reply,submit,current){forms.push({reply,submit,current});},search(select,current){forms.push({select,current});},feeds(feeds,select,current){forms.push({feeds,select,current});}};
 const context=()=>({accountKey:'selected',signal:new AbortController().signal,isAccountCurrent:()=>accountAlive,isCurrent:()=>requestAlive,
  render:async(items,options)=>{rendered.push({items,options});for(const item of items)await options.normalize(item);},
  next:async load=>{const next=context();return load(next);},navigate:async(load,title)=>{navigations.push(title);return load(context());}});
 const account={type:'Bluesky',instance:'alice.test',id:'alice-password'};
 return{ctx,cList,auth,requests,rendered,errors,states,forms,navigations,account,context,
  response:fn=>{responder=fn;},alive:value=>{accountAlive=value;},request:value=>{requestAlive=value;}};
}
test('Bluesky initialize authenticates the selected detached account and renders its timeline',async()=>{
 const f=fixture(),context=f.context();const pending=f.cList.readers.Bluesky.initialize(f.account,context);f.account.instance='wrong.test';f.account.id='wrong';await pending;
 assert.equal(f.auth[0].instance,'alice.test');assert.equal(f.auth[0].id,'alice-password');
 assert.match(f.requests[0].url,/alice\.test\/xrpc\/app.bsky.feed.getTimeline/);assert.equal(f.requests[0].options.headers.Authorization,'Bearer alice.test-token');
 assert.equal(f.rendered.length,1);assert.equal(f.cList.readers.Bluesky.supportsRequestContext,true);
});
test('late authentication and feed responses cannot render another selected account',async()=>{
 const f=fixture(),gate=deferred();f.ctx.createBlueskyAccountSession=()=>gate.promise;
 const first=f.cList.readers.Bluesky.initialize(f.account,f.context());f.alive(false);gate.resolve({accessToken:'old',did:'did:old',pds:'https://old'});
 await assert.rejects(first,/account changed/);assert.equal(f.requests.length,0);
 const g=fixture(),page=deferred();g.response(()=>page.promise);const second=g.cList.readers.Bluesky.initialize(g.account,g.context());await tick();g.request(false);
 page.resolve({ok:true,json:async()=>({feed:[{post:post()}]})});await second;assert.equal(g.rendered.length,0);
});
test('pagination retains opaque cursors and filtering while old callbacks delegate through context.next',async()=>{
 const f=fixture();let pages=0;f.response(async()=>({ok:true,json:async()=>({feed:[{post:post()}],cursor:++pages===1?'opaque-cursor':null})}));
 await f.cList.readers.Bluesky.initialize(f.account,f.context());assert.equal(typeof f.rendered[0].options.onLoadMore,'function');
 await f.rendered[0].options.onLoadMore();assert.match(f.requests[1].url,/cursor=opaque-cursor/);assert.equal(f.rendered[1].options.append,true);
});
test('all feed variants, notifications and thread reads use explicit captured session and targets',async()=>{
 const f=fixture();await f.cList.readers.Bluesky.initialize(f.account,f.context());
 for(const name of ['Favorites','Notifications',"What's Hot"])await f.cList.readers.Bluesky.feedFunctions[name](f.context());
 await f.ctx.fetchBlueskySearch('literal query','latest');await f.ctx.fetchBlueskyUserFeed('other.test');
 f.response(async()=>({ok:true,json:async()=>({thread:{post:post(),replies:[{post:post('at://did:a/app.bsky.feed.post/reply')}]}})}));await f.ctx.displayThread('at://thread');
 assert.ok(f.requests.some(request=>request.url.includes('getActorLikes')&&request.url.includes('actor=did%3Aalice.test')));
 assert.ok(f.requests.some(request=>request.url.includes('listNotifications')));assert.ok(f.requests.some(request=>request.url.includes('q=literal+query')));
 assert.ok(f.requests.some(request=>request.url.includes('actor=other.test')));assert.equal(f.rendered.at(-1).items.length,2);
 assert.ok(f.requests.every(request=>request.options.headers.Authorization==='Bearer alice.test-token'));
});
test('row toggle owns action state and record URI, rejects duplicate/stale clicks and preserves earlier-page rows',async()=>{
 const f=fixture(),context=f.context();await f.cList.readers.Bluesky.initialize(f.account,context);
 const item=await f.ctx.normalizeBlueskyPost(post()),row={isConnected:true};f.cList.readers.Bluesky.bindRow(item,row,context);
 const gate=deferred();f.response(()=>gate.promise);const pending=row.actions.favorite();await row.actions.favorite();await tick();
 assert.equal(f.requests.filter(request=>request.options.method==='POST').length,1);
 gate.resolve({ok:true,json:async()=>({uri:'at://did:alice.test/app.bsky.feed.like/owned'})});await pending;
 f.request(false);f.response(async()=>({ok:true,json:async()=>({})}));await row.actions.favorite();
 const body=JSON.parse(f.requests.at(-1).options.body);assert.equal(body.rkey,'owned');assert.equal(body.repo,'did:alice.test');
 row.isConnected=false;const count=f.requests.length;await row.actions.favorite();assert.equal(f.requests.length,count);
});
test('uncertain row writes show feedback without automatic retry and reject foreign action records',async()=>{
 const f=fixture();await f.cList.readers.Bluesky.initialize(f.account,f.context());const row={isConnected:true},item=await f.ctx.normalizeBlueskyPost(post());
 f.cList.readers.Bluesky.bindRow(item,row,f.context());f.response(async()=>{throw Error('lost response');});await row.actions.repost();
 assert.equal(f.requests.filter(request=>request.options.method==='POST').length,1);assert.match(f.errors.at(-1),/could not be confirmed/);
 const count=f.requests.length;await assert.rejects(f.ctx.toggleCapturedBlueskyRecord({accessToken:'x',did:'did:owner',pds:'https://pds'},item.bluesky,'favorite','at://did:other/app.bsky.feed.like/key'),/does not belong/);assert.equal(f.requests.length,count);
});
test('reply form captures the original account and target, then expires across account changes',async()=>{
 const f=fixture();await f.cList.readers.Bluesky.initialize(f.account,f.context());const row={isConnected:true},item=await f.ctx.normalizeBlueskyPost(post());
 f.cList.readers.Bluesky.bindRow(item,row,f.context());await row.actions.reply();const form=f.forms[0];
 await form.submit('Reply',{});const request=f.forms[1];assert.equal(request.session.did,'did:alice.test');assert.equal(request.reply.parent.uri,item.bluesky.uri);
 f.alive(false);await assert.rejects(form.submit('Stale reply',{}),/account changed/);assert.equal(f.forms.length,2);
});
test('UI panels retain selected feed ownership and recommended/pinned choices navigate captured URIs',async()=>{
 const f=fixture();await f.cList.readers.Bluesky.initialize(f.account,f.context());
 f.response(async(url)=>({ok:true,json:async()=>url.includes('getPreferences')?{preferences:[{$type:'app.bsky.actor.defs#savedFeedsPrefV2',items:[{pinned:true,value:'at://generator'}]}]}:url.includes('getFeedGenerator')?{view:{displayName:'Pinned'}}:{feeds:[{uri:'at://suggested',displayName:'Suggested'}]}}));
 await f.cList.readers.Bluesky.feedFunctions.Pinned(f.context());assert.equal(f.forms[0].feeds[0].uri,'at://generator');
 f.response(async()=>({ok:true,json:async()=>({feed:[]})}));await f.forms[0].select(f.forms[0].feeds[0]);assert.match(f.requests.at(-1).url,/feed=at%3A%2F%2Fgenerator/);
 assert.deepEqual(Array.from(f.cList.readers.Bluesky.uiActions),['Post','Search','Pinned','Recommended']);
});
