/// <reference path="./clist-types.js" />
// Service-specific account setup extracted from kvstore.js.
// Copyright Stephen Downes 2026. CC BY 4.0; provided AS IS, without warranty.
window.CList.accountFlows = window.CList.accountFlows || {};
window.CList.accountHooks = window.CList.accountHooks || {};
window.CList.accountHooks.Dropbox = {
    reauthorize: ({ key, data }) => dropboxOAuthStart(data.appKey || '', key, data.permissions || 'b', data.folder || '/CList'),
};

/**
 * @param {CListAccountFlowContext} context
 * @returns {CListAccountFlow}
 */
window.CList.accountFlows['Dropbox'] = function (context) {
    const div = context.container;
    const showTypePicker = context.back;

    function open() {
        const flow = div;
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
    }


    return { open };
};
