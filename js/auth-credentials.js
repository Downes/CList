// Captured auth target and registration receipts. Post-login account setup remains separate.
const _authRegistrationReceipts = new Map();
/** @returns {CListAuthCredentialTarget} */
function captureAuthCredentialTarget() {
    const serverUrl=window.CList.config.flaskSiteUrl, local=!!window.CList.isLocalMode(), keys={...window.CList.keys};
    if(local&&(!window.CList._localKvStore?.registerUser||!window.CList._localKvStore?.loginUser))throw new Error('Local account storage is unavailable.');
    const sourceToken=getSiteSpecificCookie(serverUrl,keys.ACCESS_TOKEN);
    const snapshot=()=>{
        const username=getSiteSpecificCookie(serverUrl,keys.USERNAME);
        return JSON.stringify([getSiteSpecificCookie(serverUrl,keys.ACCESS_TOKEN),username,getSiteSpecificCookie(serverUrl,keys.TOKEN_EXPIRES),username?sessionStorage.getItem(serverUrl+'_'+username+'_encKey'):null]);
    };
    return {serverUrl,local,keys,epoch:window.CList.state.authEpoch||0,sourceToken,source:snapshot(),snapshot,adapter:window.CList._localKvStore};
}
function authCredentialDependencies(target, owner = ()=>true, registered = ()=>{}) {
    const adapter=target.adapter;
    return {
        assertCurrent(){
            if (!owner() || (window.CList.state.authEpoch||0)!==target.epoch || window.CList.config.flaskSiteUrl!==target.serverUrl || !!window.CList.isLocalMode()!==target.local ||
                (target.local && window.CList._localKvStore!==adapter) || target.snapshot()!==target.source)
                throw new Error('The login panel, server or source session changed. Reopen Login or Register.');
        },
        deriveHash:(...args)=>deriveAuthHash(...args), deriveKey:(...args)=>deriveEncKey(...args), fetch:(...args)=>fetch(...args), now:()=>Date.now(), registered,
        localRegister:(...args)=>adapter.registerUser(...args), localLogin:(...args)=>adapter.loginUser(...args), keys:target.keys,
        exportKey:async key=>{const raw=await window.crypto.subtle.exportKey('raw',key);return btoa(String.fromCharCode(...new Uint8Array(raw)));},
        getKey:name=>sessionStorage.getItem(name),setKey:(name,value)=>sessionStorage.setItem(name,value),removeKey:name=>sessionStorage.removeItem(name),
        getCookie:(...args)=>getSiteSpecificCookie(...args),setCookie:(...args)=>setSiteSpecificCookie(...args),deleteCookie:(...args)=>deleteSiteSpecificCookie(...args)
    };
}
function authRegistrationKey(target, username) { return JSON.stringify([target.serverUrl,target.local,username,target.sourceToken]); }
async function authenticateAuthAttempt(attempt, panel, retryRegistration = false) {
    const target=captureAuthCredentialTarget(), key=authRegistrationKey(target,attempt.input.username);
    const registered=status=>{_authRegistrationReceipts.set(key,status);panel.registration(attempt,status);};
    const deps=authCredentialDependencies(target,()=>panel.owns(attempt),registered);
    if (target.serverUrl!==attempt.serverUrl) throw new Error('The account server changed. Reopen Login or Register.');
    if (retryRegistration) {
        if (!['uncertain','rejected'].includes(_authRegistrationReceipts.get(key))) throw new Error('Registration retry is no longer available for this account. Submit normally.');
        _authRegistrationReceipts.delete(key);
    }
    const prepared=await prepareAuthCredentials(attempt.input,deps);
    if (attempt.input.mode==='register') {
        const receipt=_authRegistrationReceipts.get(key);
        if (!receipt) await registerAuthCredentials(target,prepared,deps);
        else panel.registration(attempt,receipt);
    }
    const verified=await verifyAuthCredentials(target,prepared,deps);
    return installAuthSession(target,verified,prepared.encKey,deps);
}
// Existing callers retain the two-argument Promise contracts. Data errors propagate to callers.
async function KVloginWithCredentials(username, password) {
    const target=captureAuthCredentialTarget(), deps=authCredentialDependencies(target);
    const prepared=await prepareAuthCredentials({username,password},deps);
    const verified=await verifyAuthCredentials(target,prepared,deps);
    return installAuthSession(target,verified,prepared.encKey,deps);
}
async function KVregisterWithCredentials(username, password) {
    const target=captureAuthCredentialTarget(), key=authRegistrationKey(target,username.trim().toLowerCase());
    const receipt=_authRegistrationReceipts.get(key);
    if (receipt==='created') return;
    if (receipt) throw new Error('Registration already attempted. Log in to check the account before explicitly retrying registration.');
    const deps=authCredentialDependencies(target,()=>true,status=>_authRegistrationReceipts.set(key,status));
    const prepared=await prepareAuthCredentials({username,password},deps,false);
    const latest=_authRegistrationReceipts.get(key);
    if(latest==='created')return;
    if(latest)throw new Error('Registration is already pending or unconfirmed. Log in to check before retrying.');
    await registerAuthCredentials(target,prepared,deps);
}
