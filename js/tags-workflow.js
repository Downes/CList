// Explicit storage/encryption dependencies; preserve legacy collection:name + encrypted [] format.
async function listWriteTagCollections(kv) {
    const records=await kv.list();
    return (records || []).filter(record=>record.key.startsWith('collection:')).map(record=>record.key.replace(/^collection:/,''));
}
async function createWriteTagCollection(name, dependencies) {
    const {assertSession, getKey, encrypt, add}=dependencies;
    assertSession();
    const key=await getKey();
    assertSession();
    if (!key) throw new Error('Encryption key unavailable. Please log in again.');
    const encrypted=await encrypt(key,JSON.stringify([]));
    assertSession();
    try {
        await add(`collection:${name}`,encrypted);
        return {name,status:'created'};
    } catch (error) {
        if (error?.code==='AlreadyExists') return {name,status:'exists'};
        throw error; // Uncertain writes are never retried automatically.
    }
}
