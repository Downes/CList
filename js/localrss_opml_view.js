// LocalRSS OPML controls and feedback, scoped to their captured panel or account form.
function _localrssImportExportSection(div, target) {
    div.appendChild(_localrssSectionHeading('Import / Export'));

    const fileLabel = document.createElement('label');
    fileLabel.htmlFor = 'localrss-opml-file';
    fileLabel.textContent = 'Import OPML';
    div.appendChild(fileLabel);

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.id = 'localrss-opml-file';
    fileInput.accept = '.opml,.xml,text/xml,application/xml';
    div.appendChild(fileInput);

    const modeLabel = document.createElement('label');
    modeLabel.htmlFor = 'localrss-opml-mode';
    modeLabel.textContent = 'Import mode';
    div.appendChild(modeLabel);

    const modeSelect = document.createElement('select');
    modeSelect.id = 'localrss-opml-mode';
    [['merge', 'Merge into current database'], ['replace', 'Replace current database'], ['newdb', 'Create new database']]
        .forEach(([val, label]) => {
            const opt = document.createElement('option');
            opt.value = val;
            opt.textContent = label;
            modeSelect.appendChild(opt);
        });
    div.appendChild(modeSelect);

    const newDbRow = document.createElement('div');
    newDbRow.id = 'localrss-new-db-row';
    newDbRow.style.display = 'none';
    const newDbLabel = document.createElement('label');
    newDbLabel.htmlFor = 'localrss-new-db-name';
    newDbLabel.textContent = 'New database name';
    newDbRow.appendChild(newDbLabel);
    const newDbInput = document.createElement('input');
    newDbInput.type = 'text';
    newDbInput.id = 'localrss-new-db-name';
    newDbRow.appendChild(newDbInput);
    div.appendChild(newDbRow);

    modeSelect.onchange = () => { newDbRow.style.display = modeSelect.value === 'newdb' ? 'block' : 'none'; };

    const importBtn = document.createElement('button');
    importBtn.type = 'button';
    importBtn.className = 'btn btn-small';
    importBtn.textContent = 'Import';
    importBtn.onclick = () => _localrssImportOpml(target);
    div.appendChild(importBtn);

    const importStatus = document.createElement('p');
    importStatus.id = 'localrss-opml-import-status';
    importStatus.className = 'list-tip';
    div.appendChild(importStatus);

    const exportBtn = document.createElement('button');
    exportBtn.type = 'button';
    exportBtn.className = 'btn btn-small';
    exportBtn.textContent = 'Export OPML';
    exportBtn.onclick = () => _localrssExportOpml(target);
    div.appendChild(exportBtn);

    const exportStatus = document.createElement('p');
    exportStatus.id = 'localrss-opml-export-status';
    exportStatus.className = 'list-tip';
    div.appendChild(exportStatus);
}


function _localrssBuildAccountOpmlSection(accountForm = document) {
    const wrapper = document.createElement('div');
    wrapper.id = 'localrss-create-opml-section';
    const label = document.createElement('label');
    label.textContent = 'Seed with OPML (optional)';
    wrapper.appendChild(label);
    const fileInput = document.createElement('input');
    fileInput.type = 'file'; fileInput.id = 'localrss-create-opml-file';
    fileInput.accept = '.opml,.xml,text/xml';
    wrapper.appendChild(fileInput);
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'btn btn-small'; button.textContent = 'Import OPML';
    wrapper.appendChild(button);
    const status = document.createElement('div');
    status.id = 'localrss-create-opml-status'; status.className = 'feed-status-message';
    wrapper.appendChild(status);
    const target = { root: accountForm, wrapper, fileInput, button, status };
    target.current = () => wrapper.isConnected
        && accountForm.querySelector('#localrss-create-opml-section') === wrapper
        && accountForm.querySelector('#sharedForm')?.style.display !== 'none';
    button.onclick = () => seedLocalrssAccountOpml(target);
    return wrapper;
}

window.CList.ui.localrssOpml = {
    read(target) {
        const root = target.root;
        return {
            file: root?.querySelector('#localrss-opml-file')?.files?.[0],
            mode: root?.querySelector('#localrss-opml-mode')?.value || 'merge',
            newDbName: (root?.querySelector('#localrss-new-db-name')?.value || '').trim(),
        };
    },
    status(target, area, text) {
        const id = area === 'export' ? 'localrss-opml-export-status' : 'localrss-opml-import-status';
        const status = target.root?.querySelector('#' + id);
        if (status) status.textContent = text;
    },
    error(target, area, error, prefix = '') {
        console.error('LocalRSS OPML ' + area + ' failed:', error);
        this.status(target, area, prefix + (error.message || String(error)));
    },
    busy(target, area, busy) {
        const label = area === 'export' ? 'Export OPML' : area === 'account' ? 'Create account' : 'Import';
        for (const button of target.root?.querySelectorAll('button') || []) {
            if (button.textContent === label) button.disabled = busy;
        }
    },
    clearFile(target, file) {
        const input = target.root?.querySelector('#localrss-opml-file');
        if (input?.files?.[0] === file) input.value = '';
    },
    offerAccount(target, callback) {
        target.root?.querySelector('#localrss-opml-create-account')?.remove();
        const button = document.createElement('button');
        button.id = 'localrss-opml-create-account'; button.type = 'button';
        button.className = 'btn btn-small'; button.textContent = 'Create account';
        button.onclick = () => callback();
        target.root?.querySelector('#localrss-options-panel')?.appendChild(button);
    },
    accountRefresh(target, accounts) {
        window.CList.accounts = accounts;
        populateReadAccountList(accounts);
        populatePostOptions(accounts);
        updateUIVisibility();
        const switcher = target.root?.querySelector('#localrss-db-switcher');
        if (switcher) switcher.replaceWith(_localrssDatabaseSwitcher(target));
    },
    readSeed(target) {
        const serviceInput = target.root.querySelector('#serviceUrlInput');
        const dbInput = target.root.querySelector('#databaseInput');
        return {
            file: target.fileInput.files?.[0],
            serviceUrl: (serviceInput?.value || '').trim(),
            newDbName: (dbInput?.value || '').trim(),
            serviceInput, dbInput,
        };
    },
    seedStatus(target, text) { target.status.textContent = text; },
    seedBusy(target, busy) { target.button.disabled = busy; },
    seedResult(target, capture, data) {
        const serviceInput = target.root.querySelector('#serviceUrlInput');
        const dbInput = target.root.querySelector('#databaseInput');
        const unchanged = serviceInput === capture.serviceInput && dbInput === capture.dbInput
            && (serviceInput?.value || '').trim() === capture.serviceUrl
            && (dbInput?.value || '').trim() === capture.newDbName;
        if (unchanged && dbInput) dbInput.value = data.db;
        if (target.fileInput.files?.[0] === capture.file) target.fileInput.value = '';
        this.seedStatus(target, `Created database "${data.db}" with ${data.imported} feed${data.imported !== 1 ? 's' : ''} `
            + `(${data.skipped} already present). `
            + (unchanged ? 'Click Save to finish creating the account.'
                : 'Your newer form values were kept. Use the created database name above if you want to save this account.'));
    },
};
