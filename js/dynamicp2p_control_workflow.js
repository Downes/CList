// Detached control-packet validation; no DOM, PeerJS, cookies or storage.
function normalizeP2pControlPacket(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value) || typeof value.type !== 'string') throw Error('Received an invalid chat control packet.');
    if (!['peer-list', 'username-update', 'request-username', 'service-announce'].includes(value.type)) return null;
    const packet = structuredClone(value);
    if (packet.type === 'peer-list') {
        if (typeof packet.id !== 'string' || !packet.id || !Array.isArray(packet.peers)
            || packet.peers.some(id => typeof id !== 'string' || !id.trim())) throw Error('Received an invalid peer list.');
        packet.peers = [...new Set(packet.peers)];
    } else if (packet.type === 'username-update') {
        if (typeof packet.username !== 'string' || !packet.username.trim()) throw Error('Received an invalid peer username.');
        for (const field of ['did', 'didWeb']) {
            if (packet[field] != null && typeof packet[field] !== 'string') throw Error('Received an invalid peer identity.');
            packet[field] ||= null;
        }
        if (packet.publicKeyJwk != null && (typeof packet.publicKeyJwk !== 'object' || Array.isArray(packet.publicKeyJwk))) throw Error('Received an invalid peer public key.');
        packet.publicKeyJwk ||= null;
    } else if (packet.type === 'service-announce') {
        if (packet.annotationStore == null || packet.annotationStore === '') packet.annotationStore = null;
        else {
            if (typeof packet.annotationStore !== 'string') throw Error('Received an invalid annotation service URL.');
            let url; try { url = new URL(packet.annotationStore); } catch (_) { throw Error('Received an invalid annotation service URL.'); }
            if (!['http:', 'https:'].includes(url.protocol)) throw Error('Received an invalid annotation service URL.');
        }
    }
    return packet;
}
function makeP2pIdentityPacket(identity) {
    return { type: 'username-update', username: identity.username || 'Anonymous', did: identity.didKey || null,
        didWeb: identity.did || null, publicKeyJwk: identity.publicKeyJwk ? structuredClone(identity.publicKeyJwk) : null };
}
