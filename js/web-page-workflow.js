/// <reference path="./clist-types.js" />
// Standalone web-page publication workflow. Explicit inputs; no UI or globals.
// Copyright Stephen Downes 2026. CC BY 4.0; provided AS IS, without warranty.

/**
 * @param {CListWebPageRequest} request
 * @param {CListAccountData} account
 * @returns {boolean}
 */
function canOverwriteWebPage(request, account) {
    const page = request.page;
    return !!(page?.kind === 'page' && page.serviceId && page.service === request.service
        && page.accountInstance === account.instance);
}

/**
 * Resolve the original destination without controls or account-loading feedback.
 * @param {CListWebPageSource} page
 * @param {CListAccountRecord[]} accounts
 * @param {function(CListAccountRecord): (CListAccountData|null)} parse
 * @returns {CListAccountData}
 */
function findWebPageAccount(page, accounts, parse) {
    const account = accounts.map(parse).filter(Boolean)
        .find(data => data.type === page.service && data.instance === page.accountInstance && (data.permissions || '').includes('b'));
    if (!account) throw new Error('Could not find a writable account this page was published with.');
    return structuredClone(account);
}

/**
 * A resolved external write and its metadata write have separate outcomes.
 * @param {CListWebPageRequest} request
 * @param {'new'|'overwrite'} mode
 * @param {CListWebPageDependencies} dependencies
 * @returns {Promise<CListWebPageOutcome>}
 */
async function runWebPagePublication(request, mode, dependencies) {
    const snapshot = structuredClone(request);
    const { adapter, createId, now, embedIdentity, saveRecord, touchRecord, recordLocalPublication, assertSession } = dependencies;
    const account = structuredClone(dependencies.account);
    if (typeof snapshot.content !== 'string' || !snapshot.content.trim()) throw new Error('Nothing to publish - the editor is empty.');
    if (typeof snapshot.mimeType !== 'string' || !snapshot.mimeType) throw new Error('The editor returned an invalid web-page content type.');
    if (mode !== 'new' && mode !== 'overwrite') throw new Error('Choose overwrite or a new version before publishing.');
    const overwrite = mode === 'overwrite';
    if (overwrite && !canOverwriteWebPage(snapshot, account)) {
        throw new Error('This page belongs to a different destination or cannot be overwritten. Publish a new version instead.');
    }
    if (typeof adapter?.[overwrite ? 'update' : 'publish'] !== 'function') throw new Error('Web-page publishing is not available for this destination.');
    const id = overwrite ? (snapshot.page.id || createId()) : createId();
    const content = embedIdentity(snapshot.content, snapshot.mimeType, snapshot.title, id);
    await assertSession();
    const published = overwrite
        ? await adapter.update(snapshot.page.serviceId, content, snapshot.mimeType, account)
        : await adapter.publish(content, snapshot.mimeType, snapshot.title, account);
    const url = published?.url || (overwrite ? snapshot.page.url : null);
    const outcome = { status: url ? 'published' : 'unconfirmed', url: url || null, id,
        loadedPage: null, localPublication: null, metadataError: null, forked: false };
    if (!url) return outcome;
    try {
        await assertSession();
        const format = (snapshot.mimeType.split('/')[1] || '').toUpperCase();
        if (overwrite) {
            const touched = await touchRecord(snapshot.page.pageKey, id, { mimeType: snapshot.mimeType, title: snapshot.title, url });
            outcome.forked = touched.forked;
            outcome.loadedPage = { ...snapshot.page, id: touched.id, pageKey: touched.pageKey,
                title: snapshot.title, url, mimeType: snapshot.mimeType, format };
        } else if (snapshot.page?.kind === 'local-page') {
            await recordLocalPublication(snapshot.page.id, { service: snapshot.service, accountId: account.instance || null, url });
            outcome.localPublication = { publicationUrl: url, format };
        } else {
            const record = { id, title: snapshot.title, url, serviceId: published.serviceId, service: snapshot.service,
                mimeType: snapshot.mimeType, accountInstance: account.instance, publishedAt: now(), authorDid: snapshot.authorDid };
            const pageKey = await saveRecord(record);
            outcome.loadedPage = { ...record, kind: 'page', pageKey, format };
        }
    } catch (error) {
        outcome.metadataError = error.message;
    }
    return outcome;
}
