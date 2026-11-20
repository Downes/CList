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


    sessionLifecycle().restore().catch(error=>{console.error('Could not restore session controls:',error);showStatusMessage('Could not restore session controls. Please reopen Login.');});


});

// ── Auth-state helpers ────────────────────────────────────────────────────────

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
    if (typeof invalidateReader === 'function') invalidateReader();
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
    if (typeof invalidateReader === 'function') invalidateReader();
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

// Following list/controller: following.js; view/workflow are separate modules.

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
            <p>Checked accounts are listed in your public DID document and discoverable by others. Click 'Update DID' to register your list in your DID document. Other existing public links are retained.</p>
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
                    <button class="btn-small" id="migrate-prepare-btn">Preview Migration</button>
                </div>
            </div>

            <div id="migrate-step-2" style="display:none;">
                <div id="migrate-preview" style="font-size:0.9em;"></div>
                <div class="kv-action-buttons">
                    <button class="btn-small" id="migrate-run-btn">Run Migration</button>
                    <button class="btn-small btn-secondary" id="migrate-cancel-btn">Cancel</button>
                </div>
            </div>

            <div id="migrate-progress" class="me-status" style="display:none;"></div>
        </div>
    `;

    div.querySelector('#did-back-btn').onclick = () => history.back();

    const identityRead=createDidIdentityRead(div,{onState:setDidState});
    const accountUpdater=createDidAccountUpdater(div,identityRead);
    const existingPublisher=createDidExistingPublisher(div,{onStart:()=>identityRead.cancelIdentity(),onPublished:()=>setDidState(true),refreshAccounts:()=>loadAccounts()});
    const firstGenerator=createDidFirstGenerator(div,{onStart:()=>identityRead.cancelIdentity(),onStored:local=>setDidState(local,'publish'),publishStored:expected=>existingPublisher.publish(expected),refreshIdentity:()=>identityRead.identity()});
    const keyRotator=createDidKeyRotator(div,{onStart:()=>{identityRead.cancelIdentity();identityProof.invalidate();},onComplete:()=>setDidState(true),refreshAccounts:()=>loadAccounts(),refreshIdentity:()=>identityRead.identity()});
    const didRemover=createDidRemover(div,{onStart:()=>{identityRead.cancelIdentity();identityProof.invalidate();},onComplete:()=>{openLeftInterface(kvstoreDidPanel());showStatusMessage('Identity removal completed.');},refreshIdentity:()=>openLeftInterface(kvstoreDidPanel())});
    function loadAccounts(){return identityRead.accounts();}

    // mode: 'generate' (no key anywhere yet), 'publish' (key present locally, not registered
    // with this server), or 'regenerate' (already registered here -- clicking replaces it).
    function setDidButton(mode) {
        const btn = div.querySelector('#did-btn');
        if (mode === 'publish') {
            btn.textContent = 'Publish Existing Key';
            btn.onclick = () => publishExistingDid();
        } else if (mode === 'regenerate') {
            btn.textContent = 'Regenerate Key';
            btn.onclick = keyRotator.action();
        } else {
            btn.textContent = 'Generate Identity Key';
            btn.onclick = () => firstGenerator.generate();
        }
    }

    function setDidState(active, inactiveMode = 'generate') {
        window.CList.ui.didIdentity.sections(div,active,localMode);
        setDidButton(active ? 'regenerate' : inactiveMode);
    }

    function publishExistingDid(){return existingPublisher.publish();}

    // Signs a challenge with this account's identity private key and verifies it against another
    // account's publicly-published key (fetched fresh, no auth needed) -- proving the two accounts
    // share the same did:key without either account's private key ever leaving its own device.
    div.querySelector('#did-update-btn').onclick = () => accountUpdater.update();
    div.querySelector('#did-remove-btn').onclick = () => didRemover.request();
    const identityProof=bindDidIdentityProof(div);

    identityRead.start();


    const migrationPreparation = createMigrationPreparation(div);
    createMigrationExecution(div, migrationPreparation);

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
            { confirmLabel: 'Export', confirmClass: 'kv-save-btn', isCurrent:()=>div.isConnected }
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
                isCurrent:()=>div.isConnected,
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

        async function submitAuthModal(retryRegistration = false) {
            const panel = authPanelController(), attempt = panel.begin(retryRegistration);
            if (!attempt) return;
            try {
                await authenticateAuthAttempt(attempt, panel, retryRegistration);
                if (!panel.owns(attempt)) return;
                panel.authenticated(attempt);
                updateIdentityDiv();
                acceptLogin();
                await finishAuthSetup(attempt, panel);
            } catch (e) {
                console.error('Authentication flow failed:', e);
                panel.failed(attempt, e);
            } finally {
                panel.settled(attempt);
            }
        }

        function displayUsername() {
            const usernameDisplay = document.getElementById('username-display');
            if (usernameDisplay) {
                usernameDisplay.textContent = (window.CList.state.username && window.CList.state.username !== 'none') ? `Logged in as ${window.CList.state.username}!` : 'Welcome, guest!';
            }
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

        // Re-register on all saved Collab servers to push an updated DID.
        // Called from me.html after DID generation via window.parent.refreshCollabRegistrations().
        window.refreshCollabRegistrations = async function() {
            const token = getSiteSpecificCookie(window.CList.config.flaskSiteUrl, window.CList.keys.ACCESS_TOKEN);
            if (!token) return;
            const collabAccounts = (window.CList.accounts || []).filter(a => {
                const v = parseAccountValue(a);
                return v && v.type === 'Collab';
            });
            const results=await Promise.all(collabAccounts.map(async a => {
                const v = parseAccountValue(a);
                const base = v.instance.replace(/^wss?:\/\//, 'https://').replace(/\/$/, '');
                try {
                    const resp = await fetch(`${base}/api/register`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
                    });
                    if (!resp.ok) { console.warn(`Collab DID refresh failed for ${base}: ${resp.status}`); return base; }
                    return null;
                } catch (e) {
                    console.warn(`Collab DID refresh error for ${base}:`, e);
                    return base;
                }
            }));
            return results.filter(Boolean);
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

// Shared password confirmation and compatibility verification: password-confirmation*.js.

// Captured credential verification/registration/session installation: auth-credentials*.js and auth-session-workflow.js.
