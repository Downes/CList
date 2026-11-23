let _annotationBodyTargetId=0;
function annotationBodyConfiguration(doc=document){
    const dark=!!doc.documentElement?.classList.contains('dark-mode');
    return{height:200,menubar:false,plugins:'link image code',toolbar:'bold italic link image code',skin:dark?'oxide-dark':'oxide',
        content_style:dark?'body { background:#1e1e1e; color:#e0e0e0; font-size:14px; }':'body { font-size:14px; }'};
}
function createAnnotationBodyView(root,element,doc=document){
    const status=doc.createElement('div');status.className='feed-status-message';(element.parentNode||root).appendChild(status);
    let onInput=null,observer=null;
    const alive=()=>doc.getElementById('annotateEditDiv')===root&&root.contains(element);
    return{
        element,alive,read:()=>element.value||'',write:value=>{if(alive())element.value=value;},
        target(){element.id='clist-annotation-body-'+(++_annotationBodyTargetId);return element;},
        bind(input,expired){
            onInput=()=>{if(alive())input(element.value);};element.oninput=onInput;
            if(typeof MutationObserver!=='undefined'&&doc.body){observer=new MutationObserver(expired);observer.observe(doc.body,{childList:true,subtree:true});}
        },
        starting(){if(alive()){status.className='feed-status-message';status.textContent='Starting description editor…';}},
        ready(editor){if(alive()){editor.getContainer().classList.add('annotate-mini-toolbar');status.className='feed-status-message';status.textContent='';}},
        fallback(value,error,retry){
            if(!alive())return; element.value=value;element.style.visibility='';element.style.display='';status.innerHTML='';status.className='error-message';
            const message=doc.createElement('p');message.textContent='Rich editor unavailable. Description kept in the text area. '+error.message;status.appendChild(message);
            console.error('Annotation rich editor failed:',error);
            const button=doc.createElement('button');button.className='btn btn-small';button.textContent='Retry rich editor';button.onclick=()=>{if(alive())return retry();};status.appendChild(button);
        },
        cleanupError(error){console.error('Annotation editor cleanup failed:',error);if(alive())showStatusMessage('Could not release all annotation editor resources.');},
        dispose(){observer?.disconnect();if(element.oninput===onInput)element.oninput=null;status.remove();}
    };
}
