//  publish.js  -  Functions to publish content to various platforms
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
// 

async function playPost() {

    if (!Array.isArray(accounts)) {
        throw new Error('Error: Accounts array not found; maybe you need to log in.');
    }

    // If neceeary, fetch the accounts from the KVstore
    if (accounts.length === 0) {
        try {
            // Fetch the accounts from the KVstore
            accounts = await getAccounts(flaskSiteUrl); 

        } catch (error) {
            alert('Error getting Editor accounts: ' + error.message);
        }
    }

    populatePostOptions(accounts); // Populate UI with options to save
    toggleDiv('post-instructions','right',true);

}

async function playSave() {

    if (!Array.isArray(accounts)) {
        throw new Error('Error: Accounts array not found; maybe you need to log in.');
    }

    // If neceeary, fetch the accounts from the KVstore
    if (accounts.length === 0) {
        try {
            // Fetch the accounts from the KVstore
            accounts = await getAccounts(flaskSiteUrl); 

        } catch (error) {
            alert('Error getting Editor accounts: ' + error.message);
        }
    }

    populateSaveOptions(accounts); // Populate UI with options to save
    toggleDiv('save-instructions','right',true);

}


// Function to populate the save panel with account options
function populatePostOptions(accounts) {
    
    const postOptionsDiv = document.getElementById('post-options');
    postOptionsDiv.innerHTML = '';                         // Clear previous options

    // Add the account buttons
    const postButtonsDiv = makePostButtons(accounts);
    if (postButtonsDiv instanceof HTMLElement) { postOptionsDiv.appendChild(postButtonsDiv); }
    else {console.error("Error: makePostButtons() did not return a valid DOM element."); }

    // Add the save button (to save to all selected accounts)
    const finalPostOption = document.createElement('button'); // Create a button
    finalPostOption.textContent = 'Publish';  // Set label for visibility
    finalPostOption.id = 'final-post-button';  // 
    postOptionsDiv.appendChild(finalPostOption);  // Append the option if condition is met

    // Add an event listener to the final save button
    finalPostOption.onclick = async function() {
        await postAll();
    };
}

function populateSaveOptions(accounts) {

    const saveOptionsDiv = document.getElementById('save-options');
    saveOptionsDiv.innerHTML = '';                         // Clear previous options

    // Add the account buttons
    const saveButtons = document.createElement('div'); // Create a button
    saveButtons.id = "save-buttons";

    saveButtons.innerHTML = `<button class="save-button" onclick="saveContent();">Save as local</button>
     <p id="fallbackMessage" style="display: none;"><!-- Called by files.js -->
        The File System Access API is not supported in this browser. A file download will be used instead.
     </p>`;

     accounts.forEach(account => {                           // Load the options stored in the KVstore
       
        const parsedValue = JSON.parse(account.value);
        if (parsedValue.permissions.includes('s')) {  // Check if 'permissions' contains 's'

            const saveOption = document.createElement('button'); // Create a buttonn
            saveOption.classList.add('save-button');  // Add a class for consistent styling
            saveButtons.appendChild(saveOption);  // Append the option if condition is met
        }
     });

    
     if (saveButtons instanceof HTMLElement) { saveOptionsDiv.appendChild(saveButtons); }


}

// Populate Save Option Buttons with Account Info
function makePostButtons(accounts) {

    const postButtons = document.createElement('div'); // Create a button
    postButtons.id = "post-buttons";

    accounts.forEach(account => {                           // Load the options stored in the KVstore
       
        const parsedValue = JSON.parse(account.value);

        if (parsedValue.permissions.includes('w')) {  // Check if 'permissions' contains 'w'
 
            const postOption = document.createElement('button'); // Create a buttonn
            postOption.classList.add('save-button');                // Generic account button class
            // Set the account key of the button
            postOption.setAttribute('data-key', account.key);

            // Set initial state (not selected)
            postOption.setAttribute('data-selected', 'false');

            // Set the character limit
            const parts = parsedValue.permissions.split(' '); // Split on space
            const charLimit = (parts.length > 1 && !isNaN(parseInt(parts[1], 10)))
                ? parseInt(parts[1], 10)
                : 1000000; // Default to 1,000,000 if not defined
            postOption.setAttribute('data-charlimit', charLimit);
            
            // Give the Button a title
            if (parsedValue.title) {  postOption.textContent = `${parsedValue.title}`;    }
            else { postOption.textContent = `${account.key}`; }

            // Set the action to toggle the selected state
            postOption.onclick = function() {
                const isSelected = postOption.getAttribute('data-selected') === 'true';
                if (isSelected) {
                    // If currently selected, deselect it
                    postOption.setAttribute('data-selected', 'false');
                    postOption.classList.remove('selected');  // Remove selected class (change color back)
                } else {
                    // If not selected, select it
                    postOption.setAttribute('data-selected', 'true');
                    postOption.classList.add('selected');  // Add selected class (change color)
                }
            };
           

            postOption.classList.add('post-button');  // Add a class for consistent styling
            postOption.classList.add('post-account');  // Identify this button as a save account button
            postButtons.appendChild(postOption);  // Append the option if condition is met
        }
    });

    return postButtons;

}


