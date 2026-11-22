const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {menuShellDocument}=require('./helpers/menu-shell-dom.cjs');
const ctx=vm.createContext({structuredClone});vm.runInContext(fs.readFileSync('js/collab_connection_preparation.js','utf8'),ctx);
vm.runInContext(fs.readFileSync('tests/helpers/collab-preparation-fixture.js','utf8'),ctx);
for(const [name,run]of vm.runInContext('collabPreparationCases',ctx))test(name,()=>run((condition,message)=>assert.ok(condition,message)));

test('real Collab local/remote initialization uses captured preparation before replacing resources',async()=>{
    const document=menuShellDocument(),calls=[],seedTimers=[],source={storeUrl:'https://captured.invalid',token:'original-token',username:'Captured user'};
    for(const id of ['collabDiv','tiptap-editor','collab-status','collab-format-toolbar','collab-doc-id','collab-doc-warning','write-title']){const node=document.createElement('div');node.id=id;document.body.appendChild(node);}
    const extension={configure:options=>options};
    const modules={StarterKit:extension,Collaboration:extension,CollaborationCursor:extension,Link:extension,
        Y:{Doc:class{getMap(){return Object.assign(new Map(),{observe(){},unobserve(){}});}destroy(){calls.push(['destroy-doc']);}}},
        Editor:class{constructor(options){calls.push(['editor',options]);this.isEditable=options.editable;this.isEmpty=true;this.commands={insertContent:html=>calls.push(['insert',html]),setContent:html=>{calls.push(['seed',html]);this.isEmpty=false;},focus:where=>calls.push(['focus',where])};}isActive(){return false;}getText(){return 'Draft';}on(){}off(){}destroy(){calls.push(['destroy-editor']);}},
        HocuspocusProvider:class{constructor(options){calls.push(['provider',options]);this.awareness={on(){},off(){},getStates:()=>new Map()};}destroy(){calls.push(['destroy-provider']);}}};
    let load=async()=>modules;
    const context=vm.createContext({document,window:{CList:{defaults:{COLLAB:'https://default.invalid'},state:{},accounts:[],ui:{view:{writeTitle:document.getElementById('write-title')}}}},
        editorHandlers:{},currentEditor:'collab',currentEditorAccount:'captured-account',readerSession:()=>({...source}),
        fixtureLoad:()=>load(),fixtureServer:async()=> 'wss://selected.invalid',setReferences:refs=>calls.push(['references',refs]),loadPredefinedContent:editor=>{calls.push(['predefined',editor]);return true;},
        setTimeout(callback,delay){if(delay===800)seedTimers.push(callback);return 1;},clearTimeout(){},expandDocId:async name=>'namespace/'+name,slugify:()=> 'collection-slug',generateDocSlug:()=> 'fallback',sanitizeHtml:html=>html,wsUrlToRestBase:url=>url.replace('wss://','https://'),fetch:async(url,options)=>{calls.push(['title-check',url,options]);return{ok:true,json:async()=>({allow_anonymous:false})};},
        showErrorModal:message=>calls.push(['error-modal',message]),showModal:root=>{document.getElementById('generic-modal')?.remove();const modal=document.createElement('div');modal.id='generic-modal';modal.appendChild(root);document.body.appendChild(modal);},
        copyToClipboard:async link=>calls.push(['copy',link]),showStatusMessage:message=>calls.push(['status',message]),displayReferences:container=>calls.push(['display-references',container]),pushReference:reference=>calls.push(['reference',reference]),loadContent:(content,itemId)=>calls.push(['load-content',content,itemId]),activeDiscussionName:'Fixture discussion',
        escapeHtml:value=>String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'),
        getRealtimeDocShareLink:(server,id,mode)=>server.replace('wss://','https://')+'/doc/'+id.split('/').map(encodeURIComponent).join('/')+'/'+mode,console,URL});
    for(const name of ['collab_connection_preparation','collab_connection_view','collab_connection','collab_format_view','collab_format','collab_title_requests','collab_title_view','collab_title','collab_share_requests','collab_share_view','collab_share','collab_composer_view','collab_composer','collab_opening_workflow','collab_opening_view','collab_opening','collab_creation_workflow','collab_creation_view','collab_creation','collab_header_view','collab_header','collab_content_workflow','collab_content_view','collab_content','collab_mount_view','collab_mount'])vm.runInContext(fs.readFileSync('js/'+name+'.js','utf8'),context);
    let code=fs.readFileSync('js/collab.js','utf8');
    code=code.replace('editorHandlers.collab = collabHandler',`editorHandlers.collab = collabHandler;
        loadDeps=()=>fixtureLoad();getCollabWsUrl=()=>fixtureServer();
        window.fixtureCollab={connect:connectToDoc,local:initLocalEditor,title:getTitleController,header:menu=>mountCollabHeader(menu)};`);
    vm.runInContext(code,context);await context.window.fixtureCollab.connect('existing','edit','wss://initial.invalid');const baseline=calls.length;
    const gate=vm.runInContext('(()=>{let resolve;const promise=new Promise(yes=>resolve=yes);return{promise,resolve};})()',context);
    load=()=>gate.promise;const pending=context.window.fixtureCollab.connect('old');await new Promise(resolve=>setImmediate(resolve));source.token='replacement';gate.resolve(modules);
    await assert.rejects(pending,{code:'ExpiredCollabPreparation'});assert.equal(calls.length,baseline);
    load=async()=>modules;await context.window.fixtureCollab.connect('selected','read','wss://captured-server.invalid');
    const provider=calls.filter(call=>call[0]==='provider').at(-1)[1],editor=calls.filter(call=>call[0]==='editor').at(-1)[1];
    assert.equal(provider.url,'wss://captured-server.invalid');assert.equal(provider.token,'replacement');assert.equal(provider.parameters.kvstoreUrl,source.storeUrl);
    assert.equal(editor.editable,false);assert.equal(editor.element,document.getElementById('tiptap-editor'));assert.equal(calls.filter(call=>call[0]==='destroy-editor').length,1);assert.equal(calls.filter(call=>call[0]==='destroy-provider').length,1);
    assert.equal(document.getElementById('collab-format-toolbar').querySelectorAll('button').length,8);assert.equal(document.getElementById('collab-format-toolbar').querySelector('button').disabled,true);
    const remoteGate=vm.runInContext('(()=>{let resolve;const promise=new Promise(yes=>resolve=yes);return{promise,resolve};})()',context);
    load=()=>remoteGate.promise;const remote=context.window.fixtureCollab.connect('superseded');await new Promise(resolve=>setImmediate(resolve));
    load=async()=>modules;await context.window.fixtureCollab.local();assert.equal(context.editorHandlers.collab.getDocId(),null);const count=calls.length;remoteGate.resolve(modules);
    await assert.rejects(remote,{code:'ExpiredCollabPreparation'});assert.equal(calls.length,count);
    document.getElementById('collab-doc-id').value='fresh';const title=context.window.fixtureCollab.title();await title.check();assert.equal(title.hasExisting(),true);
    await title.enter();assert.equal(context.editorHandlers.collab.getDocId(),'namespace/fresh');assert.equal(document.getElementById('write-title').textContent,'fresh');
    assert.equal(calls.filter(call=>call[0]==='title-check').at(-1)[2].headers.Authorization,'Bearer replacement');title.dispose();
    await context.window.shareCollabDoc();const sharing=vm.runInContext('_collabSharePanel',context);await sharing.save(true);
    const patch=calls.filter(call=>call[0]==='title-check').at(-1);assert.equal(patch[2].method,'PATCH');assert.equal(patch[2].headers.Authorization,'Bearer replacement');assert.equal(JSON.parse(patch[2].body).allow_anonymous,true);
    await context.window.copyCollabLink('read');assert.match(calls.find(call=>call[0]==='copy')[1],/namespace\/fresh\/read$/);
    context.window.sendCollabInvite=invite=>{calls.push(['invite',invite]);return true;};assert.equal(context.window.shareCollabViaChat('edit'),true);assert.equal(calls.find(call=>call[0]==='invite')[1].docId,'namespace/fresh');sharing.dispose();
    assert.ok(context.window.openCollabSharePost('read'));assert.equal(context.currentEditor,'collab-share');assert.match(await context.editorHandlers['collab-share'].getContent(),/namespace\/fresh\/read/);
    document.getElementById('collab-share-close-btn').onclick();assert.equal(context.currentEditor,'collab');assert.equal(context.editorHandlers['collab-share'],undefined);
    assert.equal(await context.window.openCollabUrl('https://linked.invalid/doc/ns/linked/read'),true);
    assert.equal(context.editorHandlers.collab.getDocId(),'ns/linked');assert.equal(calls.filter(call=>call[0]==='provider').at(-1)[1].url,'wss://linked.invalid');
    assert.equal(document.getElementById('collab-doc-id').value,'linked');
    assert.equal(await context.window.openCollabInvite({docId:'invite/doc',title:'<literal>',mode:'edit',server:'wss://invited.invalid'}),true);
    assert.equal(context.editorHandlers.collab.getDocId(),'invite/doc');assert.equal(document.getElementById('write-title').textContent,'doc');
    assert.equal(await context.window.openCollabWithCollection('Captured collection',[{url:'https://member.invalid',title:'<Member>'}]),true);
    assert.equal(context.editorHandlers.collab.getDocId(),'namespace/collection-slug');seedTimers.at(-1)();assert.match(calls.filter(call=>call[0]==='seed').at(-1)[1],/https:\/\/member.invalid/);
    assert.match(calls.filter(call=>call[0]==='seed').at(-1)[1],/&lt;Member&gt;/);assert.equal(calls.filter(call=>call[0]==='invite').at(-1)[1].server,'wss://selected.invalid');
    assert.equal(await context.window.openCollabFromChat('<p>Captured chat</p>','Fixture discussion'),true);const oldSeed=seedTimers.at(-1),seedCount=calls.filter(call=>call[0]==='seed').length;
    assert.equal(await context.window.openCollabUrl('https://new.invalid/doc/new/read'),true);oldSeed();assert.equal(calls.filter(call=>call[0]==='seed').length,seedCount);assert.equal(context.editorHandlers.collab.getDocId(),'new');
    const incoming=document.createElement('div');incoming.id='incoming-row';incoming.reference={url:'https://source.invalid',title:'Captured source',replyToken:{type:'Mastodon',statusId:'42'}};document.body.appendChild(incoming);
    assert.equal(context.editorHandlers.collab.loadContent({type:'text/plain',value:'Literal <quote>'},incoming.id),false);
    await context.window.fixtureCollab.connect('editable','edit','wss://content.invalid');
    assert.equal(context.editorHandlers.collab.loadContent({type:'text/plain',value:'Literal <quote>'},incoming.id),true);assert.equal(calls.filter(call=>call[0]==='insert').at(-1)[1],'<p>Literal &lt;quote&gt;</p>');
    assert.equal(calls.filter(call=>call[0]==='reference').at(-1)[1],incoming.reference);
    await context.window.openCollabUrl('https://new.invalid/doc/new/read');
    for(const id of ['collab-doc-id','collab-doc-warning','collab-format-toolbar','collab-status'])document.getElementById(id)?.remove();
    const menu=document.createElement('div');menu.id='editor-menu';document.body.appendChild(menu);const header=context.window.fixtureCollab.header(menu);
    assert.equal(await header.annotate(),true);assert.equal(calls.filter(call=>call[0]==='reference').at(-1)[1].url,'https://new.invalid/doc/new/read');assert.deepEqual(calls.find(call=>call[0]==='load-content').slice(1).map(value=>JSON.stringify(value)),['{"type":"text/plain","value":""}','null']);
    assert.equal(await header.share(),true);assert.equal(context.window.CList.state.collabHeader.busy,false);
    await context.window.fixtureCollab.local();document.getElementById('collab-doc-id').value='captured-local';const namespaceGate=vm.runInContext('(()=>{let resolve;const promise=new Promise(yes=>resolve=yes);return{promise,resolve};})()',context);context.expandDocId=()=>namespaceGate.promise;
    const pendingHeaderShare=header.share();await new Promise(resolve=>setImmediate(resolve));const providerCount=calls.filter(call=>call[0]==='provider').length;
    const copies=calls.filter(call=>call[0]==='copy').length;source.token='another-session';namespaceGate.resolve('old/document');assert.equal(await pendingHeaderShare,false);assert.equal(calls.filter(call=>call[0]==='provider').length,providerCount);header.dispose();
    assert.equal(await context.window.copyCollabLink('read'),false);assert.equal(calls.filter(call=>call[0]==='copy').length,copies);assert.equal(context.editorHandlers.collab.getDocId(),null);
    document.head=document.createElement('head');document.body.appendChild(document.head);const pane=document.createElement('div');document.body.appendChild(pane);context.window.CList.ui.view.writePaneContent=pane;
    const collabRoot=document.getElementById('collabDiv'),zone=document.createElement('div');zone.id='collab-editor-container';zone.appendChild(document.getElementById('tiptap-editor'));collabRoot.appendChild(zone);pane.appendChild(collabRoot);
    context.window._attributeDroppedContent=event=>calls.push(['drop',event.type]);
    assert.equal(await context.editorHandlers.collab.initialize(),true);assert.equal(context.window.CList.state.collabMount.phase,'ready');assert.equal(calls.filter(call=>call[0]==='predefined').at(-1)[1],'collab');
    const localEditorCount=calls.filter(call=>call[0]==='editor').length;assert.equal(await context.editorHandlers.collab.initialize(),true);assert.equal(calls.filter(call=>call[0]==='editor').length,localEditorCount);zone.listeners.drop({type:'drop'});assert.equal(calls.filter(call=>call[0]==='drop').length,1);
    await context.window.fixtureCollab.connect('namespace/retained','edit','wss://retained.invalid');const remoteEditorCount=calls.filter(call=>call[0]==='editor').length;
    assert.equal(await context.editorHandlers.collab.initialize(),true);assert.equal(calls.filter(call=>call[0]==='editor').length,remoteEditorCount);assert.equal(context.editorHandlers.collab.getDocId(),'namespace/retained');assert.equal(document.getElementById('collab-doc-id').value,'retained');
});
