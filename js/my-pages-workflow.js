/// <reference path="./clist-types.js" />
// Explicit My Pages reads and deletion. No controls, account discovery, or global storage.
async function listMyPages(deps) {
    deps.assertSession();
    const records = await deps.list();
    deps.assertSession();
    const pages = [], warnings = [];
    for (const record of records || []) {
        if (!record.key.startsWith('page:') && !record.key.startsWith('collection:')) continue;
        try {
            const raw = await deps.decrypt(record.value);
            deps.assertSession();
            if (record.key.startsWith('collection:')) {
                const col = deps.parseCollection(raw);
                for (const pub of col.publishedUrls || []) pages.push({ ...pub, kind: 'collection', collectionKey: record.key,
                    id: col.id, title: col.title || record.key.slice(11) });
            } else {
                const rec = typeof raw === 'string' ? JSON.parse(raw) : raw;
                if (!rec || typeof rec !== 'object') throw new Error('Invalid page record');
                pages.push({ ...rec, kind: 'page', pageKey: record.key, format: (rec.mimeType || '').split('/')[1]?.toUpperCase() || '' });
            }
        } catch (error) {
            deps.assertSession(); // Session expiry is not an unreadable-record warning.
            warnings.push({ key: record.key, error: error.message || String(error) });
        }
    }
    deps.assertSession();
    return { pages, warnings };
}
async function fetchMyPage(page, deps) {
    deps.assertSession();
    if (!/^https?:\/\//i.test(page.url || '')) throw new Error('This page has no loadable web address.');
    const response = await deps.fetch(page.url);
    if (!response.ok) throw new Error(`Fetch error ${response.status}`);
    const text = await response.text();
    deps.assertSession();
    return text;
}
function sameMyPagePublication(a, b) {
    return a.url === b.url && a.service === b.service && a.accountInstance === b.accountInstance
        && a.serviceId === b.serviceId && a.format === b.format;
}
async function readCurrentMyPageTarget(page, deps) {
    deps.assertSession();
    const records = await deps.list();
    deps.assertSession();
    const record = (records || []).find(item => item.key === page.pageKey);
    if (!record) return null;
    const raw = await deps.decrypt(record.value);
    deps.assertSession();
    const current = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!current || current.id !== page.id || !sameMyPagePublication(
        { ...current, format: (current.mimeType || '').split('/')[1]?.toUpperCase() || '' }, page)) {
        throw new Error('This page record has changed. Reopen My Pages before deleting it.');
    }
    return current;
}
/** Delete once, then clean metadata. Retain the receipt if metadata fails. */
async function deleteMyPage(page, receipt, deps) {
    const result = { remoteDeleted: !!receipt?.remoteDeleted, metadataRemoved: false, metadataError: null };
    deps.assertSession();
    if (page.kind === 'page' && !result.remoteDeleted && !await readCurrentMyPageTarget(page, deps)) {
        throw new Error('This page record no longer exists. Reopen My Pages before deleting it.');
    }
    if (page.serviceId && page.service && !result.remoteDeleted) {
        if (!deps.deleteRemote) throw new Error('The original destination cannot delete this page. Its My Pages record was kept.');
        await deps.deleteRemote(page.serviceId);
        result.remoteDeleted = true;
    }
    try {
        deps.assertSession();
        if (page.kind === 'page') {
            if (!page.pageKey) throw new Error('Missing page record key.');
            if (await readCurrentMyPageTarget(page, deps)) await deps.remove(page.pageKey);
        } else {
            const records = await deps.list();
            deps.assertSession();
            const record = (records || []).find(item => item.key === page.collectionKey);
            if (record) {
                const raw = await deps.decrypt(record.value);
                const col = { ...(!Array.isArray(raw) ? raw : {}), ...deps.parseCollection(raw) };
                col.publishedUrls = (col.publishedUrls || []).filter(pub => !sameMyPagePublication(pub, page));
                // Preserve unrelated extension metadata as well as every member.
                const encrypted = await deps.encrypt(JSON.stringify(col));
                deps.assertSession();
                await deps.update(record.key, encrypted);
            }
        }
        result.metadataRemoved = true;
    } catch (error) { result.metadataError = error.message || String(error); }
    return result;
}
