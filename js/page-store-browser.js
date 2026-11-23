function createLocalPageBrowserController(deps, view) {
    let disposed=false,version=0,opening=false,loading=false,count=0,lastPhase='loading';
    const owned=()=>!disposed&&deps.current()&&view.alive();
    const state=phase=>{
        lastPhase=phase;
        /** @type {CListNativePageBrowserState} */
        const value={phase,count,opening};if(!disposed&&deps.sessionCurrent())deps.state(value);
    };
    const controller={
        async load(){
            if(disposed||!deps.current())return null;
            const id=++version;opening=false;loading=true;view.loading();view.busy(true);state('loading');
            try{
                const summaries=await deps.list();if(!owned()||version!==id)return null;
                count=summaries.length;view.show(summaries,selected=>controller.open(selected,id,summaries));state(count?'ready':'empty');
            }catch(error){if(owned()&&version===id){state('error');view.error('Could not list local pages',error,()=>owned()&&version===id?controller.load():null);}}
            finally{if(version===id){loading=false;if(owned())view.busy(false);}}
            return null;
        },
        async open(selected,id,summaries){
            if(!owned()||version!==id||loading||opening||!summaries.some(row=>row.id===selected))return false;
            opening=true;view.busy(true);state('reading');let handedOff=false;
            const current=()=>owned()&&version===id;
            try{
                const record=await deps.get(selected);if(!current())return false;
                const prepared=prepareLocalPageOpening(record,selected);if(!current())return false;
                const handoffCurrent=()=>!disposed&&version===id&&deps.sessionCurrent()&&deps.controlsCurrent();
                handedOff=true;state('opening');
                await deps.open(prepared,()=>{if(handoffCurrent())controller.cancel(true);},handoffCurrent);
                return handoffCurrent();
            }catch(error){
                handedOff=false;if(current()){state('error');view.error('Could not load page',error,()=>error.code==='PageNotFound'?controller.load():controller.open(selected,id,summaries));}
                return false;
            }finally{
                if(!handedOff&&version===id){opening=false;if(owned()){view.busy(false);state(lastPhase);}}
            }
        },
        async tool(kind){
            if(!owned()||loading||opening)return false;opening=true;view.busy(true);
            try{await deps.tool(kind,()=>owned());return true;}
            catch(error){if(owned())view.error('Could not open local-page tools',error,()=>controller.tool(kind));return false;}
            finally{opening=false;if(owned())view.busy(false);}
        },
        cancel(handoff=false){
            if(disposed||(!handoff&&!owned()))return;
            disposed=true;version++;deps.cancel();
        },
        dispose(){disposed=true;version++;}
    };
    view.mount({cancel:()=>controller.cancel(),export:()=>controller.tool('export'),import:()=>controller.tool('import')});
    return controller;
}
let _localPageBrowser=null;
function showLocalPages(){
    _localPageBrowser?.dispose();
    const store=window.CList.pageStore,options=window.CList.ui.view.loadOptions,owner=captureSavePanelOwner(),page=currentLoadedPage;
    const handler=editorHandlers[owner.editor],docId=handler?.getDocId?.()||null;
    const controlsId=window.CList.state.editorControls?.id,epoch=window.CList.state.authEpoch||0,session=JSON.stringify(readerSession());
    if(!options)return Promise.resolve(null);
    const sessionCurrent=()=>window.CList.pageStore===store&&epoch===(window.CList.state.authEpoch||0)&&session===JSON.stringify(readerSession());
    const controlsCurrent=()=>window.CList.ui.view.loadOptions===options&&controlsId===window.CList.state.editorControls?.id;
    const view=createLocalPageBrowserView(options);
    const controller=createLocalPageBrowserController({
        sessionCurrent,controlsCurrent,
        current(){const now=captureSavePanelOwner();return sessionCurrent()&&controlsCurrent()&&page===currentLoadedPage&&handler===editorHandlers[owner.editor]&&
            docId===(handler?.getDocId?.()||null)&&Object.keys(owner).every(key=>now[key]===owner[key]);},
        list:store.list.bind(store),get:store.get.bind(store),
        open:(prepared,cancel,current)=>loadSavedPage(prepared.content,prepared.page,options,cancel,current),
        cancel:()=>populateLoadOptions(),
        tool:(kind,current)=>kind==='export'?_exportAllPages(current):_showImportPagesPicker(options),
        state:value=>{if(_localPageBrowser===controller)window.CList.state.localPageBrowser=value;}
    },view);
    _localPageBrowser=controller;return controller.load();
}
window.CList.loaders ||= [];
window.CList.loaders.push({label:'CList (local)',icon:'folder',requiresLogin:true,requiresAccount:false,load:showLocalPages});
