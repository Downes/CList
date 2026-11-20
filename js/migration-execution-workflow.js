// Explicit copy/link steps with retained ciphertext and separate accepted/uncertain receipts.
/** @param {CListMigrationPlan} plan @param {CListDidIdentitySession} session @returns {CListMigrationExecutionPlan} */
function createMigrationExecutionPlan(plan, session) {
    return {plan, session, rows:[], identities:[], prepared:false, pending:false, complete:false, checkRequired:false,
        expected:new Map(JSON.parse(plan.destinationFingerprint)), total:plan.kvs.length, destination:plan.newUrl};
}
async function prepareMigrationExecution(operation, deps) {
    if (operation.prepared) return;
    const plan = operation.plan;
    await checkMigrationPreview(plan, deps);
    if (!operation.rows.length) operation.rows = plan.kvs.map(record => ({key:record.key, sourceValue:record.value,
        before:operation.expected.get(record.key) ?? null, value:null, status:'ready'})).sort((a,b) => Number(a.key === deps.didKey)-Number(b.key === deps.didKey));
    for (const row of operation.rows) {
        if (row.value !== null) continue;
        deps.assertCurrent();
        const plain = await deps.decrypt(plan.oldEncKey, row.sourceValue); deps.assertCurrent();
        row.value = await deps.encrypt(plan.newEncKey, plain); deps.assertCurrent();
    }
    operation.identities = await prepareMigrationIdentity(plan, operation.session, deps);
    deps.assertCurrent(); operation.prepared = true;
}
async function inspectMigrationExecution(operation, deps) {
    deps.assertCurrent();
    if (migrationFingerprint(await deps.list()) !== operation.plan.sourceFingerprint) throw new Error('Source records changed. Migration stopped; accepted destination writes are retained.');
    deps.assertCurrent();
    const records = await readMigrationDestination(operation.plan, deps), actual = new Map(records.map(row => [row.key,row.value]));
    for (const row of operation.rows) {
        const value = actual.get(row.key) ?? null;
        if (row.status === 'accepted') {
            if (value !== row.value) throw new Error('An accepted destination record changed. Migration stopped; it will not be overwritten again.');
        } else if (row.status === 'uncertain' && value === row.value) {
            row.status = 'accepted'; operation.expected.set(row.key, row.value);
        } else if (value === row.before) row.status = 'ready';
        else throw new Error('A destination record changed after preview. Migration stopped; the new value is preserved.');
    }
    if (migrationFingerprint(records) !== migrationFingerprint([...operation.expected].map(([key,value]) => ({key,value}))))
        throw new Error('Destination records changed after preview. Migration stopped.');
    await inspectMigrationIdentities(operation, deps);
}
async function sendMigrationRecord(operation, row, deps) {
    deps.assertCurrent(); row.status = 'uncertain'; deps.progress();
    let response;
    try {
        response = await deps.fetch(operation.plan.newUrl + (row.before === null ? '/add_kv/' : '/update_kv/'), {
            method:'POST', headers:{'Content-Type':'application/json', Authorization:'Bearer '+operation.plan.newToken},
            body:JSON.stringify({key:row.key, value:row.value})
        });
    } catch { throw new Error('A record copy could not be confirmed. Check migration before retrying.'); }
    if (!response.ok) {
        // Non-success responses can still follow a server-side write. Reconcile before any retry.
        throw new Error('Record copy returned HTTP '+response.status+'. Check migration before retrying.');
    }
    row.status = 'accepted'; operation.expected.set(row.key, row.value);
    deps.assertCurrent(); deps.progress();
}
/** @param {CListMigrationExecutionPlan} operation @param {Object} deps */
async function executeMigration(operation, deps) {
    await prepareMigrationExecution(operation, deps);
    await inspectMigrationExecution(operation, deps);
    for (const row of operation.rows) {
        if (row.status === 'accepted') continue;
        // Each write gets a fresh source/destination check; no blind add-to-update fallback.
        await inspectMigrationExecution(operation, deps);
        await sendMigrationRecord(operation, row, deps);
    }
    for (const target of operation.identities) {
        if (target.status === 'accepted') continue;
        await inspectMigrationExecution(operation, deps);
        if (target.status === 'accepted') continue;
        await sendDidPublication(target.session, target.payload, {
            ...deps, sending(){ target.status = 'uncertain'; deps.progress(); },
            accepted(){ target.status = 'accepted'; deps.progress(); }
        });
        deps.assertCurrent();
    }
    operation.complete = true;
}
