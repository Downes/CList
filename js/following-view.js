// Following controls and visible feedback. No credential or storage access.
window.CList.ui.following = {
    mount(back,retry) {
        const root=document.createElement('div');root.className='kvcontainer';
        const button=document.createElement('button');button.className='btn btn-small btn-secondary';button.textContent='Back';button.onclick=back;
        const heading=document.createElement('h3');heading.textContent='Following';
        const notice=document.createElement('div');notice.className='me-status';
        const list=document.createElement('div');list.id='following-list';
        const refresh=document.createElement('button');refresh.className='btn btn-small';refresh.textContent='Refresh';refresh.onclick=retry;
        root.append(button,heading,notice,list,refresh);return {root,notice,list,refresh};
    },
    message(panel,text,error=false) {panel.notice.className=error?'error-message':'me-status';panel.notice.textContent=text;},
    loading(panel,busy) {panel.refresh.disabled=busy;},
    rows(panel,items,domain,unfollow,pending) {
        panel.list.textContent='';const rows=new Map();
        for(const item of items){
            const row=document.createElement('div');row.className='following-item';
            const label=document.createElement('span');label.className='following-name';
            const parts=item.did.split(':'),name=parts.at(-1)||item.did,host=parts[2]||'';
            if(parts[0]==='did'&&parts[1]==='web'&&/^[a-z0-9.-]+$/i.test(host)){
                const link=document.createElement('a');link.href=`https://${host}/users/${encodeURIComponent(name)}/did.html`;
                link.target='_blank';link.rel='noopener noreferrer';link.textContent=host===domain?name:`${name} (${host})`;label.appendChild(link);
            }else label.textContent=item.did;
            const button=document.createElement('button');button.className='btn btn-small';button.textContent='Unfollow';button.disabled=pending.has(item.key);
            const handle={row,button};button.onclick=()=>unfollow(item,handle);row.append(label,button);panel.list.appendChild(row);rows.set(item.key,handle);
        }
        return rows;
    },
    busy(handle,busy) {handle.button.disabled=busy;},
    removed(panel,handle) {handle.row.remove();this.message(panel,panel.list.children.length?'':'Not following anyone yet.');},
    error(panel,error) {console.error('[Following]',error);this.message(panel,error?.message||String(error),true);},
};
