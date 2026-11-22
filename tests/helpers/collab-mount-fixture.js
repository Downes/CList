function mountGate() { let resolve, reject; const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject}; }
async function mountFlush(){for(let i=0;i<16;i++)await Promise.resolve();}
function mountFixture(options={}) {
    if(!document.head){document.head=document.createElement('head');document.body.appendChild(document.head);}
    let source=1,visible=true,intent=0,resource=options.resource||{editor:null,docId:null};
    const calls=[],states=[],errors=[],behavior={},outer=document.createElement('div'),pane=document.createElement('div'),menu=document.createElement('div'),title=document.createElement('p');
    title.id='write-title';outer.append(pane,menu,title);document.body.appendChild(outer);
    globalThis.showErrorModal=(message,settings)=>errors.push({message,settings});
    const controller=createCollabMountController({
        capture:()=>({source,pane}),current:snapshot=>visible&&snapshot.source===source&&snapshot.pane===pane,
        view:snapshot=>createCollabMountView(snapshot.pane),
        controls(){calls.push(['controls']);menu.innerHTML='';const input=document.createElement('input');input.id='collab-doc-id';input.value=title.textContent;menu.appendChild(input);},
        intent:()=>intent,load:async()=>{calls.push(['load']);if(behavior.load)await behavior.load();},resource:()=>resource,
        shortId:id=>id.slice(id.lastIndexOf('/')+1),slug:()=> 'fresh-slug',
        async local(current){intent++;calls.push(['local']);if(behavior.local)await behavior.local();if(!current())throw Object.assign(Error('expired local'),{code:'ExpiredCollabPreparation'});resource={editor:{id:'local-editor'},docId:null};},
        rebind(){calls.push(['rebind']);if(behavior.rebind)behavior.rebind();},
        predefined:async()=>{calls.push(['predefined']);return behavior.predefined?await behavior.predefined():true;},
        drop:event=>{calls.push(['drop',event.type]);if(behavior.drop)return behavior.drop();},state:value=>states.push(structuredClone(value))
    });
    return {controller,calls,states,errors,behavior,pane,title,menu,get resource(){return resource;},set resource(value){resource=value;},
        drop(){const zone=pane.querySelector('#collab-editor-container');if(zone.dispatchEvent)zone.dispatchEvent(new Event('drop',{bubbles:true}));else zone.listeners.drop?.({type:'drop'});},
        expire(){source++;},hide(){visible=false;},intent(){intent++;},dispose(){controller.dispose();outer.remove();}};
}
const collabMountCases=[
    ['fresh activation mounts once, awaits library/local and delivers pending content',async check=>{
        const f=mountFixture();check(await f.controller.activate(),'fresh activation succeeds');
        check(!!f.pane.querySelector('#collabDiv #tiptap-editor')&&f.title.textContent==='fresh-slug','real surface and initial slug');
        check(f.calls.map(call=>call[0]).join()==='controls,load,local,rebind,predefined'&&f.resource.editor.id==='local-editor','ordered construction and pending-content handoff');
        check(f.states.at(-1).phase==='ready'&&!f.states.at(-1).busy&&f.states.every(state=>Object.keys(state).sort().join()==='busy,phase'),'safe ready state');f.dispose();
    }],
    ['remote and local reactivation retain resources and original DOM',async check=>{
        const remote={editor:{id:'remote'},docId:'namespace/Existing'},f=mountFixture({resource:remote});
        check(await f.controller.activate()&&f.title.textContent==='Existing'&&f.resource===remote,'remote identity and short title restored');const node=f.pane.querySelector('#tiptap-editor');
        check(await f.controller.activate()&&f.pane.querySelector('#tiptap-editor')===node&&!f.calls.some(call=>call[0]==='local'),'reactivation rebuilds controls without resource destruction');f.dispose();
        const local={editor:{id:'local'},docId:null},g=mountFixture({resource:local});g.title.textContent='Unsent title';
        check(await g.controller.activate()&&g.title.textContent==='Unsent title'&&g.resource===local&&!g.calls.some(call=>call[0]==='local'),'local title/editor retained');g.dispose();
    }],
    ['duplicate activation shares pending work and one drop handler',async check=>{
        const f=mountFixture(),gate=mountGate();f.behavior.load=()=>gate.promise;const first=f.controller.activate(),second=f.controller.activate();
        check(first===second,'duplicate before mounting coalesces');await mountFlush();check(f.controller.activate()===first,'duplicate while loading coalesces');gate.resolve();await first;
        await f.controller.activate();f.drop();check(f.calls.filter(call=>call[0]==='drop').length===1&&f.calls.filter(call=>call[0]==='local').length===1,'reactivation has one listener and reuses local editor');
        check(document.head.querySelectorAll('#collab-styles').length===1,'style injection remains single');f.dispose();
    }],
    ['source and DOM expiry during library loading cannot construct or hand off',async check=>{
        for(const change of ['expire','hide','remove']){
            const f=mountFixture(),gate=mountGate();f.behavior.load=()=>gate.promise;const pending=f.controller.activate();await mountFlush();if(change==='remove')f.pane.remove();else f[change]();gate.resolve();
            check(await pending===false&&!f.calls.some(call=>call[0]==='local'||call[0]==='predefined')&&f.errors.length===0,change+' rejects delayed mount');f.drop();check(!f.calls.some(call=>call[0]==='drop'),change+' expires drop listener');f.dispose();
        }
    }],
    ['newer connection intent prevents a competing local initializer',async check=>{
        const f=mountFixture(),gate=mountGate();f.behavior.load=()=>gate.promise;const pending=f.controller.activate();await mountFlush();f.intent();gate.resolve();
        check(await pending===false&&!f.calls.some(call=>call[0]==='local')&&f.states.at(-1).phase==='cancelled','new direct connection owns initialization');f.dispose();
    }],
    ['newer title edits during library loading are preserved',async check=>{
        const f=mountFixture(),gate=mountGate();f.behavior.load=()=>gate.promise;const pending=f.controller.activate();await mountFlush();f.title.textContent='Newer title';gate.resolve();
        check(await pending&&f.title.textContent==='Newer title','deferred slug does not replace newer text');f.dispose();
    }],
    ['library/local failures are visible and explicit activation retries',async check=>{
        const f=mountFixture();f.behavior.load=()=>{throw Error('library failed');};
        check(await f.controller.activate()===false&&f.errors[0].message==='library failed'&&!f.calls.some(call=>call[0]==='local'),'dependency failure fails mounting');
        delete f.behavior.load;f.behavior.local=()=>{throw Error('local failed');};
        check(await f.controller.activate()===false&&f.errors[1].message==='local failed'&&!f.calls.some(call=>call[0]==='predefined'),'local failure stops pending content');
        delete f.behavior.local;check(await f.controller.activate()&&f.states.at(-1).phase==='ready','explicit retry succeeds');f.dispose();
    }],
    ['stale local completion and disposed callbacks cannot finish mounting',async check=>{
        const f=mountFixture(),gate=mountGate();f.behavior.local=()=>gate.promise;const pending=f.controller.activate();await mountFlush();f.expire();gate.resolve();
        check(await pending===false&&f.errors.length===0&&!f.calls.some(call=>call[0]==='predefined'),'local preparation receives ownership guard');f.dispose();
        const g=mountFixture(),wait=mountGate();g.behavior.load=()=>wait.promise;const old=g.controller.activate();await mountFlush();g.controller.dispose();wait.reject(Error('late library failure'));
        check(await old===false&&g.errors.length===0,'disposed late errors silent');g.dispose();
    }],
    ['drop failure is visible only on the owned current surface',async check=>{
        const f=mountFixture();await f.controller.activate();f.behavior.drop=()=>Promise.reject(Error('drop failed'));f.drop();await mountFlush();
        check(f.errors.length===1&&f.errors[0].message==='drop failed','async attribution failure visible');f.hide();f.drop();await mountFlush();
        check(f.calls.filter(call=>call[0]==='drop').length===1&&f.errors.length===1,'hidden editor rejects drops');f.dispose();
    }],
    ['pending-content failure remains failure and incomplete surfaces are preserved',async check=>{
        const f=mountFixture();f.behavior.predefined=()=>false;
        check(await f.controller.activate()===false&&f.states.at(-1).phase==='error','shared loader failure returned to editor switch');f.dispose();
        const g=mountFixture(),existing=document.createElement('div');existing.id='collabDiv';existing.textContent='Preserve existing';g.pane.appendChild(existing);
        check(await g.controller.activate()===false&&existing.textContent==='Preserve existing'&&g.errors.length===1,'incomplete surface fails without replacing existing content');g.dispose();
    }]
];
