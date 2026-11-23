// Explicit directory writes. HTTP acceptance is independent of response bodies/local effects.
async function writeP2pDiscussion(operation, { fetch }) {
    const body = operation.kind === 'create'
        ? { name: operation.name, peerId: operation.peerId, public: operation.public }
        : { name: operation.name };
    let response;
    try {
        response = await fetch(operation.url, { method: operation.kind === 'create' ? 'POST' : 'DELETE',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (operation.token || '') }, body: JSON.stringify(body) });
    } catch (error) { return { status: 'uncertain', message: error.message || String(error) }; }
    if (response.ok) return { status: 'accepted', message: '' };
    const rejected = response.status >= 400 && response.status < 500 && response.status !== 408;
    return { status: rejected ? 'rejected' : 'uncertain', message: 'Discussion service returned HTTP ' + response.status + '.' };
}
