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
    const encKey = await getEncKey(window.CList.config.flaskSiteUrl);
    if (!encKey) { showErrorModal('Encryption key missing — please log in again.', { title: 'Encryption key missing' }); return; }

    const accountData = { type: 'Dropbox', appKey, folder, permissions, id: accessToken, refresh: refreshToken };
    let encryptedValue;
    try {
        encryptedValue = await encryptWithKey(encKey, JSON.stringify(accountData));
    } catch (err) {
        console.error('Failed to encrypt Dropbox account data:', err);
        showErrorModal('Could not save Dropbox account — encryption failed.', { title: 'Encryption failed' });
        return;
    }

    try {
        await window.CList.storage.kv.put(title, encryptedValue);
    } catch (err) {
        if (err.code === 'NotAuthenticated') showErrorModal('Please log in to kvstore before authorizing Dropbox.', { title: 'Not logged in' });
        else showErrorModal('Failed to save Dropbox account to kvstore.', { title: 'Save failed' });
        return;
    }

    try {
        window.CList.accounts = await getAccounts(window.CList.config.flaskSiteUrl);
        if (window.CList.accounts) updateUIVisibility();
        showStatusMessage('Dropbox account authorized and saved.');
    } catch (err) {
        showErrorModal('Account saved — could not refresh account list: ' + err.message, { title: 'Account list refresh failed' });
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

// Shared by this file's saver and collections.js's "Save to Dropbox" button —
// returns a call wrapper that retries once, silently, after refreshing the
// token on a 401. Callers do: const withRefresh = _dropboxWithRefresh(account, accountData, statusEl);
// await withRefresh(t => _dropboxUpload(t, ...));
function _dropboxWithRefresh(account, accountData, statusEl) {
    let token = accountData.id;
    return async function withRefresh(fn) {
        try { return await fn(token); } catch (err) {
            if (!accountData.refresh || !err.message.includes('401')) throw err;
            statusEl.textContent = 'Refreshing token…';
            token = await _dropboxRefreshAndPersist(account, accountData);
            return await fn(token);
        }
    };
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
    if (resp.status === 409) {
        // Dropbox uses 409 for several distinct path errors — only a genuine
        // not_found means the file doesn't exist. Anything else (and any other
        // non-ok status, incl. 401) must propagate so the caller's refresh/retry
        // logic sees it, instead of being read as a false "file doesn't exist".
        const data = await resp.json().catch(() => null);
        if (data?.error?.['.tag'] === 'path' && data.error.path?.['.tag'] === 'not_found') return false;
        throw new Error(`Dropbox metadata check failed (409): ${JSON.stringify(data)}`);
    }
    if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        throw new Error(`Dropbox metadata check failed (${resp.status}): ${text}`);
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

function _promptDropboxOverwrite(statusEl, filename, doOverwrite) {
    return new Promise(resolve => {
        statusEl.innerHTML = '';
        const title = document.createElement('p');
        title.className = 'list-tip-title';
        title.textContent = `Overwrite "${filename}"?`;
        statusEl.appendChild(title);

        const msg = document.createElement('p');
        msg.className = 'list-tip';
        msg.textContent = `"${filename}" already exists in Dropbox.`;
        statusEl.appendChild(msg);

        const row = document.createElement('div');
        row.style.cssText = 'display:flex;gap:6px';

        const overwriteBtn = document.createElement('button');
        overwriteBtn.className   = 'btn btn-small';
        overwriteBtn.textContent = 'Overwrite';
        overwriteBtn.onclick = async () => {
            overwriteBtn.disabled = true;
            cancelBtn.disabled    = true;
            statusEl.textContent  = 'Saving…';
            try {
                const result = await doOverwrite();
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
}

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
        // Declared for documentation; visible() below is the actual gate since it must
        // also match the account TYPE (Dropbox specifically), which the flags alone can't express.
        requiresLogin:   true,
        requiresAccount: true,
        visible: () => typeof isRegistered === 'function' && isRegistered() && (window.CList.accounts || []).some(a => {
            const v = parseAccountValue(a);
            return v && v.type === 'Dropbox' && (v.permissions || '').includes('b');
        }),
        save: async () => {
            const accounts = window.CList.accounts || [];
            const account  = accounts.find(a => {
                const v = parseAccountValue(a);
                return v && v.type === 'Dropbox' && (v.permissions || '').includes('b');
            });
            if (!account) {
                showErrorModal('No Dropbox account configured. Add one in Accounts.', { title: 'No Dropbox account' });
                return; // let publish.js close the pane as normal
            }
            const accountData = parseAccountValue(account);

            // A loaded file (kind: 'file') with no references round-trips as raw,
            // unwrapped content under its exact original filename — it never had
            // an HTML "post" structure to begin with, so forcing one (and forcing
            // a .html extension) would silently change the file's format. Any
            // other source (a page/collection/local-page, or a file that picked up
            // references while being edited) still gets packagePost()'s HTML wrapper.
            const isRawFileRoundTrip = currentLoadedPage?.kind === 'file' && getReferences().length === 0;

            let content, filename;
            if (isRawFileRoundTrip) {
                content  = await editorHandlers[currentEditor]?.getContent?.();
                filename = currentLoadedPage.title; // exact original name, not slugified
            } else {
                content = await packagePost();
                // The filename must come from the Editor States Array's own record for
                // this editor (currentLoadedPage), not from the on-screen title field —
                // a loaded file (kind: 'file') never populates the title field, so
                // reading from there silently fell back to the generic 'clist-post'
                // default instead of the loaded file's actual name.
                const title    = (window.CList.ui.view.writeTitle?.innerText || '').trim();
                const baseName = currentLoadedPage?.kind === 'file'
                    ? currentLoadedPage.title.replace(/\.[^./]+$/, '')
                    : (currentLoadedPage?.title || title);
                filename = _slug(baseName) + '.html';
            }
            if (!content) return;

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
            const _withRefresh = _dropboxWithRefresh(account, accountData, statusEl);

            let exists;
            try {
                exists = await _withRefresh(t => _dropboxFileExists(t, accountData.folder, filename));
            } catch (err) {
                statusEl.textContent = 'Error: ' + err.message;
                console.error('[Dropbox save]', err);
                return { keepOpen: true };
            }

            const doOverwrite = () => _withRefresh(t => _dropboxUpload(t, accountData.folder, filename, content, 'overwrite'));

            if (!exists) {
                // File is new — upload immediately.
                statusEl.textContent = 'Saving…';
                try {
                    const result = await _withRefresh(t => _dropboxUpload(t, accountData.folder, filename, content, 'add'));
                    statusEl.textContent = 'Saved: ' + (result.path_display || filename);
                    return { keepOpen: true };
                } catch (err) {
                    if (!err.message.includes('conflict')) {
                        statusEl.textContent = 'Save failed: ' + err.message;
                        console.error('[Dropbox save]', err);
                        return { keepOpen: true };
                    }
                    // Dropbox says the file exists after all — the exists-check above
                    // was stale or wrong (or another save landed in between). Fall back
                    // to the same overwrite confirmation rather than just failing.
                    console.error('[Dropbox save] add conflicted, falling back to overwrite prompt:', err);
                }
            }

            // File already exists — ask the user.
            return _promptDropboxOverwrite(statusEl, filename, doOverwrite);
        },
    });
})();

// ── Loader registration ───────────────────────────────────────────────────────

(function () {

    function _fileIcon(filename) {
        const fmt = _detectFormat('', filename);
        if (fmt === 'html')                                        return 'article';
        if (fmt === 'opml' || fmt === 'rss' || fmt === 'json')      return 'list_alt';
        return 'description';
    }

    async function _openInEditor(text, filename) {
        const format = _detectFormat('', filename);

        // Route through the shared loadSavedPage() path — same as "Load from
        // file" — instead of forcing switchToEditor() directly: it picks the
        // right editor, checks for existing content, and offers Replace/Insert/
        // Cancel instead of silently cursor-inserting into whatever's already there.
        async function loadNative() {
            if (typeof loadSavedPage === 'function') {
                const nativeType = (format === 'html') ? 'text/html' : 'text/plain';
                const content    = { type: nativeType, value: text };
                const page       = { kind: 'file', title: filename };
                const optionsDiv = window.CList.ui.view.loadOptions;
                await loadSavedPage(content, page, optionsDiv, () => populateLoadOptions());
            }
        }

        // Only offer the Collection editor when the content actually parses into
        // a genuine non-empty list of items — not just because its format happens
        // to be one that CAN carry a collection.
        const parsed = (typeof _collectionShape === 'function') ? _collectionShape(text, format) : null;
        if (parsed) {
            await _offerCollectionChoice(parsed, format, { renderTarget: window.CList.ui.view.loadOptions, onNative: loadNative });
        } else {
            await loadNative();
        }
    }

    window.CList.loaders = window.CList.loaders || [];
    window.CList.loaders.push({
        label:   'Load from Dropbox',
        logoSrc: 'assets/icons/dropbox.svg',
        // Declared for documentation; visible() below is the actual gate since it must
        // also match the account TYPE (Dropbox specifically), which the flags alone can't express.
        requiresLogin:   true,
        requiresAccount: true,
        visible: () => typeof isRegistered === 'function' && isRegistered() && (window.CList.accounts || []).some(a => {
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
