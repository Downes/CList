/// <reference path="./clist-types.js" />
// Directory reads only. No PeerJS, DOM, cookies or discussion writes.
/** @returns {Promise<{kind:('ready'|'login'),items:CListDiscussionEntry[]}>} */
async function fetchP2pDiscussions(request, { fetch, signal }) {
    const response = await fetch(request.url, { method: 'GET', signal,
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (request.token || '') } });
    if (response.status === 401) return { kind: 'login', items: [] };
    if (!response.ok) throw Error('Could not load discussions (HTTP ' + response.status + ').');
    const rows = await response.json();
    if (!Array.isArray(rows) || rows.some(row => !row || typeof row.name !== 'string' || !row.name.trim()
        || typeof row.peerId !== 'string' || !row.peerId.trim())) throw Error('The server returned an invalid discussion list.');
    return { kind: 'ready', items: rows.map(row => ({ name: row.name, peerId: row.peerId })) };
}
