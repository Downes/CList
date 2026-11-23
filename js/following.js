// Following panel controller; credentials and live nodes stay in transient captures.
let _followingOwner=null, _followingPanelId=0;
function followingSession() {
    const storeUrl=window.CList.config.flaskSiteUrl;
    return {storeUrl,token:getSiteSpecificCookie(storeUrl,window.CList.keys.ACCESS_TOKEN),
        username:window.CList.state.username,mode:window.CList.storage.mode};
}
function followingOwnerCurrent(owner) {
    return _followingOwner===owner&&owner.panel.root.isConnected&&JSON.stringify(followingSession())===JSON.stringify(owner.session);
}
function followingDependencies(owner,guard=()=>followingOwnerCurrent(owner)) {
    return {assertCurrent(){if(!guard())throw new Error('The Following panel or login changed. Reopen it to continue.');},
        list:()=>window.CList.storage.kv.list(),getKey:()=>getEncKey(owner.session.storeUrl),decrypt:decryptWithKey,
        remove:key=>window.CList.storage.kv.remove(key)};
}
function followingSummary(owner,phase,error=null) {
    if(_followingOwner===owner)window.CList.state.following={panelId:owner.id,requestId:owner.generation,phase,error,pendingCount:owner.pending.size};
}
function kvstoreFollowingPanel() {
    const view=window.CList.ui.following;
    const owner={id:++_followingPanelId,session:followingSession(),generation:0,pending:new Set(),rows:new Map()};
    owner.panel=view.mount(()=>{if(followingOwnerCurrent(owner))history.back();},()=>loadFollowingPanel(owner));
    _followingOwner=owner;followingSummary(owner,'idle');
    window._clistRefreshFollowingPanel=()=>followingOwnerCurrent(owner)?loadFollowingPanel(owner):Promise.resolve();
    // The caller mounts the returned panel synchronously before this first load.
    Promise.resolve().then(()=>loadFollowingPanel(owner)).catch(error=>{if(followingOwnerCurrent(owner))view.error(owner.panel,error);});
    return owner.panel.root;
}
async function loadFollowingPanel(owner) {
    if(!followingOwnerCurrent(owner))return;
    const generation=++owner.generation,current=()=>followingOwnerCurrent(owner)&&owner.generation===generation,view=window.CList.ui.following;
    followingSummary(owner,'loading');view.loading(owner.panel,true);view.message(owner.panel,'Loading…');
    try{
        if(!owner.session.token||!owner.session.username)throw new Error('Not logged in — please log in first.');
        const result=await readFollowingEntries(followingDependencies(owner,current));if(!current())return;
        const domain=owner.session.storeUrl.replace(/^https?:\/\//,'');
        owner.rows=view.rows(owner.panel,result.items,domain,(item,handle)=>unfollowFromPanel(owner,generation,item,handle),owner.pending);
        view.message(owner.panel,result.warnings.join(' ')||(!result.items.length?'Not following anyone yet.':''),!!result.warnings.length);
        if(result.warnings.length)console.error('[Following] unreadable records',result.warnings);
        followingSummary(owner,'ready');
    }catch(error){if(current()){followingSummary(owner,'failed',error.message);view.error(owner.panel,error);}}
    finally{if(current())view.loading(owner.panel,false);}
}
async function unfollowFromPanel(owner,generation,item,handle) {
    const rowCurrent=()=>followingOwnerCurrent(owner)&&generation===owner.generation&&owner.rows.get(item.key)===handle&&handle.row.isConnected;
    if(!rowCurrent()||owner.pending.has(item.key))return;
    owner.pending.add(item.key);followingSummary(owner,'ready');const view=window.CList.ui.following;view.busy(handle,true);
    try{
        await removeFollowingEntry(item.key,followingDependencies(owner,rowCurrent));
        if(JSON.stringify(followingSession())===JSON.stringify(owner.session)&&typeof _clistAnnotateInvalidateFollowCache==='function')_clistAnnotateInvalidateFollowCache();
        if(rowCurrent()){owner.rows.delete(item.key);view.removed(owner.panel,handle);}
        else if(followingOwnerCurrent(owner))await loadFollowingPanel(owner);
    }catch(error){if(followingOwnerCurrent(owner)){followingSummary(owner,'failed',error.message);view.error(owner.panel,error);}}
    finally{
        owner.pending.delete(item.key);
        if(followingOwnerCurrent(owner)){const latest=owner.rows.get(item.key);if(latest)view.busy(latest,false);followingSummary(owner,window.CList.state.following.phase,window.CList.state.following.error);}
    }
}
