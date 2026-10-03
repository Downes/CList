//  reader.js  -  helper and utility functions for the feed reader
//  Part of CList, the next generation of learning and connecting with your community
//
//  Version version 0.1 created by Stephen Downes on January 27, 2025
//
//  Copyright Stephen Downes 2025, downes.ca
//  Licensed under Creative Commons Attribution 4.0 International https://creativecommons.org/licenses/by/4.0/
//
//  This software carries NO WARRANTY OF ANY KIND.
//  This software is provided "AS IS," and you, its user, assume all risks when using it.
// 


// 
// Define handlers for each reader
//
// Definition:
// 
//      Readers are defined as objects that pass content to the feed reader in a standardized format
//      The readerHandlers object contains a set of handlers for each type of reader
//      Each handler must have the following methods:
//          initialize:  Initialize the reader
//          feedFunctions:  A set of functions that the reader supports
//          statusActions:  A set of actions that can be taken on a status item

//      The readerHandlers object is used to call the appropriate methods for the current reader.
//      Usage:
//      
//      Add an reader to the readerHandlers object as follows:
//          (function () {
//              const serviceHandler = {
//                   initialize: async (instance,id) => {    // Initialize the reader    
                                                             // Values for instance and id
                                                             // are passed in from the accounts array               
//                   },
//                   feedFunctions: {                        // Feed functions
//                       'Funcname': function() { },           // Name of the function, which will appear as a button
//                       'Funcname2': function() { }          // Name of the function, which will appear as a button
//                   },
//                   statusActions: (item,itemID,itemLink) => {   // Status actions - icons below each status item
//                   },
//                   search: () => {                         // Search (optional)
//                   },
//               };
//               editorHandlers['service'] = serviceHandler;
//           })();
// 
//      The readerHandlers object is used to call the appropriate methods for the current editor.
//      Usage:
//
//      const handler = readerHandlers[currentReader];
//      if (handler && typeof handler.getContent === 'function') {
//         const buttons = handler.feedFunctions();
//      }
//



const leftContent = document.getElementById('left-content');
if (!leftContent) { console.error('Element with ID "left-content" not found.'); }

// Ensure readerHandlers exists
if (typeof window.CList.readers === 'undefined') {
    window.CList.readers = {};
}

// Opaque type for HTML that has been sanitized. makeListing requires this for full_content.
// Produce via sanitizeHtml() (rss.js) or any sanitizer that returns new SafeHtml(html).
class SafeHtml {
    constructor(html) { this._html = String(html == null ? '' : html); }
    toString() { return this._html; }
}
window.SafeHtml = SafeHtml;

// escapeHtml is defined in utilities.js
const _he = escapeHtml;

// Escape a plain-text value for use inside a JS string literal delimited by single quotes.
function _heJs(s) {
    return String(s == null ? '' : s)
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'");
}


// Returns a DOM element for the icon appropriate for the given account type.
function accountIcon(type) {
    if (type === 'Mastodon') {
        const span = document.createElement('span');
        span.className = 'account-icon-img';
        span.setAttribute('aria-label', 'Mastodon');
        return span;
    }
    if (type === 'OPML') {
        const span = document.createElement('span');
        span.className = 'account-icon-img account-icon-img--opml';
        span.setAttribute('aria-label', 'OPML');
        return span;
    }
    const materialIcons = {
        'Bluesky':   'cloud',
        'RSS':       'rss_feed',
        'WordPress': 'article',
        'Blogger':   'article',
    };
    const span = document.createElement('span');
    span.className = 'material-icons';
    span.textContent = materialIcons[type] || 'account_circle';
    return span;
}

// Builds and returns a styled account-list div.
function finderString() {
    const findInput = document.getElementById('find-input');
    const searchString = findInput ? findInput.value.trim() : '';
    if (!searchString) { showStatusMessage('Please enter a search term.'); return; }
    return searchString;
}

  




// This function starts up the reader in the reader div 'read-section'
//  (with some commands located in 'left-content')


async function playRead() {
    openLeftInterface(readPanel());

    if (!Array.isArray(window.CList.accounts)) {
        throw new Error('Error: Accounts array not found; maybe you need to log in.');
    }

    try {
        if (!window.CList.accounts || window.CList.accounts.length === 0) {
            window.CList.accounts = await getAccounts(window.CList.config.flaskSiteUrl);
        }
        populateReadAccountList(window.CList.accounts);
    } catch (error) {
        showStatusMessage('Could not load accounts — try logging out and back in. ' + error.message);
    }
}

