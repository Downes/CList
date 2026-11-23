/** @returns {CListAccountSaveRequest} */
function collabSetupRequest(value) {
    const key = value.trim();
    if (!key) throw new Error('Please enter a WebSocket URL.');
    const url = new URL(key);
    if (!['ws:', 'wss:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('Enter a ws:// or wss:// server URL without credentials, query or fragment.');
    const base = key.replace(/^wss?:\/\//i, 'https://').replace(/\/$/, '');
    return { key, data: { type: 'Collab', instance: key, title: base.replace('https://', ''), permissions: 'e' } };
}
// Registration transport only. An accepted receipt is recorded before reading the body.
async function requestCollabRegistration(request, deps) {
    deps.assert(); deps.dispatched();
    const response = await deps.fetch(request.url, { method: 'POST', headers: { Authorization: 'Bearer ' + request.token, 'Content-Type': 'application/json' }, body: JSON.stringify({ did: request.did }) });
    if (!response.ok) {
        if (response.status >= 400 && response.status < 500 && ![408, 429].includes(response.status)) deps.rejected();
        let detail;
        try { detail = await response.json(); } catch (_) { detail = null; }
        throw new Error('Connection failed: ' + (typeof detail?.error === 'string' ? detail.error : 'HTTP ' + response.status));
    }
    deps.accepted();
    const data = await response.json();
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Registration accepted, but its response could not be read. Retry account saving without registering again.');
    deps.assert(); return data;
}
