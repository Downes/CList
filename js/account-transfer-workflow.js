// Native v1 account bundles contain ciphertext, never executable instructions.
const CLIST_ACCOUNT_EXPORT_VERSION = 1;
/** @returns {CListAccountExportPayload} */
function validateAccountExport(value) {
    if (!value || value.clistLocalAccountExport !== CLIST_ACCOUNT_EXPORT_VERSION || typeof value.username !== 'string' || !value.username || typeof value.authHashDigest !== 'string' || !value.authHashDigest)
        throw new Error('That file is not a recognized CList account export.');
    const copy = structuredClone(value), rows = copy.kv == null ? [] : copy.kv, keys = new Set();
    if (!Array.isArray(rows)) throw new Error('The account export contains an invalid key/value list.');
    for (const row of rows) {
        if (!row || typeof row.key !== 'string' || !row.key || typeof row.value !== 'string' || keys.has(row.key)) throw new Error('The account export contains an invalid or duplicate key/value record.');
        keys.add(row.key);
    }
    copy.kv = rows; return copy;
}
function accountTransferRows(rows) {
    if (!Array.isArray(rows) || rows.some(row => !row || typeof row.key !== 'string' || !row.key || typeof row.value !== 'string')) throw new Error('Stored account data could not be read safely.');
    const map = new Map(rows.map(row => [row.key, row.value]));
    if (map.size !== rows.length) throw new Error('Stored account data contains duplicate keys.');
    return map;
}
async function verifyAccountExportPassword(payload, password, deps) {
    deps.assert(); const hash = await deps.auth(password, payload.username); deps.assert();
    const digest = await deps.digest(hash); deps.assert(); return digest === payload.authHashDigest;
}
async function prepareAccountExport(source, password, deps) {
    deps.assert(); const rows = accountTransferRows(await source.list()); deps.assert();
    const hash = await deps.auth(password, source.username); deps.assert();
    const authHashDigest = await deps.digest(hash); deps.assert();
    return { clistLocalAccountExport: CLIST_ACCOUNT_EXPORT_VERSION, exportedAt: deps.now(), username: source.username, authHashDigest,
        kv: Array.from(rows, ([key, value]) => ({ key, value })) };
}
async function prepareAccountImport(payload, password, source, deps) {
    if (!await verifyAccountExportPassword(payload, password, deps)) throw new Error('The export password is incorrect.');
    const destinationKey = await deps.key(source.storeUrl); deps.assert();
    if (!destinationKey) throw new Error('Could not read the destination encryption key. Log in again.');
    const originalKey = await deps.derive(password, payload.username); deps.assert();
    const existing = accountTransferRows(await source.list()); deps.assert();
    return { source, destinationKey, originalKey, steps: payload.kv.map(row => ({ key: row.key, original: row.value, ciphertext: null,
        status: existing.has(row.key) ? 'existing' : 'ready' })) };
}
async function runAccountImport(plan, deps) {
    for (const step of plan.steps) {
        if (['accepted', 'existing'].includes(step.status)) continue;
        deps.assert();
        if (step.status === 'uncertain') throw new Error('Check import status before retrying an unconfirmed write.');
        const present = await plan.source.get(step.key); deps.assert();
        if (present) { step.status = 'existing'; continue; }
        if (step.ciphertext === null) {
            const plaintext = await deps.decrypt(plan.originalKey, step.original); deps.assert();
            step.ciphertext = await deps.encrypt(plan.destinationKey, plaintext); deps.assert();
        }
        step.status = 'uncertain';
        try { await plan.source.add(step.key, step.ciphertext); step.status = 'accepted'; }
        catch (error) {
            if (error.code === 'AlreadyExists') step.status = 'existing';
            else { if (['InvalidData', 'NotAuthenticated', 'NotAuthorized', 'RevisionConflict'].includes(error.code)) step.status = 'ready'; throw error; }
        }
        deps.assert();
    }
}
async function checkAccountImport(plan, deps) {
    deps.assert(); const rows = accountTransferRows(await plan.source.list()); deps.assert();
    for (const step of plan.steps) {
        if (step.status !== 'uncertain') continue;
        step.status = !rows.has(step.key) ? 'ready' : rows.get(step.key) === step.ciphertext ? 'accepted' : 'existing';
    }
}
