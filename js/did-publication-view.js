// Publication controls/receipts; all operations and ownership remain in the controller.
window.CList.ui.didPublication={
    busy(root,busy){root.querySelector('#did-btn').disabled=busy;},
    progress(root,text){const target=root.querySelector('#did-status');target.className='me-status';target.textContent=text;},
    result(root,receipt,warnings=[]){const target=root.querySelector('#did-status');target.className='me-status';target.textContent='';
        const label=document.createElement('strong');label.textContent=receipt.existing?'DID already published.':'DID published.';
        const code=document.createElement('code');code.textContent=receipt.didKey;target.append(label,document.createElement('br'),code);
        if(warnings.length){const warning=document.createElement('p');warning.className='error-message';warning.textContent=warnings.join(' ');target.appendChild(warning);}
    },
    error(root,error){console.error('[DID publication]',error);const target=root.querySelector('#did-status');target.className='error-message';target.textContent=error.message||String(error);},
    action(root,label,run){const button=root.querySelector('#did-btn');button.textContent=label;button.onclick=run;},
};
