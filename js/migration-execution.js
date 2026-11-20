// Session-scoped, tab-lifetime recovery. Never install destination credentials or delete source data.
let _migrationExecutionOwner = null, _migrationExecutionSequence = 0;
const _migrationExecutionPlans = new Map(), _migrationExecutionLocks = new Set();
registerDidIdentityMutation('migration-run', key => _migrationExecutionLocks.has(key));
function createMigrationExecution(root, preparation) {
    const session = didIdentitySession(), lock = JSON.stringify(session);
    const owner = _migrationExecutionOwner = {id:++_migrationExecutionSequence};
    /** @type {CListMigrationExecutionPlan|null} */
    let operation = _migrationExecutionPlans.get(lock) || null;
    let starting = false, viewRevision = 0;
    const owned = () => _migrationExecutionOwner === owner && JSON.stringify(didIdentitySession()) === lock;
    const current = () => owned() && root.isConnected;
    const render = (initial = false) => {
        if (!owned() || !operation || (!initial && !root.isConnected)) return;
        const captured = operation, revision = ++viewRevision;
        /** @type {CListMigrationExecutionState} */
        const state = {panelId:owner.id, pending:operation.pending, complete:operation.complete, checkRequired:operation.checkRequired,
            copied:operation.copied ?? operation.rows.filter(row => row.status === 'accepted').length,
            total:operation.total, identities:operation.identityCount ?? operation.identities.filter(target => target.status === 'accepted').length,
            identityTotal:operation.identityTotal ?? operation.identities.length, destination:operation.destination, error:operation.error || null};
        window.CList.state.migrationExecution = state;
        const action = checkOnly => () => { if (current() && operation === captured && viewRevision === revision) return work(checkOnly); };
        window.CList.ui.migrationExecution.render(root, state, {check:action(true), retry:action(false)});
    };
    owner.refresh = op => { if (operation === op) render(); };
    const deps = op => ({
        assertCurrent(){ if (!current() || operation !== op) throw new Error('The migration panel or source login changed. Check migration when you return.'); },
        fetch:(...args)=>fetch(...args), list:()=>window.CList.storage.kv.list(),
        decrypt:(...args)=>decryptWithKey(...args), encrypt:(...args)=>encryptWithKey(...args),
        derive:(...args)=>derivePublicKeyJwkAndDidKey(...args), didKey:window.CList.keys.DID_IDENTITY_KEY,
        progress:()=>render()
    });
    const work = async checkOnly => {
        const op = operation;
        if (!current() || !op || op.pending || op.complete) return;
        if (!checkOnly && op.checkRequired) return;
        if (didIdentityMutationBusy(session)) { op.error = 'Another identity operation is running. Wait for it to finish.'; render(); return; }
        op.pending = true; op.error = null; _migrationExecutionLocks.add(lock); render();
        try {
            if (checkOnly) {
                await prepareMigrationExecution(op, deps(op));
                await inspectMigrationExecution(op, deps(op));
                op.checkRequired = false;
            } else await executeMigration(op, deps(op));
            if (op.complete) {
                op.copied = op.rows.filter(row => row.status === 'accepted').length;
                op.identityCount = op.identities.filter(target => target.status === 'accepted').length; op.identityTotal = op.identities.length;
                op.plan = null; op.rows = []; op.identities = []; op.expected.clear(); preparation.finished();
            }
        } catch (error) {
            console.error('Migration paused:', error);
            op.error = error.message; op.checkRequired = true;
        } finally {
            op.pending = false; _migrationExecutionLocks.delete(lock);
            _migrationExecutionOwner?.refresh(op);
        }
    };
    const start = async () => {
        if (!current() || starting || operation || didIdentityMutationBusy(session)) return;
        starting = true;
        try {
            const plan = await preparation.beginRun(); if (!plan) return;
            // Retain the handoff even if navigation occurs at the await boundary.
            operation = createMigrationExecutionPlan(plan, session); _migrationExecutionPlans.set(lock, operation);
            preparation.hold();
            if (!current()) { operation.checkRequired = true; return; }
            return await work(false);
        } catch (error) {
            console.error('Migration start failed:', error);
            if (current()) showStatusMessage('Migration could not start. Reopen the identity panel to check recovery.');
        } finally { starting = false; }
    };
    if (operation) { preparation.hold(); render(true); }
    root.querySelector('#migrate-run-btn').onclick = start;
    return {start};
}
