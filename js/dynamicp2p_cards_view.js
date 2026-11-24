// Literal card rendering and callback bindings; no editor/import/collaboration operations.
function createP2pCardsView(doc = document) {
    const root = doc.getElementById('chat-messages'), controls = new WeakMap();
    const element = (tag, text, className) => { const node = doc.createElement(tag); if (text !== undefined) node.textContent = text; if (className) node.className = className; return node; };
    const button = (label, callback) => { const node = element('button', label, 'btn-small'); node.type = 'button'; node.onclick = () => callback(node); return node; };
    const link = (text, url, callback) => { const node = element('a', text); node.href = url; node.target = '_blank'; node.rel = 'noopener noreferrer'; node.onclick = event => { event?.preventDefault(); return callback(); }; return node; };
    const shell = own => {
        const wrapper = element('div'); wrapper.style.textAlign = own ? 'right' : 'left';
        const card = element('div', undefined, 'chat-share-card'); wrapper.appendChild(card); controls.set(wrapper, []); return { wrapper, card };
    };
    const remember = (row, node) => { controls.get(row).push(node); return node; };
    const finish = row => { root.appendChild(row); return row; };
    return {
        alive: () => !!root?.isConnected && doc.getElementById('chat-messages') === root,
        current: row => !!row?.isConnected && row.parentNode === root,
        share(model, actions) {
            const { wrapper, card } = shell(model.isOwn);
            const header = element('div', undefined, 'chat-share-header');
            header.append(element('strong', model.sender), element('span', ' shared ' + ({ item: 'an item', collection: 'a collection', annotation: 'an annotation' }[model.kind] || 'something') + ':')); card.appendChild(header);
            if ((model.title || model.displayUrl) && model.kind !== 'collection') {
                const title = element('div', undefined, 'chat-share-title');
                title.appendChild(model.url ? remember(wrapper, link(model.title || model.displayUrl, model.url, () => actions.open(model.url))) : element('span', model.title || model.displayUrl)); card.appendChild(title);
            }
            if (model.kind === 'collection' && model.items.length) {
                const details = element('details', undefined, 'chat-share-collection'); details.appendChild(element('summary', model.title || 'Untitled collection', 'chat-share-title'));
                const list = element('ul', undefined, 'chat-share-items');
                model.items.forEach(item => {
                    const row = element('li'); row.appendChild(element('span', item.title || item.displayUrl));
                    if (item.url) {
                        const open = element('button', undefined, 'clist-action-btn'); open.type = 'button'; open.title = 'Open in new window';
                        open.appendChild(element('span', 'launch', 'material-icons md-18 md-light')); open.onclick = event => { event?.stopPropagation(); return actions.open(item.url); }; row.appendChild(remember(wrapper, open));
                    }
                    list.appendChild(row);
                });
                details.appendChild(list); card.appendChild(details);
                const actionsRow = element('div', undefined, 'chat-share-actions'); actionsRow.appendChild(remember(wrapper, button('↓ Add to my collection', actions.import))); card.appendChild(actionsRow);
            }
            if (model.excerpt && model.kind !== 'collection') card.appendChild(element('div', model.excerpt, 'chat-share-excerpt'));
            if (['item', 'annotation'].includes(model.kind) && model.url) {
                const actionsRow = element('div', undefined, 'chat-share-actions'); actionsRow.appendChild(remember(wrapper, button('→ Load to editor', actions.load))); card.appendChild(actionsRow);
            }
            return finish(wrapper);
        },
        invite(model, actions) {
            const { wrapper, card } = shell(false);
            card.append(element('strong', model.sender), element('span', ' invites you to ' + (model.mode === 'read' ? 'view ' : 'co-edit ')), element('em', model.title));
            card.appendChild(remember(wrapper, button('Open in Collab', actions.open))); return finish(wrapper);
        },
        busy(row, value) { for (const node of controls.get(row) || []) if (node.tagName.toLowerCase() === 'button') node.disabled = value; },
        error(row, error) { showServiceError(row || root, 'Chat action failed', error.message || String(error)); },
        disposeRow(row) { for (const node of controls.get(row) || []) node.onclick = null; controls.delete(row); }
    };
}
