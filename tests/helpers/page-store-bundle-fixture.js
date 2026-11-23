function bundleGate(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};}
async function bundleFlush(){for(let i=0;i<20;i++)await Promise.resolve();}
function bundleFixture(){
    _pageBundleController=null;
    const records=new Map(),writes=[],downloads=[],calls=[],behavior={},outer=document.createElement('div'),feedback=document.createElement('p');document.body.append(outer,feedback);let origin=true;
    Object.assign(globalThis,{currentEditor:'source',currentEditorAccount:null,currentLoadedPage:null,editorHandlers:{source:{}},
        readerSession:()=>({storeUrl:'https://storage.invalid',username:'User',token:'private-token'}),
        async _pageStoreGetAll(){calls.push(['list']);if(behavior.list)await behavior.list();return [...records.values()].map(value=>structuredClone(value));},
        async _pageStoreGet(id){return records.has(id)?structuredClone(records.get(id)):null;},
        async _pageStoreReadThenWrite(id,decide){writes.push(id);if(behavior.write)await behavior.write(id,writes.length);const action=decide(records.get(id)||null);if(action.write==='put')records.set(id,structuredClone(action.record));return action.result;},
        downloadBlob(blob,filename){downloads.push({blob,filename});},showStatusMessage:text=>{feedback.textContent=text;},showErrorModal:text=>{feedback.textContent=text;},
        showLocalPages:async()=>{calls.push(['back']);outer.textContent='Saved pages';window.CList.state.editorControls.id++;}});
    window.CList.config={flaskSiteUrl:'https://storage.invalid'};window.CList.state={username:'User',authEpoch:1,editorSwitching:{id:1},editorLoading:{id:1},editorControls:{id:1}};window.CList.ui={view:{loadOptions:outer}};
    const button=text=>Array.from(outer.querySelectorAll('button')).find(node=>node.textContent===text);
    return{records,writes,downloads,calls,behavior,outer,feedback,button,
        get state(){return window.CList.state.localPageBundle;},
        export(){origin=true;return _exportAllPages(()=>origin);},hideOrigin(){origin=false;},
        panel(){return _showImportPagesPicker(outer);},
        file(payload){return{name:'synthetic.json',async text(){calls.push(['file']);if(behavior.file)await behavior.file();return typeof payload==='string'?payload:JSON.stringify(payload);}};},
        select(file,policy='skip'){const input=outer.querySelector('input');Object.defineProperty(input,'files',{configurable:true,value:file?[file]:[]});outer.querySelector('select').value=policy;input.onchange();},
        import:()=>button('Import').onclick(),check:()=>button('Check import result').onclick(),back:()=>button('Back to local pages').onclick(),
        expire(){window.CList.state.authEpoch++;},switch(){globalThis.currentEditor='other';window.CList.state.editorSwitching.id++;},
        dispose(){outer.remove();feedback.remove();}};
}
function syntheticPage(id,extra={}){return{id,title:id,content:'Body '+id,contentType:'text/plain',editorType:'source',revision:3,references:[],...extra};}
function syntheticBundle(pages){return{manifest:{app:'CList',kind:'pageStoreBundle',version:1,exportedAt:'2026-11-22',count:pages.length},pages};}
const pageBundleCases=[
    ['real export serializes the full bundle and performs only a browser handoff',async check=>{
        const f=bundleFixture();f.records.set('a',syntheticPage('a',{extension:{kept:true},references:[{member:'b',replyToken:{type:'Mastodon',statusId:'42'}}],publications:[{service:'Example',url:'https://published.invalid'}]}));
        check(await f.export()&&f.downloads.length===1&&f.writes.length===0,'one download handoff without storage writes');
        const output=JSON.parse(await f.downloads[0].blob.text());check(output.manifest.kind==='pageStoreBundle'&&output.manifest.version===1&&output.manifest.count===1&&output.pages[0].extension.kept&&output.pages[0].references[0].replyToken.statusId==='42','full native records and extensions preserved');
        check(/^clist-pages-\d{4}-\d{2}-\d{2}\.json$/.test(f.downloads[0].filename)&&f.downloads[0].blob.type==='application/json'&&f.feedback.textContent.includes('handed to the browser'),'filename/MIME and honest handoff feedback');f.dispose();
    }],
    ['duplicate/stale exports cannot download twice or affect another surface',async check=>{
        const f=bundleFixture(),gate=bundleGate();f.behavior.list=()=>gate.promise;const pending=f.export();await bundleFlush();check(await f.export()===false,'duplicate export blocked');f.hideOrigin();gate.resolve();
        check(await pending===false&&f.downloads.length===0,'replaced origin rejects delayed download');delete f.behavior.list;
        f.behavior.list=()=>{throw Error('read failed');};check(await f.export()===false&&f.feedback.textContent.includes('Export failed')&&f.downloads.length===0,'visible export read failure');f.dispose();
    }],
    ['file and conflict policy are captured and changed selection cancels before writes',async check=>{
        const f=bundleFixture(),gate=bundleGate();f.panel();const file=f.file(syntheticBundle([syntheticPage('a')]));f.select(file,'replace');f.behavior.file=()=>gate.promise;
        const pending=f.import();check(f.import()===pending,'duplicate import shares pending attempt');await bundleFlush();f.select(file,'duplicate');gate.resolve();check(await pending===false&&f.writes.length===0&&f.state.phase==='cancelled','changed policy rejects captured read');f.dispose();
    }],
    ['skip/replace retain the existing PageStore conflict semantics',async check=>{
        const f=bundleFixture();f.records.set('a',syntheticPage('a',{content:'Existing'}));f.panel();const file=f.file(syntheticBundle([syntheticPage('a',{content:'Incoming'})]));f.select(file);
        check(await f.import()&&f.writes.length===0&&f.records.get('a').content==='Existing'&&f.outer.textContent.includes('1 skipped'),'skip is default and reported');
        check(await f.import()===false,'accepted selection cannot repeat');f.select(file,'replace');check(await f.import()&&f.records.get('a').content==='Incoming'&&f.records.get('a').revision===1&&f.outer.textContent.includes('1 replaced'),'explicit replace uses original import revision semantics');f.dispose();
    }],
    ['duplicate policy remaps in-bundle references and keeps external metadata',async check=>{
        const f=bundleFixture();f.records.set('a',syntheticPage('a'));f.records.set('b',syntheticPage('b'));f.panel();
        const a=syntheticPage('a',{references:[{member:'b',extension:{kept:true}},{member:'outside'}],publications:[{service:'Example',url:'https://published.invalid'}]});f.select(f.file(syntheticBundle([a,syntheticPage('b')])), 'duplicate');
        check(await f.import()&&f.records.size===4,'conflicts create separate copies');const copies=[...f.records.values()].filter(record=>!['a','b'].includes(record.id)),copiedA=copies.find(record=>record.title==='a'),copiedB=copies.find(record=>record.title==='b');
        check(copiedA.references[0].member===copiedB.id&&copiedA.references[0].extension.kept&&copiedA.references[1].member==='outside'&&copiedA.publications[0].url==='https://published.invalid','real two-pass remapping retains extensions/external targets/publications');f.dispose();
    }],
    ['parse and Tier-1 failures write nothing and permit explicit correction',async check=>{
        const f=bundleFixture();f.panel();f.select(f.file('not json'));check(await f.import()===false&&f.writes.length===0&&f.outer.textContent.includes('not valid JSON'),'parse failure visible before import');
        f.select(f.file(syntheticBundle([syntheticPage('a'),{id:'bad',content:'Body'}])));check(await f.import()===false&&f.writes.length===0&&f.state.receipt==='none','whole-bundle validation rejects before any write');
        f.select(f.file(syntheticBundle([syntheticPage('valid')])));check(await f.import()&&f.records.has('valid'),'explicit corrected selection works');f.dispose();
    }],
    ['partial import counts and dangling references stay visible with literal details',async check=>{
        const f=bundleFixture();f.panel();const bad='b<script>';f.behavior.write=id=>{if(id===bad)throw Error('<failed record>');};
        f.select(f.file(syntheticBundle([syntheticPage('a',{references:[{member:bad}]}),syntheticPage(bad)])));
        check(await f.import()&&f.records.size===1&&f.records.get('a').references[0].member===bad,'successful record preserved with unresolved target');
        check(f.outer.textContent.includes('1 imported, 1 failed')&&f.outer.textContent.includes('Unresolved reference: a → b<script>')&&!f.outer.querySelector('script'),'counts/dangling details remain literal and visible');
        const writes=f.writes.length;check(await f.import()===false&&f.writes.length===writes,'partial accepted import is not automatically repeated');f.dispose();
    }],
    ['post-write uncertainty locks the selection and never automatically reimports',async check=>{
        const f=bundleFixture();f.records.set('a',syntheticPage('a'));f.records.set('b',syntheticPage('b'));f.panel();f.behavior.write=(_id,count)=>{if(count===3)throw Error('remap write failed');};
        f.select(f.file(syntheticBundle([syntheticPage('a',{references:[{member:'b'}]}),syntheticPage('b')])), 'duplicate');
        check(await f.import()===false&&f.records.size===4&&f.state.receipt==='uncertain'&&f.outer.textContent.includes('Some pages may already'),'uncertainty distinct from rejected validation');
        const count=f.writes.length;await f.import();f.check();check(f.writes.length===count&&f.button('Import').disabled,'result review performs no repeated writes');f.dispose();
    }],
    ['Cancel/session/editor expiry during file reads prevents import dispatch',async check=>{
        for(const change of ['back','expire','switch']){
            const f=bundleFixture(),gate=bundleGate();f.panel();f.select(f.file(syntheticBundle([syntheticPage('a')])));f.behavior.file=()=>gate.promise;const pending=f.import();await bundleFlush();if(change==='back')await f.back();else f[change]();gate.resolve();
            check(await pending===false&&f.writes.length===0,change+' cancels before storage');f.dispose();
        }
    }],
    ['rebuilt panels block duplicate imports and explicitly inspect completed results',async check=>{
        const f=bundleFixture(),gate=bundleGate();f.panel();const file=f.file(syntheticBundle([syntheticPage('a')]));f.select(file);f.behavior.write=()=>gate.promise;const pending=f.import();await bundleFlush();f.panel();f.select(file);
        check(await f.import()===false&&f.writes.length===1,'rebuilt panel cannot repeat active operation');gate.resolve();await pending;
        check(!f.outer.textContent.includes('Import finished:'),'old completion does not repaint replacement');f.check();check(f.outer.textContent.includes('1 imported')&&f.button('Import').disabled,'explicit receipt review recovers result without another write');f.dispose();
    }],
    ['accepted stale imports finish their original store without changing the new editor',async check=>{
        const f=bundleFixture(),gate=bundleGate();f.panel();f.select(f.file(syntheticBundle([syntheticPage('a')])));f.behavior.write=()=>gate.promise;const pending=f.import();await bundleFlush();f.switch();f.outer.textContent='New surface';gate.resolve();
        check(await pending&&f.records.has('a')&&f.outer.textContent==='New surface'&&!f.calls.some(call=>call[0]==='back'),'started original import finishes without UI refresh');
        check(Object.keys(f.state).sort().join()==='busy,kind,phase,receipt'&&!JSON.stringify(f.state).includes('private-token')&&!f.state.busy,'secret-free summary state');f.dispose();
    }],
    ['completed results return to pages explicitly without refreshing or writing twice',async check=>{
        const f=bundleFixture();f.panel();f.select(f.file(syntheticBundle([])));check(await f.import()&&f.outer.textContent.includes('Nothing to import.')&&!f.calls.some(call=>call[0]==='back'),'empty accepted bundle remains visible');
        await f.back();check(f.calls.filter(call=>call[0]==='back').length===1&&f.outer.textContent==='Saved pages'&&f.writes.length===0,'explicit back refreshes only the listing');f.dispose();
    }]
];
