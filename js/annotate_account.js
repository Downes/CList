/// <reference path="./clist-types.js" />
// Service-specific account setup extracted from kvstore.js.
// Copyright Stephen Downes 2026. CC BY 4.0; provided AS IS, without warranty.
window.CList.accountFlows = window.CList.accountFlows || {};

/**
 * @param {CListAccountFlowContext} context
 * @returns {CListAccountFlow}
 */
window.CList.accountFlows['Annotate'] = function (context) {
    const div = context.container;
    const showTypePicker = context.back;
    const cancelAdd = context.finish;
    const getSite = context.refreshList;

    function open() {
        const flow = div;
        const inputStyle = 'display:block;width:100%;box-sizing:border-box;padding:0.2rem;font-size:0.8rem;margin:2px 0 8px;';
        const labelStyle = 'font-variant:small-caps;font-size:0.8rem;color:#555;display:block;margin-top:6px;';
        const defaultAnnoServer = window.CList.defaults.ANNOTATIONS;
        const optionsList = `<option value="${defaultAnnoServer}">${defaultAnnoServer}</option>` +
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

        // This install's own default annotation server (window.CList.defaults.ANNOTATIONS)
        // is already selected above — just confirm it's reachable.
        const statusEl = flow.querySelector('#anno-status');
        statusEl.textContent = `Checking ${defaultAnnoServer}…`;
        fetch(defaultAnnoServer + '/health').then(r => {
            if (!statusEl.isConnected) return;
            if (r.ok) { statusEl.style.color = '#2a7a2a'; statusEl.textContent = `✓ Found annotation server at ${defaultAnnoServer}`; }
            else      { statusEl.style.color = '#888';    statusEl.textContent = `No annotation server at ${defaultAnnoServer} — pick one below.`; }
    }).catch(() => {
        if (statusEl.isConnected) { statusEl.style.color = '#888'; statusEl.textContent = 'Could not reach default server — pick one below.'; }
    });
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
            const encKey = await getEncKey(window.CList.config.flaskSiteUrl);
            if (!encKey) throw new Error('Encryption key not found - please log in again.');
            await registerAnnotateAccount({ url, title, permissions }, { token, encKey }, text => {
                statusEl.textContent = text;
            });
            await context.reloadAccounts();
            statusEl.style.color = '#2a7a2a';
            statusEl.textContent = `✓ Registered and account added for ${url.replace('https://', '')}`;
            setTimeout(() => { cancelAdd(); getSite(window.CList.config.flaskSiteUrl); }, 1200);
        } catch (e) {
            console.error('Annotate registration error:', e);
            statusEl.style.color = '#c00';
            statusEl.textContent = 'Error: ' + e.message;
        }
    }
    return { open };
};

/**
 * Register and persist an account without accessing the account panel.
 * @param {{url: string, title: string, permissions: string}} account
 * @param {CListSaveSession} session
 * @param {function(string): void} onProgress
 * @returns {Promise<void>}
 */
async function registerAnnotateAccount({ url, title, permissions }, { token, encKey }, onProgress) {
    const healthResp = await fetch(url + '/health');
    if (!healthResp.ok) throw new Error('Server not reachable (HTTP ' + healthResp.status + ')');

    onProgress(`Registering on ${url}…`);
    const regResp = await fetch(`${url}/api/register`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
    });
    if (!regResp.ok) {
        const regErr = await regResp.json().catch(() => ({}));
        throw new Error('Registration failed: ' + (regErr.detail || regResp.status));
    }

    const instanceData = { type: 'Annotate', instance: url, title, permissions };
    const encryptedValue = await encryptWithKey(encKey, JSON.stringify(instanceData));
    await window.CList.storage.kv.put(url, encryptedValue);
}
