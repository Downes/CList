function composerGate(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};}
async function composerFlush(){for(let i=0;i<16;i++)await Promise.resolve();}
function composerFixture(options={}){
    let valid=true,previous=null,watch=()=>{};
    const container=options.container||document.createElement('div');if(!options.container){container.id='collabDiv';document.body.appendChild(container);}
    const slot=options.slot||{editor:'collab',account:'original',switchId:1,handler:null,completion:null,publishing:false};
    const target={mode:'read',title:options.title||'<img src=x> & Title',link:'https://captured.invalid/doc/test/read?a=1&b=2',current:()=>valid};
    const states=[],editors=[],timers=[],cleared=[],postCalls=[],cleanup=[],behavior={};
    Object.assign(globalThis,{escapeHtml:value=>String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'),showStatusMessage:message=>cleanup.push(message)});
    function makeEditor(config){
        const events=new Map(),sets=[];let html='';
        const editor={events,sets,removed:0,on(name,callback){if(!events.has(name))events.set(name,new Set());events.get(name).add(callback);},off(name,callback){events.get(name)?.delete(callback);},
            setContent(value){sets.push(value);html=value;},getContent(){return html;},remove(){this.removed++;if(behavior.removeError)throw Error('remove failed');},
            emit(name){for(const callback of [...(events.get(name)||[])])callback();},edit(value){html=value;this.emit('change');}};
        editors.push(editor);config.setup(editor);return editor;
    }
    const deps={install(handler){previous={...slot};slot.handler=handler;slot.editor='collab-share';},
        owns:handler=>slot.handler===handler&&slot.editor==='collab-share'&&slot.account===previous?.account&&slot.switchId===previous?.switchId,
        release(handler){if(slot.handler!==handler)return;const restore=slot.editor==='collab-share'&&slot.account===previous.account&&slot.switchId===previous.switchId;slot.handler=previous.handler;if(restore)slot.editor=previous.editor;},
        hasRich:()=>!!options.rich,init:config=>{const editor=makeEditor(config);if(behavior.init)return behavior.init(config,editor);editor.emit('init');return Promise.resolve([editor]);},
        schedule:(callback,delay)=>{timers.push({callback,delay});return timers.length;},clear:id=>cleared.push(id),getCompletion:()=>slot.completion,setCompletion:value=>{slot.completion=value;},
        publishing:()=>slot.publishing,post:async()=>{postCalls.push(true);if(behavior.post)await behavior.post();},state:value=>states.push(structuredClone(value))};
    // Use the real public opener/view; Node does not deliver MutationObserver events.
    const controller=openCollabComposer(target,deps);
    return{controller,target,slot,container,states,editors,timers,cleared,postCalls,cleanup,behavior,
        edit(value){const textarea=container.querySelector('textarea');textarea.value=value;textarea.oninput();},
        expire:()=>{valid=false;},dispose(){controller.close();if(!options.container)container.remove();}};
}
const collabComposerCases=[
    ['fallback draft, owned handler and safe seed content',async check=>{
        const f=composerFixture();check(f.slot.editor==='collab-share'&&f.slot.handler===f.controller.handler,'temporary handler installed');
        const content=await f.controller.handler.getContent();check(content.includes('&lt;img')&&!content.includes('<img'),'fallback data encoded as literal HTML');
        check(f.timers[0].delay===50&&Object.keys(f.states.at(-1)).sort().join()==='busy,phase','delayed setup and safe public state');f.controller.close();
        check(f.slot.editor==='collab'&&f.slot.handler===null&&f.cleared.includes(1)&&f.states.at(-1).phase==='closed','Cancel restores owned previous slot and clears timer/state');f.dispose();
    }],
    ['rich setup captures target and preserves earlier fallback edits',async check=>{
        const f=composerFixture({rich:true});f.edit('A newer <draft>');await f.controller.initialize();const editor=f.editors[0];
        check(editor.sets.length===1&&editor.getContent().includes('A newer &lt;draft&gt;'),'edited fallback becomes safe rich seed');
        check(f.states.at(-1).phase==='editing'&&await f.controller.handler.getContent()===editor.getContent(),'handler reads only captured rich instance');
        f.behavior.removeError=true;f.controller.close();check(editor.removed===1&&[...editor.events.values()].every(list=>list.size===0)&&f.cleanup.length===1,'owned cleanup failure reported after listeners removed once');f.dispose();
    }],
    ['late initialization cannot seed or remove a replacement composer',async check=>{
        const f=composerFixture({rich:true}),gate=composerGate();let oldInit;f.behavior.init=(_config,editor)=>{oldInit=[...editor.events.get('init')][0];return gate.promise;};
        const pending=f.controller.initialize();await composerFlush();const old=f.editors[0],oldId=f.container.querySelector('textarea').id;
        const newer=composerFixture({rich:true,slot:f.slot,container:f.container,title:'New composer'});await newer.controller.initialize();const current=newer.editors[0];
        oldInit();gate.resolve([old]);await pending;
        check(old.removed===1&&old.sets.length===0&&current.removed===0,'late old init cleans only its own instance');
        check(current.getContent().includes('New composer')&&newer.container.querySelector('textarea').id!==oldId,'unique target and newer seed preserved');newer.dispose();f.dispose();
    }],
    ['failed rich initialization preserves fallback and explicit retry',async check=>{
        const f=composerFixture({rich:true});f.edit('Preserved draft');f.behavior.init=()=>Promise.reject(Error('Tiny initialization failed'));await f.controller.initialize();
        check(f.container.textContent.includes('Tiny initialization failed')&&f.container.querySelector('textarea').value==='Preserved draft','visible failure with fallback restored');
        delete f.behavior.init;await f.controller.initialize();check(f.editors.at(-1).getContent().includes('Preserved draft'),'explicit retry retains draft');f.dispose();
    }],
    ['publication completion keeps newer edits and consumes callbacks once',async check=>{
        const f=composerFixture();await f.controller.post();const old=f.slot.completion;await f.controller.handler.getPostContent();f.edit('Newer draft');await f.controller.handler.getPostContent();old();
        check(f.controller.owned()&&f.container.textContent.includes('Newer draft edits were kept'),'newer draft survives completion despite later content reads');
        f.edit(f.target.title+': '+f.target.link);old();check(f.controller.owned(),'duplicate completion cannot later close reverted draft');
        await f.controller.post();await f.controller.handler.getPostContent();f.slot.completion();check(f.slot.editor==='collab'&&!f.container.querySelector('#collab-share-post-overlay'),'unchanged next-attempt snapshot closes owned composer');f.dispose();
    }],
    ['duplicate Post, Cancel and newer editor ownership',async check=>{
        const f=composerFixture({rich:true}),gate=composerGate();f.behavior.post=()=>gate.promise;const pending=f.controller.post();await f.controller.initialize();await f.controller.post();check(f.postCalls.length===1&&f.states.at(-1).busy,'rich readiness cannot unlock duplicate Post while opening');
        const callback=f.slot.completion;f.slot.editor='text';f.slot.switchId++;f.controller.close();gate.resolve();await pending;callback();
        check(f.slot.editor==='text'&&f.slot.handler===null,'cleanup/completion do not restore over selected editor');
        let rejected=false;try{await f.controller.handler.getContent();}catch{rejected=true;}check(rejected,'expired handler cannot read another editor');f.dispose();
    }],
    ['old close/completion cannot clear newer handlers or hooks',async check=>{
        const f=composerFixture();await f.controller.post();const old=f.slot.completion;await f.controller.handler.getPostContent();const replacement=()=>{};f.slot.completion=replacement;
        f.controller.close();check(f.slot.completion===replacement,'only owned completion hook cleared');
        const newer=composerFixture({slot:f.slot,container:f.container,title:'Replacement'});const handler=f.slot.handler;old();f.controller.close();check(f.slot.handler===handler&&newer.controller.owned(),'old completion/cancel cannot remove newer handler');newer.dispose();f.dispose();
    }],
    ['source expiry and publication-opening failure stay isolated',async check=>{
        const f=composerFixture();f.behavior.post=()=>{throw Error('Post menu failed');};await f.controller.post();check(f.container.textContent.includes('Post menu failed')&&f.controller.owned(),'post-opening failure visible without losing draft');
        f.expire();await f.controller.initialize();check(f.slot.editor==='collab'&&f.slot.handler===null,'expired composer cleans only original temporary slot');f.dispose();
    }]
];