// Returns the Read panel element (created on demand)
function readPanel() {
    const div = document.createElement('div');
    div.id = 'read-section';
    div.innerHTML = `
        <div id="read-account-list"></div>
        <div id="select-account"></div>
        <div id="account-status"></div>
    `;
    return div;
}


// playFind

function playFind() {
    openLeftInterface(findPanel());
}

// Returns the Find panel element (created on demand)
function findPanel() {
    const div = document.createElement('div');
    div.id = 'find-section';

    const input = document.createElement('input');
    input.type = 'text';
    input.id = 'find-input';
    input.className = 'find-input';
    input.placeholder = 'Search term…';
    div.appendChild(input);

    const list = document.createElement('div');
    list.className = 'account-list';

    const tip = document.createElement('div');
    tip.className = 'list-tip';
    tip.textContent = 'Enter search term and select service';
    list.appendChild(tip);

    Object.entries(window.CList.readers).forEach(([key, handler]) => {
        if (typeof handler.search !== 'function') return;
        const btn = document.createElement('button');
        btn.className = 'account-button';
        btn.addEventListener('click', () => {
            Promise.resolve(handler.search()).catch(e => {
                showStatusMessage('Search failed: ' + e.message);
                console.error('Search error:', e);
            });
        });

        let iconEl;
        if (handler.logoSrc) {
            iconEl = document.createElement('span');
            iconEl.className = 'service-icon-img';
            iconEl.style.mask = `url('${handler.logoSrc}') no-repeat center / contain`;
        } else {
            iconEl = document.createElement('span');
            iconEl.className = 'material-icons';
            iconEl.textContent = handler.icon || 'search';
        }

        const nameEl = document.createElement('span');
        nameEl.textContent = handler.label || key;

        btn.appendChild(iconEl);
        btn.appendChild(nameEl);
        list.appendChild(btn);
    });

    div.appendChild(list);
    return div;
}


// Function to populate the read account list
function populateReadAccountList(accounts) {
    const accountList = document.getElementById('read-account-list');
    if (!accountList) return;
    accountList.innerHTML = '';

    const list = makeAccountList(
        'Select an account to read',
        accounts,
        v => v.permissions.includes('r') && v.type !== 'Annotate' && v.type !== 'Hypothesis',
        key => switchReaderAccount(key)
    );

    // Annotations require a real, network-reachable kvstore for annotations.mooc.ca to verify
    // the token against — not available to a Local-only account (see local-kvstore.js).
    if (!(window.CList.isLocalMode && window.CList.isLocalMode())) {
        const annotBtn = document.createElement('button');
        annotBtn.className = 'account-button';
        annotBtn.onclick = () => window.showAnnotations('all');
        const annotIcon = document.createElement('span');
        annotIcon.className = 'material-icons';
        annotIcon.textContent = 'rate_review';
        const annotLabel = document.createElement('span');
        annotLabel.textContent = 'Annotations';
        annotBtn.appendChild(annotIcon);
        annotBtn.appendChild(annotLabel);
        list.insertBefore(annotBtn, list.children[1]);
    }

    accountList.appendChild(list);

    // Kick off background RSS fetches so feeds are ready before the user clicks
    if (typeof rssBackgroundFetchAll === 'function') {
        rssBackgroundFetchAll(accounts);
    }
}


    
// Function to switch accounts
async function switchReaderAccount(key) {
    const selectedAccount = window.CList.accounts.find(acc => acc.key === key);
    const accountData = parseAccountValue(selectedAccount);
    if (!accountData) { showStatusMessage('Could not read account data — it may be corrupt.'); return; }
    const instanceType = accountData.type;
    const handler = window.CList.readers[instanceType];

    if (!handler) {
        console.error('Unsupported instance type:', instanceType);
        showStatusMessage(`"${instanceType}" accounts are not supported as a reader — check your account type.`);
        return;
    }

    setupFeedButtons(instanceType);
    window.CList.ui.view.feedContainer.innerHTML = '';

    try {
        if (typeof handler.initialize === 'function') {
            await handler.initialize(accountData);
        }
    } catch (err) {
        console.error('Error loading feed:', err);
        showServiceError('feed-container', 'Could not load feed', err.message,
            'Try selecting the account again, or check your network connection.');
    }

    // Clear status after some time
    setTimeout(() => {
        document.getElementById('account-status').innerHTML = '';
        document.getElementById('account-status').style.display = 'none';
    }, 5000);

    const selectedAccountDiv = document.getElementById('selectedAccount');
    if (selectedAccountDiv) {
        selectedAccountDiv.innerHTML = '';
        selectedAccountDiv.appendChild(accountIcon(instanceType));
        selectedAccountDiv.appendChild(document.createTextNode(accountData.title));
    }
}

