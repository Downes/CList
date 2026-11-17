/// <reference path="./clist-types.js" />
// OPML transport takes explicit captured inputs and never reads UI/session globals.
/** @param {{account: CListAccountData, mode: string, newDbName: string, file: Blob}} request
 * @param {{fetch: Function, headers: Object, FormData: Function}} dependencies */
async function importLocalrssOpml(request, { fetch: send, headers, FormData: Form }) {
    const account = structuredClone(request.account), mode = request.mode;
    if (!['merge', 'replace', 'newdb'].includes(mode) || !request.file) throw new Error('Choose an OPML file and valid import mode.');
    const base = account._effectiveServiceUrl || account.serviceUrl;
    if (!base || (mode !== 'newdb' && !account.database)) throw new Error('LocalRSS needs a service URL and database.');
    const body = new Form();
    body.append('opml', request.file); body.append('mode', mode);
    if (mode === 'newdb') body.append('new_db_name', request.newDbName);
    const query = account.database ? '?' + new URLSearchParams({ db: account.database }) : '';
    const response = await send(base.replace(/\/$/, '') + '/api/opml_import' + query,
        { method: 'POST', headers: { ...headers }, body });
    const data = await response.json().catch(() => null);
    if (!response.ok || data?.ok !== true || data.mode !== mode
        || !Number.isInteger(data.imported) || data.imported < 0
        || !Number.isInteger(data.skipped) || data.skipped < 0
        || (mode === 'newdb' && (typeof data.db !== 'string' || !data.db.trim()))) {
        throw new Error(data?.error || 'Unconfirmed OPML import response; refresh before importing again.');
    }
    return data;
}
/** @param {CListAccountData} account
 * @param {{fetch: Function, headers: Object}} dependencies */
async function exportLocalrssOpml(account, { fetch: send, headers }) {
    const captured = structuredClone(account), base = captured._effectiveServiceUrl || captured.serviceUrl;
    if (!base || !captured.database) throw new Error('LocalRSS needs a service URL and database.');
    const response = await send(base.replace(/\/$/, '') + '/api/opml_export?' + new URLSearchParams({ db: captured.database }),
        { headers: { ...headers } });
    if (!response.ok) throw new Error('OPML export failed: HTTP ' + response.status);
    return response.blob();
}
