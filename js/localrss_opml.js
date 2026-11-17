/// <reference path="./clist-types.js" />
let _localrssAccountCreationQueue = Promise.resolve();
// OPML controllers retain receipts; account writes reuse the generic account operations.
function captureLocalrssOpmlSession(owned) {
    const storeUrl = window.CList.config.flaskSiteUrl;
    const token = getSiteSpecificCookie(storeUrl, window.CList.keys.ACCESS_TOKEN);
    const username = window.CList.state.username;
    return { storeUrl, token, isCurrent: () => owned()
        && window.CList.config.flaskSiteUrl === storeUrl && window.CList.state.username === username
        && getSiteSpecificCookie(storeUrl, window.CList.keys.ACCESS_TOKEN) === token };
}
function localrssOpmlState(target) {
    return target.opml ||= { importing: false, exporting: false, receipt: null };
}
async function _localrssImportOpml(target = _localrssOptionsTarget) {
    if (!target?.current()) return;
    const state = localrssOpmlState(target), view = window.CList.ui.localrssOpml;
    if (state.importing) return;
    const captured = view.read(target);
    if (!captured.file) { view.status(target, 'import', 'Choose an OPML file first.'); return; }
    const account = structuredClone(target.account), headers = { ...target.headers };
    state.importing = true; state.receipt = null;
    view.busy(target, 'import', true); view.status(target, 'import', 'Importing…');
    _localrssInvalidateFeedCache(target);
    let data;
    try {
        data = await importLocalrssOpml({ ...captured, account }, { fetch, headers, FormData });
    } catch (error) {
        if (target.current()) view.error(target, 'import', error, 'Import failed or unconfirmed: ');
        return;
    } finally {
        _localrssInvalidateFeedCache(target); state.importing = false;
        if (target.current()) view.busy(target, 'import', false);
    }
    if (!target.current()) return;
    view.clearFile(target, captured.file);
    const summary = `${data.imported} feed${data.imported !== 1 ? 's' : ''} (${data.skipped} already present).`;
    if (captured.mode === 'newdb') {
        const receipt = state.receipt = { account, db: data.db, name: captured.newDbName, saving: false, savedKey: null };
        view.status(target, 'import', `Created database "${data.db}" with ${summary}`);
        const create = () => _localrssCreateAccountForDb(receipt, target);
        view.offerAccount(target, create);
        let confirmed = false;
        _localrssConfirm(`Set up "${data.db}" as a new LocalRSS account so it's ready to read?`, 'New database created', () => {
            if (confirmed) return;
            confirmed = true; return create();
        });
    } else {
        const feeds = localrssFeedState(target);
        feeds.editor = null; feeds.editorId++;
        window.CList.ui.localrssFeeds.busy(target, 'editor', true);
        window.CList.ui.localrssFeeds.status(target, 'editor', 'Subscriptions imported. Select a feed again; draft text is retained.');
        view.status(target, 'import', 'Imported ' + summary);
        try {
            await refreshLocalrssOptionsStats(target);
            if (target.current() && localrssReadState().kind === 'items' && localrssReadState().filter === 'unread') await target.show('unread');
        } catch (error) { if (target.current()) view.error(target, 'import', error, 'Import succeeded; refresh failed: '); }
    }
}
async function _localrssExportOpml(target = _localrssOptionsTarget) {
    if (!target?.current()) return;
    const state = localrssOpmlState(target), view = window.CList.ui.localrssOpml;
    if (state.exporting) return;
    const account = structuredClone(target.account), headers = { ...target.headers };
    state.exporting = true; view.busy(target, 'export', true); view.status(target, 'export', 'Exporting…');
    try {
        const blob = await exportLocalrssOpml(account, { fetch, headers });
        if (!target.current()) return;
        downloadBlob(blob, `${account.database}.opml`);
        view.status(target, 'export', 'Exported.');
    } catch (error) { if (target.current()) view.error(target, 'export', error, 'Export failed: '); }
    finally { state.exporting = false; if (target.current()) view.busy(target, 'export', false); }
}
async function _localrssCreateAccountForDb(receipt, target = _localrssOptionsTarget) {
    if (!target?.current() || target.opml?.receipt !== receipt || receipt.saving) return;
    const view = window.CList.ui.localrssOpml;
    const owned = () => target.current() && target.opml.receipt === receipt;
    const session = captureLocalrssOpmlSession(owned);
    receipt.saving = true; view.busy(target, 'account', true);
    const previousCreation = _localrssAccountCreationQueue;
    let releaseCreation;
    _localrssAccountCreationQueue = new Promise(resolve => { releaseCreation = resolve; });
    let saved = !!receipt.savedKey;
    try {
        await previousCreation;
        session.encKey = await getEncKey(session.storeUrl);
        assertAccountSession(session);
        // Read existing records before saving: reconcile an earlier uncertain write or an existing account.
        let accounts = await loadAccountRecords(session);
        assertAccountSession(session);
        if (!receipt.savedKey) {
            const existing = accounts.find(record => {
                const data = parseAccountValue(record);
                return data?.type === 'LOCALRSS' && data.database === receipt.db && data.serviceUrl === receipt.account.serviceUrl;
            });
            if (existing) receipt.savedKey = existing.key;
            else {
                const baseName = (receipt.name || receipt.db || 'LocalRSS').trim();
                const keys = new Set(accounts.map(record => record.key));
                let key = baseName;
                for (let n = 2; keys.has(key); n++) key = `${baseName} (${n})`;
                /** @type {CListAccountSaveRequest} */
                const request = { key, data: { type: 'LOCALRSS', instance: key, title: baseName,
                    permissions: 'r', serviceUrl: receipt.account.serviceUrl, database: receipt.db } };
                await saveAccount(request, session);
                receipt.savedKey = key;
            }
            saved = true;
        }
        if (!owned()) return;
        view.status(target, 'import', `Account "${receipt.savedKey}" saved for database "${receipt.db}".`);
        accounts = await loadAccountRecords(session);
        assertAccountSession(session);
        if (owned()) view.accountRefresh(target, accounts);
    } catch (error) {
        if (owned()) view.error(target, 'import', error, saved
            ? 'Account saved; account-list refresh failed: '
            : `Database "${receipt.db}" exists; account save failed or is unconfirmed: `);
    } finally {
        receipt.saving = false; releaseCreation();
        if (owned()) view.busy(target, 'account', false);
    }
}
async function seedLocalrssAccountOpml(target) {
    if (!target.current() || target.pending) return;
    const view = window.CList.ui.localrssOpml, capture = view.readSeed(target);
    if (!capture.file || !capture.serviceUrl) {
        view.seedStatus(target, !capture.file ? 'Choose an OPML file first.' : 'Enter the LocalRSS Service URL above first.'); return;
    }
    const session = captureLocalrssOpmlSession(target.current);
    if (!session.isCurrent()) return;
    target.pending = true; view.seedBusy(target, true); view.seedStatus(target, 'Importing…');
    // Capture headers before the first await, just as for an Options import.
    const headers = { ..._localrssAuthHeaders() };
    try {
        const data = await importLocalrssOpml({ account: { serviceUrl: capture.serviceUrl }, file: capture.file,
            mode: 'newdb', newDbName: capture.newDbName }, { fetch, headers, FormData });
        if (session.isCurrent()) view.seedResult(target, capture, data);
    } catch (error) {
        if (session.isCurrent()) { console.error('LocalRSS seed import failed:', error); view.seedStatus(target, 'Import failed or unconfirmed: ' + error.message); }
    } finally { target.pending = false; view.seedBusy(target, false); }
}
