function createPageBundleExportView() {
    return {
        busy:()=>showStatusMessage('A local-page import/export is still running.'),
        exported:count=>showStatusMessage('Export handed to the browser: '+count+' page(s).'),
        error(error){console.error('[page-store export] failed',error);showErrorModal('Export failed: '+error.message,{title:'Export failed'});}
    };
}
function createPageBundleImportView(options, doc=document) {
    const root=doc.createElement('div'),file=doc.createElement('input'),policy=doc.createElement('select'),feedback=doc.createElement('div');
    file.type='file';file.accept='application/json,.json';
    for(const [value,label] of [['skip','Skip it (default)'],['replace','Replace it'],['duplicate','Import as a new copy']]){const option=doc.createElement('option');option.value=value;option.textContent=label;policy.appendChild(option);}policy.value='skip';
    const submit=doc.createElement('button'),check=doc.createElement('button'),back=doc.createElement('button');
    submit.className=check.className='btn btn-small';back.className='btn btn-secondary';submit.textContent='Import';check.textContent='Check import result';back.textContent='Back to local pages';
    const alive=()=>!!root.isConnected&&root.parentNode===options;
    return {
        alive,
        mount(actions){
            options.innerHTML='';
            const heading=doc.createElement('p');heading.className='list-tip';heading.textContent='Choose a CList pages export file (.json) to import:';
            const label=doc.createElement('p');label.className='list-tip';label.textContent='If a page has the same id as one already saved:';
            root.append(heading,file,label,policy,submit,check,back,feedback);options.appendChild(root);
            submit.onclick=()=>{if(alive())return actions.submit();};check.onclick=()=>{if(alive())return actions.check();};back.onclick=()=>{if(alive())return actions.back();};
            file.onchange=policy.onchange=()=>{if(alive())actions.change();};
        },
        selection:()=>({file:file.files?.[0]||null,policy:policy.value}),
        matches:selected=>file.files?.[0]===selected.file&&policy.value===selected.policy,
        busy(phase,locked=false){file.disabled=policy.disabled=!!phase;submit.disabled=!!phase||locked;back.disabled=phase==='importing';},
        notice(message){feedback.innerHTML='';const text=doc.createElement('p');text.className='feed-status-message';text.textContent=message;feedback.appendChild(text);},
        result(result){
            const summary=localPageImportSummary(result);feedback.innerHTML='';
            const text=doc.createElement('p');text.className=summary.problems?'error-message':'feed-status-message';text.textContent='Import finished: '+summary.text+'.';feedback.appendChild(text);
            if(summary.problems)console.error('[page-store import] partial result',result);
            for(const error of result.errors){const row=doc.createElement('p');row.textContent=error.id+': '+error.message;feedback.appendChild(row);}
            for(const reference of result.danglingReferences){const row=doc.createElement('p');row.textContent='Unresolved reference: '+reference.pageId+' → '+reference.member;feedback.appendChild(row);}
        },
        uncertain(error){console.error('[page-store import] uncertain',error);this.notice('Import could not be confirmed: '+error.message+'. Some pages may already have been imported. Review local pages before importing again.');},
        error(error){console.error('[page-store import] failed',error);feedback.innerHTML='';const text=doc.createElement('p');text.className='error-message';text.textContent='Import failed: '+error.message;feedback.appendChild(text);}
    };
}
