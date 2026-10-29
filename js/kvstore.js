//  kvstore.js  -  helper and utility functions for KVStore accounts management API
//  Part of CList, the next generation of learning and connecting with your community
//
//  Version version 0.1 created by Stephen Downes on January 27, 2025
//
//  Copyright Stephen Downes 2025
//  Licensed under Creative Commons Attribution 4.0 International https://creativecommons.org/licenses/by/4.0/
//
//  This software carries NO WARRANTY OF ANY KIND.
//  This software is provided "AS IS," and you, its user, assume all risks when using it.
//

// DOM references used by login-state functions defined outside DOMContentLoaded.
let identityDiv, loginButton, logoutButton, accountButton;

window.CList.schemas = window.CList.schemas || {};
window.CList.schemas['Proxyp'] = {
    type: 'Proxyp',
    instanceFromKey: true,
    kvKey: { label: 'Proxy URL', placeholder: 'https://proxyp.mooc.ca' },
    fields: [
        { key: 'title',       label: 'Title',       editable: true, inputType: 'text', placeholder: 'My Proxy', default: '' },
        { key: 'permissions', label: 'Permissions', editable: true, inputType: 'text', placeholder: 'p',        default: 'p' },
    ]
};


// Date: 2024-01-04
// Datastore login and token management functions
// Expects the following HTML elements:
//  login-button
//  logout-button
//  username-display
//  accountDropdown  (a select element)
// Expects the following variables:
//  username
//  window.CList.config.flaskSiteUrl
//  accounts
//  accessCode
//  baseURL
// The function checks for these

document.addEventListener('DOMContentLoaded', function() {

    if (!window.CList?.config?.flaskSiteUrl) {
        throw new Error('Error: CList namespace not initialized.');
    }



    identityDiv   = document.getElementById("identityDiv");
    loginButton   = document.getElementById("loginButton");
    logoutButton  = document.getElementById("logoutButton");
    accountButton = document.getElementById("accountButton");

    // Your stored accounts (will be replaced with fetched data) and List of required element IDs

    const requiredDivs = ['identityDiv','loginButton','logoutButton','accountButton'];

    // Loop through the array and check if each div exists
    for (let i = 0; i < requiredDivs.length; i++) {
        // Check if the element exists in one statement
        if (!document.getElementById(requiredDivs[i])) {
            console.error(`Error: Element with ID '${requiredDivs[i]}' is not present in the document. Exiting...`);
            return; // Exit the function immediately
        }
    }


    // Check for access token + session encryption key.
    // encKey is in sessionStorage (cleared on tab close) — if missing, user must log in again
    // to re-derive the key even if the token cookie is still valid.
    // Page load never nudges the user to log in — that only happens reactively, via
    // loginRequired(), when they pick an action that actually requires an account.
    if (hasValidSession()) {
        loginNotRequired();
    }

    if (!window.CList.state.username || window.CList.state.username === "none") {
        setLoggedOutUI();
    } else {
        // Fetch accounts on reload so Read/Post buttons reflect the user's saved accounts.
        // (accounts array is empty at page load; it's normally populated only after login)
        getAccounts(window.CList.config.flaskSiteUrl).then(accts => {
            if (accts) {
                window.CList.accounts = accts;
                if (typeof populateReadAccountList === 'function') populateReadAccountList(accts);
                if (typeof populatePostOptions    === 'function') populatePostOptions(accts);
                updateUIVisibility();
            }
        }).catch(e => console.warn('Could not fetch accounts on reload:', e));
    }

    displayUsername();


});




// ── Auth-state helpers ────────────────────────────────────────────────────────

// Checks the actual cookie/token/session-key state directly, independent of
// window.CList.state.username — usable before kvstore.js's own boot handler has run
// (e.g. by interface.js, which registers its DOMContentLoaded listener earlier).
function hasValidSession() {
    const _token = getSiteSpecificCookie(window.CList.config.flaskSiteUrl, window.CList.keys.ACCESS_TOKEN);
    return !!(_token && !isTokenExpired(_token)
        && sessionStorage.getItem(`${window.CList.config.flaskSiteUrl}_${getSiteSpecificCookie(window.CList.config.flaskSiteUrl, window.CList.keys.USERNAME)}_encKey`));
}

function isRegistered() {
    return !!(window.CList.state.username && window.CList.state.username !== 'none' && window.CList.state.username !== '');
}

function hasReadAccount() {
    return isRegistered() && (window.CList.accounts || []).some(a => {
        const v = parseAccountValue(a);
        return v && v.type && window.CList.readers &&
               window.CList.readers[v.type] &&
               window.CList.readers[v.type].feedFunctions;
    });
}

function hasPostAccount() {
    return isRegistered() && (window.CList.accounts || []).some(a => {
        const v = parseAccountValue(a);
        return v && v.permissions &&
               (v.permissions.includes('w') || v.permissions.includes('p'));
    });
}

function hasAIAccount() {
    return isRegistered() && (window.CList.accounts || []).some(a => {
        const v = parseAccountValue(a);
        return v && v.type === 'AI';
    });
}

function updateUIVisibility() {
    const reg = isRegistered();
    const _show = (id, on) => {
        const el = document.getElementById(id);
        if (el) el.style.display = on ? '' : 'none';
    };
    const local = window.CList.isLocalMode && window.CList.isLocalMode();
    document.body.classList.toggle('user-registered', reg);
    _show('openLeftButton',   hasReadAccount() || !reg); // logged-out visitors still get the public feed list
    _show('openChatButton',   reg && !local); // P2P chat needs a reachable peer identity
    _show('meButton',         reg);
    _show('post-button',      hasPostAccount());
}

// ── Login state ───────────────────────────────────────────────────────────────

// identityDiv's idle content — the login identity when logged in, blank otherwise.
// Also what showStatusMessage() (ui.js) restores after a transient status message,
// since that message borrows this same space.
function renderIdentityLabel() {
    if (isRegistered()) {
        identityDiv.innerHTML = `Identity: ${window.CList.state.username}`;
    } else {
        identityDiv.textContent = '';
    }
}

// Login is required
function loginRequired(msg) {
    window.CList.state.username = 'none';
    openLeftPane();
    loginButton.style.display="inline-block";
    const registerButton = document.getElementById("registerButton");
    if (registerButton) registerButton.style.display="inline-block";
    accountButton.style.display="none";
    logoutButton.style.display="none";
    if (msg && (msg.includes('expired') || msg.includes('cleared') || msg.includes('logged out'))) {
        identityDiv.textContent = `Session ended — please log in again.`;
    } else {
        renderIdentityLabel();
    }
    updateUIVisibility();
}

// Login not required
function loginNotRequired() {
    accountButton.style.display="block";
    logoutButton.style.display="block";
    loginButton.style.display="none";
    const registerButton = document.getElementById("registerButton");
    if (registerButton) registerButton.style.display="none";
    window.CList.state.username = getSiteSpecificCookie(window.CList.config.flaskSiteUrl, window.CList.keys.USERNAME);
    renderIdentityLabel();
    updateUIVisibility();
}

// Quietly reflect "not logged in" in the UI at page load — no pane-opening, no
// messaging. The nudge (loginRequired()) only fires reactively, when the user picks
// an action that actually needs an account.
function setLoggedOutUI() {
    window.CList.state.username = 'none';
    loginButton.style.display="inline-block";
    const registerButton = document.getElementById("registerButton");
    if (registerButton) registerButton.style.display="inline-block";
    accountButton.style.display="none";
    logoutButton.style.display="none";
    updateUIVisibility();

    // Public, no-login RSS collections — listed so logged-out visitors have something to read.
    if (typeof renderPublicFeedsList === 'function') {
        renderPublicFeedsList(document.getElementById('left-content'));
    }
}


// Opens 'Manage Accounts' window in left column interface
function playAccounts() {
    openLeftInterface(kvstoreAccountsPanel());
}

// Tracks the currently-mounted Accounts panel instance (div + its showTypePicker closure)
// so the popstate listener below can route {view:'typePicker'} back-navigation to it without
// acting on a stale instance left over from a previous visit to this panel.
let _accountsPanelCtx = null;

