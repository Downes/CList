// First-time generation controls and storage feedback; no crypto or persistence.
window.CList.ui.didGeneration={
    busy(root,busy){root.querySelector('#did-btn').disabled=busy;},
    progress(root,phase){const target=root.querySelector('#did-status');target.className='me-status';target.textContent={preparing:'Checking stored identity…',generating:'Generating key pair…',storing:'Storing private key…'}[phase]||phase;},
    stored(root,receipt,local){const target=root.querySelector('#did-status');target.className='me-status';target.textContent='';
        const label=document.createElement('strong');label.textContent=receipt.existing?'Existing identity key preserved.':'Identity key generated.';
        const code=document.createElement('code');code.textContent=receipt.didKey;target.append(label,document.createElement('br'),code);
        if(local){const text=document.createElement('p');text.textContent='Stored locally only — no public DID document, since this account has no server to publish one to.';target.appendChild(text);}
    },
    error(root,error){console.error('[Identity generation]',error);const target=root.querySelector('#did-status');target.className='error-message';target.textContent=error.message||String(error);},
    action(root,label,run){const button=root.querySelector('#did-btn');button.textContent=label;button.onclick=run;},
};
