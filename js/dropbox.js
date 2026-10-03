// dropbox.js — Save content to Dropbox
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
    if (!appKey) { showStatusMessage('Please enter your Dropbox App Key first.'); return; }
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
        showStatusMessage('Could not start Dropbox authorization: ' + e.message);
    }
}

// ── OAuth callback ────────────────────────────────────────────────────────────
// callback.html stores the result in localStorage; pick it up here after redirect.

document.addEventListener('DOMContentLoaded', async function () {
    const raw = localStorage.getItem(window.CList.keys.OAUTH_CALLBACK_RESULT);
    if (!raw) return;
    let data;
    try { data = JSON.parse(raw); } catch (e) { console.error('Bad oauth_callback_result', e); return; }
    if (data.providerType !== 'Dropbox') return;
    localStorage.removeItem(window.CList.keys.OAUTH_CALLBACK_RESULT);

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

async function _saveDropboxAccount(title, appKey, folder, permissions, accessToken, refreshToken) {
    const kvToken = getSiteSpecificCookie(window.CList.config.flaskSiteUrl, window.CList.keys.ACCESS_TOKEN);
    if (!kvToken) { showStatusMessage('Please log in to kvstore before authorizing Dropbox.'); return; }

    const encKey = await getEncKey(window.CList.config.flaskSiteUrl);
    if (!encKey) { showStatusMessage('Encryption key missing — please log in again.'); return; }

    const accountData = { type: 'Dropbox', appKey, folder, permissions, id: accessToken, refresh: refreshToken };
    let encryptedValue;
    try {
        encryptedValue = await encryptWithKey(encKey, JSON.stringify(accountData));
    } catch (err) {
        console.error('Failed to encrypt Dropbox account data:', err);
        showStatusMessage('Could not save Dropbox account — encryption failed.');
        return;
    }

    const kvKey = title;

    let response = await fetch(`${window.CList.config.flaskSiteUrl}/add_kv/`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + kvToken },
        body:    JSON.stringify({ key: kvKey, value: encryptedValue }),
    });
    if (!response.ok && response.status === 409) {
        // Key already exists — update instead
        response = await fetch(`${window.CList.config.flaskSiteUrl}/update_kv/`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + kvToken },
            body:    JSON.stringify({ key: kvKey, value: encryptedValue }),
        });
    }
    if (!response.ok) { showStatusMessage('Failed to save Dropbox account to kvstore.'); return; }

    try {
        window.CList.accounts = await getAccounts(window.CList.config.flaskSiteUrl);
        if (window.CList.accounts) updateUIVisibility();
        showStatusMessage('Dropbox account authorized and saved.');
    } catch (err) {
        showStatusMessage('Account saved — could not refresh account list: ' + err.message);
    }
    if (typeof playAccounts === 'function') playAccounts();
}

// ── Token refresh ─────────────────────────────────────────────────────────────

// Refresh the access token and persist the new one to kvstore.
async function _dropboxRefreshAndPersist(account, accountData) {
    const newToken = await _dropboxRefresh(accountData.appKey, accountData.refresh);
    accountData.id = newToken;
    await _saveDropboxAccount(account.key, accountData.appKey, accountData.folder,
        accountData.permissions, newToken, accountData.refresh);
    return newToken;
}

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
    const resp = await fetch('https://content.dropboxapi.com/2/files/upload', {
        method:  'POST',
        headers: {
            'Authorization':   'Bearer ' + accessToken,
            'Dropbox-API-Arg': JSON.stringify({ path, mode, autorename: false }),
            'Content-Type':    'application/octet-stream',
        },
        body: content,
    });
    if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        throw new Error(`Dropbox upload failed (${resp.status}): ${text}`);
    }
    return await resp.json();
}

async function _dropboxFileExists(accessToken, folder, filename) {
    const path = (folder || '/CList').replace(/\/$/, '') + '/' + filename;
    const resp = await fetch('https://api.dropboxapi.com/2/files/get_metadata', {
        method:  'POST',
        headers: { 'Authorization': 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ path }),
    });
    if (resp.status === 409) return false; // path/not_found
    if (!resp.ok) return false;
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
        const text = await resp.text().catch(() => '');
        const err = new Error(`Dropbox list failed (${resp.status}): ${text}`);
        if (text.includes('missing_scope')) err.missingScope = true;
        throw err;
    }
    return await resp.json(); // { entries: [...], cursor, has_more }
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
        const text = await resp.text().catch(() => '');
        const err = new Error(`Dropbox download failed (${resp.status}): ${text}`);
        if (text.includes('missing_scope')) err.missingScope = true;
        throw err;
    }
    return await resp.text();
}

// ── Saver registration ────────────────────────────────────────────────────────

