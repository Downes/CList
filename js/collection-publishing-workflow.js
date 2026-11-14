/// <reference path="./clist-types.js" />
// Copyright Stephen Downes 2026. CC BY 4.0; provided AS IS, without warranty.

// Explicit data/dependencies only. No application controls or global state.
function _resolvePublishFormat(acceptedFormats, selectedFormatId) {
    if (!acceptedFormats || acceptedFormats.length === 0) return selectedFormatId;
    if (acceptedFormats.includes(selectedFormatId)) return selectedFormatId;
    return acceptedFormats[0];
}

function collectionOverwriteTarget(page, targets, formatId, bins, identity) {
    if (page?.kind !== 'collection' || !page.serviceId) return null;
    if (identity && page.collectionKey !== identity.key && page.id !== identity.id) return null;
    return targets.find(t => t.account.permissions?.includes('b') && bins[t.account.type]
        && t.account.type === page.service && t.account.instance === page.accountInstance
        && _resolvePublishFormat(bins[t.account.type].acceptedFormats, formatId) === page.format) || null;
}

/** @param {CListCollectionPublicationRequest} request
 * @param {CListCollectionPublishingDependencies} dependencies
 * @returns {Promise<CListCollectionPublicationOutcome>} */
async function runCollectionPublishingWorkflow(request, dependencies) {
    const { publishers, bins, formats, flatten, assertSession, save, now, onUpdate = () => {} } = dependencies;
    const snapshot = structuredClone(request);
    const full = [], limited = [];
    snapshot.targets.forEach(target => {
        const limit = parseInt(target.account.maxlength, 10);
        (target.account.permissions?.includes('b') || !(limit > 0) ? full : limited).push(target);
    });
    assertSession();
    const items = await flatten(structuredClone(snapshot.items), snapshot.identity.id);
    const outcome = { primaryUrl: null, destinations: [], publishedUrls: structuredClone(snapshot.publishedUrls),
        metadataSaved: false, metadataError: null };
    let metadataChanged = false;
    for (const target of [...full, ...limited]) {
        const account = structuredClone(target.account), bin = account.permissions?.includes('b');
        const adapter = (bin ? bins : publishers)[account.type];
        const result = { key: target.key, destination: account.title || account.type, service: account.type,
            status: 'publishing', warnings: [] };
        onUpdate({ type: 'destination', result: structuredClone(result) });
        try {
            if (!adapter?.publish) throw new Error('No publisher registered for this account.');
            const formatId = _resolvePublishFormat(adapter.acceptedFormats, snapshot.formatId);
            const format = formats[formatId];
            if (!format) throw new Error('Unknown collection format: ' + formatId);
            const linkOnly = limited.includes(target);
            let content = linkOnly && outcome.primaryUrl ? `${snapshot.name}: ${outcome.primaryUrl}`
                : format.serialize(snapshot.name, structuredClone(items), snapshot.identity.id);
            if (linkOnly && !outcome.primaryUrl) content = content.slice(0, parseInt(account.maxlength, 10));
            assertSession();
            const overwrite = bin && snapshot.overwriteKey === target.key;
            let url, serviceId;
            if (bin) {
                if (overwrite && typeof adapter.update !== 'function') throw new Error('This destination cannot overwrite a publication.');
                const response = overwrite
                    ? await adapter.update(snapshot.page.serviceId, content, format.mimeType, account)
                    : await adapter.publish(content, format.mimeType, `${snapshot.name}.${format.ext}`, account);
                url = response?.url || (overwrite ? snapshot.page.url : null);
                serviceId = response?.serviceId || (overwrite ? snapshot.page.serviceId : undefined);
            } else {
                url = await adapter.publish(account, snapshot.name, content, [], {
                    onWarning: message => { result.warnings.push(message); onUpdate({ type: 'warning', message }); },
                    onProgress: progress => onUpdate({ type: 'progress', destination: result.destination, progress }),
                });
            }
            result.status = url ? 'published' : 'unconfirmed';
            if (url) {
                result.url = url;
                if (!outcome.primaryUrl && !linkOnly) outcome.primaryUrl = url;
                if (!linkOnly) {
                    const entry = { url, format: formatId, service: account.type,
                        accountInstance: account.instance, publishedAt: now(), ...(serviceId ? { serviceId } : {}) };
                    if (overwrite) {
                        const old = outcome.publishedUrls.find(p => p.service === account.type
                            && p.accountInstance === account.instance && p.serviceId === snapshot.page.serviceId);
                        if (old) Object.assign(old, entry); else outcome.publishedUrls.push(entry);
                    } else outcome.publishedUrls.push(entry);
                    metadataChanged = true;
                }
            }
        } catch (error) { result.status = 'failed'; result.error = error.message; }
        outcome.destinations.push(result);
        onUpdate({ type: 'destination', result: structuredClone(result) });
    }
    if (metadataChanged) {
        try { assertSession(); await save(snapshot, structuredClone(outcome.publishedUrls)); outcome.metadataSaved = true; }
        catch (error) { outcome.metadataError = error.message; }
    }
    return outcome;
}
