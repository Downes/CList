/// <reference path="./clist-types.js" />
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
        // Show the one-time logout notice left by KVlogout() (survives its reload), then clear it.
        const _logoutMsg = sessionStorage.getItem('clist_logout_message');
        if (_logoutMsg) {
            sessionStorage.removeItem('clist_logout_message');
            identityDiv.textContent = _logoutMsg;
        }
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
    _show('openLeftButton',   true); // Public feeds when logged out; Collections even without reader accounts when logged in.
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
        let dataHost = '';
        try {
            dataHost = new URL(window.CList.config.flaskSiteUrl).hostname;
        } catch {
            dataHost = window.CList.config.flaskSiteUrl || '';
        }
        identityDiv.innerHTML = `<span>Identity: ${window.CList.state.username}</span><span>Data: ${dataHost}</span>`;
    } else {
        identityDiv.textContent = '';
    }
}

// Login is required
function loginRequired(msg) {
    window.CList.state.username = 'none';
    window.CList.state.publishing.selectedAccountKeys = [];
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
    window.CList.state.publishing.selectedAccountKeys = [];
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

// Generic account panel: account-panel.js; schema view: account-form.js.

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

            <div class="nav-item">
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

    // Following and Annotations require a real server reachable by other people — nothing a
    // Local-only account (see local-kvstore.js) can provide. Identity is NOT in this list: a
    // did:key is self-certifying and needs no server, so a Local account can still generate and
    // hold one (just without a publishable did:web document) -- see kvstoreDidPanel().
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
            showErrorModal('Unfollow failed: ' + e.message, { title: 'Unfollow failed' });
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

    // Exposed so other follow/unfollow entry points (e.g. the inline batch
    // button in annotate.js) can refresh this panel's list if it's currently open.
    window._clistRefreshFollowingPanel = () => {
        if (document.body.contains(div)) loadFollowing();
    };

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

    // A did:key is self-certifying — no server needed — so Local accounts can still generate and
    // hold one. What they can't have is a did:web document (no server to publish it at), so the
    // "Public Accounts" and "Migrate to New Account Server" sections (which both operate on that
    // document) are suppressed below, and the status/help text here is worded accordingly.
    const localMode = !!(window.CList.isLocalMode && window.CList.isLocalMode());

    const didExplainerHtml = localMode
        ? `A DID (Decentralized Identifier) is a unique address for your online identity that you control — not a platform. This account has no server of its own, so there's no public DID document to publish — but you can still generate a self-certifying <code>did:key</code>: an identifier fully derived from its own public key. The private key stays encrypted on this device; the <code>did:key</code> can be used to prove to accounts on real servers that they share the same identity as this one.`
        : `A DID (Decentralized Identifier) is a unique address for your online identity that you control — not a platform. It links your accounts (Mastodon, Bluesky, WordPress) into a single verifiable identity, published at a public URL others can check. Generating a key creates a cryptographic keypair: the private key stays encrypted in your account here; the public key is published so others can confirm content or connections really come from you.`;
    const regenHelpHtml = localMode
        ? `Regenerating creates a brand-new keypair, replacing your old one. There's no public DID document to update, but any "Prove Same Identity" link to other accounts made using the old key will stop working, since the key itself has changed.`
        : `Regenerating creates a brand-new keypair, replacing your old one. Your DID address stays the same and your linked accounts are preserved, but your public key changes. Anyone who cached your old key will need to re-fetch your DID document. Do this only if you suspect your private key has been compromised.`;
    const removeHelpHtml = localMode
        ? `This will permanently delete your locally-stored identity key. There is no public DID document to remove — this account has no server. You can generate a new identity key at any time, but it will be a completely different key with no relationship to the old one.`
        : `This will permanently delete your identity key and remove your DID document from its public URL. Anyone who has linked to your DID will get a 404. You can generate a new DID at any time, but it will have a new key and a fresh identity. If you do, anyone who linked to your DID will get your new public key automatically the next time they resolve it — DID resolution always fetches fresh from the URL.`;

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
                <p>${didExplainerHtml}</p>
            </details>
            <div id="did-status" class="me-status">Checking…</div>
            <div class="kv-action-buttons">
                <button class="kv-action-btn kv-save-btn" id="did-btn">Generate Identity Key</button>
            </div>
            <details class="did-help" id="did-regen-help" style="display:none;">
                <summary>What does regenerating do?</summary>
                <p>${regenHelpHtml}</p>
            </details>
            <details class="did-help did-remove" id="did-remove-help" style="display:none;">
                <summary>Remove DID…</summary>
                <p>${removeHelpHtml}</p>
                <div class="kv-action-buttons">
                    <button class="kv-action-btn kv-delete-btn" id="did-remove-btn">Yes, remove my DID</button>
                </div>
            </details>
        </div>

        <div class="me-section" id="prove-identity-section" style="display:none;">
            <h3>Prove Same Identity</h3>
            <details class="did-help">
                <summary>What is this?</summary>
                <p>A did:key is self-certifying: the public key is the identifier. If an account on another server publishes the same did:key as this one, you can prove it's the same identity by signing a challenge with this account's private key and checking the signature against that account's publicly-published key. Nothing is sent anywhere except the signature and the challenge text — your private key never leaves this device.</p>
            </details>
            <div style="margin:0.6em 0;">
                <label style="display:block; font-size:0.85em; color:#555; margin-bottom:0.2em;">Other account's server URL</label>
                <input type="text" id="prove-other-url" placeholder="https://kvstore.downes.ca"
                    style="width:100%; box-sizing:border-box; padding:0.35em 0.5em; font-size:0.9em; border:1px solid #ccc; border-radius:4px;">
            </div>
            <div style="margin:0.6em 0;">
                <label style="display:block; font-size:0.85em; color:#555; margin-bottom:0.2em;">Username on that server</label>
                <input type="text" id="prove-other-username" placeholder="username"
                    style="width:100%; box-sizing:border-box; padding:0.35em 0.5em; font-size:0.9em; border:1px solid #ccc; border-radius:4px;">
            </div>
            <div class="kv-action-buttons">
                <button class="kv-action-btn kv-save-btn" id="prove-identity-btn">Prove Same Identity</button>
            </div>
            <div id="prove-identity-result" class="me-status"></div>
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
                data = await decryptKVJson(encKey, kv.value);
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
                const meta = await decryptKVJson(encKey, catalogKv.value);
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

            if (localMode) {
                // No server to register a did:web document with -- the self-certifying did:key,
                // generated and stored entirely on-device, is the whole identity for this account.
                statusEl.innerHTML =
                    `<strong>Identity key generated.</strong><br>did:key: <code>${didKey}</code><br><span style="font-size:0.85em; color:#555;">Stored locally only — no public DID document, since this account has no server to publish one to.</span>`;
                setDidState(true);
                return;
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
            if (!localMode) {
                const res = await fetch(`${window.CList.config.flaskSiteUrl}/auth/did`, {
                    method: 'DELETE',
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                if (!res.ok) {
                    const data = await res.json();
                    throw new Error(data.error || `Server returned ${res.status}`);
                }
            }
            statusEl.textContent = localMode ? 'Identity key removed.' : 'No DID registered yet.';
            setDidState(false);
        } catch (err) {
            console.error('removeDid failed:', err);
            statusEl.textContent = `Could not remove DID: ${err.message}. Try logging out and back in.`;
        }
    }

    // mode: 'generate' (no key anywhere yet), 'publish' (key present locally, not registered
    // with this server), or 'regenerate' (already registered here -- clicking replaces it).
    function setDidButton(mode) {
        const btn = div.querySelector('#did-btn');
        if (mode === 'publish') {
            btn.textContent = 'Publish Existing Key';
            btn.onclick = () => publishExistingDid();
        } else if (mode === 'regenerate') {
            // Destructive -- replaces the existing key, breaking any "Prove Same Identity" link
            // to it -- so require a password confirmation before it runs.
            btn.textContent = 'Regenerate Key';
            btn.onclick = () => confirmWithPassword(
                'Regenerating your identity key will permanently replace your current DID. ' +
                'Anyone relying on your old key (e.g. "Prove Same Identity" links) will no longer ' +
                'be able to verify you. This cannot be undone.',
                () => generateAndRegisterDid()
            );
        } else {
            btn.textContent = 'Generate Identity Key';
            btn.onclick = () => generateAndRegisterDid();
        }
    }

    function setDidState(active, inactiveMode = 'generate') {
        // Public Accounts operates on a did:web document, which a Local account has no server to
        // publish -- always hidden there regardless of active state. Migrate can still carry a
        // Local account's did:key to a hosted destination, so it follows the same active-state
        // gating as hosted mode (only shown once an identity key exists).
        const toggleIds = localMode
            ? ['did-regen-help', 'did-remove-help', 'prove-identity-section', 'migrate-section']
            : ['public-accounts-section', 'did-regen-help', 'did-remove-help', 'migrate-section', 'prove-identity-section'];
        toggleIds.forEach(id => div.querySelector('#' + id).style.display = active ? '' : 'none');
        if (localMode) {
            div.querySelector('#public-accounts-section').style.display = 'none';
        }
        setDidButton(active ? 'regenerate' : inactiveMode);
        if (!active) div.querySelector('#did-remove-help').removeAttribute('open');
    }

    async function checkExistingDid() {
        const token = getSiteSpecificCookie(window.CList.config.flaskSiteUrl, window.CList.keys.ACCESS_TOKEN);
        window.CList.state.username = getSiteSpecificCookie(window.CList.config.flaskSiteUrl, window.CList.keys.USERNAME);
        if (!token || !window.CList.state.username) {
            div.querySelector('#did-status').textContent = 'Not logged in.';
            return;
        }

        if (localMode) {
            // No server, so no did:web document to check -- the identity key's mere presence
            // in local storage (encrypted, like any other KV entry) is the whole state.
            let kvRow;
            try {
                kvRow = await window.CList.storage.kv.get('_did_identity_key');
            } catch (err) {
                console.error('Checking for a locally-stored identity key failed:', err);
            }
            if (!kvRow) {
                div.querySelector('#did-status').textContent = 'No identity key yet.';
                setDidState(false, 'generate');
                return;
            }
            try {
                const encKey = await getEncKey(window.CList.config.flaskSiteUrl);
                const { didKey } = await derivePublicKeyJwkAndDidKey(kvRow.value, encKey);
                div.querySelector('#did-status').innerHTML =
                    `did:key: <code>${didKey}</code><br><span style="font-size:0.85em; color:#555;">Stored locally only — no public DID document, since this account has no server to publish one to.</span>`;
                setDidState(true);
            } catch (err) {
                console.error('Reading local identity key failed:', err);
                div.querySelector('#did-status').textContent = `Could not read your identity key: ${err.message}`;
            }
            return;
        }

        const res = await fetch(`${window.CList.config.flaskSiteUrl}/users/${window.CList.state.username}/did.json`);
        if (res.ok) {
            const doc = await res.json();
            const didUrl = `${window.CList.config.flaskSiteUrl}/users/${window.CList.state.username}/did.json`;
            div.querySelector('#did-status').innerHTML =
                `DID: <code>${doc.id}</code><br>also known as: <code>${doc.alsoKnownAs[0]}</code><br><a href="${didUrl}" target="_blank">View DID document</a>`;
            setDidState(true);
            return;
        }

        let hasLocalKey = false;
        try {
            hasLocalKey = !!(await window.CList.storage.kv.get('_did_identity_key'));
        } catch (err) {
            console.error('Checking for a locally-stored identity key failed:', err);
        }
        if (hasLocalKey) {
            div.querySelector('#did-status').textContent =
                'An identity key is already stored on this account (likely copied in via import) but not published on this server yet.';
            setDidState(false, 'publish');
        } else {
            div.querySelector('#did-status').textContent = 'No DID registered yet.';
            setDidState(false, 'generate');
        }
    }

    // Registers the DID using the identity key already stored locally (e.g. carried over by
    // account export/import) instead of generating a new one -- preserves the link to whatever
    // account that key originally came from.
    async function publishExistingDid() {
        const statusEl = div.querySelector('#did-status');
        try {
            const token  = getSiteSpecificCookie(window.CList.config.flaskSiteUrl, window.CList.keys.ACCESS_TOKEN);
            const encKey = await getEncKey(window.CList.config.flaskSiteUrl);
            if (!token || !encKey) {
                statusEl.textContent = 'Not logged in — please log in to your account server before publishing a DID.';
                return;
            }

            statusEl.textContent = 'Reading stored identity key…';
            const kvRow = await window.CList.storage.kv.get('_did_identity_key');
            if (!kvRow) {
                statusEl.textContent = 'No identity key found on this account to publish.';
                return;
            }
            const { publicKeyJwk, didKey } = await derivePublicKeyJwkAndDidKey(kvRow.value, encKey);

            statusEl.textContent = 'Registering DID…';
            const res = await fetch(`${window.CList.config.flaskSiteUrl}/auth/did`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                body: JSON.stringify({ publicKeyJwk, didKey, service: [], alsoKnownAs: [] })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(`DID registration failed (${data.error || res.status}). Check that you are logged in to the correct account server.`);

            statusEl.innerHTML = `<strong>DID published.</strong><br>did:key: <code>${data.didKey}</code>`;
            setDidState(true);
            loadAccounts();
            if (typeof refreshCollabRegistrations === 'function') {
                refreshCollabRegistrations().catch(() => {});
            }
        } catch (err) {
            console.error('publishExistingDid failed:', err);
            statusEl.textContent = err.message || 'An unexpected error occurred. See browser console for details.';
        }
    }

    // Signs a challenge with this account's identity private key and verifies it against another
    // account's publicly-published key (fetched fresh, no auth needed) -- proving the two accounts
    // share the same did:key without either account's private key ever leaving its own device.
    async function proveIdentity() {
        const resultEl = div.querySelector('#prove-identity-result');
        const otherUrl = div.querySelector('#prove-other-url').value.trim().replace(/\/$/, '');
        const otherUsername = div.querySelector('#prove-other-username').value.trim().toLowerCase();
        if (!otherUrl || !otherUsername) {
            resultEl.textContent = "Enter the other account's server URL and username.";
            return;
        }

        resultEl.textContent = "Fetching the other account's public key…";
        let otherDoc;
        try {
            const res = await fetch(`${otherUrl}/users/${otherUsername}/did.json`);
            if (!res.ok) throw new Error(`no DID found for ${otherUsername} at ${otherUrl} (${res.status})`);
            otherDoc = await res.json();
        } catch (err) {
            console.error('Fetching other DID document failed:', err);
            resultEl.textContent = `Could not fetch the other account's DID document: ${err.message}`;
            return;
        }
        const otherPublicKeyJwk = otherDoc.verificationMethod?.[0]?.publicKeyJwk;
        const otherDidKey = otherDoc.alsoKnownAs?.find(a => a.startsWith('did:key:'));
        if (!otherPublicKeyJwk) {
            resultEl.textContent = 'That account has no public key on file.';
            return;
        }

        const token  = getSiteSpecificCookie(window.CList.config.flaskSiteUrl, window.CList.keys.ACCESS_TOKEN);
        const encKey = await getEncKey(window.CList.config.flaskSiteUrl);
        if (!token || !encKey) {
            resultEl.textContent = 'Not logged in — please log in first.';
            return;
        }

        resultEl.textContent = 'Signing a challenge with your private key…';
        let privateKey;
        try {
            const kvRow = await window.CList.storage.kv.get('_did_identity_key');
            if (!kvRow) throw new Error('no identity key stored for this account');
            privateKey = await decryptIdentityPrivateKey(kvRow.value, encKey);
        } catch (err) {
            console.error('Could not load identity private key:', err);
            resultEl.textContent = `Could not load your identity key: ${err.message}`;
            return;
        }

        const challenge = `CList identity proof — ${new Date().toISOString()}`;
        let signature, verified;
        try {
            signature = await signWithIdentityKey(privateKey, challenge);
            verified  = await verifyIdentitySignature(otherPublicKeyJwk, challenge, signature);
        } catch (err) {
            console.error('Sign/verify failed:', err);
            resultEl.textContent = `Sign/verify failed: ${err.message}`;
            return;
        }

        const otherLabel = `${otherUsername}@${new URL(otherUrl).hostname}`;
        if (verified) {
            resultEl.innerHTML = `<strong>Proven.</strong> This account's key signed a challenge that verifies against ${otherLabel}'s published public key — same did:key, same identity.${otherDidKey ? `<br><code>${otherDidKey}</code>` : ''}`;
        } else {
            resultEl.innerHTML = `<strong>Not the same key.</strong> The signature did not verify against ${otherLabel}'s published public key.`;
        }
    }

    div.querySelector('#did-update-btn').onclick = () => updateDid();
    // Destructive -- deletes the identity key (and, for hosted accounts, the published DID
    // document) -- so require a password confirmation before it runs.
    div.querySelector('#did-remove-btn').onclick = () => confirmWithPassword(
        'This will permanently remove your identity key' +
        (localMode ? '.' : ' and delete your published DID document.') +
        ' This cannot be undone.',
        () => removeDid()
    );
    div.querySelector('#prove-identity-btn').onclick = () => proveIdentity();

    checkExistingDid();
    if (!localMode) loadAccounts();


    // ── Account migration ─────────────────────────────────────────────────────

    let _migrateCtx = null;

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

    async function putDidDocument(serverUrl, token, { publicKeyJwk, didKey, service, alsoKnownAs }) {
        await fetch(`${serverUrl}/auth/did`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
            body: JSON.stringify({ publicKeyJwk, didKey, service, alsoKnownAs })
        });
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
            progressEl.textContent = localMode ? 'Reading accounts from this device…' : 'Exporting accounts from source server…';
            // storage.kv.list() hits the same /get_kvs/-shaped interface for both backends
            // (kvstore-remote.js for a hosted source, local-kvstore.js for a Local source), so
            // this works unchanged regardless of where the source account lives.
            const kvs = await window.CList.storage.kv.list();

            let accountCount = 0;
            for (const kv of kvs.filter(k => !k.key.startsWith('_'))) {
                try { await decryptWithKey(oldEncKey, kv.value); accountCount++; } catch {}
            }

            // hasDid means "there's an identity private key to carry over" -- for a Local source
            // there's no did.json to check, but the key's presence in kvs (just fetched above) is
            // the whole state anyway, same as checkExistingDid()'s local branch.
            const hasDid = kvs.some(k => k.key === '_did_identity_key');

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

            // Check what's already on the destination account before we overwrite anything --
            // the per-key upload in migrateRun() is a blind PUT keyed by name, so any destination
            // entry that shares a key with the source (most notably '_did_identity_key', the one
            // fixed-name system key) would otherwise be silently clobbered with no way back.
            let destKvs = [];
            try {
                const destRes = await fetch(`${newUrl}/get_kvs/`, {
                    headers: { 'Authorization': 'Bearer ' + loginData.token }
                });
                if (destRes.ok) destKvs = await destRes.json();
            } catch { /* if this fails, treat as no conflicts -- migrateRun's own per-key PUTs will surface the real error */ }
            const destKeySet = new Set(destKvs.map(k => k.key));
            const conflictCount = kvs.filter(k => destKeySet.has(k.key)).length;
            const didConflict = hasDid && destKeySet.has('_did_identity_key');

            _migrateCtx = {
                oldUrl: window.CList.config.flaskSiteUrl, oldToken, oldEncKey, oldUsername,
                newUrl, newToken: loginData.token, newEncKey, newUsername,
                hasDid, kvs, accountCount, conflictCount, didConflict
            };

            const srcHost = localMode ? 'this device (Local)' : new URL(window.CList.config.flaskSiteUrl).hostname;
            const dstHost = new URL(newUrl).hostname;
            const didPreviewLine = hasDid
                ? (localMode
                    ? '<li>Your did:key identity will be registered on the destination server</li>'
                    : '<li>DID identity will be linked between old and new servers</li>')
                : '';
            const overwriteWarning = conflictCount > 0 ? `
                <div style="font-size:0.85em; color:#842029; background:#f8d7da; padding:0.5em 0.7em; border-radius:4px; margin:0.6em 0;">
                    <strong>Warning:</strong> The destination account already has ${conflictCount} entr${conflictCount !== 1 ? 'ies' : 'y'}
                    that will be permanently overwritten by this migration${didConflict ? ', including its existing DID identity' : ''}.
                    <label style="display:block; margin-top:0.4em; font-weight:normal;">
                        <input type="checkbox" id="migrate-overwrite-confirm" style="margin-right:0.4em;">
                        I understand this will overwrite existing data on the destination account.
                    </label>
                </div>` : '';
            div.querySelector('#migrate-preview').innerHTML = `
                <p><strong>Ready to migrate:</strong></p>
                <ul style="margin:0.4em 0 0.6em 1.2em; padding:0;">
                    <li>${accountCount} account${accountCount !== 1 ? 's' : ''} from <strong>${srcHost}</strong> (${kvs.filter(k => !k.key.startsWith('_')).length} total entries)</li>
                    <li>${kvs.filter(k => k.key.startsWith('_')).length} system key${kvs.filter(k => k.key.startsWith('_')).length !== 1 ? 's' : ''}${hasDid ? ' (including your DID private key)' : ''}</li>
                    ${didPreviewLine}
                </ul>
                <p><strong>Destination:</strong> ${dstHost} as <strong>${newUsername}</strong></p>
                ${overwriteWarning}
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
        const { oldUrl, oldToken, oldEncKey, oldUsername, newUrl, newToken, newEncKey, newUsername, hasDid, kvs, conflictCount } = _migrateCtx;

        if (conflictCount > 0) {
            const confirmEl = div.querySelector('#migrate-overwrite-confirm');
            if (!confirmEl || !confirmEl.checked) {
                const progressEl = div.querySelector('#migrate-progress');
                progressEl.style.display = 'block';
                progressEl.textContent = 'Please check the overwrite-confirmation box above before running the migration.';
                return;
            }
        }

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

            if (hasDid && localMode) {
                // No old server to fetch a did.json from or link back to -- derive the public
                // key/did:key straight from the _did_identity_key entry already in kvs (the
                // private key itself was already carried over by the loop above) and register
                // it fresh on the new server, same as publishExistingDid()'s hosted-side logic.
                progressEl.textContent = 'Registering identity on destination server…';
                try {
                    const kvRow = kvs.find(k => k.key === '_did_identity_key');
                    const { publicKeyJwk, didKey } = await derivePublicKeyJwkAndDidKey(kvRow.value, oldEncKey);
                    await putDidDocument(newUrl, newToken, { publicKeyJwk, didKey, service: [], alsoKnownAs: [] });
                } catch (err) {
                    console.warn('DID registration on destination failed:', err);
                    errors++;
                }
            } else if (hasDid) {
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

                            await putDidDocument(newUrl, newToken, { publicKeyJwk, didKey, service: services, alsoKnownAs: newAlsoKnownAs });

                            // alsoKnownAs for old server: include new server's did:web
                            const oldAlsoKnownAs = [...newAlsoKnownAs];
                            if (!oldAlsoKnownAs.includes(newDidWeb)) oldAlsoKnownAs.push(newDidWeb);

                            await putDidDocument(oldUrl, oldToken, { publicKeyJwk, didKey, service: services, alsoKnownAs: oldAlsoKnownAs });
                        }
                    }
                } catch (err) {
                    console.warn('DID linking failed:', err);
                    errors++;
                }
            }

            const srcHost = localMode ? 'this device (Local)' : new URL(oldUrl).hostname;
            const dstHost = new URL(newUrl).hostname;
            const didDoneLine = hasDid
                ? (localMode
                    ? `<p>Your did:key identity was registered on <strong>${dstHost}</strong>.</p>`
                    : `<p>DID identity linked between <strong>${srcHost}</strong> and <strong>${dstHost}</strong>.</p>`)
                : '';
            progressEl.innerHTML = `
                <p style="color:green; font-weight:bold;">Migration complete!</p>
                <p>${done} of ${kvs.length} entries migrated successfully.${errors > 0 ? ` <span style="color:#c44;">(${errors} error${errors !== 1 ? 's' : ''} — see browser console)</span>` : ''}</p>
                ${didDoneLine}
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
            <div class="nav-item">
                <h3>Migrate Account Data</h3>
                <p>Right now you are running CList from <strong id="options-current-location"></strong>.</p>
                <p>If you want to run CList from a new location you need to export your account data from here, and
                    import it there. Here's the process:</p>
                <ul style="margin:0 0 .5rem; padding-left:1.2em;">
                    <li style="font-size:0.8rem; color:#666;">in the old location, click "Export", enter your password, and save the file to your computer</li>
                    <li style="font-size:0.8rem; color:#666;">register with a username and password at the new location, and log in</li>
                    <li style="font-size:0.8rem; color:#666;">in the new location, click "Import", choose the file, then enter the password you used in the old location to unlock it</li>
                </ul>
                <button class="nav-btn" id="options-export-local-account">Export</button>
                <button class="nav-btn" id="options-import-local-account">Import</button>
                <input id="optionsImportLocalAccountInput" type="file" accept="application/json" style="display:none;">
            </div>
            <p style="margin-top:1em; font-size:0.85em;"><a href="about.html" target="_blank">About CList</a></p>
        </div>
    `;

    const backBtn = div.querySelector('#options-back-btn');
    const darkBtn = div.querySelector('#options-dark-mode-toggle');
    const webBtn  = div.querySelector('#options-webmention-toggle');
    const exportLocalBtn  = div.querySelector('#options-export-local-account');
    const importLocalBtn  = div.querySelector('#options-import-local-account');
    const importLocalInput = div.querySelector('#optionsImportLocalAccountInput');

    backBtn.onclick = () => history.back();
    div.querySelector('#options-current-location').textContent = window.location.host;
    exportLocalBtn.onclick = () => {
        if (!window.CList.state.username || window.CList.state.username === 'none') {
            showErrorModal('Log in first, then export.', { title: 'Not logged in' });
            return;
        }
        confirmWithPassword(
            'Enter your current password to encrypt the export file:',
            async (password) => {
                try {
                    await exportAccountData(password);
                    showStatusMessage('Account exported.');
                } catch (err) {
                    console.error('Account export failed:', err);
                    showErrorModal(err.message, { title: 'Export failed' });
                }
            },
            { confirmLabel: 'Export', confirmClass: 'kv-save-btn' }
        );
    };
    importLocalBtn.onclick = () => importLocalInput.click();
    importLocalInput.onchange = async () => {
        const file = importLocalInput.files && importLocalInput.files[0];
        importLocalInput.value = '';
        if (!file) return;
        const payload = await parseLocalAccountExportFile(file);
        if (!payload) return;
        confirmWithPassword(
            `Enter the password for "${escapeHtml(payload.username)}" (as it was in the old location) to unlock this export:`,
            async (password) => {
                try {
                    const { imported, skipped } = await unlockAndImportAccountData(payload, password);

                    window.CList.accounts = await getAccounts(window.CList.config.flaskSiteUrl);
                    updateUIVisibility();
                    if (typeof populatePostOptions === 'function') populatePostOptions(window.CList.accounts);
                    if (typeof populateReadAccountList === 'function') populateReadAccountList(window.CList.accounts);

                    const importedMsg = `Imported ${imported} item${imported === 1 ? '' : 's'}.`;
                    if (skipped.length > 0) {
                        showErrorModal(
                            `${importedMsg} Skipped ${skipped.length} item${skipped.length === 1 ? '' : 's'} that already existed on this account: ${skipped.join(', ')}`,
                            { title: 'Some items were not imported' }
                        );
                    } else {
                        showStatusMessage(importedMsg);
                    }
                } catch (err) {
                    console.error('Local account import failed:', err);
                    showErrorModal(err.message, { title: 'Import failed' });
                }
            },
            {
                verify: (password) => verifyExportPassword(payload, password),
                confirmLabel: 'Unlock & Import',
                confirmClass: 'kv-save-btn',
            }
        );
    };

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
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'display:flex; flex-direction:column; height:100%;';

    const headerRow = document.createElement('div');
    headerRow.className = 'modal-header-row';
    const headerTitle = document.createElement('h2');
    headerTitle.textContent = 'App Settings';
    const headerCloseBtn = document.createElement('button');
    headerCloseBtn.textContent = 'X';
    headerCloseBtn.onclick = closeAppSettingsModal;
    headerRow.appendChild(headerTitle);
    headerRow.appendChild(headerCloseBtn);

    const body = document.createElement('div');
    body.style.cssText = 'display:flex; flex:1; overflow:hidden;';

    const nav = document.createElement('div');
    nav.style.cssText = 'width:300px; flex-shrink:0; border-right:1px solid var(--border-light); overflow-y:auto; padding:16px 0; box-sizing:border-box;';
    nav.innerHTML = ADMIN_SETTINGS_APPS.map(a => `
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

    body.appendChild(nav);
    body.appendChild(detail);
    wrapper.appendChild(headerRow);
    wrapper.appendChild(body);

    showModal(wrapper, { wide: true, hideDefaultClose: true });
}

function closeAppSettingsModal() {
    document.getElementById('generic-modal')?.remove();
}

// Small popup listing what each settings field does, sourced from the
// backend schema's "help" text (see admin_settings.py's SettingField.help).
// Opened from the "Help" button inside the open App Settings modal, so it
// uses showStackedModal() (not showModal()) to layer on top without
// destroying the Settings modal underneath it.
function openAdminSettingsHelpModal(appLabel, schema) {
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'max-width:420px;';

    const headerRow = document.createElement('div');
    headerRow.className = 'modal-header-row';
    const headerTitle = document.createElement('h2');
    headerTitle.textContent = `${appLabel} — Field Help`;
    const headerCloseBtn = document.createElement('button');
    headerCloseBtn.textContent = 'X';
    headerCloseBtn.onclick = closeAdminSettingsHelpModal;
    headerRow.appendChild(headerTitle);
    headerRow.appendChild(headerCloseBtn);

    const body = document.createElement('div');
    body.innerHTML = schema.map(f => `
            <p style="margin-bottom:1em;">
                <strong>${escapeHtml(f.label)}</strong><br>
                <span style="font-size:0.9em;color:var(--text-main);opacity:0.75;">${escapeHtml(f.help || 'No additional detail available.')}</span>
            </p>`).join('');

    wrapper.appendChild(headerRow);
    wrapper.appendChild(body);

    showStackedModal(wrapper, { hideDefaultClose: true });
}

function closeAdminSettingsHelpModal() {
    closeStackedModal();
}

// Apps that have adopted the generic admin-settings backend pattern (the
// clist-server-admin pip package, pinned by commit SHA in each app's
// requirements.txt — see /srv/shared/clist-server-admin) and its GET/PUT
// /admin/settings routes. Add an app here once it's wired up.
//
// baseUrl for every app but KVStore comes from window.CList.defaults (see
// defaults.js) — the admin-configured starting point for this install.
// A logged-in user's own serviceUrl/instance value, stored in their own
// kvstore account data, always takes priority over these at point of use.
const ADMIN_SETTINGS_APPS = [
    {
        // baseUrl resolves to whichever kvstore instance this CList install is
        // actually pointed at (not a fixed domain like the other entries below) --
        // kvstore is the one app every CList install depends on, and it's the
        // selectable/multi-instance piece (see window.CList.keys.KVSTORE_URL).
        label: 'KVStore', baseUrl: window.CList.config.flaskSiteUrl,
        description: 'Credential storage and identity provider for CList — this kvstore instance.',
    },
    {
        label: 'Pastebin', baseUrl: window.CList.defaults.PASTEBIN,
        description: 'Stores arbitrary text content (JSON, OPML, HTML) at a short public URL — used by CList to publish collections and other structured content.',
    },
    {
        label: 'Survey', baseUrl: window.CList.defaults.SURVEY,
        description: 'Lets any kvstore user build simple surveys; anyone with the link can respond anonymously, no account needed.',
    },
    {
        label: 'LocalRSS Reader', baseUrl: window.CList.defaults.LOCALRSS,
        description: 'Server-side RSS/podcast reader with a scheduler that fetches feeds in the background.',
        // Unlike pastebin/survey, this app's auth gate also requires an
        // X-Kvstore-Url header naming the issuing kvstore instance (same
        // pattern localrss.js uses for its /fetch_feed calls).
        requiresKvstoreUrlHeader: true,
    },
    {
        label: 'Annotations', baseUrl: window.CList.defaults.ANNOTATIONS,
        description: 'W3C-style annotation server for CList — lets users attach public/private notes to any URL.',
    },
    {
        label: 'Collab', baseUrl: window.CList.defaults.COLLAB,
        description: 'Hocuspocus/Yjs real-time collaborative document editing server for CList.',
    },
    {
        label: 'Discussions', baseUrl: window.CList.defaults.DISCUSSIONS,
        description: 'Peer discovery / signaling service for CList P2P chat — stores ephemeral PeerJS peer IDs so users can find and join each other\'s discussions.',
    },
    {
        label: 'Proxyp', baseUrl: window.CList.defaults.PROXYP,
        description: 'Cross-domain HTTP relay — lets CList fetch external URLs ("Load from URL", Etherpad/OASIS bridges) without browser CORS restrictions.',
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
                const accountData = parseAccountValue(selectedAccount);
                if (!accountData) {
                    showErrorModal('This account\'s data could not be read.', { title: 'Corrupt Account' });
                    return;
                }
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
            if (url !== window.CList.config.flaskSiteUrl) {
                window.CList.state.publishing.selectedAccountKeys = [];
            }
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
                if (mode === 'register') {
                    try {
                        await seedPublicFeedAccounts();
                    } catch (error) {
                        console.error('Could not add public feed subscriptions:', error);
                        showErrorModal('Your account was created, but some public feed subscriptions could not be added: ' + error.message,
                            { title: 'Public feed subscriptions incomplete' });
                    }
                }
                window.CList.accounts = await getAccounts(window.CList.config.flaskSiteUrl);
                // Collab, Annotations, and CListBin are all external services that verify
                // the kvstore-issued token against a real, network-reachable kvstore — a Local account's
                // token has no such issuer, so seeding/registering these accounts would just produce
                // accounts that always fail. Skip them entirely in Local mode.
                if (!window.CList.isLocalMode || !window.CList.isLocalMode()) {
                    if (mode === 'register') autoRegisterCollab().catch(e => console.warn('Collab auto-registration failed:', e));
                    if (mode === 'register') autoRegisterAnnotations().catch(e => console.warn('Annotations auto-registration failed:', e));
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
                    <p style="margin:0.6em 0;">Your account is ready. Open Read to browse your subscribed feed collections, or open Accounts to manage subscriptions and connect more services.</p>
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

        // Function to handle logout — clears persistent auth state, then does a full
        // page reload so every pane (feed, write/editor) and all in-memory state
        // (account arrays, parked editor states, references, live Collab/LaTeX
        // connections, etc.) starts clean, rather than trying to manually unwind
        // each module's state one at a time. clist_logout_message survives the
        // reload (sessionStorage) so the bootstrap handler can show the usual
        // "logged out" notice once, then clears it.
        function KVlogout() {

            // Remove the token cookies and session encryption key
            const _logoutUser = getSiteSpecificCookie(window.CList.config.flaskSiteUrl, window.CList.keys.USERNAME);
            deleteSiteSpecificCookie(window.CList.config.flaskSiteUrl, window.CList.keys.ACCESS_TOKEN);
            deleteSiteSpecificCookie(window.CList.config.flaskSiteUrl, window.CList.keys.USERNAME);
            deleteSiteSpecificCookie(window.CList.config.flaskSiteUrl, window.CList.keys.TOKEN_EXPIRES);
            if (_logoutUser) sessionStorage.removeItem(`${window.CList.config.flaskSiteUrl}_${_logoutUser}_encKey`);
            sessionStorage.removeItem(window.CList.config.flaskSiteUrl + '_encKey'); // clean up any legacy key

            // Clear any editor drafts (saveDraft() in editors.js/tinymce.js) — these also live
            // in sessionStorage, so they'd otherwise survive the reload below and get offered
            // back via offerDraftRestore()'s "restore your last session?" prompt on next load.
            Object.keys(sessionStorage)
                .filter(k => k.startsWith('clist_draft_'))
                .forEach(k => sessionStorage.removeItem(k));

            sessionStorage.setItem('clist_logout_message', 'You have been logged out.');
            window.location.reload();
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

            const encKey = await getEncKey(window.CList.config.flaskSiteUrl);
            if (!encKey) {
                loginRequired('Encryption key not found. Please log in again.');
                return;
            }
            const accounts = await loadAccountRecords({
                storeUrl: window.CList.config.flaskSiteUrl, token, encKey,
            });
            const failedCount = accounts.filter(account => parseAccountValue(account)?.type === 'bad').length;
            if (failedCount > 0 && failedCount === accounts.length) {
                showErrorModal('Session key invalid - please log out and log back in to decrypt your accounts.', { title: 'Session key invalid' });
            }
            return accounts;
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
                        showErrorModal('Error fetching accounts: ' + error.message, { title: 'Account fetch failed' });
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
            const base = window.CList.defaults.COLLAB;
            const COLLAB_DEFAULT = base.replace(/^http/, 'ws');
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
            const annoUrl = window.CList.defaults.ANNOTATIONS;
            if (!annoUrl) return;
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

        async function autoSeedCListBin() {
            const CLISTBIN_DEFAULT = window.CList.defaults.PASTEBIN;
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
 * Re-checks a password against the current session without any server round trip: re-derives
 * encKey from the entered password and compares it to the encKey already stored in
 * sessionStorage from login (deriveEncKey is deterministic for a given password+username, and
 * the password itself never needs to leave the browser to confirm it). Used to gate destructive
 * actions (DID regenerate/remove) behind a password prompt even for Local accounts, which have
 * no server to check a password against.
 * @param {string} password
 * @returns {Promise<boolean>}
 */
async function verifyPassword(password) {
    const username = getSiteSpecificCookie(window.CList.config.flaskSiteUrl, window.CList.keys.USERNAME);
    if (!username) return false;
    const storedB64 = sessionStorage.getItem(`${window.CList.config.flaskSiteUrl}_${username}_encKey`);
    if (!storedB64) return false;
    const candidateKey = await deriveEncKey(password, username);
    const rawCandidate = await window.crypto.subtle.exportKey('raw', candidateKey);
    const candidateB64 = btoa(String.fromCharCode(...new Uint8Array(rawCandidate)));
    return candidateB64 === storedB64;
}

/**
 * Prompts for a password in a modal before running an action — the one password-prompt UI for
 * the whole app. Covers two shapes of caller:
 *  - gating a destructive action on the *current* session's password (DID regenerate/remove):
 *    defaults are enough, onConfirm's argument can be ignored.
 *  - needing the password *value* itself, verified against something other than the current
 *    session (export/import, where the password is key material and import's is for a different,
 *    not-currently-logged-in account) — pass opts.verify.
 * onConfirm only runs once verify() returns true; it receives the entered password either way.
 * @param {string} message - explains what's about to happen (inserted as HTML — caller must
 *   escapeHtml() any untrusted text first, e.g. a username from an imported file)
 * @param {(password: string) => void} onConfirm
 * @param {object} [opts]
 * @param {(password: string) => Promise<boolean>} [opts.verify] - defaults to verifyPassword()
 *   (checks against the current session's password)
 * @param {string} [opts.confirmLabel] - defaults to 'Confirm'
 * @param {string} [opts.confirmClass] - defaults to 'kv-delete-btn' (red, for destructive actions)
 */
function confirmWithPassword(message, onConfirm, opts = {}) {
    const { verify = verifyPassword, confirmLabel = 'Confirm', confirmClass = 'kv-delete-btn' } = opts;

    const box = document.createElement('div');
    box.innerHTML = `
        <h3 style="margin-top:0;">Confirm Password</h3>
        <p>${message}</p>
        <input type="password" id="confirm-pw-input" placeholder="Password" autocomplete="current-password"
            style="width:100%; box-sizing:border-box; padding:0.35em 0.5em; font-size:0.9em; border:1px solid #ccc; border-radius:4px;">
        <p id="confirm-pw-error" style="color:#c44; font-size:0.85em; min-height:1.2em; margin:0.3em 0 0;"></p>
        <div class="kv-action-buttons">
            <button class="kv-action-btn ${confirmClass}" id="confirm-pw-ok">${confirmLabel}</button>
            <button class="kv-action-btn kv-cancel-btn" id="confirm-pw-cancel">Cancel</button>
        </div>
    `;

    const input   = box.querySelector('#confirm-pw-input');
    const errEl   = box.querySelector('#confirm-pw-error');
    const okBtn   = box.querySelector('#confirm-pw-ok');
    const cancelBtn = box.querySelector('#confirm-pw-cancel');

    cancelBtn.onclick = () => document.getElementById('generic-modal')?.remove();

    const attemptConfirm = async () => {
        okBtn.disabled = true;
        const ok = await verify(input.value);
        if (!ok) {
            errEl.textContent = 'Incorrect password.';
            okBtn.disabled = false;
            input.focus();
            return;
        }
        const password = input.value;
        document.getElementById('generic-modal')?.remove();
        onConfirm(password);
    };
    okBtn.onclick = attemptConfirm;
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') attemptConfirm(); });

    showModal(box, { hideDefaultClose: true });
    input.focus();
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
