// Identity read presentation. Legacy write controllers keep their existing handlers.
window.CList.ui.didIdentity={
    status(root,model){
        const status=root.querySelector('#did-status');status.textContent='';status.className='me-status';
        const line=(label,value)=>{const text=document.createElement('span');text.textContent=label;const code=document.createElement('code');code.textContent=value;status.append(text,code,document.createElement('br'));};
        if(model.kind==='published'){
            line('DID: ',model.id);if(model.alsoKnownAs.length)line('also known as: ',model.alsoKnownAs.join(', '));
            const link=document.createElement('a');link.href=model.url;link.target='_blank';link.rel='noopener noreferrer';link.textContent='View DID document';status.appendChild(link);
        }else if(model.kind==='local'){
            line('did:key: ',model.didKey);const note=document.createElement('span');note.textContent='Stored locally only — no public DID document, since this account has no server to publish one to.';status.appendChild(note);
        }else status.textContent=model.kind==='unpublished'?'An identity key is already stored on this account (likely copied in via import) but not published on this server yet.':model.local?'No identity key yet.':'No DID registered yet.';
    },
    accounts(root,items,warnings,options={}){
        const list=root.querySelector('#account-list');list.textContent='';list.className='me-status';
        if(warnings.length){const message=document.createElement('p');message.className='error-message';message.textContent=warnings.join(' ');list.appendChild(message);}
        if(!items.length){const empty=document.createElement('p');empty.textContent='No social or blog accounts found. Add Mastodon, Bluesky, WordPress, or Blogger accounts via the Accounts panel.';list.appendChild(empty);}
        items.forEach((item,index)=>{
            const row=document.createElement('div');row.className='account-row';const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.id='did-public-'+index;checkbox.dataset.key=item.key;checkbox.checked=options.selection?.has(item.key)?options.selection.get(item.key):item.public;checkbox.disabled=!!options.busy;checkbox.onchange=()=>options.onChange?.(item.key,checkbox.checked);
            const label=document.createElement('label');label.htmlFor=checkbox.id;const title=document.createElement('strong');title.textContent=item.title;
            const type=document.createElement('span');type.className='account-type';type.textContent=item.type;label.append(title,type);row.append(checkbox,label);list.appendChild(row);
        });
    },
    message(root,lane,text,error=false){const target=root.querySelector(lane==='identity'?'#did-status':'#account-list');target.textContent=text;target.className=error?'error-message':'me-status';},
    retry(root,lane,load){const target=root.querySelector(lane==='identity'?'#did-status':'#account-list');const button=document.createElement('button');button.className='btn btn-small';button.textContent='Retry';button.onclick=load;target.appendChild(button);},
    sections(root,active,local){
        const ids=['did-regen-help','did-remove-help','prove-identity-section','migrate-section'];if(!local)ids.push('public-accounts-section');
        ids.forEach(id=>root.querySelector('#'+id).style.display=active?'':'none');if(local)root.querySelector('#public-accounts-section').style.display='none';
        if(!active)root.querySelector('#did-remove-help').removeAttribute('open');
    },
};
