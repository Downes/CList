function headerGate() { let resolve, reject; const promise = new Promise((yes,no) => { resolve=yes; reject=no; }); return { promise, resolve, reject }; }
async function headerFlush() { for(let i=0;i<12;i++) await Promise.resolve(); }
function headerFixture(options={}) {
    let source=1, target=options.local ? null : {docId:'namespace/original',title:'<Literal title>',token:'private-token',links:{read:'https://read.invalid/doc/original/read'}};
    const calls=[],states=[],errors=[],behavior={},menu=document.createElement('div');menu.id='editor-menu';document.body.appendChild(menu);
    globalThis.showErrorModal=(message,settings)=>errors.push({message,settings});
    globalThis.mainContent={getBoundingClientRect:()=>({width:100})};globalThis.readPane={getBoundingClientRect:()=>({width:80})};globalThis.snapPanes=direction=>calls.push(['snap',direction]);
    const captured=source,view=createCollabHeaderView(menu);
    const controller=createCollabHeaderController({current:()=>source===captured,
        capture:()=>({target:target?structuredClone(target):null,name:menu.querySelector('input').value}),now:()=> '2026-11-21T12:00:00.000Z',
        targetCurrent:value=>!!target&&value.docId===target.docId,
        async ensure(snapshot,current){calls.push(['ensure',snapshot.name]);if(behavior.ensure)return await behavior.ensure(snapshot,current);target={docId:'namespace/created',title:'Created',links:{read:'https://read.invalid/doc/created/read'}};return structuredClone(target);},
        async share(value){calls.push(['share',value]);if(behavior.share)await behavior.share();},
        async reference(value){calls.push(['reference',value]);if(behavior.reference)await behavior.reference();},
        async load(){calls.push(['load']);if(behavior.load)await behavior.load();},state:value=>states.push(structuredClone(value))
    },view);
    menu.querySelector('input').value='Initial title';
    return{controller,view,menu,calls,states,errors,behavior,
        share:()=>menu.querySelector('#collab-invite-btn').onclick(),annotate:()=>menu.querySelector('#collab-annotate-btn').onclick(),
        expire(){source++;},replace(){target={docId:'new/document',title:'New',links:{read:'https://new.invalid'}};},
        dispose(){controller.dispose();menu.remove();}};
}
const collabHeaderCases=[
    ['header view preserves structural IDs and standard controls',async check=>{
        const f=headerFixture();
        check(['collab-doc-picker','collab-doc-id','collab-doc-warning','collab-format-toolbar','collab-who','collab-status'].every(id=>!!f.menu.querySelector('#'+id)),'existing title/format/presence/status slots retained');
        check(f.menu.querySelector('input').type==='hidden'&&f.menu.querySelector('#collab-invite-btn').className==='btn btn-small'&&f.menu.querySelector('#collab-annotate-btn').title==='Annotate this document','existing control patterns');f.dispose();
    }],
    ['Share captures document and keeps presentation free of credentials',async check=>{
        const f=headerFixture();check(await f.share(),'existing document sharing dispatched');
        const call=f.calls.find(call=>call[0]==='share');check(call[1].docId==='namespace/original'&&call[1].title==='<Literal title>'&&!f.calls.some(call=>call[0]==='ensure'),'uses captured existing document without creating');
        check(f.states.every(value=>Object.keys(value).sort().join()==='action,busy')&&!JSON.stringify(f.states).includes('private-token'),'safe presentation state');f.dispose();
    }],
    ['local Share awaits guarded creation and rejects duplicate actions',async check=>{
        const f=headerFixture({local:true}),gate=headerGate();f.behavior.ensure=()=>gate.promise;
        const pending=f.share(),duplicate=f.annotate();check(pending===duplicate&&f.menu.querySelector('#collab-invite-btn').disabled&&f.menu.querySelector('#collab-annotate-btn').disabled,'single busy action shared by controls');
        await headerFlush();f.replace();gate.resolve({docId:'new/document',links:{read:'https://new.invalid'}});
        check(await pending&&f.calls.filter(call=>call[0]==='ensure').length===1&&f.calls.filter(call=>call[0]==='share').length===1,'one creation and one captured handoff');
        check(!f.menu.querySelector('#collab-invite-btn').disabled&&!f.states.at(-1).busy,'completion unlocks current controls');f.dispose();
    }],
    ['Annotate uses exact captured reference, blank load and pane reveal',async check=>{
        const f=headerFixture();check(await f.annotate(),'annotation dispatched');const ref=f.calls.find(call=>call[0]==='reference')[1];
        check(ref.url==='https://read.invalid/doc/original/read'&&ref.title==='<Literal title>'&&ref.service==='Collab'&&ref.feed==='Collab'&&ref.author_name===''&&ref.created_at===''&&ref.cited_at==='2026-11-21T12:00:00.000Z','exact structural reference contract');
        check(f.calls.map(call=>call[0]).join()==='reference,load,snap'&&f.calls.at(-1)[1]==='left','reference precedes load and wide-reader reveal');f.dispose();
    }],
    ['missing document annotation is visible and does not create a document',async check=>{
        const f=headerFixture({local:true});check(await f.annotate()===false&&f.errors.length===1&&f.calls.length===0,'missing document visible before effects');f.dispose();
    }],
    ['session/editor menu replacement rejects pending Share completion',async check=>{
        for(const change of ['expire','remove']){
            const f=headerFixture({local:true}),gate=headerGate();f.behavior.ensure=()=>gate.promise;
            const pending=f.share();await headerFlush();if(change==='expire')f.expire();else f.menu.remove();
            gate.resolve({docId:'old'});check(await pending===false&&!f.calls.some(call=>call[0]==='share')&&f.errors.length===0,change+' blocks old Share');f.dispose();
        }
    }],
    ['document changes between annotation stages reject later effects',async check=>{
        const f=headerFixture(),gate=headerGate();f.behavior.reference=()=>gate.promise;
        const pending=f.annotate();await headerFlush();f.replace();gate.resolve();
        check(await pending===false&&f.calls.length===1&&f.errors.length===0,'new document prevents blank load and reveal');f.dispose();
    }],
    ['owned failures allow explicit retry while stale failures stay silent',async check=>{
        const f=headerFixture();f.behavior.share=()=>{throw Error('Share failed');};
        check(await f.share()===false&&f.errors[0].message==='Share failed'&&!f.states.at(-1).busy,'Share failure visible and unlocked');
        delete f.behavior.share;check(await f.share(),'explicit retry succeeds');
        const gate=headerGate();f.behavior.load=()=>gate.promise;const pending=f.annotate();await headerFlush();f.expire();gate.reject(Error('old load failed'));
        check(await pending===false&&f.errors.length===1&&!f.calls.some(call=>call[0]==='snap'),'stale annotation error/reveal suppressed');f.dispose();
    }],
    ['rebuilt and disposed controls cannot dispatch',async check=>{
        const f=headerFixture(),old=f.menu.querySelector('#collab-invite-btn').onclick;f.controller.dispose();
        check(f.menu.querySelector('#collab-invite-btn').onclick===null&&await old()===false&&f.calls.length===0,'dispose detaches and invalidates captured callback');f.dispose();
        const g=headerFixture(),saved=g.menu.querySelector('#collab-annotate-btn').onclick;g.menu.querySelector('#collab-doc-picker').remove();
        check(await saved()===false&&g.calls.length===0,'replaced header rejects old controls');g.dispose();
    }]
];
