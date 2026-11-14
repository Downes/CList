/// <reference path="./clist-types.js" />
// Account panel controller and navigation. Forms and persistence have separate boundaries.
// Copyright Stephen Downes 2026. CC BY 4.0; provided AS IS, without warranty.

// Used by kvstore.js's single popstate listener; never attach one per panel.
let _accountsPanelCtx = null;

function kvstoreAccountsPanel() {
    const div = document.createElement('div');
    div.className = 'kvcontainer';
    div.innerHTML = `
        <div id="kvList"></div>
        <div id="add-flow" style="display:none;"></div>
        <div id="sharedForm" style="display:none">
            <form id="addKvForm">
                <div id="form-fields"></div>
                <div class="kv-action-buttons">
                    <button type="button" id="submitBtn" class="kv-action-btn kv-save-btn">Save</button>
                    <button type="button" id="deleteBtn" class="kv-action-btn kv-delete-btn" style="display:none">Delete</button>
                    <button type="button" id="cancelBtn" class="kv-action-btn kv-cancel-btn">Cancel</button>
                </div>
            </form>
        </div>
        <div id="add-account-header"><button id="add-account-btn">+ Add New Account</button></div>`;
    const storeUrl = window.CList.config.flaskSiteUrl;
    const token = getSiteSpecificCookie(storeUrl, window.CList.keys.ACCESS_TOKEN);
    let accounts = [];
    let busy = false;
    const accountFlows = Object.create(null);
    const formElement = div.querySelector('#sharedForm');
    const form = createAccountForm(div, { close: closeForm, getAccountFlow,
        updateAccount: (key, data) => {
            const record = accounts.find(account => account.key === key);
            if (record) record.value = accountRecordFromData(key, data).value;
        },
    });

    async function session() {
        const result = { storeUrl, token, encKey: await getEncKey(storeUrl) };
        assertAccountSession(result);
        return result;
    }

    function getAccountFlow(type) {
        if (accountFlows[type]) return accountFlows[type];
        const factory = window.CList.accountFlows?.[type];
        if (!factory) return null;
        return accountFlows[type] = factory({
            container: div.querySelector('#add-flow'), back: showTypePicker, finish: cancelAdd,
            getAccounts: () => accounts,
            reloadAccounts: async () => { accounts = await loadAccountRecords(await session()); return accounts; },
            refreshList: refreshList,
        });
    }

    function publishAccounts() {
        window.CList.accounts = accounts;
        populatePostOptions(accounts);
        populateReadAccountList(accounts);
        updateUIVisibility();
    }

    function renderAccounts() {
        const list = div.querySelector('#kvList');
        // Keep the reusable form and its draft alive when its account row is rebuilt.
        div.insertBefore(formElement, div.querySelector('#add-account-header'));
        list.innerHTML = '';
        const accountList = document.createElement('div'); accountList.className = 'account-list';
        const tip = document.createElement('div'); tip.className = 'list-tip';
        tip.textContent = 'Select an account to manage'; accountList.appendChild(tip);
        let failed = 0;
        for (const account of accounts) {
            const data = parseAccountValue(account); if (!data) continue;
            const unreadable = data.type === 'bad'; if (unreadable) failed++;
            const item = document.createElement('div'); item.className = 'account-list-item';
            item.dataset.accountKey = account.key;
            const button = document.createElement('button');
            button.className = 'account-button' + (unreadable ? ' account-button--unreadable' : '');
            button.appendChild(accountIcon(unreadable ? '' : data.type, unreadable ? null : data));
            const name = document.createElement('span'); name.textContent = unreadable ? account.key : (data.title || account.key);
            button.appendChild(name); button.onclick = () => openEdit(account.key, item);
            item.appendChild(button); accountList.appendChild(item);
            if (formElement.dataset.openFor === account.key && formElement.style.display !== 'none') {
                accountList.appendChild(formElement);
            }
        }
        list.appendChild(accountList);
        if (accounts.length && failed === accounts.length) {
            showServiceError(list, 'Accounts unavailable', 'Could not decrypt accounts. Please log out and log back in.');
        }
    }

    async function reloadAndRender() {
        accounts = await loadAccountRecords(await session());
        publishAccounts(); renderAccounts();
    }

    function showRefreshFailure(error, completedAction = '') {
        console.error('Account list refresh failed:', error);
        const list = div.querySelector('#kvList');
        renderAccounts();
        const message = completedAction
            ? `Account ${completedAction}, but the account list could not be refreshed. ${error.message} Use Retry refresh; do not repeat the ${completedAction === 'saved' ? 'save' : 'deletion'}.`
            : `Could not load accounts. ${error.message} Use Retry refresh or log in again.`;
        showServiceError(list, completedAction ? `Account ${completedAction}; refresh failed` : 'Account refresh failed', message);
        const retry = document.createElement('button');
        retry.className = 'btn btn-small'; retry.textContent = 'Retry refresh';
        retry.onclick = () => refreshList(storeUrl); list.appendChild(retry);
    }

    async function refreshList(requestedUrl = storeUrl) {
        try {
            if (requestedUrl !== storeUrl) throw new Error('Reopen Manage Accounts for the selected server.');
            await reloadAndRender();
        } catch (error) { showRefreshFailure(error); }
    }

    function setBusy(value) {
        busy = value;
        // Preserve pre-existing disabled states, including service-supplied controls.
        div.querySelectorAll('input,button,select,textarea').forEach(control => {
            if (value) { control.dataset.wasDisabled = control.disabled ? 'yes' : 'no'; control.disabled = true; }
            else if (control.dataset.wasDisabled !== undefined) {
                control.disabled = control.dataset.wasDisabled === 'yes'; delete control.dataset.wasDisabled;
            }
        });
    }

    async function saveForm() {
        if (busy) return false;
        let request;
        try { request = form.read(); }
        catch (error) { showErrorModal(error.message, { title: 'Account save failed' }); return false; }
        setBusy(true);
        let saved, operationSession;
        try { operationSession = await session(); saved = await saveAccount(request, operationSession); }
        catch (error) {
            showErrorModal(error.message, { title: 'Account save failed' });
            setBusy(false); return false;
        }
        try {
            // The write succeeded. Never present a refresh failure as a failed write.
            assertAccountSession(operationSession);
            const record = accountRecordFromData(saved.key, saved.data);
            const index = accounts.findIndex(account => account.key === saved.key);
            if (index < 0) accounts.push(record); else accounts[index] = record;
            closeForm(); publishAccounts(); renderAccounts();
            try { await reloadAndRender(); }
            catch (error) { showRefreshFailure(error, 'saved'); }
            showStatusMessage('Account saved.');
        } catch (error) {
            showErrorModal('Account saved, but the session or view changed. Reopen Manage Accounts to refresh. ' + error.message,
                { title: 'Account saved; refresh failed' });
        } finally { setBusy(false); }
        return true;
    }

    async function deleteForm() {
        if (busy) return;
        let request;
        try { request = form.read(false); }
        catch (error) { showErrorModal(error.message, { title: 'Account delete failed' }); return; }
        if (!request.key) { showErrorModal('No key specified for deletion.', { title: 'Account delete failed' }); return; }
        if (!confirm(`Delete "${request.data.title || request.key}"? This cannot be undone.`)) return;
        setBusy(true);
        let operationSession;
        try { operationSession = await session(); await deleteAccount(request.key, operationSession); }
        catch (error) { showErrorModal(error.message, { title: 'Account delete failed' }); setBusy(false); return; }
        try {
            assertAccountSession(operationSession);
            accounts = accounts.filter(account => account.key !== request.key);
            closeForm(); publishAccounts(); renderAccounts();
            try { await reloadAndRender(); }
            catch (error) { showRefreshFailure(error, 'deleted'); }
            showStatusMessage('Account deleted.');
        } catch (error) {
            showErrorModal('Account deleted, but the session or view changed. Reopen Manage Accounts to refresh. ' + error.message,
                { title: 'Account deleted; refresh failed' });
        } finally { setBusy(false); }
    }

    async function tryCloseForm() {
        if (busy) return false;
        if (!form.isDirty()) { closeForm(); return true; }
        if (confirm('You have unsaved changes. Save them?')) return saveForm();
        if (confirm('Discard changes and close?')) { closeForm(); return true; }
        return false;
    }

    function closeForm() {
        formElement.style.display = 'none'; formElement.dataset.openFor = ''; form.setDirty(false);
        const header = div.querySelector('#add-account-header');
        header.parentNode.insertBefore(formElement, header);
        div.querySelector('#add-flow').style.display = 'none';
        div.querySelector('#kvList').style.display = 'block'; header.style.display = '';
    }

    async function openEdit(key, item) {
        if (busy) return;
        if (formElement.dataset.openFor === key && formElement.style.display !== 'none') { await tryCloseForm(); return; }
        if (formElement.style.display !== 'none' && form.isDirty() && !await tryCloseForm()) return;
        const account = accounts.find(record => record.key === key);
        const data = account && parseAccountValue(account);
        if (!data || data.type === 'bad') {
            showErrorModal('Could not decrypt this account. Please log out and log back in.', { title: 'Account decryption failed' }); return;
        }
        const schema = window.CList.schemas[data.type];
        if (!schema) { showErrorModal('No schema for account type: ' + data.type, { title: 'Unknown account type' }); return; }
        item = Array.from(div.querySelectorAll('.account-list-item')).find(row => row.dataset.accountKey === key);
        if (!item) { showErrorModal('The account list changed. Refresh it before editing.', { title: 'Account unavailable' }); return; }
        form.build(schema, 'edit', { ...data, _key: key });
        item.parentNode.insertBefore(formElement, item.nextSibling);
        formElement.dataset.openFor = key; formElement.style.display = 'block';
        formElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        div.querySelector('#submitBtn').textContent = 'Update Account';
        div.querySelector('#deleteBtn').style.display = 'inline';
        div.querySelector('#cancelBtn').onclick = () => tryCloseForm();
    }

    async function openAdd() {
        if (busy) return;
        if (formElement.style.display !== 'none' && form.isDirty() && !await tryCloseForm()) return;
        closeForm(); div.querySelector('#kvList').style.display = 'none';
        div.querySelector('#add-account-header').style.display = 'none'; showTypePicker();
    }

    function showTypePicker(pushHistory = true) {
        if (busy) return;
        if (formElement.style.display !== 'none' && form.isDirty()) {
            tryCloseForm().then(closed => { if (closed) showTypePicker(pushHistory); })
                .catch(error => showErrorModal(error.message, { title: 'Could not close account form' }));
            return;
        }
        if (pushHistory) history.pushState({ view: 'typePicker' }, '');
        closeForm();
        div.querySelector('#kvList').style.display = 'none';
        div.querySelector('#add-account-header').style.display = 'none';
        const flow = div.querySelector('#add-flow'); flow.innerHTML = '';
        const heading = document.createElement('div'); heading.className = 'list-tip';
        heading.textContent = 'Pick an account type to add'; flow.appendChild(heading);
        const list = document.createElement('div'); list.className = 'account-list';
        const local = window.CList.isLocalMode?.();
        const types = ['Mastodon', 'Bluesky', 'WordPress', 'Blogger', 'Etherpad', 'Collab', 'AI', 'Proxyp', 'Annotate', 'Hypothesis', 'JSONBin', 'Gist', '0x0', 'CListBin', 'Dropbox', 'Discord', 'LOCALRSS'];
        for (const type of types.filter(type => !local || (type !== 'Collab' && type !== 'Annotate'))) {
            const button = document.createElement('button'); button.className = 'account-button';
            button.onclick = () => selectAccountType(type); button.appendChild(typePickerIcon(type));
            const label = document.createElement('span'); label.textContent = type;
            button.appendChild(label); list.appendChild(button);
        }
        flow.appendChild(list);
        const actions = document.createElement('div'); actions.className = 'kv-action-buttons';
        const cancel = document.createElement('button'); cancel.className = 'kv-action-btn kv-cancel-btn';
        cancel.textContent = 'Cancel'; cancel.onclick = cancelAdd; actions.appendChild(cancel); flow.appendChild(actions);
        flow.style.display = 'block';
    }

    function selectAccountType(type) {
        if (busy) return;
        history.pushState({ view: 'form', type }, '');
        const flow = getAccountFlow(type);
        if (flow) { flow.open(); return; }
        const schema = window.CList.schemas[type];
        if (!schema) { showErrorModal('No schema for account type: ' + type, { title: 'Unknown account type' }); return; }
        div.querySelector('#add-flow').style.display = 'none'; form.build(schema, 'create', {});
        const header = div.querySelector('#add-account-header');
        header.parentNode.insertBefore(formElement, header.nextSibling);
        formElement.dataset.openFor = '__add__'; formElement.style.display = 'block';
        formElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        div.querySelector('#submitBtn').textContent = 'Add Account';
        div.querySelector('#deleteBtn').style.display = 'none';
        div.querySelector('#cancelBtn').onclick = () => showTypePicker();
    }

    function cancelAdd() {
        div.querySelector('#add-flow').style.display = 'none';
        div.querySelector('#kvList').style.display = 'block';
        div.querySelector('#add-account-header').style.display = '';
    }

    // Existing icon renderers.
    function typePickerIcon(type) {
        const icons = {
            Bluesky:   'cloud',
            WordPress: 'article',
            Blogger:   'article',
            Etherpad:  'edit',
            Collab:    'groups',
            AI:        'psychology',
            Proxyp:    'vpn_key',
            Annotate:  'rate_review',
            JSONBin:   'inventory_2',
            Gist:      'code',
            '0x0':     'upload',
            CListBin:  'storage',
            Dropbox:   'cloud_download',
            Discord:   'forum',
            LOCALRSS:  'rss_feed',
        };
        if (type === 'Mastodon') {
            const span = document.createElement('span');
            span.className = 'account-icon-img';
            span.setAttribute('aria-label', 'Mastodon');
            return span;
        }
        if (type === 'Hypothesis') {
            const span = document.createElement('span');
            span.className = 'account-icon-img account-icon-img--hypothesis';
            span.setAttribute('aria-label', 'Hypothes.is');
            return span;
        }
        const span = document.createElement('span');
        span.className = 'material-icons';
        span.textContent = icons[type] || 'account_circle';
        return span;
    }

    function accountIcon(type, accountData) {
        if (type === 'Mastodon') {
            const span = document.createElement('span');
            span.className = 'account-icon-img';
            span.setAttribute('aria-label', 'Mastodon');
            return span;
        }
        if (type === 'Hypothesis') {
            const span = document.createElement('span');
            span.className = 'account-icon-img account-icon-img--hypothesis';
            span.setAttribute('aria-label', 'Hypothes.is');
            return span;
        }
        if (type === 'LOCALRSS') {
            const span = document.createElement('span');
            span.className = 'material-icons';
            span.textContent = (accountData && accountData.hasAudio) ? 'podcasts' : 'rss_feed';
            return span;
        }
        const materialIcons = {
            'Bluesky':   'cloud',
            'WordPress': 'article',
            'Blogger':   'article',
            'Annotate':  'rate_review',
        };
        const span = document.createElement('span');
        span.className = 'material-icons';
        span.textContent = materialIcons[type] || 'account_circle';
        return span;
    }


    div.querySelector('#submitBtn').onclick = () => saveForm();
    div.querySelector('#deleteBtn').onclick = () => deleteForm();
    div.querySelector('#cancelBtn').onclick = () => tryCloseForm();
    div.querySelector('#addKvForm').onsubmit = event => { event.preventDefault(); saveForm(); };
    div.querySelector('#add-account-btn').onclick = () => openAdd();
    _accountsPanelCtx = { div, showTypePicker };
    refreshList(storeUrl);
    return div;
}
