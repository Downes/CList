function collabShareSettingsUrl(target, restBase) {
    return restBase(target.server) + '/api/documents/' + encodeURIComponent(target.docId);
}
async function readCollabAccess(target, deps) {
    deps.assertCurrent();
    const response = await deps.fetch(collabShareSettingsUrl(target, deps.restBase), { headers: target.token ? { Authorization: 'Bearer ' + target.token } : {}, cache: 'no-store' });
    deps.assertCurrent(); if (!response.ok) throw Error('Could not read sharing settings (HTTP ' + response.status + ').');
    const body = await response.json(); deps.assertCurrent();
    if (!body || typeof body !== 'object' || Array.isArray(body) || (body.allow_anonymous != null && typeof body.allow_anonymous !== 'boolean')) throw Error('Invalid sharing settings response.');
    return body.allow_anonymous || false;
}
async function writeCollabAccess(target, value, operation, deps) {
    deps.assertCurrent();
    if (!target.token) throw Error('Log in before changing sharing settings.');
    operation.receipt = 'uncertain'; // From dispatch onward, loss of a response does not prove failure.
    let response;
    try { response = await deps.fetch(collabShareSettingsUrl(target, deps.restBase), { method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + target.token }, body: JSON.stringify({ allow_anonymous: value }) }); }
    catch (error) { throw new Error('Sharing update could not be confirmed. Check current settings before trying again.', { cause: error }); }
    if (!response.ok) {
        operation.receipt = response.status >= 500 || [408,429].includes(response.status) ? 'uncertain' : 'rejected';
        throw Error('Sharing update returned HTTP ' + response.status + '.' + (operation.receipt === 'uncertain' ? ' Check current settings before trying again.' : ''));
    }
    operation.receipt = 'accepted'; // Retain acceptance even if the panel/session expired.
}
