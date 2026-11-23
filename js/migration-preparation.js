// Private plans contain credentials; CList.state contains safe projections only.
let _migrationPreparationOwner = null, _migrationPreparationSequence = 0;
const _migrationRegistrationReceipts = new Map(), _migrationPreparationLocks = new Set();
registerDidIdentityMutation('migration-preview', key => _migrationPreparationLocks.has(key));
function createMigrationPreparation(root) {
    _migrationPreparationOwner?.cancel();
    const session = didIdentitySession(), lock = JSON.stringify(session);
    let renderVersion = 0, revision = 0, pending = false, plan = null, abort = null, overwrite = false, consumed = false;
    const owner = _migrationPreparationOwner = {id: ++_migrationPreparationSequence, cancel: () => invalidate(false)};
    const current = () => _migrationPreparationOwner === owner && root.isConnected && JSON.stringify(didIdentitySession()) === lock;
    /** @type {CListMigrationPreparationState} */
    let state = {panelId: owner.id, phase: 'idle', message: '', preview: null, overwrite: false, registration: null};
    const receiptKey = input => {
        let url = input.url.trim();
        try { url = new URL(url).href.replace(/\/+$/, ''); } catch { /* validation owns the visible error */ }
        return JSON.stringify([lock, url, input.username.trim().toLowerCase()]);
    };
    const render = () => {
        if (!current()) return;
        window.CList.state.migrationPreparation = {...state, overwrite};
        const expected = revision, rendered = ++renderVersion;
        view.state({...state, overwrite}, value => {
            if (!current() || revision !== expected || rendered !== renderVersion || state.phase !== 'ready') return;
            overwrite = value; render();
        });
    };
    function invalidate(clearPassword = true) {
        if (consumed) return;
        revision++; abort?.abort(); plan = null; overwrite = false;
        // An outstanding registration still owns its lock until its receipt settles.
        if (current()) {
            if (clearPassword) view.clearPassword();
            state = {...state, phase: 'idle', preview: null, message: '', registration: null}; render();
        }
    }
    const dependencies = (expected, input) => ({
        assertCurrent() { if (!current() || expected !== revision) throw new Error('The migration preview or source login changed.'); },
        signal: abort.signal, fetch: (...args) => fetch(...args), getKey: url => getEncKey(url),
        list: () => window.CList.storage.kv.list(), decrypt: (...args) => decryptWithKey(...args),
        deriveKey: (...args) => deriveEncKey(...args), deriveHash: (...args) => deriveAuthHash(...args),
        didKey: window.CList.keys.DID_IDENTITY_KEY,
        registration: () => _migrationRegistrationReceipts.get(receiptKey(input)),
        recordRegistration: status => _migrationRegistrationReceipts.set(receiptKey(input), status)
    });
    const prepare = async (retryRegistration = false) => {
        if (!current() || pending || consumed) return;
        if (didIdentityMutationBusy(session)) { state.message = 'Another identity operation is running. Wait for it to finish.'; render(); return; }
        const input = view.input();
        if (retryRegistration) _migrationRegistrationReceipts.delete(receiptKey(input));
        const expected = ++revision; abort = new AbortController(); pending = true; plan = null; overwrite = false;
        _migrationPreparationLocks.add(lock);
        state = {...state, phase: 'preparing', preview: null, message: 'Checking source records and destination credentials…'}; render();
        try {
            const result = await prepareMigration(input, session, dependencies(expected, input));
            if (!current() || expected !== revision) return;
            plan = result; view.clearPassword();
            state = {...state, phase: 'ready', message: '', registration: _migrationRegistrationReceipts.get(receiptKey(input)) || null,
                preview: {source: session.local ? 'this device (Local)' : session.storeUrl, destination: result.newUrl, username: result.newUsername,
                    local: session.local, accountCount: result.accountCount, systemCount: result.kvs.length - result.accountCount,
                    hasDid: result.hasDid, conflictCount: result.conflictCount, didConflict: result.didConflict}};
            render();
        } catch (error) {
            if (current() && expected === revision) {
                console.error('Migration preview failed:', error);
                state = {...state, phase: 'failed', message: error.message, registration: _migrationRegistrationReceipts.get(receiptKey(input)) || null}; render();
            }
        } finally {
            input.password = ''; pending = false; _migrationPreparationLocks.delete(lock);
            if (current() && expected !== revision) render();
        }
    };
    const view = window.CList.ui.migrationPreparation.bind(root, {
        prepare: () => prepare(),
        retryRegistration: () => {
            if (current() && state.phase === 'failed' && ['uncertain', 'rejected'].includes(state.registration)) return prepare(true);
        },
        cancel: () => invalidate(), changed: () => invalidate(false)
    });
    render();
    return {
        async beginRun() {
            if (!current() || pending || consumed || !plan || state.phase !== 'ready') return null;
            if (plan.conflictCount && !overwrite) { state.message = 'Approve the overwrite warning before running migration.'; render(); return null; }
            if (didIdentityMutationBusy(session)) { state.message = 'Another identity operation is running.'; render(); return null; }
            const expected = revision, captured = plan;
            pending = true; abort = new AbortController(); _migrationPreparationLocks.add(lock);
            state = {...state, phase: 'checking', message: 'Rechecking the preview before migration…'}; render();
            try {
                await checkMigrationPreview(captured, dependencies(expected, {url: captured.newUrl, username: captured.newUsername}));
                consumed = true; plan = null; state = {...state, phase: 'executing', message: 'Starting migration…'}; render();
                return captured;
            } catch (error) {
                if (current() && expected === revision) {
                    console.error('Migration preview expired:', error); plan = null; overwrite = false;
                    state = {...state, phase: 'failed', preview: null, message: error.message}; render();
                }
                return null;
            } finally { pending = false; _migrationPreparationLocks.delete(lock); }
        },
        hold() { consumed = true; plan = null; state = {...state, phase:'executing', message:''}; render(); },
        finished() { plan = null; if (current()) window.CList.state.migrationPreparation = {...state, phase: 'finished', preview: null}; }
    };
}
