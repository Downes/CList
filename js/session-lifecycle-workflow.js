// Explicit session reads/logout cleanup. No DOM, navigation or account seeding.
function sessionExpiryValid(expires,now) { const value=Date.parse(expires);return Number.isFinite(value)&&value>now; }
/** @param {Object} deps @returns {CListSessionSnapshot} */
function sessionSnapshot(deps) {
    const serverUrl=deps.server(),username=deps.cookie(serverUrl,deps.keys.USERNAME);
    return {serverUrl,local:deps.local(),epoch:deps.epoch(),username,
        token:deps.cookie(serverUrl,deps.keys.ACCESS_TOKEN),expires:deps.cookie(serverUrl,deps.keys.TOKEN_EXPIRES),
        key:username?deps.get(serverUrl+'_'+username+'_encKey'):null};
}
function sessionSnapshotValid(snapshot,now) {
    return !!(snapshot.token&&snapshot.username&&snapshot.username!=='none'&&snapshot.key&&sessionExpiryValid(snapshot.expires,now));
}
/** @param {CListSessionSnapshot} snapshot @param {Object} deps @returns {Promise<CListAccountRecord[]>} */
async function readRestoredAccounts(snapshot,deps) {
    deps.assertCurrent();const encKey=await deps.getKey(snapshot.serverUrl);deps.assertCurrent();
    if(!encKey)throw new Error('The session encryption key is unavailable. Please log in again.');
    deps.validated();
    const accounts=await deps.load({storeUrl:snapshot.serverUrl,token:snapshot.token,encKey,isCurrent:deps.current});deps.assertCurrent();
    if(accounts.length&&accounts.every(account=>deps.parse(account)?.type==='bad'))throw new Error('Saved accounts could not be decrypted. Please check the session key.');
    return accounts;
}
/** @param {CListSessionSnapshot} snapshot @param {Object} deps */
function clearCapturedSession(snapshot,deps) {
    const warnings=[];let tokenCleared=false;
    const sameTarget=()=>{if(deps.server()!==snapshot.serverUrl||deps.local()!==snapshot.local||deps.epoch()!==snapshot.epoch||(tokenCleared&&deps.cookie(snapshot.serverUrl,deps.keys.ACCESS_TOKEN)))throw new Error('The account session changed. Logout stopped.');};
    const removeCookie=(key,expected)=>{
        sameTarget();if(deps.cookie(snapshot.serverUrl,key)!==expected)throw new Error('The account session changed. Logout stopped.');
        deps.deleteCookie(snapshot.serverUrl,key);
        if(deps.cookie(snapshot.serverUrl,key))throw new Error('The browser did not remove the session cookie.');
    };
    // Do not erase keys/drafts or claim logout while the login token remains active.
    removeCookie(deps.keys.ACCESS_TOKEN,snapshot.token);
    tokenCleared=true;
    for(const [key,value] of [[deps.keys.USERNAME,snapshot.username],[deps.keys.TOKEN_EXPIRES,snapshot.expires]]){
        try{removeCookie(key,value);}catch(error){warnings.push(error.message);}
    }
    const remove=(key,expected)=>{
        try{sameTarget();if(expected!==undefined&&deps.get(key)!==expected)throw new Error('A newer session key was preserved.');deps.remove(key);if(deps.get(key)!==null)throw new Error('Some browser session data could not be removed.');}
        catch(error){warnings.push(error.message);}
    };
    if(snapshot.username)remove(snapshot.serverUrl+'_'+snapshot.username+'_encKey',snapshot.key);
    remove(snapshot.serverUrl+'_encKey');
    try{for(const key of deps.listKeys().filter(key=>key.startsWith(deps.keys.EDITOR_DRAFT_PREFIX)))remove(key);}
    catch(error){warnings.push(error.message);}
    sameTarget();
    const message='You have been logged out.'+(warnings.length?' Some browser session data could not be cleared.':'');
    try{deps.set(deps.keys.LOGOUT_MESSAGE,message);}catch(error){warnings.push('The logout notice could not be saved.');}
    return {warnings,message};
}
