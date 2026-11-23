// Session-scoped pending plans survive panel rebuilds, never enter persisted/shared state.
let _didRotationOwner=null,_didRotationSequence=0;
const _didRotationPlans=new Map(),_didRotationLocks=new Set();
registerDidIdentityMutation('rotation',key=>_didRotationLocks.has(key));
function createDidKeyRotator(root,{onStart,onComplete,refreshAccounts,refreshIdentity}){
    const session=didIdentitySession(),lock=JSON.stringify(session),owner=_didRotationOwner={id:++_didRotationSequence,session,epoch:0,op:_didRotationPlans.get(lock)||null};
    const current=()=>_didRotationOwner===owner&&root.isConnected&&JSON.stringify(didIdentitySession())===lock,view=window.CList.ui.didRotation;
    const summary=(phase,error=null)=>{if(current())window.CList.state.identityRotation={panelId:owner.id,phase,error};};
    const deps=op=>({assertCurrent(){if(!current()||owner.op!==op)throw new Error('The rotation panel or login changed.');},fetch,
        getIdentityKey:()=>window.CList.storage.kv.get(window.CList.keys.DID_IDENTITY_KEY),getKey:()=>getEncKey(session.storeUrl),generate:generateIdentityKeyPair,encrypt:encryptIdentityPrivateKey,
        update:value=>window.CList.storage.kv.update(window.CList.keys.DID_IDENTITY_KEY,value),
        progress:phase=>{if(current()){summary(phase);view.progress(root,phase);}},prepared:value=>{op.prepared=value;_didRotationPlans.set(lock,op);},stored:()=>{op.stored=true;},
        sending:()=>{if(current()){summary('publishing');view.progress(root,'publishing');}},accepted:receipt=>{op.published=receipt;},
        publish:payload=>sendDidPublication(session,payload,deps(op))});
    const finish=async op=>{
        if(!current())return;op.complete=true;_didRotationPlans.delete(lock);owner.epoch++;summary('complete');onComplete();const warnings=op.published?.warning?[op.published.warning]:[];
        view.result(root,op.prepared,session.local,warnings);if(session.local)return;
        try{await refreshAccounts();if(current()&&window.CList.state.identityDisplay?.accounts.phase==='failed')warnings.push('Rotation succeeded; account refresh failed. Use its Retry control.');}catch(error){console.error('[Rotation account refresh]',error);warnings.push('Rotation succeeded; account refresh failed.');}
        if(!current())return;try{if(typeof refreshCollabRegistrations==='function'&&(await refreshCollabRegistrations())?.length)warnings.push('Rotation succeeded; some collaboration registrations could not be refreshed.');}catch(error){console.error('[Rotation collaboration refresh]',error);warnings.push('Rotation succeeded; collaboration refresh failed.');}
        if(current())view.result(root,op.prepared,session.local,warnings);
    };
    const recover=()=>{if(!current())return;_didRotationPlans.delete(lock);owner.op=null;owner.epoch++;return refreshIdentity();};
    const work=async(op,kind)=>{
        if(!current()||owner.op!==op||op.pending||op.complete||_didRotationLocks.has(lock)||didIdentityMutationBusy(session,['rotation']))return;
        op.pending=true;_didRotationLocks.add(lock);
        try{
            view.busy(root,true);onStart();
            if(kind==='store-check'){
                const row=await deps(op).getIdentityKey();deps(op).assertCurrent();
                if(row?.value===op.prepared.storedValue){op.stored=true;op.storeUnknown=false;if(session.local)await finish(op);else{summary('stored');view.message(root,'The replacement key is stored. Continue publication without regenerating.');view.action(root,'Continue publication',()=>work(op,'publish'));}}
                else if(row?.value===op.snapshot.storedValue){_didRotationPlans.delete(lock);owner.op=null;summary('failed');view.message(root,'The original key is still stored. Regenerate again to request fresh confirmation.');view.action(root,'Retry regeneration',()=>request(owner.epoch));}
                else throw new Error('The stored key changed. Refresh identity before continuing.');
                return;
            }
            if(kind==='publication-check'){
                const checked=await inspectRotatedDid(op.snapshot,op.prepared,session,deps(op));if(checked.confirmed){op.published={didKey:op.prepared.didKey,existing:true};await finish(op);}else{summary('stored');view.message(root,'The replacement key is stored but not published. Continue publication without regenerating.');view.action(root,'Continue publication',()=>work(op,'publish'));}return;
            }
            if(kind==='rotate')await storeRotatedDid(op.snapshot,session,deps(op));
            if(!current())return;
            if(session.local){await finish(op);return;}
            op.published=await publishRotatedDid(op.snapshot,op.prepared,session,deps(op));await finish(op);
        }catch(error){if(current()){
            view.error(root,error);
            if(op.published||(session.local&&op.stored)){summary('complete');view.action(root,'Refresh identity',recover);}
            else if(error.conflict){summary(op.stored?'stored':'failed',error.message);view.action(root,'Refresh identity',recover);}
            else if(op.stored){summary('stored',error.message);view.action(root,'Check publication',()=>work(op,'publication-check'));}
            else if(op.prepared&&error.storageUnknown){op.storeUnknown=true;summary('uncertain-storage',error.message);view.action(root,'Check stored key',()=>work(op,'store-check'));}
            else{summary('failed',error.message);view.action(root,'Refresh identity',recover);}
        }}finally{op.pending=false;_didRotationLocks.delete(lock);if(current())view.busy(root,false);}
    };
    const request=async epoch=>{
        if(!current()||epoch!==owner.epoch||owner.op?.pending||owner.op?.confirmation?.isOpen())return;
        const previous=owner.op;
        if(previous&&!previous.complete&&previous.prepared){if(previous.published)return work(previous,'publication-check');return work(previous,previous.stored?'publication-check':'store-check');}
        if(_didRotationLocks.has(lock)||didIdentityMutationBusy(session,['rotation'])){view.message(root,'Another identity operation is running. Wait for it to finish.');return;}
        const op=owner.op={pending:true};_didRotationLocks.add(lock);summary('preparing');
        try{
            view.busy(root,true);onStart();op.snapshot=await prepareDidRotation(session,deps(op));if(!current())return;summary('confirming');
            op.confirmation=confirmWithPassword('Regenerating your identity key will permanently replace your current DID. Anyone relying on your old key (e.g. “Prove Same Identity” links) will no longer be able to verify you. This cannot be undone.',()=>work(op,'rotate'),{
                isCurrent:()=>current()&&owner.op===op,onCancel:()=>{if(current()&&owner.op===op){owner.op=null;summary('idle');view.message(root,'Key regeneration cancelled.');}}
            });
        }catch(error){if(current()){summary('failed',error.message);view.error(root,error);view.action(root,'Refresh identity',recover);}}
        finally{op.pending=false;_didRotationLocks.delete(lock);if(current())view.busy(root,false);}
    };
    return {action:()=>{const epoch=owner.epoch;return ()=>request(epoch);}};
}

function clearDidRotationPlan(session){_didRotationPlans.delete(JSON.stringify(session));}
