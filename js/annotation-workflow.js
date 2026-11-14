/// <reference path="./clist-types.js" />
// Copyright Stephen Downes 2026. CC BY 4.0; provided AS IS, without warranty.

/** @returns {CListAnnotationRequest} */
function captureAnnotationRequest({ body, references, tags = [], visibility = 'public', motivation = 'commenting', selectors = false }) {
    if (typeof body !== 'string' || !body.trim()) throw new Error('Annotation text is required.');
    const targets = [];
    for (const ref of structuredClone(references || [])) {
        if (typeof ref.url !== 'string' || !ref.url.trim() || ref.url === '(no URL provided)' || targets.some(t => t.url === ref.url)) continue;
        const target = { url: ref.url };
        if (selectors) target.selector = Object.fromEntries(
            ['title', 'author_name', 'feed', 'created_at', 'guid'].map(key => [key, ref[key] || '']));
        if (ref.selector) target.selector = ref.selector;
        targets.push(target);
    }
    if (!targets.length) throw new Error('No target URL for this annotation.');
    return structuredClone({ body, targets, tags, visibility, motivation });
}

/** @param {CListAnnotationRequest} request
 * @param {CListAnnotationDependencies} dependencies
 * @returns {Promise<CListAnnotationOutcome>} */
async function runAnnotationWorkflow(request, { create, assertSession = () => {}, onTargetResult = () => {} }) {
    const snapshot = structuredClone(request), results = [];
    for (const target of snapshot.targets) {
        let receipt;
        try {
            assertSession();
            const annotation = await create(structuredClone({ target_url: target.url, body: snapshot.body,
                tags: snapshot.tags, visibility: snapshot.visibility, motivation: snapshot.motivation,
                ...(target.selector ? { target_selector: target.selector } : {}) }));
            const annotationId = typeof annotation?.id === 'string' ? annotation.id : null;
            const link = annotation?.links?.html || annotation?.url || annotationId;
            receipt = { targetUrl: target.url, outcome: 'created', annotationId,
                annotationUrl: typeof link === 'string' && /^https?:\/\//i.test(link) ? link : null };
        } catch (error) {
            receipt = { targetUrl: target.url, outcome: error.outcome === 'uncertain' ? 'uncertain' : 'failed',
                annotationId: null, annotationUrl: null, error: error.message };
        }
        results.push(receipt);
        onTargetResult(structuredClone(receipt));
    }
    return { results, created: results.filter(r => r.outcome === 'created').length,
        failed: results.filter(r => r.outcome === 'failed').length,
        uncertain: results.filter(r => r.outcome === 'uncertain').length,
        url: results.find(r => r.annotationUrl)?.annotationUrl || null };
}
