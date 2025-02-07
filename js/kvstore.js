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


    // Check for identity server access token to determine whether a login is required
    if (!getSiteSpecificCookie(flaskSiteUrl,'access_token')) { 
        loginRequired("No login cookie found."); }   
    else if (isTokenExpired(getSiteSpecificCookie(flaskSiteUrl,'access_token'))) { 
        //alert('token expired');
        loginRequired("Token expired.");
    }
    else { loginNotRequired();  }


    if (!username || username === "none") {
        loginRequired("No username found.");
    }

    displayUsername();


});




// Login is required
function loginRequired(msg) {
    toggleFormDisplay('loginButton','left',true);
    accountButton.style.display="none";
    logoutButton.style.display="none";
    //accountDiv.style.display="none";
    identityDiv.innerHTML = `${msg} Please login to Identity Server`;
}

// Login not required
function loginNotRequired() {
    accountButton.style.display="block";
    logoutButton.style.display="block";
    loginButton.style.display="none";
    username = getSiteSpecificCookie(flaskSiteUrl, 'username');
    identityDiv.innerHTML = `Identity: ${username}`;
}


// Opens 'Manage Accounts' window in left column interface
function playAccounts() {
    openLeftPane();
    const leftContent = document.getElementById('left-content');
    let accountsDiv = document.getElementById('accounts-section');
    accountsDiv.style.display = 'block'; // Make the reader visible
    leftContent.prepend(accountsDiv); // Move the div to the top
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

        function redirectToKVLogin() {
            // Get the current URL path (e.g., "/static/index.html" or "/CList/index.html")
            const currentPath = window.location.pathname;
        
            // Extract the directory of the current file (e.g., "/static/" or "/CList/")
            const subdirectory = currentPath.substring(0, currentPath.lastIndexOf('/') + 1);
        
            // Construct the redirect URL dynamically
            const currentDomain = window.location.origin; // Includes protocol (http/https) and domain
            const redirectPath = `${subdirectory}redirect.html`; // Dynamically determine the path to redirect.html
            const redirectUrl = `${currentDomain}${redirectPath}`;
        
            // Construct the login URL
            const loginUrl = `${flaskSiteUrl}/auth/login?next=${encodeURIComponent(redirectUrl)}`;
        
            // Open the login page in a new tab
            window.open(loginUrl, '_blank');
        }
        
        



        // Function to handle logout
        function KVlogout(flaskSiteUrl) {

            // Remove the token (cookie) for the specific Flask site
            deleteSiteSpecificCookie(flaskSiteUrl,'access_token');
            deleteSiteSpecificCookie(flaskSiteUrl,'username');


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
            if (!token) return 1;
            const payload = JSON.parse(atob(token.split('.')[1]));
            if (payload.exp < Date.now() / 1000) { console.log("access token expired"); }
            return payload.exp < Date.now() / 1000;
        }

        async function getAccounts(flaskSiteUrl, retryCount = 3, retryDelay = 500) {

            // Set up debugging for this crucial function
            const stack = new Error().stack;
            const callerFunction = stack.split("\n")[2]?.trim(); // Get the caller function name
        
            console.log(`getAccounts() called using ${flaskSiteUrl}`);
            console.log(`Called by: ${callerFunction}`);

            let username = getSiteSpecificCookie(flaskSiteUrl, 'username');
            let token = getSiteSpecificCookie(flaskSiteUrl, 'access_token');
            const passphrase = getSiteSpecificCookie(flaskSiteUrl, 'passphrase');

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
                const accounts = await Promise.all(data.map(async kv => {

                    try {
                        // ===========================
                        //   DECRYPT LOCALLY
                        // ===========================
                        const passphrase = getSiteSpecificCookie(flaskSiteUrl, 'passphrase');
                        const decryptedString = await decryptData(passphrase, kv.value);

                        const accountData = JSON.parse(decryptedString);
                        return {
                            key: kv.key,
                            value: JSON.stringify({
                                instance: kv.key,
                                id: accountData.id || '',
                                permissions: accountData.permissions || '',
                                type: accountData.type || '',
                                title: accountData.title || ''
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
                                title: 'bad'
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
                        alert('Error fetching accounts: ' + error);
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
               logoutButton.style.display="block";
               accountButton.style.display="block";
               //accountDiv.style.display="block";
                

            } 
        }
 