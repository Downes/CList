function createP2pDiscussionsView(doc = document) {
    const root = doc.getElementById('discussion-list'); let rows = [];
    const clear = () => { for (const row of rows) row.button.onclick = null; rows = []; root.innerHTML = ''; };
    const message = text => { clear(); const row = doc.createElement('li'); row.className = 'feed-status-message'; row.textContent = text; root.appendChild(row); };
    return {
        alive: () => !!root?.isConnected && doc.getElementById('discussion-list') === root,
        current: index => rows[index]?.node.parentNode === root && rows[index]?.button.parentNode === rows[index]?.node,
        loading: () => message('Loading discussions…'),
        login: () => message('Please log in to view or join discussions.'),
        empty: () => message('No discussions available. Why not create one yourself?'),
        show(items, join) {
            clear();
            items.forEach((item, index) => {
                const row = doc.createElement('li'), button = doc.createElement('button');
                row.style.listStyleType = 'none'; button.type = 'button'; button.className = 'btn';
                button.textContent = 'Join ' + item.name; button.onclick = () => join(index);
                const status = doc.createElement('span'); status.className = 'list-tip'; status.setAttribute('role', 'status');
                row.append(button, status); root.appendChild(row); rows.push({ node: row, button, status });
            });
        },
        joining(indices, value) { indices.forEach(index => { if (rows[index]) rows[index].button.disabled = value; }); },
        joined(index, existing) { if (rows[index]) { rows[index].status.className = 'list-tip'; rows[index].status.textContent = existing ? 'Already connected or connecting.' : 'Connection requested.'; } },
        joinFailed(index, error) { if (rows[index]) { rows[index].status.className = 'error-message'; rows[index].status.textContent = error.message || String(error); } },
        failed(error, retry) {
            clear(); showServiceError(root, 'Could not load discussions', error.message || String(error));
            const button = doc.createElement('button'); button.type = 'button'; button.className = 'btn btn-small';
            button.textContent = 'Retry'; button.onclick = retry;
            const row = doc.createElement('li'); row.appendChild(button); root.appendChild(row);
            rows.push({ node: row, button });
        },
        dispose() { for (const row of rows) row.button.onclick = null; rows = []; }
    };
}
