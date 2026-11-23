function collabShareGate(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};}
async function collabShareFlush(){for(let i=0;i<18;i++)await Promise.resolve();}
function collabShareFixture(options={}){
    let valid=true,chatValid=true;const calls=[],states=[],copies=[],invites=[],posts=[],behavior={},writes=options.writes||new Map(),remote=options.remote||{allow:false};
    const target={docId:'namespace/notes',server:'wss://captured.invalid',title:'<img src=x> Notes',token:'private-token',discussion:'Captured discussion',links:{edit:'https://captured.invalid/doc/namespace/notes/edit',read:'https://captured.invalid/doc/namespace/notes/read'}};
    const fetchMock=async(url,init)=>{calls.push({url,init:structuredClone(init)});const response=behavior.fetch?await behavior.fetch(url,init):{ok:true,status:200,json:async()=>({allow_anonymous:remote.allow})};if(init?.method==='PATCH'&&response.ok)remote.allow=JSON.parse(init.body).allow_anonymous;return response;};
    const show=root=>{document.getElementById('generic-modal')?.remove();const modal=document.createElement('div');modal.id='generic-modal';modal.appendChild(root);document.body.appendChild(modal);};
    const controller=createCollabShareController(target,{writes,writeKey:'captured-target',current:()=>valid,contextCurrent:()=>valid,
        read:(value,assertCurrent)=>readCollabAccess(value,{assertCurrent,fetch:fetchMock,restBase:url=>url.replace('wss://','https://')}),
        write:(value,desired,operation,assertCurrent)=>writeCollabAccess(value,desired,operation,{assertCurrent,fetch:fetchMock,restBase:url=>url.replace('wss://','https://')}),
        link:mode=>target.links[mode],copy:async(link,current)=>{copies.push({link,current});if(behavior.copy)await behavior.copy();},
        chatCurrent:()=>chatValid,chat:invite=>{invites.push(structuredClone(invite));return behavior.chat!==false;},
        post:record=>{posts.push(record);if(behavior.closePost)document.getElementById('generic-modal')?.remove();},state:value=>states.push(structuredClone(value))
    },createCollabShareView(document,show));
    return{controller,target,calls,states,copies,invites,posts,behavior,writes,remote,check:()=>document.getElementById('collab-anon-check'),modal:()=>document.getElementById('generic-modal'),
        expire:()=>{valid=false;},changeChat:()=>{chatValid=false;},dispose:()=>controller.dispose()};
}
const collabShareCases=[
    ['captured read and literal panel/link presentation',async check=>{
        const f=collabShareFixture();check(f.check().disabled&&f.check().indeterminate,'initial access state unknown and disabled');await f.controller.load();
        check(f.calls[0].url==='https://captured.invalid/api/documents/namespace%2Fnotes'&&f.calls[0].init.headers.Authorization==='Bearer private-token','captured metadata endpoint/auth');
        check(f.modal().textContent.includes('<img src=x> Notes')&&!f.modal().querySelector('img'),'literal title');
        check(f.modal().querySelectorAll('code').length===2&&f.check().checked===false&&!f.check().disabled,'links and known setting rendered');
        check(!JSON.stringify(f.states).includes('private-token')&&Object.keys(f.states.at(-1)).sort().join()==='busy,phase,receipt','safe presentation state');f.dispose();
    }],
    ['changed-only update, captured PATCH and pending duplicate lock',async check=>{
        const f=collabShareFixture();await f.controller.load();await f.controller.save(false);check(f.calls.length===1,'unchanged value does not write');
        const gate=collabShareGate();f.behavior.fetch=()=>gate.promise;const pending=f.controller.save(true);await f.controller.save(true);check(f.calls.length===2&&f.check().disabled,'one pending update');
        const patch=f.calls[1];check(patch.init.method==='PATCH'&&patch.init.headers.Authorization==='Bearer private-token'&&JSON.parse(patch.init.body).allow_anonymous===true,'captured write payload/header');
        gate.resolve({ok:true,status:204});await pending;check(f.check().checked&&!f.check().indeterminate&&f.states.at(-1).receipt==='accepted','2xx accepted without requiring JSON');f.dispose();
    }],
    ['uncertain update requires read-only check before explicit retry',async check=>{
        const f=collabShareFixture();await f.controller.load();f.behavior.fetch=()=>{throw Error('response lost');};await f.controller.save(true);
        check(f.states.at(-1).receipt==='uncertain'&&f.check().disabled&&f.check().indeterminate,'uncertainty locks access controls');const count=f.calls.length;await f.controller.save(true);check(f.calls.length===count,'uncertain write cannot repeat');
        delete f.behavior.fetch;await f.controller.load();check(f.calls.at(-1).init.method===undefined&&!f.check().disabled,'check performs GET and unlocks observed setting');
        await f.controller.save(true);check(f.calls.filter(call=>call.init.method==='PATCH').length===2,'only explicit later change retries intent');f.dispose();
    }],
    ['rejected writes restore prior value and malformed reads remain unknown',async check=>{
        const f=collabShareFixture();await f.controller.load();f.behavior.fetch=()=>({ok:false,status:403});await f.controller.save(true);
        check(f.states.at(-1).receipt==='rejected'&&!f.check().checked&&!f.check().disabled,'known rejection retains prior setting with explicit retry available');
        f.behavior.fetch=()=>({ok:true,json:async()=>({allow_anonymous:'yes'})});await f.controller.load();check(f.check().disabled&&f.modal().textContent.includes('Invalid sharing settings'),'malformed read cannot authorize a default write');f.dispose();
    }],
    ['closed/source-expired reads and actions cannot affect replacement panels',async check=>{
        const f=collabShareFixture(),gate=collabShareGate();f.behavior.fetch=()=>gate.promise;const pending=f.controller.load();await collabShareFlush();f.expire();
        gate.resolve({ok:false,status:500});await pending;check(!f.modal().textContent.includes('HTTP 500'),'stale read failure suppressed');
        const before=f.copies.length;await f.controller.actions.copy('read');check(f.copies.length===before&&!f.controller.actions.chat('edit'),'stale actions rejected');
        const old=f.modal();old.remove();const replacement=document.createElement('div');replacement.id='generic-modal';replacement.textContent='New modal';document.body.appendChild(replacement);f.dispose();check(replacement.isConnected,'old disposal preserves replacement modal');replacement.remove();
    }],
    ['pending writes remain locked across rebuilt panels',async check=>{
        const writes=new Map(),remote={allow:false},f=collabShareFixture({writes,remote});await f.controller.load();const gate=collabShareGate();f.behavior.fetch=()=>gate.promise;const pending=f.controller.save(true);
        const newer=collabShareFixture({writes,remote});await newer.controller.load();check(newer.check().disabled&&newer.calls.length===0,'rebuilt panel cannot read-confirm or write while original update pending');
        gate.resolve({ok:true,status:200});await pending;check(newer.check().disabled&&newer.check().indeterminate,'old completion does not update rebuilt controls');
        await newer.controller.load();check(newer.check().checked&&!newer.check().disabled&&newer.calls.length===1,'explicit GET observes settled value');f.dispose();newer.dispose();
    }],
    ['captured Copy/Chat/Post actions and changed-discussion rejection',async check=>{
        const f=collabShareFixture();await f.controller.load();const gate=collabShareGate();f.behavior.copy=()=>gate.promise;
        const copy=f.controller.actions.copy('read');await f.controller.actions.copy('read');check(f.copies.length===1&&f.copies[0].link===f.target.links.read,'copy captures exact link and locks duplicate');gate.resolve();await copy;
        check(f.controller.actions.chat('edit')&&f.invites[0].docId===f.target.docId&&f.invites[0].server===f.target.server&&!JSON.stringify(f.invites).includes('private-token'),'public captured invite only');
        f.changeChat();check(!f.controller.actions.chat('read')&&f.invites.length===1,'changed discussion cannot receive old action');
        f.behavior.closePost=true;check(f.controller.actions.post('read')&&f.posts[0].link===f.target.links.read&&f.posts[0].current(),'composer handoff has captured content and independent document lease');f.dispose();
    }],
    ['server uncertainty and stale write completion preserve new context',async check=>{
        const f=collabShareFixture();await f.controller.load();f.behavior.fetch=()=>({ok:false,status:503});await f.controller.save(true);check(f.states.at(-1).receipt==='uncertain','5xx is uncertain, not rolled back as confirmed');
        delete f.behavior.fetch;await f.controller.load();const gate=collabShareGate();f.behavior.fetch=()=>gate.promise;const pending=f.controller.save(true);const count=f.states.length;f.expire();gate.resolve({ok:true,status:204});await pending;
        check(f.states.length===count&&f.writes.size===0,'late accepted write releases lock without stale presentation');f.dispose();
    }]
];
