const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function fixture(withContent=false){
    let resolve,registered=null;
    const gate=new Promise(done=>{resolve=done;}),calls=[],editors=[],behavior={};
    const nodes=new Map(),parent={insertBefore(node){node.isConnected=true;nodes.set(node.id,node);}};
    const content={style:{},parentNode:parent,appendChild(node){node.isConnected=true;nodes.set(node.id,node);}};
    const root={id:'tinymceEditorDiv',style:{},isConnected:true};nodes.set(root.id,root);nodes.set('write-column',{value:''});
    const ctx=vm.createContext({console:{log(){},error(){}},currentEditor:'texteditor',currentEditorAccount:null,
        pendingContent:withContent?{type:'text/html',value:'Keep this'}:null,editorHandlers:{},
        CList:{ui:{view:{writePaneContent:content}}},
        document:{getElementById:id=>nodes.get(id)||null,createElement:()=>({}),documentElement:{classList:{contains:()=>false}}},
        debounce:fn=>fn,saveDraft(){},_attributeDroppedContent(){},
        offerDraftRestore:async()=>calls.push('draft'),loadPredefinedContent:async()=>{calls.push('content');},readerSession:()=>({token:ctx.token}),token:'first',
        tinymce:{get:()=>registered,init(config){
            calls.push('init');
            const editor={id:'write-column',on(){},getContent:()=>'',getDoc:()=>({addEventListener(){}}),removed:0,
                remove(){this.removed++;if(registered===this)registered=null;}};
            editors.push(editor);registered=editor;config.setup(editor);
            if(behavior.init)return behavior.init(config,editor);
            return gate.then(()=>{config.init_instance_callback(editor);return [editor];});
        }}
    });
    ctx.window=ctx;
    vm.runInContext(fs.readFileSync('js/tinymce.js','utf8'),ctx);
    return{ctx,calls,editors,behavior,resolve,handler:ctx.editorHandlers.tinymce,initialized:()=>vm.runInContext('TinyMCE_Intialized',ctx)};
}
test('real HTML handler waits for TinyMCE readiness before delivering content or declaring success',async()=>{
    const f=fixture(true);let finished=false;
    const pending=f.handler.initialize().then(value=>{finished=true;return value;});
    await Promise.resolve();assert.equal(finished,false);assert.equal(f.initialized(),false);
    assert.deepEqual(f.calls,['init']);
    f.resolve();assert.equal(await pending,true);assert.deepEqual(f.calls,['init','content']);assert.equal(f.initialized(),true);
    await f.handler.initialize();assert.equal(f.calls.filter(x=>x==='init').length,1);
});
test('rejected initialization cleans partial instance and permits explicit retry',async()=>{
    const f=fixture();f.behavior.init=async()=>{throw Error('Skin failed');};
    await assert.rejects(f.handler.initialize(),/Skin failed/);
    assert.equal(f.initialized(),false);assert.equal(f.editors[0].removed,1);
    assert.ok(!f.calls.includes('draft'));
    delete f.behavior.init;const retry=f.handler.initialize();f.resolve();assert.equal(await retry,true);
    assert.equal(f.calls.filter(x=>x==='draft').length,1);
});
test('session change while TinyMCE initializes prevents stale content/draft delivery',async()=>{
    const f=fixture(true),pending=f.handler.initialize();f.ctx.token='new-session';f.resolve();
    assert.equal(await pending,false);assert.equal(f.initialized(),false);
    assert.deepEqual(f.calls,['init']);assert.equal(f.editors[0].removed,1);
});
test('an empty TinyMCE initialization result is a failure rather than a successful blank mount',async()=>{
    const f=fixture();f.behavior.init=async()=>[];
    await assert.rejects(f.handler.initialize(),/did not finish/);assert.equal(f.initialized(),false);
});
