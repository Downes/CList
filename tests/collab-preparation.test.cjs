const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {menuShellDocument}=require('./helpers/menu-shell-dom.cjs');
const ctx=vm.createContext({structuredClone});vm.runInContext(fs.readFileSync('js/collab_connection_preparation.js','utf8'),ctx);
vm.runInContext(fs.readFileSync('tests/helpers/collab-preparation-fixture.js','utf8'),ctx);
for(const [name,run]of vm.runInContext('collabPreparationCases',ctx))test(name,()=>run((condition,message)=>assert.ok(condition,message)));

test('real Collab local/remote initialization uses captured preparation before replacing resources',async()=>{
    const document=menuShellDocument(),calls=[],source={storeUrl:'https://captured.invalid',token:'original-token',username:'Captured user'};
    for(const id of ['tiptap-editor','collab-status']){const node=document.createElement('div');node.id=id;document.body.appendChild(node);}
    const extension={configure:options=>options};
    const modules={StarterKit:extension,Collaboration:extension,CollaborationCursor:extension,Link:extension,
        Y:{Doc:class{getMap(){return{observe(){}};}}},
        Editor:class{constructor(options){calls.push(['editor',options]);}destroy(){calls.push(['destroy-editor']);}},
        HocuspocusProvider:class{constructor(options){calls.push(['provider',options]);this.awareness={on(){}};}destroy(){calls.push(['destroy-provider']);}}};
    let load=async()=>modules;
    const context=vm.createContext({document,window:{CList:{defaults:{COLLAB:'https://default.invalid'},state:{},accounts:[]}},
        editorHandlers:{},currentEditor:'collab',currentEditorAccount:'captured-account',readerSession:()=>({...source}),
        fixtureLoad:()=>load(),fixtureServer:async()=> 'wss://selected.invalid',setReferences:refs=>calls.push(['references',refs]),
        setTimeout(){return 1;},console,URL});
    vm.runInContext(fs.readFileSync('js/collab_connection_preparation.js','utf8'),context);
    let code=fs.readFileSync('js/collab.js','utf8');
    code=code.replace('editorHandlers.collab = collabHandler',`editorHandlers.collab = collabHandler;
        loadDeps=()=>fixtureLoad();getCollabWsUrl=()=>fixtureServer();buildFormatToolbar=()=>{};
        window.fixtureCollab={connect:connectToDoc,local:initLocalEditor,seed(){
            tiptapEditor={destroy(){fixtureOldEditor();}};hocuspocusProvider={destroy(){fixtureOldProvider();}};
        }};`);
    let oldEditor=0,oldProvider=0;context.fixtureOldEditor=()=>oldEditor++;context.fixtureOldProvider=()=>oldProvider++;
    vm.runInContext(code,context);context.window.fixtureCollab.seed();
    const gate=vm.runInContext('(()=>{let resolve;const promise=new Promise(yes=>resolve=yes);return{promise,resolve};})()',context);
    load=()=>gate.promise;const pending=context.window.fixtureCollab.connect('old');await new Promise(resolve=>setImmediate(resolve));source.token='replacement';gate.resolve(modules);
    await assert.rejects(pending,{code:'ExpiredCollabPreparation'});assert.equal(oldEditor,0);assert.equal(oldProvider,0);assert.equal(calls.length,0);
    load=async()=>modules;await context.window.fixtureCollab.connect('selected','read','wss://captured-server.invalid');
    const provider=calls.find(call=>call[0]==='provider')[1],editor=calls.find(call=>call[0]==='editor')[1];
    assert.equal(provider.url,'wss://captured-server.invalid');assert.equal(provider.token,'replacement');assert.equal(provider.parameters.kvstoreUrl,source.storeUrl);
    assert.equal(editor.editable,false);assert.equal(editor.element,document.getElementById('tiptap-editor'));assert.equal(oldEditor,1);assert.equal(oldProvider,1);
    const remoteGate=vm.runInContext('(()=>{let resolve;const promise=new Promise(yes=>resolve=yes);return{promise,resolve};})()',context);
    load=()=>remoteGate.promise;const remote=context.window.fixtureCollab.connect('superseded');await new Promise(resolve=>setImmediate(resolve));
    load=async()=>modules;await context.window.fixtureCollab.local();const count=calls.length;remoteGate.resolve(modules);
    await assert.rejects(remote,{code:'ExpiredCollabPreparation'});assert.equal(calls.length,count);
});
