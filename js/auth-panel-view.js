window.CList.ui = window.CList.ui || {};
window.CList.ui.authPanel = function(root) {
    const find = id => root.querySelector('#'+id);
    let serverError = find('authServerError');
    if (!serverError) { serverError = document.createElement('p'); serverError.id = 'authServerError'; serverError.className = 'error-message'; find('changeServerPanel').appendChild(serverError); }
    const retry=document.createElement('button');retry.id='authRegistrationRetry';retry.className='btn-small';retry.textContent='Retry registration';
    find('authMainForm').appendChild(retry);
    return {
        servers:()=>Array.from(find('serverSelect').querySelectorAll('option')).map(option=>option.value),
        input:()=>({username:find('authUsername').value, password:find('authPassword').value, confirm:find('authConfirm').value}),
        clearSecrets(){ find('authPassword').value=''; find('authConfirm').value=''; },
        reset(){
            find('authUsername').value=''; find('authPassword').value=''; find('authConfirm').value='';
            for (const name of ['authPassword','authConfirm']) { find(name).type='password'; const icon=find(name+'Toggle'); if(icon)icon.textContent='👁'; }
        },
        focus(){ find('authUsername').focus(); },
        toggle(inputId, icon){
            if (!['authPassword','authConfirm'].includes(inputId) || find(inputId+'Toggle') !== icon) return;
            const input=find(inputId); input.type=input.type==='password'?'text':'password'; icon.textContent=input.type==='password'?'👁':'🙈';
        },
        render(state, label, choose, retryAction){
            retry.onclick=retryAction;
            const register=state.mode==='register', title=register?'Register':'Login';
            retry.style.display=register&&state.error&&['uncertain','rejected'].includes(state.registration)?'inline-block':'none';retry.disabled=state.busy;
            root.style.display=state.panel==='closed'?'none':'flex';
            find('authModalTitle').textContent=state.panel==='server'?'Change Account Server':title;
            find('authSubmitBtn').textContent=state.busy?'Please wait…':title; find('authSubmitBtn').disabled=state.busy;
            find('authConfirmWrap').style.display=register?'block':'none';
            find('authUsernameHint').style.display=register?'inline':'none'; find('authUsernameRule').style.display=register?'block':'none';
            find('authServerUrl').textContent=label;
            find('authMainForm').style.display=state.panel==='server'?'none':'block';
            find('authServerLine').style.display=state.panel==='server'?'none':'block';
            find('changeServerPanel').style.display=state.panel==='server'?'block':'none';
            for(const id of ['authUsername','authPassword','authConfirm','serverSelect'])find(id).disabled=state.busy;
            for(const node of [find('authError'),serverError]){node.textContent=state.error||'';node.style.display=state.error?'block':'none';}
            const select=find('serverSelect'); if(state.panel==='server')select.value=state.draftServer||'';
            select.onchange=()=>choose(select.value);
        }
    };
};
