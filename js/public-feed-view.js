// Public reader presentation and stateless captured row controls.
function mountPublicFeedList(container) {
    const root = document.createElement('div'); root.id = 'public-feeds-list'; container.replaceChildren(root); return root;
}
function appendPublicFeedChoice(root, title, select) {
    const button = document.createElement('button'); button.className = 'btn-small account-button';
    const icon = document.createElement('span'); icon.className = 'material-icons'; icon.textContent = 'public';
    const label = document.createElement('span'); label.textContent = title;
    button.append(icon,label); button.onclick = select; root.appendChild(button);
}
function normalizePublicFeedItem(item) {
    const html = item.content_html || '', plain = _publicFeedPlainText(html);
    return { service: 'PublicFeed', url: item.link, title: item.title, desc: plain, feed: item.feed_title || '',
        titleHtml: `<strong>${escapeHtml(item.title || '')}</strong>`, expandOnTitleClick: true,
        author: item.author || item.feed_author || '', date: item.published ? new Date(item.published*1000).toLocaleDateString() : '',
        full_content: typeof window.sanitizeHtml === 'function' ? window.sanitizeHtml(html) : new SafeHtml(escapeHtml(plain)),
        link: item.link, guid: item.id != null ? String(item.id) : item.link };
}
function bindPublicFeedRow(item, row, context) {
    const root = row.querySelector('.service-status-actions') || row.querySelector('.status-actions');
    if (!root) return;
    const valid = () => row.isConnected && (!context?.isAccountCurrent || context.isAccountCurrent());
    function button(title, icon, action) {
        const el = document.createElement('button'); el.className = 'clist-action-btn'; el.title = title;
        el.innerHTML = `<span class="material-icons md-18 md-light">${icon}</span>`;
        el.onclick = () => { if (valid()) action(); }; root.appendChild(el);
    }
    if (item._hasExpandableContent) button('Expand', 'zoom_out_map', () => toggleEntryExpanded(row.querySelector('.statusSpecific').id));
    if (/^https?:\/\//i.test(item.link || item.url || '')) button('Open in browser', 'launch', () => openInBrowser(item.link || item.url));
}
function showPublicFeedNotice(container, text) {
    const p = document.createElement('p'); p.className = 'feed-status-message'; p.textContent = text; container.appendChild(p);
}
