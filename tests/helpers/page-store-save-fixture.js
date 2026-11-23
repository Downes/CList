function localSaveGate(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};}
async function localSaveFlush(){for(let i=0;i<16;i++)await Promise.resolve();}
function localSaveFixture(options={}){
    _localPageSaveController=null;
    const nativeStore=window.CList.pageStore,records=new Map(),writes=[],reads=[],notices=[],errors=[],behavior={};
    const root=document.createElement('div'),title=document.createElement('p'),feedback=document.createElement('p');root.append(title,feedback);document.body.appendChild(root);title.textContent='Captured title';
    let references=[{url:'https://source.invalid',title:'Original',replyToken:{type:'Mastodon',statusId:'42'},extension:{kept:true}}],body='<p>Captured body</p>',docId=null;
    globalThis._pageStoreReadThenWrite=async(id,decide)=>{
        writes.push(id);if(behavior.write)await behavior.write();const decision=decide(records.get(id)||null);
        if(decision.write==='put')records.set(id,structuredClone(decision.record));return decision.result;
    };
    globalThis._pageStoreGet=async id=>records.get(id)||null;globalThis._pageStoreGetAll=async()=>[...records.values()];
    const handler={contentTypes:['text/html'],getDocId:()=>docId,async getContent(){reads.push(this);return behavior.read?await behavior.read():body;}};
    Object.assign(globalThis,{currentEditor:'source',currentEditorAccount:null,currentLoadedPage:options.page||null,
        editorHandlers:{source:handler,other:{contentTypes:['text/plain'],getContent:()=> 'Other body'}},
        readerSession:()=>({storeUrl:'https://storage.invalid',username:'User',token:'private-token'}),getReferences:()=>references,
        setLoadedPage(page){if(behavior.reconcile&&!behavior.partial)throw Error('metadata failed');globalThis.currentLoadedPage={...page};title.textContent=page.title;if(behavior.reconcile)throw Error('metadata failed');},
        showStatusMessage(message){notices.push(message);feedback.textContent=message;},showErrorModal(message,settings){errors.push({message,settings});feedback.textContent=message;}});
    window.CList.config={flaskSiteUrl:'https://storage.invalid'};window.CList.state={username:'User',authEpoch:1,editorSwitching:{id:1},editorLoading:{id:1},editorControls:{id:1}};
    window.CList.ui={view:{writeTitle:title}};window.CList.pageStore=nativeStore;
    const saver=window.CList.savers.find(value=>value.label==='Save to CList (local)');
    return{records,writes,reads,notices,errors,behavior,title,feedback,handler,saver,
        save:()=>saver.save(),get page(){return currentLoadedPage;},get state(){return window.CList.state.localPageSave;},
        get references(){return references;},set body(value){body=value;},set docId(value){docId=value;},
        switch(){globalThis.currentEditor='other';globalThis.currentLoadedPage={kind:'local-page',id:'other',revision:99};title.textContent='Other title';references=[{url:'https://other.invalid'}];},
        expire(){window.CList.state.authEpoch++;},replacePage(){globalThis.currentLoadedPage={kind:'local-page',id:'replacement',revision:1};},
        dispose(){root.remove();}};
}
const localPageSaveCases=[
    ['real saver captures native record and binds the original editor API',async check=>{
        const f=localSaveFixture();check(f.saver.requiresLogin&&f.saver.requiresAccount===false&&f.saver.icon==='save','registry contract retained');
        check((await f.save()).status==='saved'&&f.records.size===1,'native save succeeds');const record=[...f.records.values()][0];
        check(record.content==='<p>Captured body</p>'&&record.title==='Captured title'&&record.contentType==='text/html'&&record.editorType==='source'&&record.revision===1,'native record shape and initial revision');
        check(f.reads[0]===f.handler&&f.page.kind==='local-page'&&f.page.id===record.id&&f.notices[0]==='Saved to CList (local).','captured method binding, identity reconciliation and feedback');
        check(Object.keys(f.state).sort().join()==='busy,phase,receipt'&&!JSON.stringify(f.state).includes('private-token')&&!f.state.busy&&f.state.receipt==='accepted','safe accepted state');f.dispose();
    }],
    ['title and references are snapshotted before deferred content capture',async check=>{
        const f=localSaveFixture(),gate=localSaveGate();f.behavior.read=()=>gate.promise;const pending=f.save();
        f.title.textContent='Newer title';f.references[0].title='Newer reference';f.references[0].extension.kept=false;
        gate.resolve('<p>Original captured body</p>');await pending;const record=[...f.records.values()][0];
        check(record.title==='Captured title'&&record.references[0].title==='Original'&&record.references[0].extension.kept&&record.references[0].replyToken.statusId==='42','stored snapshot retains exact structural metadata/extensions');
        check(f.title.textContent==='Newer title'&&f.page.title==='Newer title'&&f.page.references[0].title==='Newer reference','reconciliation keeps newer visible metadata');f.dispose();
    }],
    ['switch/session/page/live-document changes before write cancel cleanly',async check=>{
        for(const change of ['switch','expire','replacePage','document']){
            const f=localSaveFixture(),gate=localSaveGate();f.behavior.read=()=>gate.promise;const pending=f.save();await localSaveFlush();if(change==='document')f.docId='new-doc';else f[change]();gate.resolve('Old body');
            check((await pending).status==='cancelled'&&f.writes.length===0&&f.notices.length===0&&f.errors.length===0,change+' rejects stale capture before storage');f.dispose();
        }
    }],
    ['in-flight write finishes only its original record after editor switch',async check=>{
        const f=localSaveFixture(),gate=localSaveGate();f.behavior.write=()=>gate.promise;const pending=f.save();await localSaveFlush();f.switch();const page=f.page;gate.resolve();
        check((await pending).status==='saved'&&f.records.size===1&&f.page===page&&f.page.id==='other'&&f.notices.length===0,'accepted write does not attach to another editor');
        const record=[...f.records.values()][0];check(record.title==='Captured title'&&record.editorType==='source'&&record.references[0].url==='https://source.invalid','in-flight record keeps original metadata');f.dispose();
    }],
    ['duplicate same-owner saves coalesce and another owner stays open while busy',async check=>{
        const f=localSaveFixture(),gate=localSaveGate();f.behavior.read=()=>gate.promise;const first=f.save(),duplicate=f.save();check(first===duplicate,'duplicate pending promise shared');await localSaveFlush();f.switch();
        const blocked=await f.save();check(blocked.status==='busy'&&blocked.keepOpen&&f.reads.length===1&&f.notices.length===1,'different editor is not reported as saved by old operation');
        gate.resolve('Body');await first;check(f.writes.length===0,'expired original does not write');f.dispose();
    }],
    ['native updates preserve optimistic revision and existing storage metadata',async check=>{
        const f=localSaveFixture({page:{kind:'local-page',id:'native',revision:3}});
        f.records.set('native',{id:'native',title:'Old',content:'Old',contentType:'text/plain',editorType:'source',createdAt:'old-date',revision:3,publications:[{service:'Example',url:'https://published.invalid'}],sourceUri:'https://origin.invalid',references:[]});
        check((await f.save()).status==='saved'&&f.records.size===1&&f.records.get('native').revision===4&&f.page.revision===4,'existing identity updated once');
        check(f.records.get('native').createdAt==='old-date'&&f.records.get('native').publications[0].url==='https://published.invalid'&&f.records.get('native').sourceUri==='https://origin.invalid','storage metadata preserved by existing PageStore');f.dispose();
    }],
    ['revision conflicts retain page/draft and require explicit recovery',async check=>{
        const page={kind:'local-page',id:'native',revision:2},f=localSaveFixture({page});f.records.set('native',{id:'native',revision:5,content:'Stored body'});
        const result=await f.save();check(result.status==='failed'&&result.keepOpen&&f.errors[0].settings.title==='Save conflict'&&f.page===page,'conflict feedback and original identity retained');
        check(f.records.get('native').content==='Stored body'&&f.writes.length===1&&f.state.receipt==='none','no forced overwrite or automatic retry');f.dispose();
    }],
    ['nonlocal origins create a local identity and empty/failed reads never write',async check=>{
        const f=localSaveFixture({page:{kind:'published-page',id:'remote'}});check((await f.save()).status==='saved'&&![...f.records.keys()].includes('remote'),'remote metadata is not reused as native identity');f.dispose();
        const g=localSaveFixture();g.body=' ';check((await g.save()).status==='failed'&&g.writes.length===0&&g.errors[0].settings.title==='Nothing to save','empty body rejected visibly');
        g.behavior.read=()=>{throw Error('editor failed');};check((await g.save()).status==='failed'&&g.writes.length===0&&g.errors.length===2,'editor rejection handled before writing');g.dispose();
    }],
    ['accepted write retries only editor reconciliation after UI failure',async check=>{
        for(const partial of [false,true]){
            const f=localSaveFixture();f.behavior.reconcile=true;f.behavior.partial=partial;const first=await f.save();
            check(first.status==='metadata-failed'&&first.receipt==='accepted'&&f.records.size===1&&f.errors[0].settings.title==='Page saved; editor refresh failed','accepted save separated from UI failure');
            f.behavior.reconcile=false;const retry=await f.save();check(retry.status==='saved'&&f.writes.length===1&&f.reads.length===1&&f.page.revision===1,'metadata-only retry avoids duplicate write/read');f.dispose();
        }
    }],
    ['storage failures remain visible and allow a later explicit save',async check=>{
        const f=localSaveFixture();f.behavior.write=()=>{throw Error('IDB unavailable');};
        check((await f.save()).status==='failed'&&f.records.size===0&&f.page===null&&f.errors.length===1&&!f.state.busy,'write failure does not attach a page');
        delete f.behavior.write;check((await f.save()).status==='saved'&&f.records.size===1&&f.writes.length===2,'explicit retry writes once more');f.dispose();
    }]
];
