function createAnnotationBodyController(deps,view){
    let closed=false,html=view.read(),rich=null,pending=null,version=0;
    const resources=new Map(),removed=new Set();
    const owned=()=>!closed&&deps.current()&&view.alive();
    const state=phase=>{
        /** @type {CListAnnotationBodyState} */
        const value={phase,busy:phase==='initializing'};if(owned())deps.state(value);
    };
    function release(editor,feedback=false){
        if(removed.has(editor))return;removed.add(editor);const errors=[];
        for(const [name,callback] of resources.get(editor)||[]){try{editor.off(name,callback);}catch(error){errors.push(error);}}
        resources.delete(editor);try{editor.remove();}catch(error){errors.push(error);}
        if(errors.length){const error=new AggregateError(errors,'Could not release annotation editor resources.');if(feedback&&deps.current()&&view.alive())view.cleanupError(error);else console.error(error);}
    }
    function listen(editor,name,callback){editor.on(name,callback);resources.get(editor).push([name,callback]);}
    function fail(error){
        const editor=rich;rich=null;if(editor)release(editor,true);
        if(owned()){view.write(html);state('fallback');view.fallback(html,error,()=>controller.initialize());}
    }
    function ready(editor,id){
        if(!owned()||id!==version||removed.has(editor)){release(editor);return false;}
        if(rich){if(rich!==editor)release(editor,true);return true;}
        editor.setContent(html);html=editor.getContent();rich=editor;view.write(html);view.ready(editor);state('ready');return true;
    }
    const controller={
        owned,
        initialize(){
            if(!owned()){controller.dispose();return Promise.resolve(false);}
            if(rich)return Promise.resolve(true);
            if(pending)return pending.promise;
            const id=++version,editors=new Set();let finish;
            const job={promise:new Promise(resolve=>{finish=resolve;})};pending=job;state('initializing');view.starting();
            const complete=value=>{if(pending===job)pending=null;finish(value);};
            job.finish=complete;
            const reject=error=>{
                for(const editor of editors)release(editor,owned());
                if(id===version){rich=null;if(owned())fail(error);}
                complete(false);
            };
            try{
                if(!deps.available())throw Error('TinyMCE failed to load.');
                const target=view.target();
                const initialized=deps.init({...deps.configuration(),target,setup(editor){
                    editors.add(editor);resources.set(editor,[]);
                    if(!owned()||id!==version){release(editor);return;}
                    listen(editor,'init',()=>{try{ready(editor,id);}catch(error){reject(error);}});
                    const mirror=()=>{
                        if(!owned()||id!==version||rich!==editor||removed.has(editor))return;
                        try{html=editor.getContent();view.write(html);}catch(error){fail(error);}
                    };
                    for(const name of ['input','change','undo','redo'])listen(editor,name,mirror);
                }});
                Promise.resolve(initialized).then(result=>{
                    for(const editor of result||[]){editors.add(editor);if(!resources.has(editor)&&!removed.has(editor))resources.set(editor,[]);ready(editor,id);}
                    if(owned()&&id===version&&!rich)throw Error('Description editor initialization did not return an editor.');
                    complete(owned()&&id===version&&!!rich);
                }).catch(reject);
            }catch(error){reject(error);}
            return job.promise;
        },
        read(){
            if(!owned())throw Error('The annotation description source expired.');
            if(rich){try{html=rich.getContent();view.write(html);}catch(error){fail(error);throw error;}}
            return html;
        },
        set(value){
            if(!owned())throw Error('The annotation description source expired.');
            html=String(value??'');view.write(html);
            if(rich){try{rich.setContent(html);html=rich.getContent();view.write(html);}catch(error){fail(error);throw error;}}
        },
        append(value){const existing=controller.read();controller.set(rich?(existing?existing+'<p>'+value+'</p>':'<p>'+value+'</p>'):(existing?existing+'<br><br>'+value:value));},
        dispose(){
            if(closed)return;const feedback=owned();state('closed');closed=true;version++;rich=null;
            pending?.finish(false);pending=null;
            for(const editor of [...resources.keys()])release(editor,feedback);
            view.dispose();
        }
    };
    view.bind(value=>{if(owned()){html=value;state(rich?'ready':'fallback');}},()=>{if(!owned())controller.dispose();});
    state('idle');return controller;
}
