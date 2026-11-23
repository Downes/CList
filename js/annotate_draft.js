function createAnnotationDraftController(deps,view){
    let disposed=false,generation=0,target=null,busy=false;
    let baseline={},values={},dirty=new Set(),conflicts=new Set();
    const active=()=>!disposed&&deps.current();
    const owned=()=>active()&&view.alive();
    const state=()=>{
        /** @type {CListAnnotationFieldsState} */
        const value={generation,busy,dirty:dirty.size};if(active())deps.state(value);
    };
    const rowCurrent=(selected,id)=>owned()&&generation===id&&target===selected&&deps.target()===selected;
    const controller={
        active,
        refresh(){
            if(!owned())return false;
            const selected=deps.target();
            if(target!==selected){
                target=selected;generation++;baseline={};values={};dirty=new Set();conflicts=new Set();
                for(const [,key] of ANNOTATION_TARGET_FIELDS)baseline[key]=values[key]=annotationDraftFieldValue(target,key);
                const id=generation;
                view.mount(values,{
                    input(key,value){if(!rowCurrent(selected,id)||busy)return;values[key]=value;dirty.add(key);conflicts.delete(key);state();},
                    commit(key,value){
                        if(!rowCurrent(selected,id)||busy)return false;
                        if(!ANNOTATION_TARGET_FIELDS.some(([,field])=>field===key))return false;
                        if(conflicts.has(key))return false;
                        values[key]=value;
                        const current=annotationDraftFieldValue(selected,key);
                        if(current!==baseline[key]){baseline[key]=current;dirty.add(key);conflicts.add(key);view.notice('Source metadata changed. Your edit was kept; edit this field again to apply it.');state();return false;}
                        if(current===value&&!(key==='url'&&selected.url&&!deps.references().includes(selected))){dirty.delete(key);state();return true;}
                        busy=true;state();
                        try{
                            writeAnnotationDraftField(selected,key,value);baseline[key]=value;dirty.delete(key);
                            if(key==='url'&&selected.url)deps.push(selected);
                            if(rowCurrent(selected,id))view.notice('');return true;
                        }catch(error){if(rowCurrent(selected,id))view.error(error);return false;}
                        finally{busy=false;state();}
                    }
                });
            }else{
                for(const [,key] of ANNOTATION_TARGET_FIELDS)if(!dirty.has(key))baseline[key]=values[key]=annotationDraftFieldValue(target,key);
                view.update(values);
            }
            state();return true;
        },
        receive(reference,editorDiv){
            if(!active()||busy||!reference)return false;
            const selected=deps.target();busy=true;state();
            try{
                const pending=receiveAnnotationDraftReference(selected,reference,deps.references());
                for(const ref of pending){if(!active()||deps.target()!==selected)return false;deps.pushDisplay(ref,editorDiv);}
                if(!active()||deps.target()!==selected)return false;
                controller.refresh();return true;
            }catch(error){if(active())view.error(error);return false;}
            finally{busy=false;state();}
        },
        dispose(){disposed=true;generation++;}
    };return controller;
}
