function localBrowserGate(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};}
async function localBrowserFlush(){for(let i=0;i<16;i++)await Promise.resolve();}
function localBrowserFixture(options={}){
    _localPageBrowser?.dispose();_localPageBrowser=null;
    const store=window.CList.pageStore,records=new Map(),calls=[],opens=[],behavior={},outer=document.createElement('div');document.body.appendChild(outer);let docId=null;
    const record={id:'native-a',title:'<Saved literal>',revision:7,content:'<p>Saved body</p>',contentType:'text/html',editorType:'source',updatedAt:'2026-11-22',references:[{url:'https://source.invalid',replyToken:{type:'Mastodon',statusId:'42'},extension:{kept:true}}],
        publications:[{service:'Old',accountId:'old',url:'https://old.invalid',publishedAt:'2026-01-01'},{service:'New',accountId:null,url:'https://new.invalid',publishedAt:'2026-11-01'}]};
    if(!options.empty){records.set(record.id,record);records.set('native-b',{id:'native-b',title:'',content:'Second',contentType:'text/plain',editorType:'source',updatedAt:'2026-01-01'});}
    Object.assign(globalThis,{currentEditor:'source',currentEditorAccount:null,currentLoadedPage:{kind:'file',id:'original'},
        editorHandlers:{source:{getDocId:()=>docId},other:{}},
        readerSession:()=>({storeUrl:'https://storage.invalid',username:'User',token:'private-token'}),
        async _pageStoreGetAll(){calls.push(['list']);if(behavior.list)await behavior.list();return [...records.values()].map(value=>structuredClone(value));},
        async _pageStoreGet(id){calls.push(['get',id]);if(behavior.get)await behavior.get(id);return records.has(id)?structuredClone(records.get(id)):null;},
        populateLoadOptions(){calls.push(['cancel']);outer.innerHTML='Sources';window.CList.state.editorControls.id++;},
        async loadSavedPage(content,page,target,cancel,current){const handoff={content,page,target,cancel,current};opens.push(handoff);window.CList.state.editorLoading.id++;if(behavior.open)await behavior.open(handoff);},
        async _exportAllPages(){calls.push(['export']);if(behavior.export)await behavior.export();},
        _showImportPagesPicker(target){calls.push(['import',target]);target.innerHTML='Import panel';}});
    window.CList.config={flaskSiteUrl:'https://storage.invalid'};window.CList.state={username:'User',authEpoch:1,editorSwitching:{id:1},editorLoading:{id:1},editorControls:{id:1}};
    window.CList.ui={view:{loadOptions:outer}};window.CList.pageStore=store;
    const loader=window.CList.loaders.find(value=>value.label==='CList (local)');
    const button=text=>Array.from(outer.querySelectorAll('button')).find(node=>node.textContent===text);
    return{record,records,calls,opens,behavior,outer,loader,button,
        list:()=>loader.load(),get rows(){return Array.from(outer.querySelectorAll('.account-button'));},get state(){return window.CList.state.localPageBrowser;},
        expire(){window.CList.state.authEpoch++;},switch(){globalThis.currentEditor='other';window.CList.state.editorSwitching.id++;},
        controls(){window.CList.state.editorControls.id++;},replacePage(){globalThis.currentLoadedPage={id:'different'};},
        document(){docId='new-live-document';},
        dispose(){_localPageBrowser?.dispose();outer.remove();}};
}
const localPageBrowserCases=[
    ['real registry and PageStore listing render safe labels and empty states',async check=>{
        const f=localBrowserFixture();check(f.loader.requiresLogin&&f.loader.requiresAccount===false&&f.loader.icon==='folder','loader registry contract retained');
        check(await f.list()===null&&f.rows.length===2&&f.rows[0].textContent.includes('<Saved literal>')&&!f.rows[0].querySelector('Saved'),'literal list labels');
        check(f.rows[1].textContent.includes('(untitled)')&&Object.keys(f.state).sort().join()==='count,opening,phase'&&f.state.count===2&&!JSON.stringify(f.state).includes('private-token'),'untitled label and safe state');f.dispose();
        const g=localBrowserFixture({empty:true});await g.list();check(g.rows.length===0&&g.state.phase==='empty'&&g.outer.textContent.includes('No locally saved pages yet.'),'empty list retains tools');g.dispose();
    }],
    ['opening preserves native identity/references/latest publication and delegates choices',async check=>{
        const f=localBrowserFixture();await f.list();check(await f.rows[0].onclick(),'captured row opens');const handoff=f.opens[0];
        check(handoff.content.type==='text/html'&&handoff.content.value==='<p>Saved body</p>'&&handoff.page.kind==='local-page'&&handoff.page.id==='native-a'&&handoff.page.revision===7,'exact native content and identity');
        check(handoff.page.references[0].replyToken.statusId==='42'&&handoff.page.references[0].extension.kept&&handoff.page.service==='New'&&handoff.page.accountInstance===null&&handoff.page.publicationUrl==='https://new.invalid','structural references and latest publication retained');
        check(handoff.target===f.outer&&handoff.current()&&f.state.opening,'shared loader receives guarded target and owns editor choices');f.dispose();
    }],
    ['duplicate row clicks and tool actions are blocked during a read',async check=>{
        const f=localBrowserFixture(),gate=localBrowserGate();f.behavior.get=()=>gate.promise;await f.list();const click=f.rows[0].onclick,pending=click();await click();await f.button('Export all pages').onclick();
        check(f.calls.filter(call=>call[0]==='get').length===1&&!f.calls.some(call=>call[0]==='export')&&f.rows.every(row=>row.disabled),'one row read with controls locked');gate.resolve();await pending;await click();check(f.opens.length===1,'handoff remains single-use');f.dispose();
    }],
    ['source/page/session/control changes reject late reads',async check=>{
        for(const change of ['expire','switch','controls','replacePage','document']){
            const f=localBrowserFixture(),gate=localBrowserGate();f.behavior.get=()=>gate.promise;await f.list();const pending=f.rows[0].onclick();f[change]();gate.resolve();
            check(await pending===false&&f.opens.length===0&&!f.outer.querySelector('.error-message'),change+' rejects stale record read');f.dispose();
        }
    }],
    ['superseded lists and detached row callbacks cannot paint or reopen',async check=>{
        const f=localBrowserFixture(),gate=localBrowserGate();f.behavior.list=()=>gate.promise;const old=f.list();await localBrowserFlush();delete f.behavior.list;await f.list();const row=f.rows[0].onclick;gate.resolve();await old;
        check(f.rows.length===2&&f.state.phase==='ready','old list cannot replace newer panel');await f.list();check(await row()===undefined&&f.opens.length===0,'detached old view callback rejects opening');f.dispose();
    }],
    ['list/read failures show explicit retry and release locks',async check=>{
        const f=localBrowserFixture();f.behavior.list=()=>{throw Error('list failed');};await f.list();check(f.state.phase==='error'&&!!f.outer.querySelector('.error-message'),'list failure visible');
        const oldRetry=f.button('Retry').onclick;delete f.behavior.list;await oldRetry();check(f.rows.length===2,'explicit list retry');
        const listCount=f.calls.filter(call=>call[0]==='list').length;await oldRetry();check(f.calls.filter(call=>call[0]==='list').length===listCount,'removed Retry cannot rebuild newer rows');
        f.behavior.get=()=>{throw Error('read failed');};check(await f.rows[0].onclick()===false&&!f.state.opening&&f.opens.length===0,'read failure unlocks rows');
        delete f.behavior.get;await f.button('Retry').onclick();check(f.opens.length===1,'explicit row retry opens once');f.dispose();
    }],
    ['missing or mismatched records never reach the editor',async check=>{
        const f=localBrowserFixture();await f.list();f.records.delete('native-a');check(await f.rows[0].onclick()===false&&f.opens.length===0&&f.outer.textContent.includes('no longer exists'),'missing page visible');
        await f.button('Retry').onclick();check(f.rows.length===1,'missing-page retry refreshes list');
        f.records.set('native-b',{id:'wrong',content:'Bad'});check(await f.rows[0].onclick()===false&&f.opens.length===0,'mismatched stored identity rejected');f.dispose();
    }],
    ['handoff allows intended editor/UI changes but rejects later control/session/new panels',async check=>{
        const f=localBrowserFixture();await f.list();await f.rows[0].onclick();const handoff=f.opens[0];globalThis.currentEditor='target';window.CList.state.editorSwitching.id++;f.outer.innerHTML='Editor review';
        check(handoff.current(),'intended shared-loader editor switch and review replacement remain owned');f.controls();check(!handoff.current(),'new source/blank controls expire saved choices');f.dispose();
        const g=localBrowserFixture();await g.list();await g.rows[0].onclick();const old=g.opens[0];g.expire();check(!old.current(),'session expiry rejects picker choices');g.dispose();
        const h=localBrowserFixture();await h.list();await h.rows[0].onclick();const previous=h.opens[0];await h.list();check(!previous.current(),'new local list expires old handoff');h.dispose();
    }],
    ['Cancel clears pending reads and saved handoff cancellation is single-use',async check=>{
        const f=localBrowserFixture(),gate=localBrowserGate();f.behavior.get=()=>gate.promise;await f.list();const pending=f.rows[0].onclick();f.button('Cancel').onclick();gate.resolve();
        check(await pending===false&&f.opens.length===0&&f.calls.filter(call=>call[0]==='cancel').length===1,'Cancel prevents pending read handoff');f.dispose();
        const g=localBrowserFixture();await g.list();await g.rows[0].onclick();g.opens[0].cancel();g.opens[0].cancel();check(g.calls.filter(call=>call[0]==='cancel').length===1,'shared Cancel callback consumed once');g.dispose();
    }],
    ['legacy import/export remain guarded dispatches with no claimed internal migration',async check=>{
        const f=localBrowserFixture();await f.list();await f.button('Export all pages').onclick();check(f.calls.filter(call=>call[0]==='export').length===1,'existing export dispatch preserved');const old=f.rows[0].onclick;
        await f.button('Import pages...').onclick();check(f.outer.textContent==='Import panel'&&f.calls.find(call=>call[0]==='import')[1]===f.outer,'existing import target preserved');await old();check(f.opens.length===0,'import replacement expires old rows');f.dispose();
    }]
];
