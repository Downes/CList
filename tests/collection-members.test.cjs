const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const copy = value => JSON.parse(JSON.stringify(value));
const source = name => fs.readFileSync('js/' + name + '.js', 'utf8');
function fixture(values = {}) {
    const records = new Map(Object.entries(values).map(([key,value])=>[key,JSON.stringify(value)]));
    const writes=[],errors=[],messages=[]; let seq=0, encrypt=async text=>text;
    const ctx=vm.createContext({structuredClone,console:{error(){}},window:{CList:{state:{username:'alice'},config:{flaskSiteUrl:'https://store.invalid'},keys:{ACCESS_TOKEN:'access_token'},ui:{}}},
        getSiteSpecificCookie:()=> 'site-token',getEncKey:async()=> 'key',crypto:{randomUUID:()=>String(++seq)},
        _newCollectionIdentity:()=>({key:'collection:new-'+(++seq),id:'urn:uuid:'+seq}),
        _parseCollectionData:raw=>Array.isArray(raw)?{id:null,title:null,items:raw,publishedUrls:[]}:{id:raw.id||null,title:raw.title||null,items:raw.items||[],publishedUrls:raw.publishedUrls||[]},
        decryptKVJson:async(key,value)=>JSON.parse(value),encryptWithKey:async(key,value)=>encrypt(value),
    });
    ctx.window.CList.storage={kv:{list:async()=>[...records].map(([key,value])=>({key,value})),get:async key=>records.has(key)?{key,value:records.get(key)}:null,
        add:async(key,value)=>{if(records.has(key))throw Object.assign(Error('Exists'),{code:'AlreadyExists'});writes.push(['add',key]);records.set(key,value);},
        put:async(key,value)=>{writes.push(['put',key]);records.set(key,value);},update:async(key,value)=>{writes.push(['update',key]);records.set(key,value);},remove:async key=>{writes.push(['remove',key]);records.delete(key);}}};
    for(const name of ['collection-session','collection-workflow'])vm.runInContext(source(name),ctx);
    const session=ctx.beginCollectionSession({encKey:'key'}),deps=ctx.collectionDependencies(session);
    return {ctx,records,writes,errors,messages,session,deps,encrypt:fn=>{encrypt=fn;}};
}
const member=(membershipId,title='Entry')=>({membershipId,title,url:'https://same.invalid'});
const col=(items,extra={})=>({id:'urn:uuid:a',title:'Collection',items,publishedUrls:[{url:'https://published.invalid',format:'RSS'}],custom:{keep:true},...extra});

test('a replaced row generation blocks its delayed write and unlocks current replacement controls', async () => {
 const f=fixture({'collection:a':col([member('one'),member('two')])});
 f.ctx.window.CList.ui.collectionMembers={
  rows(collection,count,root,busy,actions){root.actions=actions;root.disabled=busy;},
  busy(root,value){root.disabled=value;},
  error(error){f.errors.push(error.message);},status(message){f.messages.push(message);},
 };
 vm.runInContext(source('collection-members'),f.ctx);
 const captured=await f.ctx.readCollectionSnapshot('collection:a',f.deps),root={isConnected:true};
 f.ctx._renderCollectionItems(captured,'site-token','key',{},root);
 let release;
 f.encrypt(value=>new Promise(resolve=>{release=()=>resolve(value);}));
 const pending=root.actions.remove(captured.items[0]);
 for(let i=0;i<15&&!release;i++)await new Promise(resolve=>setImmediate(resolve));
 assert.equal(typeof release,'function');
 f.ctx._renderCollectionItems(captured,'site-token','key',{},root);
 assert.equal(root.disabled,true,'replacement controls reflect the still-pending operation');
 release();await pending;
 assert.equal(f.writes.length,0);assert.equal(captured.items.length,2);
 assert.equal(root.disabled,false);assert.equal(f.ctx.window.CList.state.collectionMemberships.busy,false);
 assert.equal(f.errors.length,0,'expired operation reports soft status instead of replacing the current controls with a modal');
 assert.ok(f.messages.some(message=>message.includes('controls changed')));
});

