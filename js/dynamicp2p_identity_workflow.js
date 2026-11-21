// Explicit read/crypto dependencies only; no UI, globals, key generation or writes.
async function readP2pPrivateKeyMaterial(deps) {
    deps.assertCurrent(); const encryptionKey = await deps.getKey(); deps.assertCurrent();
    if (!encryptionKey) return null;
    const read = async () => {
        try { const row = await deps.getRecord(); deps.assertCurrent(); return row; }
        catch (error) { deps.assertCurrent(); if (error.code === 'NotFound') return null; throw error; }
    };
    const row = await read(); if (!row) return null;
    if (typeof row.value !== 'string') throw Error('Stored chat identity is invalid.');
    const key = await deps.decrypt(row.value, encryptionKey); deps.assertCurrent();
    const latest = await read();
    if (latest?.value !== row.value) throw Error('The chat identity key changed. Reload identity before signing.');
    return { key, encrypted: row.value, encryptionKey };
}
function p2pPublicJwk(value) {
    if (value == null) return null;
    if (typeof value !== 'object' || Array.isArray(value)) throw Error('The chat DID document has an invalid public key.');
    const publicKey = structuredClone(value); delete publicKey.d; return publicKey;
}
async function readP2pChatIdentity(target, deps) {
    deps.assertCurrent();
    if (!target.username) return null;
    if (target.local) {
        const material = await readP2pPrivateKeyMaterial(deps); if (!material) return null;
        const derived = await deps.derive(material.encrypted, material.encryptionKey); deps.assertCurrent();
        const latest = await deps.getRecord(); deps.assertCurrent();
        if (latest?.value !== material.encrypted) throw Error('The chat identity key changed. Reload identity before signing.');
        return { did: null, didKey: derived.didKey || null, publicKeyJwk: p2pPublicJwk(derived.publicKeyJwk), key: material.key };
    }
    const response = await deps.fetch(target.storeUrl.replace(/\/$/, '') + '/users/' + encodeURIComponent(target.username) + '/did.json', { signal: deps.signal }); deps.assertCurrent();
    if (response.status === 404) return null;
    if (!response.ok) throw Error('Could not load chat DID (HTTP ' + response.status + ').');
    const doc = await response.json(); deps.assertCurrent();
    if (!doc || typeof doc !== 'object' || Array.isArray(doc) || (doc.id != null && typeof doc.id !== 'string')) throw Error('The chat DID document is invalid.');
    const publicKeyJwk = p2pPublicJwk(doc.verificationMethod?.[0]?.publicKeyJwk);
    const key = await deps.loadKey(); deps.assertCurrent();
    return { did: doc.id || null, didKey: Array.isArray(doc.alsoKnownAs) ? doc.alsoKnownAs.find(value => typeof value === 'string' && value.startsWith('did:key:')) || null : null,
        publicKeyJwk, key };
}
async function signP2pChatText(text, key, deps) {
    if (!key) return null;
    const standard = await deps.sign(key, text);
    return standard.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
async function verifyP2pChatText(text, signature, publicKey, deps) {
    if (!publicKey || !signature) return null;
    if (typeof signature !== 'string') throw Error('Invalid chat signature.');
    const standard = signature.replace(/-/g, '+').replace(/_/g, '/');
    return deps.verify(structuredClone(publicKey), text, standard.padEnd(Math.ceil(standard.length / 4) * 4, '='));
}
