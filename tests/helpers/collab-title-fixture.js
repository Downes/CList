function collabTitleGate(){let resolve;const promise=new Promise(yes=>{resolve=yes;});return{promise,resolve};}
async function collabTitleFlush(){for(let i=0;i<20;i++)await Promise.resolve();}
function collabTitleFixture(){
    let valid=true,editor={},currentDocId=null;
    const outer=document.createElement('div');document.body.appendChild(outer);
    const make=(tag,id)=>{const node=document.createElement(tag);node.id=id;outer.appendChild(node);return node;};
    const input=make('input','collab-doc-id'),warning=make('div','collab-doc-warning'),title=make('div','write-title');input.value='notes';title.textContent='notes';
    const calls=[],opens=[],commits=[],states=[],timers=[],cleared=[],newCalls=[],urls=[],behavior={};
    const inspect=(text,snapshot,assertCurrent)=>inspectCollabTitle(text,snapshot,{assertCurrent,
        expand:async value=>behavior.expand?behavior.expand(value):'namespace/'+value,
        server:async()=> 'wss://captured.invalid',restBase:value=>value.replace('wss://','https://'),
        fetch:async(url,options)=>{calls.push({url,options:structuredClone(options)});return behavior.fetch?behavior.fetch():{ok:true,status:200};}});
    const controller=createCollabTitleController({current:()=>valid,capture:()=>({token:'private-token'}),editor:()=>editor,currentDocId:()=>currentDocId,
        inspect,hasContent:()=>true,shortId:id=>id.slice(id.lastIndexOf('/')+1),
        open:async(target,current)=>{opens.push({target,current});if(behavior.open)await behavior.open();if(current()){commits.push(target);currentDocId=target.docId;}},
        connectNew:async current=>{if(current())newCalls.push(input.value);},openUrl:async url=>urls.push(url),isUrl:value=>value.startsWith('https://collab.invalid/doc/'),
        schedule:(callback,delay)=>{timers.push({callback,delay});return timers.length;},clear:id=>cleared.push(id),state:value=>states.push(structuredClone(value))
    },createCollabTitleView(document,{writeTitle:title}));
    const emit=(node,event)=>{if(node.dispatchEvent)node.dispatchEvent(new Event(event,{bubbles:true}));else node.listeners[event]?.();};
    return{controller,input,warning,title,calls,opens,commits,states,timers,cleared,newCalls,urls,behavior,
        edit(value){input.value=value;emit(input,'input');},write(value){title.textContent=value;emit(title,'input');},expire:()=>{valid=false;},replaceEditor:()=>{editor={};},currentDoc:value=>{currentDocId=value;},
        dispose(){controller.dispose();outer.remove();}};
}
const collabTitleCases=[
    ['debounced captured checks and encoded document paths',async check=>{
        const f=collabTitleFixture();f.controller.schedule();check(f.timers[0].delay===500&&f.calls.length===0,'500ms debounce without immediate request');f.timers[0].callback();await collabTitleFlush();
        check(f.calls[0].url==='https://captured.invalid/api/documents/namespace/notes'&&f.calls[0].options.headers.Authorization==='Bearer private-token','captured server/auth and namespaced path');
        check(f.warning.textContent.includes('Your current content will be lost')&&f.controller.hasExisting(),'existing warning/choice is state-owned');
        check(!JSON.stringify(f.states).includes('private-token')&&f.states.at(-1).phase==='exists','safe phase-only progress');f.dispose();
    }],
    ['blank/current/404 paths and visible HTTP failure/retry',async check=>{
        const f=collabTitleFixture();f.input.value='';await f.controller.check();f.input.value='notes';f.currentDoc('namespace/notes');await f.controller.check();
        check(f.calls.length===0&&f.states.at(-1).phase==='current','blank/current title skips HTTP');f.currentDoc(null);f.behavior.fetch=()=>({ok:false,status:404});await f.controller.check();
        check(f.states.at(-1).phase==='available'&&!f.controller.hasExisting(),'404 means absent');f.behavior.fetch=()=>({ok:false,status:403});await f.controller.check();
        check(f.warning.textContent.includes('403')&&f.states.at(-1).phase==='error','permission failure distinct from absence');delete f.behavior.fetch;await f.warning.querySelector('button').onclick();
        check(f.controller.hasExisting()&&!f.warning.classList.contains('error-message'),'explicit retry clears error styling');f.dispose();
    }],
    ['superseded expansion and saved old choices cannot target a new title',async check=>{
        const f=collabTitleFixture(),gate=collabTitleGate();f.behavior.expand=()=>gate.promise;const old=f.controller.check();f.edit('new');delete f.behavior.expand;await f.controller.check();
        gate.resolve('namespace/old');await old;check(f.calls.length===1&&f.calls[0].url.endsWith('/new'),'old expansion cannot request another title');
        const saved=f.warning.querySelector('#collab-load-existing').onclick;f.edit('third');await f.controller.check();await saved();
        check(f.opens.length===0&&f.controller.hasExisting(),'saved old choice cannot load new candidate');f.dispose();
    }],
    ['expired source/editor/panel rejects delayed checks',async check=>{
        for(const change of ['expire','replaceEditor']){const f=collabTitleFixture(),gate=collabTitleGate();f.behavior.fetch=()=>gate.promise;const pending=f.controller.check();await collabTitleFlush();f[change]();gate.resolve({ok:true,status:200});await pending;
            check(!f.controller.hasExisting()&&!f.warning.textContent,'expired '+change+' result cannot show choice');f.dispose();}
        const f=collabTitleFixture(),gate=collabTitleGate();f.behavior.fetch=()=>gate.promise;const pending=f.controller.check();await collabTitleFlush();f.warning.remove();gate.resolve({ok:false,status:500});await pending;
        check(!f.controller.hasExisting(),'removed warning rejects stale failure');f.dispose();
    }],
    ['existing-document loading captures server, locks duplicates and normalizes titles',async check=>{
        const f=collabTitleFixture();await f.controller.check();const gate=collabTitleGate();f.behavior.open=()=>gate.promise;
        const first=f.controller.enter(),duplicate=f.controller.enter();check(first===duplicate,'duplicate Enter/Load shares pending action');await collabTitleFlush();
        check(f.opens.length===1&&f.opens[0].target.wsUrl==='wss://captured.invalid','one captured-server opening');gate.resolve();await first;
        check(f.commits.length===1&&f.title.textContent==='notes'&&f.input.value==='notes','successful choice normalizes both fields');f.dispose();
    }],
    ['newer input expires opening guard and protects title fields',async check=>{
        const f=collabTitleFixture();await f.controller.check();const gate=collabTitleGate();f.behavior.open=()=>gate.promise;const pending=f.controller.enter();await collabTitleFlush();f.write('New draft');gate.resolve();await pending;
        check(f.commits.length===0&&!f.opens[0].current()&&f.input.value==='New draft'&&f.title.textContent==='New draft','changed input blocks commit/normalization');
        check(f.states.at(-1).phase==='idle','old completion does not replace new input state');f.dispose();
    }],
    ['opening failures, state-owned Enter and fallback delegation',async check=>{
        const f=collabTitleFixture();await f.controller.check();f.warning.querySelector('button').remove();f.behavior.open=()=>{throw Error('connection failed');};await f.controller.enter();
        check(f.opens.length===1&&f.warning.textContent.includes('connection failed'),'Enter uses captured state and reports opening failure');delete f.behavior.open;await f.controller.check();await f.controller.enter();check(f.commits.length===1,'explicit choice retry succeeds');
        f.input.value='other';f.behavior.fetch=()=>({ok:false,status:404});await f.controller.check();await f.controller.enter();check(f.newCalls[0]==='other','nonexisting Enter delegates existing connect flow');
        f.controller.paste('https://collab.invalid/doc/old');f.edit('newer');await collabTitleFlush();check(f.urls.length===0,'queued stale paste rejected');f.dispose();
    }],
    ['mirrored title events, stale timers and disposed listener cleanup',async check=>{
        const f=collabTitleFixture();f.write('  Mirrored title  ');check(f.input.value==='Mirrored title'&&f.timers.length===1,'captured write-title input mirrors and schedules');
        f.controller.schedule();f.timers[0].callback();await collabTitleFlush();check(f.calls.length===0&&f.cleared.includes(1),'saved cleared timer cannot request');
        f.controller.dispose();const count=f.timers.length;f.write('After disposal');f.timers[1].callback();await collabTitleFlush();
        check(f.calls.length===0&&f.timers.length===count,'disposed timers/events inert');check(Object.keys(f.states.at(-1)).sort().join()==='busy,phase','state excludes title/doc/account');f.dispose();
    }]
];
