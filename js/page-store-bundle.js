function createPageBundleController(deps) {
    let pending=null,lastImport=null;
    const receipts=new WeakMap();
    const receiptFor=(owner,selected)=>{
        const receipt=selected.file&&receipts.get(selected.file)?.get(selected.policy);
        return receipt&&deps.sameSession(owner,receipt.owner)?receipt:null;
    };
    const state=(kind,phase,receipt='none')=>{
        /** @type {CListNativePageBundleState} */
        const value={kind,phase,receipt,busy:['exporting','reading','importing'].includes(phase)};deps.state(value);
    };
    const controller={
        export(owner,view){
            if(pending){if(owner.current())view.busy();return Promise.resolve(false);}
            const job={kind:'export',owner,promise:null};pending=job;
            job.promise=Promise.resolve().then(async()=>{
                try{
                    if(!owner.current())return false;state('export','exporting');
                    const bundle=await owner.export();if(!owner.current()){state('export','cancelled');return false;}
                    const content=JSON.stringify(bundle,null,2);await deps.download(content,owner.filename);
                    state('export','handed-off','accepted');if(owner.current())view.exported(bundle.manifest.count);return true;
                }catch(error){state('export','error');if(owner.current())view.error(error);return false;}
                finally{if(pending===job)pending=null;}
            });return job.promise;
        },
        mount(owner,view){
            const owned=()=>owner.current()&&view.alive();
            const update=()=>{
                if(!owned())return;
                const receipt=receiptFor(owner,view.selection());view.busy(pending?'blocked':null,!!receipt);
                if(pending)view.notice('A local-page import/export is still running. Use Check import result after it finishes.');
                else if(receipt){if(receipt.result)view.result(receipt.result);else view.uncertain(receipt.error);}
                else view.notice('Choose a file and conflict policy, then Import.');
            };
            const actions={
                submit(){
                    if(!owned())return Promise.resolve(false);
                    const selected=view.selection();
                    if(pending){if(pending.owner===owner&&pending.selected?.file===selected.file&&pending.selected.policy===selected.policy)return pending.promise;update();return Promise.resolve(false);}
                    const receipt=receiptFor(owner,selected);if(receipt){update();return Promise.resolve(false);}
                    if(!selected.file||typeof selected.file.text!=='function'){view.error(Error('Choose a file first.'));return Promise.resolve(false);}
                    const job={kind:'import',owner,selected,dispatched:false,promise:null};pending=job;
                    job.promise=Promise.resolve().then(async()=>{
                        try{
                            if(!owned())return false;state('import','reading');view.busy('reading');
                            const text=await selected.file.text();
                            if(!owned()||!view.matches(selected)){state('import','cancelled');return false;}
                            const bundle=parseLocalPageBundle(text,selected.policy);
                            if(!owned()||!view.matches(selected))return false;
                            job.dispatched=true;state('import','importing');view.busy('importing');
                            const result=await owner.import(bundle,{onConflict:selected.policy});
                            job.result=result;
                            const accepted={owner,selected,result};
                            let policies=receipts.get(selected.file);if(!policies){policies=new Map();receipts.set(selected.file,policies);}policies.set(selected.policy,accepted);lastImport=accepted;
                            state('import','complete','accepted');if(owned())view.result(result);return true;
                        }catch(error){
                            if(job.result){state('import','complete','accepted');if(owned())view.error(Error('Pages were imported, but results could not be displayed: '+error.message));}
                            else if(job.dispatched&&error.code!=='InvalidData'){
                                const uncertain={owner,selected,error};let policies=receipts.get(selected.file);if(!policies){policies=new Map();receipts.set(selected.file,policies);}policies.set(selected.policy,uncertain);lastImport=uncertain;
                                state('import','uncertain','uncertain');if(owned())view.uncertain(error);
                            }else{state('import','error');if(owned())view.error(error);}
                            return false;
                        }finally{if(pending===job)pending=null;if(owned())view.busy(null,!!receiptFor(owner,view.selection()));}
                    });return job.promise;
                },
                change(){update();},
                check(){
                    if(!owned())return;update();if(pending)return;
                    if(lastImport&&deps.sameSession(owner,lastImport.owner)){if(lastImport.result)view.result(lastImport.result);else view.uncertain(lastImport.error);}
                    else view.notice('No completed import result is available for this session.');
                },
                async back(){
                    if(!owned()||(pending?.owner===owner&&pending.dispatched))return;
                    owner.closed=true;
                    try{await deps.back();}catch(error){if(view.alive())view.error(error);}
                }
            };
            view.mount(actions);update();return actions;
        }
    };return controller;
}
let _pageBundleController=null;
function pageBundleController(){
    return _pageBundleController ||= createPageBundleController({
        sameSession:(a,b)=>a.store===b.store&&a.epoch===b.epoch&&a.session===b.session,
        download:(content,filename)=>downloadBlob(new Blob([content],{type:'application/json'}),filename),
        back:()=>showLocalPages(),state:value=>{window.CList.state.localPageBundle=value;}
    });
}
function capturePageBundleOwner(options,isCurrent=()=>true){
    const store=window.CList.pageStore,captured=captureSavePanelOwner(),page=currentLoadedPage,handler=editorHandlers[currentEditor],docId=handler?.getDocId?.()||null;
    const owner={store,epoch:window.CList.state.authEpoch||0,session:JSON.stringify(readerSession()),closed:false,
        filename:'clist-pages-'+new Date().toISOString().slice(0,10)+'.json',export:store.exportPages.bind(store),import:store.importPages.bind(store)};
    owner.current=()=>{const now=captureSavePanelOwner();return !owner.closed&&isCurrent()&&!!options?.isConnected&&window.CList.ui.view.loadOptions===options&&
        window.CList.pageStore===store&&owner.epoch===(window.CList.state.authEpoch||0)&&owner.session===JSON.stringify(readerSession())&&page===currentLoadedPage&&
        handler===editorHandlers[currentEditor]&&docId===(handler?.getDocId?.()||null)&&Object.keys(captured).every(key=>captured[key]===now[key]);};
    return owner;
}
function _exportAllPages(isCurrent){
    return pageBundleController().export(capturePageBundleOwner(window.CList.ui.view.loadOptions,isCurrent),createPageBundleExportView());
}
function _showImportPagesPicker(options=window.CList.ui.view.loadOptions){
    if(!options)return null;
    return pageBundleController().mount(capturePageBundleOwner(options),createPageBundleImportView(options));
}
