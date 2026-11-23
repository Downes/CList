function createAnnotationFieldsView(container,doc=document){
    let inputs={},feedback=null;
    const alive=()=>!!container&&doc.getElementById('annotate-ref-fields')===container;
    return{
        alive,
        mount(values,actions){
            container.innerHTML='';inputs={};
            for(const [label,key] of ANNOTATION_TARGET_FIELDS){
                const row=doc.createElement('div');row.className='collection-editor-field';
                const caption=doc.createElement('label');caption.textContent=label;
                const input=doc.createElement('input');input.type='text';input.className='collection-editor-input';input.value=values[key];
                input.oninput=()=>{if(alive())actions.input(key,input.value);};input.onchange=()=>{if(alive())return actions.commit(key,input.value);};
                row.append(caption,input);container.appendChild(row);inputs[key]=input;
            }
            feedback=doc.createElement('p');feedback.className='feed-status-message';container.appendChild(feedback);
        },
        update(values){if(alive())for(const key of Object.keys(inputs))if(inputs[key].value!==values[key])inputs[key].value=values[key];},
        notice(text){if(alive()&&feedback)feedback.textContent=text;},
        error(error){console.error('Annotation fields failed:',error);showErrorModal(error.message||String(error),{title:'Could not update annotation fields'});}
    };
}
