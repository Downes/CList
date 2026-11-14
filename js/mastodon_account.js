/// <reference path="./clist-types.js" />
// Service-specific account setup extracted from kvstore.js.
// Copyright Stephen Downes 2026. CC BY 4.0; provided AS IS, without warranty.
window.CList.accountFlows = window.CList.accountFlows || {};
window.CList.accountHooks = window.CList.accountHooks || {};
window.CList.accountHooks.Mastodon = {
    reauthorize: ({ key, data }) => mastodonOAuthStart(data.title || key, key, data.permissions || 'rw'),
};

/**
 * @param {CListAccountFlowContext} context
 * @returns {CListAccountFlow}
 */
window.CList.accountFlows['Mastodon'] = function (context) {
    const div = context.container;
    const showTypePicker = context.back;
    const cancelAdd = context.finish;
    const getSite = context.refreshList;

    function open() {
        const flow = div;
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
    }

    function submitMastodonUsername() {
        const username = div.querySelector('#mastodon-username-input').value.trim();
        if (!username.includes('@')) {
            showErrorModal('Please enter your username as you@instance.social', { title: 'Mastodon account failed' });
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
            showErrorModal('Please enter your username as you@instance.social', { title: 'Mastodon account failed' });
            return;
        }
        if (!token) {
            showErrorModal('Please paste an access token.', { title: 'Mastodon account failed' });
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

            const accounts = await context.reloadAccounts();
            populateReadAccountList(accounts);
            populatePostOptions(accounts);
            updateUIVisibility();
            showStatusMessage('Mastodon account saved.');
            cancelAdd();
            getSite(window.CList.config.flaskSiteUrl);
        } catch (err) {
            console.error('Manual Mastodon save failed:', err);
            showErrorModal('Could not save account: ' + err.message, { title: 'Mastodon save failed' });
        }
    }
    return { open };
};
