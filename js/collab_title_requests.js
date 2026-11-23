async function inspectCollabTitle(text, snapshot, deps) {
    deps.assertCurrent(); const docId = await deps.expand(text); deps.assertCurrent();
    if (docId === snapshot.currentDocId) return { docId, current: true, exists: false };
    const wsUrl = await deps.server(); deps.assertCurrent();
    const path = docId.split('/').map(encodeURIComponent).join('/');
    const response = await deps.fetch(deps.restBase(wsUrl) + '/api/documents/' + path,
        { headers: snapshot.token ? { Authorization: 'Bearer ' + snapshot.token } : {} });
    deps.assertCurrent();
    if (!response.ok && response.status !== 404) throw Error('Could not check document title (HTTP ' + response.status + ').');
    return { docId, wsUrl, current: false, exists: response.ok };
}
