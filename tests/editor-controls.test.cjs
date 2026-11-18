const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { Element } = require('./helpers/account-fixture.cjs');
const plain = value => JSON.parse(JSON.stringify(value));
const tick = () => new Promise(resolve=>setImmediate(resolve));
function fixture() {
    const root=new Element(), errors=[], messages=[], bodies={texteditor:'',tinymce:''}, memory=new Map(), routed=[];
    let references=[];
    for(const id of ['load-options','write-title','write-tags','write-title-row','write-format','editor-menu','editor-instructions','editor-status',
        'loaded-page-indicator','loaded-page-filename','republish-button','republish-status','mount']) {
        const element=new Element(); element.id=id; element.removeAttribute=name=>delete element[name]; root.appendChild(element);
    }
    const ctx=vm.createContext({structuredClone,console:{log(){},error(){}},
        currentEditor:'texteditor',currentEditorAccount:null,currentLoadedPage:null,pendingContent:null,EDITOR_TEST_VERSION:'fixture',
        window:{CList:{state:{username:'original'},config:{flaskSiteUrl:'https://store.invalid'},accounts:[],loaders:[],keys:{EDITOR_DRAFT_PREFIX:'clist_draft_'},
            ui:{view:{loadOptions:root.querySelector('#load-options'),writeTitle:root.querySelector('#write-title'),writePaneContent:root.querySelector('#mount')},
                isHandlerVisible:handler=>!handler.hidden}}},
        document:{getElementById:id=>root.querySelector('#'+id),createElement:tag=>new Element(tag)},
        makeEditorButton:(label,icon,select)=>{const button=new Element('button');button.textContent=label;button.onclick=select;return button;},
        showErrorModal:message=>errors.push(message),showStatusMessage:message=>messages.push(message),
        getReferences:()=>references,setReferences:value=>references=value,clearReferences:()=>references=[],
        closeReferencesPanel(){},closeRightPane(options){if(!options?.preserveEditorControls)ctx.invalidateEditorControls();},
        openRightInterface(){},loadSavedPage:async(...args)=>routed.push(args),
        sessionStorage:{getItem:key=>memory.get(key)??null,setItem:(key,value)=>memory.set(key,value),removeItem:key=>memory.delete(key)},
    });
    ctx.editorHandlers=Object.fromEntries(['texteditor','tinymce'].map(key=>[key,{label:key,contentTypes:['text/plain'],
        initialize:async()=>{ctx.currentEditor=key;await ctx.loadPredefinedContent(key);},getContent:()=>bodies[key],
        setContent:value=>{bodies[key]=value;},loadContent:({value})=>{bodies[key]+=value;}}]));
    for(const name of ['editor-state','editor-switch-view','editor-switch','editor-controls-state','editor-controls-view','editor-controls']) {
        vm.runInContext(fs.readFileSync('js/'+name+'.js','utf8'),ctx);
    }
    const button=label=>{const button=root.querySelector('#load-options').querySelectorAll('button').find(el=>el.textContent===label);
        assert.ok(button,'Rendered button '+label);return button;};
    return {ctx,root,errors,messages,bodies,memory,routed,button,refs:()=>references};
}

test('plain controls transitions are immutable and loaded-page models preserve publication rules',()=>{
    const ctx=vm.createContext({});vm.runInContext(fs.readFileSync('js/editor-controls-state.js','utf8'),ctx);
    const first=ctx.beginEditorControls(null,'sources'),next=ctx.beginEditorControls(first,'blank-choices');
    assert.equal(ctx.transitionEditorControls(next,first.id,'complete'),next);assert.equal(first.phase,'sources');
    assert.equal(ctx.editorLoadedPageModel({kind:'file',title:'A'}).notice,'Loaded file: A');
    assert.equal(ctx.editorLoadedPageModel({kind:'local-page',title:'A'}).hasPublicationLocation,false);
    for(const field of ['service','serviceId','url','publicationUrl']) assert.equal(ctx.editorLoadedPageModel({kind:'local-page',[field]:'target'}).hasPublicationLocation,true);
    const page={kind:'page',id:'id',title:'Title',url:'https://example.invalid',format:'html',extra:{keep:true}};
    const model=ctx.editorLoadedPageModel(page,page);assert.equal(model.notice,null);assert.match(model.label,/\[html\]/);
    assert.equal(page.extra.keep,true);
});

