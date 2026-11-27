// Startup/storage-event restoration and logout share a captured request lifetime.
function createSessionLifecycle(deps,view) {
    let generation=0,loggingOut=false,lastCleared=null,startedAt=0;
    const timings={};
    const summary=(phase,error=null,stage=null)=>{const elapsedMs=Math.max(0,deps.now()-startedAt);if(stage)timings[stage]=elapsedMs;window.CList.state.sessionLifecycle={generation,phase,error,stage,elapsedMs,timings:{...timings}};window.CList.ui.startupRecovery?.update(phase,stage);};
    const snapshotCurrent=snapshot=>{try{return JSON.stringify(sessionSnapshot(deps))===JSON.stringify(snapshot);}catch{return false;}};
    const restore=async({delay=0,navigate=false}={})=>{
        if(loggingOut)return;const request=++generation;let snapshot,validated=false;
        try{
            snapshot=sessionSnapshot(deps);const current=()=>generation===request&&!loggingOut&&snapshotCurrent(snapshot);
            const assertCurrent=()=>{if(!current()||!sessionSnapshotValid(snapshot,deps.now()))throw new Error('Session restoration expired.');};
            const reader=deps.reader();startedAt=deps.now();for(const key of Object.keys(timings))delete timings[key];summary('restoring',null,'key');
            if(!sessionSnapshotValid(snapshot,deps.now())){
                view.guest();summary('guest');
                const message=deps.get(deps.keys.LOGOUT_MESSAGE);if(message){deps.remove(deps.keys.LOGOUT_MESSAGE);view.notice(message);}return;
            }
            if(delay)await deps.wait(delay);assertCurrent();
            const accounts=await readRestoredAccounts(snapshot,{...deps,current,assertCurrent,validated(){validated=true;view.authenticated();summary('restoring',null,window.CList.startup?.phase() !== 'ready' && window.CList.startup ? 'features' : 'accounts');},accountsStarting(){summary('restoring',null,'accounts');}});
            assertCurrent();view.accounts(accounts);summary('ready',null,'complete');
            if(navigate&&deps.reader()===reader){await deps.navigate();assertCurrent();}
        }catch(error){
            if(generation!==request||(snapshot&&!snapshotCurrent(snapshot)))return;
            console.error('Session restoration failed:',error);if(!validated||!sessionSnapshotValid(snapshot,deps.now()))view.guest();summary('failed',error.message);
            view.failed(error.message,()=>{if(generation===request&&(!snapshot||snapshotCurrent(snapshot)))return restore();});
        }
    };
    const logout=({preserveDrafts=false}={})=>{
        if(loggingOut||(lastCleared&&snapshotCurrent(lastCleared)))return;generation++;deps.invalidateAuth();let snapshot,cleared;
        try{
            snapshot=sessionSnapshot(deps);loggingOut=true;summary('logging-out');
            const result=clearCapturedSession(snapshot,{...deps,preserveDrafts});cleared=lastCleared=sessionSnapshot(deps);view.guest();summary('logged-out');
            if(result.warnings.length){console.error('Logout cleanup incomplete:',result.warnings);view.notice(result.message);}
            deps.reload();
        }catch(error){
            console.error('Logout failed:',error);summary('failed',error.message);
            if(cleared)view.failed('Session cleared, but the page could not reload: '+error.message,()=>{if(snapshotCurrent(cleared))return deps.reload();});
            else view.failed('Logout could not finish: '+error.message,snapshot?()=>{if(snapshotCurrent(snapshot))return logout({preserveDrafts});}:null);
        }finally{loggingOut=false;}
    };
    return {restore,logout};
}
let _sessionLifecycle=null;
function sessionLifecycle(){
    if(!_sessionLifecycle)_sessionLifecycle=createSessionLifecycle({
        keys:window.CList.keys,server:()=>window.CList.config.flaskSiteUrl,local:()=>!!window.CList.isLocalMode(),epoch:()=>window.CList.state.authEpoch||0,
        cookie:(...args)=>getSiteSpecificCookie(...args),deleteCookie:(...args)=>deleteSiteSpecificCookie(...args),
        get:key=>sessionStorage.getItem(key),set:(key,value)=>sessionStorage.setItem(key,value),remove:key=>sessionStorage.removeItem(key),listKeys:()=>Object.keys(sessionStorage),
        prepareAccounts:()=>window.CList.startup?.whenFeaturesReady(),getKey:site=>getEncKey(site),load:session=>loadAccountRecords(session),parse:account=>parseAccountValue(account),now:()=>Date.now(),wait:ms=>new Promise(resolve=>setTimeout(resolve,ms)),
        reader:()=>window.CList.state.reader?.requestId??0,navigate:()=>playRead(),reload:()=>window.location.reload(),
        invalidateAuth(){window.CList.state.authEpoch=(window.CList.state.authEpoch||0)+1;if(typeof cancelAuthForLogout==='function')cancelAuthForLogout();}
    },window.CList.ui.sessionLifecycle);
    return _sessionLifecycle;
}
function KVlogout(){return sessionLifecycle().logout();}
function hasValidSession(){try{return sessionSnapshotValid(sessionSnapshot({server:()=>window.CList.config.flaskSiteUrl,local:()=>!!window.CList.isLocalMode(),epoch:()=>window.CList.state.authEpoch||0,keys:window.CList.keys,cookie:(...args)=>getSiteSpecificCookie(...args),get:key=>sessionStorage.getItem(key)}),Date.now());}catch{return false;}}
function isTokenExpired(token){return !token||!sessionExpiryValid(getSiteSpecificCookie(window.CList.config.flaskSiteUrl,window.CList.keys.TOKEN_EXPIRES),Date.now());}
window.addEventListener('storage',event=>{
    const keys=window.CList.keys,site=window.CList.config.flaskSiteUrl;
    const localKeys=window.CList.isLocalMode()?[keys.ACCESS_TOKEN,keys.USERNAME,keys.TOKEN_EXPIRES].map(key=>key+'_'+deriveSiteIdentifier(site)):[];
    if(event.key===keys.SESSION_SIGNAL||localKeys.includes(event.key))sessionLifecycle().restore({delay:500,navigate:true}).catch(error=>{console.error('Could not restore session controls:',error);showStatusMessage('Could not restore session controls. Please reopen Login.');});
});
