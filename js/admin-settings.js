// Private draft/receipt ownership; public state contains counts/phases only.
let _adminSettingsSequence=0;
const _adminPanels=new WeakMap(),_adminWrites=new Map(),_adminVisible=new Map();
/** @returns {CListAdminSession} */
function adminSettingsSession(){const storeUrl=window.CList.config.flaskSiteUrl;return{storeUrl,token:getSiteSpecificCookie(storeUrl,window.CList.keys.ACCESS_TOKEN),username:getSiteSpecificCookie(storeUrl,window.CList.keys.USERNAME),epoch:window.CList.state.authEpoch||0,local:!!window.CList.isLocalMode()};}
function createAdminSettings(panel,app){
    const session=adminSettingsSession(),lock=JSON.stringify([session,app.baseUrl]),owner={id:++_adminSettingsSequence};_adminPanels.set(panel,owner);_adminVisible.set(lock,owner);
    let model=null,request=0,rendered=0,loading=false;
    const view=window.CList.ui.adminSettings,current=()=>panel.isConnected&&_adminPanels.get(panel)===owner&&JSON.stringify(adminSettingsSession())===JSON.stringify(session);
    const summary=(phase,error=null)=>{if(current())window.CList.state.adminSettings={panelId:owner.id,app:app.label,phase,error,dirtyCount:model?.drafts.size||0,busy:!!_adminWrites.get(lock)?.pending};};
    const deps={fetch:(...args)=>fetch(...args),assertCurrent(){if(!current())throw new Error('The settings panel or account changed.');}};
    const acknowledge=operation=>{
        if(operation.owner!==owner.id)return;
        for(const [key,version] of operation.versions){const draft=model.drafts.get(key);if(draft?.version===version)model.drafts.delete(key);}
    };
    const render=()=>{
        if(!current()||!model)return;const version=++rendered,op=_adminWrites.get(lock);
        model.busy=loading||!!op?.pending;model.blocked=!!op&&!op.reviewed;model.reviewed=!!op?.reviewed;
        const action=fn=>(...args)=>{if(current()&&rendered===version)return fn(...args);};
        view.form(panel,app,model,{
            edit:action((key,value)=>edit(key,value)),arm:action(key=>{edit(key,'',true);render();}),
            toggle:action((key,value)=>{edit(key,String(value));return save(key);}),save:action(()=>save()),check:action(()=>load()),help:action(()=>view.help(app.label,model.schema))
        });
        summary(model.busy?'saving':model.blocked?'check-required':'ready',model.error?model.message:null);
    };
    const edit=(key,value,armed=false)=>{
        const field=model.schema.find(field=>field.key===key);if(!field)return;
        model.revision++;model.drafts.set(key,{value,version:model.revision,armed:armed||field.sensitive});summary('editing');
    };
    const load=async()=>{
        if(loading||!current())return;const id=++request;loading=true;
        if(model){model.message='Checking current settings…';render();}else{summary('loading');view.message(panel,'Loading settings…');}
        try{
            const result=await readAdminSettings(app,session,{...deps,assertCurrent(){deps.assertCurrent();if(request!==id)throw new Error('Replaced settings request.');}});
            if(!current())return;
            if(!model)model={...result,drafts:new Map(),revision:0};else{model.schema=result.schema;model.values=result.values;}
            model.error=false;model.message='';const op=_adminWrites.get(lock);
            if(op?.pending)model.message='A save is still running. Check settings after it finishes.';
            else if(op){
                const matches=Object.keys(op.payload).every(key=>!op.schema.find(field=>field.key===key)?.sensitive&&result.values[key]===op.payload[key]);
                if(op.accepted||matches){acknowledge(op);_adminWrites.delete(lock);model.message='Save confirmed. Current settings loaded.';}
                else{op.reviewed=true;model.message='The previous save could not be confirmed. Review your changes before saving again. Masked secret values cannot be verified by a read.';}
            }
        }catch(error){if(current()){console.error('Admin settings read failed:',error);if(model){model.error=true;model.message=error.message;}else{summary('failed',error.message);view.message(panel,error.message,()=>{if(current())return load();});}}}
        finally{loading=false;if(model)render();}
    };
    const save=async(onlyKey=null)=>{
        if(!current()||!model||loading)return;const existing=_adminWrites.get(lock);if(existing&&(existing.pending||!existing.reviewed))return;
        const payload=Object.create(null),versions=new Map();
        for(const field of model.schema){const draft=model.drafts.get(field.key);if(!draft||(onlyKey&&onlyKey!==field.key))continue;if(field.sensitive?!draft.value:draft.value===model.values[field.key])continue;payload[field.key]=draft.value;versions.set(field.key,draft.version);}
        if(!Object.keys(payload).length){model.message='No changes to save.';model.error=false;render();return;}
        const operation={owner:owner.id,payload,versions,schema:model.schema,pending:true,accepted:false,reviewed:false};_adminWrites.set(lock,operation);
        model.message='Saving…';model.error=false;render();
        try{
            const result=await writeAdminSettings(app,session,operation,deps);
            if(!current())return;model.values=result.values;acknowledge(operation);_adminWrites.delete(lock);model.message='Saved.';
        }catch(error){
            if(operation.rejected)_adminWrites.delete(lock);
            if(current()){
                console.error('Admin settings save failed:',error);model.error=true;model.message=error.message;
                if(operation.rejected&&onlyKey){const draft=model.drafts.get(onlyKey);if(draft?.version===versions.get(onlyKey))model.drafts.delete(onlyKey);}
            }
        }finally{
            operation.pending=false;
            if(_adminWrites.get(lock)===operation&&operation.rejected)_adminWrites.delete(lock);
            const visible=_adminVisible.get(lock);if(visible===owner)render();else visible?.changed();
        }
    };
    owner.changed=()=>{if(current()&&model){model.message='An earlier save finished. Check current settings before saving.';render();}};
    return {load};
}
function renderGenericAdminSettingsPanel(panel,baseUrl){
    const app=adminSettingsApps().find(app=>app.baseUrl===baseUrl);
    if(!app){window.CList.ui.adminSettings.message(panel,'Choose an available app.');return Promise.resolve();}
    return createAdminSettings(panel,app).load();
}
function playAppSettings(){if(window.innerWidth<=768){history.pushState({panel:'me'},'');openLeftInterface(kvstoreAppSettingsPanel());}else openAppSettingsModal();}
function createAdminSettingsPicker(options){
    const session=JSON.stringify(adminSettingsSession()),apps=adminSettingsApps();
    return window.CList.ui.adminSettings.picker(apps,(panel,app)=>{
        if(JSON.stringify(adminSettingsSession())!==session){window.CList.ui.adminSettings.message(panel,'The account changed. Reopen App Settings.');return;}
        return createAdminSettings(panel,app).load();
    },options);
}
function kvstoreAppSettingsPanel(){return createAdminSettingsPicker({back:()=>history.back()});}
function openAppSettingsModal(){const root=createAdminSettingsPicker({desktop:true,back:closeAppSettingsModal});showModal(root,{wide:true});}
function closeAppSettingsModal(){document.getElementById('generic-modal')?.remove();}
function openAdminSettingsHelpModal(label,schema){return window.CList.ui.adminSettings.help(label,schema);}
function closeAdminSettingsHelpModal(){closeStackedModal();}