test('loader view honors visibility and delegates returned content/page to the shared routing controller',async()=>{
    const f=fixture(),content={type:'text/plain',value:'Body',page:{kind:'file',title:'File.txt'}};
    f.ctx.window.CList.loaders.push({label:'Hidden',hidden:true},{label:'File',load:async()=>content});
    f.ctx.populateLoadOptions();assert.equal(f.root.querySelector('#load-options').textContent.includes('Hidden'),false);
    await f.button('File').onclick();assert.equal(f.routed.length,1);assert.equal(f.routed[0][0],content);
    assert.equal(f.routed[0][1],content.page);await f.routed[0][3]();assert.equal(f.ctx.window.CList.state.editorControls.phase,'sources');
    assert.equal(JSON.stringify(f.ctx.window.CList.state.editorControls).includes('Body'),false);
});

test('duplicate/old loader controls and responses after navigation, session or editor changes cannot route',async()=>{
    for(const change of ['navigation','session','store','editor','close','file']) {
        const f=fixture();let finish,count=0;
        f.ctx.window.CList.loaders.push({label:'Slow',load:()=>{count++;return new Promise(resolve=>finish=resolve);}});
        f.ctx.populateLoadOptions();const button=f.button('Slow'),pending=button.onclick();await button.onclick();assert.equal(count,1);
        if(change==='navigation')f.ctx.playLoadBlank();
        if(change==='session')f.ctx.window.CList.state.username='new';
        if(change==='store')f.ctx.window.CList.config.flaskSiteUrl='https://other.invalid';
        if(change==='editor')await f.ctx.switchToEditor('tinymce');
        if(change==='close')f.ctx.invalidateEditorControls();
        if(change==='file')f.ctx.window.CList.state.editorLoading={id:1};
        finish({type:'text/plain',value:'Old'});await pending;await button.onclick();
        assert.equal(f.routed.length,0,change);assert.equal(count,1,change);
    }
});

test('source failures show feedback and allow explicit retry; cancelled native pickers remain usable',async()=>{
    const f=fixture();let count=0;
    f.ctx.window.CList.loaders.push({label:'Retry',load:async()=>{if(++count===1)throw Error('Read failed');return null;}});
    f.ctx.populateLoadOptions();await f.button('Retry').onclick();assert.deepEqual(f.errors,['Read failed']);
    assert.equal(f.ctx.window.CList.state.editorControls.phase,'failed');await f.button('Retry').onclick();
    assert.equal(count,2);assert.equal(f.ctx.window.CList.state.editorControls.phase,'sources');
});

test('blank review Cancel preserves data and Discard clears only the chosen editor exactly once',async()=>{
    const f=fixture();f.bodies.texteditor='Draft';f.ctx.setReferences([{url:'source'}]);f.ctx.setLoadedPage({kind:'file',title:'Source'});
    f.ctx.saveDraft('texteditor','Draft');f.ctx.playLoadBlank();await f.button('texteditor').onclick();
    await f.button('Cancel').onclick();assert.equal(f.bodies.texteditor,'Draft');assert.equal(f.refs()[0].url,'source');assert.equal(f.memory.size,2);
    await f.button('texteditor').onclick();const discard=f.button('Discard and continue');await discard.onclick();await discard.onclick();
    assert.equal(f.bodies.texteditor,'');assert.deepEqual(plain(f.refs()),[]);assert.equal(f.ctx.currentLoadedPage,null);assert.equal(f.memory.size,0);
    assert.equal(f.messages.filter(message=>message==='Blank editor loaded.').length,1);
});

test('blanking a different editor retains the outgoing body, page and references for resumption',async()=>{
    const f=fixture();f.bodies.texteditor='Source';f.bodies.tinymce='Target';
    f.ctx.setLoadedPage({kind:'file',title:'Source'});f.ctx.setReferences([{url:'source'}]);
    f.ctx.playLoadBlank();await f.button('tinymce').onclick();
    assert.equal(f.ctx.currentEditor,'tinymce');assert.equal(f.bodies.tinymce,'');assert.equal(f.bodies.texteditor,'Source');
    await f.ctx.switchToEditor('texteditor');assert.equal(f.ctx.currentLoadedPage.title,'Source');assert.equal(f.refs()[0].url,'source');
});

