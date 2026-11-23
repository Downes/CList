// Explicit Etherpad transport. No DOM, feedback or mutable account reads.
async function requestEtherpadDocument(target, method, params, deps) {
    const writing = !['getHTML', 'getText'].includes(method);
    let response, result;
    try {
        response = await deps.fetch(target.proxy, { method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...target.headers },
            body: new URLSearchParams({ ...params, url: target.instance.replace(/\/$/, '') + '/' + method, apikey: target.apiKey }) });
        if (!response.ok) {
            const error = new Error('Etherpad request failed (HTTP ' + response.status + ').');
            error.uncertain = writing && (response.status >= 500 || [408, 429].includes(response.status)); throw error;
        }
        result = await response.json();
    } catch (error) {
        if (writing && error.uncertain === undefined) error.uncertain = true;
        throw error;
    }
    if (!result || typeof result !== 'object') { const error = new Error('Etherpad returned an invalid response.'); error.uncertain = writing; throw error; }
    if (result.error) { const error = new Error(String(result.error)); error.uncertain = writing; throw error; }
    // Code 1 alone is not proof that a pad exists (it also denotes invalid arguments).
    if (method === 'createPad' && result.code === 1 && /already exist/i.test(result.message || '')) return { existing: true };
    if (result.code !== undefined && result.code !== 0) throw new Error(result.message || 'Etherpad rejected the request.');
    if (writing && result.code !== 0) { const error = new Error('Etherpad did not confirm the write.'); error.uncertain = true; throw error; }
    return method === 'createPad' ? { created: true } : (result.data ?? result);
}
async function readEtherpadGuestDocument(target, deps) {
    const url = target.webBase + '/p/' + encodeURIComponent(target.pad) + '/export/html';
    const response = await deps.fetch(target.proxy + '?url=' + encodeURIComponent(url), { headers: target.headers });
    if (!response.ok) throw new Error('Etherpad export failed (HTTP ' + response.status + ').');
    const text = await response.text();
    let result; try { result = JSON.parse(text); } catch { return text; }
    if (result?.error) throw new Error(String(result.error));
    return text;
}
async function writeEtherpadGuestDocument(target, html, deps) {
    const form = new FormData(); form.append('url', target.webBase + '/p/' + encodeURIComponent(target.pad) + '/import');
    form.append('file', new Blob([html], { type: 'text/html' }), 'content.html');
    try {
        const response = await deps.fetch(target.proxy, { method: 'POST', headers: target.headers, body: form });
        if (!response.ok) { const error = new Error('Etherpad import failed (HTTP ' + response.status + ').');
            error.uncertain = response.status >= 500 || [408, 429].includes(response.status); throw error; }
        const result = await response.json();
        if (!result || result.error || (result.code !== 0 && result.success !== true)) throw new Error(result?.error || result?.message || 'Etherpad did not confirm the import.');
        return result;
    } catch (error) { if (error.uncertain === undefined) error.uncertain = true; throw error; }
}
