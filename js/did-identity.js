// Captured read lifetime for the existing DID panel. No publishing/migration writes.
let _didIdentityOwner=null,_didIdentitySequence=0;
function didIdentitySession(){const storeUrl=window.CList.config.flaskSiteUrl;return {storeUrl,username:window.CList.state.username,
    token:getSiteSpecificCookie(storeUrl,window.CList.keys.ACCESS_TOKEN),mode:window.CList.storage.mode,
    local:!!(window.CList.isLocalMode&&window.CList.isLocalMode())};}
function createDidIdentityRead(root,{onState}){
    if(_didIdentityOwner)Object.values(_didIdentityOwner.lanes).forEach(lane=>lane.abort?.abort());
    const owner=_didIdentityOwner={id:++_didIdentitySequence,root,session:didIdentitySession(),lanes:{identity:{id:0},accounts:{id:0}},selection:new Map(),versions:new Map(),dirty:new Set(),revision:0,selectionBusy:false};
    const current=()=>_didIdentityOwner===owner&&root.isConnected&&JSON.stringify(didIdentitySession())===JSON.stringify(owner.session);
    window.CList.state.identityDisplay={panelId:owner.id,identity:{requestId:0,phase:'idle',error:null},accounts:{requestId:0,phase:'idle',error:null}};
    const selectionSummary=()=>{if(current())window.CList.state.identitySelection={panelId:owner.id,revision:owner.revision,selected:Object.fromEntries(owner.selection)};};
    const read=async laneName=>{
        if(!current()||(laneName==='accounts'&&owner.session.local))return;
        const lane=owner.lanes[laneName];lane.abort?.abort();const requestId=++lane.id;lane.abort=new AbortController();
        const owned=()=>current()&&lane.id===requestId,view=window.CList.ui.didIdentity;
        const summary=(phase,error=null)=>{if(owned())window.CList.state.identityDisplay[laneName]={requestId,phase,error};};
        summary('loading');view.message(root,laneName,laneName==='identity'?'Checking…':'Loading…');
        try{
            if(!owner.session.token||!owner.session.username)throw new Error('Not logged in — please log in first.');
            const deps={assertCurrent(){if(!owned())throw new Error('The identity panel or login changed.');},signal:lane.abort.signal,fetch,
                getIdentityKey:()=>window.CList.storage.kv.get(window.CList.keys.DID_IDENTITY_KEY),list:()=>window.CList.storage.kv.list(),
                getKey:()=>getEncKey(owner.session.storeUrl),decrypt:decryptWithKey,derive:derivePublicKeyJwkAndDidKey};
            if(laneName==='identity'){
                const model=await readDidIdentity(owner.session,deps);if(!owned())return;
                view.status(root,model);onState(model.kind==='published'||model.kind==='local',model.kind==='unpublished'?'publish':'generate');
            }else{
                const result=await readDidPublicAccounts(deps);if(!owned())return;
                const present=new Set(result.items.map(item=>item.key));
                for(const key of owner.selection.keys())if(!present.has(key)){owner.selection.delete(key);owner.dirty.delete(key);}
                for(const item of result.items)if(!owner.dirty.has(item.key))owner.selection.set(item.key,item.public);
                owner.versions=result.versions;selectionSummary();
                view.accounts(root,result.items,result.warnings,{selection:owner.selection,busy:owner.selectionBusy,onChange:(key,value)=>{if(owned()&&!owner.selectionBusy){owner.selection.set(key,value);owner.dirty.add(key);owner.revision++;selectionSummary();}}});if(result.warnings.length)console.error('[Identity accounts]',result.warnings);
            }
            summary('ready');
        }catch(error){if(owned()){console.error('[Identity '+laneName+']',error);summary('failed',error.message);view.message(root,laneName,error.message,true);view.retry(root,laneName,()=>owned()?read(laneName):Promise.resolve());}}
    };
    return {isCurrent:current,
        selection(){if(!current()||window.CList.state.identityDisplay.accounts.phase!=='ready')throw new Error('Wait for the account list to finish loading, or refresh it.');return {panelId:owner.id,revision:owner.revision,items:[...owner.selection].map(([key,publicValue])=>({key,public:publicValue,sourceValue:owner.versions.get(key)}))};},
        selectionBusy(busy){if(current()){owner.selectionBusy=busy;root.querySelector('#account-list')?.querySelectorAll('input').forEach(input=>input.disabled=busy);}},
        acceptSelection(snapshot,entries){if(!current()||snapshot.panelId!==owner.id)return;for(const entry of entries){const version=owner.versions.get(entry.key);if(entry.saved&&(version===entry.originalValue||version===entry.newValue))owner.versions.set(entry.key,entry.newValue);}if(snapshot.revision===owner.revision&&entries.every(entry=>entry.saved))owner.dirty.clear();selectionSummary();},cancelIdentity(){const lane=owner.lanes.identity;lane.id++;lane.abort?.abort();if(current())window.CList.state.identityDisplay.identity={requestId:lane.id,phase:'idle',error:null};},identity:()=>read('identity'),accounts:()=>read('accounts'),start:()=>Promise.resolve().then(()=>Promise.all([read('identity'),read('accounts')])).catch(error=>{if(current()){console.error('[Identity display]',error);window.CList.ui.didIdentity.message(root,'identity',error.message,true);}})};
}

// Migrated identity operations coordinate mutations without exposing session keys.
const _didIdentityMutationChecks=new Map();
function registerDidIdentityMutation(kind,check){_didIdentityMutationChecks.set(kind,check);}
function didIdentityMutationBusy(session,except=[]){const key=JSON.stringify(session);return [..._didIdentityMutationChecks].some(([kind,check])=>!except.includes(kind)&&check(key));}

let _didLegacyMutationPending=0;
registerDidIdentityMutation('legacy',()=>_didLegacyMutationPending>0);
async function runDidLegacyMutation(action){
    _didLegacyMutationPending++;
    try{return await action();}catch(error){console.error('[Identity action]',error);showStatusMessage('The identity action failed. Check its results before retrying.');}
    finally{_didLegacyMutationPending--;}
}
