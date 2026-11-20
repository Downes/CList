window.CList.ui=window.CList.ui||{};
window.CList.ui.adminSettings={
    message(panel,text,action){
        panel.textContent='';const p=document.createElement('p');p.className='feed-status-message';p.textContent=text;panel.appendChild(p);
        if(action){const button=document.createElement('button');button.className='btn-small';button.textContent='Retry';button.onclick=action;panel.appendChild(button);}
    },
    form(panel,app,model,actions){
        panel.textContent='';const heading=document.createElement('h3');heading.textContent=app.label;panel.appendChild(heading);
        const description=document.createElement('p');description.textContent=app.description||'';panel.appendChild(description);
        for(const field of model.schema){
            const row=document.createElement('div');row.className='nav-item';const label=document.createElement('label');label.textContent=field.label;row.appendChild(label);
            const draft=model.drafts.get(field.key),value=draft?draft.value:model.values[field.key];
            if(field.sensitive&&!draft?.armed){
                const mask=document.createElement('span');mask.textContent=value?'Set (hidden)':'(not set)';row.appendChild(mask);
                const change=document.createElement('button');change.className='btn-small';change.textContent='Change';change.disabled=model.busy||model.blocked;change.onclick=()=>actions.arm(field.key);row.appendChild(change);
            }else{
                const input=document.createElement('input');input.id='admin-field-'+model.schema.indexOf(field);input.type=field.type==='boolean'?'checkbox':field.sensitive?'password':'text';label.setAttribute('for',input.id);
                if(field.type==='boolean'){
                    input.checked=value==='true';label.textContent=adminBooleanLabel(field.label,input.checked);input.disabled=model.busy||model.blocked;
                    input.onchange=()=>actions.toggle(field.key,!!input.checked);
                }else{input.value=value||'';input.placeholder=field.sensitive?'Blank leaves the saved value unchanged':'';input.oninput=()=>actions.edit(field.key,input.value);}
                row.appendChild(input);
            }
            panel.appendChild(row);
        }
        const status=document.createElement('p');status.id='admin-settings-status';status.className=model.error?'error-message':'feed-status-message';status.textContent=model.message||'';panel.appendChild(status);
        const button=(label,id,action,disabled=false)=>{const b=document.createElement('button');b.className='btn-small';b.id=id;b.textContent=label;b.disabled=disabled;b.onclick=action;panel.appendChild(b);};
        button(model.reviewed?'Save reviewed changes':'Save','admin-settings-save-btn',actions.save,model.busy||model.blocked);
        button('Check current settings','admin-settings-check-btn',actions.check,model.busy);
        button('Help','admin-settings-help-btn',actions.help);
    },
    picker(apps,select,{desktop=false,back}={}){
        const root=document.createElement('div');root.className='kvcontainer';
        const title=document.createElement('h2');title.textContent='App Settings';root.appendChild(title);
        const close=document.createElement('button');close.className='btn-small btn-secondary';close.textContent=desktop?'Close':'Back';close.onclick=back;root.appendChild(close);
        const body=document.createElement('div');if(desktop)body.style.cssText='display:flex;gap:24px;min-height:0;overflow:auto;';
        const nav=document.createElement('div'),detail=document.createElement('div');detail.id=desktop?'app-settings-modal-detail':'app-settings-detail';
        const p=document.createElement('p');p.textContent='Pick an app to view or change its admin-editable settings.';detail.appendChild(p);
        const buttons=[];for(const app of apps){const button=document.createElement('button');button.className='btn-small';button.textContent=app.label;button.onclick=()=>{if(!root.isConnected)return;for(const other of buttons)other.setAttribute('aria-pressed',String(other===button));return select(detail,app);};buttons.push(button);nav.appendChild(button);}
        body.appendChild(nav);body.appendChild(detail);root.appendChild(body);return root;
    },
    help(label,schema){
        const root=document.createElement('div'),h=document.createElement('h3');h.textContent=label+' — Field Help';root.appendChild(h);
        for(const field of schema){const p=document.createElement('p'),strong=document.createElement('strong');strong.textContent=field.label;p.appendChild(strong);const body=document.createElement('p');body.textContent=field.help||'No additional detail available.';p.appendChild(body);root.appendChild(p);}
        showStackedModal(root);return root;
    }
};
