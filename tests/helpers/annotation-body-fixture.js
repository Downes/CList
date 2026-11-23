function annotationBodyGate(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};}
async function annotationBodyFlush(){for(let i=0;i<16;i++)await Promise.resolve();}
function annotationBodyFixture(initial='<p>Initial body</p>'){
    _annotationBody?.controller.dispose();_annotationBody=null;_annotationFields?.controller.dispose();_annotationFields=null;_annotationDraft.standalone=null;
    const outer=document.createElement('div');document.body.appendChild(outer);let root,textarea;
    const surface=value=>{root=document.createElement('div');root.id='annotateEditDiv';textarea=document.createElement('textarea');textarea.id='annotate-edit-body';textarea.value=value;root.appendChild(textarea);outer.appendChild(root);};surface(initial);
    const fake=createAnnotationTinyFake({container:document.createElement('div')}),notices=[],predefined=[];
    Object.assign(globalThis,{tinymce:fake,currentEditor:'annotate-edit',currentEditorAccount:null,
        getReferences:()=>[],setReferences(){},clearReferences(){},pushReference(){},pushAndDisplayReference(){},
        showStatusMessage:message=>notices.push(message),showErrorModal:message=>notices.push(message),
        loadPredefinedContent:async editor=>{predefined.push(editor);return true;},
        escapeHtml:value=>String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'),cleanHTMLContent:value=>value});
    window.CList.state={username:'User',authEpoch:1,editorSwitching:{id:1},editorLoading:{id:1},editorControls:{id:1}};window.CList.config={flaskSiteUrl:'https://storage.invalid'};window.CList.ui={view:{writePaneContent:outer}};
    return{outer,fake,notices,predefined,get root(){return root;},get textarea(){return textarea;},get controller(){return getAnnotationBodyController();},get state(){return window.CList.state.annotationBody;},
        initialize:()=>_initAnnotateTinyMCE(),get body(){return editorHandlers['annotate-edit'].getContent();},set body(value){editorHandlers['annotate-edit'].setContent(value);},
        input(value){textarea.value=value;textarea.oninput();},replace(value){root.remove();surface(value);},expire(){window.CList.state.authEpoch++;},
        retry(){const button=Array.from(root.querySelectorAll('button')).find(node=>node.textContent==='Retry rich editor');return button.onclick();},
        dispose(){_annotationBody?.controller.dispose();_annotationBody=null;_annotationFields?.controller.dispose();_annotationFields=null;outer.remove();}};
}
const annotationBodyCases=[
    ['real handler uses one captured rich instance and mirrors input/undo/redo',async check=>{
        const f=annotationBodyFixture();check(await f.initialize(),'rich initialization succeeds');const editor=f.fake.editors[0];
        check(editor.target===f.textarea&&editor.target.id.startsWith('clist-annotation-body-')&&f.body==='<p>Initial body</p>','captured unique target seeded');
        editor.edit('<p>New edit</p>');check(f.textarea.value==='<p>New edit</p>'&&f.body==='<p>New edit</p>','input mirrors to captured backing field');
        editor.setContent('<p>Undo</p>');editor.emit('undo');editor.setContent('<p>Redo</p>');editor.emit('redo');check(f.textarea.value==='<p>Redo</p>','undo/redo mirror');
        f.fake.get=()=>({getContent:()=> 'Wrong global editor'});check(f.body==='<p>Redo</p>'&&f.state.phase==='ready','no global editor lookup');f.dispose();
    }],
    ['pending API/fallback edits survive initialization and duplicate init coalesces',async check=>{
        const f=annotationBodyFixture(),gate=annotationBodyGate();f.fake.behavior.init=()=>gate.promise;const first=f.initialize(),second=f.initialize();check(first===second&&f.fake.editors.length===1,'one pending initializer');
        f.body='<p>New native body</p>';f.input('<p>Latest fallback edit</p>');gate.resolve([f.fake.editors[0]]);check(await first&&f.body==='<p>Latest fallback edit</p>','latest same-target content seeded');
        const editor=f.fake.editors[0],count=editor.sets.length;editor.edit('<p>Later rich edit</p>');editor.emit('init');check(editor.sets.length===count&&f.body==='<p>Later rich edit</p>','duplicate init callback cannot reseed newer edits');f.dispose();
    }],
    ['late old callbacks cannot seed or remove a replacement editor',async check=>{
        const f=annotationBodyFixture(),gate=annotationBodyGate();f.fake.behavior.init=()=>gate.promise;const pending=f.initialize(),old=f.fake.editors[0],savedInit=[...old.events.get('init')][0],oldId=old.target.id;
        f.replace('<p>Replacement body</p>');delete f.fake.behavior.init;check(await f.initialize(),'replacement initializes');const current=f.fake.editors[1];savedInit();gate.resolve([old]);
        check(await pending===false&&old.removed===1&&current.removed===0&&f.body==='<p>Replacement body</p>'&&current.target.id!==oldId,'old resource isolated and removed once');f.dispose();
    }],
    ['session expiry rejects old setup while preserving the new backing content',async check=>{
        const f=annotationBodyFixture(),gate=annotationBodyGate();f.fake.behavior.init=()=>gate.promise;const old=f.initialize(),editor=f.fake.editors[0];f.expire();f.body='<p>New session body</p>';delete f.fake.behavior.init;
        await f.initialize();gate.resolve([editor]);check(await old===false&&editor.removed===1&&f.body==='<p>New session body</p>','expired session cannot overwrite new controller');f.dispose();
    }],
    ['failed initialization leaves a usable textarea and explicit rich retry',async check=>{
        const f=annotationBodyFixture();f.fake.behavior.init=()=>Promise.reject(Error('startup failed'));check(await f.initialize()===false&&f.state.phase==='fallback'&&f.root.textContent.includes('Description kept'),'visible failure with fallback');
        f.input('<p>Fallback edit</p>');f.body='<p>Native fallback body</p>';delete f.fake.behavior.init;
        check(await f.retry()&&f.body==='<p>Native fallback body</p>'&&f.fake.editors[0].removed===1&&f.fake.editors.length===2,'explicit retry preserves updated body');f.dispose();
    }],
    ['unavailable library still mounts an editable annotation description',async check=>{
        const f=annotationBodyFixture();globalThis.tinymce={};
        check(await editorHandlers['annotate-edit'].initialize()&&f.state.phase==='fallback'&&f.predefined.length===1,'fallback counts as a usable mounted editor');f.input('<p>Textarea only</p>');check(f.body==='<p>Textarea only</p>','fallback read API works');f.dispose();
    }],
    ['hidden/reactivated editor preserves resources and body with fresh field ownership',async check=>{
        const f=annotationBodyFixture();await editorHandlers['annotate-edit'].initialize();const editor=f.fake.editors[0];editor.edit('<p>Kept draft</p>');globalThis.currentEditor='other';globalThis.currentEditorAccount='other-account';
        check(f.body==='<p>Kept draft</p>'&&editor.removed===0,'background body retained across selection');window.CList.state.editorSwitching.id++;globalThis.currentEditorAccount=null;
        check(await editorHandlers['annotate-edit'].initialize()&&f.fake.editors.length===1&&f.body==='<p>Kept draft</p>','reactivation reuses captured rich editor');f.dispose();
    }],
    ['fallback and rich append paths retain the existing end-of-body rules',async check=>{
        const f=annotationBodyFixture('');editorHandlers['annotate-edit'].loadContent({type:'text/plain',value:'First'});editorHandlers['annotate-edit'].loadContent({type:'text/plain',value:'Second'});
        check(f.body==='First<br><br>Second','pre-ready fallback appends with legacy breaks');await f.initialize();editorHandlers['annotate-edit'].loadContent({type:'text/plain',value:'Third'});
        check(f.body==='First<br><br>Second<p>Third</p>','rich append stays at the end');f.dispose();
    }],
    ['API failures propagate while retaining desired fallback content',async check=>{
        const f=annotationBodyFixture();await f.initialize();f.fake.behavior.setError=true;let failed=false;try{f.body='<p>Desired body</p>';}catch{failed=true;}
        check(failed&&f.state.phase==='fallback'&&f.body==='<p>Desired body</p>'&&f.fake.editors[0].removed===1,'failed rich write preserves fallback and reports failure');
        delete f.fake.behavior.setError;await f.retry();f.fake.behavior.readError=true;failed=false;try{void f.body;}catch{failed=true;}
        check(failed&&f.state.phase==='fallback','rich read error is not silently treated as publication content');f.dispose();
    }],
    ['dispose settles pending ownership and best-effort cleanup stays idempotent',async check=>{
        const f=annotationBodyFixture(),gate=annotationBodyGate();f.fake.behavior.init=()=>gate.promise;const pending=f.initialize(),controller=f.controller,editor=f.fake.editors[0];controller.dispose();controller.dispose();
        check(await pending===false&&editor.removed===1&&[...editor.events.values()].every(list=>list.size===0)&&f.textarea.oninput===null,'dispose settles waiter and removes listeners once');gate.resolve([editor]);await annotationBodyFlush();check(editor.removed===1,'late resolve cannot repeat removal');f.dispose();
        const g=annotationBodyFixture();await g.initialize();g.fake.behavior.removeError=true;g.controller.dispose();check(g.notices.length===1&&g.fake.editors[0].removed===1&&Object.keys(g.state).sort().join()==='busy,phase','cleanup failure visible with secret-free state');g.dispose();
    }]
];
