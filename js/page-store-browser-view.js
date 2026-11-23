function createLocalPageBrowserView(options, doc = document) {
    const root = doc.createElement('div'), message = doc.createElement('p'), list = doc.createElement('div'), feedback = doc.createElement('div');
    message.className='list-tip'; list.className='account-list';
    const toolsControls=[];let rowControls=[];
    const alive=()=>!!root.isConnected&&root.parentNode===options;
    return {
        alive,
        mount(actions) {
            options.innerHTML=''; root.append(message,list,feedback);
            const tools=doc.createElement('div'); tools.className='published-page-confirm';
            for(const [text,action] of [['Export all pages',actions.export],['Import pages...',actions.import],['Cancel',actions.cancel]]) {
                const button=doc.createElement('button');button.className=text==='Cancel'?'btn btn-secondary':'btn btn-small';button.textContent=text;button.onclick=()=>{if(alive())return action();};tools.appendChild(button);
                if(text!=='Cancel')toolsControls.push(button);
            }
            root.appendChild(tools);options.appendChild(root);
        },
        loading(){message.textContent='Loading locally saved pages…';list.innerHTML='';feedback.innerHTML='';},
        show(summaries,select){
            message.textContent=summaries.length?'Select a locally saved page to load:':'No locally saved pages yet.';
            list.innerHTML='';feedback.innerHTML='';rowControls=[];
            for(const summary of summaries){
                const button=doc.createElement('button');button.className='account-button';
                const icon=doc.createElement('span');icon.className='material-icons';icon.textContent='description';
                const title=doc.createElement('span');title.textContent=summary.title||'(untitled)';button.append(icon,title);
                button.onclick=()=>{if(alive()&&button.parentNode===list)return select(summary.id);};list.appendChild(button);rowControls.push(button);
            }
        },
        busy(value){if(alive())for(const control of [...toolsControls,...rowControls])control.disabled=value;},
        error(title,error,retry){
            console.error('[page-store browser] '+title,error);feedback.innerHTML='';
            const text=doc.createElement('p');text.className='error-message';text.textContent=title+': '+error.message;feedback.appendChild(text);
            if(retry){const button=doc.createElement('button');button.className='btn btn-small';button.textContent='Retry';button.onclick=()=>{if(alive()&&button.parentNode===feedback)return retry();};feedback.appendChild(button);}
        }
    };
}