(function () {
    function _slug(title) {
        return (title || 'clist-post')
            .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 60)
            || 'clist-post';
    }

    window.CList.savers = window.CList.savers || [];
    window.CList.savers.push({
        label:   'Save to Dropbox',
        logoSrc: 'assets/icons/dropbox.svg',
        save: async () => {
            const accounts = window.CList.accounts || [];
            const account  = accounts.find(a => {
                const v = parseAccountValue(a);
                return v && v.type === 'Dropbox' && (v.permissions || '').includes('b');
            });
            if (!account) {
                showStatusMessage('No Dropbox account configured. Add one in Accounts.');
                return; // let publish.js close the pane as normal
            }
            const accountData = parseAccountValue(account);

            const content = await packagePost();
            if (!content) return;

            const title    = (window.CList.ui.view.writeTitle?.innerText || '').trim();
            const filename = _slug(title) + '.html';

            // Status area injected below the saver list — persists as long as pane stays open.
            const saveOptions = document.getElementById('save-options');
            let statusEl = document.getElementById('dropbox-save-status');
            if (!statusEl) {
                statusEl = document.createElement('div');
                statusEl.id        = 'dropbox-save-status';
                statusEl.className = 'feed-status-message';
                statusEl.style.cssText = 'margin:10px 8px 4px;font-size:0.85em;';
                saveOptions?.appendChild(statusEl);
            }
            statusEl.textContent = 'Checking Dropbox…';

            // Ensure a valid token, refreshing silently if needed.
            let token = accountData.id;
            async function _withRefresh(fn) {
                try { return await fn(token); } catch (err) {
                    if (!accountData.refresh || !err.message.includes('401')) throw err;
                    statusEl.textContent = 'Refreshing token…';
                    token = await _dropboxRefreshAndPersist(account, accountData);
                    return await fn(token);
                }
            }

            let exists;
            try {
                exists = await _withRefresh(t => _dropboxFileExists(t, accountData.folder, filename));
            } catch (err) {
                statusEl.textContent = 'Error: ' + err.message;
                console.error('[Dropbox save]', err);
                return { keepOpen: true };
            }

            if (!exists) {
                // File is new — upload immediately.
                statusEl.textContent = 'Saving…';
                try {
                    const result = await _withRefresh(t => _dropboxUpload(t, accountData.folder, filename, content, 'add'));
                    statusEl.textContent = 'Saved: ' + (result.path_display || filename);
                } catch (err) {
                    statusEl.textContent = 'Save failed: ' + err.message;
                    console.error('[Dropbox save]', err);
                }
                return { keepOpen: true };
            }

            // File already exists — ask the user.
            return new Promise(resolve => {
                statusEl.innerHTML = '';
                const msg = document.createElement('p');
                msg.style.margin  = '0 0 6px';
                msg.textContent   = `"${filename}" already exists in Dropbox.`;
                statusEl.appendChild(msg);

                const row = document.createElement('div');
                row.style.cssText = 'display:flex;gap:6px';

                const overwriteBtn = document.createElement('button');
                overwriteBtn.className   = 'btn btn-small';
                overwriteBtn.textContent = 'Overwrite';
                overwriteBtn.onclick = async () => {
                    overwriteBtn.disabled    = true;
                    cancelBtn.disabled       = true;
                    statusEl.textContent     = 'Saving…';
                    try {
                        const result = await _withRefresh(t => _dropboxUpload(t, accountData.folder, filename, content, 'overwrite'));
                        statusEl.textContent = 'Saved: ' + (result.path_display || filename);
                    } catch (err) {
                        statusEl.textContent = 'Save failed: ' + err.message;
                        console.error('[Dropbox overwrite]', err);
                    }
                    resolve({ keepOpen: true });
                };

                const cancelBtn = document.createElement('button');
                cancelBtn.className   = 'btn btn-small btn-secondary';
                cancelBtn.textContent = 'Cancel';
                cancelBtn.onclick = () => {
                    statusEl.textContent = 'Cancelled.';
                    resolve({ keepOpen: true });
                };

                row.appendChild(overwriteBtn);
                row.appendChild(cancelBtn);
                statusEl.appendChild(row);
            });
        },
    });
})();

// ── Loader registration ───────────────────────────────────────────────────────

