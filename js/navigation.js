// Private row/gesture/annotation lifetimes; shared state contains indices and phases only.
function createNavigationController(deps,view){
    let selected=null,source=deps.context(),feed=view.feed(),gesture=null,revision=0,operation=0,annotating=false,disposed=false;
    const live=()=>!disposed&&view.alive();
    const publish=()=>{if(live())window.CList.state.navigation={selectedIndex:view.entries().indexOf(selected),entryCount:view.entries().length,gesturePending:!!gesture,annotating};};
    const sync=()=>{
        if(!live())return false;
        if(source!==deps.context()||feed!==view.feed()){source=deps.context();feed=view.feed();selected=null;gesture=null;revision++;operation++;annotating=false;view.highlight(null);}
        if(selected&&!view.entries().includes(selected)){selected=null;revision++;view.highlight(null);}
        return true;
    };
    const select=row=>{if(!sync()||!view.entries().includes(row))return false;selected=row;revision++;view.highlight(row);publish();return true;};
    const expanded=id=>{if(!sync())return false;const result=view.expand(id);if(!result)return false;if(result.row)select(result.row);return true;};
    const navigate=direction=>{
        if(!sync())return;const rows=view.entries(),index=navigationIndex(rows.indexOf(selected),direction,rows.length);if(index<0)return;
        const row=rows[index],wasExpanded=view.expanded(selected),specific=view.details(row);
        if(wasExpanded&&specific&&expanded(specific.id))return;if(wasExpanded)view.collapse();select(row);
    };
    const toggle=id=>{if(!sync())return false;const result=view.toggle(id);if(result?.row)select(result.row);return!!result;};
    const currentToggle=()=>{if(!sync())return;if(!selected&&view.entries().length)select(view.entries()[0]);const specific=view.details(selected);if(specific)toggle(specific.id);};
    const annotate=async()=>{
        if(!sync()||annotating)return;const reference=view.reference(selected);
        if(!reference){deps.error('No feed item selected to annotate.');return;}
        const row=selected,stamp=source,reader=deps.reader?.(),root=feed,capturedRevision=revision,id=++operation;annotating=true;publish();
        const current=()=>live()&&id===operation&&deps.context()===stamp&&deps.reader?.()===reader&&view.feed()===root&&revision===capturedRevision&&view.entries().includes(row);
        try{const captured=structuredClone(reference),selection=view.selectedText();await deps.annotate(captured,selection,current);}
        catch(error){if(current()){console.error('Could not annotate selected entry:',error);deps.error('Could not annotate selected entry: '+error.message);}}
        finally{if(id===operation){annotating=false;if(sync())publish();}}
    };
    const controller={
        select,navigate,toggle,expand:expanded,collapse:()=>{if(sync())view.collapse();},toggleCurrent:currentToggle,entries:()=>view.entries(),
        key(intent){if(!sync())return;if(intent==='next')navigate(1);else if(intent==='previous')navigate(-1);else if(intent==='toggle')currentToggle();else if(intent==='annotate')return annotate();},
        double:row=>{if(sync()){const specific=view.details(row);if(specific)toggle(specific.id);}},
        start(event,node){
            gesture=null;if(!sync()||event.touches.length!==1||view.interactive(node)){publish();return;}
            const point=event.touches[0];gesture={id:point.identifier??0,x:point.clientX,y:point.clientY,time:deps.now(),source,reader:deps.reader?.(),revision,feed,pane:deps.pane(),paneVersion:deps.paneVersion?.(),mobile:deps.mobile(),row:view.row(node),inFeed:view.inFeed(node)};publish();
        },
        move(event){if(gesture&&(event.touches.length!==1||(event.touches[0].identifier??0)!==gesture.id))controller.cancel();},
        end(event){
            const start=gesture;gesture=null;if(!start||!sync()){publish();return;}publish();
            if(event.changedTouches.length!==1||event.touches.length||source!==start.source||deps.reader?.()!==start.reader||revision!==start.revision||view.feed()!==start.feed||deps.pane()!==start.pane||deps.paneVersion?.()!==start.paneVersion||deps.mobile()!==start.mobile||view.blocked(null)||(start.row&&!view.entries().includes(start.row)))return;
            const point=event.changedTouches[0];if((point.identifier??0)!==start.id)return;
            const intent=navigationTouchIntent({x:start.x,y:start.y,endX:point.clientX,endY:point.clientY,duration:deps.now()-start.time,mobile:start.mobile,feed:start.inFeed,pane:start.pane});
            if(intent?.kind==='entry')navigate(intent.direction);else if(intent?.kind==='pane')deps.showPane(intent.pane);
        },
        cancel(){gesture=null;publish();},choice(){if(sync()&&deps.mobile())deps.showPane('read');},
        dispose(){if(disposed)return;disposed=true;operation++;gesture=null;unbind();}
    };
    const unbind=view.bind(controller);publish();return controller;
}
let _navigationController=null;
function navigationController(){
    if(!_navigationController){const view=createNavigationView(document,document.getElementById('left-pane'));
        _navigationController=createNavigationController({
            context:()=>JSON.stringify([window.CList.config.flaskSiteUrl,getSiteSpecificCookie(window.CList.config.flaskSiteUrl,window.CList.keys.ACCESS_TOKEN),getSiteSpecificCookie(window.CList.config.flaskSiteUrl,window.CList.keys.USERNAME),window.CList.state.authEpoch||0,window.CList.state.reader?.accountKey,window.CList.state.reader?.mode]),reader:()=>window.CList.state.reader?.requestId||0,
            pane:()=>paneController().state().currentPane,paneVersion:()=>window.CList.state.panes,mobile:()=>window.innerWidth<=768,now:()=>Date.now(),
            showPane:pane=>{if(pane==='left')openLeftPane();else if(pane==='right')openRightPane();else paneController().show(pane);},
            annotate:(reference,selection,current)=>annotateNavigationReference(reference,selection,current),error:message=>showErrorModal(message,{title:'Reader navigation'})
        },view);
    }return _navigationController;
}
function _feedEntries(){return navigationController().entries();}
function setCurrentEntry(row){return navigationController().select(row);}
function navigateEntry(direction){return navigationController().navigate(direction);}
function collapseAllEntries(){return navigationController().collapse();}
function expandEntry(id){return navigationController().expand(id);}
function toggleEntryExpanded(id){return navigationController().toggle(id);}
function toggleCurrentEntry(){return navigationController().toggleCurrent();}
