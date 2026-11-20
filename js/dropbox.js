// Dropbox OAuth setup and explicit HTTP transport. File UI/workflows are separate.
// Part of CList, the next generation of learning and connecting with your community
//
// Setup (one-time per user):
//   1. Create an app at https://www.dropbox.com/developers/apps
//      — Scoped access → App folder (or Full Dropbox)
//      — Under OAuth 2 → Redirect URIs, add:  {your-clist-origin}/callback.html
//   2. Copy the App Key and paste it into the CList Dropbox account form.
//   3. Click "Authorize with Dropbox".

window.CList.schemas = window.CList.schemas || {};
window.CList.schemas['Dropbox'] = {
    type:  'Dropbox',
    kvKey: { label: 'Label', placeholder: 'My Dropbox' },
    fields: [
        { key: 'permissions', label: 'Permissions',  editable: true,  inputType: 'text',  placeholder: 'b',               default: 'b' },
        { key: 'appKey',      label: 'App Key',      editable: true,  inputType: 'text',  placeholder: 'xxxxxxxxxxxxxxx',  default: '' },
        { key: 'folder',      label: 'Save folder',  editable: true,  inputType: 'text',  placeholder: '/CList',           default: '/CList' },
        { key: 'id',          label: 'Access Token', editable: false, inputType: 'oauth', placeholder: '',                 default: '' },
    ],
};

// ── OAuth start ───────────────────────────────────────────────────────────────

async function dropboxOAuthStart(appKey, title, permissions, folder) {
    if (!appKey) { showErrorModal('Please enter your Dropbox App Key first.', { title: 'App Key required' }); return; }
    try {
        await OAuthClient.login(
            title || 'Dropbox',
            'Dropbox',
            'https://www.dropbox.com',
            {
                clientId: appKey,
                extra:    { appKey, title: title || 'Dropbox', permissions: permissions || 'b', folder: folder || '/CList' },
            }
        );
    } catch (e) {
        showErrorModal('Could not start Dropbox authorization: ' + e.message, { title: 'Authorization failed' });
    }
}

// ── OAuth callback ────────────────────────────────────────────────────────────
// callback.html stores the result in localStorage; OAuthClient.onCallback picks it up.

OAuthClient.onCallback('Dropbox', async data => {
    const ex = data.extra || {};
    await _saveDropboxAccount(
        ex.title       || 'Dropbox',
        ex.appKey      || '',
        ex.folder      || '/CList',
        ex.permissions || 'b',
        data.accessToken,
        data.tokenData?.refresh_token || ''
    );
});

// Initial OAuth account creation. File-operation token refresh uses the captured
// session in dropbox_session.js and the shared account persistence operation.
async function _saveDropboxAccount(title, appKey, folder, permissions, accessToken, refreshToken) {
    const accountData = { type: 'Dropbox', appKey, folder, permissions, id: accessToken, refresh: refreshToken };
    await OAuthClient.saveAccount('Dropbox', title, accountData);
}

// ── Token refresh ─────────────────────────────────────────────────────────────

async function _dropboxRefresh(appKey, refreshToken) {
    const resp = await fetch('https://api.dropboxapi.com/oauth2/token', {
        method:  'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body:    new URLSearchParams({
            grant_type:    'refresh_token',
            refresh_token: refreshToken,
            client_id:     appKey,
        }),
    });
    if (!resp.ok) throw new Error(`Dropbox token refresh failed (${resp.status})`);
    const data = await resp.json();
    if (!data.access_token) throw new Error('No access_token in Dropbox refresh response');
    return data.access_token;
}

// ── File upload ───────────────────────────────────────────────────────────────

async function _dropboxUpload(accessToken, folder, filename, content, mode = 'add') {
    const path = (folder || '/CList').replace(/\/$/, '') + '/' + filename;
    let resp;
    try { resp = await fetch('https://content.dropboxapi.com/2/files/upload', {
        method:  'POST',
        headers: {
            'Authorization':   'Bearer ' + accessToken,
            'Dropbox-API-Arg': JSON.stringify({ path, mode, autorename: false }),
            'Content-Type':    'application/octet-stream',
        },
        body: content,
    }); } catch (cause) {
        const error = new Error('The Dropbox upload could not be confirmed. Check Dropbox before retrying.');
        error.cause = cause; error.uncertain = true; throw error;
    }
    if (!resp.ok) {
        throw await _dropboxResponseError(resp, 'upload');
    }
    try { return await resp.json(); } catch (cause) {
        const error = new Error('Dropbox accepted the upload, but its receipt could not be read. Check Dropbox before retrying.');
        error.cause = cause; error.uncertain = true; throw error;
    }
}

async function _dropboxResponseError(response, operation) {
    const text = await response.text().catch(() => '');
    let data = null;
    try { data = JSON.parse(text); } catch { /* Unstructured service response remains visible below. */ }
    const error = new Error(`Dropbox ${operation} failed (${response.status}): ${text}`);
    error.status = response.status;
    error.missingScope = text.includes('missing_scope');
    error.conflict = response.status === 409 && data?.error?.['.tag'] === 'path'
        && data.error.path?.['.tag'] === 'conflict';
    return error;
}

async function _dropboxFileExists(accessToken, folder, filename) {
    const path = (folder || '/CList').replace(/\/$/, '') + '/' + filename;
    const resp = await fetch('https://api.dropboxapi.com/2/files/get_metadata', {
        method:  'POST',
        headers: { 'Authorization': 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ path }),
    });
    if (resp.status === 409) {
        // Dropbox uses 409 for several distinct path errors — only a genuine
        // not_found means the file doesn't exist. Anything else (and any other
        // non-ok status, incl. 401) must propagate so the caller's refresh/retry
        // logic sees it, instead of being read as a false "file doesn't exist".
        const data = await resp.json().catch(() => null);
        if (data?.error?.['.tag'] === 'path' && data.error.path?.['.tag'] === 'not_found') return false;
        const error = new Error(`Dropbox metadata check failed (409): ${JSON.stringify(data)}`);
        error.status = 409; throw error;
    }
    if (!resp.ok) {
        throw await _dropboxResponseError(resp, 'metadata check');
    }
    const data = await resp.json();
    return data['.tag'] === 'file';
}

// ── Folder listing and file download ─────────────────────────────────────────

async function _dropboxListFolder(token, folder) {
    const path = (folder || '/CList').replace(/\/$/, '') || '';
    const resp = await fetch('https://api.dropboxapi.com/2/files/list_folder', {
        method:  'POST',
        headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ path, recursive: false }),
    });
    if (!resp.ok) {
        throw await _dropboxResponseError(resp, 'list');
    }
    return await resp.json(); // { entries: [...], cursor, has_more }
}

async function _dropboxContinueFolder(token, cursor) {
    const response = await fetch('https://api.dropboxapi.com/2/files/list_folder/continue', {
        method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ cursor }),
    });
    if (!response.ok) throw await _dropboxResponseError(response, 'list continuation');
    return response.json();
}

async function _dropboxDownloadFile(token, path) {
    const resp = await fetch('https://content.dropboxapi.com/2/files/download', {
        method:  'POST',
        headers: {
            'Authorization':   'Bearer ' + token,
            'Dropbox-API-Arg': JSON.stringify({ path }),
        },
    });
    if (!resp.ok) {
        throw await _dropboxResponseError(resp, 'download');
    }
    return await resp.text();
}
