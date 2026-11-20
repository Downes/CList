// Shared password dialog view. Message is trusted caller HTML; escape untrusted text first.
window.CList.ui.passwordConfirmation={
    mount(message,options,confirm,cancel){
        const root=document.createElement('div'),heading=document.createElement('h3');heading.textContent='Confirm Password';
        const description=document.createElement('p');description.innerHTML=message;
        const input=document.createElement('input');input.id='confirm-pw-input';input.type='password';input.placeholder='Password';input.autocomplete='current-password';
        const error=document.createElement('p');error.id='confirm-pw-error';error.className='error-message';
        const buttons=document.createElement('div');buttons.className='kv-action-buttons';
        const ok=document.createElement('button');ok.id='confirm-pw-ok';ok.className='btn btn-small '+(options.confirmClass||'kv-delete-btn');ok.textContent=options.confirmLabel||'Confirm';ok.onclick=confirm;
        const abort=document.createElement('button');abort.id='confirm-pw-cancel';abort.className='btn btn-small btn-secondary';abort.textContent='Cancel';abort.onclick=cancel;
        input.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();return confirm();}});
        buttons.append(ok,abort);root.append(heading,description,input,error,buttons);showModal(root,{hideDefaultClose:true});input.focus();
        return {root,input,error,ok,modal:document.getElementById('generic-modal')};
    },
    connected(handle){return document.getElementById('generic-modal')===handle.modal&&handle.modal.contains(handle.root);},
    busy(handle,busy){handle.ok.disabled=busy;handle.input.disabled=busy;},
    message(handle,text){handle.error.textContent=text;},
    clear(handle){handle.input.value='';},
    close(handle){handle.observer?.disconnect();this.clear(handle);if(this.connected(handle))handle.modal.remove();},
    watchClosed(handle,closed){
        const observer=new MutationObserver(()=>{if(!this.connected(handle)){observer.disconnect();this.clear(handle);closed();}});
        observer.observe(document.body,{childList:true,subtree:true});handle.observer=observer;
    },
    actionError(){console.error('A password-confirmed action failed.');showStatusMessage('The confirmed action failed. Check its results before retrying.');},
};
