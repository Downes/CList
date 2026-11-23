// Removal choices, partial receipts and feedback. No destructive operations.
window.CList.ui.didRemoval={
    busy(root,busy){for(const id of ['did-btn','did-remove-btn','did-update-btn','prove-identity-btn']){const button=root.querySelector('#'+id);if(button)button.disabled=busy;}},
    message(root,text){const target=root.querySelector('#did-status');target.className='me-status';target.textContent=text;},
    progress(root,phase){this.message(root,{preparing:'Preparing identity removal…','removing-key':'Removing stored identity key…','removing-document':'Removing public DID document…'}[phase]||phase);},
    partial(root,plan,errors=[]){const target=root.querySelector('#did-status');target.className='error-message';target.textContent=(plan.keyRemoved?'Stored key removed. ':'Stored key removal is not confirmed. ')+(plan.documentRemoved?'Public DID removed or absent. ':'Public DID removal is not confirmed. ')+errors.join(' ');},
    result(root,local){this.message(root,local?'Identity key removed.':'Identity key and public DID removed.');},
    error(root,error){console.error('[DID removal]',error);const target=root.querySelector('#did-status');target.className='error-message';target.textContent=error.message||String(error);},
    action(root,label,run){const button=root.querySelector('#did-remove-btn');button.textContent=label;button.onclick=run;},
};
