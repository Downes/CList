function annotationFieldsFixture(){
    _annotationBody?.controller.dispose();_annotationBody=null;
    _annotationFields?.controller.dispose();_annotationFields=null;_annotationDraft.standalone=null;
    const root=document.createElement('div'),fields=document.createElement('div'),textarea=document.createElement('textarea');root.id='annotateEditDiv';fields.id='annotate-ref-fields';textarea.id='annotate-edit-body';root.append(fields,textarea);document.body.appendChild(root);
    let references=[],body='<p>Existing body</p>';
    const pushes=[],errors=[],behavior={};
    Object.assign(globalThis,{currentEditor:'annotate-edit',currentEditorAccount:'account-a',
        getReferences:()=>references,setReferences:value=>{references=value;},clearReferences:()=>{references=[];},
        pushReference(reference){pushes.push(reference);if(behavior.push)behavior.push();references=appendPanelReference(references,reference);},
        pushAndDisplayReference(reference){globalThis.pushReference(reference);},
        showErrorModal:message=>errors.push(message),escapeHtml:value=>String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'),cleanHTMLContent:value=>value,
        tinymce:{get:()=>({getContent:()=>body,setContent:value=>{body=value;}})}});
    window.CList.state={username:'User',authEpoch:1,editorSwitching:{id:1},editorLoading:{id:1},editorControls:{id:1}};window.CList.config={flaskSiteUrl:'https://storage.invalid'};window.sanitizeHtml=value=>value;
    textarea.value=body;globalThis.tinymce=createAnnotationTinyFake({read:()=>body,write:value=>{body=value;},container:document.createElement('div')});_initAnnotateTinyMCE();
    const render=()=>_renderAnnotateRefFields(fields);render();
    const input=key=>fields.querySelectorAll('input')[ANNOTATION_TARGET_FIELDS.findIndex(([,field])=>field===key)];
    return{root,fields,pushes,errors,behavior,input,render,get references(){return references;},set references(value){references=value;},get target(){return _annotateTarget();},get state(){return window.CList.state.annotationFields;},get body(){return body;},
        edit(key,value,commit=true){const node=input(key);node.value=value;node.oninput();return commit?node.onchange():true;},
        receive:reference=>_annotateReceiveReference(reference,root),
        expire(){window.CList.state.authEpoch++;},switch(){globalThis.currentEditor='other';},account(){globalThis.currentEditorAccount='account-b';},load(){window.CList.state.editorLoading.id++;},
        dispose(){_annotationFields?.controller.dispose();_annotationBody?.controller.dispose();_annotationBody=null;root.remove();}};
}
const annotationDraftCases=[
    ['standalone target and real field view preserve defaults and literal text',check=>{
        const f=annotationFieldsFixture(),target=f.target;
        check(target===f.target&&target.url===''&&target.id===null&&target.replyToken===null&&f.references.length===0,'standalone draft remains private until cited');
        check(f.fields.querySelectorAll('input').length===5&&f.edit('title','<Literal title>')&&f.target.title==='<Literal title>'&&!f.fields.querySelector('Literal'),'real field values are literal');
        check(f.body==='<p>Existing body</p>'&&f.state.dirty===0&&!f.state.busy,'field commit leaves body alone');f.dispose();
    }],
    ['URL promotion keeps target identity and avoids duplicate commits',check=>{
        const f=annotationFieldsFixture(),target=f.target;check(f.edit('url','https://typed.invalid')&&f.references[0]===target,'manual URL registers same live target');
        const count=f.pushes.length;f.input('url').onchange();check(f.pushes.length===count&&f.references.length===1,'duplicate change does not register twice');
        check(f.edit('author_name','Author')&&f.references[0].author_name==='Author','later metadata edits mutate original reference');f.dispose();
    }],
    ['incoming references adopt structural fields/extensions into the live draft',check=>{
        const f=annotationFieldsFixture(),target=f.target,reply={type:'Bluesky',uri:'at://source',cid:'cid'},extension={kept:true};
        f.edit('feed','Typed feed');check(f.receive({url:'https://incoming.invalid',title:'Incoming',author_name:'Writer',feed:'',replyToken:reply,extension,extensionFlag:false})&&f.references[0]===target,'incoming target retains standalone identity');
        check(target.feed==='Typed feed'&&target.replyToken===reply&&target.extension===extension&&target.extensionFlag===false&&f.input('author_name').value==='Writer','truthy adoption retains typed empty-source fields and live extensions');f.dispose();
    }],
    ['convergent references retain primary target and unfinished field edits',check=>{
        const f=annotationFieldsFixture();f.receive({url:'https://first.invalid',title:'First'});const target=f.target,node=f.input('title');f.edit('title','Unfinished title',false);
        check(f.receive({url:'https://second.invalid',title:'Second'})&&f.references.length===2&&f.target===target,'second source is convergent rather than target replacement');
        check(f.input('title')===node&&node.value==='Unfinished title'&&target.title==='First'&&f.state.dirty===1,'same-target refresh keeps unfinished input without committing it');
        f.receive({url:'https://second.invalid',title:'Duplicate'});check(f.references.length===2&&node.value==='Unfinished title','shared exact-URL dedup retained');node.onchange();check(target.title==='Unfinished title','explicit change commits retained edit');f.dispose();
    }],
    ['newer model metadata requires an explicit re-edit before an old draft can overwrite it',check=>{
        const f=annotationFieldsFixture();f.edit('title','Pending',false);f.receive({url:'https://source.invalid',title:'Accepted source'});const node=f.input('title');
        check(node.value==='Pending'&&f.target.title==='Accepted source','pending field preserved alongside newer model');
        check(node.onchange()===false&&node.onchange()===false&&f.target.title==='Accepted source'&&f.fields.textContent.includes('edit this field again'),'stale and duplicate changes cannot overwrite newer metadata');
        check(f.edit('title','Explicit edit')&&f.target.title==='Explicit edit','fresh input explicitly resolves the conflict');f.dispose();
    }],
    ['old target and rebuilt field callbacks cannot modify replacement references',check=>{
        const f=annotationFieldsFixture();f.receive({url:'https://old.invalid',title:'Old'});const old=f.input('title'),target=f.target;
        f.references=[{url:'https://new.invalid',title:'New'}];old.value='Stale';check(old.onchange()===false&&target.title==='Old'&&f.target.title==='New','target identity checked before field mutation');
        f.render();old.oninput();old.onchange();check(f.input('title').value==='New'&&f.target.title==='New','old generation remains inert after rebuild');f.dispose();
    }],
    ['session/editor/account/load changes reject old controls',check=>{
        for(const change of ['expire','switch','account','load']){
            const f=annotationFieldsFixture(),target=f.target,node=f.input('title');f[change]();node.value='Old callback';node.oninput();
            check(node.onchange()===false&&target.title===''&&f.pushes.length===0,change+' invalidates field events');f.dispose();
        }
    }],
    ['clear and native-file restoration rebuild fields without altering save format',check=>{
        const f=annotationFieldsFixture();f.edit('url','https://old.invalid');f.edit('title','Old');const old=f.input('title');_annotateClear();
        check(f.target.url===''&&f.target.title===''&&f.references.length===0&&f.body===''&&old.onchange()===false,'Clear resets target/body and expires old fields');
        const file={format:'clist-annotation-v1',body:'<p>Restored body</p>',target:{url:'https://restored.invalid',title:'Restored',author_name:'Author',feed:'Feed',extension:{kept:true}},references:[]};
        editorHandlers['annotate-edit'].setContent(file);const saved=JSON.parse(editorHandlers['annotate-edit'].getFileContent().value);
        check(f.input('title').value==='Restored'&&f.input('author_name').value==='Author'&&saved.target.extension.kept&&saved.references[0].url==='https://restored.invalid'&&saved.body==='<p>Restored body</p>','native body/target/references/extensions round-trip unchanged');f.dispose();
    }],
    ['reentrant reference registration is locked and failures stay visible',check=>{
        const f=annotationFieldsFixture();let nested;f.behavior.push=()=>{nested=f.receive({url:'https://nested.invalid'});};
        check(f.receive({url:'https://single.invalid'})&&nested===false&&f.references.length===1&&!f.state.busy,'single owned reference adoption');f.dispose();
        const g=annotationFieldsFixture();g.behavior.push=()=>{throw Error('reference panel failed');};check(g.edit('url','https://failed.invalid')===false&&g.errors[0]==='reference panel failed'&&!g.state.busy,'field registration failure visible and unlocked');
        delete g.behavior.push;check(g.input('url').onchange()&&g.references.length===1,'explicit registration retry succeeds without changing the URL');g.dispose();
    }],
    ['field state is DOM-free and presentation excludes draft/reference data',check=>{
        const standalone={standalone:null},target=resolveAnnotationDraftTarget(standalone,[],()=> 'captured-time');target.extension={kept:true};
        check(target.cited_at==='captured-time'&&writeAnnotationDraftField(target,'title','Title')&&!writeAnnotationDraftField(target,'replyToken','Unsupported')&&target.extension.kept,'pure state helpers preserve structural fields');
        const f=annotationFieldsFixture();f.edit('title','Private draft',false);check(Object.keys(f.state).sort().join()==='busy,dirty,generation'&&!JSON.stringify(f.state).includes('Private draft'),'safe controller summary');f.dispose();
    }]
];
