// Existing-key publication controller. Receipts and credentials stay transient.
let _didPublicationOwner=null,_didPublicationSequence=0;
const _didPublicationLocks=new Set();
registerDidIdentityMutation('publication',key=>_didPublicationLocks.has(key));
function createDidExistingPublisher(root,{onStart,onPublished,refreshAccounts}){
    const owner=_didPublicationOwner={id:++_didPublicationSequence,session:didIdentitySession(),receipt:null,prepared:null,needsCheck:false,pending:false};
    const current=()=>_didPublicationOwner===owner&&root.isConnected&&JSON.stringify(didIdentitySession())===JSON.stringify(owner.session);
    const view=window.CList.ui.didPublication,lock=JSON.stringify(owner.session);
    const summary=(phase,error=null)=>{if(current())window.CList.state.identityPublication={panelId:owner.id,phase,error};};
    const deps=()=>({assertCurrent(){if(!current())throw new Error('The identity panel or login changed.');},fetch,
        getKey:()=>getEncKey(owner.session.storeUrl),getIdentityKey:()=>window.CList.storage.kv.get(window.CList.keys.DID_IDENTITY_KEY),derive:derivePublicKeyJwkAndDidKey,expectedDidKey:owner.expectedDidKey,
        prepared:value=>{owner.prepared=value;},sending:()=>{if(current()){summary('publishing');view.progress(root,'Registering DID…');}},accepted:receipt=>{owner.receipt=receipt;}});
    const finish=async receipt=>{
        owner.receipt=receipt;if(!current())return;
        onPublished();summary('confirmed');const warnings=receipt.warning?[receipt.warning]:[];view.result(root,receipt,warnings);
        try{await refreshAccounts();if(current()&&window.CList.state.identityDisplay?.accounts.phase==='failed')warnings.push('DID publication succeeded; account-list refresh failed. Use its Retry control.');}
        catch(error){console.error('[DID account refresh]',error);warnings.push('DID publication succeeded; account-list refresh failed.');}
        if(!current())return;
        try{if(typeof refreshCollabRegistrations==='function'){const failures=await refreshCollabRegistrations();if(failures?.length)warnings.push('DID publication succeeded; some collaboration registrations could not be refreshed.');}}
        catch(error){console.error('[DID collaboration refresh]',error);warnings.push('DID publication succeeded; collaboration refresh failed.');}
        if(current())view.result(root,receipt,warnings);
    };
    const publish=async expectedDidKey=>{
        if(!current()||owner.pending||owner.receipt)return;
        if(typeof expectedDidKey==='string')owner.expectedDidKey=expectedDidKey;
        if(_didPublicationLocks.has(lock)||didIdentityMutationBusy(owner.session,owner.expectedDidKey?['publication','generation']:['publication'])){view.progress(root,'Another identity operation is running. Wait for it to finish.');return;}
        _didPublicationLocks.add(lock);owner.pending=true;
        try{
            view.busy(root,true);onStart();summary('preparing');
            if(owner.needsCheck){
                const latest=await deps().getIdentityKey();deps().assertCurrent();if(latest?.value!==owner.prepared.storedValue)throw new Error('The stored identity key changed. Reopen the identity panel.');
                const matches=await checkExistingDidPublication(owner.session,owner.prepared,deps());if(!current())return;
                if(matches){owner.needsCheck=false;await finish({didKey:owner.prepared.didKey,existing:true});}
                else{owner.needsCheck=false;summary('failed');view.progress(root,'No published DID was found. Click Retry publication to try again.');view.action(root,'Retry publication',publish);}
                return;
            }
            view.progress(root,'Reading stored identity key…');const receipt=await publishStoredDid(owner.session,deps());await finish(receipt);
        }catch(error){
            if(current()){
                if(owner.receipt){summary('confirmed');view.result(root,owner.receipt,['Publication succeeded, but follow-up work failed.']);console.error('[DID follow-up]',error);}
                else{owner.needsCheck=owner.needsCheck||!!error.uncertain;summary(owner.needsCheck?'uncertain':'failed',error.message);view.error(root,error);view.action(root,owner.needsCheck?'Check publication':'Retry publication',publish);}
            }
        }finally{owner.pending=false;_didPublicationLocks.delete(lock);if(current())view.busy(root,false);}
    };
    return {publish};
}
