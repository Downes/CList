/// <reference path="./clist-types.js" />
// Explicit collection records/memberships. No UI, global state or transport discovery.
/** @returns {CListCollectionBrowseRecord} */
function normalizeCollectionRecord(key, raw, parse) {
    if (typeof raw === 'string') raw = JSON.parse(raw);
    if (!raw || typeof raw !== 'object') throw new Error('Invalid collection record.');
    const parsed = parse(raw);
    if (!Array.isArray(parsed.items) || !parsed.items.every(item => item && typeof item === 'object')) throw new Error('Invalid collection members.');
    const title = parsed.title || key.replace(/^collection:/, '');
    return { ...(!Array.isArray(raw) ? structuredClone(raw) : {}), ...parsed,
        key, title, name: title, items: structuredClone(parsed.items), publishedUrls: structuredClone(parsed.publishedUrls || []) };
}
async function listCollectionRecords(deps) {
    deps.assertSession();
    const records = await deps.list(); deps.assertSession();
    const collections = [], warnings = [];
    for (const record of records || []) {
        if (!record.key.startsWith('collection:')) continue;
        try {
            const raw = await deps.decrypt(record.value); deps.assertSession();
            collections.push(normalizeCollectionRecord(record.key, raw, deps.parse));
        } catch (error) {
            deps.assertSession(); warnings.push({ key: record.key, message: error?.message || String(error) });
        }
    }
    return { collections, warnings };
}
/** @returns {Promise<CListCollectionBrowseRecord|null>} */
async function readCollectionSnapshot(key, deps) {
    deps.assertSession();
    const record = await deps.get(key); deps.assertSession();
    if (!record) return null;
    const raw = await deps.decrypt(record.value); deps.assertSession();
    return normalizeCollectionRecord(key, raw, deps.parse);
}
function collectionStoredValue(record) {
    const { key, name, feedSubscription, ...stored } = structuredClone(record);
    return { ...stored, title: record.title ?? name, items: structuredClone(record.items || []),
        publishedUrls: structuredClone(record.publishedUrls || []) };
}
async function saveCollectionRecord(key, record, deps, { createOnly = false } = {}) {
    deps.assertSession();
    if (!key?.startsWith('collection:')) throw new Error('Invalid collection key.');
    const value = collectionStoredValue(record);
    const encrypted = await deps.encrypt(JSON.stringify(value)); deps.assertSession();
    await (createOnly ? deps.add(key, encrypted) : deps.put(key, encrypted));
    return { ...structuredClone(value), key, name: value.title };
}
/** @param {CListCollectionBrowseRecord} captured */
async function deleteCollectionRecord(captured, deps) {
    const current = await readCollectionSnapshot(captured.key, deps);
    if (!current) return { removed: true };
    if (JSON.stringify(collectionStoredValue(current)) !== JSON.stringify(collectionStoredValue(captured))) {
        throw new Error('This collection has changed. Reopen it before deleting.');
    }
    deps.assertSession(); await deps.remove(captured.key);
    return { removed: true };
}
/** @param {CListCollectionBrowseRecord} captured @param {CListCollectionMember} member */
async function removeCollectionMembership(captured, member, deps) {
    const current = await readCollectionSnapshot(captured.key, deps);
    if (!current || current.id !== captured.id) throw new Error('The collection changed. Reopen it before removing an item.');
    let index;
    if (member.membershipId) {
        index = current.items.findIndex(item => item.membershipId === member.membershipId);
        if (index < 0) throw new Error('This membership no longer exists. Reopen the collection.');
        if (JSON.stringify(current.items[index]) !== JSON.stringify(member)) throw new Error('This membership has changed. Reopen the collection.');
    } else {
        // Old memberships have no durable ID: require an unchanged list and use
        // the selected ordinal, so identical duplicates remain independent.
        if (JSON.stringify(current.items) !== JSON.stringify(captured.items)) throw new Error('This legacy collection changed. Reopen it before removing an item.');
        index = captured.items.indexOf(member);
        if (index < 0) throw new Error('The selected membership is no longer current.');
    }
    current.items.splice(index, 1);
    return saveCollectionRecord(current.key, current, deps);
}
async function collectionWouldCycle(parentId, childId, deps, seen = new Set()) {
    if (!parentId || !childId) return false;
    if (parentId === childId) return true;
    if (seen.has(childId)) return false;
    seen.add(childId);
    const { collections } = await listCollectionRecords(deps);
    const child = collections.find(record => record.id === childId);
    if (!child) throw new Error('A nested collection could not be found. Reopen the collection.');
    for (const item of child.items) {
        if (item.role === 'contains' && item.collectionId && await collectionWouldCycle(parentId, item.collectionId, deps, seen)) return true;
    }
    return false;
}
async function addCollectionMembership(target, title, member, deps) {
    let current;
    if (target) {
        current = await readCollectionSnapshot(target.key, deps);
        if (!current || current.id !== target.id) throw new Error('The selected collection changed. Reopen the picker.');
        current.id ||= deps.createIdentity().id;
    } else {
        const identity = deps.createIdentity();
        current = { ...identity, title, name: title, items: [], publishedUrls: [] };
    }
    if (member.role === 'contains' && await collectionWouldCycle(current.id, member.collectionId, deps)) {
        throw new Error('This would nest a collection inside itself. Choose another collection.');
    }
    const duplicate = !!member.url && current.items.some(item => item.url === member.url);
    current.items.push({ ...structuredClone(member), membershipId: deps.createMemberId() });
    const saved = await saveCollectionRecord(current.key, current, deps, { createOnly: !target });
    return { collection: saved, duplicate };
}