// Returns the Manage Accounts panel element (add/edit/delete credentialed accounts).
// Inlined directly (not an iframe) — see kvstoreMePanel() comment for why.
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

        <div id="add-account-header">
            <button id="add-account-btn">+ Add New Account</button>
        </div>
    `;

    // Per-panel state (was module-level in flasker.html, now closure-local)
    let accounts = [];
    let currentMode = 'add';
    let currentSchema = null;
    let formDirty = false;

    function markDirty() { formDirty = true; }

    // Build form fields dynamically from schema into #form-fields.
    // mode: 'create' (all fields editable) or 'edit' (respects field.editable)
    // data: object of existing values; use '_key' for the kvstore key
    function buildFormFields(schema, mode, data) {
        const container = div.querySelector('#form-fields');
        container.innerHTML = '';
        currentSchema = schema;

        // kvKey field — editable on create, display-only on edit
        container.appendChild(makeFieldRow(
            { key: '_key', label: schema.kvKey.label, inputType: 'text',
              placeholder: schema.kvKey.placeholder, editable: false, default: '' },
            mode,
            data['_key'] || ''
        ));

        // Schema-defined fields
        for (const field of schema.fields) {
            const value = (data[field.key] != null) ? data[field.key] : (field.default || '');
            container.appendChild(makeFieldRow(field, mode, value));
        }

        // "Make public" checkbox for account types that can appear in the DID document
        const PUBLIC_CAPABLE = new Set(['Mastodon', 'Bluesky', 'WordPress', 'Blogger', 'Annotate', 'Hypothesis']);
        if (PUBLIC_CAPABLE.has(schema.type)) {
            const row = document.createElement('div');
            row.className = 'public-toggle';
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.id = 'publicCheckbox';
            cb.checked = data.public || false;
            const lbl = document.createElement('label');
            lbl.htmlFor = 'publicCheckbox';
            lbl.textContent = 'Make public (include in your DID document)';
            row.appendChild(cb);
            row.appendChild(lbl);
            container.appendChild(row);
        }
    }

    // Render a single label+input row. editable:false fields show as text in edit mode.
    function makeFieldRow(field, mode, value) {
        const wrapper = document.createElement('div');

        const label = document.createElement('label');
        label.textContent = field.label;
        wrapper.appendChild(label);

        const isEditable = (mode === 'create') || field.editable;

        if (field.inputType === 'oauth') {
            const display = document.createElement('div');
            display.className = 'field-display';
            display.textContent = value ? '(token stored)' : '(no token)';
            wrapper.appendChild(display);
            const hidden = document.createElement('input');
            hidden.type = 'hidden';
            hidden.id = field.key + 'Input';
            hidden.value = value || '';
            wrapper.appendChild(hidden);
            if (mode === 'edit') {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'kv-action-btn kv-save-btn';
                btn.textContent = 'Re-authorize';
                btn.style.marginTop = '4px';
                btn.onclick = () => {
                    const keyEl    = div.querySelector('#_keyInput');
                    const titleEl  = div.querySelector('#titleInput');
                    const permEl   = div.querySelector('#permissionsInput');
                    const appKeyEl = div.querySelector('#appKeyInput');
                    const folderEl = div.querySelector('#folderInput');
                    if (currentSchema && currentSchema.type === 'Dropbox') {
                        dropboxOAuthStart(
                            appKeyEl ? appKeyEl.value : '',
                            keyEl    ? keyEl.value    : '',
                            permEl   ? permEl.value   : 'b',
                            folderEl ? folderEl.value : '/CList'
                        );
                    } else {
                        mastodonOAuthStart(
                            titleEl ? titleEl.value : (keyEl ? keyEl.value : ''),
                            keyEl   ? keyEl.value   : '',
                            permEl  ? permEl.value  : 'rw'
                        );
                    }
                };
                wrapper.appendChild(btn);

                const manualBtn = document.createElement('button');
                manualBtn.type = 'button';
                manualBtn.className = 'kv-action-btn';
                manualBtn.textContent = 'Enter manually';
                manualBtn.style.marginTop = '4px';
                manualBtn.onclick = () => {
                    display.style.display = 'none';
                    manualBtn.style.display = 'none';
                    const input = document.createElement('input');
                    input.type = 'password';
                    input.id = field.key + 'Input';
                    input.placeholder = 'Paste access token';
                    input.style.cssText = 'display:block;width:100%;box-sizing:border-box;padding:0.2rem;font-size:0.8rem;margin:4px 0;';
                    hidden.replaceWith(input);
                };
                wrapper.appendChild(manualBtn);
            }
        } else if (isEditable) {
            const input = document.createElement('input');
            input.type = field.inputType === 'password' ? 'password' : 'text';
            input.id = field.key + 'Input';
            input.placeholder = field.placeholder || '';
            input.value = value || '';
            wrapper.appendChild(input);
        } else {
            const display = document.createElement('div');
            display.className = 'field-display';
            display.textContent = value || '';
            wrapper.appendChild(display);
            const hidden = document.createElement('input');
            hidden.type = 'hidden';
            hidden.id = field.key + 'Input';
            hidden.value = value || '';
            wrapper.appendChild(hidden);
        }

        return wrapper;
    }

    async function addOrUpdateKeyValue() {
        if (!currentSchema) { showStatusMessage('No account type selected.'); return; }

        const keyEl = div.querySelector('#_keyInput');
        const key = keyEl ? keyEl.value.trim() : '';
        if (!key) { showStatusMessage('Please enter a value for "' + currentSchema.kvKey.label + '".'); return; }

        // Build instanceData from schema
        const instanceData = { type: currentSchema.type };
        if (currentSchema.instanceFromKey) instanceData.instance = key;
        for (const field of currentSchema.fields) {
            const el = div.querySelector('#' + field.key + 'Input');
            instanceData[field.key] = el ? el.value : (field.default || '');
        }
        const publicEl = div.querySelector('#publicCheckbox');
        if (publicEl) instanceData.public = publicEl.checked;
        if (!instanceData.title) { showStatusMessage('Please enter a Title.'); return; }

        // Hypothesis: verify the API key belongs to the claimed username before saving.
        if (currentSchema.type === 'Hypothesis') {
            if (!instanceData.apiKey) {
                showStatusMessage('Hypothes.is account requires an API key.');
                return;
            }
            if (!instanceData.username) {
                showStatusMessage('Hypothes.is account requires a username.');
                return;
            }
            try {
                const apiBase = instanceData.instance?.includes('hypothes.is')
                    ? 'https://api.hypothes.is/api'
                    : (instanceData.instance || 'https://hypothes.is').replace(/\/$/, '') + '/api';
                const profileResp = await fetch(`${apiBase}/profile`, {
                    headers: { Accept: 'application/json', Authorization: `Bearer ${instanceData.apiKey}` }
                });
                if (!profileResp.ok) {
                    showStatusMessage(`Hypothes.is rejected the API key (HTTP ${profileResp.status}) — check your token and try again.`);
                    return;
                }
                const profile = await profileResp.json();
                const returnedUser = (profile.userid || '').match(/^acct:([^@]+)@/)?.[1] || '';
                const enteredUser  = instanceData.username.split('@')[0];
                if (returnedUser.toLowerCase() !== enteredUser.toLowerCase()) {
                    showStatusMessage(
                        `Username mismatch: API key belongs to "${returnedUser}", not "${enteredUser}". ` +
                        'Correct the username and try again.'
                    );
                    return;
                }
                // Normalise to the name Hypothesis actually uses (preserves their capitalisation).
                instanceData.username = returnedUser;
            } catch (err) {
                console.error('Hypothesis profile verification failed:', err);
                showStatusMessage('Could not verify Hypothes.is account — check your connection and try again.');
                return;
            }
        }

        let encryptedValue;
        try {
            const encKey = await getEncKey(window.CList.config.flaskSiteUrl);
            if (!encKey) throw new Error('Encryption key not found — please log in again.');
            encryptedValue = await encryptWithKey(encKey, JSON.stringify(instanceData));
        } catch (err) {
            console.error('Encryption error:', err);
            showStatusMessage('Could not save account — encryption failed. ' + err.message);
            return;
        }

        window.CList.storage.kv.put(key, encryptedValue)
        .then(() => {
            (async () => {
                try {
                    accounts = await getAccounts(window.CList.config.flaskSiteUrl);
                    populatePostOptions(accounts);
                    populateReadAccountList(accounts);
                    updateUIVisibility();
                } catch (error) {
                    console.error('Error fetching accounts:', error);
                } finally {
                    closeForm();
                    getSite(window.CList.config.flaskSiteUrl);
                }
            })();
        })
        .catch(error => showStatusMessage('Error saving account: ' + error));
    }

    async function setFormValues(targetKey) {
        const matchingAccount = accounts.find(account => account.key === targetKey);
        if (!matchingAccount) { showStatusMessage("Can't find account: " + targetKey); return; }
        const valueData = JSON.parse(matchingAccount.value);

        if (valueData.type === 'bad') {
            showStatusMessage('Could not decrypt this account — please log out and log back in.');
            return;
        }

        if (valueData.type === 'RSS') { showRSSEditForm(targetKey, valueData); return; }

        const schema = window.CList?.schemas?.[valueData.type];
        if (!schema) { showStatusMessage('No schema for account type: ' + (valueData.type || 'unknown')); return; }

        buildFormFields(schema, 'edit', { _key: targetKey, ...valueData });

        if (valueData.type === 'Discord') {
            const container = div.querySelector('#form-fields');
            const panelWrap = document.createElement('div');
            panelWrap.style.marginTop = '10px';
            panelWrap.innerHTML = `
                <div id="discord-edit-status" style="font-size:0.8rem;color:#555;margin-bottom:6px;min-height:1.2em;"></div>
                <div class="kv-action-buttons">
                    <button class="kv-action-btn kv-save-btn" id="discord-edit-manage-btn" type="button">Manage Channels</button>
                </div>
                <div id="discord-edit-admin-panel" style="display:none;margin-top:10px;padding-top:10px;border-top:1px solid #ccc;"></div>`;
            container.appendChild(panelWrap);
            const ctx = {
                statusEl: panelWrap.querySelector('#discord-edit-status'),
                botTokenEl: div.querySelector('#bot_tokenInput'),
                panelEl: panelWrap.querySelector('#discord-edit-admin-panel'),
            };
            panelWrap.querySelector('#discord-edit-manage-btn').onclick = () => discordManageChannels(ctx);
        }

        currentMode = 'update';
        div.querySelector('#submitBtn').textContent = 'Update Account';
        div.querySelector('#deleteBtn').style.display = 'inline';
        div.querySelector('#cancelBtn').onclick = tryCloseForm;
        formDirty = false;
    }

    // Close form with unsaved-changes check. Returns true if form was closed.
    async function tryCloseForm() {
        if (!formDirty) { closeForm(); return true; }
        if (confirm('You have unsaved changes. Save them?')) {
            await addOrUpdateKeyValue();
        } else if (confirm('Discard changes and close?')) {
            closeForm();
            return true;
        }
        return false;
    }

    function closeForm() {
        const form = div.querySelector('#sharedForm');
        form.style.display = 'none';
        form.dataset.openFor = '';
        formDirty = false;
        // Return form to its home position so getSite() rebuilding #kvList doesn't destroy it
        const header = div.querySelector('#add-account-header');
        if (header && header.parentNode) {
            header.parentNode.insertBefore(form, header);
        }
    }

    async function openEdit(key, item) {
        const form = div.querySelector('#sharedForm');
        if (form.dataset.openFor === key && form.style.display !== 'none') {
            await tryCloseForm(); return;
        }
        if (form.style.display !== 'none' && formDirty) {
            const closed = await tryCloseForm();
            if (!closed) return;
        }
        item.parentNode.insertBefore(form, item.nextSibling);
        form.dataset.openFor = key;
        form.style.display = 'block';
        form.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setFormValues(key);
    }

    async function openAdd() {
        if (div.querySelector('#sharedForm').style.display !== 'none' && formDirty) {
            const closed = await tryCloseForm();
            if (!closed) return;
        }
        closeForm();
        div.querySelector('#kvList').style.display = 'none';
        div.querySelector('#add-account-header').style.display = 'none';
        showTypePicker();
    }

    function typePickerIcon(type) {
        const icons = {
            Bluesky:   'cloud',
            RSS:       'rss_feed',
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
        };
        if (type === 'Mastodon') {
            const span = document.createElement('span');
            span.className = 'account-icon-img';
            span.setAttribute('aria-label', 'Mastodon');
            return span;
        }
        if (type === 'OPML') {
            const span = document.createElement('span');
            span.className = 'account-icon-img account-icon-img--opml';
            span.setAttribute('aria-label', 'OPML');
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

    function showTypePicker(pushHistory = true) {
        if (pushHistory) history.pushState({ view: 'typePicker' }, '');
        const flow = div.querySelector('#add-flow');
        flow.innerHTML = '';

        const heading = document.createElement('div');
        heading.className = 'list-tip';
        heading.textContent = 'Pick an account type to add';
        flow.appendChild(heading);

        const list = document.createElement('div');
        list.className = 'account-list';
        // Collab and Annotate both require an external server to verify your kvstore token
        // against a real, network-reachable kvstore instance — not possible in Local mode.
        const isLocal = window.CList?.isLocalMode && window.CList.isLocalMode();
        const allTypes = ['Mastodon', 'Bluesky', 'WordPress', 'OPML', 'RSS', 'Blogger', 'Etherpad', 'Collab', 'AI', 'Proxyp', 'Annotate', 'Hypothesis', 'JSONBin', 'Gist', '0x0', 'CListBin', 'Dropbox', 'Discord'];
        const availableTypes = isLocal ? allTypes.filter(t => t !== 'Collab' && t !== 'Annotate') : allTypes;
        availableTypes.forEach(type => {
            const btn = document.createElement('button');
            btn.className = 'account-button';
            btn.onclick = () => selectAccountType(type);
            btn.appendChild(typePickerIcon(type));
            const label = document.createElement('span');
            label.textContent = type;
            btn.appendChild(label);
            list.appendChild(btn);
        });
        flow.appendChild(list);

        const actions = document.createElement('div');
        actions.className = 'kv-action-buttons';
        actions.style.marginTop = '8px';
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'kv-action-btn kv-cancel-btn';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.onclick = () => cancelAdd();
        actions.appendChild(cancelBtn);
        flow.appendChild(actions);

        flow.style.display = 'block';
    }
    _accountsPanelCtx = { div, showTypePicker };

    function selectAccountType(type) {
        history.pushState({ view: 'form', type }, '');
        if (type === 'Mastodon') {
            const flow = div.querySelector('#add-flow');
            const inputStyle = 'display:block;width:100%;box-sizing:border-box;padding:0.2rem;font-size:0.8rem;margin:2px 0 8px;';
            const labelStyle = 'font-variant:small-caps;font-size:0.8rem;color:#555;display:block;margin-top:6px;';
            flow.innerHTML = `
                <h3 style="margin:0 0 8px;">Add Mastodon Account</h3>
                <label style="${labelStyle}">Username</label>
                <input type="text" id="mastodon-username-input"
                       placeholder="you@mastodon.social"
                       style="${inputStyle}">
                <div class="kv-action-buttons">
                    <button class="kv-action-btn kv-save-btn" id="mastodon-auth-btn">Authorize with Mastodon</button>
                    <button class="kv-action-btn kv-cancel-btn" id="mastodon-back-btn">Back</button>
                </div>
                <details style="margin-top:14px;">
                    <summary style="cursor:pointer;font-size:0.85em;color:#555;user-select:none;">Advanced: enter access token manually</summary>
                    <p style="font-size:0.82em;color:#666;margin:6px 0 10px;">
                        Get a token from your Mastodon instance under
                        <em>Settings → Development → New Application</em>.
                        Grant <code>read</code> and <code>write</code> scopes.
                    </p>
                    <label style="${labelStyle}">Title</label>
                    <input type="text" id="mastodon-manual-title" placeholder="My Mastodon" style="${inputStyle}">
                    <label style="${labelStyle}">Permissions</label>
                    <input type="text" id="mastodon-manual-permissions" value="rw" style="${inputStyle}">
                    <label style="${labelStyle}">Access Token</label>
                    <input type="password" id="mastodon-manual-token" placeholder="Paste token here" style="${inputStyle}">
                    <div class="kv-action-buttons">
                        <button class="kv-action-btn kv-save-btn" id="mastodon-manual-save-btn">Save Account</button>
                    </div>
                </details>`;
            flow.querySelector('#mastodon-auth-btn').onclick = () => submitMastodonUsername();
            flow.querySelector('#mastodon-back-btn').onclick = () => showTypePicker();
            flow.querySelector('#mastodon-manual-save-btn').onclick = () => submitMastodonManual();
            return;
        }

        if (type === 'Dropbox') {
            const flow = div.querySelector('#add-flow');
            const inputStyle = 'display:block;width:100%;box-sizing:border-box;padding:0.2rem;font-size:0.8rem;margin:2px 0 8px;';
            const labelStyle = 'font-variant:small-caps;font-size:0.8rem;color:#555;display:block;margin-top:6px;';
            flow.innerHTML = `
                <h3 style="margin:0 0 4px;">Add Dropbox Account</h3>
                <p style="font-size:0.82em;color:#666;margin:0 0 8px;">
                    <a href="https://github.com/Downes/CList/wiki/B8-%E2%80%90-Add-Dropbox-to-CList" target="_blank" rel="noopener">Full setup instructions</a>
                </p>
                <p style="font-size:0.82em;color:#666;margin:0 0 10px;">
                    Create a free app at
                    <a href="https://www.dropbox.com/developers/apps" target="_blank" rel="noopener">dropbox.com/developers/apps</a>:
                    <br>1. Choose <em>Scoped Access → App folder</em> (or Full Dropbox).
                    <br>2. Click the <strong>Permissions</strong> tab and enable
                    <code>files.content.write</code> and <code>files.content.read</code>,
                    then click <em>Submit</em>.
                    <br>3. Under <em>Settings → OAuth 2 → Redirect URIs</em>, add:
                    <code style="word-break:break-all;">${window.location.origin}/callback.html</code>
                    <br>4. Copy the <strong>App Key</strong> below and click Authorize.
                </p>
                <label style="${labelStyle}">Label</label>
                <input type="text" id="dropbox-title" placeholder="My Dropbox" value="My Dropbox" style="${inputStyle}">
                <label style="${labelStyle}">App Key</label>
                <input type="text" id="dropbox-app-key" placeholder="xxxxxxxxxxxxxxx" style="${inputStyle}">
                <label style="${labelStyle}">Save Folder</label>
                <input type="text" id="dropbox-folder" placeholder="/CList" value="/CList" style="${inputStyle}">
                <div class="kv-action-buttons">
                    <button class="kv-action-btn kv-save-btn" id="dropbox-auth-btn">Authorize with Dropbox</button>
                    <button class="kv-action-btn kv-cancel-btn" id="dropbox-back-btn">Back</button>
                </div>`;
            flow.querySelector('#dropbox-auth-btn').onclick = () => dropboxOAuthStart(
                flow.querySelector('#dropbox-app-key').value,
                flow.querySelector('#dropbox-title').value,
                'b',
                flow.querySelector('#dropbox-folder').value
            );
            flow.querySelector('#dropbox-back-btn').onclick = () => showTypePicker();
            return;
        }

        if (type === 'RSS') {
            const flow = div.querySelector('#add-flow');
            const inputStyle = 'display:block;width:100%;box-sizing:border-box;padding:0.2rem;font-size:0.8rem;margin:2px 0 8px;';
            const labelStyle = 'font-variant:small-caps;font-size:0.8rem;color:#555;display:block;margin-top:6px;';
            flow.innerHTML = `
                <h3 style="margin:0 0 8px;">Add RSS Collection</h3>
                <label style="${labelStyle}">Collection Name</label>
                <input type="text" id="rss-collection-name" placeholder="My News" style="${inputStyle}">
                <div class="kv-action-buttons">
                    <button class="kv-action-btn kv-save-btn" id="rss-create-btn">Create Collection</button>
                    <button class="kv-action-btn kv-cancel-btn" id="rss-back-btn">Back</button>
                </div>`;
            flow.querySelector('#rss-create-btn').onclick = () => submitRSSCollection();
            flow.querySelector('#rss-back-btn').onclick = () => showTypePicker();
            return;
        }

        if (type === 'Blogger') {
            const flow = div.querySelector('#add-flow');
            const inputStyle = 'display:block;width:100%;box-sizing:border-box;padding:0.2rem;font-size:0.8rem;margin:2px 0 8px;';
            const labelStyle = 'font-variant:small-caps;font-size:0.8rem;color:#555;display:block;margin-top:6px;';
            const origin = window.location.origin;
            flow.innerHTML = `
                <h3 style="margin:0 0 8px;">Add Blogger Account</h3>
                <label style="${labelStyle}">Blog ID</label>
                <input type="text" id="blogger-blog-id" placeholder="1234567890" style="${inputStyle}">
                <label style="${labelStyle}">Client ID</label>
                <input type="text" id="blogger-client-id" placeholder="123456789-abc.apps.googleusercontent.com" style="${inputStyle}">
                <label style="${labelStyle}">Blog Title</label>
                <input type="text" id="blogger-title" placeholder="My Blog" style="${inputStyle}">
                <div class="kv-action-buttons">
                    <button class="kv-action-btn kv-save-btn" id="blogger-save-btn">Save Account</button>
                    <button class="kv-action-btn kv-cancel-btn" id="blogger-back-btn">Back</button>
                </div>
                <details style="margin-top:14px;">
                    <summary style="cursor:pointer;font-size:0.85em;color:#555;user-select:none;">How to set up a Blogger account</summary>
                    <ol style="font-size:0.82em;color:#444;margin:8px 0 0;padding-left:1.4em;line-height:1.7;">
                        <li><a href="https://www.blogger.com" target="_blank">Open your Blogger dashboard</a> and click on your blog — the URL will contain <code style="background:#f4f4f4;padding:1px 4px;">blogID=XXXXXXXXXX</code>. Paste those digits above.</li>
                        <li><a href="https://console.cloud.google.com/projectcreate" target="_blank">Create a new Google Cloud project</a>.</li>
                        <li><a href="https://console.cloud.google.com/apis/library/blogger.googleapis.com" target="_blank">Enable the Blogger API v3</a> for that project.</li>
                        <li><a href="https://console.cloud.google.com/apis/credentials" target="_blank">Go to Credentials</a> → <strong>Create Credentials → OAuth client ID</strong>.</li>
                        <li>Choose <strong>Web application</strong>. Under <em>Authorized JavaScript origins</em>, add:<br>
                            <code style="background:#f4f4f4;padding:1px 4px;">${origin}</code></li>
                        <li>Click <strong>Create</strong> and copy the <em>Client ID</em> — paste it into the field above.</li>
                        <li><a href="https://console.cloud.google.com/auth/audience" target="_blank">Go to the Audience page</a>. Under <em>Test users</em>, add your own Google email address.</li>
                    </ol>
                </details>`;
            flow.querySelector('#blogger-save-btn').onclick = () => submitBloggerManual();
            flow.querySelector('#blogger-back-btn').onclick = () => showTypePicker();
            return;
        }

        if (type === 'WordPress') {
            const flow = div.querySelector('#add-flow');
            const inputStyle = 'display:block;width:100%;box-sizing:border-box;padding:0.2rem;font-size:0.8rem;margin:2px 0 8px;';
            const labelStyle = 'font-variant:small-caps;font-size:0.8rem;color:#555;display:block;margin-top:6px;';
            flow.innerHTML = `
                <h3 style="margin:0 0 8px;">Add WordPress Account</h3>
                <label style="${labelStyle}">Site URL</label>
                <input type="url" id="wp-site-url"
                       placeholder="https://your-site.com"
                       style="${inputStyle}">
                <div class="kv-action-buttons">
                    <button class="kv-action-btn kv-save-btn" id="wp-auth-btn">Authorize with WordPress</button>
                    <button class="kv-action-btn kv-cancel-btn" id="wp-back-btn">Back</button>
                </div>`;
            flow.querySelector('#wp-auth-btn').onclick = () => authorizeWordPress();
            flow.querySelector('#wp-back-btn').onclick = () => showTypePicker();
            return;
        }

        if (type === 'Collab') {
            const flow = div.querySelector('#add-flow');
            flow.innerHTML = `
                <h3 style="margin:0 0 8px;">Add Collab Server</h3>
                <label style="font-variant:small-caps;font-size:0.8rem;color:#555;">WebSocket URL</label>
                <input type="text" id="collab-ws-input"
                       placeholder="wss://collab.mooc.ca"
                       value="wss://collab.mooc.ca"
                       style="display:block;width:100%;box-sizing:border-box;padding:0.2rem;font-size:0.8rem;margin:2px 0 8px;">
                <div id="collab-register-status" style="font-size:0.8rem;color:#555;margin-bottom:8px;min-height:1.2em;"></div>
                <div class="kv-action-buttons">
                    <button class="kv-action-btn kv-save-btn" id="collab-connect-btn">Connect &amp; Register</button>
                    <button class="kv-action-btn kv-cancel-btn" id="collab-back-btn">Back</button>
                </div>`;
            flow.querySelector('#collab-connect-btn').onclick = () => connectCollab();
            flow.querySelector('#collab-back-btn').onclick = () => showTypePicker();
            return;
        }

        if (type === 'Annotate') {
            const flow = div.querySelector('#add-flow');
            const inputStyle = 'display:block;width:100%;box-sizing:border-box;padding:0.2rem;font-size:0.8rem;margin:2px 0 8px;';
            const labelStyle = 'font-variant:small-caps;font-size:0.8rem;color:#555;display:block;margin-top:6px;';
            const knownServers = ['https://annotations.mooc.ca', 'https://annotations.downes.ca'];
            const optionsList = knownServers.map(s => `<option value="${s}">${s}</option>`).join('') +
                                '<option value="__custom__">Custom…</option>';
            flow.innerHTML = `
                <h3 style="margin:0 0 8px;">Add Annotation Server</h3>
                <div id="anno-status" style="font-size:0.8rem;color:#555;margin-bottom:6px;min-height:1.2em;"></div>
                <label style="${labelStyle}">Server</label>
                <select id="anno-server-select" style="${inputStyle}">${optionsList}</select>
                <input type="url" id="anno-custom-url" placeholder="https://annotations.example.com"
                       style="display:none;width:100%;box-sizing:border-box;padding:0.2rem;font-size:0.8rem;margin:2px 0 8px;">
                <label style="${labelStyle}">Title</label>
                <input type="text" id="anno-title" placeholder="My Annotations" style="${inputStyle}">
                <label style="${labelStyle}">Permissions</label>
                <input type="text" id="anno-perms" value="rw" style="${inputStyle}">
                <div class="kv-action-buttons">
                    <button class="kv-action-btn kv-save-btn" id="anno-add-btn">Add Account</button>
                    <button class="kv-action-btn kv-cancel-btn" id="anno-back-btn">Back</button>
                </div>`;
            flow.querySelector('#anno-server-select').onchange = () => annoServerChanged();
            flow.querySelector('#anno-add-btn').onclick = () => connectAnnotate();
            flow.querySelector('#anno-back-btn').onclick = () => showTypePicker();

            // Auto-detect from flaskSiteUrl: kvstore.mooc.ca → annotations.mooc.ca
            const kvMatch = (window.CList.config.flaskSiteUrl || '').match(/^https?:\/\/kvstore\.(.+)/);
            if (kvMatch) {
                const autoUrl = `https://annotations.${kvMatch[1]}`;
                const sel = flow.querySelector('#anno-server-select');
                if ([...sel.options].some(o => o.value === autoUrl)) {
                    sel.value = autoUrl;
                } else {
                    const opt = new Option(autoUrl, autoUrl);
                    sel.insertBefore(opt, sel.firstChild);
                    sel.value = autoUrl;
                }
                const statusEl = flow.querySelector('#anno-status');
                statusEl.textContent = `Checking ${autoUrl}…`;
                fetch(autoUrl + '/health').then(r => {
                    if (!statusEl.isConnected) return;
                    if (r.ok) { statusEl.style.color = '#2a7a2a'; statusEl.textContent = `✓ Found annotation server at ${autoUrl}`; }
                    else      { statusEl.style.color = '#888';    statusEl.textContent = `No annotation server at ${autoUrl} — pick one below.`; }
                }).catch(() => {
                    if (statusEl.isConnected) { statusEl.style.color = '#888'; statusEl.textContent = 'Could not reach auto-detected server — pick one below.'; }
                });
            }
            return;
        }

        if (type === 'Discord') {
            const flow = div.querySelector('#add-flow');
            const inputStyle = 'display:block;width:100%;box-sizing:border-box;padding:0.2rem;font-size:0.8rem;margin:2px 0 8px;';
            const labelStyle = 'font-variant:small-caps;font-size:0.8rem;color:#555;display:block;margin-top:6px;';
            flow.innerHTML = `
                <h3 style="margin:0 0 8px;">Select Channels</h3>
                <div id="discord-select-status" style="font-size:0.8rem;color:#555;margin-bottom:6px;min-height:1.2em;"></div>
                <div id="discord-channel-list" class="account-list"></div>
                <div class="kv-action-buttons" style="margin-top:10px;">
                    <button class="kv-action-btn kv-cancel-btn" id="discord-back-btn">Back</button>
                </div>
                <details style="margin-top:14px;">
                    <summary style="cursor:pointer;font-size:0.8rem;color:#888;">Manage channels (admin)</summary>
                    <div style="margin-top:8px;">
                        <label style="${labelStyle}">Bot Token</label>
                        <input type="password" id="discord-bot-token" placeholder="" style="${inputStyle}">
                        <div class="kv-action-buttons">
                            <button class="kv-action-btn kv-save-btn" id="discord-manage-btn" type="button">Manage Channels</button>
                        </div>
                        <div id="discord-admin-panel" style="display:none;margin-top:10px;padding-top:10px;border-top:1px solid #ccc;"></div>
                    </div>
                </details>`;
            flow.querySelector('#discord-back-btn').onclick = () => showTypePicker();
            flow.querySelector('#discord-manage-btn').onclick = () => discordManageChannels({
                statusEl: flow.querySelector('#discord-select-status'),
                botTokenEl: flow.querySelector('#discord-bot-token'),
                panelEl: flow.querySelector('#discord-admin-panel'),
            });
            renderDiscordChannelPicker(flow);
            return;
        }

        const schema = window.CList?.schemas?.[type];
        if (!schema) { showStatusMessage('No schema for account type: ' + type); return; }

        div.querySelector('#add-flow').style.display = 'none';
        buildFormFields(schema, 'create', {});

        const form = div.querySelector('#sharedForm');
        const header = div.querySelector('#add-account-header');
        header.parentNode.insertBefore(form, header.nextSibling);
        form.dataset.openFor = '__add__';
        form.style.display = 'block';
        form.scrollIntoView({ behavior: 'smooth', block: 'start' });

        currentMode = 'add';
        div.querySelector('#submitBtn').textContent = 'Add Account';
        div.querySelector('#deleteBtn').style.display = 'none';
        div.querySelector('#cancelBtn').onclick = showTypePicker;
        formDirty = false;
    }

    async function connectCollab() {
        const wsUrl = (div.querySelector('#collab-ws-input').value || '').trim();
        const statusEl = div.querySelector('#collab-register-status');
        if (!wsUrl) { statusEl.textContent = 'Please enter a WebSocket URL.'; return; }

        const token = getSiteSpecificCookie(window.CList.config.flaskSiteUrl, window.CList.keys.ACCESS_TOKEN);
        if (!token) { statusEl.textContent = 'Please log in before adding a Collab account.'; return; }

        const base = wsUrl.replace(/^wss?:\/\//, 'https://').replace(/\/$/, '');
        const parentUsername = window.CList?.state?.username;
        const kvDomain = window.CList.config.flaskSiteUrl.replace(/^https?:\/\//, '');
        const did = (parentUsername && parentUsername !== 'none')
            ? `did:web:${kvDomain}:users:${parentUsername}`
            : null;

        statusEl.textContent = 'Connecting…';
        try {
            const resp = await fetch(`${base}/api/register`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ did })
            });
            if (!resp.ok) {
                const err = await resp.json().catch(() => ({}));
                statusEl.textContent = 'Connection failed: ' + (err.error || resp.status);
                return;
            }
            const data = await resp.json();
            statusEl.textContent = `Connected as ${data.username}${data.did ? ' · DID registered' : ''} — saving…`;

            // Build and encrypt the account record
            const instanceData = {
                type: 'Collab',
                instance: wsUrl,
                title: base.replace('https://', ''),
                permissions: 'e'
            };
            const encKey = await getEncKey(window.CList.config.flaskSiteUrl);
            if (!encKey) throw new Error('Encryption key not found — please log in again.');
            const encryptedValue = await encryptWithKey(encKey, JSON.stringify(instanceData));

            await window.CList.storage.kv.put(wsUrl, encryptedValue);

            accounts = await getAccounts(window.CList.config.flaskSiteUrl);
            statusEl.textContent = `✓ Registered as ${data.username} on ${base.replace('https://', '')}`;
            setTimeout(() => { cancelAdd(); getSite(window.CList.config.flaskSiteUrl); }, 1200);
        } catch (e) {
            console.error('Collab registration error:', e);
            statusEl.textContent = 'Error: ' + e.message;
        }
    }

    function annoServerChanged() {
        const sel = div.querySelector('#anno-server-select');
        const customInput = div.querySelector('#anno-custom-url');
        customInput.style.display = sel.value === '__custom__' ? 'block' : 'none';
    }

    async function connectAnnotate() {
        const statusEl = div.querySelector('#anno-status');
        const sel = div.querySelector('#anno-server-select');
        let url = sel.value === '__custom__'
            ? (div.querySelector('#anno-custom-url').value || '').trim()
            : sel.value;
        if (!url) { statusEl.textContent = 'Please select or enter a server URL.'; return; }
        url = url.replace(/\/$/, '');
        const title = (div.querySelector('#anno-title').value || '').trim();
        if (!title) { statusEl.textContent = 'Please enter a title.'; return; }
        const permissions = (div.querySelector('#anno-perms').value || 'rw').trim();
        const token = getSiteSpecificCookie(window.CList.config.flaskSiteUrl, window.CList.keys.ACCESS_TOKEN);
        if (!token) { statusEl.textContent = 'Please log in before adding an account.'; return; }

        statusEl.style.color = '#555';
        statusEl.textContent = `Checking ${url}…`;
        try {
            const healthResp = await fetch(url + '/health');
            if (!healthResp.ok) throw new Error('Server not reachable (HTTP ' + healthResp.status + ')');

            statusEl.textContent = `Registering on ${url}…`;
            const regResp = await fetch(`${url}/api/register`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
            });
            if (!regResp.ok) {
                const regErr = await regResp.json().catch(() => ({}));
                throw new Error('Registration failed: ' + (regErr.detail || regResp.status));
            }

            const instanceData = { type: 'Annotate', instance: url, title, permissions };
            const encKey = await getEncKey(window.CList.config.flaskSiteUrl);
            if (!encKey) throw new Error('Encryption key not found — please log in again.');
            const encryptedValue = await encryptWithKey(encKey, JSON.stringify(instanceData));
            await window.CList.storage.kv.put(url, encryptedValue);
            accounts = await getAccounts(window.CList.config.flaskSiteUrl);
            statusEl.style.color = '#2a7a2a';
            statusEl.textContent = `✓ Registered and account added for ${url.replace('https://', '')}`;
            setTimeout(() => { cancelAdd(); getSite(window.CList.config.flaskSiteUrl); }, 1200);
        } catch (e) {
            console.error('Annotate registration error:', e);
            statusEl.style.color = '#c00';
            statusEl.textContent = 'Error: ' + e.message;
        }
    }

    // Finds the existing Discord account (if any) subscribed to a given channel name —
    // matches on the decrypted `channel` field, not the kvstore key, so it still finds
    // accounts created under the old free-label flow.
    function findDiscordAccountKey(channelName) {
        const match = accounts.find(a => {
            const v = parseAccountValue(a);
            return v && v.type === 'Discord' && v.channel === channelName;
        });
        return match ? match.key : null;
    }

    // Renders the channel list as account-button-styled rows (matching the main account
    // list's look). Clicking an unsubscribed channel creates a Discord account for it,
    // keyed and titled by the channel's own name (e.g. "CList/General" — the admin sets
    // this naming when registering the channel); clicking a subscribed one removes it.
    async function renderDiscordChannelPicker(flow) {
        const listEl = flow.querySelector('#discord-channel-list');
        const token = getSiteSpecificCookie(window.CList.config.flaskSiteUrl, window.CList.keys.ACCESS_TOKEN);
        listEl.innerHTML = '<p class="feed-status-message">Loading channels…</p>';
        try {
            const resp = await fetch('https://discord.mooc.ca/channels', {
                headers: token ? { 'Authorization': `Bearer ${token}` } : {}
            });
            if (!resp.ok) throw new Error('HTTP ' + resp.status);
            const channels = await resp.json();
            if (!listEl.isConnected) return;
            if (!channels.length) {
                listEl.innerHTML = '<p class="feed-status-message">No channels registered yet — ask your admin to add one under Manage Channels below.</p>';
                return;
            }
            listEl.innerHTML = channels.map(c => `
                <div class="account-list-item">
                    <button type="button" class="account-button${findDiscordAccountKey(c.name) ? ' selected' : ''}" data-channel-name="${escapeHtml(c.name)}">
                        <span class="material-icons">forum</span>
                        <span>${escapeHtml(c.name)}</span>
                    </button>
                </div>`).join('');
            listEl.querySelectorAll('[data-channel-name]').forEach(btn => {
                btn.onclick = () => toggleDiscordChannel(btn.getAttribute('data-channel-name'), flow);
            });
        } catch (e) {
            console.error('Could not load Discord channels:', e);
            listEl.innerHTML = `<p class="feed-status-message">Could not load channels: ${escapeHtml(e.message)}</p>`;
        }
    }

    // Registering/removing a channel from the admin panel can happen while the Select
    // Channels picker is open behind it (create flow) or from the edit-account form,
    // where there's no picker to refresh — only re-render when the former is present.
    async function refreshDiscordChannelPickerIfVisible() {
        const flow = document.getElementById('add-flow');
        if (flow && flow.querySelector('#discord-channel-list')) {
            await renderDiscordChannelPicker(flow);
        }
    }

    async function toggleDiscordChannel(channelName, flow) {
        const statusEl = flow.querySelector('#discord-select-status');
        statusEl.style.color = '#555';
        try {
            const existingKey = findDiscordAccountKey(channelName);
            if (existingKey) {
                await window.CList.storage.kv.remove(existingKey);
                statusEl.textContent = `Unsubscribed from "${channelName}".`;
            } else {
                const instanceData = { type: 'Discord', title: channelName, permissions: 'rw', channel: channelName, bot_token: '' };
                const encKey = await getEncKey(window.CList.config.flaskSiteUrl);
                if (!encKey) throw new Error('Encryption key not found — please log in again.');
                const encryptedValue = await encryptWithKey(encKey, JSON.stringify(instanceData));
                await window.CList.storage.kv.add(channelName, encryptedValue);
                statusEl.textContent = `Subscribed to "${channelName}".`;
            }
            accounts = await getAccounts(window.CList.config.flaskSiteUrl);
            window.CList.accounts = accounts;
            populatePostOptions(accounts);
            populateReadAccountList(accounts);
            updateUIVisibility();
            await renderDiscordChannelPicker(flow);
            getSite(window.CList.config.flaskSiteUrl);
        } catch (e) {
            console.error('Discord channel toggle failed:', e);
            statusEl.style.color = '#c00';
            statusEl.textContent = 'Error: ' + e.message;
        }
    }

    // Admin "manage channels" panel — validated live against Discord on every call
    // (see discord_bridge's CLAUDE.md for the trust-on-first-use auth model).
    // ctx = { statusEl, botTokenEl, panelEl } — lets the same admin-panel logic run
    // from both the Add-account flow and the edit-account form.
    async function discordManageChannels(ctx) {
        const { statusEl, botTokenEl, panelEl } = ctx;
        const botToken = (botTokenEl.value || '').trim();
        if (!botToken) { statusEl.textContent = 'Enter the bot token above first.'; return; }
        panelEl.style.display = 'block';
        panelEl.innerHTML = '<p class="feed-status-message">Checking bot token…</p>';
        try {
            const [channelsResp, guildsResp] = await Promise.all([
                fetch(`https://discord.mooc.ca/admin/channels?bot_token=${encodeURIComponent(botToken)}`),
                fetch(`https://discord.mooc.ca/admin/guilds?bot_token=${encodeURIComponent(botToken)}`),
            ]);
            if (!channelsResp.ok) {
                const err = await channelsResp.json().catch(() => ({}));
                throw new Error(err.error || `HTTP ${channelsResp.status}`);
            }
            const channelsList = await channelsResp.json();
            const guildsList = guildsResp.ok ? await guildsResp.json() : [];
            renderDiscordAdminPanel(panelEl, channelsList, guildsList, ctx);
        } catch (e) {
            console.error('Discord admin channel list failed:', e);
            panelEl.innerHTML = `<p class="feed-status-message">Could not load channels: ${escapeHtml(e.message)}</p>`;
        }
    }

    function renderDiscordAdminPanel(panel, channelsList, guildsList, ctx) {
        const rows = channelsList.map(c => `
            <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #eee;">
                <span class="account-button" style="width:auto;flex:1 1 auto;border:none;padding:var(--pad-v) 0;cursor:default;">
                    <span class="material-icons">forum</span>
                    <span>${escapeHtml(c.name)}</span>
                </span>
                <button class="kv-action-btn kv-cancel-btn" data-channel-id="${c.id}" style="padding:2px 8px;margin-left:8px;flex-shrink:0;">Delete</button>
            </div>`).join('') || '<p class="feed-status-message">No channels registered yet.</p>';

        const guildOptions = guildsList.map(g => `<option value="${g.id}">${escapeHtml(g.name)}</option>`).join('');

        panel.innerHTML = `
            <h4 style="margin:0 0 6px;">Manage Channels</h4>
            ${rows}
            <div style="margin-top:10px;">
                <label style="font-variant:small-caps;font-size:0.8rem;color:#555;display:block;">Create New Channel</label>
                ${guildsList.length ? `
                <select id="discord-new-guild-select" style="width:100%;box-sizing:border-box;padding:0.2rem;font-size:0.8rem;margin:2px 0;">
                    ${guildOptions}
                </select>
                <input type="text" id="discord-new-channel-name" placeholder="Channel name" style="width:100%;box-sizing:border-box;padding:0.2rem;font-size:0.8rem;margin:2px 0;">
                <button class="kv-action-btn kv-save-btn" id="discord-create-channel-btn" style="margin-top:4px;">Create Channel</button>
                ` : `<p class="feed-status-message">No eligible guilds — grant the bot's role "Manage Channels" + "Manage Webhooks" in Discord's Server Settings → Roles.</p>`}
            </div>
            <div style="margin-top:14px;">
                <label style="font-variant:small-caps;font-size:0.8rem;color:#555;display:block;">Register Existing Channel</label>
                <input type="text" id="discord-new-guild" placeholder="Guild ID" style="width:100%;box-sizing:border-box;padding:0.2rem;font-size:0.8rem;margin:2px 0;">
                <input type="text" id="discord-new-channel-id" placeholder="Channel ID" style="width:100%;box-sizing:border-box;padding:0.2rem;font-size:0.8rem;margin:2px 0;">
                <input type="text" id="discord-new-webhook" placeholder="Webhook URL" style="width:100%;box-sizing:border-box;padding:0.2rem;font-size:0.8rem;margin:2px 0;">
                <button class="kv-action-btn kv-save-btn" id="discord-new-channel-btn" style="margin-top:4px;">Add Channel</button>
            </div>`;

        panel.querySelectorAll('[data-channel-id]').forEach(btn => {
            btn.onclick = () => discordDeleteChannel(btn.getAttribute('data-channel-id'), ctx);
        });
        panel.querySelector('#discord-new-channel-btn').onclick = () => discordAddChannel(panel, ctx);
        const createBtn = panel.querySelector('#discord-create-channel-btn');
        if (createBtn) createBtn.onclick = () => discordCreateChannel(panel, ctx);
    }

    async function discordCreateChannel(panel, ctx) {
        const { statusEl, botTokenEl } = ctx;
        const botToken = (botTokenEl.value || '').trim();
        const guild_id = panel.querySelector('#discord-new-guild-select').value;
        const name = (panel.querySelector('#discord-new-channel-name').value || '').trim();
        if (!guild_id || !name) {
            statusEl.textContent = 'Choose a guild and enter a channel name.';
            return;
        }
        statusEl.style.color = '#555';
        statusEl.textContent = 'Creating channel…';
        try {
            const resp = await fetch(`https://discord.mooc.ca/admin/guilds/${guild_id}/channels`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bot_token: botToken, name })
            });
            if (!resp.ok) {
                const err = await resp.json().catch(() => ({}));
                throw new Error(err.error || `HTTP ${resp.status}`);
            }
            const result = await resp.json();
            statusEl.style.color = '#2a7a2a';
            statusEl.textContent = result.name ? `✓ Created "${result.name}".` : '✓ Channel created.';
            await discordManageChannels(ctx);
            await refreshDiscordChannelPickerIfVisible();
        } catch (e) {
            console.error('Discord create channel failed:', e);
            statusEl.style.color = '#c00';
            statusEl.textContent = 'Could not create channel: ' + e.message;
        }
    }

    async function discordAddChannel(panel, ctx) {
        const { statusEl, botTokenEl } = ctx;
        const botToken = (botTokenEl.value || '').trim();
        const guild_id = (panel.querySelector('#discord-new-guild').value || '').trim();
        const channel_id = (panel.querySelector('#discord-new-channel-id').value || '').trim();
        const webhook_url = (panel.querySelector('#discord-new-webhook').value || '').trim();
        if (!guild_id || !channel_id || !webhook_url) {
            statusEl.textContent = 'Please fill in all fields to add a channel.';
            return;
        }
        statusEl.textContent = 'Looking up guild and channel names…';
        try {
            const resp = await fetch('https://discord.mooc.ca/admin/channels', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bot_token: botToken, guild_id, channel_id, webhook_url })
            });
            if (!resp.ok) {
                const err = await resp.json().catch(() => ({}));
                throw new Error(err.error || `HTTP ${resp.status}`);
            }
            const result = await resp.json();
            statusEl.style.color = '#2a7a2a';
            statusEl.textContent = result.name ? `✓ Added "${result.name}".` : '✓ Channel added.';
            await discordManageChannels(ctx);
            await refreshDiscordChannelPickerIfVisible();
        } catch (e) {
            console.error('Discord add channel failed:', e);
            statusEl.textContent = 'Could not add channel: ' + e.message;
        }
    }

    async function discordDeleteChannel(id, ctx) {
        const { statusEl, botTokenEl } = ctx;
        const botToken = (botTokenEl.value || '').trim();
        try {
            const resp = await fetch(`https://discord.mooc.ca/admin/channels/${id}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bot_token: botToken })
            });
            if (!resp.ok) {
                const err = await resp.json().catch(() => ({}));
                throw new Error(err.error || `HTTP ${resp.status}`);
            }
            await discordManageChannels(ctx);
            await refreshDiscordChannelPickerIfVisible();
        } catch (e) {
            console.error('Discord delete channel failed:', e);
            statusEl.textContent = 'Could not delete channel: ' + e.message;
        }
    }

    function cancelAdd() {
        div.querySelector('#add-flow').style.display = 'none';
        div.querySelector('#kvList').style.display = 'block';
        div.querySelector('#add-account-header').style.display = '';
    }

    // --- RSS Collection Editor ---
    // State for the two-level feed editor (list → feed editor)
    let _rssEditKey = null;
    let _rssEditTitle = null;
    let _rssEditFeeds = [];

    // Entry point called from setFormValues when type === 'RSS'
    function showRSSEditForm(key, data) {
        _rssEditKey   = key;
        _rssEditTitle = data.title || key;
        _rssEditFeeds = (data.feeds || []).map(f => ({ ...f }));
        _rssRenderList();
        currentMode = 'update';
        formDirty = false;
    }

    // Show the sorted feed list with Add Feed / Load OPML buttons
    function _rssRenderList() {
        const container = div.querySelector('#form-fields');
        container.innerHTML = '';

        const heading = document.createElement('div');
        heading.className = 'field-display';
        heading.contentEditable = 'true';
        heading.style.cssText = 'margin-bottom:8px;border-bottom:1px solid #ccc;padding:2px 4px;font-weight:bold;outline:none;';
        heading.textContent = _rssEditTitle;
        heading.addEventListener('input', () => { _rssEditTitle = heading.textContent.trim(); });
        container.appendChild(heading);

        const sorted = _rssEditFeeds
            .map((f, i) => ({ ...f, _i: i }))
            .sort((a, b) => (a.title || a.url || '').localeCompare(b.title || b.url || ''));

        if (!sorted.length) {
            const empty = document.createElement('p');
            empty.style.cssText = 'font-size:0.8rem;color:#888;margin:0 0 8px;';
            empty.textContent = 'No feeds yet.';
            container.appendChild(empty);
        } else {
            const list = document.createElement('div');
            list.style.marginBottom = '6px';
            sorted.forEach(f => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'account-button';
                btn.style.cssText = 'display:block;width:100%;text-align:left;margin-bottom:2px;font-size:0.82rem;padding:4px 8px;';
                btn.textContent = f.title || f.url;
                btn.onclick = () => _rssShowFeedEditor(f._i);
                list.appendChild(btn);
            });
            container.appendChild(list);
        }

        const addBtn = document.createElement('button');
        addBtn.type = 'button'; addBtn.className = 'kv-action-btn';
        addBtn.textContent = '+ Add Feed';
        addBtn.onclick = () => _rssShowFeedEditor(-1);
        container.appendChild(addBtn);

        const opmlBtn = document.createElement('button');
        opmlBtn.type = 'button'; opmlBtn.className = 'kv-action-btn';
        opmlBtn.style.marginLeft = '6px'; opmlBtn.textContent = 'Load OPML';
        opmlBtn.onclick = _rssShowOpmlLoader;
        container.appendChild(opmlBtn);

        // Configure shared form buttons for the list view
        const saveBtn = div.querySelector('#submitBtn');
        saveBtn.style.display = 'inline';
        saveBtn.textContent = 'Save';
        saveBtn.onclick = async () => {
            try {
                const ok = await _rssSaveCollection();
                if (ok) { showStatusMessage('Collection saved.'); getSite(window.CList.config.flaskSiteUrl); }
            } catch (e) { console.error(e); showStatusMessage('Save failed: ' + e.message); }
        };
        div.querySelector('#deleteBtn').style.display = 'inline';
        div.querySelector('#deleteBtn').textContent = 'Delete Collection';
        div.querySelector('#deleteBtn').onclick = () => _rssDeleteCollection().catch(e => { console.error(e); showStatusMessage('Delete failed: ' + e.message); });
        div.querySelector('#cancelBtn').textContent = 'Done';
        div.querySelector('#cancelBtn').onclick = tryCloseForm;
    }

    // Show the feed editor for an existing feed (feedIndex >= 0) or a new one (-1)
    function _rssShowFeedEditor(feedIndex) {
        const container = div.querySelector('#form-fields');
        const feed = feedIndex >= 0 ? _rssEditFeeds[feedIndex] : {};
        const isNew = feedIndex < 0;
        const inputStyle = 'display:block;width:100%;box-sizing:border-box;padding:0.2rem;font-size:0.8rem;margin:2px 0 8px;';
        const labelStyle = 'font-variant:small-caps;font-size:0.8rem;color:#555;display:block;margin-top:6px;';

        container.innerHTML = `
            <label style="${labelStyle}">Feed URL *</label>
            <input type="url" id="_feed-url" placeholder="https://example.com/feed" style="${inputStyle}">
            <label style="${labelStyle}">Title</label>
            <input type="text" id="_feed-title" placeholder="Feed title" style="${inputStyle}">
            <label style="${labelStyle}">Author</label>
            <input type="text" id="_feed-author" placeholder="Author name" style="${inputStyle}">
            <label style="${labelStyle}">Icon URL</label>
            <input type="url" id="_feed-icon" placeholder="https://example.com/icon.png" style="${inputStyle}">`;

        // Set values safely via DOM properties (not innerHTML) to avoid injection
        container.querySelector('#_feed-url').value   = feed.url    || '';
        container.querySelector('#_feed-title').value = feed.title  || '';
        container.querySelector('#_feed-author').value = feed.author || '';
        container.querySelector('#_feed-icon').value  = feed.icon   || '';

        div.querySelector('#submitBtn').style.display = '';
        div.querySelector('#submitBtn').textContent = isNew ? 'Add Feed' : 'Save Feed';
        div.querySelector('#submitBtn').onclick = () => _rssSaveFeedFromEditor(feedIndex).catch(e => { console.error(e); showStatusMessage('Save failed: ' + e.message); });
        div.querySelector('#deleteBtn').style.display = isNew ? 'none' : 'inline';
        div.querySelector('#deleteBtn').textContent = 'Remove Feed';
        div.querySelector('#deleteBtn').onclick = () => _rssDeleteFeed(feedIndex).catch(e => { console.error(e); showStatusMessage('Delete failed: ' + e.message); });
        div.querySelector('#cancelBtn').textContent = 'Back';
        div.querySelector('#cancelBtn').onclick = _rssRenderList;
    }

    async function _rssSaveFeedFromEditor(feedIndex) {
        const url = (div.querySelector('#_feed-url')?.value || '').trim();
        if (!url) { showStatusMessage('Feed URL is required.'); return; }
        const feedData = {
            url,
            title:  (div.querySelector('#_feed-title')?.value  || '').trim() || url,
            author: (div.querySelector('#_feed-author')?.value || '').trim(),
            icon:   (div.querySelector('#_feed-icon')?.value   || '').trim(),
        };
        if (feedIndex < 0) {
            _rssEditFeeds.push(feedData);
        } else {
            _rssEditFeeds[feedIndex] = feedData;
        }
        const ok = await _rssSaveCollection();
        if (ok) {
            showStatusMessage(feedIndex < 0 ? 'Feed added.' : 'Feed saved.');
            _rssRenderList();
        }
    }

    async function _rssDeleteFeed(feedIndex) {
        const btn = div.querySelector('#deleteBtn');
        if (btn && btn.dataset.confirm !== 'pending') {
            btn.dataset.confirm = 'pending';
            btn.textContent = 'Click again to confirm';
            btn.style.background = '#c0392b';
            setTimeout(() => {
                if (btn.dataset.confirm === 'pending') {
                    btn.dataset.confirm = '';
                    btn.textContent = 'Remove Feed';
                    btn.style.background = '';
                }
            }, 3000);
            return;
        }
        if (btn) { btn.dataset.confirm = ''; btn.textContent = 'Remove Feed'; btn.style.background = ''; }
        _rssEditFeeds.splice(feedIndex, 1);
        const ok = await _rssSaveCollection();
        if (ok) {
            showStatusMessage('Feed removed.');
            _rssRenderList();
        }
    }

    async function _rssDeleteCollection() {
        const btn = div.querySelector('#deleteBtn');
        if (btn && btn.dataset.confirm !== 'pending') {
            btn.dataset.confirm = 'pending';
            btn.textContent = 'Click again to confirm';
            btn.style.background = '#c0392b';
            setTimeout(() => {
                if (btn.dataset.confirm === 'pending') {
                    btn.dataset.confirm = '';
                    btn.textContent = 'Delete Collection';
                    btn.style.background = '';
                }
            }, 3000);
            return;
        }
        if (btn) { btn.dataset.confirm = ''; btn.textContent = 'Delete Collection'; btn.style.background = ''; }
        try {
            await window.CList.storage.kv.remove(_rssEditKey);
            accounts = await getAccounts(window.CList.config.flaskSiteUrl);
            populatePostOptions(accounts);
            populateReadAccountList(accounts);
            updateUIVisibility();
            showStatusMessage(`"${_rssEditKey}" deleted.`);
            closeForm();
            getSite(window.CList.config.flaskSiteUrl);
        } catch (err) {
            console.error('RSS collection delete failed:', err);
            showStatusMessage('Could not delete: ' + err.message);
        }
    }

    // Show OPML import panel (URL or file)
    function _rssShowOpmlLoader() {
        const container = div.querySelector('#form-fields');
        const inputStyle = 'display:block;width:100%;box-sizing:border-box;padding:0.2rem;font-size:0.8rem;margin:2px 0 8px;';
        const labelStyle = 'font-variant:small-caps;font-size:0.8rem;color:#555;display:block;margin-top:6px;';
        container.innerHTML = `
            <p style="font-size:0.85rem;margin:0 0 10px;">Add feeds from an OPML source. New feeds will be added; existing feeds will not be changed.</p>
            <label style="${labelStyle}">Load from URL</label>
            <div style="display:flex;gap:4px;align-items:flex-start;margin-bottom:12px;">
                <input type="url" id="_opml-url" placeholder="https://example.com/feeds.opml" style="${inputStyle}margin-bottom:0;flex:1;">
                <button type="button" class="kv-action-btn" id="_opml-url-btn">Load URL</button>
            </div>
            <label style="${labelStyle}">Load from File</label>
            <input type="file" id="_opml-file" accept=".opml,.xml" style="font-size:0.8rem;margin-bottom:8px;">
            <div id="_opml-status" style="font-size:0.8rem;color:#888;margin-top:4px;"></div>`;
        container.querySelector('#_opml-url-btn').onclick = () => _rssLoadOpmlFromUrl().catch(e => { console.error(e); const s = container.querySelector('#_opml-status'); if (s) s.textContent = 'Error: ' + e.message; });
        container.querySelector('#_opml-file').onchange   = _rssLoadOpmlFromFile;
        div.querySelector('#submitBtn').style.display = 'none';
        div.querySelector('#deleteBtn').style.display = 'none';
        div.querySelector('#cancelBtn').textContent = 'Back';
        div.querySelector('#cancelBtn').onclick = _rssRenderList;
    }

    async function _rssLoadOpmlFromUrl() {
        const url = (div.querySelector('#_opml-url')?.value || '').trim();
        if (!url) { showStatusMessage('Please enter an OPML URL.'); return; }
        const status = div.querySelector('#_opml-status');
        status.textContent = 'Fetching…';
        try {
            const serviceUrl = (typeof getOpml2jsonUrl === 'function')
                ? await getOpml2jsonUrl()
                : 'https://opml2json.downes.ca';
            const fd = new FormData();
            fd.append('url', url);
            const resp = await fetch(`${serviceUrl}/list_feeds`, { method: 'POST', body: fd });
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const data = await resp.json();
            if (!data.ok) throw new Error(data.error || 'list_feeds failed');
            await _rssImportFeeds(data.feeds, status);
        } catch (err) {
            console.error('OPML URL load failed:', err);
            status.textContent = 'Error: ' + err.message;
        }
    }

    function _rssLoadOpmlFromFile() {
        const file = div.querySelector('#_opml-file')?.files[0];
        if (!file) return;
        const status = div.querySelector('#_opml-status');
        status.textContent = 'Reading…';
        const reader = new FileReader();
        reader.onload = async ev => {
            try {
                const doc = new DOMParser().parseFromString(ev.target.result, 'text/xml');
                const feeds = Array.from(doc.getElementsByTagName('outline'))
                    .map(o => ({
                        url:   o.getAttribute('xmlUrl') || o.getAttribute('xmlurl'),
                        title: o.getAttribute('title') || o.getAttribute('text') || '',
                    }))
                    .filter(f => f.url)
                    .map(f => ({ ...f, title: f.title || f.url }));
                await _rssImportFeeds(feeds, status);
            } catch (err) {
                console.error('OPML file parse failed:', err);
                status.textContent = 'Error: ' + err.message;
            }
        };
        reader.onerror = () => {
            console.error('FileReader error:', reader.error);
            status.textContent = 'Error reading file: ' + (reader.error?.message || 'unknown error');
        };
        reader.readAsText(file);
    }

    async function _rssImportFeeds(feeds, statusEl) {
        if (!feeds || !feeds.length) { statusEl.textContent = 'No feeds found in OPML.'; return; }
        const existingUrls = new Set(_rssEditFeeds.map(f => f.url));
        let added = 0;
        for (const f of feeds) {
            if (!existingUrls.has(f.url)) {
                _rssEditFeeds.push({ url: f.url, title: f.title || f.url, author: '', icon: '' });
                existingUrls.add(f.url);
                added++;
            }
        }
        if (!added) { statusEl.textContent = 'All feeds already in collection.'; return; }
        const ok = await _rssSaveCollection();
        if (ok) {
            showStatusMessage(`${added} feed${added > 1 ? 's' : ''} added.`);
            _rssRenderList();
        } else {
            statusEl.textContent = 'Save failed.';
        }
    }

    // Save _rssEditFeeds to kvstore. Returns true on success.
    async function _rssSaveCollection() {
        try {
            const encKey = await getEncKey(window.CList.config.flaskSiteUrl);
            if (!encKey) throw new Error('Encryption key not found — please log in again.');
            const collectionData = { type: 'RSS', instance: _rssEditKey, title: _rssEditTitle || _rssEditKey, feeds: _rssEditFeeds, permissions: 'r' };
            const encryptedValue = await encryptWithKey(encKey, JSON.stringify(collectionData));
            await window.CList.storage.kv.update(_rssEditKey, encryptedValue);
            try {
                const accts = await getAccounts(window.CList.config.flaskSiteUrl);
                if (accts) {
                    window.CList.accounts = accts;
                    populatePostOptions(accts);
                    populateReadAccountList(accts);
                    updateUIVisibility();
                }
            } catch (e) {
                console.warn('Account refresh failed:', e);
            }
            return true;
        } catch (err) {
            console.error('RSS collection save failed:', err);
            showStatusMessage('Could not save: ' + err.message);
            return false;
        }
    }

    // Create a new (empty) RSS collection
    async function submitRSSCollection() {
        const name = div.querySelector('#rss-collection-name').value.trim();
        if (!name) { showStatusMessage('Please enter a collection name.'); return; }
        try {
            const encKey = await getEncKey(window.CList.config.flaskSiteUrl);
            if (!encKey) throw new Error('Encryption key not found — please log in again.');
            const collectionData = { type: 'RSS', instance: name, title: name, feeds: [], permissions: 'r' };
            const encryptedValue = await encryptWithKey(encKey, JSON.stringify(collectionData));
            await window.CList.storage.kv.put(name, encryptedValue);
            accounts = await getAccounts(window.CList.config.flaskSiteUrl);
            populatePostOptions(accounts);
            populateReadAccountList(accounts);
            updateUIVisibility();
            showStatusMessage(`Collection "${name}" created. Open it to add feeds.`);
            cancelAdd();
            getSite(window.CList.config.flaskSiteUrl);
        } catch (err) {
            console.error('RSS collection create failed:', err);
            showStatusMessage('Could not create collection: ' + err.message);
        }
    }

    async function submitBloggerManual() {
        const blogId      = div.querySelector('#blogger-blog-id').value.trim();
        const clientId    = div.querySelector('#blogger-client-id').value.trim();
        const title       = div.querySelector('#blogger-title').value.trim();

        if (!blogId)   { showStatusMessage('Please enter your Blog ID.');    return; }
        if (!clientId) { showStatusMessage('Please enter your Client ID.'); return; }

        const instanceData = { type: 'Blogger', id: clientId, title: title || blogId, permissions: 'w' };

        try {
            const encKey = await getEncKey(window.CList.config.flaskSiteUrl);
            if (!encKey) throw new Error('Encryption key not found — please log in again.');
            const encryptedValue = await encryptWithKey(encKey, JSON.stringify(instanceData));

            await window.CList.storage.kv.put(blogId, encryptedValue);

            window.CList.accounts = await getAccounts(window.CList.config.flaskSiteUrl);
            populatePostOptions(window.CList.accounts);
            updateUIVisibility();
            showStatusMessage('Blogger account saved.');
            cancelAdd();
            getSite(window.CList.config.flaskSiteUrl);
        } catch (err) {
            console.error('Blogger save failed:', err);
            showStatusMessage('Could not save account: ' + err.message);
        }
    }

    function authorizeWordPress() {
        let siteUrl = div.querySelector('#wp-site-url').value.trim();
        if (!siteUrl) {
            showStatusMessage('Please enter your WordPress site URL.');
            return;
        }
        if (!/^https?:\/\//i.test(siteUrl)) siteUrl = 'https://' + siteUrl;
        wpAuthStart(siteUrl);
    }

    function submitMastodonUsername() {
        const username = div.querySelector('#mastodon-username-input').value.trim();
        if (!username.includes('@')) {
            showStatusMessage('Please enter your username as you@instance.social');
            return;
        }
        mastodonOAuthStart(username, username, 'rw');
    }

    async function submitMastodonManual() {
        const username    = div.querySelector('#mastodon-username-input').value.trim();
        const title       = div.querySelector('#mastodon-manual-title').value.trim();
        const permissions = div.querySelector('#mastodon-manual-permissions').value.trim() || 'rw';
        const token       = div.querySelector('#mastodon-manual-token').value.trim();

        if (!username.includes('@')) {
            showStatusMessage('Please enter your username as you@instance.social');
            return;
        }
        if (!token) {
            showStatusMessage('Please paste an access token.');
            return;
        }

        const instanceData = {
            type: 'Mastodon',
            instance: username,
            id: token,
            title: title || username,
            permissions,
        };

        try {
            const encKey = await getEncKey(window.CList.config.flaskSiteUrl);
            if (!encKey) throw new Error('Encryption key not found — please log in again.');
            const encryptedValue = await encryptWithKey(encKey, JSON.stringify(instanceData));

            await window.CList.storage.kv.put(username, encryptedValue);

            accounts = await getAccounts(window.CList.config.flaskSiteUrl);
            populateReadAccountList(accounts);
            populatePostOptions(accounts);
            updateUIVisibility();
            showStatusMessage('Mastodon account saved.');
            cancelAdd();
            getSite(window.CList.config.flaskSiteUrl);
        } catch (err) {
            console.error('Manual Mastodon save failed:', err);
            showStatusMessage('Could not save account: ' + err.message);
        }
    }

    function resetForm() {
        currentMode = 'add';
        currentSchema = null;
        formDirty = false;
    }

    // Local override of the global accountIcon() (reader.js) — adds Hypothesis/Annotate cases.
    function accountIcon(type) {
        if (type === 'Mastodon') {
            const span = document.createElement('span');
            span.className = 'account-icon-img';
            span.setAttribute('aria-label', 'Mastodon');
            return span;
        }
        if (type === 'OPML') {
            const span = document.createElement('span');
            span.className = 'account-icon-img account-icon-img--opml';
            span.setAttribute('aria-label', 'OPML');
            return span;
        }
        if (type === 'Hypothesis') {
            const span = document.createElement('span');
            span.className = 'account-icon-img account-icon-img--hypothesis';
            span.setAttribute('aria-label', 'Hypothes.is');
            return span;
        }
        const materialIcons = {
            'Bluesky':   'cloud',
            'RSS':       'rss_feed',
            'WordPress': 'article',
            'Blogger':   'article',
            'Annotate':  'rate_review',
        };
        const span = document.createElement('span');
        span.className = 'material-icons';
        span.textContent = materialIcons[type] || 'account_circle';
        return span;
    }

    async function getSite(flaskSiteUrl) {
        const kvList = div.querySelector('#kvList');

        try {
            // Reuse getAccounts() rather than re-fetching/re-decrypting /get_kvs/ independently —
            // it already applies the one definitive system/collection/following-key exclusion list.
            const accounts = await getAccounts(flaskSiteUrl);
            if (!accounts) return; // getAccounts() already called loginRequired() in this case

            kvList.innerHTML = '';  // Clear previous entries

            const accountList = document.createElement('div');
            accountList.className = 'account-list';
            const tip = document.createElement('div');
            tip.className = 'list-tip';
            tip.textContent = 'Select an account to manage';
            accountList.appendChild(tip);

            let decryptFailCount = 0;
            for (const account of accounts) {
                const parsedValue = JSON.parse(account.value);
                const unreadable = parsedValue.type === 'bad'; // getAccounts()'s marker for a failed decrypt
                if (unreadable) decryptFailCount++;

                const item = document.createElement('div');
                item.className = 'account-list-item';
                const button = document.createElement('button');
                button.className = 'account-button' + (unreadable ? ' account-button--unreadable' : '');
                button.appendChild(accountIcon(unreadable ? '' : parsedValue.type));
                const name = document.createElement('span');
                name.textContent = unreadable ? account.key : (parsedValue.title || account.key);
                button.appendChild(name);
                button.onclick = () => openEdit(account.key, item);
                item.appendChild(button);
                accountList.appendChild(item);
            }
            kvList.appendChild(accountList);
            if (accounts.length > 0 && decryptFailCount === accounts.length) {
                const errBanner = document.createElement('p');
                errBanner.className = 'list-tip';
                errBanner.style.color = '#c44';
                errBanner.textContent = 'Could not decrypt accounts — session key missing. Please log out and log back in.';
                kvList.appendChild(errBanner);
            }

        } catch (error) {
            console.error('Error fetching account list:', error);
            if (kvList) kvList.innerHTML = `<p class="list-tip" style="color:#c44;">Could not load accounts — ${error.message}. Try logging out and back in.</p>`;
        }
    }

    async function deleteKeyValue() {
        const keyEl = div.querySelector('#_keyInput');
        const key = keyEl ? keyEl.value : '';
        const titleEl = div.querySelector('#titleInput');
        const title = (titleEl ? titleEl.value : '') || key;
        if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;

        if (key) {
            window.CList.storage.kv.remove(key)
            .then(async () => {
                try {
                    accounts = await getAccounts(window.CList.config.flaskSiteUrl);
                    populatePostOptions(accounts);
                    populateReadAccountList(accounts);
                    updateUIVisibility();
                } catch (error) {
                    console.error('Error fetching accounts:', error);
                } finally {
                    closeForm();
                    getSite(window.CList.config.flaskSiteUrl);
                }
            })
            .catch(error => showStatusMessage('Error deleting account: ' + error));
        } else {
            showStatusMessage('No key specified for deletion.');
        }
    }

    // Wire up the static buttons declared in the innerHTML above
    div.querySelector('#submitBtn').onclick = () => addOrUpdateKeyValue();
    div.querySelector('#deleteBtn').onclick = () => deleteKeyValue();
    div.querySelector('#cancelBtn').onclick = () => tryCloseForm();
    div.querySelector('#addKvForm').onsubmit = () => { addOrUpdateKeyValue(); return false; };
    div.querySelector('#add-account-btn').onclick = () => openAdd();

    // Mark form dirty whenever any field changes
    div.querySelector('#addKvForm').addEventListener('input',  markDirty);
    div.querySelector('#addKvForm').addEventListener('change', markDirty);

    // Initialize: load accounts and render the list (was the DOMContentLoaded handler)
    (async () => {
        if (getSiteSpecificCookie(window.CList.config.flaskSiteUrl, window.CList.keys.ACCESS_TOKEN)) {
            resetForm();
            try {
                accounts = await getAccounts(window.CList.config.flaskSiteUrl);
            } catch (error) {
                console.error('Error fetching accounts:', error);
            }
        } else {
            console.error('Token not found.');
            return;
        }
        getSite(window.CList.config.flaskSiteUrl);
    })();

    return div;
}

function playMe() {
    // Push a {panel:'me'} entry so that Back from a sub-panel (Following/Identity/Options),
    // which pushes this same state before opening, has somewhere correct to land.
    history.pushState({ panel: 'me' }, '');
    openLeftInterface(kvstoreMePanel());
}

// Returns the Me panel element (DID management and public identity settings)
// Inlined directly (not an iframe) so it works under file:// — file:// iframes get an
// opaque "null" origin and can't share any state (localStorage, cookies, JS calls) with
// their parent, even when served from the exact same directory.
function kvstoreMePanel() {
    const div = document.createElement('div');
    div.className = 'kvcontainer';
    div.innerHTML = `
        <div class="me-section me-section--top">

            <div class="nav-item" data-federation="1">
                <button class="nav-btn" id="me-nav-following">Following</button>
                <p class="nav-desc">People you follow. Their annotations appear alongside your own when you view annotation threads.</p>
            </div>

            <div class="nav-item" data-federation="1">
                <button class="nav-btn" id="me-nav-identity">Identity</button>
                <p class="nav-desc">Manage your decentralized identity (DID), link your social accounts, and control what is publicly visible.</p>
            </div>

            <div class="nav-item">
                <button class="nav-btn" id="me-nav-options">Options</button>
                <p class="nav-desc">Configure application preferences and settings.</p>
            </div>

            <div class="nav-item" data-federation="1">
                <button class="nav-btn" id="me-nav-annotations">Annotations</button>
                <p class="nav-desc">View all your annotations.</p>
            </div>

            <div class="nav-item">
                <button class="nav-btn" id="me-nav-collections">My Collections</button>
                <p class="nav-desc">Manage your saved collections of links and resources.</p>
            </div>

            <div class="nav-item" data-admin-only="1">
                <button class="nav-btn" id="me-nav-app-settings">App Settings</button>
                <p class="nav-desc">View or change admin-editable runtime settings for apps that support it.</p>
            </div>

        </div>
    `;
    div.querySelector('#me-nav-following').onclick    = () => playFollowing();
    div.querySelector('#me-nav-identity').onclick      = () => playDid();
    div.querySelector('#me-nav-options').onclick       = () => playOptions();
    div.querySelector('#me-nav-annotations').onclick   = () => window.showAnnotations('my');
    div.querySelector('#me-nav-collections').onclick   = () => window.showSavedCollections();
    div.querySelector('#me-nav-app-settings').onclick  = () => playAppSettings();

    // Following, Identity (DID), and Annotations all require a real server reachable by other
    // people — nothing a Local-only account (see local-kvstore.js) can provide.
    if (window.CList.isLocalMode && window.CList.isLocalMode()) {
        div.querySelectorAll('[data-federation="1"]').forEach(el => el.style.display = 'none');
    }
    // App Settings is cosmetically hidden for non-admins — the real security boundary is
    // each app's own ADMIN_USERNAMES check server-side (see admin_settings.py).
    if (window.CList.state.username !== window.CList.config.adminUsername) {
        div.querySelectorAll('[data-admin-only="1"]').forEach(el => el.style.display = 'none');
    }
    return div;
}

function playFollowing() {
    history.pushState({ panel: 'me' }, '');
    openLeftInterface(kvstoreFollowingPanel());
}

// Returns the Following panel element (list of followed DIDs)
// Inlined directly (not an iframe) — see kvstoreMePanel() comment for why.
function kvstoreFollowingPanel() {
    const div = document.createElement('div');
    div.className = 'kvcontainer';
    div.innerHTML = `
        <button class="back-btn" id="following-back-btn">&#8592; Back</button>
        <div class="me-section me-section--flat">
            <h3>Following</h3>
            <div id="following-list" class="me-status">Loading…</div>
        </div>
    `;
    div.querySelector('#following-back-btn').onclick = () => history.back();

    async function unfollowDid(kvKey, rowEl) {
        try {
            await window.CList.storage.kv.remove(kvKey);
            if (typeof _clistAnnotateInvalidateFollowCache === 'function') {
                _clistAnnotateInvalidateFollowCache();
            }
            rowEl.remove();
            const listEl = div.querySelector('#following-list');
            if (!listEl.hasChildNodes()) {
                listEl.textContent = 'Not following anyone yet.';
            }
        } catch(e) {
            console.error('Unfollow failed:', e);
            showStatusMessage('Unfollow failed: ' + e.message);
        }
    }

    async function loadFollowing() {
        const listEl  = div.querySelector('#following-list');
        const token    = getSiteSpecificCookie(window.CList.config.flaskSiteUrl, window.CList.keys.ACCESS_TOKEN);
        window.CList.state.username = getSiteSpecificCookie(window.CList.config.flaskSiteUrl, window.CList.keys.USERNAME);
        if (!token || !window.CList.state.username) {
            listEl.textContent = 'Not logged in — please log in first.';
            return;
        }
        let kvs;
        try {
            kvs = await window.CList.storage.kv.list();
        } catch (err) {
            console.error('loadFollowing fetch failed:', err);
            listEl.textContent = `Could not load data (${err.message}). Check your connection or log in again.`;
            return;
        }
        const followingItems = kvs.filter(k => k.key.startsWith('social:following:'));
        if (followingItems.length === 0) {
            listEl.textContent = 'Not following anyone yet.';
            return;
        }
        const encKey = await getEncKey(window.CList.config.flaskSiteUrl);
        if (!encKey) {
            listEl.textContent = 'Encryption key not available — please log in again.';
            return;
        }
        const myDomain = (window.CList.config.flaskSiteUrl || '').replace(/^https?:\/\//, '');
        listEl.innerHTML = '';
        for (const kv of followingItems) {
            let did = kv.key.replace('social:following:', '');
            try {
                const decrypted = await decryptWithKey(encKey, kv.value);
                did = JSON.parse(decrypted).did || did;
            } catch(e) {
                console.error('Could not decrypt follow entry:', kv.key, e);
            }
            const parts = did.split(':');
            const displayName = parts[parts.length - 1] || did;
            const domain = parts[2] || '';
            const profileUrl = domain ? `https://${domain}/users/${displayName}/did.html` : '';
            const row = document.createElement('div');
            row.className = 'following-item';
            const nameEl = document.createElement('span');
            nameEl.className = 'following-name';
            if (profileUrl) {
                const a = document.createElement('a');
                a.href = profileUrl;
                a.target = '_blank';
                a.textContent = domain !== myDomain ? `${displayName} (${domain})` : displayName;
                nameEl.appendChild(a);
            } else {
                nameEl.textContent = did;
            }
            row.appendChild(nameEl);
            const btn = document.createElement('button');
            btn.className = 'unfollow-btn';
            btn.textContent = 'Unfollow';
            btn.onclick = () => unfollowDid(kv.key, row);
            row.appendChild(btn);
            listEl.appendChild(row);
        }
    }

    loadFollowing();
    return div;
}

