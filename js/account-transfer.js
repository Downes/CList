//  account-transfer.js  -  export/import account data between CList account servers
//  Part of CList, the next generation of learning and connecting with your community
//
//  Copyright Stephen Downes 2026, downes.ca
//  Licensed under Creative Commons Attribution 4.0 International https://creativecommons.org/licenses/by/4.0/
//
//  This software carries NO WARRANTY OF ANY KIND.
//  This software is provided "AS IS," and you, its user, assume all risks when using it.
//
//  Source/destination, transport methods and optional caller lifetime are captured
//  before asynchronous work. Workflows and transient import receipts are separate.

// Same digest used server-side for login -- used here only to verify the unlock password
// against an export file's authHashDigest, never to authenticate anywhere.
async function sha256Hex(str) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Download handoff only; the browser's eventual file write is not observable here.
async function exportAccountData(password, options = {}) {
    const source = captureAccountTransferSource(options), deps = accountTransferDependencies(source), deliver = downloadBlob;
    const state = phase => { if (source.current()) deps.state({ phase, busy: phase === 'exporting', imported: 0, skipped: 0, remaining: 0, uncertain: 0 }); };
    try {
        state('exporting'); const payload = await prepareAccountExport(source, password, deps); deps.assert();
        await deliver(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }), 'clist-account-' + source.username + '.json');
        state('export-handed-off'); return { exported: payload.kv.length };
    } catch (error) { state('failed'); throw error; }
}

// Parses and validates an account export file. Returns the parsed payload, or null (after
// showing an error modal) if the file isn't a recognized export.
async function parseLocalAccountExportFile(file, options = {}) {
    let payload;
    try {
        payload = JSON.parse(await file.text());
    } catch (err) {
        if (options.feedback === false) throw new Error('That file is not valid JSON.');
        showErrorModal('That file is not valid JSON.', { title: 'Import failed' });
        return null;
    }
    try { return validateAccountExport(payload); }
    catch (error) {
        if (options.feedback === false) throw error;
        showErrorModal(error.message, { title: 'Import failed' }); return null;
    }
}

// Checks a password against an export payload's own embedded digest -- distinct from
// verifyPassword() in kvstore.js, which only checks a password against the *current* session:
// payload.username here is whatever account the export was made from, which during Import is
// not the account currently logged in. Shared by the Import button's confirmWithPassword() call
// and (implicitly, by already having been checked there) unlockAndImportAccountData() below.
async function verifyExportPassword(payload, password, options = {}) {
    const captured = validateAccountExport(payload);
    return verifyAccountExportPassword(captured, password, {
        assert() { if (options.isCurrent && !options.isCurrent()) throw new Error('The export password check expired.'); },
        auth: deriveAuthHash, digest: sha256Hex,
    });
}

// Compatibility API: failures retain a private operation handle for explicit recovery.
async function unlockAndImportAccountData(payload, password, options = {}) {
    const captured = validateAccountExport(payload), source = captureAccountTransferSource(options), deps = accountTransferDependencies(source);
    const plan = await prepareAccountImport(captured, password, source, deps), operation = createAccountImportOperation(plan, deps);
    options.onOperation?.(operation);
    const result = await operation.run();
    if (!result.complete) throw Object.assign(new Error(result.error || 'Account import is incomplete. Check its status before retrying.'), { code: 'AccountImportIncomplete', operation });
    return result;
}
