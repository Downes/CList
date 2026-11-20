/// <reference path="./clist-types.js" />
// Explicit Following reads/deletes. Dependencies capture storage/session ownership.
const FOLLOWING_KEY_PREFIX = 'social:following:';
/** @returns {Promise<{items:CListFollowingEntry[],warnings:string[]}>} */
async function readFollowingEntries({list,getKey,decrypt,assertCurrent}) {
    assertCurrent(); const records = await list(); assertCurrent();
    const stored = records.filter(record=>record.key.startsWith(FOLLOWING_KEY_PREFIX));
    if (!stored.length) return {items:[],warnings:[]};
    const key = await getKey(); assertCurrent();
    if (!key) throw new Error('Encryption key not available — please log in again.');
    const items = [], warnings = [];
    for (const record of stored) {
        let did = record.key.slice(FOLLOWING_KEY_PREFIX.length);
        try { const text = await decrypt(key,record.value); assertCurrent(); did = JSON.parse(text).did || did; }
        catch (error) { assertCurrent(); warnings.push('A follow entry could not be decrypted; its stored identity is shown.'); }
        items.push({key:record.key,did:String(did)});
    }
    return {items,warnings};
}
async function removeFollowingEntry(key,{remove,assertCurrent}) {
    if (typeof key !== 'string' || !key.startsWith(FOLLOWING_KEY_PREFIX) || key.length===FOLLOWING_KEY_PREFIX.length) throw new Error('Invalid follow entry.');
    assertCurrent(); await remove(key);
}
