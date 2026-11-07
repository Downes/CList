//  account-transfer.js  -  export/import account data between CList account servers
//  Part of CList, the next generation of learning and connecting with your community
//
//  Copyright Stephen Downes 2026, downes.ca
//  Licensed under Creative Commons Attribution 4.0 International https://creativecommons.org/licenses/by/4.0/
//
//  This software carries NO WARRANTY OF ANY KIND.
//  This software is provided "AS IS," and you, its user, assume all risks when using it.
//
//  Reads and writes go through window.CList.storage.kv (storage.js), which is already
//  backend-agnostic -- it talks to whichever account (Local, via IndexedDB, or a real kvstore
//  server, via HTTP) is currently logged in. That's what lets this same code bridge any
//  combination: Local -> Local (e.g. across origins, where IndexedDB itself is a browser
//  security boundary no amount of JS can cross), Local -> hosted, hosted -> Local, or hosted ->
//  a different hosted account. Export reads from whatever you're logged into right now; import
//  writes to whatever you're logged into right now.
//
//  Export asks for the account's own password purely to derive its encryption key and a
//  verification digest client-side -- the password itself is never sent anywhere, and a real
//  kvstore server never hands back anything password-derived for this code to read, unlike a
//  Local account's own IndexedDB record. Import never writes a `users` row --
//  the destination account must already exist (register + log in there first, same as any
//  other account) -- it only unlocks the export with its *original* username/password, decrypts
//  each kv value with that account's key, and re-encrypts it under the currently logged-in
//  account's key. That's also why a destination username collision can't happen: nothing about
//  the old username is ever written here.

const CLIST_ACCOUNT_EXPORT_VERSION = 1;

// Same digest used server-side for login -- used here only to verify the unlock password
// against an export file's authHashDigest, never to authenticate anywhere.
async function sha256Hex(str) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Exports every kv row for the currently logged-in account into a downloadable JSON file,
// password-wrapped so the file is useless without it. The caller (kvstore.js's Export button)
// already verified `password` against the current session via confirmWithPassword()/
// verifyPassword() before calling this, so it's trusted here -- used only to derive the
// authHashDigest that unlockAndImportAccountData() later checks a password against. Throws if
// not logged in or on a storage failure; callers show err.message to the user.
async function exportAccountData(password) {
    const username = window.CList.state.username;
    if (!username || username === 'none') {
        throw new Error('Log in first, then export.');
    }

    const kvRows = await window.CList.storage.kv.list();
    const authHash = await deriveAuthHash(password, username);
    const authHashDigest = await sha256Hex(authHash);

    const payload = {
        clistLocalAccountExport: CLIST_ACCOUNT_EXPORT_VERSION,
        exportedAt: new Date().toISOString(),
        username,
        authHashDigest,
        kv: kvRows.map(r => ({ key: r.key, value: r.value })),
    };

    downloadBlob(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }), `clist-account-${username}.json`);
}

// Parses and validates an account export file. Returns the parsed payload, or null (after
// showing an error modal) if the file isn't a recognized export.
async function parseLocalAccountExportFile(file) {
    let payload;
    try {
        payload = JSON.parse(await file.text());
    } catch (err) {
        showErrorModal('That file is not valid JSON.', { title: 'Import failed' });
        return null;
    }
    if (payload.clistLocalAccountExport !== CLIST_ACCOUNT_EXPORT_VERSION || !payload.username || !payload.authHashDigest) {
        showErrorModal('That file is not a recognized CList account export.', { title: 'Import failed' });
        return null;
    }
    return payload;
}

// Checks a password against an export payload's own embedded digest -- distinct from
// verifyPassword() in kvstore.js, which only checks a password against the *current* session:
// payload.username here is whatever account the export was made from, which during Import is
// not the account currently logged in. Shared by the Import button's confirmWithPassword() call
// and (implicitly, by already having been checked there) unlockAndImportAccountData() below.
async function verifyExportPassword(payload, password) {
    const authHash = await deriveAuthHash(password, payload.username);
    const digest = await sha256Hex(authHash);
    return digest === payload.authHashDigest;
}

// Unlocks an exported account with its *original* username/password, decrypts every kv value
// with that account's key, and re-encrypts it for the account currently logged in here -- so
// importing never touches (or collides with) a `users` row. The caller (kvstore.js's Import
// button) already verified `password` against payload.authHashDigest via
// confirmWithPassword()/verifyExportPassword() before calling this. The caller must already be
// logged in to the destination account. Keys that already exist on the destination account are
// left untouched (reported back as `skipped`) rather than overwritten, since the destination may
// not be a brand-new account. Throws if not logged in, or on any storage failure; callers show
// err.message to the user. Returns { imported, skipped } where `skipped` is the list of
// colliding keys.
async function unlockAndImportAccountData(payload, password) {
    const destUsername = window.CList.state.username;
    if (!destUsername || destUsername === 'none') {
        throw new Error('Log in to the account you want to import into first.');
    }
    const newEncKey = await getEncKey(window.CList.config.flaskSiteUrl);
    if (!newEncKey) {
        throw new Error("Could not read this account's encryption key -- try logging in again.");
    }
    const oldEncKey = await deriveEncKey(password, payload.username);

    const existingRows = await window.CList.storage.kv.list();
    const existingKeys = new Set(existingRows.map(r => r.key));

    let imported = 0;
    const skipped = [];
    for (const row of (payload.kv || [])) {
        if (existingKeys.has(row.key)) {
            skipped.push(row.key);
            continue;
        }
        const plaintext = await decryptWithKey(oldEncKey, row.value);
        const newValue = await encryptWithKey(newEncKey, plaintext);
        await window.CList.storage.kv.put(row.key, newValue);
        imported++;
    }
    return { imported, skipped };
}
