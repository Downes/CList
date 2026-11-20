/// <reference path="./clist-types.js" />
// Find controller. Provider/session/abort captures stay outside plain UI state.
let _findPanel=null, _findRequest=null;
function findState(){return window.CList.state.find ||= createFindState();}
function findSession(){const storeUrl=window.CList.config.flaskSiteUrl;return{storeUrl,username:window.CList.state.username,
    token:getSiteSpecificCookie(storeUrl,window.CList.keys.ACCESS_TOKEN)};}
function sameFindSession(session){const now=findSession();return Object.keys(now).every(key=>now[key]===session[key]);}
function invalidateFindPanel(){_findPanel=null;}
function invalidateFindRequest(){
    _findRequest?.abort.abort();_findRequest=null;
    if(window.CList.state.find?.status==='loading')window.CList.state.find={...findState(),status:'cancelled'};
    window.CList.ui.find.busy(false);
}
// Legacy providers can still ask for the current Find term. The state, rather
// than a live DOM input, owns that value; migrated providers receive a snapshot.
function finderString(){const query=findState().query.trim();if(!query){window.CList.ui.find.invalidQuery();return;}return query;}
function playFind(){openLeftInterface(findPanel());}
function findPanel(){
    const state=window.CList.state.find=openFindState(findState());
    const panel=_findPanel={id:state.panelId,session:findSession()};
    const current=()=>_findPanel===panel&&sameFindSession(panel.session);
    const options=Object.entries(window.CList.readers).filter(([,handler])=>typeof handler.search==='function'&&window.CList.ui.isHandlerVisible(handler))
        .map(([key,handler])=>({key,label:handler.label||key,icon:handler.icon,logoSrc:handler.logoSrc,
            select:()=>current()?selectFindProvider(panel,key):Promise.resolve()}));
    return window.CList.ui.find.mount(options,state.query,value=>{if(_findPanel===panel){
        // Editing a live input is local work even if a token just expired.
        // Rebind future explicit searches; keep already-dispatched requests captured.
        panel.session=findSession();window.CList.state.find={...findState(),query:value};
    }});
}
async function selectFindProvider(panel,key){
    if(_findPanel!==panel||!sameFindSession(panel.session))return;
    const handler=window.CList.readers[key];
    if(typeof handler?.search!=='function'||!window.CList.ui.isHandlerVisible(handler))return;
    const query=findState().query.trim();if(!query){window.CList.ui.find.invalidQuery();return;}
    if(_findRequest&&findRequestCurrent(_findRequest)&&findState().status==='loading'
        &&_findRequest.selection.key===key&&_findRequest.selection.query===query)return;
    // Reuse the reader lifetime: Find supersedes account reads, and subsequent
    // account/feed requests supersede Find. Do not introduce a second dispatcher.
    invalidateReader('find');
    const selection={key,handler,query,session:findSession(),readerId:window.CList.state.reader.requestId,target:window.CList.ui.find.target()};
    return runFindRequest(selection,context=>handler.supportsFindContext
        ?handler.search(query,context):handler.search());
}
function findRequestCurrent(request){
    const selection=request.selection;
    return _findRequest===request&&!request.abort.signal.aborted&&sameFindSession(selection.session)
        &&window.CList.state.reader.requestId===selection.readerId&&window.CList.readers[selection.key]===selection.handler
        &&window.CList.ui.find.target()===selection.target
        &&window.CList.ui.isHandlerVisible(selection.handler);
}
async function runFindRequest(selection,load){
    _findRequest?.abort.abort();
    const state=window.CList.state.find=beginFindRequest(findState(),selection.key,selection.query);
    const request=_findRequest={id:state.requestId,selection,abort:new AbortController()};
    const isCurrent=()=>findRequestCurrent(request),view=window.CList.ui.find;
    let continuationId=null;
    /** @type {CListFindContext} */
    const context={requestId:request.id,query:selection.query,signal:request.abort.signal,isCurrent,
        render:(items,options)=>isCurrent()?view.render(items,options,isCurrent):Promise.resolve(),
        empty:title=>{if(isCurrent())view.empty(title,isCurrent);},
        fail:(title,error)=>{if(isCurrent()){
            window.CList.state.find=finishFindRequest(findState(),request.id,error?.message||String(error));
            view.requestError(title,error,isCurrent);
        }},
        next:next=>{
            const retry=continuationId!==null&&_findRequest?.id===continuationId&&_findRequest.selection===selection
                &&findRequestCurrent(_findRequest)&&findState().status==='failed';
            if(!(isCurrent()&&findState().status!=='loading')&&!retry)return Promise.resolve();
            const pending=runFindRequest(selection,next);continuationId=_findRequest.id;return pending;
        },
    };
    view.busy(true,selection.key);
    try{
        await load(context);
        if(isCurrent()&&findState().status!=='failed')window.CList.state.find=finishFindRequest(findState(),request.id);
    }catch(error){if(isCurrent()){
        window.CList.state.find=finishFindRequest(findState(),request.id,error?.message||String(error));view.error(error);
    }}finally{
        if(isCurrent())view.busy(false,selection.key);
        else if(_findRequest===request)invalidateFindRequest();
    }
}