function playDid() {
    history.pushState({ panel: 'me' }, '');
    openLeftInterface(kvstoreDidPanel());
}

// Returns the Identity panel element (DID management and public identity settings)
// Inlined directly (not an iframe) — see kvstoreMePanel() comment for why.
function kvstoreDidPanel() {
    const div = document.createElement('div');
    div.className = 'kvcontainer';
    div.innerHTML = `
        <button class="back-btn" id="did-back-btn">&#8592; Back</button>

        <div class="me-section" id="public-accounts-section" style="display:none;">
            <h3>Public Accounts</h3>
            <p>Checked accounts are listed in your public DID document and discoverable by others. Click 'Update DID' to register your list in your DID document.</p>
            <div id="account-list" class="me-status">Loading…</div>
            <div class="kv-action-buttons">
                <button class="kv-action-btn kv-save-btn" id="did-update-btn">Update DID</button>
            </div>
        </div>

        <div class="me-section">
            <h3>Decentralized Identity (DID)</h3>
            <details class="did-help">
                <summary>What is this?</summary>
                <p>A DID (Decentralized Identifier) is a unique address for your online identity that you control — not a platform. It links your accounts (Mastodon, Bluesky, WordPress) into a single verifiable identity, published at a public URL others can check. Generating a key creates a cryptographic keypair: the private key stays encrypted in your account here; the public key is published so others can confirm content or connections really come from you.</p>
            </details>
            <div id="did-status" class="me-status">Checking…</div>
            <div class="kv-action-buttons">
                <button class="kv-action-btn kv-save-btn" id="did-btn">Generate Identity Key</button>
            </div>
            <details class="did-help" id="did-regen-help" style="display:none;">
                <summary>What does regenerating do?</summary>
                <p>Regenerating creates a brand-new keypair, replacing your old one. Your DID address stays the same and your linked accounts are preserved, but your public key changes. Anyone who cached your old key will need to re-fetch your DID document. Do this only if you suspect your private key has been compromised.</p>
            </details>
            <details class="did-help did-remove" id="did-remove-help" style="display:none;">
                <summary>Remove DID…</summary>
                <p>This will permanently delete your identity key and remove your DID document from its public URL. Anyone who has linked to your DID will get a 404. You can generate a new DID at any time, but it will have a new key and a fresh identity. If you do, anyone who linked to your DID will get your new public key automatically the next time they resolve it — DID resolution always fetches fresh from the URL.</p>
                <div class="kv-action-buttons">
                    <button class="kv-action-btn kv-delete-btn" id="did-remove-btn">Yes, remove my DID</button>
                </div>
            </details>
        </div>


        <div class="me-section" id="migrate-section" style="display:none;">
            <h3>Migrate to New Account Server</h3>
            <details class="did-help">
                <summary>What is this?</summary>
                <p>Move your accounts and DID identity to a different Account Server. All your credentials are exported, re-encrypted with your new server's key, and uploaded securely. Your old account is not deleted — both will exist until you delete the old one.</p>
                <p><strong>Note:</strong> The destination server must allow connections from this app's origin. Any kvstore server configured to accept requests from <code>clist.mooc.ca</code> will work.</p>
            </details>

            <div id="migrate-step-1">
                <div style="margin:0.6em 0;">
                    <label style="display:block; font-size:0.85em; color:#555; margin-bottom:0.2em;">Destination server URL</label>
                    <input type="text" id="migrate-new-url" value="https://kvstore.mooc.ca"
                        style="width:100%; box-sizing:border-box; padding:0.35em 0.5em; font-size:0.9em; border:1px solid #ccc; border-radius:4px;">
                </div>
                <div style="margin:0.6em 0;">
                    <label style="display:block; font-size:0.85em; color:#555; margin-bottom:0.2em;">Username on destination server</label>
                    <input type="text" id="migrate-new-username" placeholder="username"
                        style="width:100%; box-sizing:border-box; padding:0.35em 0.5em; font-size:0.9em; border:1px solid #ccc; border-radius:4px;">
                </div>
                <div style="margin:0.6em 0;">
                    <label style="display:block; font-size:0.85em; color:#555; margin-bottom:0.2em;">Password on destination server</label>
                    <input type="password" id="migrate-new-password" placeholder="password"
                        style="width:100%; box-sizing:border-box; padding:0.35em 0.5em; font-size:0.9em; border:1px solid #ccc; border-radius:4px;">
                </div>
                <div style="margin:0.6em 0; font-size:0.85em;">
                    <label><input type="checkbox" id="migrate-register" style="margin-right:0.4em;">Register a new account on the destination server</label>
                </div>
                <div class="kv-action-buttons">
                    <button class="kv-action-btn kv-save-btn" id="migrate-prepare-btn">Preview Migration</button>
                </div>
            </div>

            <div id="migrate-step-2" style="display:none;">
                <div id="migrate-preview" style="font-size:0.9em;"></div>
                <div class="kv-action-buttons">
                    <button class="kv-action-btn kv-save-btn" id="migrate-run-btn">Run Migration</button>
                    <button class="kv-action-btn" id="migrate-cancel-btn" style="margin-left:0.5em;">Cancel</button>
                </div>
            </div>

            <div id="migrate-progress" class="me-status" style="display:none;"></div>
        </div>
    `;

    div.querySelector('#did-back-btn').onclick = () => history.back();

    async function loadAccounts() {
        const listEl = div.querySelector('#account-list');
        const token  = getSiteSpecificCookie(window.CList.config.flaskSiteUrl, window.CList.keys.ACCESS_TOKEN);
        window.CList.state.username = getSiteSpecificCookie(window.CList.config.flaskSiteUrl, window.CList.keys.USERNAME);
        if (!token || !window.CList.state.username) {
            listEl.textContent = 'Not logged in — please log in first.';
            return;
        }

        let kvs;
        try {
            kvs = await window.CList.storage.kv.list();
        } catch (err) {
            console.error('loadAccounts fetch failed:', err);
            listEl.textContent = `Could not load accounts (${err.message}). Check your connection or log in again.`;
            return;
        }

        const encKey = await getEncKey(window.CList.config.flaskSiteUrl);
        if (!encKey) {
            listEl.textContent = 'Encryption key not available — please log in again.';
            return;
        }

        const PUBLIC_TYPES = new Set(['Mastodon', 'Bluesky', 'WordPress', 'Blogger', 'Annotate', 'Hypothesis']);

        const rows = [];
        for (const kv of kvs.filter(k => !k.key.startsWith('_'))) {
            try {
                const plain = await decryptWithKey(encKey, kv.value);
                const data  = JSON.parse(plain);
                if (PUBLIC_TYPES.has(data.type)) rows.push({ key: kv.key, data });
            } catch (err) { console.error(`Decryption failed for account "${kv.key}" — skipping.`, err); }
        }

        if (rows.length === 0) {
            listEl.textContent = 'No social or blog accounts found. Add Mastodon, Bluesky, WordPress, or Blogger accounts via the Accounts panel.';
            return;
        }

        listEl.innerHTML = rows.map(({ key, data }) => `
            <div class="account-row">
                <input type="checkbox" id="pub_${CSS.escape(key)}" data-key="${key}" ${data.public ? 'checked' : ''}>
                <label for="pub_${CSS.escape(key)}">
                    <strong>${data.title || key}</strong>
                    <span class="account-type">${data.type || ''}</span>
                </label>
            </div>
        `).join('');
    }

    async function updateDid() {
        const statusEl = div.querySelector('#did-status');
        const token    = getSiteSpecificCookie(window.CList.config.flaskSiteUrl, window.CList.keys.ACCESS_TOKEN);
        window.CList.state.username = getSiteSpecificCookie(window.CList.config.flaskSiteUrl, window.CList.keys.USERNAME);
        if (!token || !window.CList.state.username) {
            statusEl.textContent = 'Not logged in — please log in first.';
            return;
        }

        let existingProfile;
        try {
            const res = await fetch(`${window.CList.config.flaskSiteUrl}/users/${window.CList.state.username}/did.json`);
            if (!res.ok) throw new Error('no profile');
            existingProfile = await res.json();
        } catch {
            statusEl.textContent = 'No DID registered yet — generate an identity key first.';
            return;
        }

        const encKey = await getEncKey(window.CList.config.flaskSiteUrl);
        const checkboxes = div.querySelectorAll('#account-list input[type="checkbox"]');
        const services   = [];
        const alsoKnownAs = existingProfile.alsoKnownAs
            ? existingProfile.alsoKnownAs.filter(a => !a.startsWith('did:key:'))
            : [];

        let kvs = [];
        try {
            kvs = await window.CList.storage.kv.list();
        } catch (err) {
            console.error('updateDid fetch failed:', err);
            statusEl.textContent = `Could not load accounts (${err.message}). Try again or log in again.`;
            return;
        }

        const typeMap = {
            Mastodon:  'SocialWebAccount',
            WordPress: 'Blog',
            Blogger:   'Blog',
            Etherpad:  'CollaborationService',
            OPML:      'FeedList',
            AI:        'AIService',
            Proxyp:    'ProxyService',
            Annotate:   'AnnotationService',
            Hypothesis: 'AnnotationService',
        };

        for (const cb of checkboxes) {
            const key      = cb.dataset.key;
            const isPublic = cb.checked;
            const kv       = kvs.find(k => k.key === key);
            if (!kv) continue;

            let data;
            try {
                data = JSON.parse(await decryptWithKey(encKey, kv.value));
            } catch { continue; }

            data.public = isPublic;
            const encrypted = await encryptWithKey(encKey, JSON.stringify(data));
            try {
                await window.CList.storage.kv.update(key, encrypted);
            } catch (err) {
                // Preserve prior fire-and-forget behavior: a failed per-account
                // visibility update must not abort the rest of the DID update.
                console.warn(`Could not update visibility for "${key}":`, err);
            }

            if (!isPublic) continue;

            if (data.type === 'Bluesky') {
                const handle = `at://${data.instance || key}`;
                if (!alsoKnownAs.includes(handle)) alsoKnownAs.push(handle);
                continue;
            }

            const serviceEndpoint = (data.type === 'Hypothesis' && data.username)
                ? `${data.instance}/users/${data.username}`
                : (data.instance || key);
            services.push({
                id: `${existingProfile.id}#${key.replace(/[^a-zA-Z0-9]/g, '-')}`,
                type: typeMap[data.type] || 'Service',
                serviceEndpoint,
            });
        }

        // Add pages catalog service entries if the user has published a catalog
        const catalogKv = kvs.find(kv => kv.key === 'clist:pages-catalog');
        if (catalogKv) {
            try {
                const meta = JSON.parse(await decryptWithKey(encKey, catalogKv.value));
                if (meta.opmlUrl) services.push({
                    id: `${existingProfile.id}#pages-opml`,
                    type: 'CListPages',
                    serviceEndpoint: meta.opmlUrl,
                });
                if (meta.apUrl) services.push({
                    id: `${existingProfile.id}#pages-outbox`,
                    type: 'OrderedCollection',
                    serviceEndpoint: meta.apUrl,
                });
            } catch {}
        }

        const publicKeyJwk = existingProfile.verificationMethod?.[0]?.publicKeyJwk;
        const didKey = existingProfile.alsoKnownAs?.find(a => a.startsWith('did:key:'));
        if (!publicKeyJwk || !didKey) {
            statusEl.textContent = 'DID key not found — please regenerate your identity key.';
            return;
        }

        try {
            const res = await fetch(`${window.CList.config.flaskSiteUrl}/auth/did`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                body: JSON.stringify({ publicKeyJwk, didKey, service: services, alsoKnownAs })
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result.error || res.status);
            statusEl.textContent = 'DID updated successfully.';
        } catch (err) {
            console.error('updateDid PUT failed:', err);
            statusEl.textContent = `DID update failed: ${err.message}. Try logging out and back in.`;
        }
    }

    async function generateAndRegisterDid() {
        const statusEl = div.querySelector('#did-status');
        try {
            const token  = getSiteSpecificCookie(window.CList.config.flaskSiteUrl, window.CList.keys.ACCESS_TOKEN);
            const encKey = await getEncKey(window.CList.config.flaskSiteUrl);
            if (!token || !encKey) {
                statusEl.textContent = 'Not logged in — please log in to your account server before generating a DID.';
                return;
            }

            statusEl.textContent = 'Generating key pair…';
            const { keyPair, publicKeyJwk, didKey } = await generateIdentityKeyPair();

            statusEl.textContent = 'Storing private key…';
            const encryptedPrivKey = await encryptIdentityPrivateKey(keyPair.privateKey, encKey);
            try {
                await window.CList.storage.kv.put('_did_identity_key', encryptedPrivKey);
            } catch (err) {
                throw new Error(`Could not store private key (${err.message}). Your session may have expired — try logging out and back in.`);
            }

            // Preserve existing services and alsoKnownAs (minus old did:key) across key rotation
            let existingServices = [];
            let existingAlsoKnownAs = [];
            try {
                const existingRes = await fetch(`${window.CList.config.flaskSiteUrl}/users/${window.CList.state.username}/did.json`);
                if (existingRes.ok) {
                    const existingDoc = await existingRes.json();
                    existingServices = (existingDoc.service || []).filter(s => s.type !== 'KVStore');
                    existingAlsoKnownAs = (existingDoc.alsoKnownAs || []).filter(a => !a.startsWith('did:key:'));
                }
            } catch { /* first-time generation — no existing doc */ }

            statusEl.textContent = 'Registering DID…';
            const res = await fetch(`${window.CList.config.flaskSiteUrl}/auth/did`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                body: JSON.stringify({ publicKeyJwk, didKey, service: existingServices, alsoKnownAs: existingAlsoKnownAs })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(`DID registration failed (${data.error || res.status}). Check that you are logged in to the correct account server.`);

            statusEl.innerHTML = `<strong>DID registered.</strong><br>did:key: <code>${data.didKey}</code>`;
            setDidState(true);
            loadAccounts();
            if (typeof refreshCollabRegistrations === 'function') {
                refreshCollabRegistrations().catch(() => {});
            }
        } catch (err) {
            console.error('generateAndRegisterDid failed:', err);
            statusEl.textContent = err.message || 'An unexpected error occurred. See browser console for details.';
        }
    }

    async function removeDid() {
        const statusEl = div.querySelector('#did-status');
        const token = getSiteSpecificCookie(window.CList.config.flaskSiteUrl, window.CList.keys.ACCESS_TOKEN);
        if (!token) {
            statusEl.textContent = 'Not logged in — please log in first.';
            return;
        }
        try {
            try {
                await window.CList.storage.kv.remove('_did_identity_key');
            } catch (e) {
                // Preserve prior fire-and-forget behavior: a missing/failed kv delete
                // here must not block removing the DID document below.
                console.warn('Could not remove DID private key from kvstore:', e);
            }
            const res = await fetch(`${window.CList.config.flaskSiteUrl}/auth/did`, {
                method: 'DELETE',
                headers: { 'Authorization': 'Bearer ' + token }
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || `Server returned ${res.status}`);
            }
            statusEl.textContent = 'No DID registered yet.';
            setDidState(false);
        } catch (err) {
            console.error('removeDid failed:', err);
            statusEl.textContent = `Could not remove DID: ${err.message}. Try logging out and back in.`;
        }
    }

    function setDidState(active) {
        ['public-accounts-section', 'did-regen-help', 'did-remove-help', 'migrate-section'].forEach(id =>
            div.querySelector('#' + id).style.display = active ? '' : 'none'
        );
        div.querySelector('#did-btn').textContent = active ? 'Regenerate Key' : 'Generate Identity Key';
        if (!active) div.querySelector('#did-remove-help').removeAttribute('open');
    }

    async function checkExistingDid() {
        const token = getSiteSpecificCookie(window.CList.config.flaskSiteUrl, window.CList.keys.ACCESS_TOKEN);
        window.CList.state.username = getSiteSpecificCookie(window.CList.config.flaskSiteUrl, window.CList.keys.USERNAME);
        if (!token || !window.CList.state.username) {
            div.querySelector('#did-status').textContent = 'Not logged in.';
            return;
        }
        const res = await fetch(`${window.CList.config.flaskSiteUrl}/users/${window.CList.state.username}/did.json`);
        if (res.ok) {
            const doc = await res.json();
            const didUrl = `${window.CList.config.flaskSiteUrl}/users/${window.CList.state.username}/did.json`;
            div.querySelector('#did-status').innerHTML =
                `DID: <code>${doc.id}</code><br>also known as: <code>${doc.alsoKnownAs[0]}</code><br><a href="${didUrl}" target="_blank">View DID document</a>`;
            setDidState(true);
        } else {
            div.querySelector('#did-status').textContent = 'No DID registered yet.';
            setDidState(false);
        }
    }

    div.querySelector('#did-update-btn').onclick = () => updateDid();
    div.querySelector('#did-btn').onclick = () => generateAndRegisterDid();
    div.querySelector('#did-remove-btn').onclick = () => removeDid();

    checkExistingDid();
    loadAccounts();


    // ── Account migration ─────────────────────────────────────────────────────

    let _migrateCtx = null;

    async function exportAllKVRaw(serverUrl, token) {
        const res = await fetch(`${serverUrl}/get_kvs/`, {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        if (!res.ok) throw new Error(`Could not read accounts from source server (${res.status})`);
        return await res.json();
    }

    async function putKV(serverUrl, token, key, value) {
        const res = await fetch(`${serverUrl}/add_kv/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
            body: JSON.stringify({ key, value })
        });
        if (res.status === 409) {
            const upRes = await fetch(`${serverUrl}/update_kv/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                body: JSON.stringify({ key, value })
            });
            if (!upRes.ok) throw new Error(`Update failed (${upRes.status})`);
        } else if (!res.ok) {
            throw new Error(`Upload failed (${res.status})`);
        }
    }

    async function migratePrepare() {
        const progressEl = div.querySelector('#migrate-progress');
        progressEl.style.display = 'block';
        progressEl.textContent = 'Checking credentials…';

        const oldToken    = getSiteSpecificCookie(window.CList.config.flaskSiteUrl, window.CList.keys.ACCESS_TOKEN);
        const oldUsername = getSiteSpecificCookie(window.CList.config.flaskSiteUrl, window.CList.keys.USERNAME);
        const oldEncKey   = await getEncKey(window.CList.config.flaskSiteUrl);

        if (!oldToken || !oldUsername || !oldEncKey) {
            progressEl.textContent = 'Not logged in to source server. Please log in first.';
            return;
        }

        const newUrl      = div.querySelector('#migrate-new-url').value.trim().replace(/\/$/, '');
        const newUsername = div.querySelector('#migrate-new-username').value.trim().toLowerCase();
        const newPassword = div.querySelector('#migrate-new-password').value;
        const doRegister  = div.querySelector('#migrate-register').checked;

        if (!newUrl || !newUsername || !newPassword) {
            progressEl.textContent = 'Please fill in all destination fields.';
            return;
        }

        try {
            progressEl.textContent = 'Exporting accounts from source server…';
            const kvs = await exportAllKVRaw(window.CList.config.flaskSiteUrl, oldToken);

            let accountCount = 0;
            for (const kv of kvs.filter(k => !k.key.startsWith('_'))) {
                try { await decryptWithKey(oldEncKey, kv.value); accountCount++; } catch {}
            }

            let hasDid = false;
            try {
                const didRes = await fetch(`${window.CList.config.flaskSiteUrl}/users/${oldUsername}/did.json`);
                hasDid = didRes.ok;
            } catch {}

            progressEl.textContent = doRegister
                ? 'Registering on destination server…'
                : 'Logging in to destination server…';

            const [newEncKey, newAuthHash] = await Promise.all([
                deriveEncKey(newPassword, newUsername),
                deriveAuthHash(newPassword, newUsername)
            ]);

            if (doRegister) {
                const regRes = await fetch(`${newUrl}/auth/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: newUsername, auth_hash: newAuthHash })
                });
                if (!regRes.ok) {
                    const err = await regRes.json().catch(() => ({}));
                    throw new Error(err.error || `Registration failed (${regRes.status})`);
                }
            }

            const loginRes = await fetch(`${newUrl}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: newUsername, auth_hash: newAuthHash })
            });
            if (!loginRes.ok) {
                const err = await loginRes.json().catch(() => ({}));
                throw new Error(err.error || `Login failed (${loginRes.status}). Is the destination server URL correct?`);
            }
            const loginData = await loginRes.json();

            _migrateCtx = {
                oldUrl: window.CList.config.flaskSiteUrl, oldToken, oldEncKey, oldUsername,
                newUrl, newToken: loginData.token, newEncKey, newUsername,
                hasDid, kvs, accountCount
            };

            const srcHost = new URL(window.CList.config.flaskSiteUrl).hostname;
            const dstHost = new URL(newUrl).hostname;
            div.querySelector('#migrate-preview').innerHTML = `
                <p><strong>Ready to migrate:</strong></p>
                <ul style="margin:0.4em 0 0.6em 1.2em; padding:0;">
                    <li>${accountCount} account${accountCount !== 1 ? 's' : ''} from <strong>${srcHost}</strong> (${kvs.filter(k => !k.key.startsWith('_')).length} total entries)</li>
                    <li>${kvs.filter(k => k.key.startsWith('_')).length} system key${kvs.filter(k => k.key.startsWith('_')).length !== 1 ? 's' : ''}${hasDid ? ' (including your DID private key)' : ''}</li>
                    ${hasDid ? '<li>DID identity will be linked between old and new servers</li>' : ''}
                </ul>
                <p><strong>Destination:</strong> ${dstHost} as <strong>${newUsername}</strong></p>
                <p style="font-size:0.85em; color:#856404; background:#fff3cd; padding:0.5em 0.7em; border-radius:4px; margin:0.6em 0 0;">
                    Your source account will not be deleted. To switch servers after migration, log out and use the "Change" link on the login screen.
                </p>`;

            div.querySelector('#migrate-step-1').style.display = 'none';
            div.querySelector('#migrate-step-2').style.display = 'block';
            progressEl.style.display = 'none';

        } catch (err) {
            console.error('migratePrepare failed:', err);
            progressEl.textContent = `Error: ${err.message}`;
        }
    }

    async function migrateRun() {
        if (!_migrateCtx) return;
        const { oldUrl, oldToken, oldEncKey, oldUsername, newUrl, newToken, newEncKey, newUsername, hasDid, kvs } = _migrateCtx;

        const progressEl = div.querySelector('#migrate-progress');
        progressEl.style.display = 'block';
        div.querySelector('#migrate-step-2').style.display = 'none';

        let done = 0, errors = 0;

        try {
            for (const kv of kvs) {
                try {
                    const plaintext = await decryptWithKey(oldEncKey, kv.value);
                    const newValue  = await encryptWithKey(newEncKey, plaintext);
                    await putKV(newUrl, newToken, kv.key, newValue);
                    done++;
                } catch (err) {
                    console.error(`Failed to migrate "${kv.key}":`, err);
                    errors++;
                }
                progressEl.textContent = `Migrating: ${done + errors} / ${kvs.length} entries…`;
            }

            if (hasDid) {
                progressEl.textContent = 'Linking DID between servers…';
                try {
                    const oldDidRes = await fetch(`${oldUrl}/users/${oldUsername}/did.json`);
                    if (oldDidRes.ok) {
                        const oldDoc = await oldDidRes.json();
                        const publicKeyJwk = oldDoc.verificationMethod?.[0]?.publicKeyJwk;
                        const didKey = (oldDoc.alsoKnownAs || []).find(a => a.startsWith('did:key:'));
                        const services = (oldDoc.service || []).filter(s => s.type !== 'KVStore');

                        if (publicKeyJwk && didKey) {
                            const oldDidWeb = `did:web:${new URL(oldUrl).hostname}:users:${oldUsername}`;
                            const newDidWeb = `did:web:${new URL(newUrl).hostname}:users:${newUsername}`;

                            // alsoKnownAs for new server: include old server's did:web
                            const newAlsoKnownAs = (oldDoc.alsoKnownAs || [])
                                .filter(a => !a.startsWith('did:key:'));
                            if (!newAlsoKnownAs.includes(oldDidWeb)) newAlsoKnownAs.push(oldDidWeb);

                            await fetch(`${newUrl}/auth/did`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + newToken },
                                body: JSON.stringify({ publicKeyJwk, didKey, service: services, alsoKnownAs: newAlsoKnownAs })
                            });

                            // alsoKnownAs for old server: include new server's did:web
                            const oldAlsoKnownAs = [...newAlsoKnownAs];
                            if (!oldAlsoKnownAs.includes(newDidWeb)) oldAlsoKnownAs.push(newDidWeb);

                            await fetch(`${oldUrl}/auth/did`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + oldToken },
                                body: JSON.stringify({ publicKeyJwk, didKey, service: services, alsoKnownAs: oldAlsoKnownAs })
                            });
                        }
                    }
                } catch (err) {
                    console.warn('DID linking failed:', err);
                    errors++;
                }
            }

            const srcHost = new URL(oldUrl).hostname;
            const dstHost = new URL(newUrl).hostname;
            progressEl.innerHTML = `
                <p style="color:green; font-weight:bold;">Migration complete!</p>
                <p>${done} of ${kvs.length} entries migrated successfully.${errors > 0 ? ` <span style="color:#c44;">(${errors} error${errors !== 1 ? 's' : ''} — see browser console)</span>` : ''}</p>
                ${hasDid ? `<p>DID identity linked between <strong>${srcHost}</strong> and <strong>${dstHost}</strong>.</p>` : ''}
                <p style="font-size:0.85em; margin-top:0.8em;"><strong>Next steps:</strong> Log out, then use the "Change" link on the login screen to switch to <strong>${dstHost}</strong>.</p>`;

        } catch (err) {
            console.error('migrateRun failed:', err);
            progressEl.textContent = `Migration failed: ${err.message}`;
        }

        _migrateCtx = null;
    }

    function migrateReset() {
        _migrateCtx = null;
        div.querySelector('#migrate-step-1').style.display = 'block';
        div.querySelector('#migrate-step-2').style.display = 'none';
        div.querySelector('#migrate-progress').style.display = 'none';
    }

    div.querySelector('#migrate-prepare-btn').onclick = () => migratePrepare();
    div.querySelector('#migrate-run-btn').onclick = () => migrateRun();
    div.querySelector('#migrate-cancel-btn').onclick = () => migrateReset();

    return div;
}

