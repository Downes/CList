// Removal plans/receipts are transient and scoped to the original login.
let _didRemovalOwner=null,_didRemovalSequence=0;
const _didRemovalPlans=new Map(),_didRemovalLocks=new Set();
registerDidIdentityMutation('removal',key=>_didRemovalLocks.has(key));
function createDidRemover(root,{onStart,onComplete,refreshIdentity}){
    const session=didIdentitySession(),lock=JSON.stringify(session),owner=_didRemovalOwner={id:++_didRemovalSequence,op:_didRemovalPlans.get(lock)||null};
    const current=()=>_didRemovalOwner===owner&&root.isConnected&&JSON.stringify(didIdentitySession())===lock,view=window.CList.ui.didRemoval;
    const summary=(phase,error=null)=>{if(current())window.CList.state.identityRemoval={panelId:owner.id,phase,error};};
    const deps=op=>({assertCurrent(){if(!current()||owner.op!==op)throw new Error('The removal panel or login changed.');},fetch,
        getIdentityKey:()=>window.CList.storage.kv.get(window.CList.keys.DID_IDENTITY_KEY),removeKey:()=>window.CList.storage.kv.remove(window.CList.keys.DID_IDENTITY_KEY),
        checked:result=>{op.plan.keyRemoved=op.plan.keyRemoved||result.keyRemoved;op.plan.documentRemoved=op.plan.documentRemoved||result.documentRemoved;},
        keyRemoved:()=>{op.plan.keyRemoved=true;},documentRemoved:()=>{op.plan.documentRemoved=true;},
        progress:phase=>{if(current()){summary(phase);view.progress(root,phase);}}});
    const finish=op=>{op.complete=true;_didRemovalPlans.delete(lock);if(typeof clearDidRotationPlan==='function')clearDidRotationPlan(session);if(current()){summary('complete');view.result(root,session.local);onComplete();}};
    const recover=()=>{if(!current())return;_didRemovalPlans.delete(lock);owner.op=null;return refreshIdentity();};
    const work=async(op,checkOnly)=>{
        if(!current()||owner.op!==op||op.pending||op.complete)return;
        if(didIdentityMutationBusy(session)){view.message(root,'Another identity operation is running. Wait for it to finish.');return;}
        op.pending=true;_didRemovalLocks.add(lock);
        try{
            onStart();view.busy(root,true);let errors=[];
            if(checkOnly){const result=await checkDidRemoval(op.plan,session,deps(op));deps(op).checked(result);}
            else{_didRemovalPlans.set(lock,op);const result=await removeCapturedDid(op.plan,session,deps(op));errors=result.errors;if(current()&&result.errors.length)console.error('[DID removal] partial results',result.errors);}
            if(!current())return;
            if(op.plan.keyRemoved&&op.plan.documentRemoved){finish(op);return;}
            summary('partial');view.partial(root,op.plan,errors);
            view.action(root,checkOnly?'Retry remaining removal':'Check removal',()=>work(op,!checkOnly));
        }catch(error){if(current()){summary(op.complete?'complete':'failed',op.complete?'Controls refresh failed.':error.message);view.error(root,op.complete?new Error('Identity removal completed, but its controls could not be refreshed. Use Refresh identity.'):error);view.action(root,'Refresh identity',recover);}}
        finally{op.pending=false;_didRemovalLocks.delete(lock);if(current())view.busy(root,false);}
    };
    const request=async()=>{
        if(!current()||owner.op?.pending||owner.op?.complete||owner.op?.confirmation?.isOpen())return;
        if(didIdentityMutationBusy(session)){view.message(root,'Another identity operation is running. Wait for it to finish.');return;}
        if(owner.op?.confirmed)return work(owner.op,true);
        const op=owner.op={pending:true};_didRemovalLocks.add(lock);summary('preparing');
        try{
            onStart();view.busy(root,true);op.plan=await prepareDidRemoval(session,deps(op));if(!current())return;
            if(op.plan.keyRemoved&&op.plan.documentRemoved){finish(op);return;}
            summary('confirming');op.confirmation=confirmWithPassword('This will permanently remove your identity key'+(session.local?'.':' and delete your published DID document.')+' This cannot be undone.',()=>{op.confirmed=true;return work(op,false);},{isCurrent:()=>current()&&owner.op===op,onCancel:()=>{if(current()&&owner.op===op){owner.op=null;summary('idle');view.message(root,'Identity removal cancelled.');}}});
        }catch(error){if(current()){summary(op.complete?'complete':'failed',op.complete?'Controls refresh failed.':error.message);view.error(root,op.complete?new Error('Identity removal completed, but its controls could not be refreshed. Use Refresh identity.'):error);view.action(root,'Refresh identity',recover);}}
        finally{op.pending=false;_didRemovalLocks.delete(lock);if(current())view.busy(root,false);}
    };
    return {request};
}
