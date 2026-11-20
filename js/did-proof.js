// Proof controller: transient target/session/crypto lifetime, safe phase summaries.
let _didProofOwner=null,_didProofPanelId=0;
function bindDidIdentityProof(root){
    _didProofOwner?.abort?.abort();
    const owner=_didProofOwner={id:++_didProofPanelId,root,session:didIdentitySession(),requestId:0,pending:false,abort:null};
    const current=()=>_didProofOwner===owner&&root.isConnected&&JSON.stringify(didIdentitySession())===JSON.stringify(owner.session);
    const view=window.CList.ui.didProof;
    const summary=(phase,error=null)=>{if(current())window.CList.state.identityProof={panelId:owner.id,requestId:owner.requestId,phase,error};};
    const edit=()=>{if(!current())return;owner.abort?.abort();owner.requestId++;owner.pending=false;summary('idle');view.busy(root,false);view.progress(root,'idle');};
    const prove=async()=>{
        if(!current()||owner.pending)return;
        const requestId=++owner.requestId;owner.abort=new AbortController();owner.pending=true;
        const owned=()=>current()&&requestId===owner.requestId;
        view.busy(root,true);
        try{
            const values=view.values(root),target=didProofTarget(values.server,values.username);
            if(!owner.session.token||!owner.session.username)throw new Error('Not logged in — please log in first.');
            const result=await runDidIdentityProof(target,{signal:owner.abort.signal,fetch,
                assertCurrent(){if(!owned())throw new Error('The proof inputs, panel or login changed.');},
                progress:phase=>{if(owned()){summary(phase);view.progress(root,phase);}},
                getKey:()=>getEncKey(owner.session.storeUrl),getIdentityKey:()=>window.CList.storage.kv.get(window.CList.keys.DID_IDENTITY_KEY),
                decrypt:decryptIdentityPrivateKey,sign:signWithIdentityKey,verify:verifyIdentitySignature,
                challenge:()=>`CList identity proof — ${new Date().toISOString()}`});
            if(owned()){summary('complete');view.result(root,result);}
        }catch(error){if(owned()){summary('failed',error.message);view.error(root,error);}}
        finally{if(owned()){owner.pending=false;view.busy(root,false);}}
    };
    view.bind(root,prove,edit);summary('idle');return {invalidate:edit};
}
