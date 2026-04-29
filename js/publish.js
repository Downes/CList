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

//
// Define handlers for each publisher
//
// Definition:
//
//      The publishHandlers registry maps account types to publisher objects.
//      Each publisher must implement:
//
//          publish: async (accountData, title, content) => publishedURL | null
//
//      accountData — the full parsed account object (type, instance, id, permissions, title, …)
//      title       — the write-pane title (may contain HTML; strip if the service requires plain text)
//      content     — the post body (may contain HTML; handler is responsible for any stripping)
//      returns     — the URL of the published post as a string, or null if not applicable
//
//      Register a publisher in the relevant service .js file:
//
//          (function () {
//              window.publishHandlers = window.publishHandlers || {};
//              window.publishHandlers['ServiceType'] = {
//                  publish: async (accountData, title, content) => {
//                      // call the service API …
//                      return publishedURL; // or null
//                  }
//              };
//          })();
//

window.publishHandlers = window.publishHandlers || {};

//
// Define handlers for each save destination
//
//      The saveHandlers registry is an ordered array of saver objects displayed
//      in the right-pane Save list. Each saver must have:
//
//          label  {string}   Display name shown in the list
//          icon   {string}   Material Icons name (or logoSrc for a masked SVG)
//          save   async () => void
//
//      Register a saver from any service .js file:
//
//          (function () {
//              window.saveHandlers = window.saveHandlers || [];
//              window.saveHandlers.push({
//                  label: 'Save to My Service',
//                  icon:  'cloud_upload',
//                  save:  async () => { /* save logic here */ }
//              });
//          })();
//

window.saveHandlers = window.saveHandlers || [];

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
            showStatusMessage('Error getting accounts: ' + error.message);
        }
    }

    populatePostOptions(accounts); // Populate UI with options to save
    openRightInterface('post-instructions');

}

async function playSave() {
    populateSaveOptions();
    openRightInterface('save-instructions');
}


// Function to populate the post panel with account options
function populatePostOptions(accounts) {
    const postOptionsDiv = document.getElementById('post-options');
    postOptionsDiv.innerHTML = '';

    postOptionsDiv.appendChild(makeAccountList(
        'Select accounts to publish to',
        accounts,
        v => v.permissions.includes('w'),
        (key, parsedValue, btn) => {
            const isSelected = btn.getAttribute('data-selected') === 'true';
            btn.setAttribute('data-selected', isSelected ? 'false' : 'true');
            btn.classList.toggle('selected', !isSelected);
        }
    ));

    const finalPostOption = document.createElement('button');
    finalPostOption.textContent = 'Publish';
    finalPostOption.id = 'final-post-button';
    finalPostOption.className = 'final-save-button';
    postOptionsDiv.appendChild(finalPostOption);

    finalPostOption.onclick = async function() {
        await postAll();
    };
}

function populateSaveOptions() {
    const saveOptionsDiv = document.getElementById('save-options');
    saveOptionsDiv.innerHTML = '';

    const list = document.createElement('div');
    list.className = 'account-list';

    const tip = document.createElement('div');
    tip.className = 'list-tip';
    tip.textContent = 'Select a destination to save to';
    list.appendChild(tip);

    saveHandlers.forEach(handler => {
        const btn = document.createElement('button');
        btn.className = 'account-button';

        const iconEl = document.createElement('span');
        if (handler.logoSrc) {
            iconEl.className = 'service-icon-img';
            iconEl.style.webkitMask = `url('${handler.logoSrc}') no-repeat center / contain`;
            iconEl.style.mask = `url('${handler.logoSrc}') no-repeat center / contain`;
        } else {
            iconEl.className = 'material-icons';
            iconEl.textContent = handler.icon || 'save';
        }

        const nameEl = document.createElement('span');
        nameEl.textContent = handler.label;

        btn.appendChild(iconEl);
        btn.appendChild(nameEl);

        btn.addEventListener('click', async () => {
            await handler.save();
            closeRightPane();
        });

        list.appendChild(btn);
    });

    saveOptionsDiv.appendChild(list);
}


async function postAll() {

    const post = await packagePost();
    const writeColumnTitle = document.getElementById('write-title').innerText.trim();
    const resultDiv = document.getElementById('post-result');
    resultDiv.innerHTML = '';

    const allAccounts = await getAccounts(flaskSiteUrl);

    // Collect selected accounts with char limits, sorted highest-first so the
    // fullest version is published first and its URL is available for short-form posts
    const selectedButtons = document.querySelectorAll('#post-options .account-button[data-selected="true"]');
    const selectedAccounts = Array.from(selectedButtons)
        .map(btn => {
            const key = btn.getAttribute('data-key');
            const account = allAccounts.find(acc => acc.key === key);
            if (!account) return null;
            const accountData = parseAccountValue(account);
            if (!accountData) return null;
            const parts = accountData.permissions.split(' ');
            const charLimit = (parts.length > 1 && !isNaN(parseInt(parts[1], 10)))
                ? parseInt(parts[1], 10)
                : 1000000;
            return { key, charLimit };
        })
        .filter(Boolean)
        .sort((a, b) => b.charLimit - a.charLimit);

    let publishedURL = null;

    for (const selected of selectedAccounts) {
        const account = allAccounts.find(acc => acc.key === selected.key);
        if (!account) continue;

        const accountData = parseAccountValue(account);
        if (!accountData) continue;
        const charLimit = selected.charLimit;
        const handler = publishHandlers[accountData.type];
        if (!handler || typeof handler.publish !== 'function') {
            showPostMessage(resultDiv, `No publish handler registered for account type: ${accountData.type}`);
            continue;
        }

        // Build candidate text: use handler.construct() if defined, otherwise raw post HTML
        const candidateText = (typeof handler.construct === 'function')
            ? handler.construct(writeColumnTitle, post)
            : post;

        let contentToPost;
        if (candidateText.length <= charLimit) {
            // Fits: publish as-is
            contentToPost = candidateText;
        } else if (publishedURL) {
            // Too long but we have a URL: assemble "title/opening + see [url]" within limit
            const ref = `see ${publishedURL}`;
            const baseText = writeColumnTitle ? removeHtml(writeColumnTitle) : removeHtml(post);
            const maxBaseLen = charLimit - ref.length - 1; // -1 for the space separator
            const prefix = maxBaseLen > 0 ? baseText.substring(0, maxBaseLen) : '';
            contentToPost = (prefix ? prefix + ' ' : '') + ref;
        } else {
            // Too long and no URL to reference: warn and truncate
            showPostMessage(resultDiv,
                `Post exceeds the ${charLimit}-character limit for "${accountData.title || accountData.type}" and will be truncated.`
            );
            contentToPost = candidateText.substring(0, charLimit);
        }

        const url = await handler.publish(accountData, writeColumnTitle, contentToPost);
        if (url && !publishedURL) publishedURL = url;
    }
}

function showPostMessage(div, text) {
    const p = document.createElement('p');
    p.className = 'feed-status-message';
    p.textContent = text;
    div.appendChild(p);
}

// Dispatch publishing to the registered handler for the account type
async function postContentByType(accountData, title, content) {
    const handler = publishHandlers[accountData.type];
    if (!handler || typeof handler.publish !== 'function') {
        showStatusMessage('No publish handler registered for account type: ' + accountData.type);
        return null;
    }
    return await handler.publish(accountData, title, content);
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