test('blank review cannot discard newer typing or another editor after a stale click',async()=>{
    for(const change of ['typing','editor','rebuild','references']) {
        const f=fixture();f.bodies.texteditor='Draft';f.ctx.playLoadBlank();await f.button('texteditor').onclick();const discard=f.button('Discard and continue');
        if(change==='typing')f.bodies.texteditor='New';
        if(change==='editor')await f.ctx.switchToEditor('tinymce');
        if(change==='rebuild')f.ctx.populateLoadOptions();
        if(change==='references')f.ctx.setReferences([{url:'new'}]);
        await discard.onclick();assert.equal(f.bodies.texteditor,change==='typing'?'New':'Draft');
        assert.equal(f.messages.includes('Blank editor loaded.'),false);
    }
});

test('async blank clearing waits for the captured target and failed initialization cannot claim completion',async()=>{
    const f=fixture();let finish;
    f.ctx.editorHandlers.texteditor.setContent=()=>new Promise(resolve=>finish=resolve);
    const blank=f.ctx._doLoadBlank('texteditor');await tick();await f.ctx.switchToEditor('tinymce');finish();await blank;
    assert.equal(f.ctx.currentEditor,'tinymce');assert.equal(f.messages.includes('Blank editor loaded.'),false);
    f.ctx.editorHandlers.texteditor.initialize=()=>{throw Error('Mount failed');};
    await f.ctx._doLoadBlank('texteditor');assert.ok(f.errors.includes('Mount failed'));assert.equal(f.messages.includes('Blank editor loaded.'),false);
});

test('blank eligibility, template Back and page/publication UI use explicit models',async()=>{
    const f=fixture();f.ctx.editorHandlers.account={label:'Account',initialize(){},requiresAccount:true};
    f.ctx.editorHandlers.hidden={label:'Hidden',initialize(){},visible:()=>false};
    f.ctx.playLoadBlank();assert.equal(f.root.querySelector('#load-options').textContent.includes('Account'),false);
    assert.equal(f.root.querySelector('#load-options').textContent.includes('Hidden'),false);
    await f.ctx.window.CList.loaders.find(loader=>loader.label==='Load template').load();await f.button('Back').onclick();
    assert.equal(f.ctx.window.CList.state.editorControls.phase,'sources');
    f.ctx.setLoadedPage({kind:'file',title:'A.xml',documentTitle:'Exact title',serviceExtension:{keep:true}});
    assert.equal(f.root.querySelector('#write-title').textContent,'Exact title');assert.equal(f.root.querySelector('#republish-button').style.display,'none');
    assert.equal(f.ctx.currentLoadedPage.serviceExtension.keep,true);
    f.ctx.setLoadedPage({kind:'local-page',title:'Published',publicationUrl:'https://example.invalid/page',format:'html'});
    assert.equal(f.root.querySelector('#republish-button').style.display,'');assert.match(f.root.querySelector('#loaded-page-filename').textContent,/\[html\]/);
});

test('toolbar action errors are visible and old controls cannot run against a different editor/account',async()=>{
    const f=fixture();let calls=0;
    f.ctx.editorHandlers.texteditor.editorFunctions={Action:async()=>{calls++;throw Error('Action failed');}};
    await f.ctx.initializeEditor('texteditor');const button=f.root.querySelector('#editor-menu').children[0];
    await button.onclick();assert.deepEqual(f.errors,['Action failed']);await f.ctx.switchToEditor('tinymce');await button.onclick();assert.equal(calls,1);
});

test('late source failures do not replace a newer editor/file UI with an obsolete error',async()=>{
    const f=fixture();let reject;
    f.ctx.window.CList.loaders.push({label:'Slow',load:()=>new Promise((resolve,fail)=>reject=fail)});
    f.ctx.populateLoadOptions();const pending=f.button('Slow').onclick();await f.ctx.switchToEditor('tinymce');
    reject(Error('Old source failed'));await pending;assert.deepEqual(f.errors,[]);
    assert.equal(f.ctx.window.CList.state.editorControls.phase,'cancelled');
});

test('blank initialization cannot close a newer load or claim completion after session/store changes',async()=>{
    for(const change of ['session','store','file']) {
        const f=fixture();let finish;
        f.ctx.editorHandlers.texteditor.initialize=()=>new Promise(resolve=>finish=resolve);
        const blank=f.ctx._doLoadBlank('texteditor');await tick();
        if(change==='session')f.ctx.window.CList.state.username='new';
        if(change==='store')f.ctx.window.CList.config.flaskSiteUrl='https://other.invalid';
        if(change==='file')f.ctx.window.CList.state.editorLoading={id:1};
        finish();await blank;
        assert.equal(f.messages.includes('Blank editor loaded.'),false,change);
        assert.equal(f.ctx.window.CList.state.editorControls.phase,'cancelled',change);
    }
});
