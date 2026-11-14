/// <reference path="./clist-types.js" />
// Account data operations. No form controls, messages, or navigation.
// Copyright Stephen Downes 2026. CC BY 4.0; provided AS IS, without warranty.

/** @param {CListAccountSession} session */
function assertAccountSession(session) {
    if (!session.encKey || !session.token) throw new Error('Please log in again before managing accounts.');
    if (session.storeUrl !== window.CList.config.flaskSiteUrl ||
        session.token !== getSiteSpecificCookie(session.storeUrl, window.CList.keys.ACCESS_TOKEN)) {
        throw new Error('The account session changed. Reopen Manage Accounts before continuing.');
    }
}

/**
 * Single account allowlist and normalization path, also used by getAccounts().
 * Unreadable records retain their keys so users can identify/remove them.
 * @param {CListAccountSession} session
 * @returns {Promise<CListAccountRecord[]>}
 */
async function loadAccountRecords(session) {
    assertAccountSession(session);
    const records = await window.CList.storage.kv.list();
    const accounts = await Promise.all(records.map(async record => {
        try {
            const data = JSON.parse(await decryptWithKey(session.encKey, record.value));
            if (!window.CList.schemas[data.type]) return null;
            return accountRecordFromData(record.key, data);
        } catch {
            return accountRecordFromData(record.key, {
                id: 'bad', permissions: 'bad', type: 'bad', title: 'bad', public: false,
            });
        }
    }));
    assertAccountSession(session);
    return accounts.filter(account => account !== null);
}

/**
 * @param {string} key
 * @param {CListAccountData} data
 * @returns {CListAccountRecord}
 */
function accountRecordFromData(key, data) {
    return { key, value: JSON.stringify({
        ...data, instance: key, id: data.id || '', permissions: data.permissions || '',
        type: data.type || '', title: data.title || '', public: data.public || false,
    }) };
}

/**
 * Hook preparation, encryption, and persistence receive a detached snapshot.
 * A successful return means the write completed; refresh is a separate action.
 * @param {CListAccountSaveRequest} request
 * @param {CListAccountSession} session
 * @returns {Promise<CListAccountSaveRequest>}
 */
async function saveAccount(request, session) {
    assertAccountSession(session);
    const snapshot = structuredClone(request);
    if (!snapshot.key) throw new Error('Please enter an account key.');
    if (!snapshot.data.type || !snapshot.data.title) throw new Error('Please enter an account type and Title.');
    const prepare = window.CList.accountHooks?.[snapshot.data.type]?.prepareSave;
    if (prepare) snapshot.data = await prepare(snapshot.data);
    assertAccountSession(session);
    const encrypted = await encryptWithKey(session.encKey, JSON.stringify(snapshot.data));
    assertAccountSession(session);
    await window.CList.storage.kv.put(snapshot.key, encrypted);
    return snapshot;
}

/**
 * @param {string} key
 * @param {CListAccountSession} session
 * @returns {Promise<void>}
 */
async function deleteAccount(key, session) {
    assertAccountSession(session);
    if (!key) throw new Error('No key specified for deletion.');
    await window.CList.storage.kv.remove(key);
}
