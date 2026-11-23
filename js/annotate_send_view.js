function createAnnotationSendView(section,doc=document){
    const root=doc.createElement('div'),feedback=doc.createElement('div');let send=null,account=null,visibility=null;
    const alive=()=>doc.getElementById('annotate-send-section')===section&&root.parentNode===section;
    const message=(text,error=false)=>{feedback.innerHTML='';const row=doc.createElement('p');row.className=error?'error-message':'feed-status-message';row.textContent=text;feedback.appendChild(row);};
    return{
        alive,
        mount(){section.innerHTML='';root.appendChild(feedback);section.appendChild(root);},
        notice:message,
        choices(accounts,selected,vis,actions){
            root.innerHTML='';feedback.innerHTML='';const row=doc.createElement('div');row.className='annotation-send-controls';
            const label=doc.createElement('label');label.textContent='Send to:';account=buildAccountSelect(accounts);account.value=String(selected);
            const visibilityLabel=doc.createElement('label');visibilityLabel.textContent='Visibility:';visibility=buildVisibilitySelect();visibility.value=vis;
            const accountControl=account,visibilityControl=visibility;
            account.onchange=()=>{if(alive()&&root.contains(accountControl))actions.select(Number(accountControl.value));};visibility.onchange=()=>{if(alive()&&root.contains(visibilityControl))actions.visibility(visibilityControl.value);};
            send=doc.createElement('button');send.className='btn btn-small';send.textContent='Send';const sendControl=send;send.addEventListener('click',()=>{if(alive()&&root.contains(sendControl))return actions.send();});
            row.append(label,account,visibilityLabel,visibility,send);root.append(row,feedback);
        },
        busy(value){if(alive()&&send){send.disabled=account.disabled=visibility.disabled=value;send.textContent=value?'Sending…':'Send';}},
        result(outcome,label,url){
            message(window.CList.ui.annotations.summary(outcome)+' Destination: '+label+'; target: '+url+((outcome.results[0]?.error)?' '+outcome.results[0].error:''),!outcome.created);
            if(outcome.failed||outcome.uncertain)console.error('Annotation Send result:',outcome);
            if(outcome.created)showStatusMessage('Sent to '+label+'.');
        },
        error(error,retry){
            console.error('Annotation Send failed:',error);message(error.message||String(error),true);
            if(retry){const button=doc.createElement('button');button.className='btn btn-small';button.textContent='Reload Send controls';button.onclick=()=>{if(alive()&&button.parentNode===feedback)return retry();};feedback.appendChild(button);}
        },
        returnError(error){console.error('Annotation sent; draft return check failed:',error);message('Annotation sent. Your draft was kept because returning to the previous editor failed: '+error.message,true);}
    };
}
