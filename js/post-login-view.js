window.CList.ui=window.CList.ui||{};
window.CList.ui.postLogin={
    result(state,actions){
        const root=document.createElement('div'),line=text=>{const p=document.createElement('p');p.textContent=text;root.appendChild(p);};
        const title=document.createElement('h3');title.textContent='Logged in — account setup';root.appendChild(title);
        line(state.done+' of '+state.total+' default accounts are available. Your login has been kept.');
        for(const error of state.errors)line(error);
        if(state.uncertainServices.length)line('Check the service before retrying an unconfirmed registration. Accepted steps are kept.');
        const button=(label,action)=>{const node=document.createElement('button');node.className='btn-small';node.textContent=label;node.onclick=()=>{if(root.isConnected)return action();};root.appendChild(node);};
        button('Refresh accounts',actions.refresh);
        if(state.errors.length||state.done<state.total){button('Check setup',actions.check);button('Retry remaining setup',actions.retry);}
        for(const step of state.uncertainServices)button('Retry '+step.label+' registration',()=>actions.service(step.key));
        showModal(root);return root;
    },
    busy(root,value){if(root)for(const button of root.querySelectorAll('button'))button.disabled=value;},
    welcome(container){
        container.textContent='';const heading=document.createElement('h3');heading.textContent="You're in!";container.appendChild(heading);
        const p=document.createElement('p');p.textContent='Your account is ready. Open Read to browse subscriptions, or Accounts to manage subscriptions and connect services.';container.appendChild(p);
        const button=document.createElement('button');button.className='btn';button.textContent='Open Accounts →';button.onclick=()=>{if(button.isConnected)playAccounts();};container.appendChild(button);
    }
};