(function () {

    function _detectFormatByName(filename) {
        const lower = (filename || '').toLowerCase();
        if (lower.endsWith('.html') || lower.endsWith('.htm'))                     return 'html';
        if (lower.endsWith('.opml'))                                                return 'opml';
        if (lower.endsWith('.rss') || lower.endsWith('.xml') || lower.endsWith('.atom')) return 'rss';
        return 'text'; // .md, .txt, unknown
    }

    function _fileIcon(filename) {
        const fmt = _detectFormatByName(filename);
        if (fmt === 'html')            return 'article';
        if (fmt === 'opml' || fmt === 'rss') return 'list_alt';
        return 'description';
    }

    async function _openInEditor(text, filename) {
        const fmt = _detectFormatByName(filename);
        if (fmt === 'html') {
            if (typeof switchToEditor === 'function')
                await switchToEditor('tinymce', { type: 'text/html', value: text });
        } else if (fmt === 'opml' || fmt === 'rss') {
            if (typeof window.loadCollectionText === 'function')
                await window.loadCollectionText(text, filename);
        } else {
            // .md, .txt, unknown
            if (typeof switchToEditor === 'function')
                await switchToEditor('texteditor', { type: 'text/plain', value: text });
        }
    }

    window.CList.loaders = window.CList.loaders || [];
    window.CList.loaders.push({
        label:   'Load from Dropbox',
        logoSrc: 'assets/icons/dropbox.svg',
        visible: () => (window.CList.accounts || []).some(a => {
            const v = parseAccountValue(a);
            return v && v.type === 'Dropbox';
        }),
        load: () => new Promise(resolve => {
            const optionsDiv = window.CList.ui.view.loadOptions;
            optionsDiv.innerHTML = '<p class="list-tip">Loading Dropbox files…</p>';

            (async () => {
                const accounts = window.CList.accounts || [];
                const account  = accounts.find(a => {
                    const v = parseAccountValue(a);
                    return v && v.type === 'Dropbox';
                });
                if (!account) {
                    optionsDiv.innerHTML = '<p class="list-tip">No Dropbox account configured.</p>';
                    return resolve(null);
                }
                const accountData = parseAccountValue(account);

                let listing;
                try {
                    listing = await _dropboxListFolder(accountData.id, accountData.folder);
                } catch (err) {
                    if (accountData.refresh && err.message.includes('401') && !err.missingScope) {
                        try {
                            const newToken = await _dropboxRefreshAndPersist(account, accountData);
                            listing = await _dropboxListFolder(newToken, accountData.folder);
                        } catch (err2) {
                            optionsDiv.innerHTML = `<p class="list-tip">Token refresh failed: ${err2.message}</p>`;
                            return resolve(null);
                        }
                    } else {
                        optionsDiv.innerHTML = `<p class="list-tip">Could not list Dropbox files: ${err.message}</p>`;
                        return resolve(null);
                    }
                }

                const files = (listing.entries || [])
                    .filter(e => e['.tag'] === 'file')
                    .sort((a, b) => (b.server_modified || '').localeCompare(a.server_modified || ''));

                if (!files.length) {
                    optionsDiv.innerHTML = `<p class="list-tip">No files found in ${accountData.folder || '/CList'}.</p>`;
                    return resolve(null);
                }

                optionsDiv.innerHTML = '';
                const tip = document.createElement('p');
                tip.className   = 'list-tip';
                tip.textContent = 'Choose a file to load';
                optionsDiv.appendChild(tip);

                const list = document.createElement('div');
                list.className = 'account-list';

                // Persistent error area shown below the file list on download failure.
                const loadErrEl = document.createElement('div');
                loadErrEl.className   = 'error-message';
                loadErrEl.style.cssText = 'margin:10px 8px 4px;font-size:0.82em;display:none;';

                function _showLoadError(msg) {
                    loadErrEl.textContent = msg;
                    loadErrEl.style.display = 'block';
                }

                for (const file of files) {
                    const btn = document.createElement('button');
                    btn.className = 'account-button';

                    const iconEl = document.createElement('span');
                    iconEl.className   = 'material-icons';
                    iconEl.textContent = _fileIcon(file.name);
                    btn.appendChild(iconEl);

                    const nameEl = document.createElement('span');
                    nameEl.textContent = file.name;
                    btn.appendChild(nameEl);

                    btn.addEventListener('click', async () => {
                        loadErrEl.style.display = 'none';
                        btn.disabled = true;
                        btn.innerHTML = '';
                        const spinEl = document.createElement('span');
                        spinEl.className   = 'material-icons';
                        spinEl.textContent = 'hourglass_top';
                        btn.appendChild(spinEl);
                        const loadingEl = document.createElement('span');
                        loadingEl.textContent = 'Loading…';
                        btn.appendChild(loadingEl);

                        function _resetBtn() {
                            btn.disabled = false;
                            btn.innerHTML = '';
                            btn.appendChild(iconEl);
                            btn.appendChild(nameEl);
                        }

                        try {
                            let text = await _dropboxDownloadFile(accountData.id, file.path_display);
                            await _openInEditor(text, file.name);
                            resolve(null);
                        } catch (err) {
                            if (accountData.refresh && err.message.includes('401') && !err.missingScope) {
                                try {
                                    const newToken = await _dropboxRefreshAndPersist(account, accountData);
                                    const text = await _dropboxDownloadFile(newToken, file.path_display);
                                    await _openInEditor(text, file.name);
                                    resolve(null);
                                } catch (err2) {
                                    console.error('[Dropbox load]', err2);
                                    _showLoadError('Load failed: ' + err2.message);
                                    _resetBtn();
                                }
                            } else {
                                console.error('[Dropbox load]', err);
                                const isScope = err.message.includes('scope') || err.message.includes('not permitted');
                                const msg = isScope
                                    ? 'Missing permission — go to your Dropbox App Console → Permissions tab, '
                                      + 'enable files.content.read, click Submit, then re-authorize CList from Accounts.'
                                    : 'Load failed: ' + err.message;
                                _showLoadError(msg);
                                _resetBtn();
                            }
                        }
                    });

                    list.appendChild(btn);
                }

                optionsDiv.appendChild(list);
                optionsDiv.appendChild(loadErrEl);
            })();
        }),
    });
})();