function playOptions() {
    history.pushState({ panel: 'me' }, '');
    openLeftInterface(kvstoreOptionsPanel());
}

// Returns the Options panel element
// Inlined directly (not an iframe) — see kvstoreMePanel() comment for why.
function kvstoreOptionsPanel() {
    const div = document.createElement('div');
    div.className = 'kvcontainer';
    div.innerHTML = `
        <button class="back-btn" id="options-back-btn">&#8592; Back</button>
        <div class="me-section me-section--flat">
            <h3>Options</h3>
            <div class="nav-item">
                <button class="nav-btn" id="options-dark-mode-toggle">Dark Mode: Off</button>
                <p class="nav-desc">Switch between light and dark colour schemes.</p>
            </div>
            <div class="nav-item">
                <button class="nav-btn" id="options-webmention-toggle">WebMention: Off</button>
                <p class="nav-desc">When on, notifies source URLs via <a href="https://www.w3.org/TR/webmention/" target="_blank">WebMention</a> after each publish.</p>
            </div>
            <p style="margin-top:1em; font-size:0.85em;"><a href="about.html" target="_blank">About CList</a></p>
        </div>
    `;

    const backBtn = div.querySelector('#options-back-btn');
    const darkBtn = div.querySelector('#options-dark-mode-toggle');
    const webBtn  = div.querySelector('#options-webmention-toggle');

    backBtn.onclick = () => history.back();

    function updateToggle() {
        const isDark = document.documentElement.classList.contains('dark-mode');
        darkBtn.textContent = isDark ? 'Dark Mode: On' : 'Dark Mode: Off';
    }
    function toggleDarkMode() {
        const isNowDark = document.documentElement.classList.toggle('dark-mode');
        localStorage.setItem('clist-dark-mode', isNowDark ? '1' : '0');
        // Sync TinyMCE content iframes (chrome is handled by CSS; content area needs injection)
        try {
            if (window.tinymce) {
                window.tinymce.editors.forEach(ed => {
                    try {
                        const doc = ed.getDoc();
                        if (!doc) return;
                        let s = doc.getElementById('clist-dm');
                        if (isNowDark) {
                            if (!s) { s = doc.createElement('style'); s.id = 'clist-dm'; doc.head.appendChild(s); }
                            s.textContent = 'body{background:#1e1e1e!important;color:#e0e0e0!important}';
                        } else if (s) {
                            s.remove();
                        }
                    } catch(e) {}
                });
            }
        } catch(e) {}
        updateToggle();
    }
    function updateWebMentionToggle() {
        const on = localStorage.getItem('clist_webmention_enabled') === 'true';
        webBtn.textContent = on ? 'WebMention: On' : 'WebMention: Off';
    }
    function toggleWebMention() {
        const on = localStorage.getItem('clist_webmention_enabled') === 'true';
        const nowOn = !on;
        if (typeof setWebmentionEnabled === 'function') setWebmentionEnabled(nowOn);
        else localStorage.setItem('clist_webmention_enabled', nowOn ? 'true' : 'false');
        updateWebMentionToggle();
    }

    darkBtn.onclick = toggleDarkMode;
    webBtn.onclick  = toggleWebMention;
    updateToggle();
    updateWebMentionToggle();

    return div;
}

