// DID account-selection update feedback; checkbox values come from controller state.
window.CList.ui.didUpdate={
    busy(root,busy){root.querySelector('#did-update-btn').disabled=busy;},
    message(root,text,error=false){const target=root.querySelector('#did-status');target.className=error?'error-message':'me-status';target.textContent=text;},
    result(root,plan){const complete=plan.published&&plan.entries.every(entry=>entry.saved);this.message(root,(plan.published?'DID account choices are published. ':'DID publication is not confirmed. ')+(plan.entries.every(entry=>entry.saved)?'Account visibility is saved.':'Some account visibility saves remain unconfirmed.')+' '+plan.warnings.join(' '),!complete||!!plan.warnings.length);},
    error(root,error){console.error('[DID update]',error);this.message(root,error.message||String(error),true);},
    recovery(root,run){const button=document.createElement('button');button.className='btn btn-small btn-secondary';button.textContent='Refresh accounts';button.onclick=run;root.querySelector('#did-status').appendChild(button);},
    action(root,label,run){const button=root.querySelector('#did-update-btn');button.textContent=label;button.onclick=run;},
};
