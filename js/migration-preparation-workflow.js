// Explicit preparation operations. No DOM, cookies or installed destination session.
/** @param {CListMigrationInput} input @param {CListDidIdentitySession} session */
function migrationDestination(input, session) {
    let url;
    try { url = new URL(input.url.trim()); } catch { throw new Error('Enter a valid destination server URL.'); }
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash)
        throw new Error('Use an HTTP(S) server URL without credentials, query or fragment.');
    const newUrl = url.href.replace(/\/+$/, ''), newUsername = input.username.trim().toLowerCase();
    if (!newUsername || !input.password) throw new Error('Please fill in all destination fields.');
    if (!session.local && newUrl === session.storeUrl.replace(/\/+$/, '') && newUsername === session.username)
        throw new Error('Choose a different destination account.');
    return {newUrl, newUsername};
}
function migrationRecords(records) {
    if (!Array.isArray(records) || records.some(row => !row || typeof row.key !== 'string' || typeof row.value !== 'string') ||
        new Set(records.map(row => row.key)).size !== records.length) throw new Error('The account returned an invalid record list. Preview stopped.');
    return records.map(row => ({...row}));
}
function migrationFingerprint(records) {
    return JSON.stringify(migrationRecords(records).map(row => [row.key, row.value]).sort((a,b) => a[0].localeCompare(b[0])));
}
async function readMigrationDestination(plan, deps) {
    deps.assertCurrent();
    const response = await deps.fetch(plan.newUrl + '/get_kvs/', {
        headers: {Authorization: 'Bearer ' + plan.newToken}, signal: deps.signal
    });
    deps.assertCurrent();
    if (!response.ok) throw new Error('Destination record check failed (' + response.status + '). Preview again after checking the destination login.');
    const records = migrationRecords(await response.json());
    deps.assertCurrent();
    return records;
}
/**
 * @param {CListMigrationInput} input
 * @param {CListDidIdentitySession} session
 * @param {Object} deps Explicit storage, crypto, HTTP and lifetime dependencies.
 * @returns {Promise<CListMigrationPlan>} Private, transient execution handoff.
 */
async function prepareMigration(input, session, deps) {
    const target = migrationDestination(input, session);
    deps.assertCurrent();
    if (!session.token || !session.username) throw new Error('Please log in to the source account first.');
    const oldEncKey = await deps.getKey(session.storeUrl);
    deps.assertCurrent();
    if (!oldEncKey) throw new Error('The source encryption key is unavailable. Please log in again.');
    const kvs = migrationRecords(await deps.list());
    deps.assertCurrent();
    for (const row of kvs) {
        try { await deps.decrypt(oldEncKey, row.value); }
        catch { throw new Error('A source record could not be decrypted. Preview stopped; nothing was copied.'); }
        deps.assertCurrent();
    }
    const [newEncKey, authHash] = await Promise.all([
        deps.deriveKey(input.password, target.newUsername), deps.deriveHash(input.password, target.newUsername)
    ]);
    deps.assertCurrent();
    const auth = {method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({username: target.newUsername, auth_hash: authHash}), signal: deps.signal};
    if (input.register && !deps.registration()) {
        deps.assertCurrent();
        let response;
        // A lost reply must not cause an automatic second registration attempt.
        deps.recordRegistration('uncertain');
        try { response = await deps.fetch(target.newUrl + '/auth/register', auth); }
        catch { throw new Error('Registration could not be confirmed. Preview again to check login, or explicitly retry registration.'); }
        deps.recordRegistration(response.ok ? 'created' : 'rejected');
        deps.assertCurrent();
        if (!response.ok) throw new Error('Destination registration failed (' + response.status + '). Use an existing account or explicitly retry.');
    }
    deps.assertCurrent();
    const response = await deps.fetch(target.newUrl + '/auth/login', auth);
    deps.assertCurrent();
    if (!response.ok) throw new Error('Destination login failed (' + response.status + '). Check credentials; no records were copied.');
    const login = await response.json();
    deps.assertCurrent();
    if (!login || typeof login.token !== 'string' || !login.token) throw new Error('Destination login returned no token.');
    const plan = {...target, oldUrl: session.storeUrl, oldUsername: session.username, oldToken: session.token,
        oldEncKey, newEncKey, newToken: login.token, kvs, hasDid: kvs.some(row => row.key === deps.didKey),
        accountCount: kvs.filter(row => !row.key.startsWith('_')).length};
    const destination = await readMigrationDestination(plan, deps), keys = new Set(destination.map(row => row.key));
    plan.conflictCount = kvs.filter(row => keys.has(row.key)).length;
    plan.didConflict = plan.hasDid && keys.has(deps.didKey);
    plan.sourceFingerprint = migrationFingerprint(kvs);
    plan.destinationFingerprint = migrationFingerprint(destination);
    return plan;
}
/** @param {CListMigrationPlan} plan @param {Object} deps */
async function checkMigrationPreview(plan, deps) {
    deps.assertCurrent();
    const source = migrationRecords(await deps.list());
    deps.assertCurrent();
    const destination = await readMigrationDestination(plan, deps);
    if (migrationFingerprint(source) !== plan.sourceFingerprint || migrationFingerprint(destination) !== plan.destinationFingerprint)
        throw new Error('Source or destination records changed. Preview again before running migration.');
    deps.assertCurrent();
}