function playAppSettings() {
    if (window.innerWidth <= 768) {
        history.pushState({ panel: 'me' }, '');
        openLeftInterface(kvstoreAppSettingsPanel());
    } else {
        openAppSettingsModal();
    }
}

// Desktop-only modal: 80vw x 80vh, centered, 200px app-picker column on the
// left, settings pane on the right. Mobile keeps the single-pane left-panel
// flow (kvstoreAppSettingsPanel) instead of this modal.
function openAppSettingsModal() {
    closeAppSettingsModal();

    const overlay = document.createElement('div');
    overlay.id = 'appSettingsModal';
    overlay.style.cssText = 'display:flex; position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:9999; align-items:center; justify-content:center;';

    const box = document.createElement('div');
    box.style.cssText = 'background:#fff; border-radius:8px; width:80vw; height:80vh; position:relative; display:flex; overflow:hidden;';

    const closeBtn = document.createElement('span');
    closeBtn.textContent = '✕';
    closeBtn.title = 'Close';
    closeBtn.style.cssText = 'position:absolute; top:10px; right:14px; cursor:pointer; font-size:1.3em; line-height:1; color:#555; z-index:1;';
    closeBtn.onclick = closeAppSettingsModal;

    const nav = document.createElement('div');
    nav.style.cssText = 'width:300px; flex-shrink:0; border-right:1px solid #ddd; overflow-y:auto; padding:16px 0; box-sizing:border-box;';
    nav.innerHTML = `<h3 style="margin:0 16px 12px;">App Settings</h3>` +
        ADMIN_SETTINGS_APPS.map(a => `
            <button class="account-button" data-app-base="${escapeHtml(a.baseUrl)}" style="display:block;width:100%;text-align:left;margin-bottom:2px;padding-left:16px;box-sizing:border-box;">
                <span>${escapeHtml(a.label)}</span>
            </button>`).join('');

    const detail = document.createElement('div');
    detail.id = 'app-settings-modal-detail';
    detail.style.cssText = 'flex:1; overflow-y:auto; padding:16px 36px 16px 16px; box-sizing:border-box;';
    detail.innerHTML = '<p class="feed-status-message">Pick an app to view or change its admin-editable settings.</p>';

    nav.querySelectorAll('[data-app-base]').forEach(btn => {
        btn.onclick = () => {
            nav.querySelectorAll('[data-app-base]').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            renderGenericAdminSettingsPanel(detail, btn.getAttribute('data-app-base'));
        };
    });

    box.appendChild(closeBtn);
    box.appendChild(nav);
    box.appendChild(detail);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
}

