function collabLifecycleFixture() {
    let source='original',visible=true,installed=null;
    const outer=document.createElement('div');document.body.appendChild(outer);
    const add=id=>{const node=document.createElement('div');node.id=id;outer.appendChild(node);return node;};
    const element=add('tiptap-editor'),status=add('collab-status');add('collab-who');
    const trace=[],providers=[],editors=[],docs=[],timers=[],states=[],references=[],notices=[],auth=[],behavior={};
    const fail=name=>{trace.push(name);if(behavior.cleanup===name)throw Error('cleanup '+name);};
    class Doc {constructor(){this.map={data:new Map(),handlers:new Set(),observe:handler=>{this.map.handlers.add(handler);},unobserve:handler=>{trace.push('unobserve');this.map.handlers.delete(handler);},get:key=>this.map.data.get(key)};docs.push(this);}getMap(){return this.map;}destroy(){fail('doc');}}
    class Provider {constructor(options){this.options=options;this.awareness={handlers:new Set(),states:new Map(),on:(_name,handler)=>this.awareness.handlers.add(handler),off:(_name,handler)=>{trace.push('off');this.awareness.handlers.delete(handler);},getStates:()=>this.awareness.states};providers.push(this);if(behavior.statusOnCreate)options.onStatus({status:'connected'});}destroy(){fail('provider');}}
    class Editor {constructor(options){if(behavior.editorError)throw Error('editor construction failed');this.options=options;editors.push(this);}destroy(){fail('editor');}}
    const extension={configure:options=>options},modules={Editor,StarterKit:extension,Collaboration:extension,CollaborationCursor:extension,Link:extension,HocuspocusProvider:Provider,Y:{Doc}};
    Object.assign(globalThis,{showStatusMessage:message=>notices.push(message),showErrorModal:message=>auth.push(message)});
    const lifecycle=createCollabConnectionLifecycle({source:()=>source,targetCurrent:target=>target.element.isConnected&&document.getElementById('tiptap-editor')===target.element,
        visible:()=>visible,view:(target,rebind)=>createCollabConnectionView(rebind?{...target,statusElement:document.getElementById('collab-status')}:target),
        clearReferences:()=>references.push('clear'),pushReference:record=>references.push(structuredClone(record)),install:value=>{installed=value;},ready:()=>trace.push('toolbar'),
        schedule:(callback,delay)=>{timers.push({callback,delay});return timers.length;},clear:id=>trace.push('timer '+id),state:value=>states.push(structuredClone(value))});
    const target=options=>({element,statusElement:status,storeUrl:'https://captured.invalid',token:'private-token',username:'Captured',color:'#123456',wsUrl:'wss://captured.invalid',docId:'namespace/document',mode:'read',modules,assertCurrent(){if(behavior.expired)throw Error('expired preparation');},...options});
    return{lifecycle,start:options=>lifecycle.start(target(options)),outer,element,status,trace,providers,editors,docs,timers,states,references,notices,auth,behavior,
        installed:()=>installed,expire:()=>{source='changed';},visible:value=>{visible=value;},dispose(){lifecycle.dispose();outer.remove();}};
}
const collabLifecycleCases=[
    ['captured resource construction and synchronous status callbacks',async check=>{
        const f=collabLifecycleFixture();f.behavior.statusOnCreate=true;f.start();const p=f.providers[0].options,e=f.editors[0].options;
        check(p.url==='wss://captured.invalid'&&p.name==='namespace/document'&&p.token==='private-token'&&p.parameters.mode==='read','captured provider configuration');
        check(e.element===f.element&&!e.editable&&e.extensions.length===4,'captured read-only editor and shared extensions');
        check(f.states.at(-1).phase==='connected'&&!JSON.stringify(f.states).includes('private-token'),'safe synchronous status state');
        check(f.timers[0].delay===200&&f.installed().map===f.docs[0].map,'owned awareness timer and resource aliases');f.dispose();
    }],
    ['replaced callbacks and timers cannot touch the new connection',async check=>{
        const f=collabLifecycleFixture();f.start();const old=f.providers[0],map=f.docs[0].map,ref=[...map.handlers][0],awareness=[...old.awareness.handlers][0];
        map.data.set('url',JSON.stringify({url:'https://old.invalid'}));f.start({docId:'new'});const count=f.references.length;f.status.textContent='new status';
        old.options.onStatus({status:'old'});old.options.onAuthenticationFailed();ref({keysChanged:new Set(['url'])});awareness();f.timers[0].callback();
        check(f.status.textContent==='new status'&&f.references.length===count&&f.auth.length===0,'old status/auth/ref/presence/timer callbacks rejected');
        check(f.trace.includes('unobserve')&&f.trace.includes('off')&&f.trace.includes('timer 1'),'observers and timer detached');
        check(['editor','provider','doc'].every(name=>f.trace.filter(value=>value===name).length===1),'each replaced resource destroyed once');f.dispose();
    }],
    ['background connection survives editor hiding but cannot merge references',async check=>{
        const f=collabLifecycleFixture();f.start();const map=f.docs[0].map,handler=[...map.handlers][0],record={url:'https://source.invalid',author_name:'Exact author',extra:{keep:true}};map.data.set(record.url,JSON.stringify(record));
        f.visible(false);handler({keysChanged:new Set([record.url])});f.providers[0].options.onStatus({status:'connected'});
        check(f.references.length===1&&f.status.textContent==='connected'&&f.installed()!==null,'background stays connected without global reference mutation');
        f.visible(true);handler({keysChanged:new Set([record.url])});check(f.references[1].extra.keep&&f.references[1].author_name==='Exact author','visible captured map preserves reference metadata');
        f.expire();f.providers[0].options.onAuthenticationFailed();check(f.installed()===null&&f.auth.length===0&&f.trace.includes('provider'),'session expiry cleans old resources without old auth feedback');f.dispose();
    }],
    ['local startup releases remote resources and clears old presence',async check=>{
        const f=collabLifecycleFixture();f.start();const old=f.providers[0];old.awareness.states.set('peer',{user:{name:'Old'}});f.lifecycle.refresh();
        f.start({local:true,docId:undefined,wsUrl:null});check(f.providers.length===1&&f.installed().provider===undefined&&f.trace.includes('provider'),'local startup does not retain remote provider');
        check(document.getElementById('collab-who').textContent===''&&f.states.at(-1).remote===false&&f.editors.at(-1).options.editable,'local presence/state/editability restored');f.dispose();
    }],
    ['construction failure cleans partial resources and allows explicit restart',async check=>{
        const f=collabLifecycleFixture();f.behavior.editorError=true;let failed=false;try{f.start();}catch(error){failed=error.message.includes('construction');}
        check(failed&&f.installed()===null&&f.trace.includes('provider')&&f.trace.includes('doc'),'partial provider/doc released after editor failure');
        check(f.states.at(-1).phase==='error','failure propagates with safe error state');delete f.behavior.editorError;f.start();check(f.installed().editor===f.editors[0],'explicit restart succeeds');f.dispose();
    }],
    ['cleanup failures do not skip remaining resources or repeat disposal',async check=>{
        const f=collabLifecycleFixture();f.start();f.behavior.cleanup='editor';f.lifecycle.dispose();const count=f.trace.length;f.lifecycle.dispose();
        check(f.trace.includes('provider')&&f.trace.includes('doc')&&f.installed()===null,'cleanup continues after a failed destroy');
        check(f.notices.length===1&&f.trace.length===count,'cleanup failure visible and repeated disposal idempotent');f.dispose();
    }],
    ['presence is literal and rebuilt chrome requires explicit rebinding',async check=>{
        const f=collabLifecycleFixture();f.start();const provider=f.providers[0];provider.awareness.states.set('peer',{user:{name:'<img src=x>',color:'url(evil)'}});f.lifecycle.refresh();
        let who=document.getElementById('collab-who');check(who.textContent.includes('<img src=x>')&&!who.querySelector('img')&&['#888','rgb(136, 136, 136)'].includes(who.querySelector('span').style.color),'literal presence and safe color fallback');
        who.remove();f.status.remove();const newWho=document.createElement('div'),newStatus=document.createElement('div');newWho.id='collab-who';newStatus.id='collab-status';f.outer.append(newWho,newStatus);
        provider.options.onStatus({status:'connected'});f.lifecycle.refresh();check(newWho.textContent===''&&newStatus.textContent==='','saved callbacks do not write replacement chrome');
        f.lifecycle.rebind();check(newWho.textContent.includes('<img src=x>')&&newStatus.textContent==='connected','intentional resume rebinds captured active connection');f.dispose();
    }],
    ['replaced editor target and corrupt references cannot affect current content',async check=>{
        const f=collabLifecycleFixture();f.start();const map=f.docs[0].map,handler=[...map.handlers][0];map.data.set('bad','not JSON');handler({keysChanged:new Set(['bad'])});
        check(f.notices.length===1&&f.references.length===1,'corrupt reference skipped with owned feedback');f.element.remove();const replacement=document.createElement('div');replacement.id='tiptap-editor';f.outer.appendChild(replacement);
        f.providers[0].options.onStatus({status:'connected'});check(f.installed()===null&&f.trace.includes('doc'),'replaced editor expires and releases resource set');f.dispose();
    }]
];
