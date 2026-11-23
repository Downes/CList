function annotationSendGate(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};}
async function annotationSendFlush(){for(let i=0;i<20;i++)await Promise.resolve();}
function annotationSendFixture(){
    _annotationSendPanel?.controller.dispose();_annotationSendPanel=null;_annotationSendShared.pending=null;_annotationSendShared.choice=null;_annotationDraft.standalone=null;
    const root=document.createElement('div'),section=document.createElement('div');root.id='annotateEditDiv';section.id='annotate-send-section';root.appendChild(section);document.body.appendChild(root);
    const calls=[],switched=[],notices=[],projections=[],behavior={},reads=[];let token='private-token',body='<p>Captured body</p>',tags=['captured-tag'],dispatched;
    const target={url:'https://target.invalid',id:'target-row',title:'Target title',author_name:'Author',feed:'Feed'},references=[target,{url:'https://secondary.invalid'}];
    const accounts=[{type:'Annotate',title:'<Store literal>',instance:'https://annotations.invalid',permissions:'w',privateKey:'private-account-key'},
        {type:'Hypothesis',title:'Hypothesis',instance:'https://hypothes.is',permissions:'w',apiKey:'private-hypothesis-key'},
        {type:'Annotate',title:'Read only',instance:'https://readonly.invalid',permissions:'r'}];
    window.CList.state={username:'User',authEpoch:1,editorSwitching:{id:1},editorLoading:{id:1},editorControls:{id:1}};
    window.CList.config={flaskSiteUrl:'https://identity.invalid'};window.CList.keys={ACCESS_TOKEN:'access_token'};window.CList.accounts=accounts.map((account,index)=>({key:'account-'+index,value:JSON.stringify(account)}));
    Object.assign(globalThis,{currentEditor:'annotate-edit',currentEditorAccount:null,getReferences:()=>references,
        getSiteSpecificCookie:()=>token,parseAccountValue:record=>{try{return JSON.parse(record.value);}catch{return null;}},
        async ensureAccountsLoaded(){calls.push(['accounts']);if(behavior.accounts)await behavior.accounts();return window.CList.accounts;},
        buildAccountSelect(values){projections.push(structuredClone(values));const select=document.createElement('select');for(const [index,value] of values.entries()){const option=document.createElement('option');option.value=String(index);option.textContent=value.title||value.instance;select.appendChild(option);}return select;},
        buildVisibilitySelect(){const select=document.createElement('select');for(const value of ['public','private']){const option=document.createElement('option');option.value=value;option.textContent=value;select.appendChild(option);}return select;},
        async fetch(url,options){calls.push(['fetch',url,options]);if(behavior.fetch)return await behavior.fetch(url,options);return{ok:true,json:async()=>({id:'accepted-id'})};},
        showStatusMessage:message=>notices.push(message),showErrorModal:message=>notices.push(message),
        async switchToEditor(editor){switched.push(editor);if(behavior.switch) return await behavior.switch(editor);globalThis.currentEditor=editor;window.CList.state.editorSwitching.id++;return true;}});
    window.getWriteTags=()=>tags;window.hypothesisCreate=async(account,payload)=>{calls.push(['hypothesis',account,payload]);return{id:'https://hypothes.is/a/accepted'};};
    editorHandlers['annotate-edit'].getContent=async function(){reads.push(this);return behavior.body?await behavior.body():body;};_annotateReturnEditor='texteditor';
    const button=text=>Array.from(section.querySelectorAll('button')).find(node=>node.textContent===text);
    const send=control=>{const selected=control||section.querySelector('.annotation-send-controls button');dispatched=undefined;selected.dispatchEvent(new Event('click'));return dispatched||Promise.resolve(false);};
    return{root,section,target,references,calls,switched,notices,projections,behavior,reads,accounts,button,send,
        render(){const loaded=_renderSendControls(section),controller=_annotationSendPanel.controller,sendAction=controller.send;controller.send=(...args)=>{dispatched=sendAction.apply(controller,args);return dispatched;};return loaded;},get state(){return window.CList.state.annotationSend;},get body(){return body;},set body(value){body=value;},get returnTo(){return _annotateReturnEditor;},set returnTo(value){_annotateReturnEditor=value;},
        get tags(){return tags;},set tags(value){tags=value;},token(value){token=value;},expire(){window.CList.state.authEpoch++;},
        select(index,visibility){const fields=section.querySelectorAll('select');if(index!==undefined){fields[0].value=String(index);fields[0].onchange();}if(visibility){fields[1].value=visibility;fields[1].onchange();}},
        dispose(){_annotationSendPanel?.controller.dispose();root.remove();}};
}
const annotationSendCases=[
    ['account filtering and state-owned choices exclude private presentation data',async check=>{
        const f=annotationSendFixture();await f.render();check(f.section.querySelectorAll('option').length===4&&f.section.textContent.includes('<Store literal>')&&!f.section.querySelector('Store'),'two writable accounts and public/private choices with literal labels');
        f.select(1,'private');check(f.state.accountIndex===1&&f.state.visibility==='private'&&!JSON.stringify(f.projections).includes('private-hypothesis-key')&&!f.section.textContent.includes('private-account-key'),'credentials stay outside the view');
        globalThis.currentEditor='other';window.CList.state.editorSwitching.id++;globalThis.currentEditor='annotate-edit';window.CList.state.editorSwitching.id++;
        await f.render();check(f.state.accountIndex===1&&f.state.visibility==='private'&&f.section.querySelectorAll('select')[1].value==='private','reactivated controls preserve account and private visibility');
        check(Object.keys(f.state).sort().join()==='accountIndex,busy,phase,receipt,visibility','safe selection summary');f.dispose();
    }],
    ['real request/workflow/transport sends only captured primary target and returns safely',async check=>{
        const f=annotationSendFixture();await f.render();f.select(0,'private');check(await f.send(),'Send succeeds');const call=f.calls.find(call=>call[0]==='fetch'),payload=JSON.parse(call[2].body);
        check(call[1]==='https://annotations.invalid/annotations'&&call[2].headers.Authorization==='Bearer private-token'&&payload.body==='<p>Captured body</p>'&&payload.target_url==='https://target.invalid','captured credential/endpoint/body/primary URL');
        check(payload.tags[0]==='captured-tag'&&payload.visibility==='private'&&payload.target_selector.title==='Target title'&&payload.target_selector.author_name==='Author'&&payload.target_selector.feed==='Feed','tags/visibility/source metadata retain old Send contract');
        check(f.switched.join()==='texteditor'&&f.returnTo===null&&f.state.receipt==='accepted'&&!f.state.busy,'unchanged draft returns once with settled lock');f.dispose();
    }],
    ['duplicate sends coalesce while account/visibility changes are rejected',async check=>{
        const f=annotationSendFixture(),gate=annotationSendGate();f.behavior.body=()=>gate.promise;await f.render();f.select(0,'private');const first=f.send(),duplicate=f.send();check(first===duplicate,'same pending Send promise');await annotationSendFlush();f.select(1,'public');
        check(f.state.accountIndex===0&&f.state.visibility==='private'&&f.section.querySelectorAll('select')[0].disabled,'state owns the disabled choices');gate.resolve('Captured async body');await first;
        const call=f.calls.find(call=>call[0]==='fetch');check(f.calls.filter(call=>call[0]==='fetch').length===1&&JSON.parse(call[2].body).visibility==='private','one captured destination write');f.dispose();
    }],
    ['new target/tags or expired session during body capture cancels before publishing',async check=>{
        for(const change of ['target','tags','session']){
            const f=annotationSendFixture(),gate=annotationSendGate();f.behavior.body=()=>gate.promise;await f.render();const pending=f.send();await annotationSendFlush();if(change==='target')f.target.url='https://changed.invalid';else if(change==='tags')f.tags=['new-tag'];else f.token('new-session');gate.resolve('Body');
            check(await pending===false&&!f.calls.some(call=>call[0]==='fetch')&&f.switched.length===0,change+' blocks stale dispatch');f.dispose();
        }
    }],
    ['accepted Send preserves newer body/metadata/tags/return intent',async check=>{
        const f=annotationSendFixture(),gate=annotationSendGate();f.behavior.fetch=()=>gate.promise;await f.render();const pending=f.send();await annotationSendFlush();f.body='<p>Newer draft</p>';f.target.title='New metadata';f.tags=['new-tag'];f.returnTo='new-return';gate.resolve({ok:true,json:async()=>({id:'accepted'})});
        check(await pending&&f.switched.length===0&&f.body==='<p>Newer draft</p>'&&f.target.title==='New metadata'&&f.returnTo==='new-return','accepted original does not clear or leave newer draft');check(f.state.receipt==='accepted'&&!f.state.busy,'accepted operation settles without draft mutations');f.dispose();
    }],
    ['rebuilding controls holds the pending lock and suppresses old completion effects',async check=>{
        const f=annotationSendFixture(),gate=annotationSendGate();f.behavior.fetch=()=>gate.promise;await f.render();const old=f.section.querySelector('.annotation-send-controls button'),pending=f.send();await annotationSendFlush();await f.render();
        check(f.state.busy&&f.section.querySelector('.annotation-send-controls button').disabled,'rebuilt controls inherit pending lock');await f.send();check(f.calls.filter(call=>call[0]==='fetch').length===1,'rebuilt Send cannot duplicate publication');gate.resolve({ok:true,json:async()=>({id:'accepted'})});await pending;
        check(f.switched.length===0&&!f.state.busy&&f.section.textContent.includes('Earlier Send finished'),'old completion unlocks current controls without returning or replaying');await f.send(old);check(f.calls.filter(call=>call[0]==='fetch').length===1,'old saved control remains inert');f.dispose();
    }],
    ['account loading failure is visible with explicit retry and stale loads cannot repaint',async check=>{
        const f=annotationSendFixture();f.behavior.accounts=()=>{throw Error('accounts failed');};await f.render();check(f.state.phase==='error'&&f.section.textContent.includes('accounts failed'),'account read failure is not an empty account list');delete f.behavior.accounts;await f.button('Reload Send controls').onclick();check(!!f.section.querySelector('.annotation-send-controls button'),'explicit reload succeeds');f.dispose();
        const g=annotationSendFixture(),gate=annotationSendGate();g.behavior.accounts=()=>gate.promise;const old=g.render();await annotationSendFlush();delete g.behavior.accounts;await g.render();gate.resolve();await old;check(g.section.querySelectorAll('.annotation-send-controls').length===1&&g.state.phase==='ready','superseded account load cannot append old controls');g.dispose();
    }],
    ['account changes invalidate old choices and retired row callbacks',async check=>{
        const f=annotationSendFixture();await f.render();const old=f.section.querySelector('.annotation-send-controls button');window.CList.accounts.shift();check(await f.send()===false&&!f.calls.some(call=>call[0]==='fetch')&&f.section.textContent.includes('accounts changed'),'removed account cannot be used');await f.button('Reload Send controls').onclick();await f.send(old);check(!f.calls.some(call=>call[0]==='fetch'||call[0]==='hypothesis'),'retired callback cannot send using new choices');f.dispose();
    }],
    ['login/permission/missing-target states do not invoke transport',async check=>{
        const f=annotationSendFixture();f.token('');await f.render();check(f.state.phase==='login-required'&&!f.calls.some(call=>call[0]==='accounts'),'login notice without account request');f.dispose();
        const g=annotationSendFixture();window.CList.accounts=window.CList.accounts.slice(2);await g.render();check(g.state.phase==='empty'&&g.section.textContent.includes('No annotation account'),'write permission filtering');g.dispose();
        const h=annotationSendFixture();await h.render();h.target.url='';check(await h.send()===false&&h.section.textContent.includes('No target URL')&&!h.calls.some(call=>call[0]==='fetch'),'missing target visible before body/network');h.dispose();
    }],
    ['uncertain and rejected results stay visible and are never automatically retried',async check=>{
        const f=annotationSendFixture();f.behavior.fetch=()=>{throw Error('network lost');};await f.render();check(await f.send()===false&&f.state.receipt==='uncertain'&&f.section.textContent.includes('Check the server before retrying')&&f.calls.filter(call=>call[0]==='fetch').length===1,'uncertainty remains visible without replay');f.dispose();
        const g=annotationSendFixture();g.behavior.fetch=()=>({ok:false,status:403,json:async()=>({detail:'Rejected'})});await g.render();check(await g.send()===false&&g.state.receipt==='rejected'&&g.switched.length===0&&!g.state.busy,'rejection preserves draft and unlocks');delete g.behavior.fetch;check(await g.send()&&g.calls.filter(call=>call[0]==='fetch').length===2,'later explicit Send retries once');g.dispose();
    }],
    ['stale pending completion cannot render errors or switch another source',async check=>{
        const f=annotationSendFixture(),gate=annotationSendGate();f.behavior.fetch=()=>gate.promise;await f.render();const pending=f.send();await annotationSendFlush();f.expire();f.section.textContent='New session surface';gate.reject(Error('old network failure'));
        check(await pending===false&&f.section.textContent==='New session surface'&&f.switched.length===0&&f.notices.length===0,'late failure does not affect new session/UI');f.dispose();
    }],
    ['post-write return-check failure keeps acceptance and never repeats the write',async check=>{
        const f=annotationSendFixture();let reads=0;f.behavior.body=()=>{if(++reads>1)throw Error('draft readback failed');return 'Captured body';};await f.render();
        check(await f.send()&&f.state.receipt==='accepted'&&f.switched.length===0&&f.section.textContent.includes('Annotation sent. Your draft was kept')&&f.calls.filter(call=>call[0]==='fetch').length===1,'accepted write stays separate from return failure');f.dispose();
    }]
];