function closeAppSettingsModal() {
    const existing = document.getElementById('appSettingsModal');
    if (existing) existing.remove();
}

// Small overlay listing what each settings field does, sourced from the
// backend schema's "help" text (see admin_settings.py's SettingField.help).
// Layered above #appSettingsModal (and works standalone over the mobile
// left-pane flow too, since it's just appended to <body>).
function openAdminSettingsHelpModal(appLabel, schema) {
    closeAdminSettingsHelpModal();

    const overlay = document.createElement('div');
    overlay.id = 'adminSettingsHelpModal';
    overlay.style.cssText = 'display:flex; position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:10000; align-items:center; justify-content:center;';

    const box = document.createElement('div');
    box.style.cssText = 'background:#fff; border-radius:8px; max-width:480px; width:90%; max-height:80vh; overflow-y:auto; padding:1.5em; position:relative; box-sizing:border-box;';

    const closeBtn = document.createElement('span');
    closeBtn.textContent = '✕';
    closeBtn.title = 'Close';
    closeBtn.style.cssText = 'position:absolute; top:10px; right:14px; cursor:pointer; font-size:1.3em; line-height:1; color:#555;';
    closeBtn.onclick = closeAdminSettingsHelpModal;

    const body = document.createElement('div');
    body.innerHTML = `<h3 style="margin-top:0;">${escapeHtml(appLabel)} — Field Help</h3>` +
        schema.map(f => `
            <p style="margin-bottom:1em;">
                <strong>${escapeHtml(f.label)}</strong><br>
                <span style="font-size:0.9em;color:#555;">${escapeHtml(f.help || 'No additional detail available.')}</span>
            </p>`).join('');

    box.appendChild(closeBtn);
    box.appendChild(body);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
}

