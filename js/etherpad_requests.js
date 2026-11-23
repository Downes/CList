// Explicit read-only connection discovery. Legacy document operations remain in etherpad.js.
async function readEtherpadPads(target, deps) {
    const response = await deps.fetch(target.proxy, {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...target.headers },
        body: new URLSearchParams({ url: target.instance.replace(/\/$/, '') + '/listAllPads', apikey: target.apiKey }),
    });
    if (!response.ok) throw new Error('Etherpad pad listing failed (HTTP ' + response.status + ').');
    const result = await response.json();
    if (result?.error) throw new Error(String(result.error));
    if (result?.code && result.code !== 0) throw new Error(result.message || 'Etherpad rejected the pad listing.');
    const pads = result?.data?.padIDs ?? result?.padIDs;
    if (!Array.isArray(pads) || pads.some(pad => typeof pad !== 'string')) throw new Error('Etherpad returned an invalid pad list.');
    return pads.slice();
}
function normalizeEtherpadGuest(base, pad, strict = false) {
    const url = new URL(base);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Enter an HTTP or HTTPS Etherpad server address without credentials.');
    const name = String(pad || '').trim();
    if (!name || (strict && !/^[a-zA-Z0-9_-]+$/.test(name))) throw new Error('Enter a pad name using letters, numbers, underscores and dashes.');
    return { base: url.origin, pad: name, url: url.origin + '/p/' + encodeURIComponent(name) };
}
