/// <reference path="./clist-types.js" />
// Service-specific account setup extracted from kvstore.js.
// Copyright Stephen Downes 2026. CC BY 4.0; provided AS IS, without warranty.
window.CList.accountFlows = window.CList.accountFlows || {};

/**
 * @param {CListAccountFlowContext} context
 * @returns {CListAccountFlow}
 */
window.CList.accountFlows['Collab'] = function (context) {
    const div = context.container;
    const showTypePicker = context.back;
    const cancelAdd = context.finish;
    const getSite = context.refreshList;

    function open() {
        const flow = div;
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
            const encKey = await getEncKey(window.CList.config.flaskSiteUrl);
            if (!encKey) throw new Error('Encryption key not found - please log in again.');
            const data = await registerCollabAccount(wsUrl, did, { token, encKey });

            await context.reloadAccounts();
            statusEl.textContent = `✓ Registered as ${data.username} on ${base.replace('https://', '')}`;
            setTimeout(() => { cancelAdd(); getSite(window.CList.config.flaskSiteUrl); }, 1200);
        } catch (e) {
            console.error('Collab registration error:', e);
            statusEl.textContent = 'Error: ' + e.message;
        }
    }
    return { open };
};

/**
 * Register and persist an account using plain values, without form access.
 * @param {string} wsUrl
 * @param {string|null} did
 * @param {CListSaveSession} session
 * @returns {Promise<Object>} Server registration response.
 */
async function registerCollabAccount(wsUrl, did, { token, encKey }) {
    const base = wsUrl.replace(/^wss?:\/\//, 'https://').replace(/\/$/, '');
    const resp = await fetch(`${base}/api/register`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ did })
    });
    if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error('Connection failed: ' + (err.error || resp.status));
    }
    const data = await resp.json();

    // Build and encrypt the account record
    const instanceData = {
        type: 'Collab',
        instance: wsUrl,
        title: base.replace('https://', ''),
        permissions: 'e'
    };
    const encryptedValue = await encryptWithKey(encKey, JSON.stringify(instanceData));

    await window.CList.storage.kv.put(wsUrl, encryptedValue);

    return data;
}