function closeAdminSettingsHelpModal() {
    const existing = document.getElementById('adminSettingsHelpModal');
    if (existing) existing.remove();
}

// Apps that have adopted the generic admin-settings backend pattern (see
// /srv/shared/admin_settings.py — a copy-paste module, not a shared import —
// and its GET/PUT /admin/settings routes). Add an app here once it's wired up.
const ADMIN_SETTINGS_APPS = [
    {
        label: 'Pastebin', baseUrl: 'https://pastebin.mooc.ca',
        description: 'Stores arbitrary text content (JSON, OPML, HTML) at a short public URL — used by CList to publish collections and other structured content.',
    },
    {
        label: 'Survey', baseUrl: 'https://survey.mooc.ca',
        description: 'Lets any kvstore user build simple surveys; anyone with the link can respond anonymously, no account needed.',
    },
    {
        label: 'LocalRSS Reader', baseUrl: 'https://localrss.downes.ca',
        description: 'Server-side RSS/podcast reader with a scheduler that fetches feeds in the background.',
        // Unlike pastebin/survey, this app's auth gate also requires an
        // X-Kvstore-Url header naming the issuing kvstore instance (same
        // pattern rss.js already uses for /fetch_feed) — see rss.js:309.
        requiresKvstoreUrlHeader: true,
    },
    {
        label: 'Annotations', baseUrl: 'https://annotations.mooc.ca',
        description: 'W3C-style annotation server for CList — lets users attach public/private notes to any URL.',
    },
    {
        label: 'OPML2JSON', baseUrl: 'https://opml2json.downes.ca',
        description: 'Converts OPML to JSON and aggregates RSS/Atom feeds for CList feed reading.',
        // Same as localrss_reader — its admin-settings auth gate also checks
        // X-Kvstore-Url (same pattern used by /fetch_feed).
        requiresKvstoreUrlHeader: true,
    },
    {
        label: 'Collab', baseUrl: 'https://collab.mooc.ca',
        description: 'Hocuspocus/Yjs real-time collaborative document editing server for CList.',
    },
    {
        label: 'Discussions', baseUrl: 'https://discussions.mooc.ca',
        description: 'Peer discovery / signaling service for CList P2P chat — stores ephemeral PeerJS peer IDs so users can find and join each other\'s discussions.',
    },
];

// Extra headers a given admin-settings app's auth gate requires beyond the
// standard Bearer token — currently only localrss_reader's X-Kvstore-Url.
function _adminSettingsExtraHeaders(baseUrl) {
    const app = ADMIN_SETTINGS_APPS.find(a => a.baseUrl === baseUrl);
    if (app && app.requiresKvstoreUrlHeader) {
        return { 'X-Kvstore-Url': window.CList.config.flaskSiteUrl };
    }
    return {};
}

// Returns the App Settings panel element — an app picker; selecting an app
// renders renderGenericAdminSettingsPanel() inline beneath the picker.
function kvstoreAppSettingsPanel() {
    const div = document.createElement('div');
    div.className = 'kvcontainer';
    const appButtons = ADMIN_SETTINGS_APPS.map(a => `
        <button class="account-button" data-app-base="${escapeHtml(a.baseUrl)}" style="display:block;width:100%;text-align:left;margin-bottom:2px;">
            <span>${escapeHtml(a.label)}</span>
        </button>`).join('');
    div.innerHTML = `
        <button class="back-btn" id="app-settings-back-btn">&#8592; Back</button>
        <div class="me-section me-section--flat">
            <h3>App Settings</h3>
            <p class="nav-desc">Pick an app to view or change its admin-editable settings.</p>
            ${appButtons}
            <div id="app-settings-detail" style="margin-top:12px;"></div>
        </div>
    `;
    div.querySelector('#app-settings-back-btn').onclick = () => history.back();
    div.querySelectorAll('[data-app-base]').forEach(btn => {
        btn.onclick = () => renderGenericAdminSettingsPanel(
            div.querySelector('#app-settings-detail'),
            btn.getAttribute('data-app-base')
        );
    });
    return div;
}

// Generic admin-settings editor, reusable by any app that has adopted the
// admin_settings.py backend pattern. Fetches GET {baseUrl}/admin/settings,
// renders one row per schema field, and PUTs only the fields that changed.
async function renderGenericAdminSettingsPanel(panel, baseUrl) {
    panel.innerHTML = '<p class="feed-status-message">Loading settings…</p>';
    const token = getSiteSpecificCookie(window.CList.config.flaskSiteUrl, window.CList.keys.ACCESS_TOKEN);
    try {
        const resp = await fetch(`${baseUrl}/admin/settings`, {
            headers: { 'Authorization': 'Bearer ' + token, ..._adminSettingsExtraHeaders(baseUrl) }
        });
        if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            throw new Error(err.error || `HTTP ${resp.status}`);
        }
        const { schema, values } = await resp.json();
        _renderAdminSettingsForm(panel, baseUrl, schema, values);
    } catch (e) {
        console.error('Admin settings load failed:', e);
        panel.innerHTML = `<p class="feed-status-message">Could not load settings: ${escapeHtml(e.message)}</p>`;
    }
}

function _setAdminSettingsStatus(panel, text, color) {
    const statusEl = panel.querySelector('#admin-settings-status');
    statusEl.textContent = text || '';
    statusEl.style.color = color || '#555';
    // Only show the bordered box styling when there's actually a message.
    statusEl.classList.toggle('feed-status-message', !!text);
}

function _booleanStatusLabel(label, isOn) {
    // Fields are typically labelled e.g. "Enabled" / "Real-time editing
    // enabled" — flip a trailing "enabled" to "disabled" (matching case)
    // when off, so the label itself reflects current state at a glance.
    if (isOn || !/enabled$/i.test(label)) return label;
    return label.replace(/enabled$/i, m => (m[0] === 'E' ? 'Disabled' : 'disabled'));
}

function _renderAdminSettingsForm(panel, baseUrl, schema, values, savedMessage) {
    const rows = schema.map(f => {
        if (f.type === 'boolean') {
            const checked = (values[f.key] ?? 'true') === 'true';
            return `
                <div class="nav-item" data-setting-key="${escapeHtml(f.key)}">
                    <label style="display:flex;align-items:center;gap:10px;">
                        <span class="admin-setting-switch">
                            <input type="checkbox" class="admin-setting-toggle" data-setting-key="${escapeHtml(f.key)}" data-label="${escapeHtml(f.label)}" ${checked ? 'checked' : ''}>
                            <span class="admin-setting-switch-track"></span>
                        </span>
                        <span class="admin-setting-switch-label" style="font-variant:small-caps;font-size:0.8rem;color:#555;">${escapeHtml(_booleanStatusLabel(f.label, checked))}</span>
                    </label>
                </div>`;
        }
        if (f.sensitive) {
            // Masked read-only text + a "Change" button that swaps in a blank
            // password input, so the admin never retypes a value they're not changing.
            const masked = values[f.key] ? escapeHtml(values[f.key]) : '(not set)';
            return `
                <div class="nav-item" data-setting-key="${escapeHtml(f.key)}">
                    <label style="font-variant:small-caps;font-size:0.8rem;color:#555;display:block;">${escapeHtml(f.label)}</label>
                    <span class="admin-setting-masked" style="font-family:monospace;">${masked}</span>
                    <button class="kv-action-btn" data-change-key="${escapeHtml(f.key)}" style="margin-left:8px;">Change</button>
                </div>`;
        }
        const current = values[f.key] || '';
        return `
            <div class="nav-item" data-setting-key="${escapeHtml(f.key)}">
                <label style="font-variant:small-caps;font-size:0.8rem;color:#555;display:block;">${escapeHtml(f.label)}</label>
                <input type="text" class="admin-setting-input" data-setting-key="${escapeHtml(f.key)}" value="${escapeHtml(current)}" style="width:100%;box-sizing:border-box;padding:0.2rem;font-size:0.85rem;">
            </div>`;
    }).join('');

    const appMeta = ADMIN_SETTINGS_APPS.find(a => a.baseUrl === baseUrl) || { label: baseUrl, description: '' };

    panel.innerHTML = `
        <h3 style="margin-top:0;">${escapeHtml(appMeta.label)}</h3>
        <p class="nav-desc" style="margin-bottom:1.2em;">${escapeHtml(appMeta.description)}</p>
        ${rows}
        <p id="admin-settings-status" style="min-height:1.2em;"></p>
        <div style="display:flex;gap:8px;">
            <button class="btn btn-small" id="admin-settings-save-btn">Save</button>
            <button class="btn btn-small btn-secondary" id="admin-settings-help-btn">Help</button>
        </div>
    `;

    panel.querySelector('#admin-settings-help-btn').onclick = () => {
        openAdminSettingsHelpModal(appMeta.label, schema);
    };

    if (savedMessage) {
        _setAdminSettingsStatus(panel, savedMessage, '#2a7a2a');
    }

    panel.querySelectorAll('[data-change-key]').forEach(btn => {
        btn.onclick = () => {
            const key = btn.getAttribute('data-change-key');
            const row = panel.querySelector(`[data-setting-key="${key}"]`);
            row.querySelector('.admin-setting-masked').style.display = 'none';
            btn.style.display = 'none';
            const input = document.createElement('input');
            input.type = 'password';
            input.className = 'admin-setting-input';
            input.setAttribute('data-setting-key', key);
            input.placeholder = 'Enter new value';
            input.style.cssText = 'width:100%;box-sizing:border-box;padding:0.2rem;font-size:0.85rem;';
            row.appendChild(input);
        };
    });

    // Boolean fields take effect immediately on click, bypassing the Save
    // button entirely — each toggle PUTs just its own key right away.
    panel.querySelectorAll('.admin-setting-toggle').forEach(input => {
        const baseLabel = input.getAttribute('data-label');
        const labelEl = input.closest('label').querySelector('.admin-setting-switch-label');
        input.onchange = async () => {
            const key = input.getAttribute('data-setting-key');
            const newValue = input.checked ? 'true' : 'false';
            labelEl.textContent = _booleanStatusLabel(baseLabel, input.checked);
            input.disabled = true;
            _setAdminSettingsStatus(panel, 'Saving…', '#555');
            const saveToken = getSiteSpecificCookie(window.CList.config.flaskSiteUrl, window.CList.keys.ACCESS_TOKEN);
            try {
                const resp = await fetch(`${baseUrl}/admin/settings`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + saveToken, ..._adminSettingsExtraHeaders(baseUrl) },
                    body: JSON.stringify({ [key]: newValue })
                });
                if (!resp.ok) {
                    const err = await resp.json().catch(() => ({}));
                    throw new Error(err.error || `HTTP ${resp.status}`);
                }
                const result = await resp.json();
                values[key] = result.values[key];
                _setAdminSettingsStatus(panel, '✓ Saved.', '#2a7a2a');
            } catch (e) {
                console.error('Admin setting toggle failed:', e);
                input.checked = !input.checked;
                labelEl.textContent = _booleanStatusLabel(baseLabel, input.checked);
                _setAdminSettingsStatus(panel, 'Could not save: ' + e.message, '#c00');
            } finally {
                input.disabled = false;
            }
        };
    });

    panel.querySelector('#admin-settings-save-btn').onclick = async () => {
        const changes = {};
        panel.querySelectorAll('.admin-setting-input').forEach(input => {
            const key = input.getAttribute('data-setting-key');
            const field = schema.find(f => f.key === key);
            if (field.sensitive) {
                // Only present when "Change" was clicked; blank means leave it alone.
                if (input.value) changes[key] = input.value;
            } else if (input.value !== (values[key] || '')) {
                changes[key] = input.value;
            }
        });
        if (!Object.keys(changes).length) {
            _setAdminSettingsStatus(panel, 'No changes to save.', '#555');
            return;
        }
        _setAdminSettingsStatus(panel, 'Saving…', '#555');
        const saveToken = getSiteSpecificCookie(window.CList.config.flaskSiteUrl, window.CList.keys.ACCESS_TOKEN);
        try {
            const resp = await fetch(`${baseUrl}/admin/settings`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + saveToken, ..._adminSettingsExtraHeaders(baseUrl) },
                body: JSON.stringify(changes)
            });
            if (!resp.ok) {
                const err = await resp.json().catch(() => ({}));
                throw new Error(err.error || `HTTP ${resp.status}`);
            }
            const result = await resp.json();
            _renderAdminSettingsForm(panel, baseUrl, schema, result.values, '✓ Saved.');
        } catch (e) {
            console.error('Admin settings save failed:', e);
            _setAdminSettingsStatus(panel, 'Could not save: ' + e.message, '#c00');
        }
    };
}

