// First-time generation controller. Existing-key publication owns its own receipts.
let _didGenerationOwner=null,_didGenerationId=0;
const _didGenerationLocks=new Set();
registerDidIdentityMutation('generation',key=>_didGenerationLocks.has(key));
function createDidFirstGenerator(root,{onStart,onStored,publishStored,refreshIdentity}){
    const owner=_didGenerationOwner={id:++_didGenerationId,session:didIdentitySession(),pending:false,needsCheck:false,receipt:null};
    const current=()=>_didGenerationOwner===owner&&root.isConnected&&JSON.stringify(didIdentitySession())===JSON.stringify(owner.session);
    const lock=JSON.stringify(owner.session),view=window.CList.ui.didGeneration;
    const summary=(phase,error=null)=>{if(current())window.CList.state.identityGeneration={panelId:owner.id,phase,error};};
    const deps=()=>({assertCurrent(){if(!current())throw new Error('The identity panel or login changed.');},
        getIdentityKey:()=>window.CList.storage.kv.get(window.CList.keys.DID_IDENTITY_KEY),getKey:()=>getEncKey(owner.session.storeUrl),
        derive:derivePublicKeyJwkAndDidKey,generate:generateIdentityKeyPair,encrypt:encryptIdentityPrivateKey,
        add:value=>window.CList.storage.kv.add(window.CList.keys.DID_IDENTITY_KEY,value),
        progress:phase=>{if(current()){summary(phase);view.progress(root,phase);}},stored:receipt=>{owner.receipt=receipt;}});
    const finish=async receipt=>{
        owner.receipt=receipt;if(!current())return;
        onStored(owner.session.local);summary('stored');view.stored(root,receipt,owner.session.local);
        if(!owner.session.local&&current())await publishStored(receipt.didKey);
    };
    const generate=async()=>{
        if(!current()||owner.pending||owner.receipt)return;
        if(_didGenerationLocks.has(lock)||didIdentityMutationBusy(owner.session,['generation'])){view.progress(root,'Another identity operation is running. Wait for it to finish.');return;}
        _didGenerationLocks.add(lock);owner.pending=true;
        try{
            view.busy(root,true);onStart();summary('preparing');view.progress(root,'preparing');
            if(owner.needsCheck){
                const receipt=await inspectDidGeneration(deps());if(!current())return;
                owner.needsCheck=false;
                if(receipt)await finish(receipt);
                else{summary('failed');view.progress(root,'No stored identity key was found. Click Retry generation to try again.');view.action(root,'Retry generation',generate);}
                return;
            }
            const receipt=await generateFirstDid(owner.session,deps());await finish(receipt);
        }catch(error){if(current()){
            if(owner.receipt){summary('stored');view.error(root,new Error('The identity key was stored, but follow-up work failed. Refresh identity to recover.'));view.action(root,'Refresh identity',()=>current()?refreshIdentity():Promise.resolve());}
            else{owner.needsCheck=owner.needsCheck||!!error.uncertain;summary(owner.needsCheck?'uncertain':'failed',error.message);view.error(root,error);view.action(root,owner.needsCheck?'Check stored identity':'Retry generation',generate);}
        }}finally{owner.pending=false;_didGenerationLocks.delete(lock);if(current())view.busy(root,false);}
    };
    return {generate};
}
