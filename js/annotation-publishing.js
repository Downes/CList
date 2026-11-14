/// <reference path="./clist-types.js" />
// Copyright Stephen Downes 2026. CC BY 4.0; provided AS IS, without warranty.

// Controller: transient sessions/locks, data operations, and post-write effects.
function captureAnnotationSession() {
    const storeUrl = window.CList.config.flaskSiteUrl;
    return { storeUrl, token: getSiteSpecificCookie(storeUrl, window.CList.keys.ACCESS_TOKEN) || '' };
}
function assertAnnotationSession(session) {
    const current = captureAnnotationSession();
    if (current.storeUrl !== session.storeUrl || current.token !== session.token)
        throw new Error('The account session changed. Start a new annotation operation.');
}

/** @param {CListAccountData} account
 * @param {CListAnnotationRequest} request
 * @param {CListAnnotationSession} session
 * @param {function(CListAnnotationReceipt): void} [onTargetResult]
 * @returns {Promise<CListAnnotationOutcome>} */
async function runAnnotationOperation(account, request, session, onTargetResult = () => {}) {
    account = structuredClone(account); request = structuredClone(request); session = structuredClone(session);
    const state = window.CList.state.annotationPublishing ||= { active: [], last: null };
    const keys = request.targets.map(t => JSON.stringify([session.storeUrl, account.type,
        account.instance?.replace(/\/$/, ''), account.username || '', t.url]));
    if (keys.some(key => state.active.includes(key))) throw new Error('An annotation for this account and target is already being sent.');
    state.active.push(...keys);
    try {
        const outcome = await runAnnotationWorkflow(request, {
            assertSession: () => assertAnnotationSession(session), onTargetResult,
            create: payload => {
                if (account.type === 'Hypothesis') return window.hypothesisCreate(account, payload);
                if (account.type === 'gRSShopper') return window.grsshopperCreate(account, payload);
                return createStoreAnnotation(account, payload, session);
            },
        });
        state.last = structuredClone(outcome);
        return outcome;
    } finally { state.active = state.active.filter(key => !keys.includes(key)); }
}

async function publishAnnotationAccount(account, content, refs, options = {}) {
    const session = options.annotationSession || captureAnnotationSession();
    const request = captureAnnotationRequest({ body: content, references: refs,
        tags: account.type === 'Hypothesis' ? [] : options.tags || [], selectors: account.type === 'Annotate' });
    const outcome = await runAnnotationOperation(account, request, session, options.onTargetResult);
    if (!outcome.created && !outcome.uncertain) throw new Error(outcome.results.map(r => r.error).join('; '));
    return outcome.url;
}

// Compatibility entry point shared by the inline form and annotation editor.
async function _submitAnnotation(panel, itemID, url, body, tags, visibility, account, token, capturedSession) {
    try {
        const session = capturedSession || captureAnnotationSession();
        assertAnnotationSession(session);
        if (token !== undefined && account.type !== 'Hypothesis' && session.token !== token)
            throw new Error('The account session changed. Reopen the annotation controls.');
        const request = captureAnnotationRequest({ body, references: [{ url }], tags, visibility });
        const outcome = await runAnnotationOperation(account, request, session);
        window.CList.ui.annotations.show(outcome);
        return outcome.created > 0;
    } catch (error) {
        console.error('[annotations] save failed', error);
        showErrorModal(error.message, { title: 'Save failed' }); return false;
    }
}

async function flowAnnotation(anno, targetUrl, accounts, token, capturedSession) {
    const session = capturedSession || captureAnnotationSession();
    assertAnnotationSession(session);
    if (session.token !== token) throw new Error('The account session changed. Reopen the annotation controls.');
    const request = captureAnnotationRequest({ body: anno.body?.value || anno.body || '',
        references: [{ url: targetUrl, selector: { via: anno.creator?.id || anno.creator || '', via_annotation_id: anno.id || '' } }],
        tags: Array.isArray(anno.tag) ? anno.tag : [], motivation: 'flowing' });
    let outcome;
    for (const account of structuredClone(accounts).filter(a => a.type === 'Annotate')) {
        outcome = await runAnnotationOperation(account, request, session);
        if (outcome.created || outcome.uncertain) return outcome;
    }
    if (!outcome) throw new Error('No writable annotation store is available.');
    return outcome;
}

// Read-only eligibility query; collection editing remains in the existing editor.
async function offerCollectionForAnnotation(ref, session) {
    if (!ref?.url || !(ref.statusID || ref.id)) return;
    try {
        assertAnnotationSession(session);
        const key = await getEncKey(session.storeUrl);
        if (!key) return;
        assertAnnotationSession(session);
        const records = await fetchDecryptedKvRecordsByPrefix('collection:', key);
        assertAnnotationSession(session);
        if (records.some(({ value }) => _parseCollectionData(value).items.some(item => item.url === ref.url))) return;
        window.CList.ui.annotations.offerCollect(ref.statusID || ref.id);
    } catch (error) {
        console.error('[annotations] collection eligibility', error);
        window.CList.ui.publishing.notice('Annotation saved; collection availability could not be checked.');
    }
}
