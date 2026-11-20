// Shared confirmation controller. Passwords/verification keys remain transient.
let _passwordConfirmationOwner=null,_passwordConfirmationId=0;
function passwordConfirmationSession(){
    const storeUrl=window.CList.config.flaskSiteUrl,username=getSiteSpecificCookie(storeUrl,window.CList.keys.USERNAME);
    return {storeUrl,username,accountUsername:window.CList.state.username,token:getSiteSpecificCookie(storeUrl,window.CList.keys.ACCESS_TOKEN),
        mode:window.CList.storage?.mode,storedKey:username?sessionStorage.getItem(`${storeUrl}_${username}_encKey`):null};
}
function passwordVerificationDependencies(assertCurrent){return {assertCurrent,derive:deriveEncKey,
    exportKey:key=>window.crypto.subtle.exportKey('raw',key),encode:raw=>btoa(String.fromCharCode(...new Uint8Array(raw)))};}
async function verifyPassword(password){
    const snapshot=passwordConfirmationSession();
    return verifyPasswordSnapshot(password,snapshot,passwordVerificationDependencies(()=>{if(JSON.stringify(passwordConfirmationSession())!==JSON.stringify(snapshot))throw new Error('The password session changed.');}));
}
/** Compatible API: trusted HTML message, callback(password), optional custom verifier/label/class/source guard. */
function confirmWithPassword(message,onConfirm,opts={}){
    const view=window.CList.ui.passwordConfirmation;
    if(_passwordConfirmationOwner&&!_passwordConfirmationOwner.done){const old=_passwordConfirmationOwner;old.done=true;view.close(old.handle);old.session=null;old.cancelNotice?.();}
    const owner=_passwordConfirmationOwner={id:++_passwordConfirmationId,session:passwordConfirmationSession(),done:false,pending:false,handle:null};
    const visible=()=>_passwordConfirmationOwner===owner&&!owner.done&&view.connected(owner.handle);
    const current=()=>visible()&&JSON.stringify(passwordConfirmationSession())===JSON.stringify(owner.session)&&(!opts.isCurrent||opts.isCurrent());
    const summary=(phase,error=null)=>{if(_passwordConfirmationOwner===owner)window.CList.state.passwordConfirmation={id:owner.id,phase,error};};
    const cancelNotice=()=>{try{opts.onCancel?.();}catch{view.actionError();}};owner.cancelNotice=cancelNotice;
    const close=()=>{if(!visible())return;owner.done=true;summary('cancelled');view.close(owner.handle);owner.session=null;cancelNotice();};
    const attempt=async()=>{
        if(!visible()||owner.pending)return;
        if(!current()){summary('expired');view.clear(owner.handle);view.message(owner.handle,'The session or source changed. Cancel and reopen this action.');return;}
        owner.pending=true;summary('verifying');view.busy(owner.handle,true);view.message(owner.handle,'');let password=owner.handle.input.value;
        try{
            const ok=await(opts.verify?opts.verify(password):verifyPasswordSnapshot(password,owner.session,passwordVerificationDependencies(()=>{if(!current())throw new Error('Expired verification.');})));
            if(!current())return;
            if(!ok){summary('rejected');view.message(owner.handle,'Incorrect password.');return;}
            owner.done=true;summary('confirmed');view.close(owner.handle);owner.session=null;
            try{await onConfirm(password);}catch{if(_passwordConfirmationOwner===owner)summary('action-failed','Confirmed action failed.');view.actionError();}
        }catch{
            if(current()){console.error('Password verification failed.');summary('failed','Password verification failed.');view.message(owner.handle,'Could not verify the password. Please try again.');}
        }finally{
            password='';owner.pending=false;
            if(visible()){
                view.busy(owner.handle,false);
                if(!current()){summary('expired');view.clear(owner.handle);view.message(owner.handle,'The session or source changed. Cancel and reopen this action.');}
            }else view.clear(owner.handle);
        }
    };
    owner.handle=view.mount(message,opts,attempt,close);summary('ready');
    view.watchClosed(owner.handle,()=>{if(!owner.done){owner.done=true;summary('cancelled');owner.session=null;cancelNotice();}});
    return {isOpen:visible,cancel:close};
}
