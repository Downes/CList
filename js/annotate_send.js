function writableAnnotationEditorAccounts(records,parse){
    return records.map(record=>({key:record.key,account:parse(record)})).filter(({account})=>account&&['Annotate','Hypothesis','gRSShopper'].includes(account.type)&&(account.permissions||'rw').includes('w'))
        .map(entry=>({...entry,key:entry.key||JSON.stringify([entry.account.type,entry.account.instance,entry.account.username,entry.account.title])}));
}
function createAnnotationSendController(deps,view,shared){
    let disposed=false,version=0,accounts=[],accountStamp=null,index=0,visibility='public',phase='loading',receipt='none';
    const owned=()=>!disposed&&deps.current()&&view.alive();
    const accountCurrent=()=>accountStamp===deps.accountStamp();
    const remember=()=>{if(accounts[index])shared.choice={session:deps.preferenceKey(),key:accounts[index].key,visibility};};
    const state=(settled=false)=>{
        /** @type {CListAnnotationSendState} */
        const value={phase,busy:phase==='loading'||!!shared.pending,accountIndex:index,visibility,receipt};if(owned()||settled)deps.state(value);
    };
    const controller={
        owned,
        async load(){
            if(!owned())return false;const id=++version;phase='loading';accounts=[];view.notice('Loading annotation accounts…');view.busy(true);state();
            if(!deps.session.token){phase='login-required';view.notice('Log in with an annotation account to send.');state();return true;}
            try{
                const records=await deps.accounts();if(!owned()||version!==id)return false;
                accounts=structuredClone(writableAnnotationEditorAccounts(records,deps.parse));accountStamp=deps.accountStamp();index=0;visibility='public';
                if(!accounts.length){phase='empty';view.notice('No annotation account with write permission — add one in Account Settings.');state();return true;}
                if(shared.choice?.session===deps.preferenceKey()){
                    const selected=accounts.findIndex(entry=>entry.key===shared.choice.key);if(selected>=0)index=selected;
                    if(['public','private'].includes(shared.choice.visibility))visibility=shared.choice.visibility;
                }
                remember();phase='ready';view.choices(accounts.map(({account})=>({title:account.title||account.instance||account.type})),index,visibility,controller);controller.refresh();return true;
            }catch(error){if(owned()&&version===id){phase='error';view.busy(false);view.error(error,()=>controller.load());state();}return false;}
        },
        select(value){if(!owned()||shared.pending||!Number.isInteger(value)||!accounts[value])return false;index=value;receipt='none';remember();state();return true;},
        visibility(value){if(!owned()||shared.pending||!['public','private'].includes(value))return false;visibility=value;receipt='none';remember();state();return true;},
        refresh(finished){
            if(!owned())return;view.busy(phase==='loading'||!!shared.pending);
            if(finished&&finished.controller!==controller&&deps.sameSession(finished.snapshot))view.notice('Earlier Send finished. Check its destination before sending again.');
            state();
        },
        send(){
            if(!owned()||phase==='loading'||!accounts[index])return Promise.resolve(false);
            if(shared.pending){if(shared.pending.controller===controller)return shared.pending.promise;view.notice('An annotation is already being sent.');return Promise.resolve(false);}
            if(!accountCurrent()){view.error(Error('Annotation accounts changed. Reload the Send controls.'),()=>controller.load());return Promise.resolve(false);}
            let snapshot;
            try{
                snapshot=deps.capture(structuredClone(accounts[index].account),visibility);
                if(!snapshot.target.url)throw Error('No target URL for this annotation — fill in the URL field above.');
            }catch(error){if(owned())view.error(error);return Promise.resolve(false);}
            const id=version,job={controller,snapshot,promise:null};shared.pending=job;phase='capturing';receipt='none';view.busy(true);state();
            const current=()=>owned()&&version===id&&accountCurrent();
            job.promise=Promise.resolve().then(async()=>{
                try{
                    if(!current())return false;
                    const body=await snapshot.read();
                    if(!current())return false;
                    if(!deps.draftCurrent(snapshot)){view.notice('The annotation draft changed before Send. Press Send again for the updated draft.');return false;}
                    phase='sending';state();const outcome=await deps.publish(snapshot,body);
                    receipt=outcome.uncertain?'uncertain':outcome.created?'accepted':'rejected';phase=outcome.uncertain?'uncertain':'result';
                    if(!current())return !!outcome.created;
                    view.result(outcome,snapshot.label,snapshot.target.url);state();
                    if(outcome.created&&deps.draftCurrent(snapshot)){
                        try{
                            const latest=await snapshot.read();
                            if(current()&&deps.draftCurrent(snapshot)&&latest===body)await deps.returnEditor(snapshot,()=>current()&&deps.draftCurrent(snapshot));
                        }catch(error){if(current())view.returnError(error);}
                    }
                    return !!outcome.created;
                }catch(error){if(current()){phase='error';view.error(error);state();}return false;}
                finally{
                    if(shared.pending===job)shared.pending=null;
                    if(phase==='capturing')phase=current()?'ready':'cancelled';
                    else if(phase==='sending'&&!current())phase='cancelled';
                    if(owned())view.busy(false);state(true);deps.settled(job);
                }
            });return job.promise;
        },
        dispose(){disposed=true;version++;}
    };
    view.mount();return controller;
}
const _annotationSendShared={pending:null};
let _annotationSendPanel=null;
function annotationSendSource(){return JSON.stringify([captureAnnotationSession(),annotationDraftSource()]);}
function renderAnnotationSendControls(section){
    _annotationSendPanel?.controller.dispose();const source=annotationSendSource(),session=captureAnnotationSession(),epoch=window.CList.state.authEpoch||0;
    const view=createAnnotationSendView(section);
    const controller=createAnnotationSendController({
        session,current:()=>currentEditor==='annotate-edit'&&source===annotationSendSource(),
        accounts:()=>ensureAccountsLoaded(),parse:parseAccountValue,accountStamp:()=>JSON.stringify(window.CList.accounts||[]),
        preferenceKey:()=>JSON.stringify([session.storeUrl,window.CList.state.username,epoch]),
        sameSession:snapshot=>snapshot.epoch===(window.CList.state.authEpoch||0)&&JSON.stringify(snapshot.session)===JSON.stringify(captureAnnotationSession()),
        capture(account,visibility){
            const draft=_annotateTarget(),handler=editorHandlers['annotate-edit'],tags=structuredClone(window.getWriteTags?.()||[]);
            return{draft,target:structuredClone(draft),tags,account,visibility,session:structuredClone(session),epoch,
                returnTo:_annotateReturnEditor,handler,read:handler.getContent.bind(handler),label:account.title||account.instance||account.type};
        },
        draftCurrent:snapshot=>snapshot.draft===_annotateTarget()&&JSON.stringify(snapshot.target)===JSON.stringify(_annotateTarget())&&snapshot.handler===editorHandlers['annotate-edit']&&
            snapshot.returnTo===_annotateReturnEditor&&JSON.stringify(snapshot.tags)===JSON.stringify(window.getWriteTags?.()||[]),
        publish(snapshot,body){
            const target=snapshot.target;
            const request=captureAnnotationRequest({body,references:[{url:target.url,title:target.title,author_name:target.author_name,feed:target.feed}],tags:snapshot.tags,visibility:snapshot.visibility,selectors:true});
            return runAnnotationOperation(snapshot.account,request,snapshot.session);
        },
        async returnEditor(snapshot,current){
            if(!current())return false;
            const to=snapshot.returnTo;
            if(!to||to==='annotate-edit'){if(_annotateReturnEditor===to)_annotateReturnEditor=null;return true;}
            const result=await switchToEditor(to);
            if(result!==false&&_annotateReturnEditor===to)_annotateReturnEditor=null;
            return result!==false;
        },
        settled:job=>_annotationSendPanel?.controller.refresh(job),
        state:value=>{if(_annotationSendPanel?.controller===controller)window.CList.state.annotationSend=value;}
    },view,_annotationSendShared);
    _annotationSendPanel={controller,section};return controller.load().catch(error=>{if(controller.owned())view.error(error);else console.error('Expired annotation Send controls failed:',error);return false;});
}
