function collabFormatFixture() {
    let current=true;const outer=document.createElement('div');document.body.appendChild(outer);
    const bar=document.createElement('div');bar.id='collab-format-toolbar';outer.appendChild(bar);
    const calls=[],notices=[],states=[],events=new Map(),offCalls=[],active=new Set(),behavior={};
    Object.assign(globalThis,{showStatusMessage:message=>notices.push(message)});
    const editor={isEditable:true,
        on(event,handler){if(!events.has(event))events.set(event,new Set());events.get(event).add(handler);},
        off(event,handler){offCalls.push(event);if(behavior.offError)throw Error('off failed');events.get(event)?.delete(handler);},
        isActive(name,options){if(behavior.queryError)throw Error('query failed');return active.has(name+(options?':'+options.level:''));},
        chain(){let command;const chain={focus(){return chain;},run(){if(behavior.commandError)throw Error('command failed');calls.push(command);if(behavior.hook)behavior.hook();if(active.has(command))active.delete(command);else active.add(command);emit('transaction');return true;}};
            for(const [method,name]of Object.entries({toggleBold:'bold',toggleItalic:'italic',toggleBulletList:'bulletList',toggleOrderedList:'orderedList',toggleBlockquote:'blockquote'}))chain[method]=()=>{command=name;return chain;};
            chain.toggleHeading=options=>{command='heading:'+options.level;return chain;};return chain;}
    };
    function emit(event){for(const handler of [...(events.get(event)||[])])handler();}
    const controller=createCollabFormatController({editor,current:()=>current,state:value=>states.push(structuredClone(value))},createCollabFormatView());
    return{controller,editor,bar,outer,calls,notices,states,events,offCalls,active,behavior,emit,expire:()=>{current=false;},dispose(){controller.dispose();outer.remove();}};
}
const collabFormatCases=[
    ['eight commands preserve captured editor chains and active state',async check=>{
        const f=collabFormatFixture(),buttons=Array.from(f.bar.querySelectorAll('button'));check(buttons.length===8&&buttons.every(button=>!!button.title),'eight labelled commands');
        for(const button of buttons)button.onclick();
        check(f.calls.join()==='bold,italic,heading:1,heading:2,heading:3,bulletList,orderedList,blockquote','existing command chains retained');
        check(buttons[0].classList.contains('is-active')&&buttons[0].getAttribute('aria-pressed')==='true','active and accessible pressed state rendered');
        check(f.states.at(-1).enabled&&Object.keys(f.states.at(-1)).sort().join()==='count,enabled','safe availability/count state');f.dispose();
    }],
    ['read-only mode disables controls and saved callbacks',async check=>{
        const f=collabFormatFixture(),button=f.bar.querySelector('button');f.editor.isEditable=false;f.emit('transaction');
        check(button.disabled&&!f.states.at(-1).enabled,'read-only view disabled');button.onclick();check(f.calls.length===0,'saved click cannot bypass read-only guard');
        f.editor.isEditable=true;f.emit('selectionUpdate');button.onclick();check(f.calls.length===1&&!button.disabled,'editable state restores command availability');f.dispose();
    }],
    ['expired ownership blocks commands and old event output',async check=>{
        const f=collabFormatFixture(),button=f.bar.querySelector('button'),refresh=[...f.events.get('transaction')][0],count=f.states.length;f.expire();
        button.onclick();refresh();check(f.calls.length===0&&f.states.length===count,'expired source/editor cannot command or repaint');f.dispose();
    }],
    ['disposed listeners and replaced bars cannot affect rebuilt controls',async check=>{
        const f=collabFormatFixture(),button=f.bar.querySelector('button'),saved=[...f.events.get('transaction')][0];f.controller.dispose();f.controller.dispose();
        check(f.offCalls.join()==='selectionUpdate,transaction'&&f.events.get('transaction').size===0,'listeners detached once');
        f.bar.remove();const next=document.createElement('div');next.id='collab-format-toolbar';f.outer.appendChild(next);
        const states=[];const newer=createCollabFormatController({editor:f.editor,current:()=>true,state:value=>states.push(value)},createCollabFormatView());
        const count=states.length;button.onclick();saved();check(f.calls.length===0&&states.length===count&&next.querySelectorAll('button').length===8,'saved controls/events cannot touch new toolbar');
        check(f.events.get('transaction').size===1,'rebuild has one listener per event');newer.dispose();f.dispose();
    }],
    ['reentrant command dispatch is locked',async check=>{
        const f=collabFormatFixture(),button=f.bar.querySelector('button');f.behavior.hook=()=>button.onclick();button.onclick();
        check(f.calls.length===1&&f.states.at(-1).enabled,'one command despite synchronous reentrant click/transaction');f.dispose();
    }],
    ['command/query failures visible with explicit recovery',async check=>{
        const f=collabFormatFixture(),button=f.bar.querySelector('button');f.behavior.commandError=true;button.onclick();
        check(f.notices.length===1&&f.calls.length===0,'command failure visible without retry');delete f.behavior.commandError;button.onclick();check(f.calls.length===1,'explicit retry succeeds');
        f.behavior.queryError=true;f.controller.refresh();check(button.disabled&&!f.states.at(-1).enabled&&f.notices.length===2,'query failure disables stale presentation');
        delete f.behavior.queryError;f.controller.refresh();check(!button.disabled,'later refresh restores presentation');f.dispose();
    }],
    ['listener cleanup failures keep stale callbacks inert',async check=>{
        const f=collabFormatFixture(),saved=[...f.events.get('selectionUpdate')][0],button=f.bar.querySelector('button');f.behavior.offError=true;f.controller.dispose();const count=f.states.length;
        saved();button.onclick();check(f.offCalls.length===2&&f.notices.length===1,'cleanup attempts both events with visible failure');
        check(f.calls.length===0&&f.states.length===count,'failed detach does not reactivate disposed callbacks');f.dispose();
    }]
];
