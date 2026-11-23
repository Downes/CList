// Panel handoffs and explicit recovery for captured account-transfer operations.
function createPersonalOptionsTransfer(current, view, deps = personalOptionsTransferDependencies()) {
    let sequence = 0, pending = false;
    const release = id => { if (sequence === id) pending = false; };
    async function refresh(result, source, owned) {
        if (!owned()) return;
        try {
            const accounts = await deps.accounts(source); if (!owned()) return;
            deps.install(accounts, source);
            const count = result.imported, skipped = result.skipped || [];
            view.report('Imported ' + count + ' item' + (count === 1 ? '' : 's') + '.' + (skipped.length ? ' Skipped existing keys: ' + skipped.join(', ') : ''));
        } catch (error) {
            deps.log(error); if (owned()) view.report('Account data imported, but the account list could not be refreshed. ' + error.message,
                [['Retry account refresh', () => refresh(result, source, owned)]], true);
        }
    }
    async function present(operation, source, owned) {
        if (!owned()) return;
        const result = operation.result();
        if (!operation.current()) { view.report('The original transfer destination expired. Reopen the transfer to continue.', [], true); return; }
        if (result.complete) { await refresh(result, source, owned); return; }
        const action = result.uncertain ? 'Check import status' : 'Retry remaining imports';
        view.report('Imported ' + result.imported + ' item(s). ' + result.remaining + ' remaining; ' + result.uncertain + ' unconfirmed. ' + (result.error || ''), [[action, async () => {
            if (!owned() || !operation.current()) return;
            if (result.uncertain) await operation.check(); else await operation.run();
            if (owned()) await present(operation, source, owned);
        }]], true);
    }
    return {
        export() {
            if (pending || !current()) return;
            if (!deps.logged()) { view.report('Log in first, then export.', [], true); return; }
            const id = ++sequence, source = deps.capture(), owned = () => current() && sequence === id && deps.current(source); pending = true;
            let submitted = false;
            deps.confirm('Enter your current password to encrypt the export file:', async password => {
                if (submitted) return; submitted = true;
                try { if (!owned()) return; view.report('Preparing account export…'); await deps.export(password, { isCurrent: owned }); if (owned()) view.report('Account exported.'); }
                catch (error) { deps.log(error); if (owned()) view.report(error.message, [], true); }
                finally { release(id); }
            }, { confirmLabel: 'Export', isCurrent: owned, onCancel: () => release(id) });
        },
        async import(file) {
            if (pending || !current()) return;
            const id = ++sequence, source = deps.capture(), owned = () => current() && sequence === id && deps.current(source); pending = true;
            try {
                const payload = await deps.parse(file); if (!owned() || !payload) { release(id); return; }
                let submitted = false;
                deps.confirm('Enter the password for "' + deps.escape(payload.username) + '" (as it was in the old location) to unlock this export:', async password => {
                    if (submitted) return; submitted = true;
                    let operation;
                    try {
                        if (!owned()) return;
                        view.report('Importing account data…');
                        const result = await deps.import(payload, password, { isCurrent: owned, onOperation: value => { operation = value; } });
                        if (operation) await present(operation, source, owned); else if (owned()) await refresh(result, source, owned);
                    }
                    catch (error) { deps.log(error); if (error.operation && owned()) await present(error.operation, source, owned); else if (owned()) view.report(error.message, [], true); }
                    finally { release(id); }
                }, { verify: password => deps.verify(payload, password), confirmLabel: 'Unlock & Import', isCurrent: owned, onCancel: () => release(id) });
            } catch (error) { deps.log(error); if (owned()) view.report(error.message, [], true); release(id); }
        },
    };
}
function personalOptionsTransferDependencies() {
    return {
        capture: captureOAuthAccountSaveSource, current: currentOAuthAccountSaveSource,
        logged: () => !!window.CList.state.username && window.CList.state.username !== 'none',
        confirm: (...args) => confirmWithPassword(...args), escape: escapeHtml,
        export: (password, options) => exportAccountData(password, options), parse: file => parseLocalAccountExportFile(file, { feedback: false }),
        verify: (payload, password) => verifyExportPassword(payload, password), import: (payload, password, options) => unlockAndImportAccountData(payload, password, options),
        accounts: source => getAccounts(source.storeUrl),
        install(accounts, source) { window.CList.accounts = accounts; updateUIVisibility(); if (oauthAccountSaveSurfaceCurrent(source)) { populatePostOptions(accounts); populateReadAccountList(accounts); } },
        log: error => console.error('[Options account transfer]', error),
    };
}
