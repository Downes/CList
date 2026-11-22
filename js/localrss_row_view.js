// Captured LocalRSS row controls. Action state/transport remains in localrss_actions.
function localrssRowButton(row, context, title, icon, action, active = false) {
    const root = row.querySelector('.service-status-actions') || row.querySelector('.status-actions');
    if (!root) return null;
    const button = document.createElement('button'); button.className = 'clist-action-btn' + (active ? ' action-active' : ''); button.title = title;
    button.innerHTML = `<span class="material-icons md-18 md-light">${icon}</span>`;
    button.onclick = () => {
        if (!row.isConnected || (context?.isAccountCurrent && !context.isAccountCurrent())) return;
        try { return Promise.resolve(action(button)).catch(error => { console.error('[LocalRSS row]',error); showStatusMessage(error?.message || String(error)); }); }
        catch (error) { console.error('[LocalRSS row]',error); showStatusMessage(error?.message || String(error)); }
    };
    root.appendChild(button); return button;
}
function bindLocalrssRow(item, row, context) {
    const id = row.querySelector('.statusSpecific')?.id || row.id;
    if (item._hasExpandableContent) localrssRowButton(row,context,'Expand','zoom_out_map',()=>toggleEntryExpanded(id));
    if (/^https?:\/\//i.test(item.link || '')) localrssRowButton(row,context,'Open in browser','launch',()=>openInBrowser(item.link,id));
    if (!context?.isAccountCurrent || context.account?.type !== 'LOCALRSS') return;
    if (item.audioIndex != null) { const index = item.audioIndex; localrssRowButton(row,context,'Play audio','play_arrow',()=>playAudio(index)); }
    const actionId = item.localrssActionId;
    const readButton = localrssRowButton(row,context,item.readAt ? 'Mark unread' : 'Mark read',item.readAt ? 'visibility_off' : 'visibility',button=>localrssToggleRead(actionId,button));
    localrssRowButton(row,context,item.bookmarked ? 'Remove bookmark' : 'Bookmark','star',button=>localrssToggleBookmark(actionId,button),!!item.bookmarked);
    if (!item.readAt && item._hasExpandableContent) {
        let fired = false;
        row.onEntryExpand = () => {
            if (fired || !row.isConnected) return;
            fired = true;
            localrssToggleRead(actionId, readButton);
        };
    }
}
function bindLocalrssFeedRow(item,row,context) {
    const id = row.querySelector('.statusSpecific')?.id || row.id;
    if (/^https?:\/\//i.test(item.link || '')) localrssRowButton(row,context,'Open feed URL in browser','launch',()=>openInBrowser(item.link,id));
    if (!context?.isAccountCurrent || context.account?.type !== 'LOCALRSS') return;
    const feedId = item.feedId, title = item.title;
    localrssRowButton(row,context,'Show posts','list',()=> context.navigate(next=>loadLocalrssView(next,
        {kind:'items',selection:{mode:'feed',feedId,title}}),'Feed posts'));
}
