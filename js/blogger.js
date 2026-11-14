/// <reference path="./clist-types.js" />
//  blogger.js  -  helper and utility functions for Blogger API
//  Part of CList, the next generation of learning and connecting with your community
//
//  Version version 0.1 created by Stephen Downes on January 27, 2025
//
//  Copyright Stephen Downes 2025
//  Licensed under Creative Commons Attribution 4.0 International https://creativecommons.org/licenses/by/4.0/
//
//  This software carries NO WARRANTY OF ANY KIND.
//  This software is provided "AS IS," and you, its user, assume all risks when using it.

window.CList.schemas = window.CList.schemas || {};
window.CList.schemas['Blogger'] = {
    type: 'Blogger',
    instanceFromKey: true,
    kvKey: { label: 'Blog ID', placeholder: '1234567890' },
    fields: [
        { key: 'title',       label: 'Blog Title', editable: true, inputType: 'text',     placeholder: 'My Blog', default: '' },
        { key: 'permissions', label: 'Permissions',editable: true, inputType: 'text',     placeholder: 'w',       default: 'w' },
        { key: 'id',          label: 'Client ID',  editable: true, inputType: 'text',     placeholder: '123456.apps.googleusercontent.com', default: '' },
    ]
};

(function () {
    window.CList.publishers = window.CList.publishers || {};
    window.CList.publishers['Blogger'] = {
        acceptedFormats: ['html', 'md', 'text'],
        publish: async (accountData, title, content) => {
            const plainTitle = derivePlainTitle(title, content);
            return await publishBloggerPost(
                accountData.instance,
                accountData.id,
                plainTitle,
                content
            );
        }
    };
})();

/**
 * Publish using the existing Google token flow. Data/errors only; the caller
 * presents failures. A successful response without a URL remains unconfirmed.
 * @param {string} blogid
 * @param {string} clientid
 * @param {string} bloggerTitle
 * @param {string} bloggerContent
 * @returns {Promise<CListPublisherResult>}
 */
async function publishBloggerPost(blogid, clientid, bloggerTitle, bloggerContent) {
    if (!bloggerContent) throw new Error('There is no content to publish to Blogger.');
    if (!blogid || !clientid) throw new Error('The Blogger account needs a Blog ID and Client ID. Check it under Accounts.');
    const accessToken = await requestBloggerAccessToken(clientid);
    let response;
    try {
        response = await fetch(`https://www.googleapis.com/blogger/v3/blogs/${blogid}/posts/`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ kind: 'blogger#post', title: bloggerTitle, content: bloggerContent }),
        });
    } catch (error) {
        throw new Error('Could not confirm Blogger publication: ' + error.message + '. Check your blog before retrying.');
    }
    let data;
    try { data = await response.json(); }
    catch {
        if (response.ok) throw new Error('Blogger returned success, but its response could not be read. Check your blog before retrying.');
        throw new Error(`Failed to publish to Blogger (HTTP ${response.status}). The error response could not be read.`);
    }
    if (!response.ok) {
        throw new Error(`Failed to publish to Blogger (HTTP ${response.status}): ${data?.error?.message || response.statusText || 'Unknown error'}`);
    }
    return typeof data?.url === 'string' && data.url ? data.url : null;
}

/**
 * Google Identity Services reports OAuth errors in callback and popup errors in
 * error_callback: https://developers.google.com/identity/oauth2/web/reference/js-reference
 * @param {string} clientid
 * @returns {Promise<string>} Transient access token; never persisted.
 */
function requestBloggerAccessToken(clientid) {
    return new Promise((resolve, reject) => {
        if (typeof google === 'undefined' || !google.accounts?.oauth2?.initTokenClient) {
            reject(new Error('Google authorization is unavailable. Reload CList and try again.'));
            return;
        }
        const client = google.accounts.oauth2.initTokenClient({
            client_id: clientid,
            scope: 'https://www.googleapis.com/auth/blogger',
            callback: response => {
                if (response?.error || !response?.access_token) {
                    const detail = response?.error_description || response?.error || 'No access token returned';
                    reject(new Error('Failed to authorize with Blogger: ' + detail));
                } else {
                    resolve(response.access_token);
                }
            },
            error_callback: error => {
                const detail = error?.type === 'popup_closed' ? 'The authorization window was closed.'
                    : error?.type === 'popup_failed_to_open' ? 'The authorization window could not open. Allow pop-ups and try again.'
                    : 'The authorization window failed.';
                reject(new Error('Failed to authorize with Blogger: ' + detail));
            },
        });
        client.requestAccessToken();
    });
}

// Service-specific account setup extracted from kvstore.js.
// Copyright Stephen Downes 2026. CC BY 4.0; provided AS IS, without warranty.
window.CList.accountFlows = window.CList.accountFlows || {};

/**
 * @param {CListAccountFlowContext} context
 * @returns {CListAccountFlow}
 */
window.CList.accountFlows['Blogger'] = function (context) {
    const div = context.container;
    const showTypePicker = context.back;
    const cancelAdd = context.finish;
    const getSite = context.refreshList;

    function open() {
        const flow = div;
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
    }

    async function submitBloggerManual() {
        const blogId      = div.querySelector('#blogger-blog-id').value.trim();
        const clientId    = div.querySelector('#blogger-client-id').value.trim();
        const title       = div.querySelector('#blogger-title').value.trim();

        if (!blogId)   { showErrorModal('Please enter your Blog ID.', { title: 'Blogger account failed' });    return; }
        if (!clientId) { showErrorModal('Please enter your Client ID.', { title: 'Blogger account failed' }); return; }

        const instanceData = { type: 'Blogger', id: clientId, title: title || blogId, permissions: 'w' };

        try {
            const encKey = await getEncKey(window.CList.config.flaskSiteUrl);
            if (!encKey) throw new Error('Encryption key not found — please log in again.');
            const encryptedValue = await encryptWithKey(encKey, JSON.stringify(instanceData));

            await window.CList.storage.kv.put(blogId, encryptedValue);

            window.CList.accounts = await context.reloadAccounts();
            populatePostOptions(window.CList.accounts);
            updateUIVisibility();
            showStatusMessage('Blogger account saved.');
            cancelAdd();
            getSite(window.CList.config.flaskSiteUrl);
        } catch (err) {
            console.error('Blogger save failed:', err);
            showErrorModal('Could not save account: ' + err.message, { title: 'Blogger save failed' });
        }
    }
    return { open };
};
