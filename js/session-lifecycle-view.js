window.CList.ui=window.CList.ui||{};
window.CList.ui.sessionLifecycle={
    guest(){window.CList.accounts=[];setLoggedOutUI();displayUsername();},
    authenticated(){loginNotRequired();displayUsername();},
    accounts(accounts){window.CList.accounts=accounts;populateReadAccountList(accounts);populatePostOptions(accounts);updateUIVisibility();},
    notice(message){if(message)showStatusMessage(message);},
    failed(message,retry){
        const root=document.createElement('div'),p=document.createElement('p');p.textContent=message;root.appendChild(p);
        if(retry){const button=document.createElement('button');button.className='btn-small';button.textContent='Retry';button.onclick=()=>{if(root.isConnected)return retry();};root.appendChild(button);}
        showModal(root);
    }
};
