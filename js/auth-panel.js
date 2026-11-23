// Form/picker state owner. Credential verification and session installation remain in kvstore.js.
let _authPanelController=null, _authPanelSequence=0, _authPanelSubmission=null;
function createAuthPanel(root, deps) {
    const id=++_authPanelSequence, view=window.CList.ui.authPanel(root);
    const allowed=view.servers();
    let viewRevision=0;
    /** @type {CListAuthPanelState} */
    let state=authPanelState(deps.server());
    const current=()=>root.isConnected&&deps.root()===root;
    const render=()=>{
        if(!current())return;
        window.CList.state.authPanel={...state};
        const generation=state.generation, revision=++viewRevision;
        view.render(state,authServerLabel(state.serverUrl,deps.localUrl),value=>{
            if(!current()||generation!==state.generation||revision!==viewRevision||state.panel!=='server'||_authPanelSubmission)return;
            if(allowed.includes(value)){state.draftServer=value;state.error=null;render();}
        },()=>{if(current()&&generation===state.generation&&revision===viewRevision&&!state.busy)return submitAuthModal(true);});
    };
    const unlocked=()=>{if(!_authPanelSubmission)return true;deps.status('Please wait for the current login or registration to finish.');return false;};
    const owns=attempt=>current()&&_authPanelSubmission===attempt&&attempt.owner===id&&attempt.generation===state.generation&&attempt.epoch===(window.CList.state.authEpoch||0)&&deps.server()===attempt.serverUrl;
    const controller={root,owns,
        cancelForLogout(){
            if(_authPanelSubmission?.owner===id){_authPanelSubmission.input.password='';_authPanelSubmission=null;}
            state={...state,generation:state.generation+1,panel:'closed',busy:false,error:null};view.clearSecrets();render();
        },
        ownsSetup:attempt=>current()&&attempt.owner===id&&attempt.generation===state.generation&&attempt.epoch===(window.CList.state.authEpoch||0)&&deps.server()===attempt.serverUrl&&attempt.authenticated,
        open(mode){
            if(!current()||!unlocked())return;
            if(!['login','register'].includes(mode))return;
            deps.beforeOpen();state={...authPanelState(deps.server()),generation:state.generation+1,mode,panel:'main'};view.reset();render();view.focus();
        },
        close(){if(!current()||!unlocked())return;state={...state,generation:state.generation+1,panel:'closed',error:null};view.clearSecrets();render();},
        openServers(){
            if(!current()||state.panel!=='main'||!unlocked())return;
            state={...state,panel:'server',draftServer:allowed.includes(deps.server())?deps.server():allowed[0]||null,error:null};render();
        },
        closeServers(){if(!current()||state.panel!=='server'||!unlocked())return;state={...state,panel:'main',draftServer:null,error:null};render();},
        selectServer(){
            if(!current()||state.panel!=='server'||!unlocked())return;
            try{
                const result=applyAuthServerSelection(state.draftServer,deps.server(),allowed,deps);
                state={...state,serverUrl:deps.server(),panel:'main',draftServer:null,error:result.warning};render();
            }catch(error){console.error('Account server selection failed:',error);state.error=error.message;render();}
        },
        toggle(inputId,icon){if(current()&&state.panel==='main'&&!state.busy)view.toggle(inputId,icon);},
        begin(retryRegistration = false){
            if(!current()||state.panel!=='main'||_authPanelSubmission)return null;
            if(retryRegistration&&!['uncertain','rejected'].includes(state.registration))return null;
            if(deps.server()!==state.serverUrl){state.error='The account server changed. Reopen Login or Register.';render();return null;}
            try{
                const input=validateAuthInput(view.input(),state.mode);
                window.CList.state.authEpoch=(window.CList.state.authEpoch||0)+1;
                const attempt=_authPanelSubmission={owner:id,generation:state.generation,epoch:window.CList.state.authEpoch||0,serverUrl:state.serverUrl,input,authenticated:false};
                state.busy=true;state.error=null;render();return attempt;
            }catch(error){state.error=error.message;render();return null;}
        },
        registration(attempt,status){if(owns(attempt)){state.registration=status;render();}},
        authenticated(attempt){if(!owns(attempt))return;attempt.authenticated=true;state.panel='closed';view.clearSecrets();render();},
        failed(attempt,error){
            if(!owns(attempt))return;
            if(attempt.authenticated)deps.status('Logged in, but account setup could not finish: '+error.message);
            else{state.error=state.registration==='created'?'Account created; login or session saving could not finish: '+error.message:(state.mode==='register'?'Registration':'Login')+' failed: '+error.message;render();}
        },
        settled(attempt){
            attempt.input.password='';if(_authPanelSubmission!==attempt)return;_authPanelSubmission=null;
            if(current()&&attempt.generation===state.generation&&attempt.epoch===(window.CList.state.authEpoch||0)){state.busy=false;render();}
        }
    };
    return controller;
}
function authPanelController(){
    const root=document.getElementById('authModal');
    if(!_authPanelController||_authPanelController.root!==root)_authPanelController=createAuthPanel(root,{
        root:()=>document.getElementById('authModal'),server:()=>window.CList.config.flaskSiteUrl,localUrl:window.CList.LOCAL_KVSTORE_URL,
        persist:url=>localStorage.setItem(window.CList.keys.KVSTORE_URL,url),select:url=>{window.CList.config.flaskSiteUrl=url;},
        changed(){if(window.CList.state.publishing)window.CList.state.publishing.selectedAccountKeys=[];if(typeof invalidateReader==='function')invalidateReader();},
        status:message=>showStatusMessage(message),beforeOpen(){if(typeof endTour==='function')endTour();}
    });
    return _authPanelController;
}
function openAuthModal(mode){return authPanelController().open(mode);}
function closeAuthModal(){return authPanelController().close();}
function openChangeServerPanel(){return authPanelController().openServers();}
function closeChangeServerPanel(){return authPanelController().closeServers();}
function selectAccountServer(){return authPanelController().selectServer();}
function toggleAuthPassword(inputId,icon){return authPanelController().toggle(inputId,icon);}

function cancelAuthForLogout(){_authPanelController?.cancelForLogout();}
