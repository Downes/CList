/// <reference path="./clist-types.js" />
// Tag controller. Sessions/keys and pending work remain transient, outside UI state.
let _writeTagsSession = null;
let _writeTagsList = null;
let _writeTagsCreation = null;
let _writeTagsBlur = null;
function cancelWriteTagsBlur(){if(_writeTagsBlur!==null){clearTimeout(_writeTagsBlur);_writeTagsBlur=null;}}
function writeTagsState() { return window.CList.state.writeTags ||= createWriteTagsState(); }
function writeTagsSession() {
    const storeUrl=window.CList.config.flaskSiteUrl;
    return {storeUrl,username:window.CList.state.username,
        token:getSiteSpecificCookie(storeUrl,window.CList.keys.ACCESS_TOKEN),
        local:!!window.CList.isLocalMode?.()};
}
function sameWriteTagsSession(a,b) { return !!a && Object.keys(b).every(key=>a[key]===b[key]); }
function syncWriteTagsSession() {
    const session=writeTagsSession();
    if (!sameWriteTagsSession(_writeTagsSession,session)) {
        _writeTagsSession=session; _writeTagsList=null;
        const state=writeTagsState();
        window.CList.state.writeTags={...state,collections:null,loading:false,dropdown:false,offer:null,
            version:state.version+1,requestId:state.requestId+1,error:null,creation:null};
    }
    return session;
}
function writeTagsContext() { return {version:writeTagsState().version,session:_writeTagsSession}; }
function writeTagsContextCurrent(context) {
    // Tags are global editor content. Do not reject typing in the still-visible
    // field while another editor is mounting; replaced controls expire by version.
    return context.version===writeTagsState().version
        && sameWriteTagsSession(context.session,writeTagsSession());
}
function currentWriteTagsInput(context,value){
    if(context.version!==writeTagsState().version)return null;
    if(writeTagsContextCurrent(context))return context;
    // A token can expire while this input remains focused. Rebind its live text
    // to the new session, without accepting cached suggestions or old Yes clicks.
    syncWriteTagsSession();const state=writeTagsState();
    window.CList.state.writeTags={...state,query:value,dropdown:!!value.trim()};renderWriteTags();
    return writeTagsContext();
}
function renderWriteTags() {
    const state=writeTagsState(),context=writeTagsContext();
    cancelWriteTagsBlur();
    window.CList.ui.tags.closeDropdown(); window.CList.ui.tags.clearOffer();
    window.CList.ui.tags.mount({selected:[...state.selected],query:state.query},{
        focus:()=>focusWriteTags(context),
        input:value=>{const current=currentWriteTagsInput(context,value);if(current){cancelWriteTagsBlur();
            window.CList.state.writeTags={...writeTagsState(),query:value,dropdown:!!value.trim()};renderWriteTagsDropdown(current);
        }},
        key:(key,value)=>{
            const current=currentWriteTagsInput(context,value);if(!current)return false;
            if(key==='Enter'||key===','){addSelectedWriteTag(value.trim().replace(/,$/,''),current);return true;}
            if(key==='Backspace'&&!value&&writeTagsState().selected.length){removeSelectedWriteTag(writeTagsState().selected.at(-1),current);return true;}
            return false;
        },
        remove:name=>removeSelectedWriteTag(name,context),
        blur:()=>{if(!writeTagsContextCurrent(context))return;cancelWriteTagsBlur();_writeTagsBlur=setTimeout(()=>{_writeTagsBlur=null;if(writeTagsContextCurrent(context)){
            window.CList.state.writeTags={...writeTagsState(),dropdown:false};window.CList.ui.tags.closeDropdown();
        }},150);},
    });
    if(state.offer) window.CList.ui.tags.offer(state.offer,()=>confirmWriteTagCollection(state.offer,context),()=>{
        if(writeTagsContextCurrent(context)){window.CList.state.writeTags={...writeTagsState(),offer:null};window.CList.ui.tags.clearOffer();}
    },state.creating);
}
function focusCurrentWriteTags() {
    const context=writeTagsContext();
    requestAnimationFrame(()=>{if(writeTagsContextCurrent(context))window.CList.ui.tags.focus();});
}
window.getWriteTags=()=>[...writeTagsState().selected];
window.refreshWriteTags=function(){
    try{
        syncWriteTagsSession(); const state=writeTagsState();
        // Tags and an unfinished input were global before this refactor. Rebind
        // controls to the new editor/load without silently discarding that draft.
        window.CList.state.writeTags={...state,dropdown:false,version:state.version+1};renderWriteTags();
    }catch(error){window.CList.ui.tags.error(error);}
};
window.clearWriteTags=function(){
    syncWriteTagsSession();const state=writeTagsState();
    window.CList.state.writeTags={...state,selected:[],query:'',dropdown:false,offer:null,version:state.version+1};renderWriteTags();
};
function addSelectedWriteTag(name,context){
    if(!writeTagsContextCurrent(context))return;
    const state=addWriteTag(writeTagsState(),name);if(state===writeTagsState())return;
    window.CList.state.writeTags={...state,offer:context.session.token&&unknownWriteTag(state,name)?name:null};
    renderWriteTags();focusCurrentWriteTags();
}
function removeSelectedWriteTag(name,context){
    context=currentWriteTagsInput(context,writeTagsState().query);if(!context)return;
    window.CList.state.writeTags={...removeWriteTag(writeTagsState(),name),query:'',dropdown:false,offer:null};
    renderWriteTags();focusCurrentWriteTags();
}
function renderWriteTagsDropdown(context){
    if(!writeTagsContextCurrent(context))return;
    const state=writeTagsState();
    if(!state.dropdown){window.CList.ui.tags.closeDropdown();return;}
    const query=state.query;
    window.CList.ui.tags.dropdown(suggestedWriteTags(state),name=>{
        if(writeTagsContextCurrent(context)&&writeTagsState().dropdown&&writeTagsState().query===query
            &&suggestedWriteTags(writeTagsState()).includes(name))addSelectedWriteTag(name,context);
    });
}
async function focusWriteTags(context){
    if(context.version!==writeTagsState().version)return;
    cancelWriteTagsBlur();
    if(!writeTagsContextCurrent(context)){window.refreshWriteTags();focusCurrentWriteTags();return;}
    const state=writeTagsState();
    if(state.collections!==null)return;
    if(!context.session.token){window.CList.state.writeTags={...state,collections:[]};return;}
    if(!_writeTagsList){
        const requestId=state.requestId+1,session=context.session,kv=window.CList.storage.kv;
        window.CList.state.writeTags={...state,requestId,loading:true,error:null};
        const request=_writeTagsList={requestId,session,promise:null};
        request.promise=(async()=>{
            try{
                const names=await listWriteTagCollections(kv);
                if(_writeTagsList===request&&sameWriteTagsSession(session,writeTagsSession()))
                    window.CList.state.writeTags={...writeTagsState(),collections:names,error:null};
            }catch(error){
                if(_writeTagsList===request&&sameWriteTagsSession(session,writeTagsSession())){
                    window.CList.state.writeTags={...writeTagsState(),error:error?.message||String(error)};window.CList.ui.tags.error(error);
                }
            }finally{
                if(_writeTagsList===request){_writeTagsList=null;window.CList.state.writeTags={...writeTagsState(),loading:false};}
            }
        })();
        // Synchronous dependency throws still settle through the same caught promise.
        await request.promise;
    }else await _writeTagsList.promise;
    if(writeTagsContextCurrent(context))renderWriteTagsDropdown(context);
}
async function confirmWriteTagCollection(name,context){
    if(!writeTagsContextCurrent(context)||writeTagsState().offer!==name||!writeTagsState().selected.includes(name)||_writeTagsCreation)return;
    const creation=_writeTagsCreation={name,session:context.session};
    window.CList.state.writeTags={...writeTagsState(),creating:true,offer:null,creation:{name,status:'pending',error:null}};
    window.CList.ui.tags.clearOffer();
    const kv=window.CList.storage.kv;
    try{
        const result=await createWriteTagCollection(name,{
            assertSession:()=>{if(!sameWriteTagsSession(context.session,writeTagsSession()))throw new Error('The account or storage session changed.');},
            getKey:()=>getEncKey(context.session.storeUrl),encrypt:encryptWithKey,add:(key,value)=>kv.add(key,value),
        });
        if(sameWriteTagsSession(context.session,writeTagsSession())){
            const state=writeTagsState();
            window.CList.state.writeTags={...state,collections:state.collections===null?null:[...new Set([...state.collections,name])],creation:{...result,error:null}};
            if(writeTagsContextCurrent(context))showStatusMessage(result.status==='created'?`Created collection "${name}".`:`Collection "${name}" already exists.`);
        }
    }catch(error){
        if(sameWriteTagsSession(context.session,writeTagsSession())){
            window.CList.state.writeTags={...writeTagsState(),creation:{name,status:'failed',error:error?.message||String(error)}};window.CList.ui.tags.error(error);
        }else window.CList.ui.tags.staleError(error);
    }finally{
        if(_writeTagsCreation===creation){_writeTagsCreation=null;window.CList.state.writeTags={...writeTagsState(),creating:false};window.CList.ui.tags.creationBusy(false);}
    }
}
if(window.CList.startup)window.CList.startup.afterFeatures(()=>window.refreshWriteTags());
else if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>window.refreshWriteTags());
else window.refreshWriteTags();
