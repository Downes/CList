// Controller owns canonical layout; storage saves never read styles back from the DOM.
function createPaneController(deps,view){
    let state=initialPaneState(),disposed=false,drag=null;
    const notice=(kind,error)=>{console.error('Pane '+kind+' failed:',error);deps.notice('Pane layout could not be '+(kind==='read'?'restored':'saved')+'. Your current layout is still usable.');};
    const publish=()=>{if(disposed)return;window.CList.state.panes={...state};view.render(state);};
    const profile=loggedIn=>loggedIn?deps.keys.PANE_STATE_LOGGED_IN:deps.keys.PANE_STATE_LOGGED_OUT;
    const save=(key=profile(deps.loggedIn()))=>{if(disposed)return;try{deps.set(key,JSON.stringify(paneSnapshot(state)));}catch(error){notice('write',error);}};
    const read=key=>{try{const text=deps.get(key);return text?normalizePaneState(JSON.parse(text)):null;}catch(error){notice('read',error);return null;}};
    const change=(next,persist=true)=>{if(disposed)return;state=next;publish();if(persist)save();};
    const closeHooks=(side,options={})=>side==='left'?deps.closeLeft():deps.closeRight(options);
    const ratio=()=>{const box=view.measure();return box.width>0?box.readWidth/box.width:NaN;};
    const controller={
        state:()=>({...state}),save,read,
        apply(saved){if(disposed)return;try{const next=normalizePaneState(saved,state);if(!next.leftOpen)closeHooks('left');if(!next.rightOpen)closeHooks('right');change(next,false);}catch(error){notice('read',error);}},
        restore(loggedIn=deps.loggedIn()){
            if(disposed)return;drag=null;const saved=read(profile(loggedIn));
            const next=saved||{...snapPaneState(initialPaneState(),'right',ratio()),leftOpen:true,currentPane:'left-pane'};
            if(!next.leftOpen&&(saved||state.leftOpen))closeHooks('left');if(!next.rightOpen&&(saved||state.rightOpen))closeHooks('right');change(next,false);
        },
        open(side){if(disposed)return;drag=null;change({...state,dragging:false,[side==='left'?'leftOpen':'rightOpen']:true,currentPane:side+'-pane',surface:side==='left'?'read':'write'});return side==='left'?view.left:undefined;},
        close(side,options={}){if(disposed)return;drag=null;closeHooks(side,options);change({...state,dragging:false,[side==='left'?'leftOpen':'rightOpen']:false,currentPane:side==='left'?'read-pane':'write-pane',surface:side==='left'?'read':'write'});},
        toggleLeft(){if(state.leftOpen)controller.close('left');else return controller.open('left');},
        snap(direction){if(disposed)return;change(snapPaneState(state,direction,ratio()));},
        show(surface){if(disposed)return;drag=null;closeHooks(surface==='read'?'left':'right');change({...state,dragging:false,surface,currentPane:surface+'-pane',...(surface==='read'?{leftOpen:false}:{rightOpen:false})});},
        reveal(){
            if(disposed)return;
            if(deps.mobile()){drag=null;closeHooks('left');closeHooks('right');change({...state,dragging:false,leftOpen:false,rightOpen:false,surface:'write',currentPane:'write-pane'});}
            else{const hidden=view.measure().writeWidth<=1;const next=hidden?snapPaneState(state,'left',ratio()):state;change({...next,currentPane:'write-pane',surface:'write'},hidden);}
        },
        beginDrag(){if(disposed||deps.mobile())return;drag={context:deps.context(),key:profile(deps.loggedIn()),changed:false};change({...state,dragging:true},false);},
        drag(clientX){
            if(disposed||!drag)return;if(drag.context!==deps.context()){drag=null;change({...state,dragging:false},false);return;}
            const box=view.measure();if(!(box.width>0)||!Number.isFinite(clientX))return;
            const readFlex=Math.max(0,Math.min(1,(clientX-box.left)/box.width));if(readFlex!==state.readFlex||1-readFlex!==state.writeFlex)drag.changed=true;change({...state,readFlex,writeFlex:1-readFlex},false);
        },
        endDrag(){if(disposed||!drag)return;const captured=drag;drag=null;change({...state,dragging:false},false);if(captured.changed&&captured.context===deps.context())save(captured.key);},
        dispose(){if(disposed)return;disposed=true;drag=null;unbind();}
    };
    const unbind=view.bind(controller);return controller;
}
let _paneController=null;
function paneController(){
    if(!_paneController){
        const mobile=()=>window.innerWidth<=768;
        const refs={main:document.getElementById('main-content'),mainWindow:document.getElementById('main-window'),left:document.getElementById('left-pane'),right:document.getElementById('right-pane'),read:document.getElementById('read-pane'),write:document.getElementById('write-pane'),divider:document.getElementById('divider'),events:document};
        _paneController=createPaneController({keys:window.CList.keys,mobile,loggedIn:()=>typeof hasValidSession==='function'&&hasValidSession(),
            context:()=>JSON.stringify([window.CList.config.flaskSiteUrl,window.CList.state.authEpoch||0,getSiteSpecificCookie(window.CList.config.flaskSiteUrl,window.CList.keys.ACCESS_TOKEN),getSiteSpecificCookie(window.CList.config.flaskSiteUrl,window.CList.keys.USERNAME),typeof hasValidSession==='function'&&hasValidSession()]),
            get:key=>localStorage.getItem(key),set:(key,value)=>localStorage.setItem(key,value),notice:text=>showStatusMessage(text),
            closeLeft(){if(typeof invalidateFindPanel==='function')invalidateFindPanel();},
            closeRight(options){if(typeof invalidateSavePanel==='function')invalidateSavePanel();if(!options.preserveEditorControls&&typeof invalidateEditorControls==='function')invalidateEditorControls();if(typeof invalidateEditorPicker==='function')invalidateEditorPicker();}
        },createPaneView(refs,mobile));
    }return _paneController;
}
function activePaneStateKey(){return(typeof hasValidSession==='function'&&hasValidSession())?window.CList.keys.PANE_STATE_LOGGED_IN:window.CList.keys.PANE_STATE_LOGGED_OUT;}
function getSavedPaneState(key){return paneController().read(key);}
function applyPaneState(state){return paneController().apply(state);}
function savePaneState(){return paneController().save();}
function restoreLoggedInPaneState(){return paneController().restore(true);}
function restoreLoggedOutPaneState(){return paneController().restore(false);}
function openLeftPane(){return paneController().open('left');}
function toggleLeftPane(){return paneController().toggleLeft();}
function closeLeftPane(){return paneController().close('left');}
function openRightPane(){return paneController().open('right');}
function closeRightPane(options={}){return paneController().close('right',options);}
function snapPanes(direction){return paneController().snap(direction);}
function revealEditorPane(){return paneController().reveal();}
