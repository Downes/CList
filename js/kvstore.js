//  kvstore.js  -  helper and utility functions for KVStore accounts management API
//  Part of CList, the next generation of learning and connecting with your community
//
//  Version version 0.1 created by Stephen Downes on January 27, 2025
//
//  Copyright National Research Council of Canada 2025
//  Licensed under Creative Commons Attribution 4.0 International https://creativecommons.org/licenses/by/4.0/
//
//  This software carries NO WARRANTY OF ANY KIND.
//  This software is provided "AS IS," and you, its user, assume all risks when using it.
//

window.accountSchemas = window.accountSchemas || {};
window.accountSchemas['Proxyp'] = {
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
//  flaskSiteUrl
//  accounts
//  accessCode
//  baseURL
// The function checks for these

document.addEventListener('DOMContentLoaded', function() {

    // Perform checks for varuiable definitions in HTML file
    if (typeof username === 'undefined') {
        throw new Error('Error: Username is not defined.');
    }

    if (typeof flaskSiteUrl === 'undefined' || !flaskSiteUrl) {
        throw new Error('Error: Flask Site URL is not defined or has no value.');
    }

    if (!Array.isArray(accounts)) {
        throw new Error('Error: Accounts is not an array.');
    }

    if (typeof accessCode === 'undefined') {
        throw new Error('Error: accessCode is not defined.');
    }

    if (typeof baseURL === 'undefined') {
        throw new Error('Error: Username is not defined.');
    }



    const identityDiv = document.getElementById("identityDiv");
    const loginButton = document.getElementById("loginButton");
    const logoutButton = document.getElementById("logoutButton");
    const accountButton = document.getElementById("accountButton");

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
    const _token = getSiteSpecificCookie(flaskSiteUrl, 'access_token');
    if (!_token) {
        loginRequired("No login cookie found.");
    } else if (isTokenExpired(_token)) {
        loginRequired("Token expired.");
    } else if (!sessionStorage.getItem(flaskSiteUrl + '_encKey')) {
        loginRequired("Session key cleared. Please log in again.");
    } else {
        loginNotRequired();
    }


    if (!username || username === "none") {
        loginRequired("No username found.");
    }

    displayUsername();


});




// Login is required
function loginRequired(msg) {
    openLeftPane();
    loginButton.style.display="inline-block";
    const registerButton = document.getElementById("registerButton");
    if (registerButton) registerButton.style.display="inline-block";
    accountButton.style.display="none";
    logoutButton.style.display="none";
    identityDiv.innerHTML = `${msg} Please login to Identity Server`;
}

// Login not required
function loginNotRequired() {
    accountButton.style.display="block";
    logoutButton.style.display="block";
    loginButton.style.display="none";
    const registerButton = document.getElementById("registerButton");
    if (registerButton) registerButton.style.display="none";
    username = getSiteSpecificCookie(flaskSiteUrl, 'username');
    identityDiv.innerHTML = `Identity: ${username}`;
}


// Opens 'Manage Accounts' window in left column interface
function playAccounts() {
    openLeftInterface(kvstoreAccountsPanel());
}

// Returns the Manage Accounts panel element (created on demand)
function kvstoreAccountsPanel() {
    const div = document.createElement('div');
    div.innerHTML = `
        <iframe src="flasker.html" style="width:100%; height:600px; border:none;"></iframe>
    `;
    return div;
}

function playMe() {
    openLeftInterface(kvstoreMePanel());
}

// Returns the Me panel element (DID management and public identity settings)
function kvstoreMePanel() {
    const div = document.createElement('div');
    div.innerHTML = `
        <iframe src="me.html" style="width:100%; height:600px; border:none;"></iframe>
    `;
    return div;
}

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
                baseUrl = '';
                instanceType = '';
                return;
            }

            // Find the selected account
            const selectedAccount = accounts.find(account => account.key === selectedKey);
            if (selectedAccount) {
           
                // Parse the JSON string in the value field
                const accountData = JSON.parse(selectedAccount.value);
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

        function openAuthModal(mode) {
            document.getElementById('authModalTitle').textContent = mode === 'login' ? 'Login' : 'Register';
            document.getElementById('authSubmitBtn').textContent  = mode === 'login' ? 'Login' : 'Register';
            document.getElementById('authSubmitBtn').disabled = false;
            document.getElementById('authConfirmWrap').style.display = mode === 'register' ? 'block' : 'none';
            document.getElementById('authUsername').value  = '';
            document.getElementById('authPassword').value  = '';
            document.getElementById('authConfirm').value   = '';
            document.getElementById('authError').style.display = 'none';
            const modal = document.getElementById('authModal');
            modal.dataset.mode = mode;
            modal.style.display = 'flex';
            document.getElementById('authUsername').focus();
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
                accounts = await getAccounts(flaskSiteUrl);
                if (accounts) {
                    await playRead();
                    populateReadAccountList(accounts);
                }
            } catch (e) {
                errDiv.textContent = (mode === 'register' ? 'Registration' : 'Login') + ' failed: ' + e.message;
                errDiv.style.display = 'block';
                document.getElementById('authSubmitBtn').disabled = false;
                document.getElementById('authSubmitBtn').textContent = mode === 'login' ? 'Login' : 'Register';
            }
        }

        // Function to handle logout
        function KVlogout(flaskSiteUrl) {

            // Remove the token cookies and session encryption key
            deleteSiteSpecificCookie(flaskSiteUrl,'access_token');
            deleteSiteSpecificCookie(flaskSiteUrl,'username');
            deleteSiteSpecificCookie(flaskSiteUrl,'token_expires');
            sessionStorage.removeItem(flaskSiteUrl + '_encKey');


            // Clear the account list
            const element = document.getElementById('read-account-list');
            if (element) element.style.display = 'none';
            if (element) element.value='';
            accounts.splice(0, accounts.length);    // Clear the accounts array

            username = '';  // Clear the username
            // Clear the baseURL and accessToken input fields and selected option in the dropdown
            document.getElementById('baseURL').value = '';
            document.getElementById('accessToken').value = '';


            // Reset left content
            document.querySelectorAll('#left-content > div').forEach(div => div.style.display = 'none');

            // Display logout message
           //alert('You have been logged out.');

            loginRequired("You have been logged out.");

            // Optionally redirect to the home page or keep the user on the same page
            // window.location.href = '/';
        };



        function displayUsername() {
            username = localStorage.getItem('username');
            const usernameDisplay = document.getElementById('username-display');
            if (usernameDisplay) {
                usernameDisplay.textContent = username ? `Logged in as ${username}!` : 'Welcome, guest!';
            }

        }




        function isTokenExpired(token) {
            // Token is now an opaque string, not a JWT — check the stored expiry cookie.
            if (!token) return true;
            const expires = getSiteSpecificCookie(flaskSiteUrl, 'token_expires');
            if (!expires) return true;
            const expired = new Date(expires) < new Date();
            if (expired) console.log("access token expired");
            return expired;
        }

        async function getAccounts(flaskSiteUrl, retryCount = 3, retryDelay = 500) {

            // Set up debugging for this crucial function
            const stack = new Error().stack;
            const callerFunction = stack.split("\n")[2]?.trim(); // Get the caller function name
        
            console.log(`getAccounts() called using ${flaskSiteUrl}`);
            console.log(`Called by: ${callerFunction}`);

            let username = getSiteSpecificCookie(flaskSiteUrl, 'username');
            let token = getSiteSpecificCookie(flaskSiteUrl, 'access_token');

                // Retry logic: If username is not set, wait and retry
            let attempt = 0;
            while ((!username || username === "none" || !token) && attempt < retryCount) {
                console.warn(`No username found in cookies. Retrying in ${retryDelay}ms... (${attempt + 1}/${retryCount})`);
                await new Promise(resolve => setTimeout(resolve, retryDelay));
                username = getSiteSpecificCookie(flaskSiteUrl, 'username');
                token = getSiteSpecificCookie(flaskSiteUrl, 'access_token');
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

            console.log('Tring using access token ' + token);
            try {
                const response = await fetch(`${flaskSiteUrl}/get_kvs/`, {
                    method: 'GET',
                    headers: {
                        'Authorization': 'Bearer ' + token
                    }
                });
        
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
        
                const data = await response.json();

                // Load encKey from sessionStorage once, before decrypting all values
                const encKey = await getEncKey(flaskSiteUrl);
                if (!encKey) {
                    loginRequired('Encryption key not found. Please log in again.');
                    return;
                }

                const accounts = await Promise.all(
                    data
                        .filter(kv => !kv.key.startsWith('_'))  // exclude system keys
                        .map(async kv => {

                    try {
                        // ===========================
                        //   DECRYPT LOCALLY
                        // ===========================
                        const decryptedString = await decryptWithKey(encKey, kv.value);

                        const accountData = JSON.parse(decryptedString);
                        return {
                            key: kv.key,
                            value: JSON.stringify({
                                instance: kv.key,
                                id: accountData.id || '',
                                permissions: accountData.permissions || '',
                                type: accountData.type || '',
                                title: accountData.title || '',
                                public: accountData.public || false
                            })
                        };
                    } catch (error) {
                        console.error(`Error parsing kv.value for key: ${kv.key}`, error);
                        return {
                            key: kv.key,
                            value: JSON.stringify({
                                instance: kv.key,
                                id: 'bad',
                                permissions: 'bad',
                                type: 'bad',
                                title: 'bad',
                                public: false
                            })
                        };
                    }
                }));
        
                console.log('Accounts in getAccounts():', accounts);
                return accounts; // Return the accounts array
            } catch (error) {
                //alert('Error fetching key-value pairs: ' + error);
                throw error; // Re-throw the error for the caller to handle
            }
        }
         

         


        // Event listener for changes in localStorage
        // This happens when redirect.html sets the username in localStorage
        // which only happens after a successful login

        window.addEventListener('storage', (event) => {
            if (event.key === 'kvstore') {
                console.log('Detected change in kvstore:', event.newValue);
                console.log('Getting accounts from KVStore...' + flaskSiteUrl);
                             
                // Introduce a small delay to allow cookies to be set before calling getAccounts
                setTimeout(async () => {
                    try {
                        console.log('Delaying getAccounts() call to ensure cookies are set...');
                        accounts = await getAccounts(flaskSiteUrl);
                        console.log('Accounts:', accounts);
                        await playRead();
                        console.log('PlayRead() run');
                        populateReadAccountList(accounts);
                        
                        updateIdentityDiv(); // Update the div when kvstore changes
                        acceptLogin();
                    } catch (error) {
                        console.error('Error fetching accounts:', error);
                        showStatusMessage('Error fetching accounts: ' + error.message);
                    }
                }, 500); // Adjust delay time if needed (500ms should be sufficient)

            }
        });

        // Function to fetch cookies and update the div
        function updateIdentityDiv() {
            username = getSiteSpecificCookie(flaskSiteUrl, 'username');
            if (username) {
                identityDiv.innerHTML = `Identity: ${username}`;
            } else {
                console.warn('No login data found in cookies.');
            }
        }

        // Function to fetch cookies and update the div
        function acceptLogin() {
            username = getSiteSpecificCookie(flaskSiteUrl, 'username');
            const access_token = getSiteSpecificCookie(flaskSiteUrl, 'access_token');
            if (username && access_token) {
               loginButton.style.display="none";
               const registerButton = document.getElementById("registerButton");
               if (registerButton) registerButton.style.display="none";
               logoutButton.style.display="block";
               accountButton.style.display="block";
            }
        }


// =============================================================================
//  NEW AUTH FUNCTIONS (v0.2 — PBKDF2 zero-knowledge login)
// =============================================================================

/**
 * Retrieve the session encryption key from sessionStorage.
 * Returns null if the user has not logged in this tab session.
 * @param {string} siteUrl - flaskSiteUrl, used as namespace
 * @returns {Promise<CryptoKey|null>}
 */
async function getEncKey(siteUrl) {
    const b64 = sessionStorage.getItem(siteUrl + '_encKey');
    if (!b64) return null;
    const raw = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    return window.crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
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

    const response = await fetch(`${flaskSiteUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: uname, auth_hash: authHash })
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `Login failed (${response.status})`);
    }

    const data = await response.json();

    // Store token and expiry in persistent cookies (365-day lifetime matches server)
    setSiteSpecificCookie(flaskSiteUrl, 'access_token', data.token, 365);
    setSiteSpecificCookie(flaskSiteUrl, 'username', data.username, 365);
    setSiteSpecificCookie(flaskSiteUrl, 'token_expires', data.expires, 365);

    // Export encKey to raw bytes and store in sessionStorage (cleared when tab closes)
    const rawKey = await window.crypto.subtle.exportKey('raw', encKey);
    const keyB64 = btoa(String.fromCharCode(...new Uint8Array(rawKey)));
    sessionStorage.setItem(flaskSiteUrl + '_encKey', keyB64);

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

    const response = await fetch(`${flaskSiteUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: uname.toLowerCase(), auth_hash: authHash })
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `Registration failed (${response.status})`);
    }
}
