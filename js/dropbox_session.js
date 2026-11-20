/// <reference path="./clist-types.js" />
// Transient Dropbox account/session captures. No controls or feedback.
/**
 * @param {{account:CListAccountRecord,parsedValue:CListAccountData}|null} found
 * @param {string|null} [permission]
 * @returns {CListDropboxSession}
 */
function captureDropboxSession(found, permission = null) {
    if (!found?.account || !found.parsedValue) throw new Error('No Dropbox account configured. Add one in Accounts.');
    const storeUrl = window.CList.config.flaskSiteUrl;
    const capture = { username: window.CList.state.username, storeUrl,
        token: getSiteSpecificCookie(storeUrl, window.CList.keys.ACCESS_TOKEN),
        key: found.account.key, expectedValue: found.account.value,
        data: structuredClone(found.parsedValue), permission };
    assertDropboxSession(capture);
    return capture;
}
/** @param {CListDropboxSession} capture */
function assertDropboxSession(capture) {
    if (!capture.username || !capture.token || capture.username !== window.CList.state.username
        || capture.storeUrl !== window.CList.config.flaskSiteUrl
        || capture.token !== getSiteSpecificCookie(capture.storeUrl, window.CList.keys.ACCESS_TOKEN)) {
        throw new Error('The Dropbox session changed. Reopen the file controls before continuing.');
    }
    const account = (window.CList.accounts || []).find(record => record.key === capture.key);
    if (!account || account.value !== capture.expectedValue || capture.data.type !== 'Dropbox'
        || (capture.permission && !(capture.data.permissions || '').includes(capture.permission))) {
        throw new Error('The Dropbox account changed or was removed. Reopen the file controls.');
    }
    if (!capture.data.id || typeof capture.data.id !== 'string') throw new Error('Dropbox authorization is missing. Re-authorize it in Accounts.');
    return true;
}
/** @param {CListDropboxSession} capture */
function createDropboxRequestClient(capture, onProgress = () => {}) {
    return { async call(operation) {
        assertDropboxSession(capture);
        try { return await operation(capture.data.id); }
        catch (error) {
            // Only an explicit authentication rejection is safe to replay. A timeout,
            // lost upload response, or error containing the digits 401 is not one.
            if (error?.status !== 401 || !capture.data.refresh || error.missingScope) throw error;
            assertDropboxSession(capture);
            onProgress('Refreshing Dropbox token…');
            const token = await _dropboxRefresh(capture.data.appKey, capture.data.refresh);
            assertDropboxSession(capture);
            const session = { storeUrl: capture.storeUrl, token: capture.token,
                encKey: await getEncKey(capture.storeUrl), isCurrent: () => assertDropboxSession(capture) };
            assertDropboxSession(capture);
            const data = { ...capture.data, id: token, title: capture.data.title || capture.key };
            const result = await saveAccount({ key: capture.key, data }, session);
            assertDropboxSession(capture);
            const account = window.CList.accounts.find(record => record.key === capture.key);
            account.value = JSON.stringify(result.data);
            capture.expectedValue = account.value; capture.data = structuredClone(result.data);
            assertDropboxSession(capture);
            return operation(token);
        }
    } };
}
