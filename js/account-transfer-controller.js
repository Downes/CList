function createAccountImportOperation(plan, deps) {
    let pending = null, error = null;
    function result() {
        return { imported: plan.steps.filter(step => step.status === 'accepted').length,
            skipped: plan.steps.filter(step => step.status === 'existing').map(step => step.key),
            remaining: plan.steps.filter(step => step.status === 'ready').length, uncertain: plan.steps.filter(step => step.status === 'uncertain').length,
            complete: plan.steps.every(step => ['accepted', 'existing'].includes(step.status)), error: error?.message || null };
    }
    function state(phase, busy) {
        if (!deps.current()) return;
        const value = result();
        /** @type {CListAccountTransferState} */
        const summary = { phase, busy, imported: value.imported, skipped: value.skipped.length, remaining: value.remaining, uncertain: value.uncertain }; deps.state(summary);
    }
    function run(action, phase) {
        if (pending) return pending;
        pending = Promise.resolve().then(async () => { deps.assert(); error = null; state(phase, true); await action(plan, deps); })
            .catch(failure => { error = failure; deps.log(failure); })
            .then(() => { const value = result(); state(value.complete ? 'complete' : value.error ? 'failed' : 'review', false); return value; })
            .finally(() => { pending = null; });
        return pending;
    }
    return { current: deps.current, result, run: () => run(runAccountImport, 'importing'), check: () => run(checkAccountImport, 'checking') };
}
function captureAccountTransferSource(options = {}) {
    const source = captureOAuthAccountSaveSource(), kv = source.kv;
    if (!source.username || source.username === 'none' || !source.token) throw new Error('Log in to the account before transferring its data.');
    const keyVersion = typeof passwordConfirmationSession === 'function' ? passwordConfirmationSession().storedKey : undefined;
    return { ...source, list: kv.list.bind(kv), get: kv.get.bind(kv), add: kv.add.bind(kv),
        current: () => currentOAuthAccountSaveSource(source) && (!options.isCurrent || options.isCurrent())
            && (keyVersion === undefined || passwordConfirmationSession().storedKey === keyVersion) };
}
function accountTransferDependencies(source) {
    const assert = () => { if (!source.current()) throw new Error('The account transfer source or destination expired. Reopen the transfer.'); };
    return { assert, current: source.current, auth: deriveAuthHash, digest: sha256Hex, key: getEncKey, derive: deriveEncKey,
        encrypt: encryptWithKey, decrypt: decryptWithKey, now: () => new Date().toISOString(),
        state: value => { window.CList.state.accountTransfer = value; }, log: error => console.error('[Account transfer]', error) };
}
