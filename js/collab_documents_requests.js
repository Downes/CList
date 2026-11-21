async function readCollabDocuments(snapshot, deps) {
    deps.assertCurrent();
    if (!snapshot.token) throw Error('Log in to browse collaboration documents.');
    const accounts = snapshot.accounts.length ? snapshot.accounts : await deps.accounts(snapshot.storeUrl);
    deps.assertCurrent();
    if (!Array.isArray(accounts)) throw Error('Could not read collaboration accounts.');
    const wsUrl = deps.server(accounts) || snapshot.defaultServer;
    if (!/^wss?:\/\/|^https?:\/\//.test(wsUrl)) throw Error('Invalid collaboration server URL.');
    const response = await deps.fetch(deps.restBase(wsUrl) + '/api/documents', { headers: { Authorization: 'Bearer ' + snapshot.token } });
    deps.assertCurrent();
    if (!response.ok) throw Error('Server returned ' + response.status);
    const data = await response.json(); deps.assertCurrent();
    if (!Array.isArray(data)) throw Error('Invalid collaboration document list.');
    const documents = data.map(record => {
        if (!record || typeof record.id !== 'string' || !record.id || (record.title != null && typeof record.title !== 'string')) throw Error('Invalid collaboration document entry.');
        return { id: record.id, title: record.title || '' };
    });
    return { wsUrl, documents };
}