test('collection records normalize legacy arrays and preserve current extensions, warning on corrupt entries',async()=>{
 const f=fixture({'collection:old':[member('old')],'collection:a':col([member('one')])});f.records.set('collection:bad','{');
 const listed=await f.ctx.listCollectionRecords(f.deps);
 assert.equal(listed.collections.length,2);assert.equal(listed.warnings.length,1);
 const current=listed.collections.find(item=>item.key==='collection:a');assert.deepEqual(copy(current.custom),{keep:true});
 assert.equal(listed.collections[0].name,'old');assert.equal(listed.collections[0].id,null);
 assert.equal(f.writes.length,0);
});
test('membership removal targets one durable ID while preserving newer siblings, extensions and publications',async()=>{
 const f=fixture({'collection:a':col([member('one'),member('two')])});const captured=await f.ctx.readCollectionSnapshot('collection:a',f.deps);
 f.records.set('collection:a',JSON.stringify(col([member('one'),member('two'),member('incoming')],{newExtension:'kept'})));
 const result=await f.ctx.removeCollectionMembership(captured,captured.items[0],f.deps);
 assert.deepEqual(copy(result.items.map(item=>item.membershipId)),['two','incoming']);assert.equal(result.newExtension,'kept');
 assert.deepEqual(copy(result.custom),{keep:true});assert.equal(result.publishedUrls.length,1);
 assert.equal(captured.items.length,2,'captured collection is not optimistically mutated');
});
test('legacy duplicate memberships remove only the selected ordinal and reject changed lists',async()=>{
 const original={title:'Same',url:'https://same.invalid'};const f=fixture({'collection:a':col([original,original])});
 const captured=await f.ctx.readCollectionSnapshot('collection:a',f.deps);
 const result=await f.ctx.removeCollectionMembership(captured,captured.items[1],f.deps);assert.equal(result.items.length,1);
 const g=fixture({'collection:a':col([original,original])}),old=await g.ctx.readCollectionSnapshot('collection:a',g.deps);
 g.records.set('collection:a',JSON.stringify(col([original,original,member('new')])));
 await assert.rejects(g.ctx.removeCollectionMembership(old,old.items[1],g.deps),/legacy collection changed/);assert.equal(g.writes.length,0);
});
test('changed selected memberships and failed encryption leave source objects and storage untouched',async()=>{
 const f=fixture({'collection:a':col([member('one')])}),captured=await f.ctx.readCollectionSnapshot('collection:a',f.deps);
 f.records.set('collection:a',JSON.stringify(col([member('one','Incoming edit')])));
 await assert.rejects(f.ctx.removeCollectionMembership(captured,captured.items[0],f.deps),/membership has changed/);assert.equal(f.writes.length,0);
 const g=fixture({'collection:a':col([member('one')])}),snapshot=await g.ctx.readCollectionSnapshot('collection:a',g.deps);
 g.encrypt(async()=>{throw Error('Encrypt failed');});await assert.rejects(g.ctx.removeCollectionMembership(snapshot,snapshot.items[0],g.deps),/Encrypt failed/);
 assert.equal(snapshot.items.length,1);assert.equal(g.writes.length,0);
});
test('membership adds use latest collection and independent IDs even for duplicate URLs',async()=>{
 const f=fixture({'collection:a':col([member('one')])}),target=await f.ctx.readCollectionSnapshot('collection:a',f.deps);
 f.records.set('collection:a',JSON.stringify(col([member('one'),member('incoming')])));
 const added=await f.ctx.addCollectionMembership(target,target.title,{title:'Again',url:'https://same.invalid',membershipId:'untrusted'},f.deps);
 assert.equal(added.duplicate,true);assert.equal(added.collection.items.length,3);assert.notEqual(added.collection.items[2].membershipId,'untrusted');
 assert.equal(added.collection.publishedUrls.length,1);assert.deepEqual(copy(added.collection.custom),{keep:true});
});
test('nesting rejects direct and indirect cycles without writes',async()=>{
 const f=fixture({'collection:a':col([{role:'contains',collectionId:'urn:uuid:b'}]),'collection:b':col([],{id:'urn:uuid:b',title:'Child'})});
 const child=await f.ctx.readCollectionSnapshot('collection:b',f.deps);
 await assert.rejects(f.ctx.addCollectionMembership(child,'Child',{role:'contains',collectionId:'urn:uuid:a'},f.deps),/nest a collection inside itself/);
 await assert.rejects(f.ctx.addCollectionMembership(child,'Child',{role:'contains',collectionId:'urn:uuid:b'},f.deps),/nest a collection inside itself/);assert.equal(f.writes.length,0);
});
test('new collection creation uses add-if-absent and legacy targets retain their key while gaining identity',async()=>{
 const f=fixture({'collection:legacy':[member('old')]});const target=await f.ctx.readCollectionSnapshot('collection:legacy',f.deps);
 const saved=await f.ctx.addCollectionMembership(target,'legacy',member('new'),f.deps);
 assert.equal(saved.collection.key,'collection:legacy');assert.ok(saved.collection.id);assert.equal(f.records.size,1);
 const fresh=await f.ctx.addCollectionMembership(null,'Fresh',member('fresh'),f.deps);assert.ok(f.writes.some(call=>call[0]==='add'));assert.equal(fresh.collection.title,'Fresh');
});
test('delete rechecks the latest snapshot and never deletes a replacement collection',async()=>{
 const f=fixture({'collection:a':col([])}),captured=await f.ctx.readCollectionSnapshot('collection:a',f.deps);
 f.records.set('collection:a',JSON.stringify(col([member('new')])));
 await assert.rejects(f.ctx.deleteCollectionRecord(captured,f.deps),/has changed/);assert.equal(f.writes.length,0);
 const latest=await f.ctx.readCollectionSnapshot('collection:a',f.deps);await f.ctx.deleteCollectionRecord(latest,f.deps);assert.equal(f.records.has('collection:a'),false);
});
test('session changes during key acquisition or encryption stop writes',async()=>{
 const f=fixture();let finish;f.ctx.getEncKey=()=>new Promise(resolve=>{finish=resolve;});const session=f.ctx.beginCollectionSession();
 const pending=f.ctx.prepareCollectionSession(session);f.ctx.window.CList.state.username='bob';finish('key');await assert.rejects(pending,/no longer current/);
 const g=fixture();g.encrypt(async value=>{g.ctx.window.CList.config.flaskSiteUrl='https://other.invalid';return value;});
 await assert.rejects(g.ctx.saveCollectionRecord('collection:new',col([]),g.deps),/no longer current/);assert.equal(g.writes.length,0);
});
const event=(membershipId,eventId)=>({membershipId,role:'event',eventId,title:'Event',start:'2026-01-01T00:00:00.000Z',allDay:false});
test('_recomputeCollectionType tags a collection as a calendar only once a strict majority of its items are event references, and clears again on removal',async()=>{
 const f=fixture({'collection:a':col([member('one')])});const target=await f.ctx.readCollectionSnapshot('collection:a',f.deps);
 const afterOneEvent=await f.ctx.addCollectionMembership(target,target.title,{role:'event',eventId:'e1',title:'E1',start:'2026-01-01T00:00:00.000Z',allDay:false},f.deps);
 assert.ok(!('type' in afterOneEvent.collection),'one event against one leaf is a tie, not yet a majority');
 const afterTwoEvents=await f.ctx.addCollectionMembership(afterOneEvent.collection,afterOneEvent.collection.title,{role:'event',eventId:'e2',title:'E2',start:'2026-01-02T00:00:00.000Z',allDay:false},f.deps);
 assert.equal(afterTwoEvents.collection.type,'calendar','two events against one leaf is a majority');
 const reopened=await f.ctx.readCollectionSnapshot('collection:a',f.deps);
 const removed=await f.ctx.removeCollectionMembership(reopened,reopened.items.find(item=>item.eventId==='e1'),f.deps);
 assert.ok(!('type' in removed),'removing an event back down to a tie clears the calendar tag (absent, not merely falsy)');
});
test('_recomputeCollectionType never tags an empty collection',async()=>{
 const f=fixture({'collection:a':col([member('one')])});const target=await f.ctx.readCollectionSnapshot('collection:a',f.deps);
 const removed=await f.ctx.removeCollectionMembership(target,target.items[0],f.deps);
 assert.equal(removed.items.length,0);assert.ok(!('type' in removed));
});