// Browser back button returns to the Me nav page when inside a sub-panel.
// Opens the panel directly (not via playMe()) so landing here doesn't push another
// history entry on top of the one we just navigated back to.
//
// The 'typePicker' branch serves the Accounts panel's own internal history scheme
// (showTypePicker()/selectAccountType() push {view:'typePicker'}/{view:'form'}). It routes
// back into the currently-mounted panel instance via _accountsPanelCtx rather than adding a
// second listener inside kvstoreAccountsPanel() itself, which would leak a new listener on
// every visit since openLeftInterface() never tears down previously-attached window listeners.
// The isConnected check guards against acting on a stale instance left over from navigating
// away to a different panel (reproducing the safety the old iframe got for free from document
// destruction).
window.addEventListener('popstate', (e) => {
    if (e.state && e.state.panel === 'me') {
        openLeftInterface(kvstoreMePanel());
    } else if (e.state && e.state.view === 'typePicker') {
        if (_accountsPanelCtx && _accountsPanelCtx.div.isConnected) {
            _accountsPanelCtx.showTypePicker(false);
        }
    }
});

        // Function to toggle the account selection section
        function toggleAccountSection(open) {
            const accountSection = document.getElementById('accountSection');
            const isHidden = accountSection.style.display === 'none' || open;

            if (isHidden) { 
                accountSection.style.display = 'block';  // Show the section
            } else {
                accountSection.style.display = 'none';  // Hide the section
            }
        };



        // Event handler for dropdown change
        function handleAccountChange() {
            const accountDropdown = document.getElementById('accountDropdown');
            const selectedKey = accountDropdown.value;
            
            if (selectedKey === "") {
                // Clear inputs if no account is selected
                accessToken = '';
                baseURL = '';
                instanceType = '';
                return;
            }

            // Find the selected account
            const selectedAccount = window.CList.accounts.find(account => account.key === selectedKey);
            if (selectedAccount) {
           
                // Parse the JSON string in the value field
                const accountData = JSON.parse(selectedAccount.value);
                let accountName = accountData.instance;
                baseURL = extractBaseUrl(accountName);
                accessToken = accountData.id;
                instanceType = accountData.type;

                // Store the Account Data
                setCookie('accountBaseUrl',baseURL,1);
                setCookie('accountAccessToken',accountData.id,1);
                setCookie('accountInstanceType',accountData.type,1);
                
                // Get the Account Data
                getAccountData();
             

            }
        };

        function getAccountData() {
            document.getElementById('baseURL').value = getCookie('accountBaseUrl');
            document.getElementById('accessToken').value = getCookie('accountAccessToken');
            document.getElementById('instanceType').value = getCookie('accountInstanceType');  
            // Display the selected account instance URL before the Account button
            if (getCookie('accountAccessToken')) { return 1; } else { return 0; }
        }

        // Show the auth modal in login or register mode.
        function redirectToKVLogin()    { openAuthModal('login'); }
        function redirectToKVRegister() { openAuthModal('register'); }

        // "Local" has no real hostname — new URL(url).hostname would show "local.clist", which is
        // accurate but not clear to a user who never typed that in.
        function serverDisplayName(url) {
            return (window.CList.LOCAL_KVSTORE_URL && url === window.CList.LOCAL_KVSTORE_URL)
                ? 'Local (this device only)'
                : new URL(url).hostname;
        }

        function openAuthModal(mode) {
            if (typeof endTour === 'function') endTour();
            document.getElementById('authModalTitle').textContent = mode === 'login' ? 'Login' : 'Register';
            document.getElementById('authSubmitBtn').textContent  = mode === 'login' ? 'Login' : 'Register';
            document.getElementById('authSubmitBtn').disabled = false;
            document.getElementById('authConfirmWrap').style.display  = mode === 'register' ? 'block' : 'none';
            document.getElementById('authUsernameHint').style.display = mode === 'register' ? 'inline' : 'none';
            document.getElementById('authUsernameRule').style.display = mode === 'register' ? 'block'  : 'none';
            document.getElementById('authUsername').value  = '';
            document.getElementById('authPassword').value  = '';
            document.getElementById('authConfirm').value   = '';
            document.getElementById('authError').style.display = 'none';
            document.getElementById('authServerUrl').textContent = serverDisplayName(window.CList.config.flaskSiteUrl);
            document.getElementById('authMainForm').style.display = 'block';
            document.getElementById('authServerLine').style.display = 'block';
            document.getElementById('changeServerPanel').style.display = 'none';
            const modal = document.getElementById('authModal');
            modal.dataset.mode = mode;
            modal.style.display = 'flex';
            document.getElementById('authUsername').focus();
        }

        function openChangeServerPanel() {
            document.getElementById('authMainForm').style.display = 'none';
            document.getElementById('authServerLine').style.display = 'none';
            document.getElementById('changeServerPanel').style.display = 'block';
            document.getElementById('authModalTitle').textContent = 'Change Account Server';
            const sel = document.getElementById('serverSelect');
            sel.value = window.CList.config.flaskSiteUrl;
            if (!sel.value) sel.selectedIndex = 0;
        }

        function closeChangeServerPanel() {
            document.getElementById('changeServerPanel').style.display = 'none';
            document.getElementById('authMainForm').style.display = 'block';
            document.getElementById('authServerLine').style.display = 'block';
            const mode = document.getElementById('authModal').dataset.mode;
            document.getElementById('authModalTitle').textContent = mode === 'login' ? 'Login' : 'Register';
        }

        function selectAccountServer() {
            const url = document.getElementById('serverSelect').value;
            window.CList.config.flaskSiteUrl = url;
            localStorage.setItem(window.CList.keys.KVSTORE_URL, url);
            document.getElementById('authServerUrl').textContent = serverDisplayName(url);
            closeChangeServerPanel();
        }

        function closeAuthModal() {
            document.getElementById('authModal').style.display = 'none';
        }

        function toggleAuthPassword(inputId, icon) {
            const input = document.getElementById(inputId);
            input.type = input.type === 'password' ? 'text' : 'password';
            icon.textContent = input.type === 'password' ? '👁' : '🙈';
        }

        async function submitAuthModal() {
            const mode = document.getElementById('authModal').dataset.mode;
            const u = document.getElementById('authUsername').value.trim().toLowerCase();
            const p = document.getElementById('authPassword').value;
            const errDiv = document.getElementById('authError');
            errDiv.style.display = 'none';

            if (!u || !p) { errDiv.textContent = 'Username and password are required.'; errDiv.style.display = 'block'; return; }

            if (mode === 'register') {
                // Password never reaches the server in the clear (see KVregisterWithCredentials) - the
                // server stores only a derived hash and so cannot enforce strength itself. This is the
                // one place a weak password can be caught, and it matters more than usual here: the
                // password is the sole protection for the user's encrypted credential vault.
                if (p.length < 8) { errDiv.textContent = 'Password must be at least 8 characters.'; errDiv.style.display = 'block'; return; }
                const p2 = document.getElementById('authConfirm').value;
                if (p !== p2) { errDiv.textContent = 'Passwords do not match.'; errDiv.style.display = 'block'; return; }
                if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(u)) { errDiv.textContent = 'Username must be 3–32 characters, start with a letter or digit, and contain only letters, digits, dots, hyphens, and underscores.'; errDiv.style.display = 'block'; return; }
            }

            document.getElementById('authSubmitBtn').disabled = true;
            document.getElementById('authSubmitBtn').textContent = 'Please wait\u2026';
            try {
                if (mode === 'register') await KVregisterWithCredentials(u, p);
                await KVloginWithCredentials(u, p);
                closeAuthModal();
                updateIdentityDiv();
                acceptLogin();
                window.CList.accounts = await getAccounts(window.CList.config.flaskSiteUrl);
                // Collab, Annotations, RSS Relay, and CListBin are all external services that verify
                // the kvstore-issued token against a real, network-reachable kvstore — a Local account's
                // token has no such issuer, so seeding/registering these accounts would just produce
                // accounts that always fail. Skip them entirely in Local mode.
                if (!window.CList.isLocalMode || !window.CList.isLocalMode()) {
                    if (mode === 'register') autoRegisterCollab().catch(e => console.warn('Collab auto-registration failed:', e));
                    if (mode === 'register') autoRegisterAnnotations().catch(e => console.warn('Annotations auto-registration failed:', e));
                    autoSeedRSSRelay().catch(e => console.warn('RSS Relay account seed failed:', e));
                    autoSeedCListBin().catch(e => console.warn('CListBin account seed failed:', e));
                }
                if (window.CList.accounts) {
                    updateUIVisibility();
                    await playRead();
                    populateReadAccountList(window.CList.accounts);
                }
                if (mode === 'register') showOnboardingNudge();
            } catch (e) {
                errDiv.textContent = (mode === 'register' ? 'Registration' : 'Login') + ' failed: ' + e.message;
                errDiv.style.display = 'block';
                document.getElementById('authSubmitBtn').disabled = false;
                document.getElementById('authSubmitBtn').textContent = mode === 'login' ? 'Login' : 'Register';
            }
        }

        function showOnboardingNudge() {
            const container = window.CList.ui.view.feedContainer;
            if (!container) return;
            container.innerHTML = `
                <div style="padding:8% 10%">
                    <h3>You're in!</h3>
                    <p style="margin:0.6em 0;">Your account is ready. Next, connect your first service so you can read feeds and post content.</p>
                    <p style="margin:1em 0;">
                        <button onclick="playAccounts()">Open Accounts &rarr;</button>
                    </p>
                    <p style="margin:0.8em 0 0; font-size:0.85em; color:#666;">
                        You can add Mastodon, Bluesky, RSS feeds, WordPress, and more.<br>
                        Not sure where to start? Check the
                        <a href="https://github.com/Downes/CList/wiki" target="_blank">documentation</a>.
                    </p>
                </div>`;
        }

        // Function to handle logout
        function KVlogout() {

            // Remove the token cookies and session encryption key
            const _logoutUser = getSiteSpecificCookie(window.CList.config.flaskSiteUrl, window.CList.keys.USERNAME);
            deleteSiteSpecificCookie(window.CList.config.flaskSiteUrl, window.CList.keys.ACCESS_TOKEN);
            deleteSiteSpecificCookie(window.CList.config.flaskSiteUrl, window.CList.keys.USERNAME);
            deleteSiteSpecificCookie(window.CList.config.flaskSiteUrl, window.CList.keys.TOKEN_EXPIRES);
            if (_logoutUser) sessionStorage.removeItem(`${window.CList.config.flaskSiteUrl}_${_logoutUser}_encKey`);
            sessionStorage.removeItem(window.CList.config.flaskSiteUrl + '_encKey'); // clean up any legacy key


            // Clear the account list
            const element = document.getElementById('read-account-list');
            if (element) element.style.display = 'none';
            if (element) element.value='';
            window.CList.accounts = [];

            window.CList.state.username = '';  // Clear the username
            // Clear the baseURL and accessToken input fields and selected option in the dropdown
            document.getElementById('baseURL').value = '';
            document.getElementById('accessToken').value = '';


            // Reset left content
            document.querySelectorAll('#left-content > div').forEach(div => div.style.display = 'none');

            // Display logout message
           //alert('You have been logged out.');

            loginRequired("You have been logged out.");

            // Optionally redirect to the home page or keep the user on the same page
            // window.location.href = '/';
        };



        function displayUsername() {
            const usernameDisplay = document.getElementById('username-display');
            if (usernameDisplay) {
                usernameDisplay.textContent = (window.CList.state.username && window.CList.state.username !== 'none') ? `Logged in as ${window.CList.state.username}!` : 'Welcome, guest!';
            }
        }




        function isTokenExpired(token) {
            // Token is now an opaque string, not a JWT — check the stored expiry cookie.
            if (!token) return true;
            const expires = getSiteSpecificCookie(window.CList.config.flaskSiteUrl, window.CList.keys.TOKEN_EXPIRES);
            if (!expires) return true;
            const expired = new Date(expires) < new Date();
            if (expired) console.log("access token expired");
            return expired;
        }

        async function getAccounts(siteUrl = window.CList.config.flaskSiteUrl, retryCount = 3, retryDelay = 500) {

            // Set up debugging for this crucial function
            const stack = new Error().stack;
            const callerFunction = stack.split("\n")[2]?.trim(); // Get the caller function name
        
            console.log(`getAccounts() called using ${window.CList.config.flaskSiteUrl}`);
            console.log(`Called by: ${callerFunction}`);

            let username = getSiteSpecificCookie(window.CList.config.flaskSiteUrl, window.CList.keys.USERNAME);
            let token = getSiteSpecificCookie(window.CList.config.flaskSiteUrl, window.CList.keys.ACCESS_TOKEN);

                // Retry logic: If username is not set, wait and retry
            let attempt = 0;
            while ((!username || username === "none" || !token) && attempt < retryCount) {
                console.warn(`No username found in cookies. Retrying in ${retryDelay}ms... (${attempt + 1}/${retryCount})`);
                await new Promise(resolve => setTimeout(resolve, retryDelay));
                username = getSiteSpecificCookie(window.CList.config.flaskSiteUrl, window.CList.keys.USERNAME);
                token = getSiteSpecificCookie(window.CList.config.flaskSiteUrl, window.CList.keys.ACCESS_TOKEN);
                attempt++;
            }

            if (typeof username === 'undefined' || username === "none" || !username) {
                console.error('No username found in cookies.');
                loginRequired('No username found in cookies.');
                return;
            }

            if (!token) {
                console.error('No access token found in cookies.');
                loginRequired('No access token found in cookies.');
                return;
            }

            try {
                const data = await window.CList.storage.kv.list();

                // Load encKey from sessionStorage once, before decrypting all values
                const encKey = await getEncKey(window.CList.config.flaskSiteUrl);
                if (!encKey) {
                    loginRequired('Encryption key not found. Please log in again.');
                    return;
                }

                const accounts = (await Promise.all(
                    data.map(async kv => {

                    try {
                        // ===========================
                        //   DECRYPT LOCALLY
                        // ===========================
                        const decryptedString = await decryptWithKey(encKey, kv.value);

                        const accountData = JSON.parse(decryptedString);

                        // Allowlist: only records whose decrypted type matches a registered
                        // account schema are accounts — everything else (collections, the
                        // following list, the DID private key, future non-account data kinds)
                        // decrypts fine but has no matching schema, so it's excluded here rather
                        // than via a hand-maintained list of known non-account key prefixes.
                        if (!window.CList.schemas[accountData.type]) return null;

                        return {
                            key: kv.key,
                            value: JSON.stringify({
                                ...accountData,
                                instance: kv.key,
                                id: accountData.id || '',
                                permissions: accountData.permissions || '',
                                type: accountData.type || '',
                                title: accountData.title || '',
                                public: accountData.public || false
                            })
                        };
                    } catch (error) {
                        console.error(`Error parsing kv.value for key: ${kv.key}`, error);
                        return {
                            key: kv.key,
                            value: JSON.stringify({
                                instance: kv.key,
                                id: 'bad',
                                permissions: 'bad',
                                type: 'bad',
                                title: 'bad',
                                public: false
                            })
                        };
                    }
                }))).filter(a => a !== null);

                const failedCount = accounts.filter(a => {
                    try { return JSON.parse(a.value).type === 'bad'; } catch(e) { return true; }
                }).length;
                if (failedCount > 0 && failedCount === accounts.length) {
                    showStatusMessage('Session key invalid — please log out and log back in to decrypt your accounts.');
                }
                console.log('Accounts in getAccounts():', accounts);
                return accounts; // Return the accounts array
            } catch (error) {
                //alert('Error fetching key-value pairs: ' + error);
                throw error; // Re-throw the error for the caller to handle
            }
        }
         

         


        // Event listener for changes in localStorage
        // This happens when redirect.html sets the username in localStorage
        // which only happens after a successful login

        window.addEventListener('storage', (event) => {
            if (event.key === 'kvstore') {
                console.log('Detected change in kvstore:', event.newValue);
                console.log('Getting accounts from KVStore...' + window.CList.config.flaskSiteUrl);
                             
                // Introduce a small delay to allow cookies to be set before calling getAccounts
                setTimeout(async () => {
                    try {
                        console.log('Delaying getAccounts() call to ensure cookies are set...');
                        window.CList.accounts = await getAccounts(window.CList.config.flaskSiteUrl);
                        console.log('Accounts:', window.CList.accounts);
                        await playRead();
                        console.log('PlayRead() run');
                        populateReadAccountList(window.CList.accounts);
                        
                        updateIdentityDiv(); // Update the div when kvstore changes
                        acceptLogin();
                    } catch (error) {
                        console.error('Error fetching accounts:', error);
                        showStatusMessage('Error fetching accounts: ' + error.message);
                    }
                }, 500); // Adjust delay time if needed (500ms should be sufficient)

            }
        });

        // Function to fetch cookies and update the div
        function updateIdentityDiv() {
            window.CList.state.username = getSiteSpecificCookie(window.CList.config.flaskSiteUrl, window.CList.keys.USERNAME);
            if (window.CList.state.username) {
                renderIdentityLabel();
            } else {
                console.warn('No login data found in cookies.');
            }
        }

        // Function to fetch cookies and update the div
        function acceptLogin() {
            window.CList.state.username = getSiteSpecificCookie(window.CList.config.flaskSiteUrl, window.CList.keys.USERNAME);
            const access_token = getSiteSpecificCookie(window.CList.config.flaskSiteUrl, window.CList.keys.ACCESS_TOKEN);
            if (window.CList.state.username && access_token) {
               loginButton.style.display="none";
               const registerButton = document.getElementById("registerButton");
               if (registerButton) registerButton.style.display="none";
               logoutButton.style.display="block";
               accountButton.style.display="block";
               updateUIVisibility();
            }
        }

        // Silently register the current user on the default collab server and save
        // a Collab account to kvstore if one doesn't already exist.
        async function autoRegisterCollab() {
            const COLLAB_DEFAULT = 'wss://collab.mooc.ca';
            const base = 'https://collab.mooc.ca';
            const token = getSiteSpecificCookie(window.CList.config.flaskSiteUrl, window.CList.keys.ACCESS_TOKEN);
            if (!token) return;

            const resp = await fetch(`${base}/api/register`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
            });
            if (!resp.ok) throw new Error(`Collab registration failed (${resp.status})`);

            // Don't add a duplicate account entry
            const existing = (window.CList.accounts || []).find(a => {
                const v = parseAccountValue(a);
                return v && v.type === 'Collab' && v.instance === COLLAB_DEFAULT;
            });
            if (existing) return;

            const encKey = await getEncKey(window.CList.config.flaskSiteUrl);
            if (!encKey) throw new Error('Encryption key not available');
            const instanceData = { type: 'Collab', instance: COLLAB_DEFAULT, title: 'collab.mooc.ca', permissions: 'e' };
            const encryptedValue = await encryptWithKey(encKey, JSON.stringify(instanceData));

            await window.CList.storage.kv.add(COLLAB_DEFAULT, encryptedValue);
        }

        // Silently register the current user on the matching annotations server and save
        // an Annotate account to kvstore if one doesn't already exist.
        async function autoRegisterAnnotations() {
            const kvMatch = (window.CList.config.flaskSiteUrl || '').match(/^https?:\/\/kvstore\.(.+)/);
            if (!kvMatch) return;
            const annoUrl = `https://annotations.${kvMatch[1]}`;
            const token = getSiteSpecificCookie(window.CList.config.flaskSiteUrl, window.CList.keys.ACCESS_TOKEN);
            if (!token) return;

            const resp = await fetch(`${annoUrl}/api/register`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
            });
            if (!resp.ok) throw new Error(`Annotations registration failed (${resp.status})`);

            // Don't add a duplicate account entry
            const existing = (window.CList.accounts || []).find(a => {
                const v = parseAccountValue(a);
                return v && v.type === 'Annotate' && v.instance === annoUrl;
            });
            if (existing) return;

            const encKey = await getEncKey(window.CList.config.flaskSiteUrl);
            if (!encKey) throw new Error('Encryption key not available');
            const instanceData = { type: 'Annotate', instance: annoUrl, title: annoUrl.replace('https://', ''), permissions: 'rw' };
            const encryptedValue = await encryptWithKey(encKey, JSON.stringify(instanceData));

            await window.CList.storage.kv.add(annoUrl, encryptedValue);

            // Refresh accounts and update UI so the Post button appears immediately
            window.CList.accounts = await getAccounts(window.CList.config.flaskSiteUrl);
            updateUIVisibility();
            if (typeof populatePostOptions === 'function') populatePostOptions(window.CList.accounts);
        }

        // Silently save a default RSS Relay (OPML2JSON) service account if one doesn't exist.
        async function autoSeedRSSRelay() {
            const OPML2JSON_DEFAULT = 'https://opml2json.downes.ca';
            const token = getSiteSpecificCookie(window.CList.config.flaskSiteUrl, window.CList.keys.ACCESS_TOKEN);
            if (!token) return;

            const existing = (window.CList.accounts || []).find(a => {
                const v = parseAccountValue(a);
                return v && v.type === 'OPML2JSON';
            });
            if (existing) return;

            const encKey = await getEncKey(window.CList.config.flaskSiteUrl);
            if (!encKey) throw new Error('Encryption key not available');
            const instanceData = { type: 'OPML2JSON', instance: OPML2JSON_DEFAULT, title: 'RSS Relay', permissions: 's' };
            const encryptedValue = await encryptWithKey(encKey, JSON.stringify(instanceData));

            await window.CList.storage.kv.add(OPML2JSON_DEFAULT, encryptedValue);
        }

        async function autoSeedCListBin() {
            const CLISTBIN_DEFAULT = 'https://pastebin.mooc.ca';
            const token = getSiteSpecificCookie(window.CList.config.flaskSiteUrl, window.CList.keys.ACCESS_TOKEN);
            if (!token) return;

            const existing = (window.CList.accounts || []).find(a => {
                const v = parseAccountValue(a);
                return v && v.type === 'CListBin' && v.instance === CLISTBIN_DEFAULT;
            });
            if (existing) return;

            const encKey = await getEncKey(window.CList.config.flaskSiteUrl);
            if (!encKey) throw new Error('Encryption key not available');
            const instanceData = { type: 'CListBin', instance: CLISTBIN_DEFAULT, title: 'pastebin.mooc.ca', permissions: 'b' };
            const encryptedValue = await encryptWithKey(encKey, JSON.stringify(instanceData));

            await window.CList.storage.kv.add(CLISTBIN_DEFAULT, encryptedValue);
        }

        // Re-register on all saved Collab servers to push an updated DID.
        // Called from me.html after DID generation via window.parent.refreshCollabRegistrations().
        window.refreshCollabRegistrations = async function() {
            const token = getSiteSpecificCookie(window.CList.config.flaskSiteUrl, window.CList.keys.ACCESS_TOKEN);
            if (!token) return;
            const collabAccounts = (window.CList.accounts || []).filter(a => {
                const v = parseAccountValue(a);
                return v && v.type === 'Collab';
            });
            await Promise.all(collabAccounts.map(async a => {
                const v = parseAccountValue(a);
                const base = v.instance.replace(/^wss?:\/\//, 'https://').replace(/\/$/, '');
                try {
                    const resp = await fetch(`${base}/api/register`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
                    });
                    if (!resp.ok) console.warn(`Collab DID refresh failed for ${base}: ${resp.status}`);
                } catch (e) {
                    console.warn(`Collab DID refresh error for ${base}:`, e);
                }
            }));
        };


// =============================================================================
//  NEW AUTH FUNCTIONS (v0.2 — PBKDF2 zero-knowledge login)
// =============================================================================

/**
 * Retrieve the session encryption key from sessionStorage.
 * Returns null if the user has not logged in this tab session.
 * @param {string} siteUrl - window.CList.config.flaskSiteUrl, used as namespace
 * @returns {Promise<CryptoKey|null>}
 */
async function getEncKey(siteUrl) {
    const username = getSiteSpecificCookie(siteUrl, window.CList.keys.USERNAME);
    if (!username) return null;
    const b64 = sessionStorage.getItem(`${siteUrl}_${username}_encKey`);
    if (!b64) return null;
    const raw = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    return window.crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

/**
 * Authenticate against the kvstore server using PBKDF2-derived credentials.
 * Derives encKey (stays in browser) and authHash (sent to server) from the password.
 * On success: stores token+expiry in site-specific cookies, encKey in sessionStorage.
 * @param {string} uname - lowercase username
 * @param {string} password
 * @returns {Promise<{token: string, username: string}>}
 */
async function KVloginWithCredentials(uname, password) {
    // Derive both keys in parallel (each runs 100k PBKDF2 iterations — takes ~2-3s)
    const [encKey, authHash] = await Promise.all([
        deriveEncKey(password, uname),
        deriveAuthHash(password, uname)
    ]);

    let data;
    if (window.CList.isLocalMode()) {
        // Local mode: go straight to IndexedDB, never through the window.fetch sentinel
        // interception (docs/storage-architecture-plan.md §8 step 5(b)).
        try {
            data = await window.CList._localKvStore.loginUser(uname, authHash);
        } catch (err) {
            throw new Error(err.message || 'Login failed');
        }
    } else {
        const response = await fetch(`${window.CList.config.flaskSiteUrl}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: uname, auth_hash: authHash })
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error || `Login failed (${response.status})`);
        }

        data = await response.json();
    }

    // Store token and expiry in persistent cookies (365-day lifetime matches server)
    setSiteSpecificCookie(window.CList.config.flaskSiteUrl, window.CList.keys.ACCESS_TOKEN, data.token, 365);
    setSiteSpecificCookie(window.CList.config.flaskSiteUrl, window.CList.keys.USERNAME, data.username, 365);
    setSiteSpecificCookie(window.CList.config.flaskSiteUrl, window.CList.keys.TOKEN_EXPIRES, data.expires, 365);

    // Export encKey to raw bytes and store in sessionStorage (cleared when tab closes)
    const rawKey = await window.crypto.subtle.exportKey('raw', encKey);
    const keyB64 = btoa(String.fromCharCode(...new Uint8Array(rawKey)));
    sessionStorage.setItem(`${window.CList.config.flaskSiteUrl}_${data.username}_encKey`, keyB64);

    return { token: data.token, username: data.username };
}

/**
 * Register a new account on the kvstore server.
 * Derives authHash client-side; server stores bcrypt(authHash).
 * Server never sees the raw password or the encryption key.
 * @param {string} uname - desired username (will be lowercased)
 * @param {string} password
 * @returns {Promise<void>}
 */
async function KVregisterWithCredentials(uname, password) {
    const authHash = await deriveAuthHash(password, uname.toLowerCase());

    if (window.CList.isLocalMode()) {
        // Local mode: go straight to IndexedDB, never through the window.fetch sentinel
        // interception (docs/storage-architecture-plan.md §8 step 5(b)).
        try {
            await window.CList._localKvStore.registerUser(uname.toLowerCase(), authHash);
        } catch (err) {
            throw new Error(err.message || 'Registration failed');
        }
        return;
    }

    const response = await fetch(`${window.CList.config.flaskSiteUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: uname.toLowerCase(), auth_hash: authHash })
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `Registration failed (${response.status})`);
    }
}
