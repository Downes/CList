// Rotation messages and recovery controls; no key/storage operations.
window.CList.ui.didRotation={
    busy(root,busy){root.querySelector('#did-btn').disabled=busy;},
    message(root,text){const target=root.querySelector('#did-status');target.className='me-status';target.textContent=text;},
    progress(root,phase){this.message(root,{preparing:'Preparing identity regeneration…',generating:'Generating replacement key…',storing:'Storing replacement key…',publishing:'Publishing replacement identity…'}[phase]||phase);},
    result(root,prepared,local,warnings=[]){const target=root.querySelector('#did-status');target.className='me-status';target.textContent='';const title=document.createElement('strong');title.textContent='Identity key regenerated.';const code=document.createElement('code');code.textContent=prepared.didKey;target.append(title,document.createElement('br'),code);if(local){const note=document.createElement('p');note.textContent='Stored locally only.';target.appendChild(note);}if(warnings.length){const warning=document.createElement('p');warning.className='error-message';warning.textContent=warnings.join(' ');target.appendChild(warning);}},
    error(root,error){console.error('[Identity rotation]',error);const target=root.querySelector('#did-status');target.className='error-message';target.textContent=error.message||String(error);},
    action(root,label,run){const button=root.querySelector('#did-btn');button.textContent=label;button.onclick=run;},
};
