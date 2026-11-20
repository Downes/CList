// Shared search controls. Provider/controller callbacks own request state.
window.CList.ui.searchProvider = {
    modes(names,selected,onSelect) { window.CList.ui.reader.menu(names,selected,onSelect,false); },
};
function bindSearchProviderRow(item,row,context) {
    const root = row.querySelector('.service-status-actions') || row.querySelector('.status-actions');
    if (!root) return;
    const id = row.querySelector('.statusSpecific')?.id || row.id;
    const current = () => row.isConnected && (!context?.isAccountCurrent || context.isAccountCurrent());
    const add = (title,icon,action) => {
        const button = document.createElement('button'); button.className = 'clist-action-btn'; button.title = title;
        button.innerHTML = `<span class="material-icons md-18 md-light">${icon}</span>`;
        button.onclick = () => {
            if (!current()) return;
            try { return Promise.resolve(action()).catch(error=>{if(current()){console.error('[search row]',error);showStatusMessage(error.message);}}); }
            catch (error) { if(current()){console.error('[search row]',error);showStatusMessage(error.message);} }
        };
        root.appendChild(button);
    };
    if (item._hasExpandableContent) add('Expand','zoom_out_map',()=>toggleEntryExpanded(id));
    const url = item.url;
    if (/^https?:\/\//i.test(url || '')) add('Open in browser','launch',()=>openInBrowser(url,id));
}
