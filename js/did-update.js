// Selection/account flag writes and DID publication retain independent receipts.
let _didUpdateOwner=null,_didUpdateSequence=0;
const _didUpdatePlans=new Map(),_didUpdateLocks=new Set();
registerDidIdentityMutation('update',key=>_didUpdateLocks.has(key));
function createDidAccountUpdater(root,reader){
    const session=didIdentitySession(),lock=JSON.stringify(session),owner=_didUpdateOwner={id:++_didUpdateSequence,op:_didUpdatePlans.get(lock)||null};
    const current=()=>_didUpdateOwner===owner&&root.isConnected&&JSON.stringify(didIdentitySession())===lock,view=window.CList.ui.didUpdate;
    const summary=(phase,error=null)=>{if(current())window.CList.state.identityUpdate={panelId:owner.id,phase,error};};
    const deps=op=>({assertCurrent(){if(!current()||owner.op!==op)throw new Error('The update panel or login changed.');},fetch,
        list:()=>window.CList.storage.kv.list(),get:key=>window.CList.storage.kv.get(key),getIdentityKey:()=>window.CList.storage.kv.get(window.CList.keys.DID_IDENTITY_KEY),getKey:()=>getEncKey(session.storeUrl),
        decrypt:decryptWithKey,encrypt:encryptWithKey,derive:derivePublicKeyJwkAndDidKey,catalogKey:window.CList.keys.PAGES_CATALOG,
        update:(key,value)=>window.CList.storage.kv.update(key,value),sending:()=>{if(current()){summary('publishing');view.message(root,'Publishing account choices…');}},accepted:()=>{op.plan.published=true;},publish:payload=>sendDidPublication(session,payload,deps(op))});
    const discard=async()=>{if(!current())return;_didUpdatePlans.delete(lock);owner.op=null;view.action(root,'Update DID',update);return reader.accounts();};
    const work=async(op,checkOnly)=>{
        if(!current()||owner.op!==op||op.pending||op.complete)return;
        if(didIdentityMutationBusy(session)){view.message(root,'Another identity operation is running. Wait for it to finish.');return;}
        op.pending=true;_didUpdateLocks.add(lock);
        try{
            reader.cancelIdentity();reader.selectionBusy(true);view.busy(root,true);summary(checkOnly?'checking':'saving');
            if(!op.plan){view.message(root,'Preparing captured account choices…');op.plan=await prepareDidAccountUpdate(op.snapshot,session,deps(op));_didUpdatePlans.set(lock,op);}
            if(!checkOnly){const now=reader.selection();if(now.panelId!==op.snapshot.panelId||now.revision!==op.snapshot.revision)throw new Error('Account choices changed. Refresh accounts to start a new update.');}
            if(checkOnly)await checkDidAccountUpdate(op.plan,session,deps(op));else await applyDidAccountUpdate(op.plan,session,deps(op));
            if(!current())return;reader.acceptSelection(op.plan.snapshot,op.plan.entries);view.result(root,op.plan);
            op.complete=op.plan.published&&op.plan.entries.every(entry=>entry.saved);summary(op.complete?'complete':'partial');
            if(op.complete){_didUpdatePlans.delete(lock);view.action(root,'Update DID',update);}else view.action(root,checkOnly?'Retry remaining update':'Check update',()=>work(op,!checkOnly));
        }catch(error){if(current()){
            summary(op.plan?'partial':'failed',error.message);view.error(root,error);
            if(op.plan){view.action(root,'Check update',()=>work(op,true));view.recovery(root,discard);}
            else view.action(root,'Refresh accounts',discard);
        }}finally{op.pending=false;_didUpdateLocks.delete(lock);if(current()){reader.selectionBusy(false);view.busy(root,false);}}
    };
    const update=async()=>{
        if(!current()||owner.op?.pending)return;
        if(owner.op&&!owner.op.complete&&owner.op.plan)return work(owner.op,true);
        try{const snapshot=reader.selection();const op=owner.op={snapshot,pending:false};return work(op,false);}
        catch(error){if(current()){summary('failed',error.message);view.error(root,error);}}
    };
    return {update};
}
