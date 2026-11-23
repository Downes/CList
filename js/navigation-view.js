function createNavigationView(doc,left){
    const feed=()=>doc.getElementById('feed-container');
    const rowCurrent=row=>!row?.isCListRowCurrent||row.isCListRowCurrent();
    const entries=()=>Array.from(feed()?.querySelectorAll('.status-box')||[]).filter(rowCurrent);
    const inside=(root,node)=>!!root&&!!node&&(root===node||root.contains(node));
    const target=event=>event.composedPath?.()[0]||event.target;
    const modal=()=>['generic-modal','generic-modal-stacked','authModal'].some(id=>{const node=doc.getElementById(id);return node?.isConnected&&node.style.display!=='none';})||!!doc.querySelector('dialog[open],[aria-modal="true"]');
    const editing=node=>!!node&&(node.isContentEditable||['INPUT','TEXTAREA','SELECT'].includes(String(node.tagName).toUpperCase())||!!node.closest?.('input,textarea,select,[role="textbox"],[role="combobox"],[role="listbox"],[role="menu"],audio,video'));
    const blocked=node=>modal()||editing(node)||editing(doc.activeElement);
    const details=row=>row?.querySelector('.statusSpecific');
    const find=id=>{const node=doc.getElementById(id);return inside(feed(),node)&&rowCurrent(node.closest('.status-box'))?node:null;};
    const collapse=()=>{for(const content of feed()?.querySelectorAll('.entry-full-content')||[]){if(content.style.display==='block'){content.style.display='none';const summary=find(content.id.replace(/-content$/,'-summary'));if(summary)summary.style.display='block';}}};
    return{
        feed,entries,details,blocked,
        alive:()=>left.isConnected,
        row:node=>{const row=node?.closest?.('.status-box');return inside(feed(),row)&&rowCurrent(row)?row:null;},
        interactive:node=>blocked(node)||!!node?.closest?.('a,button,input,textarea,select,audio,video,[role="slider"]'),
        readerChoice:node=>!!node?.closest?.('#read-account-list .account-button, #find-section .account-button, #public-feeds-list .account-button'),
        inFeed:node=>inside(feed(),node),
        selectedText:()=>doc.defaultView?.getSelection?.()?.toString().trim()||'',
        reference:row=>details(row)?.reference||null,
        expanded:row=>row?.querySelector('.entry-full-content')?.style.display==='block',
        highlight(row){for(const entry of entries())entry.classList.toggle('current-entry',entry===row);row?.scrollIntoView?.({block:'start',behavior:'smooth'});},
        collapse,
        expand(id){const content=find(id+'-content');if(!content)return null;collapse();content.style.display='block';const summary=find(id+'-summary');if(summary)summary.style.display='none';const row=content.closest('.status-box');if(!row)content.scrollIntoView?.({block:'start',behavior:'smooth'});return{row};},
        toggle(id){const content=find(id+'-content');if(!content)return null;if(content.style.display==='block'){content.style.display='none';const summary=find(id+'-summary');if(summary)summary.style.display='block';return{collapsed:true};}return this.expand(id);},
        bind(actions){
            const bindings=[];const on=(root,name,fn,options)=>{root.addEventListener(name,fn,options);bindings.push(()=>root.removeEventListener(name,fn,options));};
            on(doc,'keydown',event=>{const node=target(event);const intent=navigationKeyIntent({key:event.key,ctrl:event.ctrlKey,alt:event.altKey,meta:event.metaKey,repeat:event.repeat,composing:event.isComposing||event.keyCode===229,defaultPrevented:event.defaultPrevented,blocked:blocked(node)});if(intent){event.preventDefault();return actions.key(intent);}});
            on(doc,'dblclick',event=>{const node=target(event);if(!this.interactive(node)){const row=this.row(node);if(row)return actions.double(row);}});
            on(doc,'touchstart',event=>actions.start(event,target(event)),{passive:true});
            on(doc,'touchmove',event=>actions.move(event),{passive:true});
            on(doc,'touchend',event=>actions.end(event),{passive:true});on(doc,'touchcancel',()=>actions.cancel(),{passive:true});
            on(left,'click',event=>{if(!blocked(target(event))&&this.readerChoice(target(event)))actions.choice();});
            return()=>bindings.forEach(remove=>remove());
        }
    };
}
