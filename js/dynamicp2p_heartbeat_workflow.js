// A heartbeat acknowledges activity; it does not confirm discussion publication.
async function sendP2pHeartbeat(target, deps) {
    const response = await deps.fetch(target.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + target.token },
        body: JSON.stringify({ name: target.name, peerId: target.peerId })
    });
    if (response.status === 401) return 'expired';
    if (!response.ok) throw Error('Heartbeat returned HTTP ' + response.status + '.');
    return 'accepted';
}