async function postAll() {

    let post = await packagePost(); 
    const buttons = document.querySelectorAll('.post-account');
    //const writeColumnContent = document.getElementById('write-column').value.trim();
    const writeColumnTitle = document.getElementById('write-title').innerText.trim();
    const selectedAccounts = [];


    // Collect selected accounts
    buttons.forEach(button => {
        if (button.getAttribute('data-selected') === 'true') {
            const charLimit = parseInt(button.getAttribute('data-charlimit'), 10) || 1000000; // Default if undefined
            selectedAccounts.push({
                key: button.getAttribute('data-key'),
                charLimit: charLimit
            });
        }
    });
console.log(selectedAccounts);
    // Sort accounts by character limit (highest first)
    selectedAccounts.sort((a, b) => b.charLimit - a.charLimit);
    accounts = await getAccounts(flaskSiteUrl);
    // Process each account sequentially
    let publishedURL = null;
    let status = null;
    for (const selected of selectedAccounts) {
console.log(accounts);
        const account = accounts.find(acc => acc.key === selected.key);
        if (!account) continue;

        const accountData = JSON.parse(account.value);
        const instanceURL = extractBaseUrl(accountData.instance);
        const accountName = extractAccountName(accountData.instance);
        const charLimit = selected.charLimit;

        //let remainingContent = writeColumnContent; // Start with full content
        // alert(publishedURL);

        console.log(`Processing ${accountData.type} account with char limit ${charLimit}`);

        // Process content based on account type
        // alert("Post length is "+post.length);
        if (post.length <= charLimit) {
            if (post.length <= 1000) {  // status, or
                status = packageStatus(charLimit, post);
                publishedURL = await postContentByType(accountData, writeColumnTitle, status);
            } else {                   // post
                publishedURL = await postContentByType(accountData, writeColumnTitle, post);
            }
        } else {
            if (publishedURL) { // If we've published it somewhere, post the title and link
                status = packageStatus(charLimit, writeColumnTitle,publishedURL);
                publishedURL = await postContentByType(accountData, writeColumnTitle, status);
            } else {  // Otherwise, just post the status
                status = packageStatus(charLimit, post);
                publishedURL = await postContentByType(accountData, writeColumnTitle, status);
            }
        }

        // Timeout check (30 seconds)
        if (!publishedURL) {
            await new Promise(resolve => setTimeout(resolve, 30000)); // Wait 30 seconds
        }

    }
};

// Helper function to save content by account type
async function postContentByType(accountData, title, content) {
    const responseDiv = document.getElementById('post-result');
    let publishedURL = null;

    if (accountData.type === "Mastodon") { 
        content = removeHtml(content);
        await postMastodonStatus(accountData.id, extractBaseUrl(accountData.instance), responseDiv, content);

    } else if (accountData.type === "WordPress") {
        title = removeHtml(title);
        publishedURL = await publishPost(extractBaseUrl(accountData.instance), extractAccountName(accountData.instance), accountData.id, title, content);

    } else if (accountData.type === "Bluesky") {
        await submitBlueskyPost(content,'saveResult',replyContentId = null,parentUri = null, parentCid = null, rootUri = null, rootCid = null);

    } else if (accountData.type === "Blogger") {
        title = removeHtml(title);
        publishedURL = await publishBloggerPost(accountData.instance, accountData.id, responseDiv, title, content);

    } else {
        alert("Account type not recognized: " + accountData.type);
    }

    return publishedURL;
}


    // Makes sure posts that need a title get one
    function checkTitleAndProceed(title) {
        if (title === "Title (Optional)") {
            const userResponse = confirm("Would you like to add a proper title?");
            if (userResponse) {
                // User clicked "Yes"
                alert("Please enter a title (top of the 'write' pane) and then click 'Publish' again.");
                return; // Stop function execution
            }
            // If user clicked "No", continue execution
        }
    }

