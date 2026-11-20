// Collection editor entry preparation. Dependencies own storage, identities and bytes.
async function prepareCollectionEntryFile(file, parent, deps) {
    deps.assertCurrent();
    const detected = deps.recognize(await file.arrayBuffer(), file.type, file.name);
    deps.assertCurrent();
    if (!detected.collection) return { local: true, mimeType: detected.type, title: file.name };
    if (!deps.canPersist) throw new Error('Please log in to add a nested collection file.');
    const parsed = structuredClone(detected.collection), identity = deps.identity(parsed.id);
    if (parent?.id && (identity.id === parent.id || parsed.items.some(item => item.role === 'contains' && item.collectionId === parent.id))) {
        throw new Error('This nested collection would contain its parent.');
    }
    if (parent?.id && deps.wouldCycle) for (const item of parsed.items) {
        if (item.role === 'contains' && item.collectionId && await deps.wouldCycle(parent.id, item.collectionId)) {
            throw new Error('This nested collection would indirectly contain its parent.');
        }
        deps.assertCurrent();
    }
    deps.assertCurrent();
    const record = { ...parsed, id: identity.id, title: parsed.title || file.name, items: parsed.items,
        publishedUrls: parsed.publishedUrls || [] };
    await deps.save(identity.key, record);
    deps.assertCurrent();
    return { local: false, collectionId: identity.id, title: record.title };
}
async function listCollectionEntryTargets(parent, deps) {
    deps.assertCurrent();
    const [collections, pages] = await Promise.all([deps.collections(), deps.pages()]);
    deps.assertCurrent();
    return { collections: collections.filter(record => !parent?.id || record.id !== parent.id), pages: pages.filter(record => record.url) };
}
async function prepareExistingCollectionEntry(target, parent, deps) {
    deps.assertCurrent();
    if (target.kind === 'collection') {
        if (!target.record.id) throw new Error('Open and save this legacy collection before nesting it.');
        if (parent?.id && await deps.cycle(parent.id, target.record.id)) throw new Error('This collection already contains the parent collection.');
        deps.assertCurrent();
        return { role: 'contains', collectionId: target.record.id, title: target.record.title || target.record.name || '' };
    }
    return { title: target.record.title || target.record.url, url: target.record.url, mimeType: target.record.mimeType };
}
