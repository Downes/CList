function normalizeAnnotateSetupUrl(value) {
    const key = value.trim().replace(/\/$/, '');
    if (!key) throw new Error('Please select or enter a server URL.');
    const url = new URL(key);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('Enter an HTTP(S) annotation server URL without credentials, query or fragment.');
    return key;
}
/** @returns {CListAccountSaveRequest} */
function annotateSetupRequest(values) {
    const key = normalizeAnnotateSetupUrl(values.url), title = values.title.trim();
    if (!title) throw new Error('Please enter a title.');
    return { key, data: { type: 'Annotate', instance: key, title, permissions: values.permissions.trim() || 'rw' } };
}
async function checkAnnotateSetupServer(url, deps) {
    deps.assert(); const response = await deps.fetch(url + '/health'); deps.assert();
    if (!response.ok) throw new Error('Server not reachable (HTTP ' + response.status + ')');
}
async function requestAnnotateRegistration(request, deps) {
    deps.assert(); deps.dispatched();
    const response = await deps.fetch(request.url + '/api/register', { method: 'POST', headers: { Authorization: 'Bearer ' + request.token, 'Content-Type': 'application/json' } });
    if (!response.ok) {
        if (response.status >= 400 && response.status < 500 && ![408, 429].includes(response.status)) deps.rejected();
        let detail; try { detail = await response.json(); } catch (_) { detail = null; }
        throw new Error('Registration failed: ' + (typeof detail?.detail === 'string' ? detail.detail : 'HTTP ' + response.status));
    }
    deps.accepted(); deps.assert();
}
