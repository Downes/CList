/// <reference path="./clist-types.js" />
// Shared entry point for access/link sharing. Captured resources and credentials stay private.
/** @param {CListEditorShareResource|null} resource */
function openEditorSharing(resource) {
    if (!resource) return Promise.resolve(false);
    const type = currentEditor, handler = editorHandlers[type], account = currentEditorAccount;
    const switchId = window.CList.state.editorSwitching?.id, source = JSON.stringify([readerSession(), window.CList.state.authEpoch || 0]);
    const session = readerSession();
    const contextCurrent = () => resource.current() && account === currentEditorAccount && switchId === window.CList.state.editorSwitching?.id && source === JSON.stringify([readerSession(), window.CList.state.authEpoch || 0]);
    const current = () => currentEditor === type && contextCurrent();
    if (!current()) return Promise.resolve(false);
    const links = resource.links || {edit:getRealtimeDocShareLink(resource.server,resource.docId,'edit'),read:getRealtimeDocShareLink(resource.server,resource.docId,'read')};
    for(const link of Object.values(links)) {
        const url=new URL(link);
        if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw new Error('Share links must be public HTTP(S) URLs without embedded credentials.');
    }
    const target = {...resource, links, editorType:type, editorName:handler.label || type, token:session.token, source};
    return openCollabSharePanel(target, {
        current, contextCurrent, accessSettings:resource.accessSettings !== false,
        writeKey:JSON.stringify([source,resource.server,resource.docId]),
        read:(captured,assertCurrent)=>readCollabAccess(captured,{assertCurrent,restBase:wsUrlToRestBase,fetch:(...args)=>fetch(...args)}),
        write:(captured,value,operation,assertCurrent)=>writeCollabAccess(captured,value,operation,{assertCurrent,restBase:wsUrlToRestBase,fetch:(...args)=>fetch(...args)}),
        link:mode=>links[mode],
        copy:(link,isCurrent)=>copyToClipboard(link,{successMsg:'Link copied to clipboard.',isCurrent}),
        chatCurrent:()=>!!target.discussion && target.discussion===(typeof activeDiscussionName!=='undefined'?activeDiscussionName:null) && target.chatOwner===(typeof _p2pSession!=='undefined'?_p2pSession:null),
        chat:invite=>typeof window.sendCollabInvite==='function'&&window.sendCollabInvite(invite),
        post:captured=>window.openCollabSharePost(captured.mode,captured),
        state:value=>{window.CList.state.collabSharing=value},
    });
}
function refreshEditorShareButton() {
    const button=document.getElementById('editor-share-button');if(!button)return;
    try { const resource=editorHandlers[currentEditor]?.getSharing?.();button.hidden=!resource || !resource.current(); }
    catch(error){button.hidden=true;console.error('Editor sharing unavailable:',error);showStatusMessage('Sharing is unavailable: '+error.message);}
}
async function shareActiveEditor() {
    try {const resource=editorHandlers[currentEditor]?.getSharing?.();if(!resource||!resource.current()){refreshEditorShareButton();return false;}return await openEditorSharing(resource);}
    catch(error){console.error('Could not share editor:',error);showErrorModal(error.message||String(error),{title:'Could not share editor'});return false;}
}
// Resource owners notify after committing connections/documents; the observer is a fallback.
let _editorShareRefreshQueued=false;
function notifyEditorSharingChanged() {
    if(_editorShareRefreshQueued)return;
    _editorShareRefreshQueued=true;
    queueMicrotask(()=>{_editorShareRefreshQueued=false;refreshEditorShareButton()});
}
if (typeof MutationObserver !== 'undefined') {
    const pane=document.getElementById('write-pane');
    if(pane)new MutationObserver(notifyEditorSharingChanged).observe(pane,{childList:true,subtree:true,characterData:true});
}
refreshEditorShareButton();
