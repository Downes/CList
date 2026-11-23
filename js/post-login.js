// Own post-login effects separately from accepted credentials. Private plans retain step receipts.
let _postLoginOwner=null,_postLoginSequence=0;
async function finishAuthSetup(attempt,panel) {
    const target=captureAuthCredentialTarget(),owner=_postLoginOwner={id:++_postLoginSequence,dialog:null};
    const defaults={...window.CList.defaults},session={storeUrl:target.serverUrl,token:getSiteSpecificCookie(target.serverUrl,target.keys.ACCESS_TOKEN),encKey:null};
    const assertCurrent=()=>{
        if(_postLoginOwner!==owner||!panel.ownsSetup(attempt)||(owner.dialog&&!owner.dialog.isConnected))throw new Error('Account setup expired. The accepted login and completed steps were kept.');
        authCredentialDependencies(target).assertCurrent();
    };
    /** @type {CListPostLoginPlan} */
    const plan={session,steps:[],discover:attempt.input.mode==='register',discovered:false,discoveryError:null};
    let pending=false,refreshError=null,shown=false;
    const readerVersion=()=>window.CList.state.reader?.requestId??0,initialReader=readerVersion();
    /** @returns {CListPostLoginState} */
    const summary=()=>{
        const errors=[plan.discoveryError,refreshError,...plan.steps.map(step=>step.error)].filter(Boolean);
        return {operationId:owner.id,pending,done:plan.steps.filter(step=>['accepted','existing'].includes(step.record)).length,total:plan.steps.length,errors,
            uncertainServices:plan.steps.filter(step=>step.registration==='uncertain'&&!['accepted','existing'].includes(step.record)).map(step=>({key:step.key,label:step.label}))};
    };
    const publish=()=>{assertCurrent();window.CList.state.postLoginSetup=summary();};
    const deps={assertCurrent,fetch:(...args)=>fetch(...args),list:()=>window.CList.storage.kv.list(),add:(...args)=>window.CList.storage.kv.add(...args),encrypt:(...args)=>encryptWithKey(...args),
        discover:()=>discoverPublicFeedSetup(defaults.LOCALRSS,{assertCurrent,fetch:(...args)=>fetch(...args)}),failed:error=>console.error('Account setup step failed:',error)};
    const refresh=async()=>{
        const accounts=await loadAccountRecords({...session,isCurrent:()=>{try{assertCurrent();return true;}catch{return false;}}});assertCurrent();
        if(accounts.length&&accounts.every(account=>parseAccountValue(account)?.type==='bad'))throw new Error('Saved accounts could not be decrypted. Check the session key before continuing.');
        window.CList.accounts=accounts;updateUIVisibility();populateReadAccountList(accounts);populatePostOptions(accounts);
        if(!shown&&readerVersion()===initialReader){shown=true;await playRead();assertCurrent();if(plan.discover&&readerVersion()===initialReader)window.CList.ui.postLogin.welcome(window.CList.ui.view.feedContainer);}
    };
    const work=async(kind='run',key=null)=>{
        if(pending)return;try{assertCurrent();}catch{return;}
        pending=true;refreshError=null;window.CList.ui.postLogin.busy(owner.dialog,true);publish();
        try{
            if(!session.encKey){session.encKey=await getEncKey(session.storeUrl);assertCurrent();if(!session.encKey)throw new Error('The session encryption key is unavailable.');}
            if(kind==='service'){
                const step=plan.steps.find(item=>item.key===key);if(!step||step.registration!=='uncertain')return;step.registration='ready';
            }
            if(kind==='check')await checkPostLoginSetup(plan,deps);
            else if(kind!=='refresh')await runPostLoginSetup(plan,deps,kind==='service'?key:null);
            assertCurrent();await refresh();
        }catch(error){console.error('Post-login setup incomplete:',error);try{assertCurrent();refreshError=error.message;}catch{return;}}
        finally{
            pending=false;
            try{
                assertCurrent();publish();const state=summary();
                if(owner.dialog||state.errors.length||state.done<state.total){
                    owner.dialog=window.CList.ui.postLogin.result(state,{refresh:()=>work('refresh'),check:()=>work('check'),retry:()=>work(),service:key=>work('service',key)});
                }else window.CList.ui.postLogin.busy(owner.dialog,false);
            }catch(error){
                try{assertCurrent();}catch{return;} // Expired UI cannot replace another session's feedback.
                console.error('Could not display account setup results:',error);
                showStatusMessage('Logged in, but account setup feedback could not be displayed. Check Accounts before retrying.');
            }
        }
    };
    if(plan.discover&&defaults.LOCALRSS)plan.steps.push(postLoginStep(publicFeedSetupAccount(defaults.LOCALRSS,'clist-changelog','CList Changelog')));
    else if(!defaults.LOCALRSS)plan.discovered=true;
    if(!target.local){
        const descriptors=[...(plan.discover?[collabSetupAccount(defaults),annotationSetupAccount(defaults)]:[]),clistbinSetupAccount(defaults)];
        for(const descriptor of descriptors.filter(Boolean))plan.steps.push(postLoginStep(descriptor));
    }
    return work();
}
