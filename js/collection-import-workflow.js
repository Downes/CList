/// <reference path="./clist-types.js" />
// Collection import recognition and persistence decisions; explicit data/dependencies only.
function recognizeCollectionImport(text, mimeType, filename, recognize) {
    const detected = recognize(text, mimeType || '', filename || '');
    if (!detected.collection || !Array.isArray(detected.collection.items)) throw new Error('This content is not a recognized collection.');
    let extensions = {};
    // The shared recognizer owns format validation. Retain extension properties of
    // valid JSON collections rather than narrowing them to the parser's fields.
    if (typeof text === 'string') {
        try {
            const raw = JSON.parse(text.replace(/^\uFEFF/, ''));
            if (raw && !Array.isArray(raw) && typeof raw === 'object' && Array.isArray(raw.items)) {
                extensions = { ...raw }; delete extensions.id; // Only the shared parser validates imported identity.
            }
        } catch { /* Non-JSON collection formats have no JSON extension record. */ }
    }
    return structuredClone({ ...extensions, ...detected.collection });
}
function captureCollectionImportRequest(parsed, name, identity) {
    name = String(name || '').trim();
    if (!name) throw new Error('Please enter a collection name.');
    if (!/^[a-zA-Z0-9#\-_ ]+$/.test(name)) throw new Error('Name may only contain letters, digits, spaces, #, -, and _.');
    if (!Array.isArray(parsed.items)) throw new Error('This collection has no valid entries.');
    const record = structuredClone({ ...parsed, id: identity.id, title: name, items: parsed.items });
    delete record.key; delete record.name;
    return { key: identity.key, id: identity.id, name, record };
}
function collectionImportSnapshot(record) {
    if (!record) return null;
    const copy = structuredClone(record); delete copy.key; delete copy.name;
    return JSON.stringify(copy);
}
async function persistCollectionImport(request, mode, expected, deps) {
    deps.assertCurrent();
    const latest = await deps.read(request.key);
    deps.assertCurrent();
    if (collectionImportSnapshot(latest) !== collectionImportSnapshot(expected)) {
        throw new Error('The destination collection changed. Select it again before saving.');
    }
    if (latest && !['overwrite', 'merge'].includes(mode)) throw new Error('Choose Overwrite or Merge before saving.');
    const incoming = structuredClone(request.record.items);
    const oldItems = latest?.items || [];
    const urls = new Set(oldItems.map(item => item.url).filter(Boolean));
    const membershipIds = new Set(oldItems.map(item => item.membershipId).filter(Boolean));
    const nestedIds = new Set(oldItems.filter(item => item.role === 'contains').map(item => item.collectionId).filter(Boolean));
    const additions = incoming.filter(item => {
        if (item.membershipId && membershipIds.has(item.membershipId)) return false;
        if (item.role === 'contains') return item.membershipId || !nestedIds.has(item.collectionId);
        if (item.url) return !urls.has(item.url);
        return true; // Local entries and annotation/collection stubs need not have a URL.
    });
    const record = { ...(latest || {}), ...request.record,
        items: mode === 'merge' ? [...oldItems, ...additions] : incoming,
        publishedUrls: latest ? latest.publishedUrls || [] : request.record.publishedUrls || [] };
    delete record.key; delete record.name;
    await deps.save(request.key, record, { createOnly: !latest });
    return { status: 'saved', key: request.key, id: request.id, name: request.name,
        count: record.items.length, added: mode === 'merge' ? additions.length : incoming.length };
}
