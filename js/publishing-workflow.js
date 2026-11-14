/// <reference path="./clist-types.js" />
// Ordinary multi-destination publication. No controls, renderers, or global state.
// Copyright Stephen Downes 2026. CC BY 4.0; provided AS IS, without warranty.

/**
 * @param {CListPublicationRequest} request
 * @param {CListPublishingDependencies} dependencies
 * @returns {Promise<CListPublishingOutcome>}
 */
async function runPublishingWorkflow(request, { accounts, publishers, parseAccount, toText, onUpdate = () => {} }) {
    const snapshot = structuredClone(request);
    const handlers = { ...publishers };
    const targets = snapshot.selectedAccountKeys.map(key => {
        const record = accounts.find(account => account.key === key);
        const data = record && parseAccount(record);
        if (!data || !(data.permissions || '').includes('w')) return null;
        const limit = parseInt(data.maxlength, 10);
        return { key, data: structuredClone(data), charLimit: !isNaN(limit) && limit > 0 ? limit : Infinity };
    }).filter(Boolean).sort((a, b) => b.charLimit - a.charLimit);
    if (!targets.length) throw new Error('No valid publishing account is selected.');

    const results = targets.map(target => ({
        key: target.key, destination: target.data.title || target.data.type,
        service: target.data.type, status: 'pending', warnings: [],
    }));
    onUpdate({ type: 'started', destinations: structuredClone(results) });
    let primaryUrl = null;
    for (let index = 0; index < targets.length; index++) {
        const { key, data, charLimit } = targets[index];
        const result = results[index];
        const handler = handlers[data.type];
        if (typeof handler?.publish !== 'function') {
            result.status = 'skipped';
            result.error = `No publish handler registered for account type: ${data.type}`;
            onUpdate({ type: 'destination', result: structuredClone(result) });
            continue;
        }

        result.status = 'publishing';
        onUpdate({ type: 'destination', result: structuredClone(result) });
        let candidate, content;
        try {
            candidate = typeof handler.construct === 'function'
                ? handler.construct(snapshot.title, snapshot.content) : snapshot.content;
            if (typeof candidate !== 'string') throw new Error('The publisher did not construct text content.');
            if (candidate.length <= charLimit) {
                content = candidate;
            } else if (primaryUrl) {
                const link = `see ${primaryUrl}`;
                const base = toText(snapshot.title || snapshot.content);
                const maxLength = charLimit - link.length - 1;
                const prefix = maxLength > 0 ? base.substring(0, maxLength) : '';
                content = (prefix ? prefix + ' ' : '') + link;
            } else {
                result.warnings.push(`Post exceeds the ${charLimit}-character limit for "${result.destination}" and will be truncated.`);
                content = candidate.substring(0, charLimit);
            }
        } catch (error) {
            result.status = 'failed'; result.error = error.message;
            onUpdate({ type: 'destination', result: structuredClone(result) });
            continue;
        }
        for (const message of result.warnings) onUpdate({ type: 'warning', key, destination: result.destination, message });

        let url;
        try {
            url = await handler.publish(data, snapshot.title, content, structuredClone(snapshot.references), {
                onWarning: message => {
                    result.warnings.push(message);
                    onUpdate({ type: 'warning', key, destination: result.destination, message });
                },
                onProgress: progress => onUpdate({
                    type: 'progress', key, destination: result.destination,
                    progress: { stage: progress.stage, completed: progress.completed, total: progress.total },
                }),
            });
        } catch (error) {
            result.status = 'failed'; result.error = error.message;
            onUpdate({ type: 'destination', result: structuredClone(result) });
            continue;
        }
        if (url) {
            result.status = 'published'; result.url = url;
            if (!primaryUrl) primaryUrl = url;
        } else {
            result.status = 'unconfirmed';
        }
        onUpdate({ type: 'destination', result: structuredClone(result) });
    }
    return { primaryUrl, destinations: structuredClone(results) };
}

/**
 * Plain-data operation updates; credentials and controls never enter this state.
 * @param {CListPublishingOperation} operation
 * @param {CListPublishingUpdate} update
 * @returns {CListPublishingOperation}
 */
function applyPublishingUpdate(operation, update) {
    if (update.type === 'started') return { ...operation, status: 'publishing', destinations: structuredClone(update.destinations) };
    if (update.type === 'destination') {
        return { ...operation, primaryUrl: operation.primaryUrl || update.result.url || null,
            destinations: operation.destinations.map(result => result.key === update.result.key ? structuredClone(update.result) : result) };
    }
    if (update.type === 'progress') {
        return { ...operation, destinations: operation.destinations.map(result => result.key === update.key
            ? { ...result, progress: structuredClone(update.progress) } : result) };
    }
    if (update.type === 'warning') {
        return { ...operation, destinations: operation.destinations.map(result => result.key === update.key
            ? { ...result, warnings: [...result.warnings, update.message] } : result) };
    }
    return operation;
}
